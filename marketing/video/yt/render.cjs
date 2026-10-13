/* Dựng khung hình bản YouTube (1920×1080, 30 khung/giây, 60 giây):
 *   node render.cjs <thư mục ra> <từ> <đến> [bước]  (JPEG chất lượng cao) */
let chromium; try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const fs = require("fs"), path = require("path");
const OUT = process.argv[2], FPS = 30, from = +(process.argv[3] || 0), to = +(process.argv[4] || 60 * FPS), STEP = +(process.argv[5] || 1);
fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(__dirname, `.build-${process.pid}.html`); fs.copyFileSync(path.join(__dirname, "yt.html"), tmp);
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log("[console]", m.text().slice(0, 200)); }); p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 300)));
  await p.goto("file://" + tmp); await p.waitForFunction(() => window.__vidReady, null, { timeout: 30000 });
  for (let f = from; f < to; f += STEP) {
    await p.evaluate((t) => window.__render(t), f / FPS);
    await p.screenshot({ path: path.join(OUT, `f${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 94 });
  }
  await b.close(); fs.unlinkSync(tmp);
})();
