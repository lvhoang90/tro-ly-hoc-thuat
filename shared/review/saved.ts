// Danh sách bản nhận xét đã lưu ở trình duyệt: lọc theo tên, sắp xếp, và loại bỏ mục hỏng (không đọc được thì bỏ qua, không làm hỏng cả trang).
export type SortMode = "new" | "old" | "score_hi" | "score_lo" | "name";
export interface SavedLike { id: string; at: string; result: { file: { name: string }; score: { score100: number; sumMax: number } } }

export const SORT_MODES: readonly SortMode[] = ["new", "old", "score_hi", "score_lo", "name"];

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d");
const scoreOf = (x: SavedLike) => (x.result.score.sumMax ? x.result.score.score100 : -1);
const time = (x: SavedLike) => { const t = Date.parse(x.at); return Number.isFinite(t) ? t : 0; };

/** Chỉ giữ mục đủ trường cần dùng để hiển thị và tải. */
export function isUsable(x: unknown): x is SavedLike {
  const r = x as SavedLike | null;
  return !!r && typeof r.id === "string" && typeof r.at === "string" && !!r.result && typeof r.result.file?.name === "string" && typeof r.result.score?.score100 === "number" && typeof r.result.score?.sumMax === "number";
}

/** Lọc theo tên tệp, không phân biệt hoa thường và dấu tiếng Việt. */
export function filterSaved<T extends SavedLike>(list: T[], q: string): T[] {
  const k = fold(q.trim());
  return k ? list.filter((x) => fold(x.result.file.name).includes(k)) : list;
}

export function sortSaved<T extends SavedLike>(list: T[], mode: SortMode): T[] {
  const a = [...list];
  const byName = (x: T, y: T) => x.result.file.name.localeCompare(y.result.file.name, "vi");
  if (mode === "old") a.sort((x, y) => time(x) - time(y));
  else if (mode === "score_hi") a.sort((x, y) => scoreOf(y) - scoreOf(x) || time(y) - time(x));
  else if (mode === "score_lo") a.sort((x, y) => (scoreOf(x) < 0 ? 1 : 0) - (scoreOf(y) < 0 ? 1 : 0) || scoreOf(x) - scoreOf(y) || time(y) - time(x));
  else if (mode === "name") a.sort(byName);
  else a.sort((x, y) => time(y) - time(x));
  return a;
}
