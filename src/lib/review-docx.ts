// Xuất bản nhận xét ra Word (.docx) ngay trong trình duyệt; tải theo yêu cầu để không làm nặng trang chính. Chuyển từ ứng dụng "Trợ lý phản biện học thuật".
import type { ReviewResult } from "../../shared/review/assemble.ts";
import { labelsFor, type Evidence } from "../../shared/review/rubric.ts";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, Footer, PageNumber,
} from "docx";

const FONT = 'Times New Roman';
const SIZE = 26; // 13pt
const s = (v: unknown) => (v == null ? '' : String(v));
const paras = (text: unknown) => s(text).split(/\n{1,}/).map((t) => t.trim()).filter(Boolean);

type O = { size?: number; bold?: boolean; italics?: boolean; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; indent?: number; head?: boolean; right?: boolean };
const run = (text: unknown, o: O = {}) => new TextRun({ text: s(text), font: FONT, size: o.size || SIZE, bold: o.bold, italics: o.italics, color: o.color });
const P = (text: unknown, o: O = {}) => new Paragraph({
  children: [run(text, o)], alignment: o.align || AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 100, line: 300 },
  indent: o.indent ? { left: o.indent } : undefined,
});
const label = (l: string, text: string) => new Paragraph({ children: [run(l, { bold: true }), run(text)], spacing: { after: 80, line: 300 }, alignment: AlignmentType.JUSTIFIED });
const bullet = (text: unknown, o: O = {}) => new Paragraph({ children: [run(text, o)], bullet: { level: 0 }, spacing: { after: 60, line: 290 }, alignment: AlignmentType.JUSTIFIED });
const H = (text: string, level: number) => new Paragraph({
  heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level - 1],
  children: [run(text, { bold: true, size: level === 1 ? 28 : SIZE })], spacing: { before: level === 1 ? 280 : 180, after: 100 }, keepNext: true,
});

const border = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (text: unknown, w: number, o: O = {}) => new TableCell({
  borders, width: { size: w, type: WidthType.PERCENTAGE },
  shading: o.head ? { fill: 'EDEDED' } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({ children: [run(text, { bold: o.bold || o.head, size: 24 })], alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT })],
});

type Tr = (vi: string, en: string) => string;
const refOf = (e: Evidence, L: Tr) => `${e.paragraph ? `${L('đoạn', 'paragraph')} ¶${e.paragraph}` : ''}${e.page ? `, ${L('trang', 'page')} ${e.page}` : ''}`.replace(/, $/, '');

function evidenceBlock(L: Tr, evs?: Evidence[]) {
  if (!evs?.length) return [];
  const out: Paragraph[] = [P(L('Căn cứ trong văn bản:', 'Evidence in the text:'), { bold: true, after: 40 })];
  for (const e of evs) out.push(P(`“${s(e.quote)}” (${refOf(e, L) || L('vị trí không xác định', 'location unknown')})`, { italics: true, size: 24, indent: 360, after: 60 }));
  return out;
}

