// Điểm truy cập dữ liệu cho giao diện (thay PostgREST + RLS của Supabase): bảng nào, thao tác nào, cột nào đều khai báo ở đây.
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { userFromRequest } from "./auth.ts";
import { all, get, now, run, type Row } from "./db.ts";
import * as q from "./quota.ts";

interface Table {
  json?: string[]; bool?: string[];
  /** Chỉ chủ sở hữu (user_id = mình) hoặc quản trị đọc. */
  read: "public" | "own" | "own_or_admin" | "admin";
  /** Thao tác ghi cho phép; cột được sửa. */
  write?: { insert?: boolean; update?: string[] | true; delete?: boolean; upsert?: boolean; own?: boolean; admin?: boolean };
  pk: string;
}
const TABLES: Record<string, Table> = {
  app_settings: { json: ["value"], read: "public", pk: "key" },
  profiles: {
    json: ["research_fields", "keywords"], bool: ["approved"], read: "own_or_admin", pk: "id",
    write: { update: ["full_name", "title", "affiliation", "department", "position", "country", "orcid", "research_fields", "keywords", "bio", "website", "scholar_url", "scopus_id", "phone", "updated_at"], own: true },
  },
  usage_daily: { read: "own_or_admin", pk: "user_id" },
  usage_log: { bool: ["refunded"], read: "own_or_admin", pk: "id" },
  credit_grants: { read: "own_or_admin", pk: "id" },
  citations: { json: ["source"], read: "own", pk: "id", write: { insert: true, update: true, delete: true, own: true } },
  projects: { read: "own", pk: "id", write: { insert: true, update: true, delete: true, own: true } },
  admin_kv: { json: ["value"], read: "admin", pk: "key", write: { insert: true, update: true, delete: true, upsert: true, admin: true } },
};
const ident = /^[a-z_][a-z0-9_]*$/;

interface Filter { col: string; op: "eq" | "neq" | "in"; val: unknown }
interface Req {
  table: string; op: "select" | "insert" | "update" | "delete" | "upsert";
  filters?: Filter[]; order?: { col: string; asc: boolean }[]; limit?: number; values?: Row | Row[]; single?: "single" | "maybe" | null;
}

class Fail extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }

const decode = (t: Table, r: Row): Row => {
  const o: Row = { ...r };
  for (const c of t.json ?? []) if (typeof o[c] === "string") { try { o[c] = JSON.parse(o[c] as string); } catch { /* giữ nguyên */ } }
  for (const c of t.bool ?? []) if (c in o) o[c] = !!o[c];
  return o;
};
const encode = (t: Table, c: string, v: unknown): unknown =>
  t.json?.includes(c) ? JSON.stringify(v ?? null) : t.bool?.includes(c) ? (v ? 1 : 0) : typeof v === "boolean" ? (v ? 1 : 0) : v ?? null;

