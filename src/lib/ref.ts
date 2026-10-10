// Liên kết giới thiệu cá nhân: ?ref=<mã 7 ký tự>. Lưu ở máy cho tới khi đăng ký (không cookie, không gửi đi đâu trước khi người dùng đăng ký).
const KEY = "ami.ref";
const OK = /^[a-z0-9]{7}$/i;

export function captureRef(): void {
  try {
    const r = new URLSearchParams(location.search).get("ref") ?? "";
    if (OK.test(r)) localStorage.setItem(KEY, r.toLowerCase());
  } catch { /* bỏ qua */ }
}
export const getRef = (): string => { try { const r = localStorage.getItem(KEY) ?? ""; return OK.test(r) ? r : ""; } catch { return ""; } };
export const clearRef = (): void => { try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ } };
export const inviteUrl = (siteUrl: string, code: string) => `${siteUrl.replace(/\/$/, "")}/?ref=${encodeURIComponent(code)}&utm_source=invite&utm_medium=referral&utm_campaign=ami`;
