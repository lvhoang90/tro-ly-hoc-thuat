// So khớp họ tên với chỉ mục công khai của ProFind (https://profind.isavn.edu.vn/data/suggest.json) ngay trên máy người dùng.
// Thuật toán nameSim/suggest chép từ ProFind (src/Suggest.tsx) và EduFind (portal/profind-match.js): sửa bên nào thì sửa cả hai.
// Chỉ mục chỉ gồm nhà nghiên cứu gắn với trường, viện Việt Nam; khớp theo tên chỉ là gợi ý, không khẳng định cùng một người.

/** [mã, họ tên, mã đơn vị[], công trình, trích dẫn, năm công bố gần nhất, orcid, top 2% (0/1), điểm ProScore hoặc null] */
export type Row = [string, string, string[], number, number, number, string, number, number | null];
export interface Idx { built?: string; i: Record<string, [string, string]>; d: Record<string, string[]>; a: Row[] }

export const PROFIND_ORIGIN = "https://profind.isavn.edu.vn";
export const PROFIND_INDEX_URL = `${PROFIND_ORIGIN}/data/suggest.json`;

export const fold = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const PART = new Set(["thi", "van", "huu", "duc", "ngoc", "minh"]); // đệm thường bị bỏ khi viết tên không dấu
const toks = (s: string) => fold(s).split(" ").filter(Boolean);
const key = (t: string[]) => [...t].sort().join(" ");
const core = (t: string[]) => t.filter((x) => !PART.has(x));

/** Mức giống nhau của hai họ tên (0..1): cùng bộ chữ sau khi bỏ dấu, chấp nhận đảo thứ tự (Nguyễn Văn An = An Van Nguyen). */
export function nameSim(u: string[], a: string[]): number {
  if (!u.length || !a.length) return 0;
  if (key(u) === key(a)) return 1;
  const cu = core(u), ca = core(a);
  if (cu.length >= 2 && key(cu) === key(ca)) return 0.9;
  const first = u[0], last = u[u.length - 1], common = u.filter((x) => a.includes(x)).length;
  if (common >= 2 && a.includes(last) && a.includes(first) && common / Math.max(u.length, a.length) >= 0.6) return 0.6;
  return 0;
}

// ---------- Tác giả của một tài liệu ----------
export interface AuthorHit { id: string; name: string; units: string[]; works: number; cites: number; last: number; orcid: string; top2: boolean; pro: number | null }
export interface AuthorMatch { family: string; given: string; hits: AuthorHit[]; total: number }

export interface Prepared { idx: Idx; exact: Map<string, Row[]>; byCore: Map<string, Row[]> }
const cache = new WeakMap<Idx, Prepared>();
/** Dựng bảng tra theo bộ chữ đã sắp xếp: tìm tác giả là một lần tra, không duyệt cả 16.000 hồ sơ. */
export function prepare(idx: Idx): Prepared {
  let p = cache.get(idx);
  if (p) return p;
  p = { idx, exact: new Map(), byCore: new Map() };
  for (const r of idx.a) {
    const t = toks(r[1]);
    if (t.length < 2) continue;
    const k = key(t), c = core(t);
    (p.exact.get(k) ?? p.exact.set(k, []).get(k)!).push(r);
    if (c.length >= 2) { const kc = key(c); (p.byCore.get(kc) ?? p.byCore.set(kc, []).get(kc)!).push(r); }
  }
  cache.set(idx, p);
  return p;
}

const unitNames = (idx: Idx, ids: string[]) => ids.map((u) => idx.i[u]?.[1] || idx.i[u]?.[0] || "").filter(Boolean);
const toHit = (idx: Idx, r: Row): AuthorHit => ({ id: r[0], name: r[1], units: unitNames(idx, r[2]), works: r[3], cites: r[4], last: r[5], orcid: r[6], top2: !!r[7], pro: r[8] ?? null });

/**
 * Tìm hồ sơ ProFind khớp tên từng tác giả. Chỉ nhận tên đầy đủ trùng bộ chữ (kể cả đảo thứ tự, khác phần đệm);
 * tên viết tắt (J. Choi) không khớp để tránh nhận nhầm. Mỗi tác giả tối đa `max` hồ sơ, nhiều công trình nhất lên trước.
 */
