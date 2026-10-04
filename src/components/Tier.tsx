// Hạng tài khoản (Cơ bản / Đã xác thực): khung mời xác thực, liên hệ tác giả. Lời nhắc nêu lợi ích của người dùng, không chèo kéo:
// có nút "Để sau", mỗi ngày tối đa một lần cho khung thông báo chung, không bật cửa sổ che màn hình.
import { useState, type ReactNode } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { APP } from "../lib/config.ts";
import { Icon } from "./Icon.tsx";

/** YYYY-MM-DD → DD/MM/YYYY */
export const fmtDay = (d: string) => d.split("-").reverse().join("/");

export function ContactLinks({ verify = true }: { verify?: boolean }) {
  const { t } = useI18n();
  const { contact, profile } = useApp();
  const has = contact && (contact.email || contact.phone || contact.zalo);
  if (!has) return <p className="muted">{t("contact_missing")}</p>;
  const subject = encodeURIComponent(`[${APP.name.vi}] ${t(verify ? "contact_verify_subject" : "contact_subject")}`);
  const body = encodeURIComponent(`${t(verify ? "contact_verify_body" : "contact_body")}\n\nEmail: ${profile?.email ?? ""}\n${profile?.full_name ?? ""}\n${profile?.affiliation ?? ""}\nORCID: ${profile?.orcid ?? ""}`);
  const zaloNum = (contact.zalo || contact.phone || "").replace(/\D/g, "");
  return (
    <div className="contact-row">
      {contact.email && <a className="btn" href={`mailto:${contact.email}?subject=${subject}&body=${body}`}><Icon name="mail" size={16} /> {contact.email}</a>}
      {contact.phone && <a className="btn" href={`tel:${contact.phone}`}><Icon name="phone" size={16} /> {contact.phone}</a>}
      {zaloNum && <a className="btn" href={`https://zalo.me/${zaloNum}`} target="_blank" rel="noopener noreferrer">Zalo {contact.zalo || contact.phone}</a>}
    </div>
  );
}

export function Benefits() {
  const { t } = useI18n();
  return (
    <div>
      <span className="lbl">{t("nudge_benefits_h")}</span>
      <ul className="mini-list">{(["nudge_b1", "nudge_b2", "nudge_b3", "nudge_b4"] as const).map((k) => <li key={k}><Icon name="checkCircle" size={14} /> {t(k)}</li>)}</ul>
    </div>
  );
}

/** Khung mời xác thực dùng chung: tiêu đề, nội dung, quyền lợi (tuỳ chọn) và cách liên hệ. */
export function VerifyCard({ title, body, benefits = false, onLater, children }: { title: string; body: string; benefits?: boolean; onLater?: () => void; children?: ReactNode }) {
  const { t, lang } = useI18n();
  const { contact } = useApp();
  const note = lang === "vi" ? contact?.note_vi : contact?.note_en;
  return (
    <div className="card contact">
      <div className="between"><h3>{title}</h3>{onLater && <button className="btn sm" onClick={onLater}>{t("announce_later")}</button>}</div>
      <p className="muted">{body}</p>
      {children}
      {benefits && <Benefits />}
      {note && <p>{note}</p>}
      <p className="muted small">{t("verify_how")}</p>
      <ContactLinks />
      <p className="muted small">{t("nudge_reassure")}</p>
    </div>
  );
}

function useDailyDismiss(key: string): [boolean, () => void] {
  const today = new Date().toISOString().slice(0, 10);
  const k = `tl-nudge-${key}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(k) === today; } catch { return false; } });
  return [hidden, () => { setHidden(true); try { localStorage.setItem(k, today); } catch { /* bỏ qua */ } }];
}

/** Báo trước ngày áp dụng hạng cho tài khoản Cơ bản (chỉ trước ngày áp dụng; ẩn đến hết ngày khi bấm "Để sau"). */
export function TierAnnounce() {
  const { t } = useI18n();
  const { quota } = useApp();
  const [hidden, dismiss] = useDailyDismiss("announce");
  if (!quota || quota.tier !== "basic" || quota.gated || hidden) return null;
  return <VerifyCard title={t("announce_title", { date: fmtDay(quota.tier_start) })} body={t("announce_body", { n: quota.basic_weekly })} benefits onLater={dismiss} />;
}

/** Thẻ hạng ở trang Hồ sơ (cố định, không bật lên). */
export function TierCard() {
  const { t } = useI18n();
  const { quota } = useApp();
  if (!quota || quota.tier === "admin") return null;
  if (quota.tier === "verified") return <div className="card"><h3><Icon name="checkCircle" size={16} /> {t("tier_verified")}</h3><p className="muted">{t("tier_verified_d")}</p></div>;
  return (
    <VerifyCard title={t("tier_basic")} body={t("tier_basic_d", { n: quota.basic_weekly })} benefits />
  );
}

/** Gợi ý tài liệu bị khoá ở hạng Cơ bản: cho biết số lượng, chi tiết mở khi xác thực. */
export function LockedReco({ works, journals }: { works: number; journals: number }) {
  const { t } = useI18n();
  return <VerifyCard title={t("teaser_title", { w: works, j: journals })} body={t("teaser_body")} />;
}
