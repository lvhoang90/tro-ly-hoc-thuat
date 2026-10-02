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
  const { data: p } = await sb.from("profiles").select("role,status,bonus_credits,lifetime_used").eq("id", userId).single();
  if (!p) return null;
  const { data: s } = await sb.from("app_settings").select("value").eq("key", "free_daily_limit").maybeSingle();
  const lim = Number(s?.value ?? 2);
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const { data: u } = await sb.from("usage_daily").select("used").eq("user_id", userId).eq("day", day).maybeSingle();
  const used = u?.used ?? 0;
  return {
    role: p.role, status: p.status, unlimited: p.role === "admin", free_limit: lim, used_today: used,
    free_left: Math.max(lim - used, 0), bonus: p.bonus_credits, lifetime_used: p.lifetime_used,
  };
}
