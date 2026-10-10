// ISA Connect (chuẩn dùng chung với Mây, EduFind và ProFind): ký mã chuyển người dùng đã xác thực email sang ProFind
// để không phải nhập mã OTP lần nữa. Đặc tả: ProFind docs/ISA-CONNECT.md. Khoá ISA_CONNECT_SECRET dùng chung cả hệ sinh thái (≥ 16 ký tự).
import { createHmac, randomBytes } from "node:crypto";

export const PROFIND_ORIGIN = "https://profind.isavn.edu.vn";
export const PHONE_RE = /^(0|84)(3|5|7|8|9)\d{8}$/; // di động Việt Nam, giống ProFind
export const normPhone = (p: unknown) => String(p ?? "").replace(/[\s.()-]/g, "").replace(/^\+/, "");
export const tidy = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

const hex = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");
export const secretOk = (s: string | undefined): s is string => !!s && s.length >= 16;

export interface ConnectInput { email: string; name: string; phone?: string; lang: "vi" | "en"; authorId?: string; org?: string; job?: string }

/** Mã `v1.<payload base64url>.<HMAC-SHA256 hex>`: hạn 10 phút, dùng một lần (`jti`), `cs` là sự đồng ý của người dùng khi bấm nút. */
export function signConnect(secret: string, i: ConnectInput, now = Date.now()): string {
  const payload = {
    e: i.email.trim().toLowerCase(), n: tidy(i.name, 80), ph: i.phone ? normPhone(i.phone) : undefined, cs: true, lg: i.lang,
    a: /^A\d{5,12}$/.test(i.authorId ?? "") ? i.authorId : undefined, o: tidy(i.org, 120), j: tidy(i.job, 80),
    src: "ami", exp: now + 10 * 60e3, jti: randomBytes(16).toString("hex"),
  };
  const pl = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `v1.${pl}.${hex(secret, `v1.${pl}`)}`;
}

export const connectUrl = (token: string) => `${PROFIND_ORIGIN}/#/ket-noi?t=${token}&from=ami`;
/** Nơi mở ProFind khi chưa bật liên kết ISA: người dùng tự đăng nhập ở đó. */
export const plainProfindUrl = (authorId?: string) =>
  `${PROFIND_ORIGIN}/?utm_source=ami&utm_medium=ecosystem&utm_campaign=connect${authorId && /^A\d{5,12}$/.test(authorId) ? `#/tac-gia/${authorId}` : ""}`;

export interface LinkStatus { registered: boolean; verified?: boolean; authorId?: string; pending?: boolean }
/** Hỏi ProFind (máy chủ tới máy chủ) người dùng đã có tài khoản, hồ sơ xác thực hoặc đang chờ duyệt chưa. Lỗi mạng: trả null. */
export async function linkStatus(secret: string, email: string, f: typeof fetch = fetch, now = Date.now()): Promise<LinkStatus | null> {
  const e = email.trim().toLowerCase();
  const u = new URL(`${PROFIND_ORIGIN}/api/account`);
  u.searchParams.set("op", "link-status"); u.searchParams.set("e", e); u.searchParams.set("ts", String(now)); u.searchParams.set("sig", hex(secret, `ls:${e}:${now}`));
  try {
    const r = await f(u, { signal: AbortSignal.timeout(5000) });
    return r.ok ? ((await r.json()) as LinkStatus) : null;
  } catch { return null; }
}
