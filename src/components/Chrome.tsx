import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n.tsx";
import type { Lang } from "../../shared/types.ts";
import { useApp } from "../ctx.tsx";
import { APP, withUtm } from "../lib/config.ts";
import { visit, type VisitStats } from "../lib/api.ts";
import { Flag, Icon } from "./Icon.tsx";
import { AuthorBadge } from "./AuthorCard.tsx";

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
        {session && <button className="btn ghost sm signout" onClick={signOut} title={t("sign_out")}><Icon name="logout" size={16} /><span className="lbl">{t("sign_out")}</span></button>}
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
      <div className="toasts" role="status" aria-live="polite" aria-label={t("notifications")}>{toasts.filter((x) => x.kind !== "win").map((x) => <div key={x.id} className={`toast ${x.kind}`}>{x.text}</div>)}</div>
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
        <a key={name} className="share-btn" href={href} target="_blank" rel="noopener noreferrer" title={`${t("share")} ${name}`}><span aria-hidden="true">{glyph}</span><span className="sr-only">{`${t("share")} ${name}`}</span></a>
      ))}
      <button className="share-btn zalo" title={`${t("share")} Zalo`} onClick={() => copy(t("zalo_copied"))}><span aria-hidden="true">Z</span><span className="sr-only">{`${t("share")} Zalo`}</span></button>
      <button className="share-btn" title={t("copy_link")} aria-label={t("copy_link")} onClick={() => copy(t("link_copied"))}><Icon name="copy" size={15} /></button>
    </div>
  );
}

// ---------- Bộ đếm truy cập (cùng cách hiển thị với EduFind) ----------
function useVisits() {
  const [s, setS] = useState<VisitStats | null>(null);
  useEffect(() => { void visit(14).then(setS); }, []);
  return s;
}
const nf = new Intl.NumberFormat("en-US");

/** Khối thống kê dùng chung cho chân trang và cửa sổ nổi: tổng, hôm nay, 7 ngày, quốc gia nhiều nhất. */
function VisitBody({ s }: { s: VisitStats }) {
  const { t, lang } = useI18n();
  const week = (s.days ?? []).slice(-7);
  const max = Math.max(1, ...week.map((d) => d.n));
  const dn = useMemo(() => new Intl.DisplayNames([lang], { type: "region" }), [lang]);
  const top = (s.countries ?? []).slice(0, 5);
  const cmax = Math.max(1, ...top.map((c) => c.n));
  return (
    <div className="visit-body">
      <div className="visit-nums"><div><b>{nf.format(s.total ?? 0)}</b><span>{t("visits_total")}</span></div><div><b>{nf.format(s.today ?? 0)}</b><span>{t("visits_today")}</span></div><div><b>{nf.format(week.reduce((a, d) => a + d.n, 0))}</b><span>{t("visits_7d")}</span></div></div>
      <div className="spark big" aria-label={t("visits_7d")}>{week.map((d) => <i key={d.d} title={`${d.d}: ${d.n}`} style={{ height: `${Math.max(10, (d.n / max) * 100)}%` }}><em>{d.d.slice(8)}</em></i>)}</div>
      {top.length > 0 && <ul className="mini-bars">{top.map((c) => <li key={c.c}><span>{dn.of(c.c) ?? c.c}</span><span className="mb-track"><i style={{ width: `${(c.n / cmax) * 100}%` }} /></span><b>{nf.format(c.n)}</b></li>)}</ul>}
    </div>
  );
}

export function VisitCounter() {
  const s = useVisits();
  if (!s?.enabled) return null;
  return <VisitBody s={s} />;
}

/** Nút nổi góc dưới trái: số lượt truy cập, bấm mở chi tiết (đóng bằng Esc hoặc bấm ra ngoài). */
export function VisitChip() {
  const { t } = useI18n();
  const s = useVisits();
  const [open, setOpen] = useState(false);
  const [atFooter, setAtFooter] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Khi chân trang đã hiện (đã có dòng lượt truy cập), ẩn nút nổi để không chồng lên chữ.
  useEffect(() => {
    const el = document.querySelector(".site-footer");
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setAtFooter(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [s?.enabled]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const c = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    addEventListener("keydown", k); addEventListener("mousedown", c);
    return () => { removeEventListener("keydown", k); removeEventListener("mousedown", c); };
  }, [open]);
  if (!s?.enabled || (atFooter && !open)) return null;
  return (
    <div className="visits" ref={box}>
      {open && <div className="popover visit-pop" role="dialog" aria-label={t("visits_head")}><div className="pop-title">{t("visits_head")}</div><VisitBody s={s} /><p className="muted small">{t("visits_title")}</p></div>}
      <button className="visit-chip" onClick={() => setOpen(!open)} aria-expanded={open} title={t("visits_title")}><Icon name="eye" size={14} /> <b>{nf.format(s.total ?? 0)}</b></button>
    </div>
  );
}

/** Nút lên đầu trang: chỉ hiện khi trang đã cuộn xuống đủ xa. */
export function ScrollTop() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const f = () => setShow(window.scrollY > 700);
    f(); addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  if (!show) return null;
  const go = () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return <button className="to-top" onClick={go} aria-label={t("to_top")} title={t("to_top")}><Icon name="up" size={20} /></button>;
}

