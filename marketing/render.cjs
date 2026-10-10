// Dựng ảnh truyền thông từ các tệp HTML trong thư mục này: node marketing/render.cjs (cần playwright và Chromium).
// Đầu ra: poster-3x4.png (1800x2400), social-1x1/00..11 (1620x1620), public/og.png (1200x630).
const { chromium } = require("playwright"); const path = require("path");
const M = __dirname + "/"; const R = path.resolve(M, "..") + "/";
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
  const shot = async (html, out, w, h, scale) => { const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale }); await p.goto("file://" + M + html); await p.waitForTimeout(900); await p.screenshot({ path: out }); await p.close(); };
  await shot("poster.html", M + "poster-3x4.png", 1200, 1600, 1.5);
  await shot("social-cover.html", M + "social-1x1/00-bia.png", 1080, 1080, 1.5);
  await shot("og.html", R + "public/og.png", 1200, 630, 1); await shot("og.html", M + "og.png", 1200, 630, 1);
  // Bộ ảnh vuông 1:1: mỗi ảnh một bước, ảnh chụp lấy từ public/guide/vi (dữ liệu minh họa).
  const fs = require("fs"); const FONTS = "file://" + R + "public/fonts/";
  const css = `@font-face{font-family:Inter;font-weight:400 800;src:url(${FONTS}inter-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122}
@font-face{font-family:Inter;font-weight:400 800;src:url(${FONTS}inter-vietnamese.woff2) format("woff2");unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+031B,U+1EA0-1EF9,U+20AB}
@font-face{font-family:SG;font-weight:400 800;src:url(${FONTS}space-grotesk-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122}
@font-face{font-family:SG;font-weight:400 800;src:url(${FONTS}space-grotesk-vietnamese.woff2) format("woff2");unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+031B,U+1EA0-1EF9,U+20AB}`;
  const T = [
    ["01-dang-ky", "01-landing", "Đăng ký miễn phí", "Xác nhận email là dùng được ngay", "BƯỚC 1", 0, "wave"],
    ["02-de-tai", "02-abstract", "Dán đề tài của bạn", "Abstract là thước đo cho mọi tài liệu", "BƯỚC 2", 62, "read"],
    ["03-tai-lieu", "03-upload", "Thả tài liệu vào", "PDF, DOC, DOCX · tệp đọc ngay trên máy bạn", "BƯỚC 3", 30, "idle"],
    ["04-diem", "04-score", "Chấm điểm 0–100", "5 tiêu chí rõ ràng, ngưỡng đạt là 60", "BƯỚC 4", 0, "happy"],
    ["05-doan-trich", "05-passages", "Đoạn nào đáng trích?", "Xếp theo ưu tiên, khớp nguyên văn với tài liệu", "BƯỚC 5", 0, "think"],
    ["06-trich-dan", "06-cite", "Trích dẫn một chạm", "APA, Harvard, IEEE và hơn 10.000 kiểu khác", "BƯỚC 6", 0, "celebrate"],
    ["07-lich-su", "07-history", "Mọi trích dẫn gọn gàng", "Gom theo đề tài, đổi kiểu ngay tại từng nguồn", "BƯỚC 7", 0, "happy"],
    ["08-diem-thap", "08b-decision", "Điểm thấp? Đừng bỏ cuộc", "Có hướng đi khác: nguồn mới, chỉnh abstract, tạp chí", "BƯỚC 8", 0, "care"],
    ["09-giao-su", "p7-result", "Giáo sư phản biện", "Giả lập hội đồng: đánh giá đề cương, luận văn, luận án", "TÍNH NĂNG CAO CẤP", 0, "read", 1],
    ["10-bang-chung", "p8-sections", "Mỗi nhận xét có bằng chứng", "Trích nguyên văn, được máy đối chiếu với bản gốc", "GIÁO SƯ PHẢN BIỆN", 0, "think", 1],
    ["11-de-nghi", "p2-request", "Xin quyền sử dụng", "Gửi lý do và minh chứng khoa học để quản trị viên duyệt", "GIÁO SƯ PHẢN BIỆN", 40, "wave", 1],
  ];
  for (const [file, img, title, sub, tag, pos, ami, prem] of T) {
    const src = "file://" + R + "public/guide/vi/" + img + ".webp";
    const html = `<!doctype html><meta charset=utf-8><style>${css}
*{box-sizing:border-box;margin:0}body{width:1080px;height:1080px;position:relative;overflow:hidden;font-family:Inter,sans-serif;color:#fff;background:radial-gradient(700px 480px at 95% 0%,rgba(124,92,240,.42),transparent 60%),linear-gradient(150deg,#0b2a40,#103f63 58%,#1d3a7a)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:44px 44px}
.top{position:absolute;left:60px;right:60px;top:44px;display:flex;justify-content:space-between;align-items:center}.top .l{display:flex;gap:12px;align-items:center;font:700 30px SG}.top img{width:46px;height:46px}
.tag{padding:9px 20px;border-radius:99px;font:700 19px Inter;letter-spacing:.08em;background:${prem ? "#fde047" : "rgba(255,255,255,.14)"};color:${prem ? "#3b2f00" : "#fff"};border:1.5px solid ${prem ? "#fde047" : "rgba(255,255,255,.3)"}}
h1{position:absolute;left:60px;top:128px;right:60px;font:700 70px/1.05 SG;letter-spacing:-.02em;color:${prem ? "#fde68a" : "#fff"}}
.s{position:absolute;left:62px;top:218px;right:60px;font:500 30px/1.3 Inter;color:#bcd7ea}
.card{position:absolute;left:60px;right:60px;top:300px;border-radius:26px;background:#fff;box-shadow:0 40px 80px -30px rgba(0,0,0,.65);overflow:hidden;padding:14px}
.card img{width:100%;height:auto;max-height:572px;object-fit:cover;object-position:50% ${pos}%;border-radius:14px;display:block}
.ami{position:absolute;right:24px;bottom:-14px;height:190px}
.foot{position:absolute;left:60px;bottom:40px;font:600 24px Inter;color:#9ec3dc}.foot b{color:#fff;font-family:SG}
</style><div class=grid></div><div class=top><div class=l><img src="file://${R}public/favicon.svg">Ami</div><div class=tag>${tag}</div></div>
<h1>${title}</h1><div class=s>${sub}</div><div class=card><img src="${src}"></div><img class=ami src="file://${M}ami/ami-${ami}.png"><div class=foot><b>aaa.isavietnam.app</b> · Trợ lý học thuật | AI Academic Agent</div>`;
    fs.writeFileSync(M + "social-1x1/.tile.html", html);
    const p = await b.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1.5 }); await p.goto("file://" + M + "social-1x1/.tile.html"); await p.waitForTimeout(700);
    await p.screenshot({ path: M + "social-1x1/" + file + ".png" }); await p.close();
  }
  fs.unlinkSync(M + "social-1x1/.tile.html");
  await b.close();
})();
