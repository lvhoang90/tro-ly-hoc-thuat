// Điều phối một lượt phản biện ở trình duyệt: mỗi lần gọi máy chủ là một bước ngắn (nhận xét một lô mục, hoặc phần tổng hợp),
// nên không vướng giới hạn thời gian của hàm máy chủ. Văn bản công trình được gửi lại ở từng bước nhưng chỉ tính tiền một lần nhờ bộ nhớ đệm.
// Lỗi giữa chừng: phần đã xong được lưu điểm (checkpoint) để "Thử lại" nối tiếp cùng lượt; lệnh hoàn lượt không gửi được (mất mạng)
// thì xếp hàng gửi lại khi có mạng. Mô-đun này không nhập Supabase để kiểm thử được bằng Node; việc gọi mạng và lưu trữ đi qua `Deps`.
import { assemble, sectionDigest, type ReviewResult } from "../../shared/review/assemble.ts";
import { corpusChars, corpusToText, numberBlocks, type RawBlock } from "../../shared/review/corpus.ts";
import { MAX_REVIEW_CHARS, SECTIONS_PER_CALL } from "../../shared/review/limits.ts";
import type { ReviewMeta } from "../../shared/review/prompts.ts";
import { sectionBatches, type Template } from "../../shared/review/template.ts";
import { shouldRetry } from "../../shared/review/retry.ts";
import { dropCheckpoint, doneSectionIds, findCheckpoint, fingerprint, parseCheckpoints, parsePending, pendingBatches, putCheckpoint, type Checkpoint, type PendingFail } from "../../shared/review/checkpoint.ts";

export interface ReviewQuota { eligible: boolean; has_access: boolean; unlimited: boolean; limit: number; used: number; left: number; next_reset: string }
export type Stage = { phase: "start" } | { phase: "sections"; done: number; total: number; resumed?: boolean } | { phase: "overall" } | { phase: "finish" };

export const CKPT_KEY = "ami-review-ckpt-v1";
export const PENDING_KEY = "ami-review-pendfail-v1";

