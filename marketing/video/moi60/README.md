# Clip "Ami 1.6: có gì mới" (60 giây, 1080×1920, lời đọc tiếng Việt)

- `../ami-1.6-moi-60s.vi.mp4`: clip dọc 9:16, 60 giây, 30 khung/giây, lời đọc bằng giọng nam ElevenLabs "Việt Hoàng - Hà Nội" (`eleven_v4`, bản YouTube 16:9 ở thư mục `../yt`), nhạc nền và hiệu ứng âm thanh. Không in phụ đề; chữ trên màn hình chỉ là giao diện ứng dụng và các nhãn ngắn.
- `../ami-1.6-moi-60s-cover.png` (9:16) và `../ami-1.6-moi-60s-cover-4x5.png` (4:5, cắt phần giữa cho lưới hồ sơ): ảnh bìa dựng từ `cover.html`; chụp bằng `node cover.cjs <9x16.png> <4x5.png>`.

## Kịch bản
| Giây | Cảnh | Lời đọc |
|------|------|---------|
| 0–6 | **Mở đầu**: 30 bài luận văn, 7 ngày; hiện "Có gì mới?" | "Ba mươi bài luận văn. Một tuần. Phản biện sao kịp? Ami có cách!" |
| 6–13,5 | **Giáo sư phản biện**: nhận xét từng mục, điểm đề xuất thang 100, khuyến nghị | "Ra mắt Giáo sư phản biện! Ami soạn nháp nhận xét từng mục, kèm điểm đề xuất thang một trăm." |
| 13,5–19,5 | **Trích dẫn nguyên văn** đối chiếu với bản gốc | "Mỗi nhận xét kèm trích dẫn nguyên văn, đối chiếu bản gốc. Không bịa, không đoán!" |
| 19,5–29,5 | **Chấm lô**: nhiều tệp, mỗi người một bản Word, tối đa 30 công trình | "Mới! Chấm lô! Chọn cả chục công trình, mỗi người một tệp Word. Ami đọc lần lượt, soạn nhận xét riêng, xuất Word riêng cho từng người." |
| 29,5–36,5 | **Tệp lỗi không ảnh hưởng tệp khác** (hoàn lượt), tải gói .zip | "Tệp nào lỗi, báo rõ, hoàn lại lượt, tệp khác vẫn chạy. Rồi tải tất cả trong một gói zip!" |
| 36,5–44,5 | **Sửa tại chỗ**: đổi điểm, tổng điểm và khuyến nghị tự tính lại, tải Word bản đã sửa | "Chưa ưng ý? Sửa ngay trên màn hình! Chỉnh điểm từng mục, tổng điểm và khuyến nghị tự tính lại!" |
| 44,5–52,5 | **Giao diện mới, hướng dẫn có hình; ProFind → Ami** nhớ tên tạp chí | "Giao diện mới, hướng dẫn có hình từng bước. Và từ ProFind bấm sang Ami, tên tạp chí đi theo luôn!" |
| 52,5–60 | **Kết**: địa chỉ, mã QR, lưu ý | "Dành cho tài khoản đã xác thực. Là bản nháp hỗ trợ, quyết định cuối là của thầy cô. Thử ngay nhé!" |

Số liệu trong clip (điểm, tên người, tên tệp) là dữ liệu minh họa; ảnh giao diện chụp từ bản thật với máy chủ AI giả.

## Dựng lại
1. Giọng: xem `../yt/README.md` (ElevenLabs `eleven_v4`, giọng "Việt Hoàng - Hà Nội", bắt buộc `language_code: "vi"`). `script.json` là lời đọc, `dur.json` là độ dài từng đoạn; ghi lại thành `<khóa>.wav` 44,1 kHz mono sau `loudnorm`.
2. Hình: `NODE_PATH=<nơi có playwright> node render.cjs <thư mục khung> 0 1800` (có thể chia nhiều tiến trình theo đoạn khung). Mọi chuyển động là hàm của thời gian trong `index.html` (`window.__render(t)`); `CAPTIONS` đặt `false` nên không in phụ đề.
3. Âm thanh: `python3 audio60.py <thư mục chứa wav> mix.wav` (cần numpy), tổng hợp nhạc nền và hiệu ứng, trộn với giọng; thời điểm bắt đầu từng đoạn ở biến `starts` (khớp `START` trong `index.html`).
4. Ghép: `ffmpeg -framerate 30 -i f%04d.jpg -i mix.wav -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart -shortest out.mp4`.

Phông Inter và Space Grotesk theo giấy phép SIL OFL 1.1 (xem `public/fonts/LICENSE-fonts.txt`).
