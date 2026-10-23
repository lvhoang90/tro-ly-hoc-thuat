// Danh sách kết quả đã lưu (cục bộ và trên tài khoản): lọc theo tên, sắp xếp, ghép hai nguồn, và loại bỏ mục hỏng.
export type SortMode = "new" | "old" | "score_hi" | "score_lo" | "name";
export const SORT_MODES: readonly SortMode[] = ["new", "old", "score_hi", "score_lo", "name"];

/** Thông tin đủ để hiển thị một dòng: không cần nội dung đầy đủ. `score` null nghĩa là không chấm điểm. */
export interface ResultMeta { id: string; at: string; name: string; score: number | null; label: string }
export interface Row extends ResultMeta { local: boolean; cloud: boolean }

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
const scoreOf = (x: { score: number | null }) => x.score ?? -1;
const time = (x: { at: string }) => { const t = Date.parse(x.at); return Number.isFinite(t) ? t : 0; };

/** Bản lưu cục bộ phải đủ trường cần dùng để hiển thị và tải. */
export function isUsable(x: unknown): boolean {
  const r = x as { id?: unknown; at?: unknown; result?: { file?: { name?: unknown }; score?: { score100?: unknown; sumMax?: unknown } } } | null;
  return !!r && typeof r.id === "string" && typeof r.at === "string" && !!r.result && typeof r.result.file?.name === "string" && typeof r.result.score?.score100 === "number" && typeof r.result.score?.sumMax === "number";
}

/** Lọc theo tên tệp, không phân biệt hoa thường và dấu tiếng Việt. */
export function filterRows<T extends { name: string }>(list: T[], q: string): T[] {
  const k = fold(q.trim());
  return k ? list.filter((x) => fold(x.name).includes(k)) : list;
}

export function sortRows<T extends { name: string; at: string; score: number | null }>(list: T[], mode: SortMode): T[] {
  const a = [...list];
  if (mode === "old") a.sort((x, y) => time(x) - time(y));
  else if (mode === "score_hi") a.sort((x, y) => scoreOf(y) - scoreOf(x) || time(y) - time(x));
  else if (mode === "score_lo") a.sort((x, y) => (x.score == null ? 1 : 0) - (y.score == null ? 1 : 0) || scoreOf(x) - scoreOf(y) || time(y) - time(x));
  else if (mode === "name") a.sort((x, y) => x.name.localeCompare(y.name, "vi"));
  else a.sort((x, y) => time(y) - time(x));
  return a;
}

/** Ghép danh sách trên máy và trên tài khoản theo mã; thông tin trên máy ưu tiên (có thể vừa được sửa). `cloud` null: chưa tải được danh sách. */
export function mergeRows(local: ResultMeta[], cloud: ResultMeta[] | null): Row[] {
  const byId = new Map<string, Row>();
  for (const c of cloud ?? []) byId.set(c.id, { ...c, local: false, cloud: true });
  for (const l of local) { const c = byId.get(l.id); byId.set(l.id, { ...l, local: true, cloud: !!c }); }
  return sortRows([...byId.values()], "new");
}

/** Mã các bản chỉ có trên máy: cần tải lên tài khoản (bản cũ trước khi có tính năng lưu, hoặc lần gửi trước bị lỗi). Rỗng nếu chưa biết danh sách trên tài khoản. */
export const missingInCloud = (local: ResultMeta[], cloud: ResultMeta[] | null): string[] => {
  if (!cloud) return [];
  const have = new Set(cloud.map((c) => c.id));
  return local.filter((l) => !have.has(l.id)).map((l) => l.id);
};
