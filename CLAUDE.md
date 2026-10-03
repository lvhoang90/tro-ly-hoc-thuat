# Quy ước làm việc cho dự án Trợ lý học thuật | AI Academic Agent

## Ghi chú phát hành: chỉ viết cho người dùng cuối

Áp dụng cho `scripts/releases.mjs` (nguồn của `CHANGELOG.md`, trang `/ghi-chu-phat-hanh`, `/en/release-notes`), nội dung GitHub Release và thông báo "Có gì mới" trong ứng dụng.

- **Nêu:** tính năng mới, thay đổi trải nghiệm, lỗi đã sửa mà người dùng từng gặp, bằng ngôn ngữ đời thường, mỗi dòng ngắn, đúng sự thật.
- **Bỏ:** chi tiết kỹ thuật (thư viện, kiến trúc, cách cài đặt), số đo hiệu năng, hạ tầng và triển khai, quy trình phát hành và CI, tài liệu truyền thông (poster, clip, ảnh mạng xã hội), SEO và dữ liệu có cấu trúc, tên tệp, mã, giấy phép thư viện, mọi việc nội bộ.
- Mỗi phiên bản chỉ vài dòng, ưu tiên điều người dùng sẽ thấy hoặc cảm nhận đầu tiên. Có đủ tiếng Việt và tiếng Anh.
- Chi tiết kỹ thuật để ở nội dung PR, commit và `docs/`; không đưa vào ghi chú phát hành.
- Sau khi sửa `scripts/releases.mjs` chạy `npm run release:notes`; `tests/release.test.ts` kiểm tra bản sinh khớp nguồn.

## Quy trình phát hành

Xem mục "Phát hành" trong `README.md`.
