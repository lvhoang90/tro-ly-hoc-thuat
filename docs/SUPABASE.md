# Hướng dẫn thiết lập Supabase từng bước

Thời gian khoảng 20 phút. Bạn cần: tài khoản Supabase (gói Free đủ dùng), tài khoản Vercel, Anthropic API key.

## Bước 1. Tạo dự án
1. Vào https://supabase.com/dashboard, đăng nhập (có thể dùng GitHub).
2. **New project** → chọn Organization → đặt tên `tro-ly-hoc-thuat`.
3. **Database Password**: bấm *Generate*, lưu vào trình quản lý mật khẩu.
4. **Region**: chọn *Southeast Asia (Singapore)* (gần Việt Nam nhất).
5. **Create new project**, chờ 1 đến 2 phút.

## Bước 2. Tạo bảng và hàm (chạy `schema.sql`)
1. Menu trái → **SQL Editor** → **New query**.
2. Mở tệp `supabase/schema.sql` trong repo, sao chép toàn bộ, dán vào, bấm **Run**. Kết quả mong đợi: *Success. No rows returned*.
3. Có thể chạy lại bất cứ lúc nào, không gây lỗi hay mất dữ liệu.

## Bước 3. Đặt tài khoản master (không giới hạn lượt)
1. Vẫn ở SQL Editor, chạy (thay email của bạn):
   ```sql
   insert into public.admin_emails(email) values ('email-cua-ban@example.com') on conflict do nothing;
   ```
2. Tài khoản đăng ký bằng đúng email này sẽ tự thành **admin**. Nếu đã đăng ký trước đó, lệnh trên tự nâng quyền ngay.
3. Muốn thêm admin khác: lặp lại với email khác, hoặc dùng nút *Nâng lên quản trị* trong trang Quản trị.

## Bước 4. Bật xác thực email
1. **Authentication** → **Sign In / Providers** (hoặc **Providers**) → **Email** → bật **Enable Email provider**.
2. Bật **Confirm email** (bắt buộc xác thực email mới dùng được).
3. **Authentication** → **URL Configuration**:
   - **Site URL**: địa chỉ ứng dụng, ví dụ `https://tro-ly-hoc-thuat.vercel.app` (hoặc tên miền riêng).
   - **Redirect URLs**: thêm `https://tro-ly-hoc-thuat.vercel.app/**` và `http://localhost:5173/**` (khi chạy thử máy bạn).
4. (Khuyến nghị) **Authentication** → **Emails** → **SMTP Settings**: gắn SMTP riêng (Resend, Brevo, Gmail SMTP…). Email mặc định của Supabase bị giới hạn số thư mỗi giờ và dễ vào Spam, đủ để thử nhưng không đủ cho người dùng thật.
5. (Tùy chọn) **Authentication** → **Emails** → **Templates**: sửa tiêu đề và nội dung thư *Confirm signup* sang tiếng Việt/Anh.

## Bước 5. Lấy khóa kết nối
**Project Settings** (biểu tượng bánh răng) → **API Keys** (hoặc **API**):
| Hiển thị trên Supabase | Đặt vào biến môi trường | Ghi chú |
|---|---|---|
| Project URL | `VITE_SUPABASE_URL` và `SUPABASE_URL` | công khai |
| `anon` (hoặc *publishable*) key | `VITE_SUPABASE_ANON_KEY` | công khai, an toàn nhờ RLS |
| `service_role` (hoặc *secret*) key | `SUPABASE_SERVICE_ROLE_KEY` | **bí mật**, chỉ ở Vercel, không dán vào mã hay chat |

## Bước 6. Khai báo trên Vercel
1. Vercel → **Add New… → Project** → import repo `lvhoang90/tro-ly-hoc-thuat` (framework tự nhận là Vite).
2. **Settings → Environment Variables**, thêm cho cả Production và Preview:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CONTACT_EMAIL`, tùy chọn `ANTHROPIC_MODEL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` (mẫu: `.env.example`).
   Đánh dấu **Sensitive** cho khóa `service_role` và `ANTHROPIC_API_KEY`.
3. **Deploy** (hoặc Redeploy sau khi thêm biến). Gói Pro cho phép hàm chạy lâu, đủ cho `maxDuration` 120 giây đã khai báo trong `vercel.json`.

## Bước 7. Kiểm tra đầu cuối
1. Mở ứng dụng → **Tạo tài khoản** bằng email master → mở thư xác thực → đăng nhập. Menu có mục **Quản trị**.
2. **Quản trị → Cài đặt**: nhập email, SĐT, Zalo liên hệ, số lượt miễn phí mỗi ngày (mặc định 2) → **Lưu**.
3. Đăng ký thêm một tài khoản thử (email khác). Phân tích 2 tài liệu rồi thử lần thứ 3: phải hiện khung "đã dùng hết lượt" kèm thông tin liên hệ.
4. Trở lại tài khoản master → **Quản trị → Người dùng** → tìm tài khoản thử → nhập số lượt → bấm **+**. Tài khoản thử dùng tiếp được.

## Xử lý sự cố thường gặp
| Triệu chứng | Nguyên nhân và cách xử lý |
|---|---|
| Không nhận được email xác thực | Xem Spam; kiểm tra giới hạn email mặc định; gắn SMTP riêng (Bước 4.4). |
| Bấm liên kết xác thực bị đưa về `localhost` | Site URL/Redirect URLs chưa đúng (Bước 4.3). |
| Gọi phân tích báo `server_misconfigured` | Thiếu `SUPABASE_SERVICE_ROLE_KEY` hoặc `ANTHROPIC_API_KEY` trên Vercel; redeploy sau khi thêm. |
| Đăng nhập được nhưng không thấy mục Quản trị | Email chưa nằm trong `admin_emails` (Bước 3), hoặc đã đăng ký bằng email khác. |
| `permission denied` khi cấp lượt | Chạy lại toàn bộ `schema.sql`; chỉ tài khoản có `role = admin` mới gọi được hàm `admin_*`. |
| Muốn đổi số lượt miễn phí | Quản trị → Cài đặt; có hiệu lực ngay với mọi người dùng. |

## Sao lưu và dữ liệu
Hệ thống không lưu tài liệu tải lên. Dữ liệu duy nhất cần bảo vệ là hồ sơ, hạn mức và lịch sử trích dẫn: bật **Database → Backups** (gói Pro của Supabase có sao lưu hằng ngày; gói Free thì dùng `pg_dump` định kỳ).
