// Hạng người dùng và chu kỳ hạn mức (bản TypeScript của quota_rule/vn_week_start trong supabase/schema.sql).
export type Tier = "basic" | "verified" | "admin";
export type Period = "day" | "week";

export const DEFAULT_TIER_START = "2026-10-10";

/** Ngày theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD. */
export const vnDay = (t = Date.now()) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10);

const addDays = (day: string, n: number) => new Date(Date.parse(day + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);

/** Thứ Hai của tuần chứa `day`. */
export function weekStart(day: string): string {
  const dow = new Date(day + "T00:00:00Z").getUTCDay(); // 0 = Chủ nhật
  return addDays(day, -((dow + 6) % 7));
}

/** Ngày bắt đầu chu kỳ kế tiếp (lúc hạn mức đặt lại). */
export const nextReset = (period: Period, day: string) => (period === "week" ? addDays(weekStart(day), 7) : addDays(day, 1));

export interface RuleInput {
  role: "user" | "admin"; approved: boolean; quota_limit: number | null; quota_period: Period | null;
  free_daily_limit: number; basic_weekly_limit: number; tier_start: string; today: string;
}

export function quotaRule(p: RuleInput): { tier: Tier; limit: number; period: Period } {
  if (p.role === "admin") return { tier: "admin", limit: 0, period: "day" };
  if (p.approved) return { tier: "verified", limit: p.quota_limit ?? p.free_daily_limit, period: p.quota_period ?? "day" };
  if (p.today >= p.tier_start) return { tier: "basic", limit: p.basic_weekly_limit, period: "week" };
  return { tier: "basic", limit: p.free_daily_limit, period: "day" };
}
