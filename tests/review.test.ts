import test from "node:test";
import assert from "node:assert/strict";
import { DOC_TYPES, computeScore, decide, decisionFromScore, defaultRubric } from "../shared/review/rubric.ts";
import { buildIndex, corpusToText, numberBlocks, verifyEvidence, verifyQuote } from "../shared/review/corpus.ts";
import { builtinTemplate, normalizeTemplate, sectionBatches, usesDefaultRubric } from "../shared/review/template.ts";
import { assemble, sectionDigest } from "../shared/review/assemble.ts";
import { layoutPdfPages, pdfTextProblem, type PdfItem } from "../shared/review/layout.ts";
import { SECTIONS_SCHEMA, overallSchema } from "../shared/review/schemas.ts";
import { overallPrompt, sectionsPrompt, documentBlock } from "../shared/review/prompts.ts";

const blocks = numberBlocks([
  { kind: "heading", level: 1, text: "Ứng dụng AI trong học tập" },
  { kind: "p", text: "Nghiên cứu khảo sát 120 học sinh trung học phổ thông tại một trường." },
  { kind: "p", text: "Kết quả cho thấy 85% học sinh sử dụng công cụ này hằng tuần, nhưng chưa mô tả cách chọn mẫu.", page: 3 },
  { kind: "row", text: "x", cells: ["Đề tài:", "Học tập"] },
]);

test("kiểm chứng trích dẫn: khớp, bỏ qua dấu câu, dấu \"…\", và loại trích dẫn bịa", () => {
  const idx = buildIndex(blocks);
  const ok = verifyQuote(idx, "Kết quả cho thấy 85% học sinh sử dụng công cụ này hằng tuần");
  assert.ok(ok.ok);
  assert.equal(ok.location?.paragraph, 3);
  assert.equal(ok.location?.page, 3);
  assert.ok(verifyQuote(idx, "kết quả cho thấy 85 học sinh sử dụng công cụ này hằng tuần!").ok);
  assert.ok(verifyQuote(idx, "Kết quả cho thấy 85% học sinh … chưa mô tả cách chọn mẫu").ok);
  assert.ok(!verifyQuote(idx, "Kết quả cho thấy 95% học sinh sử dụng công cụ này hằng tuần").ok);
  assert.ok(!verifyQuote(idx, "ngắn quá").ok);
  const { kept, dropped } = verifyEvidence(idx, [{ quote: "Nghiên cứu khảo sát 120 học sinh trung học phổ thông" }, { quote: "một câu hoàn toàn bịa đặt không có trong tài liệu" }, { quote: "nghiên cứu khảo sát 120 học sinh trung học phổ thông" }]);
  assert.equal(kept.length, 1);
  assert.equal(dropped, 1);
});

