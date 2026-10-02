import { useState } from "react";
import { useI18n } from "../i18n.tsx";
import { Panel } from "./Panel.tsx";
import { Icon } from "./Icon.tsx";
import { Bullets, Breakdown, Choice, PassageList, RecoAdvice, RecoJournals, RecoWorks, ScoreGauge } from "./Results.tsx";
import { PASS_SCORE, type AnalysisResult } from "../../shared/types.ts";

const clip = (s: string, n = 150) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

/** Kết quả đánh giá: tổng quan, các phần đánh giá tách riêng (thu gọn được), rồi hộp "Quyết định của bạn" ở cuối. */
export default function ResultView({ res, fileName, sel, toggle, onCiteSelected, onCiteSource, onAnother, onEditAbstract, onNewProject }: {
  res: AnalysisResult; fileName: string; sel: Set<string>; toggle: (id: string) => void;
  onCiteSelected: () => void; onCiteSource: () => void; onAnother: () => void; onEditAbstract: () => void; onNewProject: () => void;
}) {
  const { t, lang } = useI18n();
  const pass = res.score >= PASS_SCORE;
  const keys = pass ? ["summary", "fit", "gap", "passages"] : ["summary", "fit", "gap", "advice", "works", "journals"];
  const [open, setOpen] = useState<Record<string, boolean>>({ passages: true, advice: true, works: true, journals: true });
  const tog = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const setAll = (v: boolean) => setOpen((o) => ({ ...o, ...Object.fromEntries(keys.map((k) => [k, v])) }));
  const allOpen = keys.every((k) => open[k]);
  const rec = res.recommendations;
  const strengths = res.strengths[lang], gaps = res.gaps[lang];
  const roman = (k: string) => ["I", "II", "III", "IV", "V", "VI"][keys.indexOf(k)] + ".";

  return (
    <div className="stack gap">
      <div className="card result-head">
        <ScoreGauge score={res.score} />
        <div className="grow">
          <div className={`verdict ${pass ? "pass" : "fail"}`}><Icon name={pass ? "checkCircle" : "alert"} size={14} /> {pass ? t("pass") : t("fail")}</div>
          <h3 className="serif">{res.meta.title || fileName}</h3>
          <p className="muted small">{res.meta.authors.map((a) => a.family).join(", ")}{res.meta.year ? ` · ${res.meta.year}` : ""}{res.meta.container ? ` · ${res.meta.container}` : ""} · {res.language === "vi" ? t("lang_vi") : t("lang_en")}</p>
          <p className="prose">{res.verdict[lang]}</p>
        </div>
        <Breakdown b={res.breakdown} />
      </div>

      <div className="between toolbar">
        <h3 className="serif">{t("eval_h")}</h3>
        <button className="btn sm" onClick={() => setAll(!allOpen)}>{allOpen ? t("collapse_all") : t("expand_all")}</button>
      </div>

      <Panel n={roman("summary")} title={t("sec_summary")} icon="lines" accent="blue" open={!!open.summary} onToggle={() => tog("summary")} preview={clip(res.summary[lang])}>
        <p className="prose">{res.summary[lang]}</p>
      </Panel>
      <Panel n={roman("fit")} title={t("sec_fit")} icon="checkCircle" accent="teal" open={!!open.fit} onToggle={() => tog("fit")}
        preview={strengths.length ? clip(strengths[0], 110) : ""} badge={<span className="badge">{strengths.length}</span>}>
        {strengths.length ? <Bullets items={strengths} tone="teal" /> : <p className="muted">{t("reco_none")}</p>}
      </Panel>
      <Panel n={roman("gap")} title={t("sec_gap")} icon="gap" accent="amber" open={!!open.gap} onToggle={() => tog("gap")}
        preview={gaps.length ? clip(gaps[0], 110) : ""} badge={<span className="badge">{gaps.length}</span>}>
        {gaps.length ? <Bullets items={gaps} tone="amber" /> : <p className="muted">{t("reco_none")}</p>}
      </Panel>

      {pass ? (
        <Panel n={roman("passages")} title={t("passages_h")} icon="quote" accent="emerald" open={!!open.passages} onToggle={() => tog("passages")}
          preview={t("selected_n", { n: sel.size })} badge={<span className="badge">{res.passages.length}</span>}>
          <p className="muted small">{t("passages_d")}</p>
          {res.passages.length === 0 ? <p className="muted">{t("no_passages")}</p> :
            <PassageList passages={res.passages} dropped={res.droppedPassages} selected={sel} toggle={toggle} />}
        </Panel>
      ) : rec && (
        <>
          <Panel n={roman("advice")} title={t("sec_advice")} icon="compass" accent="violet" open={!!open.advice} onToggle={() => tog("advice")} preview={clip(rec.advice[lang])}>
            <RecoAdvice rec={rec} />
          </Panel>
          <Panel n={roman("works")} title={t("reco_works")} icon="book" accent="violet" open={!!open.works} onToggle={() => tog("works")}
            preview={rec.works[0]?.title} badge={<span className="badge">{rec.works.length}</span>}>
            <RecoWorks rec={rec} />
          </Panel>
          <Panel n={roman("journals")} title={t("reco_journals")} icon="cap" accent="violet" open={!!open.journals} onToggle={() => tog("journals")}
            preview={rec.journals[0]?.title} badge={<span className="badge">{rec.journals.length}</span>}>
            <RecoJournals rec={rec} />
          </Panel>
        </>
      )}

      <section className="decision">
        <div className="decision-head">
          <span className="panel-ico gold"><Icon name="compass" size={18} /></span>
          <div><h3 className="serif">{t("decision_h")}</h3><p className="muted small">{pass ? t("decision_d_pass") : t("decision_d_fail")}</p></div>
        </div>
        <div className="choices">
          {pass ? (
            <>
              <Choice tone="primary" icon="quote" title={t("opt_cite_sel")} desc={sel.size ? t("opt_cite_sel_d", { n: sel.size }) : t("opt_cite_sel_none")} disabled={sel.size === 0} onClick={onCiteSelected} badge={t("recommended")} />
              <Choice icon="book" title={t("opt_cite_src")} desc={t("opt_cite_src_d")} onClick={onCiteSource} />
              <Choice icon="refresh" title={t("opt_another")} desc={t("opt_another_d")} onClick={onAnother} />
              <Choice icon="plus" title={t("new_project")} desc={t("opt_new_d")} onClick={onNewProject} />
            </>
          ) : (
            <>
              <Choice tone="primary" icon="search" title={t("opt_find_other")} desc={t("opt_find_other_d")} onClick={onAnother} badge={t("recommended")} />
              <Choice icon="edit" title={t("opt_edit_abs")} desc={t("opt_edit_abs_d")} onClick={onEditAbstract} />
              <Choice tone="caution" icon="alert" title={t("opt_cite_anyway")} desc={t("opt_cite_anyway_d")} onClick={onCiteSource} />
              <Choice icon="plus" title={t("new_project")} desc={t("opt_new_d")} onClick={onNewProject} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
