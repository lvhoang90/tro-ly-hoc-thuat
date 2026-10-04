// Gợi ý khi điểm < 60: tìm công trình thay thế trên OpenAlex (CC0) và đối chiếu tạp chí với CSDL EduFind (28 lĩnh vực).
import edu from "../../data/edufind.ts";
import { edufindUrl } from "../../shared/edufind-types.ts";
import type { Bi, EdufindLink, JournalRec, Recommendations, WorkRec } from "../../shared/types.ts";

const issnKey = (s: string) => s.replace(/[^0-9Xx]/g, "").toUpperCase();
const tokens = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/đ/g, "d").match(/[a-z0-9]{4,}/g) ?? [];
const D = edu.disciplines;
const dName = (i: number): Bi => ({ vi: D[i].vi, en: D[i].en });
const dUrl = (i: number) => edufindUrl(edu.origin, D[i].path);

const byIssn = new Map<string, JournalRec>();
const intlRec = (j: (typeof edu.intl)[number], why: string, prefer?: Set<number>): JournalRec => {
  const di = (prefer && j.d.find((x) => prefer.has(x))) ?? j.d[0];
  return { title: j.t, issn: j.i, publisher: j.p, quartile: j.q, sjr: j.s, openAccess: j.oa, domestic: false, why, discipline: dName(di), url: `${dUrl(di)}?tab=international&q=${encodeURIComponent(j.t)}`, ...(j.b ? { bkhcn: j.b } : {}) };
};
const domRec = (j: (typeof edu.dom)[number], why: string): JournalRec =>
  ({ title: j.t, issn: j.i, publisher: j.p, quartile: "", sjr: null, openAccess: false, domestic: true, maxScore: j.max, why, discipline: dName(j.d), url: `${dUrl(j.d)}?q=${encodeURIComponent(j.t)}`, ...(j.b ? { bkhcn: j.b } : {}) });

interface OAWork {
  title?: string; publication_year?: number; doi?: string; cited_by_count?: number;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { source?: { display_name?: string; issn?: string[] }; landing_page_url?: string } | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null };
}

async function searchOpenAlex(q: string, mailto: string): Promise<OAWork[]> {
  const u = new URL("https://api.openalex.org/works");
  u.searchParams.set("search", q);
  u.searchParams.set("filter", "type:article,has_abstract:true,from_publication_date:2012-01-01");
  u.searchParams.set("per-page", "6");
  u.searchParams.set("select", "title,publication_year,doi,cited_by_count,authorships,primary_location,open_access");
  if (mailto) u.searchParams.set("mailto", mailto);
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    return ((await r.json()) as { results?: OAWork[] }).results ?? [];
  } catch { return []; }
}

export async function recommend(a: { advice: Bi; queries: string[]; keywords: string[]; disciplines: string[] }): Promise<Recommendations> {
  const mailto = process.env.CONTACT_EMAIL ?? "";
  const qs = a.queries.map((q) => q.trim()).filter(Boolean).slice(0, 3);
  const batches = await Promise.all(qs.map((q) => searchOpenAlex(q, mailto)));

  // Lĩnh vực EduFind do AI chọn theo nghiên cứu của người dùng (bỏ mã không tồn tại).
  const chosen = [...new Set(a.disciplines.map((s) => D.findIndex((d) => d.slug === s)).filter((i) => i >= 0))].slice(0, 3);
  const prefer = new Set(chosen);

  const seen = new Set<string>();
  const works: WorkRec[] = [];
  const venueIssn = new Set<string>();
  const rank = Math.max(...batches.map((b) => b.length), 0);
  for (let r = 0; r < rank; r++) {            // xen kẽ kết quả của các truy vấn
    for (const b of batches) {
      const w = b[r];
      if (!w?.title) continue;
      const key = (w.doi ?? w.title).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const issn = w.primary_location?.source?.issn ?? [];
      issn.forEach((i) => venueIssn.add(issnKey(i)));
      works.push({
        title: w.title, year: w.publication_year ?? null, venue: w.primary_location?.source?.display_name ?? "",
        doi: (w.doi ?? "").replace(/^https?:\/\/doi\.org\//, ""), citedBy: w.cited_by_count ?? 0,
        authors: (w.authorships ?? []).slice(0, 4).map((x) => x.author?.display_name ?? "").filter(Boolean).join(", ")
          + ((w.authorships?.length ?? 0) > 4 ? ", et al." : ""),
        url: w.open_access?.oa_url ?? w.primary_location?.landing_page_url ?? (w.doi ?? ""),
        openAccess: !!w.open_access?.is_oa, issn,
      });
    }
  }

  const journals: JournalRec[] = [];
  const have = new Set<string>();
  const add = (j: JournalRec) => { const k = j.title.toLowerCase(); if (!have.has(k)) { have.add(k); journals.push(j); } };

  // (1) Nơi các công trình tương tự được đăng và có trong EduFind (mọi lĩnh vực).
  if (byIssn.size === 0) for (const j of edu.intl) for (const i of j.i) byIssn.set(issnKey(i), intlRec(j, "venue", prefer));
  for (const i of venueIssn) { const h = byIssn.get(i); if (h) add({ ...h, why: "venue" }); }

  // (2) Khớp từ khóa trong đúng lĩnh vực của người dùng: quốc tế (theo hạng SJR) rồi trong nước (theo điểm Hội đồng).
  const kw = new Set(tokens([...a.keywords, ...qs].join(" ")));
  const overlap = (title: string) => { const t = new Set(tokens(title)); let n = 0; kw.forEach((k) => t.has(k) && n++); return n; };
  const Q: Record<string, number> = { Q1: 4, Q2: 3, Q3: 2, Q4: 1 };
  const intl = edu.intl.filter((j) => j.d.some((x) => prefer.has(x)))
    .map((j) => ({ j, n: overlap(j.t), q: Q[j.q] ?? 0, s: j.s ?? 0 }))
    .sort((x, y) => y.n - x.n || y.q - x.q || y.s - x.s);
  for (const x of intl) { if (journals.filter((j) => !j.domestic).length >= 6) break; add(intlRec(x.j, x.n ? "keyword" : "field", prefer)); }
  const dom = edu.dom.filter((j) => prefer.has(j.d))
    .map((j) => ({ j, n: overlap(j.t) })).sort((x, y) => y.n - x.n || y.j.max - x.j.max);
  for (const x of dom.slice(0, 4)) add(domRec(x.j, x.n ? "keyword" : "field"));

  const disciplines: EdufindLink[] = chosen.map((i) => ({ slug: D[i].slug, name: dName(i), url: dUrl(i) }));
  return {
    advice: a.advice, queries: qs, keywords: a.keywords, works: works.slice(0, 8), journals: journals.slice(0, 12),
    disciplines, edufind: { url: edufindUrl(edu.origin) },
  };
}
