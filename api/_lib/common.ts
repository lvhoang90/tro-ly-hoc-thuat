import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ApiError, ApiErrorCode, Quota } from "../../shared/types.ts";
import { DEFAULT_TIER_START, nextReset, quotaRule, vnDay, weekStart } from "../../shared/tier.ts";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const fail = (error: ApiErrorCode, status: number, message?: string, quota?: Quota | null) =>
  json({ error, message, quota } satisfies ApiError, status);

let admin: SupabaseClient | null = null;
/** Khách hàng Supabase dùng service_role (chỉ chạy ở máy chủ, bỏ qua RLS). */
export function adminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

export interface AuthedUser { id: string; email: string; sb: SupabaseClient }

/** Xác thực JWT của Supabase; yêu cầu email đã xác thực. Trả về Response lỗi nếu không hợp lệ. */
export async function requireUser(request: Request): Promise<AuthedUser | Response> {
  const sb = adminClient();
  if (!sb) return fail("server_misconfigured", 500, "Thiếu cấu hình Supabase trên máy chủ.");
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return fail("unauthorized", 401);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return fail("unauthorized", 401);
  if (!data.user.email_confirmed_at) return fail("email_unverified", 403);
  return { id: data.user.id, email: data.user.email ?? "", sb };
}

export async function quotaOf(sb: SupabaseClient, userId: string): Promise<Quota | null> {
  // my_quota() dùng auth.uid(); với service_role tính trực tiếp (cùng quy tắc với quota_rule trong schema.sql).
  const { data: p } = await sb.from("profiles").select("role,status,approved,bonus_credits,lifetime_used,quota_limit,quota_period").eq("id", userId).single();
  if (!p) return null;
  const { data: st } = await sb.from("app_settings").select("key,value").in("key", ["free_daily_limit", "file_limit_basic_mb", "file_limit_approved_mb", "basic_weekly_limit", "tier_start"]);
  const val = (k: string) => st?.find((x) => x.key === k)?.value;
  const set = (k: string, d: number) => Number(val(k) ?? d);
  const today = vnDay();
  const tierStart = typeof val("tier_start") === "string" ? (val("tier_start") as string) : DEFAULT_TIER_START;
  const rule = quotaRule({
    role: p.role, approved: !!p.approved, quota_limit: p.quota_limit, quota_period: p.quota_period,
    free_daily_limit: set("free_daily_limit", 1), basic_weekly_limit: set("basic_weekly_limit", 1), tier_start: tierStart, today,
  });
  const approved = p.approved || p.role === "admin";
  const { data: u } = await sb.from("usage_daily").select("used").eq("user_id", userId).gte("day", rule.period === "week" ? weekStart(today) : today).lte("day", today);
  const used = (u ?? []).reduce((n, r) => n + (r.used ?? 0), 0);
  const lim = rule.tier === "admin" ? set("free_daily_limit", 1) : rule.limit;
  return {
    role: p.role, status: p.status, unlimited: p.role === "admin", approved,
    max_file_mb: approved ? set("file_limit_approved_mb", 15) : set("file_limit_basic_mb", 2), free_limit: lim, used_today: used,
    free_left: Math.max(lim - used, 0), bonus: p.bonus_credits, lifetime_used: p.lifetime_used,
    tier: rule.tier, period: rule.period, next_reset: nextReset(rule.period, today), gated: rule.tier === "basic" && today >= tierStart, tier_start: tierStart, basic_weekly: set("basic_weekly_limit", 1),
  };
}
