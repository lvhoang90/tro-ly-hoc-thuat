// Sinh hai trang hướng dẫn tĩnh (VI, EN) để công cụ tìm kiếm lập chỉ mục: public/huong-dan.html và public/en/guide.html.
// Chạy: node scripts/gen-guide.mjs. Nội dung bám đúng chức năng thật của ứng dụng; sửa ở đây rồi chạy lại.
import { writeFileSync } from "node:fs";

const SITE = "https://aaa.isavietnam.app";
const DATE = "2026-10-02";
const T = {
  vi: {
    lang: "vi", path: "/huong-dan", file: "public/huong-dan.html", other: "/en/guide", locale: "vi_VN",
    title: "Hướng dẫn Trợ lý học thuật: đọc, chấm điểm, trích dẫn APA",
    desc: "Hướng dẫn 8 bước dùng Trợ lý học thuật AI Academic Agent: nhập abstract, tải PDF/DOCX, nhận điểm phù hợp 0–100, chọn đoạn đáng trích và sao chép trích dẫn APA, Harvard, IEEE.",
    h1: "Hướng dẫn dùng Trợ lý học thuật",
    lead: "Từ một tài liệu đến trích dẫn đúng chuẩn trong 8 bước. Miễn phí để bắt đầu: 1 lượt phân tích mỗi tuần (từ 10/10/2026; trước đó 1 lượt mỗi ngày).",
    cta: "Dùng thử miễn phí", home: "Trang chủ", langLabel: "English", stepsH: "8 bước sử dụng", faqH: "Câu hỏi thường gặp", ecoH: "Hệ sinh thái ISA Vietnam",
    howName: "Cách dùng Trợ lý học thuật để đánh giá tài liệu và tạo trích dẫn",
    steps: [
      ["Đăng ký tài khoản", "Tạo tài khoản bằng email và xác nhận qua thư. Tài khoản Cơ bản có 1 lượt phân tích miễn phí mỗi tuần (từ 10/10/2026)."],
      ["Dán tóm tắt đề tài", "Nhập Abstract hoặc đề cương nghiên cứu. Đây là thước đo để hệ thống chấm mọi tài liệu."],
      ["Tải tài liệu lên", "Chọn tệp PDF, DOC hoặc DOCX (tối đa 2 MB với tài khoản chưa xác thực, 15 MB với tài khoản đã được quản trị viên xác thực). Bản scan được đọc bằng OCR."],
      ["Xem điểm phù hợp", "Nhận điểm từ 0 đến 100 theo năm tiêu chí (chủ đề, khái niệm, phương pháp, bằng chứng, tính cập nhật), kèm tóm tắt và nhận xét."],
      ["Chọn đoạn đáng trích", "Từ 60 điểm trở lên, hệ thống gợi ý các đoạn nên trích, xếp theo mức ưu tiên, có số trang và được đối chiếu nguyên văn với tài liệu."],
      ["Sao chép trích dẫn", "Chọn APA, Harvard, Chicago, MLA, IEEE, Vancouver, AMA, BibTeX, RIS hoặc hơn 10.000 kiểu tạp chí (CSL), rồi sao chép danh mục tài liệu tham khảo và trích dẫn trong bài."],
      ["Xem lịch sử theo đề tài", "Các trích dẫn đã sao chép được gom theo đề tài; đổi kiểu và ngôn ngữ trích dẫn ngay tại từng nguồn."],
      ["Điểm thấp thì chọn hướng đi", "Dưới 60 điểm, hệ thống gợi ý tìm nguồn khác, chỉnh abstract và tạp chí phù hợp từ EduFind; bạn là người quyết định bước tiếp theo."],
    ],
    faq: [
      ["Trợ lý học thuật là gì?", "Trợ lý học thuật (AI Academic Agent) là ứng dụng web song ngữ Việt/Anh giúp nhà nghiên cứu đọc tài liệu, đánh giá mức độ phù hợp với đề tài, tìm đoạn đáng trích dẫn và tạo trích dẫn theo chuẩn quốc tế."],
      ["Dùng có mất phí không?", "Tài khoản Cơ bản được dùng miễn phí 1 lượt phân tích mỗi tuần (từ 10/10/2026; trước đó mỗi ngày). Cần dùng nhiều hơn, bạn có thể xin xác thực tài khoản, xem câu hỏi bên dưới."],
      ["Tài khoản đã xác thực là gì?", "Là tài khoản đã được tác giả xác nhận là nhà nghiên cứu (họ tên, đơn vị, ORCID). Tài khoản đã xác thực có hạn mức riêng do hai bên thống nhất, xem lại được toàn bộ lịch sử trích dẫn và gợi ý tài liệu chi tiết, và tải được tệp tối đa 15 MB. Để xác thực, liên hệ tác giả qua email, điện thoại hoặc Zalo ghi ở chân trang. Dữ liệu bạn đã lưu không bị mất khi chưa xác thực."],
      ["Tác giả trên ProFind là gì?", "Sau khi phân tích, Ami đối chiếu họ tên tác giả của tài liệu với ProFind, ứng dụng tra cứu nhà nghiên cứu gắn với trường, viện Việt Nam trong hệ sinh thái ISA. Việc đối chiếu chạy ngay trên máy bạn nên họ tên không bị gửi đi đâu. Vì khớp theo tên, kết quả chỉ là gợi ý: hãy xem đơn vị và công trình trước khi kết luận cùng một người. Tác giả nước ngoài thường không có trong ProFind."],
      ["Hồ sơ ProFind của tôi và liên kết mời đồng nghiệp ở đâu?", "Ở trang Hồ sơ: Ami gợi ý hồ sơ ProFind gần với họ tên, email và đơn vị của bạn; bấm \"Đúng là tôi\" để sang ProFind mà không phải nhập mã lại (chỉ khi bạn bấm, Ami mới chuyển email, họ tên, số điện thoại, công việc và đơn vị sang ProFind). Cũng ở đó có liên kết cá nhân để mời đồng nghiệp: khi người được mời đăng ký và phân tích xong lần đầu, bạn nhận thêm lượt theo mức quản trị viên đặt."],
      ["Tài liệu của tôi có bị lưu lại không?", "Hệ thống không lưu tệp và toàn văn tài liệu. Tệp được đọc ngay trên máy bạn; chỉ phần văn bản được gửi qua máy chủ tới Claude (Anthropic) để phân tích và không được lưu lại. Hệ thống chỉ lưu trích dẫn bạn đã sao chép và đề tài bạn chủ động lưu. Chi tiết ở trang Quyền riêng tư."],
      ["Chấp nhận định dạng và dung lượng nào?", "PDF, DOC và DOCX. Tối đa 2 MB với tài khoản chưa xác thực, hoặc 15 MB với tài khoản đã được quản trị viên xác thực. Bản scan được đọc bằng OCR."],
      ["Điểm phù hợp được tính như thế nào?", "Thang 100 điểm theo năm tiêu chí: chủ đề (40), khái niệm và lý thuyết (20), phương pháp (15), bằng chứng (15), tính cập nhật (10). Từ 60 điểm trở lên là đạt ngưỡng trích dẫn."],
      ["Có nguy cơ trích dẫn bịa không?", "Mọi đoạn trích đề xuất đều được đối chiếu nguyên văn với văn bản gốc, đoạn nào không khớp sẽ bị loại. Bạn vẫn nên đọc lại nguồn trước khi dùng."],
      ["Hỗ trợ những kiểu trích dẫn nào?", "APA 7, Harvard, Chicago 17, MLA 9, IEEE, Vancouver, AMA 11, BibTeX, RIS và hơn 10.000 kiểu tạp chí, trường đại học theo chuẩn CSL, bằng tiếng Việt hoặc tiếng Anh."],
      ["Điểm dưới 60 thì sao?", "Hệ thống không đề xuất đoạn trích. Thay vào đó, ứng dụng gợi ý hướng tìm nguồn thay thế và các tạp chí phù hợp lĩnh vực từ EduFind."],
      ["Giáo sư phản biện là gì?", "Tính năng cao cấp, chỉ dành cho nhà khoa học đã xác thực và được quản trị viên phê duyệt (gửi đề nghị kèm lý do và minh chứng khoa học trong mục Giáo sư phản biện). Khi được duyệt: tải một đề cương, luận văn, luận án hoặc bài báo (DOCX hoặc PDF có chữ) và một mẫu nhận xét của trường/viện (hoặc dùng mẫu có sẵn). Ami soạn bản nháp nhận xét từng mục, đề xuất điểm thang 100 do máy cộng, khuyến nghị thông qua hoặc chỉnh sửa, câu hỏi cho tác giả; mọi trích dẫn minh chứng được đối chiếu nguyên văn với bản gốc. Kết quả xuất ra Word. Đây chỉ là bản nháp hỗ trợ: Ami không kiểm tra trùng lặp và không xác minh tài liệu tham khảo; người phản biện chịu trách nhiệm về nội dung cuối cùng."],
    ],
    eco: [["EduFind", "https://isavn.edu.vn/go/edufind?from=ami", "Tra cứu tạp chí khoa học được Hội đồng Giáo sư nhà nước tính điểm (28 ngành)."], ["Trợ lý văn thư", "https://isavn.edu.vn/go/may?from=ami", "Chuẩn hóa chính tả, ngữ pháp và thể thức văn bản hành chính theo Nghị định 30/2020/NĐ-CP."]],
    foot: "© 2026 Lương Việt Hoàng (ISA Vietnam). Bản quyền đóng.",
  },
  en: {
    lang: "en", path: "/en/guide", file: "public/en/guide.html", other: "/huong-dan", locale: "en_US",
    title: "AI Academic Agent guide: read, score and cite in APA",
    desc: "An 8-step guide to AI Academic Agent: paste your abstract, upload a PDF or DOCX, get a 0–100 fit score, pick citable passages and copy APA, Harvard or IEEE citations.",
    h1: "How to use AI Academic Agent",
    lead: "From a source document to a correctly formatted citation in 8 steps. Free to start: 1 analysis per week (from 10/10/2026; 1 per day before).",
    cta: "Try it free", home: "Home", langLabel: "Tiếng Việt", stepsH: "8 steps", faqH: "Frequently asked questions", ecoH: "ISA Vietnam ecosystem",
    howName: "How to use AI Academic Agent to assess a source and create citations",
    steps: [
      ["Create an account", "Sign up with your email and confirm it. A Basic account gets 1 free analysis per week (from 10/10/2026)."],
      ["Paste your abstract", "Enter your abstract or research proposal. It is the yardstick every source is scored against."],
      ["Upload a document", "Choose a PDF, DOC or DOCX file (up to 2 MB for unverified accounts, or 15 MB for accounts verified by an administrator). Scans are read with OCR."],
      ["Read the fit score", "Get a score from 0 to 100 on five criteria (topic, concepts, method, evidence, currency), with a summary and comments."],
      ["Pick passages worth citing", "At 60 or above, the tool suggests passages to quote, ranked by priority, with page numbers, each checked verbatim against the source."],
      ["Copy the citation", "Choose APA, Harvard, Chicago, MLA, IEEE, Vancouver, AMA, BibTeX, RIS or over 10,000 journal styles (CSL), then copy the reference and the in-text citation."],
      ["Review history by topic", "Copied citations are grouped by topic; switch the style and language right on each source."],
      ["Low score? Choose a path", "Below 60, the tool suggests other sources, a sharper abstract and suitable journals from EduFind. You decide the next step."],
    ],
    faq: [
      ["What is AI Academic Agent?", "AI Academic Agent is a bilingual Vietnamese/English web app that helps researchers read sources, judge how well they fit a study, find passages worth citing and create citations to international standards."],
      ["Is it free?", "A Basic account gets 1 free analysis per week (from 10/10/2026; 1 per day before). If you need more, you can ask to have your account verified, see the next question."],
      ["What is a verified account?", "An account the author has confirmed belongs to a researcher (name, affiliation, ORCID). Verified accounts get a personal allowance agreed between both sides, can review their full citation history and the detailed source suggestions, and can upload files up to 15 MB. To get verified, contact the author by email, phone or Zalo listed in the footer. Nothing you saved is lost while you are unverified."],
      ["What are the authors on ProFind?", "After an analysis, Ami matches the document's author names with ProFind, the ISA ecosystem's lookup of researchers tied to Vietnamese universities and institutes. The matching runs on your device, so the names are not sent anywhere. Because it matches by name, the result is only a hint: check the affiliation and works before concluding it is the same person. Foreign authors are usually not in ProFind."],
      ["Where are my ProFind profile and the invitation link?", "On the Profile page: Ami suggests ProFind profiles close to your name, email and affiliation; press \"That is me\" to go to ProFind without entering a code again (only when you press does Ami send your email, name, phone, job and affiliation to ProFind). The same page has your personal link to invite colleagues: when an invited person signs up and finishes a first analysis, you receive extra analyses at the level the administrator sets."],
      ["Are my documents stored?", "The system does not store files or the full text of documents. Files are read on your device; only the extracted text goes through our server to Claude (Anthropic) for analysis and is not stored. The system keeps only the citations you copied and the topics you chose to save. See the Privacy page for details."],
      ["Which formats and sizes are accepted?", "PDF, DOC and DOCX, up to 2 MB for unverified accounts, or 15 MB for accounts verified by an administrator. Scans are read with OCR."],
      ["How is the fit score calculated?", "A 100-point scale over five criteria: topic (40), concepts and theory (20), method (15), evidence (15) and currency (10). A score of 60 or more passes the citation threshold."],
      ["Can it invent quotes?", "Every suggested passage is checked verbatim against the source text, and any that does not match is dropped. You should still read the source before relying on it."],
      ["Which citation styles are supported?", "APA 7, Harvard, Chicago 17, MLA 9, IEEE, Vancouver, AMA 11, BibTeX, RIS and over 10,000 CSL journal and university styles, in Vietnamese or English."],
      ["What happens below 60?", "No passages are suggested. Instead the app points you to alternative sources and suitable journals for your field from EduFind."],
      ["What is the AI Professor?", "A premium feature for verified researchers approved by the administrator (send a request with your reason and scientific evidence on the AI Professor page). Once approved: upload a proposal, thesis, dissertation or article (DOCX or text PDF) and your institution's review template (or use a built-in one). Ami drafts section-by-section comments, a proposed score out of 100 summed by code, an accept/revise recommendation and questions for the author; every evidence quote is checked verbatim against the original. Results export to Word. It is only a drafting aid: Ami does not check plagiarism or verify references; the reviewer is responsible for the final text."],
    ],
    eco: [["EduFind", "https://isavn.edu.vn/go/edufind?from=ami", "Look up journals scored by the Vietnamese State Professorship Council (28 disciplines)."], ["Records Assistant", "https://isavn.edu.vn/go/may?from=ami", "Spelling, grammar and format checks for Vietnamese administrative documents under Decree 30/2020/ND-CP."]],
    foot: "© 2026 Luong Viet Hoang (ISA Vietnam). All rights reserved.",
  },
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

for (const t of Object.values(T)) {
  const o = T[t.lang === "vi" ? "en" : "vi"];
  const url = SITE + t.path, ourl = SITE + o.path;
  const ld = [
    { "@context": "https://schema.org", "@type": "HowTo", name: t.howName, inLanguage: t.lang, step: t.steps.map(([n, d], i) => ({ "@type": "HowToStep", position: i + 1, name: n, text: d })) },
    { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: t.lang, mainEntity: t.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: t.home, item: SITE + "/" }, { "@type": "ListItem", position: 2, name: t.h1, item: url }] },
  ];
  const html = `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="${t.lang}" href="${url}">
<link rel="alternate" hreflang="${o.lang}" href="${ourl}">
<link rel="alternate" hreflang="x-default" href="${SITE}${T.vi.path}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#0a0f1e">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Trợ lý học thuật | AI Academic Agent 1.0">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:locale" content="${t.locale}">
<meta property="og:locale:alternate" content="${o.locale}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
:root{--bg:#0a0f1e;--card:#121a34;--line:#2a3763;--text:#e6ecf8;--muted:#9aa8c4;--accent:#38bdf8;--on:#04101f}
@media (prefers-color-scheme:light){:root{--bg:#f4f7fc;--card:#fff;--line:#d3dbea;--text:#0f172a;--muted:#4b5870;--accent:#03629a;--on:#fff}}
*{box-sizing:border-box}body{margin:0;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--text)}
a{color:var(--accent)}header,main,footer{max-width:820px;margin:0 auto;padding:0 16px}
header{display:flex;justify-content:space-between;align-items:center;padding-top:18px;padding-bottom:6px;font-size:.92rem;flex-wrap:wrap;gap:.5rem}
h1{font-size:clamp(1.7rem,5vw,2.4rem);line-height:1.2;margin:.8rem 0 .4rem}h2{font-size:1.35rem;margin:2rem 0 .8rem}
.lead{color:var(--muted);font-size:1.08rem;margin:0 0 1.2rem}.btn{display:inline-block;background:var(--accent);color:var(--on);font-weight:700;padding:.7rem 1.3rem;border-radius:12px;text-decoration:none}
ol.steps{list-style:none;counter-reset:s;padding:0;margin:0;display:grid;gap:.7rem}ol.steps li{counter-increment:s;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:.9rem 1rem .9rem 3.4rem;position:relative}
ol.steps li::before{content:counter(s);position:absolute;left:1rem;top:.9rem;width:1.8rem;height:1.8rem;border-radius:50%;background:var(--accent);color:var(--on);font-weight:800;display:grid;place-items:center}
ol.steps b{display:block}ol.steps span{color:var(--muted)}details{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.7rem 1rem;margin:.5rem 0}summary{cursor:pointer;font-weight:600}details p{margin:.5rem 0 0;color:var(--muted)}
footer{padding-top:2rem;padding-bottom:2rem;color:var(--muted);font-size:.88rem}ul.eco{padding-left:1.1rem}
</style>
</head>
<body>
<header><a href="/">${esc(t.home)}</a><a href="${o.path}" hreflang="${o.lang}" lang="${o.lang}">${esc(t.langLabel)}</a></header>
<main>
<h1>${esc(t.h1)}</h1>
<p class="lead">${esc(t.lead)}</p>
<p><a class="btn" href="/">${esc(t.cta)}</a></p>
<h2>${esc(t.stepsH)}</h2>
<ol class="steps">
${t.steps.map(([n, d]) => `<li><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join("\n")}
</ol>
<h2>${esc(t.faqH)}</h2>
${t.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n")}
<h2>${esc(t.ecoH)}</h2>
<ul class="eco">
${t.eco.map(([n, h, d]) => `<li><a href="${h}">${esc(n)}</a>: ${esc(d)}</li>`).join("\n")}
</ul>
</main>
<footer>${esc(t.foot)}</footer>
</body>
</html>
`;
  writeFileSync(t.file, html);
}
console.log("ok");
