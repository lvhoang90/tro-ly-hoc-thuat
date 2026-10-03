import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase, type Contact, type Profile } from "../lib/supabase.ts";
import { Icon } from "../components/Icon.tsx";
import AdminStats from "./AdminStats.tsx";
import { BudgetBanner } from "../components/BudgetCard.tsx";
import { useApiBudget } from "../lib/budget.ts";

interface UserRow { id: string; email: string; full_name: string; affiliation: string; orcid: string; role: string; status: string; approved: boolean; cost_usd: number; bonus_credits: number; lifetime_used: number; used_today: number; created_at: string; last_seen: string | null; total_count: number }

const PAGE = 25;
const usdFmt = (n: number) => (n < 1 ? `$${Number(n).toFixed(4)}` : `$${Number(n).toFixed(2)}`);

interface Grant { id: number; amount: number; note: string; created_at: string; admin_id: string | null }
interface Use { id: number; created_at: string; source: string; refunded: boolean }

/** Hồ sơ đầy đủ của một người dùng (mọi thông tin họ đã khai báo, trừ mật khẩu). Quản trị viên đọc được nhờ chính sách RLS. */
function UserDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [p, setP] = useState<Profile | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [uses, setUses] = useState<Use[]>([]);
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    void supabase.from("profiles").select("*").eq("id", id).maybeSingle().then(({ data }) => { setP(data as Profile); setLast((data as { last_seen?: string })?.last_seen ?? null); });
    void supabase.from("credit_grants").select("id,amount,note,created_at,admin_id").eq("user_id", id).order("created_at", { ascending: false }).limit(10).then(({ data }) => setGrants((data ?? []) as Grant[]));
    void supabase.from("usage_log").select("id,created_at,source,refunded").eq("user_id", id).order("created_at", { ascending: false }).limit(10).then(({ data }) => setUses((data ?? []) as Use[]));
  }, [id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  const dt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");
  const row = (label: string, v: React.ReactNode) => <><dt>{label}</dt><dd>{v || "—"}</dd></>;
  return (
    <div className="drawer-wrap" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t("adm_detail")} onClick={(e) => e.stopPropagation()}>
        <div className="between"><h3 className="serif"><Icon name="user" size={18} /> {t("adm_detail")}</h3><button className="icon-btn" onClick={onClose} aria-label={t("close")}><Icon name="x" size={16} /></button></div>
        {!p ? <p className="muted">…</p> : (
          <>
            <div className="id-card slim">
              <div className="avatar sm" aria-hidden="true">{(p.full_name || p.email).split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase()).join("") || "?"}</div>
              <div><h4>{[p.title, p.full_name].filter(Boolean).join(" ") || p.email}</h4>
                <div className="id-badges"><span className={`badge ${p.role === "admin" ? "admin" : ""}`}>{p.role === "admin" ? t("role_admin") : t("role_user")}</span>
                  <span className="badge">{p.status === "suspended" ? t("st_suspended") : t("st_active")}</span>
                  <span className={`badge ${p.approved || p.role === "admin" ? "ok-badge" : "warn-badge"}`}>{p.approved || p.role === "admin" ? t("approved") : t("pending")}</span></div></div>
            </div>
            <h5>{t("sec_identity")}</h5>
            <dl className="kv">
              {row("Email", <a href={`mailto:${p.email}`}>{p.email}</a>)}
              {row("ORCID iD", p.orcid && <a href={`https://orcid.org/${p.orcid}`} target="_blank" rel="noopener noreferrer">{p.orcid}</a>)}
              {row(t("country"), p.country)}
              {row(t("phone"), p.phone)}
            </dl>
            <h5>{t("sec_affil")}</h5>
            <dl className="kv">
              {row(t("affiliation"), p.affiliation)}{row(t("department"), p.department)}{row(t("position"), p.position)}
            </dl>
            <h5>{t("sec_research")}</h5>
            <dl className="kv">
              {row(t("fields"), p.research_fields.length ? <div className="tags static">{p.research_fields.map((x) => <span className="tag" key={x}>{x}</span>)}</div> : "")}
              {row(t("keywords"), p.keywords.length ? <div className="tags static">{p.keywords.map((x) => <span className="tag" key={x}>{x}</span>)}</div> : "")}
              {row(t("bio"), p.bio && <span className="prose">{p.bio}</span>)}
            </dl>
            <h5>{t("sec_links")}</h5>
            <dl className="kv">
              {row("Google Scholar", p.scholar_url && <a href={p.scholar_url} target="_blank" rel="noopener noreferrer">{p.scholar_url}</a>)}
              {row("Scopus Author ID", p.scopus_id)}
              {row(t("website"), p.website && <a href={p.website} target="_blank" rel="noopener noreferrer">{p.website}</a>)}
            </dl>
            <h5>{t("adm_account")}</h5>
            <dl className="kv">
              {row(t("adm_created"), dt(p.created_at))}{row(t("adm_last"), dt(last))}
              {row(t("adm_bonus"), String(p.bonus_credits))}{row(t("adm_life"), String(p.lifetime_used))}
            </dl>
            <h5>{t("adm_grants")}</h5>
            {grants.length === 0 ? <p className="muted small">{t("reco_none")}</p> : <ul className="mini-list">{grants.map((g) => <li key={g.id}><b>{g.amount > 0 ? "+" : ""}{g.amount}</b> <span className="muted small">{dt(g.created_at)}{g.note ? ` · ${g.note}` : ""}</span></li>)}</ul>}
            <h5>{t("adm_uses")}</h5>
            {uses.length === 0 ? <p className="muted small">{t("reco_none")}</p> : <ul className="mini-list">{uses.map((u) => <li key={u.id}><span className="muted small">{dt(u.created_at)}</span> · {u.source}{u.refunded ? ` · ${t("adm_refunded")}` : ""}</li>)}</ul>}
            <p className="muted small">{t("adm_privacy")}</p>
          </>
        )}
      </aside>
    </div>
  );
}

