// Tạo bản chụp gọn CSDL tạp chí EduFind (SJR + Hội đồng GSNN) cho tầng gợi ý của Trợ lý học thuật.
// Dùng: EDUFIND_DIR=/đường/dẫn/edufind-khgd npm run sync:edufind   (mặc định ../edufind-khgd)
// Chỉ lấy trường cần thiết để giảm dung lượng; dữ liệu bên thứ ba (SCImago/Scopus, HĐGSNN) theo điều khoản từng nguồn.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.env.EDUFIND_DIR ?? path.resolve(process.cwd(), "../edufind-khgd");
const slug = process.env.EDUFIND_DISCIPLINE ?? "giao-duc";
const dir = path.join(root, "disciplines", slug);
const read = (f) => JSON.parse(readFileSync(path.join(dir, "data", f), "utf8"));
const cfg = JSON.parse(readFileSync(path.join(dir, "config.json"), "utf8"));

const sjr = read("sjr.json");
const council = read("council.json");

const intl = sjr.journals.map((j) => ({
  t: j.title, i: j.issn, p: j.publisher ?? "", q: j.bestQuartile ?? "", s: j.sjr ?? null,
  oa: !!j.openAccess, c: (j.categories ?? []).map((x) => x.name), co: j.country ?? "",
}));
const dom = council.journals.map((j) => ({
  t: j.name, i: (j.issn ?? []).map((x) => x.value).filter(Boolean), p: j.publisher ?? "", id: j.id,
  max: Math.max(0, ...(j.scoreTiers ?? []).map((t) => t.maxScore ?? 0)), idx: j.index ?? [],
}));

const out = {
  discipline: slug,
  nameVi: cfg.discipline.vi, nameEn: cfg.discipline.en,
  url: cfg.site.url, decision: cfg.council.decision,
  sjrYear: sjr.meta.year, generated: new Date().toISOString().slice(0, 10),
  intl, dom,
};
mkdirSync("data", { recursive: true });
// Xuất ra module TypeScript (không phải .json) vì hàm Vercel chạy ESM và không cho import .json thiếu thuộc tính "type: json".
writeFileSync("data/edufind-journals.ts", `// Tệp sinh tự động bởi scripts/sync-edufind.mjs, không sửa tay.\nconst data = ${JSON.stringify(out)};\nexport default data;\n`);
console.log(`OK: ${intl.length} tạp chí quốc tế, ${dom.length} tạp chí trong nước → data/edufind-journals.ts`);
