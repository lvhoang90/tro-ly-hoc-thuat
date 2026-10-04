import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { fmtDay } from "./Tier.tsx";

export function remaining(q: { unlimited: boolean; free_left: number; bonus: number } | null): number {
  if (!q) return 0;
  return q.unlimited ? Infinity : q.free_left + q.bonus;
}

export function QuotaBar() {
  const { t } = useI18n();
  const { quota } = useApp();
  if (!quota) return null;
  if (quota.unlimited) return <div className="quota ok"><b>∞</b> {t("quota_unlimited")}</div>;
  const left = quota.free_left + quota.bonus;
  const dots = Array.from({ length: quota.free_limit }, (_, i) => i < quota.free_left);
  return (
    <div className={`quota ${left > 0 ? "ok" : "out"}`}>
      <span className="dots" aria-hidden="true">{dots.map((on, i) => <i key={i} className={on ? "on" : ""} />)}</span>
      <span>{t(quota.period === "week" ? "quota_free_week" : "quota_free", { left: quota.free_left, total: quota.free_limit })}</span>
      {quota.bonus > 0 && <span className="badge">{t("quota_bonus", { n: quota.bonus })}</span>}
      {quota.period === "week" && quota.free_left === 0 && <span className="muted small">{t("quota_reset_week", { date: fmtDay(quota.next_reset) })}</span>}
    </div>
  );
}
