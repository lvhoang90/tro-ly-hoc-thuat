// Quyền riêng tư: trang tĩnh khớp bản sinh, nêu đúng các điểm thật của hệ thống, lời trong ứng dụng khớp trang.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COPY, render } from "../scripts/gen-privacy.mjs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("hai trang quyền riêng tư đã được sinh lại từ nguồn", () => {
  for (const [file, content] of Object.entries(render())) assert.equal(read(file), content, `${file} lỗi thời: chạy npm run gen:privacy`);
});

test("trang nêu đúng các điểm thật: bên thứ ba, ngoại lệ .doc, không lưu tệp, cam kết", () => {
  for (const lang of ["vi", "en"] as const) {
    const c = COPY[lang], all = JSON.stringify(c);
    assert.match(all, /Anthropic/); assert.match(all, /Supabase/); assert.match(all, /Vercel/); assert.match(all, /OpenAlex/);
    assert.match(c.docNote, /\.doc/);
    assert.equal(c.pledges.length, 3);
    assert.ok(c.rows.every((r) => r.length === 3), "mỗi dòng bảng có 3 cột");
    assert.deepEqual(c.flow.map((s) => s.k), ["local", "server", "third", "store"]);
  }
});

test("lời trong ứng dụng khớp trang: nhắc .doc, Anthropic và liên kết trang quyền riêng tư", () => {
  const dict = read("src/dict.ts");
  const note = dict.match(/privacy_note: \{ vi: "([^"]+)", en: "([^"]+)"/)!;
  for (const s of [note[1], note[2]]) { assert.match(s, /\.doc/); assert.match(s, /Anthropic/); }
  assert.match(read("src/pages/Workspace.tsx"), /\/quyen-rieng-tu/); assert.match(read("src/pages/Workspace.tsx"), /\/en\/privacy/);
  assert.match(read("src/components/Chrome.tsx"), /\/quyen-rieng-tu/);
});

test("trang hướng dẫn không còn nói 'Không.' cộc lốc về việc lưu tài liệu và trỏ tới trang quyền riêng tư", () => {
  assert.match(read("public/huong-dan.html"), /Quyền riêng tư/); assert.match(read("public/en/guide.html"), /Privacy page/);
});
