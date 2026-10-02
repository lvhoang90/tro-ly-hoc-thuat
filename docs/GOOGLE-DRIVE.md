# Đồng bộ dữ liệu quản trị lên Google Drive (không lưu gì trên máy)

Mọi thành phần của hệ thống đã nằm trên đám mây, nên bạn có thể quản lý và cập nhật từ bất kỳ đâu, kể cả điện thoại:

| Thành phần | Nằm ở đâu | Chỉnh sửa / cập nhật ở đâu |
|---|---|---|
| Mã nguồn | GitHub (`lvhoang90/tro-ly-hoc-thuat`) | Trình soạn thảo web của GitHub, hoặc Claude Code trên web (nhờ tôi sửa, tạo PR, bạn bấm Merge) |
| Trang web | Vercel (tự deploy khi `main` đổi) | Không cần sửa tay; bí mật và biến môi trường ở Vercel → Settings → Environment Variables |
| Cơ sở dữ liệu (người dùng, hạn mức, chi phí, lịch sử) | Supabase | Trang **Quản trị** của ứng dụng; cấu trúc bảng ở Supabase → SQL Editor |
| Bản sao để xem, lọc, báo cáo, chia sẻ | **Google Sheets trong Google Drive của bạn** | Cập nhật tự động hằng ngày (hướng dẫn dưới đây) |

Google Sheets chỉ là bản sao **một chiều** (Supabase → Sheets). Việc sửa dữ liệu thật (cấp lượt, xác nhận, khóa tài khoản, đổi cài đặt) làm ở trang Quản trị để hai nơi không lệch nhau. Nếu sau này bạn muốn sửa trong Sheets rồi ghi ngược vào hệ thống, hãy nhờ tôi thiết kế riêng (cần kiểm soát quyền chặt).

Cách này chạy hoàn toàn trong Google (Apps Script, miễn phí), không cần máy chủ riêng, GitHub Actions hay phần mềm trên máy bạn.

## Bước 1. Tạo Google Sheet
1. Vào https://drive.google.com → **Mới → Google Trang tính** (Google Sheets) → đặt tên `AI Academic Agent - Quản trị`.
2. Có thể đặt vào một thư mục riêng, ví dụ `Dự án / Trợ lý học thuật`.

## Bước 2. Dán mã đồng bộ
1. Trong Sheet: **Tiện ích mở rộng → Apps Script** (Extensions → Apps Script).
2. Xóa mã mẫu, mở tệp `docs/google-apps-script/Sync.gs` trong repo (trên GitHub bấm **Raw** rồi sao chép toàn bộ), dán vào, bấm **Lưu** (biểu tượng đĩa).

