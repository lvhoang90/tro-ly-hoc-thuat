import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n.tsx";

// Biểu đồ SVG nhẹ, không phụ thuộc thư viện ngoài. Quy ước (theo bộ quy tắc dataviz):
// một trục Y duy nhất; cột rộng tối đa 24px, đầu cột bo 4px, các đoạn xếp chồng cách nhau 2px nền;
// đường 2px, chấm r=4 có vòng nền 2px; vùng tô 10%; lưới mảnh 1px; chú giải khi từ 2 chuỗi trở lên;
// tooltip có đường dóng và hiện mọi chuỗi; mọi biểu đồ có chế độ bảng; chữ dùng màu chữ, không dùng màu dữ liệu.

export interface Series { key: string; label: string; color: string; kind: "area" | "line" | "bar" }
export interface Point { x: string; v: number[] }

/** Chia trục thành các bước tròn (1, 2, 2.5, 5 × 10^k) để nhãn trục sạch: 0, 100k, 200k... */
const scale = (max: number) => {
  if (!(max > 0)) return { top: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const rough = max / 4, p = Math.pow(10, Math.floor(Math.log10(rough))), f = rough / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  const top = Math.ceil((max - 1e-9) / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1e6; v += step) ticks.push(+v.toPrecision(12));
  return { top, ticks };
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(el); setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Khung biểu đồ: tiêu đề, chú giải, nút chuyển Biểu đồ/Bảng, giữ khung khi đang tải. */
export function ChartCard({ title, subtitle, series, table, loading, children, wide }: {
  title: string; subtitle?: string; series?: Series[]; table?: { head: string[]; rows: (string | number)[][] };
  loading?: boolean; children: ReactNode; wide?: boolean;
}) {
  const { t } = useI18n();
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={`chart-card ${wide ? "wide" : ""} ${loading ? "loading" : ""}`}>
      <figcaption>
        <div><h4>{title}</h4>{subtitle && <p>{subtitle}</p>}</div>
        {table && <button className="mini-toggle" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>{asTable ? t("view_chart") : t("view_table")}</button>}
      </figcaption>
      {series && series.length > 1 && (
        <ul className="legend">{series.map((s) => <li key={s.key}><i style={{ background: s.color }} />{s.label}</li>)}</ul>
      )}
      {asTable && table ? (
        <div className="table-wrap tview"><table className="tbl"><thead><tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
      ) : children}
    </figure>
  );
}

/** Chuỗi theo trục X (ngày hoặc nhãn): cột (có thể xếp chồng), đường, vùng. Một trục Y. */
export function TimeChart({ data, series, fmt, stacked, height = 210, ref0 }: {
  data: Point[]; series: Series[]; fmt: (v: number, si: number) => string; stacked?: boolean; height?: number;
  ref0?: { at: number; label: string };   // đường tham chiếu dọc tại chỉ số cột (ví dụ ngưỡng 60 điểm)
}) {
  const [box, W] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const H = height, m = { l: 44, r: 12, t: 12, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const n = data.length;
  const tot = (p: Point) => (stacked ? p.v.reduce((a, b) => a + b, 0) : Math.max(...p.v, 0));
  const { top, ticks } = scale(Math.max(...data.map(tot), 0));
  const X = (i: number) => m.l + (n <= 1 ? iw / 2 : (iw * (i + 0.5)) / n);
  const Y = (v: number) => m.t + ih - (v / top) * ih;
  const slot = iw / Math.max(n, 1);
  const bw = Math.min(24, Math.max(3, slot - 3));
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 62))));
  const bars = series.map((s, i) => [s, i] as const).filter(([s]) => s.kind === "bar");
  const lines = series.map((s, i) => [s, i] as const).filter(([s]) => s.kind !== "bar");

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - m.l) / iw) * n - 0.5);
    setHi(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setHi((h) => Math.min(n - 1, (h ?? -1) + 1));
    if (e.key === "ArrowLeft") setHi((h) => Math.max(0, (h ?? n) - 1));
    if (e.key === "Escape") setHi(null);
  };

  // đoạn cột xếp chồng: đầu trên bo 4px, các đoạn cách nhau 2px nền
  const barRects = bars.flatMap(([s, si]) => data.map((p, i) => {
    const base = stacked ? series.slice(0, si).reduce((a, q, qi) => a + (q.kind === "bar" ? p.v[qi] : 0), 0) : 0;
    const v = p.v[si]; if (!(v > 0)) return null;
    const y1 = Y(base + v), y0 = Y(base);
    const h = Math.max(0, y0 - y1 - (stacked && base > 0 ? 2 : 0));
    const x = X(i) - bw / 2;
    const isTop = !(stacked && series.some((q, qi) => qi > si && q.kind === "bar" && p.v[qi] > 0)); // chỉ đoạn trên cùng mới bo đầu
    const r = Math.min(4, h / 2, bw / 2);
    const d = isTop ? `M${x} ${y1 + h}V${y1 + r}Q${x} ${y1} ${x + r} ${y1}H${x + bw - r}Q${x + bw} ${y1} ${x + bw} ${y1 + r}V${y1 + h}Z` : `M${x} ${y1}H${x + bw}V${y1 + h}H${x}Z`;
    return <path key={`${si}-${i}`} d={d} fill={s.color} opacity={hi === null || hi === i ? 1 : 0.45} />;
  }));

  return (
    <div ref={box} className="chart-box" style={{ height: H }} tabIndex={0} onKeyDown={onKey} onBlur={() => setHi(null)} role="img" aria-label={series.map((s) => s.label).join(", ")}>
      <svg width={W} height={H} onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
        {ticks.map((tv, i) => (
          <g key={i}><line x1={m.l} x2={W - m.r} y1={Y(tv)} y2={Y(tv)} className="grid" />
            <text x={m.l - 8} y={Y(tv) + 4} textAnchor="end" className="axis">{fmt(tv, 0).replace(/\.0+$/, "")}</text></g>
        ))}
        {data.map((p, i) => i % every === 0 && <text key={p.x} x={X(i)} y={H - 6} textAnchor="middle" className="axis">{p.x}</text>)}
        {ref0 && <g><line x1={m.l + slot * ref0.at} x2={m.l + slot * ref0.at} y1={m.t} y2={m.t + ih} className="refline" /><text x={m.l + slot * ref0.at + 4} y={m.t + 10} className="axis strong">{ref0.label}</text></g>}
        {lines.map(([s, si]) => {
          const pts = data.map((p, i) => [X(i), Y(p.v[si])] as const);
          const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
          return (
            <g key={s.key}>
              {s.kind === "area" && n > 1 && <path d={`${d}L${pts[n - 1][0]} ${Y(0)}L${pts[0][0]} ${Y(0)}Z`} fill={s.color} opacity={0.1} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {n > 0 && <circle cx={pts[n - 1][0]} cy={pts[n - 1][1]} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
              {hi !== null && <circle cx={pts[hi][0]} cy={pts[hi][1]} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
            </g>
          );
        })}
        {barRects}
        {hi !== null && <line x1={X(hi)} x2={X(hi)} y1={m.t} y2={m.t + ih} className="crosshair" />}
        {n === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" className="axis">—</text>}
      </svg>
      {hi !== null && data[hi] && (
        <div className="tip" style={{ left: Math.min(Math.max(X(hi), 70), W - 70), top: 4 }}>
          <b>{data[hi].x}</b>
          {series.map((s, si) => <div key={s.key} className="tip-row"><i style={{ background: s.color }} /><strong>{fmt(data[hi].v[si], si)}</strong><span>{s.label}</span></div>)}
        </div>
      )}
    </div>
  );
}

/** Thanh ngang xếp hạng: giá trị ở đầu thanh, tên bên trái, tooltip khi di chuột. */
export function HBars({ rows, color, fmt, empty }: { rows: { label: string; value: number; sub?: string }[]; color: string; fmt: (v: number) => string; empty?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  const [hi, setHi] = useState<number | null>(null);
  if (!rows.length || max <= 0) return <p className="muted small chart-empty">{empty ?? "—"}</p>;
  return (
    <ul className="hbars">
      {rows.map((r, i) => (
        <li key={r.label + i} onPointerEnter={() => setHi(i)} onPointerLeave={() => setHi(null)} onFocus={() => setHi(i)} onBlur={() => setHi(null)} tabIndex={0} className={hi === i ? "hot" : ""}>
          <span className="hb-label" title={r.label}>{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <span className="hb-track"><span className="hb-bar" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} /></span>
          <strong className="hb-val">{fmt(r.value)}</strong>
        </li>
      ))}
    </ul>
  );
}

/** Ô chỉ số: số lớn, chú thích, đường nhỏ xu hướng (tùy chọn). */
export function Kpi({ label, value, sub, spark, color, tone }: { label: string; value: string; sub?: ReactNode; spark?: number[]; color?: string; tone?: "warn" | "good" }) {
  const W = 120, H = 34;
  const path = useMemo(() => {
    if (!spark || spark.length < 2) return "";
    const max = Math.max(...spark, 1e-9);
    return spark.map((v, i) => `${i ? "L" : "M"}${((i / (spark.length - 1)) * W).toFixed(1)} ${(H - 4 - (v / max) * (H - 8)).toFixed(1)}`).join("");
  }, [spark]);
  return (
    <div className={`kpi ${tone ?? ""}`}>
      <span className="kpi-label">{label}</span>
      <b className="kpi-value">{value}</b>
      {sub && <span className="kpi-sub">{sub}</span>}
      {path && <svg className="kpi-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={`${path}L${W} ${H}L0 ${H}Z`} fill={color} opacity={0.1} /><path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </div>
  );
}
