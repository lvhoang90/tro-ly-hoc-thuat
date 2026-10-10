import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

// Máy chủ giả: Supabase (xác thực, RPC, bảng usage_log) và Anthropic (phát luồng SSE) để chạy thật api/review.ts.
const db = { eligible: true, access: true, left: 2, log: { units_done: 0, refunded: false, user_id: "u1" }, rpcs: [] as { fn: string; args: Record<string, unknown> }[] };
const ai = { calls: [] as { body: Record<string, unknown> }[], fail: false, stop: "end_turn", reply: (kind: string): unknown => ({ kind }) };

const readBody = (q: http.IncomingMessage) => new Promise<string>((res) => { let b = ""; q.on("data", (d) => (b += d)); q.on("end", () => res(b)); });
const sse = (r: http.ServerResponse, text: string, stop: string) => {
  const ev = (e: string, d: unknown) => r.write(`event: ${e}\ndata: ${JSON.stringify({ type: e, ...(d as object) })}\n\n`);
  r.writeHead(200, { "content-type": "text/event-stream" });
  ev("message_start", { message: { id: "m", type: "message", role: "assistant", model: "x", content: [], stop_reason: null, usage: { input_tokens: 1000, output_tokens: 1, cache_creation_input_tokens: 500, cache_read_input_tokens: 0 } } });
  ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
  ev("content_block_delta", { index: 0, delta: { type: "text_delta", text } });
  ev("content_block_stop", { index: 0 });
  ev("message_delta", { delta: { stop_reason: stop }, usage: { output_tokens: 200 } });
  ev("message_stop", {});
  r.end();
};

const sbServer = http.createServer(async (q, r) => {
  const url = q.url ?? "";
  const body = await readBody(q);
  const j = (o: unknown, c = 200) => { r.writeHead(c, { "content-type": "application/json" }); r.end(JSON.stringify(o)); };
  if (url.startsWith("/auth/v1/user")) return j({ id: "u1", email: "a@b.c", email_confirmed_at: "2026-01-01T00:00:00Z", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
  if (url.startsWith("/rest/v1/rpc/")) {
    const fn = url.split("/rpc/")[1].split("?")[0];
    const args = body ? JSON.parse(body) : {};
    db.rpcs.push({ fn, args });
    if (fn === "review_quota_of") return j({ eligible: db.eligible, has_access: db.access, unlimited: false, limit: 2, used: 2 - db.left, left: db.left, next_reset: "2026-10-12" });
    if (fn === "consume_review") return db.left > 0 ? j({ ok: true, log_id: 7, quota: { left: db.left - 1, limit: 2 } }) : j({ ok: false, reason: "quota_exhausted", quota: { left: 0 } });
    if (fn === "refund_review") { const ok = !db.log.refunded && db.log.units_done === 0; if (ok) db.log.refunded = true; return j(ok); }
    if (fn === "add_usage") { if (args.p_unit) db.log.units_done++; return j(db.log.units_done); }
    return j(null);
  }
  if (url.startsWith("/rest/v1/usage_log")) return j(db.log);
  j({ message: "not found " + url }, 404);
});
const aiServer = http.createServer(async (q, r) => {
  const body = JSON.parse(await readBody(q) || "{}");
  ai.calls.push({ body });
  if (ai.fail) { r.writeHead(500, { "content-type": "application/json" }); return r.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "boom" } })); }
  const schema = (body.output_config?.format?.schema ?? {}) as { properties?: Record<string, unknown> };
  const kind = schema.properties?.template_title ? "template" : schema.properties?.rubric_scores || schema.properties?.document_profile ? "overall" : "sections";
  sse(r, JSON.stringify(ai.reply(kind)), ai.stop);
});

let POST: (r: Request) => Promise<Response>;
let makeToken: (u: string, l: number, now?: number) => string;
let readToken: (t: string, u: string, now?: number) => number | null;
before(async () => {
  await Promise.all([new Promise<void>((r) => sbServer.listen(0, r)), new Promise<void>((r) => aiServer.listen(0, r))]);
  process.env.SUPABASE_URL = `http://127.0.0.1:${(sbServer.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.ANTHROPIC_API_KEY = "sk-test";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(aiServer.address() as AddressInfo).port}`;
  ({ POST, makeToken, readToken } = await import("../api/review.ts"));
});
after(() => { sbServer.close(); aiServer.close(); });

const req = (body: unknown) => new Request("http://x/api/review", { method: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify(body) });
const reset = () => { db.eligible = true; db.access = true; db.left = 2; db.log = { units_done: 0, refunded: false, user_id: "u1" }; db.rpcs.length = 0; ai.calls.length = 0; ai.fail = false; ai.stop = "end_turn"; };
const corpus = "[¶1] # Tiêu đề\n" + "[¶2] Nghiên cứu khảo sát 120 học sinh trung học phổ thông tại một trường. ".repeat(10);
const tpl = { sections: [{ title: "Tính cấp thiết" }, { title: "Phương pháp" }, { title: "Kết luận", kind: "conclusion" }] };
const meta = { docType: "thesis", role: "reviewer" };

test("mã thông báo: đúng người, hết hạn và bị sửa đều bị từ chối", () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  const t = makeToken("u1", 7, 1_000);
  assert.equal(readToken(t, "u1", 2_000), 7);
  assert.equal(readToken(t, "u2", 2_000), null);
  assert.equal(readToken(t, "u1", 1_000 + 46 * 60_000), null);
  assert.equal(readToken(t.slice(0, -2) + "xx", "u1", 2_000), null);
  assert.equal(readToken("rác", "u1"), null);
});

