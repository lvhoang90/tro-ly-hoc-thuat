import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { copyRich } from "../lib/clipboard.ts";
import { STYLES, formatCitation, toHtml, toPlain, type StyleId } from "../../shared/citation.ts";
import { PASS_SCORE, type Lang, type SourceMeta } from "../../shared/types.ts";
import { FlagToggle } from "../components/Chrome.tsx";
import { Icon } from "../components/Icon.tsx";

interface Row {
  id: string; created_at: string; style: string; cite_lang: string; reference: string; in_text: string; quote: string; page: string;
  priority: string; project: string; source: Partial<SourceMeta>; score: number | null; project_id: string | null; abstract_hash: string; abstract_title: string;
}
interface SourceGroup { key: string; meta: Partial<SourceMeta>; rows: Row[]; quotes: Row[]; score: number | null; best: number; last: number }
interface Topic { key: string; title: string; sources: SourceGroup[]; last: number }

const PRIO: Record<string, number> = { high: 0, medium: 1, low: 2 };
const hasMeta = (s: Partial<SourceMeta>): s is SourceMeta => !!s && !!s.title && Array.isArray(s.authors);

/** Nhãn mức phù hợp với đề tài theo điểm. */
function Fit({ score }: { score: number | null }) {
  const { t } = useI18n();
  if (score == null) return null;
  const k = score >= 80 ? "high" : score >= PASS_SCORE ? "mid" : "low";
  return <span className={`fit ${k}`} title={t("fit_title")}><Icon name={k === "low" ? "alert" : "checkCircle"} size={13} /> {t(`fit_${k}` as "fit_high")} · {score}/100</span>;
}

