import { useMemo, useState } from "react";
import { useI18n } from "../i18n.tsx";
import type { AnalysisResult, Passage, Priority } from "../../shared/types.ts";
import { PASS_SCORE } from "../../shared/types.ts";

export function ScoreGauge({ score }: { score: number }) {
  const { t } = useI18n();
  const r = 54, c = 2 * Math.PI * r;
  const tone = score >= 80 ? "great" : score >= PASS_SCORE ? "good" : score >= 40 ? "weak" : "poor";
  return (
    <div className={`gauge ${tone}`} role="img" aria-label={`${t("score")}: ${score}/100`}>
      <svg viewBox="0 0 140 140" width="140" height="140">
        <circle cx="70" cy="70" r={r} className="track" />
        <circle cx="70" cy="70" r={r} className="arc" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 70 70)" />
        <line x1={70 + r * Math.cos(-Math.PI / 2 + (PASS_SCORE / 100) * 2 * Math.PI) * 0.82} y1={70 + r * Math.sin(-Math.PI / 2 + (PASS_SCORE / 100) * 2 * Math.PI) * 0.82}
          x2={70 + r * Math.cos(-Math.PI / 2 + (PASS_SCORE / 100) * 2 * Math.PI) * 1.18} y2={70 + r * Math.sin(-Math.PI / 2 + (PASS_SCORE / 100) * 2 * Math.PI) * 1.18} className="mark" />
      </svg>
      <div className="gauge-n"><b>{score}</b><small>/100</small></div>
    </div>
  );
}

const CRIT: [keyof AnalysisResult["breakdown"], number, "c_topic" | "c_concept" | "c_method" | "c_evidence" | "c_currency"][] = [
  ["topic", 40, "c_topic"], ["concept", 20, "c_concept"], ["method", 15, "c_method"], ["evidence", 15, "c_evidence"], ["currency", 10, "c_currency"],
];

export function Breakdown({ b }: { b: AnalysisResult["breakdown"] }) {
  const { t } = useI18n();
  return (
    <div className="criteria">
      {CRIT.map(([k, max, label]) => (
        <div key={k} className="crit">
          <span>{t(label)}</span>
          <div className="bar"><div style={{ width: `${(b[k] / max) * 100}%` }} /></div>
          <b>{b[k]}<small>/{max}</small></b>
        </div>
      ))}
    </div>
  );
}

const PRIO: Priority[] = ["high", "medium", "low"];

export function PassageList({ passages, dropped, selected, toggle }: {
  passages: Passage[]; dropped: number; selected: Set<string>; toggle: (id: string) => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Priority | "all">("all");
  const counts = useMemo(() => Object.fromEntries(PRIO.map((p) => [p, passages.filter((x) => x.priority === p).length])), [passages]);
  const shown = passages.filter((p) => filter === "all" || p.priority === filter);
  return (
    <div>
      <div className="chips" role="group" aria-label={t("priority")}>
        <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>{t("all")} ({passages.length})</button>
        {PRIO.map((p) => <button key={p} className={`${p} ${filter === p ? "on" : ""}`} onClick={() => setFilter(p)}>{t(`prio_${p}` as "prio_high")} ({counts[p]})</button>)}
      </div>
      <ul className="passages">
        {shown.map((p) => (
          <li key={p.id} className={`passage ${p.priority} ${selected.has(p.id) ? "sel" : ""}`}>
            <label>
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              <div className="p-body">
                <div className="p-meta">
                  <span className={`prio ${p.priority}`}>{t(`prio_${p.priority}` as "prio_high")}</span>
                  <span className="badge">#{p.rank}</span>
                  <span className="badge">{t(`use_${p.use}` as "use_theory")}</span>
                  {p.page && <span className="badge">{t("page")} {p.page}</span>}
                </div>
                <blockquote><mark>{p.quote}</mark></blockquote>
                <p className="muted small">{p.reason}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
      {dropped > 0 && <p className="muted small">{t("dropped_note", { n: dropped })}</p>}
    </div>
  );
}

export function Recommendations({ rec }: { rec: NonNullable<AnalysisResult["recommendations"]> }) {
  const { t } = useI18n();
  return (
    <div className="reco">
      <div className="card inner">
        <h4>{t("reco_advice")}</h4>
        <p>{rec.advice}</p>
        {rec.keywords.length > 0 && <div className="tags static">{rec.keywords.map((k) => <span key={k} className="tag">{k}</span>)}</div>}
        {rec.queries.length > 0 && (
          <p className="small muted">{t("reco_queries")}: {rec.queries.map((q) => (
            <a key={q} className="q" target="_blank" rel="noopener noreferrer" href={`https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`}>{q}</a>
          ))}</p>
        )}
      </div>

      <h4>{t("reco_works")}</h4>
      {rec.works.length === 0 ? <p className="muted">{t("reco_none")}</p> : (
        <ul className="works">
          {rec.works.map((w) => (
            <li key={w.doi || w.title}>
              <a href={w.doi ? `https://doi.org/${w.doi}` : w.url} target="_blank" rel="noopener noreferrer"><b>{w.title}</b></a>
              <div className="muted small">{w.authors} · {w.year ?? "n.d."} · <i>{w.venue}</i></div>
              <div className="small">
                <span className="badge">{t("cited_by", { n: w.citedBy })}</span>{w.openAccess && <span className="badge oa">Open Access</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h4>{t("reco_journals")} <small className="muted">· {t("from_edufind")}</small></h4>
      {rec.journals.length === 0 ? <p className="muted">{t("reco_none")}</p> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>{t("journal")}</th><th>ISSN</th><th>{t("rank")}</th><th>{t("note")}</th></tr></thead>
            <tbody>
              {rec.journals.map((j) => (
                <tr key={j.title}>
                  <td><b>{j.title}</b><div className="muted small">{j.publisher}</div></td>
                  <td className="mono small">{j.issn.join(", ")}</td>
                  <td>{j.domestic ? <span className="badge">{t("hdgs_max", { n: j.maxScore ?? 0 })}</span> : <span className={`badge q ${j.quartile}`}>{j.quartile || "—"}</span>}</td>
                  <td className="small">{j.why === "venue" ? t("why_venue") : t("why_keyword")}{j.openAccess && <span className="badge oa">OA</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rec.edufind && <p><a className="btn" href={rec.edufind.url} target="_blank" rel="noopener noreferrer">{t("open_edufind")} →</a></p>}
    </div>
  );
}