test("văn bản gửi AI có số đoạn và số trang", () => {
  const t = corpusToText(blocks);
  assert.match(t, /\[¶1\] # Ứng dụng AI/);
  assert.match(t, /--- trang 3 ---\n\[¶3\]/);
  assert.match(t, /\[¶4\] \| Đề tài: \| Học tập \|/);
});

test("ngưỡng khuyến nghị, sàn khuyết điểm nghiêm trọng, thang điểm cộng đúng 100", () => {
  assert.equal(decisionFromScore(39.9), "reject");
  assert.equal(decisionFromScore(40), "major_revision");
  assert.equal(decisionFromScore(55), "minor_revision");
  assert.equal(decisionFromScore(60), "accept_with_conditions");
  assert.equal(decisionFromScore(75), "accept");
  assert.ok(decide(58, []).belowPass);
  const d = decide(82, [{ severity: "fatal" }]);
  assert.equal(d.key, "major_revision");
  assert.ok(d.floorApplied);
  assert.equal(decide(82, [{ severity: "serious" }]).key, "accept");
  for (const t of Object.keys(DOC_TYPES)) assert.equal(defaultRubric(t).reduce((s, c) => s + c.max, 0), 100, t);
  const r = computeScore([{ max: 4, points: 9 }, { max: 6, points: 3 }, { max: 0, points: 5 }]);
  assert.equal(r.score100, 70);
  assert.equal(computeScore([{ max: 10, points: -3 }]).score100, 0);
});

test("mẫu có sẵn đủ mục, có kết luận; chuẩn hóa mẫu từ người dùng", () => {
  const t = builtinTemplate("thesis");
  assert.equal(t.sections.length, 8);
  assert.equal(t.sections.at(-1)?.kind, "conclusion");
  assert.ok(usesDefaultRubric(t));
  assert.deepEqual(sectionBatches(t, 4), [["s1", "s2", "s3", "s4"], ["s5", "s6", "s7", "s8"]]);
  assert.throws(() => normalizeTemplate({ sections: [{ title: "  " }] }), /template_empty/);
  const n = normalizeTemplate({ sections: [{ title: "A", level: 9, kind: "xx" as never, max_points: -5 }, { title: "B", max_points: 10 }] });
  assert.deepEqual(n.sections.map((s) => [s.id, s.level, s.kind, s.max_points]), [["s1", 3, "narrative", 0], ["s2", 1, "narrative", 10]]);
  assert.ok(!usesDefaultRubric(n));
  assert.equal(normalizeTemplate({ sections: Array.from({ length: 80 }, (_, i) => ({ title: `m${i}` })) }).sections.length, 40);
});

test("assemble: bỏ trích dẫn bịa, tính điểm bằng mã, báo mục thiếu và lệch khuyến nghị", () => {
  const template = builtinTemplate("thesis");
  const meta = { docType: "thesis", role: "reviewer" };
  const sections = [{ section_id: "s1", content: "ok", strengths: ["a"], weaknesses: ["b"], revisions: [{ priority: "bat_buoc", action: "sửa" }], evidence: [{ quote: "Nghiên cứu khảo sát 120 học sinh trung học phổ thông" }, { quote: "câu bịa đặt hoàn toàn không tồn tại" }], points: 0, point_rationale: "", insufficient_basis: false }];
  const overall = {
    document_profile: { title: "T", author: "A" }, info_values: [{ label: "Tên", value: "T" }],
    rubric_scores: defaultRubric("thesis").map((c) => ({ criterion_id: c.id, points: c.max, rationale: "r", evidence: [] })),
    fatal_defects: [{ severity: "fatal", description: "d", evidence: [] }], integrity_notes: [],
    overall: { summary: "s", main_strengths: [], main_weaknesses: [], conclusion_text: "c", proposed_decision: "accept" },
    questions_for_author: ["q"], limitations: ["l"],
  };
  const r = assemble({ sections, overall, template, blocks, meta, fileName: "x.docx", model: "m" });
  assert.equal(r.score.score100, 100);
  assert.equal(r.decision.key, "major_revision"); // sàn do khuyết điểm "fatal"
  assert.equal(r.decision.mismatch?.model, "accept");
  assert.equal(r.verification.kept, 1);
  assert.equal(r.verification.dropped, 1);
  assert.equal(r.sections.filter((s) => s.missing).length, 7);
  assert.equal(r.warnings.length, 7);
  assert.equal(r.file.pages, 3);
  assert.match(sectionDigest(template, sections), /Ưu điểm: a/);
  // Thiếu hết điểm thành phần: không có điểm tổng, không bịa khuyến nghị.
  const none = assemble({ sections: [], overall: {}, template, blocks, meta, fileName: "x", model: "m" });
  assert.equal(none.decision.key, "unscored");
  assert.equal(none.score.sumMax, 0);
});

test("assemble: mẫu có điểm riêng thì chấm theo mục của mẫu", () => {
  const template = normalizeTemplate({ sections: [{ title: "A", kind: "scored", max_points: 4 }, { title: "B", kind: "scored", max_points: 6 }] });
  const r = assemble({ sections: [{ section_id: "s1", points: 4 }, { section_id: "s2", points: 3 }], overall: {}, template, blocks, meta: { docType: "other", role: "other" }, fileName: "x", model: "m" });
  assert.equal(r.score.scheme, "template");
  assert.equal(r.score.score100, 70);
});

test("dựng đoạn văn từ mảnh chữ PDF, bỏ số trang; phát hiện PDF scan", () => {
  const it = (str: string, y: number, h = 12): PdfItem => ({ str, x: 50, y, h, w: str.length * 6 });
  const page = (n: number): PdfItem[] => [
    it("1. Giới thiệu", 700, 16),
    it("Đây là câu đầu của đoạn văn đầu tiên và", 650), it("tiếp tục sang dòng kế tiếp của đoạn.", 636),
    it("Đoạn thứ hai bắt đầu sau khoảng cách lớn hơn.", 600),
    it(String(n), 40),
  ];
  const b = layoutPdfPages([page(1), page(2)]);
  assert.equal(b[0].kind, "bold");
  assert.equal(b[1].text, "Đây là câu đầu của đoạn văn đầu tiên và tiếp tục sang dòng kế tiếp của đoạn.");
  assert.ok(!b.some((x) => /^\d$/.test(x.text)));
  assert.equal(b.find((x) => x.page === 2)?.page, 2);
  assert.equal(pdfTextProblem(["", "  ", ""]), "scan");
  assert.equal(pdfTextProblem(["Văn bản tiếng Việt bình thường ".repeat(20), "Trang hai cũng có chữ ".repeat(20)]), null);
});

test("lược đồ và lời nhắc: lô mục, tổng hợp theo thang mặc định", () => {
  const t = builtinTemplate("article");
  const rub = defaultRubric("article");
  const p1 = sectionsPrompt({ m: { docType: "article", role: "reviewer" }, template: t, rubric: rub, ids: ["s1", "s2"] });
  assert.match(p1, /CHỈ soạn nhận xét cho 2 mục/);
  assert.ok(!p1.includes('"id": "s3"'));
  const p2 = overallPrompt({ m: { docType: "article", role: "reviewer" }, template: t, rubric: rub, sectionDigest: "x" });
  assert.match(p2, /rubric_scores/);
  assert.ok((overallSchema({ withRubric: true }) as { properties: Record<string, unknown> }).properties.rubric_scores);
  assert.ok(!(overallSchema({ withRubric: false }) as { properties: Record<string, unknown> }).properties.rubric_scores);
  assert.ok(SECTIONS_SCHEMA);
  assert.match(documentBlock("abc"), /^<tai_lieu>\nabc\n<\/tai_lieu>$/);
});

test("nhãn kết quả theo ngôn ngữ: loại văn bản, vai trò, khuyến nghị, thang điểm, mẫu có sẵn, cảnh báo", async () => {
  const { labelsFor, defaultRubric, DOC_TYPES, DECISIONS } = await import("../shared/review/rubric.ts");
  const en = labelsFor("en"), vi = labelsFor("vi");
  assert.equal(en.docType("thesis"), "Master's thesis"); assert.equal(vi.docType("thesis"), "Luận văn thạc sĩ");
  assert.equal(en.role("reviewer"), "Reviewer"); assert.equal(en.docType("lạ"), "Other scientific work");
  for (const k of Object.keys(DECISIONS)) { assert.ok(en.decision(k).label && en.decision(k).advice, k); assert.notEqual(en.decision(k).short, vi.decision(k).short); }
  assert.match(en.decision("unscored").label, /Not scored/);
  for (const t of Object.keys(DOC_TYPES)) {
    const v = defaultRubric(t, "vi"), e = defaultRubric(t, "en");
    assert.deepEqual(e.map((c) => [c.id, c.max]), v.map((c) => [c.id, c.max]));
    assert.ok(e.every((c) => /^[A-Za-z]/.test(c.label)) && e.reduce((s, c) => s + c.max, 0) === 100, t);
  }
  const tpl = builtinTemplate("proposal", "en");
  assert.equal(tpl.language, "en"); assert.match(tpl.template_title, /Review form: research proposal/); assert.equal(tpl.sections.at(-1)?.title, "Conclusion and recommendations");
  const r = assemble({ sections: [], overall: {}, template: tpl, blocks, meta: { docType: "proposal", role: "reviewer", lang: "en" }, fileName: "x", model: "m" });
  assert.equal(r.meta.docTypeLabel, "Research proposal");
  assert.ok(r.warnings.every((w) => /^(Section|Criterion|The total)/.test(w)), r.warnings.join("|"));
});
