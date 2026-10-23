import { useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { savesToCloud, setSavePref } from "../lib/results-store.ts";

/** Công tắc "Lưu kết quả vào tài khoản": bật thì kết quả (không phải tệp) được lưu để xem lại từ mọi máy. */
export default function CloudToggle() {
  const { t, lang } = useI18n();
  const { profile, refresh, toast } = useApp();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const on = savesToCloud(profile);
  const change = async (v: boolean) => {
    setBusy(true);
    const ok = await setSavePref(profile.id, v);
    if (ok) await refresh(); else toast(t("cloud_pref_fail"), "err");
    setBusy(false);
  };
  return (
    <label className="cloud-toggle">
      <input type="checkbox" checked={on} disabled={busy} onChange={(e) => void change(e.target.checked)} />
      <span><b>{t("cloud_save")}</b> <small className="muted">{t("cloud_save_d")} <a href={lang === "vi" ? "/quyen-rieng-tu" : "/en/privacy"} target="_blank" rel="noopener">{t("privacy_link")}</a></small></span>
    </label>
  );
}
