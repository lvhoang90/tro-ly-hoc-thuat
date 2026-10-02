import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveMood } from "../src/mascot/types.ts";
import { scoreReaction } from "../src/mascot/reactions.ts";

test("cảm xúc tạm thời tự quay về trạng thái nền", () => {
  assert.equal(effectiveMood("wave", 1), "wave");
  assert.equal(effectiveMood("wave", 3), "idle");
  assert.equal(effectiveMood("celebrate", 2), "celebrate");
  assert.equal(effectiveMood("celebrate", 3.5), "happy");
});

test("cảm xúc bền vững không tự đổi", () => {
  for (const m of ["idle", "read", "think", "happy", "care", "alert", "sleep"] as const) assert.equal(effectiveMood(m, 999), m);
});

test("phản ứng theo điểm: ≥80 ăn mừng, ≥60 vui, dưới 60 quan tâm", () => {
  assert.equal(scoreReaction(95).mood, "celebrate");
  assert.equal(scoreReaction(80).mood, "celebrate");
  assert.equal(scoreReaction(79).mood, "happy");
  assert.equal(scoreReaction(60).mood, "happy");
  assert.equal(scoreReaction(59).mood, "care");
  assert.equal(scoreReaction(0).key, "ami_score_lo");
});
