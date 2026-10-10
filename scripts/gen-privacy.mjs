// Sinh hai trang "Quyền riêng tư" tĩnh (VI, EN): public/quyen-rieng-tu.html và public/en/privacy.html.
// Chạy: npm run gen:privacy. Nội dung bám đúng cách ứng dụng thật xử lý dữ liệu (xem api/analyze.ts, api/extract-doc.ts,
// api/_lib/recommend.ts, supabase/schema.sql); đổi cách xử lý dữ liệu thì sửa ở đây. tests/privacy.test.ts kiểm tra bản sinh còn khớp.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SITE = "https://aaa.isavietnam.app";
export const DATE = "2026-10-10";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const T = {
  vi: {
    lang: "vi", locale: "vi_VN", path: "/quyen-rieng-tu", file: "public/quyen-rieng-tu.html", other: "/en/privacy",
    title: "Quyền riêng tư của Trợ lý học thuật: dữ liệu đi đâu",
    desc: "Trợ lý học thuật xử lý tài liệu và ý tưởng nghiên cứu của bạn thế nào: đọc tệp ngay trên máy, gửi văn bản tới Claude để phân tích, điều gì được lưu và quyền của bạn.",
    h1: "Quyền riêng tư và luồng dữ liệu",
    lead: "Ý tưởng nghiên cứu và tài liệu của bạn thuộc về bạn. Trang này mô tả đúng điều gì xảy ra với dữ liệu khi bạn dùng Trợ lý học thuật, kể cả những chỗ có bên thứ ba tham gia.",
    home: "Trang chủ", langLabel: "English", guide: "Hướng dẫn sử dụng", guidePath: "/huong-dan", cta: "Dùng thử miễn phí",
    updated: "Cập nhật ngày", foot: "© 2026 Lương Việt Hoàng (ISA Vietnam). Bản quyền đóng.", crumb: "Quyền riêng tư",
    pledgeH: "Ba cam kết",
    pledges: [
      ["Không bán, không chia sẻ", "Chúng tôi không bán dữ liệu của bạn và không dùng nội dung của bạn vào việc nào khác ngoài chạy phân tích cho chính bạn."],
      ["Không lưu tệp và toàn văn", "Tệp và toàn văn tài liệu của bạn không được lưu trên hệ thống của chúng tôi."],
      ["Bạn quyết định điều được lưu", "Abstract chỉ được lưu khi bạn bấm Lưu; trích dẫn được lưu khi bạn sao chép. Cả hai đều xóa được."],
    ],
    flowH: "Dữ liệu đi qua những đâu",
    flowLead: "Bốn nơi tham gia khi bạn bấm Phân tích. Màu và nhãn cho biết dữ liệu đang ở đâu.",
    tags: { local: "Trên máy bạn", server: "Máy chủ ứng dụng", third: "Bên thứ ba", store: "Được lưu" },
    flow: [
      { k: "local", n: 1, h: "Máy của bạn", d: "Trình duyệt đọc tệp PDF, DOCX hoặc bản quét (OCR) và tách thành văn bản. Tệp không rời khỏi máy bạn." },
      { k: "server", n: 2, h: "Máy chủ của ứng dụng (Vercel)", d: "Kiểm tra tài khoản và hạn mức, ghép lời nhắc, đối chiếu câu trích với văn bản gốc. Không ghi lại nội dung." },
      { k: "third", n: 3, h: "Claude (Anthropic)", d: "Mô hình AI đọc văn bản, abstract và đoạn giới thiệu hồ sơ ngắn để chấm điểm, rồi trả kết quả." },
      { k: "store", n: 4, h: "Cơ sở dữ liệu (Supabase)", d: "Chỉ nhận hồ sơ, hạn mức, nhật ký sử dụng (không có nội dung), và abstract hay trích dẫn khi bạn lưu." },
    ],
    arrows: ["văn bản đã tách và abstract", "văn bản, abstract, lời nhắc", "hồ sơ, nhật ký; thêm abstract và trích dẫn khi bạn lưu"],
    docNote: "Ngoại lệ: tệp .doc đời cũ (Word 97-2003) trình duyệt không đọc được, nên nguyên tệp được gửi tới máy chủ ứng dụng để lấy văn bản rồi bỏ ngay, không lưu. Muốn giữ tệp trên máy, hãy lưu thành .docx hoặc PDF.",
    oaNote: "Khi điểm phù hợp dưới 60, máy chủ tìm tài liệu thay thế trên OpenAlex bằng vài từ khóa do AI tạo ra. Nguyên văn tài liệu của bạn không được gửi tới OpenAlex.",
    tableH: "Từng loại dữ liệu",
    head: ["Dữ liệu", "Đi đâu", "Có lưu không"],
    rows: [
      ["Tệp tải lên (PDF, DOCX, bản quét)", "Đọc ngay trên máy bạn. Riêng .doc đời cũ: gửi tới máy chủ ứng dụng để đọc rồi bỏ.", "Không lưu"],
      ["Văn bản tách từ tệp, abstract, đoạn giới thiệu ngắn về hồ sơ", "Qua máy chủ ứng dụng tới Claude (Anthropic) để phân tích.", "Ứng dụng không lưu. Anthropic xử lý theo điều khoản của họ"],
      ["Kết quả phân tích (điểm, nhận xét, đoạn gợi ý)", "Trả về trình duyệt của bạn.", "Không lưu, trừ điểm phù hợp ghi vào nhật ký"],
      ["Abstract (đề tài)", "Lưu vào tài khoản của bạn.", "Chỉ khi bạn bấm Lưu. Xóa được"],
      ["Trích dẫn đã sao chép (tham khảo, câu trích, số trang, điểm)", "Lưu vào Lịch sử của bạn.", "Mỗi lần bạn sao chép. Xóa được"],
      ["Hồ sơ nhà nghiên cứu (email, họ tên, đơn vị, ORCID...)", "Lưu vào tài khoản của bạn.", "Có. Sửa được; email dùng để đăng nhập và liên hệ"],
      ["Nhật ký sử dụng (thời điểm, mô hình, số token, chi phí, điểm)", "Lưu để tính hạn mức và chi phí.", "Có. Không chứa nội dung tài liệu"],
      ["Lượt truy cập", "Đếm ẩn danh theo ngày và quốc gia.", "Không lưu địa chỉ IP"],
      ["Đo hành trình trong hệ sinh thái ISA", "Bộ đếm chung của Viện ISA (isavn.edu.vn) nhận trang đang xem, nguồn truy cập, loại thiết bị và tên các hành động ngắn (đã đăng ký, đã phân tích, đã sao chép). Không cookie, tôn trọng Do Not Track; mã khách ngẫu nhiên lưu trong trình duyệt, không chứa tên hay email. Không có nội dung tài liệu.", "Không lưu địa chỉ IP"],
      ["Đề nghị dùng Giáo sư phản biện (lý do, minh chứng khoa học)", "Lưu vào cơ sở dữ liệu để quản trị viên xét duyệt.", "Có, đến khi xử lý; không chứa nội dung công trình"],
      ["Công trình và mẫu nhận xét trong Giáo sư phản biện", "Đọc ngay trên máy bạn; văn bản đã đánh số đoạn được gửi qua máy chủ ứng dụng tới Claude (Anthropic) trong vài lần gọi nối tiếp. Bản nhận xét được dựng và lưu ngay trên trình duyệt của bạn.", "Ứng dụng không lưu nội dung. Bản nhận xét chỉ nằm trên trình duyệt (tối đa 30 bản, xóa được); nhật ký chỉ có số token, chi phí, điểm"],
      ["Họ tên tác giả của tài liệu (đối chiếu hồ sơ ProFind)", "Đối chiếu ngay trên máy bạn với chỉ mục công khai tải về từ ProFind. Họ tên không rời khỏi máy bạn.", "Không lưu"],
      ["Kết nối sang ProFind (chỉ khi bạn bấm)", "Máy chủ ứng dụng chuyển email đã xác thực, họ tên, số điện thoại, công việc, đơn vị và hồ sơ đã chọn sang ProFind trong một mã ký số dùng một lần. Không chuyển tài liệu, trích dẫn hay lịch sử.", "ProFind lưu theo quy định riêng của ProFind"],
      ["Liên kết giới thiệu đồng nghiệp", "Mã người mời và việc người được mời đã phân tích xong lần đầu hay chưa.", "Có, chỉ để tính lượt thưởng"],
    ],
    thirdH: "Các bên thứ ba",
    third: [
      ["Anthropic (Claude)", "Phân tích tài liệu qua API thương mại. Theo điều khoản hiện hành của Anthropic, nội dung gửi qua API mặc định không được dùng để huấn luyện mô hình. Thời gian lưu giữ và thay đổi do Anthropic quy định; hãy xem điều khoản của họ."],
      ["Vercel", "Chạy ứng dụng và máy chủ."],
      ["Supabase", "Đăng nhập và cơ sở dữ liệu lưu những mục ghi ở bảng trên."],
      ["OpenAlex", "Chỉ khi điểm dưới 60: vài từ khóa tìm kiếm do AI tạo ra."],
      ["Viện ISA (isavn.edu.vn)", "Bộ đếm truy cập chung của hệ sinh thái và cổng chuyển tiếp giữa các ứng dụng (ghi ẩn danh lượt bấm sang EduFind, ProFind, Mây)."],
      ["ProFind", "Chỉ mục công khai của ProFind được tải về trình duyệt của bạn để đối chiếu tên tác giả; tài khoản ProFind chỉ được tạo hoặc nối khi bạn bấm \"Đúng là tôi\"."],
      ["Google Sheets", "Bảng báo cáo vận hành của quản trị viên (nếu bật): email, họ tên, tên đề tài, số liệu sử dụng. Không có nội dung tài liệu, abstract hay câu trích."],
    ],
    seeH: "Ai xem được dữ liệu đã lưu",
    see: "Người dùng khác không xem được dữ liệu của bạn. Người quản trị hệ thống về mặt kỹ thuật có thể truy cập cơ sở dữ liệu (hồ sơ, đề tài, trích dẫn đã lưu); chúng tôi chỉ truy cập để vận hành và hỗ trợ khi bạn yêu cầu. Trang quản trị chỉ hiển thị hồ sơ và số liệu, không hiển thị nội dung tài liệu.",
    rightsH: "Quyền của bạn",
    rights: [
      "Ý tưởng, abstract và tài liệu thuộc về bạn.",
      "Xem và sửa hồ sơ; xóa đề tài và trích dẫn đã lưu ngay trong ứng dụng.",
      "Muốn xóa tài khoản và toàn bộ dữ liệu: liên hệ quản trị viên qua thông tin ở cuối trang ứng dụng.",
    ],
    tipH: "Lời khuyên khi dùng",
    tip: "Đừng tải tài liệu chứa thông tin cá nhân nhạy cảm hoặc dữ liệu mật mà bạn không có quyền chia sẻ. Với bản thảo chưa công bố, bạn có thể chỉ dùng abstract và đoạn trích cần thiết.",
  },
  en: {
    lang: "en", locale: "en_US", path: "/en/privacy", file: "public/en/privacy.html", other: "/quyen-rieng-tu",
    title: "AI Academic Agent privacy: where your data goes",
    desc: "How AI Academic Agent handles your documents and research ideas: files are read on your device, text is sent to Claude for analysis, what is stored, and your rights.",
    h1: "Privacy and data flow",
    lead: "Your research ideas and documents belong to you. This page describes exactly what happens to your data when you use AI Academic Agent, including where third parties are involved.",
    home: "Home", langLabel: "Tiếng Việt", guide: "User guide", guidePath: "/en/guide", cta: "Try it free",
    updated: "Updated", foot: "© 2026 Lương Việt Hoàng (ISA Vietnam). All rights reserved.", crumb: "Privacy",
    pledgeH: "Three commitments",
    pledges: [
      ["We do not sell or share", "We do not sell your data and we do not use your content for anything except running the analysis for you."],
      ["No files or full text stored", "Your files and the full text of your documents are not stored on our systems."],
      ["You decide what is kept", "An abstract is saved only when you press Save; a citation is saved when you copy it. You can delete both."],
    ],
    flowH: "Where your data goes",
    flowLead: "Four places take part when you press Analyse. Colour and labels show where the data is.",
    tags: { local: "On your device", server: "App server", third: "Third party", store: "Stored" },
    flow: [
      { k: "local", n: 1, h: "Your device", d: "Your browser reads the PDF, DOCX or scan (OCR) and turns it into text. The file never leaves your device." },
      { k: "server", n: 2, h: "The app's server (Vercel)", d: "Checks your account and quota, builds the prompt and checks quotes against the source text. It does not record the content." },
      { k: "third", n: 3, h: "Claude (Anthropic)", d: "The AI model reads the text, your abstract and a short profile summary to score the source, then returns the result." },
      { k: "store", n: 4, h: "Database (Supabase)", d: "Receives only your profile, quota, usage log (no content), and an abstract or citations when you save them." },
    ],
    arrows: ["extracted text and abstract", "text, abstract, prompt", "profile, log; plus abstract and citations when you save"],
    docNote: "Exception: a legacy .doc file (Word 97-2003) cannot be read by a browser, so the whole file is sent to the app's server to extract the text and is discarded immediately, never stored. To keep the file on your device, save it as .docx or PDF.",
    oaNote: "When the fit score is below 60, the server looks for alternative sources on OpenAlex using a few AI-generated keywords. The text of your document is not sent to OpenAlex.",
    tableH: "Each kind of data",
    head: ["Data", "Where it goes", "Is it stored?"],
    rows: [
      ["Uploaded file (PDF, DOCX, scan)", "Read on your device. Legacy .doc only: sent to the app's server to be read, then discarded.", "Not stored"],
      ["Text extracted from the file, your abstract, a short profile summary", "Through the app's server to Claude (Anthropic) for analysis.", "Not stored by the app. Anthropic handles it under its own terms"],
      ["Analysis result (score, comments, suggested passages)", "Returned to your browser.", "Not stored, except the fit score recorded in the usage log"],
      ["Abstract (topic)", "Saved to your account.", "Only when you press Save. Deletable"],
      ["Copied citations (reference, quote, page, score)", "Saved to your History.", "Each time you copy. Deletable"],
      ["Researcher profile (email, name, affiliation, ORCID...)", "Saved to your account.", "Yes. Editable; the email is used for sign-in and contact"],
      ["Usage log (time, model, tokens, cost, score)", "Kept to compute quota and cost.", "Yes. Contains no document content"],
      ["Visits", "Counted anonymously per day and country.", "No IP address stored"],
      ["Journey measurement across the ISA ecosystem", "The shared ISA counter (isavn.edu.vn) receives the page being viewed, the traffic source, the device type and short action names (signed up, analysed, copied). No cookies, Do Not Track respected; a random visitor ID is kept in your browser and holds no name or email. No document content.", "No IP address stored"],
      ["Requests to use the AI Professor (reason, scientific evidence)", "Stored in the database for the administrator to review.", "Yes, until decided; contains no content of any work"],
      ["Works and review templates in the AI Professor", "Read on your device; the numbered text is sent through the app server to Claude (Anthropic) in a few consecutive calls. The review is built and stored in your own browser.", "The app keeps no content. The review lives only in your browser (up to 30, deletable); the log has only tokens, cost and score"],
      ["Authors' names in a document (matching ProFind profiles)", "Matched on your device against the public index downloaded from ProFind. The names never leave your device.", "Not stored"],
      ["Connecting to ProFind (only when you press)", "The app server sends your verified email, name, phone, job, affiliation and the chosen profile to ProFind in a one-time signed code. No documents, citations or history are sent.", "ProFind stores it under ProFind's own rules"],
      ["Colleague invitation link", "The inviter's code and whether the invited person has finished a first analysis.", "Yes, only to count bonus analyses"],
    ],
    thirdH: "Third parties",
    third: [
      ["Anthropic (Claude)", "Analyses documents through its commercial API. Under Anthropic's current terms, content sent through the API is not used to train models by default. Retention and any changes are set by Anthropic; please read their terms."],
      ["Vercel", "Runs the app and its server."],
      ["Supabase", "Sign-in and the database that holds the records in the table above."],
      ["OpenAlex", "Only when the score is below 60: a few AI-generated search keywords."],
      ["ISA Institute (isavn.edu.vn)", "The ecosystem's shared visit counter and the redirect gateway between apps (anonymous clicks to EduFind, ProFind and Mary)."],
      ["ProFind", "ProFind's public index is downloaded to your browser to match author names; a ProFind account is created or linked only when you press \"That is me\"."],
      ["Google Sheets", "The administrator's operations report (if enabled): email, name, topic title, usage figures. No document content, abstracts or quotes."],
    ],
    seeH: "Who can see stored data",
    see: "Other users cannot see your data. The system administrator can technically access the database (profiles, topics, saved citations); we access it only to operate the service and to help when you ask. The admin screens show profiles and figures, never document content.",
    rightsH: "Your rights",
    rights: [
      "Your ideas, abstracts and documents belong to you.",
      "View and edit your profile; delete saved topics and citations inside the app.",
      "To delete your account and all your data, contact the administrator using the details at the bottom of the app.",
    ],
    tipH: "Good practice",
    tip: "Do not upload documents that contain sensitive personal information or confidential data you are not entitled to share. For an unpublished manuscript you can use only the abstract and the passages you need.",
  },
};

