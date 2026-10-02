import test from "node:test";
import assert from "node:assert/strict";
import { htmlToMarked, toCslItem } from "../src/lib/csl.ts";

test("htmlToMarked: chữ nghiêng, thực thể, khoảng cách lề trái/phải", () => {
  assert.equal(htmlToMarked('<div class="csl-entry"><div class="csl-left-margin">[1]</div><div class="csl-right-inline">A &amp; B, <i>Journal</i>.</div></div>'), "[1] A & B, *Journal*.");
  assert.equal(htmlToMarked("x<sup>2</sup>"), "x^2^");
});
test("toCslItem: ánh xạ loại và trường", () => {
  const it = toCslItem({ type: "chapter", title: "T", authors: [{ family: "Nguyễn", given: "An" }], year: "2020", container: "Book", publisher: "P", volume: "", issue: "", pages: "1 – 9", doi: "doi: 10.1/x", url: "", lang: "vi" }, "vi") as any;
  assert.equal(it.type, "chapter"); assert.equal(it["container-title"], "Book"); assert.equal(it.page, "1-9"); assert.equal(it.DOI, "10.1/x");
  assert.deepEqual(it.issued, { "date-parts": [[2020]] }); assert.equal(it.language, "vi-VN");
});
