import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { visit, type VisitStats } from "../lib/api.ts";
import { ChartCard, HBars, Kpi, TimeChart, type Series } from "../components/Charts.tsx";
import { Icon } from "../components/Icon.tsx";
import BudgetCard from "../components/BudgetCard.tsx";
import type { BudgetState } from "../lib/budget.ts";

interface Stats {
  users: number; approved_users: number; pending_users: number; new_7d: number; analyses_today: number; analyses_7d: number; analyses_total: number;
  refunded_total: number; citations_total: number; bonus_outstanding: number; exhausted_today: number;
  cost_total: number; cost_today: number; cost_30d: number; cost_refunded: number; tokens_in: number; tokens_out: number;
}
interface Day { day: string; analyses: number; refunded: number; cost_usd: number; input_tokens: number; output_tokens: number; new_users: number; citations: number }
interface Top { user_id: string; email: string; full_name: string; analyses: number; cost_usd: number; tokens: number }
interface Hist { bucket: number; n: number }
interface Funnel { registered: number; analysed: number; returned: number; cited: number; verified: number }

const RANGES = [7, 30, 90] as const;
const nf = new Intl.NumberFormat("en-US");
const COLORS = { analyses: "var(--s1)", cost: "var(--s2)", people: "var(--s3)", muted: "var(--muted)" };

