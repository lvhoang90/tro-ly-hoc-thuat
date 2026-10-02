import { useEffect, useRef, useState, type DragEvent } from "react";
import { useMascot } from "../mascot/ctx.tsx";
import { scoreReaction } from "../mascot/reactions.ts";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { analyze, ApiFailure } from "../lib/api.ts";
import { ExtractFailure, extractText, OCR_MAX_PAGES, type Progress } from "../lib/extract.ts";
import { detectLang } from "../../shared/lang.ts";
import { MAX_ABSTRACT_CHARS, MAX_TEXT_CHARS, MAX_TEXT_CHARS_BASIC, MIN_ABSTRACT_WORDS, type AnalysisResult } from "../../shared/types.ts";
import { QuotaBar, remaining } from "../components/Quota.tsx";
import { ContactAdmin } from "../components/Chrome.tsx";
import { Icon } from "../components/Icon.tsx";
import ResultView from "../components/ResultView.tsx";
import ProjectPicker, { type Project } from "../components/ProjectPicker.tsx";
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
  const [projectId, setProjectId] = useState(() => store.get("tl-project-id"));
  const [abstractHash, setAbstractHash] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [prog, setProg] = useState<Progress | null>(null);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [err, setErr] = useState<string>("");
  const [errDetail, setErrDetail] = useState<string>("");
  const [needContact, setNeedContact] = useState(false);
  const [res, setRes] = useState<AnalysisResult | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { store.set("tl-abstract", abstract); }, [abstract]);
  useEffect(() => { store.set("tl-project", project); }, [project]);
  useEffect(() => { store.set("tl-project-id", projectId); }, [projectId]);
  // Mã băm của abstract (không lưu nội dung): dùng để gom lịch sử trích dẫn theo đề tài khi người dùng không lưu đề tài.
  useEffect(() => {
    const norm = abstract.toLowerCase().replace(/\s+/g, " ").trim();
    if (!norm || !crypto?.subtle) { setAbstractHash(""); return; }
    void crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm)).then((b) => setAbstractHash([...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("")));
  }, [abstract]);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setPhase((p) => Math.min(p + 1, 3)), 9000);
    return () => clearInterval(id);
  }, [busy]);

  // Ali phản ứng theo từng bước, theo việc đọc tệp, phân tích và điểm số.
  const ali = useMascot();
  useEffect(() => { if (step === 1) ali.say(t("ali_step1"), "idle", 9000); else if (step === 2 && !reading && !busy) ali.say(t("ali_step2"), "idle", 9000); else if (step === 4) ali.say(t("ali_step4"), "happy", 8000); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (reading) ali.say(t("ali_reading"), "read", 0); }, [reading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (file && !reading && !busy) ali.say(t("ali_read_ok"), "happy", 8000); }, [file]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (busy) ali.say(t("ali_busy"), "think", 0); }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (res) { const r = scoreReaction(res.score); ali.say(t(r.key), r.mood, 9000); } }, [res]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (err) ali.say(t("ali_oops"), "care", 7000); }, [err]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxMb = quota?.max_file_mb ?? 2;
  const approved = quota?.approved ?? false;
  const textLimit = approved ? MAX_TEXT_CHARS : MAX_TEXT_CHARS_BASIC;
  const wc = words(abstract);
  const abstractOk = wc >= MIN_ABSTRACT_WORDS && abstract.length <= MAX_ABSTRACT_CHARS;
  // Bối cảnh học thuật người dùng đã khai báo: giúp AI chọn thuật ngữ và đánh giá theo đúng lĩnh vực.
  const profileContext = () => {
    if (!profile) return "";
    const parts = [
      profile.research_fields.length && `Declared research fields: ${profile.research_fields.join("; ")}`,
      profile.keywords.length && `Research keywords: ${profile.keywords.join("; ")}`,
      profile.title && `Academic title: ${profile.title}`,
      profile.affiliation && `Affiliation: ${profile.affiliation}`,
      profile.country && `Country: ${profile.country}`,
    ].filter(Boolean);
    return parts.join("\n");
  };
  const left = remaining(quota);
  const out = quota != null && left <= 0;

  async function pick(f: File | undefined | null, ocr = false) {
    if (!f) return;
    setErr(""); setErrDetail(""); setFile(null); setText(""); setProg(null); setNeedContact(false); setOcrFile(null);
    setReading(true);
    abort.current = new AbortController();
    try {
      const r = await extractText(f, setProg, { ocr, signal: abort.current.signal, maxBytes: maxMb * 1048576 });
      if (r.text.length > textLimit) { setErr(approved ? t("err_too_long") : t("err_too_long_basic")); return; }
      const dl = detectLang(r.text);
      if (dl === "other") { setErr(t("err_unsupported_language")); return; }
      setFile(f); setText(r.text);
    } catch (e) {
      const code = e instanceof ExtractFailure ? e.code : "corrupt";
      if (code === "no_text" && !ocr && e instanceof ExtractFailure && e.kind === "pdf") setOcrFile(f); // đề nghị OCR
      else if (code === "size") setErr(approved ? t("err_file_size", { mb: maxMb }) : t("err_file_size_basic", { mb: maxMb }));
      else if (code !== "cancelled") { setErr(t(`err_file_${code}` as Key, { mb: maxMb, n: OCR_MAX_PAGES })); setErrDetail(e instanceof ExtractFailure ? e.detail ?? "" : ""); }
    } finally { setReading(false); }
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files?.[0]); };

  async function run() {
    if (!file) return;
    setErr(""); setBusy(true); setPhase(0); setNeedContact(false);
    try {
      const r = await analyze({ abstract, text, fileName: file.name, profile: profileContext() });
      setRes(r); setSel(new Set(r.passages.filter((p) => p.priority === "high").map((p) => p.id)));
      if (r.quota) setQuota(r.quota);
      setStep(3);
    } catch (e) {
      if (e instanceof ApiFailure) {
        if (e.info.quota) setQuota(e.info.quota);
        if (e.info.error === "quota_exhausted") setNeedContact(true);
        setErr(e.info.error === "too_long" && e.info.message === "unapproved" ? t("err_too_long_basic")
          : e.info.error === "ai_failed" && e.info.message ? e.info.message : t(`err_${e.info.error}` as Key));
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
          <button disabled={n > step || (n >= 3 && !res)} onClick={() => setStep(n)}><span>{step > n ? <Icon name="check" size={13} /> : n}</span>{t(`step${n}` as "step1")}</button>
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
          <ProjectPicker title={project} abstract={abstract} projectId={projectId}
            onPick={(p: Project | null) => { if (p) { setProjectId(p.id); setProject(p.title); setAbstract(p.abstract); } else { setProjectId(""); setProject(""); setAbstract(""); } }}
            onSaved={(id, name) => { setProjectId(id); setProject(name); }} />
          <label>{t("project_label")}<input value={project} onChange={(e) => setProject(e.target.value)} maxLength={120} placeholder={t("project_ph")} /></label>
          <label>Abstract / Proposal
            <textarea rows={11} value={abstract} onChange={(e) => setAbstract(e.target.value)} placeholder={t("abstract_ph")} />
          </label>
          <div className="between">
            <span className={wc >= MIN_ABSTRACT_WORDS ? "muted small" : "warn small"}>{t("word_count", { n: wc, min: MIN_ABSTRACT_WORDS })}</span>
            <button className="btn primary" disabled={!abstractOk} onClick={() => setStep(2)}>{t("next")} <Icon name="right" size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card stack">
          <h3>{t("upload_h")}</h3>
          <p className="muted">{t("upload_d", { mb: maxMb })}</p>
          <div className={`limit-note ${approved ? "ok" : "warn"}`}><Icon name={approved ? "checkCircle" : "info"} size={16} /> <span>{approved ? t("limit_approved", { mb: maxMb }) : t("limit_basic", { mb: maxMb })}</span></div>
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
                  <div><b><Icon name="file" size={16} /> {file.name}</b><div className="muted small">{(file.size / 1048576).toFixed(2)} MB · {t("chars", { n: text.length.toLocaleString() })}</div><div className="small">{t("replace_file")}</div></div>
                ) : (
                  <div><b>{t("drop_here")}</b><div className="muted small">PDF · DOC · DOCX</div></div>
                )}
              </div>
              <p className="muted small privacy"><Icon name="shield" size={15} /> {t("privacy_note")}</p>
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
          {err && <div className="err box" role="alert">{err}{errDetail && <small className="err-detail">{t("tech_detail")}: {errDetail}</small>}</div>}
          {needContact && <ContactAdmin />}
          {busy && (
            <div className="busy" aria-live="polite">
              <div className="spinner" />
              <div><b>{t(`phase${phase}` as "phase0")}</b><div className="muted small">{t("busy_note")}</div></div>
            </div>
          )}
          <div className="between">
            <button className="btn" onClick={() => setStep(1)} disabled={busy}><Icon name="left" size={16} /> {t("back")}</button>
            <button className="btn primary" disabled={!file || busy || reading || out} onClick={run}>{busy ? "…" : t("analyze")}</button>
          </div>
          {quota && !quota.unlimited && !out && <p className="muted small">{t("will_use")}</p>}
        </div>
      )}

      {step === 3 && res && (
        <ResultView res={res} fileName={file?.name ?? ""} sel={sel}
          toggle={(id) => setSel((x) => { const n = new Set(x); n.has(id) ? n.delete(id) : n.add(id); return n; })}
          onCiteSelected={() => setStep(4)} onCiteSource={() => { setSel(new Set()); setStep(4); }}
          onAnother={newDoc} onEditAbstract={() => { setRes(null); setSel(new Set()); setFile(null); setText(""); setStep(1); }} onNewProject={reset} />
      )}

      {step === 4 && res && (
        <CiteStep meta={res.meta} passages={res.passages.filter((p) => sel.has(p.id))} ctx={{ score: res.score, projectId, abstractHash, abstractTitle: (project.trim() || abstract.trim().split(/\s+/).slice(0, 10).join(" ")).slice(0, 120) }}
          onBack={() => setStep(3)} onAnother={newDoc} onNewProject={reset} />
      )}
    </div>
  );
}
