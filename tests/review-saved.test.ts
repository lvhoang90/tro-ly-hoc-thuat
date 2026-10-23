import test from "node:test";
import assert from "node:assert/strict";
import { filterSaved, isUsable, sortSaved, type SavedLike } from "../shared/review/saved.ts";

const mk = (id: string, name: string, at: string, score: number, sumMax = 100): SavedLike => ({ id, at, result: { file: { name }, score: { score100: score, sumMax } } });
const L = [
  mk("a", "Nguyễn Văn An.docx", "2026-10-01T08:00:00Z", 70),
  mk("b", "Đặng Thị Bình.docx", "2026-10-03T08:00:00Z", 55),
  mk("c", "Lê Văn Cường.pdf", "2026-10-02T08:00:00Z", 88),
  mk("d", "Không chấm điểm.docx", "2026-10-04T08:00:00Z", 0, 0),
];

test("lọc theo tên không phân biệt hoa thường và dấu", () => {
  assert.deepEqual(filterSaved(L, "dang").map((x) => x.id), ["b"]);
  assert.deepEqual(filterSaved(L, "VĂN").map((x) => x.id), ["a", "c"]);
  assert.deepEqual(filterSaved(L, " nguyen van ").map((x) => x.id), ["a"]);
  assert.equal(filterSaved(L, "").length, 4);
  assert.deepEqual(filterSaved(L, "zzz"), []);
});

test("sắp xếp: mới, cũ, điểm, tên; bản không chấm điểm luôn xuống cuối khi xếp theo điểm", () => {
  assert.deepEqual(sortSaved(L, "new").map((x) => x.id), ["d", "b", "c", "a"]);
  assert.deepEqual(sortSaved(L, "old").map((x) => x.id), ["a", "c", "b", "d"]);
  assert.deepEqual(sortSaved(L, "score_hi").map((x) => x.id), ["c", "a", "b", "d"]);
  assert.deepEqual(sortSaved(L, "score_lo").map((x) => x.id), ["b", "a", "c", "d"]);
  assert.deepEqual(sortSaved(L, "name").map((x) => x.id), ["b", "d", "c", "a"]);
  assert.equal(L[0].id, "a"); // không đổi mảng gốc
});

test("loại mục hỏng khỏi danh sách lưu", () => {
  assert.ok(isUsable(L[0]));
  for (const bad of [null, {}, { id: "x" }, { id: "x", at: "t", result: {} }, { id: "x", at: "t", result: { file: { name: "a" }, score: {} } }, "x", 5]) assert.equal(isUsable(bad), false);
});
