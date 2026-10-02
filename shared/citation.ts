// Định dạng trích dẫn theo các chuẩn quốc tế thông dụng. Chạy hoàn toàn ở trình duyệt (không tốn băng thông).
// Văn bản dùng *dấu sao* để đánh dấu chữ nghiêng; dùng toPlain() / toHtml() khi sao chép.
import type { Author, Lang, SourceMeta } from "./types.ts";

export type StyleId = "apa" | "mla" | "chicago" | "harvard" | "ieee" | "vancouver" | "ama" | "bibtex" | "ris";

export const STYLES: { id: StyleId; label: string; hint: { vi: string; en: string } }[] = [
  { id: "apa", label: "APA 7th", hint: { vi: "Giáo dục, tâm lý, khoa học xã hội; phổ biến nhất ở tạp chí trong nước", en: "Education, psychology, social sciences" } },
  { id: "harvard", label: "Harvard (Cite Them Right)", hint: { vi: "Tác giả - năm, dùng rộng rãi ở Anh, Úc", en: "Author-date, common in UK and Australia" } },
  { id: "chicago", label: "Chicago 17th (author-date)", hint: { vi: "Nhân văn, lịch sử, khoa học xã hội", en: "Humanities, history, social sciences" } },
  { id: "mla", label: "MLA 9th", hint: { vi: "Ngữ văn, ngôn ngữ, nhân văn", en: "Literature, language, humanities" } },
  { id: "ieee", label: "IEEE", hint: { vi: "Kỹ thuật, công nghệ thông tin; đánh số", en: "Engineering, computing; numbered" } },
  { id: "vancouver", label: "Vancouver (ICMJE/NLM)", hint: { vi: "Y sinh; đánh số", en: "Biomedicine; numbered" } },
  { id: "ama", label: "AMA 11th", hint: { vi: "Y học; đánh số", en: "Medicine; numbered" } },
  { id: "bibtex", label: "BibTeX", hint: { vi: "LaTeX, Overleaf", en: "LaTeX, Overleaf" } },
  { id: "ris", label: "RIS", hint: { vi: "EndNote, Zotero, Mendeley", en: "EndNote, Zotero, Mendeley" } },
];

export interface CiteOpts {
  style: StyleId;
  lang: Lang;            // ngôn ngữ của các từ nối (&/và, pp./tr., et al./và cs.)
  page?: string;         // trang của trích đoạn (khi trích trực tiếp)
  index?: number;        // số thứ tự cho kiểu đánh số
}
export interface Citation { reference: string; inText: string }

const W = {
  en: { and: "&", andWord: "and", etAl: "et al.", pp: "pp.", p: "p.", vol: "vol.", no: "no.", in: "In", thesis: "Thesis", retrieved: "Retrieved", ed: "ed." },
  vi: { and: "và", andWord: "và", etAl: "và cs.", pp: "tr.", p: "tr.", vol: "tập", no: "số", in: "Trong", thesis: "Luận văn/Luận án", retrieved: "Truy cập từ", ed: "xuất bản lần thứ" },
};

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const nonEmpty = <T>(a: (T | "" | undefined | false)[]) => a.filter(Boolean) as T[];

export const normDoi = (d: string) => clean(d).replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, "");
const doiUrl = (d: string) => (d ? `https://doi.org/${normDoi(d)}` : "");
const link = (m: SourceMeta) => (m.doi ? doiUrl(m.doi) : clean(m.url));
const dash = (p: string) => clean(p).replace(/\s*[-–—]\s*/g, "–");
const hyphen = (p: string) => clean(p).replace(/\s*[-–—]\s*/g, "-");

/** Chữ cái đầu: "Văn An" → "V. A." (giữ dấu tiếng Việt, nhận cả tên có gạch nối). */
function initials(given: string, spaced = true, dots = true): string {
  const parts = clean(given).split(/[\s]+/).filter(Boolean);
  const out = parts.map((p) =>
    p.split("-").map((x) => (x ? x[0].toUpperCase() + (dots ? "." : "") : "")).join(dots ? "-" : ""));
  return out.join(spaced ? " " : "");
}