## Bước 3. Khai báo khóa kết nối (không dán vào ô tính)
1. Trong Apps Script: biểu tượng bánh răng **Cài đặt dự án** (Project Settings) → cuộn xuống **Script properties** → **Add script property**.
2. Thêm hai thuộc tính:
   - `SUPABASE_URL` = địa chỉ dự án Supabase, dạng `https://xxxxxxxx.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = khóa **Secret** (hoặc `service_role`) lấy ở Supabase → Project Settings → API Keys
3. **Lưu**. Khóa này quyền rất cao: chỉ để trong Script properties của tài khoản Google của bạn, không gửi cho ai.

## Bước 4. Chạy lần đầu
1. Quay lại trình soạn mã, chọn hàm `syncAll` ở thanh công cụ rồi bấm **Chạy** (Run).
2. Google hỏi cấp quyền: **Xem xét quyền** → chọn tài khoản của bạn → nếu có cảnh báo "Google chưa xác minh ứng dụng này" thì bấm **Nâng cao → Đi tới (không an toàn)**. Đây là mã của chính bạn trong Sheet của bạn, nên an toàn. Cho phép truy cập Trang tính và kết nối ngoài.
3. Chạy xong, quay lại Sheet sẽ thấy các tab: **Người dùng, Lượt phân tích, Theo ngày, Cấp lượt, Truy cập, Quốc gia, Cài đặt, Đồng bộ** (tab cuối ghi thời điểm và số dòng).

## Bước 5. Hẹn đồng bộ tự động
1. Chọn hàm `setupTrigger` rồi **Chạy** một lần. Hệ thống sẽ tự đồng bộ **mỗi ngày lúc 2 giờ sáng (giờ Việt Nam)**. Đổi giờ bằng `DAILY_HOUR` ở đầu mã.
2. Sau khi tải lại Sheet, có thêm menu **Agent** với "Đồng bộ ngay" khi bạn muốn cập nhật tức thì (cả trên điện thoại qua ứng dụng Google Sheets: mở bằng máy tính để dùng menu này, hoặc chờ lịch tự động).

## Bước 6. Bảo mật khi chia sẻ
- Sheet chứa email, điện thoại, đơn vị công tác của người dùng. **Không bật chia sẻ công khai.** Chỉ mời đúng tài khoản cần xem, ưu tiên quyền *Người xem*.
- Mặc định **không** đưa nội dung abstract và đoạn trích của người dùng vào Sheet. Nếu bật `INCLUDE_CITATIONS = true`, chỉ có nguồn, kiểu, điểm và đề tài, vẫn không có nội dung đoạn trích.
- Nếu nghi lộ khóa: Supabase → API Keys → tạo secret key mới, xóa khóa cũ, rồi cập nhật Script properties và Vercel.

## Sao lưu cơ sở dữ liệu đầy đủ
Google Sheets là bản báo cáo, **không phải bản sao lưu để khôi phục**. Để khôi phục được cả hệ thống:
- Supabase gói Pro: bật **Database → Backups** (sao lưu hằng ngày, có khôi phục theo thời điểm nếu mua thêm).
- Gói Free: không có sao lưu tự động; hãy nâng cấp trước khi có người dùng thật, hoặc nhờ tôi thiết lập lịch xuất `pg_dump` lên Drive.
- Mã nguồn và lược đồ SQL luôn nằm trên GitHub (`supabase/schema.sql`).

## Xử lý sự cố
| Thông báo | Cách xử lý |
|---|---|
| `Thiếu SUPABASE_URL ...` | Chưa khai báo Script properties (Bước 3), hoặc gõ sai tên. |
| `profiles: HTTP 401` hoặc `403` | Sai khóa. Dùng khóa Secret/`service_role`, không dùng khóa Publishable/`anon`. |
| `visit_days: HTTP 404` hoặc `relation ... does not exist` | Chưa chạy `supabase/schema.sql` bản mới (xem `docs/SUPABASE.md`, mục nâng cấp v2). |
| `Exceeded maximum execution time` | Nhật ký quá lớn so với giới hạn 6 phút của Apps Script. Hãy báo tôi để chuyển sang đồng bộ theo lô hoặc chỉ lấy 90 ngày gần nhất. |
| Không thấy lịch tự chạy | Apps Script → biểu tượng đồng hồ **Triggers**: phải có một dòng `syncAll` theo ngày. |

## Cách B: đồng bộ bằng GitHub Actions (khi Google chặn Apps Script)

Dùng khi bước cấp quyền Apps Script báo "Ứng dụng này đã bị chặn". Không cần Apps Script; một service account ghi thẳng vào Google Sheet của bạn.

1. **Tạo service account.** Vào console.cloud.google.com, chọn (hoặc tạo) một dự án. Mở *APIs & Services → Library*, tìm **Google Sheets API** và bấm **Enable**. Mở *IAM & Admin → Service Accounts → Create service account*, đặt tên `sheet-sync`, bỏ qua các bước gán quyền, bấm **Done**.
2. **Tạo khóa JSON.** Bấm vào service account vừa tạo, tab **Keys → Add key → Create new key → JSON**. Tệp JSON được tải về máy. Giữ kín tệp này, không đưa lên Git hay chat.
3. **Chia sẻ Sheet.** Mở tệp JSON, sao chép giá trị `client_email` (dạng `sheet-sync@…iam.gserviceaccount.com`). Mở Google Sheet của bạn, bấm **Chia sẻ**, dán email đó và cấp quyền **Người chỉnh sửa**.
4. **Lấy SHEET_ID.** Là đoạn nằm giữa `/d/` và `/edit` trong địa chỉ của Sheet.
5. **Thêm 4 secret vào GitHub.** Repo → *Settings → Secrets and variables → Actions → New repository secret*:
   - `SUPABASE_URL`: địa chỉ dự án Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: khóa `service_role`.
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: dán toàn bộ nội dung tệp JSON.
   - `SHEET_ID`: mã ở bước 4.
6. **Chạy thử.** Tab *Actions → Sync Google Sheets → Run workflow*. Sau khi xong (xanh), Sheet có các tab dữ liệu. Workflow tự chạy mỗi ngày lúc 02:00 giờ Việt Nam (`.github/workflows/sync-sheets.yml`).

Script nằm ở `scripts/sync-sheets.mjs`, cùng nguyên tắc với bản Apps Script: một chiều, không đưa abstract hay đoạn trích vào Sheet (đặt biến `INCLUDE_CITATIONS=1` nếu cần tab trích dẫn).
