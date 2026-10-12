// Nhận tạp chí chuyển từ EduFind hoặc ProFind (liên kết có ?journal=<tên>&utm_source=edufind|profind). Lưu trong phiên để còn nguyên sau khi đăng nhập.
const KEY = "ami.handoff";
const SRC_KEY = "ami.handoff.src";

export type HandoffSource = "edufind" | "profind";
const SOURCES: readonly string[] = ["edufind", "profind"];

/** Đọc tên tạp chí và nguồn từ chuỗi truy vấn; chỉ nhận khi đến từ EduFind hoặc ProFind. Làm sạch ký tự điều khiển, cắt 140 ký tự. */
export function parseHandoff(search: string): { journal: string; source: HandoffSource } | null {
  const p = new URLSearchParams(search);
  const journal = (p.get("journal") ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
  const source = p.get("utm_source") ?? "";
  return journal && SOURCES.includes(source) ? { journal, source: source as HandoffSource } : null;
}

/** Đọc tham số từ địa chỉ (chỉ khi đến từ EduFind hoặc ProFind) và lưu vào phiên. */
export function captureHandoff(): void {
  try {
    const h = parseHandoff(location.search);
    if (!h) return;
    sessionStorage.setItem(KEY, h.journal);
    sessionStorage.setItem(SRC_KEY, h.source);
    const u = new URL(location.href); u.searchParams.delete("journal");
    history.replaceState(history.state, "", u.pathname + u.search + u.hash); // dọn tên tạp chí khỏi thanh địa chỉ
  } catch { /* bỏ qua */ }
}
export const getHandoff = (): string => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } };
export const getHandoffSource = (): HandoffSource => { try { return sessionStorage.getItem(SRC_KEY) === "profind" ? "profind" : "edufind"; } catch { return "edufind"; } };
export const clearHandoff = (): void => { try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(SRC_KEY); } catch { /* bỏ qua */ } };
