// Sinh hai trang hướng dẫn tĩnh (VI, EN) để công cụ tìm kiếm lập chỉ mục: public/huong-dan.html và public/en/guide.html.
// Chạy: node scripts/gen-guide.mjs. Nội dung bám đúng chức năng thật của ứng dụng; sửa ở đây rồi chạy lại.
import { readFileSync, writeFileSync } from "node:fs";
import { CONTENT } from "./guide-content.mjs";

const SITE = "https://aaa.isavietnam.app";
const DATE = "2026-10-10";
const T = {
  vi: {
    lang: "vi", path: "/huong-dan", file: "public/huong-dan.html", other: "/en/guide", locale: "vi_VN",
    title: "Hướng dẫn Trợ lý học thuật: đọc, chấm điểm, trích dẫn APA",
    desc: "Hướng dẫn 8 bước dùng Trợ lý học thuật AI Academic Agent: nhập abstract, tải PDF/DOCX, nhận điểm phù hợp 0–100, chọn đoạn đáng trích và sao chép trích dẫn APA, Harvard, IEEE.",
    h1: "Hướng dẫn dùng Trợ lý học thuật",
    lead: "Từ một tài liệu đến trích dẫn đúng chuẩn trong 8 bước. Miễn phí để bắt đầu: 1 lượt phân tích mỗi tuần.",
    cta: "Dùng thử miễn phí", home: "Trang chủ", langLabel: "English", stepsH: "8 bước sử dụng", faqH: "Câu hỏi thường gặp", ecoH: "Hệ sinh thái ISA Vietnam",
    howName: "Cách dùng Trợ lý học thuật để đánh giá tài liệu và tạo trích dẫn",
    steps: [
      ["Đăng ký tài khoản", "Tạo tài khoản bằng email và xác nhận qua thư. Tài khoản Cơ bản có 1 lượt phân tích miễn phí mỗi tuần."],
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
      ["Dùng có mất phí không?", "Tài khoản Cơ bản được dùng miễn phí 1 lượt phân tích mỗi tuần. Cần dùng nhiều hơn, bạn có thể xin xác thực tài khoản, xem câu hỏi bên dưới."],
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
    foot: "© 2026 Lương Việt Hoàng (ISA Vietnam). Bản quyền đóng.", proCta: "Mở Giáo sư phản biện",
  },
  en: {
    lang: "en", path: "/en/guide", file: "public/en/guide.html", other: "/huong-dan", locale: "en_US",
    title: "AI Academic Agent guide: read, score and cite in APA",
    desc: "An 8-step guide to AI Academic Agent: paste your abstract, upload a PDF or DOCX, get a 0–100 fit score, pick citable passages and copy APA, Harvard or IEEE citations.",
    h1: "How to use AI Academic Agent",
    lead: "From a source document to a correctly formatted citation in 8 steps. Free to start: 1 analysis per week.",
    cta: "Try it free", home: "Home", langLabel: "Tiếng Việt", stepsH: "8 steps", faqH: "Frequently asked questions", ecoH: "ISA Vietnam ecosystem",
    howName: "How to use AI Academic Agent to assess a source and create citations",
    steps: [
      ["Create an account", "Sign up with your email and confirm it. A Basic account gets 1 free analysis per week."],
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
      ["Is it free?", "A Basic account gets 1 free analysis per week. If you need more, you can ask to have your account verified, see the next question."],
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
    foot: "© 2026 Luong Viet Hoang (ISA Vietnam). All rights reserved.", proCta: "Open the AI Professor",
  },
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MAN = JSON.parse(readFileSync(new URL("../public/guide/manifest.json", import.meta.url), "utf8"));
for (const l of ["vi", "en"]) Object.assign(T[l], CONTENT[l]);

const fig = (lang, key, alt, n, label) => {
  const dim = MAN[`${lang}/${key}`];
  if (!dim) throw new Error(`thiếu ảnh ${lang}/${key}: chạy lại bộ chụp ảnh hướng dẫn`);
  return `<figure id="h${n}"><img src="/guide/${lang}/${key}.webp" width="${dim[0]}" height="${dim[1]}" alt="${esc(alt)}" loading="lazy" decoding="async"><figcaption>${esc(label)} ${n}. ${esc(alt)}</figcaption></figure>`;
};

for (const t of Object.values(T)) {
  const o = T[t.lang === "vi" ? "en" : "vi"];
  const url = SITE + t.path, ourl = SITE + o.path;
  let n = 0;
  const ld = [
    { "@context": "https://schema.org", "@type": "HowTo", name: t.howName, inLanguage: t.lang, image: `${SITE}/og.png`, step: t.steps.map((st, i) => ({ "@type": "HowToStep", position: i + 1, name: st[0], text: st[1], url: `${url}#h${i + 1}`, image: `${SITE}/guide/${t.lang}/${st[3]}.webp` })) },
    { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: t.lang, mainEntity: t.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: t.home, item: SITE + "/" }, { "@type": "ListItem", position: 2, name: t.h1, item: url }] },
  ];
  const stepHtml = t.steps.map(([name, short, more, img, alt]) => `<li><b>${esc(name)}</b><span class="short">${esc(short)}</span>
<ul class="more">${more.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
${fig(t.lang, img, alt, ++n, t.figure)}</li>`).join("\n");
  const proHtml = t.proSteps.map(([name, d, img, alt]) => `<li class="ps"><strong>${esc(name)}</strong><span class="short">${esc(d)}</span>
${fig(t.lang, img, alt, ++n, t.figure)}</li>`).join("\n");
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
<meta name="theme-color" content="#0b2a40">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<meta property="og:type" content="article">
<meta property="og:site_name" content="Ami - Trợ lý học thuật | AI Academic Agent">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.title)}">
<meta property="og:locale" content="${t.locale}">
<meta property="og:locale:alternate" content="${o.locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(t.title)}">
<meta name="twitter:description" content="${esc(t.desc)}">
<meta name="twitter:image" content="${SITE}/og.png">
<meta name="author" content="Lương Việt Hoàng">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
@font-face{font-family:Inter;font-weight:400 700;font-display:swap;src:url(/fonts/inter-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122}
@font-face{font-family:Inter;font-weight:400 700;font-display:swap;src:url(/fonts/inter-vietnamese.woff2) format("woff2");unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+031B,U+1EA0-1EF9,U+20AB}
@font-face{font-family:"Space Grotesk";font-weight:400 700;font-display:swap;src:url(/fonts/space-grotesk-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122}
@font-face{font-family:"Space Grotesk";font-weight:400 700;font-display:swap;src:url(/fonts/space-grotesk-vietnamese.woff2) format("woff2");unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+031B,U+1EA0-1EF9,U+20AB}
:root{--bg:#141a28;--card:#242c3d;--line:#3a465d;--text:#f1f4fa;--muted:#b4bfd3;--accent:#7cc0ee;--on:#0d1218;--navy:#0b2a40;--pg-bg:#4d4222;--pg-ink:#ffe08a;--pg-line:#7a6a2c;--display:"Space Grotesk",Inter,system-ui,sans-serif}
@media (prefers-color-scheme:light){:root{--bg:#f4f6f8;--card:#fff;--line:#d9e2ea;--text:#0f2a3d;--muted:#51677a;--accent:#17688f;--on:#fff;--pg-bg:#fff3c4;--pg-ink:#6b4300;--pg-line:#f6d86a}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font:16px/1.65 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--text)}
a{color:var(--accent)}img{max-width:100%;height:auto;display:block}
.top{background:linear-gradient(120deg,#0b2a40,#103f63 62%,#23408a);color:#fff}
.top-in{max-width:980px;margin:0 auto;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:.8rem;flex-wrap:wrap}
.brand{display:flex;gap:.6rem;align-items:center;color:#fff;text-decoration:none;font:700 1.25rem var(--display)}.brand img{width:34px;height:34px}.brand small{display:block;font:400 .72rem Inter,sans-serif;color:#b9d4e8}
.top a.lang{color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:.3rem .9rem;text-decoration:none;font-size:.9rem}
.hero{max-width:980px;margin:0 auto;padding:30px 16px 34px;color:#fff}
.hero h1{font:700 clamp(1.9rem,5vw,2.8rem)/1.12 var(--display);margin:0 0 .6rem;letter-spacing:-.015em}.hero .lead{color:#d3e5f2;font-size:1.06rem;max-width:68ch;margin:0 0 1.1rem}
.btn{display:inline-flex;gap:.4rem;align-items:center;background:#fff;color:#0b2a40;font-weight:700;padding:.65rem 1.2rem;border-radius:10px;text-decoration:none}.btn.gold{background:#fde047;color:#3b2f00}
.toc{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1.1rem}.toc a{color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:.3rem .9rem;text-decoration:none;font-size:.92rem}.toc a:hover{background:rgba(255,255,255,.14)}
main{max-width:980px;margin:0 auto;padding:0 16px}
h2{font:700 clamp(1.4rem,3vw,1.9rem)/1.2 var(--display);margin:2.6rem 0 .5rem;letter-spacing:-.01em;scroll-margin-top:12px}
.sub{color:var(--muted);margin:0 0 1.2rem}
.glance{display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem;margin-top:1.8rem}.glance div{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1rem}.glance b{display:block;font:700 1.05rem var(--display);margin-bottom:.2rem}.glance span{color:var(--muted);font-size:.95rem}
ol.steps,ol.psteps{list-style:none;counter-reset:s;padding:0;margin:0;display:grid;gap:1.2rem}
ol.steps>li,ol.psteps>li{counter-increment:s;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:1.1rem 1.2rem 1.2rem 4rem;position:relative;box-shadow:0 10px 28px -20px rgba(15,42,61,.4)}
ol.steps>li::before,ol.psteps>li::before{content:counter(s);position:absolute;left:1.1rem;top:1.05rem;width:2rem;height:2rem;border-radius:50%;background:var(--accent);color:var(--on);font:700 1rem var(--display);display:grid;place-items:center}
ol.steps>li>b,ol.psteps>li>strong{display:block;font:700 1.15rem var(--display)}.short{display:block;color:var(--muted);margin:.15rem 0 .5rem}
ul.more{margin:.2rem 0 .9rem;padding-left:1.1rem}ul.more li{margin:.25rem 0}
figure{margin:.8rem 0 0}figure img{border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px -18px rgba(15,42,61,.5);background:#fff}figcaption{font-size:.84rem;color:var(--muted);margin-top:.4rem}
.pro{margin-top:2.8rem;border:1px solid var(--pg-line);border-radius:26px;padding:1.6rem 1.4rem;background:linear-gradient(135deg,var(--pg-bg),var(--card) 55%)}
.pro h2{margin-top:.5rem}.badge{display:inline-block;background:var(--pg-bg);color:var(--pg-ink);border:1px solid var(--pg-line);border-radius:999px;padding:.15rem .75rem;font-size:.74rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.pro .psub{font:600 1.15rem var(--display);margin:.1rem 0 .7rem}.pro p{margin:.5rem 0}.note{border:1px dashed var(--pg-line);border-radius:12px;padding:.7rem .9rem;background:rgba(246,216,106,.14)}
ol.psteps>li{border-color:var(--pg-line)}ol.psteps>li::before{background:#fde047;color:#3b2f00}
.scale{width:100%;border-collapse:collapse;margin:.6rem 0;background:var(--card);border-radius:12px;overflow:hidden}.scale td{padding:.5rem .8rem;border-bottom:1px solid var(--line)}.scale td:first-child{font-weight:700;white-space:nowrap}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.7rem 1rem;margin:.5rem 0}summary{cursor:pointer;font-weight:600}details p{margin:.5rem 0 0;color:var(--muted)}
ul.eco{padding-left:1.1rem}footer{max-width:980px;margin:0 auto;padding:2rem 16px 2.4rem;color:var(--muted);font-size:.88rem}
@media(max-width:720px){.glance{grid-template-columns:1fr}ol.steps>li,ol.psteps>li{padding:3.4rem 1rem 1rem}ol.steps>li::before,ol.psteps>li::before{top:.9rem}ol.steps>li>b,ol.psteps>li>strong{margin-top:-.2rem}}
</style>
</head>
<body>
<div class="top"><div class="top-in"><a class="brand" href="/"><img src="/favicon.svg" alt="" width="34" height="34"><span>Ami<small>Trợ lý học thuật | AI Academic Agent</small></span></a><a class="lang" href="${o.path}" hreflang="${o.lang}" lang="${o.lang}">${esc(t.langLabel)}</a></div>
<div class="hero">
<h1>${esc(t.h1)}</h1>
<p class="lead">${esc(t.lead)}</p>
<a class="btn" href="/">${esc(t.cta)}</a>
<nav class="toc" aria-label="${esc(t.h1)}">${t.toc.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join("")}</nav>
</div></div>
<main>
<div class="glance" aria-label="${esc(t.glanceH)}">${t.glance.map(([h, d]) => `<div><b>${esc(h)}</b><span>${esc(d)}</span></div>`).join("")}</div>
<h2 id="phan-tich">${esc(t.stepsH)}</h2>
<p class="sub">${esc(t.stepsLead)}</p>
<ol class="steps">
${stepHtml}
</ol>
<section class="pro" id="giao-su">
<span class="badge">${esc(t.proBadge)}</span>
<h2>${esc(t.proH)}</h2>
<p class="psub">${esc(t.proSub)}</p>
<p>${esc(t.proLead)}</p>
${t.proWho.map((w, i) => `<p class="${i ? "note" : ""}">${esc(w)}</p>`).join("\n")}
<h3 style="font:700 1.2rem var(--display);margin:1.6rem 0 .7rem">${esc(t.proStepsH)}</h3>
<ol class="psteps">
${proHtml}
</ol>
${t.proAfter.map((w) => `<p>${esc(w)}</p>`).join("\n")}
<h3 style="font:700 1.2rem var(--display);margin:1.6rem 0 .5rem">${esc(t.proScaleH)}</h3>
<table class="scale"><tbody>${t.proScale.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table>
<p class="sub">${esc(t.proScaleNote)}</p>
<h3 style="font:700 1.2rem var(--display);margin:1.6rem 0 .5rem">${esc(t.proAdminH)}</h3>
<p>${esc(t.proAdmin)}</p>
${fig(t.lang, t.proAdminImg[0], t.proAdminImg[1], ++n, t.figure)}
<p style="margin-top:1.2rem"><a class="btn gold" href="/#/review">${esc(t.proCta || t.proH)}</a></p>
</section>
<h2 id="hoi-dap">${esc(t.faqH)}</h2>
${t.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n")}
<h2>${esc(t.ecoH)}</h2>
<ul class="eco">
${t.eco.map(([nm, h, d]) => `<li><a href="${h}">${esc(nm)}</a>: ${esc(d)}</li>`).join("\n")}
</ul>
</main>
<footer>${esc(t.foot)}</footer>
</body>
</html>
`;
  writeFileSync(t.file, html);
}
console.log("ok");
