// Nhận tạp chí chuyển từ EduFind (liên kết có ?journal=<tên>&utm_source=edufind). Lưu trong phiên để còn nguyên sau khi đăng nhập.
const KEY = "ami.handoff";

/** Đọc tham số từ địa chỉ (chỉ khi đến từ EduFind), lưu vào phiên rồi dọn khỏi thanh địa chỉ. */
export function captureHandoff(): void {
  try {
    const p = new URLSearchParams(location.search);
    const journal = (p.get("journal") ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
    if (journal && p.get("utm_source") === "edufind") sessionStorage.setItem(KEY, journal);
  } catch { /* bỏ qua */ }
}
export const getHandoff = (): string => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } };
export const clearHandoff = (): void => { try { sessionStorage.removeItem(KEY); } catch { /* bỏ qua */ } };
