// Trích văn bản ngay trong trình duyệt: tệp không rời khỏi máy người dùng (chỉ văn bản đã trích được gửi đi để phân tích).
// Cách này tiết kiệm băng thông (văn bản nhẹ hơn tệp gốc nhiều lần), tránh giới hạn thân yêu cầu 4,5 MB của Vercel
// và bảo đảm hệ thống không lưu tài liệu. PDF: pdf.js (Apache-2.0). DOCX: mammoth (BSD-2). DOC: máy chủ (word-extractor, MIT).
import { MAX_FILE_BYTES } from "../../shared/types.ts";
import { extractDoc } from "./api.ts";

export type ExtractError = "type" | "size" | "empty" | "no_text" | "corrupt";
export class ExtractFailure extends Error { constructor(public code: ExtractError) { super(code); } }

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

async function pdfText(buf: ArrayBuffer, onProgress: (p: number) => void): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await task.promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let line = "";
    for (const it of tc.items as { str: string; hasEOL?: boolean }[]) {
      line += it.str + (it.hasEOL ? "\n" : " ");
    }
    out.push(`[[p.${i}]]\n${line}`);
    onProgress(i / doc.numPages);
    page.cleanup();
  }
  await task.destroy();
  return out.join("\n");
}

async function docxText(buf: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser")).default as { extractRawText(o: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> };
  return (await mammoth.extractRawText({ arrayBuffer: buf })).value;
}

export async function extractText(file: File, onProgress: (p: number) => void = () => {}): Promise<{ text: string; kind: Kind }> {
  if (file.size === 0) throw new ExtractFailure("empty");
  if (file.size > MAX_FILE_BYTES) throw new ExtractFailure("size");
  const kind = await sniff(file);
  let text = "";
  try {
    if (kind === "pdf") text = await pdfText(await file.arrayBuffer(), onProgress);
    else if (kind === "docx") text = await docxText(await file.arrayBuffer());
    else text = (await extractDoc(file)).text;
  } catch (e) {
    if (e instanceof ExtractFailure) throw e;
    throw new ExtractFailure("corrupt");
  }
  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.replace(/\[\[p\.\d+\]\]/g, "").trim().length < 400) throw new ExtractFailure("no_text"); // PDF quét ảnh, không có lớp chữ
  return { text, kind };
}
