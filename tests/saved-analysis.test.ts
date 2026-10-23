import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { analysisFileName, analysisLabel, analysisName, isSavedAnalysis, type SavedAnalysis } from "../shared/results/analysis.ts";
import { buildAnalysisDocx, buildAnalysisZip } from "../src/lib/analysis-docx.ts";
import type { AnalysisResult } from "../shared/types.ts";

const bi = <T,>(vi: T, en: T) => ({ vi, en });
function sample(score: number, name = "Bai bao A.pdf"): SavedAnalysis {
  const res: AnalysisResult = {
    language: "vi", score, breakdown: { topic: 30, concept: 15, method: 10, evidence: 10, currency: 5 },
    verdict: bi("Nguồn khá phù hợp với đề tài.", "A fairly good fit."), summary: bi("Bài khảo sát năng lực số của học sinh.", "A survey of pupils' digital skills."),
    strengths: bi(["Cùng bối cảnh"], ["Same setting"]), gaps: bi(["Thiếu phần phương pháp"], ["Method is thin"]),
    meta: { type: "article", title: "Năng lực số của học sinh", authors: [{ family: "Nguyễn", given: "An" }], year: "2024", container: "Tạp chí Giáo dục", publisher: "", volume: "", issue: "", pages: "", doi: "10.1/abc", url: "" },
    passages: score >= 60 ? [{ id: "p1", quote: "Năng lực số là khả năng sử dụng công nghệ một cách an toàn.", page: "4", priority: "high", rank: 1, reason: bi("Định nghĩa rõ", "Clear definition"), use: "definition" }] : [],
    droppedPassages: 1,
    recommendations: score >= 60 ? null : { advice: bi("Tìm nguồn khác", "Find another source"), queries: [], keywords: ["năng lực số"], works: [{ title: "Một công trình", authors: "Lê B", year: 2023, venue: "JER", doi: "10.2/x", url: "", citedBy: 3, openAccess: true, issn: [] }], journals: [{ title: "Tạp chí Giáo dục", issn: ["2354-0753"], publisher: "Bộ GD&ĐT", quartile: "", sjr: null, openAccess: false, domestic: true, why: "venue", discipline: bi("Giáo dục", "Education"), url: "" }], disciplines: [], edufind: { url: "" } },
    quota: null, truncated: false,
  };
  return { v: 1, fileName: name, project: "Đề tài thử", at: "2026-10-20T08:00:00Z", res };
}
const text = async (b: Blob) => { const z = await JSZip.loadAsync(Buffer.from(await b.arrayBuffer())); return (await z.file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); };

test("nhận dạng bản phân tích đã lưu hợp lệ và loại bản hỏng", () => {
  assert.ok(isSavedAnalysis(sample(70)));
  for (const bad of [null, {}, { v: 2 }, { ...sample(70), res: null }, { ...sample(70), fileName: 5 }, "x"]) assert.equal(isSavedAnalysis(bad), false);
});

test("tên hiển thị, nhãn và tên tệp Word", () => {
  assert.equal(analysisName(sample(70)), "Năng lực số của học sinh");
  assert.equal(analysisLabel(sample(70)), "pass"); assert.equal(analysisLabel(sample(59)), "fail");
  assert.equal(analysisFileName(sample(70, "A/B:c.pdf")), "Phan-tich - A B c.docx");
  assert.equal(analysisFileName(sample(70), "en"), "Analysis - Bai bao A.docx");
});

test("báo cáo Word đạt ngưỡng: có điểm, nhận định, đoạn trích nguyên văn kèm trang", async () => {
  const t = await text(await buildAnalysisDocx(sample(82), "vi"));
  for (const s of ["BÁO CÁO PHÂN TÍCH TÀI LIỆU", "82/100", "đạt ngưỡng trích dẫn", "Năng lực số là khả năng sử dụng công nghệ một cách an toàn.", "trang 4", "Định nghĩa rõ", "10.1/abc", "1 đoạn bị loại"]) assert.ok(t.includes(s), s);
});

test("báo cáo Word dưới ngưỡng: có hướng đi, công trình và tạp chí gợi ý; bản tiếng Anh", async () => {
  const vi = await text(await buildAnalysisDocx(sample(45), "vi"));
  for (const s of ["chưa đạt ngưỡng", "Tìm nguồn khác", "Một công trình", "2354-0753"]) assert.ok(vi.includes(s), s);
  const en = await text(await buildAnalysisDocx(sample(45), "en"));
  for (const s of ["SOURCE ANALYSIS REPORT", "below the citation threshold", "Find another source"]) assert.ok(en.includes(s), s);
});

test("gói .zip: mỗi bản một tệp, trùng tên thì thêm số", async () => {
  const z = await JSZip.loadAsync(Buffer.from(await (await buildAnalysisZip([sample(70, "A.pdf"), sample(50, "A.pdf"), sample(60, "B.pdf")], "vi")).arrayBuffer()));
  assert.deepEqual(Object.keys(z.files).sort(), ["Phan-tich - A (2).docx", "Phan-tich - A.docx", "Phan-tich - B.docx"]);
});