export interface Deps {
  post: <T>(body: unknown) => Promise<T>;
  /** Mã lỗi và trạng thái HTTP của lỗi do máy chủ trả về; null nếu là lỗi khác (mất mạng, hủy…). */
  codeOf: (e: unknown) => { code: string; status: number } | null;
  makeError: (code: string, status: number) => Error;
  read: (key: string) => string | null;
  write: (key: string, value: string | null) => void;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const LOCKED = ["review_token", "review_locked", "unauthorized", "suspended", "not_verified"];

const loadCk = (d: Deps) => parseCheckpoints(d.read(CKPT_KEY), d.now());
const saveCk = (d: Deps, list: Checkpoint[]) => { try { d.write(CKPT_KEY, list.length ? JSON.stringify(list) : null); } catch { /* đầy bộ nhớ: bỏ điểm lưu, vẫn chạy được */ } };
const loadPend = (d: Deps) => parsePending(d.read(PENDING_KEY), d.now());
const savePend = (d: Deps, list: PendingFail[]) => { try { d.write(PENDING_KEY, list.length ? JSON.stringify(list) : null); } catch { /* bỏ qua */ } };
const forget = (d: Deps, token: string) => savePend(d, loadPend(d).filter((p) => p.token !== token));

function prepare(p: { blocks: RawBlock[]; meta: ReviewMeta; template: Template }) {
  const blocks = numberBlocks(p.blocks);
  const corpus = corpusToText(blocks);
  return { blocks, corpus, fp: fingerprint(corpus, p.template, p.meta) };
}

/** Lượt đang dở của đúng văn bản này (cùng khung mẫu và bối cảnh): số mục đã xong / tổng số mục. null nếu không có gì để nối tiếp. */
export function resumeInfoCore(d: Deps, p: { blocks: RawBlock[]; meta: ReviewMeta; template: Template }): { done: number; total: number } | null {
  const ck = findCheckpoint(loadCk(d), prepare(p).fp);
  if (!ck) return null;
  const total = p.template.sections.length;
  return { done: Math.min(doneSectionIds(ck.sections).size, total), total };
}

/** Gửi lại các lệnh hoàn lượt đã bị mất mạng làm hỏng. Bỏ qua mã còn điểm lưu dùng được (sẽ được nối tiếp, không hoàn). */
export async function flushPendingCore(d: Deps): Promise<void> {
  const live = new Set(loadCk(d).map((c) => c.token));
  for (const p of loadPend(d)) {
    if (live.has(p.token)) continue;
    try { await d.post({ op: "fail", token: p.token }); forget(d, p.token); }
    catch (e) { const c = d.codeOf(e); if (c && c.status < 500 && c.status !== 429 && c.status !== 408) forget(d, p.token); /* mã lệnh đã hết hạn hoặc bị từ chối: bỏ; lỗi mạng: giữ để gửi lại */ }
  }
}

/** Chạy toàn bộ một lượt phản biện. Ném lỗi (đã hoàn lượt nếu chưa có phần nào xong) hoặc trả bản nhận xét (có thể thiếu mục, kèm cảnh báo). */
export async function runReviewCore(d: Deps, p: { blocks: RawBlock[]; fileName: string; meta: ReviewMeta; template: Template; onStage?: (s: Stage) => void; signal?: AbortSignal }): Promise<{ result: ReviewResult; quota: ReviewQuota | null }> {
  const { blocks, corpus, fp } = prepare(p);
  if (corpusChars(blocks) > MAX_REVIEW_CHARS) throw d.makeError("too_long", 413);
  const stage = p.onStage ?? (() => {});
  const abort = () => { if (p.signal?.aborted) throw new DOMException("cancelled", "AbortError"); };
  const transient = (e: unknown) => { const c = d.codeOf(e); return shouldRetry(c ? c.code : null, c ? c.status : 0); };
  async function retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
    for (let i = 1; ; i++) {
      try { return await fn(); } catch (e) {
        if (i >= tries || !transient(e) || d.codeOf(e)?.code === "review_token") throw e;
        await d.sleep(1500 * i);
      }
    }
  }
  const batches = sectionBatches(p.template, SECTIONS_PER_CALL);

