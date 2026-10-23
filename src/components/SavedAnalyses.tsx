import { useEffect, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { clearCloud, delCloud, getCloud, listCloud } from "../lib/results-store.ts";
import { filterRows, SORT_MODES, sortRows, type ResultMeta, type SortMode } from "../../shared/review/saved.ts";
import { isSavedAnalysis, analysisFileName, type SavedAnalysis } from "../../shared/results/analysis.ts";
import { PASS_SCORE } from "../../shared/types.ts";
import ResultView from "./ResultView.tsx";
import CloudToggle from "./CloudToggle.tsx";
import { Icon } from "./Icon.tsx";

const save = (blob: Blob, name: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

/** Các lượt phân tích đã lưu trên tài khoản: xem lại, tải báo cáo Word (từng bản hoặc gói .zip), xóa. Không có tệp gốc. */
export default function SavedAnalyses() {
  const { t, lang } = useI18n();
  const { toast } = useApp();
  const [rows, setRows] = useState<ResultMeta[] | null | undefined>(undefined); // undefined: đang tải; null: không tải được
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("new");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<{ id: string; data: SavedAnalysis } | null>(null);

  useEffect(() => { let live = true; void listCloud("analysis").then((l) => { if (live) setRows(l); }); return () => { live = false; }; }, []);

  const fetchOne = async (id: string): Promise<SavedAnalysis | null> => {
    const d = await getCloud<SavedAnalysis>("analysis", id);
    if (!isSavedAnalysis(d)) { toast(t("cloud_fetch_fail"), "err"); return null; }
    return d;
  };
  const view = async (id: string) => { setBusy(true); const d = await fetchOne(id); setBusy(false); if (d) setOpen({ id, data: d }); };
  const word = async (list: SavedAnalysis[]) => {
    if (!list.length) return;
    setBusy(true);
    try {
      const m = await import("../lib/analysis-docx.ts");
      if (list.length === 1) save(await m.buildAnalysisDocx(list[0], lang), analysisFileName(list[0], lang));
      else save(await m.buildAnalysisZip(list, lang), lang === "en" ? "Analyses.zip" : "Cac-bao-cao-phan-tich.zip");
    } catch (e) { console.error(e); toast(t("rv_export_fail"), "err"); } finally { setBusy(false); }
  };
  const wordIds = async (ids: string[]) => {
    setBusy(true); const list: SavedAnalysis[] = [];
    for (const id of ids) { const d = await fetchOne(id); if (d) list.push(d); }
    setBusy(false); await word(list);
  };
  const remove = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    if (await delCloud("analysis", id)) { setRows((r) => (r ? r.filter((x) => x.id !== id) : r)); setSel((s) => s.filter((x) => x !== id)); if (open?.id === id) setOpen(null); }
    else toast(t("cloud_fetch_fail"), "err");
  };
  const clear = async () => {
    if (!confirm(t("sa_clear_confirm"))) return;
    if (await clearCloud("analysis")) { setRows([]); setSel([]); setOpen(null); toast(t("rv_cleared")); } else toast(t("cloud_fetch_fail"), "err");
  };

  if (open) {
    const d = open.data;
    return (
      <div className="stack gap">
        <div className="between toolbar">
          <button className="btn sm" onClick={() => setOpen(null)}><Icon name="left" size={15} /> {t("back")}</button>
          <span className="row wrap">
            <button className="btn sm primary" disabled={busy} onClick={() => void word([d])}>{busy ? "…" : t("sa_word")}</button>
            <button className="btn sm" onClick={() => void remove(open.id)}>{t("delete")}</button>
          </span>
        </div>
        <p className="muted small">{t("sa_analysed_on", { d: new Date(d.at).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB") })}{d.project ? ` · ${d.project}` : ""} · {d.fileName}</p>
        <ResultView res={d.res} fileName={d.fileName} sel={new Set()} toggle={() => {}} readOnly />
      </div>
    );
  }

  const list = rows ?? [];
  const shown = sortRows(filterRows(list, q), sort);
  return (
    <div className="stack gap">
      <CloudToggle />
      <p className="muted small">{t("sa_note")}</p>
      {rows === undefined && <div className="card">…</div>}
      {rows === null && <div className="card err box" role="alert">{t("sa_load_fail")}</div>}
      {rows && rows.length === 0 && <div className="card"><p className="muted">{t("sa_empty")}</p></div>}
      {rows && rows.length > 0 && (
        <div className="card stack rv-savedbox">
          <div className="between"><h4>{t("sa_title")} <span className="muted small">{t("rv_saved_count", { a: shown.length, b: list.length })}</span></h4>
            <span className="row wrap">
              {sel.length > 0
                ? <button className="btn sm primary" disabled={busy} onClick={() => void wordIds(sel)}>{busy ? "…" : t("rv_zip_selected", { n: sel.length })}</button>
                : list.length > 1 && <button className="btn sm" disabled={busy} onClick={() => void wordIds(shown.map((x) => x.id))}>{busy ? "…" : t("rv_zip")}</button>}
              <button className="btn sm" onClick={() => void clear()}>{t("rv_clear")}</button></span></div>
          {list.length > 3 && (
            <div className="rv-savedtools">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("rv_search")} aria-label={t("rv_search")} />
              <label className="small">{t("rv_sort")} <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>{SORT_MODES.map((m) => <option key={m} value={m}>{t(`rv_sort_${m}` as "rv_sort_new")}</option>)}</select></label>
              <button className="btn sm ghost" onClick={() => setSel(sel.length === shown.length ? [] : shown.map((x) => x.id))}>{sel.length === shown.length && shown.length > 0 ? t("rv_select_none") : t("rv_select_all")}</button>
            </div>
          )}
          {shown.length === 0 && <p className="muted small">{t("rv_none_found")}</p>}
          <ul className="rv-saved">{shown.map((x) => (
            <li key={x.id} className={sel.includes(x.id) ? "on" : ""}>
              <input type="checkbox" checked={sel.includes(x.id)} onChange={() => setSel((c) => (c.includes(x.id) ? c.filter((i) => i !== x.id) : [...c, x.id]))} aria-label={`${t("rv_select_one")}: ${x.name}`} />
              <button className="btn sm rv-savedname" onClick={() => void view(x.id)} title={x.name}>{x.name}</button>
              <span className="muted small">{new Date(x.at).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB")} · {x.score != null ? `${x.score}/100` : "—"} · {x.score != null && x.score >= PASS_SCORE ? t("pass") : t("fail")}</span>
              <span className="row wrap rv-savedact">
                <button className="btn sm" disabled={busy} onClick={() => void view(x.id)}>{t("sa_view")}</button>
                <button className="btn sm" disabled={busy} onClick={() => void wordIds([x.id])}>{t("sa_word")}</button>
                <button className="btn sm ghost" aria-label={t("delete")} onClick={() => void remove(x.id)}>×</button></span>
            </li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}
