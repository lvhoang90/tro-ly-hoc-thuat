import { useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { copyRich } from "../lib/clipboard.ts";
import { STYLES, formatCitation, isNumbered, toHtml, toPlain, type StyleId } from "../../shared/citation.ts";
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

export default function CiteStep({ meta: initial, passages, project, onBack }: {
  meta: SourceMeta; passages: Passage[]; project: string; onBack: () => void;
}) {
  const { t, lang: ui } = useI18n();
  const { toast, session } = useApp();
  const [meta, setMeta] = useState<SourceMeta>(initial);
  const [style, setStyle] = useState<StyleId>("apa");
  const [cl, setCl] = useState<Lang>(ui);
  const [pages, setPages] = useState<Record<string, string>>(() => Object.fromEntries(passages.map((p) => [p.id, p.page])));
  const saved = useRef(new Set<string>());
  const [open, setOpen] = useState(!initial.title || !initial.authors.length || !initial.year);

  const m = (k: keyof SourceMeta, v: string) => setMeta({ ...meta, [k]: v });
  const base = useMemo(() => formatCitation(meta, { style, lang: cl }), [meta, style, cl]);
  const items = useMemo(() => passages.map((p) => ({ p, c: formatCitation(meta, { style, lang: cl, page: pages[p.id] }) })), [passages, meta, style, cl, pages]);
  const numbered = isNumbered(style);
  const noInText = style === "bibtex" || style === "ris";
  const cite = (it?: { p: Passage; c: ReturnType<typeof formatCitation> }) => it ? it.c.inText : base.inText;

  async function record(kind: string, ref: string, inText: string, quote: string, page: string, priority: string) {
    const key = [style, cl, ref, inText, quote].join("|");
    if (saved.current.has(key) || !session) return;
    saved.current.add(key);
    const { error } = await supabase.from("citations").insert({
      user_id: session.user.id, style, cite_lang: cl, reference: toPlain(ref), in_text: toPlain(inText), quote, page, priority, project, source: meta,
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
          <button className="btn primary sm" onClick={copyRef}>{t("copy")}</button>
        </div>
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
