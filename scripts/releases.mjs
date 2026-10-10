// Nguồn duy nhất cho lịch sử phát hành (Semantic Versioning, định dạng Keep a Changelog).
// Sửa ở đây rồi chạy `npm run release:notes` để sinh lại CHANGELOG.md và hai trang ghi chú phát hành.
// Mỗi mục là [tiếng Việt, tiếng Anh].
//
// NGUYÊN TẮC VIẾT GHI CHÚ PHÁT HÀNH (xem CLAUDE.md): chỉ nêu điều người dùng cuối nhìn thấy hoặc cảm nhận được
// (tính năng mới, thay đổi trải nghiệm, lỗi đã sửa mà người dùng từng gặp). Không đưa vào chi tiết kỹ thuật, thư viện,
// kiến trúc, hiệu năng đo đạc, hạ tầng, quy trình phát hành, tài liệu truyền thông hay việc nội bộ; không nhắc tới GitHub. Mỗi dòng ngắn, dễ hiểu.
export const REPO = "https://github.com/lvhoang90/tro-ly-hoc-thuat";
export const SITE = "https://aaa.isavietnam.app";

export const RELEASES = [
  {
    version: "1.5.0",
    date: "2026-10-10",
    title: ["Giao diện mới, hướng dẫn có hình, Giáo sư phản biện nổi bật", "A fresh look, an illustrated guide, and a more visible AI Professor"],
    summary: [
      "Ami có giao diện nhẹ nhàng, hiện đại và cùng phong cách với EduFind, ProFind; trang hướng dẫn trình bày từng bước kèm ảnh chụp từ ứng dụng.",
      "Ami has a lighter, more modern look in the same style as EduFind and ProFind, and the guide now walks through every step with screenshots from the app.",
    ],
    sections: {
      Added: [
        ["Trang hướng dẫn mới trình bày chi tiết từng bước, có ảnh minh họa và khung màu đánh dấu chỗ cần bấm, bằng tiếng Việt và tiếng Anh.",
         "A new guide explains every step in detail, with screenshots and coloured frames marking what to press, in Vietnamese and English."],
        ["Phần riêng hướng dẫn Giáo sư phản biện: từ gửi đề nghị, được duyệt, tải công trình đến đọc điểm và tải bản nháp Word.",
         "A dedicated section on the AI Professor: from sending a request and getting approved to uploading a work, reading the score and downloading the Word draft."],
      ],
      Changed: [
        ["Giao diện mới: nền sáng nhẹ, thanh menu xanh navy, chữ rõ hơn, đồng bộ với các ứng dụng khác của hệ sinh thái ISA.",
         "A new look: a light background, a navy menu bar and clearer type, matching the other apps of the ISA ecosystem."],
        ["Giáo sư phản biện (giả lập hội đồng) nổi bật hơn: có phần giới thiệu trên trang chủ, mục riêng có dấu sao trên thanh menu và biểu ngữ ở trang Phân tích.",
         "The AI Professor (simulated committee) is easier to find: an introduction on the home page, a starred menu item and a banner on the Analyse page."],
        ["Tên ứng dụng thống nhất là \"Ami - Trợ lý học thuật | AI Academic Agent\"; số phiên bản chỉ ghi một kiểu ở mọi nơi.",
         "The app name is now \"Ami - Trợ lý học thuật | AI Academic Agent\" everywhere, and the version number is written the same way in every place."],
        ["Ảnh xem trước khi chia sẻ liên kết được thiết kế lại.",
         "The preview image shown when the link is shared has been redesigned."],
        ["Bé Ami được chỉnh lại cho chỉn chu hơn: hai tay gắn liền vào thân thay vì rời ra.",
         "Ami has been tidied up: both arms are now attached to the body instead of floating away from it."],
        ["Nhãn kết quả của Giáo sư phản biện (loại văn bản, khuyến nghị, thang điểm, bản Word) hiển thị đúng tiếng Anh khi bạn dùng giao diện tiếng Anh.",
         "AI Professor result labels (document type, recommendation, scoring scale, Word file) now show in English when you use the English interface."],
      ],
    },
    notes: [],
  },
  {
    version: "1.4.0",
    date: "2026-10-10",
    title: ["Giáo sư phản biện ngay trong Ami", "The AI Professor, right inside Ami"],
    summary: [
      "Giáo sư phản biện là tính năng cao cấp: tải một đề cương, luận văn, luận án hoặc bài báo, Ami soạn bản nháp phản biện theo mẫu của trường hoặc viện, kèm điểm đề xuất và bằng chứng trích nguyên văn.",
      "The AI Professor is a premium feature: upload a proposal, thesis, dissertation or article and Ami drafts a review following your institution's template, with a proposed score and verbatim evidence.",
    ],
    sections: {
      Added: [
        ["Mục Giáo sư phản biện mới: nhận xét từng mục theo khung mẫu, điểm đề xuất thang 100, khuyến nghị thông qua hoặc chỉnh sửa, câu hỏi dành cho tác giả.",
         "A new AI Professor page: section-by-section comments following the template, a proposed score out of 100, an accept or revise recommendation, and questions for the author."],
        ["Dành cho nhà khoa học đã xác thực và được phê duyệt: bạn gửi đề nghị kèm lý do và minh chứng khoa học, quản trị viên duyệt rồi cấp số lượt dùng mỗi tuần.",
         "For verified researchers who are approved: send a request with your reason and scientific evidence, and the administrator reviews it and grants a weekly quota."],
        ["Dùng mẫu có sẵn theo loại văn bản, hoặc tải mẫu nhận xét của trường/viện để Ami làm theo đúng từng mục.",
         "Use a built-in template for the document type, or upload your institution's review template so Ami follows it section by section."],
        ["Mỗi nhận xét kèm đoạn trích nguyên văn đã được đối chiếu với bản gốc; đoạn nào không khớp sẽ bị loại.",
         "Every comment comes with a verbatim quote checked against the original; quotes that do not match are removed."],
        ["Tải bản nháp về Word (.docx) để chỉnh sửa và hoàn thiện. Kết quả chỉ lưu trên trình duyệt của bạn và xóa được bất cứ lúc nào.",
         "Download the draft as Word (.docx) to edit and finish. Results are kept only in your browser and can be deleted at any time."],
      ],
      Changed: [
        ["Đây là bản nháp hỗ trợ: Ami không kiểm tra trùng lặp và không xác minh tài liệu tham khảo; người phản biện chịu trách nhiệm về nội dung cuối cùng.",
         "This is a drafting aid: Ami does not check plagiarism or verify references; the reviewer remains responsible for the final text."],
      ],
    },
    notes: [],
  },
  {
    version: "1.3.0",
    date: "2026-10-10",
    title: ["Biết ngay tác giả là ai, nối liền hệ sinh thái ISA", "Know who wrote it, and a connected ISA ecosystem"],
    summary: [
      "Ami cho biết tác giả của tài liệu có hồ sơ nhà khoa học trên ProFind hay không, giúp bạn có hồ sơ của chính mình chỉ với vài bấm và mời đồng nghiệp cùng dùng.",
      "Ami now tells you whether a document's authors have a researcher profile on ProFind, helps you get your own profile in a few taps, and lets you invite colleagues.",
    ],
    sections: {
      Added: [
        ["Sau mỗi lần phân tích, Ami cho biết tác giả của tài liệu có hồ sơ trên ProFind hay không, kèm đơn vị, số công trình và số trích dẫn. Việc đối chiếu chạy ngay trên máy bạn, họ tên không bị gửi đi đâu.",
         "After each analysis, Ami tells you whether the document's authors have a profile on ProFind, with their affiliation, number of works and citations. The matching runs on your device, so the names are not sent anywhere."],
        ["Hồ sơ nhà khoa học của bạn trên ProFind: Ami gợi ý hồ sơ gần với bạn nhất; bấm \"Đúng là tôi\" để sang ProFind mà không phải nhập mã lại. Chỉ khi bạn bấm, thông tin mới được chuyển sang ProFind.",
         "Your researcher profile on ProFind: Ami suggests the closest profiles; press \"That is me\" to go to ProFind without entering a code again. Your details are sent to ProFind only when you press."],
        ["Trang Hồ sơ có thêm hành trình bốn bước trên hệ sinh thái ISA: EduFind, ProFind, Ami và Mây, cho thấy bạn đang ở đâu.",
         "The Profile page now shows a four-step journey across the ISA ecosystem (EduFind, ProFind, Ami and Mary) so you can see where you are."],
        ["Liên kết cá nhân để mời đồng nghiệp: khi họ đăng ký và phân tích xong lần đầu, bạn nhận thêm lượt phân tích.",
         "A personal link to invite colleagues: when they sign up and finish a first analysis, you receive extra analyses."],
      ],
      Changed: [
        ["Chân trang giới thiệu đủ bốn ứng dụng của hệ sinh thái ISA: EduFind, ProFind, Ami và Mây.",
         "The footer now introduces all four apps of the ISA ecosystem: EduFind, ProFind, Ami and Mary."],
        ["Trang Quyền riêng tư và hướng dẫn sử dụng được bổ sung cho các tính năng mới.",
         "The Privacy page and the user guide now cover the new features."],
      ],
    },
    notes: [],
  },
  {
    version: "1.2.0",
    date: "2026-10-04",
    title: ["Hạng tài khoản rõ ràng, hành trình liền mạch hơn", "Clearer account tiers and a smoother journey"],
    summary: [
      "Trợ lý học thuật có thêm trang Quyền riêng tư, tài khoản đã xác thực với hạn mức riêng và gợi ý bước tiếp theo sau khi bạn trích dẫn.",
      "AI Academic Agent now has a Privacy page, verified accounts with a personal allowance, and a suggested next step once you have cited.",
    ],
    sections: {
      Added: [
        ["Trang Quyền riêng tư bằng tiếng Việt và tiếng Anh: vẽ rõ tài liệu và ý tưởng của bạn đi đâu, điều gì được lưu và quyền của bạn; kèm một cam kết ngắn ngay ở bước tải tài liệu.",
         "A Privacy page in Vietnamese and English that shows where your documents and ideas go, what is stored and what your rights are, plus a short pledge right at the upload step."],
        ["Tài khoản đã xác thực: sau khi tác giả xác nhận bạn là nhà nghiên cứu, bạn có hạn mức riêng, xem lại toàn bộ lịch sử trích dẫn và gợi ý tài liệu chi tiết. Để được xác thực, gửi tác giả họ tên, đơn vị và ORCID.",
         "Verified accounts: once the author confirms you are a researcher, you get a personal allowance, your full citation history and the detailed source suggestions. To get verified, send the author your name, affiliation and ORCID."],
        ["Sau khi sao chép trích dẫn, ứng dụng gợi ý bước tiếp theo: chọn tạp chí trên EduFind hoặc chuẩn hóa thể thức bản thảo với Trợ lý văn thư.",
         "After you copy a citation, the app suggests what to do next: choose a journal on EduFind, or format your manuscript with the Document Assistant."],
        ["Lời chào khi tài khoản của bạn vừa được xác thực.",
         "A welcome message when your account has just been verified."],
      ],
      Changed: [
        ["Từ 10/10/2026, tài khoản Cơ bản có 1 lượt phân tích miễn phí mỗi tuần (trước đó mỗi ngày). Lịch sử trích dẫn và gợi ý tài liệu chi tiết dành cho tài khoản đã xác thực; dữ liệu bạn đã lưu không bị mất.",
         "From 10 October 2026, Basic accounts get 1 free analysis per week (it was per day). Citation history and the detailed source suggestions are for verified accounts; nothing you have saved is lost."],
        ["Số lượt còn lại hiển thị theo tuần, kèm ngày mở lượt mới.",
         "Remaining analyses are shown per week, with the date the next one opens."],
        ["Hướng dẫn sử dụng được cập nhật theo các thay đổi trên.",
         "The user guide has been updated to match."],
      ],
    },
    notes: [],
  },
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
