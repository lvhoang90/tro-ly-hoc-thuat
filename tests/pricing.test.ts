import test from "node:test";
import assert from "node:assert/strict";
import { costUsd, priceOf } from "../api/_lib/pricing.ts";

test("chi phí API tính theo token thực tế và bảng giá của mô hình", () => {
  assert.deepEqual(priceOf("claude-opus-5-5"), [4, 20]);
  assert.deepEqual(priceOf("claude-sonnet-5-5"), [2, 10]);
  // 12.000 token vào + 3.500 ra trên Opus 5.5: 12000*4/1e6 + 3500*20/1e6 = 0.048 + 0.07
  assert.ok(Math.abs(costUsd("claude-opus-5-5", 12000, 3500) - 0.118) < 1e-9);
  assert.ok(Math.abs(costUsd("claude-sonnet-5-5", 1_000_000, 1_000_000) - 12) < 1e-9);
});
test("mô hình lạ dùng mức ước lượng, có thể ghi đè bằng biến môi trường", () => {
  assert.deepEqual(priceOf("model-la"), [5, 25]);
  process.env.ANTHROPIC_PRICE_IN = "1"; process.env.ANTHROPIC_PRICE_OUT = "2";
  assert.deepEqual(priceOf("claude-opus-5-5"), [1, 2]);
  delete process.env.ANTHROPIC_PRICE_IN; delete process.env.ANTHROPIC_PRICE_OUT;
});
