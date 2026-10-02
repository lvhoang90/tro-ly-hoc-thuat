# Trợ lý học thuật | AI Academic Assistant 1.0

Ứng dụng web song ngữ Việt/Anh giúp nhà nghiên cứu **đọc tài liệu, chấm mức độ phù hợp, tóm tắt, chọn đoạn đáng trích dẫn và sao chép trích dẫn đúng chuẩn quốc tế**.
Bản quyền đóng, mọi quyền được bảo lưu (xem `LICENSE`). Tác giả: Lương Việt Hoàng (ISA Vietnam).

## Luồng người dùng

1. **Đăng ký + xác thực email** (Supabase Auth). Chưa xác thực thì không đăng nhập và không gọi được API.
2. **Nhập Abstract/Proposal** (tối thiểu 40 từ). Đây là chuẩn để đo độ phù hợp.
3. **Tải tài liệu** PDF/DOC/DOCX dưới 10 MB (được chứa ảnh). Văn bản được trích **ngay trên máy người dùng**; chỉ văn bản gửi lên.
4. **AI đánh giá**: điểm 0-100 theo 5 tiêu chí (chủ đề 40, khái niệm 20, phương pháp 15, bằng chứng 15, cập nhật 10), tóm tắt, điểm phù hợp/hạn chế.
   - **≥ 60 điểm**: danh sách đoạn nên trích, xếp hạng và tô màu ưu tiên cao/trung bình/thấp, kèm số trang. Mỗi đoạn là nguyên văn đã **đối chiếu với văn bản gốc**; đoạn AI "bịa" bị loại.
   - **< 60 điểm**: gợi ý nên tìm gì thay thế, công trình tương tự (OpenAlex) và tạp chí đối chiếu với CSDL **EduFind** (hạng Q của SJR, mức điểm HĐGSNN).
5. **Trích dẫn**: APA 7, Harvard, Chicago (author-date), MLA 9, IEEE, Vancouver, AMA, BibTeX, RIS. Chọn ngôn ngữ trích dẫn **tiếng Việt (và, tr., và cs.) hoặc tiếng Anh (&, pp., et al.)** độc lập với ngôn ngữ giao diện. Sao chép giữ chữ nghiêng khi dán vào Word.

Hạn mức: **2 lượt/ngày** (đặt lại 00:00 giờ Việt Nam). Hết lượt thì hiện thông tin liên hệ quản trị viên (email/SĐT/Zalo). Quản trị viên cấp thêm lượt trong trang Quản trị. **Master** (role admin) không giới hạn. Lượt bị hoàn lại nếu AI lỗi hoặc tài liệu ngôn ngữ khác.
Không lưu tài liệu; chỉ lưu hồ sơ, hạn mức và **lịch sử trích dẫn đã sao chép**.

## Kiến trúc

```
Trình duyệt (React + TS, Vite)               Vercel Functions                Dịch vụ ngoài
 ├ pdf.js / mammoth: trích văn bản  ─────►   /api/analyze  ──► Claude API (JSON có cấu trúc)
 ├ nhận diện ngôn ngữ (shared/lang)           │   ├ xác thực JWT Supabase + email đã xác thực
 ├ định dạng trích dẫn (shared/citation)      │   ├ consume_credit() nguyên tử → hoàn lại nếu lỗi
 └ supabase-js: hồ sơ, lịch sử, admin RPC     │   ├ đối chiếu trích đoạn (shared/quotes)
                                              │   └ <60: OpenAlex + data/edufind-journals.json
                                              /api/extract-doc  (chỉ .doc cũ, word-extractor)
                                              /api/visit        ──► Upstash Redis (đếm truy cập)
Supabase: Auth + Postgres (RLS)  ◄── supabase/schema.sql
```

Vì sao trích văn bản ở trình duyệt: **tiết kiệm băng thông** (văn bản nhẹ hơn tệp gốc nhiều lần), tránh giới hạn thân yêu cầu 4,5 MB của Vercel, tệp không rời khỏi máy và không thể bị lưu. Thư viện nặng (pdf.js, mammoth) chỉ tải khi người dùng chọn tệp.

## Mã nguồn mở đang dùng (xem `THIRD_PARTY_NOTICES.md`)

