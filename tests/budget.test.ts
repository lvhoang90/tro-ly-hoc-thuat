// Dự báo ngân sách API: mức tiêu hao, số ngày còn lại, khuyến nghị nạp tiền.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, forecastBudget, type DayCost } from "../shared/budget.ts";

const TODAY = "2026-10-03";
const series = (n: number, f: (i: number) => number): DayCost[] => Array.from({ length: n + 1 }, (_, i) => ({ day: addDays(TODAY, -(n - i)), cost: i === n ? 0.3 : f(i) }));

test("tiêu hao đều 1 USD/ngày, còn 10 USD: khoảng 10 ngày, ngày hết đúng", () => {
  const f = forecastBudget(series(30, () => 1), 10, TODAY);
  assert.ok(Math.abs(f.expected.daysLeft - 10) < 0.2, String(f.expected.daysLeft));
  assert.equal(f.expected.date, addDays(TODAY, 10));
  assert.equal(f.level, "soon");
  assert.equal(f.confidence, "high");
});

test("ba kịch bản theo thứ tự: thấp lâu nhất, cao ngắn nhất", () => {
  const f = forecastBudget(series(30, (i) => 1 + (i % 3) * 0.5), 40, TODAY);
  assert.ok(f.low.daysLeft >= f.expected.daysLeft && f.expected.daysLeft > f.high.daysLeft);
});

test("mức dùng đang tăng thì hết sớm hơn mức dùng đều cùng trung bình", () => {
  const flat = forecastBudget(series(28, () => 2), 60, TODAY);
  const up = forecastBudget(series(28, (i) => (i < 21 ? 1 : 3)), 60, TODAY);
  assert.ok(up.burn.trend > 1.5);
  assert.ok(up.expected.daysLeft < flat.expected.daysLeft);
});

test("ngày gần đây nặng hơn ngày xa (trung bình trượt nghiêng về gần)", () => {
  const f = forecastBudget(series(28, (i) => (i < 21 ? 1 : 4)), 100, TODAY);
  assert.ok(f.burn.ewma > f.burn.avg30);
});

test("chưa có chi phí: không giới hạn ngày, mức tin cậy thấp, không khuyến nghị nạp", () => {
  const f = forecastBudget(series(10, () => 0), 20, TODAY);
  assert.equal(f.expected.daysLeft, Infinity); assert.equal(f.expected.date, null);
  assert.equal(f.confidence, "low"); assert.equal(f.level, "ok"); assert.equal(f.topUp.amount, 0);
});

test("hết tiền hoặc âm: mức empty, ngày hết là hôm nay", () => {
  const f = forecastBudget(series(10, () => 1), -2, TODAY);
  assert.equal(f.level, "empty"); assert.equal(f.expected.daysLeft, 0); assert.equal(f.expected.date, TODAY);
});

test("khuyến nghị nạp: đủ 30 ngày cộng 20% dự phòng, làm tròn lên 5 USD, nạp trước ngày hết 5 ngày", () => {
  const f = forecastBudget(series(30, () => 2), 20, TODAY);
  assert.equal(f.topUp.amount, 55);                    // 2×30×1,2 − 20 = 52 → 55
  assert.equal(f.topUp.by, addDays(TODAY, 10 - 5));   // hết sau 10 ngày, nạp trước 5 ngày
});

test("còn nhiều tiền thì không cần nạp thêm", () => {
  const f = forecastBudget(series(30, () => 1), 500, TODAY);
  assert.equal(f.topUp.amount, 0); assert.equal(f.level, "ok");
});

test("nhịp theo thứ trong tuần được học khi có đủ 3 tuần dữ liệu", () => {
  const heavyOnMonday = series(35, (i) => (new Date(Date.parse(addDays(TODAY, -(35 - i)))).getUTCDay() === 1 ? 5 : 1));
  const f = forecastBudget(heavyOnMonday, 30, TODAY);
  const flat = forecastBudget(series(35, () => 1.571), 30, TODAY);
  assert.ok(Math.abs(f.expected.daysLeft - flat.expected.daysLeft) < 3);
});

// ---------- Sửa và hoàn tác lần ghi gần nhất ----------
import { editLastEntry, undoLastEntry, type BudgetConfig } from "../shared/budget.ts";
const cfgOf = (history: BudgetConfig["history"]): BudgetConfig => ({ balance_usd: history[history.length - 1].balance_usd, as_of: history[history.length - 1].at, warn_days: 14, history });
const H = {
  start: { at: "2026-10-01T00:00:00Z", kind: "start" as const, amount_usd: 20, balance_usd: 20 },
  topup: { at: "2026-10-05T00:00:00Z", kind: "topup" as const, amount_usd: 50, balance_usd: 62 },   // trước đó còn 12
  check: { at: "2026-10-08T00:00:00Z", kind: "check" as const, amount_usd: -3, balance_usd: 59 },    // trước đó còn 62
};

test("sửa số tiền nạp nhập nhầm: số dư tính lại từ số dư trước đó, giữ nguyên thời điểm", () => {
  const n = editLastEntry(cfgOf([H.start, H.topup]), 5)!;     // lỡ gõ 50 thay vì 5
  assert.equal(n.balance_usd, 17); assert.equal(n.as_of, H.topup.at);
  assert.equal(n.history[1].amount_usd, 5); assert.equal(n.history[1].balance_usd, 17); assert.equal(n.history.length, 2);
});

test("sửa số dư đã nhập lúc bắt đầu", () => {
  const n = editLastEntry(cfgOf([H.start]), 200)!;            // lỡ gõ 20 thay vì 200
  assert.equal(n.balance_usd, 200); assert.equal(n.history[0].amount_usd, 200); assert.equal(n.history[0].balance_usd, 200);
});

test("sửa lần đối chiếu: số dư đúng thay đổi, chênh lệch tính lại", () => {
  const n = editLastEntry(cfgOf([H.start, H.topup, H.check]), 60)!;
  assert.equal(n.balance_usd, 60); assert.equal(n.history[2].amount_usd, -2);   // 60 − 62
});

test("giá trị không hợp lệ bị từ chối: nạp ≤ 0, số dư âm, không phải số", () => {
  assert.equal(editLastEntry(cfgOf([H.start, H.topup]), 0), null);
  assert.equal(editLastEntry(cfgOf([H.start, H.check]), -1), null);
  assert.equal(editLastEntry(cfgOf([H.start]), NaN), null);
});

test("hoàn tác quay về mốc trước đó; chỉ còn một lần ghi thì báo xóa thiết lập", () => {
  const u = undoLastEntry(cfgOf([H.start, H.topup, H.check]))!;
  assert.equal(u.balance_usd, 62); assert.equal(u.as_of, H.topup.at); assert.equal(u.history.length, 2);
  assert.equal(undoLastEntry(cfgOf([H.start])), null);
});
