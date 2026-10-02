# Clip "Hành trình cùng Ami" (30 giây, 1080×1920, tiếng Anh)

- `ami-journey-30s.mp4`: clip dọc 9:16, 30 giây, 30 khung/giây, giọng Ami (tiếng Anh) + nhạc nền + hiệu ứng âm thanh.
- `ami-journey-cover.png`: ảnh bìa (khung hình ở giây 4,6).
- `ami-journey-30s.en.srt`: phụ đề tiếng Anh (clip đã in sẵn lời thoại trong bong bóng của Ami).

## Kịch bản
| Giây | Cảnh | Lời Ami |
|------|------|---------|
| 0–5,6 | **Mở đầu**: giấy chất đống, "HOURS" bị gạch, thành "MINUTES"; Ami vẫy chào rồi ăn mừng | "Hi, I'm Ami! Finding the right papers takes hours. Not anymore." |
| 5,7–9,4 | **1 · Upload**: PDF, DOC, DOCX, SCAN bay vào, đọc xong | "Drop in a PDF, a Word file, even a scan." |
| 9,4–13,1 | **2 · Score**: đồng hồ đếm lên 82/100, 5 tiêu chí | "I score how well it fits your topic, zero to one hundred." |
| 13,1–17,8 | **3 · Passages**: đoạn trích được tô sáng, dấu "VERBATIM MATCH", số trang | "Then I pick passages worth citing, with page numbers, checked word for word." |
| 17,8–23,3 | **4 · Cite**: APA → Harvard → IEEE → 10,000+, bấm Copy, Ami ăn mừng | "One tap: APA, Harvard, IEEE, or ten thousand more styles." |
| 23,3–30 | **Kết**: logo, tên ứng dụng, QR, aaa.isavietnam.app, "Free · 1 analysis / day", "Files never stored" | "Your files are never stored. Try me free at aaa.isavietnam.app!" |

Dữ liệu trong clip là dữ liệu minh họa.

## Cách dựng lại
- `audio.py`: tổng hợp nhạc nền và hiệu ứng bằng numpy, trộn với giọng nói (Piper TTS, giọng `en_US-amy-medium`, giấy phép MIT/CC0 theo mô hình giọng).
- `overlay.js`: các cảnh, bong bóng lời thoại, chuyển động theo thời gian `t` (dựng khung hình xác định).
- `render.cjs`: chạy lượt `bg` (nền + cảnh) và lượt `ami` (Ami 3D thật từ ứng dụng, nền trong suốt) bằng Playwright; sau đó ghép bằng ffmpeg (xem lệnh `overlay` với hiệu ứng Ami xuất hiện).
