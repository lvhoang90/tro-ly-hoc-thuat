# Trợ lý học thuật | AI Academic Agent 1.0

Ứng dụng web song ngữ Việt/Anh giúp nhà nghiên cứu **đọc tài liệu, chấm mức độ phù hợp, tóm tắt, chọn đoạn đáng trích dẫn và sao chép trích dẫn đúng chuẩn quốc tế**.
Bản quyền đóng, mọi quyền được bảo lưu (xem `LICENSE`). Tác giả: Lương Việt Hoàng (ISA Vietnam).

## Luồng người dùng

1. **Đăng ký + xác thực email** (Supabase Auth). Chưa xác thực thì không đăng nhập và không gọi được API.
2. **Nhập Abstract/Proposal** (tối thiểu 40 từ). Đây là chuẩn để đo độ phù hợp.
3. **Tải tài liệu** PDF/DOC/DOCX tối đa 2 MB (15 MB với tài khoản đã được quản trị viên xác thực; được chứa ảnh). Văn bản được trích **ngay trên máy người dùng**; chỉ văn bản gửi lên.
4. **AI đánh giá**: điểm 0-100 theo 5 tiêu chí (chủ đề 40, khái niệm 20, phương pháp 15, bằng chứng 15, cập nhật 10), tóm tắt, điểm phù hợp/hạn chế.
   - **≥ 60 điểm**: danh sách đoạn nên trích, xếp hạng và tô màu ưu tiên cao/trung bình/thấp, kèm số trang. Mỗi đoạn là nguyên văn đã **đối chiếu với văn bản gốc**; đoạn AI "bịa" bị loại.
   - **< 60 điểm**: gợi ý nên tìm gì thay thế, công trình tương tự (OpenAlex) và tạp chí đối chiếu với CSDL **EduFind**: AI chọn 1 đến 3 trong 28 lĩnh vực phù hợp với đề tài, gợi ý tạp chí quốc tế (hạng Q của SJR) và trong nước (điểm tối đa HĐGSNN), kèm liên kết đúng trang lĩnh vực.
5. **Trích dẫn**: APA 7, Harvard, Chicago (author-date), MLA 9, IEEE, Vancouver, AMA, BibTeX, RIS. Chọn ngôn ngữ trích dẫn **tiếng Việt (và, tr., và cs.) hoặc tiếng Anh (&, pp., et al.)** độc lập với ngôn ngữ giao diện. Sao chép giữ chữ nghiêng khi dán vào Word.

Kết quả đánh giá hiển thị song ngữ (đổi ngôn ngữ giao diện là đổi cả nhận xét, không gọi AI lần nữa), viết theo văn phong học thuật phù hợp lĩnh vực mà người dùng khai báo trong hồ sơ. Sau phần nhận xét là hộp **Quyết định của bạn** để chọn hướng đi (trích dẫn, tìm nguồn khác, chỉnh abstract, hoặc vẫn trích dẫn nguồn có điểm thấp). Lịch sử trích dẫn cho đổi kiểu và ngôn ngữ ngay trên từng mục.

Dung lượng tệp: **15 MB** cho người dùng đã được quản trị viên **xác thực**, **2 MB** cho tài khoản chưa xác thực (chỉnh được trong Quản trị → Cài đặt). Trang **Quản trị → Thống kê** có chi phí API thực tế (USD và VND) theo ngày, theo người dùng, token, số lượt phân tích, phân bố điểm phù hợp, người dùng mới và lượt truy cập, kèm biểu đồ tương tác và chế độ xem bảng. Lịch sử trích dẫn gom theo **đề tài** (abstract đã lưu) hoặc, nếu chỉ có một đề tài, xếp theo mức ưu tiên và điểm phù hợp.

Hạn mức theo **hạng tài khoản**. *Cơ bản* (chưa xác thực): đến hết 09/10/2026 là 1 lượt/ngày, từ **10/10/2026** là **1 lượt/tuần** (tuần bắt đầu thứ Hai, giờ Việt Nam; ngày áp dụng và số lượt chỉnh trong Quản trị → Cài đặt), lịch sử trích dẫn chỉ xem lại khi đã xác thực (dữ liệu vẫn được lưu) và gợi ý tài liệu chỉ hiện số lượng. *Đã xác thực*: hạn mức riêng từng người do tác giả đặt (mặc định 1 lượt/ngày), đầy đủ tính năng. Hết lượt thì hiện lời mời xác thực kèm email/SĐT/Zalo của tác giả. Quản trị viên cấp thêm lượt, đặt hạn mức riêng và lọc người dùng thường xuyên chưa xác thực trong trang Quản trị. **Master** (role admin) không giới hạn. Lượt bị hoàn lại nếu AI lỗi hoặc tài liệu ngôn ngữ khác.
Không lưu tài liệu; chỉ lưu hồ sơ, hạn mức và **lịch sử trích dẫn đã sao chép**.

