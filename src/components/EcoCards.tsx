// Hệ sinh thái ISA trong Ami: hành trình bốn ứng dụng, hồ sơ ProFind của bạn (ISA Connect) và mời đồng nghiệp.
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { APP, goApp } from "../lib/config.ts";
import { call } from "../lib/api.ts";
import { useProfindIndex } from "../lib/profind.ts";
import { track } from "../lib/isa.ts";
import { inviteUrl } from "../lib/ref.ts";
import { supabase } from "../lib/supabase.ts";
import { Icon } from "./Icon.tsx";
import { mainPick, pct, profindAuthorUrl, suggest } from "../../shared/profind.ts";

interface Status { enabled: boolean; hasPhone: boolean; registered?: boolean | null; verified?: boolean; authorId?: string; pending?: boolean }
const nf = new Intl.NumberFormat("vi-VN");

/** Trạng thái hồ sơ ProFind của người dùng (hỏi máy chủ Ami, máy chủ hỏi ProFind). Lỗi mạng thì coi như chưa biết. */
export function useProfindStatus(): Status | null {
  const { session } = useApp();
  const [st, setSt] = useState<Status | null>(null);
  useEffect(() => {
    if (!session) return;
    let live = true;
    call<Status>("/api/eco", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "status" }) })
      .then((r) => live && setSt(r), () => live && setSt(null));
    return () => { live = false; };
  }, [session]);
  return st;
}

/** Hành trình trên hệ sinh thái ISA: chọn tạp chí → hồ sơ nhà khoa học → đọc và trích dẫn → chuẩn hóa thể thức. */
export function IsaJourney({ status }: { status: Status | null }) {
  const { t } = useI18n();
  const { quota } = useApp();
  const used = (quota?.lifetime_used ?? 0) > 0;
  const pf = status?.verified ? ["ok", t("jr_pf_verified")] : status?.pending ? ["mid", t("jr_pf_pending")] : status?.registered ? ["mid", t("jr_pf_registered")] : ["", t("jr_pf_none")];
  const steps: { key: string; icon: "cap" | "user" | "book" | "file"; title: string; sub: string; href?: string; chip: [string, string] }[] = [
    { key: "edufind", icon: "cap", title: "EduFind", sub: t("jr_edufind"), href: APP.author.edufind, chip: ["", t("jr_open")] },
    { key: "profind", icon: "user", title: "ProFind", sub: t("jr_profind"), href: APP.author.profind, chip: pf as [string, string] },
    { key: "ami", icon: "book", title: "Ami", sub: t("jr_ami"), chip: used ? ["ok", t("jr_ami_used")] : ["now", t("jr_here")] },
    { key: "may", icon: "file", title: t("foot_vanthu"), sub: t("jr_may"), href: APP.author.vanthu, chip: ["", t("jr_open")] },
  ];
  return (
    <div className="card">
      <h3>{t("jr_title")}</h3>
      <p className="muted small">{t("jr_d")}</p>
      <ol className="isa-journey">
        {steps.map((s, i) => {
          const body = (
            <>
              <span className="jr-ico"><Icon name={s.icon} size={20} /></span>
              <b>{s.title}</b><small>{s.sub}</small>
              <span className={`jr-chip ${s.chip[0]}`}>{s.chip[1]}</span>
            </>
          );
          return (
            <li key={s.key} className={s.key === "ami" ? "here" : ""} data-n={i + 1}>
              {s.href ? <a href={s.href} target="_blank" rel="noopener noreferrer" onClick={() => track("ami_sang_ung_dung", s.key)}>{body}</a> : <div>{body}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Hồ sơ nhà khoa học của bạn trên ProFind: gợi ý ngay trên máy, bấm "Đúng là tôi" để sang ProFind không cần nhập mã lại. */
export function ProfindCard({ status }: { status: Status | null }) {
  const { t } = useI18n();
  const { profile, toast } = useApp();
  const idxState = useProfindIndex(!!profile && !status?.verified);
  const [busy, setBusy] = useState("");
  const [needPhone, setNeedPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem("ami.pf.hide") ?? "[]")); } catch { return new Set(); } });

  const cands = useMemo(() => {
    if (!profile || idxState.status !== "ready" || !profile.full_name.trim()) return [];
    return suggest(idxState.idx, { name: profile.full_name, email: profile.email, org: profile.affiliation }, profile.orcid).filter((c) => !hidden.has(c.id)).slice(0, 3);
  }, [profile, idxState, hidden]);
  const main = mainPick(cands);
  if (!profile) return null;

  const hide = (id: string) => { const n = new Set(hidden).add(id); setHidden(n); try { localStorage.setItem("ami.pf.hide", JSON.stringify([...n])); } catch { /* bỏ qua */ } };

  async function connect(authorId: string | undefined, label: string) {
    setBusy(label);
    const w = window.open("", "_blank"); // mở thẻ ngay khi bấm để trình duyệt không chặn cửa sổ bật lên
    try {
      const r = await call<{ url: string }>("/api/eco", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "connect", authorId, phone: phone || undefined, lang: document.documentElement.lang === "en" ? "en" : "vi" }) });
      track("ami_ket_noi_profind", label);
      if (w) { w.opener = null; w.location.href = r.url; } else location.href = r.url;
      setNeedPhone(false);
    } catch (e) {
      w?.close();
      const code = (e as { info?: { error?: string } }).info?.error;
      if (code === "need_phone") setNeedPhone(true); else toast(t("pf_connect_err"), "err");
    } finally { setBusy(""); }
  }

  if (status?.verified)
    return (
      <div className="card contact">
        <h3><Icon name="checkCircle" size={16} /> {t("pf_me_verified")}</h3>
        <p className="muted">{t("pf_me_verified_d")}</p>
        <a className="btn" href={profindAuthorUrl(status.authorId || "")} target="_blank" rel="noopener noreferrer" onClick={() => track("ami_sang_profind", "me")}>{t("pf_open_mine")} <Icon name="external" size={14} /></a>
      </div>
    );

  return (
    <div className="card stack">
      <h3>{t("pf_me_title")}</h3>
      <p className="muted">{status?.pending ? t("pf_me_pending") : t("pf_me_d")}</p>
      {idxState.status === "loading" && <p className="muted small">{t("pf_loading")}</p>}
      {cands.map((c) => (
        <div key={c.id} className={`pf-cand ${c.id === main ? "main" : ""}`}>
          <div className="between">
            <b>{c.name} {c.top2 && <span className="badge oa">Top 2%</span>}</b>
            <span className="badge" title={t("pf_pct_hint")}>{t("pf_pct", { n: pct(c) })}</span>
          </div>
          <div className="muted small">{c.units.slice(0, 2).join(" · ")}</div>
          <div className="small">{t("pf_stats", { w: nf.format(c.works), c: nf.format(c.cites) })}</div>
          <p className="tags static">{c.why.map(([k, w]) => <span key={w} className={`tag ${k}`}>{t(`pf_why_${w}` as "pf_why_orcid")}</span>)}</p>
          <div className="row wrap">
            <button className="btn sm primary" disabled={!!busy} onClick={() => connect(c.id, "dung_la_toi")}>{busy === "dung_la_toi" ? "…" : t("pf_yes")}</button>
            <button className="btn sm" onClick={() => hide(c.id)}>{t("pf_no")}</button>
          </div>
        </div>
      ))}
      {needPhone && (
        <label>{t("pf_phone")}
          <input value={phone} inputMode="tel" placeholder="09xx xxx xxx" onChange={(e) => setPhone(e.target.value)} />
          <small className="muted">{t("pf_phone_d")}</small>
        </label>
      )}
      <div className="row wrap">
        <button className="btn" disabled={!!busy} onClick={() => connect(undefined, "tim")}>{busy === "tim" ? "…" : t("pf_search")}</button>
        {needPhone && <button className="btn primary" disabled={!!busy || !phone.trim()} onClick={() => connect(cands[0]?.id, "co_sdt")}>{t("pf_continue")}</button>}
      </div>
      <p className="muted small">{t("pf_transfer")}</p>
    </div>
  );
}

