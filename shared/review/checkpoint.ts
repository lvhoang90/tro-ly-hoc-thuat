// Điểm lưu của một lượt phản biện đang dở, để "Thử lại" nối tiếp từ phần đã xong thay vì làm lại và tốn thêm lượt.
// Chỉ lưu ở trình duyệt; mã lượt (token) có hiệu lực 3 giờ nên điểm lưu hết hạn sau 2,5 giờ.
export interface Checkpoint { v: 1; fp: string; token: string; at: number; sections: unknown[]; overall: unknown; model: string }
export interface PendingFail { token: string; fp: string; at: number }

export const CKPT_TTL_MS = 2.5 * 3600_000;
export const TOKEN_TTL_MS = 3 * 3600_000;
export const MAX_CKPTS = 3;

/** Dấu vân tay của (văn bản, khung mẫu, bối cảnh): khác một ký tự là coi như lượt khác. */
export function fingerprint(corpus: string, template: unknown, meta: unknown): string {
  const s = `${corpus}\u0000${JSON.stringify(template)}\u0000${JSON.stringify(meta)}`;
  let h1 = 0x811c9dc5, h2 = 5381;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = (Math.imul(h2, 33) + c) >>> 0; }
  return `${s.length.toString(36)}-${h1.toString(36)}-${h2.toString(36)}`;
}

export const doneSectionIds = (sections: unknown[]): Set<string> =>
  new Set(sections.map((s) => (s as { section_id?: unknown })?.section_id).filter((x): x is string => typeof x === "string"));

/** Bỏ các mục đã có kết quả; mỗi lô còn lại giữ nguyên thứ tự, lô trống bị bỏ. */
export const pendingBatches = (batches: string[][], done: Set<string>): string[][] => batches.map((b) => b.filter((id) => !done.has(id))).filter((b) => b.length > 0);

const fresh = (c: Checkpoint, now: number) => c && c.v === 1 && typeof c.token === "string" && now - c.at < CKPT_TTL_MS && now >= c.at - 60_000;

export function parseCheckpoints(raw: string | null, now: number): Checkpoint[] {
  try { const v = JSON.parse(raw ?? "[]"); return Array.isArray(v) ? v.filter((c) => fresh(c, now) && typeof c.fp === "string" && Array.isArray(c.sections)).slice(0, MAX_CKPTS) : []; } catch { return []; }
}
export const findCheckpoint = (list: Checkpoint[], fp: string): Checkpoint | null => list.find((c) => c.fp === fp) ?? null;
export const putCheckpoint = (list: Checkpoint[], c: Checkpoint): Checkpoint[] => [c, ...list.filter((x) => x.fp !== c.fp)].slice(0, MAX_CKPTS);
export const dropCheckpoint = (list: Checkpoint[], fp: string): Checkpoint[] => list.filter((c) => c.fp !== fp);

export function parsePending(raw: string | null, now: number): PendingFail[] {
  try { const v = JSON.parse(raw ?? "[]"); return Array.isArray(v) ? v.filter((p) => p && typeof p.token === "string" && now - p.at < TOKEN_TTL_MS) : []; } catch { return []; }
}
