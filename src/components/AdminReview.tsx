import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";

interface Row {
  id: number; user_id: string; email: string; full_name: string; affiliation: string; orcid: string; lifetime_used: number;
  reason: string; evidence: string; status: "pending" | "approved" | "rejected"; admin_note: string; granted: number | null;
  created_at: string; decided_at: string | null; review_limit: number | null;
}

/** Xét duyệt đề nghị dùng Giáo sư phản biện: xem lý do và minh chứng, cấp số lượt mỗi tuần hoặc từ chối; thu hồi khi cần. */
export default function AdminReview() {
  const { t, lang } = useI18n();
  const { toast } = useApp();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [limit, setLimit] = useState<Record<number, string>>({});
  const [note, setNote] = useState<Record<number, string>>({});
  const load = useCallback(() => {
    void supabase.rpc("admin_list_review_requests", { p_status: status, p_limit: 100 }).then(({ data, error }) => { if (error) toast(error.message, "err"); else setRows((data as Row[]) ?? []); });
  }, [status, toast]);
  useEffect(load, [load]);

  const decide = async (r: Row, approve: boolean) => {
    const { error } = await supabase.rpc("admin_decide_review", { p_id: r.id, p_approve: approve, p_limit: Math.max(1, Math.min(50, parseInt(limit[r.id] ?? "2", 10) || 2)), p_note: note[r.id] ?? "" });
    if (error) toast(error.message, "err"); else { toast(t("adm_rq_done")); load(); }
  };
  const revoke = async (r: Row) => {
    const { error } = await supabase.rpc("admin_set_review_limit", { p_user: r.user_id, p_limit: 0 });
    if (error) toast(error.message, "err"); else { toast(t("adm_rq_done")); load(); }
  };
  const fmt = (s: string) => new Date(s).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB");

  return (
    <div className="card stack">
      <div className="chips" role="tablist">
        {(["pending", "approved", "rejected"] as const).map((x) => <button key={x} role="tab" aria-selected={status === x} className={status === x ? "on" : ""} onClick={() => setStatus(x)}>{t(`adm_rq_filter_${x}` as "adm_rq_filter_pending")}</button>)}
      </div>
      {rows.length === 0 && <p className="muted">{t("adm_rq_empty")}</p>}
      {rows.map((r) => (
        <div key={r.id} className="rq-item">
          <div className="between"><b>{r.full_name || r.email}</b><span className="muted small">{fmt(r.created_at)}</span></div>
          <div className="muted small">{[r.email, r.affiliation, r.orcid].filter(Boolean).join(" · ")} · {t("adm_rq_stats", { n: r.lifetime_used })}</div>
          <div><b>{t("adm_rq_reason")}</b><pre>{r.reason}</pre></div>
          <div><b>{t("adm_rq_evidence")}</b><pre>{r.evidence}</pre></div>
          {r.status === "pending" ? (
            <div className="row wrap">
              <label className="inline">{t("adm_rq_limit")} <input className="mini" inputMode="numeric" value={limit[r.id] ?? "2"} onChange={(e) => setLimit({ ...limit, [r.id]: e.target.value })} /></label>
              <input className="grow" placeholder={t("adm_rq_note")} value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} maxLength={1000} />
              <button className="btn primary sm" onClick={() => void decide(r, true)}>{t("adm_rq_approve")}</button>
              <button className="btn sm" onClick={() => void decide(r, false)}>{t("adm_rq_reject")}</button>
            </div>
          ) : (
            <div className="row wrap">
              {r.admin_note && <span className="muted small">{r.admin_note}</span>}
              {r.status === "approved" && <><span className="badge ok-badge">{t("adm_rq_granted", { n: r.review_limit ?? r.granted ?? 0 })}</span>{(r.review_limit ?? 0) > 0 && <button className="btn sm" onClick={() => void revoke(r)}>{t("adm_rq_revoke")}</button>}</>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
