import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { ApiFailure } from "../lib/api.ts";
import { ExtractFailure } from "../lib/extract.ts";
import { readReviewDoc, type ReadDoc } from "../lib/review-read.ts";
import { analyzeTemplate, clearReviews, loadSaved, removeReview, runReview, saveReview, type ReviewQuota, type SavedReview, type Stage } from "../lib/review.ts";
import { blockLine, numberBlocks } from "../../shared/review/corpus.ts";
import { MAX_REVIEW_CHARS } from "../../shared/review/limits.ts";
import { DOC_TYPES, ROLES } from "../../shared/review/rubric.ts";
import { builtinTemplate, usesDefaultRubric, type Template } from "../../shared/review/template.ts";
import type { ReviewResult } from "../../shared/review/assemble.ts";
import { VerifyCard, fmtDay } from "../components/Tier.tsx";
import { Icon } from "../components/Icon.tsx";
import { track } from "../lib/isa.ts";
import type { Key } from "../dict.ts";

const stageText = (s: Stage | null, t: (k: Key, p?: Record<string, string | number>) => string) =>
  !s ? "" : s.phase === "start" ? t("rv_ph_start") : s.phase === "sections" ? t("rv_ph_sections", { a: Math.min(s.done + 1, s.total), b: s.total }) : s.phase === "overall" ? t("rv_ph_overall") : t("rv_ph_finish");
const stagePct = (s: Stage | null) => (!s ? 0 : s.phase === "start" ? 4 : s.phase === "sections" ? 8 + (s.done / Math.max(s.total, 1)) * 70 : s.phase === "overall" ? 85 : 96);

const plainTemplateText = (doc: ReadDoc) => numberBlocks(doc.blocks).map((b) => blockLine(b).replace(/^\[¶\d+\] /, "")).join("\n");

