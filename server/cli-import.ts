// Dòng lệnh: node server-dist/import.mjs ami-export.json [--replace]
import { readFileSync } from "node:fs";
import { DATA_DIR } from "./db.ts";
import { importData, type Export } from "./migrate.ts";

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error("Dùng: node server-dist/import.mjs ami-export.json [--replace]"); process.exit(1); }
const data = JSON.parse(readFileSync(file, "utf8")) as Export;
try {
  const n = importData(data, { replace: flags.includes("--replace") });
  console.log(`Đã nhập vào ${DATA_DIR}:`);
  for (const [k, v] of Object.entries(n)) console.log(`  ${k.padEnd(16)} ${v}`);
} catch (e) { console.error((e as Error).message); process.exit(1); }
