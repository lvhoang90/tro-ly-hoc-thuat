import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { copyRich } from "../lib/clipboard.ts";
import { APP, withUtm } from "../lib/config.ts";
import { STYLES, formatCitation, isNumbered, toHtml, toPlain, type Citation, type StyleId } from "../../shared/citation.ts";
import { CSL_FORMAT, formatCsl, loadCslIndex, type CslEntry } from "../lib/csl.ts";
import type { Author, Lang, Passage, SourceMeta, SourceType } from "../../shared/types.ts";
import { FlagToggle } from "./Chrome.tsx";
import { Icon } from "./Icon.tsx";

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
          <button type="button" className="icon-btn" aria-label="remove" onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon name="x" size={15} /></button>
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => onChange([...value, { family: "", given: "" }])}><Icon name="plus" size={14} /> {t("add_author")}</button>
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
      <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="book" size={15} /> {t("csl_more")} <Icon name="chevron" size={14} className={open ? "chev up" : "chev"} />
      </button>
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

export interface CiteCtx { score: number; projectId: string; abstractHash: string; abstractTitle: string }

export default function CiteStep({ meta: initial, passages, ctx, onBack, onAnother, onNewProject }: {
  meta: SourceMeta; passages: Passage[]; ctx: CiteCtx; onBack: () => void; onAnother: () => void; onNewProject: () => void;
}) {
  const { t, lang: ui } = useI18n();
  const { toast, celebrate, session } = useApp();
  const [meta, setMeta] = useState<SourceMeta>(initial);
  const [style, setStyle] = useState<string>("apa");
  const [cslId, setCslId] = useState("");
  const isCsl = style === "csl";
  const [cslRes, setCslRes] = useState<{ base: Citation; per: Record<string, string> } | null>(null);
  const [cslBusy, setCslBusy] = useState(false);
  const [cslErr, setCslErr] = useState(false);
  // Ngôn ngữ trích dẫn đi theo ngôn ngữ giao diện, trừ khi người dùng tự chọn khác.
  const [cl, setCl] = useState<Lang>(ui);
  const touched = useRef(false);
  useEffect(() => { if (!touched.current) setCl(ui); }, [ui]);
  const [pages, setPages] = useState<Record<string, string>>(() => Object.fromEntries(passages.map((p) => [p.id, p.page])));
  const saved = useRef(new Set<string>());
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState(!initial.title || !initial.authors.length || !initial.year);
  const incomplete = !initial.title || !initial.authors.length || !initial.year;

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
  const styleInfo = STYLES.find((s) => s.id === style);
  const cite = (it?: { p: Passage; c: Citation }) => (it ? it.c.inText : base.inText);

  async function record(ref: string, inText: string, quote: string, page: string, priority: string) {
    const key = [styleKey, cl, ref, inText, quote].join("|");
    if (saved.current.has(key) || !session) return;
    saved.current.add(key);
    const { error } = await supabase.from("citations").insert({
      user_id: session.user.id, style: styleKey, cite_lang: cl, reference: toPlain(ref), in_text: toPlain(inText), quote, page, priority, project: ctx.abstractTitle, source: meta,
      score: ctx.score, project_id: ctx.projectId || null, abstract_hash: ctx.abstractHash, abstract_title: ctx.abstractTitle,
    });
    if (error) { saved.current.delete(key); toast(error.message, "err"); }
  }

  async function copy(plain: string, rich: string, what: string, rec: () => Promise<void>) {
    const ok = await copyRich(plain, rich);
    if (!ok) { toast(t("copy_fail"), "err"); return; }
    setDone((n) => n + 1);
    celebrate(t("win_title", { what }), plain.length > 140 ? plain.slice(0, 140).trimEnd() + "…" : plain, t("win_note"));
    await rec();
  }

  const copyRef = () => copy(toPlain(base.reference), toHtml(base.reference), t("reference"), () => record(base.reference, base.inText, "", "", ""));
  const copyIn = (it?: (typeof items)[number]) => copy(toPlain(cite(it)), toHtml(cite(it)), t("in_text"),
    () => record(base.reference, cite(it), it?.p.quote ?? "", it ? pages[it.p.id] : "", it?.p.priority ?? ""));
  const copyQuote = (it: (typeof items)[number]) => {
    const text = `“${it.p.quote}” ${it.c.inText}`;
    return copy(toPlain(text), toHtml(text), t("quote"), () => record(base.reference, it.c.inText, it.p.quote, pages[it.p.id], it.p.priority));
  };
  const copyAll = () => {
    const body = items.map((it) => `“${it.p.quote}” ${it.c.inText}`).join("\n\n");
    const plain = `${body}${body ? "\n\n" : ""}${toPlain(base.reference)}`;
    const html = `${toHtml(body)}${body ? "<br><br>" : ""}${toHtml(base.reference)}`;
    return copy(plain, html, t("everything"), async () => {
      await record(base.reference, base.inText, "", "", "");
      for (const it of items) await record(base.reference, it.c.inText, it.p.quote, pages[it.p.id], it.p.priority);
    });
  };

  return (
    <div className="cite-layout">
      <aside className="cite-side">
        <div className="card">
          <h3 className="serif">{t("cite_style")}</h3>
          <div className="lbl">{t("cite_lang")}</div>
          <FlagToggle value={cl} onChange={(l) => { touched.current = true; setCl(l); }} label={t("cite_lang")} />
          <p className="muted small">{cl === "vi" ? t("cl_vi_note") : t("cl_en_note")}</p>
          <div className="lbl">{t("cite_style")}</div>
          <div className="stylechips" role="radiogroup" aria-label={t("cite_style")}>
            {STYLES.map((s) => (
              <button key={s.id} role="radio" aria-checked={style === s.id} className={style === s.id ? "on" : ""} onClick={() => setStyle(s.id)}>{s.label.split(" (")[0]}</button>
            ))}
          </div>
          {styleInfo && <p className="muted small style-hint">{styleInfo.label} · {styleInfo.hint[ui]}</p>}
          <CslPicker value={isCsl ? cslId : ""} onPick={(id) => { setCslId(id); setStyle("csl"); }} />
        </div>

        <div className="card">
          <div className="between">
            <h3 className="serif">{t("source_info")}</h3>
            <button className="btn sm" onClick={() => setOpen(!open)}>{open ? t("hide") : t("edit")}</button>
          </div>
          <p className="src-line">{meta.authors.map((a) => a.family).filter(Boolean).join(", ") || "—"}{meta.year ? ` (${meta.year})` : ""}<br /><i>{meta.title || "—"}</i></p>
          {incomplete && <p className="warn small"><Icon name="alert" size={14} /> {t("meta_incomplete")}</p>}
          {open && (
            <div className="form-grid one">
              <label>{t("src_type")}
                <select value={meta.type} onChange={(e) => m("type", e.target.value)}>{TYPES.map((x) => <option key={x} value={x}>{t(`type_${x}` as "type_article")}</option>)}</select>
              </label>
              <label>{t("year")}<input value={meta.year} onChange={(e) => m("year", e.target.value)} inputMode="numeric" /></label>
              <label>{t("title")}<input value={meta.title} onChange={(e) => m("title", e.target.value)} /></label>
              {meta.lang === "vi" && <label>{t("title_en")}<input value={meta.titleEn ?? ""} onChange={(e) => m("titleEn", e.target.value)} /></label>}
              <div><span className="lbl">{t("authors")}</span><AuthorsEditor value={meta.authors} onChange={(a) => setMeta({ ...meta, authors: a })} /></div>
              <label>{meta.type === "book" || meta.type === "report" || meta.type === "web" ? t("publisher") : t("container")}
                <input value={meta.container} onChange={(e) => m("container", e.target.value)} /></label>
              <div className="row"><label className="grow">{t("volume")}<input value={meta.volume} onChange={(e) => m("volume", e.target.value)} /></label>
                <label className="grow">{t("issue")}<input value={meta.issue} onChange={(e) => m("issue", e.target.value)} /></label></div>
              <label>{t("pages")}<input value={meta.pages} onChange={(e) => m("pages", e.target.value)} placeholder="45-67" /></label>
              <label>{t("publisher")}<input value={meta.publisher} onChange={(e) => m("publisher", e.target.value)} /></label>
              <label>DOI<input value={meta.doi} onChange={(e) => m("doi", e.target.value)} placeholder="10.xxxx/xxxxx" /></label>
              <label>URL<input value={meta.url} onChange={(e) => m("url", e.target.value)} /></label>
            </div>
          )}
        </div>
      </aside>

      <div className="cite-main">
        <section className="out-card">
          <div className="out-head">
            <div><small>{t("reference_entry")}</small><b>{isCsl ? (cslId || "CSL") : styleInfo?.label}</b></div>
            <button className="btn primary" onClick={copyRef} disabled={noRef}><Icon name="copy" size={16} /> {t("copy")}</button>
          </div>
          {cslBusy && <p className="muted small">…</p>}
          {cslErr && <p className="err small">{t("csl_fail")}</p>}
          {isCsl && !cslId && <p className="muted">{t("csl_choose")}</p>}
          <pre className={`cite-out ${noInText ? "code" : ""}`} dangerouslySetInnerHTML={{ __html: toHtml(base.reference) }} />
          {!noInText && (
            <div className="out-in">
              <div><small>{t("in_text")}</small><div className="cite-in" dangerouslySetInnerHTML={{ __html: toHtml(base.inText) }} /></div>
              <button className="btn sm" onClick={() => copyIn()}><Icon name="copy" size={14} /> {t("copy")}</button>
            </div>
          )}
          {numbered && <p className="muted small">{t("numbered_note")}</p>}
        </section>

        {items.length > 0 && (
          <section className="out-card">
            <div className="out-head">
              <div><small>{t("quotes_h")}</small><b>{t("quotes_selected", { n: items.length })}</b></div>
              {!noInText && <button className="btn sm" onClick={copyAll}><Icon name="copy" size={14} /> {t("copy_all")}</button>}
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
                      {!noInText && <button className="btn sm primary" onClick={() => copyQuote(it)}><Icon name="copy" size={14} /> {t("copy_quote")}</button>}
                      {!noInText && <button className="btn sm" onClick={() => copyIn(it)}>{t("copy_in_text")}</button>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`finish ${done ? "done" : ""}`}>
          <div className="finish-head">
            <span className="finish-ico"><Icon name={done ? "checkCircle" : "info"} size={22} /></span>
            <div>
              <h3 className="serif">{t("finish_q")}</h3>
              <p className="muted small">{done ? t("finish_done", { n: done }) : t("finish_hint")}</p>
            </div>
          </div>
          <div className="choices two">
            <button className="choice primary" onClick={onAnother}>
              <span className="choice-ico"><Icon name="refresh" size={22} /></span>
              <span className="choice-body"><b>{t("finish_yes")}</b><small>{t("opt_another_d")}</small></span>
              <Icon name="right" size={18} className="choice-go" />
            </button>
            <button className="choice" onClick={onBack}>
              <span className="choice-ico"><Icon name="left" size={22} /></span>
              <span className="choice-body"><b>{t("finish_more")}</b><small>{t("finish_more_d")}</small></span>
            </button>
            <a className="choice" href="#/history">
              <span className="choice-ico"><Icon name="clock" size={22} /></span>
              <span className="choice-body"><b>{t("nav_history")}</b><small>{t("finish_hist_d")}</small></span>
            </a>
            <button className="choice" onClick={onNewProject}>
              <span className="choice-ico"><Icon name="plus" size={22} /></span>
              <span className="choice-body"><b>{t("new_project")}</b><small>{t("opt_new_d")}</small></span>
            </button>
            {done > 0 && (
              <a className="choice" href={withUtm(APP.author.vanthu, "cite-finish")} target="_blank" rel="noopener noreferrer">
                <span className="choice-ico"><Icon name="file" size={22} /></span>
                <span className="choice-body"><b>{t("finish_may")}</b><small>{t("finish_may_d")}</small></span>
                <Icon name="right" size={18} className="choice-go" />
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
