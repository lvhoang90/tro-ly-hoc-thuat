# Ami trong hệ sinh thái ISA (EduFind, ProFind, Ami, Mây)

Tài liệu cho người vận hành. Nội dung cho người dùng nằm ở trang Hướng dẫn và Quyền riêng tư.

## Ami kết nối với gì

| Hướng | Cách làm | Dữ liệu đi đâu |
|---|---|---|
| Ami → các ứng dụng | Liên kết qua cổng `https://isavn.edu.vn/go/<ứng dụng>?from=ami` (EduFind, ProFind, Mây) | Chỉ nguồn chiến dịch, ngôn ngữ, mã giới thiệu 7 ký tự; không email, không ORCID |
| EduFind → Ami | `?journal=<tên>&utm_source=edufind` | Tên tạp chí, lưu trong phiên (`src/lib/handoff.ts`) |
| ProFind → Ami | chưa có (xem "Việc cần làm ở ProFind") | |
| Đo hành trình | `https://isavn.edu.vn/embed.js` (đã gắn ở `index.html`), sự kiện qua `window.isaTrack` (`src/lib/isa.ts`) | Tên sự kiện ngắn, không nội dung tài liệu |
| Tác giả trên ProFind | Tải `https://profind.isavn.edu.vn/data/suggest.json` về trình duyệt (khoảng 1,5 MB, chỉ khi cần) và so khớp tên trên máy | Họ tên không rời khỏi máy người dùng |
| Hồ sơ ProFind của tôi (ISA Connect) | `POST /api/eco` ký mã `v1.<payload>.<HMAC>` rồi mở `https://profind.isavn.edu.vn/#/ket-noi?t=…&from=ami` | Chỉ khi người dùng bấm: email đã xác thực, họ tên, số điện thoại, đơn vị, công việc, hồ sơ đã chọn |

Mã nguồn: `shared/profind.ts` (thuật toán so khớp, chép từ ProFind `src/Suggest.tsx` và EduFind `portal/profind-match.js`: sửa bên nào thì sửa cả ba), `api/_lib/connect.ts`, `api/eco.ts`, `src/components/{AuthorsPanel,EcoCards}.tsx`.

## Bật Kết nối ISA (một lần)

`ISA_CONNECT_SECRET` là khoá dùng chung của cả hệ sinh thái (Mây, ProFind, EduFind phải cùng một giá trị, từ 16 ký tự). Nếu đã đặt ở Vercel dưới dạng biến chung của nhóm ISA Vietnam: Team Settings → Environment Variables → `ISA_CONNECT_SECRET` → **Link to Projects** → thêm dự án `tro-ly-hoc-thuat` → triển khai lại. Không dán khoá vào cuộc trò chuyện hay mã nguồn.

Chưa đặt khoá: nút "Đúng là tôi" vẫn mở ProFind bình thường (người dùng tự đăng nhập), không báo lỗi; trạng thái hồ sơ ProFind hiện "chưa biết".

## Việc cần làm ở ProFind (không nằm trong kho này)
- `api/account.js`, thao tác `connect`: hiện chỉ nhận `src` là `edufind` hoặc `may`; Ami gửi `src: "ami"` nên đang bị ghi là `may` trong thống kê `connect_*` và `user.link.from`. Thêm `ami` vào hai chỗ đó là đủ.
- Giao diện `#/ket-noi` cũng nên nhận `from=ami`.

## Việc cần làm ở isavn.edu.vn (không nằm trong kho này)
- Cổng `/go/<ứng dụng>?to=` chỉ nhận đường dẫn, không nhận phần `#`; hồ sơ tác giả ProFind dùng đường dẫn `#/tac-gia/<mã>` nên Ami phải mở thẳng ProFind kèm `utm_source=ami` thay vì đi qua cổng. Nếu cổng nhận thêm `hash=` thì các lượt bấm này cũng được đo ở cổng.
- Bài viết và dữ liệu bé Asi còn ghi Ami "1 lượt phân tích mỗi ngày" (`server/articles-data.js`, `server/knowledge/he-sinh-thai.json`, `server/knowledge-en/en.json`); từ 10/10/2026 tài khoản Cơ bản là 1 lượt mỗi tuần.

## Sự kiện gửi cho bộ đếm ISA (`window.isaTrack`)
`ami_dang_ky` (nhãn `ref` nếu đăng ký bằng liên kết mời), `ami_phan_tich` (`dat`/`chua_dat`), `ami_sao_chep`, `ami_het_luot` (nhãn hạng), `ami_lien_he_xac_thuc`, `ami_lien_he_luot`, `ami_sang_ung_dung` (EduFind/ProFind/Mây từ Hồ sơ), `ami_sang_profind` (`author`/`me`), `ami_ket_noi_profind` (`dung_la_toi`/`tim`/`co_sdt`), `ami_moi_dong_nghiep` (`copy`/`share`).

## Giới thiệu đồng nghiệp
Cột `profiles.ref_code`, `referred_by`, `referral_paid`; cài đặt `referral_bonus` (mặc định 1) và `referral_cap` (mặc định 5), chỉnh ở Quản trị → Cài đặt. Thưởng trả một lần khi người được mời phân tích thành công lần đầu (hàm `pay_referral`, gọi từ `record_usage` khi có điểm). Mỗi lượt thưởng tốn chi phí API như một lượt thường: đặt `referral_bonus = 0` để tắt. Chạy `supabase/migrations/20261010_ecosystem.sql` trước khi triển khai mã mới.
