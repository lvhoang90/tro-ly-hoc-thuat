// Nhập dữ liệu xuất từ Supabase (scripts/migrate-export.mjs) vào SQLite. Giữ nguyên id, mã băm mật khẩu, lịch sử, hạn mức.
import { db, get, run, tx } from "./db.ts";

type Rec = Record<string, any>;
export interface Export {
  auth_users: Rec[]; profiles: Rec[]; app_settings: Rec[]; admin_emails: Rec[]; usage_daily: Rec[]; usage_log: Rec[];
  credit_grants: Rec[]; projects: Rec[]; citations: Rec[]; admin_kv: Rec[]; visit_days: Rec[]; visit_countries: Rec[];
}

const iso = (v: unknown): string | null => { if (!v) return null; const d = new Date(String(v)); return Number.isNaN(+d) ? null : d.toISOString(); };
const j = (v: unknown, d: unknown) => JSON.stringify(v ?? d);
const TABLES = ["credit_grants", "usage_log", "usage_daily", "citations", "projects", "profiles", "email_tokens", "sessions", "users", "admin_emails", "admin_kv", "visit_days", "visit_countries"];

export function importData(x: Export, opts: { replace?: boolean } = {}): Record<string, number> {
  const have = Number(get("select count(*) c from users")!.c);
  if (have && !opts.replace) throw new Error(`CSDL đã có ${have} tài khoản. Dùng --replace để xoá và nhập lại từ đầu.`);
  const n: Record<string, number> = {};
  tx(() => {
    if (opts.replace) for (const t of TABLES) db.exec(`delete from ${t}`);
    const ids = new Set<string>();
    for (const u of x.auth_users) {
      const created = iso(u.created_at) ?? new Date().toISOString();
      run("insert into users(id, email, pw_hash, email_verified_at, full_name, created_at) values (?,?,?,?,?,?)",
        u.id, u.email, u.encrypted_password || "", iso(u.email_confirmed_at), String(u.raw_user_meta_data?.full_name ?? ""), created);
      ids.add(u.id);
    }
    n.users = ids.size;
    const profileIds = new Set<string>();
    for (const p of x.profiles) {
      if (!ids.has(p.id)) continue;
      run(`insert into profiles(id,email,full_name,title,affiliation,department,position,country,orcid,research_fields,keywords,bio,website,
        scholar_url,scopus_id,phone,role,status,approved,bonus_credits,lifetime_used,created_at,updated_at,last_seen) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        p.id, p.email, p.full_name ?? "", p.title ?? "", p.affiliation ?? "", p.department ?? "", p.position ?? "", p.country ?? "VN", p.orcid ?? "",
        j(p.research_fields, []), j(p.keywords, []), p.bio ?? "", p.website ?? "", p.scholar_url ?? "", p.scopus_id ?? "", p.phone ?? "",
        p.role, p.status, p.approved || p.role === "admin" ? 1 : 0, p.bonus_credits ?? 0, p.lifetime_used ?? 0,
        iso(p.created_at) ?? new Date().toISOString(), iso(p.updated_at) ?? iso(p.created_at) ?? new Date().toISOString(), iso(p.last_seen));
      profileIds.add(p.id);
    }
    n.profiles = profileIds.size;
    const has = (id: string) => profileIds.has(id);
    for (const e of x.admin_emails) run("insert or ignore into admin_emails(email) values (?)", e.email);
    for (const s of x.app_settings) run("insert into app_settings(key, value) values (?,?) on conflict(key) do update set value = excluded.value", s.key, j(s.value, null));
    for (const d of x.usage_daily) if (has(d.user_id)) run("insert into usage_daily(user_id, day, used) values (?,?,?)", d.user_id, d.day, d.used);
    for (const l of x.usage_log) if (has(l.user_id))
      run("insert into usage_log(id,user_id,created_at,source,refunded,model,input_tokens,output_tokens,cost_usd,score) values (?,?,?,?,?,?,?,?,?,?)",
        l.id, l.user_id, iso(l.created_at), l.source, l.refunded ? 1 : 0, l.model ?? "", l.input_tokens ?? 0, l.output_tokens ?? 0, Number(l.cost_usd) || 0, l.score ?? null);
    for (const g of x.credit_grants) if (has(g.user_id))
      run("insert into credit_grants(id,user_id,admin_id,amount,note,created_at) values (?,?,?,?,?,?)", g.id, g.user_id, has(g.admin_id) ? g.admin_id : null, g.amount, g.note ?? "", iso(g.created_at));
    const projIds = new Set<string>();
    for (const p of x.projects) if (has(p.user_id)) {
      run("insert into projects(id,user_id,title,abstract,created_at,updated_at) values (?,?,?,?,?,?)", p.id, p.user_id, p.title ?? "", p.abstract ?? "", iso(p.created_at), iso(p.updated_at) ?? iso(p.created_at));
      projIds.add(p.id);
    }
    for (const c of x.citations) if (has(c.user_id))
      run(`insert into citations(id,user_id,created_at,style,cite_lang,reference,in_text,quote,page,priority,project,source,score,project_id,abstract_hash,abstract_title)
        values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, c.id, c.user_id, iso(c.created_at), c.style, c.cite_lang ?? "en", c.reference, c.in_text ?? "", c.quote ?? "", c.page ?? "",
        c.priority ?? "", c.project ?? "", j(c.source, {}), c.score ?? null, projIds.has(c.project_id) ? c.project_id : null, c.abstract_hash ?? "", c.abstract_title ?? "");
    for (const k of x.admin_kv) run("insert into admin_kv(key, value, updated_at) values (?,?,?)", k.key, j(k.value, {}), iso(k.updated_at) ?? new Date().toISOString());
    for (const v of x.visit_days) run("insert into visit_days(day, n) values (?,?)", v.day, v.n);
    for (const v of x.visit_countries) run("insert into visit_countries(country, n) values (?,?)", v.country, v.n);
    for (const t of ["usage_log", "credit_grants", "usage_daily", "citations", "projects", "admin_kv", "visit_days", "visit_countries", "admin_emails"] as const) {
      const r = x[t]; n[t] = Number(get(`select count(*) c from ${t}`)!.c); void r;
    }
  });
  return n;
}
