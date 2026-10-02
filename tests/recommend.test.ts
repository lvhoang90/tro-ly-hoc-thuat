import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "http://localhost:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
// Không gọi mạng: OpenAlex trả rỗng, chỉ kiểm tra tầng đối chiếu EduFind.
globalThis.fetch = (async () => new Response(JSON.stringify({ results: [] }), { status: 200 })) as typeof fetch;

test("gợi ý chọn đúng lĩnh vực EduFind và dùng địa chỉ mới", async () => {
  const { recommend } = await import("../api/_lib/recommend.ts");
  const r = await recommend({
    advice: { vi: "a", en: "a" }, queries: ["educational leadership robotics"],
    keywords: ["educational", "leadership", "robotics", "school"], disciplines: ["giao-duc", "khong-ton-tai"],
  });
  assert.equal(r.edufind.url, "https://edufind.isavn.edu.vn/");
  assert.deepEqual(r.disciplines.map((d) => d.slug), ["giao-duc"]);
  assert.ok(r.disciplines[0].url.startsWith("https://edufind.isavn.edu.vn/giao-duc"));
  assert.ok(r.journals.length > 3);
  assert.ok(r.journals.some((j) => j.domestic), "có tạp chí trong nước của Hội đồng");
  assert.ok(r.journals.every((j) => j.url.startsWith("https://edufind.isavn.edu.vn/")));
  assert.ok(!JSON.stringify(r).includes("vercel.app"), "không còn liên kết cũ");
});
