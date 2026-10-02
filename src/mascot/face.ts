import type { FaceState } from "./types.ts";

const CYAN = "#7dd3fc", VIOLET = "#c4b5fd", PINK = "rgba(251,113,133,.55)", AMBER = "#fcd34d";

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + rad, y); c.arcTo(x + w, y, x + w, y + h, rad); c.arcTo(x + w, y + h, x, y + h, rad); c.arcTo(x, y + h, x, y, rad); c.arcTo(x, y, x + w, y, rad); c.closePath();
}

/** Vẽ khuôn mặt trên kính che (visor) của robot: mắt, lông mày, miệng theo cảm xúc. */
export function drawFace(c: CanvasRenderingContext2D, w: number, h: number, f: FaceState) {
  c.clearRect(0, 0, w, h);
  const m = f.mood;
  const col = m === "alert" ? AMBER : m === "think" ? VIOLET : CYAN;
  let ew = w * 0.125, eh = h * 0.34;
  const cy0 = h * 0.42, cxL = w * 0.31, cxR = w * 0.69;
  let gx = f.gx, gy = f.gy;
  if (m === "think") { gx = -0.7; gy = -0.9; eh *= 0.82; }
  if (m === "read") { gx = Math.sin(f.t * 3.2); gy = 0.2; eh *= 0.42; }
  if (m === "care") { ew *= 1.08; eh *= 1.1; gy = 0.1; }
  if (m === "alert") { ew *= 0.95; eh = ew * 2.0; }
  const blink = m === "sleep" ? 1 : f.blink;
  const ox = gx * w * 0.022, oy = gy * h * 0.04;

  c.lineCap = "round"; c.lineJoin = "round";
  c.shadowColor = col; c.shadowBlur = w * 0.045; c.fillStyle = col; c.strokeStyle = col;

  const happyEyes = m === "happy" || m === "celebrate" || m === "wave";
  const arcEye = (cx: number, down: boolean) => {
    c.lineWidth = w * 0.036; c.beginPath();
    if (down) c.arc(cx + ox * 0.4, cy0 - eh * 0.1, ew * 0.82, 0.12 * Math.PI, 0.88 * Math.PI);
    else c.arc(cx + ox * 0.4, cy0 + eh * 0.22, ew * 0.82, 1.12 * Math.PI, 1.88 * Math.PI);
    c.stroke();
  };

  for (const cx of [cxL, cxR]) {
    if (m === "sleep") { arcEye(cx, true); continue; }
    if (happyEyes && blink < 0.5 && !(m === "wave" && Math.floor(f.t * 2) % 4 === 0)) { arcEye(cx, false); continue; }
    const hh = Math.max(w * 0.012, eh * (1 - blink * 0.94));
    rr(c, cx - ew / 2 + ox, cy0 - hh / 2 + oy, ew, hh, ew * 0.48); c.fill();
    if (blink < 0.35 && hh > eh * 0.5) {
      c.shadowBlur = 0; c.fillStyle = "rgba(255,255,255,.88)";
      c.beginPath(); c.arc(cx - ew * 0.14 + ox, cy0 - hh * 0.22 + oy, ew * 0.17, 0, Math.PI * 2); c.fill();
      c.shadowBlur = w * 0.045; c.fillStyle = col;
    }
  }

  // Lông mày
  c.lineWidth = w * 0.026;
  if (m === "care") {
    c.beginPath(); c.moveTo(cxL - ew * 0.9, cy0 - eh * 0.88); c.lineTo(cxL + ew * 0.7, cy0 - eh * 1.16); c.stroke();
    c.beginPath(); c.moveTo(cxR + ew * 0.9, cy0 - eh * 0.88); c.lineTo(cxR - ew * 0.7, cy0 - eh * 1.16); c.stroke();
  } else if (m === "think") {
    c.beginPath(); c.moveTo(cxR - ew * 0.7, cy0 - eh * 0.85); c.lineTo(cxR + ew * 0.8, cy0 - eh * 1.12); c.stroke();
  } else if (m === "alert") {
    c.beginPath(); c.moveTo(cxL - ew * 0.7, cy0 - eh * 0.72); c.lineTo(cxL + ew * 0.7, cy0 - eh * 0.72); c.stroke();
    c.beginPath(); c.moveTo(cxR - ew * 0.7, cy0 - eh * 0.72); c.lineTo(cxR + ew * 0.7, cy0 - eh * 0.72); c.stroke();
  }

  // Miệng
  const my = h * 0.8, mw = w * 0.09;
  c.lineWidth = w * 0.03;
  if (m === "celebrate") {
    c.beginPath(); c.moveTo(w / 2 - mw * 1.4, my - h * 0.03); c.quadraticCurveTo(w / 2, my + h * 0.2, w / 2 + mw * 1.4, my - h * 0.03); c.closePath(); c.fill();
  } else if (m === "happy" || m === "wave") {
    c.beginPath(); c.arc(w / 2, my - h * 0.05, mw * 1.25, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  } else if (m === "alert") {
    c.beginPath(); c.ellipse(w / 2, my, mw * 0.5, h * 0.045, 0, 0, Math.PI * 2); c.fill();
  } else if (m === "think") {
    c.beginPath(); c.moveTo(w / 2 - mw * 0.5, my); c.quadraticCurveTo(w / 2, my - h * 0.03, w / 2 + mw * 0.9, my - h * 0.02); c.stroke();
  } else if (m === "care") {
    c.beginPath(); c.arc(w / 2, my - h * 0.07, mw * 0.95, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
  } else if (m === "sleep") {
    c.beginPath(); c.moveTo(w / 2 - mw * 0.6, my); c.lineTo(w / 2 + mw * 0.6, my); c.stroke();
    c.font = `800 ${h * 0.2}px sans-serif`; c.fillStyle = col;
    c.fillText("z", w * 0.78, h * (0.3 - ((f.t * 0.1) % 0.14))); c.fillText("Z", w * 0.86, h * (0.18 - ((f.t * 0.1) % 0.1)));
  } else {
    c.beginPath(); c.arc(w / 2, my - h * 0.05, mw, 0.18 * Math.PI, 0.82 * Math.PI); c.stroke();
  }

  c.shadowBlur = 0;
  if (happyEyes) { // má hồng
    c.fillStyle = PINK;
    for (const cx of [cxL - ew * 0.5, cxR + ew * 0.5]) { c.beginPath(); c.ellipse(cx, cy0 + eh * 0.62, ew * 0.5, h * 0.045, 0, 0, Math.PI * 2); c.fill(); }
  }
  if (m === "celebrate") { // lấp lánh
    c.strokeStyle = "#fff"; c.lineWidth = w * 0.012;
    for (const [sx, sy, ph] of [[0.1, 0.18, 0], [0.9, 0.2, 1.3], [0.5, 0.06, 2.4]] as const) {
      const s = w * 0.025 * (0.6 + 0.4 * Math.sin(f.t * 8 + ph));
      c.beginPath(); c.moveTo(w * sx - s, h * sy); c.lineTo(w * sx + s, h * sy); c.moveTo(w * sx, h * sy - s); c.lineTo(w * sx, h * sy + s); c.stroke();
    }
  }
}
