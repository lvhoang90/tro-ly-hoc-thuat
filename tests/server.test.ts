// Kiểm thử máy chủ Node + SQLite: đăng ký/xác nhận/đăng nhập, hạn mức, phân quyền dữ liệu, quản trị, mật khẩu nhập từ Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";

process.env.DB_FILE = ":memory:";
process.env.DATA_DIR = "/tmp/ami-test-data";
process.env.NO_LISTEN = "1";
process.env.SITE_URL = "http://site.test";
process.env.ADMIN_EMAIL = "boss@example.com";
process.env.ADMIN_PASSWORD = "boss-password";

const mails: string[] = [];
const origLog = console.log;
console.log = (...a: unknown[]) => { const s = a.join(" "); if (s.startsWith("[mail:console]")) mails.push(s); else origLog(...a); };

const { app } = await import("../server/index.ts");
const dbm = await import("../server/db.ts");
const quota = await import("../server/quota.ts");
const srv = app.listen(0);
const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
test.after(() => srv.close());

class Client {
  cookie = "";
  async req(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
    const r = await fetch(base + path, { method, redirect: "manual", headers: { "content-type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    return { status: r.status, headers: r.headers, json: (await r.json().catch(() => ({}))) as Record<string, any> };
  }
  rest(body: unknown) { return this.req("/api/rest", body); }
  rpc(fn: string, args: unknown = {}) { return this.req(`/api/rpc/${fn}`, args); }
}

async function register(email: string, password = "secret12", name = "Test") {
  const c = new Client();
  const r = await c.req("/api/auth/signup", { email, password, full_name: name, redirect: "http://site.test/" });
  assert.equal(r.status, 200);
  const link = /http:\/\/site\.test\/api\/auth\/confirm\?[^\s]+/.exec(mails.at(-1)!)![0];
  const ok = await c.req(link.replace("http://site.test", ""));
  assert.equal(ok.status, 302);
  return { c, id: (await c.req("/api/auth/session")).json.user.id as string };
}

test("đăng ký → chưa xác nhận không đăng nhập được → xác nhận qua liên kết thì vào luôn", async () => {
  const c = new Client();
  await c.req("/api/auth/signup", { email: "a@x.com", password: "secret12", full_name: "A" });
  assert.equal((await c.req("/api/auth/login", { email: "a@x.com", password: "secret12" })).json.message, "Email not confirmed");
  assert.equal((await c.req("/api/auth/login", { email: "a@x.com", password: "wrong" })).json.message, "Invalid login credentials");
  assert.equal((await c.req("/api/auth/session")).json.user, null);
  const link = /\/api\/auth\/confirm\?[^\s]+/.exec(mails.at(-1)!)![0];
  const r = await c.req(link);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "http://site.test/");
  assert.equal((await c.req("/api/auth/session")).json.user.email, "a@x.com");
  assert.equal((await c.req(link)).headers.get("location")?.includes("auth_error=expired"), true, "liên kết chỉ dùng một lần");
  assert.equal((await c.req("/api/auth/signup", { email: "A@x.com", password: "secret12" })).json.user.identities.length, 0, "email trùng (không phân biệt hoa thường)");
  await c.req("/api/auth/logout", {});
  assert.equal((await c.req("/api/auth/session")).json.user, null);
  assert.equal((await c.req("/api/auth/login", { email: "a@x.com", password: "secret12" })).status, 200);
});

test("chuyển hướng chỉ về chính trang web", async () => {
  const c = new Client();
  await c.req("/api/auth/signup", { email: "r@x.com", password: "secret12", redirect: "https://evil.example/x" });
  assert.match(decodeURIComponent(mails.at(-1)!), /redirect=http:\/\/site\.test\//);
});

test("hạn mức: miễn phí rồi thưởng, hoàn lượt, quản trị không giới hạn", async () => {
  const { id } = await register("q@x.com");
  const my = (await (async () => { const c = new Client(); await c.req("/api/auth/login", { email: "q@x.com", password: "secret12" }); return c.rpc("my_quota"); })()).json.data;
  assert.equal(my.free_left, 1); assert.equal(my.max_file_mb, 2); assert.equal(my.approved, false);
  const a = quota.consumeCredit(id);
  assert.deepEqual([a.ok, (a as any).source, (a as any).free_left], [true, "free", 0]);
  assert.equal((quota.consumeCredit(id) as any).reason, "quota_exhausted");
  quota.refundCredit(id, "free");
  assert.equal(quota.quotaOf(id)!.free_left, 1);
  assert.equal(quota.quotaOf(id)!.lifetime_used, 0);
  dbm.run("update profiles set bonus_credits = 2 where id = ?", id);
  quota.consumeCredit(id);
  const b = quota.consumeCredit(id) as any;
  assert.deepEqual([b.source, b.bonus], ["bonus", 1]);
  quota.recordUsage(b.log_id, "m", 100, 50, 0.01, 77);
  quota.refundCredit(id, "bonus");
  assert.equal(quota.quotaOf(id)!.bonus, 2);
  dbm.run("update profiles set status = 'suspended' where id = ?", id);
  assert.equal((quota.consumeCredit(id) as any).reason, "suspended");
});

test("phân quyền dữ liệu: chỉ thấy của mình, không tự nâng quyền", async () => {
  const u1 = await register("u1@x.com"), u2 = await register("u2@x.com");
  const ins = await u1.c.rest({ table: "citations", op: "insert", values: { user_id: u2.id, style: "apa7", reference: "R", source: { t: 1 } } });
  assert.equal(ins.status, 200);
  assert.equal(ins.json.data[0].user_id, u1.id, "user_id luôn là người đang đăng nhập");
  assert.deepEqual(ins.json.data[0].source, { t: 1 });
  assert.equal((await u2.c.rest({ table: "citations", op: "select" })).json.data.length, 0);
  assert.equal((await u2.c.rest({ table: "citations", op: "delete", filters: [{ col: "id", op: "in", val: [ins.json.data[0].id] }] })).json.data.length, 0);
  assert.equal((await u1.c.rest({ table: "profiles", op: "update", values: { role: "admin" }, filters: [{ col: "id", op: "eq", val: u1.id }] })).status, 403);
  assert.equal((await u1.c.rest({ table: "profiles", op: "update", values: { full_name: "Mới", keywords: ["a"] }, filters: [{ col: "id", op: "eq", val: u2.id }] })).json.data.length, 0, "không sửa được hồ sơ người khác");
  const own = await u1.c.rest({ table: "profiles", op: "update", values: { full_name: "Mới", keywords: ["a"] }, filters: [{ col: "id", op: "eq", val: u1.id }] });
  assert.deepEqual([own.json.data[0].full_name, own.json.data[0].keywords], ["Mới", ["a"]]);
  assert.equal((await u1.c.rest({ table: "profiles", op: "select" })).json.data.length, 1);
  assert.equal((await u1.c.rest({ table: "admin_kv", op: "select" })).status, 403);
  assert.equal((await u1.c.rpc("admin_stats")).status, 403);
  assert.equal((await new Client().rest({ table: "profiles", op: "select" })).status, 401);
  const settings = await new Client().rest({ table: "app_settings", op: "select", filters: [{ col: "key", op: "eq", val: "contact" }], single: "maybe" });
  assert.equal(settings.status, 200, "cài đặt liên hệ công khai");
});

test("quản trị: đăng nhập từ ADMIN_PASSWORD, thống kê, cấp lượt, khoá, ngân sách", async () => {
  const adm = new Client();
  assert.equal((await adm.req("/api/auth/login", { email: "boss@example.com", password: "boss-password" })).status, 200);
  const { id } = await register("m@x.com");
  const list = (await adm.rpc("admin_list_users", { p_search: "m@x", p_limit: 10, p_offset: 0, p_pending: true })).json.data;
  assert.equal(list.length, 1); assert.equal(list[0].total_count, 1); assert.equal(list[0].approved, false);
  assert.equal((await adm.rpc("admin_grant_credits", { p_user: id, p_amount: 5, p_note: "" })).json.data, 5);
  await adm.rpc("admin_set_user", { p_user: id, p_approved: true });
  assert.equal(quota.quotaOf(id)!.approved, true);
  const me = (await adm.rest({ table: "profiles", op: "select", filters: [{ col: "email", op: "eq", val: "boss@example.com" }], single: "single" })).json.data[0].id;
  assert.equal((await adm.rpc("admin_set_user", { p_user: me, p_role: "user" })).status, 400, "không tự hạ quyền");
  const st = (await adm.rpc("admin_stats")).json.data;
  assert.ok(st.users >= 2 && typeof st.cost_total === "number");
  const ts = (await adm.rpc("admin_timeseries", { p_days: 14 })).json.data;
  assert.equal(ts.length, 14); assert.equal(ts.at(-1).day, dbm.vnDay());
  assert.equal((await adm.rpc("admin_score_hist", { p_days: 30 })).json.data.length, 10);
  assert.equal((await adm.rpc("admin_set_setting", { p_key: "nope", p_value: 1 })).status, 400);
  assert.equal((await adm.rpc("admin_set_setting", { p_key: "free_daily_limit", p_value: 3 })).status, 200);
  assert.equal(quota.quotaOf(id)!.free_limit, 3);
  const kv = await adm.rest({ table: "admin_kv", op: "upsert", values: { key: "api_budget", value: { a: 1 } } });
  assert.deepEqual(kv.json.data[0].value, { a: 1 });
  assert.equal((await adm.rpc("admin_spend_since", { p_since: "2020-01-01T00:00:00Z" })).json.data.length, 1);
  assert.equal((await adm.rest({ table: "admin_kv", op: "delete", filters: [{ col: "key", op: "eq", val: "api_budget" }] })).status, 200);
});

test("mật khẩu bcrypt nhập từ Supabase đăng nhập được và tự đổi sang scrypt", async () => {
  dbm.run("insert into users(id, email, pw_hash, email_verified_at, created_at) values ('imp-1','old@x.com',?,?,?)", bcrypt.hashSync("cu-mat-khau", 10), dbm.now(), dbm.now());
  dbm.createProfile("imp-1", "old@x.com", "Cũ");
  const c = new Client();
  assert.equal((await c.req("/api/auth/login", { email: "old@x.com", password: "sai" })).status, 400);
  assert.equal((await c.req("/api/auth/login", { email: "old@x.com", password: "cu-mat-khau" })).status, 200);
  assert.match(dbm.get("select pw_hash from users where id = 'imp-1'")!.pw_hash as string, /^scrypt\$/);
  assert.equal((await new Client().req("/api/auth/login", { email: "old@x.com", password: "cu-mat-khau" })).status, 200);
});

test("bộ đếm truy cập và tiêu đề bảo mật", async () => {
  const c = new Client();
  await fetch(base + "/api/visit", { method: "POST", headers: { "user-agent": "Mozilla/5.0", "cf-ipcountry": "vn" } });
  await fetch(base + "/api/visit", { method: "POST", headers: { "user-agent": "Googlebot" } });
  const v = (await c.req("/api/visit?days=7")).json;
  assert.equal(v.total, 1); assert.equal(v.today, 1); assert.equal(v.days.length, 7); assert.deepEqual(v.countries, [{ c: "VN", n: 1 }]);
  const r = await fetch(base + "/api/health");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal((await c.req("/api/analyze", { abstract: "x" })).status, 401);
});