React, Vite, TypeScript, supabase-js, @anthropic-ai/sdk, **pdf.js** (Apache-2.0), **mammoth** (BSD-2), **word-extractor** (MIT); dữ liệu **OpenAlex** (CC0).
Đã cân nhắc và để dành cho giai đoạn sau: **tesseract.js** (Apache-2.0, OCR PDF quét ảnh), **citeproc-js + kho CSL** (CSL-styles CC BY-SA, hàng nghìn kiểu trích dẫn), **Crossref API** (tự điền DOI/siêu dữ liệu).

## Cài đặt

Yêu cầu: Node 20+, tài khoản Supabase, Anthropic API key, Vercel; tùy chọn Upstash Redis.

1. **Supabase**: tạo dự án; *SQL Editor* → dán và chạy `supabase/schema.sql`. Bỏ comment dòng cuối, thay email của bạn để thành **master**, chạy lại. *Authentication → Providers → Email*: bật **Confirm email**. *Authentication → URL Configuration*: đặt Site URL và Redirect URL là địa chỉ ứng dụng. Khuyến nghị cấu hình SMTP riêng (gói miễn phí giới hạn số email/giờ).
2. **Biến môi trường** (Vercel → Settings → Environment Variables; mẫu ở `.env.example`):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (bí mật), `ANTHROPIC_API_KEY` (bí mật), `ANTHROPIC_MODEL` (mặc định `claude-opus-5-5`; đặt `claude-sonnet-5-5` để rẻ hơn), `CONTACT_EMAIL`, `KV_REST_API_URL` + `KV_REST_API_TOKEN` (đếm truy cập; có thể dùng chung Upstash với EduFind, khóa riêng tiền tố `troly:`).
3. **Vercel**: import repo, framework Vite (đã có `vercel.json`). `api/analyze` cần thời gian chạy tới 120 giây; dùng gói/tùy chọn Vercel cho phép (Fluid compute).
4. Đăng nhập bằng email master → **Quản trị → Cài đặt**: nhập email/SĐT/Zalo liên hệ và số lượt miễn phí/ngày.
5. Cập nhật CSDL EduFind: `EDUFIND_DIR=../edufind-khgd npm run sync:edufind`, rồi commit `data/edufind-journals.json`. Ngành khác: `EDUFIND_DISCIPLINE=<slug>`.

Chạy cục bộ: `npm i && npm run dev` (giao diện). Để thử cả `/api`, dùng `vercel dev`. Kiểm thử: `npm test` (đối chiếu trích đoạn, nhận diện ngôn ngữ, định dạng trích dẫn).

## Bảo mật

- Khóa `service_role` và `ANTHROPIC_API_KEY` chỉ ở máy chủ. Hạn mức trừ ở máy chủ bằng hàm Postgres khóa hàng (không thể gian lận từ trình duyệt); `consume_credit/refund_credit` chỉ `service_role` gọi được.
- RLS: người dùng chỉ đọc/sửa hồ sơ và lịch sử của mình; cột `role`, `status`, `bonus_credits` không sửa được từ trình duyệt; các hàm `admin_*` kiểm tra quyền.
- Nội dung tài liệu được coi là dữ liệu không tin cậy (chống prompt injection); trích đoạn phải khớp nguyên văn.
- Bộ đếm truy cập ẩn danh: không lưu IP, không cookie.

## Giới hạn đã biết

- PDF **quét ảnh không có lớp chữ** chưa đọc được (cần OCR, xem lộ trình). Hình, bảng biểu trong tài liệu không được phân tích, chỉ văn bản.
- `.doc` cũ tối đa ~4 MB (giới hạn thân yêu cầu của Vercel); `.docx`/PDF tới 10 MB. Tài liệu quá 400.000 ký tự bị từ chối, yêu cầu tách phần.
- Số trang của DOCX không xác định được (không có trang cố định); PDF thì có.
- Siêu dữ liệu thư mục (tác giả, năm, DOI) do AI trích từ nội dung và có thể thiếu: người dùng được sửa trước khi sao chép. Hãy đối chiếu DOI với Crossref khi trích dẫn chính thức.
- Điểm số là đánh giá hỗ trợ, không thay thế phán đoán của nhà nghiên cứu.
