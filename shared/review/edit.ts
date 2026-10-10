// Sửa bản nhận xét ngay trên màn hình: cập nhật điểm thì tổng điểm, khuyến nghị và cảnh báo được tính lại bằng mã.
import type { ReviewResult } from "./assemble.ts";
import { UNSCORED, clamp, computeScore, decide, round1 } from "./rubric.ts";

/** Tính lại tổng điểm (thang 100) và khuyến nghị từ bảng điểm hiện có. Chưa có điểm thành phần thì giữ trạng thái "chưa có điểm". */
export function recompute(r: ReviewResult): ReviewResult {
  const sc = computeScore(r.score.rows);
  const decision = sc.sumMax ? decide(sc.score100, r.fatalDefects) : UNSCORED;
  return { ...r, score: { ...r.score, rows: sc.rows, sum: sc.sum, sumMax: sc.sumMax, score100: sc.score100 }, decision: { ...decision, mismatch: null } };
}

/** Đặt điểm của một dòng trong bảng điểm (kẹp trong 0..tối đa); với điểm theo mẫu thì đồng bộ điểm của mục tương ứng. */
export function setRowPoints(r: ReviewResult, index: number, value: number): ReviewResult {
  const row = r.score.rows[index];
  if (!row) return r;
  const points = round1(clamp(value, 0, row.max));
  const rows = r.score.rows.map((x, i) => (i === index ? { ...x, points } : x));
  const sections = r.score.scheme === "template" && row.id ? r.sections.map((s) => (s.id === row.id ? { ...s, points } : s)) : r.sections;
  return recompute({ ...r, score: { ...r.score, rows }, sections });
}

/** Mỗi dòng một ý (bỏ dòng trống) ↔ danh sách. */
export const linesToList = (text: string): string[] => text.split("\n").map((x) => x.trim()).filter(Boolean);
export const listToLines = (list: string[]): string => list.join("\n");
