# Thành phần bên thứ ba / Third-party components

Các thành phần dưới đây dùng theo giấy phép của chúng; không thuộc giấy phép đóng của dự án.

| Thành phần | Giấy phép | Dùng để |
|---|---|---|
| React, React DOM | MIT | Giao diện |
| Vite, @vitejs/plugin-react | MIT | Build |
| TypeScript | Apache-2.0 | Ngôn ngữ |
| @supabase/supabase-js | MIT | Đăng nhập, cơ sở dữ liệu |
| @anthropic-ai/sdk | MIT | Gọi Claude API |
| pdfjs-dist (Mozilla PDF.js) | Apache-2.0 | Đọc văn bản PDF trong trình duyệt |
| mammoth | BSD-2-Clause | Đọc văn bản DOCX trong trình duyệt |
| word-extractor | MIT | Đọc văn bản DOC (Word cũ) trên máy chủ |
| tesseract.js | Apache-2.0 | OCR PDF quét ảnh trong trình duyệt (mô hình Tesseract tessdata_fast, Apache-2.0) |
| citeproc-js | CPAL-1.0 hoặc AGPL-1.0 (dùng theo CPAL-1.0) | Định dạng trích dẫn theo kiểu CSL |
| @vercel/analytics | MPL-2.0 | (đã cài sẵn, chưa bật) |

Dữ liệu:

| Nguồn | Giấy phép / điều khoản | Dùng để |
|---|---|---|
| OpenAlex | CC0 | Gợi ý công trình thay thế khi điểm dưới 60 |
| SCImago Journal Rank (Scopus), Hội đồng GSNN | Điều khoản riêng của từng nguồn | Bản chụp tạp chí EduFind trong `data/edufind.ts` |
| Citation Style Language (kiểu CSL, locale) | CC BY-SA 3.0 | Hơn 10.000 kiểu trích dẫn, tải theo nhu cầu; chỉ mục `public/csl/index.json` |
| ORCID Public API | Điều khoản ORCID | Nhập hồ sơ (tùy chọn, người dùng chủ động bấm) |
