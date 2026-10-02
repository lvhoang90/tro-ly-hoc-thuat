import { useEffect, useState, type KeyboardEvent } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase, type Profile } from "../lib/supabase.ts";
import { importOrcid, normalizeOrcid, validOrcid } from "../lib/orcid.ts";
import { QuotaBar } from "../components/Quota.tsx";

const TITLES = ["", "CN.", "ThS.", "NCS.", "TS.", "PGS.TS.", "GS.TS.", "BS.", "Mr.", "Ms.", "Dr.", "Assoc. Prof.", "Prof."];
const COUNTRIES: [string, string, string][] = [
  ["VN", "Việt Nam", "Vietnam"], ["US", "Hoa Kỳ", "United States"], ["GB", "Vương quốc Anh", "United Kingdom"], ["AU", "Úc", "Australia"],
  ["CA", "Canada", "Canada"], ["SG", "Singapore", "Singapore"], ["JP", "Nhật Bản", "Japan"], ["KR", "Hàn Quốc", "South Korea"],
  ["FR", "Pháp", "France"], ["DE", "Đức", "Germany"], ["TH", "Thái Lan", "Thailand"], ["MY", "Malaysia", "Malaysia"], ["OTHER", "Khác", "Other"],
];
const SUGGEST = ["Khoa học giáo dục", "Quản lý giáo dục", "Công nghệ giáo dục", "Tâm lý học", "Khoa học xã hội", "Kinh tế", "Y học", "Kỹ thuật", "Công nghệ thông tin", "Khoa học tự nhiên"];

