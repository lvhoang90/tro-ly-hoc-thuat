# Giáo sư phản biện (Ami 1.4.0)

Tích hợp từ ứng dụng "Trợ lý phản biện học thuật" (`lvhoang90/cham-diem-luan-van`) vào Ami: trang `#/review`, tính năng cao cấp: chỉ dành cho tài khoản đã xác thực **và được quản trị viên phê duyệt** (quản trị viên dùng không giới hạn).

## Luồng
1. **Trình duyệt** đọc công trình (.docx qua mammoth, PDF có chữ qua pdf.js + dựng lại đoạn văn) thành các khối đánh số `[¶n]`, có số trang (`src/lib/review-read.ts`, `shared/review/layout.ts`). Tệp không rời máy.
2. `POST /api/review` với `op`:
   - `template`: tách khung mẫu của trường/viện (miễn phí, chỉ người đã xác thực).
   - `start`: ghi nhận một lượt (`consume_review`) và cấp mã HMAC (45 phút; khóa suy ra từ `SUPABASE_SERVICE_ROLE_KEY`).
   - `part` (`kind: sections | overall`): một lần gọi Claude. Mỗi lô tối đa 4 mục; phần tổng hợp (điểm theo thang, khuyết điểm, liêm chính, câu hỏi, kết luận) chạy sau cùng. Văn bản đứng đầu lời nhắc kèm `cache_control` để các lần gọi sau dùng bộ nhớ đệm. Chi phí cộng dồn vào `usage_log` (`add_usage`).
   - `finish`: ghi điểm, trả thưởng giới thiệu. `fail`: hoàn lượt nếu chưa có phần nào xong (`refund_review`).
3. Trình duyệt điều phối các bước tuần tự (`src/lib/review.ts`), thử lại khi lỗi tạm thời, tự chia đôi lô nếu phản hồi bị cắt, rồi **ghép kết quả** (`shared/review/assemble.ts`): đối chiếu từng trích dẫn với bản gốc, tính điểm và khuyến nghị bằng mã, nêu mục thiếu.
4. Kết quả lưu ở `localStorage` (tối đa 5 bản); xuất Word bằng `docx` (tải theo yêu cầu).

Mỗi bước ngắn nên không vướng giới hạn thời gian hàm (`api/review.ts`: `maxDuration` 300 giây trong `vercel.json`).

## Phê duyệt, hạn mức và chi phí
- Mặc định **0**: không ai dùng được cho đến khi được duyệt. Người dùng đã xác thực vào trang, gửi đề nghị (lý do ≥ 40 ký tự, minh chứng khoa học ≥ 20 ký tự; mỗi người một đề nghị chờ duyệt). Quản trị viên xét ở Quản trị → tab Giáo sư phản biện: phê duyệt kèm số lượt mỗi tuần (lưu ở `profiles.review_limit`), từ chối kèm ghi chú, hoặc thu hồi sau này. Người bị từ chối có thể bổ sung minh chứng và gửi lại.
- `review_weekly_limit` (Cài đặt) là mức mặc định cho người chưa được duyệt riêng, thường để 0.
- Hạn mức riêng, tách khỏi lượt phân tích; tính theo tuần giờ Việt Nam.
- Ước tính khoảng 1–2 USD API mỗi lượt (văn bản dài; xem `usage_log.cost_usd`). Theo dõi ở tab Ngân sách.
- Giới hạn văn bản: 900.000 ký tự (`shared/review/limits.ts`); dài hơn thì tách theo chương. Chế độ "đọc từng phần" của bản gốc không được đưa vào.

## Triển khai
1. Supabase → SQL Editor: chạy `supabase/migrations/20261011_review.sql` (chạy lại an toàn).
2. Biến môi trường tùy chọn: `REVIEW_MODEL` (mặc định `ANTHROPIC_MODEL` hoặc `claude-opus-5-5`), `REVIEW_EFFORT` (mặc định `high`).

## Giới hạn đã biết
- Chưa kiểm tra trùng lặp (đạo văn) và không xác minh tài liệu tham khảo có thật; giao diện và bản Word đều nói rõ.
- PDF ảnh quét chưa hỗ trợ (chưa OCR); `.doc` cần lưu lại thành `.docx`.
- Chưa thử với mô hình thật trong phiên phát triển: kiểm thử dùng máy chủ AI giả (`tests/review-api.test.ts`). Bộ nhớ đệm lời nhắc có thể không phát huy khi dùng đầu ra có lược đồ; chi phí thực tế đọc ở nhật ký sau những lượt đầu.
