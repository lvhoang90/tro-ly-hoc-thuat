// Nguồn duy nhất cho lịch sử phát hành (Semantic Versioning, định dạng Keep a Changelog).
// Sửa ở đây rồi chạy `npm run release:notes` để sinh lại CHANGELOG.md và hai trang ghi chú phát hành.
// Mỗi mục là [tiếng Việt, tiếng Anh].
export const REPO = "https://github.com/lvhoang90/tro-ly-hoc-thuat";
export const SITE = "https://aaa.isavietnam.app";

export const RELEASES = [
  {
    version: "1.1.0",
    date: "2026-10-03",
    title: ["Gặp Ami, trợ lý robot AI đồng hành", "Meet Ami, your AI robot companion"],
    summary: [
      "Trợ lý học thuật có thêm Ami, nhân vật robot 3D thân thiện đi cùng bạn từ trang chủ đến từng bước học thuật.",
      "AI Academic Agent gains Ami, a friendly 3D robot character who guides you from the home page through every step.",
    ],
    sections: {
      Added: [
        ["Ami: robot trợ lý 3D vẽ bằng mã (three.js, tải lười), có 9 cảm xúc (nghỉ, vẫy chào, đọc, suy nghĩ, vui, ăn mừng, quan tâm, cảnh báo, ngủ), mắt nhìn theo con trỏ, bong bóng thoại song ngữ Việt/Anh.",
         "Ami: a procedurally drawn 3D assistant robot (three.js, lazy-loaded) with 9 emotions (idle, wave, read, think, happy, celebrate, care, alert, sleep), eyes that follow the pointer and bilingual Vietnamese/English speech bubbles."],
        ["Ami đồng hành khắp hành trình: chào ở trang đăng nhập, nhắc từng bước, đọc tài liệu cùng bạn, \"suy nghĩ\" khi phân tích, phản ứng theo điểm phù hợp (từ 80: ăn mừng, từ 60: vui, dưới 60: quan tâm) và báo lỗi nhẹ nhàng. Ở các trang sau đăng nhập, Ami nhỏ gọn ở góc dưới, có nút ẩn/hiện.",
         "Ami accompanies the whole journey: greets you on the sign-in page, prompts each step, reads your document with you, \"thinks\" during analysis, reacts to the fit score (80+: celebrate, 60+: happy, below 60: care) and reports errors gently. After sign-in a compact Ami sits in the corner with a hide/show button."],
        ["Khối \"Hệ sinh thái ISA\" ở chân trang (EduFind, Trợ lý học thuật, Trợ lý văn thư) với liên kết có UTM để đo lượt chuyển.",
         "An \"ISA ecosystem\" block in the footer (EduFind, AI Academic Agent, Document Assistant) with UTM-tagged links to measure referrals."],
        ["Bộ truyền thông mới lấy Ami làm nhân vật chính: ảnh xem trước khi chia sẻ, poster 3:4, 9 ảnh vuông 1:1 và clip 30 giây khổ dọc (tiếng Anh, tiếng Việt).",
         "A new marketing kit starring Ami: share-preview image, 3:4 poster, nine 1:1 social images and a 30-second vertical video (English and Vietnamese)."],
        ["Ghi chú phát hành song ngữ trên web (/ghi-chu-phat-hanh, /en/release-notes), thông báo \"Có gì mới\" trong ứng dụng, số phiên bản ở chân trang, CHANGELOG.md và quy trình phát hành tự động (đẩy thẻ phiên bản hoặc chạy workflow Release).",
         "Bilingual release notes on the web (/ghi-chu-phat-hanh, /en/release-notes), an in-app \"What's new\" notice, the version number in the footer, CHANGELOG.md and automated releases (push a version tag or run the Release workflow)."],
      ],
      Changed: [
        ["Ảnh xem trước khi chia sẻ (og.png) được thiết kế lại với Ami.",
         "The share-preview image (og.png) was redesigned around Ami."],
        ["Tên hiển thị trong hệ sinh thái: \"Trợ lý văn thư Mây\" (vi), \"Mary, Document Assistant\" (en); bước hiện tại ghi \"Bạn đang ở đây cùng Ami\".",
         "Ecosystem display names: \"Trợ lý văn thư Mây\" (vi), \"Mary, Document Assistant\" (en); the current step reads \"You are here with Ami\"."],
        ["Phần 3D chỉ tải riêng khoảng 142 KB (nén) khi trình duyệt rảnh; thiết bị không có WebGL, bật tiết kiệm dữ liệu hoặc RAM thấp dùng bản SVG nhẹ; tạm dừng khi tab ẩn hoặc robot ngoài màn hình; tự giảm chất lượng khi máy chậm; tôn trọng chế độ giảm chuyển động. Lighthouse trang chủ: hiệu năng 96, trợ năng 100, SEO 100, CLS 0.",
         "The 3D part loads separately (about 142 KB gzipped) when the browser is idle; devices without WebGL, with data-saver or low memory get a light SVG robot; rendering pauses when the tab is hidden or the robot is off-screen; quality drops automatically on slow devices; reduced-motion is respected. Home-page Lighthouse: performance 96, accessibility 100, SEO 100, CLS 0."],
      ],
      Fixed: [
        ["Vòng lặp vẽ robot không còn nhận khoảng thời gian âm (khi đồng hồ trình duyệt nhảy lùi), tránh trường hợp đầu robot xoay loạn.",
         "The robot render loop no longer accepts a negative frame time (when the browser clock jumps backwards), which could make the robot's head spin wildly."],
      ],
    },
    notes: [
      "Ami thêm thư viện three.js (MIT); xem THIRD_PARTY_NOTICES.md.",
      "Ami added the three.js library (MIT); see THIRD_PARTY_NOTICES.md.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-02",
    title: ["Phát hành đầu tiên", "First release"],
    summary: [
      "Ứng dụng web song ngữ giúp đọc tài liệu, chấm mức độ phù hợp 0–100, chọn đoạn đáng trích và sao chép trích dẫn chuẩn quốc tế.",
      "A bilingual web app that reads sources, scores their fit 0–100, picks citable passages and copies internationally standard citations.",
    ],
    sections: {
      Added: [
        ["Đăng ký, xác thực email (Supabase Auth); 1 lượt phân tích miễn phí mỗi ngày; tệp tối đa 2 MB (15 MB với tài khoản đã được quản trị viên xác thực).",
         "Sign-up and email verification (Supabase Auth); 1 free analysis per day; files up to 2 MB (15 MB for accounts verified by an administrator)."],
        ["Phân tích bằng Claude: điểm 0–100 theo 5 tiêu chí, tóm tắt, đoạn trích xếp hạng có số trang và được đối chiếu nguyên văn với tài liệu gốc; dưới 60 điểm gợi ý nguồn thay thế (OpenAlex) và tạp chí phù hợp từ EduFind.",
         "Analysis with Claude: a 0–100 score on 5 criteria, a summary, ranked passages with page numbers verified verbatim against the source; below 60 it suggests alternative sources (OpenAlex) and suitable journals from EduFind."],
        ["Đọc PDF, DOC, DOCX ngay trên máy người dùng; OCR (tiếng Việt và Anh) cho bản quét; tài liệu không bị lưu trữ.",
         "PDF, DOC and DOCX are read on the user's device; OCR (Vietnamese and English) for scans; documents are never stored."],
        ["Trích dẫn APA, Harvard, Chicago, MLA, IEEE, Vancouver, AMA, BibTeX, RIS và kho 10.865 kiểu CSL; ngôn ngữ trích dẫn Việt/Anh độc lập với giao diện; lịch sử gom theo đề tài.",
         "Citations in APA, Harvard, Chicago, MLA, IEEE, Vancouver, AMA, BibTeX and RIS plus a store of 10,865 CSL styles; citation language (Vietnamese/English) independent of the interface; history grouped by topic."],
        ["Hồ sơ nhà nghiên cứu (ORCID có kiểm tra chữ số kiểm tra), trang quản trị với thống kê chi phí API, đồng bộ Google Sheets bằng GitHub Actions, đếm lượt truy cập.",
         "Researcher profile (ORCID with check-digit validation), an admin area with API-cost statistics, Google Sheets sync through GitHub Actions and a visit counter."],
        ["SEO và truy cập: dữ liệu có cấu trúc, sitemap, trang hướng dẫn song ngữ (/huong-dan, /en/guide), llms.txt; tương phản màu đạt WCAG 2.2 AA; giao diện điện thoại ưu tiên nội dung chính; tên miền aaa.isavietnam.app.",
         "SEO and accessibility: structured data, sitemap, bilingual guides (/huong-dan, /en/guide), llms.txt; colour contrast meeting WCAG 2.2 AA; a phone layout that puts the main content first; the aaa.isavietnam.app domain."],
        ["Ảnh tác giả ở chân trang kèm hộp thoại giới thiệu; bộ truyền thông đầu tiên (poster, ảnh minh họa từng bước, bài đăng song ngữ).",
         "Author photo in the footer with an introduction dialog; the first marketing kit (poster, step-by-step images, bilingual post)."],
      ],
      Fixed: [
        ["Đọc được PDF trên Safari/iPhone (bổ sung ReadableStream async iterator cho pdf.js) và báo đúng nguyên nhân khi không đọc được tệp.",
         "PDFs now read on Safari/iPhone (added a ReadableStream async iterator for pdf.js) and the real cause is reported when a file cannot be read."],
        ["Hàm /api/analyze không còn sập khi khởi động trên Vercel; sửa nhãn phần trăm hồ sơ bị cắt trên iPhone.",
         "The /api/analyze function no longer crashes on start-up on Vercel; fixed the clipped profile-percentage label on iPhone."],
      ],
    },
    notes: [],
  },
];

export const SECTION_VI = { Added: "Thêm mới", Changed: "Thay đổi", Fixed: "Sửa lỗi", Removed: "Gỡ bỏ", Deprecated: "Sắp loại bỏ", Security: "Bảo mật" };
export const SECTION_ORDER = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"];