const fam = (a: Author) => clean(a.family);
const given = (a: Author) => clean(a.given);
const hasNames = (m: SourceMeta) => m.authors.some((a) => fam(a));
const authors = (m: SourceMeta) => m.authors.filter((a) => fam(a));

function joinList(items: string[], last: string, oxford: boolean): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} ${last} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}${oxford ? "," : ""} ${last} ${items[items.length - 1]}`;
}
/** Thêm dấu chấm cuối nếu chưa có. */
const dot = (s: string) => (!s ? "" : /[.?!]$/.test(s.replace(/\*+$/, "")) ? s : s + ".");

// ---------- Danh sách tác giả theo từng kiểu ----------
function apaAuthors(m: SourceMeta, w: typeof W.en): string {
  const list = authors(m).map((a) => (given(a) ? `${fam(a)}, ${initials(given(a))}` : fam(a)));
  if (list.length > 20) return `${list.slice(0, 19).join(", ")}, ... ${list[list.length - 1]}`;
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")}, ${w.and} ${list[list.length - 1]}`;
}
function harvardAuthors(m: SourceMeta, w: typeof W.en): string {
  const list = authors(m).map((a) => (given(a) ? `${fam(a)}, ${initials(given(a))}` : fam(a)));
  if (list.length > 3) return `${list[0]} ${w.etAl}`;
  return joinList(list, w.andWord, false);
}
function mlaAuthors(m: SourceMeta, w: typeof W.en): string {
  const a = authors(m);
  const first = given(a[0]) ? `${fam(a[0])}, ${given(a[0])}` : fam(a[0]);
  if (a.length === 1) return first;
  if (a.length >= 3) return `${first}, ${w.etAl}`;
  return `${first}, ${w.andWord} ${given(a[1]) ? given(a[1]) + " " : ""}${fam(a[1])}`;
}
function chicagoAuthors(m: SourceMeta, w: typeof W.en): string {
  const a = authors(m);
  const list = a.map((x, i) => (i === 0 ? (given(x) ? `${fam(x)}, ${given(x)}` : fam(x)) : `${given(x) ? given(x) + " " : ""}${fam(x)}`));
  if (list.length > 10) return `${list.slice(0, 7).join(", ")}, ${w.etAl}`;
  return joinList(list, w.andWord, true);
}
function ieeeAuthors(m: SourceMeta, w: typeof W.en): string {
  const list = authors(m).map((a) => (given(a) ? `${initials(given(a))} ${fam(a)}` : fam(a)));
  if (list.length > 6) return `${list[0]} ${w.etAl}`;
  return joinList(list, w.andWord, true);
}
function numAuthors(m: SourceMeta, w: typeof W.en, max: number, shown: number): string {
  const list = authors(m).map((a) => (given(a) ? `${fam(a)} ${initials(given(a), false, false)}` : fam(a)));
  if (list.length > max) return `${list.slice(0, shown).join(", ")}, ${w.etAl}`;
  return list.join(", ");
}

// ---------- Trích dẫn trong văn bản ----------
function inTextName(m: SourceMeta, w: typeof W.en, joiner: string, etAlAt: number): string {
  const a = authors(m).map(fam);
  if (a.length === 0) return `*${shortTitle(m.title)}*`;
  if (a.length === 1) return a[0];
  if (a.length === 2 && etAlAt > 2) return `${a[0]} ${joiner} ${a[1]}`;
  if (a.length < etAlAt) return joinList(a, joiner, false);
  return `${a[0]} ${w.etAl}`;
}
const shortTitle = (t: string) => clean(t).split(/[:?]/)[0].split(" ").slice(0, 6).join(" ");

