import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase, type Contact } from "../lib/supabase.ts";
import { visit, type VisitStats } from "../lib/api.ts";

interface UserRow { id: string; email: string; full_name: string; affiliation: string; orcid: string; role: string; status: string; bonus_credits: number; lifetime_used: number; used_today: number; created_at: string; last_seen: string | null; total_count: number }
interface Stats { users: number; new_7d: number; analyses_today: number; analyses_7d: number; analyses_total: number; citations_total: number; bonus_outstanding: number; exhausted_today: number }

const PAGE = 25;

export default function Admin() {
  const { t } = useI18n();
  const { toast, contact, profile, refresh } = useApp();
  const [tab, setTab] = useState<"users" | "settings" | "stats">("users");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [off, setOff] = useState(0);
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [vs, setVs] = useState<VisitStats | null>(null);
  const [limit, setLimit] = useState("2");
  const [c, setC] = useState<Contact>({ email: "", phone: "", zalo: "", note_vi: "", note_en: "" });

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_users", { p_search: q.trim(), p_limit: PAGE, p_offset: off });
    if (error) { toast(error.message, "err"); return; }
    const r = (data ?? []) as UserRow[];
    setRows(r); setTotal(r[0]?.total_count ?? 0);
  }, [q, off, toast]);

  useEffect(() => { const id = setTimeout(() => void loadUsers(), 250); return () => clearTimeout(id); }, [loadUsers]);
  useEffect(() => {
    if (tab === "stats") {
      void supabase.rpc("admin_stats").then(({ data }) => setStats(data as Stats));
      void visit().then(setVs);
    }
    if (tab === "settings") {
      void supabase.from("app_settings").select("key,value").then(({ data }) => {
        const l = data?.find((x) => x.key === "free_daily_limit")?.value; if (l != null) setLimit(String(l));
        const ct = data?.find((x) => x.key === "contact")?.value as Contact | undefined; if (ct) setC({ ...c, ...ct });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(() => { if (contact) setC((x) => ({ ...x, ...contact })); }, [contact]);

  if (profile?.role !== "admin") return <div className="card err">{t("forbidden")}</div>;

  async function grant(u: UserRow, sign: 1 | -1) {
    const n = Math.abs(parseInt(amount[u.id] ?? "10", 10) || 0) * sign;
    if (!n) return;
    const { data, error } = await supabase.rpc("admin_grant_credits", { p_user: u.id, p_amount: n, p_note: "" });
    if (error) toast(error.message, "err"); else { toast(t("granted", { n, email: u.email })); setRows((r) => r.map((x) => (x.id === u.id ? { ...x, bonus_credits: data as number } : x))); }
  }
  async function setUser(u: UserRow, role?: string, status?: string) {
    const { error } = await supabase.rpc("admin_set_user", { p_user: u.id, p_role: role ?? null, p_status: status ?? null });
    if (error) toast(error.message, "err"); else { toast(t("saved")); void loadUsers(); void refresh(); }
  }
  async function saveSettings() {
    const n = Math.max(0, Math.min(100, parseInt(limit, 10) || 0));
    const a = await supabase.rpc("admin_set_setting", { p_key: "free_daily_limit", p_value: n });
    const b = await supabase.rpc("admin_set_setting", { p_key: "contact", p_value: c });
    if (a.error || b.error) toast((a.error ?? b.error)!.message, "err"); else { toast(t("saved")); void refresh(); }
  }

  return (
    <div className="page">
      <h2>{t("admin_title")}</h2>
      <div className="seg wide" role="tablist">
        {(["users", "settings", "stats"] as const).map((x) => <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? "on" : ""} onClick={() => setTab(x)}>{t(`adm_${x}` as "adm_users")}</button>)}
      </div>

      {tab === "users" && (
        <div className="card">
          <div className="row wrap"><input className="grow" placeholder={t("adm_search")} value={q} onChange={(e) => { setQ(e.target.value); setOff(0); }} />
            <span className="muted small">{t("adm_total", { n: total })}</span></div>
          <div className="table-wrap">
            <table className="tbl users">
              <thead><tr><th>{t("adm_user")}</th><th>{t("adm_today")}</th><th>{t("adm_bonus")}</th><th>{t("adm_life")}</th><th>{t("adm_grant")}</th><th>{t("adm_role")}</th></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className={u.status === "suspended" ? "dim" : ""}>
                    <td><b>{u.full_name || "—"}</b><div className="muted small">{u.email}</div><div className="muted small">{u.affiliation}{u.orcid ? ` · ${u.orcid}` : ""}</div>
                      <div className="muted small">{new Date(u.created_at).toLocaleDateString()}{u.last_seen ? ` → ${new Date(u.last_seen).toLocaleDateString()}` : ""}</div></td>
                    <td>{u.role === "admin" ? "∞" : u.used_today}</td>
                    <td><b>{u.bonus_credits}</b></td>
                    <td>{u.lifetime_used}</td>
                    <td>
                      <div className="row nowrap">
                        <input className="mini" inputMode="numeric" value={amount[u.id] ?? "10"} onChange={(e) => setAmount({ ...amount, [u.id]: e.target.value })} aria-label={t("adm_grant")} />
                        <button className="btn sm primary" onClick={() => grant(u, 1)}>+</button>
                        <button className="btn sm" onClick={() => grant(u, -1)}>−</button>
                      </div>
                    </td>
                    <td>
                      <div className="row wrap">
                        <button className="btn sm" onClick={() => setUser(u, u.role === "admin" ? "user" : "admin")} disabled={u.id === profile.id}>{u.role === "admin" ? t("adm_revoke_admin") : t("adm_make_admin")}</button>
                        <button className={`btn sm ${u.status === "suspended" ? "primary" : ""}`} onClick={() => setUser(u, undefined, u.status === "suspended" ? "active" : "suspended")} disabled={u.id === profile.id}>{u.status === "suspended" ? t("adm_unsuspend") : t("adm_suspend")}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="between"><button className="btn sm" disabled={off === 0} onClick={() => setOff(Math.max(0, off - PAGE))}>←</button>
            <span className="muted small">{Math.floor(off / PAGE) + 1} / {Math.max(1, Math.ceil(total / PAGE))}</span>
            <button className="btn sm" disabled={off + PAGE >= total} onClick={() => setOff(off + PAGE)}>→</button></div>
        </div>
      )}

      {tab === "settings" && (
        <div className="card form-grid">
          <h3 className="wide">{t("adm_quota_h")}</h3>
          <label>{t("adm_free_limit")}<input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
          <p className="muted small wide">{t("adm_free_hint")}</p>
          <h3 className="wide">{t("adm_contact_h")}</h3>
          <label>Email<input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></label>
          <label>{t("phone")}<input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></label>
          <label>Zalo<input value={c.zalo} onChange={(e) => setC({ ...c, zalo: e.target.value })} placeholder={t("zalo_ph")} /></label>
          <label className="wide">{t("adm_note_vi")}<textarea rows={2} value={c.note_vi} onChange={(e) => setC({ ...c, note_vi: e.target.value })} /></label>
          <label className="wide">{t("adm_note_en")}<textarea rows={2} value={c.note_en} onChange={(e) => setC({ ...c, note_en: e.target.value })} /></label>
          <div className="wide actions"><button className="btn primary" onClick={saveSettings}>{t("save")}</button></div>
        </div>
      )}

      {tab === "stats" && (
        <div className="stack gap">
          <div className="stats">
            {stats && ([["users", stats.users], ["new_7d", stats.new_7d], ["analyses_today", stats.analyses_today], ["analyses_7d", stats.analyses_7d], ["analyses_total", stats.analyses_total], ["citations_total", stats.citations_total], ["bonus_outstanding", stats.bonus_outstanding], ["exhausted_today", stats.exhausted_today]] as const).map(([k, v]) => (
              <div key={k} className="stat"><b>{v}</b><span>{t(`st_${k}` as "st_users")}</span></div>
            ))}
            {vs?.enabled && <><div className="stat"><b>{vs.total}</b><span>{t("visits_total")}</span></div><div className="stat"><b>{vs.today}</b><span>{t("visits_today")}</span></div></>}
          </div>
          {vs?.enabled && vs.countries && vs.countries.length > 0 && <div className="card"><h4>{t("visits_countries")}</h4><p>{vs.countries.map((x) => `${x.c}: ${x.n}`).join(" · ")}</p></div>}
          {vs && !vs.enabled && <p className="muted small">{t("visits_off")}</p>}
        </div>
      )}
    </div>
  );
}
