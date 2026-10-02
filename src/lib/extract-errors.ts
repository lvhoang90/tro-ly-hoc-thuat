// Phân loại lỗi khi đọc tệp để báo đúng nguyên nhân thay vì luôn nói "hỏng hoặc có mật khẩu".
export type ReadErrorCode = "password" | "corrupt" | "read" | "engine";

const text = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/** Tên/thông điệp lỗi rút gọn, hiển thị nhỏ dưới thông báo để người dùng gửi lại khi cần hỗ trợ. */
export function errorDetail(e: unknown): string {
  return text(e).replace(/\s+/g, " ").slice(0, 140);
}

export function classifyReadError(e: unknown): ReadErrorCode {
  const name = e instanceof Error ? e.name : "";
  const s = text(e);
  if (name === "PasswordException" || /password/i.test(s)) return "password";
  if (name === "InvalidPDFException" || name === "MissingPDFException" || name === "FormatError" || /invalid pdf|bad xref|unexpected end|end of data|not a zip|corrupted zip|can't find end of central directory/i.test(s)) return "corrupt";
  // Không đọc được byte của tệp từ thiết bị (iCloud/Drive chưa tải về, quyền truy cập, tệp bị đổi).
  if (["NotReadableError", "NotFoundError", "SecurityError", "AbortError"].includes(name) || /could not be read|permission|not readable|the object can not be found/i.test(s)) return "read";
  // Bộ đọc PDF (worker/mô-đun) không khởi động được trên trình duyệt này.
  if (/worker|dynamically imported module|import|Failed to fetch|Load failed|is not a function|undefined|ReadableStream|SyntaxError|ReferenceError|TypeError|RangeError|out of memory/i.test(s) || ["TypeError", "SyntaxError", "ReferenceError", "RangeError"].includes(name)) return "engine";
  return "corrupt";
}
