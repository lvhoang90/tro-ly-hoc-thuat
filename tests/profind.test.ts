// So khớp tác giả với chỉ mục ProFind (mẫu thật trích từ chỉ mục công khai).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchAuthors, mainPick, nameSim, pct, profindAuthorUrl, suggest, type Idx } from "../shared/profind.ts";

const idx = JSON.parse(readFileSync(new URL("./fixtures/profind-suggest.sample.json", import.meta.url), "utf8")) as Idx;

test("tên khớp không phân biệt dấu, thứ tự và dấu gạch nối", () => {
  const [a] = matchAuthors(idx, [{ family: "Tran", given: "Minh-Triet" }]);
  assert.equal(a.hits[0]?.name, "Minh-Triet Tran");
  assert.ok(a.hits[0].units.length > 0 && a.hits[0].works > 0);
  const [b] = matchAuthors(idx, [{ family: "Minh-Triet", given: "Tran" }]);
  assert.equal(b.hits[0]?.id, a.hits[0].id, "đảo họ và tên vẫn khớp");
  const [c] = matchAuthors(idx, [{ family: "TRẦN", given: "Bách Xuân" }]);
  assert.equal(c.hits[0]?.name, "Bach Xuan Tran", "có dấu tiếng Việt");
});

test("tên viết tắt hoặc thiếu họ không được nhận nhầm", () => {
  const r = matchAuthors(idx, [{ family: "Tran", given: "M." }, { family: "Tran", given: "" }, { family: "Krunz", given: "M" }]);
  assert.deepEqual(r.map((x) => x.hits.length), [0, 0, 0]);
});

test("nhiều người trùng tên: trả tối đa max, nhiều công trình nhất trước, và báo tổng số", () => {
  const r = matchAuthors(idx, [{ family: "Nguyen", given: "Van An" }], 2)[0];
  assert.ok(r.total >= 1 && r.hits.length <= 2);
  for (let i = 1; i < r.hits.length; i++) assert.ok(r.hits[i - 1].works >= r.hits[i].works);
});

test("khác phần đệm vẫn khớp ở mức 0,9 (Nguyễn Thị Lan = Nguyen Lan)", () => {
  assert.equal(nameSim(["nguyen", "thi", "lan"], ["nguyen", "lan"]), 0.9);
  assert.equal(nameSim(["nguyen", "van", "an"], ["an", "van", "nguyen"]), 1);
  assert.equal(nameSim(["tran"], ["tran", "an"]), 0);
});

test("gợi ý hồ sơ của người dùng: ORCID trùng là 100%, tên + tên miền email là đề xuất chính", () => {
  const r = idx.a.find((x) => x[6] && x[2].length)!;
  const byOrcid = suggest(idx, { name: "Ai Do", email: "a@gmail.com", org: "" }, r[6]);
  assert.equal(byOrcid[0].id, r[0]); assert.equal(pct(byOrcid[0]), 100);
  const dom = Object.entries(idx.d)[0];
  const row = idx.a.find((x) => x[2].some((u) => dom[1].includes(u)))!;
  const c = suggest(idx, { name: row[1], email: `x@${dom[0]}`, org: "" });
  assert.equal(c[0].id, row[0]);
  assert.ok(c[0].score >= 70 && mainPick(c) === row[0]);
  assert.equal(suggest(idx, { name: "Người Không Có", email: "n@x.vn", org: "" }).length, 0);
});

test("liên kết ProFind mang nguồn Ami và mã tác giả đã mã hóa", () => {
  assert.equal(profindAuthorUrl("A123"), "https://isavn.edu.vn/go/profind?from=ami&hash=%2Ftac-gia%2FA123");
});
