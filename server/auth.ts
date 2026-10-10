// Đăng nhập bằng email + mật khẩu, phiên lưu trong cookie HttpOnly. Thay thế Supabase Auth.
// Băm mật khẩu: scrypt (người dùng mới). Mật khẩu nhập từ Supabase (bcrypt) vẫn xác thực được và tự đổi sang scrypt khi đăng nhập.
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";
import { Router, type Request, type Response, type NextFunction } from "express";
import { createProfile, get, now, run, tx } from "./db.ts";
import { sendMail } from "./mail.ts";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, o: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const COOKIE = "ami_session";
const SESSION_DAYS = 30;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scryptAsync(pw, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;
}

/** `ok` đúng mật khẩu; `rehash` có giá trị khi cần lưu lại bằng scrypt. */
export async function checkPassword(pw: string, stored: string): Promise<{ ok: boolean; rehash?: string }> {
  if (stored.startsWith("scrypt$")) {
    const [, s, h] = stored.split("$");
    const calc = await scryptAsync(pw, Buffer.from(s, "base64"), 32, SCRYPT);
    const want = Buffer.from(h, "base64");
    return { ok: want.length === calc.length && timingSafeEqual(want, calc) };
  }
  if (/^\$2[aby]\$/.test(stored)) {
    const ok = await bcrypt.compare(pw, stored).catch(() => false);
    return ok ? { ok, rehash: await hashPassword(pw) } : { ok: false };
  }
  return { ok: false };
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const DUMMY = bcrypt.hashSync("dummy-password", 8);

// ---------- Phiên ----------
function readCookie(req: Request, name: string): string {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}
const secure = (req: Request) => req.secure || req.headers["x-forwarded-proto"] === "https";

function startSession(req: Request, res: Response, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const exp = new Date(Date.now() + SESSION_DAYS * 86400e3);
  run("insert into sessions(token_hash, user_id, created_at, expires_at) values (?,?,?,?)", sha(token), userId, now(), exp.toISOString());
  res.append("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure(req) ? "; Secure" : ""}`);
}

export interface AuthUser { id: string; email: string; verified: boolean; created_at: string }

export function userFromRequest(req: Request): AuthUser | null {
  const t = readCookie(req, COOKIE);
  if (!t) return null;
  const r = get(`select u.id, u.email, u.email_verified_at v, u.created_at from sessions s join users u on u.id = s.user_id
    where s.token_hash = ? and s.expires_at > ?`, sha(t), now());
  return r ? { id: r.id as string, email: r.email as string, verified: !!r.v, created_at: r.created_at as string } : null;
}

declare module "express-serve-static-core" { interface Request { user?: AuthUser } }

/** Bắt buộc đã đăng nhập (và đã xác thực email). */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const u = userFromRequest(req);
  if (!u) return void res.status(401).json({ error: "unauthorized" });
  if (!u.verified) return void res.status(403).json({ error: "email_unverified" });
  req.user = u;
  next();
}

// ---------- Giới hạn tần suất (trong bộ nhớ) ----------
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number): boolean {
  const t = Date.now(), arr = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  arr.push(t); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
  return arr.length > max;
}

// ---------- Thư xác nhận / đặt lại ----------
const baseUrl = (req: Request) => (process.env.SITE_URL || `${req.headers["x-forwarded-proto"] ?? req.protocol}://${req.get("host")}`).replace(/\/$/, "");
/** Chỉ cho chuyển hướng về chính trang web (tránh chuyển hướng mở). */
function safeRedirect(req: Request, to: unknown): string {
  const base = baseUrl(req);
  try { const u = new URL(String(to || "/"), base); if (u.origin === new URL(base).origin) return u.toString(); } catch { /* bỏ qua */ }
  return base + "/";
}

async function mailLink(req: Request, userId: string, email: string, kind: "verify" | "reset", redirect: unknown) {
  const token = randomBytes(32).toString("base64url");
  const ttl = kind === "verify" ? 3 * 86400e3 : 3600e3;
  run("delete from email_tokens where user_id = ? and kind = ?", userId, kind);
  run("insert into email_tokens(token_hash, user_id, kind, expires_at) values (?,?,?,?)", sha(token), userId, kind, new Date(Date.now() + ttl).toISOString());
  const link = `${baseUrl(req)}/api/auth/confirm?token=${token}&redirect=${encodeURIComponent(safeRedirect(req, redirect))}`;
  if (kind === "verify")
    await sendMail(email, "Xác nhận email | Confirm your email — Trợ lý học thuật",
      `Chào bạn,\n\nBấm vào liên kết để xác nhận email và bắt đầu dùng Trợ lý học thuật:\n${link}\n\nHello,\n\nOpen this link to confirm your email and start using the AI Academic Agent:\n${link}\n\nLiên kết có hiệu lực 3 ngày. / The link is valid for 3 days.`);
  else
    await sendMail(email, "Đặt lại mật khẩu | Reset your password — Trợ lý học thuật",
      `Bấm vào liên kết để đăng nhập và đặt lại mật khẩu:\n${link}\n\nOpen this link to sign in and reset your password:\n${link}\n\nLiên kết có hiệu lực 1 giờ. / The link is valid for 1 hour. Nếu không phải bạn yêu cầu, hãy bỏ qua thư này. / If you did not request this, ignore this email.`);
}

