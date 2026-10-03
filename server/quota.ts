// Hạn mức và các hàm quản trị: bản SQLite của consume_credit, refund_credit, my_quota, admin_* trong supabase/schema.sql.
import type { Quota } from "../shared/types.ts";
import { all, get, now, run, setting, tx, vnDay, type Row } from "./db.ts";

export class RpcError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }

export type Consume =
  | { ok: true; source: "free" | "bonus" | "admin"; log_id: number; free_left: number; bonus: number }
  | { ok: false; reason: "no_profile" | "suspended" | "quota_exhausted" };

export function consumeCredit(userId: string): Consume {
  return tx(() => {
    const p = get("select * from profiles where id = ?", userId);
    if (!p) return { ok: false, reason: "no_profile" } as const;
    if (p.status !== "active") return { ok: false, reason: "suspended" } as const;
    const lim = setting("free_daily_limit", 1), d = vnDay();
    run("insert or ignore into usage_daily(user_id, day, used) values (?,?,0)", userId, d);
    let used = get("select used from usage_daily where user_id = ? and day = ?", userId, d)!.used as number;
    let bonus = p.bonus_credits as number;
    let src: "free" | "bonus" | "admin";
    if (p.role === "admin") src = "admin";
    else if (used < lim) { run("update usage_daily set used = used + 1 where user_id = ? and day = ?", userId, d); used++; src = "free"; }
    else if (bonus > 0) { run("update profiles set bonus_credits = bonus_credits - 1 where id = ?", userId); bonus--; src = "bonus"; }
    else return { ok: false, reason: "quota_exhausted" } as const;
    const t = now();
    run("update profiles set lifetime_used = lifetime_used + 1, last_seen = ? where id = ?", t, userId);
    const log = run("insert into usage_log(user_id, created_at, source) values (?,?,?)", userId, t, src);
    return { ok: true, source: src, log_id: Number(log.lastInsertRowid), free_left: Math.max(lim - used, 0), bonus } as const;
  });
}

export function refundCredit(userId: string, source: string) {
  tx(() => {
    const l = get("select id from usage_log where user_id = ? and source = ? and refunded = 0 order by id desc limit 1", userId, source);
    if (!l) return;
    run("update usage_log set refunded = 1 where id = ?", l.id);
    run("update profiles set lifetime_used = max(lifetime_used - 1, 0) where id = ?", userId);
    if (source === "free") run("update usage_daily set used = max(used - 1, 0) where user_id = ? and day = ?", userId, vnDay());
    else if (source === "bonus") run("update profiles set bonus_credits = bonus_credits + 1 where id = ?", userId);
  });
}

export function recordUsage(logId: number, model: string, inT: number, outT: number, cost: number, score: number | null) {
  run("update usage_log set model = ?, input_tokens = max(?,0), output_tokens = max(?,0), cost_usd = max(?,0), score = ? where id = ?",
    model || "", inT || 0, outT || 0, cost || 0, score, logId);
}

export function quotaOf(userId: string): Quota | null {
  const p = get("select role,status,approved,bonus_credits,lifetime_used from profiles where id = ?", userId);
  if (!p) return null;
  const lim = setting("free_daily_limit", 1);
  const approved = !!p.approved || p.role === "admin";
  const used = (get("select used from usage_daily where user_id = ? and day = ?", userId, vnDay())?.used as number | undefined) ?? 0;
  return {
    role: p.role as "user" | "admin", status: p.status as "active" | "suspended", unlimited: p.role === "admin", approved,
    max_file_mb: approved ? setting("file_limit_approved_mb", 15) : setting("file_limit_basic_mb", 2),
    free_limit: lim, used_today: used, free_left: Math.max(lim - used, 0), bonus: p.bonus_credits as number, lifetime_used: p.lifetime_used as number,
  };
}

// ---------- Quản trị ----------
const asInt = (v: unknown, d: number, lo: number, hi: number) => Math.min(Math.max(Math.trunc(Number(v)) || d, lo), hi);
const VN = "date(created_at, '+7 hours')";
const days = (n: number) => { // n ngày gần nhất theo giờ VN, cũ → mới
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(vnDay(Date.now() - i * 86400e3));
  return out;
};
const sinceIso = (n: number) => new Date(Date.now() - n * 86400e3).toISOString();
const fix = (r: Row | undefined, keys: string[]) => { if (r) for (const k of keys) r[k] = Number(r[k] ?? 0); return r; };

