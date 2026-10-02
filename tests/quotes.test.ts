import test from "node:test";
import assert from "node:assert/strict";
import { locateQuote, prepare } from "../shared/quotes.ts";
import { detectLang } from "../shared/lang.ts";

const doc = "[[p.1]]\nIntro text here about the tradi-\ntional approach to teaching and learning in schools.\n[[p.2]]\nStudents' engagement is the ﬁrst predictor of academic success, according to recent evidence.";

test("tìm trích đoạn qua ngắt dòng và gạch nối, suy ra trang", () => {
  const r = locateQuote(doc, "about the traditional approach to teaching and learning in schools", prepare(doc));
  assert.ok(r); assert.equal(r.page, "1");
  assert.match(r.text, /traditional approach/);
});
test("ligature và trang 2", () => {
  const r = locateQuote(doc, "engagement is the first predictor of academic success", prepare(doc));
  assert.ok(r); assert.equal(r.page, "2");
});
test("từ chối trích đoạn bịa", () => {
  assert.equal(locateQuote(doc, "this sentence never appears anywhere in the document at all", prepare(doc)), null);
});
test("nhận diện ngôn ngữ", () => {
  const en = "The purpose of this study is to examine the relationship between teachers and students in the context of digital learning. ".repeat(8);
  const vi = "Mục đích của nghiên cứu này là xem xét mối quan hệ giữa giáo viên và học sinh trong bối cảnh học tập số của các trường học tại Việt Nam. ".repeat(8);
  const fr = "Le but de cette étude est d'examiner la relation entre les enseignants et les élèves dans le contexte de l'apprentissage numérique des écoles. ".repeat(8);
  const zh = "本研究的目的是考察数字化学习背景下教师与学生之间的关系以及学校的教学方式变化".repeat(12) + " abc".repeat(10);
  assert.equal(detectLang(en), "en");
  assert.equal(detectLang(vi), "vi");
  assert.equal(detectLang(fr), "other");
  assert.notEqual(detectLang(zh), "en");
});
