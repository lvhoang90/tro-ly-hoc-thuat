// Xuất toàn bộ dữ liệu từ Supabase (Postgres) ra một tệp JSON để nhập vào máy chủ mới (xem docs/CPANEL.md).
//   DATABASE_URL="postgresql://postgres:<mật-khẩu-CSDL>@db.<mã-dự-án>.supabase.co:5432/postgres" npm run migrate:export
// DATABASE_URL lấy ở Supabase → Project Settings → Database → Connection string. Chỉ đặt trong môi trường của bạn, không gửi cho ai.
// Tệp xuất chứa email và mã băm mật khẩu: giữ riêng tư, xoá sau khi nhập xong.
import { writeFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Thiếu DATABASE_URL (xem hướng dẫn ở đầu tệp này)."); process.exit(1); }
const out = process.argv[2] || "ami-export.json";

const QUERIES = {
  auth_users: "select id, email, encrypted_password, email_confirmed_at, created_at, raw_user_meta_data from auth.users",
  profiles: "select * from public.profiles",
  app_settings: "select * from public.app_settings",
  admin_emails: "select * from public.admin_emails",
  usage_daily: "select user_id, day::text as day, used from public.usage_daily",
  usage_log: "select id::int as id, user_id, created_at, source, refunded, model, input_tokens, output_tokens, cost_usd::float8 as cost_usd, score from public.usage_log",
  credit_grants: "select id::int as id, user_id, admin_id, amount, note, created_at from public.credit_grants",
  projects: "select * from public.projects",
  citations: "select * from public.citations",
  admin_kv: "select * from public.admin_kv",
  visit_days: "select day::text as day, n::int as n from public.visit_days",
  visit_countries: "select country, n::int as n from public.visit_countries",
};

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
await client.connect();
const data = { exported_at: new Date().toISOString(), version: 1 };
for (const [k, sql] of Object.entries(QUERIES)) {
  const r = await client.query(`select coalesce(json_agg(row_to_json(t)), '[]'::json) as j from (${sql}) t`);
  data[k] = r.rows[0].j;
  console.log(`${k.padEnd(16)} ${data[k].length}`);
}
await client.end();
writeFileSync(out, JSON.stringify(data), { mode: 0o600 });
console.log(`\nĐã ghi ${out}. Giữ riêng tư (có mã băm mật khẩu) và xoá sau khi nhập xong.`);
