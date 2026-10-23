// Xuất báo cáo phân tích ra Word (.docx) ngay trong trình duyệt; tải theo yêu cầu để không làm nặng trang chính.
import { analysisFileName, type SavedAnalysis } from "../../shared/results/analysis.ts";
import { PASS_SCORE } from "../../shared/types.ts";
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

const FONT = "Times New Roman";
const SIZE = 24;
const s = (v: unknown) => (v == null ? "" : String(v));
type O = { size?: number; bold?: boolean; italics?: boolean; color?: string; after?: number; indent?: number };
const run = (text: unknown, o: O = {}) => new TextRun({ text: s(text), font: FONT, size: o.size || SIZE, bold: o.bold, italics: o.italics, color: o.color });
const P = (text: unknown, o: O = {}) => new Paragraph({ children: [run(text, o)], alignment: AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 100, line: 290 }, indent: o.indent ? { left: o.indent } : undefined });
const label = (l: string, text: string) => new Paragraph({ children: [run(l, { bold: true }), run(text)], spacing: { after: 70, line: 290 } });
const bullet = (text: unknown, o: O = {}) => new Paragraph({ children: [run(text, o)], bullet: { level: 0 }, spacing: { after: 50, line: 280 } });
const H = (text: string, level: 1 | 2) => new Paragraph({ heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: [run(text, { bold: true, size: level === 1 ? 28 : 26 })], spacing: { before: level === 1 ? 260 : 160, after: 90 }, keepNext: true });
const bd = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const borders = { top: bd, bottom: bd, left: bd, right: bd };
const cell = (text: unknown, w: number, o: O & { head?: boolean; right?: boolean } = {}) => new TableCell({
  borders, width: { size: w, type: WidthType.PERCENTAGE }, shading: o.head ? { fill: "EDEDED" } : undefined, margins: { top: 50, bottom: 50, left: 90, right: 90 },
  children: [new Paragraph({ children: [run(text, { bold: o.bold || o.head, size: 22 })], alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT })],
});

