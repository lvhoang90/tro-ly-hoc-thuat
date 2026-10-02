// Tạo bản chụp gọn CSDL EduFind (tất cả lĩnh vực: SJR + Hội đồng GSNN) cho tầng gợi ý của AI Academic Agent.
// Dùng: EDUFIND_DIR=/đường/dẫn/edufind-khgd npm run sync:edufind   (mặc định ../edufind-khgd)
// Địa chỉ gốc lấy từ site.config.json của EduFind (hiện là https://edufind.isavn.edu.vn); mỗi lĩnh vực ở <gốc>/<site.path>/.
// Giữ top N tạp chí SJR mỗi lĩnh vực + toàn bộ tạp chí trong nước của Hội đồng. Dữ liệu bên thứ ba theo điều khoản từng nguồn.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.env.EDUFIND_DIR ?? path.resolve(process.cwd(), "../edufind-khgd");
const TOP = Number(process.env.EDUFIND_TOP ?? 400);
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const origin = json(path.join(root, "site.config.json")).origin.replace(/\/$/, "");

const disciplines = [];
const jmap = new Map(); // sourceId -> bản ghi gọn
const dom = [];

for (const slug of readdirSync(path.join(root, "disciplines")).sort()) {
  const dir = path.join(root, "disciplines", slug);
  if (!existsSync(path.join(dir, "config.json")) || !existsSync(path.join(dir, "data", "sjr.json"))) continue;
  const cfg = json(path.join(dir, "config.json"));
  const di = disciplines.length;
  const sjr = json(path.join(dir, "data", "sjr.json"));
  disciplines.push({ slug, path: cfg.site.path, vi: cfg.discipline.vi, en: cfg.discipline.en, year: sjr.meta.year, decision: cfg.council?.decision?.vi ?? "" });
  const top = [...sjr.journals].filter((j) => j.sjr != null).sort((a, b) => b.sjr - a.sjr).slice(0, TOP);
  for (const j of top) {
    const k = j.sourceId;
    const r = jmap.get(k) ?? { t: j.title, i: j.issn, p: j.publisher ?? "", q: j.bestQuartile ?? "", s: j.sjr, oa: !!j.openAccess, d: [] };
    r.d.push(di);
    jmap.set(k, r);
  }
  const councilFile = path.join(dir, "data", "council.json");
  if (existsSync(councilFile)) {
    for (const j of json(councilFile).journals) {
      dom.push({
        t: j.name, i: (j.issn ?? []).map((x) => x.value).filter(Boolean), p: j.publisher ?? "",
        max: Math.max(0, ...(j.scoreTiers ?? []).map((t) => t.maxScore ?? 0)), d: di,
      });
    }
  }
}

const out = { origin, generated: new Date().toISOString().slice(0, 10), disciplines, intl: [...jmap.values()], dom };
mkdirSync("data", { recursive: true });
// Xuất module TypeScript (không phải .json): hàm Vercel chạy ESM, import .json thiếu thuộc tính "type: json" sẽ sập khi khởi động.
const lit = JSON.stringify(JSON.stringify(out));
writeFileSync("data/edufind.ts", `// Tệp sinh tự động bởi scripts/sync-edufind.mjs, không sửa tay.\nconst data = JSON.parse(${lit});\nexport default data as unknown as import("../shared/edufind-types.ts").EdufindData;\n`);
console.log(`OK: ${disciplines.length} lĩnh vực, ${out.intl.length} tạp chí quốc tế, ${dom.length} tạp chí trong nước, gốc ${origin} → data/edufind.ts`);
