import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);

// server/cli-import.ts
import { readFileSync } from "node:fs";

// server/db.ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
var DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
mkdirSync(DATA_DIR, { recursive: true });
var db = new DatabaseSync(process.env.DB_FILE || path.join(DATA_DIR, "ami.db"));
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
var DEFAULTS = {
  free_daily_limit: 1,
  file_limit_basic_mb: 2,
  file_limit_approved_mb: 15,
  usd_vnd: 25500,
  contact: { email: "", phone: "", zalo: "", note_vi: "", note_en: "" }
};
for (const [k, v] of Object.entries(DEFAULTS))
  db.prepare("insert or ignore into app_settings(key, value) values (?, ?)").run(k, JSON.stringify(v));
var get = (sql, ...p) => db.prepare(sql).get(...p);
var run = (sql, ...p) => db.prepare(sql).run(...p);
var tx = (fn) => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
};

// server/migrate.ts
var iso = (v) => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(+d) ? null : d.toISOString();
};
var j = (v, d) => JSON.stringify(v ?? d);
var TABLES = ["credit_grants", "usage_log", "usage_daily", "citations", "projects", "profiles", "email_tokens", "sessions", "users", "admin_emails", "admin_kv", "visit_days", "visit_countries"];
function importData(x, opts = {}) {
  const have = Number(get("select count(*) c from users").c);
  if (have && !opts.replace) throw new Error(`CSDL \u0111\xE3 c\xF3 ${have} t\xE0i kho\u1EA3n. D\xF9ng --replace \u0111\u1EC3 xo\xE1 v\xE0 nh\u1EADp l\u1EA1i t\u1EEB \u0111\u1EA7u.`);
  const n = {};
  tx(() => {
    if (opts.replace) for (const t of TABLES) db.exec(`delete from ${t}`);
    const ids = /* @__PURE__ */ new Set();
    for (const u of x.auth_users) {
      const created = iso(u.created_at) ?? (/* @__PURE__ */ new Date()).toISOString();
      run(
        "insert into users(id, email, pw_hash, email_verified_at, full_name, created_at) values (?,?,?,?,?,?)",
        u.id,
        u.email,
        u.encrypted_password || "",
        iso(u.email_confirmed_at),
        String(u.raw_user_meta_data?.full_name ?? ""),
        created
      );
      ids.add(u.id);
    }
    n.users = ids.size;
    const profileIds = /* @__PURE__ */ new Set();
    for (const p of x.profiles) {
      if (!ids.has(p.id)) continue;
      run(
        `insert into profiles(id,email,full_name,title,affiliation,department,position,country,orcid,research_fields,keywords,bio,website,
        scholar_url,scopus_id,phone,role,status,approved,bonus_credits,lifetime_used,created_at,updated_at,last_seen) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        p.id,
        p.email,
        p.full_name ?? "",
        p.title ?? "",
        p.affiliation ?? "",
        p.department ?? "",
        p.position ?? "",
        p.country ?? "VN",
        p.orcid ?? "",
        j(p.research_fields, []),
        j(p.keywords, []),
        p.bio ?? "",
        p.website ?? "",
        p.scholar_url ?? "",
        p.scopus_id ?? "",
        p.phone ?? "",
        p.role,
        p.status,
        p.approved || p.role === "admin" ? 1 : 0,
        p.bonus_credits ?? 0,
        p.lifetime_used ?? 0,
        iso(p.created_at) ?? (/* @__PURE__ */ new Date()).toISOString(),
        iso(p.updated_at) ?? iso(p.created_at) ?? (/* @__PURE__ */ new Date()).toISOString(),
        iso(p.last_seen)
      );
      profileIds.add(p.id);
    }
    n.profiles = profileIds.size;
    const has = (id) => profileIds.has(id);
    for (const e of x.admin_emails) run("insert or ignore into admin_emails(email) values (?)", e.email);
    for (const s of x.app_settings) run("insert into app_settings(key, value) values (?,?) on conflict(key) do update set value = excluded.value", s.key, j(s.value, null));
    for (const d of x.usage_daily) if (has(d.user_id)) run("insert into usage_daily(user_id, day, used) values (?,?,?)", d.user_id, d.day, d.used);
    for (const l of x.usage_log) if (has(l.user_id))
      run(
        "insert into usage_log(id,user_id,created_at,source,refunded,model,input_tokens,output_tokens,cost_usd,score) values (?,?,?,?,?,?,?,?,?,?)",
        l.id,
        l.user_id,
        iso(l.created_at),
        l.source,
        l.refunded ? 1 : 0,
        l.model ?? "",
        l.input_tokens ?? 0,
        l.output_tokens ?? 0,
        Number(l.cost_usd) || 0,
        l.score ?? null
      );
    for (const g of x.credit_grants) if (has(g.user_id))
      run("insert into credit_grants(id,user_id,admin_id,amount,note,created_at) values (?,?,?,?,?,?)", g.id, g.user_id, has(g.admin_id) ? g.admin_id : null, g.amount, g.note ?? "", iso(g.created_at));
    const projIds = /* @__PURE__ */ new Set();
    for (const p of x.projects) if (has(p.user_id)) {
      run("insert into projects(id,user_id,title,abstract,created_at,updated_at) values (?,?,?,?,?,?)", p.id, p.user_id, p.title ?? "", p.abstract ?? "", iso(p.created_at), iso(p.updated_at) ?? iso(p.created_at));
      projIds.add(p.id);
    }
    for (const c of x.citations) if (has(c.user_id))
      run(
        `insert into citations(id,user_id,created_at,style,cite_lang,reference,in_text,quote,page,priority,project,source,score,project_id,abstract_hash,abstract_title)
        values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        c.id,
        c.user_id,
        iso(c.created_at),
        c.style,
        c.cite_lang ?? "en",
        c.reference,
        c.in_text ?? "",
        c.quote ?? "",
        c.page ?? "",
        c.priority ?? "",
        c.project ?? "",
        j(c.source, {}),
        c.score ?? null,
        projIds.has(c.project_id) ? c.project_id : null,
        c.abstract_hash ?? "",
        c.abstract_title ?? ""
      );
    for (const k of x.admin_kv) run("insert into admin_kv(key, value, updated_at) values (?,?,?)", k.key, j(k.value, {}), iso(k.updated_at) ?? (/* @__PURE__ */ new Date()).toISOString());
    for (const v of x.visit_days) run("insert into visit_days(day, n) values (?,?)", v.day, v.n);
    for (const v of x.visit_countries) run("insert into visit_countries(country, n) values (?,?)", v.country, v.n);
    for (const t of ["usage_log", "credit_grants", "usage_daily", "citations", "projects", "admin_kv", "visit_days", "visit_countries", "admin_emails"]) {
      const r = x[t];
      n[t] = Number(get(`select count(*) c from ${t}`).c);
      void r;
    }
  });
  return n;
}

// server/cli-import.ts
var [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("D\xF9ng: node server-dist/import.mjs ami-export.json [--replace]");
  process.exit(1);
}
var data = JSON.parse(readFileSync(file, "utf8"));
try {
  const n = importData(data, { replace: flags.includes("--replace") });
  console.log(`\u0110\xE3 nh\u1EADp v\xE0o ${DATA_DIR}:`);
  for (const [k, v] of Object.entries(n)) console.log(`  ${k.padEnd(16)} ${v}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