export function matchAuthors(idx: Idx, authors: { family: string; given: string }[], max = 3): AuthorMatch[] {
  const p = prepare(idx);
  return authors.map((a) => {
    const t = toks(`${a.given} ${a.family}`);
    const rows = t.length >= 2 ? (p.exact.get(key(t)) ?? (core(t).length >= 2 ? p.byCore.get(key(core(t))) : undefined) ?? []) : [];
    const sorted = [...rows].sort((x, y) => y[3] - x[3] || y[4] - x[4]);
    return { family: a.family, given: a.given, hits: sorted.slice(0, max).map((r) => toHit(idx, r)), total: sorted.length };
  });
}

// ---------- Hồ sơ của chính người dùng ----------
export interface Cand extends AuthorHit { score: number; why: [string, string][] }
const FREE_DOM = new Set(["gmail.com", "googlemail.com", "yahoo.com", "yahoo.com.vn", "ymail.com", "outlook.com", "outlook.com.vn", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com"]);
export const isFreeMail = (email: string) => { const d = (email.split("@")[1] ?? "").toLowerCase(); return !d || FREE_DOM.has(d); };

/** Gợi ý hồ sơ ProFind của người dùng từ họ tên, email, đơn vị và ORCID (nếu có). Tối đa 30, điểm cao trước. */
export function suggest(idx: Idx, user: { name: string; email: string; org: string }, orcid = ""): Cand[] {
  const nameTok = toks(user.name), dom = (user.email.split("@")[1] ?? "").toLowerCase();
  const parts = dom.split(".");
  let unitIds: string[] = [];
  for (let k = 0; k < parts.length - 1 && !unitIds.length; k++) unitIds = idx.d[parts.slice(k).join(".")] ?? [];
  const orgTok = new Set(toks(user.org).filter((x) => x.length > 1));
  const year = new Date().getFullYear(), oc = orcid.replace(/[^0-9X]/gi, "").toUpperCase();
  const out: Cand[] = [];
  for (const r of idx.a) {
    const byOrcid = !!oc && r[6].replace(/[^0-9X]/gi, "").toUpperCase() === oc;
    const sim = nameSim(nameTok, toks(r[1]));
    if (!byOrcid && sim === 0) continue;
    const why: [string, string][] = [];
    let score = 0;
    if (byOrcid) { score = 100; why.push(["ok", "orcid"]); }
    else {
      score += 40 * sim; why.push([sim === 1 ? "ok" : "mid", sim === 1 ? "name_exact" : sim >= 0.9 ? "name_part" : "name_near"]);
      const hit = unitIds.length ? r[2].some((x) => unitIds.includes(x)) : false;
      if (hit) { score += 30; why.push(["ok", "unit_email"]); } else if (unitIds.length) why.push(["no", "unit_other"]);
      const names = r[2].map((x) => toks(`${idx.i[x]?.[0] ?? ""} ${idx.i[x]?.[1] ?? ""}`));
      if (orgTok.size && names.some((n) => n.filter((x) => orgTok.has(x)).length >= 2)) { score += 15; why.push(["ok", "unit_org"]); }
      if (r[5] >= year - 2) { score += 10; why.push(["ok", "recent"]); }
    }
    out.push({ ...toHit(idx, r), score: Math.round(score), why });
  }
  return out.sort((x, y) => y.score - x.score || y.works - x.works).slice(0, 30);
}
/** Đề xuất chính: từ 70 điểm và hơn đề xuất kế tiếp ít nhất 15 điểm (hoặc là đề xuất duy nhất). */
export const mainPick = (c: Cand[]) => (c[0] && c[0].score >= 70 && (!c[1] || c[0].score - c[1].score >= 15) ? c[0].id : null);
export const pct = (c: Cand) => (c.score >= 100 ? 100 : Math.min(99, c.score));

/** Liên kết tới hồ sơ tác giả trên ProFind (đường dẫn dạng #, nên không đi qua cổng /go được); kèm nguồn để ProFind đo. */
export const profindAuthorUrl = (id: string, campaign = "author") =>
  `${PROFIND_ORIGIN}/?utm_source=ami&utm_medium=ecosystem&utm_campaign=${campaign}#/tac-gia/${encodeURIComponent(id)}`;
