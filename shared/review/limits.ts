/** Số ký tự văn bản công trình tối đa gửi AI trong một lượt phản biện (công trình dài hơn: tách theo phần). */
export const MAX_REVIEW_CHARS = 900_000;
export const MAX_TEMPLATE_CHARS = 60_000;
/** Số lần gọi AI tối đa của một lượt phản biện (chặn lạm dụng mã thông báo). */
export const MAX_REVIEW_PARTS = 24;
/** Số mục xử lý trong một lần gọi AI. */
export const SECTIONS_PER_CALL = 4;
