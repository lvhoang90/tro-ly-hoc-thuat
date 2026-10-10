// Dựng lại đoạn văn từ các mảnh chữ của PDF (hàm thuần; chuyển từ ứng dụng "Trợ lý phản biện học thuật").
// pages: [[{ str, x, y, h }]] — mỗi mảnh chữ theo thứ tự đọc của pdf.js; y là tọa độ từ đáy trang, h là cỡ chữ.

const HEAD_RE = /^(\d+(\.\d+)*[.)]?|[IVXLC]+[.)]|[a-zđ]\)|chương|phần|mục|bài|CHƯƠNG|PHẦN|MỤC)\s+\S/;
const LIST_RE = /^([•·●▪\-–—]|\d+[.)]|[a-zđ]\))\s+\S/;

const median = (a: number[]) => { const s = [...a].sort((x: number, y: number) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const normKey = (t: string) => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

export interface PdfItem { str: string; x: number; y: number; h: number; w?: number }
interface Line { text: string; y: number; h: number; x: number; endX: number; tail: string }

function linesOfPage(items: PdfItem[]): Line[] {
  const lines: Line[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) { if (it.str && lines.length) lines[lines.length - 1].tail = ' '; continue; }
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Math.max(2, 0.45 * Math.max(last.h, it.h))) {
      const gap = it.x - last.endX;
      const sep = last.tail || gap > 0.18 * it.h ? ' ' : '';
      last.text += sep + it.str; last.endX = it.x + (it.w || 0); last.h = Math.max(last.h, it.h); last.tail = '';
    } else lines.push({ text: it.str, y: it.y, h: it.h, x: it.x, endX: it.x + (it.w || 0), tail: '' });
  }
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter((l) => l.text);
}

export function layoutPdfPages(pages: PdfItem[][]): { kind: "p" | "bold"; text: string; page: number }[] {
  const perPage = pages.map(linesOfPage);
  const nPages = perPage.length;
  // Bỏ số trang và đầu/chân trang lặp lại.
  const freq = new Map<string, number>();
  perPage.forEach((ls) => new Set(ls.map((l) => normKey(l.text))).forEach((k) => freq.set(k, (freq.get(k) || 0) + 1)));
  const ys = perPage.flat().map((l) => l.y);
  const yMax = Math.max(...ys, 0), yMin = Math.min(...ys, 0), band = 0.06 * (yMax - yMin);
  const inMargin = (l: Line) => l.y >= yMax - band || l.y <= yMin + band; // chỉ coi là đầu/chân trang khi nằm sát mép trên/dưới
  const isNoise = (l: Line) => /^[-–\s]*\d{1,4}[-–\s]*$/.test(l.text) || /^trang\s+\d+/i.test(l.text) || (nPages >= 4 && inMargin(l) && l.text.length < 120 && (freq.get(normKey(l.text)) ?? 0) >= Math.max(3, 0.4 * nPages));
  const allH = perPage.flat().map((l) => l.h).filter(Boolean);
  const bodyH = median(allH) || 12;
  const pitches: number[] = [];
  perPage.forEach((ls) => { for (let i = 1; i < ls.length; i++) { const d = ls[i - 1].y - ls[i].y; if (d > 0 && d < 3 * bodyH) pitches.push(d); } });
  const pitch = median(pitches) || bodyH * 1.2;

  const blocks: { text: string; page: number; heading: boolean }[] = [];
  let cur: { text: string; page: number; heading: boolean } | null = null;
  const flush = () => { if (cur) { blocks.push(cur); cur = null; } };
  perPage.forEach((ls, pi) => {
    const kept = ls.filter((l) => !isNoise(l));
    kept.forEach((l, i) => {
      const prev = i > 0 ? kept[i - 1] : null;
      const gap = prev ? prev.y - l.y : 0;
      const big = l.h > bodyH * 1.12;
      const headingLike = l.text.length < 140 && !/[.;,]$/.test(l.text) && (big || (HEAD_RE.test(l.text) && l.text.length < 100) || (l.text === l.text.toUpperCase() && /\p{L}{4}/u.test(l.text)));
      const c = cur as { text: string; page: number; heading: boolean } | null;
      const startsNew = !c || gap > pitch * 1.45 || LIST_RE.test(l.text) || headingLike || c.heading;
      if (startsNew) { flush(); cur = { text: l.text, page: pi + 1, heading: headingLike }; }
      else if (/[-‐]$/.test(c.text) && /^\p{Ll}/u.test(l.text)) c.text = c.text.slice(0, -1) + l.text;
      else c.text += ' ' + l.text;
    });
  });
  flush();
  return blocks.map((b) => ({ kind: (b.heading ? 'bold' : 'p') as 'bold' | 'p', text: b.text.replace(/\s+/g, ' ').trim(), page: b.page })).filter((b) => b.text);
}

/** Phát hiện PDF dạng ảnh scan hoặc phông lỗi mã. Trả về null nếu dùng được, ngược lại mã lỗi. */
export function pdfTextProblem(pageTexts: string[]): "scan" | "encoding" | null {
  const n = pageTexts.length;
  const total = pageTexts.reduce((s: number, t: string) => s + t.length, 0);
  const empty = pageTexts.filter((t) => t.replace(/\s/g, '').length < 20).length;
  if (n === 0 || total < 200 || total / n < 120 || empty / n > 0.6) return 'scan';
  const all = pageTexts.join(' ');
  const letters = (all.match(/\p{L}/gu) || []).length;
  const weird = (all.match(/[\uFFFD\uE000-\uF8FF\u00A1-\u00BF\u0080-\u009F\u00D7\u00F7]/g) || []).length;
  if (letters < 0.4 * all.replace(/\s/g, '').length || weird / Math.max(1, all.length) > 0.03) return 'encoding';
  return null;
}
