// Kiểm tra tương phản màu theo WCAG 2.2 (SC 1.4.3: chữ thường >= 4.5:1; SC 1.4.11: thành phần giao diện >= 3:1).
// Đọc trực tiếp các biến màu trong src/styles.css để mọi chỉnh sửa màu đều bị kiểm tra lại.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
type Rgb = [number, number, number];
const hex = (s: string): Rgb => { const h = s.trim().replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) as Rgb; };
const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (c: Rgb) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a: Rgb, b: Rgb) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a: Rgb, b: Rgb, p: number): Rgb => [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)) as Rgb;

/** Gom các khai báo --biến trong những khối chọn lọc theo chủ đề. */
function tokens(selector: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(new RegExp(selector.source + String.raw`\s*\{([^}]*)\}`, "gm"))) for (const d of m[m.length - 1].matchAll(/--([\w-]+):\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  return out;
}
const dark = tokens(/^:root(?![^{]*data-theme)/m);
const light = { ...tokens(/:root\[data-theme="light"\]/), ...tokens(/:root:not\(\[data-theme="dark"\]\)/) };
const themes: Record<string, Record<string, string>> = { dark, light: { ...dark, ...light } };

for (const [name, t] of Object.entries(themes)) {
  const c = (k: string) => hex(t[k]);
  for (const k of ["bg","card-solid","text","muted","accent","accent2","good","warn","bad","blue","teal","amber","emerald","violet","gold","on-accent","on-gold"]) assert.ok(t[k], `thiếu biến --${k} (${name})`);
  const bg = c("bg"), card = c("card-solid");
  // Nền thực tế của chữ: nền trang, thẻ, và các nền pha màu nhấn (nút chọn, nhãn, ô chọn).
  const surfaces: Record<string, Rgb> = { "nền trang": bg, "thẻ": card, "thẻ pha accent 16%": mix(c("accent"), card, 0.16), "nền pha accent 16%": mix(c("accent"), bg, 0.16), "thẻ pha vàng 10%": mix(c("gold"), card, 0.1), "thẻ pha accent 18% (nút liên kết, chọn)": mix(c("accent"), card, 0.18), "nút chọn nổi bật, đầu accent2 (14%)": mix(c("accent2"), card, 0.14) };
  test(`[${name}] chữ chính và chữ phụ đạt 4.5:1 trên mọi nền`, () => {
    for (const fg of ["text", "muted", "accent", "accent2", "good", "warn", "bad", "blue", "teal", "amber", "emerald", "violet", "gold"]) for (const [sn, s] of Object.entries(surfaces)) {
      const r = ratio(c(fg), s); assert.ok(r >= 4.5, `${fg} trên ${sn}: ${r.toFixed(2)} < 4.5`);
    }
  });
  test(`[${name}] chữ chính/phụ trên các nền pha trạng thái (good, bad, amber, gold) đạt 4.5:1`, () => {
    for (const k of ["good", "bad", "amber", "gold", "warn"]) for (const fg of ["text", "muted"]) { const r = ratio(c(fg), mix(c(k), card, 0.18)); assert.ok(r >= 4.5, `${fg} trên thẻ pha ${k} 18%: ${r.toFixed(2)} < 4.5`); }
  });
  test(`[${name}] chữ trên nút/nhãn tô màu đạt 4.5:1`, () => {
    for (const [fg, bgk] of [["on-accent", "accent"], ["on-accent", "accent2"], ["on-gold", "gold"]]) { const r = ratio(c(fg), c(bgk)); assert.ok(r >= 4.5, `${fg} trên ${bgk}: ${r.toFixed(2)} < 4.5`); }
  });
  test(`[${name}] viền trạng thái đạt 3:1 so với thẻ`, () => {
    for (const k of ["accent", "amber", "good", "bad"]) { const r = ratio(c(k), card); assert.ok(r >= 3, `${k} trên thẻ: ${r.toFixed(2)} < 3`); }
  });
}
