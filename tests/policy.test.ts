// Bảo đảm các con số hạn mức công bố (trang hướng dẫn, văn bản giao diện, README) khớp mặc định trong schema.sql.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const num = (sql: string, key: string) => Number(sql.match(new RegExp(`\\('${key}', '(\\d+)'::jsonb\\)`))![1]);
const sql = read("supabase/schema.sql");
const weekly = num(sql, "basic_weekly_limit"), tierStart = sql.match(/\('tier_start', '"(\d{4}-\d{2}-\d{2})"'::jsonb\)/)![1];
const tierVi = tierStart.split("-").reverse().join("/");
const daily = num(sql, "free_daily_limit"), basic = num(sql, "file_limit_basic_mb"), approved = num(sql, "file_limit_approved_mb");

test("mặc định hạn mức: 1 lượt/ngày, 2 MB chưa xác thực, 15 MB đã xác thực", () => {
  assert.deepEqual([daily, basic, approved], [1, 2, 15]);
});

test("hạng tài khoản: mặc định 1 lượt/tuần từ 10/10/2026, khớp mã", () => {
  assert.deepEqual([weekly, tierStart], [1, "2026-10-10"]);
  assert.match(read("shared/tier.ts"), new RegExp(`DEFAULT_TIER_START = "${tierStart}"`));
  assert.match(read("api/_lib/common.ts"), new RegExp(`set\\("basic_weekly_limit", ${weekly}\\)`));
});

test("giá trị dự phòng trong mã khớp schema", () => {
  assert.match(sql, new RegExp(`'free_daily_limit'\\), ${daily}\\)`));
  assert.match(read("api/_lib/common.ts"), new RegExp(`set\\("free_daily_limit", ${daily}\\)`));
  assert.match(read("api/_lib/common.ts"), new RegExp(`set\\("file_limit_basic_mb", ${basic}\\)`));
  assert.match(read("src/pages/Workspace.tsx"), new RegExp(`max_file_mb \\?\\? ${basic}`));
});

test("văn bản công bố nêu đúng số lượt và dung lượng", () => {
  const vi = read("public/huong-dan.html"), en = read("public/en/guide.html"), dict = read("src/dict.ts");
  assert.match(vi, new RegExp(`${weekly} lượt phân tích miễn phí mỗi tuần \\(từ ${tierVi}`));
  assert.match(en, new RegExp(`${weekly} free analysis per week \\(from ${tierVi}`));
  assert.match(dict, new RegExp(`1 lượt phân tích mỗi tuần \\(từ ${tierVi}`));
  assert.match(read("public/llms.txt"), new RegExp(`${weekly} lượt phân tích mỗi tuần \\(từ ${tierVi}\\)`));
  assert.match(vi, new RegExp(`Tối đa ${basic} MB với tài khoản chưa xác thực, hoặc ${approved} MB`));
  assert.match(en, new RegExp(`up to ${basic} MB for unverified accounts, or ${approved} MB`));
  assert.match(dict, new RegExp(`tối đa ${basic} MB \\(${approved} MB nếu đã xác thực\\)`));
});
