// Văn bản công trình dạng các khối có đánh số đoạn [¶n], và kiểm chứng máy móc các đoạn trích nguyên văn.
export type BlockKind = "p" | "heading" | "bold" | "li" | "row";
export interface RawBlock { kind: BlockKind; text: string; level?: number; depth?: number; cells?: string[]; page?: number }
export interface Block extends RawBlock { n: number }

/** Gắn số đoạn tăng dần cho các khối. */
export const numberBlocks = (blocks: RawBlock[]): Block[] => blocks.map((b, i) => ({ ...b, n: i + 1 }));

export function blockLine(b: Block): string {
  switch (b.kind) {
    case "heading": return `[¶${b.n}] ${"#".repeat(b.level ?? 1)} ${b.text}`;
    case "bold": return `[¶${b.n}] **${b.text}**`;
    case "li": return `[¶${b.n}] ${"  ".repeat(b.depth ?? 0)}• ${b.text}`;
    case "row": return `[¶${b.n}] | ${(b.cells ?? []).join(" | ")} |`;
    default: return `[¶${b.n}] ${b.text}`;
  }
}

/** Văn bản gửi mô hình; có số trang khi biết (PDF). */
export function corpusToText(blocks: Block[]): string {
  let page = 0;
  const out: string[] = [];
  for (const b of blocks) {
    if (b.page && b.page !== page) { page = b.page; out.push(`--- trang ${page} ---`); }
    out.push(blockLine(b));
  }
  return out.join("\n");
}

export const corpusChars = (blocks: Block[]) => blocks.reduce((s, b) => s + b.text.length + 8, 0);
export const countWords = (blocks: Block[]) => blocks.reduce((s, b) => s + (b.text.match(/\S+/g) ?? []).length, 0);

/** Mục lục: các tiêu đề và dòng in đậm kèm số đoạn. */
export const outlineOf = (blocks: Block[]) =>
  blocks.filter((b) => b.kind === "heading" || b.kind === "bold").map((b) => `[¶${b.n}] ${b.text}`).slice(0, 400).join("\n");

const norm = (s: string) => String(s).normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export interface Span { start: number; end: number; n: number; page?: number }
export interface Index { hay: string; spans: Span[] }

export function buildIndex(blocks: Block[]): Index {
  const parts: string[] = [];
  const spans: Span[] = [];
  let offset = 0;
  for (const b of blocks) {
    const t = norm(b.kind === "row" ? (b.cells ?? []).join(" ") : b.text);
    spans.push({ start: offset, end: offset + t.length, n: b.n, page: b.page });
    parts.push(t);
    offset += t.length + 1;
  }
  return { hay: parts.join(" "), spans };
}

export interface Location { paragraph: number; page?: number }

/** Trả về { ok, location }; location là đoạn thật chứa trích dẫn (không tin vị trí do mô hình tự khai). */
export function verifyQuote(index: Index, quote: unknown): { ok: boolean; location: Location | null } {
  const pieces = String(quote ?? "").split(/…|\.{3,}/).map(norm).filter((p) => p.split(" ").filter(Boolean).length >= 3);
  if (pieces.length === 0) return { ok: false, location: null };
  let from = 0;
  let first = -1;
  for (const p of pieces) {
    const at = index.hay.indexOf(p, from);
    if (at < 0) return { ok: false, location: null };
    if (first < 0) first = at;
    from = at + p.length;
  }
  const span = index.spans.find((s) => first >= s.start && first <= s.end);
  return { ok: true, location: span ? { paragraph: span.n, ...(span.page ? { page: span.page } : {}) } : null };
}

/** Lọc danh sách bằng chứng; trả về bằng chứng đã xác thực và số bị loại. */
export function verifyEvidence(index: Index, evidence: { quote?: string; note?: string }[] = []) {
  const kept: { quote: string; note: string; paragraph?: number; page?: number }[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  for (const e of evidence ?? []) {
    const q = String(e?.quote ?? "").trim();
    if (!q) continue;
    const v = verifyQuote(index, q);
    if (!v.ok) { dropped++; continue; }
    const key = norm(q);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ quote: q, note: e.note ?? "", ...v.location });
  }
  return { kept, dropped };
}
