# Chạy Ami trên hosting dùng chung (cPanel, Node + SQLite)

Thay thế Vercel + Supabase bằng một ứng dụng Node duy nhất: giao diện, API, đăng nhập và CSDL SQLite cùng nằm trên hosting ISA.
Tài khoản và mật khẩu hiện có được giữ nguyên (mã băm bcrypt của Supabase vẫn đăng nhập được; lần đăng nhập đầu tiên sẽ tự đổi sang scrypt).

## 0. Yêu cầu
- Hosting có **Setup Node.js App** (Passenger), Node ≥ 22.5 (cần `node:sqlite`), RAM ≥ 512 MB.
- Hộp thư SMTP trên hosting để gửi email xác nhận/đặt lại mật khẩu (tạo ở cPanel → Email Accounts, ví dụ `no-reply@isavietnam.app`).
- Khoá `ANTHROPIC_API_KEY` (đang đặt trên Vercel).

## 1. Tạo gói triển khai
Cách 1 (không cần máy cài Node): GitHub → Actions → **cPanel bundle** → Run workflow, nhập địa chỉ web (địa chỉ tạm ở bước 3, về sau chạy lại với địa chỉ chính thức) → tải `ami-cpanel` ở mục Artifacts.

Cách 2: `VITE_SITE_URL=https://<địa-chỉ> npm run pack:cpanel` → ra `ami-cpanel.zip`.

Gói tự chứa (thư viện đã đóng sẵn), **không cần chạy `npm install` trên hosting**.

## 2. Xuất dữ liệu từ Supabase
Cần chuỗi kết nối CSDL: Supabase → Project Settings → Database → Connection string (URI). **Chỉ đặt trong máy của bạn, không gửi cho ai (kể cả trong cuộc trò chuyện).**

```bash
npm ci
DATABASE_URL="postgresql://postgres:<mật-khẩu-CSDL>@db.<mã-dự-án>.supabase.co:5432/postgres" npm run migrate:export
```
Ra `ami-export.json` (có email và mã băm mật khẩu: giữ riêng tư, xoá sau khi nhập). Nếu máy không kết nối được cổng 5432, dùng chuỗi "Session pooler" cũng ở trang đó.

## 3. Chạy song song ở địa chỉ tạm
1. cPanel → **Domains/Subdomains**: tạo subdomain tạm (ví dụ `ami-test.isavietnam.app`), bật SSL (AutoSSL).
2. cPanel → **Setup Node.js App** → Create Application: Node 22, Application root `ami`, Application URL = subdomain tạm, Startup file `app.cjs`.
3. Giải nén `ami-cpanel.zip` vào thư mục `ami` (File Manager hoặc Upload + Extract).
4. Thêm biến môi trường trong màn hình app:

| Biến | Giá trị |
|---|---|
| `DATA_DIR` | thư mục **ngoài** thư mục `ami` và ngoài `public_html`, ví dụ `/home/<user>/ami-data` (nơi lưu CSDL; tạo trước) |
| `SITE_URL` | địa chỉ web đang chạy, ví dụ `https://ami-test.isavietnam.app` (dùng trong liên kết email) |
| `ANTHROPIC_API_KEY` | khoá Claude |
| `ANTHROPIC_MODEL` | tuỳ chọn, mặc định `claude-opus-5-5` |
| `ADMIN_EMAIL` | email quản trị (tự thành quản trị khi đăng ký/đã có tài khoản) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | hộp thư gửi đi (cổng 465 = SSL; cổng 587 thì thêm `SMTP_SECURE=false`). Hoặc một biến `SMTP_URL=smtps://user:pass@host:465` |

5. Nhập dữ liệu: cPanel → **Terminal** (hoặc nút "Enter to the virtual environment" trong màn hình Node app), tải `ami-export.json` lên thư mục `ami`, rồi:
   ```bash
   cd ~/ami && DATA_DIR=/home/<user>/ami-data node server-dist/import.mjs ami-export.json
   rm ami-export.json
   ```
   (Nhập lại từ đầu: thêm `--replace`.)
6. Bấm **Restart** ở màn hình Node app, mở địa chỉ tạm, kiểm tra: `/api/health` → `{"ok":true,"ai":true,"mail":true}`; đăng nhập bằng tài khoản cũ; xem Quản trị → Thống kê khớp số liệu cũ; thử một lượt phân tích; thử đăng ký tài khoản mới (email xác nhận phải tới).

Lưu ý: dữ liệu ở địa chỉ tạm chỉ để thử. Đến lúc chuyển chính thức, **xuất lại và nhập lại với `--replace`** để lấy dữ liệu mới nhất.

## 4. Chuyển chính thức (đổi DNS)
1. Chọn giờ ít người dùng. Chạy lại bước 2, rồi bước 5 với `--replace` (tạm dừng người dùng mới đăng ký trong lúc đó).
2. Chạy lại workflow **cPanel bundle** với `site_url` là địa chỉ chính thức (`https://aaa.isavietnam.app`) và triển khai lại gói; đổi `SITE_URL` và Application URL sang địa chỉ chính thức.
3. Đổi DNS của `aaa.isavietnam.app` về hosting (giảm TTL xuống 300 giây trước đó ít nhất một ngày).
4. Theo dõi một vài ngày; giữ nguyên Vercel/Supabase (không xoá) để quay lại được.

**Quay lại:** đổi DNS về Vercel như cũ. Dữ liệu phát sinh trên hosting sau khi chuyển sẽ không có ở Supabase.

Sau khi ổn định: cập nhật trang Quyền riêng tư (nêu hosting ISA thay cho Vercel/Supabase), tắt dự án Vercel/Supabase.

## 5. Vận hành
- **Sao lưu**: thư mục `DATA_DIR` (tệp `ami.db`, `ami.db-wal`). Dùng cPanel → Backup hoặc cron: `sqlite3 ami.db ".backup ami-$(date +%F).db"`.
- **Cập nhật phiên bản**: tải gói mới, giải nén đè lên `ami` (không đụng `DATA_DIR`), Restart.
- **Thời gian chờ**: phân tích mất 20–90 giây. Máy chủ gửi tín hiệu giữ kết nối mỗi 10 giây. Nếu vẫn bị cắt (lỗi 502/504 sau ~60 giây), nhờ nhà cung cấp tăng `ProxyTimeout`/Passenger timeout lên ≥ 120 giây.
- **Quốc gia truy cập**: chỉ có khi trước hosting có CDN gửi tiêu đề `CF-IPCountry` (Cloudflare); nếu không, biểu đồ quốc gia để trống.
- **Quên mật khẩu**: liên kết trong email đăng nhập thẳng vào tài khoản (giống trước đây). Đổi mật khẩu: API `POST /api/auth/update-password` đã có, giao diện sẽ bổ sung sau.
- **Lỗi thường gặp**: `ERR_UNKNOWN_BUILTIN_MODULE node:sqlite` → Node < 22.5, chọn Node 22 ở Setup Node.js App. Email không tới → xem nhật ký (stderr) của app, kiểm tra SMTP; chưa cấu hình SMTP thì liên kết xác nhận chỉ in ra nhật ký.
