// Thống kê lượt truy cập ẩn danh (cùng cách hiển thị với EduFind): không lưu IP, không cookie.
//   POST /api/visit → ghi một lượt (mỗi phiên trình duyệt một lần, do máy khách quyết định) rồi trả thống kê
//   GET  /api/visit → chỉ trả thống kê
// Lưu trong Supabase (hàm record_visit / visit_stats trong schema.sql, chỉ service_role gọi được), nên không cần dịch vụ ngoài.
// Quốc gia lấy từ tiêu đề x-vercel-ip-country do Vercel gắn. Chưa cấu hình Supabase thì trả { enabled: false }.
export const config = { runtime: "edge" };

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor|curl|wget|python-requests/i;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function rpc(url: string, key: string, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${fn} ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export default async function handler(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ enabled: false });
  const ua = request.headers.get("user-agent") || "";
  const country = (request.headers.get("x-vercel-ip-country") || "").toUpperCase();
  try {
    if (request.method === "POST" && !BOT.test(ua)) await rpc(url, key, "record_visit", { p_country: country });
    const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 30, 7), 90);
    const s = (await rpc(url, key, "visit_stats", { p_days: days })) as { total: number; today: number; days: { d: string; n: number }[]; countries: { c: string; n: number }[] };
    return json({ enabled: true, ...s });
  } catch {
    return json({ enabled: false });
  }
}