/** Tên tệp nhận xét theo công trình: "Nhan-xet - <tên tệp gốc>.docx" (tiếng Anh: "Review - …"). */
export function exportFileName(r: ReviewResult, lang: 'vi' | 'en' = 'vi') {
  const base = String(r?.file?.name || 'cong-trinh').replace(/\.(docx|pdf)$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || (lang === 'en' ? 'work' : 'cong-trinh');
  return `${lang === 'en' ? 'Review' : 'Nhan-xet'} - ${base}.docx`;
}
export function uniqueName(name: string, used: Set<string>) {
  let n = name, i = 2;
  while (used.has(n.toLowerCase())) n = name.replace(/\.docx$/, ` (${i++}).docx`);
  used.add(n.toLowerCase());
  return n;
}

export async function buildDocx(r: ReviewResult, lang: 'vi' | 'en' = 'vi'): Promise<Blob> {
  const L: Tr = (vi, en) => (lang === 'en' ? en : vi);
  const PRIORITY: Record<string, string> = { bat_buoc: L('Bắt buộc', 'Required'), nen_lam: L('Nên thực hiện', 'Recommended'), goi_y: L('Gợi ý', 'Suggestion') };
  const dec = labelsFor(lang).decision(r.decision.key);
  const body: (Paragraph | Table)[] = [];
  const t = r.template;
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(s(t.title || L('PHIẾU NHẬN XÉT', 'REVIEW FORM')).toUpperCase(), { bold: true, size: 30 })] }));
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [run(L('Bản nháp do hệ thống hỗ trợ soạn thảo — người nhận xét thẩm định, chỉnh sửa và chịu trách nhiệm về nội dung cuối cùng', 'A draft prepared with system assistance. The reviewer verifies, edits and remains responsible for the final text.'), { italics: true, size: 22 })] }));

  // Mỗi bản nhận xét nêu rõ công trình nào để không nhầm giữa nhiều tác giả.
  const wk = r.file?.name;
  if (wk) body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(`${L('Công trình', 'Work')}: ${s(r.profile?.title && r.profile.title !== 'Không xác định' && r.profile.title !== 'Unknown' ? r.profile.title + ' — ' : '')}${L('tệp', 'file')} “${s(wk)}”`, { size: 22 })] }));
  const info = (r.info || []).filter((x) => x.label);
  if (info.length) {
    body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: info.map((x) => new TableRow({ children: [cell(x.label, 35, { bold: true }), cell(x.value, 65)] })) }));
    body.push(P('', { after: 120 }));
  }

  for (const sec of r.sections || []) {
    body.push(H(`${s(sec.number)} ${s(sec.title)}`.trim(), Math.min(3, Math.max(1, sec.level || 1))));
    if (sec.insufficient_basis) body.push(P(L('Lưu ý: văn bản được nộp chưa đủ cơ sở để đánh giá đầy đủ mục này.', 'Note: the submitted text is not enough to assess this section fully.'), { italics: true }));
    for (const para of paras(sec.content)) body.push(P(para));
    if (sec.max_points > 0) body.push(label(L('Điểm đề xuất: ', 'Proposed score: '), `${s(sec.points)}/${s(sec.max_points)}${sec.point_rationale ? ` — ${s(sec.point_rationale)}` : ''}`));
    if (sec.strengths?.length) { body.push(P(L('Ưu điểm:', 'Strengths:'), { bold: true, after: 40 })); sec.strengths.forEach((x: string) => body.push(bullet(x))); }
    if (sec.weaknesses?.length) { body.push(P(L('Hạn chế:', 'Weaknesses:'), { bold: true, after: 40 })); sec.weaknesses.forEach((x: string) => body.push(bullet(x))); }
    if (sec.revisions?.length) { body.push(P(L('Yêu cầu/đề nghị chỉnh sửa:', 'Requested revisions:'), { bold: true, after: 40 })); sec.revisions.forEach((x) => body.push(bullet(`[${PRIORITY[x.priority] || L('Gợi ý', 'Suggestion')}] ${s(x.action)}`))); }
    body.push(...evidenceBlock(L, sec.evidence));
  }

  // Phần bổ sung của hệ thống: điểm và khuyến nghị.
  const sc = r.score;
  const d = r.decision;
  body.push(H(L('ĐỀ XUẤT ĐIỂM VÀ KHUYẾN NGHỊ', 'PROPOSED SCORE AND RECOMMENDATION'), 1));
  if (sc.rows.length) {
    body.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [cell(L('Tiêu chí', 'Criterion'), 60, { head: true }), cell(L('Điểm tối đa', 'Max'), 20, { head: true, right: true }), cell(L('Điểm đề xuất', 'Proposed'), 20, { head: true, right: true })] }),
        ...sc.rows.map((x) => new TableRow({ children: [cell(x.label, 60), cell(String(x.max), 20, { right: true }), cell(String(x.points), 20, { right: true })] })),
        new TableRow({ children: [cell(L('Tổng', 'Total'), 60, { bold: true }), cell(String(sc.sumMax), 20, { bold: true, right: true }), cell(String(sc.sum), 20, { bold: true, right: true })] }),
      ],
    }));
    body.push(P('', { after: 80 }));
  }
  body.push(label(L('Điểm đề xuất (thang 100): ', 'Proposed score (out of 100): '), `${s(sc.score100)}`));
  body.push(label(L('Khuyến nghị: ', 'Recommendation: '), s(dec.label)));
  body.push(P(s(dec.advice)));
  if (d.belowPass) body.push(P(L('CẢNH BÁO: điểm đề xuất thấp hơn ngưỡng thông qua (60/100). Đề nghị người hướng dẫn, giáo sư hướng dẫn hoặc người phản biện cân nhắc kỹ khuyến nghị nêu trên trước khi thông qua.', 'WARNING: the proposed score is below the pass mark (60/100). The supervisor or reviewer should weigh the recommendation above carefully before approving.'), { bold: true }));
  if (d.floorApplied) body.push(P(L('Lưu ý: khuyến nghị được hạ mức do có khuyết điểm nghiêm trọng, dù điểm số cao hơn.', 'Note: the recommendation was lowered because of a fatal defect, despite the higher score.'), { italics: true }));
  if (d.mismatch) body.push(P(L(`Lưu ý: nhận định văn bản của mô hình (${s(labelsFor(lang).decision(d.mismatch.model).short)}) khác với mức theo ngưỡng điểm; người nhận xét cần cân nhắc.`, `Note: the model's own verdict (${s(labelsFor(lang).decision(d.mismatch.model).short)}) differs from the score-based level; the reviewer should weigh it.`), { italics: true }));

  const ov = r.overall;
  if (ov.summary || ov.conclusion) {
    body.push(H(L('Nhận xét tổng quát và kết luận', 'Overall assessment and conclusion'), 2));
    for (const para of paras(ov.summary)) body.push(P(para));
    for (const para of paras(ov.conclusion)) body.push(P(para));
  }
  if (r.fatalDefects?.length) {
    body.push(H(L('Khuyết điểm nghiêm trọng', 'Serious defects'), 2));
    for (const f of r.fatalDefects) { body.push(bullet(`${f.severity === 'fatal' ? L('[Rất nghiêm trọng] ', '[Fatal] ') : L('[Nghiêm trọng] ', '[Serious] ')}${s(f.description)}`)); body.push(...evidenceBlock(L, f.evidence)); }
  }
  if (r.integrityNotes?.length) {
    body.push(H(L('Dấu hiệu cần kiểm tra về liêm chính học thuật', 'Academic integrity flags to check'), 2));
    body.push(P(L('Các nội dung dưới đây chỉ là dấu hiệu cần kiểm tra, không phải kết luận về vi phạm.', 'The items below are only flags to check, not findings of misconduct.'), { italics: true }));
    for (const n of r.integrityNotes) { body.push(bullet(s(n.concern))); if (n.suggested_check) body.push(P(`${L('Đề nghị kiểm tra', 'Suggested check')}: ${s(n.suggested_check)}`, { indent: 360, after: 60 })); body.push(...evidenceBlock(L, n.evidence)); }
  }
  if (r.questions?.length) {
    body.push(H(L('Câu hỏi đề nghị tác giả giải trình', 'Questions for the author'), 2));
    r.questions.forEach((q, i) => body.push(P(`${i + 1}. ${s(q)}`, { indent: 240 })));
  }
  if (r.limitations?.length) {
    body.push(H(L('Giới hạn của bản nhận xét tự động', 'Limits of this automated draft'), 2));
    r.limitations.forEach((x: string) => body.push(bullet(x)));
  }
  body.push(P(L(`Đã đối chiếu ${r.verification?.kept ?? 0} đoạn trích với bản gốc (loại ${r.verification?.dropped ?? 0} đoạn không khớp). Hệ thống không kiểm tra trùng lặp (đạo văn) và không xác minh sự tồn tại của tài liệu tham khảo; người nhận xét cần thực hiện các việc này bằng công cụ chuyên dụng.`, `${r.verification?.kept ?? 0} quotes were checked against the original (${r.verification?.dropped ?? 0} non-matching quotes removed). The system does not check plagiarism and does not verify that references exist; the reviewer must do both with dedicated tools.`), { italics: true, size: 22 }));

  const doc = new Document({
    creator: L('Người nhận xét', 'Reviewer'), title: s(t.title || L('Phiếu nhận xét', 'Review form')),
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 22 })] })] }) },
      children: body,
    }],
  });
  return Packer.toBlob(doc);
}