function exec(b: Req, user: { id: string } | null, isAdmin: boolean): Row[] | Row | null {
  const t = TABLES[b.table];
  if (!t) throw new Fail("unknown table", 404);
  const uid = user?.id ?? "";
  const scoped = t.read === "own" || (t.read === "own_or_admin" && !isAdmin);
  if (t.read !== "public" && !user) throw new Fail("unauthorized", 401);
  if (t.read === "admin" && !isAdmin) throw new Fail("forbidden", 403);
  const ownCol = b.table === "profiles" ? "id" : "user_id";

  const where: string[] = [], args: unknown[] = [];
  for (const f of b.filters ?? []) {
    if (!ident.test(f.col)) throw new Fail("bad column");
    if (f.op === "in") {
      const v = Array.isArray(f.val) ? f.val : [];
      if (!v.length) { where.push("0"); continue; }
      where.push(`${f.col} in (${v.map(() => "?").join(",")})`); args.push(...v.map((x) => encode(t, f.col, x)));
    } else { where.push(`${f.col} ${f.op === "eq" ? "=" : "<>"} ?`); args.push(encode(t, f.col, f.val)); }
  }
  if (scoped || (b.op !== "select" && t.write?.own)) { where.push(`${ownCol} = ?`); args.push(uid); }
  const W = where.length ? ` where ${where.join(" and ")}` : "";

  if (b.op === "select") {
    const ord = (b.order ?? []).map((o) => { if (!ident.test(o.col)) throw new Fail("bad column"); return `${o.col} ${o.asc ? "asc" : "desc"}`; });
    const lim = Math.min(Math.max(Math.trunc(Number(b.limit)) || 1000, 1), 1000);
    return all(`select * from ${b.table}${W}${ord.length ? " order by " + ord.join(",") : ""} limit ${lim}`, ...args).map((r) => decode(t, r));
  }

  const w = t.write;
  if (!w || (w.admin && !isAdmin)) throw new Fail("forbidden", 403);
  const vals = (Array.isArray(b.values) ? b.values : b.values ? [b.values] : []) as Row[];

  if (b.op === "delete") {
    if (!w.delete) throw new Fail("forbidden", 403);
    if (!where.length) throw new Fail("filter required");
    const rows = all(`select * from ${b.table}${W}`, ...args);
    run(`delete from ${b.table}${W}`, ...args);
    return rows.map((r) => decode(t, r));
  }

  if (b.op === "update") {
    const allowed = w.update === true ? null : w.update;
    const sets: string[] = [], sa: unknown[] = [];
    for (const [c, v] of Object.entries(vals[0] ?? {})) {
      if (!ident.test(c) || c === ownCol || c === t.pk) throw new Fail("forbidden column", 403);
      if (allowed && !allowed.includes(c)) throw new Fail("forbidden column", 403);
      sets.push(`${c} = ?`); sa.push(encode(t, c, v));
    }
    if (!sets.length) return [];
    if (!where.length) throw new Fail("filter required");
    run(`update ${b.table} set ${sets.join(", ")}${W}`, ...sa, ...args);
    return all(`select * from ${b.table}${W}`, ...args).map((r) => decode(t, r));
  }

  // insert / upsert
  if (!(b.op === "upsert" ? w.upsert : w.insert)) throw new Fail("forbidden", 403);
  const out: Row[] = [];
  for (const v of vals) {
    const row: Row = { ...v };
    if (w.own) row.user_id = uid;
    if (b.table === "citations" || b.table === "projects") { row.id = randomUUID(); row.created_at = now(); if (b.table === "projects") row.updated_at = row.created_at; }
    if (b.table === "admin_kv") row.updated_at = row.updated_at ?? now();
    const cols = Object.keys(row);
    if (!cols.every((c) => ident.test(c))) throw new Fail("bad column");
    const sql = `insert into ${b.table}(${cols.join(",")}) values (${cols.map(() => "?").join(",")})` +
      (b.op === "upsert" ? ` on conflict(${t.pk}) do update set ${cols.filter((c) => c !== t.pk).map((c) => `${c} = excluded.${c}`).join(", ")}` : "");
    try { run(sql, ...cols.map((c) => encode(t, c, row[c]))); } catch (e) { throw new Fail(String((e as Error).message).slice(0, 200)); }
    out.push(decode(t, get(`select * from ${b.table} where ${t.pk} = ?`, row[t.pk])!));
  }
  return out;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type RpcFn = (a: any, uid: string) => unknown;
const ADMIN_RPC: Record<string, RpcFn> = {
  admin_list_users: (a) => q.adminListUsers(a), admin_stats: () => q.adminStats(), admin_timeseries: (a) => q.adminTimeseries(a),
  admin_top_users: (a) => q.adminTopUsers(a), admin_score_hist: (a) => q.adminScoreHist(a), admin_spend_since: (a) => q.adminSpendSince(a),
  admin_set_setting: (a) => (q.adminSetSetting(a), null), admin_grant_credits: (a, uid) => q.adminGrantCredits(uid, a),
  admin_set_user: (a, uid) => (q.adminSetUser(uid, a), null),
};

const isAdminUser = (id: string) => { const p = get("select role, status from profiles where id = ?", id); return p?.role === "admin" && p?.status === "active"; };

export const rest = Router();

rest.post("/rest", (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const user = userFromRequest(req);
  const u = user && user.verified ? user : null;
  try { res.json({ data: exec(req.body as Req, u, !!u && isAdminUser(u.id)) }); }
  catch (e) { res.status(e instanceof Fail ? e.status : 500).json({ error: { message: (e as Error).message } }); }
});

rest.post("/rpc/:fn", (req, res) => {
  res.set("Cache-Control", "no-store");
  const user = userFromRequest(req);
  if (!user || !user.verified) return void res.status(401).json({ error: { message: "unauthorized" } });
  try {
    if (req.params.fn === "my_quota") return void res.json({ data: q.quotaOf(user.id) });
    const fn = ADMIN_RPC[req.params.fn as string];
    if (!fn) return void res.status(404).json({ error: { message: "unknown function" } });
    if (!isAdminUser(user.id)) return void res.status(403).json({ error: { message: "forbidden" } });
    res.json({ data: fn(req.body ?? {}, user.id) ?? null });
  } catch (e) { res.status(e instanceof q.RpcError ? e.status : 500).json({ error: { message: (e as Error).message } }); }
});