/** Mời đồng nghiệp bằng liên kết cá nhân; có thưởng lượt cho người mời khi bạn bè phân tích xong lần đầu (quản trị viên đặt mức thưởng). */
export function InviteCard() {
  const { t } = useI18n();
  const { profile, toast } = useApp();
  const [cfg, setCfg] = useState<{ bonus: number; cap: number }>({ bonus: 0, cap: 0 });
  useEffect(() => {
    void supabase.from("app_settings").select("key,value").in("key", ["referral_bonus", "referral_cap"]).then(({ data }) => {
      const g = (k: string) => Number(data?.find((x) => x.key === k)?.value ?? 0);
      setCfg({ bonus: g("referral_bonus"), cap: g("referral_cap") });
    });
  }, []);
  if (!profile?.ref_code) return null;
  const url = inviteUrl(APP.siteUrl, profile.ref_code);
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast(t("inv_copied")); track("ami_moi_dong_nghiep", "copy"); } catch { toast(url); } };
  const share = () => { track("ami_moi_dong_nghiep", "share"); void navigator.share?.({ title: APP.name.vi, text: t("inv_text"), url }).catch(() => undefined); };
  return (
    <div className="card stack">
      <h3>{t("inv_title")}</h3>
      <p className="muted">{cfg.bonus > 0 ? t("inv_d_bonus", { n: cfg.bonus, cap: cfg.cap }) : t("inv_d")}</p>
      <div className="row wrap">
        <input className="grow" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t("inv_title")} />
        <button className="btn primary" onClick={copy}>{t("inv_copy")}</button>
        {typeof navigator !== "undefined" && "share" in navigator && <button className="btn" onClick={share}>{t("share")}</button>}
      </div>
      <p className="muted small">{t("inv_privacy")}</p>
    </div>
  );
}
