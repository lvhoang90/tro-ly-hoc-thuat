import test from "node:test";
import assert from "node:assert/strict";
import { formatCitation, toPlain, normDoi } from "../shared/citation.ts";
import type { SourceMeta } from "../shared/types.ts";

const art: SourceMeta = {
  type: "article", title: "Teacher beliefs about digital learning", year: "2021",
  authors: [{ family: "Smith", given: "John Adam" }, { family: "Nguyễn", given: "Văn An" }, { family: "Lee", given: "Min-ho" }],
  container: "Computers & Education", publisher: "", volume: "12", issue: "3", pages: "45-67", doi: "https://doi.org/10.1000/xyz123", url: "", lang: "en",
};
const f = (style: any, lang: any = "en", m = art, page?: string) => formatCitation(m, { style, lang, page });

test("APA 7 bài báo", () => {
  const c = f("apa");
  assert.equal(toPlain(c.reference), "Smith, J. A., Nguyễn, V. A., & Lee, M.-H. (2021). Teacher beliefs about digital learning. Computers & Education, 12(3), 45–67. https://doi.org/10.1000/xyz123");
  assert.equal(c.inText, "(Smith et al., 2021)");
  assert.equal(f("apa", "en", art, "50").inText, "(Smith et al., 2021, p. 50)");
});
test("APA tiếng Việt dùng từ nối Việt", () => {
  const m = { ...art, authors: art.authors.slice(0, 2) };
  assert.equal(f("apa", "vi", m).inText, "(Smith và Nguyễn Văn An, 2021)");
  assert.match(toPlain(f("apa", "vi", m).reference), /^Smith, J\. A\. và Nguyễn Văn An \(2021\)/);
  assert.equal(f("apa", "vi", art, "50").inText, "(Smith và cs., 2021, tr. 50)");
});
test("MLA, Chicago, Harvard, IEEE, Vancouver", () => {
  assert.match(toPlain(f("mla").reference), /^Smith, John Adam, et al\. "Teacher beliefs about digital learning\." Computers & Education, vol\. 12, no\. 3, 2021, pp\. 45-67\./);
  assert.match(toPlain(f("chicago").reference), /^Smith, John Adam, Văn An Nguyễn, and Min-ho Lee\. 2021\. "Teacher beliefs about digital learning\." Computers & Education 12 \(3\): 45–67\./);
  assert.match(toPlain(f("harvard").reference), /^Smith, J\. A\., Nguyễn, V\. A\. and Lee, M\.-H\. \(2021\) 'Teacher beliefs about digital learning', Computers & Education, 12\(3\), pp\. 45–67\. doi:10\.1000\/xyz123\./);
  assert.match(toPlain(f("ieee").reference), /^\[1\] J\. A\. Smith, V\. A\. Nguyễn, and M\.-H\. Lee, "Teacher beliefs about digital learning," Computers & Education, vol\. 12, no\. 3, pp\. 45–67, 2021, doi: 10\.1000\/xyz123\./);
  assert.match(toPlain(f("vancouver").reference), /^1\. Smith JA, Nguyễn VA, Lee MH\. Teacher beliefs about digital learning\. Computers & Education\. 2021;12\(3\):45-67\. doi:10\.1000\/xyz123/);
});
test("BibTeX và RIS", () => {
  assert.match(f("bibtex").reference, /@article\{smith2021teacher,/);
  assert.match(f("ris").reference, /TY {2}- JOUR[\s\S]*SP {2}- 45[\s\S]*EP {2}- 67[\s\S]*ER/);
});
test("DOI", () => assert.equal(normDoi("doi: 10.1/ab"), "10.1/ab"));

test("Việt và Anh cho kết quả khác nhau: tên người Việt đầy đủ khi trích dẫn tiếng Việt", () => {
  const vn: SourceMeta = { type: "article", title: "Quản trị nhà trường", year: "2020", authors: [{ family: "Nguyễn", given: "Văn An" }, { family: "Trần", given: "Thị Bình" }], container: "Tạp chí Giáo dục", publisher: "", volume: "12", issue: "3", pages: "45-67", doi: "", url: "", lang: "vi" };
  const vi = formatCitation(vn, { style: "apa", lang: "vi", page: "50" });
  const en = formatCitation(vn, { style: "apa", lang: "en", page: "50" });
  assert.equal(toPlain(vi.reference), "Nguyễn Văn An và Trần Thị Bình (2020). Quản trị nhà trường. Tạp chí Giáo dục, 12(3), 45–67.");
  assert.equal(vi.inText, "(Nguyễn Văn An và Trần Thị Bình, 2020, tr. 50)");
  assert.equal(toPlain(en.reference), "Nguyễn, V. A., & Trần, T. B. (2020). Quản trị nhà trường. Tạp chí Giáo dục, 12(3), 45–67.");
  assert.equal(en.inText, "(Nguyễn & Trần, 2020, p. 50)");
  assert.notEqual(vi.reference, en.reference);
});