function page(t) {
  const o = t.lang === "vi" ? T.en : T.vi, url = SITE + t.path, ourl = SITE + o.path;
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": url, url, name: t.title, description: t.desc, inLanguage: t.lang, dateModified: DATE, isPartOf: { "@type": "WebSite", name: "Ami - Trợ lý học thuật | AI Academic Agent", url: SITE + "/" } },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: t.home, item: SITE + "/" }, { "@type": "ListItem", position: 2, name: t.crumb, item: url }] } ] };
  const f = Object.fromEntries(t.flow.map((s) => [s.k, s]));
  const card = (s, cls) => `<li class="fc ${s.k} ${cls}"><span class="tag">${esc(t.tags[s.k])}</span><b><i>${s.n}</i> ${esc(s.h)}</b><span>${esc(s.d)}</span></li>`;
  const arrow = (txt, cls) => `<li class="fa ${cls}" aria-hidden="true"><span>${esc(txt)}</span><em>→</em></li>`;
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
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
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
:root{--bg:#0a0f1e;--card:#121a34;--line:#2a3763;--text:#e6ecf8;--muted:#9aa8c4;--accent:#38bdf8;--on:#04101f;--local:#34d399;--server:#38bdf8;--third:#fbbf24;--store:#b3a0fb}
@media (prefers-color-scheme:light){:root{--bg:#f4f7fc;--card:#fff;--line:#d3dbea;--text:#0f172a;--muted:#4b5870;--accent:#03629a;--on:#fff;--local:#046e50;--server:#03629a;--third:#9c4808;--store:#6d28d9}}
*{box-sizing:border-box}body{margin:0;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--text)}
a{color:var(--accent)}header,main,footer{max-width:900px;margin:0 auto;padding:0 16px}
header{display:flex;justify-content:space-between;align-items:center;padding-top:18px;padding-bottom:6px;font-size:.92rem;flex-wrap:wrap;gap:.5rem}
h1{font-size:clamp(1.7rem,5vw,2.4rem);line-height:1.2;margin:.8rem 0 .4rem}h2{font-size:1.35rem;margin:2.2rem 0 .7rem}
.lead{color:var(--muted);font-size:1.05rem;margin:0 0 1.2rem}.sub{color:var(--muted);margin:-.3rem 0 1rem}.btn{display:inline-block;background:var(--accent);color:var(--on);font-weight:700;padding:.7rem 1.3rem;border-radius:12px;text-decoration:none}
.pledges{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.8rem;list-style:none;padding:0;margin:0}.pledges li{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:.9rem 1rem}.pledges b{display:block;margin-bottom:.2rem}.pledges span{color:var(--muted);font-size:.95rem}
ol.flow{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr auto 1fr auto 1fr;grid-template-areas:"a1 ar1 a2 ar2 a3" ". . ar3 . ." ". . a4 . .";gap:.6rem .4rem;align-items:stretch}
.fc{background:var(--card);border:1px solid var(--line);border-left:6px solid var(--c);border-radius:14px;padding:.8rem .9rem;display:flex;flex-direction:column;gap:.3rem;font-size:.92rem}.fc b{font-size:1rem}.fc i{font-style:normal;display:inline-grid;place-items:center;width:1.5rem;height:1.5rem;border-radius:50%;background:var(--c);color:var(--bg);font-weight:800;font-size:.85rem;margin-right:.2rem}.fc span:last-child{color:var(--muted)}
.fc .tag{align-self:flex-start;font-size:.72rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--c);border:1px solid var(--c);border-radius:99px;padding:.05rem .55rem}
.fc.local{--c:var(--local);grid-area:a1}.fc.server{--c:var(--server);grid-area:a2}.fc.third{--c:var(--third);grid-area:a3}.fc.store{--c:var(--store);grid-area:a4}
.fa{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:.74rem;color:var(--muted);max-width:7.5rem}.fa em{font-style:normal;font-size:1.4rem;color:var(--text)}
.fa.ar1{grid-area:ar1}.fa.ar2{grid-area:ar2}.fa.ar3{grid-area:ar3;max-width:none;flex-direction:row;gap:.5rem;justify-content:center}.fa.ar3 em{transform:rotate(90deg)}
.note{background:var(--card);border:1px dashed var(--line);border-radius:12px;padding:.7rem 1rem;margin:.8rem 0;font-size:.94rem;color:var(--muted)}
.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.92rem}th,td{padding:.55rem .6rem;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em}
ul.plain{padding-left:1.2rem}ul.plain li{margin:.4rem 0}.third li b{display:inline}
footer{padding-top:2rem;padding-bottom:2rem;color:var(--muted);font-size:.88rem}
@media (max-width:700px){ol.flow{grid-template-columns:1fr;grid-template-areas:"a1" "ar1" "a2" "ar2" "a3" "ar3" "a4"}.fa,.fa.ar3{max-width:none;flex-direction:row;gap:.5rem}.fa em,.fa.ar3 em{transform:rotate(90deg)}}
</style>
</head>
<body>
<header><a href="/">${esc(t.home)}</a><span><a href="${t.guidePath}">${esc(t.guide)}</a> · <a href="${o.path}" hreflang="${o.lang}" lang="${o.lang}">${esc(t.langLabel)}</a></span></header>
<main>
<h1>${esc(t.h1)}</h1>
<p class="lead">${esc(t.lead)}</p>
<p><a class="btn" href="/">${esc(t.cta)}</a></p>
<h2>${esc(t.pledgeH)}</h2>
<ul class="pledges">
${t.pledges.map(([h, d]) => `<li><b>${esc(h)}</b><span>${esc(d)}</span></li>`).join("\n")}
</ul>
<h2>${esc(t.flowH)}</h2>
<p class="sub">${esc(t.flowLead)}</p>
<ol class="flow">
${card(f.local, "")}
${arrow(t.arrows[0], "ar1")}
${card(f.server, "")}
${arrow(t.arrows[1], "ar2")}
${card(f.third, "")}
${arrow(t.arrows[2], "ar3")}
${card(f.store, "")}
</ol>
<p class="note">${esc(t.docNote)}</p>
<p class="note">${esc(t.oaNote)}</p>
<h2>${esc(t.tableH)}</h2>
<div class="tw"><table>
<thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>
${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("\n")}
</tbody>
</table></div>
<h2>${esc(t.thirdH)}</h2>
<ul class="plain third">
${t.third.map(([n, d]) => `<li><b>${esc(n)}:</b> ${esc(d)}</li>`).join("\n")}
</ul>
<h2>${esc(t.seeH)}</h2>
<p>${esc(t.see)}</p>
<h2>${esc(t.rightsH)}</h2>
<ul class="plain">
${t.rights.map((r) => `<li>${esc(r)}</li>`).join("\n")}
</ul>
<h2>${esc(t.tipH)}</h2>
<p>${esc(t.tip)}</p>
<p class="sub">${esc(t.updated)}: ${DATE}</p>
</main>
<footer>${esc(t.foot)}</footer>
</body>
</html>
`;
}

export function render() { return { [T.vi.file]: page(T.vi), [T.en.file]: page(T.en) }; }
export const COPY = T;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [f, c] of Object.entries(render())) writeFileSync(f, c);
  console.log("ok");
}