export default function Admin() {
  const { t } = useI18n();
  const { toast, contact, profile, refresh } = useApp();
  const [tab, setTab] = useState<"users" | "settings" | "stats">("users");
  const budget = useApiBudget();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [off, setOff] = useState(0);
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<string | null>(null);
  const [limit, setLimit] = useState("1");
  const [mbBasic, setMbBasic] = useState("2");
  const [mbApproved, setMbApproved] = useState("15");
  const [rate, setRate] = useState("25500");
  const [pending, setPending] = useState(false);
  const [c, setC] = useState<Contact>({ email: "", phone: "", zalo: "", note_vi: "", note_en: "" });

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_users", { p_search: q.trim(), p_limit: PAGE, p_offset: off, p_pending: pending });
    if (error) { toast(error.message, "err"); return; }
    const r = (data ?? []) as UserRow[];
    setRows(r); setTotal(r[0]?.total_count ?? 0);
  }, [q, off, pending, toast]);

  useEffect(() => { const id = setTimeout(() => void loadUsers(), 250); return () => clearTimeout(id); }, [loadUsers]);
  useEffect(() => {
    if (tab === "settings") {
      void supabase.from("app_settings").select("key,value").then(({ data }) => {
        const get = (k: string) => data?.find((x) => x.key === k)?.value;
        const l = get("free_daily_limit"); if (l != null) setLimit(String(l));
        if (get("file_limit_basic_mb") != null) setMbBasic(String(get("file_limit_basic_mb")));
        if (get("file_limit_approved_mb") != null) setMbApproved(String(get("file_limit_approved_mb")));
        if (get("usd_vnd") != null) setRate(String(get("usd_vnd")));
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
  async function setUser(u: UserRow, role?: string, status?: string, approved?: boolean) {
    const { error } = await supabase.rpc("admin_set_user", { p_user: u.id, p_role: role ?? null, p_status: status ?? null, p_approved: approved ?? null });
    if (error) toast(error.message, "err"); else { toast(t("saved")); void loadUsers(); void refresh(); }
  }
  async function saveSettings() {
    const n = Math.max(0, Math.min(100, parseInt(limit, 10) || 0));
    const a = await supabase.rpc("admin_set_setting", { p_key: "free_daily_limit", p_value: n });
    const b = await supabase.rpc("admin_set_setting", { p_key: "contact", p_value: c });
    const mb = (v: string, d: number) => Math.max(1, Math.min(100, parseInt(v, 10) || d));
    const e1 = await supabase.rpc("admin_set_setting", { p_key: "file_limit_basic_mb", p_value: mb(mbBasic, 2) });
    const e2 = await supabase.rpc("admin_set_setting", { p_key: "file_limit_approved_mb", p_value: Math.max(mb(mbApproved, 15), mb(mbBasic, 2)) });
    const e3 = await supabase.rpc("admin_set_setting", { p_key: "usd_vnd", p_value: Math.max(1, parseInt(rate, 10) || 25500) });
    const err = a.error ?? b.error ?? e1.error ?? e2.error ?? e3.error;
    if (err) toast(err.message, "err"); else { toast(t("saved")); void refresh(); }
  }

  return (
    <div className="page admin-wide">
      <h2>{t("admin_title")}</h2>
      <div className="seg wide" role="tablist">
        {(["users", "settings", "stats"] as const).map((x) => <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? "on" : ""} onClick={() => setTab(x)}>{t(`adm_${x}` as "adm_users")}</button>)}
      </div>

      {tab !== "stats" && <BudgetBanner b={budget} onOpen={() => setTab("stats")} />}

      {tab === "users" && (
        <div className="card">
          <div className="row wrap"><input className="grow" placeholder={t("adm_search")} value={q} onChange={(e) => { setQ(e.target.value); setOff(0); }} />
            <label className="inline check-inline"><input type="checkbox" checked={pending} onChange={(e) => { setPending(e.target.checked); setOff(0); }} /> {t("adm_only_pending")}</label>
            <span className="muted small">{t("adm_total", { n: total })}</span></div>
          <div className="table-wrap">
            <table className="tbl users">
              <thead><tr><th>{t("adm_user")}</th><th>{t("adm_status")}</th><th title={`${t("adm_today")} · ${t("adm_bonus")} · ${t("adm_life")}`}><div className="ustat"><span>{t("adm_c_today")}</span><span>{t("adm_c_bonus")}</span><span>{t("adm_c_life")}</span></div></th><th>{t("adm_grant")}</th><th>{t("adm_role")}</th></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className={u.status === "suspended" ? "dim" : ""}>
                    <td className="u-user"><div className="u-name"><button className="link strong" onClick={() => setDetail(u.id)} title={t("adm_detail")}>{u.full_name || u.email}</button>{u.full_name && <span className="muted small ell" title={u.email}>{u.email}</span>}</div>
                      <div className="muted small ell" title={[u.affiliation, u.orcid].filter(Boolean).join(" · ")}>{[u.affiliation, u.orcid].filter(Boolean).join(" · ")}{u.affiliation || u.orcid ? " · " : ""}{new Date(u.created_at).toLocaleDateString()}{u.last_seen ? ` – ${new Date(u.last_seen).toLocaleDateString()}` : ""}</div></td>
                    <td>
                      <div className="row nowrap">
                        <span className={`badge ${u.approved ? "ok-badge" : "warn-badge"}`}>{u.approved ? t("approved") : t("pending")}</span>
                        {u.role !== "admin" && <button className={`btn sm ${u.approved ? "" : "primary"}`} onClick={() => setUser(u, undefined, undefined, !u.approved)}>{u.approved ? t("adm_unapprove") : t("adm_approve")}</button>}
                        <span className="muted small">{usdFmt(u.cost_usd)}</span>
                      </div>
                    </td>
                    <td><div className="ustat"><span>{u.role === "admin" ? "∞" : u.used_today}</span><b>{u.bonus_credits}</b><span>{u.lifetime_used}</span></div></td>
                    <td>
                      <div className="row nowrap">
                        <input className="mini" inputMode="numeric" value={amount[u.id] ?? "10"} onChange={(e) => setAmount({ ...amount, [u.id]: e.target.value })} aria-label={t("adm_grant")} />
                        <button className="btn sm primary" onClick={() => grant(u, 1)}>+</button>
                        <button className="btn sm" onClick={() => grant(u, -1)}>−</button>
                      </div>
                    </td>
                    <td>
                      <div className="row nowrap">
                        <button className="btn sm" onClick={() => setUser(u, u.role === "admin" ? "user" : "admin")} disabled={u.id === profile.id}>{u.role === "admin" ? t("adm_revoke_admin") : t("adm_make_admin")}</button>
                        <button className={`btn sm ${u.status === "suspended" ? "primary" : ""}`} onClick={() => setUser(u, undefined, u.status === "suspended" ? "active" : "suspended")} disabled={u.id === profile.id}>{u.status === "suspended" ? t("adm_unsuspend") : t("adm_suspend")}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="between"><button className="btn sm" disabled={off === 0} onClick={() => setOff(Math.max(0, off - PAGE))}><Icon name="left" size={14} /></button>
            <span className="muted small">{Math.floor(off / PAGE) + 1} / {Math.max(1, Math.ceil(total / PAGE))}</span>
            <button className="btn sm" disabled={off + PAGE >= total} onClick={() => setOff(off + PAGE)}><Icon name="right" size={14} /></button></div>
        </div>
      )}

      {detail && <UserDetail id={detail} onClose={() => setDetail(null)} />}

      {tab === "settings" && (
        <div className="card form-grid">
          <h3 className="wide">{t("adm_quota_h")}</h3>
          <label>{t("adm_free_limit")}<input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
          <p className="muted small wide">{t("adm_free_hint")}</p>
          <h3 className="wide">{t("adm_files_h")}</h3>
          <label>{t("adm_mb_basic")}<input inputMode="numeric" value={mbBasic} onChange={(e) => setMbBasic(e.target.value)} /></label>
          <label>{t("adm_mb_approved")}<input inputMode="numeric" value={mbApproved} onChange={(e) => setMbApproved(e.target.value)} /></label>
          <p className="muted small wide">{t("adm_files_hint")}</p>
          <h3 className="wide">{t("adm_cost_h")}</h3>
          <label>{t("adm_rate")}<input inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
          <p className="muted small wide">{t("adm_rate_hint")}</p>
          <h3 className="wide">{t("adm_contact_h")}</h3>
          <label>Email<input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></label>
          <label>{t("phone")}<input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></label>
          <label>Zalo<input value={c.zalo} onChange={(e) => setC({ ...c, zalo: e.target.value })} placeholder={t("zalo_ph")} /></label>
          <label className="wide">{t("adm_note_vi")}<textarea rows={2} value={c.note_vi} onChange={(e) => setC({ ...c, note_vi: e.target.value })} /></label>
          <label className="wide">{t("adm_note_en")}<textarea rows={2} value={c.note_en} onChange={(e) => setC({ ...c, note_en: e.target.value })} /></label>
          <div className="wide actions"><button className="btn primary" onClick={saveSettings}>{t("save")}</button></div>
        </div>
      )}

      {tab === "stats" && <AdminStats budget={budget} />}
    </div>
  );
}