/** Một dòng gọn cho chân trang: tổng lượt và lượt hôm nay. */
function VisitInline() {
  const { t } = useI18n();
  const s = useVisits();
  if (!s?.enabled) return null;
  return <span className="sf-visits"><Icon name="eye" size={14} /> {t("foot_visits", { n: nf.format(s.total ?? 0) })} <i>·</i> {t("foot_today", { n: nf.format(s.today ?? 0) })}</span>;
}

/** Chân trang tối giản, nền tối cố định (khác phần nội dung): thương hiệu, tác giả, liên hệ; dòng bản quyền, truy cập, chia sẻ. */
export function Footer() {
  const { t, lang } = useI18n();
  const { contact, profile } = useApp();
  const a = APP.author;
  const zalo = (contact?.zalo || contact?.phone || "").replace(/\D/g, "");
  const has = !!(contact && (contact.email || contact.phone || zalo));
  const note = lang === "vi" ? contact?.note_vi : contact?.note_en;
  return (
    <footer className="site-footer">
      <div className="sf-inner">
        <section className="sf-brand">
          <div className="sf-logo"><Logo size={36} /><div><b>{APP.name[lang]} {APP.version}</b><span>{lang === "vi" ? APP.name.en : APP.name.vi}</span></div></div>
          <p>{t("foot_about")}</p>
          <p><a className="sf-guide" href={lang === "vi" ? "/huong-dan" : "/en/guide"}>{t("foot_guide")}</a> · <a className="sf-guide" href={lang === "vi" ? "/quyen-rieng-tu" : "/en/privacy"}>{t("foot_privacy")}</a></p>
        </section>

        <section className="sf-col" aria-label={t("author")}>
          <h2 className="sf-h">{t("author")}</h2>
          <AuthorBadge />
          <ul className="sf-links">
            {a.orcid && <li><a href={`https://orcid.org/${a.orcid}`} target="_blank" rel="noopener noreferrer"><span className="orcid-dot">iD</span> {a.orcid}</a></li>}
            {a.website && <li><a href={a.website} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14} /> {a.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></li>}
            <li><a href={withUtm(a.edufind)} target="_blank" rel="noopener noreferrer"><Icon name="cap" size={14} /> EduFind <small>{t("foot_related")}</small></a></li>
            <li><a href={withUtm(a.vanthu)} target="_blank" rel="noopener noreferrer"><Icon name="file" size={14} /> {t("foot_vanthu")} <small>{t("foot_related")}</small></a></li>
          </ul>
        </section>

        <section className="sf-col" aria-label={t("foot_contact")}>
          <h2 className="sf-h">{t("foot_contact")}</h2>
          {has ? (
            <ul className="sf-links">
              {contact!.email && <li><a href={`mailto:${contact!.email}`}><Icon name="mail" size={14} /> {contact!.email}</a></li>}
              {contact!.phone && <li><a href={`tel:${contact!.phone}`}><Icon name="phone" size={14} /> {contact!.phone}</a></li>}
              {zalo && <li><a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer"><span className="zalo-dot">Z</span> {t("foot_zalo")}</a></li>}
            </ul>
          ) : <p className="sf-muted">{t("foot_contact_pending")}{profile?.role === "admin" && <><br />{t("foot_contact_admin")}</>}</p>}
          {note && <p className="sf-muted">{note}</p>}
        </section>
      </div>

      <nav className="sf-eco" aria-label={t("eco_title")}>
        <h2 className="sf-h">{t("eco_title")}</h2>
        <ol>
          <li><a href={withUtm(a.ecoEdufind)} target="_blank" rel="noopener noreferrer"><small>1. {t("eco_1")}</small><b>EduFind</b><span>{t("eco_1d")}</span></a></li>
          <li className="self"><a href="/" aria-current="page"><small>2. {t("eco_2")}</small><b>{APP.name[lang]}</b><span>{t("eco_2d")}</span></a></li>
          <li><a href={withUtm(a.vanthu)} target="_blank" rel="noopener noreferrer"><small>3. {t("eco_3")}</small><b>{t("foot_vanthu")}</b><span>{t("eco_3d")}</span></a></li>
        </ol>
      </nav>

      <div className="sf-bottom">
        <div className="sf-legal">
          <span>© {APP.year} {a.name} ({a.org}). {t("rights")}</span>
          <small>{t("rights_detail")}</small>
          <small><a href={APP.release.notes[lang]}>{t("release_link").replace("{v}", APP.release.version)}</a></small>
        </div>
        <div className="sf-tools"><VisitInline /><ShareButtons compact /></div>
      </div>
    </footer>
  );
}

// ---------- Thông báo "Có gì mới" (một lần cho mỗi phiên bản) ----------
const SEEN_KEY = "tl-seen-release";
export function WhatsNew() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(SEEN_KEY) !== APP.release.version) setOpen(true); } catch { setOpen(true); }
  }, []);
  if (!open) return null;
  const close = () => { try { localStorage.setItem(SEEN_KEY, APP.release.version); } catch { /* bỏ qua */ } setOpen(false); };
  return (
    <aside className="whatsnew" role="region" aria-label={t("whatsnew_title").replace("{v}", APP.release.version)}>
      <div className="wn-badge" aria-hidden="true">NEW</div>
      <div className="wn-body">
        <b>{t("whatsnew_title").replace("{v}", APP.release.version)}</b>
        <p>{t("whatsnew_body")}</p>
        <a href={APP.release.notes[lang]} target="_blank" rel="noopener" onClick={close}>{t("whatsnew_link")}</a>
      </div>
      <button className="wn-x" onClick={close} aria-label={t("close")}><Icon name="x" size={16} /></button>
    </aside>
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