// ---------- Chính ----------
export function formatCitation(m: SourceMeta, o: CiteOpts): Citation {
  const w = W[o.lang];
  const vi2en = o.lang === "en" && m.lang === "vi" && m.titleEn ? ` [${clean(m.titleEn)}]` : "";
  const T = clean(m.title) + vi2en;
  const Y = clean(m.year) || (o.lang === "vi" ? "không rõ năm" : "n.d.");
  const C = clean(m.container), V = clean(m.volume), I = clean(m.issue), P = clean(m.pages);
  const PUB = clean(m.publisher), L = link(m);
  const page = clean(o.page);
  const n = o.index ?? 1;
  const noAuth = !hasNames(m);

  switch (o.style) {
    case "apa": {
      const A = noAuth ? "" : apaAuthors(m, w);
      const head = noAuth ? `${dot(m.type === "article" || m.type === "chapter" ? T : `*${T}*`)} (${Y}).` : `${dot(A)} (${Y}).`;
      let body = "";
      switch (m.type) {
        case "article": body = `${noAuth ? "" : dot(T) + " "}${nonEmpty([C && `*${C}*`, V && (I ? `*${V}*(${I})` : `*${V}*`), P && dash(P)]).join(", ")}.`.replace(/^ /, ""); break;
        case "chapter":
        case "conference": body = `${noAuth ? "" : dot(T) + " "}${w.in} *${C}*${P ? ` (${w.pp} ${dash(P)})` : ""}. ${dot(PUB)}`.trim(); break;
        case "thesis": body = `${noAuth ? "" : `*${T}* `}[${w.thesis}${PUB ? `, ${PUB}` : ""}].`.trim(); break;
        default: body = `${noAuth ? "" : `*${T}*. `}${dot(PUB || C)}`.trim();
      }
      const ref = `${head} ${body}${L ? " " + L : ""}`.replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
      const nm = inTextName(m, w, w.and, 3);
      return { reference: ref, inText: `(${nm}, ${Y}${page ? `, ${w.p} ${page}` : ""})` };
    }
    case "harvard": {
      const A = noAuth ? "" : harvardAuthors(m, w);
      const lead = noAuth ? `${m.type === "article" || m.type === "chapter" ? `'${T}'` : `*${T}*`} (${Y})` : `${A} (${Y})`;
      let body = "";
      switch (m.type) {
        case "article": body = `${noAuth ? "" : `'${T}', `}*${C}*${V ? `, ${V}${I ? `(${I})` : ""}` : ""}${P ? `, ${w.pp} ${dash(P)}` : ""}`; break;
        case "chapter":
        case "conference": body = `${noAuth ? "" : `'${T}', `}${w.in}: *${C}*${PUB ? `. ${PUB}` : ""}${P ? `, ${w.pp} ${dash(P)}` : ""}`; break;
        case "thesis": body = `${noAuth ? "" : `*${T}*. `}${w.thesis}${PUB ? `. ${PUB}` : ""}`; break;
        default: body = `${noAuth ? "" : `*${T}*. `}${PUB || C}`;
      }
      const ref = `${lead}${body ? " " + body.replace(/^\s+|\.$/g, "") : ""}.${m.doi ? ` doi:${normDoi(m.doi)}.` : m.url ? ` Available at: ${m.url}.` : ""}`
        .replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
      const nm = inTextName(m, w, w.andWord, 4);
      return { reference: ref, inText: `(${nm}, ${Y}${page ? `, ${w.p} ${page}` : ""})` };
    }
    case "chicago": {
      const A = noAuth ? "" : chicagoAuthors(m, w);
      const lead = noAuth ? `${dot(m.type === "article" || m.type === "chapter" ? `"${T}"` : `*${T}*`)} ${Y}.` : `${dot(A)} ${Y}.`;
      let body = "";
      switch (m.type) {
        case "article": body = `${noAuth ? "" : `"${dot(T)}" `}*${C}*${V ? ` ${V}` : ""}${I ? ` (${I})` : ""}${P ? `: ${dash(P)}` : ""}.`; break;
        case "chapter":
        case "conference": body = `${noAuth ? "" : `"${dot(T)}" `}${w.in} *${C}*${P ? `, ${dash(P)}` : ""}. ${dot(PUB)}`; break;
        case "thesis": body = `${noAuth ? "" : `*${T}*. `}${w.thesis}${PUB ? `, ${PUB}` : ""}.`; break;
        default: body = `${noAuth ? "" : `*${T}*. `}${dot(PUB || C)}`;
      }
      const ref = `${lead} ${body}${L ? " " + L + "." : ""}`.replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
      const nm = inTextName(m, w, w.andWord, 4);
      return { reference: ref, inText: `(${nm} ${Y}${page ? `, ${page}` : ""})` };
    }
    case "mla": {
      const A = noAuth ? "" : mlaAuthors(m, w);
      let body = "";
      switch (m.type) {
        case "article": body = `"${dot(T)}" *${C}*${nonEmpty([V && `${w.vol} ${V}`, I && `${w.no} ${I}`, Y, P && `${w.pp} ${hyphen(P)}`]).map((x, i) => (i === 0 ? ", " + x : ", " + x)).join("")}.`; break;
        case "chapter":
        case "conference": body = `"${dot(T)}" *${C}*, ${PUB ? PUB + ", " : ""}${Y}${P ? `, ${w.pp} ${hyphen(P)}` : ""}.`; break;
        case "thesis": body = `*${T}*. ${Y}. ${PUB ? PUB + ", " : ""}${w.thesis}.`; break;
        default: body = `*${T}*. ${PUB ? PUB + ", " : ""}${Y}.`;
      }
      const ref = `${A ? dot(A) + " " : ""}${body}${L ? " " + L + "." : ""}`.replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
      const nm = inTextName(m, w, w.andWord, 3);
      return { reference: ref, inText: `(${nm}${page ? " " + page : ""})` };
    }
    case "ieee": {
      const A = noAuth ? "" : ieeeAuthors(m, w);
      let body = "";
      switch (m.type) {
        case "article": body = `"${T}," *${C}*${V ? `, ${w.vol} ${V}` : ""}${I ? `, ${w.no} ${I}` : ""}${P ? `, ${w.pp} ${dash(P)}` : ""}, ${Y}`; break;
        case "chapter":
        case "conference": body = `"${T}," in *${C}*${PUB ? `, ${PUB}` : ""}, ${Y}${P ? `, ${w.pp} ${dash(P)}` : ""}`; break;
        case "thesis": body = `*${T}*, ${w.thesis}${PUB ? `, ${PUB}` : ""}, ${Y}`; break;
        default: body = `*${T}*${PUB ? `. ${PUB}` : ""}, ${Y}`;
      }
      const tail = m.doi ? `, doi: ${normDoi(m.doi)}.` : m.url ? `. [Online]. Available: ${m.url}` : ".";
      const ref = `[${n}] ${A ? A + ", " : ""}${body}${tail}`.replace(/\s+/g, " ");
      return { reference: ref, inText: `[${n}${page ? `, ${w.p} ${page}` : ""}]` };
    }
    case "vancouver":
    case "ama": {
      const A = noAuth ? "" : numAuthors(m, w, o.style === "ama" ? 6 : 6, o.style === "ama" ? 3 : 6);
      const ital = o.style === "ama";
      const jc = ital ? `*${C}*` : C;
      let body = "";
      switch (m.type) {
        case "article": body = `${dot(T)} ${jc}. ${Y}${V ? `;${V}` : ""}${I ? `(${I})` : ""}${P ? `:${hyphen(P)}` : ""}.`; break;
        case "chapter":
        case "conference": body = `${dot(T)} ${w.in}: ${jc}. ${PUB ? dot(PUB) + " " : ""}${Y}${P ? `:${hyphen(P)}` : ""}.`; break;
        case "thesis": body = `${dot(ital ? `*${T}*` : T)} [${w.thesis}]. ${PUB ? dot(PUB) + " " : ""}${Y}.`; break;
        default: body = `${dot(ital ? `*${T}*` : T)} ${PUB ? dot(PUB) + " " : ""}${Y}.`;
      }
      const tail = m.doi ? ` doi:${normDoi(m.doi)}` : m.url ? ` ${m.url}` : "";
      const ref = `${n}. ${A ? dot(A) + " " : ""}${body}${tail}`.replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
      return { reference: ref, inText: o.style === "ama" ? `^${n}^` : `(${n})` };
    }
    case "bibtex": {
      const key = `${(authors(m)[0] ? fam(authors(m)[0]) : "anon").normalize("NFKD").replace(/[^A-Za-z]/g, "").toLowerCase() || "anon"}${Y.replace(/\D/g, "")}${shortTitle(T).split(" ")[0].normalize("NFKD").replace(/[^A-Za-z]/g, "").toLowerCase()}`;
      const type = { article: "article", book: "book", chapter: "incollection", conference: "inproceedings", thesis: "phdthesis", report: "techreport", web: "misc" }[m.type];
      const containerField = m.type === "article" ? "journal" : m.type === "chapter" || m.type === "conference" ? "booktitle" : "";
      const f: [string, string][] = [
        ["author", authors(m).map((a) => `${fam(a)}${given(a) ? ", " + given(a) : ""}`).join(" and ")],
        ["title", T], [containerField, C], ["year", clean(m.year)], ["volume", V], ["number", I], ["pages", P ? dash(P).replace("–", "--") : ""],
        [m.type === "thesis" ? "school" : "publisher", PUB], ["doi", normDoi(m.doi)], ["url", m.doi ? "" : clean(m.url)],
      ];
      const body = f.filter(([k, v]) => k && v).map(([k, v]) => `  ${k} = {${v}}`).join(",\n");
      return { reference: `@${type}{${key},\n${body}\n}`, inText: `\\cite{${key}}` };
    }
    case "ris": {
      const ty = { article: "JOUR", book: "BOOK", chapter: "CHAP", conference: "CONF", thesis: "THES", report: "RPRT", web: "ELEC" }[m.type];
      const lines = [`TY  - ${ty}`, ...authors(m).map((a) => `AU  - ${fam(a)}${given(a) ? ", " + given(a) : ""}`), `TI  - ${T}`,
        C && `${m.type === "article" ? "JO" : "T2"}  - ${C}`, m.year && `PY  - ${clean(m.year)}`, V && `VL  - ${V}`, I && `IS  - ${I}`,
        ...(P ? [`SP  - ${dash(P).split("–")[0]}`, ...(dash(P).includes("–") ? [`EP  - ${dash(P).split("–")[1]}`] : [])] : []),
        PUB && `PB  - ${PUB}`, m.doi && `DO  - ${normDoi(m.doi)}`, m.url && `UR  - ${clean(m.url)}`, "ER  - "];
      return { reference: nonEmpty(lines).join("\n"), inText: "" };
    }
  }
}

/** Bỏ ký hiệu nghiêng, dùng để dán vào trình soạn thảo thuần văn bản. */
export const toPlain = (s: string) => s.replace(/\*([^*]+)\*/g, "$1").replace(/\^(\d+)\^/g, "$1");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** HTML có chữ nghiêng (dán vào Word/Google Docs giữ nguyên định dạng). */
export const toHtml = (s: string) => esc(s).replace(/\*([^*]+)\*/g, "<i>$1</i>").replace(/\^(\d+)\^/g, "<sup>$1</sup>").replace(/\n/g, "<br>");

export const isNumbered = (s: StyleId) => s === "ieee" || s === "vancouver" || s === "ama";
