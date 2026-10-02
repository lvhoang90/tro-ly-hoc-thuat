"""Tạo overlay.vi.js (bản tiếng Việt) từ overlay.js bằng cách thay các chuỗi hiển thị."""
s = open("overlay.js", encoding="utf-8").read()
R = [
 # lời thoại (bong bóng)
 ("Hi, I'm Ami! Finding the right papers takes hours. Not anymore.", "Chào bạn, mình là Ami! Tìm đúng tài liệu mất hàng giờ. Từ nay thì không nữa!"),
 ("Drop in a PDF, a Word file, even a scan.", "Thả vào tệp PDF, Word, hay cả bản quét."),
 ("I score how well it fits your topic, zero to one hundred.", "Mình chấm điểm độ phù hợp, từ 0 đến 100."),
 ("Then I pick passages worth citing, with page numbers, checked word for word.", "Rồi chọn đoạn đáng trích, kèm số trang, đối chiếu từng chữ."),
 ("One tap: APA, Harvard, IEEE, or ten thousand more styles.", "Chạm một cái, có ngay trích dẫn chuẩn, hơn 10.000 kiểu!"),
 ("Your files are never stored. Try me free at aaa.isavietnam.app!", "Tệp của bạn không bị lưu trữ. Dùng thử miễn phí ngay nhé!"),
 # thương hiệu
 ('<div style="font-weight:800;font-size:30px;letter-spacing:.02em">AI Academic Agent <span style="color:#38bdf8">1.0</span></div>', '<div style="font-weight:800;font-size:30px;letter-spacing:.02em">Trợ lý học thuật <span style="color:#38bdf8">· AI Academic Agent 1.0</span></div>'),
 # cảnh A
 ("FINDING THE RIGHT PAPERS…", "TÌM ĐÚNG TÀI LIỆU CHO ĐỀ TÀI…"),
 ('aHours.textContent = "HOURS"', 'aHours.textContent = "HÀNG GIỜ"'),
 ('aMin.textContent = "MINUTES"', 'aMin.textContent = "VÀI PHÚT"'),
 ('aSub.textContent = "with an AI academic assistant"', 'aSub.textContent = "cùng trợ lý học thuật AI"'),
 ("font-size:230px;line-height:1;color:#fff", "font-size:170px;line-height:1.3;color:#fff"),
 ("font-size:176px;line-height:1.1;letter-spacing:-.02em", "font-size:160px;line-height:1.2;letter-spacing:-.02em"),
 # cảnh B
 ("1 · UPLOAD", "1 · TẢI TÀI LIỆU"), ("Drop in your paper", "Thả tài liệu vào"),
 ("PDF · DOC · DOCX · scans", "PDF · DOC · DOCX · bản quét"), ("Reading your file…", "Đang đọc tệp…"),
 ("✓ Ready · 12 pages read", "✓ Sẵn sàng · đã đọc 12 trang"),
 # cảnh C
 ("2 · SCORE", "2 · CHẤM ĐIỂM"), ("Fit to your abstract", "Độ phù hợp đề tài"),
 ("✓ Meets the citation threshold (60)", "✓ Đạt ngưỡng trích dẫn (60)"),
 ('["Topic fit", 34', '["Chủ đề", 34'), ('["Concepts & theory", 16', '["Khái niệm, lý thuyết", 16'),
 ('["Method", 12', '["Phương pháp", 12'), ('["Evidence", 12', '["Bằng chứng", 12'), ('["Recency", 8', '["Tính cập nhật", 8'),
 # cảnh D
 ("3 · PASSAGES", "3 · ĐOẠN TRÍCH"), ("HIGH PRIORITY", "ƯU TIÊN CAO"), ("#1 · Definition", "#1 · Định nghĩa"),
 ("✓ VERBATIM MATCH", "✓ KHỚP NGUYÊN VĂN"), ("#2 · Evidence", "#2 · Bằng chứng"), ("#3 · Method", "#3 · Phương pháp"),
 (">p. 4<", ">tr. 4<"), (">p. 7<", ">tr. 7<"), (">p. 9<", ">tr. 9<"),
 # cảnh E
 ("4 · CITE", "4 · TRÍCH DẪN"), ("10,000+ journal styles", "Hơn 10.000 kiểu tạp chí"),
 ("Copy citation", "Sao chép trích dẫn"), ("✓ Copied!", "✓ Đã sao chép!"),
 # cảnh F
 ("Free · 1 analysis / day", "Miễn phí · 1 lượt phân tích/ngày"), ("Files never stored", "Không lưu tài liệu"),
 ("Scan &amp; try it free", "Quét mã dùng thử miễn phí"),
]
for a, b in R:
    assert a in s, a
    s = s.replace(a, b)
import json, re
sp = json.load(open("vo-vi-speech.json"))  # độ dài lời nói thật (giây) để chữ và miệng Ami bám theo giọng
for k, d in sp.items():
    m = re.search(r'\{ k: "%s", a: ([0-9.]+), b: ([0-9.]+),' % k, s)
    a = float(m.group(1)); s = s.replace(m.group(0), '{ k: "%s", a: %s, b: %.2f,' % (k, m.group(1), a + d + 0.1))
open("overlay.vi.js", "w", encoding="utf-8").write(s)
print("ok", len(R))
