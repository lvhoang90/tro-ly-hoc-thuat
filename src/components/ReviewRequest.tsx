import { useEffect, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";

export interface ReviewRequestRow { id: number; reason: string; evidence: string; status: "pending" | "approved" | "rejected"; admin_note: string; granted: number | null; created_at: string; decided_at: string | null }

/** Đề nghị cấp hạn mức dùng Giáo sư phản biện: người dùng đã xác thực nêu lý do và minh chứng khoa học; quản trị viên duyệt. */
export default function ReviewRequest() {
  const { t, lang } = useI18n();
  const { toast } = useApp();
  const [req, setReq] = useState<ReviewRequestRow | null | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => { void supabase.rpc("my_review_request").then(({ data }) => setReq((data as ReviewRequestRow | null) ?? null)); };
  useEffect(load, []);

  const okLen = reason.trim().length >= 40 && evidence.trim().length >= 20;
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("submit_review_request", { p_reason: reason.trim(), p_evidence: evidence.trim() });
    setBusy(false);
    if (error) { toast(/already_pending/.test(error.message) ? t("rq_pending_already") : error.message, "err"); load(); return; }
    toast(t("rq_sent")); setReason(""); setEvidence(""); load();
  };
  if (req === undefined) return <div className="center"><div className="spinner" /></div>;
  const date = (s: string) => new Date(s).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-GB");

  if (req?.status === "pending") return (
    <div className="card stack" role="status"><h3>{t("rq_pending_h")}</h3><p>{t("rq_pending_b", { date: date(req.created_at) })}</p></div>
  );
  return (
    <div className="card stack">
      <h3>{t("rq_h")}</h3>
      <p className="muted">{t("rq_b")}</p>
      {req?.status === "rejected" && <div className="box warnbox"><b>{t("rq_rejected", { date: req.decided_at ? date(req.decided_at) : "" })}</b>{req.admin_note && <p>{req.admin_note}</p>}<p className="muted small">{t("rq_again")}</p></div>}
      <label>{t("rq_reason")}<textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={3000} placeholder={t("rq_reason_ph")} /></label>
      <label>{t("rq_evidence")}<textarea rows={4} value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={3000} placeholder={t("rq_evidence_ph")} /></label>
      <div className="between"><span className={okLen ? "muted small" : "warn small"}>{t("rq_min")}</span>
        <button className="btn primary" disabled={!okLen || busy} onClick={() => void submit()}>{busy ? "…" : t("rq_send")}</button></div>
    </div>
  );
}