const emailOk = (e: unknown): e is string => typeof e === "string" && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const sessionBody = (u: AuthUser) => ({ user: { id: u.id, email: u.email, email_confirmed_at: u.verified ? u.created_at : null, identities: [{}] } });

export const auth = Router();

auth.get("/session", (req, res) => {
  res.set("Cache-Control", "no-store");
  const u = userFromRequest(req);
  res.json(u && u.verified ? sessionBody(u) : { user: null });
});

auth.post("/signup", async (req, res) => {
  const { email, password, full_name, redirect } = req.body ?? {};
  if (limited(`su:${req.ip}`, 10, 3600e3)) return void res.status(429).json({ message: "Too many requests, rate limit. Try again in seconds." });
  if (!emailOk(email)) return void res.status(400).json({ message: "Invalid email" });
  if (typeof password !== "string" || password.length < 6 || password.length > 200) return void res.status(400).json({ message: "Password should be at least 6 characters." });
  if (get("select 1 from users where email = ?", email.trim())) return void res.json({ user: { identities: [] }, session: null });
  const id = randomUUID(), pw = await hashPassword(password), t = now();
  const name = typeof full_name === "string" ? full_name.trim().slice(0, 200) : "";
  tx(() => {
    run("insert into users(id, email, pw_hash, full_name, created_at) values (?,?,?,?,?)", id, email.trim(), pw, name, t);
    createProfile(id, email.trim(), name, t);
  });
  await mailLink(req, id, email.trim(), "verify", redirect).catch((e) => console.error("mail", e));
  res.json({ user: { id, email: email.trim(), identities: [{}] }, session: null });
});

auth.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (limited(`li:${req.ip}`, 30, 600e3)) return void res.status(429).json({ message: "Too many requests, rate limit. Try again in seconds." });
  const u = emailOk(email) && typeof password === "string" ? get("select * from users where email = ?", email.trim()) : undefined;
  const chk = await checkPassword(typeof password === "string" ? password : "", (u?.pw_hash as string) || DUMMY);
  if (!u || !u.pw_hash || !chk.ok) return void res.status(400).json({ message: "Invalid login credentials" });
  if (!u.email_verified_at) return void res.status(400).json({ message: "Email not confirmed" });
  if (chk.rehash) run("update users set pw_hash = ? where id = ?", chk.rehash, u.id);
  startSession(req, res, u.id as string);
  res.json(sessionBody({ id: u.id as string, email: u.email as string, verified: true, created_at: u.created_at as string }));
});

auth.post("/logout", (req, res) => {
  const t = readCookie(req, COOKIE);
  if (t) run("delete from sessions where token_hash = ?", sha(t));
  res.append("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

auth.post("/resend", async (req, res) => {
  const { email, redirect } = req.body ?? {};
  if (limited(`rs:${req.ip}`, 10, 3600e3)) return void res.status(429).json({ message: "Too many requests, rate limit." });
  const u = emailOk(email) ? get("select id, email, email_verified_at v from users where email = ?", email.trim()) : undefined;
  if (u && !u.v) await mailLink(req, u.id as string, u.email as string, "verify", redirect).catch((e) => console.error("mail", e));
  res.json({ ok: true }); // luôn trả như nhau để không lộ email nào đã đăng ký
});

auth.post("/reset", async (req, res) => {
  const { email, redirect } = req.body ?? {};
  if (limited(`rp:${req.ip}`, 10, 3600e3)) return void res.status(429).json({ message: "Too many requests, rate limit." });
  const u = emailOk(email) ? get("select id, email from users where email = ?", email.trim()) : undefined;
  if (u) await mailLink(req, u.id as string, u.email as string, "reset", redirect).catch((e) => console.error("mail", e));
  res.json({ ok: true });
});

/** Liên kết trong thư: xác nhận email (và/hoặc đặt lại) rồi đăng nhập luôn, như Supabase. */
auth.get("/confirm", (req, res) => {
  const t = typeof req.query.token === "string" ? req.query.token : "";
  const to = safeRedirect(req, req.query.redirect);
  const r = t ? get("select user_id, kind from email_tokens where token_hash = ? and expires_at > ?", sha(t), now()) : undefined;
  if (!r) return void res.redirect(302, to + (to.includes("?") ? "&" : "?") + "auth_error=expired");
  run("delete from email_tokens where token_hash = ?", sha(t));
  run("update users set email_verified_at = coalesce(email_verified_at, ?) where id = ?", now(), r.user_id);
  startSession(req, res, r.user_id as string);
  res.redirect(302, to);
});

auth.post("/update-password", requireUser, async (req, res) => {
  const { password } = req.body ?? {};
  if (typeof password !== "string" || password.length < 6 || password.length > 200) return void res.status(400).json({ message: "Password should be at least 6 characters." });
  run("update users set pw_hash = ? where id = ?", await hashPassword(password), req.user!.id);
  res.json({ ok: true });
});
