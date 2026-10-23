import test from "node:test";
import assert from "node:assert/strict";
import { fingerprint, parseCheckpoints, pendingBatches, doneSectionIds } from "../shared/review/checkpoint.ts";
import { builtinTemplate } from "../shared/review/template.ts";
import { CKPT_KEY, PENDING_KEY, flushPendingCore, resumeInfoCore, runReviewCore, type Deps } from "../src/lib/review-run.ts";

class Srv extends Error { code: string; status: number; constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; } }
class Net extends Error {}
const meta = { docType: "thesis", role: "reviewer", field: "", notes: "", lang: "vi" as const };
const tpl = builtinTemplate("thesis");
const blocks = [{ kind: "p" as const, text: "Nghiên cứu khảo sát 120 học sinh trung học phổ thông tại một trường để tìm hiểu năng lực số." }];
const overallRaw = { rubric_scores: [15, 15, 20, 20, 15, 5, 10].map((p, i) => ({ criterion_id: `c${i + 1}`, points: p, rationale: "", evidence: [] })), fatal_defects: [], overall: { summary: "S", conclusion_text: "C", proposed_decision: "accept" } };

/** Máy chủ giả + trình duyệt giả; `script(body, calls)` có thể ném lỗi để mô phỏng mất mạng hoặc từ chối. */
function world(script: (b: Record<string, unknown>, log: Record<string, unknown>[]) => void = () => {}) {
  const store = new Map<string, string>(); const log: Record<string, unknown>[] = []; let tokens = 0; let clock = 1_000_000;
  const d: Deps = {
    post: async <T,>(b: unknown) => {
      const body = b as Record<string, unknown>; log.push(body); script(body, log);
      if (body.op === "start") return { token: `T${++tokens}`, review: { eligible: true, has_access: true, unlimited: false, limit: 5, used: 1, left: 4, next_reset: "x" } } as T;
      if (body.op === "fail") return { refunded: true } as T;
      if (body.op === "finish") return { review: { eligible: true, has_access: true, unlimited: false, limit: 5, used: 1, left: 4, next_reset: "x" } } as T;
      if (body.kind === "overall") return { raw: overallRaw } as T;
      const ids = body.ids as string[];
      return { model: "m", raw: { sections: ids.map((id) => ({ section_id: id, content: `NX ${id}`, strengths: [], weaknesses: [], revisions: [], evidence: [] })) } } as T;
    },
    codeOf: (e) => (e instanceof Srv ? { code: e.code, status: e.status } : null),
    makeError: (code, status) => new Srv(code, status),
    read: (k) => store.get(k) ?? null, write: (k, v) => { if (v === null) store.delete(k); else store.set(k, v); },
    now: () => clock, sleep: async () => {},
  };
  return { d, store, log, tick: (ms: number) => { clock += ms; }, ops: () => log.map((x) => x.op + (x.kind ? ":" + x.kind : "")) };
}
const run = (d: Deps, m = meta) => runReviewCore(d, { blocks, fileName: "A.docx", meta: m, template: tpl });

test("chạy trọn vẹn: không để lại điểm lưu hay lệnh chờ", async () => {
  const w = world();
  const { result } = await run(w.d);
  assert.equal(result.sections.length, tpl.sections.length);
  assert.deepEqual(w.ops(), ["start", "part:sections", "part:sections", "part:overall", "finish"]);
  assert.equal(w.store.get(CKPT_KEY), undefined); assert.equal(w.store.get(PENDING_KEY), undefined);
});

test("mất mạng ngay phần đầu: giữ lượt, 'Thử lại' dùng lại đúng mã lượt, không gọi start lần nữa", async () => {
  let down = true;
  const w = world((b) => { if (down && (b.op === "part" || b.op === "fail")) throw new Net("offline"); });
  await assert.rejects(run(w.d), Net);
  assert.equal(parseCheckpoints(w.store.get(CKPT_KEY) ?? null, 1_000_000).length, 1);
  assert.equal(JSON.parse(w.store.get(PENDING_KEY)!).length, 1); // lệnh hoàn lượt chờ gửi
  assert.deepEqual(resumeInfoCore(w.d, { blocks, meta, template: tpl }), { done: 0, total: tpl.sections.length });
  down = false; w.log.length = 0;
  const { result } = await run(w.d);
  assert.equal(result.sections.length, tpl.sections.length);
  assert.equal(w.ops().includes("start"), false, "không mở lượt mới");
  assert.equal(w.ops().includes("fail"), false, "không hoàn lượt đang dùng lại");
  assert.ok(w.log.filter((x) => x.op === "part").every((x) => x.token === "T1"));
  assert.equal(w.store.get(CKPT_KEY), undefined); assert.equal(w.store.get(PENDING_KEY), undefined);
});

