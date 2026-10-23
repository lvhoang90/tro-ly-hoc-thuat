// Điều phối một lượt phản biện ở trình duyệt (xem review-run.ts): ở đây chỉ nối với mạng (Supabase) và localStorage.
import type { ReviewResult } from "../../shared/review/assemble.ts";
import type { RawBlock } from "../../shared/review/corpus.ts";
import { MAX_SAVED_REVIEWS } from "../../shared/review/limits.ts";
import type { ReviewMeta } from "../../shared/review/prompts.ts";
import { isUsable } from "../../shared/review/saved.ts";
import type { Template } from "../../shared/review/template.ts";
import { ApiFailure, call } from "./api.ts";
import { flushPendingCore, resumeInfoCore, runReviewCore, type Deps, type ReviewQuota, type Stage } from "./review-run.ts";

export type { ReviewQuota, Stage };

const post = <T>(body: unknown) => call<T>("/api/review", { method: "POST", headers: { "content-type": "application/json", "x-ami-keepalive": "1" }, body: JSON.stringify(body) });

export const analyzeTemplate = (text: string) => post<{ template: Template }>({ op: "template", text }).then((r) => r.template);

const deps: Deps = {
  post,
  codeOf: (e) => (e instanceof ApiFailure ? { code: e.info.error, status: e.status } : null),
  makeError: (code, status) => new ApiFailure({ error: code } as never, status),
  read: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  write: (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* bỏ qua */ } },
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/** Chạy toàn bộ một lượt phản biện; lỗi giữa chừng thì "Thử lại" nối tiếp từ phần đã xong (cùng lượt, không tốn thêm). */
export const runReview = (p: Parameters<typeof runReviewCore>[1]) => runReviewCore(deps, p);
/** Lượt đang dở của đúng công trình này (cùng khung mẫu và bối cảnh), hoặc null. */
export const resumeInfo = (p: { blocks: RawBlock[]; meta: ReviewMeta; template: Template }) => resumeInfoCore(deps, p);
/** Gửi lại lệnh hoàn lượt bị mất mạng làm hỏng. */
export const flushPendingFail = () => flushPendingCore(deps);

// ---- Lưu kết quả cục bộ (chỉ trên máy này; máy chủ không giữ nội dung) ----
const KEY = "ami-review-v1";
export interface SavedReview { id: string; at: string; result: ReviewResult }
export function loadSaved(): SavedReview[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter(isUsable) as SavedReview[] : []; } catch { return []; }
}
/** Ghi danh sách xuống trình duyệt; đầy bộ nhớ thì ghi ít bản hơn (bỏ dần bản cũ nhất). Danh sách trả về vẫn đủ để dùng trong phiên này. */
export function persistSaved(list: SavedReview[]): SavedReview[] {
  const all = list.slice(0, MAX_SAVED_REVIEWS);
  let keep = all;
  for (;;) {
    try { localStorage.setItem(KEY, JSON.stringify(keep)); break; } catch {
      if (keep.length <= 1) break; // bị chặn hoặc không đủ chỗ: vẫn giữ trong phiên này
      keep = keep.slice(0, -1);
    }
  }
  return all;
}
let seq = 0;
export function saveReview(result: ReviewResult): SavedReview[] {
  const item = { id: `${Date.now()}-${++seq}`, at: new Date().toISOString(), result };
  return persistSaved([item, ...loadSaved()]);
}
/** Thay một bản đã lưu bằng bản đã sửa (chỉ trong bộ nhớ; ghi xuống bằng persistSaved, có thể gộp nhiều lần sửa). */
export const replaceReview = (list: SavedReview[], id: string, result: ReviewResult): SavedReview[] => list.map((x) => (x.id === id ? { ...x, result } : x));
export function removeReview(id: string): SavedReview[] {
  return persistSaved(loadSaved().filter((x) => x.id !== id));
}
export function clearReviews() { try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ } }
