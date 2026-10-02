// Tạo chỉ mục gọn các kiểu CSL (Citation Style Language) từ danh sách công khai của Zotero.
// Chỉ mục chỉ chứa mã kiểu, tên, loại (phụ thuộc/độc lập) và định dạng; tệp .csl được tải theo nhu cầu từ jsDelivr.
// Kiểu CSL: CC BY-SA 3.0 (https://github.com/citation-style-language/styles). Chạy: npm run build:csl
import { writeFileSync, mkdirSync } from "node:fs";

const r = await fetch("https://www.zotero.org/styles-files/styles.json");
if (!r.ok) throw new Error(`Zotero ${r.status}`);
const list = await r.json();
const FMT = { "author-date": "d", numeric: "n", note: "o", label: "l", "author": "a" };
const rows = list
  .filter((s) => /^[a-z0-9-]+$/.test(s.name))
  .map((s) => [s.name, s.title, s.dependent ? 1 : 0, FMT[s.categories?.format] ?? ""])
  .sort((a, b) => a[1].localeCompare(b[1], "en"));
mkdirSync("public/csl", { recursive: true });
writeFileSync("public/csl/index.json", JSON.stringify({ generated: new Date().toISOString().slice(0, 10), styles: rows }));
console.log(`OK: ${rows.length} kiểu (${rows.filter((x) => !x[2]).length} độc lập, ${rows.filter((x) => x[2]).length} phụ thuộc)`);
