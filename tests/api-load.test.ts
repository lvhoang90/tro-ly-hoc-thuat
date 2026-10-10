import test from "node:test";
import assert from "node:assert/strict";

// Phát hiện sớm lỗi "hàm sập ngay khi khởi động" (FUNCTION_INVOCATION_FAILED) trên Vercel: mỗi hàm phải nạp được dưới Node ESM.
process.env.SUPABASE_URL = "http://localhost:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
process.env.ANTHROPIC_API_KEY = "test";

for (const name of ["analyze", "extract-doc", "visit", "eco", "review"]) {
  test(`api/${name} nạp được`, async () => {
    const mod = await import(`../api/${name}.ts`);
    assert.ok(mod.default || mod.POST || mod.GET, "phải export handler");
  });
}
test("analyze.GET trả trạng thái cấu hình", async () => {
  const { GET } = await import("../api/analyze.ts");
  const body = await (GET() as Response).json();
  assert.deepEqual(body, { ok: true, enabled: true });
});
