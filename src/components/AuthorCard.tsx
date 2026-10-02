import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { APP } from "../lib/config.ts";
import { Icon } from "./Icon.tsx";

/** Ảnh và tên tác giả trong chân trang; bấm để mở hộp thoại giới thiệu. */
export function AuthorBadge() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const a = APP.author;
  const role = a.role[lang];
  return (
    <>
      <button type="button" className="sf-author sf-author-btn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${t("author_open")}: ${a.name}`}>
        <img className="sf-photo" src={a.photo} alt="" width={48} height={48} loading="lazy" />
        <span>
          <b>{a.name}</b>
          <span>{a.org}</span>
          {role && <span>{role}</span>}
        </span>
      </button>
      {open && <AuthorModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AuthorModal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const a = APP.author;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Tab") { // giữ tiêu điểm trong hộp thoại
        const f = [...document.querySelectorAll<HTMLElement>(".author-modal a[href], .author-modal button")];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = scroll; prev?.focus(); };
  }, [onClose]);
  const links: [string, string][] = [
    ...(a.orcid ? [[`https://orcid.org/${a.orcid}`, `ORCID ${a.orcid}`] as [string, string]] : []),
    ...(a.website ? [[a.website, a.website.replace(/^https?:\/\//, "").replace(/\/$/, "")] as [string, string]] : []),
    [a.edufind, "EduFind"], [a.vanthu, t("foot_vanthu")],
  ];
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="author-modal" role="dialog" aria-modal="true" aria-labelledby="author-name" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="icon-btn modal-x" onClick={onClose} aria-label={t("author_close")}><Icon name="x" size={18} /></button>
        <header className="am-head">
          <img src={a.photo} alt={a.name} width={112} height={112} />
          <div>
            <h2 id="author-name" className="serif">{a.name}</h2>
            <p className="am-role">{a.role[lang]}</p>
            <p className="muted small">{a.org}</p>
          </div>
        </header>
        <dl className="am-facts">
          {a.facts.map((f) => <div key={f.k.en}><dt>{f.k[lang]}</dt><dd>{f.v[lang]}</dd></div>)}
        </dl>
        <h3 className="am-h">{t("author_links")}</h3>
        <ul className="am-links">
          {links.map(([href, label]) => <li key={href}><a href={href} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14} /> {label}</a></li>)}
        </ul>
      </div>
    </div>
  );
}
