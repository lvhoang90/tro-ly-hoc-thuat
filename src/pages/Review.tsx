import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { ApiFailure } from "../lib/api.ts";
import { ExtractFailure } from "../lib/extract.ts";
import { readReviewDoc, type ReadDoc } from "../lib/review-read.ts";
import { analyzeTemplate, clearReviews, loadSaved, persistSaved, removeReview, replaceReview, runReview, type ReviewQuota, type SavedReview, type Stage } from "../lib/review.ts";
import { runBatch, type ItemStatus, type WorkItem } from "../lib/review-batch.ts";
import { blockLine, numberBlocks } from "../../shared/review/corpus.ts";
import { MAX_BATCH_WORKS, MAX_REVIEW_CHARS, MAX_SAVED_REVIEWS } from "../../shared/review/limits.ts";
import { linesToList, listToLines, setRowPoints } from "../../shared/review/edit.ts";
import { DOC_TYPES, ROLES, labelsFor } from "../../shared/review/rubric.ts";
import { builtinTemplate, usesDefaultRubric, type Template } from "../../shared/review/template.ts";
import type { ReviewResult } from "../../shared/review/assemble.ts";
import { VerifyCard, fmtDay } from "../components/Tier.tsx";
import ReviewRequest from "../components/ReviewRequest.tsx";
import { Icon } from "../components/Icon.tsx";
import { track } from "../lib/isa.ts";
import type { Key } from "../dict.ts";

const stageText = (s: Stage | null, t: (k: Key, p?: Record<string, string | number>) => string) =>
  !s ? "" : s.phase === "start" ? t("rv_ph_start") : s.phase === "sections" ? t("rv_ph_sections", { a: Math.min(s.done + 1, s.total), b: s.total }) : s.phase === "overall" ? t("rv_ph_overall") : t("rv_ph_finish");
const stagePct = (s: Stage | null) => (!s ? 0 : s.phase === "start" ? 4 : s.phase === "sections" ? 8 + (s.done / Math.max(s.total, 1)) * 70 : s.phase === "overall" ? 85 : 96);

const plainTemplateText = (doc: ReadDoc) => numberBlocks(doc.blocks).map((b) => blockLine(b).replace(/^\[¶\d+\] /, "")).join("\n");

const rowsFor = (text: string) => Math.min(14, Math.max(3, text.split("\n").length + Math.ceil(text.length / 110)));
function Area({ value, onChange, label, min }: { value: string; onChange: (v: string) => void; label: string; min?: number }) {
  return <textarea className="rv-edit" rows={Math.max(min ?? 3, rowsFor(value))} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />;
}

