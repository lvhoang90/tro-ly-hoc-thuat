// Phân tích tài liệu bằng Claude (bản chạy trên Express/SQLite). Logic y hệt api/analyze.ts của bản Vercel.
import Anthropic from "@anthropic-ai/sdk";
import { Router, type Response } from "express";
import { SCHEMA, SYSTEM, userPrompt } from "../api/_lib/prompt.ts";
import { recommend } from "../api/_lib/recommend.ts";
import { costUsd } from "../api/_lib/pricing.ts";
import { detectLang } from "../shared/lang.ts";
import { locateQuote, prepare } from "../shared/quotes.ts";
import {
  MAX_ABSTRACT_CHARS, MAX_TEXT_CHARS, MAX_TEXT_CHARS_BASIC, MIN_ABSTRACT_WORDS, PASS_SCORE,
  type AnalysisResult, type ApiError, type ApiErrorCode, type Bi, type Passage, type Quota, type SourceMeta,
} from "../shared/types.ts";
import { requireUser } from "./auth.ts";
import { consumeCredit, quotaOf, recordUsage, refundCredit } from "./quota.ts";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const clampInt = (n: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(n) || 0)));
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const bi = (vi: unknown, en: unknown): Bi => ({ vi: s(vi), en: s(en) });
const bis = (vi: unknown, en: unknown): Bi<string[]> => ({ vi: ((vi as unknown[]) ?? []).map(s).filter(Boolean), en: ((en as unknown[]) ?? []).map(s).filter(Boolean) });

interface Body { abstract?: string; text?: string; fileName?: string; profile?: string }
interface Out { status: number; body: unknown }
const json = (body: unknown, status = 200): Out => ({ status, body });
const fail = (error: ApiErrorCode, status: number, message?: string, quota?: Quota | null): Out =>
  json({ error, message, quota, status } satisfies ApiError & { status: number }, status);

/** Phân tích mất 20–90 giây: gửi đều khoảng trắng (hợp lệ trong JSON) để proxy của hosting không cắt kết nối vì im lặng. */
function respond(res: Response, o: Out, streaming: boolean) {
  if (!streaming) return void res.status(o.status).json(o.body);
  res.end(JSON.stringify(o.body));
}

export const analyzeRoute = Router();

analyzeRoute.post("/analyze", requireUser, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const auth = { id: req.user!.id };
  if (!process.env.ANTHROPIC_API_KEY) return respond(res, fail("server_misconfigured", 500, "Thiếu ANTHROPIC_API_KEY."), false);
  const body: Body = req.body ?? {};
  const early = (o: Out) => respond(res, o, false);
  const abstract = s(body.abstract);
  const text = s(body.text);
  if (abstract.split(/\s+/).length < MIN_ABSTRACT_WORDS || abstract.length > MAX_ABSTRACT_CHARS)
    return early(fail("bad_request", 400, "Abstract/Proposal quá ngắn hoặc quá dài."));
  if (text.replace(/\[\[p\.\d+\]\]/g, "").trim().length < 400) return early(fail("no_text", 422));
  // Người dùng chưa được quản trị viên xác thực có hạn mức văn bản thấp hơn (tương ứng tệp tối đa 2 MB).
  const pre = quotaOf(auth.id);
  const limit = pre?.approved ? MAX_TEXT_CHARS : MAX_TEXT_CHARS_BASIC;
  if (text.length > limit) return early(fail("too_long", 413, pre?.approved ? undefined : "unapproved"));

  // Chặn sớm tài liệu ngôn ngữ khác (chưa tốn lượt, chưa gọi AI).
  if (detectLang(text) === "other") return early(fail("unsupported_language", 422));


  // Trừ lượt trước khi gọi AI; hoàn lại nếu thất bại.
  const id = auth.id;
  const c = consumeCredit(id);
  if (!c.ok) {
    const q = quotaOf(id);
    if (c.reason === "no_profile") return early(fail("server_misconfigured", 500, "Không kiểm tra được hạn mức."));
    return early(fail(c.reason === "suspended" ? "suspended" : "quota_exhausted", c.reason === "suspended" ? 403 : 402, undefined, q));
  }
  const source = c.source, logId = c.log_id;
  const refund = () => refundCredit(id, source);
  // Ghi chi phí API thực tế (kể cả khi hoàn lượt vì AI lỗi: token đã tiêu thật).
  const track = async (u: { input_tokens?: number; output_tokens?: number } | undefined, score: number | null) => {
    if (!u || !logId) return;
    const inT = u.input_tokens ?? 0, outT = u.output_tokens ?? 0;
    recordUsage(logId, MODEL, inT, outT, costUsd(MODEL, inT, outT), score);
  };

  res.status(200).set("Content-Type", "application/json; charset=utf-8");
  res.flushHeaders();
  const beat = setInterval(() => res.write(" "), 10_000);
  const done = (o: Out) => { clearInterval(beat); respond(res, o, true); };
  const result = await (async (): Promise<Out> => {
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
      const recommendations = score < PASS_SCORE ? await recommend({ advice: bi(r.advice_vi, r.advice_en), queries: r.queries ?? [], keywords: (r.keywords ?? []).map(s).filter(Boolean), disciplines: r.disciplines ?? [] }) : null;
  
      const out: AnalysisResult = {
        language: r.language, score, breakdown, verdict: bi(r.verdict_vi, r.verdict_en), summary: bi(r.summary_vi, r.summary_en),
        strengths: bis(r.strengths_vi, r.strengths_en), gaps: bis(r.gaps_vi, r.gaps_en),
        meta, passages, droppedPassages: dropped, recommendations, quota: quotaOf(id), truncated: false,
      };
      return json(out);
    } catch (e) {
      await refund();
      if (e instanceof Anthropic.RateLimitError) return fail("ai_failed", 429, "Hệ thống AI đang quá tải, vui lòng thử lại sau ít phút. Lượt dùng đã được hoàn lại.");
      if (e instanceof Anthropic.APIError) return fail("ai_failed", 502, `Lỗi dịch vụ AI (${e.status}). Lượt dùng đã được hoàn lại.`);
      return fail("ai_failed", 500, "Không phân tích được tài liệu. Lượt dùng đã được hoàn lại.");
    }
  })();
  done(result);
});