export function adminListUsers(a: { p_search?: string; p_limit?: number; p_offset?: number; p_pending?: boolean }) {
  const q = `%${(a.p_search ?? "").trim()}%`, search = (a.p_search ?? "").trim() !== "";
  const where = `(? = 0 or p.email like ? escape '\\' or p.full_name like ? escape '\\' or p.orcid like ? escape '\\' or p.affiliation like ? escape '\\')
    and (? = 0 or (p.approved = 0 and p.role <> 'admin'))`;
  const esc = q.replace(/[\\]/g, "\\\\");
  const args = [search ? 1 : 0, esc, esc, esc, esc, a.p_pending ? 1 : 0];
  const total = Number(get(`select count(*) c from profiles p where ${where}`, ...args)!.c);
  const rows = all(
    `select p.id, p.email, p.full_name, p.affiliation, p.orcid, p.role, p.status, (p.approved or p.role = 'admin') approved,
       p.bonus_credits, p.lifetime_used, coalesce(ud.used, 0) used_today,
       coalesce((select sum(l.cost_usd) from usage_log l where l.user_id = p.id), 0) cost_usd, p.created_at, p.last_seen
     from profiles p left join usage_daily ud on ud.user_id = p.id and ud.day = ?
     where ${where} order by p.created_at desc limit ? offset ?`,
    vnDay(), ...args, asInt(a.p_limit, 50, 1, 200), Math.max(Number(a.p_offset) || 0, 0));
  return rows.map((r) => ({ ...r, approved: !!r.approved, total_count: total }));
}

export function adminGrantCredits(admin: string, a: { p_user: string; p_amount: number; p_note?: string }) {
  return tx(() => {
    const p = get("select bonus_credits from profiles where id = ?", a.p_user);
    if (!p) throw new RpcError("user not found");
    const nb = Math.max((p.bonus_credits as number) + Math.trunc(Number(a.p_amount) || 0), 0);
    run("update profiles set bonus_credits = ? where id = ?", nb, a.p_user);
    run("insert into credit_grants(user_id, admin_id, amount, note, created_at) values (?,?,?,?,?)", a.p_user, admin, Math.trunc(Number(a.p_amount) || 0), a.p_note ?? "", now());
    return nb;
  });
}

export function adminSetUser(admin: string, a: { p_user: string; p_role?: string | null; p_status?: string | null; p_approved?: boolean | null }) {
  if (a.p_user === admin && (a.p_role === "user" || a.p_status === "suspended")) throw new RpcError("cannot demote or suspend yourself");
  for (const [v, ok] of [[a.p_role, ["user", "admin"]], [a.p_status, ["active", "suspended"]]] as const)
    if (v != null && !ok.includes(v as never)) throw new RpcError("invalid value");
  const p = get("select role, status, approved from profiles where id = ?", a.p_user);
  if (!p) return;
  const role = a.p_role ?? (p.role as string);
  const approved = role === "admin" ? 1 : a.p_approved == null ? (p.approved as number) : a.p_approved ? 1 : 0;
  run("update profiles set role = ?, status = ?, approved = ? where id = ?", role, a.p_status ?? p.status, approved, a.p_user);
  if (a.p_status === "suspended") run("delete from sessions where user_id = ?", a.p_user);
}

export function adminStats() {
  const c = (sql: string, ...p: unknown[]) => Number(Object.values(get(sql, ...p)!)[0] ?? 0);
  const d = vnDay(), lim = setting("free_daily_limit", 1);
  return {
    users: c("select count(*) from profiles"),
    approved_users: c("select count(*) from profiles where approved = 1 or role = 'admin'"),
    pending_users: c("select count(*) from profiles where approved = 0 and role <> 'admin'"),
    new_7d: c("select count(*) from profiles where created_at > ?", sinceIso(7)),
    analyses_today: c(`select count(*) from usage_log where refunded = 0 and ${VN} = ?`, d),
    analyses_7d: c("select count(*) from usage_log where refunded = 0 and created_at > ?", sinceIso(7)),
    analyses_total: c("select count(*) from usage_log where refunded = 0"),
    refunded_total: c("select count(*) from usage_log where refunded = 1"),
    citations_total: c("select count(*) from citations"),
    bonus_outstanding: c("select coalesce(sum(bonus_credits),0) from profiles"),
    exhausted_today: c(`select count(*) from usage_daily d join profiles p on p.id = d.user_id
      where d.day = ? and d.used >= ? and p.bonus_credits = 0 and p.role = 'user'`, d, lim),
    cost_total: c("select coalesce(sum(cost_usd),0) from usage_log"),
    cost_today: c(`select coalesce(sum(cost_usd),0) from usage_log where ${VN} = ?`, d),
    cost_30d: c("select coalesce(sum(cost_usd),0) from usage_log where created_at > ?", sinceIso(30)),
    cost_refunded: c("select coalesce(sum(cost_usd),0) from usage_log where refunded = 1"),
    tokens_in: c("select coalesce(sum(input_tokens),0) from usage_log"),
    tokens_out: c("select coalesce(sum(output_tokens),0) from usage_log"),
  };
}

