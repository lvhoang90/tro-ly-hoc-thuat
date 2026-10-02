// Gợi ý khi điểm < 60: tìm công trình thay thế trên OpenAlex (CC0) và đối chiếu tạp chí với CSDL EduFind.
import edu from "../../data/edufind-journals.json";
import type { JournalRec, Recommendations, WorkRec } from "../../shared/types.ts";

interface IntlJ { t: string; i: string[]; p: string; q: string; s: number | null; oa: boolean; c: string[]; co: string }
interface DomJ { t: string; i: string[]; p: string; id: string; max: number; idx: unknown[] }
const INTL = edu.intl as IntlJ[];
const DOM = edu.dom as unknown as DomJ[];

const issnKey = (s: string) => s.replace(/[^0-9Xx]/g, "").toUpperCase();
const byIssn = new Map<string, { j: IntlJ | DomJ; domestic: boolean }>();
for (const j of INTL) for (const i of j.i) byIssn.set(issnKey(i), { j, domestic: false });
for (const j of DOM) for (const i of j.i) byIssn.set(issnKey(i), { j, domestic: true });

const tokens = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[a-z0-9]{4,}/g) ?? [];

function toJournal(j: IntlJ | DomJ, domestic: boolean, why: string): JournalRec {
  if (domestic) {
    const d = j as DomJ;
    return { title: d.t, issn: d.i, publisher: d.p, quartile: "", sjr: null, openAccess: false, domestic: true, maxScore: d.max, why };
  }
  const x = j as IntlJ;
  return { title: x.t, issn: x.i, publisher: x.p, quartile: x.q, sjr: x.s, openAccess: x.oa, domestic: false, why };
}

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

export async function recommend(advice: string, queries: string[], keywords: string[]): Promise<Recommendations> {
  const mailto = process.env.CONTACT_EMAIL ?? "";
  const qs = queries.map((q) => q.trim()).filter(Boolean).slice(0, 3);
  const batches = await Promise.all(qs.map((q) => searchOpenAlex(q, mailto)));

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
        authors: (w.authorships ?? []).slice(0, 4).map((a) => a.author?.display_name ?? "").filter(Boolean).join(", ")
          + ((w.authorships?.length ?? 0) > 4 ? ", et al." : ""),
        url: w.open_access?.oa_url ?? w.primary_location?.landing_page_url ?? (w.doi ?? ""),
        openAccess: !!w.open_access?.is_oa, issn,
      });
    }
  }

  // Tạp chí: (1) nơi các công trình tương tự được đăng và có trong EduFind; (2) khớp từ khóa với tên/chuyên ngành.
  const journals: JournalRec[] = [];
  const have = new Set<string>();
  const add = (j: JournalRec) => { const k = j.title.toLowerCase(); if (!have.has(k)) { have.add(k); journals.push(j); } };
  for (const i of venueIssn) {
    const hit = byIssn.get(i);
    if (hit) add(toJournal(hit.j, hit.domestic, "venue"));
  }
  const kw = new Set(tokens([...keywords, ...qs].join(" ")));
  const scored = [...INTL.map((j) => ({ j, domestic: false })), ...DOM.map((j) => ({ j, domestic: true }))]
    .map(({ j, domestic }) => {
      const t = new Set(tokens(j.t + " " + ("c" in j ? j.c.join(" ") : "")));
      let n = 0; kw.forEach((k) => t.has(k) && n++);
      const q = "q" in j ? ({ Q1: 4, Q2: 3, Q3: 2, Q4: 1 } as Record<string, number>)[j.q] ?? 0 : 2;
      return { j, domestic, n, q };
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || b.q - a.q);
  for (const x of scored) { if (journals.length >= 8) break; add(toJournal(x.j, x.domestic, "keyword")); }

  return {
    advice, queries: qs, keywords, works: works.slice(0, 8), journals: journals.slice(0, 8),
    edufind: { url: edu.url, name: edu.nameVi },
  };
}