function Result({ r, onClose }: { r: ReviewResult; onClose?: () => void }) {
  const { t } = useI18n();
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const d = r.decision;
  const sev = d.severity === "ok" ? "ok" : d.severity === "danger" ? "err" : "warn";
  const ev = (list: { quote: string; paragraph?: number; page?: number }[]) => list.length > 0 && (
    <ul className="rv-ev">{list.map((e, i) => <li key={i}>“{e.quote}” <small className="muted">(¶{e.paragraph}{e.page ? `, ${t("rv_page")} ${e.page}` : ""})</small></li>)}</ul>
  );
  const download = async () => {
    setBusy(true);
    try {
      const { buildDocx, exportFileName } = await import("../lib/review-docx.ts");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await buildDocx(r)); a.download = exportFileName(r);
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { console.error(e); toast(t("rv_export_fail"), "err"); } finally { setBusy(false); }
  };
  return (
    <div className="stack rv-result">
      <div className="card stack">
        <div className="between">
          <div><h3>{r.profile.title && r.profile.title !== "Không xác định" ? r.profile.title : r.file.name}</h3>
            <p className="muted small">{r.meta.docTypeLabel} · {r.file.name} · {t("rv_words", { n: r.file.words.toLocaleString() })}{r.file.pages ? ` · ${t("rv_pages", { n: r.file.pages })}` : ""}</p></div>
          {onClose && <button className="btn sm" onClick={onClose}>{t("rv_close")}</button>}
        </div>
        <div className="rv-score">
          <div className={`rv-num ${sev}`}><b>{r.score.sumMax ? r.score.score100 : "—"}</b><small>/100</small></div>
          <div className="stack">
            <b className={sev}>{d.label}</b>
            <span className="muted">{d.advice}</span>
            {d.belowPass && r.score.sumMax > 0 && <span className="warn small"><Icon name="info" size={14} /> {t("rv_below_pass")}</span>}
            {d.floorApplied && <span className="muted small">{t("rv_floor")}</span>}
            {d.mismatch && <span className="muted small">{t("rv_mismatch", { m: d.mismatch.modelLabel ?? d.mismatch.model })}</span>}
          </div>
        </div>
        <div className="row wrap">
          <button className="btn primary" onClick={download} disabled={busy}><Icon name="file" size={16} /> {busy ? "…" : t("rv_download")}</button>
        </div>
        <p className="muted small">{t("rv_draft_note")}</p>
        {r.warnings.length > 0 && <div className="box warnbox"><b>{t("rv_warnings")}</b><ul>{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
      </div>

      {r.score.rows.length > 0 && (
        <div className="card stack">
          <h4>{t("rv_table")}</h4>
          <table className="tbl rv-tbl"><thead><tr><th>{t("rv_criterion")}</th><th>{t("rv_max")}</th><th>{t("rv_points")}</th></tr></thead>
            <tbody>{r.score.rows.map((x, i) => <tr key={i}><td>{x.label}{x.rationale && <small className="muted"><br />{x.rationale}</small>}</td><td>{x.max}</td><td><b>{x.points}</b></td></tr>)}
              <tr><td><b>{t("rv_total")}</b></td><td><b>{r.score.sumMax}</b></td><td><b>{r.score.sum}</b></td></tr></tbody></table>
        </div>
      )}

      {(r.overall.summary || r.overall.conclusion) && (
        <div className="card stack">
          <h4>{t("rv_overall")}</h4>
          {r.overall.summary.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          {r.overall.conclusion.split(/\n+/).filter(Boolean).map((p, i) => <p key={`c${i}`}>{p}</p>)}
        </div>
      )}

      <div className="card stack">
        <h4>{t("rv_sections")}</h4>
        {r.sections.map((s) => (
          <details key={s.id} className="rv-sec" open={s.level === 1 && r.sections.length <= 8}>
            <summary><b>{s.number} {s.title}</b>{s.max_points > 0 && <span className="badge">{s.points}/{s.max_points}</span>}{s.missing && <span className="badge warn">{t("rv_missing")}</span>}{s.insufficient_basis && !s.missing && <span className="badge">{t("rv_insufficient")}</span>}</summary>
            {s.content.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            {s.strengths.length > 0 && <><h5>{t("rv_strengths")}</h5><ul>{s.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            {s.weaknesses.length > 0 && <><h5>{t("rv_weaknesses")}</h5><ul>{s.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            {s.revisions.length > 0 && <><h5>{t("rv_revisions")}</h5><ul>{s.revisions.map((x, i) => <li key={i}><span className={`badge ${x.priority === "bat_buoc" ? "warn" : ""}`}>{t(`rv_pr_${x.priority}` as Key)}</span> {x.action}</li>)}</ul></>}
            {s.evidence.length > 0 && <><h5>{t("rv_evidence")}</h5>{ev(s.evidence)}</>}
          </details>
        ))}
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

export default function Review() {
  const { t, lang } = useI18n();
  const { quota, toast } = useApp();
  const eligible = !!quota?.approved;
  const [rq, setRq] = useState<ReviewQuota | null>(null);
  const [docType, setDocType] = useState<keyof typeof DOC_TYPES>("thesis");
  const [role, setRole] = useState<keyof typeof ROLES>("reviewer");
  const [field, setField] = useState("");
  const [notes, setNotes] = useState("");
  const [custom, setCustom] = useState<{ name: string; tpl: Template } | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);
  const [work, setWork] = useState<{ name: string; doc: ReadDoc } | null>(null);
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<SavedReview[]>(loadSaved);
  const [open, setOpen] = useState<string>("");
  const [drag, setDrag] = useState(false);
  const workInput = useRef<HTMLInputElement>(null);
  const tplInput = useRef<HTMLInputElement>(null);

  const refreshQuota = () => { void supabase.rpc("my_review_quota").then(({ data }) => setRq((data as ReviewQuota | null) ?? null)); };
  useEffect(() => { if (eligible) refreshQuota(); }, [eligible]);
  useEffect(() => { if (running) { const f = (e: BeforeUnloadEvent) => { e.preventDefault(); }; addEventListener("beforeunload", f); return () => removeEventListener("beforeunload", f); } }, [running]);

  const tpl: Template = useCustom && custom ? custom.tpl : builtinTemplate(docType);
  const readErr = (e: unknown) => {
    const code = e instanceof ExtractFailure ? e.code : "corrupt";
    setErr(code === "size" ? t("err_file_size", { mb: 15 }) : code === "type" ? t("rv_err_type") : t(`err_file_${code}` as Key, { mb: 15, n: 0 }));
  };
  const pickWork = async (f?: File) => {
    if (!f) return;
    setErr(""); setWork(null); setReading({ done: 0, total: 1 });
    try {
      const doc = await readReviewDoc(f, (done, total) => setReading({ done, total }));
      if (doc.chars > MAX_REVIEW_CHARS) { setErr(t("rv_too_long", { n: Math.round(MAX_REVIEW_CHARS / 1000).toLocaleString() })); return; }
      setWork({ name: f.name, doc });
    } catch (e) { readErr(e); } finally { setReading(null); }
  };
  const pickTemplate = async (f?: File) => {
    if (!f) return;
    setErr(""); setTplBusy(true);
    try {
      const doc = await readReviewDoc(f, () => {}, 80);
      const text = plainTemplateText(doc);
      setCustom({ name: f.name, tpl: await analyzeTemplate(text) }); setUseCustom(true);
    } catch (e) {
      if (e instanceof ApiFailure) setErr(e.info.message || t(`err_${e.info.error}` as Key)); else readErr(e);
    } finally { setTplBusy(false); }
  };

  const start = async () => {
    if (!work || running) return;
    setErr(""); setRunning(true); setStage({ phase: "start" }); setOpen("");
    track("ami_phan_bien", docType);
    try {
      const { result, quota: q } = await runReview({ blocks: work.doc.blocks, fileName: work.name, meta: { docType, role, field: field.trim(), notes: notes.trim() }, template: tpl, onStage: setStage });
      const list = saveReview(result);
      setSaved(list); setOpen(list[0].id); if (q) setRq(q); else refreshQuota();
      setWork(null);
    } catch (e) {
      refreshQuota();
      if (e instanceof ApiFailure) {
        const k = e.info.error;
        setErr(k === "quota_exhausted" ? t("rv_quota_out", { date: fmtDay(rq?.next_reset ?? "") }) : k === "ai_failed" && e.info.message ? `${e.info.message} ${t("rv_refunded")}` : t(`err_${k}` as Key) + (k === "ai_failed" || k === "truncated" ? ` ${t("rv_refunded")}` : ""));
      } else setErr(t("err_network"));
    } finally { setRunning(false); setStage(null); }
  };

  if (!quota) return <div className="center"><div className="spinner" /></div>;
  const left = rq ? (rq.unlimited ? Infinity : rq.left) : 1;
  const shown = saved.find((x) => x.id === open);

  return (
    <div className="page rv-page">
      <div className="between"><h2>{t("rv_title")}</h2>
        {eligible && rq && <span className="badge">{rq.unlimited ? t("rv_unlimited") : t("rv_left", { a: rq.left, b: rq.limit })}</span>}</div>
      <p className="muted">{t("rv_intro")}</p>

      {!eligible && (
        <>
          <VerifyCard title={t("rv_locked_title")} body={t("rv_locked_body")} benefits />
          <div className="card stack"><h4>{t("rv_what_h")}</h4>
            <ul>{(["rv_what_1", "rv_what_2", "rv_what_3", "rv_what_4"] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul></div>
        </>
      )}

      {eligible && shown && <Result r={shown.result} onClose={() => setOpen("")} />}

      {eligible && !shown && (
        <>
          <div className="card stack">
            <h3>1. {t("rv_s1")}</h3>
            <div className="grid2">
              <label>{t("rv_doctype")}<select value={docType} onChange={(e) => setDocType(e.target.value as keyof typeof DOC_TYPES)} disabled={running}>{Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>{t("rv_role")}<select value={role} onChange={(e) => setRole(e.target.value as keyof typeof ROLES)} disabled={running}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
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
            <div className={`drop ${drag ? "drag" : ""} ${work ? "has" : ""}`} role="button" tabIndex={0}
              onClick={() => !running && workInput.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !running && workInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (!running) void pickWork(e.dataTransfer.files?.[0]); }}>
              <input ref={workInput} type="file" hidden accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => { void pickWork(e.target.files?.[0]); e.target.value = ""; }} />
              {reading ? <div><b>{t("reading")}</b><div className="bar"><div style={{ width: `${Math.max(5, (reading.done / Math.max(reading.total, 1)) * 100)}%` }} /></div></div>
                : work ? <div><b><Icon name="file" size={16} /> {work.name}</b><div className="muted small">{t("rv_words", { n: work.doc.words.toLocaleString() })}{work.doc.pages ? ` · ${t("rv_pages", { n: work.doc.pages })}` : ""} · {t("chars", { n: work.doc.chars.toLocaleString() })}</div><div className="small">{t("replace_file")}</div></div>
                  : <div><b>{t("drop_here")}</b><div className="muted small">PDF · DOCX</div></div>}
            </div>
            <p className="muted small privacy"><Icon name="shield" size={15} /> {t("rv_privacy")} <a href={lang === "vi" ? "/quyen-rieng-tu" : "/en/privacy"} target="_blank" rel="noopener">{t("privacy_link")}</a></p>
            {err && <div className="err box" role="alert">{err}</div>}
            {running && (
              <div className="busy" aria-live="polite"><div className="spinner" /><div style={{ flex: 1 }}><b>{stageText(stage, t)}</b><div className="bar"><div style={{ width: `${stagePct(stage)}%` }} /></div><div className="muted small">{t("rv_busy_note")}</div></div></div>
            )}
            <div className="between">
              <span className="muted small">{left === 0 ? t("rv_quota_out", { date: fmtDay(rq?.next_reset ?? "") }) : t("rv_will_use")}</span>
              <button className="btn primary" disabled={!work || running || left === 0 || !!reading} onClick={start}>{running ? "…" : t("rv_start")}</button>
            </div>
          </div>
        </>
      )}

      {eligible && !shown && saved.length > 0 && (
        <div className="card stack">
          <div className="between"><h4>{t("rv_saved")}</h4><button className="btn sm" onClick={() => { if (confirm(t("rv_clear_confirm"))) { clearReviews(); setSaved([]); toast(t("rv_cleared")); } }}>{t("rv_clear")}</button></div>
          <p className="muted small">{t("rv_saved_note")}</p>
          <ul className="rv-saved">{saved.map((x) => (
            <li key={x.id}><button className="btn sm" onClick={() => setOpen(x.id)}>{x.result.file.name}</button>
              <span className="muted small">{new Date(x.at).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB")} · {x.result.score.sumMax ? `${x.result.score.score100}/100` : "—"}</span>
              <button className="btn sm ghost" aria-label={t("rv_remove")} onClick={() => setSaved(removeReview(x.id))}>×</button></li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}
