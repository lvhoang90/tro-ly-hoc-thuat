// Máy chủ Trợ lý học thuật: Express + SQLite, chạy trên hosting dùng chung (cPanel "Setup Node.js App") hoặc máy riêng.
// Phục vụ giao diện đã build (dist/), API đăng nhập, dữ liệu, phân tích, trích .doc và bộ đếm truy cập.
import express from "express";
import compression from "compression";
import path from "node:path";
import { randomUUID } from "node:crypto";
import WordExtractor from "word-extractor";
import { analyzeRoute } from "./analyze.ts";
import { auth, hashPassword, requireUser } from "./auth.ts";
import { addAdminEmail, createProfile, DATA_DIR, get, now, run } from "./db.ts";
import { mailEnabled } from "./mail.ts";
import { recordVisit, visitStats } from "./quota.ts";
import { rest } from "./rest.ts";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor|curl|wget|python-requests/i;
const DIST = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.resolve(import.meta.dirname, "../dist");

/** Tài khoản quản trị: ADMIN_EMAIL được nâng quyền khi đăng ký; có ADMIN_PASSWORD thì tạo sẵn (đã xác thực) nếu chưa có. */
async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim();
  if (!email) return;
  addAdminEmail(email);
  const pw = process.env.ADMIN_PASSWORD;
  if (pw && !get("select 1 from users where email = ?", email)) {
    const id = randomUUID(), t = now();
    run("insert into users(id, email, pw_hash, email_verified_at, full_name, created_at) values (?,?,?,?,?,?)", id, email, await hashPassword(pw), t, "Admin", t);
    createProfile(id, email, "Admin", t);
    console.log(`Đã tạo tài khoản quản trị ${email}.`);
  }
}
await bootstrapAdmin();

export const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(compression());
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  if (req.path.startsWith("/api/")) res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});

app.use("/api", express.json({ limit: "12mb" }));
app.use("/api/auth", auth);
app.use("/api", rest);
app.use("/api", analyzeRoute);

app.post("/api/extract-doc", requireUser, express.raw({ type: "application/octet-stream", limit: "16mb" }), async (req, res) => {
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (buf.length < 100) return void res.status(400).json({ error: "bad_request", message: "Tệp rỗng." });
  try { res.json({ text: (await new WordExtractor().extract(buf)).getBody() }); }
  catch { res.status(422).json({ error: "bad_request", message: "Không đọc được tệp .doc." }); }
});

// Thống kê lượt truy cập ẩn danh: không lưu IP, không cookie. Quốc gia lấy từ tiêu đề CDN nếu có (Cloudflare/Vercel).
app.all("/api/visit", (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    if (req.method === "POST" && !BOT.test(req.get("user-agent") ?? ""))
      recordVisit(String(req.get("cf-ipcountry") || req.get("x-vercel-ip-country") || "").toUpperCase());
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
    res.json({ enabled: true, ...visitStats(days) });
  } catch { res.json({ enabled: false }); }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, ai: !!process.env.ANTHROPIC_API_KEY, mail: mailEnabled }));
app.use("/api", (_req, res) => res.status(404).json({ error: "not_found" }));

app.use("/assets", express.static(path.join(DIST, "assets"), { maxAge: "365d", immutable: true }));
app.use(express.static(DIST, {
  extensions: ["html"], // cleanUrls: /quyen-rieng-tu → quyen-rieng-tu.html
  setHeaders: (res, file) => { if (/(sitemap\.xml|robots\.txt|llms\.txt)$/.test(file)) res.set("Cache-Control", "public, max-age=3600"); },
}));
app.use((_req, res) => res.status(404).sendFile(path.join(DIST, "index.html")));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

if (!process.env.NO_LISTEN) {
  const port = Number(process.env.PORT) || 3000;
  // Passenger truyền cổng/ổ cắm qua PORT; không đặt thời gian chờ ngắn cho yêu cầu phân tích.
  const srv = app.listen(port, () => console.log(`Ami đang chạy ở cổng ${port}; dữ liệu: ${DATA_DIR}; SMTP: ${mailEnabled ? "bật" : "chưa cấu hình (in liên kết ra nhật ký)"}`));
  srv.requestTimeout = 0; srv.headersTimeout = 65_000; srv.keepAliveTimeout = 65_000;
}
