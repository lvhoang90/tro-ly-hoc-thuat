// Đối chiếu trích đoạn do AI đề xuất với văn bản gốc để chống "bịa trích dẫn".
// Cách làm: so khớp trên chuỗi chỉ gồm chữ-số (bỏ dấu câu, xuống dòng, gạch nối cuối dòng, ligature),
// rồi ánh xạ ngược về đoạn nguyên văn trong tài liệu và suy ra số trang từ nhãn [[p.N]].

const LIGATURES: Record<string, string> = { "ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl", "ﬆ": "st" };

export const PAGE_MARK = /\[\[p\.(\d+)\]\]/g;

/** Bỏ nhãn trang, dùng khi cần văn bản sạch. */
export const stripPageMarks = (s: string) => s.replace(PAGE_MARK, " ");

interface Norm { s: string; map: number[] }

function normalize(text: string): Norm {
  let s = "";
  const map: number[] = [];
  // bỏ nhãn trang trước khi chuẩn hóa nhưng giữ vị trí: thay bằng khoảng trắng cùng độ dài
  const clean = text.replace(PAGE_MARK, (m) => " ".repeat(m.length));
  for (let i = 0; i < clean.length; i++) {
    let ch = clean[i];
    if (LIGATURES[ch]) ch = LIGATURES[ch];
    ch = ch.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
    // chữ "đ" không phân rã thành d + dấu, ánh xạ về "d" để so khớp ổn định
    ch = ch.replace(/đ/g, "d");
    for (const c of ch) {
      if (/[\p{L}\p{N}]/u.test(c)) { s += c; map.push(i); }
    }
  }
  return { s, map };
}

export interface Located { text: string; page: string; start: number; end: number }

/** Tìm `quote` trong `doc`. Trả về đoạn nguyên văn trong tài liệu hoặc null nếu không khớp. */
export function locateQuote(doc: string, quote: string, docNorm?: Norm): Located | null {
  const d = docNorm ?? normalize(doc);
  const q = normalize(stripPageMarks(quote)).s;
  if (q.length < 20) return null;
  const idx = d.s.indexOf(q);
  if (idx < 0) return null;
  const start = d.map[idx];
  const end = d.map[idx + q.length - 1] + 1;
  let raw = doc.slice(start, end);
  raw = stripPageMarks(raw).replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2").replace(/\s+/g, " ").trim();
  return { text: raw, page: pageAt(doc, start), start, end };
}

/** Số trang chứa vị trí `pos` (nhãn [[p.N]] đặt ở đầu mỗi trang). */
export function pageAt(doc: string, pos: number): string {
  let page = "";
  PAGE_MARK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PAGE_MARK.exec(doc)) && m.index <= pos) page = m[1];
  PAGE_MARK.lastIndex = 0;
  return page;
}

export function prepare(doc: string): Norm { return normalize(doc); }
