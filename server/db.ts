// CSDL SQLite (node:sqlite) cho bản chạy trên hosting dùng chung. Thay thế Supabase/Postgres:
// cùng lược đồ logic, nhưng thời gian lưu dạng chuỗi ISO UTC và "ngày" tính theo giờ Việt Nam (UTC+7).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(process.env.DB_FILE || path.join(DATA_DIR, "ami.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

db.exec(`
create table if not exists users (
  id text primary key,
  email text not null unique collate nocase,
  pw_hash text not null default '',
  email_verified_at text,
  full_name text not null default '',
  created_at text not null
);
create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at text not null,
  expires_at text not null
);
create table if not exists email_tokens (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  kind text not null,
  expires_at text not null
);
create table if not exists app_settings (key text primary key, value text not null);
create table if not exists admin_emails (email text primary key collate nocase);
create table if not exists profiles (
  id text primary key references users(id) on delete cascade,
  email text not null,
  full_name text not null default '', title text not null default '', affiliation text not null default '',
  department text not null default '', position text not null default '', country text not null default 'VN',
  orcid text not null default '', research_fields text not null default '[]', keywords text not null default '[]',
  bio text not null default '', website text not null default '', scholar_url text not null default '',
  scopus_id text not null default '', phone text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'active' check (status in ('active','suspended')),
  approved integer not null default 0,
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  lifetime_used integer not null default 0,
  created_at text not null, updated_at text not null, last_seen text
);
create table if not exists usage_daily (
  user_id text not null references profiles(id) on delete cascade, day text not null, used integer not null default 0,
  primary key (user_id, day)
);
create table if not exists usage_log (
  id integer primary key autoincrement,
  user_id text not null references profiles(id) on delete cascade,
  created_at text not null,
  source text not null check (source in ('free','bonus','admin')),
  refunded integer not null default 0,
  model text not null default '', input_tokens integer not null default 0, output_tokens integer not null default 0,
  cost_usd real not null default 0, score integer
);
create index if not exists usage_log_user_idx on usage_log(user_id, created_at);
create index if not exists usage_log_time_idx on usage_log(created_at);
create table if not exists credit_grants (
  id integer primary key autoincrement,
  user_id text not null references profiles(id) on delete cascade,
  admin_id text references profiles(id) on delete set null,
  amount integer not null, note text not null default '', created_at text not null
);
create table if not exists projects (
  id text primary key, user_id text not null references profiles(id) on delete cascade,
  title text not null default '', abstract text not null default '', created_at text not null, updated_at text not null
);
create index if not exists projects_user_idx on projects(user_id, updated_at);
create table if not exists citations (
  id text primary key, user_id text not null references profiles(id) on delete cascade,
  created_at text not null, style text not null, cite_lang text not null default 'en',
  reference text not null, in_text text not null default '', quote text not null default '',
  page text not null default '', priority text not null default '', project text not null default '',
  source text not null default '{}', score integer,
  project_id text references projects(id) on delete set null,
  abstract_hash text not null default '', abstract_title text not null default ''
);
create index if not exists citations_user_idx on citations(user_id, created_at);
create table if not exists admin_kv (key text primary key, value text not null default '{}', updated_at text not null);
create table if not exists visit_days (day text primary key, n integer not null default 0);
create table if not exists visit_countries (country text primary key, n integer not null default 0);
`);

const DEFAULTS: Record<string, unknown> = {
  free_daily_limit: 1, file_limit_basic_mb: 2, file_limit_approved_mb: 15, usd_vnd: 25500,
  contact: { email: "", phone: "", zalo: "", note_vi: "", note_en: "" },
};
for (const [k, v] of Object.entries(DEFAULTS))
  db.prepare("insert or ignore into app_settings(key, value) values (?, ?)").run(k, JSON.stringify(v));

export type Row = Record<string, unknown>;
export const all = (sql: string, ...p: unknown[]) => db.prepare(sql).all(...(p as never[])) as Row[];
export const get = (sql: string, ...p: unknown[]) => db.prepare(sql).get(...(p as never[])) as Row | undefined;
export const run = (sql: string, ...p: unknown[]) => db.prepare(sql).run(...(p as never[]));

export const now = () => new Date().toISOString();
/** "Hôm nay" theo giờ Việt Nam (hạn mức đặt lại lúc 00:00 UTC+7). */
export const vnDay = (t = Date.now()) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
export const tx = <T>(fn: () => T): T => {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
};

export function setting<T = number>(key: string, fallback: T): T {
  const r = get("select value from app_settings where key = ?", key);
  if (!r) return fallback;
  try { return JSON.parse(r.value as string) as T; } catch { return fallback; }
}

/** Hồ sơ mới (tương đương trigger handle_new_user): email trong admin_emails tự thành quản trị viên. */
export function createProfile(userId: string, email: string, fullName: string, createdAt = now()) {
  const adm = !!get("select 1 from admin_emails where lower(email) = lower(?)", email);
  run(`insert or ignore into profiles(id, email, full_name, role, approved, created_at, updated_at) values (?,?,?,?,?,?,?)`,
    userId, email, fullName, adm ? "admin" : "user", adm ? 1 : 0, createdAt, createdAt);
}

/** Email thêm vào admin_emails (ADMIN_EMAIL) sau khi đã đăng ký thì tự nâng quyền. */
export function addAdminEmail(email: string) {
  run("insert or ignore into admin_emails(email) values (?)", email);
  run("update profiles set role = 'admin', approved = 1 where lower(email) = lower(?)", email);
}
