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

## Chống lạm dụng chi phí
- **Trần mỗi lượt**: một lượt dừng khi chi phí API đạt `MAX_REVIEW_COST_USD` (6 USD), số lần gọi lỗi đạt `MAX_REVIEW_FAILS` (8) hoặc số phần thành công đạt `MAX_REVIEW_PARTS` (24); trả mã `review_limit` (429). Trình duyệt dừng thử và vẫn ghép phần đã có thành bản nhận xét dở dang.
- **Một văn bản cho cả lượt**: bước đầu ghi mã băm SHA-256 của văn bản (`bind_review`), các bước sau phải khớp (409 nếu khác).
- **Bước tách mẫu** ghi một dòng `usage_log` riêng (`kind = 'review_template'`) kèm chi phí và giới hạn 10 lần mỗi giờ cho mỗi người (`log_template`); quản trị viên không giới hạn.
- **Thưởng giới thiệu** chỉ trả khi lượt đã có ít nhất một phần AI xử lý xong (`finish_review`).
- **Thử lại**: chỉ với lỗi tạm thời (`shared/review/retry.ts`). Bị cắt giữa chừng thì chia đôi lô ngay; AI từ chối (`ai_refused`) và chạm trần không thử lại.
- Bảng điều khiển chỉ đếm lượt phân tích thường (`kind = 'analyze'`); chi phí và token tính đủ mọi loại.

## Thời gian và mức suy nghĩ
- Mã lượt sống 3 giờ (công trình dài cần nhiều bước tuần tự).
- Nhận xét từng mục dùng mức suy nghĩ `medium` (`REVIEW_EFFORT_SECTIONS`), phần tổng hợp dùng `high` (`REVIEW_EFFORT`) để mỗi bước nằm gọn trong 300 giây. Nên đo thời gian thật ở những lượt đầu; nếu có bước bị cắt (504) thì giảm `REVIEW_EFFORT_SECTIONS` hoặc `SECTIONS_PER_CALL`.
- Chi phí bộ nhớ đệm tính đọc đệm bằng 0,1 lần giá nhập (thận trọng, có thể cao hơn thực tế); chỉnh bằng `ANTHROPIC_CACHE_READ_FACTOR`.

## Triển khai
1. Supabase → SQL Editor: chạy `supabase/migrations/20261011_review.sql` (chạy lại an toàn).
2. Biến môi trường tùy chọn: `REVIEW_MODEL` (mặc định `ANTHROPIC_MODEL` hoặc `claude-opus-5-5`), `REVIEW_EFFORT` (tổng hợp, mặc định `high`), `REVIEW_EFFORT_SECTIONS` (nhận xét mục, mặc định `medium`), `ANTHROPIC_CACHE_READ_FACTOR`.
3. Chạy lại migration `20261011_review.sql` sau khi cập nhật mã (cột `corpus_hash`, `fails`, hàm `bind_review`, `log_template`, `add_usage` mới): mã mới cần các hàm này.

## Giới hạn đã biết
- Chấm lô tối đa 30 công trình mỗi lần (`MAX_BATCH_WORKS`), chạy tuần tự; mỗi công trình tốn 1 lượt, và cả lô dùng chung loại văn bản, vai trò, mẫu nhận xét. Hết lượt/khóa/đình chỉ thì dừng cả lô, các tệp còn lại ghi "bỏ qua"; lỗi riêng một tệp không ảnh hưởng tệp khác (lượt được hoàn).
- Sửa tại chỗ (`shared/review/edit.ts`): điểm từng mục, nhận xét, ưu/nhược điểm, yêu cầu chỉnh sửa; điểm tổng và khuyến nghị tính lại bằng mã. Gói .zip một tệp .docx mỗi công trình (`src/lib/review-docx.ts`, `buildZip`).
- Kết quả (kèm trích đoạn công trình) lưu ở `localStorage` tối đa 30 bản (`MAX_SAVED_REVIEWS`), tự giảm khi hết chỗ; xóa được bất cứ lúc nào.
- Chưa kiểm tra trùng lặp (đạo văn) và không xác minh tài liệu tham khảo có thật; giao diện và bản Word đều nói rõ.
- PDF ảnh quét chưa hỗ trợ (chưa OCR); `.doc` cần lưu lại thành `.docx`.
- Chưa thử với mô hình thật trong phiên phát triển: kiểm thử dùng máy chủ AI giả (`tests/review-api.test.ts`). Bộ nhớ đệm lời nhắc có thể không phát huy khi dùng đầu ra có lược đồ; chi phí thực tế đọc ở nhật ký sau những lượt đầu.
