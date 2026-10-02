import { useEffect, useState } from "react";
import { useI18n } from "../i18n.tsx";
import type { Lang } from "../../shared/types.ts";
import { useApp } from "../ctx.tsx";
import { APP } from "../lib/config.ts";
import { visit, type VisitStats } from "../lib/api.ts";
import { Flag, Icon } from "./Icon.tsx";

export const Logo = ({ size = 34 }: { size?: number }) => (
  <img src="/favicon.svg" width={size} height={size} alt="" aria-hidden="true" />
);

/** Nút chọn ngôn ngữ kèm quốc kỳ; trạng thái đang chọn mang màu cờ (đỏ-vàng cho Việt Nam, xanh-đỏ cho Anh). */
export function FlagToggle({ value, onChange, label }: { value: Lang; onChange: (l: Lang) => void; label: string }) {
  return (
    <div className="flagseg" role="group" aria-label={label}>
      {(["vi", "en"] as const).map((l) => (
        <button key={l} className={`${l} ${value === l ? "on" : ""}`} onClick={() => onChange(l)} aria-pressed={value === l} title={l === "vi" ? "Tiếng Việt" : "English"}>
          <Flag lang={l} w={20} /><span>{l.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return <FlagToggle value={lang} onChange={setLang} label="Language" />;
}

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem("tl-theme") ?? ""; } catch { return ""; } });
  useEffect(() => {
    const r = document.documentElement;
    if (theme) r.setAttribute("data-theme", theme); else r.removeAttribute("data-theme");
    try { theme ? localStorage.setItem("tl-theme", theme) : localStorage.removeItem("tl-theme"); } catch { /* bỏ qua */ }
  }, [theme]);
  const dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  return (
    <button className="icon-btn" onClick={() => setTheme(dark ? "light" : "dark")} title={t("theme")} aria-label={t("theme")}>
      <Icon name={dark ? "sun" : "moon"} size={17} />
    </button>
  );
}

export type Route = "work" | "history" | "profile" | "admin";

export function Header({ route, go }: { route: Route; go: (r: Route) => void }) {
  const { t, lang } = useI18n();
  const { session, profile, signOut } = useApp();
  const items: [Route, string][] = [["work", t("nav_work")], ["history", t("nav_history")], ["profile", t("nav_profile")]];
  if (profile?.role === "admin") items.push(["admin", t("nav_admin")]);
  return (
    <header className="topbar">
      <a className="brand" href="#/" onClick={() => go("work")}>
        <Logo />
        <span className="brand-text">
          <b>{APP.name[lang]}</b>
          <small>{lang === "vi" ? APP.name.en : APP.name.vi} {APP.version}</small>
        </span>
      </a>
      {session && (
        <nav className="nav" aria-label="Main">
          {items.map(([r, label]) => (
            <a key={r} href={`#/${r === "work" ? "" : r}`} className={route === r ? "on" : ""} onClick={() => go(r)}>{label}</a>
          ))}
        </nav>
      )}
      <div className="top-actions">
        <LangSwitch />
        <ThemeToggle />
        {session && <button className="btn ghost sm" onClick={signOut}>{t("sign_out")}</button>}
      </div>
    </header>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  const { t } = useI18n();
  const win = toasts.filter((x) => x.kind === "win");
  return (
    <>
      <div className="wins" aria-live="polite">
        {win.map((x) => (
          <div key={x.id} className="win" role="status">
            <span className="win-ico"><Icon name="check" size={22} /></span>
            <div className="win-body">
              <b>{x.text}</b>
              {x.body && <p>{x.body}</p>}
              {x.note && <small><Icon name="clock" size={12} /> {x.note}</small>}
            </div>
          </div>
        ))}
      </div>
      <div className="toasts" aria-live="polite" aria-label={t("notifications")}>{toasts.filter((x) => x.kind !== "win").map((x) => <div key={x.id} className={`toast ${x.kind}`}>{x.text}</div>)}</div>
    </>
  );
}

// ---------- Chia sẻ mạng xã hội (liên kết thuần, không nhúng script bên thứ ba) ----------
export function ShareButtons({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n();
  const { toast } = useApp();
  const url = APP.siteUrl || location.origin;
  const text = lang === "vi"
    ? `${APP.name.vi} ${APP.version}: đọc tài liệu, tóm tắt và trích dẫn theo chuẩn khoa học`
    : `${APP.name.en} ${APP.version}: read, summarise and cite sources to scholarly standards`;
  const u = encodeURIComponent(url), tx = encodeURIComponent(text);
  const links: [string, string, string][] = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`, "f"],
    ["X", `https://twitter.com/intent/tweet?url=${u}&text=${tx}`, "𝕏"],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, "in"],
    ["Telegram", `https://t.me/share/url?url=${u}&text=${tx}`, "Tg"],
    ["Email", `mailto:?subject=${encodeURIComponent(APP.name[lang])}&body=${tx}%0A${u}`, "@"],
  ];
  const copy = async (msg: string) => {
    try { await navigator.clipboard.writeText(url); toast(msg); } catch { toast(url); }
  };
  return (
    <div className={`share ${compact ? "compact" : ""}`}>
      {!compact && <span className="muted">{t("share")}</span>}
      {links.map(([name, href, glyph]) => (
        <a key={name} className="share-btn" href={href} target="_blank" rel="noopener noreferrer" title={name} aria-label={`${t("share")} ${name}`}>{glyph}</a>
      ))}
      <button className="share-btn zalo" title="Zalo" aria-label={`${t("share")} Zalo`} onClick={() => copy(t("zalo_copied"))}>Z</button>
      <button className="share-btn" title={t("copy_link")} aria-label={t("copy_link")} onClick={() => copy(t("link_copied"))}><Icon name="copy" size={15} /></button>
    </div>
  );
}

// ---------- Bộ đếm truy cập ----------
export function VisitCounter() {
  const { t } = useI18n();
  const [s, setS] = useState<VisitStats | null>(null);
  useEffect(() => { void visit().then(setS); }, []);
  if (!s?.enabled) return null;
  const fmt = (n = 0) => n.toLocaleString();
  const max = Math.max(1, ...(s.days ?? []).map((d) => d.n));
  return (
    <div className="visits" title={t("visits_title")}>
      <span><b>{fmt(s.total)}</b> {t("visits_total")}</span>
      <span><b>{fmt(s.today)}</b> {t("visits_today")}</span>
      <span className="spark" aria-hidden="true">{(s.days ?? []).map((d) => <i key={d.d} style={{ height: `${Math.max(12, (d.n / max) * 100)}%` }} />)}</span>
    </div>
  );
}

export function Footer() {
  const { t, lang } = useI18n();
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="foot-title">{APP.name[lang]} {APP.version}</div>
          <p className="muted small">{t("foot_about")}</p>
          <p className="brand-mean"><Logo size={22} /> <span className="muted small">{t("brand_meaning")}</span></p>
          <ShareButtons />
        </div>
        <div>
          <div className="foot-title">{t("author")}</div>
          <p className="small"><b>{APP.author.name}</b> · {APP.author.org}</p>
          <p className="muted small">{t("author_note")}</p>
          <p className="small"><a href={APP.author.edufind} target="_blank" rel="noopener noreferrer">EduFind</a> · {t("edufind_note")}</p>
        </div>
        <div>
          <div className="foot-title">{t("visits_head")}</div>
          <VisitCounter />
        </div>
      </div>
      <div className="copyright">
        <p>© {APP.year} {APP.author.name} ({APP.author.org}). {t("rights")}</p>
        <p className="muted small">{t("rights_detail")}</p>
      </div>
    </footer>
  );
}

// ---------- Liên hệ quản trị viên ----------
export function ContactAdmin({ reason }: { reason?: string }) {
  const { t, lang } = useI18n();
  const { contact, profile } = useApp();
  const note = lang === "vi" ? contact?.note_vi : contact?.note_en;
  const has = contact && (contact.email || contact.phone || contact.zalo);
  const subject = encodeURIComponent(`[${APP.name.vi}] ${t("contact_subject")}`);
  const body = encodeURIComponent(`${t("contact_body")}\n\nEmail: ${profile?.email ?? ""}\n${profile?.full_name ?? ""}\nORCID: ${profile?.orcid ?? ""}`);
  const zaloNum = (contact?.zalo || contact?.phone || "").replace(/\D/g, "");
  return (
    <div className="card contact">
      <h3>{reason ?? t("quota_out_title")}</h3>
      <p className="muted">{t("quota_out_body")}</p>
      {note && <p>{note}</p>}
      {has ? (
        <div className="contact-row">
          {contact.email && <a className="btn" href={`mailto:${contact.email}?subject=${subject}&body=${body}`}><Icon name="mail" size={16} /> {contact.email}</a>}
          {contact.phone && <a className="btn" href={`tel:${contact.phone}`}><Icon name="phone" size={16} /> {contact.phone}</a>}
          {zaloNum && <a className="btn" href={`https://zalo.me/${zaloNum}`} target="_blank" rel="noopener noreferrer">Zalo {contact.zalo || contact.phone}</a>}
        </div>
      ) : <p className="muted">{t("contact_missing")}</p>}
    </div>
  );
}