test("lỗi giữa chừng: nối tiếp chỉ các mục chưa xong, mục đã xong không gọi lại AI", async () => {
  let bad = true;
  const w = world((b) => { if (bad && b.op === "part" && b.kind === "sections" && (b.ids as string[]).includes(tpl.sections[4].id)) throw new Net("offline"); });
  await assert.rejects(run(w.d), Net); // lô 1 xong, lô 2 mất mạng
  const info = resumeInfoCore(w.d, { blocks, meta, template: tpl });
  assert.deepEqual(info, { done: 4, total: tpl.sections.length });
  bad = false; w.log.length = 0;
  const { result } = await run(w.d);
  assert.equal(result.sections.length, tpl.sections.length);
  const parts = w.log.filter((x) => x.op === "part" && x.kind === "sections");
  assert.equal(parts.length, 1);
  assert.deepEqual(parts[0].ids, tpl.sections.slice(4).map((s) => s.id));
  assert.equal(w.ops().includes("start"), false);
});

test("lệnh hoàn lượt thành công thì bỏ điểm lưu: lần sau là lượt mới", async () => {
  let fail = true;
  const w = world((b) => { if (fail && b.op === "part") throw new Srv("ai_failed", 502); });
  await assert.rejects(run(w.d), (e: Srv) => e.code === "ai_failed");
  assert.equal(w.ops().filter((o) => o === "fail").length, 1);
  assert.equal(w.store.get(CKPT_KEY), undefined);
  assert.equal(resumeInfoCore(w.d, { blocks, meta, template: tpl }), null);
  fail = false; w.log.length = 0;
  await run(w.d);
  assert.equal(w.ops()[0], "start");
});

test("lượt cũ hết hạn hoặc đã hoàn: tự mở lượt mới, không báo lỗi", async () => {
  let down = true; let expired = false;
  const w = world((b) => {
    if (down && (b.op === "part" || b.op === "fail")) throw new Net("offline");
    if (expired && b.token === "T1" && b.op === "part") throw new Srv("review_token", 401);
  });
  await assert.rejects(run(w.d), Net);
  down = false; expired = true; w.log.length = 0;
  const { result } = await run(w.d);
  assert.equal(result.sections.length, tpl.sections.length);
  assert.equal(w.ops().filter((o) => o === "start").length, 1);
  assert.ok(w.log.filter((x) => x.op === "part").some((x) => x.token === "T2"));
});

test("đổi bối cảnh hoặc khung mẫu thì không nối tiếp (dấu vân tay khác)", async () => {
  const w = world((b) => { if (b.op === "part" || b.op === "fail") throw new Net("offline"); });
  await assert.rejects(run(w.d), Net);
  assert.equal(resumeInfoCore(w.d, { blocks, meta: { ...meta, notes: "khác" }, template: tpl }), null);
  assert.notEqual(fingerprint("a", tpl, meta), fingerprint("a", tpl, { ...meta, field: "x" }));
  assert.notEqual(fingerprint("a", tpl, meta), fingerprint("b", tpl, meta));
});

test("điểm lưu hết hạn sau 2,5 giờ; lệnh hoàn lượt chờ được gửi lại và xóa", async () => {
  let down = true;
  const w = world((b) => { if (down && (b.op === "part" || b.op === "fail")) throw new Net("offline"); });
  await assert.rejects(run(w.d), Net);
  w.tick(10_000); down = false; w.log.length = 0;
  await flushPendingCore(w.d); // còn điểm lưu dùng được: không hoàn
  assert.equal(w.ops().length, 0);
  w.tick(2.6 * 3600_000); // điểm lưu hết hạn, mã lượt còn hiệu lực
  await flushPendingCore(w.d);
  assert.deepEqual(w.ops(), ["fail"]);
  assert.equal(w.store.get(PENDING_KEY), undefined);
  assert.equal(resumeInfoCore(w.d, { blocks, meta, template: tpl }), null);
});

test("hàm phụ: mục đã xong và lô còn lại", () => {
  assert.deepEqual([...doneSectionIds([{ section_id: "a" }, { section_id: "b" }, {}, null])].sort(), ["a", "b"]);
  assert.deepEqual(pendingBatches([["a", "b"], ["c", "d"], ["e"]], new Set(["a", "b", "d"])), [["c"], ["e"]]);
});
