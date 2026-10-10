// Tạo gói triển khai cho hosting cPanel: cpanel/ (và ami-cpanel.zip nếu có lệnh zip).
// Gói tự chứa (thư viện đã đóng sẵn trong server-dist), nên trên hosting không cần chạy "npm install".
//   VITE_SITE_URL=https://<địa-chỉ-chính-thức> npm run pack:cpanel
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const sh = (c, env = {}) => execSync(c, { stdio: "inherit", env: { ...process.env, ...env } });
sh("npm run build", { VITE_BACKEND: "local" });
sh("npm run build:server");
rmSync("cpanel", { recursive: true, force: true });
mkdirSync("cpanel");
cpSync("dist", "cpanel/dist", { recursive: true });
cpSync("server-dist", "cpanel/server-dist", { recursive: true });
cpSync("app.cjs", "cpanel/app.cjs");
writeFileSync("cpanel/package.json", JSON.stringify({ name: "tro-ly-hoc-thuat", private: true, main: "app.cjs", engines: { node: ">=22.5" }, scripts: { start: "node app.cjs" } }, null, 2) + "\n");
try { rmSync("ami-cpanel.zip", { force: true }); sh("cd cpanel && zip -qr ../ami-cpanel.zip ."); console.log("\nĐã tạo ami-cpanel.zip"); }
catch { console.log("\nĐã tạo thư mục cpanel/ (không có lệnh zip: hãy nén thủ công)."); }
