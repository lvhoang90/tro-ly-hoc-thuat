/** Mã lỗi mà thử lại là vô ích (và tốn tiền): bị cắt giữa chừng thì phải chia nhỏ, AI từ chối, chạm trần, văn bản hay quyền không hợp lệ. */
export const NO_RETRY = new Set(["truncated", "ai_refused", "review_limit", "review_token", "review_locked", "not_verified", "bad_request", "no_text", "too_long"]);

/** Có nên thử lại một lần gọi bước phản biện không: chỉ với lỗi tạm thời của AI hoặc máy chủ; lỗi mạng (không có mã) cũng thử lại. */
export function shouldRetry(code: string | null, status: number): boolean {
  if (code === null) return true;
  if (NO_RETRY.has(code)) return false;
  return code === "ai_failed" || code === "server_error" || status >= 500 || status === 429;
}
