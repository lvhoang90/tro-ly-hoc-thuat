// Dự báo ngân sách API: còn dùng được bao lâu và nên nạp bao nhiêu, vào lúc nào.
// Thuần tính toán (không gọi mạng), dùng chung cho giao diện quản trị và kiểm thử.
//
// Ý tưởng: lấy mức tiêu hao theo ngày từ nhật ký chi phí thật, ước lượng mức hiện tại bằng trung bình trượt
// nghiêng về ngày gần đây (nửa đời 7 ngày), điều chỉnh theo xu hướng tuần (tuần này so với tuần trước, giảm
// bớt một nửa để không phóng đại), theo nhịp các ngày trong tuần (khi có đủ ba tuần dữ liệu), rồi mô phỏng từng
// ngày cho ba kịch bản (thấp, kỳ vọng, cao) cho tới khi hết tiền.

export interface DayCost { day: string; cost: number }
export type BudgetLevel = "ok" | "soon" | "urgent" | "empty";
export interface Scenario { daysLeft: number; date: string | null }
export interface BudgetForecast {
  level: BudgetLevel;
  remaining: number;
  burn: { avg7: number; avg30: number; ewma: number; trend: number; peak: number };
  low: Scenario; expected: Scenario; high: Scenario;
  topUp: { amount: number; by: string | null; horizonDays: number };
  confidence: "low" | "medium" | "high";
  activeDays: number;
}
export interface BudgetOptions { warnDays?: number; horizonDays?: number; leadDays?: number; bufferPct?: number }

const DAY = 86400000;
const parse = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const addDays = (d: string, n: number) => new Date(parse(d) + n * DAY).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(parse(d)).getUTCDay();
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function forecastBudget(input: DayCost[], remaining: number, today: string, opt: BudgetOptions = {}): BudgetForecast {
  const warn = opt.warnDays ?? 14, horizon = opt.horizonDays ?? 30, lead = opt.leadDays ?? 5, buffer = 1 + (opt.bufferPct ?? 20) / 100;
  // Chỉ dùng các ngày đã trọn vẹn (bỏ hôm nay) và bỏ chuỗi ngày 0 ở đầu (trước khi có người dùng).
  let days = input.filter((d) => d.day < today).sort((a, b) => (a.day < b.day ? -1 : 1));
  const first = days.findIndex((d) => d.cost > 0);
  days = first < 0 ? [] : days.slice(first);
  const costs = days.map((d) => d.cost);
  const n = costs.length, activeDays = costs.filter((c) => c > 0).length;
  const last = (k: number) => costs.slice(-Math.min(k, n));
  const avg7 = mean(last(7)), avg30 = mean(last(30));
  let wSum = 0, ewma = 0;
  for (let i = 0; i < n; i++) { const w = Math.pow(0.5, (n - 1 - i) / 7); ewma += costs[i] * w; wSum += w; }
  ewma = wSum ? ewma / wSum : 0;
  const peak = Math.max(0, ...costs.slice(-14));
  let trend = 1;
  if (n >= 14) { const cur = mean(costs.slice(-7)), prev = mean(costs.slice(-14, -7)); trend = prev > 0 ? cur / prev : cur > 0 ? 1.5 : 1; }
  trend = Math.min(2, Math.max(0.5, trend));
  const weeklyG = Math.sqrt(trend);
  // Nhịp theo ngày trong tuần, co về 1 một nửa để không bị nhiễu khi ít dữ liệu.
  const season = Array(7).fill(1) as number[];
  if (n >= 21) {
    const overall = mean(costs), sums = Array(7).fill(0), cnt = Array(7).fill(0);
    days.forEach((d, i) => { const w = weekday(d.day); sums[w] += costs[i]; cnt[w]++; });
    const raw = sums.map((s, w) => (cnt[w] && overall > 0 ? 0.5 + 0.5 * (s / cnt[w] / overall) : 1));
    const m = mean(raw); raw.forEach((v, w) => (season[w] = v / m));
  }
  const grow = (g: number, k: number) => Math.min(3, Math.pow(g, k / 7));
  const scenarios = {
    low: (k: number) => Math.min(avg7, avg30, ewma) * season[weekday(addDays(today, k))],
    expected: (k: number) => ewma * grow(weeklyG, k) * season[weekday(addDays(today, k))],
    high: (k: number) => 1.25 * Math.max(avg7, ewma) * grow(Math.max(weeklyG, 1.15), k) * season[weekday(addDays(today, k))],
  };
  const run = (daily: (k: number) => number): Scenario => {
    if (remaining <= 0) return { daysLeft: 0, date: today };
    let cum = 0;
    for (let k = 1; k <= 365; k++) {
      const d = daily(k); cum += d;
      if (cum >= remaining) { const left = k - 1 + (d > 0 ? (remaining - (cum - d)) / d : 0); return { daysLeft: left, date: addDays(today, Math.floor(left)) }; }
    }
    return { daysLeft: Infinity, date: null };
  };
  const low = run(scenarios.low), expected = run(scenarios.expected), high = run(scenarios.high);
  let level: BudgetLevel = "ok";
  if (remaining <= 0) level = "empty";
  else if (expected.daysLeft <= 7 || high.daysLeft <= 3) level = "urgent";
  else if (expected.daysLeft <= warn || high.daysLeft <= warn) level = "soon"; // thận trọng: kịch bản xấu cũng tính
  let need = 0; for (let k = 1; k <= horizon; k++) need += scenarios.expected(k);
  const amount = Math.max(0, Math.ceil((need * buffer - Math.max(remaining, 0)) / 5) * 5);
  let by: string | null = null;
  if (expected.date) { by = addDays(expected.date, -lead); if (by < today) by = today; }
  return {
    level, remaining, burn: { avg7, avg30, ewma, trend, peak }, low, expected, high, topUp: { amount, by, horizonDays: horizon },
    confidence: activeDays >= 21 ? "high" : activeDays >= 7 ? "medium" : "low", activeDays,
  };
}
