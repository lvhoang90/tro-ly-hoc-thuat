// Thống kê lượt truy cập ẩn danh (cùng cách làm với EduFind): không lưu IP, không cookie.
//   POST /api/visit → ghi một lượt (mỗi phiên trình duyệt một lần, do máy khách quyết định) rồi trả thống kê
//   GET  /api/visit → chỉ trả thống kê
// Lưu trữ: Upstash Redis qua REST (KV_REST_API_URL/TOKEN hoặc UPSTASH_REDIS_REST_URL/TOKEN). Chưa cấu hình thì trả { enabled: false }.
// Dùng tiền tố khóa riêng "troly:" nên không lẫn với bộ đếm EduFind dù chung một cơ sở Redis.
export const config = { runtime: "edge" };

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor|curl|wget|python-requests/i;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const dayKey = (back = 0) => new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10);
const P = "troly";

type Cmd = (string | number)[];
async function redis(url: string, token: string, commands: Cmd[]): Promise<any[]> {
  const r = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return ((await r.json()) as { result: unknown }[]).map((x) => x.result);
}

export default async function handler(request: Request): Promise<Response> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return json({ enabled: false });

  const ua = request.headers.get("user-agent") || "";
  const country = (request.headers.get("x-vercel-ip-country") || "").toUpperCase();
  try {
    const writes: Cmd[] = [];
    if (request.method === "POST" && !BOT.test(ua)) {
      writes.push(["INCR", `${P}:total`], ["INCR", `${P}:d:${dayKey()}`], ["EXPIRE", `${P}:d:${dayKey()}`, 60 * 86400]);
      if (/^[A-Z]{2}$/.test(country) && country !== "XX" && country !== "T1") writes.push(["HINCRBY", `${P}:countries`, country, 1]);
    }
    const days = Array.from({ length: 7 }, (_, i) => dayKey(6 - i));
    const res = (await redis(url, token, [...writes, ["GET", `${P}:total`], ["MGET", ...days.map((d) => `${P}:d:${d}`)], ["HGETALL", `${P}:countries`]])).slice(writes.length);
    const [total, perDay, flat] = res as [string | null, (string | null)[] | null, string[] | null];
    const pairs: { c: string; n: number }[] = [];
    for (let i = 0; i < (flat?.length ?? 0); i += 2) pairs.push({ c: flat![i], n: Number(flat![i + 1]) });
    pairs.sort((a, b) => b.n - a.n);
    const series = days.map((d, i) => ({ d, n: Number(perDay?.[i] ?? 0) }));
    return json({ enabled: true, total: Number(total ?? 0), today: series[6].n, days: series, countries: pairs.slice(0, 5) });
  } catch {
    return json({ enabled: false });
  }
}
