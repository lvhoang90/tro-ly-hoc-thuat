import test from "node:test";
import assert from "node:assert/strict";
import { withKeepalive } from "../api/_lib/keepalive.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

test("bước chạy lâu: gửi khoảng trắng giữ kết nối trước, rồi JSON; thân vẫn đọc được bằng JSON.parse", async () => {
  const r = withKeepalive(async () => { await sleep(130); return json({ raw: { ok: 1 }, model: "m" }); }, 20);
  assert.equal(r.status, 200);
  const chunks: string[] = []; const rd = r.body!.getReader(); const dec = new TextDecoder();
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(dec.decode(value)); }
  const all = chunks.join("");
  assert.ok(chunks.length >= 4, `cần nhiều khoảng trắng giữ kết nối, có ${chunks.length} đoạn`);
  assert.ok(/^ {4,}\{/.test(all), "khoảng trắng đứng trước JSON");
  assert.deepEqual(JSON.parse(all), { raw: { ok: 1 }, model: "m" });
});

test("lỗi của máy chủ: mã thật được ghi vào thân (status) và giữ nguyên các trường khác", async () => {
  const r = withKeepalive(async () => json({ error: "review_limit", message: "đầy" }, 429), 20);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { error: "review_limit", message: "đầy", status: 429 });
});

test("phản hồi lỗi không phải JSON và ngoại lệ đều thành lỗi server_error có status", async () => {
  const a = await withKeepalive(async () => new Response("<html>504</html>", { status: 504 }), 20).json();
  assert.deepEqual(a, { error: "server_error", message: "504", status: 504 });
  const b = await withKeepalive(async () => { throw new Error("hỏng"); }, 20).json();
  assert.equal(b.error, "server_error"); assert.equal(b.status, 500); assert.equal(b.message, "hỏng");
});
