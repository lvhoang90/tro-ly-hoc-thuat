import Anthropic from "@anthropic-ai/sdk";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { adminClient, fail, json, requireUser, type AuthedUser } from "./_lib/common.ts";
import { costUsdCached } from "./_lib/pricing.ts";
import { OVERALL_ID, SECTIONS_SCHEMA, TEMPLATE_SCHEMA, overallSchema } from "../shared/review/schemas.ts";
import { SYSTEM_REVIEWER, SYSTEM_TEMPLATE, documentBlock, overallPrompt, sectionsPrompt, templatePrompt } from "../shared/review/prompts.ts";
import { defaultRubric } from "../shared/review/rubric.ts";
import { normalizeTemplate, usesDefaultRubric } from "../shared/review/template.ts";
import { MAX_REVIEW_CHARS, MAX_REVIEW_COST_USD, MAX_REVIEW_FAILS, MAX_REVIEW_PARTS, MAX_TEMPLATE_CHARS } from "../shared/review/limits.ts";

const MODEL = process.env.REVIEW_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
// Phần tổng hợp (điểm, khuyết điểm, kết luận) dùng mức suy nghĩ cao; nhận xét từng mục dùng mức vừa để mỗi bước nằm gọn trong thời gian cho phép.
const EFFORT_OVERALL = process.env.REVIEW_EFFORT ?? "high";
const EFFORT_SECTIONS = process.env.REVIEW_EFFORT_SECTIONS ?? "medium";
const TOKEN_TTL_MS = 3 * 60 * 60_000;
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Mã thông báo ký bằng HMAC (khóa suy ra từ khóa dịch vụ Supabase): chứng minh lượt phản biện đã được ghi nhận cho đúng người dùng.
const secret = () => {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("server_misconfigured");
  return createHmac("sha256", "review-v1").update(k).digest();
};
const sign = (b: string) => createHmac("sha256", secret()).update(b).digest("base64url");
export function makeToken(uid: string, log: number, now = Date.now()) {
  const b = Buffer.from(JSON.stringify({ u: uid, l: log, e: now + TOKEN_TTL_MS })).toString("base64url");
  return `${b}.${sign(b)}`;
}
export function readToken(tok: string, uid: string, now = Date.now()): number | null {
  const [b, mac] = tok.split(".");
  if (!b || !mac) return null;
  const want = Buffer.from(sign(b)), got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(b, "base64url").toString());
    return p.u === uid && p.e > now && Number.isInteger(p.l) ? p.l : null;
  } catch { return null; }
}

type Usage = { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };
class Truncated extends Error {}
class Refused extends Error {}

async function callJson(p: { system: string; blocks: Anthropic.TextBlockParam[]; schema: unknown; maxTokens: number; effort: string }) {
  const client = new Anthropic({ maxRetries: 1 });
  const stream = client.messages.stream({
    model: MODEL, max_tokens: p.maxTokens,
    system: [{ type: "text", text: p.system, cache_control: { type: "ephemeral" } }],
    output_config: { effort: p.effort, format: { type: "json_schema", schema: p.schema } },
    messages: [{ role: "user", content: p.blocks }],
  } as Anthropic.MessageCreateParamsStreaming);
  const msg = await stream.finalMessage();
  const text = msg.content.find((b) => b.type === "text");
  const usage = msg.usage as Usage;
  if (msg.stop_reason === "max_tokens") throw Object.assign(new Truncated(), { usage });
  if (msg.stop_reason === "refusal" || !text || text.type !== "text") throw Object.assign(new Refused(), { usage });
  try { return { raw: JSON.parse(text.text) as unknown, usage }; } catch { throw Object.assign(new Error("bad_json"), { usage }); } // vẫn ghi chi phí đã tiêu
}

const aiError = (e: unknown) => {
  if (e instanceof Truncated) return fail("truncated", 502, "Phản hồi AI bị cắt giữa chừng.");
  if (e instanceof Refused) return fail("ai_refused", 422);
  if (e instanceof Anthropic.RateLimitError) return fail("ai_failed", 429, "Hệ thống AI đang quá tải, vui lòng thử lại sau ít phút.");
  if (e instanceof Anthropic.APIError) return fail("ai_failed", 502, `Lỗi dịch vụ AI (${e.status}).`);
  return fail("ai_failed", 500, "Không xử lý được phần này.");
};

