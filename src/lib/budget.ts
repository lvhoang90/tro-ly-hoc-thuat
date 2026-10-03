import { useCallback, useEffect, useMemo, useState } from "react";
import { forecastBudget, type BudgetForecast, type DayCost } from "../../shared/budget.ts";
import { supabase } from "./supabase.ts";

export interface BudgetEntry { at: string; kind: "start" | "topup" | "check"; amount_usd: number; balance_usd: number }
export interface BudgetConfig { balance_usd: number; as_of: string; warn_days: number; history: BudgetEntry[] }
export interface BudgetState {
  loading: boolean; error: string | null; missing: boolean;       // missing: chưa chạy bản cập nhật cơ sở dữ liệu
  config: BudgetConfig | null; spent: number; remaining: number;
  tokensPerUsd: number; avgCostPerAnalysis: number; forecast: BudgetForecast | null;
  save: (c: BudgetConfig) => Promise<string | null>; reload: () => void;
}

const KEY = "api_budget";
const vnDay = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);

/** Tải cấu hình ngân sách, chi phí kể từ mốc nhập số dư và chuỗi chi phí 60 ngày; tính số dư còn lại và dự báo. */
export function useApiBudget(): BudgetState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [config, setConfig] = useState<BudgetConfig | null>(null);
  const [spent, setSpent] = useState(0);
  const [days, setDays] = useState<(DayCost & { tokens: number; analyses: number })[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    void (async () => {
      setLoading(true); setError(null); setMissing(false);
      const [kv, ts] = await Promise.all([supabase.from("admin_kv").select("value").eq("key", KEY).maybeSingle(), supabase.rpc("admin_timeseries", { p_days: 60 })]);
      if (off) return;
      if (kv.error) { setMissing(/admin_kv|relation|does not exist|schema cache/i.test(kv.error.message)); setError(kv.error.message); setLoading(false); return; }
      const raw = kv.data?.value as Partial<BudgetConfig> | undefined;
      const cfg: BudgetConfig | null = raw && Number.isFinite(Number(raw.balance_usd)) && raw.as_of
        ? { balance_usd: Number(raw.balance_usd), as_of: raw.as_of, warn_days: Math.min(60, Math.max(3, Number(raw.warn_days) || 14)), history: Array.isArray(raw.history) ? raw.history : [] } : null;
      setConfig(cfg);
      setDays(((ts.data ?? []) as { day: string; cost_usd: number; input_tokens: number; output_tokens: number; analyses: number; refunded: number }[])
        .map((r) => ({ day: r.day, cost: Number(r.cost_usd), tokens: Number(r.input_tokens) + Number(r.output_tokens), analyses: Number(r.analyses) + Number(r.refunded) })));
      if (cfg) {
        const sp = await supabase.rpc("admin_spend_since", { p_since: cfg.as_of });
        if (off) return;
        if (sp.error) { setMissing(/admin_spend_since|function|schema cache/i.test(sp.error.message)); setError(sp.error.message); }
        else setSpent(Number((sp.data as { cost_usd: number }[] | null)?.[0]?.cost_usd ?? 0));
      } else setSpent(0);
      setLoading(false);
    })();
    return () => { off = true; };
  }, [tick]);

  const save = useCallback(async (c: BudgetConfig) => {
    const { error: e } = await supabase.from("admin_kv").upsert({ key: KEY, value: { ...c, history: c.history.slice(-12) }, updated_at: new Date().toISOString() });
    if (e) return e.message;
    setTick((x) => x + 1); return null;
  }, []);

  const derived = useMemo(() => {
    const remaining = (config?.balance_usd ?? 0) - spent;
    const last30 = days.slice(-30);
    const c30 = last30.reduce((a, r) => a + r.cost, 0), t30 = last30.reduce((a, r) => a + r.tokens, 0), n30 = last30.reduce((a, r) => a + r.analyses, 0);
    const forecast = config && days.length ? forecastBudget(days, remaining, vnDay(new Date()), { warnDays: config.warn_days }) : null;
    return { remaining, tokensPerUsd: c30 > 0 ? t30 / c30 : 0, avgCostPerAnalysis: n30 > 0 ? c30 / n30 : 0, forecast };
  }, [config, spent, days]);

  return { loading, error, missing, config, spent, ...derived, save, reload: () => setTick((x) => x + 1) };
}