/** Bảng thống kê quản trị: chi phí API, hoạt động, người dùng, truy cập; mọi thẻ cùng một khoảng thời gian. */
export default function AdminStats({ budget }: { budget: BudgetState }) {
  const { t, lang } = useI18n();
  const { toast } = useApp();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [top, setTop] = useState<Top[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [fun, setFun] = useState<Funnel | null>(null);
  const [vs, setVs] = useState<VisitStats | null>(null);
  const [rate, setRate] = useState(25500);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c, d, e, v, f] = await Promise.all([
      supabase.rpc("admin_stats"), supabase.rpc("admin_timeseries", { p_days: range }), supabase.rpc("admin_top_users", { p_days: range, p_limit: 8 }),
      supabase.rpc("admin_score_hist", { p_days: range }), supabase.from("app_settings").select("value").eq("key", "usd_vnd").maybeSingle(), visit(range), supabase.rpc("admin_funnel", { p_days: range }),
    ]);
    const err = a.error ?? b.error ?? c.error ?? d.error;
    if (err) toast(err.message, "err");
    setStats(a.data as Stats); setDays((b.data ?? []) as Day[]); setTop((c.data ?? []) as Top[]); setHist((d.data ?? []) as Hist[]); setVs(v); setFun(((f.data as Funnel[] | null) ?? [])[0] ?? null);
    const r = Number(e.data?.value); if (r > 0) setRate(r);
    setLoading(false);
  }, [range, toast]);
  useEffect(() => { void load(); }, [load]);

  const usd = (n: number) => (Math.abs(n) < 1 ? `$${n.toFixed(4)}` : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const vnd = (n: number) => `${Math.round(n * rate).toLocaleString(lang === "vi" ? "vi-VN" : "en-US")} ₫`;
  const both = (n: number) => `${usd(n)} · ${vnd(n)}`;
  const fd = (iso: string) => { const [, m, d] = iso.split("-"); return lang === "vi" ? `${d}/${m}` : `${m}/${d}`; };

  const funRows = fun && fun.registered > 0
    ? ([["fun_reg", fun.registered], ["fun_analysed", fun.analysed], ["fun_returned", fun.returned], ["fun_cited", fun.cited], ["fun_verified", fun.verified]] as const)
        .map(([k, v]) => ({ label: t(k), value: v, sub: `${Math.round((v / fun.registered) * 100)}%` }))
    : [];
  const D = days ?? [];
  const sum = (k: keyof Day) => D.reduce((a, r) => a + Number(r[k]), 0);
  const periodCost = sum("cost_usd"), periodAnalyses = sum("analyses"), periodRefunded = sum("refunded");
  const avg = periodAnalyses + periodRefunded > 0 ? periodCost / (periodAnalyses + periodRefunded) : 0;
  const tokIn = sum("input_tokens"), tokOut = sum("output_tokens");

  const sCost: Series[] = [{ key: "c", label: t("st_cost"), color: COLORS.cost, kind: "area" }];
  const sAn: Series[] = [{ key: "a", label: t("st_ok"), color: COLORS.analyses, kind: "bar" }, { key: "r", label: t("st_refunded"), color: COLORS.muted, kind: "bar" }];
  const sUsers: Series[] = [{ key: "u", label: t("st_new_users"), color: COLORS.people, kind: "bar" }];
  const sVis: Series[] = [{ key: "v", label: t("visits_total"), color: COLORS.people, kind: "area" }];
  const sHist: Series[] = [{ key: "h", label: t("st_analyses_n"), color: COLORS.analyses, kind: "bar" }];
  const sTok: Series[] = [{ key: "i", label: t("st_tok_in"), color: COLORS.analyses, kind: "bar" }, { key: "o", label: t("st_tok_out"), color: COLORS.cost, kind: "bar" }];

  const dPts = D.map((r) => ({ x: fd(r.day), v: [Number(r.cost_usd)] }));
  const aPts = D.map((r) => ({ x: fd(r.day), v: [r.analyses, r.refunded] }));
  const uPts = D.map((r) => ({ x: fd(r.day), v: [r.new_users] }));
  const tPts = D.map((r) => ({ x: fd(r.day), v: [r.input_tokens, r.output_tokens] }));
  const hPts = hist.map((h) => ({ x: h.bucket === 9 ? "90+" : `${h.bucket * 10}`, v: [Number(h.n)] }));
  const vDays = (vs?.days ?? []).slice(-range);
  const vPts = vDays.map((r) => ({ x: fd(r.d), v: [r.n] }));
  const ctry = useMemo(() => { const dn = new Intl.DisplayNames([lang], { type: "region" }); return (vs?.countries ?? []).map((c) => ({ label: dn.of(c.c) ?? c.c, value: c.n, sub: c.c })); }, [vs, lang]);

  return (
    <div className="stack gap">
      <div className="filters" role="group" aria-label={t("st_range")}>
        <span className="muted small">{t("st_range")}</span>
        <div className="seg">{RANGES.map((r) => <button key={r} className={range === r ? "on" : ""} aria-pressed={range === r} onClick={() => setRange(r)}>{t("st_days", { n: r })}</button>)}</div>
        <button className="btn sm" onClick={() => void load()}><Icon name="refresh" size={14} /> {t("st_reload")}</button>
        <span className="muted small grow right">{t("st_rate", { n: rate.toLocaleString() })}</span>
      </div>

      <BudgetCard b={budget} rate={rate} />

      {stats && (
        <div className="kpis">
          <Kpi label={t("st_cost_period", { n: range })} value={usd(periodCost)} sub={vnd(periodCost)} spark={D.map((r) => Number(r.cost_usd))} color={COLORS.cost} />
          <Kpi label={t("st_cost_today")} value={usd(stats.cost_today)} sub={vnd(stats.cost_today)} />
          <Kpi label={t("st_cost_avg")} value={usd(avg)} sub={t("st_per_analysis")} />
          <Kpi label={t("st_cost_total")} value={usd(stats.cost_total)} sub={t("st_wasted", { v: usd(stats.cost_refunded) })} />
          <Kpi label={t("st_analyses_period", { n: range })} value={nf.format(periodAnalyses)} sub={t("st_refunded_n", { n: periodRefunded })} spark={D.map((r) => r.analyses)} color={COLORS.analyses} />
          <Kpi label={t("st_tokens")} value={`${nf.format(Math.round(tokIn / 1000))}k / ${nf.format(Math.round(tokOut / 1000))}k`} sub={t("st_tok_split")} />
          <Kpi label={t("st_users")} value={nf.format(stats.users)} sub={t("st_pending", { n: stats.pending_users })} tone={stats.pending_users > 0 ? "warn" : undefined} spark={D.map((r) => r.new_users)} color={COLORS.people} />
          <Kpi label={t("st_citations_total")} value={nf.format(stats.citations_total)} sub={t("st_exhausted", { n: stats.exhausted_today })} />
          <Kpi label={t("visits_total")} value={vs?.enabled ? nf.format(vs.total ?? 0) : "—"} sub={vs?.enabled ? t("st_visits_today", { n: vs.today ?? 0 }) : t("visits_off")} spark={vDays.map((r) => r.n)} color={COLORS.people} />
        </div>
      )}

      <div className="chart-grid">
        <ChartCard wide loading={loading} title={t("ch_cost")} subtitle={t("ch_cost_d")} series={sCost}
          table={{ head: [t("date"), "USD", "VND"], rows: D.map((r) => [r.day, usd(Number(r.cost_usd)), vnd(Number(r.cost_usd))]) }}>
          <TimeChart data={dPts} series={sCost} fmt={(v) => `$${Number(v.toFixed(v < 1 ? 3 : 2))}`} />
        </ChartCard>
        <ChartCard loading={loading} title={t("ch_analyses")} subtitle={t("ch_analyses_d")} series={sAn}
          table={{ head: [t("date"), t("st_ok"), t("st_refunded")], rows: D.map((r) => [r.day, r.analyses, r.refunded]) }}>
          <TimeChart data={aPts} series={sAn} stacked fmt={(v) => nf.format(v)} />
        </ChartCard>
        <ChartCard loading={loading} title={t("ch_tokens")} subtitle={t("ch_tokens_d")} series={sTok}
          table={{ head: [t("date"), t("st_tok_in"), t("st_tok_out")], rows: D.map((r) => [r.day, nf.format(r.input_tokens), nf.format(r.output_tokens)]) }}>
          <TimeChart data={tPts} series={sTok} stacked fmt={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))} />
        </ChartCard>
        <ChartCard loading={loading} title={t("ch_hist")} subtitle={t("ch_hist_d")} series={sHist}
          table={{ head: [t("st_score_bin"), t("st_analyses_n")], rows: hist.map((h) => [h.bucket === 9 ? "90–100" : `${h.bucket * 10}–${h.bucket * 10 + 9}`, Number(h.n)]) }}>
          <TimeChart data={hPts} series={sHist} fmt={(v) => nf.format(v)} ref0={{ at: 6, label: t("ch_pass") }} />
        </ChartCard>
        <ChartCard loading={loading} title={t("ch_funnel")} subtitle={t("ch_funnel_d")}
          table={{ head: [t("st_step"), t("st_users_n"), "%"], rows: funRows.map((r) => [r.label, r.value, r.sub ?? ""]) }}>
          <HBars rows={funRows} color={COLORS.people} fmt={(v) => nf.format(v)} empty={t("reco_none")} />
        </ChartCard>
        <ChartCard loading={loading} title={t("ch_top")} subtitle={t("ch_top_d")}
          table={{ head: [t("adm_user"), t("st_analyses_n"), "USD"], rows: top.map((r) => [r.full_name || r.email, Number(r.analyses), usd(Number(r.cost_usd))]) }}>
          <HBars rows={top.map((r) => ({ label: r.full_name || r.email, sub: `${r.analyses}×`, value: Number(r.cost_usd) }))} color={COLORS.cost} fmt={usd} empty={t("reco_none")} />
        </ChartCard>
        <ChartCard loading={loading} title={t("ch_users")} subtitle={t("ch_users_d")} series={sUsers}
          table={{ head: [t("date"), t("st_new_users")], rows: D.map((r) => [r.day, r.new_users]) }}>
          <TimeChart data={uPts} series={sUsers} fmt={(v) => nf.format(v)} />
        </ChartCard>
        <ChartCard wide loading={loading} title={t("ch_visits")} subtitle={vs?.enabled ? t("ch_visits_d") : t("visits_off")} series={sVis}
          table={{ head: [t("date"), t("visits_total")], rows: vDays.map((r) => [r.d, r.n]) }}>
          <TimeChart data={vPts} series={sVis} fmt={(v) => nf.format(v)} />
        </ChartCard>
        <ChartCard loading={loading} title={t("visits_countries")} subtitle={t("ch_countries_d")}
          table={{ head: [t("country"), t("visits_total")], rows: ctry.map((c) => [`${c.label} (${c.sub})`, c.value]) }}>
          <HBars rows={ctry} color={COLORS.people} fmt={(v) => nf.format(v)} empty={t("reco_none")} />
        </ChartCard>
      </div>
      <p className="muted small">{t("st_note")}</p>
    </div>
  );
}
