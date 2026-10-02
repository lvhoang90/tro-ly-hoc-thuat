/* Dựng khung hình clip Ami (hai lượt, ghép bằng ffmpeg):
 *   node render.cjs <thư mục> <từ> <đến> <bước> bg    -> nền + cảnh + bong bóng (1080×1920, JPEG)
 *   node render.cjs <thư mục> <từ> <đến> <bước> ami   -> Ami 3D nền trong suốt (620×900, PNG, nền trong suốt; dùng nhiều tiến trình song song theo đoạn khung)
 * Lượt "ami" cần bản build ứng dụng chạy ở http://localhost:4173 (vite preview) với Supabase giả. */
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const OUT = process.argv[2], FPS = 30, TOTAL = 30 * FPS;
const from = +(process.argv[3] || 0), to = +(process.argv[4] || TOTAL), STEP = +(process.argv[5] || 1), MODE = process.argv[6] || "bg";
fs.mkdirSync(OUT, { recursive: true });
const qr = fs.readFileSync(path.join(__dirname, "../qr-app.svg"), "utf8");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: MODE === "ami" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : [] });
  const ami = MODE === "ami";
  const ctx = await b.newContext({ viewport: ami ? (process.env.VP ? { width: +process.env.VP.split('x')[0], height: +process.env.VP.split('x')[1] } : { width: 620, height: 900 }) : { width: 1080, height: 1920 }, deviceScaleFactor: 1, baseURL: "http://localhost:4173", locale: "en-US" });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log("[console]", m.text().slice(0, 200)); }); p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 300)));
  if (ami) {
    await p.addInitScript(() => { window.__amiLock = true; window.__noPop = true;  try { localStorage.setItem("tl-lang", "en"); } catch {} });
    await p.route("http://mock.supabase.test/**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
    await p.route("**/api/visit**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"enabled":false}' }));
    await p.clock.install({ time: 0 });
    // Lấy ảnh trực tiếp từ canvas WebGL ngay sau khi vẽ (nhanh hơn chụp màn hình nhiều lần)
    await p.addInitScript(() => { window.__rafN = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf((ts) => { window.__rafN++; cb(ts); if (window.__want) { const c = document.querySelector(".ami-3d canvas"); if (c) { window.__img = c.toDataURL("image/png"); window.__want = false; } } }); });
    await p.goto("/?amidebug");
    for (let i = 0; i < 60 && !(await p.locator(".ami-3d canvas").count()); i++) { await p.clock.runFor(500); await p.waitForTimeout(250); }
    await p.addStyleTag({ content: `html,body,#root{background:transparent!important}body>*:not(#root):not(#vid){display:none!important}#root>*:not(:has(.ami-hero)){display:none!important}
      .ami-hero .ami-stage{width:620px!important;margin:0!important;position:fixed!important;left:0;top:0;z-index:5}.ami-hero .ami-stage::before,.ami-bubble,.ami-orbit{display:none!important}#vid{display:none!important}` });
  } else await p.setContent("<!doctype html><meta charset=utf-8><body style='margin:0'>");
  await p.evaluate((q) => { window.__QR = q; }, qr);
  await p.addScriptTag({ path: path.join(__dirname, "overlay.js") });
  if (ami) await p.evaluate(() => { document.querySelectorAll("#root *").forEach((e) => { if (!e.closest(".ami-hero")) e.style.visibility = "hidden"; }); document.querySelectorAll(".ami-hero, .ami-hero *").forEach((e) => { e.style.visibility = "visible"; }); });
  else await p.addStyleTag({ content: "html{background:#070b16}" });
  await p.waitForFunction(() => window.__vidReady);
  if (ami && from > 0) await p.clock.runFor(Math.round(from * 1000 / FPS));
  if (ami) await p.clock.runFor(100);
  const t0 = Date.now();
  for (let f = from; f < to; f += STEP) {
    await p.evaluate((t) => window.__render(t), f / FPS);
    if (ami) { await p.evaluate(() => { window.__want = true; window.__img = null; }); const n0 = await p.evaluate(() => window.__rafN); let dms = Math.round((f + STEP) * 1000 / FPS) - Math.round(f * 1000 / FPS); await p.clock.runFor(dms); for (let k = 0; k < 6 && (await p.evaluate(() => window.__rafN)) === n0; k++) await p.clock.runFor(17); }
    const file = path.join(OUT, `f${String(f).padStart(4, "0")}.${ami ? "png" : "jpg"}`);
    if (ami) { const d = await p.evaluate(() => window.__img); if (!d) throw new Error("không có khung Ami tại " + f); fs.writeFileSync(file, Buffer.from(d.split(",")[1], "base64")); if (process.env.BOTH) await p.screenshot({ path: file.replace(/\.png$/, "_s.png"), clip: { x: 0, y: 0, width: 620, height: 775 }, timeout: 300000 }); }
    else await p.screenshot({ path: file, type: "jpeg", quality: 93, timeout: 180000 });
    if (f % 30 === 0) console.log(MODE, "frame", f, ((Date.now() - t0) / 1000).toFixed(0) + "s");
  }
  await b.close();
})();
