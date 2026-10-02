import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { copyRich } from "../lib/clipboard.ts";
import { STYLES, formatCitation, toHtml, toPlain, type StyleId } from "../../shared/citation.ts";
import type { Lang, SourceMeta } from "../../shared/types.ts";
import { FlagToggle } from "../components/Chrome.tsx";
import { Icon } from "../components/Icon.tsx";

interface Row { id: string; created_at: string; style: string; cite_lang: string; reference: string; in_text: string; quote: string; page: string; priority: string; project: string; source: Partial<SourceMeta> }

const hasMeta = (s: Partial<SourceMeta>): s is SourceMeta => !!s && !!s.title && Array.isArray(s.authors);

/** Một mục lịch sử: đổi kiểu trích dẫn hoặc ngôn ngữ ngay trên mục (định dạng lại từ siêu dữ liệu đã lưu). */
function Entry({ r, onDelete }: { r: Row; onDelete: () => void }) {
  const { t } = useI18n();
  const { toast } = useApp();
  const builtin = STYLES.some((s) => s.id === r.style);
  const [style, setStyle] = useState<string>(builtin ? r.style : "");
  const [lang, setLang] = useState<Lang>(r.cite_lang === "vi" ? "vi" : "en");
  const can = hasMeta(r.source);

  const out = useMemo(() => {
    if (!can || !style) return { reference: r.reference, inText: r.in_text, changed: false };
    const c = formatCitation(r.source as SourceMeta, { style: style as StyleId, lang, page: r.page || undefined });
    return { reference: toPlain(c.reference), inText: toPlain(c.inText), changed: true, html: toHtml(c.reference) };
  }, [can, style, lang, r]);

  const copy = async (plain: string, what: string, html?: string) => { toast((await copyRich(plain, html)) ? t("copied", { what }) : t("copy_fail"), "ok"); };
  const noIn = style === "bibtex" || style === "ris";

  return (
    <li className="card entry">
      <div className="between">
        <span className="muted small">{new Date(r.created_at).toLocaleString()}{r.project ? ` · ${r.project}` : ""}</span>
        <button className="icon-btn" aria-label={t("delete")} title={t("delete")} onClick={onDelete}><Icon name="trash" size={16} /></button>
      </div>
      {r.quote && <blockquote>“{r.quote}”{r.page && <small className="muted"> ({t("page")} {r.page})</small>}</blockquote>}

      <div className="entry-controls">
        <label className="inline small">{t("cite_style")}
          <select value={style} onChange={(e) => setStyle(e.target.value)} disabled={!can}>
            {!builtin && <option value="">{r.style.startsWith("csl:") ? `CSL · ${r.style.slice(4)}` : r.style}</option>}
            {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <FlagToggle value={lang} onChange={setLang} label={t("cite_lang")} />
      </div>
      {!can && <p className="muted small">{t("hist_no_meta")}</p>}

      {out.changed && "html" in out && out.html ? <pre className="cite-out" dangerouslySetInnerHTML={{ __html: out.html }} /> : <pre className="cite-out">{out.reference}</pre>}
      <div className="row wrap">
        <button className="btn sm primary" onClick={() => copy(out.reference, t("reference"), "html" in out ? out.html : undefined)}><Icon name="copy" size={14} /> {t("copy")}</button>
        {!noIn && out.inText && <button className="btn sm" onClick={() => copy(out.inText, t("in_text"))}>{out.inText}</button>}
        {!noIn && r.quote && out.inText && <button className="btn sm" onClick={() => copy(`“${r.quote}” ${out.inText}`, t("quote"))}>{t("copy_quote")}</button>}
      </div>
    </li>
  );
}

export default function History() {
  const { t } = useI18n();
  const { toast } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("citations").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) toast(error.message, "err"); else setRows(data as Row[]);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (rows ?? []).filter((r) => !q || (r.reference + r.quote + r.project + (r.source.title ?? "")).toLowerCase().includes(q.toLowerCase())), [rows, q]);

  const del = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("citations").delete().eq("id", id);
    if (error) toast(error.message, "err"); else setRows((r) => (r ?? []).filter((x) => x.id !== id));
  };
  const exportAll = () => {
    const txt = [...new Set(shown.map((r) => r.reference))].join("\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
    a.download = `citations-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="page">
      <div className="between"><h2 className="serif">{t("hist_title")}</h2>{shown.length > 0 && <button className="btn sm" onClick={exportAll}>{t("export")}</button>}</div>
      <p className="muted">{t("hist_note")}</p>
      <input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
      {rows === null ? <div className="card">…</div> : shown.length === 0 ? <div className="card muted">{t("hist_empty")}</div> : (
        <ul className="hist">{shown.map((r) => <Entry key={r.id} r={r} onDelete={() => del(r.id)} />)}</ul>
      )}
    </div>
  );
}
