import { useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { Icon } from "./Icon.tsx";
import { editLastEntry, undoLastEntry } from "../../shared/budget.ts";
import type { BudgetConfig, BudgetState } from "../lib/budget.ts";

const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: Math.abs(n) < 100 ? 2 : 0, maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;
const compact = (n: number, lang: string) => (n >= 1e6 ? `${(n / 1e6).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 1 })} ${lang === "vi" ? "triệu" : "M"}` : n >= 1e3 ? `${Math.round(n / 1e3).toLocaleString("en-US")}k` : String(Math.round(n)));
const useDate = () => { const { lang } = useI18n(); return (iso: string | null) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return lang === "vi" ? `${d}/${m}/${y}` : `${m}/${d}/${y}`; }; };

/** Dải cảnh báo hiện ở mọi tab quản trị khi ngân sách sắp hết. */
export function BudgetBanner({ b, onOpen }: { b: BudgetState; onOpen: () => void }) {
  const { t } = useI18n(); const fd = useDate();
  const f = b.forecast;
  if (b.loading || !f || f.level === "ok") return null;
  const msg = f.level === "empty" ? t("bud_banner_empty")
    : t(f.level === "urgent" ? "bud_banner_urgent" : "bud_banner_soon", { n: Math.max(0, Math.floor(f.expected.daysLeft)), date: fd(f.expected.date), by: fd(f.topUp.by), amt: usd(f.topUp.amount) });
  return (
    <div className={`bud-banner ${f.level}`} role="status">
      <Icon name="alert" size={18} /><span>{msg}</span>
      <button className="btn sm" onClick={onOpen}>{t("bud_view")}</button>
    </div>
  );
}