export function adminTimeseries(a: { p_days?: number }) {
  const n = asInt(a.p_days, 30, 1, 365), ds = days(n);
  const from = ds[0];
  const by = (sql: string) => new Map(all(sql, from).map((r) => [r.d as string, r]));
  const logs = by(`select ${VN} d, sum(refunded = 0) analyses, sum(refunded = 1) refunded, sum(cost_usd) cost_usd,
    sum(input_tokens) input_tokens, sum(output_tokens) output_tokens from usage_log where ${VN} >= ? group by d`);
  const users = by(`select ${VN} d, count(*) n from profiles where ${VN} >= ? group by d`);
  const cites = by(`select ${VN} d, count(*) n from citations where ${VN} >= ? group by d`);
  return ds.map((day) => {
    const l = logs.get(day);
    return {
      day, analyses: Number(l?.analyses ?? 0), refunded: Number(l?.refunded ?? 0), cost_usd: Number(l?.cost_usd ?? 0),
      input_tokens: Number(l?.input_tokens ?? 0), output_tokens: Number(l?.output_tokens ?? 0),
      new_users: Number(users.get(day)?.n ?? 0), citations: Number(cites.get(day)?.n ?? 0),
    };
  });
}

export function adminTopUsers(a: { p_days?: number; p_limit?: number }) {
  return all(
    `select p.id user_id, p.email, p.full_name, sum(l.refunded = 0) analyses, coalesce(sum(l.cost_usd),0) cost_usd,
       coalesce(sum(l.input_tokens + l.output_tokens),0) tokens
     from usage_log l join profiles p on p.id = l.user_id where l.created_at > ?
     group by p.id order by cost_usd desc limit ?`, sinceIso(asInt(a.p_days, 30, 1, 365)), asInt(a.p_limit, 8, 1, 50))
    .map((r) => fix(r, ["analyses", "cost_usd", "tokens"]));
}

export function adminScoreHist(a: { p_days?: number }) {
  const rows = all(`select min(score / 10, 9) b, count(*) n from usage_log where score is not null and refunded = 0 and created_at > ?
    group by b`, sinceIso(asInt(a.p_days, 30, 1, 365)));
  return Array.from({ length: 10 }, (_, b) => ({ bucket: b, n: Number(rows.find((r) => r.b === b)?.n ?? 0) }));
}

export function adminSpendSince(a: { p_since: string }) {
  const t = new Date(a.p_since);
  if (Number.isNaN(+t)) throw new RpcError("invalid date");
  const r = get(`select coalesce(sum(cost_usd),0) cost_usd, coalesce(sum(input_tokens),0) input_tokens,
    coalesce(sum(output_tokens),0) output_tokens, coalesce(sum(refunded = 0),0) analyses from usage_log where created_at >= ?`, t.toISOString())!;
  return [fix(r, ["cost_usd", "input_tokens", "output_tokens", "analyses"])];
}

const SETTINGS = ["free_daily_limit", "contact", "file_limit_basic_mb", "file_limit_approved_mb", "usd_vnd"];
export function adminSetSetting(a: { p_key: string; p_value: unknown }) {
  if (!SETTINGS.includes(a.p_key)) throw new RpcError("unknown setting");
  run("insert into app_settings(key, value) values (?,?) on conflict(key) do update set value = excluded.value", a.p_key, JSON.stringify(a.p_value ?? null));
}

// ---------- Bộ đếm truy cập ẩn danh ----------
export function recordVisit(country: string) {
  run("insert into visit_days(day, n) values (?,1) on conflict(day) do update set n = n + 1", vnDay());
  if (/^[A-Z]{2}$/.test(country) && country !== "XX" && country !== "T1")
    run("insert into visit_countries(country, n) values (?,1) on conflict(country) do update set n = n + 1", country);
}

export function visitStats(n: number) {
  const ds = days(Math.max(n, 1));
  const m = new Map(all("select day, n from visit_days where day >= ?", ds[0]).map((r) => [r.day as string, Number(r.n)]));
  return {
    total: Number(get("select coalesce(sum(n),0) s from visit_days")!.s),
    today: m.get(vnDay()) ?? 0,
    days: ds.map((d) => ({ d, n: m.get(d) ?? 0 })),
    countries: all("select country c, n from visit_countries order by n desc limit 10").map((r) => ({ c: r.c, n: Number(r.n) })),
  };
}