function Result({ r, onClose, onChange }: { r: ReviewResult; onClose?: () => void; onChange?: (r: ReviewResult) => void }) {
  const { t, lang } = useI18n();
  const L = labelsFor(lang);
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const edit = !!onChange;
  const set = (fn: (x: ReviewResult) => ReviewResult) => onChange?.(fn(r));
  const dt = L.decision(r.decision.key);
  const d = { ...r.decision, ...dt };
  const sev = d.severity === "ok" ? "ok" : d.severity === "danger" ? "err" : "warn";
  const ev = (list: { quote: string; paragraph?: number; page?: number }[]) => list.length > 0 && (
    <ul className="rv-ev">{list.map((e, i) => <li key={i}>“{e.quote}” <small className="muted">(¶{e.paragraph}{e.page ? `, ${t("rv_page")} ${e.page}` : ""})</small></li>)}</ul>
  );
  const download = async () => {
    setBusy(true);
    try {
      const { buildDocx, exportFileName } = await import("../lib/review-docx.ts");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await buildDocx(r, lang)); a.download = exportFileName(r, lang);
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { console.error(e); toast(t("rv_export_fail"), "err"); } finally { setBusy(false); }
  };
  const paras = (text: string) => text.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>);
  return (
    <div className="stack rv-result">
      <div className="card stack">
        <div className="between">
          <div><h3>{r.profile.title && r.profile.title !== "Không xác định" && r.profile.title !== "Unknown" ? r.profile.title : r.file.name}</h3>
            <p className="muted small">{L.docType(r.meta.docType)} · {r.file.name} · {t("rv_words", { n: r.file.words.toLocaleString() })}{r.file.pages ? ` · ${t("rv_pages", { n: r.file.pages })}` : ""}</p></div>
          {onClose && <button className="btn sm" onClick={onClose}>{t("rv_close")}</button>}
        </div>
        <div className="rv-score">
          <div className={`rv-num ${sev}`}><b>{r.score.sumMax ? r.score.score100 : "—"}</b><small>/100</small></div>
          <div className="stack">
            <b className={sev}>{d.label}</b>
            <span className="muted">{d.advice}</span>
            {d.belowPass && r.score.sumMax > 0 && <span className="warn small"><Icon name="info" size={14} /> {t("rv_below_pass")}</span>}
            {d.floorApplied && <span className="muted small">{t("rv_floor")}</span>}
            {d.mismatch && <span className="muted small">{t("rv_mismatch", { m: L.decision(d.mismatch.model).short })}</span>}
          </div>
        </div>
        <div className="row wrap">
          <button className="btn primary" onClick={download} disabled={busy}><Icon name="file" size={16} /> {busy ? "…" : t("rv_download")}</button>
        </div>
        <p className="muted small">{t("rv_draft_note")}</p>
        {edit && <p className="muted small">{t("rv_edit_hint")}</p>}
        {r.warnings.length > 0 && <div className="box warnbox"><b>{t("rv_warnings")}</b><ul>{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
      </div>

      {edit && r.info.length > 0 && (
        <div className="card stack">
          <h4>{t("rv_info")}</h4>
          {r.info.map((x, i) => (
            <label key={i}>{x.label}<input value={x.value} onChange={(e) => set((q) => ({ ...q, info: q.info.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)) }))} /></label>
          ))}
        </div>
      )}

      {r.score.rows.length > 0 && (
        <div className="card stack">
          <h4>{t("rv_table")}</h4>
          <table className="tbl rv-tbl"><thead><tr><th>{t("rv_criterion")}</th><th>{t("rv_max")}</th><th>{t("rv_points")}</th></tr></thead>
            <tbody>{r.score.rows.map((x, i) => (
              <tr key={i}><td>{x.label}{x.rationale && <small className="muted"><br />{x.rationale}</small>}</td><td>{x.max}</td>
                <td>{edit
                  ? <input className="rv-pts" type="number" min={0} max={x.max} step={0.5} value={x.points} aria-label={`${t("rv_points")}: ${x.label ?? ""}`} onChange={(e) => set((q) => setRowPoints(q, i, Number(e.target.value)))} />
                  : <b>{x.points}</b>}</td></tr>
            ))}
              <tr><td><b>{t("rv_total")}</b></td><td><b>{r.score.sumMax}</b></td><td><b>{r.score.sum}</b></td></tr></tbody></table>
        </div>
      )}

      {(edit || r.overall.summary || r.overall.conclusion) && (
        <div className="card stack">
          <h4>{t("rv_overall")}</h4>
          {edit ? (
            <>
              <Area label={t("rv_overall")} value={r.overall.summary} onChange={(v) => set((q) => ({ ...q, overall: { ...q.overall, summary: v } }))} min={4} />
              <h5>{t("rv_conclusion")}</h5>
              <Area label={t("rv_conclusion")} value={r.overall.conclusion} onChange={(v) => set((q) => ({ ...q, overall: { ...q.overall, conclusion: v } }))} min={3} />
            </>
          ) : <>{paras(r.overall.summary)}{paras(r.overall.conclusion)}</>}
        </div>
      )}

      <div className="card stack">
        <h4>{t("rv_sections")}</h4>
        {r.sections.map((s, si) => {
          const upd = (patch: Partial<typeof s>) => set((q) => ({ ...q, sections: q.sections.map((x, j) => (j === si ? { ...x, ...patch } : x)) }));
          return (
            <details key={s.id} className="rv-sec" open={s.level === 1 && r.sections.length <= 8}>
              <summary><b>{s.number} {s.title}</b>{s.max_points > 0 && <span className="badge">{s.points}/{s.max_points}</span>}{s.missing && <span className="badge warn">{t("rv_missing")}</span>}{s.insufficient_basis && !s.missing && <span className="badge">{t("rv_insufficient")}</span>}</summary>
              {edit ? <Area label={`${s.title}`} value={s.content} onChange={(v) => upd({ content: v })} min={4} /> : paras(s.content)}
              {(edit || s.strengths.length > 0) && <><h5>{t("rv_strengths")}</h5>{edit ? <Area label={t("rv_strengths")} value={listToLines(s.strengths)} onChange={(v) => upd({ strengths: linesToList(v) })} /> : <ul>{s.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>}</>}
              {(edit || s.weaknesses.length > 0) && <><h5>{t("rv_weaknesses")}</h5>{edit ? <Area label={t("rv_weaknesses")} value={listToLines(s.weaknesses)} onChange={(v) => upd({ weaknesses: linesToList(v) })} /> : <ul>{s.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul>}</>}
              {s.revisions.length > 0 && <><h5>{t("rv_revisions")}</h5><ul className={edit ? "rv-revs" : ""}>{s.revisions.map((x, i) => (
                <li key={i}><span className={`badge ${x.priority === "bat_buoc" ? "warn" : ""}`}>{t(`rv_pr_${x.priority}` as Key)}</span>{" "}
                  {edit ? <input className="rv-edit" value={x.action} aria-label={t("rv_revisions")} onChange={(e) => upd({ revisions: s.revisions.map((y, j) => (j === i ? { ...y, action: e.target.value } : y)) })} /> : x.action}</li>
              ))}</ul></>}
              {s.evidence.length > 0 && <><h5>{t("rv_evidence")}</h5>{ev(s.evidence)}</>}
            </details>
          );
        })}
      </div>

      {r.fatalDefects.length > 0 && (
        <div className="card stack"><h4>{t("rv_fatal")}</h4>
          <ul>{r.fatalDefects.map((f, i) => <li key={i}><span className={`badge ${f.severity === "fatal" ? "warn" : ""}`}>{f.severity === "fatal" ? t("rv_fatal_l") : t("rv_serious_l")}</span> {f.description}{ev(f.evidence)}</li>)}</ul></div>
      )}
      {r.integrityNotes.length > 0 && (
        <div className="card stack"><h4>{t("rv_integrity")}</h4><p className="muted small">{t("rv_integrity_note")}</p>
          <ul>{r.integrityNotes.map((n, i) => <li key={i}>{n.concern}{n.suggested_check && <div className="muted small">{t("rv_check")}: {n.suggested_check}</div>}{ev(n.evidence)}</li>)}</ul></div>
      )}
      {r.questions.length > 0 && <div className="card stack"><h4>{t("rv_questions")}</h4><ol>{r.questions.map((q, i) => <li key={i}>{q}</li>)}</ol></div>}
      <div className="card stack">
        <h4>{t("rv_limits")}</h4>
        <ul>{r.limitations.map((x, i) => <li key={i}>{x}</li>)}<li>{t("rv_limit_fixed")}</li></ul>
        <p className="muted small">{t("rv_verified", { a: r.verification.kept, b: r.verification.dropped })}</p>
      </div>
    </div>
  );
}

const saveBlobAs = (blob: Blob, name: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
const STATUS_KEY: Record<ItemStatus, Key> = { reading: "rv_st_reading", ready: "rv_st_ready", read_error: "rv_st_read_error", queued: "rv_st_queued", running: "rv_st_running", done: "rv_st_done", failed: "rv_st_failed", skipped: "rv_st_skipped", stopped: "rv_st_stopped" };
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function Review() {
  const { t, lang } = useI18n();
  const { quota, toast } = useApp();
  const eligible = !!quota?.approved;
  const [rq, setRq] = useState<ReviewQuota | null>(null);
  const [rqLoaded, setRqLoaded] = useState(false);
  const [docType, setDocType] = useState<keyof typeof DOC_TYPES>("thesis");
  const [role, setRole] = useState<keyof typeof ROLES>("reviewer");
  const [field, setField] = useState("");
  const [notes, setNotes] = useState("");
  const [custom, setCustom] = useState<{ name: string; tpl: Template } | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [reading, setReading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runIds, setRunIds] = useState<string[]>([]);
  const [stopping, setStopping] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<SavedReview[]>(loadSaved);
  const [open, setOpen] = useState<string>("");
  const [drag, setDrag] = useState(false);
  const workInput = useRef<HTMLInputElement>(null);
  const tplInput = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  const savedRef = useRef<SavedReview[]>(saved);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  savedRef.current = saved;

  const refreshQuota = () => { void supabase.rpc("my_review_quota").then(({ data }) => { setRq((data as ReviewQuota | null) ?? null); setRqLoaded(true); }); };
  useEffect(() => { if (eligible) refreshQuota(); }, [eligible]);
  useEffect(() => { if (running) { const f = (e: BeforeUnloadEvent) => { e.preventDefault(); }; addEventListener("beforeunload", f); return () => removeEventListener("beforeunload", f); } }, [running]);
  // Sửa trên màn hình: ghi xuống trình duyệt sau khi ngừng gõ, và ghi nốt khi rời trang.
  useEffect(() => () => { if (persistTimer.current) { clearTimeout(persistTimer.current); persistSaved(savedRef.current); } }, []);

  const access = eligible && rqLoaded && (!!rq?.has_access || !!rq?.unlimited);
  const tpl: Template = useCustom && custom ? custom.tpl : builtinTemplate(docType, lang);
  const readErrText = (e: unknown) => {
    const code = e instanceof ExtractFailure ? e.code : "corrupt";
    return code === "size" ? t("err_file_size", { mb: 15 }) : code === "type" ? t("rv_err_type") : t(`err_file_${code}` as Key, { mb: 15, n: 0 });
  };
  const failText = (e: unknown): { code: string; message: string } => {
    if (e instanceof ApiFailure) {
      const k = e.info.error;
      const message = k === "quota_exhausted" ? t("rv_quota_out", { date: fmtDay(rq?.next_reset ?? "") })
        : k === "ai_failed" && e.info.message ? `${e.info.message} ${t("rv_refunded")}`
        : t(`err_${k}` as Key) + (k === "ai_failed" || k === "truncated" ? ` ${t("rv_refunded")}` : "");
      return { code: k, message };
    }
    return { code: "network", message: t("err_network") };
  };
  const patchItem = (id: string, patch: Partial<WorkItem>) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const addFiles = async (files: File[]) => {
    if (!files.length || running) return;
    setErr("");
    const fresh = files.filter((f) => !items.some((x) => x.name === f.name && x.size === f.size));
    const room = Math.max(0, MAX_BATCH_WORKS - items.length);
    if (fresh.length > room) setErr(t("rv_batch_max", { n: MAX_BATCH_WORKS }));
    const take = fresh.slice(0, room);
    const added: WorkItem[] = take.map((f) => ({ id: newId(), name: f.name, size: f.size, status: "reading" as const }));
    if (!added.length) return;
    setItems((prev) => [...prev, ...added]);
    setReading(true);
    // Đọc tuần tự từng tệp ngay trên máy; tệp lỗi chỉ báo ở dòng của nó.
    for (let i = 0; i < take.length; i++) {
      try {
        const doc = await readReviewDoc(take[i]);
        if (doc.chars > MAX_REVIEW_CHARS) patchItem(added[i].id, { status: "read_error", error: t("rv_too_long", { n: Math.round(MAX_REVIEW_CHARS / 1000).toLocaleString() }) });
        else patchItem(added[i].id, { status: "ready", blocks: doc.blocks, words: doc.words, pages: doc.pages });
      } catch (e) { patchItem(added[i].id, { status: "read_error", error: readErrText(e) }); }
    }
    setReading(false);
  };
  const pickTemplate = async (f?: File) => {
    if (!f) return;
    setErr(""); setTplBusy(true);
    try {
      const doc = await readReviewDoc(f, () => {}, 80);
      const text = plainTemplateText(doc);
      setCustom({ name: f.name, tpl: await analyzeTemplate(text) }); setUseCustom(true);
    } catch (e) {
      if (e instanceof ApiFailure) setErr(e.info.message || t(`err_${e.info.error}` as Key)); else setErr(readErrText(e));
    } finally { setTplBusy(false); }
  };

  const addSaved = (result: ReviewResult) => {
    const item: SavedReview = { id: newId(), at: new Date().toISOString(), result };
    const next = persistSaved([item, ...savedRef.current]);
    savedRef.current = next; setSaved(next);
    return item.id;
  };
  const onEdit = (id: string, r: ReviewResult) => {
    const next = replaceReview(savedRef.current, id, r);
    savedRef.current = next; setSaved(next);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => { persistSaved(savedRef.current); persistTimer.current = null; }, 700);
  };

  /** Chạy tuần tự các công trình: mỗi công trình một lượt phản biện và một bản nhận xét riêng. */
  const runItems = async (list: WorkItem[]) => {
    if (!list.length || running) return;
    setErr(""); setRunning(true); setStopping(false); stopRef.current = false; setOpen(""); setRunIds(list.map((x) => x.id));
    const meta = { docType, role, field: field.trim(), notes: notes.trim(), lang };
    const tplNow = tpl;
    const sum = await runBatch(list.map((x) => ({ ...x })), {
      run: async (it, onStage) => {
        track("ami_phan_bien", docType);
        const { result, quota: q } = await runReview({ blocks: it.blocks ?? [], fileName: it.name, meta, template: tplNow, onStage: onStage as (s: Stage) => void });
        const savedId = addSaved(result);
        if (q) setRq((prev) => ({ ...(prev as ReviewQuota), ...q })); else refreshQuota();
        return { savedId };
      },
      onChange: (it) => patchItem(it.id, it),
      shouldStop: () => stopRef.current,
      classify: failText,
    });
    refreshQuota();
    setRunning(false); setStopping(false);
    if (sum.stoppedBecause) setErr(items.find((x) => x.status === "skipped")?.error ?? "");
    if (sum.done + sum.failed > 1) toast(t("rv_batch_done", { a: sum.done, b: sum.done + sum.failed }));
  };

  const downloadOne = async (r: ReviewResult) => {
    try { const { buildDocx, exportFileName } = await import("../lib/review-docx.ts"); saveBlobAs(await buildDocx(r, lang), exportFileName(r, lang)); }
    catch (e) { console.error(e); toast(t("rv_export_fail"), "err"); }
  };
  const downloadZip = async (list: SavedReview[]) => {
    if (!list.length) return;
    setZipBusy(true);
    try { const { buildZip } = await import("../lib/review-docx.ts"); saveBlobAs(await buildZip(list.map((x) => x.result), lang), lang === "en" ? "Reviews.zip" : "Cac-ban-nhan-xet.zip"); }
    catch (e) { console.error(e); toast(t("rv_export_fail"), "err"); } finally { setZipBusy(false); }
  };

  if (!quota) return <div className="center"><div className="spinner" /></div>;
  const left = rq ? (rq.unlimited ? Infinity : rq.left) : 1;
  const shown = saved.find((x) => x.id === open);
  const ready = items.filter((x) => x.status === "ready");
  const over = Number.isFinite(left) && ready.length > left;
  const doneItems = items.filter((x) => x.status === "done" && saved.some((s) => s.id === x.savedId));
  const finished = items.filter((x) => x.status === "done" || x.status === "failed" || x.status === "skipped" || x.status === "stopped");
  const inRun = items.filter((x) => runIds.includes(x.id));
  const doneCount = inRun.filter((x) => ["done", "failed", "skipped", "stopped"].includes(x.status)).length;
  const runningItem = items.find((x) => x.status === "running");
  const batchZip = doneItems.map((x) => saved.find((s) => s.id === x.savedId)).filter((x): x is SavedReview => !!x);

  return (
    <div className="page rv-page">
      <div className="between"><h2>{t("rv_title")} <span className="badge premium">{t("rv_premium")}</span></h2>
        {access && rq && <span className="badge">{rq.unlimited ? t("rv_unlimited") : t("rv_left", { a: rq.left, b: rq.limit })}</span>}</div>
      <p className="muted">{t("rv_intro")}</p>

      {!eligible && (
        <>
          <VerifyCard title={t("rv_locked_title")} body={t("rv_locked_body")} benefits />
          <div className="card stack"><h4>{t("rv_what_h")}</h4>
            <ul>{(["rv_what_1", "rv_what_2", "rv_what_3", "rv_what_4"] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul></div>
        </>
      )}

      {eligible && !rqLoaded && <div className="center"><div className="spinner" /></div>}
      {eligible && rqLoaded && !access && <ReviewRequest />}

      {access && shown && <Result key={shown.id} r={shown.result} onClose={() => setOpen("")} onChange={(r) => onEdit(shown.id, r)} />}

      {access && !shown && (
        <>
          <div className="card stack">
            <h3>1. {t("rv_s1")}</h3>
            <div className="grid2">
              <label>{t("rv_doctype")}<select value={docType} onChange={(e) => setDocType(e.target.value as keyof typeof DOC_TYPES)} disabled={running}>{Object.keys(DOC_TYPES).map((k) => <option key={k} value={k}>{labelsFor(lang).docType(k)}</option>)}</select></label>
              <label>{t("rv_role")}<select value={role} onChange={(e) => setRole(e.target.value as keyof typeof ROLES)} disabled={running}>{Object.keys(ROLES).map((k) => <option key={k} value={k}>{labelsFor(lang).role(k)}</option>)}</select></label>
            </div>
            <label>{t("rv_field")}<input value={field} onChange={(e) => setField(e.target.value)} maxLength={200} placeholder={t("rv_field_ph")} disabled={running} /></label>
            <label>{t("rv_notes")}<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1500} placeholder={t("rv_notes_ph")} disabled={running} /></label>
          </div>

          <div className="card stack">
            <h3>2. {t("rv_s2")}</h3>
            <div className="chips" role="radiogroup">
              <button role="radio" aria-checked={!useCustom} className={!useCustom ? "on" : ""} onClick={() => setUseCustom(false)} disabled={running}>{t("rv_tpl_builtin")}</button>
              <button role="radio" aria-checked={useCustom} className={useCustom ? "on" : ""} onClick={() => (custom ? setUseCustom(true) : tplInput.current?.click())} disabled={running || tplBusy}>{tplBusy ? t("rv_tpl_reading") : custom ? `${t("rv_tpl_custom")}: ${custom.name}` : t("rv_tpl_upload")}</button>
              {custom && <button onClick={() => tplInput.current?.click()} disabled={running || tplBusy}>{t("rv_tpl_change")}</button>}
            </div>
            <input ref={tplInput} type="file" hidden accept=".pdf,.docx" onChange={(e) => { void pickTemplate(e.target.files?.[0]); e.target.value = ""; }} />
            <p className="muted small">{useCustom ? t("rv_tpl_custom_d") : t("rv_tpl_builtin_d")}</p>
            <details className="rv-sec"><summary>{t("rv_tpl_sections", { n: tpl.sections.length })} · {usesDefaultRubric(tpl) ? t("rv_scheme_default") : t("rv_scheme_tpl", { n: tpl.scale_total || "—" })}</summary>
              <ol className="rv-tpl">{tpl.sections.map((s) => <li key={s.id}>{s.number} {s.title}{s.max_points > 0 && <small className="muted"> ({s.max_points})</small>}</li>)}</ol></details>
          </div>

          <div className="card stack">
            <h3>3. {t("rv_s3")}</h3>
            <p className="muted small">{t("rv_batch_hint")}</p>
            <div className={`drop ${drag ? "drag" : ""} ${items.length ? "has" : ""}`} role="button" tabIndex={0}
              onClick={() => !running && workInput.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !running && workInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (!running) void addFiles(Array.from(e.dataTransfer.files ?? [])); }}>
              <input ref={workInput} type="file" hidden multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <div><b>{reading ? t("reading") : t("rv_drop_multi")}</b><div className="muted small">PDF · DOCX · {t("rv_batch_max", { n: MAX_BATCH_WORKS })}</div></div>
            </div>

            {items.length > 0 && (
              <ol className="rv-items">
                {items.map((it) => {
                  const sv = it.savedId ? saved.find((x) => x.id === it.savedId) : undefined;
                  const dr = sv ? labelsFor(lang).decision(sv.result.decision.key) : null;
                  const sevCls = sv ? (sv.result.decision.severity === "ok" ? "ok" : sv.result.decision.severity === "danger" ? "err" : "warn") : "";
                  return (
                    <li key={it.id} className={`rv-item st-${it.status}`}>
                      <div className="rv-item-head">
                        <b><Icon name="file" size={15} /> {it.name}</b>
                        <span className={`badge st-${it.status}`}>{t(STATUS_KEY[it.status])}</span>
                        {it.words != null && <span className="muted small">{t("rv_words", { n: it.words.toLocaleString() })}{it.pages ? ` · ${t("rv_pages", { n: it.pages })}` : ""}</span>}
                        {!running && ["ready", "read_error", "failed", "skipped", "stopped", "done"].includes(it.status) && <button className="btn sm ghost" aria-label={t("rv_remove_file")} onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}>×</button>}
                      </div>
                      {it.status === "running" && <div className="rv-item-run"><span className="small">{stageText((it.stage as Stage) ?? { phase: "start" }, t)}</span><div className="bar"><div style={{ width: `${stagePct((it.stage as Stage) ?? { phase: "start" })}%` }} /></div></div>}
                      {it.error && (it.status === "read_error" || it.status === "failed" || it.status === "skipped") && <div className="rv-item-err small" role="alert">{it.error}</div>}
                      {sv && dr && (
                        <div className="rv-item-res">
                          <span className={`rv-pill ${sevCls}`}>{sv.result.score.sumMax ? `${sv.result.score.score100}/100` : "—"} · {dr.short}{sv.result.decision.belowPass && sv.result.score.sumMax > 0 ? " ⚠" : ""}</span>
                          <button className="btn sm" onClick={() => setOpen(sv.id)}>{t("rv_open")}</button>
                          <button className="btn sm" onClick={() => void downloadOne(sv.result)}>{t("rv_download_one")}</button>
                        </div>
                      )}
                      {it.status === "failed" && it.blocks && !running && <button className="btn sm" disabled={left === 0} onClick={() => void runItems([it])}>{t("rv_retry")}</button>}
                    </li>
                  );
                })}
              </ol>
            )}

            <p className="muted small privacy"><Icon name="shield" size={15} /> {t("rv_privacy")} <a href={lang === "vi" ? "/quyen-rieng-tu" : "/en/privacy"} target="_blank" rel="noopener">{t("privacy_link")}</a></p>
            {err && <div className="err box" role="alert">{err}</div>}
            {over && <div className="warnbox box" role="alert">{t("rv_batch_over", { a: ready.length, b: Number.isFinite(left) ? left : 0 })}</div>}
            {running && (
              <div className="busy" aria-live="polite"><div className="spinner" /><div style={{ flex: 1 }}>
                <b>{t("rv_batch_progress", { a: Math.min(doneCount + 1, inRun.length), b: inRun.length, name: runningItem?.name ?? "" })}</b>
                <div className="muted small">{stopping ? t("rv_batch_stopping") : t("rv_busy_note")}</div></div>
                <button className="btn sm" onClick={() => { stopRef.current = true; setStopping(true); }} disabled={stopping}>{t("rv_batch_stop")}</button></div>
            )}
            <div className="between">
              <span className="muted small">{left === 0 ? t("rv_quota_out", { date: fmtDay(rq?.next_reset ?? "") }) : t("rv_will_use")}</span>
              <span className="row wrap">
                {batchZip.length > 1 && <button className="btn" onClick={() => void downloadZip(batchZip)} disabled={zipBusy}>{zipBusy ? "…" : t("rv_zip")}</button>}
                {finished.length > 0 && !running && <button className="btn" onClick={() => setItems([])}>{t("rv_batch_new")}</button>}
                <button className="btn primary" disabled={ready.length === 0 || running || left === 0 || over || reading} onClick={() => void runItems(ready)}>{running ? "…" : ready.length > 1 ? t("rv_batch_start", { n: ready.length }) : t("rv_start")}</button>
              </span>
            </div>
          </div>
        </>
      )}

      {access && !shown && saved.length > 0 && (
        <div className="card stack">
          <div className="between"><h4>{t("rv_saved")}</h4>
            <span className="row wrap">
              {saved.length > 1 && <button className="btn sm" onClick={() => void downloadZip(saved)} disabled={zipBusy}>{zipBusy ? "…" : t("rv_zip")}</button>}
              <button className="btn sm" onClick={() => { if (confirm(t("rv_clear_confirm"))) { clearReviews(); setSaved([]); savedRef.current = []; toast(t("rv_cleared")); } }}>{t("rv_clear")}</button></span></div>
          <p className="muted small">{t("rv_saved_note", { n: MAX_SAVED_REVIEWS })}</p>
          <ul className="rv-saved">{saved.map((x) => (
            <li key={x.id}><button className="btn sm" onClick={() => setOpen(x.id)}>{x.result.file.name}</button>
              <span className="muted small">{new Date(x.at).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB")} · {x.result.score.sumMax ? `${x.result.score.score100}/100` : "—"}</span>
              <button className="btn sm ghost" aria-label={t("rv_remove")} onClick={() => { const next = removeReview(x.id); savedRef.current = next; setSaved(next); }}>×</button></li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}
