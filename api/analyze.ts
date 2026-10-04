import Anthropic from "@anthropic-ai/sdk";
import { adminClient, fail, json, quotaOf, requireUser } from "./_lib/common.ts";
import { SCHEMA, SYSTEM, userPrompt } from "./_lib/prompt.ts";
import { recommend } from "./_lib/recommend.ts";
import { costUsd } from "./_lib/pricing.ts";
import { detectLang } from "../shared/lang.ts";
import { locateQuote, prepare } from "../shared/quotes.ts";
import {
  MAX_ABSTRACT_CHARS, MAX_TEXT_CHARS, MAX_TEXT_CHARS_BASIC, MIN_ABSTRACT_WORDS, PASS_SCORE,
  type AnalysisResult, type Bi, type Passage, type SourceMeta,
} from "../shared/types.ts";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const clampInt = (n: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(n) || 0)));
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const bi = (vi: unknown, en: unknown): Bi => ({ vi: s(vi), en: s(en) });
const bis = (vi: unknown, en: unknown): Bi<string[]> => ({ vi: ((vi as unknown[]) ?? []).map(s).filter(Boolean), en: ((en as unknown[]) ?? []).map(s).filter(Boolean) });

interface Body { abstract?: string; text?: string; fileName?: string; profile?: string }

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!process.env.ANTHROPIC_API_KEY) return fail("server_misconfigured", 500, "Thiếu ANTHROPIC_API_KEY.");

  let body: Body;
  try { body = await request.json(); } catch { return fail("bad_request", 400); }
  const abstract = s(body.abstract);
  const text = s(body.text);
  if (abstract.split(/\s+/).length < MIN_ABSTRACT_WORDS || abstract.length > MAX_ABSTRACT_CHARS)
    return fail("bad_request", 400, "Abstract/Proposal quá ngắn hoặc quá dài.");
  if (text.replace(/\[\[p\.\d+\]\]/g, "").trim().length < 400) return fail("no_text", 422);
  // Người dùng chưa được quản trị viên xác thực có hạn mức văn bản thấp hơn (tương ứng tệp tối đa 2 MB).
  const pre = await quotaOf(auth.sb, auth.id);
  const limit = pre?.approved ? MAX_TEXT_CHARS : MAX_TEXT_CHARS_BASIC;
  if (text.length > limit) return fail("too_long", 413, pre?.approved ? undefined : "unapproved");

  // Chặn sớm tài liệu ngôn ngữ khác (chưa tốn lượt, chưa gọi AI).
  if (detectLang(text) === "other") return fail("unsupported_language", 422);

  // Trừ lượt trước khi gọi AI; hoàn lại nếu thất bại.
  const { sb, id } = auth;
  const { data: c, error: cErr } = await sb.rpc("consume_credit", { p_user: id });
  if (cErr || !c) return fail("server_misconfigured", 500, "Không kiểm tra được hạn mức.");
  if (!c.ok) {
    const q = await quotaOf(sb, id);
    return fail(c.reason === "suspended" ? "suspended" : "quota_exhausted", c.reason === "suspended" ? 403 : 402, undefined, q);
  }
  const source = c.source as string;
  const logId = c.log_id as number;
  const refund = () => sb.rpc("refund_credit", { p_user: id, p_source: source });
  // Ghi chi phí API thực tế (kể cả khi hoàn lượt vì AI lỗi: token đã tiêu thật).
  const track = async (u: { input_tokens?: number; output_tokens?: number } | undefined, score: number | null) => {
    if (!u || !logId) return;
    const inT = u.input_tokens ?? 0, outT = u.output_tokens ?? 0;
    await sb.rpc("record_usage", { p_log: logId, p_model: MODEL, p_in: inT, p_out: outT, p_cost: costUsd(MODEL, inT, outT), p_score: score });
  };

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: userPrompt({ abstract, text, fileName: s(body.fileName) || "document", profile: s(body.profile).slice(0, 800) }) }],
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (msg.stop_reason === "refusal") { await track(msg.usage, null); await refund(); return fail("ai_refused", 422); }
    if (msg.stop_reason === "max_tokens") { await track(msg.usage, null); await refund(); return fail("ai_failed", 502, "Phản hồi AI bị cắt giữa chừng."); }
    const raw = msg.content.find((b) => b.type === "text");
    if (!raw || raw.type !== "text") { await track(msg.usage, null); await refund(); return fail("ai_failed", 502); }
    const r = JSON.parse(raw.text);

    if (r.language !== "en" && r.language !== "vi") { await track(msg.usage, null); await refund(); return fail("unsupported_language", 422); }

    const b = r.breakdown;
    const breakdown = {
      topic: clampInt(b.topic, 40), concept: clampInt(b.concept, 20), method: clampInt(b.method, 15),
      evidence: clampInt(b.evidence, 15), currency: clampInt(b.currency, 10),
    };
    const score = breakdown.topic + breakdown.concept + breakdown.method + breakdown.evidence + breakdown.currency;

    // Đối chiếu trích đoạn với văn bản gốc; trang suy ra từ nhãn [[p.N]] chứ không tin mô hình.
    let passages: Passage[] = [];
    let dropped = 0;
    if (score >= PASS_SCORE) {
      const norm = prepare(text);
      const found: Passage[] = [];
      const used = new Set<number>();
      for (const p of r.passages as { quote: string; priority: Passage["priority"]; reason_vi: string; reason_en: string; use: Passage["use"] }[]) {
        const loc = locateQuote(text, p.quote, norm);
        if (!loc || used.has(loc.start)) { dropped++; continue; }
        used.add(loc.start);
        found.push({ id: "", quote: loc.text, page: loc.page, priority: p.priority, rank: 0, reason: bi(p.reason_vi, p.reason_en), use: p.use });
      }
      passages = found.map((p, i) => ({ ...p, id: `p${i + 1}`, rank: i + 1 }));
    }

    const m = r.meta;
    const meta: SourceMeta = {
      type: m.type, title: s(m.title), titleEn: s(m.title_en) || undefined, lang: r.language,
      authors: (m.authors as { family: string; given: string }[]).filter((a) => s(a.family)).map((a) => ({ family: s(a.family), given: s(a.given) })),
      year: s(m.year), container: s(m.container), publisher: s(m.publisher), volume: s(m.volume), issue: s(m.issue),
      pages: s(m.pages), doi: s(m.doi), url: s(m.url),
    };

    await track(msg.usage, score);
    let recommendations = score < PASS_SCORE ? await recommend({ advice: bi(r.advice_vi, r.advice_en), queries: r.queries ?? [], keywords: (r.keywords ?? []).map(s).filter(Boolean), disciplines: r.disciplines ?? [] }) : null;
    // Hạng Cơ bản (sau ngày áp dụng): chỉ cho biết số gợi ý; công trình và tạp chí chi tiết mở khi được xác thực.
    if (recommendations && (await quotaOf(sb, id))?.gated)
      recommendations = { ...recommendations, locked: { works: recommendations.works.length, journals: recommendations.journals.length }, works: [], journals: [] };

    const out: AnalysisResult = {
      language: r.language, score, breakdown, verdict: bi(r.verdict_vi, r.verdict_en), summary: bi(r.summary_vi, r.summary_en),
      strengths: bis(r.strengths_vi, r.strengths_en), gaps: bis(r.gaps_vi, r.gaps_en),
      meta, passages, droppedPassages: dropped, recommendations, quota: await quotaOf(sb, id), truncated: false,
    };
    return json(out);
  } catch (e) {
    await refund();
    if (e instanceof Anthropic.RateLimitError) return fail("ai_failed", 429, "Hệ thống AI đang quá tải, vui lòng thử lại sau ít phút. Lượt dùng đã được hoàn lại.");
    if (e instanceof Anthropic.APIError) return fail("ai_failed", 502, `Lỗi dịch vụ AI (${e.status}). Lượt dùng đã được hoàn lại.`);
    return fail("ai_failed", 500, "Không phân tích được tài liệu. Lượt dùng đã được hoàn lại.");
  }
}

export const GET = () => json({ ok: true, enabled: !!adminClient() && !!process.env.ANTHROPIC_API_KEY });
