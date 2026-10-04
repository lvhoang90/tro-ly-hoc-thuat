import test from "node:test";
import assert from "node:assert/strict";
import { nextReset, quotaRule, vnDay, weekStart, type RuleInput } from "../shared/tier.ts";

test("tuần bắt đầu từ thứ Hai (giờ Việt Nam)", () => {
  assert.equal(weekStart("2026-10-05"), "2026-10-05"); // thứ Hai
  assert.equal(weekStart("2026-10-04"), "2026-09-28"); // Chủ nhật thuộc tuần trước
  assert.equal(weekStart("2026-10-10"), "2026-10-05"); // thứ Bảy
  assert.equal(nextReset("week", "2026-10-10"), "2026-10-12");
  assert.equal(nextReset("day", "2026-10-31"), "2026-11-01");
  assert.equal(vnDay(Date.parse("2026-10-09T17:30:00Z")), "2026-10-10"); // 00:30 sáng 10/10 giờ VN
});

const base: RuleInput = { role: "user", approved: false, quota_limit: null, quota_period: null, free_daily_limit: 1, basic_weekly_limit: 1, tier_start: "2026-10-10", today: "2026-10-09" };

test("quy tắc hạn mức theo hạng và ngày bắt đầu áp dụng", () => {
  assert.deepEqual(quotaRule(base), { tier: "basic", limit: 1, period: "day" }, "trước 10/10 giữ 1 lượt/ngày");
  assert.deepEqual(quotaRule({ ...base, today: "2026-10-10" }), { tier: "basic", limit: 1, period: "week" });
  assert.deepEqual(quotaRule({ ...base, today: "2026-10-10", approved: true }), { tier: "verified", limit: 1, period: "day" }, "đã xác thực không bị thiệt");
  assert.deepEqual(quotaRule({ ...base, today: "2026-10-10", approved: true, quota_limit: 5, quota_period: "week" }), { tier: "verified", limit: 5, period: "week" });
  assert.equal(quotaRule({ ...base, role: "admin" }).tier, "admin");
});
