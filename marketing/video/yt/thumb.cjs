/* Ảnh đại diện YouTube 1280×720: node thumb.cjs <ra.jpg> */
let chromium; try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const path = require("path");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("file://" + path.join(__dirname, "thumb.html")); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
  await p.screenshot({ path: process.argv[2], type: "jpeg", quality: 92 }); await b.close();
})();
