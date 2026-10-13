/* Chụp ảnh bìa clip: node cover.cjs <ra 9:16.png> [ra 4:5.png] */
let chromium; try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const path = require("path");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
  const p = await (await b.newContext({ viewport: { width: 1080, height: 1920 } })).newPage();
  await p.goto("file://" + path.join(__dirname, "cover.html")); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.screenshot({ path: process.argv[2] });
  if (process.argv[3]) await p.screenshot({ path: process.argv[3], clip: { x: 0, y: 324, width: 1080, height: 1350 } }); // vùng 4:5 ở giữa (lưới hồ sơ)
  await b.close();
})();
