import { useEffect, useRef, useState, type DragEvent } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { analyze, ApiFailure } from "../lib/api.ts";
import { ExtractFailure, extractText, OCR_MAX_PAGES, type Progress } from "../lib/extract.ts";
import { detectLang } from "../../shared/lang.ts";
import { MAX_ABSTRACT_CHARS, MAX_FILE_BYTES, MAX_TEXT_CHARS, MIN_ABSTRACT_WORDS, PASS_SCORE, type AnalysisResult } from "../../shared/types.ts";
import { QuotaBar, remaining } from "../components/Quota.tsx";
import { ContactAdmin } from "../components/Chrome.tsx";
import { Breakdown, PassageList, Recommendations, ScoreGauge } from "../components/Results.tsx";
import CiteStep from "../components/CiteStep.tsx";
import type { Key } from "../dict.ts";

const store = {
  get: (k: string) => { try { return sessionStorage.getItem(k) ?? ""; } catch { return ""; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* bỏ qua */ } },
};
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export default function Workspace() {
  const { t, lang } = useI18n();
  const { profile, quota, setQuota, refresh } = useApp();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [abstract, setAbstract] = useState(() => store.get("tl-abstract"));
  const [project, setProject] = useState(() => store.get("tl-project"));
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [prog, setProg] = useState<Progress | null>(null);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [err, setErr] = useState<string>("");
  const [needContact, setNeedContact] = useState(false);
  const [res, setRes] = useState<AnalysisResult | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { store.set("tl-abstract", abstract); }, [abstract]);
  useEffect(() => { store.set("tl-project", project); }, [project]);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setPhase((p) => Math.min(p + 1, 3)), 9000);
    return () => clearInterval(id);
  }, [busy]);

  const wc = words(abstract);
  const abstractOk = wc >= MIN_ABSTRACT_WORDS && abstract.length <= MAX_ABSTRACT_CHARS;
  const left = remaining(quota);
  const out = quota != null && left <= 0;

  async function pick(f: File | undefined | null, ocr = false) {
    if (!f) return;
    setErr(""); setFile(null); setText(""); setProg(null); setNeedContact(false); setOcrFile(null);
    setReading(true);
    abort.current = new AbortController();
    try {
      const r = await extractText(f, setProg, { ocr, signal: abort.current.signal });
      if (r.text.length > MAX_TEXT_CHARS) { setErr(t("err_too_long")); return; }
      const dl = detectLang(r.text);
      if (dl === "other") { setErr(t("err_unsupported_language")); return; }
      setFile(f); setText(r.text);
    } catch (e) {
      const code = e instanceof ExtractFailure ? e.code : "corrupt";
      if (code === "no_text" && !ocr && e instanceof ExtractFailure && e.kind === "pdf") setOcrFile(f); // đề nghị OCR
      else if (code !== "cancelled") setErr(t(`err_file_${code}` as Key, { mb: MAX_FILE_BYTES / 1048576, n: OCR_MAX_PAGES }));
    } finally { setReading(false); }
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files?.[0]); };

  async function run() {
    if (!file) return;
    setErr(""); setBusy(true); setPhase(0); setNeedContact(false);
    try {
      const r = await analyze({ abstract, text, fileName: file.name, ui: lang, fields: profile?.research_fields.join("; ") });
      setRes(r); setSel(new Set(r.passages.filter((p) => p.priority === "high").map((p) => p.id)));
      if (r.quota) setQuota(r.quota);
      setStep(3);
    } catch (e) {
      if (e instanceof ApiFailure) {
        if (e.info.quota) setQuota(e.info.quota);
        if (e.info.error === "quota_exhausted") setNeedContact(true);
        setErr(e.info.error === "ai_failed" && e.info.message ? e.info.message : t(`err_${e.info.error}` as Key));
      } else setErr(t("err_network"));
      void refresh();
    } finally { setBusy(false); }
  }

  const reset = () => { setStep(1); setFile(null); setText(""); setRes(null); setSel(new Set()); setErr(""); setNeedContact(false); };
  const newDoc = () => { setStep(2); setFile(null); setText(""); setRes(null); setSel(new Set()); setErr(""); };

  const stepper = (
    <ol className="stepper" aria-label="Steps">
      {([1, 2, 3, 4] as const).map((n) => (
        <li key={n} className={step === n ? "on" : step > n ? "done" : ""}>
          <button disabled={n > step || (n >= 3 && !res)} onClick={() => setStep(n)}><span>{step > n ? "✓" : n}</span>{t(`step${n}` as "step1")}</button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="page">
      <div className="between"><h2>{t("work_title")}</h2><QuotaBar /></div>
      {stepper}

      {step === 1 && (
        <div className="card stack">
          <h3>{t("abstract_h")}</h3>
          <p className="muted">{t("abstract_d")}</p>
          <label>{t("project_label")}<input value={project} onChange={(e) => setProject(e.target.value)} maxLength={120} placeholder={t("project_ph")} /></label>
          <label>Abstract / Proposal
            <textarea rows={11} value={abstract} onChange={(e) => setAbstract(e.target.value)} placeholder={t("abstract_ph")} />
          </label>
          <div className="between">
            <span className={wc >= MIN_ABSTRACT_WORDS ? "muted small" : "warn small"}>{t("word_count", { n: wc, min: MIN_ABSTRACT_WORDS })}</span>
            <button className="btn primary" disabled={!abstractOk} onClick={() => setStep(2)}>{t("next")} →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card stack">
          <h3>{t("upload_h")}</h3>
          <p className="muted">{t("upload_d", { mb: MAX_FILE_BYTES / 1048576 })}</p>
          {out && !busy ? <ContactAdmin /> : (
            <>
              <div className={`drop ${drag ? "drag" : ""} ${file ? "has" : ""}`} role="button" tabIndex={0}
                onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
                <input ref={input} type="file" hidden accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
                {reading ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <b>{prog?.phase === "model" ? t("ocr_model") : prog?.phase === "ocr" ? t("ocr_running", { a: prog.done, b: prog.total }) : t("reading")}</b>
                    <div className="bar"><div style={{ width: `${Math.max(5, prog ? (prog.done / Math.max(prog.total, 1)) * 100 : 0)}%` }} /></div>
                    {prog && prog.phase !== "text" && <button className="btn sm" onClick={() => abort.current?.abort()}>{t("cancel")}</button>}
                  </div>
                ) : file ? (
                  <div><b>📄 {file.name}</b><div className="muted small">{(file.size / 1048576).toFixed(2)} MB · {t("chars", { n: text.length.toLocaleString() })}</div><div className="small">{t("replace_file")}</div></div>
                ) : (
                  <div><b>{t("drop_here")}</b><div className="muted small">PDF · DOC · DOCX</div></div>
                )}
              </div>
              <p className="muted small">🔒 {t("privacy_note")}</p>
            </>
          )}
          {ocrFile && !reading && (
            <div className="card inner warnbox">
              <h4>{t("ocr_title")}</h4>
              <p className="small">{t("ocr_body", { n: OCR_MAX_PAGES })}</p>
              <div className="row wrap"><button className="btn primary sm" onClick={() => void pick(ocrFile, true)}>{t("ocr_run")}</button>
                <button className="btn sm" onClick={() => setOcrFile(null)}>{t("cancel")}</button></div>
            </div>
          )}
          {err && <div className="err box" role="alert">{err}</div>}
          {needContact && <ContactAdmin />}
          {busy && (
            <div className="busy" aria-live="polite">
              <div className="spinner" />
              <div><b>{t(`phase${phase}` as "phase0")}</b><div className="muted small">{t("busy_note")}</div></div>
            </div>
          )}
          <div className="between">
            <button className="btn" onClick={() => setStep(1)} disabled={busy}>← {t("back")}</button>
            <button className="btn primary" disabled={!file || busy || reading || out} onClick={run}>{busy ? "…" : t("analyze")}</button>
          </div>
          {quota && !quota.unlimited && !out && <p className="muted small">{t("will_use")}</p>}
        </div>
      )}

      {step === 3 && res && (
        <div className="stack gap">
          <div className="card result-head">
            <ScoreGauge score={res.score} />
            <div className="grow">
              <div className={`verdict ${res.score >= PASS_SCORE ? "pass" : "fail"}`}>{res.score >= PASS_SCORE ? t("pass") : t("fail")}</div>
              <h3>{res.meta.title || file?.name}</h3>
              <p className="muted small">{res.meta.authors.map((a) => a.family).join(", ")}{res.meta.year ? ` · ${res.meta.year}` : ""}{res.meta.container ? ` · ${res.meta.container}` : ""} · {res.language === "vi" ? t("lang_vi") : t("lang_en")}</p>
              <p>{res.verdict}</p>
            </div>
            <Breakdown b={res.breakdown} />
          </div>

          <div className="card">
            <h3>{t("summary")}</h3>
            <p className="prose">{res.summary}</p>
            <div className="two">
              {res.strengths.length > 0 && <div><h4>👍 {t("strengths")}</h4><ul>{res.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}
              {res.gaps.length > 0 && <div><h4>⚠ {t("gaps")}</h4><ul>{res.gaps.map((s) => <li key={s}>{s}</li>)}</ul></div>}
            </div>
          </div>

          {res.score >= PASS_SCORE ? (
            <div className="card">
              <div className="between"><h3>{t("passages_h")}</h3>
                <div className="row wrap"><span className="muted small">{t("selected_n", { n: sel.size })}</span>
                  <button className="btn primary sm" disabled={sel.size === 0} onClick={() => setStep(4)}>{t("cite_selected")} →</button></div>
              </div>
              <p className="muted small">{t("passages_d")}</p>
              {res.passages.length === 0 ? <p className="muted">{t("no_passages")}</p> :
                <PassageList passages={res.passages} dropped={res.droppedPassages} selected={sel}
                  toggle={(id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })} />}
              <div className="actions"><button className="btn sm" onClick={() => { setSel(new Set()); setStep(4); }}>{t("cite_whole")}</button></div>
            </div>
          ) : (
            <div className="card">
              <h3>{t("reco_h")}</h3>
              <p className="muted small">{t("reco_d")}</p>
              {res.recommendations && <Recommendations rec={res.recommendations} />}
              <div className="actions"><button className="btn sm" onClick={() => { setSel(new Set()); setStep(4); }}>{t("cite_anyway")}</button></div>
            </div>
          )}
          <div className="actions"><button className="btn" onClick={newDoc}>{t("another_doc")}</button><button className="btn ghost" onClick={reset}>{t("new_project")}</button></div>
        </div>
      )}

      {step === 4 && res && (
        <CiteStep meta={res.meta} passages={res.passages.filter((p) => sel.has(p.id))} project={project} onBack={() => setStep(3)} />
      )}
    </div>
  );
}