  const attempt = async (ck: Checkpoint | null): Promise<{ result: ReviewResult; quota: ReviewQuota | null }> => {
    stage({ phase: "start" });
    const token = ck ? ck.token : (await d.post<{ token: string }>({ op: "start" })).token;
    if (ck) forget(d, token); // nối tiếp cùng lượt: không hoàn lượt này nữa
    const base = { token, corpus, meta: p.meta, template: p.template };
    const rawSections: unknown[] = ck ? [...ck.sections] : [];
    let overall: unknown = ck ? ck.overall : null;
    let model = ck ? ck.model : "";
    const failedIds: string[] = [];
    const save = () => saveCk(d, putCheckpoint(loadCk(d), { v: 1, fp, token, at: d.now(), sections: rawSections, overall, model }));
    if (!ck) save(); // có mã lượt là có điểm lưu: mất mạng ngay bước đầu vẫn nối tiếp được cùng lượt

    try {
      const todo = pendingBatches(batches, doneSectionIds(rawSections));
      const total = batches.length;
      let done = total - todo.length;
      const doBatch = async (ids: string[]): Promise<void> => {
        abort();
        try {
          const r = await retry(() => d.post<{ raw: { sections?: unknown[] }; model: string }>({ ...base, op: "part", kind: "sections", ids }));
          rawSections.push(...(r.raw.sections ?? [])); model = r.model; save();
        } catch (e) {
          if (!d.codeOf(e)) throw e; // không nhận được phản hồi (mất mạng, hủy): dừng để nối tiếp sau, không ghép bản dở dang
          const code = d.codeOf(e)?.code ?? "";
          if (code === "truncated" && ids.length > 1) {
            const mid = Math.ceil(ids.length / 2);
            await doBatch(ids.slice(0, mid)); await doBatch(ids.slice(mid));
          } else if (LOCKED.includes(code)) throw e;
          else if (rawSections.length === 0 && failedIds.length === 0) throw e; // phần đầu tiên hỏng: dừng
          else failedIds.push(...ids);
        }
      };
      stage({ phase: "sections", done, total, resumed: !!ck && done > 0 });
      for (const ids of todo) { stage({ phase: "sections", done, total, resumed: !!ck && done > 0 }); await doBatch(ids); done++; }
      stage({ phase: "sections", done: total, total });
      if (rawSections.length === 0) throw d.makeError("ai_failed", 502);

      if (overall == null) {
        abort();
        stage({ phase: "overall" });
        try {
          overall = (await retry(() => d.post<{ raw: unknown }>({ ...base, op: "part", kind: "overall", digest: sectionDigest(p.template, rawSections as never[]) }))).raw;
          save();
        } catch (e) {
          if (!d.codeOf(e)) throw e; // mất mạng ở phần tổng hợp: giữ các mục đã xong để nối tiếp
          const code = d.codeOf(e)?.code ?? "";
          if (["review_token", "review_locked", "unauthorized", "suspended"].includes(code)) throw e;
        }
      }
      const result = assemble({ sections: rawSections as never[], overall, template: p.template, blocks, meta: p.meta, fileName: p.fileName, model });
      if (failedIds.length) result.warnings.unshift(p.meta.lang === "en" ? `Some sections could not be processed (${failedIds.length}); the reviewer must comment on them.` : `Một số mục không xử lý được (${failedIds.length}); cần người phản biện tự nhận xét.`);
      if (!overall) result.warnings.unshift(p.meta.lang === "en" ? "The overall part (score, defects, questions) could not be processed; the reviewer must complete it." : "Phần tổng hợp (điểm, khuyết điểm, câu hỏi) chưa xử lý được; cần người phản biện tự hoàn thiện.");
      stage({ phase: "finish" });
      const fin = await d.post<{ review: ReviewQuota }>({ op: "finish", token, score: result.score.sumMax ? result.score.score100 : null }).catch(() => null);
      saveCk(d, dropCheckpoint(loadCk(d), fp)); forget(d, token);
      return { result, quota: fin?.review ?? null };
    } catch (e) {
      const code = d.codeOf(e)?.code ?? "";
      if (code === "review_token") { saveCk(d, dropCheckpoint(loadCk(d), fp)); forget(d, token); throw e; } // mã lượt hết hạn hoặc đã hoàn: không còn gì để nối tiếp
      // Đã có phần xong: giữ điểm lưu để "Thử lại" nối tiếp (không hoàn lượt vì máy chủ cũng không hoàn khi đã có phần xong).
      // Chưa có phần nào: thử hoàn lượt; hoàn được thì bỏ điểm lưu; không gửi được (mất mạng) thì giữ điểm lưu và xếp hàng gửi lại.
      if (rawSections.length === 0) {
        try {
          const r = await d.post<{ refunded?: boolean }>({ op: "fail", token });
          if (r?.refunded) saveCk(d, dropCheckpoint(loadCk(d), fp)); // chưa hoàn được (đã có phần xong ở máy chủ): giữ điểm lưu để nối tiếp
        } catch (f) {
          const c = d.codeOf(f);
          if (c && c.code === "review_token") saveCk(d, dropCheckpoint(loadCk(d), fp));
          else { const list = loadPend(d); if (!list.some((x) => x.token === token)) savePend(d, [...list, { token, fp, at: d.now() }]); }
        }
      }
      throw e;
    }
  };

  await flushPendingCore(d).catch(() => {});
  const ck = findCheckpoint(loadCk(d), fp);
  try { return await attempt(ck); }
  catch (e) {
    if (ck && d.codeOf(e)?.code === "review_token") return attempt(null); // lượt cũ hết hạn: bắt đầu lượt mới
    throw e;
  }
}
