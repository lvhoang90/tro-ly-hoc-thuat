import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHandoff } from "../src/lib/handoff.ts";

test("nhận tên tạp chí từ EduFind và ProFind, ghi nhận đúng nguồn", () => {
  assert.deepEqual(parseHandoff("?journal=Tạp%20chí%20Giáo%20dục&utm_source=edufind"), { journal: "Tạp chí Giáo dục", source: "edufind" });
  assert.deepEqual(parseHandoff("?utm_source=profind&journal=Journal%20of%20Education"), { journal: "Journal of Education", source: "profind" });
});

test("không nhận khi nguồn lạ hoặc thiếu tên", () => {
  assert.equal(parseHandoff("?journal=A&utm_source=facebook"), null);
  assert.equal(parseHandoff("?journal=A"), null);
  assert.equal(parseHandoff("?utm_source=profind"), null);
  assert.equal(parseHandoff("?journal=%20%20&utm_source=profind"), null);
});

test("làm sạch ký tự lạ và cắt 140 ký tự", () => {
  const h = parseHandoff(`?journal=${encodeURIComponent("<b>Tên\n  tạp\tchí</b>")}&utm_source=profind`)!;
  assert.equal(h.journal, "b Tên tạp chí /b");
  assert.equal(parseHandoff(`?journal=${"x".repeat(300)}&utm_source=edufind`)!.journal.length, 140);
});
