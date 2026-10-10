/** Số ký tự văn bản công trình tối đa gửi AI trong một lượt phản biện (công trình dài hơn: tách theo phần). */
export const MAX_REVIEW_CHARS = 900_000;
export const MAX_TEMPLATE_CHARS = 60_000;
/** Số lần gọi AI tối đa của một lượt phản biện (chặn lạm dụng mã thông báo). */
export const MAX_REVIEW_PARTS = 24;
/** Trần chi phí API của một lượt phản biện (USD): vượt thì từ chối các bước tiếp theo. Dự kiến khoảng 1–2 USD/lượt. */
export const MAX_REVIEW_COST_USD = 6;
/** Số lần gọi AI thất bại tối đa của một lượt. */
export const MAX_REVIEW_FAILS = 8;
/** Số lần tách mẫu tối đa mỗi giờ cho mỗi người (khớp log_template trong SQL). */
export const TEMPLATES_PER_HOUR = 10;
/** Số mục xử lý trong một lần gọi AI. */
export const SECTIONS_PER_CALL = 4;
/** Số công trình tối đa trong một lô (mỗi tệp là một công trình của một người, dùng 1 lượt). */
export const MAX_BATCH_WORKS = 30;
/** Số bản nhận xét lưu cục bộ trên trình duyệt. */
export const MAX_SAVED_REVIEWS = 30;
