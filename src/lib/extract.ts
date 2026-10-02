// Trích văn bản ngay trong trình duyệt: tệp không rời khỏi máy người dùng (chỉ văn bản đã trích được gửi đi để phân tích).
// Cách này tiết kiệm băng thông (văn bản nhẹ hơn tệp gốc nhiều lần), tránh giới hạn thân yêu cầu 4,5 MB của Vercel
// và bảo đảm hệ thống không lưu tài liệu. PDF: pdf.js (Apache-2.0). DOCX: mammoth (BSD-2). DOC: máy chủ (word-extractor, MIT).
import { MAX_FILE_BYTES } from "../../shared/types.ts";
import { extractDoc } from "./api.ts";

export type ExtractError = "type" | "size" | "empty" | "no_text" | "corrupt" | "ocr_too_long" | "ocr_failed" | "cancelled";
export class ExtractFailure extends Error { constructor(public code: ExtractError, public kind?: Kind) { super(code); } }

/** OCR (tesseract.js, Apache-2.0) chạy trong trình duyệt, chỉ khi người dùng đồng ý; mô hình ngôn ngữ tải từ CDN và được trình duyệt lưu đệm. */
export const OCR_MAX_PAGES = 60;
const OCR_LANG_PATH = "https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@4.1.0";
export interface Progress { done: number; total: number; phase: "text" | "ocr" | "model" }

export type Kind = "pdf" | "docx" | "doc";

async function sniff(file: File): Promise<Kind> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !["pdf", "doc", "docx"].includes(ext)) throw new ExtractFailure("type");
  const h = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const is = (...b: number[]) => b.every((x, i) => h[i] === x);
  if (ext === "pdf" && is(0x25, 0x50, 0x44, 0x46)) return "pdf";
  if (ext === "docx" && is(0x50, 0x4b)) return "docx";
  if (ext === "doc" && is(0xd0, 0xcf, 0x11, 0xe0)) return "doc";
  throw new ExtractFailure("type"); // đuôi tệp không khớp nội dung
}

async function pdfText(buf: ArrayBuffer, onProgress: (p: Progress) => void, ocr: boolean, signal?: AbortSignal): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await task.promise;
  const out: string[] = [];
  const n = doc.numPages;
  const blank: number[] = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let line = "";
    for (const it of tc.items as { str: string; hasEOL?: boolean }[]) {
      line += it.str + (it.hasEOL ? "\n" : " ");
    }
    out.push(line);
    if (line.trim().length < 25) blank.push(i);
    onProgress({ done: i, total: n, phase: "text" });
    page.cleanup();
  }
  // Trang không có lớp chữ (ảnh quét): chỉ OCR khi người dùng yêu cầu.
  if (ocr && blank.length) {
    if (blank.length > OCR_MAX_PAGES) { await task.destroy(); throw new ExtractFailure("ocr_too_long", "pdf"); }
    onProgress({ done: 0, total: blank.length, phase: "model" });
    const { createWorker } = await import("tesseract.js");
    // Nếu CDN bị chặn hoặc mô hình không tải được, createWorker có thể treo mà không báo lỗi: đặt hạn chót để báo lỗi rõ ràng.
    const worker = await Promise.race([
      createWorker(["eng", "vie"], 1, { langPath: OCR_LANG_PATH, gzip: false }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new ExtractFailure("ocr_failed", "pdf")), 90_000)),
    ]).catch(async (e) => { await task.destroy(); throw e instanceof ExtractFailure ? e : new ExtractFailure("ocr_failed", "pdf"); });
    try {
      for (let k = 0; k < blank.length; k++) {
        if (signal?.aborted) throw new ExtractFailure("cancelled", "pdf");
        const i = blank[k];
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const cv = document.createElement("canvas");
        cv.width = vp.width; cv.height = vp.height;
        await page.render({ canvas: cv, viewport: vp } as never).promise;
        const { data } = await worker.recognize(cv);
        out[i - 1] = data.text;
        cv.width = cv.height = 0;
        onProgress({ done: k + 1, total: blank.length, phase: "ocr" });
        page.cleanup();
      }
    } finally { await worker.terminate(); }
  }
  await task.destroy();
  return out.map((t, i) => `[[p.${i + 1}]]\n${t}`).join("\n");
}

async function docxText(buf: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser")).default as { extractRawText(o: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> };
  return (await mammoth.extractRawText({ arrayBuffer: buf })).value;
}

export async function extractText(file: File, onProgress: (p: Progress) => void = () => {}, opts: { ocr?: boolean; signal?: AbortSignal } = {}): Promise<{ text: string; kind: Kind }> {
  if (file.size === 0) throw new ExtractFailure("empty");
  if (file.size > MAX_FILE_BYTES) throw new ExtractFailure("size");
  const kind = await sniff(file);
  let text = "";
  try {
    if (kind === "pdf") text = await pdfText(await file.arrayBuffer(), onProgress, !!opts.ocr, opts.signal);
    else if (kind === "docx") text = await docxText(await file.arrayBuffer());
    else text = (await extractDoc(file)).text;
  } catch (e) {
    if (e instanceof ExtractFailure) throw e;
    console.error("extract failed", e);
    throw new ExtractFailure("corrupt");
  }
  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.replace(/\[\[p\.\d+\]\]/g, "").trim().length < 400) throw new ExtractFailure("no_text", kind); // PDF quét ảnh, không có lớp chữ
  return { text, kind };
}
