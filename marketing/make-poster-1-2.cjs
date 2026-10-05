// Poster phát hành 1.2: node marketing/make-poster-1-2.cjs → marketing/poster-1-2-4x5.png (1080×1350 ×2) và poster-1-2-1x1.png (1080×1080 ×2).
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const dir = __dirname, qr = fs.readFileSync(path.join(dir, "qr-app-v12.svg"), "utf8");
const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#7c5cf0"/></linearGradient></defs><rect width="48" height="48" rx="11" fill="url(#g)"/><path d="M24 9 11 37h5l8-18 8 18h5z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><path d="M19 31h10" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>';
const icon = (d) => `<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  doc: icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
  gauge: icon('<path d="M12 14l4-5"/><circle cx="12" cy="14" r="2"/><path d="M3.5 18a9.5 9.5 0 1 1 17 0"/>'),
  quote: icon('<path d="M7 7h3v4c0 2-1 3-3 4M15 7h3v4c0 2-1 3-3 4"/>'),
  compass: icon('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  lock: icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  check: icon('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'),
};
const css = `*{box-sizing:border-box;margin:0}body{font-family:'DejaVu Sans','Segoe UI',Arial,sans-serif;color:#e8ecf8;background:#070b16;width:1080px;position:relative;overflow:hidden;background:radial-gradient(1100px 700px at 8% 0%,#1d2f6b,#0c1330 52%,#060a14)}
.grad{background:linear-gradient(90deg,#38bdf8,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
.gold{color:#fde047}.halo{position:absolute;border-radius:50%;background:radial-gradient(closest-side,#38bdf866,#7c5cf044 60%,transparent)}
.dots{position:absolute;inset:0;background-image:radial-gradient(#ffffff14 1.5px,transparent 1.6px);background-size:34px 34px;mask-image:linear-gradient(180deg,#000,transparent 70%)}
.top{position:absolute;left:70px;right:70px;top:54px;display:flex;align-items:center;gap:18px}.top svg{width:66px;height:66px}.top small{display:block;font-size:17px;letter-spacing:.2em;color:#38bdf8;font-weight:700}.top b{font-size:25px;letter-spacing:.02em}
.ver{margin-left:auto;font-size:21px;font-weight:800;padding:10px 22px;border-radius:99px;background:linear-gradient(100deg,#fde047,#fb923c);color:#1b1230;box-shadow:0 8px 24px #fb923c55}
.ami{position:absolute;filter:drop-shadow(0 28px 34px rgba(0,0,0,.5))}
.kick{font-size:21px;letter-spacing:.22em;font-weight:800}
h1{font-weight:800;letter-spacing:-.01em}
.sub{font-size:25px;line-height:1.42;color:#cfd8f3}
.rail{position:absolute;left:70px;right:70px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.rail:before{content:"";position:absolute;left:8%;right:8%;top:50px;height:3px;background:linear-gradient(90deg,#38bdf8,#8b7cf6,#fde047);opacity:.55}
.node{position:relative;text-align:center;padding:0 6px}
.node .ic{width:100px;height:100px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;color:#38bdf8;background:#101a3d;border:2px solid #2b3d78;box-shadow:0 10px 28px #0007}
.node b{display:block;font-size:23px;line-height:1.2}.node span{display:block;font-size:17px;color:#a9b4d0;margin-top:5px;line-height:1.35}
.node.new .ic{color:#fde047;border-color:#fde047;background:#2a2410;box-shadow:0 0 0 6px #fde04722,0 10px 30px #fde04733}
.node .tag{position:absolute;top:-14px;left:50%;transform:translateX(18px);font-size:14px;font-weight:800;letter-spacing:.12em;background:#fde047;color:#1b1230;padding:4px 10px;border-radius:99px}
.trust{position:absolute;left:70px;right:70px;display:flex;gap:16px}
.chip{flex:1;display:flex;gap:14px;align-items:center;padding:16px 20px;border:1px solid #2b3d78;border-radius:20px;background:linear-gradient(160deg,#121c40,#0d1530)}
.chip svg{flex:none;width:42px;height:42px;color:#34d399}.chip b{display:block;font-size:20px;line-height:1.25}.chip span{font-size:16px;color:#a9b4d0;line-height:1.35}
.cta{position:absolute;left:70px;right:70px;display:flex;align-items:center;gap:30px;padding:22px 30px;border-radius:28px;background:linear-gradient(100deg,#15407a,#5a3fd0);box-shadow:0 18px 50px #3b2bbf55}
.qr{width:176px;height:176px;padding:12px;background:#fff;border-radius:18px;flex:none}.qr svg{width:100%;height:100%;display:block}
.cta h3{font-size:36px;line-height:1.15;margin-bottom:8px}.cta p{font-size:19px;color:#dbe3fb;line-height:1.45}
.cta .url{display:inline-block;margin-top:12px;font-size:29px;font-weight:800;padding:8px 20px;border-radius:14px;background:#070b16}
.foot{position:absolute;left:70px;right:70px;border-top:1px solid #27366a;padding-top:14px;font-size:17px;color:#a9b4d0;display:flex;justify-content:space-between;gap:20px}.foot b{color:#e8ecf8}.foot em{color:#38bdf8;font-style:normal}`;
const head = `<div class=top>${logo}<div><small>TRỢ LÝ HỌC THUẬT</small><b>AI Academic Agent</b></div><div class=ver>PHIÊN BẢN 1.2</div></div>`;
const rail = (top) => `<div class=rail style="top:${top}px">
<div class=node><div class=ic>${I.doc}</div><b>Đọc giúp bạn</b><span>PDF, DOC, DOCX, bản scan</span></div>
<div class=node><div class=ic>${I.gauge}</div><b>Chấm 0–100</b><span>so với đề tài của bạn</span></div>
<div class=node><div class=ic>${I.quote}</div><b>Trích dẫn</b><span>APA, IEEE, 10.000+ kiểu</span></div>
<div class="node new"><span class=tag>MỚI</span><div class=ic>${I.compass}</div><b class=gold>Đi tiếp</b><span>chọn tạp chí · chuẩn hóa thể thức</span></div></div>`;
const trust = (top) => `<div class=trust style="top:${top}px">
<div class=chip>${I.lock}<div><b>Tài liệu không bị lưu</b><span>Có trang Quyền riêng tư vẽ rõ dữ liệu đi đâu</span></div></div>
<div class=chip>${I.check}<div><b>Tài khoản đã xác thực</b><span>Hạn mức riêng, lịch sử và gợi ý đầy đủ</span></div></div></div>`;
const cta = (bottom) => `<div class=cta style="bottom:${bottom}px"><div class=qr>${qr}</div><div><h3>Thử miễn phí ngay</h3><p>Quét mã hoặc vào địa chỉ bên dưới.<br>Miễn phí để bắt đầu, không cần thẻ.</p><span class=url>aaa.isavietnam.app</span></div></div>`;
const foot = (bottom) => `<div class=foot style="bottom:${bottom}px"><span><b>Lương Việt Hoàng</b> · ISA Vietnam · ORCID 0009-0000-5248-6186</span><span><em>EduFind</em> · <em>Trợ lý văn thư Mây</em></span></div>`;

const p45 = `<style>${css}body{height:1350px}</style><div class=dots></div><div class=halo style="left:-60px;top:130px;width:560px;height:620px"></div>${head}
<img class=ami src="ami/ami-celebrate.png" style="left:6px;top:150px;width:456px;height:570px">
<div style="position:absolute;left:470px;top:176px;width:540px"><div class="kick gold">AMI ĐỌC GIÚP BẠN</div>
<h1 style="font-size:66px;line-height:1.1;margin:14px 0 18px">Bài báo này<br>có đáng trích<br><span class=grad>cho đề tài<br>của bạn?</span></h1>
<p class=sub>Ami đọc, chấm điểm và chỉ ra đoạn đáng trích. Rồi đưa bạn đi tiếp.</p></div>
${rail(676)}${trust(918)}${cta(112)}${foot(44)}`;

const p11 = `<style>${css}body{height:1080px}.qr{width:150px;height:150px}.cta{padding:18px 26px}.cta h3{font-size:32px}.cta .url{font-size:26px;margin-top:8px}.cta p{font-size:17px}</style><div class=dots></div><div class=halo style="left:-60px;top:90px;width:520px;height:560px"></div>${head}
<img class=ami src="ami/ami-celebrate.png" style="left:20px;top:128px;width:336px;height:420px">
<div style="position:absolute;left:390px;top:150px;width:620px"><div class="kick gold">AMI ĐỌC GIÚP BẠN</div>
<h1 style="font-size:60px;line-height:1.1;margin:12px 0 14px">Bài báo này có đáng trích <span class=grad>cho đề tài của bạn?</span></h1>
<p class=sub style="font-size:23px">Ami đọc, chấm điểm và chỉ ra đoạn đáng trích. Rồi đưa bạn đi tiếp.</p></div>
${rail(588)}${cta(56)}`;

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  for (const [name, html, h] of [["poster-1-2-4x5", p45, 1350], ["poster-1-2-1x1", p11, 1080]]) {
    const ctx = await b.newContext({ viewport: { width: 1080, height: h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    fs.writeFileSync(path.join(dir, name + ".html"), `<!doctype html><meta charset=utf-8>${html}`);
    await page.goto("file://" + path.join(dir, name + ".html")); await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(dir, name + ".png") }); await ctx.close();
  }
  await b.close();
})();
