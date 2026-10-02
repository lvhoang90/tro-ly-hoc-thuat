import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ApiError, ApiErrorCode, Quota } from "../../shared/types.ts";

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
  // my_quota() dùng auth.uid(); với service_role tính trực tiếp.
  const { data: p } = await sb.from("profiles").select("role,status,approved,bonus_credits,lifetime_used").eq("id", userId).single();
  if (!p) return null;
  const { data: st } = await sb.from("app_settings").select("key,value").in("key", ["free_daily_limit", "file_limit_basic_mb", "file_limit_approved_mb"]);
  const set = (k: string, d: number) => Number(st?.find((x) => x.key === k)?.value ?? d);
  const lim = set("free_daily_limit", 1);
  const approved = p.approved || p.role === "admin";
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const { data: u } = await sb.from("usage_daily").select("used").eq("user_id", userId).eq("day", day).maybeSingle();
  const used = u?.used ?? 0;
  return {
    role: p.role, status: p.status, unlimited: p.role === "admin", approved,
    max_file_mb: approved ? set("file_limit_approved_mb", 15) : set("file_limit_basic_mb", 2), free_limit: lim, used_today: used,
    free_left: Math.max(lim - used, 0), bonus: p.bonus_credits, lifetime_used: p.lifetime_used,
  };
}