/** Thẻ ngân sách API: số dư còn lại, dự báo hết, khuyến nghị nạp, ghi nhận nạp tiền và đối chiếu số dư. */
export default function BudgetCard({ b, rate }: { b: BudgetState; rate: number }) {
  const { t, lang } = useI18n(); const { toast } = useApp(); const fd = useDate();
  const [editing, setEditing] = useState(false); const [editVal, setEditVal] = useState("");
  const [start, setStart] = useState(""); const [topup, setTopup] = useState(""); const [check, setCheck] = useState(""); const [warn, setWarn] = useState("");
  const vnd = (n: number) => `${Math.round(n * rate).toLocaleString(lang === "vi" ? "vi-VN" : "en-US")} ₫`;
  const num = (s: string) => { const v = Number(s.replace(",", ".").trim()); return Number.isFinite(v) ? v : NaN; };
  const f = b.forecast, cfg = b.config;

  async function commit(c: BudgetConfig) { const e = await b.save(c); if (e) toast(e, "err"); else toast(t("saved")); }
  const last = cfg?.history[cfg.history.length - 1];
  async function saveEdit() { if (!cfg) return; const n = editLastEntry(cfg, num(editVal)); if (!n) { toast(t("bud_bad_value"), "err"); return; } await commit(n); setEditing(false); }
  async function undo() {
    if (!cfg || !last) return;
    const next = undoLastEntry(cfg);
    if (!window.confirm(t(next ? "bud_undo_confirm" : "bud_reset_confirm", { k: t(`bud_kind_${last.kind}` as "bud_kind_start"), v: usd(last.kind === "topup" ? last.amount_usd : last.balance_usd) }))) return;
    if (next) await commit(next); else { const e = await b.reset(); if (e) toast(e, "err"); else toast(t("saved")); }
    setEditing(false);
  }
  const entry = (kind: "start" | "topup" | "check", amount: number, balance: number) => ({ at: new Date().toISOString(), kind, amount_usd: amount, balance_usd: balance });

  if (b.missing) return <div className="card budget"><h3>{t("bud_title")}</h3><p className="muted">{t("bud_missing")}</p></div>;
  if (b.error && !cfg) return <div className="card budget"><h3>{t("bud_title")}</h3><p className="err">{b.error}</p></div>;
  if (!cfg) return (
    <div className="card budget">
      <h3>{t("bud_start_h")}</h3><p className="muted">{t("bud_start_d")}</p>
      <div className="row wrap">
        <label className="grow">{t("bud_balance_in")}<input inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="50" /></label>
        <button className="btn primary" disabled={!(num(start) >= 0)} onClick={() => void commit({ balance_usd: num(start), as_of: new Date().toISOString(), warn_days: 14, history: [entry("start", num(start), num(start))] })}>{t("bud_start_btn")}</button>
      </div>
    </div>
  );

  const rem = b.remaining, lvl = f?.level ?? "ok";
  const pct = Math.max(0, Math.min(100, (rem / Math.max(cfg.balance_usd, 0.01)) * 100));
  const exp = f?.expected, inf = !exp || !Number.isFinite(exp.daysLeft);
  return (
    <div className={`card budget ${lvl}`}>
      <div className="bud-head">
        <div><h3>{t("bud_title")}</h3><span className="muted small">{t("bud_sub")}</span></div>
        <span className={`bud-chip ${lvl}`}>{t(`bud_lvl_${lvl}` as "bud_lvl_ok")}</span>
        <button className="btn sm" onClick={b.reload} aria-label={t("st_reload")}><Icon name="refresh" size={14} /></button>
      </div>
      <div className="bud-main">
        <div className="bud-remain">
          <span className="muted small">{t("bud_remaining")}</span>
          <b className="bud-big">{usd(rem)}</b><span className="muted">{vnd(rem)}</span>
          <div className="bud-bar" role="img" aria-label={`${pct.toFixed(0)}%`}><i style={{ width: `${pct}%` }} /></div>
          <span className="muted small">{t("bud_of", { b: usd(cfg.balance_usd), d: fd(cfg.as_of.slice(0, 10)) })}</span>
        </div>
        {f && (
          <ul className="bud-facts">
            <li><Icon name="clock" size={16} /><span>{inf ? t("bud_runway_inf") : t("bud_runway", { n: Math.floor(exp!.daysLeft), date: fd(exp!.date) })}
              {!inf && <small className="muted"> {t("bud_range", { a: Number.isFinite(f.low.daysLeft) ? Math.floor(f.low.daysLeft) : "∞", b: Math.floor(f.high.daysLeft) })}</small>}</span></li>
            <li><Icon name="wallet" size={16} /><span>{f.topUp.amount > 0 ? t("bud_topup_by", { date: fd(f.topUp.by), amt: usd(f.topUp.amount) }) : t("bud_topup_none", { n: f.topUp.horizonDays })}
              {f.topUp.amount > 0 && <small className="muted"> {t("bud_topup_note", { n: f.topUp.horizonDays })}</small>}</span></li>
            <li><Icon name="chart" size={16} /><span>{t("bud_burn", { a: usd(f.burn.avg7), b: usd(f.burn.avg30) })}
              <small className="muted"> {t("bud_trend", { p: `${f.burn.trend >= 1 ? "+" : "−"}${Math.abs(Math.round((f.burn.trend - 1) * 100))}%` })}</small></span></li>
            {b.tokensPerUsd > 0 && <li><Icon name="cpu" size={16} /><span>{t("bud_tokens", { n: compact(Math.max(rem, 0) * b.tokensPerUsd, lang) })}{b.avgCostPerAnalysis > 0 && <> · {t("bud_analyses", { n: Math.max(0, Math.floor(rem / b.avgCostPerAnalysis)).toLocaleString("en-US") })}</>}</span></li>}
            <li className="muted small">{t(`bud_conf_${f.confidence}` as "bud_conf_low", { n: f.activeDays })}</li>
          </ul>
        )}
      </div>
      <div className="bud-actions">
        <div><label>{t("bud_topup_in")}<span className="row nowrap"><input inputMode="decimal" value={topup} onChange={(e) => setTopup(e.target.value)} placeholder="50" />
          <button className="btn sm primary" disabled={!(num(topup) > 0)} onClick={() => { const a = num(topup), nb = Math.max(rem, 0) + a; void commit({ ...cfg, balance_usd: nb, as_of: new Date().toISOString(), history: [...cfg.history, entry("topup", a, nb)] }); setTopup(""); }}>{t("bud_topup_btn")}</button></span></label></div>
        <div><label>{t("bud_check_in")}<span className="row nowrap"><input inputMode="decimal" value={check} onChange={(e) => setCheck(e.target.value)} placeholder={rem.toFixed(2)} />
          <button className="btn sm" disabled={!(num(check) >= 0)} onClick={() => { const v = num(check); void commit({ ...cfg, balance_usd: v, as_of: new Date().toISOString(), history: [...cfg.history, entry("check", v - rem, v)] }); setCheck(""); }}>{t("bud_check_btn")}</button></span></label></div>
        <div><label>{t("bud_warn")}<span className="row nowrap"><input inputMode="numeric" value={warn || String(cfg.warn_days)} onChange={(e) => setWarn(e.target.value)} />
          <button className="btn sm" disabled={!warn || !(num(warn) >= 3)} onClick={() => { void commit({ ...cfg, warn_days: Math.min(60, Math.round(num(warn))) }); setWarn(""); }}>{t("bud_save")}</button></span></label></div>
      </div>
      <p className="muted small bud-fix"><Icon name="info" size={14} /> {t("bud_fix_hint")}</p>
      {cfg.history.length > 0 && (
        <details className="bud-hist"><summary>{t("bud_hist")}</summary>
          <ul>{[...cfg.history].reverse().slice(0, 6).map((h, i) => (
            <li key={h.at}><span>{new Date(h.at).toLocaleString(lang === "vi" ? "vi-VN" : "en-US")}</span><b>{t(`bud_kind_${h.kind}` as "bud_kind_start")}</b>
              <span>{h.kind === "topup" ? `+${usd(h.amount_usd)} → ` : h.kind === "check" ? `${h.amount_usd >= 0 ? "+" : "−"}${usd(Math.abs(h.amount_usd))} → ` : ""}{usd(h.balance_usd)}</span>
              {i === 0 && (editing ? (
                <span className="row nowrap bud-edit">
                  <input inputMode="decimal" aria-label={t(h.kind === "topup" ? "bud_edit_topup" : "bud_edit_balance")} value={editVal} onChange={(e) => setEditVal(e.target.value)} />
                  <button className="btn sm primary" onClick={() => void saveEdit()}>{t("bud_save")}</button>
                  <button className="btn sm" onClick={() => setEditing(false)}>{t("close")}</button>
                </span>
              ) : (
                <span className="row nowrap bud-edit">
                  <button className="btn sm" onClick={() => { setEditVal(String(h.kind === "topup" ? h.amount_usd : h.balance_usd)); setEditing(true); }}>{t("bud_edit")}</button>
                  <button className="btn sm" onClick={() => void undo()}>{t("bud_undo")}</button>
                </span>
              ))}
            </li>))}
          </ul>
          {editing && last && <p className="muted small">{t(last.kind === "topup" ? "bud_edit_topup" : "bud_edit_balance")}</p>}
        </details>
      )}
      <p className="muted small bud-note">{t("bud_note")}</p>
    </div>
  );
}
