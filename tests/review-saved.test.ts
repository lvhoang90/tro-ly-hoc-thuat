import test from "node:test";
import assert from "node:assert/strict";
import { filterRows, isUsable, mergeRows, missingInCloud, sortRows, type ResultMeta } from "../shared/review/saved.ts";

const mk = (id: string, name: string, at: string, score: number | null): ResultMeta => ({ id, at, name, score, label: "" });
const L = [
  mk("a", "Nguyễn Văn An.docx", "2026-10-01T08:00:00Z", 70),
  mk("b", "Đặng Thị Bình.docx", "2026-10-03T08:00:00Z", 55),
  mk("c", "Lê Văn Cường.pdf", "2026-10-02T08:00:00Z", 88),
  mk("d", "Không chấm điểm.docx", "2026-10-04T08:00:00Z", null),
];

test("lọc theo tên không phân biệt hoa thường và dấu", () => {
  assert.deepEqual(filterRows(L, "dang").map((x) => x.id), ["b"]);
  assert.deepEqual(filterRows(L, "VĂN").map((x) => x.id), ["a", "c"]);
  assert.deepEqual(filterRows(L, " nguyen van ").map((x) => x.id), ["a"]);
  assert.equal(filterRows(L, "").length, 4);
  assert.deepEqual(filterRows(L, "zzz"), []);
});

test("sắp xếp: mới, cũ, điểm, tên; bản không chấm điểm luôn xuống cuối khi xếp theo điểm", () => {
  assert.deepEqual(sortRows(L, "new").map((x) => x.id), ["d", "b", "c", "a"]);
  assert.deepEqual(sortRows(L, "old").map((x) => x.id), ["a", "c", "b", "d"]);
  assert.deepEqual(sortRows(L, "score_hi").map((x) => x.id), ["c", "a", "b", "d"]);
  assert.deepEqual(sortRows(L, "score_lo").map((x) => x.id), ["b", "a", "c", "d"]);
  assert.deepEqual(sortRows(L, "name").map((x) => x.id), ["b", "d", "c", "a"]);
  assert.equal(L[0].id, "a"); // không đổi mảng gốc
});

test("loại mục lưu cục bộ hỏng", () => {
  const ok = { id: "x", at: "t", result: { file: { name: "a" }, score: { score100: 1, sumMax: 100 } } };
  assert.ok(isUsable(ok));
  for (const bad of [null, {}, { id: "x" }, { id: "x", at: "t", result: {} }, { id: "x", at: "t", result: { file: { name: "a" }, score: {} } }, "x", 5]) assert.equal(isUsable(bad), false);
});

test("ghép danh sách trên máy và trên tài khoản: hợp theo mã, ưu tiên thông tin trên máy", () => {
  const local = [mk("a", "A (đã sửa).docx", "2026-10-01T08:00:00Z", 71), mk("l", "Chỉ trên máy.docx", "2026-10-05T08:00:00Z", 60)];
  const cloud = [mk("a", "A.docx", "2026-10-01T08:00:00Z", 70), mk("z", "Từ máy khác.docx", "2026-10-06T08:00:00Z", 90)];
  const rows = mergeRows(local, cloud);
  assert.deepEqual(rows.map((r) => [r.id, r.local, r.cloud]), [["z", false, true], ["l", true, false], ["a", true, true]]);
  assert.equal(rows.find((r) => r.id === "a")!.name, "A (đã sửa).docx");
  assert.deepEqual(mergeRows(local, null).map((r) => [r.id, r.cloud]), [["l", false], ["a", false]]);
});

test("bản chỉ có trên máy cần tải lên; chưa biết danh sách tài khoản thì không tải lên gì", () => {
  const local = [mk("a", "A", "2026-10-01T08:00:00Z", 1), mk("b", "B", "2026-10-02T08:00:00Z", 2)];
  assert.deepEqual(missingInCloud(local, [mk("a", "A", "2026-10-01T08:00:00Z", 1)]), ["b"]);
  assert.deepEqual(missingInCloud(local, []), ["a", "b"]);
  assert.deepEqual(missingInCloud(local, null), []);
});