test("tài khoản chưa xác thực bị từ chối; hết hạn mức báo 402", async () => {
  reset(); db.eligible = false;
  let r = await POST(req({ op: "start" }));
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, "not_verified");
  reset(); db.access = false;
  r = await POST(req({ op: "start" }));
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, "review_locked");
  reset(); db.left = 0;
  r = await POST(req({ op: "start" }));
  assert.equal(r.status, 402);
  assert.equal((await r.json()).error, "quota_exhausted");
});

test("tách khung mẫu qua AI và chuẩn hóa", async () => {
  reset();
  ai.reply = () => ({ template_title: "Mẫu X", language: "vi", purpose: "p", info_fields: [], sections: [{ id: "a", number: "1.", title: "Mục một", level: 1, kind: "narrative", guidance: "", max_points: 0 }], scale_total: 0, scoring_notes: "", ambiguities: [] });
  const r = await POST(req({ op: "template", text: "Mẫu nhận xét luận văn\n1. Mục một\n".repeat(10) }));
  assert.equal(r.status, 200);
  const { template } = await r.json();
  assert.equal(template.sections[0].id, "s1");
  assert.equal(ai.calls[0].body.output_config && (ai.calls[0].body.output_config as { effort: string }).effort, "medium");
  assert.equal((await POST(req({ op: "template", text: "ngắn" }))).status, 400);
});

test("một lượt đầy đủ: bắt đầu, nhận xét mục, tổng hợp, kết thúc; văn bản được đặt đầu và có bộ nhớ đệm", async () => {
  reset();
  ai.reply = (kind) => (kind === "sections" ? { sections: [{ section_id: "s1" }] } : { document_profile: { title: "T" } });
  const st = await (await POST(req({ op: "start" }))).json();
  assert.ok(st.token);
  const base = { token: st.token, corpus, meta, template: tpl };
  let r = await POST(req({ ...base, op: "part", kind: "sections", ids: ["s1", "s2", "zz"] }));
  assert.equal(r.status, 200);
  const first = ai.calls[0].body as { messages: { content: { text: string; cache_control?: unknown }[] }[]; system: { cache_control?: unknown }[] };
  assert.ok(first.messages[0].content[0].text.startsWith("<tai_lieu>"));
  assert.ok(first.messages[0].content[0].cache_control, "khối văn bản có cache_control");
  assert.match(first.messages[0].content[1].text, /CHỈ soạn nhận xét cho 2 mục/); // "zz" bị loại
  r = await POST(req({ ...base, op: "part", kind: "overall", digest: "x" }));
  assert.equal(r.status, 200);
  const fin = await POST(req({ token: st.token, op: "finish", score: 71.4 }));
  assert.equal(fin.status, 200);
  assert.equal(db.log.units_done, 2);
  const add = db.rpcs.filter((x) => x.fn === "add_usage");
  assert.equal(add.length, 2);
  // 1000 nhập + 500 ghi đệm 1,25x trên Opus 5.5 (4 USD) + 200 xuất (20 USD)
  assert.ok(Math.abs(Number(add[0].args.p_cost) - (1000 * 4 + 500 * 5 + 200 * 20) / 1e6) < 1e-9);
  assert.equal(db.rpcs.find((x) => x.fn === "finish_review")?.args.p_score, 71);
  // Sau khi đã có phần hoàn tất, "fail" không hoàn lượt.
  const f = await (await POST(req({ token: st.token, op: "fail" }))).json();
  assert.equal(f.refunded, false);
});

test("mã sai bị từ chối; phần lỗi báo đúng mã và chỉ hoàn lượt khi trình duyệt gọi fail; cắt giữa chừng báo truncated", async () => {
  reset();
  assert.equal((await POST(req({ op: "part", kind: "overall", token: "x.y", corpus, meta, template: tpl }))).status, 401);
  const st = await (await POST(req({ op: "start" }))).json();
  const base = { token: st.token, corpus, meta, template: tpl };
  ai.stop = "max_tokens"; ai.reply = () => ({ sections: [] });
  let r = await POST(req({ ...base, op: "part", kind: "sections", ids: ["s1"] }));
  assert.equal((await r.json()).error, "truncated");
  assert.ok(!db.log.refunded, "chưa hoàn: trình duyệt còn có thể thử lại");
  assert.equal((await (await POST(req({ token: st.token, op: "fail" }))).json()).refunded, true);
  assert.ok(db.log.refunded);
  reset(); ai.fail = true;
  const st2 = await (await POST(req({ op: "start" }))).json();
  r = await POST(req({ token: st2.token, op: "part", kind: "overall", corpus, meta, template: tpl }));
  assert.equal(r.status, 502);
  assert.ok(!db.log.refunded);
  assert.equal((await (await POST(req({ token: st2.token, op: "fail" }))).json()).refunded, true);
  // Văn bản quá ngắn không tốn gì
  reset();
  const st3 = await (await POST(req({ op: "start" }))).json();
  assert.equal((await POST(req({ token: st3.token, op: "part", kind: "overall", corpus: "ngắn", meta, template: tpl }))).status, 422);
  assert.equal(ai.calls.length, 0);
});