## Phát hành

Dự án theo [Semantic Versioning](https://semver.org/lang/vi/) (MAJOR.MINOR.PATCH) và [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/). Lịch sử có ở `CHANGELOG.md` (tiếng Anh), trên web tại `/ghi-chu-phat-hanh` và `/en/release-notes`, và ở trang [Releases](https://github.com/lvhoang90/tro-ly-hoc-thuat/releases) của GitHub. Nguồn duy nhất là `scripts/releases.mjs`. Ghi chú phát hành chỉ nêu điều người dùng cuối cảm nhận được, không đưa chi tiết kỹ thuật hay việc nội bộ (xem `CLAUDE.md`).

Quy trình phát hành phiên bản `X.Y.Z`:

1. Thêm mục mới ở đầu `RELEASES` trong `scripts/releases.mjs` (song ngữ), tăng `version` trong `package.json` (`npm version X.Y.Z --no-git-tag-version`), `APP.release` trong `src/lib/config.ts` và `softwareVersion` trong `index.html`.
2. Chạy `npm run release:notes` để sinh lại `CHANGELOG.md` và hai trang ghi chú; cập nhật `lastmod` trong `public/sitemap.xml`.
3. `npm run typecheck && npm test && npm run build` (có `tests/release.test.ts` kiểm tra các số phiên bản và bản sinh khớp nhau), mở PR vào `main` và gộp khi CI xanh. Vercel tự triển khai `main`.
4. Tạo thẻ và GitHub Release: gắn thẻ có chú thích rồi đẩy lên (`git tag -a vX.Y.Z -m "AI Academic Agent X.Y.Z" && git push origin vX.Y.Z`), hoặc vào **Actions → Release → Run workflow** (nhập `version`, tùy chọn `target` là commit đích; workflow tự tạo thẻ). Workflow `.github/workflows/release.yml` kiểm tra mục tương ứng trong `CHANGELOG.md`, chạy typecheck, kiểm thử và build (với phiên bản mới nhất), rồi tạo GitHub Release với nội dung lấy từ `CHANGELOG.md`.
5. Ứng dụng tự báo trên web: số phiên bản và liên kết ghi chú ở chân trang, thông báo "Mới trong phiên bản X.Y.Z" một lần cho mỗi người dùng (lưu `tl-seen-release` trong trình duyệt).

Số phiên bản "1.0" trong tên ứng dụng ("AI Academic Agent 1.0") là tên thương hiệu, không đổi theo bản phát hành.

## Kiến trúc

```
Trình duyệt (React + TS, Vite)               Vercel Functions                Dịch vụ ngoài
 ├ pdf.js / mammoth: trích văn bản  ─────►   /api/analyze  ──► Claude API (JSON có cấu trúc)
 ├ nhận diện ngôn ngữ (shared/lang)           │   ├ xác thực JWT Supabase + email đã xác thực
 ├ định dạng trích dẫn (shared/citation)      │   ├ consume_credit() nguyên tử → hoàn lại nếu lỗi
 └ supabase-js: hồ sơ, lịch sử, admin RPC     │   ├ đối chiếu trích đoạn (shared/quotes)
                                              │   └ <60: OpenAlex + data/edufind.ts
                                              /api/extract-doc  (chỉ .doc cũ, word-extractor)
                                              /api/visit        ──► Supabase (đếm truy cập)
Supabase: Auth + Postgres (RLS)  ◄── supabase/schema.sql
```

Vì sao trích văn bản ở trình duyệt: **tiết kiệm băng thông** (văn bản nhẹ hơn tệp gốc nhiều lần), tránh giới hạn thân yêu cầu 4,5 MB của Vercel, tệp không rời khỏi máy và không thể bị lưu. Thư viện nặng (pdf.js, mammoth) chỉ tải khi người dùng chọn tệp.

## Mã nguồn mở đang dùng (xem `THIRD_PARTY_NOTICES.md`)

React, Vite, TypeScript, supabase-js, @anthropic-ai/sdk, **pdf.js** (Apache-2.0), **mammoth** (BSD-2), **word-extractor** (MIT); dữ liệu **OpenAlex** (CC0).
**Giai đoạn 2**: **tesseract.js** (Apache-2.0) OCR PDF quét ảnh ngay trên trình duyệt; **citeproc-js** (CPAL-1.0 hoặc AGPL-1.0, dùng theo CPAL) + kho **CSL** (CC BY-SA 3.0) cho hơn 10.000 kiểu trích dẫn của tạp chí và trường. Để dành: **Crossref API** (tự điền DOI/siêu dữ liệu).

### OCR và kho CSL (giai đoạn 2)
- **OCR**: khi PDF không có lớp chữ, hệ thống đề nghị OCR (Việt + Anh) chạy trên máy người dùng, tối đa 60 trang, có nút hủy. Lần đầu tải mô hình khoảng 6 MB từ jsDelivr (trình duyệt lưu đệm). Tệp vẫn không rời khỏi máy.
- **CSL**: mục *Kiểu khác* tìm trong chỉ mục `public/csl/index.json` (10.865 kiểu), rồi tải tệp `.csl` cần dùng theo yêu cầu. Kiểu phụ thuộc (tạp chí) tự dùng kiểu cha. Cập nhật chỉ mục: `npm run build:csl`.

## Cài đặt

Yêu cầu: Node 20+, tài khoản Supabase, Anthropic API key, Vercel.

1. **Supabase**: tạo dự án; *SQL Editor* → dán và chạy `supabase/schema.sql`. Bỏ comment dòng cuối, thay email của bạn để thành **master**, chạy lại. *Authentication → Providers → Email*: bật **Confirm email**. *Authentication → URL Configuration*: đặt Site URL và Redirect URL là địa chỉ ứng dụng. Khuyến nghị cấu hình SMTP riêng (gói miễn phí giới hạn số email/giờ).
2. **Biến môi trường** (Vercel → Settings → Environment Variables; mẫu ở `.env.example`):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (bí mật), `ANTHROPIC_API_KEY` (bí mật), `ANTHROPIC_MODEL` (mặc định `claude-opus-5-5`; đặt `claude-sonnet-5-5` để rẻ hơn), `CONTACT_EMAIL`.
3. **Vercel**: import repo, framework Vite (đã có `vercel.json`). `api/analyze` cần thời gian chạy tới 120 giây; dùng gói/tùy chọn Vercel cho phép (Fluid compute).
4. Đăng nhập bằng email master → **Quản trị → Cài đặt**: nhập email/SĐT/Zalo liên hệ và số lượt miễn phí/ngày.
5. Cập nhật CSDL EduFind (cả 28 lĩnh vực, địa chỉ gốc lấy từ `site.config.json` của EduFind, hiện là https://edufind.isavn.edu.vn/): cập nhật bản sao repo `edufind-khgd`, chạy `EDUFIND_DIR=../edufind-khgd npm run sync:edufind`, rồi commit `data/edufind.ts`. Mỗi lĩnh vực giữ 400 tạp chí SJR cao nhất (đổi bằng `EDUFIND_TOP`) và toàn bộ tạp chí trong nước của Hội đồng.

Hướng dẫn Supabase chi tiết từng bước: [`docs/SUPABASE.md`](docs/SUPABASE.md). Đồng bộ dữ liệu quản trị sang Google Sheets/Drive: [`docs/GOOGLE-DRIVE.md`](docs/GOOGLE-DRIVE.md).

Chạy cục bộ: `npm i && npm run dev` (giao diện). Để thử cả `/api`, dùng `vercel dev`. Kiểm thử: `npm test` (đối chiếu trích đoạn, nhận diện ngôn ngữ, định dạng trích dẫn).

## Bảo mật

- Khóa `service_role` và `ANTHROPIC_API_KEY` chỉ ở máy chủ. Hạn mức trừ ở máy chủ bằng hàm Postgres khóa hàng (không thể gian lận từ trình duyệt); `consume_credit/refund_credit` chỉ `service_role` gọi được.
- RLS: người dùng chỉ đọc/sửa hồ sơ và lịch sử của mình; cột `role`, `status`, `bonus_credits` không sửa được từ trình duyệt; các hàm `admin_*` kiểm tra quyền.
- Nội dung tài liệu được coi là dữ liệu không tin cậy (chống prompt injection); trích đoạn phải khớp nguyên văn.
- Bộ đếm truy cập ẩn danh: không lưu IP, không cookie.

## Giới hạn đã biết

- PDF quét ảnh cần OCR trên máy người dùng (chậm hơn, độ chính xác phụ thuộc chất lượng bản quét). Hình, bảng biểu trong tài liệu không được phân tích, chỉ văn bản.
- Kiểu CSL tải từ jsDelivr nên cần mạng; nếu CDN bị chặn, chọn một trong 9 kiểu có sẵn.
- `.doc` cũ tối đa ~4 MB (giới hạn thân yêu cầu của Vercel); `.docx`/PDF tới 2 MB hoặc 15 MB tùy tài khoản (chỉnh trong Quản trị → Cài đặt). Tài liệu quá 400.000 ký tự bị từ chối, yêu cầu tách phần.
- Số trang của DOCX không xác định được (không có trang cố định); PDF thì có.
- Siêu dữ liệu thư mục (tác giả, năm, DOI) do AI trích từ nội dung và có thể thiếu: người dùng được sửa trước khi sao chép. Hãy đối chiếu DOI với Crossref khi trích dẫn chính thức.
- Điểm số là đánh giá hỗ trợ, không thay thế phán đoán của nhà nghiên cứu.