async function guardEligible(auth: AuthedUser) {
  const { data } = await auth.sb.rpc("review_quota_of", { p_user: auth.id });
  return data as { eligible: boolean; has_access: boolean; unlimited: boolean; limit: number; used: number; left: number; next_reset: string } | null;
}

interface Body {
  op?: string; token?: string; text?: string; meta?: { docType?: string; role?: string; field?: string; notes?: string; lang?: string };
  template?: unknown; ids?: unknown; corpus?: string; kind?: string; digest?: string; score?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!process.env.ANTHROPIC_API_KEY) return fail("server_misconfigured", 500, "Thiếu ANTHROPIC_API_KEY.");
  let body: Body;
  try { body = await request.json(); } catch { return fail("bad_request", 400); }
  const { sb, id } = auth;
  const q = await guardEligible(auth);
  if (!q) return fail("server_misconfigured", 500, "Không kiểm tra được hạn mức. Đã chạy supabase/migrations/20261011_review.sql chưa?");
  if (!q.eligible) return fail("not_verified", 403);
  if (!q.has_access) return fail("review_locked", 403); // cần được quản trị viên phê duyệt hạn mức

  // 1) Tách khung mẫu của trường/viện (miễn phí, không trừ lượt).
  if (body.op === "template") {
    const text = s(body.text);
    if (text.length < 80 || text.length > MAX_TEMPLATE_CHARS) return fail("bad_request", 400, "Mẫu quá ngắn hoặc quá dài.");
    // Ghi một dòng nhật ký riêng (kèm chi phí) và giới hạn tần suất theo giờ.
    const { data: lt } = await sb.rpc("log_template", { p_user: id });
    if (!lt?.ok) return fail("review_limit", 429, "Bạn tách mẫu quá nhiều lần trong một giờ. Hãy thử lại sau.");
    const trackT = (u: Usage | undefined) => (u ? sb.rpc("add_usage", { p_log: lt.log_id, p_model: MODEL, p_in: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), p_out: u.output_tokens ?? 0, p_cost: costUsdCached(MODEL, u), p_unit: true, p_failed: false }) : Promise.resolve());
    try {
      const r = await callJson({ system: SYSTEM_TEMPLATE, blocks: [{ type: "text", text: templatePrompt(text) }], schema: TEMPLATE_SCHEMA, maxTokens: 16000, effort: "medium" });
      await trackT(r.usage);
      return json({ template: normalizeTemplate(r.raw as never) });
    } catch (e) {
      await trackT((e as { usage?: Usage }).usage);
      if (e instanceof Error && e.message === "template_empty") return fail("bad_request", 422, "Không nhận diện được mục nào trong mẫu (mẫu có thể là ảnh quét).");
      return aiError(e);
    }
  }

  // 2) Bắt đầu: ghi nhận lượt và cấp mã thông báo.
  if (body.op === "start") {
    const { data: c, error } = await sb.rpc("consume_review", { p_user: id });
    if (error || !c) return fail("server_misconfigured", 500, "Không kiểm tra được hạn mức.");
    if (!c.ok) return json({ error: c.reason === "suspended" ? "suspended" : c.reason === "not_verified" ? "not_verified" : c.reason === "no_access" ? "review_locked" : "quota_exhausted", review: c.quota ?? q }, c.reason === "quota_exhausted" ? 402 : 403);
    return json({ token: makeToken(id, c.log_id as number), review: c.quota });
  }

  // Các bước còn lại cần mã thông báo hợp lệ.
  const log = readToken(s(body.token), id);
  if (log === null) return fail("review_token", 401);

  if (body.op === "fail") {
    const { data: refunded } = await sb.rpc("refund_review", { p_log: log });
    return json({ refunded: !!refunded, review: await guardEligible(auth) });
  }
  if (body.op === "finish") {
    const sc = Number(body.score);
    await sb.rpc("finish_review", { p_log: log, p_score: Number.isFinite(sc) ? Math.round(Math.max(0, Math.min(100, sc))) : null });
    return json({ review: await guardEligible(auth) });
  }

  if (body.op === "part") {
    const { data: row } = await sb.from("usage_log").select("units_done,refunded,cost_usd,fails").eq("id", log).eq("user_id", id).eq("kind", "review").single();
    if (!row || row.refunded) return fail("review_token", 401);
    // Ba trần chống lạm dụng: số phần thành công, số lần gọi lỗi và chi phí API của lượt.
    if (row.units_done >= MAX_REVIEW_PARTS || row.fails >= MAX_REVIEW_FAILS || Number(row.cost_usd) >= MAX_REVIEW_COST_USD)
      return fail("review_limit", 429, "Lượt phản biện này đã chạm giới hạn chi phí hoặc số lần gọi. Hãy dừng và liên hệ quản trị viên.");
    const corpus = s(body.corpus);
    if (corpus.length < 400) return fail("no_text", 422);
    if (corpus.length > MAX_REVIEW_CHARS) return fail("too_long", 413);
    // Mọi bước của một lượt phải dùng đúng một văn bản (so mã băm với bước đầu).
    const { data: same } = await sb.rpc("bind_review", { p_log: log, p_hash: createHash("sha256").update(corpus).digest("hex") });
    if (!same) return fail("bad_request", 409, "Văn bản khác với văn bản của bước đầu tiên trong lượt này.");
    const m = { docType: s(body.meta?.docType) || "other", role: s(body.meta?.role) || "reviewer", lang: body.meta?.lang === "en" ? "en" as const : "vi" as const, field: s(body.meta?.field).slice(0, 200), notes: s(body.meta?.notes).slice(0, 1500) };
    let template;
    try { template = normalizeTemplate(body.template as never); } catch { return fail("bad_request", 400, "Khung mẫu không hợp lệ."); }
    const rubric = usesDefaultRubric(template) ? defaultRubric(m.docType, m.lang) : null;
    const doc: Anthropic.TextBlockParam = { type: "text", text: documentBlock(corpus), cache_control: { type: "ephemeral" } };
    const track = (u: Usage | undefined, unit: boolean, failedStep = false) =>
      sb.rpc("add_usage", { p_log: log, p_model: MODEL, p_in: u ? (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) : 0, p_out: u?.output_tokens ?? 0, p_cost: u ? costUsdCached(MODEL, u) : 0, p_unit: unit, p_failed: failedStep });
    // Phần thất bại vẫn ghi chi phí (token đã tiêu thật); trình duyệt thử lại, và gọi "fail" để hoàn lượt nếu chưa có phần nào xong.
    const failed = async (e: unknown) => {
      await track((e as { usage?: Usage }).usage, false, true);
      return aiError(e);
    };
    try {
      if (body.kind === "overall") {
        const r = await callJson({ system: SYSTEM_REVIEWER, blocks: [doc, { type: "text", text: overallPrompt({ m, template, rubric, sectionDigest: s(body.digest).slice(0, 60_000) }) }], schema: overallSchema({ withRubric: !!rubric }), maxTokens: 32000, effort: EFFORT_OVERALL });
        await track(r.usage, true);
        return json({ raw: r.raw, model: MODEL, part: OVERALL_ID });
      }
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter((x) => template.sections.some((t) => t.id === x)).slice(0, 8);
      if (!ids.length) return fail("bad_request", 400);
      const r = await callJson({ system: SYSTEM_REVIEWER, blocks: [doc, { type: "text", text: sectionsPrompt({ m, template, rubric, ids }) }], schema: SECTIONS_SCHEMA, maxTokens: 40000, effort: EFFORT_SECTIONS });
      await track(r.usage, true);
      return json({ raw: r.raw, model: MODEL });
    } catch (e) { return failed(e); }
  }
  return fail("bad_request", 400);
}

export const GET = () => json({ ok: true, enabled: !!adminClient() && !!process.env.ANTHROPIC_API_KEY });
