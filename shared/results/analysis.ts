// Phân tích thường lưu trên tài khoản: dạng dữ liệu, tên tệp xuất, và dạng gọn để hiển thị danh sách.
import type { AnalysisResult } from "../types.ts";
import { PASS_SCORE } from "../types.ts";

/** Nội dung lưu cho một lượt phân tích: kết quả và tên tệp, KHÔNG có tệp hay toàn văn. */
export interface SavedAnalysis { v: 1; fileName: string; project: string; at: string; res: AnalysisResult }

export const isSavedAnalysis = (x: unknown): x is SavedAnalysis => {
  const r = x as SavedAnalysis | null;
  return !!r && r.v === 1 && typeof r.fileName === "string" && !!r.res && typeof r.res.score === "number" && !!r.res.breakdown && !!r.res.meta && Array.isArray(r.res.passages);
};

/** Tên hiển thị trong danh sách: nhan đề tài liệu nếu có, không thì tên tệp. */
export const analysisName = (s: SavedAnalysis) => (s.res.meta.title || s.fileName || "Tai-lieu").slice(0, 300);
/** Nhãn ngắn lưu kèm để lọc/hiển thị mà không cần mở cả bản: "pass" hoặc "fail" theo ngưỡng 60. */
export const analysisLabel = (s: SavedAnalysis) => (s.res.score >= PASS_SCORE ? "pass" : "fail");

export function analysisFileName(s: SavedAnalysis, lang: "vi" | "en" = "vi"): string {
  const base = String(s.fileName || s.res.meta.title || "tai-lieu").replace(/\.(docx?|pdf)$/i, "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "tai-lieu";
  return `${lang === "en" ? "Analysis" : "Phan-tich"} - ${base}.docx`;
}