function Tags({ value, onChange, placeholder, suggest }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; suggest?: string[] }) {
  const [txt, setTxt] = useState("");
  const add = (s: string) => { const v = s.trim(); if (v && !value.includes(v) && value.length < 15) onChange([...value, v]); setTxt(""); };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(txt); }
    else if (e.key === "Backspace" && !txt && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div>
      <div className="tags">
        {value.map((v) => <span key={v} className="tag">{v}<button type="button" aria-label="remove" onClick={() => onChange(value.filter((x) => x !== v))}>×</button></span>)}
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={key} onBlur={() => add(txt)} placeholder={value.length ? "" : placeholder} />
      </div>
      {suggest && (
        <div className="suggest">{suggest.filter((s) => !value.includes(s)).slice(0, 6).map((s) => <button type="button" key={s} onClick={() => add(s)}>+ {s}</button>)}</div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { t, lang } = useI18n();
  const { profile, refresh, toast, quota } = useApp();
  const [f, setF] = useState<Profile | null>(profile);
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState(false);
  useEffect(() => { setF(profile); }, [profile]);
  if (!f) return <div className="card">…</div>;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setF({ ...f, [k]: v });
  const orcidOk = !f.orcid || validOrcid(f.orcid);

  async function save() {
    if (!f) return;
    if (!orcidOk) { toast(t("orcid_bad"), "err"); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name.trim(), title: f.title, affiliation: f.affiliation.trim(), department: f.department.trim(), position: f.position.trim(),
      country: f.country, orcid: f.orcid, research_fields: f.research_fields, keywords: f.keywords, bio: f.bio.trim(),
      website: f.website.trim(), scholar_url: f.scholar_url.trim(), scopus_id: f.scopus_id.trim(), phone: f.phone.trim(), updated_at: new Date().toISOString(),
    }).eq("id", f.id);
    setBusy(false);
    if (error) toast(error.message, "err"); else { toast(t("saved")); await refresh(); }
  }

  async function doImport() {
    if (!f || !validOrcid(f.orcid)) { toast(t("orcid_bad"), "err"); return; }
    setImp(true);
    try {
      const o = await importOrcid(f.orcid);
      setF({
        ...f,
        full_name: f.full_name || o.full_name || "", bio: f.bio || o.bio || "", affiliation: f.affiliation || o.affiliation || "",
        website: f.website || o.website || "", keywords: f.keywords.length ? f.keywords : (o.keywords ?? []).slice(0, 12),
      });
      toast(t("orcid_imported"));
    } catch { toast(t("orcid_fail"), "err"); }
    setImp(false);
  }

  const initials = (f.full_name || f.email).split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase()).join("");
  const completeness = Math.round(([f.full_name, f.affiliation, f.orcid, f.research_fields.length, f.keywords.length, f.bio, f.title, f.country].filter(Boolean).length / 8) * 100);

  return (
    <div className="page profile">
      <div className="card id-card">
        <div className="avatar" aria-hidden="true">{initials || "?"}</div>
        <div className="id-main">
          <h2>{[f.title, f.full_name].filter(Boolean).join(" ") || f.email}</h2>
          <p className="muted">{[f.position, f.affiliation].filter(Boolean).join(" · ") || t("profile_empty")}</p>
          <div className="id-badges">
            {f.orcid && validOrcid(f.orcid) && <a className="badge orcid" href={`https://orcid.org/${f.orcid}`} target="_blank" rel="noopener noreferrer"><span>iD</span> {f.orcid}</a>}
            <span className="badge">{f.email}</span>
            {f.role === "admin" && <span className="badge admin">{t("role_admin")}</span>}
            <span className={`badge ${f.approved || f.role === "admin" ? "ok-badge" : "warn-badge"}`}>{f.approved || f.role === "admin" ? t("approved") : t("pending")}</span>
          </div>
        </div>
        <div className="meter" title={t("completeness")}><div style={{ width: `${completeness}%` }} /><span>{completeness}%</span></div>
      </div>

      <QuotaBar />
      {quota && <p className="muted small">{t("usage_life", { n: quota.lifetime_used })} · {quota.approved ? t("limit_approved", { mb: quota.max_file_mb }) : t("limit_basic", { mb: quota.max_file_mb })}</p>}

      <div className="card form-grid">
        <h3>{t("sec_identity")}</h3>
        <label>{t("full_name")}<input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></label>
        <label>{t("acad_title")}
          <select value={f.title} onChange={(e) => set("title", e.target.value)}>
            {TITLES.map((x) => <option key={x} value={x}>{x || "—"}</option>)}
          </select>
        </label>
        <label className="wide">ORCID iD
          <div className="row">
            <input value={f.orcid} placeholder="0000-0002-1825-0097" onChange={(e) => set("orcid", normalizeOrcid(e.target.value))} aria-invalid={!orcidOk} />
            <button type="button" className="btn" disabled={imp || !validOrcid(f.orcid)} onClick={doImport}>{imp ? "…" : t("orcid_import")}</button>
          </div>
          <small className={orcidOk ? "muted" : "err"}>{orcidOk ? t("orcid_hint") : t("orcid_bad")}</small>
        </label>
        <label>{t("country")}
          <select value={f.country} onChange={(e) => set("country", e.target.value)}>
            {COUNTRIES.map(([c, vi, en]) => <option key={c} value={c}>{lang === "vi" ? vi : en}</option>)}
          </select>
        </label>
        <label>{t("phone")}<input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></label>

        <h3>{t("sec_affil")}</h3>
        <label className="wide">{t("affiliation")}<input value={f.affiliation} onChange={(e) => set("affiliation", e.target.value)} /></label>
        <label>{t("department")}<input value={f.department} onChange={(e) => set("department", e.target.value)} /></label>
        <label>{t("position")}<input value={f.position} onChange={(e) => set("position", e.target.value)} /></label>

        <h3>{t("sec_research")}</h3>
        <label className="wide">{t("fields")}<Tags value={f.research_fields} onChange={(v) => set("research_fields", v)} placeholder={t("fields_ph")} suggest={SUGGEST} /></label>
        <label className="wide">{t("keywords")}<Tags value={f.keywords} onChange={(v) => set("keywords", v)} placeholder={t("keywords_ph")} /></label>
        <label className="wide">{t("bio")}<textarea rows={4} maxLength={1500} value={f.bio} onChange={(e) => set("bio", e.target.value)} /></label>

        <h3>{t("sec_links")}</h3>
        <label>Google Scholar<input type="url" value={f.scholar_url} onChange={(e) => set("scholar_url", e.target.value)} placeholder="https://scholar.google.com/citations?user=…" /></label>
        <label>Scopus Author ID<input value={f.scopus_id} onChange={(e) => set("scopus_id", e.target.value)} /></label>
        <label className="wide">{t("website")}<input type="url" value={f.website} onChange={(e) => set("website", e.target.value)} /></label>

        <div className="wide actions"><button className="btn primary" disabled={busy} onClick={save}>{busy ? "…" : t("save")}</button></div>
      </div>
    </div>
  );
}