/** Một nguồn: kiểu trích dẫn và ngôn ngữ đổi ngay tại đây, áp dụng cho danh mục và mọi đoạn trích của nguồn đó. */
function Source({ g, onDelete }: { g: SourceGroup; onDelete: (ids: string[]) => void }) {
  const { t } = useI18n();
  const { toast } = useApp();
  const first = g.rows[0];
  const can = hasMeta(g.meta);
  const builtin = STYLES.some((s) => s.id === first.style);
  const [style, setStyle] = useState<string>(builtin ? first.style : "");
  const [lang, setLang] = useState<Lang>(first.cite_lang === "vi" ? "vi" : "en");
  const [open, setOpen] = useState(true);

  const fmt = (page: string) => (can && style ? formatCitation(g.meta as SourceMeta, { style: style as StyleId, lang, page: page || undefined }) : null);
  const ref = useMemo(() => fmt(""), [can, style, lang, g.meta]); // eslint-disable-line react-hooks/exhaustive-deps
  const refText = ref ? toPlain(ref.reference) : first.reference;
  const noIn = style === "bibtex" || style === "ris";
  const copy = async (plain: string, what: string, html?: string) => { toast((await copyRich(plain, html)) ? t("copied", { what }) : t("copy_fail"), "ok"); };
  const quotes = [...g.quotes].sort((a, b) => (PRIO[a.priority] ?? 3) - (PRIO[b.priority] ?? 3) || +new Date(b.created_at) - +new Date(a.created_at));

  return (
    <li className="card src-card">
      <div className="src-head">
        <button className="link strong src-title" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Icon name="chevron" size={15} className={open ? "chev up" : "chev"} /> {g.meta.title || first.reference.slice(0, 90)}
        </button>
        <Fit score={g.score} />
        <button className="icon-btn" aria-label={t("delete")} title={t("delete")} onClick={() => onDelete(g.rows.map((r) => r.id))}><Icon name="trash" size={15} /></button>
      </div>
      <p className="muted small">{(g.meta.authors ?? []).map((a) => a.family).join(", ")}{g.meta.year ? ` · ${g.meta.year}` : ""}{g.meta.container ? ` · ${g.meta.container}` : ""}</p>

      {open && (
        <>
          <div className="entry-controls">
            <label className="inline small">{t("cite_style")}
              <select value={style} onChange={(e) => setStyle(e.target.value)} disabled={!can}>
                {!builtin && <option value="">{first.style.startsWith("csl:") ? `CSL · ${first.style.slice(4)}` : first.style}</option>}
                {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <FlagToggle value={lang} onChange={setLang} label={t("cite_lang")} />
          </div>
          {!can && <p className="muted small">{t("hist_no_meta")}</p>}
          {ref ? <pre className="cite-out" dangerouslySetInnerHTML={{ __html: toHtml(ref.reference) }} /> : <pre className="cite-out">{refText}</pre>}
          <div className="row wrap"><button className="btn sm primary" onClick={() => copy(refText, t("reference"), ref ? toHtml(ref.reference) : undefined)}><Icon name="copy" size={14} /> {t("copy")} {t("reference").toLowerCase()}</button></div>

          {quotes.length > 0 && <h5 className="q-h">{t("quotes_h")} · {quotes.length}</h5>}
          <ul className="q-list">
            {quotes.map((r) => {
              const c = fmt(r.page);
              const inText = c ? toPlain(c.inText) : r.in_text;
              return (
                <li key={r.id} className={`passage ${r.priority || "low"}`}>
                  <div className="p-meta">
                    {r.priority && <span className={`prio ${r.priority}`}>{t(`prio_${r.priority}` as "prio_high")}</span>}
                    {r.page && <span className="badge">{t("page")} {r.page}</span>}
                    <span className="muted small">{new Date(r.created_at).toLocaleDateString()}</span>
                    <button className="icon-btn sm" aria-label={t("delete")} onClick={() => onDelete([r.id])}><Icon name="x" size={13} /></button>
                  </div>
                  <blockquote>“{r.quote}”</blockquote>
                  {!noIn && inText && <div className="cite-in">{inText}</div>}
                  <div className="row wrap">
                    {!noIn && inText && <button className="btn sm" onClick={() => copy(`“${r.quote}” ${inText}`, t("quote"))}><Icon name="copy" size={13} /> {t("copy_quote")}</button>}
                    {!noIn && inText && <button className="btn sm ghost" onClick={() => copy(inText, t("in_text"))}>{t("copy_in_text")}</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </li>
  );
}

export default function History() {
  const { t } = useI18n();
  const { toast } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("citations").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) toast(error.message, "err"); else setRows(data as Row[]);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  // Gom theo đề tài (abstract): ưu tiên đề tài đã lưu, nếu không thì theo mã băm abstract. Trong mỗi đề tài, gom theo nguồn.
  const topics = useMemo<Topic[]>(() => {
    const needle = q.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => !needle || (r.reference + r.quote + r.abstract_title + (r.source.title ?? "")).toLowerCase().includes(needle));
    const byTopic = new Map<string, Row[]>();
    for (const r of list) {
      const k = r.project_id || r.abstract_hash || "none";
      byTopic.set(k, [...(byTopic.get(k) ?? []), r]);
    }
    return [...byTopic.entries()].map(([key, rs]) => {
      const bySrc = new Map<string, Row[]>();
      for (const r of rs) {
        const sk = `${(r.source.title || r.reference).toLowerCase()}|${r.source.year ?? ""}`;
        bySrc.set(sk, [...(bySrc.get(sk) ?? []), r]);
      }
      const sources: SourceGroup[] = [...bySrc.entries()].map(([sk, srs]) => {
        const quotes = srs.filter((r) => r.quote);
        const scores = srs.map((r) => r.score).filter((x): x is number => x != null);
        return {
          key: sk, meta: srs[0].source, rows: srs, quotes, score: scores.length ? Math.max(...scores) : null,
          best: quotes.length ? Math.min(...quotes.map((r) => PRIO[r.priority] ?? 3)) : 4, last: Math.max(...srs.map((r) => +new Date(r.created_at))),
        };
      }).sort((a, b) => a.best - b.best || (b.score ?? -1) - (a.score ?? -1) || b.last - a.last);
      return { key, title: rs.find((r) => r.abstract_title)?.abstract_title || "", sources, last: Math.max(...rs.map((r) => +new Date(r.created_at))) };
    }).sort((a, b) => b.last - a.last);
  }, [rows, q]);

  const del = async (ids: string[]) => {
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("citations").delete().in("id", ids);
    if (error) toast(error.message, "err"); else setRows((r) => (r ?? []).filter((x) => !ids.includes(x.id)));
  };
  const exportAll = () => {
    const txt = [...new Set((rows ?? []).map((r) => r.reference))].join("\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
    a.download = `citations-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };
  const multi = topics.length > 1;

  return (
    <div className="page">
      <div className="between"><h2 className="serif">{t("hist_title")}</h2>{(rows?.length ?? 0) > 0 && <button className="btn sm" onClick={exportAll}>{t("export")}</button>}</div>
      <p className="muted">{t("hist_note")} {multi ? t("hist_by_topic") : t("hist_by_priority")}</p>
      <input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
      {rows === null ? <div className="card">…</div> : topics.length === 0 ? <div className="card muted">{t("hist_empty")}</div> : (
        <div className="topics">
          {topics.map((tp) => {
            const scores = tp.sources.map((s) => s.score).filter((x): x is number => x != null);
            const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
            return (
              <section key={tp.key} className="topic">
                {multi && (
                  <header className="topic-head">
                    <span className="panel-ico"><Icon name="book" size={18} /></span>
                    <div><h3 className="serif">{tp.title || t("hist_ungrouped")}</h3>
                      <p className="muted small">{t("hist_topic_meta", { n: tp.sources.length })}{avg != null ? ` · ${t("hist_avg_fit", { n: avg })}` : ""}</p></div>
                  </header>
                )}
                <ul className="hist">{tp.sources.map((g) => <Source key={g.key} g={g} onDelete={del} />)}</ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