export async function buildAnalysisDocx(a: SavedAnalysis, lang: "vi" | "en" = "vi"): Promise<Blob> {
  const L = (vi: string, en: string) => (lang === "en" ? en : vi);
  const r = a.res, m = r.meta, pass = r.score >= PASS_SCORE;
  const PRIO: Record<string, string> = { high: L("Ưu tiên cao", "High priority"), medium: L("Ưu tiên vừa", "Medium priority"), low: L("Ưu tiên thấp", "Low priority") };
  const CRIT: [keyof typeof r.breakdown, number, string, string][] = [["topic", 40, "Chủ đề", "Topic fit"], ["concept", 20, "Khái niệm, lý thuyết", "Concepts and theory"], ["method", 15, "Phương pháp", "Method"], ["evidence", 15, "Bằng chứng", "Evidence"], ["currency", 10, "Tính cập nhật", "Recency"]];
  const kids: (Paragraph | Table)[] = [];
  kids.push(new Paragraph({ children: [run(L("BÁO CÁO PHÂN TÍCH TÀI LIỆU", "SOURCE ANALYSIS REPORT"), { bold: true, size: 30 })], alignment: AlignmentType.CENTER, spacing: { after: 160 } }));
  kids.push(label(L("Tệp: ", "File: "), a.fileName));
  if (a.project) kids.push(label(L("Đề tài: ", "Study: "), a.project));
  kids.push(label(L("Ngày phân tích: ", "Analysed on: "), new Date(a.at).toLocaleString(lang === "en" ? "en-GB" : "vi-VN")));
  kids.push(label(L("Điểm phù hợp với đề tài: ", "Fit to your study: "), `${r.score}/100 · ${pass ? L("đạt ngưỡng trích dẫn (60)", "meets the citation threshold (60)") : L("chưa đạt ngưỡng trích dẫn (60)", "below the citation threshold (60)")}`));
  kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ children: [cell(L("Tiêu chí", "Criterion"), 60, { head: true }), cell(L("Tối đa", "Max"), 20, { head: true, right: true }), cell(L("Điểm", "Score"), 20, { head: true, right: true })] }),
    ...CRIT.map(([k, max, vi, en]) => new TableRow({ children: [cell(L(vi, en), 60), cell(max, 20, { right: true }), cell(r.breakdown[k], 20, { right: true })] })),
  ] }));
  kids.push(H(L("Nhận định chung", "Overall assessment"), 1), P(r.verdict[lang]));
  kids.push(H(L("Tóm tắt tài liệu", "Summary of the source"), 1), P(r.summary[lang]));
  if (r.strengths[lang].length) { kids.push(H(L("Điểm phù hợp với đề tài", "Where it fits your study"), 2)); r.strengths[lang].forEach((x) => kids.push(bullet(x))); }
  if (r.gaps[lang].length) { kids.push(H(L("Khoảng trống so với đề tài", "Gaps against your study"), 2)); r.gaps[lang].forEach((x) => kids.push(bullet(x))); }
  kids.push(H(L("Thông tin nguồn", "Source details"), 1));
  kids.push(label(L("Nhan đề: ", "Title: "), m.title), label(L("Tác giả: ", "Authors: "), m.authors.map((x) => `${x.family} ${x.given}`.trim()).join("; ")));
  if (m.year) kids.push(label(L("Năm: ", "Year: "), m.year));
  if (m.container) kids.push(label(L("Nguồn xuất bản: ", "Published in: "), m.container));
  if (m.doi) kids.push(label("DOI: ", m.doi));
  if (pass) {
    kids.push(H(L("Đoạn đáng trích dẫn", "Passages worth citing"), 1));
    if (!r.passages.length) kids.push(P(L("Không có đoạn nào được đề xuất.", "No passage was suggested.")));
    r.passages.forEach((p, i) => {
      kids.push(P(`${i + 1}. ${PRIO[p.priority] ?? p.priority}${p.page ? `, ${L("trang", "page")} ${p.page}` : ""}`, { bold: true, after: 40 }));
      kids.push(P(`“${p.quote}”`, { italics: true, indent: 360, after: 50 }));
      if (p.reason[lang]) kids.push(P(`${L("Lý do: ", "Why: ")}${p.reason[lang]}`, { indent: 360, after: 90 }));
    });
    if (r.droppedPassages) kids.push(P(L(`${r.droppedPassages} đoạn bị loại vì không khớp nguyên văn với tài liệu gốc.`, `${r.droppedPassages} passage(s) were removed because they did not match the original text.`), { italics: true }));
  } else if (r.recommendations) {
    const rec = r.recommendations;
    kids.push(H(L("Hướng đi khi điểm dưới ngưỡng", "Next steps (score below the threshold)"), 1), P(rec.advice[lang]));
    if (rec.keywords.length) kids.push(label(L("Từ khóa gợi ý: ", "Suggested keywords: "), rec.keywords.join(", ")));
    if (rec.works.length) { kids.push(H(L("Công trình gợi ý", "Suggested works"), 2)); rec.works.forEach((w) => kids.push(bullet(`${w.title} (${w.authors}${w.year ? `, ${w.year}` : ""}${w.venue ? `, ${w.venue}` : ""})${w.doi ? ` DOI ${w.doi}` : ""}`))); }
    if (rec.journals.length) { kids.push(H(L("Tạp chí gợi ý", "Suggested journals"), 2)); rec.journals.forEach((j) => kids.push(bullet(`${j.title}${j.issn.length ? ` (ISSN ${j.issn.join(", ")})` : ""}${j.quartile ? `, ${j.quartile}` : ""}${j.publisher ? `, ${j.publisher}` : ""}`))); }
  }
  kids.push(P(L("Kết quả do AI tạo để hỗ trợ đọc tài liệu. Người dùng tự kiểm chứng trước khi trích dẫn; điểm chỉ phản ánh mức phù hợp với đề tài đã nêu.", "Generated by AI to support reading. Verify before citing; the score only reflects fit to the study you described."), { italics: true, size: 22, after: 0 }));
  const doc = new Document({ creator: "Ami", title: L("Báo cáo phân tích tài liệu", "Source analysis report"), sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1417, right: 1134 } } }, children: kids }] });
  return Packer.toBlob(doc);
}

export async function buildAnalysisZip(list: SavedAnalysis[], lang: "vi" | "en" = "vi"): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip(); const used = new Set<string>();
  for (const a of list) {
    let n = analysisFileName(a, lang), i = 2;
    while (used.has(n.toLowerCase())) n = n.replace(/( \(\d+\))?\.docx$/, ` (${i++}).docx`);
    used.add(n.toLowerCase());
    zip.file(n, await buildAnalysisDocx(a, lang));
  }
  return zip.generateAsync({ type: "blob" });
}
