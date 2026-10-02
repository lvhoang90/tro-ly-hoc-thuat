import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { copyRich } from "../lib/clipboard.ts";
import { STYLES } from "../../shared/citation.ts";

interface Row { id: string; created_at: string; style: string; cite_lang: string; reference: string; in_text: string; quote: string; page: string; priority: string; project: string; source: { title?: string; year?: string } }

export default function History() {
  const { t } = useI18n();
  const { toast } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [style, setStyle] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("citations").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) toast(error.message, "err"); else setRows(data as Row[]);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (rows ?? []).filter((r) =>
    (!style || r.style === style) && (!q || (r.reference + r.quote + r.project + (r.source.title ?? "")).toLowerCase().includes(q.toLowerCase()))), [rows, q, style]);

  const copy = async (s: string, label: string) => { toast((await copyRich(s)) ? t("copied", { what: label }) : t("copy_fail"), "ok"); };
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
      <div className="between"><h2>{t("hist_title")}</h2>{shown.length > 0 && <button className="btn sm" onClick={exportAll}>{t("export")}</button>}</div>
      <p className="muted">{t("hist_note")}</p>
      <div className="row wrap">
        <input className="grow" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="">{t("all_styles")}</option>{STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      {rows === null ? <div className="card">…</div> : shown.length === 0 ? <div className="card muted">{t("hist_empty")}</div> : (
        <ul className="hist">
          {shown.map((r) => (
            <li key={r.id} className="card">
              <div className="between"><span className="muted small">{new Date(r.created_at).toLocaleString()} · <b>{STYLES.find((s) => s.id === r.style)?.label ?? r.style}</b>{r.project ? ` · ${r.project}` : ""}</span>
                <button className="icon-btn" aria-label={t("delete")} onClick={() => del(r.id)}>🗑</button></div>
              {r.quote && <blockquote>“{r.quote}”{r.page && <small className="muted"> ({t("page")} {r.page})</small>}</blockquote>}
              <pre className="cite-out">{r.reference}</pre>
              <div className="row wrap">
                <button className="btn sm" onClick={() => copy(r.reference, t("reference"))}>{t("copy")} {t("reference").toLowerCase()}</button>
                {r.in_text && <button className="btn sm" onClick={() => copy(r.in_text, t("in_text"))}>{r.in_text}</button>}
                {r.quote && r.in_text && <button className="btn sm" onClick={() => copy(`“${r.quote}” ${r.in_text}`, t("quote"))}>{t("copy_quote")}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
