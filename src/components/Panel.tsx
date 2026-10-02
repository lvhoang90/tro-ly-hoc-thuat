import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon.tsx";
import { useI18n } from "../i18n.tsx";

export type Accent = "blue" | "teal" | "amber" | "emerald" | "violet" | "gold";

/** Khung nội dung có thể thu gọn: tiêu đề phân đoạn đánh số, màu nhấn riêng, dòng xem trước khi đã thu gọn. */
export function Panel({ n, title, icon, accent, open, onToggle, preview, badge, children }: {
  n?: string; title: string; icon: IconName; accent: Accent; open: boolean; onToggle: () => void;
  preview?: string; badge?: ReactNode; children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className={`panel ${accent} ${open ? "open" : ""}`}>
      <button className="panel-head" onClick={onToggle} aria-expanded={open}>
        <span className="panel-ico"><Icon name={icon} size={18} /></span>
        <span className="panel-title">
          {n && <small>{n}</small>}
          <b>{title}</b>
          {!open && preview && <em>{preview}</em>}
        </span>
        {badge}
        <span className="panel-toggle"><span className="lbl">{open ? t("collapse") : t("expand")}</span><Icon name="chevron" size={16} className="chev" /></span>
      </button>
      {open && <div className="panel-body">{children}</div>}
    </section>
  );
}
