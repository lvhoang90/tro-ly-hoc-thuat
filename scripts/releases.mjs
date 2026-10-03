// Nguồn duy nhất cho lịch sử phát hành (Semantic Versioning, định dạng Keep a Changelog).
// Sửa ở đây rồi chạy `npm run release:notes` để sinh lại CHANGELOG.md và hai trang ghi chú phát hành.
// Mỗi mục là [tiếng Việt, tiếng Anh].
//
// NGUYÊN TẮC VIẾT GHI CHÚ PHÁT HÀNH (xem CLAUDE.md): chỉ nêu điều người dùng cuối nhìn thấy hoặc cảm nhận được
// (tính năng mới, thay đổi trải nghiệm, lỗi đã sửa mà người dùng từng gặp). Không đưa vào chi tiết kỹ thuật, thư viện,
// kiến trúc, hiệu năng đo đạc, hạ tầng, quy trình phát hành, tài liệu truyền thông hay việc nội bộ. Mỗi dòng ngắn, dễ hiểu.
export const REPO = "https://github.com/lvhoang90/tro-ly-hoc-thuat";
export const SITE = "https://aaa.isavietnam.app";

export const RELEASES = [
  {
    version: "1.1.0",
    date: "2026-10-03",
    title: ["Gặp Ami, trợ lý robot đồng hành", "Meet Ami, your robot companion"],
    summary: [
      "Trợ lý học thuật có thêm Ami, nhân vật robot thân thiện đi cùng bạn từ trang chủ đến từng bước đọc, chấm điểm và trích dẫn.",
      "AI Academic Agent now has Ami, a friendly robot who stays with you from the home page through every step of reading, scoring and citing.",
    ],
    sections: {
      Added: [
        ["Ami, trợ lý robot 3D thân thiện: biết vẫy chào, đọc tài liệu cùng bạn, suy nghĩ khi phân tích, vui mừng khi tài liệu phù hợp và quan tâm khi điểm thấp. Ami nói tiếng Việt hoặc tiếng Anh theo ngôn ngữ bạn chọn.",
         "Ami, a friendly 3D robot who waves hello, reads your document with you, thinks while analysing, cheers when a source fits and shows care when the score is low. Ami speaks Vietnamese or English, following your language choice."],
        ["Ami nhắc bạn từng bước, báo lỗi nhẹ nhàng và phản ứng theo điểm phù hợp. Sau khi đăng nhập, Ami thu nhỏ ở góc màn hình; bạn có thể ẩn hoặc hiện lại bất cứ lúc nào.",
         "Ami guides you step by step, explains problems gently and reacts to the fit score. After you sign in, Ami stays small in the corner of the screen, and you can hide or show Ami at any time."],
        ["Chân trang giới thiệu cả hệ sinh thái ISA: EduFind (chọn tạp chí), Trợ lý học thuật (đọc và trích dẫn) và Trợ lý văn thư (chuẩn hóa thể thức).",
         "The footer now introduces the whole ISA ecosystem: EduFind (choose a journal), AI Academic Agent (read and cite) and the Document Assistant (format documents)."],
        ["Thông báo \"Có gì mới\" khi có phiên bản mới, kèm trang ghi chú phát hành bằng tiếng Việt và tiếng Anh.",
         "A \"What's new\" notice when a new version arrives, with release notes in Vietnamese and English."],
      ],
      Changed: [
        ["Ảnh hiển thị khi bạn chia sẻ liên kết ứng dụng được làm mới, có Ami.",
         "The preview image shown when you share a link to the app has been refreshed and now features Ami."],
        ["Ami tải nhẹ, không làm chậm trang; tự chuyển sang bản đơn giản trên thiết bị yếu hoặc khi bạn bật chế độ giảm chuyển động.",
         "Ami loads lightly and does not slow the page down; on weaker devices, or when you turn on reduced motion, a simpler version is shown automatically."],
      ],
    },
    notes: [],
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
        ["Đăng ký bằng email; mỗi ngày có 1 lượt phân tích miễn phí. Tệp tối đa 2 MB, hoặc 15 MB với tài khoản đã được quản trị viên xác thực.",
         "Sign up with your email; every day you get 1 free analysis. Files up to 2 MB, or 15 MB for accounts verified by an administrator."],
        ["Tải tài liệu PDF, DOC, DOCX (kể cả bản quét) để nhận điểm phù hợp 0–100 theo 5 tiêu chí so với đề tài của bạn. Tài liệu được đọc ngay trên máy bạn và không bị lưu trữ.",
         "Upload a PDF, DOC or DOCX (scans included) and get a 0–100 fit score on 5 criteria against your topic. Documents are read on your device and are never stored."],
        ["Gợi ý các đoạn đáng trích, xếp theo mức ưu tiên, có số trang và được đối chiếu nguyên văn với tài liệu gốc. Điểm thấp thì gợi ý nguồn khác và tạp chí phù hợp từ EduFind.",
         "Suggested passages worth citing, ranked by priority, with page numbers and checked word for word against the source. For a low score, it suggests other sources and suitable journals from EduFind."],
        ["Sao chép trích dẫn APA, Harvard, Chicago, MLA, IEEE, Vancouver, AMA, BibTeX, RIS hoặc hơn 10.000 kiểu tạp chí, bằng tiếng Việt hoặc tiếng Anh; lịch sử trích dẫn gom theo đề tài.",
         "Copy citations in APA, Harvard, Chicago, MLA, IEEE, Vancouver, AMA, BibTeX, RIS or over 10,000 journal styles, in Vietnamese or English; your citation history is grouped by topic."],
        ["Giao diện song ngữ Việt/Anh, hồ sơ nhà nghiên cứu (ORCID), trang hướng dẫn sử dụng, màu sắc dễ đọc và giao diện điện thoại ưu tiên nội dung chính.",
         "A bilingual Vietnamese/English interface, a researcher profile (ORCID), a user guide, easy-to-read colours and a phone layout that puts the main content first."],
      ],
      Fixed: [
        ["Đọc được tệp PDF trên iPhone và Safari; khi không đọc được tệp, ứng dụng nói rõ nguyên nhân.",
         "PDF files now open on iPhone and Safari; when a file cannot be read, the app explains why."],
        ["Sửa nhãn phần trăm hoàn thiện hồ sơ bị cắt trên iPhone.",
         "Fixed the profile-completion percentage label being cut off on iPhone."],
      ],
    },
    notes: [],
  },
];

export const SECTION_VI = { Added: "Thêm mới", Changed: "Thay đổi", Fixed: "Sửa lỗi", Removed: "Gỡ bỏ", Deprecated: "Sắp loại bỏ", Security: "Bảo mật" };
export const SECTION_ORDER = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"];
