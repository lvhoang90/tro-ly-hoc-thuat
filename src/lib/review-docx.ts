// Xuất bản nhận xét ra Word (.docx) ngay trong trình duyệt; tải theo yêu cầu để không làm nặng trang chính. Chuyển từ ứng dụng "Trợ lý phản biện học thuật".
import type { ReviewResult } from "../../shared/review/assemble.ts";
import type { Evidence } from "../../shared/review/rubric.ts";
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

const PRIORITY: Record<string, string> = { bat_buoc: 'Bắt buộc', nen_lam: 'Nên thực hiện', goi_y: 'Gợi ý' };
const refOf = (e: Evidence) => `${e.paragraph ? `đoạn ¶${e.paragraph}` : ''}${e.page ? `, trang ${e.page}` : ''}`.replace(/, $/, '');

function evidenceBlock(evs?: Evidence[]) {
  if (!evs?.length) return [];
  const out: Paragraph[] = [P('Căn cứ trong văn bản:', { bold: true, after: 40 })];
  for (const e of evs) out.push(P(`“${s(e.quote)}” (${refOf(e) || 'vị trí không xác định'})`, { italics: true, size: 24, indent: 360, after: 60 }));
  return out;
}

/** Tên tệp nhận xét theo công trình: "Nhan-xet - <tên tệp gốc>.docx". */
export function exportFileName(r: ReviewResult) {
  const base = String(r?.file?.name || 'cong-trinh').replace(/\.(docx|pdf)$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'cong-trinh';
  return `Nhan-xet - ${base}.docx`;
}
export function uniqueName(name: string, used: Set<string>) {
  let n = name, i = 2;
  while (used.has(n.toLowerCase())) n = name.replace(/\.docx$/, ` (${i++}).docx`);
  used.add(n.toLowerCase());
  return n;
}

export async function buildDocx(r: ReviewResult): Promise<Blob> {
  const body: (Paragraph | Table)[] = [];
  const t = r.template;
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(s(t.title || 'PHIẾU NHẬN XÉT').toUpperCase(), { bold: true, size: 30 })] }));
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [run('Bản nháp do hệ thống hỗ trợ soạn thảo — người nhận xét thẩm định, chỉnh sửa và chịu trách nhiệm về nội dung cuối cùng', { italics: true, size: 22 })] }));

  // Mỗi bản nhận xét nêu rõ công trình nào để không nhầm giữa nhiều tác giả.
  const wk = r.file?.name;
  if (wk) body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(`Công trình: ${s(r.profile?.title && r.profile.title !== 'Không xác định' ? r.profile.title + ' — ' : '')}tệp “${s(wk)}”`, { size: 22 })] }));
  const info = (r.info || []).filter((x) => x.label);
  if (info.length) {
    body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: info.map((x) => new TableRow({ children: [cell(x.label, 35, { bold: true }), cell(x.value, 65)] })) }));
    body.push(P('', { after: 120 }));
  }

  for (const sec of r.sections || []) {
    body.push(H(`${s(sec.number)} ${s(sec.title)}`.trim(), Math.min(3, Math.max(1, sec.level || 1))));
    if (sec.insufficient_basis) body.push(P('Lưu ý: văn bản được nộp chưa đủ cơ sở để đánh giá đầy đủ mục này.', { italics: true }));
    for (const para of paras(sec.content)) body.push(P(para));
    if (sec.max_points > 0) body.push(label('Điểm đề xuất: ', `${s(sec.points)}/${s(sec.max_points)}${sec.point_rationale ? ` — ${s(sec.point_rationale)}` : ''}`));
    if (sec.strengths?.length) { body.push(P('Ưu điểm:', { bold: true, after: 40 })); sec.strengths.forEach((x: string) => body.push(bullet(x))); }
    if (sec.weaknesses?.length) { body.push(P('Hạn chế:', { bold: true, after: 40 })); sec.weaknesses.forEach((x: string) => body.push(bullet(x))); }
    if (sec.revisions?.length) { body.push(P('Yêu cầu/đề nghị chỉnh sửa:', { bold: true, after: 40 })); sec.revisions.forEach((x) => body.push(bullet(`[${PRIORITY[x.priority] || 'Gợi ý'}] ${s(x.action)}`))); }
    body.push(...evidenceBlock(sec.evidence));
  }

  // Phần bổ sung của hệ thống: điểm và khuyến nghị.
  const sc = r.score;
  const d = r.decision;
  body.push(H('ĐỀ XUẤT ĐIỂM VÀ KHUYẾN NGHỊ', 1));
  if (sc.rows.length) {
    body.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [cell('Tiêu chí', 60, { head: true }), cell('Điểm tối đa', 20, { head: true, right: true }), cell('Điểm đề xuất', 20, { head: true, right: true })] }),
        ...sc.rows.map((x) => new TableRow({ children: [cell(x.label, 60), cell(String(x.max), 20, { right: true }), cell(String(x.points), 20, { right: true })] })),
        new TableRow({ children: [cell('Tổng', 60, { bold: true }), cell(String(sc.sumMax), 20, { bold: true, right: true }), cell(String(sc.sum), 20, { bold: true, right: true })] }),
      ],
    }));
    body.push(P('', { after: 80 }));
  }
  body.push(label('Điểm đề xuất (thang 100): ', `${s(sc.score100)}`));
  body.push(label('Khuyến nghị: ', s(d.label)));
  body.push(P(s(d.advice)));
  if (d.belowPass) body.push(P('CẢNH BÁO: điểm đề xuất thấp hơn ngưỡng thông qua (60/100). Đề nghị người hướng dẫn, giáo sư hướng dẫn hoặc người phản biện cân nhắc kỹ khuyến nghị nêu trên trước khi thông qua.', { bold: true }));
  if (d.floorApplied) body.push(P('Lưu ý: khuyến nghị được hạ mức do có khuyết điểm nghiêm trọng, dù điểm số cao hơn.', { italics: true }));
  if (d.mismatch) body.push(P(`Lưu ý: nhận định văn bản của mô hình (${s(d.mismatch.modelLabel)}) khác với mức theo ngưỡng điểm; người nhận xét cần cân nhắc.`, { italics: true }));

  const ov = r.overall;
  if (ov.summary || ov.conclusion) {
    body.push(H('Nhận xét tổng quát và kết luận', 2));
    for (const para of paras(ov.summary)) body.push(P(para));
    for (const para of paras(ov.conclusion)) body.push(P(para));
  }
  if (r.fatalDefects?.length) {
    body.push(H('Khuyết điểm nghiêm trọng', 2));
    for (const f of r.fatalDefects) { body.push(bullet(`${f.severity === 'fatal' ? '[Rất nghiêm trọng] ' : '[Nghiêm trọng] '}${s(f.description)}`)); body.push(...evidenceBlock(f.evidence)); }
  }
  if (r.integrityNotes?.length) {
    body.push(H('Dấu hiệu cần kiểm tra về liêm chính học thuật', 2));
    body.push(P('Các nội dung dưới đây chỉ là dấu hiệu cần kiểm tra, không phải kết luận về vi phạm.', { italics: true }));
    for (const n of r.integrityNotes) { body.push(bullet(s(n.concern))); if (n.suggested_check) body.push(P(`Đề nghị kiểm tra: ${s(n.suggested_check)}`, { indent: 360, after: 60 })); body.push(...evidenceBlock(n.evidence)); }
  }
  if (r.questions?.length) {
    body.push(H('Câu hỏi đề nghị tác giả giải trình', 2));
    r.questions.forEach((q, i) => body.push(P(`${i + 1}. ${s(q)}`, { indent: 240 })));
  }
  if (r.limitations?.length) {
    body.push(H('Giới hạn của bản nhận xét tự động', 2));
    r.limitations.forEach((x: string) => body.push(bullet(x)));
  }
  body.push(P(`Đã đối chiếu ${r.verification?.kept ?? 0} đoạn trích với bản gốc (loại ${r.verification?.dropped ?? 0} đoạn không khớp). Hệ thống không kiểm tra trùng lặp (đạo văn) và không xác minh sự tồn tại của tài liệu tham khảo; người nhận xét cần thực hiện các việc này bằng công cụ chuyên dụng.`, { italics: true, size: 22 }));

  const doc = new Document({
    creator: 'Người nhận xét', title: s(t.title || 'Phiếu nhận xét'),
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 22 })] })] }) },
      children: body,
    }],
  });
  return Packer.toBlob(doc);
}
