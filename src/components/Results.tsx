import { useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import type { AnalysisResult, Passage, Priority } from "../../shared/types.ts";
import { PASS_SCORE } from "../../shared/types.ts";

export function ScoreGauge({ score }: { score: number }) {
  const { t } = useI18n();
  const r = 54, c = 2 * Math.PI * r;
  const tone = score >= 80 ? "great" : score >= PASS_SCORE ? "good" : score >= 40 ? "weak" : "poor";
  const a = -Math.PI / 2 + (PASS_SCORE / 100) * 2 * Math.PI;
  return (
    <div className={`gauge ${tone}`} role="img" aria-label={`${t("score")}: ${score}/100`}>
      <svg viewBox="0 0 140 140" width="140" height="140">
        <circle cx="70" cy="70" r={r} className="track" />
        <circle cx="70" cy="70" r={r} className="arc" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 70 70)" />
        <line x1={70 + r * Math.cos(a) * 0.84} y1={70 + r * Math.sin(a) * 0.84} x2={70 + r * Math.cos(a) * 1.16} y2={70 + r * Math.sin(a) * 1.16} className="mark" />
      </svg>
      <div className="gauge-n"><b>{score}</b><small>/100</small></div>
      <div className="gauge-cap">{t("pass_line")}</div>
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

/** Danh sách gạch đầu dòng học thuật (dấu ▪ thay cho chấm tròn mặc định). */
export function Bullets({ items, tone }: { items: string[]; tone: "teal" | "amber" }) {
  return <ul className={`bullets ${tone}`}>{items.map((s, i) => <li key={i}>{s}</li>)}</ul>;
}

const PRIO: Priority[] = ["high", "medium", "low"];

export function PassageList({ passages, dropped, selected, toggle }: {
  passages: Passage[]; dropped: number; selected: Set<string>; toggle: (id: string) => void;
}) {
  const { t, lang } = useI18n();
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
                <p className="why"><b>{t("why_cite")}:</b> {p.reason[lang]}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
      {dropped > 0 && <p className="muted small">{t("dropped_note", { n: dropped })}</p>}
    </div>
  );
}

type Reco = NonNullable<AnalysisResult["recommendations"]>;

export function RecoAdvice({ rec }: { rec: Reco }) {
  const { t, lang } = useI18n();
  return (
    <div className="stack">
      <p className="prose">{rec.advice[lang]}</p>
      {rec.disciplines.length > 0 && (
        <div>
          <span className="lbl">{t("reco_fields")}</span>
          <div className="tags static">{rec.disciplines.map((d) => (
            <a key={d.slug} className="tag link-tag" href={d.url} target="_blank" rel="noopener noreferrer">{d.name[lang]} <Icon name="external" size={12} /></a>
          ))}</div>
        </div>
      )}
      {rec.keywords.length > 0 && (
        <div><span className="lbl">{t("reco_keywords")}</span>
          <div className="tags static">{rec.keywords.map((k) => <span key={k} className="tag">{k}</span>)}</div></div>
      )}
      {rec.queries.length > 0 && (
        <div><span className="lbl">{t("reco_queries")}</span>
          <div>{rec.queries.map((q) => (
            <a key={q} className="q" target="_blank" rel="noopener noreferrer" href={`https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`}>{q}</a>
          ))}</div></div>
      )}
    </div>
  );
}

export function RecoWorks({ rec }: { rec: Reco }) {
  const { t } = useI18n();
  if (rec.works.length === 0) return <p className="muted">{t("reco_none")}</p>;
  return (
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
  );
}

export function RecoJournals({ rec }: { rec: Reco }) {
  const { t, lang } = useI18n();
  const why = (w: string) => (w === "venue" ? t("why_venue") : w === "keyword" ? t("why_keyword") : t("why_field"));
  return (
    <div className="stack">
      {rec.journals.length === 0 ? <p className="muted">{t("reco_none")}</p> : (
        <div className="table-wrap">
          <table className="tbl jtbl">
            <thead><tr><th>{t("journal")}</th><th>ISSN</th><th>{t("rank")}</th><th>{t("note")}</th></tr></thead>
            <tbody>
              {rec.journals.map((j) => (
                <tr key={j.title}>
                  <td><a href={j.url} target="_blank" rel="noopener noreferrer"><b>{j.title}</b></a>
                    <div className="muted small">{j.publisher}</div>
                    <div className="muted small">{j.discipline[lang]}</div></td>
                  <td className="mono small">{j.issn.join(", ")}</td>
                  <td>{j.domestic ? <span className="badge">{t("hdgs_max", { n: j.maxScore ?? 0 })}</span> : <span className={`badge q ${j.quartile}`}>{j.quartile || "—"}</span>}</td>
                  <td className="small">{why(j.why)}{j.openAccess && <span className="badge oa">OA</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row wrap">
        {rec.disciplines.map((d) => (
          <a key={d.slug} className="btn sm" href={d.url} target="_blank" rel="noopener noreferrer"><Icon name="cap" size={15} /> {t("open_field", { name: d.name[lang] })}</a>
        ))}
        <a className="btn sm" href={rec.edufind.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} /> {t("open_edufind")}</a>
      </div>
    </div>
  );
}

/** Thẻ lựa chọn lớn ở cuối bước đánh giá: người dùng chọn hướng đi sau khi đã đọc xong mọi nhận xét. */
export function Choice({ icon, title, desc, onClick, tone = "plain", disabled, badge }: {
  icon: IconName; title: string; desc: ReactNode; onClick: () => void; tone?: "primary" | "plain" | "caution"; disabled?: boolean; badge?: string;
}) {
  return (
    <button className={`choice ${tone}`} onClick={onClick} disabled={disabled}>
      <span className="choice-ico"><Icon name={icon} size={22} /></span>
      <span className="choice-body"><b>{title}{badge && <em>{badge}</em>}</b><small>{desc}</small></span>
      <Icon name="right" size={18} className="choice-go" />
    </button>
  );
}
