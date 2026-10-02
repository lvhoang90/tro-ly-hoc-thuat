import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { copyRich } from "../lib/clipboard.ts";
import { STYLES, formatCitation, isNumbered, toHtml, toPlain, type Citation, type StyleId } from "../../shared/citation.ts";
import { CSL_FORMAT, formatCsl, loadCslIndex, type CslEntry } from "../lib/csl.ts";
import type { Author, Lang, Passage, SourceMeta, SourceType } from "../../shared/types.ts";

const TYPES: SourceType[] = ["article", "book", "chapter", "conference", "thesis", "report", "web"];

function AuthorsEditor({ value, onChange }: { value: Author[]; onChange: (a: Author[]) => void }) {
  const { t } = useI18n();
  const set = (i: number, k: keyof Author, v: string) => onChange(value.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  return (
    <div className="authors">
      {value.map((a, i) => (
        <div className="row" key={i}>
          <input value={a.family} placeholder={t("family")} onChange={(e) => set(i, "family", e.target.value)} aria-label={t("family")} />
          <input value={a.given} placeholder={t("given")} onChange={(e) => set(i, "given", e.target.value)} aria-label={t("given")} />
          <button type="button" className="icon-btn" aria-label="remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => onChange([...value, { family: "", given: "" }])}>+ {t("add_author")}</button>
      <small className="muted">{t("author_hint")}</small>
    </div>
  );
}

function CslPicker({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  const { t } = useI18n();
  const [list, setList] = useState<CslEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(!!value);
  const [fail, setFail] = useState(false);
  useEffect(() => { if (open && !list) loadCslIndex().then(setList).catch(() => setFail(true)); }, [open, list]);
  const shown = useMemo(() => {
    if (!list) return [];
    const k = q.trim().toLowerCase();
    return (k ? list.filter((x) => x.title.toLowerCase().includes(k) || x.id.includes(k)) : list.filter((x) => !x.dependent)).slice(0, 40);
  }, [list, q]);
  const cur = list?.find((x) => x.id === value);
  return (
    <div className="csl">
      <button className="btn sm" onClick={() => setOpen(!open)} aria-expanded={open}>{t("csl_more")} {open ? "▴" : "▾"}</button>
      {open && (
        <div className="stack">
          <p className="muted small">{t("csl_hint")}</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("csl_search")} aria-label={t("csl_search")} />
          {fail && <p className="err small">{t("csl_fail")}</p>}
          {!list && !fail && <p className="muted small">…</p>}
          <ul className="csl-list">
            {shown.map((x) => (
              <li key={x.id}><button className={x.id === value ? "on" : ""} onClick={() => onPick(x.id)}>
                <span>{x.title}</span><small>{CSL_FORMAT[x.format] ?? ""}</small></button></li>
            ))}
            {list && shown.length === 0 && <li className="muted small">{t("reco_none")}</li>}
          </ul>
          {cur && <p className="small">{t("csl_selected")}: <b>{cur.title}</b> <span className="badge">{CSL_FORMAT[cur.format]}</span></p>}
          <p className="muted small">{t("csl_credit")}</p>
        </div>
      )}
    </div>
  );
}

export default function CiteStep({ meta: initial, passages, project, onBack }: {
  meta: SourceMeta; passages: Passage[]; project: string; onBack: () => void;
}) {
  const { t, lang: ui } = useI18n();
  const { toast, session } = useApp();
  const [meta, setMeta] = useState<SourceMeta>(initial);
  const [style, setStyle] = useState<string>("apa");
  const [cslId, setCslId] = useState("");
  const isCsl = style === "csl";
  const [cslRes, setCslRes] = useState<{ base: Citation; per: Record<string, string> } | null>(null);
  const [cslBusy, setCslBusy] = useState(false);
  const [cslErr, setCslErr] = useState(false);
  const [cl, setCl] = useState<Lang>(ui);
  const [pages, setPages] = useState<Record<string, string>>(() => Object.fromEntries(passages.map((p) => [p.id, p.page])));
  const saved = useRef(new Set<string>());
  const [open, setOpen] = useState(!initial.title || !initial.authors.length || !initial.year);

  const m = (k: keyof SourceMeta, v: string) => setMeta({ ...meta, [k]: v });
  useEffect(() => {
    if (!isCsl || !cslId) { setCslRes(null); return; }
    let live = true;
    setCslBusy(true); setCslErr(false);
    const id = setTimeout(() => {
      formatCsl(meta, cslId, cl, pages).then((r) => { if (live) setCslRes({ base: { reference: r.reference, inText: r.inText }, per: r.perPage }); })
        .catch(() => { if (live) { setCslRes(null); setCslErr(true); } })
        .finally(() => { if (live) setCslBusy(false); });
    }, 250);
    return () => { live = false; clearTimeout(id); };
  }, [isCsl, cslId, meta, cl, pages]);

  const base: Citation = useMemo(() => isCsl ? (cslRes?.base ?? { reference: "", inText: "" }) : formatCitation(meta, { style: style as StyleId, lang: cl }), [meta, style, cl, isCsl, cslRes]);
  const items = useMemo(() => passages.map((p) => ({ p, c: isCsl ? { reference: base.reference, inText: cslRes?.per[p.id] ?? base.inText } : formatCitation(meta, { style: style as StyleId, lang: cl, page: pages[p.id] }) })),
    [passages, meta, style, cl, pages, isCsl, cslRes, base]);
  const numbered = !isCsl && isNumbered(style as StyleId);
  const noInText = style === "bibtex" || style === "ris";
  const styleKey = isCsl ? `csl:${cslId}` : style;
  const noRef = isCsl && !base.reference;
  const cite = (it?: { p: Passage; c: ReturnType<typeof formatCitation> }) => it ? it.c.inText : base.inText;

  async function record(kind: string, ref: string, inText: string, quote: string, page: string, priority: string) {
    const key = [styleKey, cl, ref, inText, quote].join("|");
    if (saved.current.has(key) || !session) return;
    saved.current.add(key);
    const { error } = await supabase.from("citations").insert({
      user_id: session.user.id, style: styleKey, cite_lang: cl, reference: toPlain(ref), in_text: toPlain(inText), quote, page, priority, project, source: meta,
    });
    if (error) { saved.current.delete(key); toast(error.message, "err"); }
    void kind;
  }

  async function copy(plain: string, rich: string, what: string, rec: () => Promise<void>) {
    const ok = await copyRich(plain, rich);
    if (!ok) { toast(t("copy_fail"), "err"); return; }
    toast(t("copied", { what }));
    await rec();
  }

  const copyRef = () => copy(toPlain(base.reference), toHtml(base.reference), t("reference"),
    () => record("ref", base.reference, base.inText, "", "", ""));
  const copyIn = (it?: (typeof items)[number]) => copy(toPlain(cite(it)), toHtml(cite(it)), t("in_text"),
    () => record("in", base.reference, cite(it), it?.p.quote ?? "", it ? pages[it.p.id] : "", it?.p.priority ?? ""));
  const copyQuote = (it: (typeof items)[number]) => {
    const text = `“${it.p.quote}” ${it.c.inText}`;
    return copy(toPlain(text), toHtml(text), t("quote"), () => record("quote", base.reference, it.c.inText, it.p.quote, pages[it.p.id], it.p.priority));
  };
  const copyAll = () => {
    const body = items.map((it) => `“${it.p.quote}” ${it.c.inText}`).join("\n\n");
    const plain = `${body}${body ? "\n\n" : ""}${toPlain(base.reference)}`;
    const html = `${toHtml(body)}${body ? "<br><br>" : ""}${toHtml(base.reference)}`;
    return copy(plain, html, t("everything"), async () => {
      await record("ref", base.reference, base.inText, "", "", "");
      for (const it of items) await record("quote", base.reference, it.c.inText, it.p.quote, pages[it.p.id], it.p.priority);
    });
  };

  return (
    <div className="stack gap">
      <div className="card">
        <div className="between">
          <h3>{t("cite_style")}</h3>
          <div className="row wrap">
            <label className="inline">{t("cite_lang")}
              <select value={cl} onChange={(e) => setCl(e.target.value as Lang)}>
                <option value="vi">{t("cl_vi")}</option>
                <option value="en">{t("cl_en")}</option>
              </select>
            </label>
          </div>
        </div>
        <div className="styles" role="radiogroup" aria-label={t("cite_style")}>
          {STYLES.map((s) => (
            <button key={s.id} role="radio" aria-checked={style === s.id} className={`style ${style === s.id ? "on" : ""}`} onClick={() => setStyle(s.id)}>
              <b>{s.label}</b><small>{s.hint[ui]}</small>
            </button>
          ))}
        </div>
        <CslPicker value={isCsl ? cslId : ""} onPick={(id) => { setCslId(id); setStyle("csl"); }} />
        {cl === "en" && ui === "vi" && <p className="muted small">{t("cl_en_note")}</p>}
      </div>

      <div className="card">
        <div className="between">
          <h3>{t("source_info")}</h3>
          <button className="btn sm" onClick={() => setOpen(!open)}>{open ? t("hide") : t("edit")}</button>
        </div>
        {(!initial.title || !initial.authors.length || !initial.year) && <p className="warn">{t("meta_incomplete")}</p>}
        {open && (
          <div className="form-grid">
            <label>{t("src_type")}
              <select value={meta.type} onChange={(e) => m("type", e.target.value)}>{TYPES.map((x) => <option key={x} value={x}>{t(`type_${x}` as "type_article")}</option>)}</select>
            </label>
            <label>{t("year")}<input value={meta.year} onChange={(e) => m("year", e.target.value)} inputMode="numeric" /></label>
            <label className="wide">{t("title")}<input value={meta.title} onChange={(e) => m("title", e.target.value)} /></label>
            {meta.lang === "vi" && <label className="wide">{t("title_en")}<input value={meta.titleEn ?? ""} onChange={(e) => m("titleEn", e.target.value)} /></label>}
            <div className="wide"><span className="lbl">{t("authors")}</span><AuthorsEditor value={meta.authors} onChange={(a) => setMeta({ ...meta, authors: a })} /></div>
            <label className="wide">{meta.type === "book" || meta.type === "report" || meta.type === "web" ? t("publisher") : t("container")}
              <input value={meta.container} onChange={(e) => m("container", e.target.value)} /></label>
            <label>{t("volume")}<input value={meta.volume} onChange={(e) => m("volume", e.target.value)} /></label>
            <label>{t("issue")}<input value={meta.issue} onChange={(e) => m("issue", e.target.value)} /></label>
            <label>{t("pages")}<input value={meta.pages} onChange={(e) => m("pages", e.target.value)} placeholder="45-67" /></label>
            <label>{t("publisher")}<input value={meta.publisher} onChange={(e) => m("publisher", e.target.value)} /></label>
            <label>DOI<input value={meta.doi} onChange={(e) => m("doi", e.target.value)} placeholder="10.xxxx/xxxxx" /></label>
            <label>URL<input value={meta.url} onChange={(e) => m("url", e.target.value)} /></label>
          </div>
        )}
      </div>

      <div className="card">
        <div className="between">
          <h3>{t("reference_entry")}</h3>
          <button className="btn primary sm" onClick={copyRef} disabled={noRef}>{t("copy")}</button>
        </div>
        {cslBusy && <p className="muted small">…</p>}
        {cslErr && <p className="err small">{t("csl_fail")}</p>}
        {isCsl && !cslId && <p className="muted">{t("csl_choose")}</p>}
        <pre className={`cite-out ${noInText ? "code" : ""}`} dangerouslySetInnerHTML={{ __html: toHtml(base.reference) }} />
        {!noInText && (
          <div className="between top">
            <div><span className="lbl">{t("in_text")}</span><div className="cite-in" dangerouslySetInnerHTML={{ __html: toHtml(base.inText) }} /></div>
            <button className="btn sm" onClick={() => copyIn()}>{t("copy")}</button>
          </div>
        )}
        {numbered && <p className="muted small">{t("numbered_note")}</p>}
      </div>

      {items.length > 0 && (
        <div className="card">
          <div className="between">
            <h3>{t("quotes_selected", { n: items.length })}</h3>
            {!noInText && <button className="btn sm" onClick={copyAll}>{t("copy_all")}</button>}
          </div>
          <ul className="passages cite">
            {items.map((it) => (
              <li key={it.p.id} className={`passage ${it.p.priority}`}>
                <div className="p-body">
                  <div className="p-meta">
                    <span className={`prio ${it.p.priority}`}>{t(`prio_${it.p.priority}` as "prio_high")}</span>
                    <label className="inline small">{t("page")}
                      <input className="mini" value={pages[it.p.id] ?? ""} onChange={(e) => setPages({ ...pages, [it.p.id]: e.target.value })} />
                    </label>
                  </div>
                  <blockquote>“{it.p.quote}”</blockquote>
                  {!noInText && <div className="cite-in" dangerouslySetInnerHTML={{ __html: toHtml(it.c.inText) }} />}
                  <div className="row wrap">
                    {!noInText && <button className="btn sm primary" onClick={() => copyQuote(it)}>{t("copy_quote")}</button>}
                    {!noInText && <button className="btn sm" onClick={() => copyIn(it)}>{t("copy_in_text")}</button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions"><button className="btn" onClick={onBack}>← {t("back")}</button><span className="muted small">{t("history_note")}</span></div>
    </div>
  );
}
