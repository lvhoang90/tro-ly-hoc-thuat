// Kho kiểu CSL (Citation Style Language): hơn 10.000 kiểu tạp chí/trường đại học qua citeproc-js.
// Tệp .csl và locale được tải theo nhu cầu từ jsDelivr (CDN) rồi trình duyệt tự lưu đệm, nên không làm nặng gói chính.
// citeproc-js: CPAL-1.0 OR AGPL-1.0; kiểu CSL: CC BY-SA 3.0.
import type { Lang, SourceMeta } from "../../shared/types.ts";

export interface CslEntry { id: string; title: string; dependent: boolean; format: string }

const STYLE_BASE = "https://cdn.jsdelivr.net/gh/citation-style-language/styles@master/";
const LOCALE_BASE = "https://cdn.jsdelivr.net/gh/citation-style-language/locales@master/";
export const CSL_FORMAT: Record<string, string> = { d: "author-date", n: "numeric", o: "note", l: "label", a: "author" };

let indexP: Promise<CslEntry[]> | null = null;
export function loadCslIndex(fetcher: typeof fetch = fetch, url = "/csl/index.json"): Promise<CslEntry[]> {
  return (indexP ??= fetcher(url).then((r) => {
    if (!r.ok) throw new Error("csl index");
    return r.json();
  }).then((d: { styles: [string, string, number, string][] }) =>
    d.styles.map(([id, title, dep, format]) => ({ id, title, dependent: !!dep, format }))).catch((e) => { indexP = null; throw e; }));
}

const cache = new Map<string, Promise<string>>();
const text = (fetcher: typeof fetch, url: string) => {
  let p = cache.get(url);
  if (!p) {
    p = fetcher(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.text(); });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
};

/** Kiểu phụ thuộc chỉ trỏ tới một kiểu "cha"; lấy tệp cha để dựng bộ máy. */
export async function loadStyleXml(id: string, fetcher: typeof fetch = fetch): Promise<string> {
  let xml: string;
  try { xml = await text(fetcher, `${STYLE_BASE}${id}.csl`); }
  catch { xml = await text(fetcher, `${STYLE_BASE}dependent/${id}.csl`); } // kiểu phụ thuộc nằm ở thư mục dependent/
  const m = xml.match(/<link[^>]*href="([^"]+)"[^>]*rel="independent-parent"|<link[^>]*rel="independent-parent"[^>]*href="([^"]+)"/);
  if (m) {
    const parent = (m[1] ?? m[2]).split("/").pop()!;
    xml = await text(fetcher, `${STYLE_BASE}${parent}.csl`);
  }
  return xml;
}

const TYPE: Record<SourceMeta["type"], string> = {
  article: "article-journal", book: "book", chapter: "chapter", conference: "paper-conference",
  thesis: "thesis", report: "report", web: "webpage",
};

export function toCslItem(m: SourceMeta, lang: Lang) {
  const yr = parseInt(m.year, 10);
  const isContainer = m.type === "article" || m.type === "chapter" || m.type === "conference";
  const title = lang === "en" && m.lang === "vi" && m.titleEn ? `${m.title} [${m.titleEn}]` : m.title;
  const item: Record<string, unknown> = {
    id: "item1", type: TYPE[m.type], title,
    author: m.authors.filter((a) => a.family).map((a) => ({ family: a.family, given: a.given })),
    language: m.lang === "vi" ? "vi-VN" : "en-US",
  };
  if (Number.isFinite(yr)) item.issued = { "date-parts": [[yr]] };
  if (m.container) item[isContainer ? "container-title" : "publisher"] = m.container;
  if (m.publisher) item.publisher = m.publisher;
  if (m.volume) item.volume = m.volume;
  if (m.issue) item.issue = m.issue;
  if (m.pages) item.page = m.pages.replace(/\s*[-–—]\s*/g, "-");
  if (m.doi) item.DOI = m.doi.replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, "");
  if (m.url) item.URL = m.url;
  return item;
}

const ENT: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#38;": "&", "&#60;": "<", "&#62;": ">", "&nbsp;": " ", "&#160;": " " };
/** HTML của citeproc → văn bản có *chữ nghiêng* (định dạng nội bộ). */
export function htmlToMarked(html: string): string {
  return html
    .replace(/<\/div>\s*<div/gi, "</div> <div")
    .replace(/<\/?(i|em)\b[^>]*>/gi, "*")
    .replace(/<sup[^>]*>(.*?)<\/sup>/gi, "^$1^")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:amp|lt|gt|quot|nbsp|#38|#60|#62|#160);/g, (e) => ENT[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\*\s*\*/g, "")
    .replace(/[ \t]+/g, " ").trim();
}

export interface CslOut { reference: string; inText: string; perPage: Record<string, string> }

/** Định dạng một nguồn bằng kiểu CSL; `pages` gồm trang của từng trích đoạn (khóa tùy ý). */
export async function formatCsl(m: SourceMeta, styleId: string, lang: Lang, pages: Record<string, string> = {}, fetcher: typeof fetch = fetch): Promise<CslOut> {
  const tag = lang === "vi" ? "vi-VN" : "en-US";
  const [{ default: CSL }, styleXml, loc, locEn] = await Promise.all([
    import("citeproc") as Promise<{ default: any }>,
    loadStyleXml(styleId, fetcher),
    text(fetcher, `${LOCALE_BASE}locales-${tag}.xml`),
    text(fetcher, `${LOCALE_BASE}locales-en-US.xml`),
  ]);
  const item = toCslItem(m, lang);
  const sys = {
    retrieveLocale: (l: string) => (l === tag ? loc : locEn),
    retrieveItem: () => item,
  };
  const engine = new CSL.Engine(sys, styleXml, tag, true);
  engine.updateItems(["item1"]);
  const bib = engine.makeBibliography();
  const reference = bib?.[1]?.length ? bib[1].map((h: string) => htmlToMarked(h)).join("\n") : "";
  const cite = (locator?: string) => {
    const e = new CSL.Engine(sys, styleXml, tag, true);
    const items = [{ id: "item1", ...(locator ? { locator, label: "page" } : {}) }];
    const r = e.processCitationCluster({ citationID: "c1", citationItems: items, properties: { noteIndex: 1 } }, [], []);
    return htmlToMarked(r?.[1]?.[0]?.[1] ?? "");
  };
  const perPage: Record<string, string> = {};
  for (const [k, p] of Object.entries(pages)) perPage[k] = cite(p || undefined);
  return { reference, inText: cite(), perPage };
}
