import { useEffect, useRef } from "react";

// Nền động khoa học: sóng xác suất lượng tử (giao thoa), công thức toán trôi nhẹ và chuỗi xoắn kép ADN.
// Tiết kiệm CPU/pin: giới hạn ~30 khung/giây, dừng khi tab ẩn, một khung tĩnh nếu người dùng chọn "giảm chuyển động".
const FORMULAS = [
  "iħ ∂ψ/∂t = Ĥψ", "E = mc²", "∇·E = ρ/ε₀", "e^{iπ} + 1 = 0", "ΔxΔp ≥ ħ/2", "P(A|B) = P(B|A)P(A)/P(B)",
  "σ = √(Σ(xᵢ−μ)²/N)", "H(X) = −Σ p log p", "∫ e^{−x²}dx = √π", "F = G m₁m₂/r²", "∇×B = μ₀J", "r = Σ zₓzᵧ / n",
  "y = β₀ + β₁x + ε", "A–T  G–C", "ψ(x,t)", "λ = h/p", "Σ 1/n² = π²/6", "df = ∂f/∂x dx",
];

interface Glyph { x: number; y: number; vx: number; vy: number; s: string; a: number; size: number }

export default function Background() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, t = 0, running = true, scrolling = false, scrollTimer = 0;
    let glyphs: Glyph[] = [];
    const css = () => getComputedStyle(document.documentElement);
    let c1 = "56,189,248", c2 = "167,139,250", c3 = "52,211,153";

    const resize = () => {
      dpr = 1; // nền chỉ là họa tiết mờ: không cần độ phân giải màn hình retina
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(6, Math.min(16, Math.round((w * h) / 110000)));
      glyphs = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.12,
        s: FORMULAS[i % FORMULAS.length], a: 0.07 + Math.random() * 0.09, size: 13 + Math.random() * 13,
      }));
      const cs = css();
      c1 = cs.getPropertyValue("--bg-c1").trim() || c1; c2 = cs.getPropertyValue("--bg-c2").trim() || c2; c3 = cs.getPropertyValue("--bg-c3").trim() || c3;
    };

    const waves = () => {
      // Hai nguồn sóng giao thoa: vẽ các đường mật độ xác suất |ψ|² theo hàng ngang.
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const y0 = h * (0.18 + (r / rows) * 0.7);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const k = 0.018 + r * 0.0016;
          const env = Math.exp(-Math.pow((x - w * 0.5) / (w * 0.42), 2));
          const psi = Math.sin(k * x - t * 0.9 + r) + Math.sin(k * 1.35 * x + t * 0.7 - r * 0.6);
          const y = y0 + psi * 16 * env + Math.sin(x * 0.004 + t * 0.2 + r) * 8;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${r % 2 ? c1 : c2},${0.09 + (r % 3) * 0.03})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    };

    const dna = () => {
      // Xoắn kép ADN ở mép phải, nghiêng nhẹ; các "cặp base" nối hai mạch.
      const cx = w * (w > 900 ? 0.86 : 0.93), len = h * 1.1, amp = w > 900 ? 46 : 24, n = 34;
      for (let i = 0; i < n; i++) {
        const p = i / n, y = -h * 0.05 + p * len, ph = p * 14 + t * 0.8;
        const x1 = cx + Math.sin(ph) * amp + p * 30, x2 = cx - Math.sin(ph) * amp + p * 30;
        const z1 = Math.cos(ph), z2 = -z1;
        ctx.strokeStyle = `rgba(${c3},${0.1 + Math.abs(Math.sin(ph)) * 0.05})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
        ctx.fillStyle = `rgba(${c1},${0.28 + z1 * 0.16})`; ctx.beginPath(); ctx.arc(x1, y, 2.6 + z1 * 1.2, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(${c2},${0.28 + z2 * 0.16})`; ctx.beginPath(); ctx.arc(x2, y, 2.6 + z2 * 1.2, 0, 7); ctx.fill();
      }
    };

    const text = () => {
      ctx.textBaseline = "middle";
      for (const g of glyphs) {
        g.x += g.vx; g.y += g.vy;
        if (g.x < -200) g.x = w + 100; if (g.x > w + 200) g.x = -100;
        if (g.y < -40) g.y = h + 20; if (g.y > h + 40) g.y = -20;
        ctx.font = `${g.size}px "Cambria Math","STIX Two Math","Times New Roman",serif`;
        ctx.fillStyle = `rgba(${c1},${g.a})`;
        ctx.fillText(g.s, g.x, g.y);
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!running || scrolling || now - last < 42) return; // ~24 khung/giây, tạm dừng khi đang cuộn trang
      last = now; t += 0.042;
      ctx.clearRect(0, 0, w, h);
      waves(); dna(); text();
    };

    resize();
    addEventListener("resize", resize);
    const onScroll = () => { scrolling = true; clearTimeout(scrollTimer); scrollTimer = window.setTimeout(() => { scrolling = false; }, 180); };
    addEventListener("scroll", onScroll, { passive: true });
    const vis = () => { running = !document.hidden; };
    document.addEventListener("visibilitychange", vis);
    const mo = new MutationObserver(resize);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (reduce) { waves(); dna(); text(); } else raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); removeEventListener("scroll", onScroll); document.removeEventListener("visibilitychange", vis); mo.disconnect(); };
  }, []);
  return <canvas ref={ref} className="bg-canvas" aria-hidden="true" />;
}
