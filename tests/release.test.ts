// Kiểm tra phát hành: một phiên bản duy nhất ở package.json, config.ts, CHANGELOG.md, ghi chú phát hành trên web; bản sinh luôn khớp nguồn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RELEASES } from "../scripts/releases.mjs";
import { render } from "../scripts/gen-release.mjs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const semver = /^\d+\.\d+\.\d+$/;

test("phiên bản khớp ở package.json, config.ts, CHANGELOG và nguồn ghi chú", () => {
  const pkg = JSON.parse(read("package.json")).version as string;
  const lock = JSON.parse(read("package-lock.json")).version as string;
  const cfg = read("src/lib/config.ts").match(/release: \{ version: "([^"]+)", date: "([^"]+)"/)!;
  const log = read("CHANGELOG.md").match(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/m)!;
  assert.match(pkg, semver);
  assert.equal(lock, pkg);
  assert.equal(cfg[1], pkg);
  assert.equal(log[1], pkg);
  assert.equal(RELEASES[0].version, pkg);
  assert.match(read("index.html"), new RegExp(`"softwareVersion": "${pkg.replace(/\./g, "\\.")}"`));
  assert.equal(cfg[2], RELEASES[0].date);
  assert.equal(log[2], RELEASES[0].date);
});

test("lịch sử phát hành: phiên bản giảm dần, ngày không tăng, mỗi mục có đủ hai ngôn ngữ", () => {
  const cmp = (a: string, b: string) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  for (let i = 0; i < RELEASES.length; i++) {
    const r = RELEASES[i];
    assert.match(r.version, semver); assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
    if (i > 0) { assert.ok(cmp(RELEASES[i - 1].version, r.version) > 0, "phiên bản phải giảm dần"); assert.ok(RELEASES[i - 1].date >= r.date); }
    assert.equal(r.title.length, 2); assert.equal(r.summary.length, 2);
    for (const items of Object.values(r.sections) as string[][][]) for (const it of items) { assert.equal(it.length, 2); assert.ok(it[0].length > 10 && it[1].length > 10); }
  }
});

test("CHANGELOG.md và hai trang ghi chú phát hành đã được sinh lại từ nguồn", () => {
  for (const [file, content] of Object.entries(render())) assert.equal(read(file), content, `${file} lỗi thời: chạy npm run release:notes`);
});

test("trang ghi chú phát hành nêu phiên bản mới nhất và liên kết tới chính nó trong sitemap", () => {
  const v = RELEASES[0].version;
  assert.match(read("public/ghi-chu-phat-hanh.html"), new RegExp(`id="v${v}"`));
  assert.match(read("public/en/release-notes.html"), new RegExp(`id="v${v}"`));
  const sm = read("public/sitemap.xml");
  assert.match(sm, /\/ghi-chu-phat-hanh</); assert.match(sm, /\/en\/release-notes</);
});
