import { useMemo } from "react";
import { Panel } from "./Panel.tsx";
import { Icon } from "./Icon.tsx";
import { useI18n } from "../i18n.tsx";
import { useProfindIndex } from "../lib/profind.ts";
import { track } from "../lib/isa.ts";
import { matchAuthors, profindAuthorUrl } from "../../shared/profind.ts";
import type { SourceMeta } from "../../shared/types.ts";

const nf = new Intl.NumberFormat("vi-VN");

/** Tác giả của tài liệu trên ProFind: so khớp họ tên ngay trên máy bạn với chỉ mục công khai của ProFind. */
export function AuthorsPanel({ n, authors, open, onToggle }: { n?: string; authors: SourceMeta["authors"]; open: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const st = useProfindIndex();
  const matches = useMemo(() => (st.status === "ready" ? matchAuthors(st.idx, authors.slice(0, 12)) : []), [st, authors]);
  const found = matches.filter((m) => m.hits.length > 0);
  const preview = st.status === "loading" ? t("pf_loading") : st.status === "error" ? "" : found.length ? t("pf_found_n", { n: found.length, total: matches.length }) : t("pf_none_short");

  return (
    <Panel n={n} title={t("pf_title")} icon="user" accent="blue" open={open} onToggle={onToggle} preview={preview}
      badge={st.status === "ready" ? <span className="badge">{found.length}/{matches.length}</span> : undefined}>
      {st.status === "loading" && <p className="muted">{t("pf_loading")}</p>}
      {st.status === "error" && <p className="muted">{t("pf_error")}</p>}
      {st.status === "ready" && (
        <div className="stack">
          <p className="muted small">{t("pf_note")}</p>
          {found.length === 0 && <p className="muted">{t("pf_none")}</p>}
          {found.map((m) => (
            <div key={`${m.family}|${m.given}`} className="pf-author">
              <b>{[m.given, m.family].filter(Boolean).join(" ")}</b>
              <ul className="works">
                {m.hits.map((h) => (
                  <li key={h.id}>
                    <a href={profindAuthorUrl(h.id)} target="_blank" rel="noopener noreferrer" onClick={() => track("ami_sang_profind", "author")}>
                      <b>{h.name}</b> {h.top2 && <span className="badge oa">Top 2%</span>} <Icon name="external" size={12} />
                    </a>
                    <div className="muted small">{h.units.slice(0, 2).join(" · ")}</div>
                    <div className="small">{t("pf_stats", { w: nf.format(h.works), c: nf.format(h.cites) })}{h.last > 0 ? ` · ${t("pf_last", { y: h.last })}` : ""}</div>
                  </li>
                ))}
              </ul>
              {m.total > m.hits.length && <p className="muted small">{t("pf_more", { n: m.total - m.hits.length })}</p>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
