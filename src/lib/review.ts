// Điều phối một lượt phản biện ở trình duyệt: mỗi lần gọi máy chủ là một bước ngắn (nhận xét một lô mục, hoặc phần tổng hợp),
// nên không vướng giới hạn thời gian của hàm máy chủ. Văn bản công trình được gửi lại ở từng bước nhưng chỉ tính tiền một lần nhờ bộ nhớ đệm.
import { assemble, sectionDigest, type ReviewResult } from "../../shared/review/assemble.ts";
import { corpusToText, numberBlocks, type RawBlock } from "../../shared/review/corpus.ts";
import { MAX_REVIEW_CHARS, MAX_SAVED_REVIEWS, SECTIONS_PER_CALL } from "../../shared/review/limits.ts";
import type { ReviewMeta } from "../../shared/review/prompts.ts";
import { corpusChars } from "../../shared/review/corpus.ts";
import { sectionBatches, type Template } from "../../shared/review/template.ts";
import { shouldRetry } from "../../shared/review/retry.ts";
import { ApiFailure, call } from "./api.ts";

export interface ReviewQuota { eligible: boolean; has_access: boolean; unlimited: boolean; limit: number; used: number; left: number; next_reset: string }
export type Stage = { phase: "start" } | { phase: "sections"; done: number; total: number } | { phase: "overall" } | { phase: "finish" };

const post = <T>(body: unknown) => call<T>("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const analyzeTemplate = (text: string) => post<{ template: Template }>({ op: "template", text }).then((r) => r.template);

const transient = (e: unknown) => shouldRetry(e instanceof ApiFailure ? e.info.error : null, e instanceof ApiFailure ? e.status : 0);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries || !transient(e) || (e instanceof ApiFailure && e.info.error === "review_token")) throw e;
      await wait(1500 * i);
    }
  }
}

/** Chạy toàn bộ một lượt phản biện. Ném lỗi (đã hoàn lượt nếu chưa có phần nào xong) hoặc trả bản nhận xét (có thể thiếu mục, kèm cảnh báo). */
export async function runReview(p: { blocks: RawBlock[]; fileName: string; meta: ReviewMeta; template: Template; onStage?: (s: Stage) => void; signal?: AbortSignal }): Promise<{ result: ReviewResult; quota: ReviewQuota | null }> {
  const blocks = numberBlocks(p.blocks);
  if (corpusChars(blocks) > MAX_REVIEW_CHARS) throw new ApiFailure({ error: "too_long" }, 413);
  const corpus = corpusToText(blocks);
  const stage = p.onStage ?? (() => {});
  stage({ phase: "start" });
  const { token } = await post<{ token: string }>({ op: "start" });
  const base = { token, corpus, meta: p.meta, template: p.template };
  let done = 0;
  const rawSections: unknown[] = [];
  const failedIds: string[] = [];
  let model = "";
  const abort = () => { if (p.signal?.aborted) throw new DOMException("cancelled", "AbortError"); };

  try {
    const batches = sectionBatches(p.template, SECTIONS_PER_CALL);
    const total = batches.length;
    const doBatch = async (ids: string[]): Promise<void> => {
      abort();
      try {
        const r = await retry(() => post<{ raw: { sections?: unknown[] }; model: string }>({ ...base, op: "part", kind: "sections", ids }));
        rawSections.push(...(r.raw.sections ?? [])); model = r.model;
      } catch (e) {
        const code = e instanceof ApiFailure ? e.info.error : "";
        if (code === "truncated" && ids.length > 1) {
          const mid = Math.ceil(ids.length / 2);
          await doBatch(ids.slice(0, mid)); await doBatch(ids.slice(mid));
        } else if (["review_token", "review_locked", "unauthorized", "suspended", "not_verified"].includes(code)) throw e;
        else if (rawSections.length === 0 && failedIds.length === 0) throw e; // phần đầu tiên hỏng: dừng (máy chủ đã hoàn lượt)
        else failedIds.push(...ids);
      }
    };
    for (const ids of batches) { stage({ phase: "sections", done, total }); await doBatch(ids); done++; }
    stage({ phase: "sections", done: total, total });
    // Nếu không có phần nào thành công thì không đi tiếp (máy chủ đã hoàn lượt khi phần đầu thất bại).
    if (rawSections.length === 0) throw new ApiFailure({ error: "ai_failed" }, 502);

    abort();
    stage({ phase: "overall" });
    let overall: unknown = null;
    try {
      overall = (await retry(() => post<{ raw: unknown }>({ ...base, op: "part", kind: "overall", digest: sectionDigest(p.template, rawSections as never[]) }))).raw;
    } catch (e) {
      if (e instanceof ApiFailure && ["review_token", "review_locked", "unauthorized", "suspended"].includes(e.info.error)) throw e;
    }
    const result = assemble({ sections: rawSections as never[], overall, template: p.template, blocks, meta: p.meta, fileName: p.fileName, model });
    if (failedIds.length) result.warnings.unshift(p.meta.lang === "en" ? `Some sections could not be processed (${failedIds.length}); the reviewer must comment on them.` : `Một số mục không xử lý được (${failedIds.length}); cần người phản biện tự nhận xét.`);
    if (!overall) result.warnings.unshift(p.meta.lang === "en" ? "The overall part (score, defects, questions) could not be processed; the reviewer must complete it." : "Phần tổng hợp (điểm, khuyết điểm, câu hỏi) chưa xử lý được; cần người phản biện tự hoàn thiện.");
    stage({ phase: "finish" });
    const fin = await post<{ review: ReviewQuota }>({ op: "finish", token, score: result.score.sumMax ? result.score.score100 : null }).catch(() => null);
    return { result, quota: fin?.review ?? null };
  } catch (e) {
    // Chưa có phần nào xong: hoàn lượt (máy chủ chỉ hoàn khi đúng như vậy).
    await post({ op: "fail", token }).catch(() => {});
    throw e;
  }
}

// ---- Lưu kết quả cục bộ (chỉ trên máy này; máy chủ không giữ nội dung) ----
const KEY = "ami-review-v1";
export interface SavedReview { id: string; at: string; result: ReviewResult }
export function loadSaved(): SavedReview[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
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
