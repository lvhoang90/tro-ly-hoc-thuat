// Đọc công trình/mẫu ngay trong trình duyệt thành các khối văn bản (đoạn, tiêu đề, danh sách, bảng) kèm số trang với PDF.
// Tệp không rời khỏi máy; chỉ văn bản đã đánh số đoạn được gửi đi. DOCX: mammoth; PDF: pdf.js + dựng lại đoạn văn.
import { MAX_FILE_BYTES } from "../../shared/types.ts";
import { countWords, type RawBlock } from "../../shared/review/corpus.ts";
import { layoutPdfPages, pdfTextProblem, type PdfItem } from "../../shared/review/layout.ts";
import { classifyReadError, errorDetail } from "./extract-errors.ts";
import { ExtractFailure, openPdf, readBytes, sniff } from "./extract.ts";

export interface ReadDoc { blocks: RawBlock[]; chars: number; words: number; pages?: number }

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** HTML do mammoth → các khối văn bản. */
export function htmlToBlocks(html: string): RawBlock[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll("img").forEach((i) => i.replaceWith(" [hình/biểu đồ] "));
  const blocks: RawBlock[] = [];
  const push = (kind: RawBlock["kind"], text: string, extra: Partial<RawBlock> = {}) => {
    const t = clean(text);
    if (t) blocks.push({ kind, text: t, ...extra });
  };
  const walkList = (el: Element, depth: number) => {
    for (const li of Array.from(el.children).filter((c) => c.tagName === "LI")) {
      const own = li.cloneNode(true) as Element;
      own.querySelectorAll(":scope > ul, :scope > ol").forEach((n) => n.remove());
      push("li", own.textContent ?? "", { depth });
      li.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => walkList(sub, depth + 1));
    }
  };
  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) push("heading", el.textContent ?? "", { level: Number(tag[1]) });
    else if (tag === "p") {
      const inner = el.innerHTML.trim();
      const allBold = /^<strong>[\s\S]*<\/strong>$/.test(inner) && !/<\/strong>[\s\S]*<strong>/.test(inner);
      push(allBold ? "bold" : "p", el.textContent ?? "");
    } else if (tag === "ul" || tag === "ol") walkList(el, 0);
    else if (tag === "table") {
      el.querySelectorAll("tr").forEach((tr) => {
        const cells = Array.from(tr.children).filter((c) => c.tagName === "TD" || c.tagName === "TH").map((c) => clean(c.textContent ?? ""));
        if (cells.some(Boolean)) push("row", cells.join(" | "), { cells: cells.map((c) => c || "[ô trống]") });
      });
    } else push("p", el.textContent ?? "");
  }
  return blocks;
}

const stats = (blocks: RawBlock[], pages?: number): ReadDoc => ({
  blocks, chars: blocks.reduce((s, b) => s + b.text.length + 8, 0), words: countWords(blocks.map((b, n) => ({ ...b, n }))), ...(pages ? { pages } : {}),
});

async function docxBlocks(buf: ArrayBuffer): Promise<RawBlock[]> {
  const mammoth = (await import("mammoth/mammoth.browser")).default as {
    convertToHtml(o: { arrayBuffer: ArrayBuffer }, opts: unknown): Promise<{ value: string }>;
    images: { imgElement(f: () => Promise<{ src: string; alt: string }>): unknown };
  };
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf }, { convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "x", alt: "[hình/biểu đồ]" })) });
  return htmlToBlocks(value);
}

async function pdfBlocks(buf: ArrayBuffer, onProgress: (done: number, total: number) => void): Promise<{ blocks: RawBlock[]; pages: number }> {
  const { task, doc } = await openPdf(buf);
  const pages: PdfItem[][] = [];
  const texts: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const items = (tc.items as { str?: string; transform?: number[]; height?: number; width?: number }[])
        .filter((it) => typeof it.str === "string" && it.transform)
        .map((it) => ({ str: it.str as string, x: it.transform![4], y: it.transform![5], h: it.height || Math.abs(it.transform![3]) || 0, w: it.width || 0 }));
      pages.push(items);
      texts.push(items.map((x) => x.str).join(" "));
      onProgress(i, doc.numPages);
      page.cleanup();
    }
  } finally { await task.destroy(); }
  const problem = pdfTextProblem(texts);
  if (problem) throw new ExtractFailure(problem === "scan" ? "no_text" : "corrupt", "pdf");
  return { blocks: layoutPdfPages(pages), pages: pages.length };
}

/** Đọc một công trình hoặc mẫu (.docx hoặc PDF có lớp chữ). */
export async function readReviewDoc(file: File, onProgress: (done: number, total: number) => void = () => {}, minChars = 400): Promise<ReadDoc> {
  if (file.size === 0) throw new ExtractFailure("empty");
  if (file.size > MAX_FILE_BYTES) throw new ExtractFailure("size");
  const kind = await sniff(file);
  if (kind === "doc") throw new ExtractFailure("type");
  try {
    const buf = await readBytes(file);
    let blocks: RawBlock[]; let pages: number | undefined;
    if (kind === "pdf") ({ blocks, pages } = await pdfBlocks(buf, onProgress));
    else blocks = await docxBlocks(buf);
    const doc = stats(blocks, pages);
    if (doc.blocks.length === 0 || doc.chars < minChars) throw new ExtractFailure("no_text", kind);
    return doc;
  } catch (e) {
    if (e instanceof ExtractFailure) throw e;
    console.error("review read failed", e);
    throw new ExtractFailure(classifyReadError(e), kind, errorDetail(e));
  }
}
