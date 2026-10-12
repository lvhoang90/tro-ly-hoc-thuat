/* Dựng khung hình clip "Ami 1.6 có gì mới" (60 giây, 1080×1920, 30 khung/giây).
 *   node render.cjs <thư mục ra> <từ> <đến> [bước]
 * Đọc index.html, thay lời thoại và độ dài giọng (script.json, dur.json), dựng từng khung bằng Playwright (JPEG). */
let chromium; try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); } const fs = require("fs"); const path = require("path");
const OUT = process.argv[2], FPS = 30, from = +(process.argv[3] || 0), to = +(process.argv[4] || 60 * FPS), STEP = +(process.argv[5] || 1);
fs.mkdirSync(OUT, { recursive: true });
const rd = (f) => fs.readFileSync(path.join(__dirname, f), "utf8");
const html = rd("index.html").replace("__SCRIPT__", rd("script.json")).replace("__DUR__", rd("dur.json"));
const tmp = path.join(__dirname, `.build-${process.pid}.html`); fs.writeFileSync(tmp, html);
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log("[console]", m.text().slice(0, 200)); }); p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 300)));
  await p.goto("file://" + tmp); await p.waitForFunction(() => window.__vidReady, null, { timeout: 30000 });
  const t0 = Date.now();
  for (let f = from; f < to; f += STEP) {
    await p.evaluate((t) => window.__render(t), f / FPS);
    await p.screenshot({ path: path.join(OUT, `f${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    if (f % 150 === 0) console.log("frame", f, ((Date.now() - t0) / 1000).toFixed(0) + "s");
  }
  await b.close(); fs.unlinkSync(tmp);
})();
