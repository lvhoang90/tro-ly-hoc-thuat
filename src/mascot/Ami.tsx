import { lazy, Suspense, useEffect, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { useMascot } from "./ctx.tsx";
import type { Mood } from "./types.ts";

const Robot3D = lazy(() => import("./Robot3D.tsx"));

function webglOk(): boolean {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
function lowPower(): boolean {
  const n = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (location.search.includes("ami3d") || location.search.includes("amidebug")) return false; // ép bật 3D khi xem thử
  // Trình duyệt tự động (kiểm thử, đo tốc độ) thường vẽ WebGL bằng CPU rất chậm: dùng robot 2D để không ảnh hưởng số đo.
  return !!n.connection?.saveData || n.webdriver === true || (n.deviceMemory !== undefined && n.deviceMemory <= 1);
}
const prefersReduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Robot 2D dùng khi chưa tải xong 3D, không có WebGL hoặc máy yếu. */
export function AmiSvg({ mood = "idle" }: { mood?: Mood }) {
  const happy = mood === "happy" || mood === "celebrate" || mood === "wave";
  return (
    <svg className="ami-svg" viewBox="0 0 160 190" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="amiA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#7c5cf0" /></linearGradient>
        <radialGradient id="amiB" cx="35%" cy="30%"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#cfd8f0" /></radialGradient>
      </defs>
      <ellipse cx="80" cy="182" rx="38" ry="6" fill="rgba(10,16,40,.28)" />
      <path d="M52 126h56l-8 38H60z" fill="#1b2a5c" /><ellipse cx="80" cy="168" rx="26" ry="5" fill="#38bdf8" opacity=".8" />
      <ellipse cx="80" cy="116" rx="40" ry="38" fill="url(#amiB)" /><rect x="64" y="100" width="32" height="32" rx="9" fill="url(#amiA)" />
      <path d="M72 124l8-18 8 18z" fill="#fff" />
      <circle cx="36" cy="106" r="12" fill="#38bdf8" /><circle cx="124" cy="106" r="12" fill="#38bdf8" />
      <rect x="32" y="40" width="96" height="72" rx="28" fill="url(#amiB)" /><rect x="42" y="52" width="76" height="46" rx="18" fill="#070b18" />
      {happy ? <><path d="M54 78q8-12 16 0" stroke="#7dd3fc" strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M90 78q8-12 16 0" stroke="#7dd3fc" strokeWidth="5" fill="none" strokeLinecap="round" /></>
        : <><rect x="54" y="62" width="16" height="22" rx="8" fill="#7dd3fc" /><rect x="90" y="62" width="16" height="22" rx="8" fill="#7dd3fc" /></>}
      <path d="M72 90q8 6 16 0" stroke="#7dd3fc" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M22 34l58-22 58 22-58 22z" fill="#1b2a5c" /><path d="M54 44v14q26 12 52 0V44" fill="#14204a" /><circle cx="80" cy="34" r="5" fill="#7dd3fc" />
      <path d="M136 36v26" stroke="#f5c04a" strokeWidth="3" /><circle cx="136" cy="66" r="5" fill="#f5c04a" />
    </svg>
  );
}

/** Nhân vật trợ lý Ami: robot 3D tải lười (không chặn trang), có lời nhắn và cảm xúc theo ngữ cảnh. */
export function Ami({ variant }: { variant: "hero" | "companion" }) {
  const { t } = useI18n();
  const { toasts } = useApp();
  const { mood, text, nonce, enabled, say, setEnabled } = useMascot();
  const [ready3d, setReady3d] = useState(false);
  const [ok] = useState(() => webglOk() && !lowPower());
  const [reduced] = useState(prefersReduced);
  const [open, setOpen] = useState(true);

  // Tải 3D sau khi trang đã rảnh để không ảnh hưởng tốc độ hiển thị ban đầu.
  useEffect(() => {
    if (!ok) return;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setReady3d(true), { timeout: 1500 }) : window.setTimeout(() => setReady3d(true), 600);
    return () => { if (w.requestIdleCallback && w.cancelIdleCallback) w.cancelIdleCallback(id); else window.clearTimeout(id); };
  }, [ok]);

  // Nhận thưởng (sao chép trích dẫn): Ami ăn mừng.
  const win = toasts.filter((x) => x.kind === "win").at(-1)?.id;
  useEffect(() => { if (win && variant === "companion") say(t("ami_copied"), "celebrate", 6000); }, [win]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (text) setOpen(true); }, [text, nonce]);
  useEffect(() => { // báo cho CSS để nút lên đầu trang nhường chỗ cho nhân vật ở góc phải
    if (variant !== "companion") return;
    document.documentElement.dataset.ami = enabled ? "on" : "min";
    return () => { delete document.documentElement.dataset.ami; };
  }, [variant, enabled]);

  if (variant === "companion" && !enabled) {
    return <button className="ami-show" onClick={() => { setEnabled(true); say(t("ami_back"), "wave", 5000); }} aria-label={t("ami_show")} title={t("ami_show")}><AmiSvg /></button>;
  }
  return (
    <aside className={`ami ami-${variant}`} aria-label={t("ami_name")}>
      {text && open && (
        <div className="ami-bubble" role="status" aria-live="polite">
          <span>{text}</span>
          {variant === "companion" && <button className="ami-x" onClick={() => setOpen(false)} aria-label={t("ami_hide_tip")}>×</button>}
        </div>
      )}
      <div className="ami-stage" role="button" tabIndex={0} aria-label={t("ami_name")} onClick={() => say(t("ami_tap"), "wave", 4500)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); say(t("ami_tap"), "wave", 4500); } }}>
        {variant === "hero" && <div className="ami-orbit" aria-hidden="true"><i>0–100</i><i>APA</i><i>“ ”</i><i>DOI</i></div>}
        {ok && ready3d ? <Suspense fallback={<AmiSvg mood={mood} />}><Robot3D mood={mood} nonce={nonce} reduced={reduced} fps={variant === "companion" ? 40 : 60} /></Suspense> : <AmiSvg mood={mood} />}
      </div>
      {variant === "companion" && <button className="ami-off" onClick={() => setEnabled(false)} aria-label={t("ami_hide")} title={t("ami_hide")}>–</button>}
    </aside>
  );
}
