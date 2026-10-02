/* Lớp dựng cảnh cho clip "Hành trình cùng Ami" (30 giây, 1080×1920).
 * Mọi chuyển động là hàm của thời gian t (giây) để dựng khung hình xác định: window.__render(t). */
(() => {
  const W = 1080, H = 1920;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const eo = (p) => 1 - Math.pow(1 - p, 3);
  const eio = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const ob = (p) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const COL = { a: "#38bdf8", b: "#2dd4bf", c: "#34d399", d: "#fbbf24", e: "#f472b6", f: "#a78bfa" };
  const SC = { A: [0.2, 5.6], B: [5.7, 9.4], C: [9.4, 13.15], D: [13.15, 17.85], E: [17.85, 23.3], F: [23.3, 31] };
  /* Lời thoại (giờ bắt đầu/kết thúc khớp tệp giọng nói) */
  const VO = [
    { k: "hook", a: 0.45, b: 5.27, c: COL.a, text: "Chào bạn, mình là Ami! Tìm đúng tài liệu mất hàng giờ. Từ nay thì không nữa!" },
    { k: "upload", a: 5.85, b: 8.59, c: COL.b, text: "Thả vào tệp PDF, Word, hay cả bản quét." },
    { k: "score", a: 9.5, b: 12.53, c: COL.c, text: "Mình chấm điểm độ phù hợp, từ 0 đến 100." },
    { k: "pass", a: 13.3, b: 16.86, c: COL.d, text: "Rồi chọn đoạn đáng trích, kèm số trang, đối chiếu từng chữ." },
    { k: "cite", a: 18.0, b: 21.54, c: COL.e, text: "Chạm một cái, có ngay trích dẫn chuẩn, hơn 10.000 kiểu!" },
    { k: "end", a: 23.3, b: 26.72, c: COL.f, text: "Tệp của bạn không bị lưu trữ. Dùng thử miễn phí ngay nhé!" },
  ];
  /* Cảm xúc của Ami theo thời gian */
  const MOODS = [[0.0, "idle"], [0.35, "wave"], [3.7, "celebrate"], [5.85, "read"], [9.5, "think"], [11.4, "happy"], [13.3, "think"], [16.0, "happy"], [18.0, "happy"], [22.15, "celebrate"], [23.4, "wave"], [26.8, "happy"]];

  const css = `
  #vid{position:fixed;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;z-index:-1;font-family:'DejaVu Sans','Segoe UI',Arial,sans-serif;color:#eef2fb;background:#070b16}
  #vid *{box-sizing:border-box}
  #vid .abs{position:absolute;left:0;top:0;will-change:transform,opacity}
  #vid .blob{border-radius:50%}
  #vid .dots{position:absolute;inset:-60px;background-image:radial-gradient(rgba(255,255,255,.08) 2px,transparent 2px);background-size:44px 44px}
  #vid .card{position:absolute;left:60px;top:190px;width:960px;background:#fff;color:#0b1020;border-radius:44px;box-shadow:0 24px 40px rgba(0,0,0,.45),0 0 0 3px rgba(255,255,255,.14);padding:40px 44px;overflow:hidden}
  #vid .pill{display:inline-flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.1em;font-size:26px;padding:10px 24px;border-radius:99px;color:#04101f}
  #vid h2{font-size:56px;line-height:1.1;font-weight:800;margin-top:18px;color:#0b1020}
  #vid .bub{position:absolute;left:60px;top:985px;width:960px;min-height:170px;background:#fff;color:#0b1020;border-radius:36px;border:6px solid var(--c);box-shadow:0 12px 24px rgba(0,0,0,.4);padding:20px 34px 22px;z-index:6}
  #vid .bub::after{content:"";position:absolute;left:470px;bottom:-22px;width:36px;height:36px;background:#fff;border:6px solid var(--c);border-width:0 6px 6px 0;transform:rotate(45deg)}
  #vid .bub small{display:block;font-weight:800;letter-spacing:.18em;font-size:22px;color:var(--c);filter:brightness(.6);margin-bottom:4px}
  #vid .bub p{font-weight:800;font-size:44px;line-height:1.18}
  #vid .bub p span{display:inline-block}
  #vid .chip{display:inline-flex;align-items:center;justify-content:center;font-weight:800;border-radius:20px}
  #vid .grad{background:linear-gradient(90deg,#38bdf8,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
  #vid .paper{position:absolute;width:170px;height:224px;background:#fff;border-radius:12px;box-shadow:0 14px 30px rgba(0,0,0,.45);padding:22px 18px}
  #vid .paper i{display:block;height:9px;border-radius:5px;background:#cfd8ea;margin-bottom:14px}
  #vid .paper i:first-child{width:70%;background:#7aa7e8;height:12px}
  #vid .spark{position:absolute;width:16px;height:16px;border-radius:50%}
  #vid .row{display:flex;align-items:center;gap:18px}
  #vid .bar{height:22px;border-radius:12px;background:#e6ebf5;overflow:hidden;flex:1}
  #vid .bar b{display:block;height:100%;border-radius:12px}
  `;

  const logoSvg = `<svg viewBox="0 0 48 48" width="100%" height="100%"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#7c5cf0"/></linearGradient></defs><rect x="1" y="1" width="46" height="46" rx="12" fill="url(#lg)"/><path d="M5.5 40.5L24 6L42.5 40.5M9.57 32.91L38.43 32.91" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.79 40.5L24 17.73L36.21 40.5M14.48 35.49L33.52 35.49" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" fill="#fff" d="M17.71 40.5L24 28.77L30.29 40.5ZM21.86 40.5L24 33.7L26.14 40.5Z"/></svg>`;

  const root = document.createElement("div"); root.id = "vid";
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const mk = (html, cls = "abs", style = "") => { const d = document.createElement("div"); d.className = cls; d.style.cssText = style; d.innerHTML = html; root.appendChild(d); return d; };
  document.body.appendChild(root);

  /* nền */
  const bg1 = mk("", "abs blob", `width:900px;height:900px;background:radial-gradient(closest-side,rgba(29,111,168,.75),rgba(29,111,168,.3) 55%,transparent)`);
  const bg2 = mk("", "abs blob", `width:1000px;height:1000px;background:radial-gradient(closest-side,rgba(109,76,240,.65),rgba(109,76,240,.25) 55%,transparent)`);
  const dots = mk("", "dots");
  const halo = mk("", "abs", `left:${W / 2 - 420}px;top:1130px;width:840px;height:840px;border-radius:50%;background:radial-gradient(closest-side,rgba(56,189,248,.38),rgba(124,92,240,.2) 60%,transparent)`);
  /* nhãn thương hiệu trên cùng */
  const brand = mk(`<div style="width:64px;height:64px">${logoSvg}</div><div style="font-weight:800;font-size:30px;letter-spacing:.02em">Trợ lý học thuật <span style="color:#38bdf8">· AI Academic Agent 1.0</span></div>`, "abs row", `left:60px;top:74px;gap:18px`);

  /* ---- Cảnh A: mở đầu ---- */
  const A = mk("", "abs", `left:0;top:0;width:${W}px;height:${H}px`);
  const aKick = document.createElement("div"); aKick.style.cssText = `position:absolute;left:0;width:${W}px;top:250px;text-align:center;font-weight:800;font-size:40px;letter-spacing:.14em;color:#7dd3fc`; aKick.textContent = "TÌM ĐÚNG TÀI LIỆU CHO ĐỀ TÀI…"; A.appendChild(aKick);
  const papers = [];
  for (let i = 0; i < 18; i++) {
    const d = document.createElement("div"); d.className = "paper"; d.innerHTML = "<i></i><i></i><i></i><i></i><i style='width:60%'></i><i></i>"; A.appendChild(d);
    papers.push({ d, x: 120 + rnd(i) * 640, y: 330 + rnd(i + 40) * 380, r: -28 + rnd(i + 80) * 56, t0: 0.7 + i * 0.1, sx: 400 + rnd(i + 5) * 600 });
  }
  const aHours = document.createElement("div"); aHours.style.cssText = `position:absolute;left:0;width:${W}px;top:455px;text-align:center;font-weight:900;font-size:170px;line-height:1.3;color:#fff;text-shadow:0 10px 50px rgba(0,0,0,.7),0 0 0 #000;letter-spacing:-.02em`; aHours.textContent = "HÀNG GIỜ"; A.appendChild(aHours);
  const aStrike = document.createElement("div"); aStrike.style.cssText = `position:absolute;left:120px;top:585px;height:24px;border-radius:12px;background:#ef4444;box-shadow:0 0 30px #ef4444aa;transform-origin:left center`; A.appendChild(aStrike);
  const aMin = document.createElement("div"); aMin.style.cssText = `position:absolute;left:0;width:${W}px;top:455px;text-align:center;font-weight:900;font-size:160px;line-height:1.2;letter-spacing:-.02em`; aMin.className = "grad"; aMin.textContent = "VÀI PHÚT"; A.appendChild(aMin);
  const aSub = document.createElement("div"); aSub.style.cssText = `position:absolute;left:0;width:${W}px;top:700px;text-align:center;font-weight:800;font-size:44px;color:#cfd8ee`; aSub.textContent = "cùng trợ lý học thuật AI"; A.appendChild(aSub);

  /* ---- Cảnh B: tải tài liệu ---- */
  const B = mk(`<div class="pill" style="background:${COL.b}">1 · TẢI TÀI LIỆU</div><h2>Thả tài liệu vào</h2>
    <div id="bDrop" style="margin-top:26px;height:430px;border:6px dashed #94a3b8;border-radius:32px;background:#f1f5fb;position:relative">
      <div id="bIcon" style="position:absolute;left:0;right:0;top:60px;text-align:center;font-size:120px;line-height:1;color:#64748b">⬆</div>
      <div id="bHint" style="position:absolute;left:0;right:0;top:215px;text-align:center;font-weight:800;font-size:38px;color:#475569">PDF · DOC · DOCX · bản quét</div>
    </div>
    <div id="bProg" style="margin-top:34px"><div class="row" style="font-weight:800;font-size:34px;margin-bottom:14px"><span id="bProgT">Đang đọc tệp…</span><span id="bProgN" style="margin-left:auto;color:#0f766e">0%</span></div><div class="bar"><b id="bProgB" style="width:0;background:linear-gradient(90deg,#2dd4bf,#38bdf8)"></b></div></div>
    <div id="bDone" style="margin-top:26px;display:inline-flex;gap:14px;align-items:center;font-weight:800;font-size:34px;color:#065f46;background:#d1fae5;padding:14px 28px;border-radius:99px">✓ Sẵn sàng · đã đọc 12 trang</div>`, "card");
  const chipDefs = [["PDF", "#ef4444", -380, -520], ["DOC", "#2563eb", 520, -480], ["DOCX", "#1d4ed8", -420, 640], ["SCAN", "#0f766e", 560, 700]];
  const bChips = chipDefs.map(([tx, c], i) => {
    const d = document.createElement("div"); d.className = "chip"; d.style.cssText = `position:absolute;left:${140 + i * 0}px;top:0;width:${i === 3 ? 200 : 170}px;height:96px;background:${c};color:#fff;font-size:38px;box-shadow:0 10px 24px rgba(0,0,0,.3);z-index:3`; d.textContent = tx; B.querySelector("#bDrop").appendChild(d); return d;
  });

  /* ---- Cảnh C: chấm điểm ---- */
  const crit = [["Chủ đề", 34, 40, COL.c], ["Khái niệm, lý thuyết", 16, 20, "#38bdf8"], ["Phương pháp", 12, 15, "#a78bfa"], ["Bằng chứng", 12, 15, "#fbbf24"], ["Tính cập nhật", 8, 10, "#f472b6"]];
  const C = mk(`<div class="row"><div class="pill" style="background:${COL.c}">2 · CHẤM ĐIỂM</div><div style="margin-left:auto;font-weight:800;font-size:30px;color:#475569">Độ phù hợp đề tài</div></div>
    <div style="display:flex;justify-content:center;margin-top:12px"><div style="position:relative;width:270px;height:270px">
      <svg viewBox="0 0 120 120" width="270" height="270"><circle cx="60" cy="60" r="50" fill="none" stroke="#e6ebf5" stroke-width="12"/><circle id="cRing" cx="60" cy="60" r="50" fill="none" stroke="#10b981" stroke-width="12" stroke-linecap="round" stroke-dasharray="314.16" stroke-dashoffset="314.16" transform="rotate(-90 60 60)"/><line x1="60" y1="6" x2="60" y2="19" stroke="#0b1020" stroke-width="3" transform="rotate(216 60 60)"/></svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b id="cNum" style="font-size:104px;line-height:1">0</b><span style="font-size:28px;color:#64748b;font-weight:800">/100</span></div></div></div>
    <div style="display:flex;justify-content:center;margin-top:6px"><div id="cBadge" style="display:inline-flex;font-weight:800;font-size:32px;color:#065f46;background:#d1fae5;padding:12px 28px;border-radius:99px">✓ Đạt ngưỡng trích dẫn (60)</div></div>
    <div style="margin-top:18px">${crit.map((c, i) => `<div class="row" id="cRow${i}" style="margin-bottom:12px"><span style="width:340px;font-weight:800;font-size:28px;color:#334155;white-space:nowrap">${c[0]}</span><div class="bar"><b id="cBar${i}" style="width:0;background:${c[3]}"></b></div><span style="width:110px;text-align:right;font-weight:800;font-size:28px"><span id="cVal${i}">0</span><span style="color:#94a3b8;font-size:24px">/${c[2]}</span></span></div>`).join("")}</div>`, "card");

  /* ---- Cảnh D: đoạn đáng trích ---- */
  const quote = "Educational robotics is defined as the use of programmable robots as learning tools to support computational thinking in school settings.";
  const qWords = quote.split(" ");
  const D = mk(`<div class="row"><div class="pill" style="background:${COL.d}">3 · ĐOẠN TRÍCH</div><div class="chip" style="margin-left:auto;background:#fee2e2;color:#991b1b;font-size:28px;padding:10px 22px">ƯU TIÊN CAO</div></div>
    <div style="margin-top:28px;border:4px solid #fde68a;background:#fffbeb;border-radius:30px;padding:34px 36px;position:relative">
      <div class="row" style="margin-bottom:16px"><b style="font-size:30px;color:#92400e">#1 · Định nghĩa</b><span class="chip" id="dPage" style="margin-left:auto;background:#0b1020;color:#fff;font-size:28px;padding:8px 22px">tr. 4</span></div>
      <div id="dQuote" style="font-size:42px;line-height:1.5;font-weight:700;font-family:Georgia,'DejaVu Serif',serif;color:#1f2937">${qWords.map((w, i) => `<span class="qw" data-i="${i}" style="padding:2px 0;border-radius:6px">${w} </span>`).join("")}</div>
      <div id="dStamp" style="position:absolute;right:26px;bottom:-34px;transform:rotate(-6deg);background:#10b981;color:#fff;font-weight:900;font-size:34px;padding:14px 26px;border-radius:18px;box-shadow:0 14px 30px rgba(16,185,129,.5);letter-spacing:.04em">✓ KHỚP NGUYÊN VĂN</div>
    </div>
    <div id="dMore" style="margin-top:70px">
      <div class="row" id="dM1" style="padding:20px 26px;border-radius:24px;background:#f1f5fb;margin-bottom:16px"><b style="font-size:32px">#2 · Bằng chứng</b><span style="margin-left:auto;font-size:28px;font-weight:800;color:#475569">tr. 7</span></div>
      <div class="row" id="dM2" style="padding:20px 26px;border-radius:24px;background:#f1f5fb"><b style="font-size:32px">#3 · Phương pháp</b><span style="margin-left:auto;font-size:28px;font-weight:800;color:#475569">tr. 9</span></div>
    </div>`, "card");

  /* ---- Cảnh E: trích dẫn ---- */
  const refs = [
    ["APA 7", "Choi, J., & Nguyen, T. (2025). Integrating AI with robotics in K-12 education for programming learning: A systematic review. <i>IEEE TALE</i>, 1–8."],
    ["Harvard", "Choi, J. and Nguyen, T. (2025) ‘Integrating AI with robotics in K-12 education for programming learning: a systematic review’, <i>IEEE TALE</i>, pp. 1–8."],
    ["IEEE", "[1] J. Choi and T. Nguyen, “Integrating AI with robotics in K-12 education for programming learning: A systematic review,” in <i>IEEE TALE</i>, 2025, pp. 1–8."],
    ["10,000+", "Nature · Science · Cell · Vancouver · MLA · Chicago · ACS · AMA · Elsevier · Springer · Wiley · Sage · Taylor &amp; Francis · …"],
  ];
  const E = mk(`<div class="pill" style="background:${COL.e}">4 · TRÍCH DẪN</div>
    <div class="row" id="eChips" style="margin-top:26px;gap:14px">${refs.map((r, i) => `<div class="chip" id="eChip${i}" style="font-size:30px;padding:14px 22px;background:#e6ebf5;color:#334155">${r[0]}</div>`).join("")}</div>
    <div id="eBox" style="margin-top:26px;height:340px;border-radius:30px;background:#f8fafc;border:4px solid #e2e8f0;padding:34px 38px;font-size:40px;line-height:1.45;font-weight:600;color:#1f2937;position:relative;overflow:hidden"><div id="eTxt"></div></div>
    <div id="eCount" style="margin-top:22px;text-align:center;font-weight:900;font-size:44px;color:#be185d;height:60px"></div>
    <div class="row" style="margin-top:6px"><div id="eBtn" class="chip" style="flex:1;height:110px;font-size:42px;background:linear-gradient(90deg,#be185d,#7c3aed);color:#fff">Sao chép trích dẫn</div></div>`, "card");
  const eFinger = mk("👆", "abs", `font-size:110px;z-index:5;filter:drop-shadow(0 12px 16px rgba(0,0,0,.5))`);

  /* ---- Cảnh F: kết ---- */
  const qrSvg = (window.__QR || "");
  const F = mk(`<div style="text-align:center">
    <div id="fLogo" style="width:170px;height:170px;margin:0 auto;border-radius:56px;box-shadow:0 0 90px rgba(124,92,240,.7)">${logoSvg}</div>
    <div style="margin-top:22px;font-weight:900;font-size:78px;letter-spacing:-.01em">Trợ lý học thuật</div>
    <div class="grad" style="font-weight:900;font-size:56px;margin-top:4px">AI Academic Agent 1.0</div>
    <div id="fChips" style="margin-top:26px;display:flex;justify-content:center;gap:16px;flex-wrap:wrap">
      <span class="chip" style="font-size:30px;padding:12px 24px;background:#0e1a3d;border:2px solid #38bdf8;color:#e0f2fe">Miễn phí · 1 lượt phân tích/ngày</span>
      <span class="chip" style="font-size:30px;padding:12px 24px;background:#0e1a3d;border:2px solid #a78bfa;color:#ede9fe">Không lưu tài liệu</span></div>
    <div id="fQr" style="margin:34px auto 0;display:flex;align-items:center;justify-content:center;gap:34px">
      <div style="width:220px;height:220px;padding:14px;background:#fff;border-radius:28px;box-shadow:0 0 0 6px #38bdf8,0 20px 60px rgba(0,0,0,.5)">${qrSvg}</div>
      <div style="text-align:left"><div style="font-weight:800;font-size:34px;color:#cfd8ee">Quét mã dùng thử miễn phí</div><div style="margin-top:14px;font-weight:900;font-size:46px;background:#0b1020;border:3px solid #38bdf8;padding:12px 26px;border-radius:18px">aaa.isavietnam.app</div></div></div>
    </div>`, "abs", `left:0;top:190px;width:${W}px;height:820px`);

  /* hạt lấp lánh / confetti */
  const SPK = [];
  for (let i = 0; i < 64; i++) { const d = document.createElement("div"); d.className = "spark"; d.style.opacity = 0; d.style.background = ["#38bdf8", "#a78bfa", "#fbbf24", "#34d399", "#f472b6", "#fff"][i % 6]; root.appendChild(d); SPK.push(d); }
  const bursts = [[3.75, 540, 600, 0], [11.45, 540, 590, 16], [16.0, 700, 600, 32], [22.25, 540, 900, 48]];

  /* bong bóng lời thoại */
  const bub = mk(`<small>AMI</small><p></p>`, "bub");
  const bubP = bub.querySelector("p");
  const wordsOf = VO.map((v) => v.text.split(" "));
  let bubSeg = -1;

  const setT = (el, x, y, s = 1, o = 1, r = 0) => { el.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`; el.style.opacity = o; };
  const vis = (key, t) => { const [a, b] = SC[key]; return Math.min(eo(P(t, a, a + 0.35)), 1 - P(t, b - 0.2, b)); };
  const inSlide = (key, t) => { const [a] = SC[key]; return (1 - eo(P(t, a, a + 0.45))) * 90; };

  /* trạng thái cảm xúc/nói gửi cho Ami */
  let moodI = -1, lastTalk = null;
  const stage = () => document.querySelector(".ami-hero .ami-stage");

  window.__render = (t) => {
    /* nền chuyển động */
    setT(bg1, -250 + Math.sin(t * 0.5) * 60, -200 + Math.cos(t * 0.4) * 60);
    setT(bg2, 560 + Math.cos(t * 0.45) * 70, 1100 + Math.sin(t * 0.35) * 60);
    dots.style.transform = `translate(${(t * 12) % 44}px,${(t * 8) % 44}px)`;
    setT(halo, 0, 0, 1 + Math.sin(t * 2) * 0.03, eo(P(t, 0.2, 1.2)));
    setT(brand, 0, (1 - eo(P(t, 0.3, 0.9))) * -40, 1, eo(P(t, 0.3, 0.9)) * (1 - P(t, 23.3, 23.7)));

    /* Cảnh A */
    const va = vis("A", t);
    A.style.opacity = va; A.style.display = va <= 0 ? "none" : "block";
    aKick.style.opacity = eo(P(t, 0.6, 1.1)); aKick.style.transform = `translateY(${(1 - eo(P(t, 0.6, 1.1))) * 30}px)`;
    papers.forEach((p) => {
      const q = P(t, p.t0, p.t0 + 0.55), fall = ob(q), sweep = eio(P(t, 3.55, 4.15));
      const x = p.x + sweep * (p.sx + 300), y = p.y - (1 - fall) * 900 - sweep * 420, r = p.r + (1 - fall) * 90 + sweep * 200;
      p.d.style.opacity = eo(q) * (1 - sweep);
      p.d.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`;
    });
    const hp = ob(P(t, 1.0, 1.55));
    aHours.style.transform = `scale(${0.4 + 0.6 * hp})`; aHours.style.opacity = eo(P(t, 1.0, 1.3)) * (1 - eo(P(t, 3.95, 4.2)));
    aStrike.style.width = `${eo(P(t, 3.5, 3.85)) * 840}px`; aStrike.style.opacity = 1 - eo(P(t, 3.95, 4.2));
    const mp = ob(P(t, 3.95, 4.55));
    aMin.style.opacity = eo(P(t, 3.95, 4.15)); aMin.style.transform = `scale(${0.3 + 0.7 * mp})`;
    aSub.style.opacity = eo(P(t, 4.5, 4.9)); aSub.style.transform = `translateY(${(1 - eo(P(t, 4.5, 4.9))) * 30}px)`;

    /* Cảnh B */
    const vb = vis("B", t);
    B.style.display = vb <= 0 ? "none" : "block"; setT(B, 0, inSlide("B", t), 1, vb);
    bChips.forEach((d, i) => {
      const t0 = 6.15 + i * 0.5, q = ob(P(t, t0, t0 + 0.45));
      const tx = [-380, 520, -420, 560][i], ty = [-520, -480, 640, 700][i];
      const gx = [70, 270, 470, 660][i] - 140 + 0, gy = 270;
      const dx = (1 - q) * tx + gx, dy = (1 - q) * ty + gy;
      d.style.transform = `translate(${dx}px,${dy}px) scale(${0.6 + 0.4 * q}) rotate(${(1 - q) * 25}deg)`; d.style.opacity = P(t, t0, t0 + 0.15);
    });
    const dz = B.querySelector("#bDrop"); dz.style.borderColor = t > 6.1 ? "#2dd4bf" : "#94a3b8"; dz.style.background = t > 6.1 ? "#ecfdf5" : "#f1f5fb";
    B.querySelector("#bIcon").style.opacity = 1 - P(t, 6.1, 6.4); B.querySelector("#bHint").style.opacity = 1 - P(t, 6.1, 6.4);
    const pg = eio(P(t, 7.9, 8.8)); B.querySelector("#bProgB").style.width = pg * 100 + "%"; B.querySelector("#bProgN").textContent = Math.round(pg * 100) + "%";
    B.querySelector("#bProg").style.opacity = P(t, 7.7, 7.95) * (1 - P(t, 8.85, 9.0)); B.querySelector("#bProg").style.display = t > 9.0 ? "none" : "block";
    const dn = ob(P(t, 8.9, 9.25)); B.querySelector("#bDone").style.opacity = P(t, 8.9, 9.05); B.querySelector("#bDone").style.transform = `scale(${0.6 + 0.4 * dn})`;

    /* Cảnh C */
    const vc = vis("C", t);
    C.style.display = vc <= 0 ? "none" : "block"; setT(C, 0, inSlide("C", t), 1, vc);
    const gp = eio(P(t, 9.95, 11.4)), score = Math.round(82 * gp);
    C.querySelector("#cRing").style.strokeDashoffset = 314.16 * (1 - 0.82 * gp);
    C.querySelector("#cNum").textContent = score;
    const bd = ob(P(t, 11.35, 11.8)); const cb = C.querySelector("#cBadge"); cb.style.opacity = P(t, 11.35, 11.5); cb.style.transform = `scale(${0.6 + 0.4 * bd})`;
    crit.forEach((c, i) => {
      const q = eo(P(t, 10.5 + i * 0.28, 11.3 + i * 0.28));
      C.querySelector("#cBar" + i).style.width = (q * c[1] / c[2]) * 100 + "%"; C.querySelector("#cVal" + i).textContent = Math.round(q * c[1]);
      const r = C.querySelector("#cRow" + i); r.style.opacity = P(t, 10.4 + i * 0.28, 10.6 + i * 0.28);
    });

    /* Cảnh D */
    const vd = vis("D", t);
    D.style.display = vd <= 0 ? "none" : "block"; setT(D, 0, inSlide("D", t), 1, vd);
    const sweep = P(t, 14.1, 15.5);
    D.querySelectorAll(".qw").forEach((w, i) => { const q = i / qWords.length; w.style.background = sweep > q ? "linear-gradient(#fde047,#fde047)" : "transparent"; w.style.color = sweep > q ? "#1c1500" : "#1f2937"; });
    const sp = ob(P(t, 15.7, 16.1)); const stp = D.querySelector("#dStamp"); stp.style.opacity = P(t, 15.7, 15.8); stp.style.transform = `rotate(-6deg) scale(${1.9 - 0.9 * sp})`;
    const pgp = ob(P(t, 14.5, 14.9)); D.querySelector("#dPage").style.transform = `scale(${0.7 + 0.3 * pgp})`;
    ["#dM1", "#dM2"].forEach((s, i) => { const q = eo(P(t, 16.35 + i * 0.3, 16.85 + i * 0.3)); const el = D.querySelector(s); el.style.opacity = q; el.style.transform = `translateX(${(1 - q) * 120}px)`; });

    /* Cảnh E */
    const ve = vis("E", t);
    E.style.display = ve <= 0 ? "none" : "block"; setT(E, 0, inSlide("E", t), 1, ve);
    const times = [18.25, 19.45, 20.6, 21.65]; let si = -1; times.forEach((x, i) => { if (t >= x) si = i; });
    refs.forEach((r, i) => { const on = i === si; const c = E.querySelector("#eChip" + i); c.style.background = on ? "linear-gradient(90deg,#be185d,#7c3aed)" : "#e6ebf5"; c.style.color = on ? "#fff" : "#334155"; c.style.transform = `scale(${on ? 1.1 : 1})`; });
    if (si >= 0) { const full = refs[si][1].replace(/<[^>]+>/g, ""); const q = clamp((t - times[si]) / 0.55); const n = Math.floor(full.length * eo(q)); E.querySelector("#eTxt").innerHTML = refs[si][1].length === full.length ? full.slice(0, n) : (q >= 1 ? refs[si][1] : full.slice(0, n)); }
    else E.querySelector("#eTxt").innerHTML = "";
    const ec = E.querySelector("#eCount"); ec.textContent = si === 3 ? "Hơn 10.000 kiểu tạp chí" : ""; ec.style.opacity = si === 3 ? 1 : 0;
    const press = P(t, 22.0, 22.2) * (1 - P(t, 22.2, 22.4)); const btn = E.querySelector("#eBtn");
    btn.textContent = t > 22.15 ? "✓ Đã sao chép!" : "Sao chép trích dẫn"; btn.style.background = t > 22.15 ? "linear-gradient(90deg,#059669,#10b981)" : "linear-gradient(90deg,#be185d,#7c3aed)"; btn.style.transform = `scale(${1 - press * 0.06})`;
    const fp = eo(P(t, 21.65, 22.1)); setT(eFinger, 660 + (1 - fp) * 160, 1010 - fp * 20 + (1 - fp) * 140 + press * 18, 1, ve * P(t, 21.65, 21.85) * (1 - P(t, 22.5, 22.8)));

    /* Cảnh F */
    const vf = vis("F", t);
    F.style.display = vf <= 0 ? "none" : "block"; F.style.opacity = vf; F.style.transform = `translateY(${inSlide("F", t) * 0.6}px)`;
    const lg = ob(P(t, 23.5, 24.2)); F.querySelector("#fLogo").style.transform = `scale(${0.3 + 0.7 * lg}) rotate(${(1 - lg) * -25}deg)`;
    const pulse = t > 27.5 ? 1 + Math.sin((t - 27.5) * 6) * 0.015 : 1; F.querySelector("#fQr").style.transform = `scale(${pulse})`;
    F.querySelector("#fChips").style.opacity = eo(P(t, 24.4, 24.9)); F.querySelector("#fQr").style.opacity = eo(P(t, 25.0, 25.6));

    /* hạt */
    SPK.forEach((d) => (d.style.opacity = 0));
    bursts.forEach(([t0, bx, by, off]) => { const q = t - t0; if (q < 0 || q > 1.5) return; for (let k = 0; k < 16; k++) { const d = SPK[off + k], a = (k / 16) * Math.PI * 2 + rnd(k + off), v = 260 + rnd(k + off + 9) * 520; const x = bx + Math.cos(a) * v * q, y = by + Math.sin(a) * v * q + 700 * q * q; d.style.opacity = Math.max(0, 1 - q / 1.5); d.style.transform = `translate(${x}px,${y}px) scale(${0.6 + rnd(k + 3)})`; } });

    /* bong bóng lời thoại */
    let seg = -1; VO.forEach((v, i) => { if (t >= v.a - 0.05) seg = i; });
    if (seg !== bubSeg) { bubSeg = seg; if (seg >= 0) { bubP.innerHTML = wordsOf[seg].map((w) => `<span style="opacity:0">${w}&nbsp;</span>`).join(""); bub.style.setProperty("--c", VO[seg].c); } }
    if (seg >= 0) { const v = VO[seg]; const q = clamp((t - v.a) / (v.b - v.a - 0.3)); const n = wordsOf[seg].length; bubP.childNodes.forEach((s, i) => { s.style.opacity = q * n > i ? 1 : 0; }); }
    const bo = seg < 0 ? 0 : eo(P(t, VO[seg].a - 0.05, VO[seg].a + 0.18)) * (seg === VO.length - 1 ? 1 - P(t, 29.3, 29.9) : 1);
    setT(bub, 0, (1 - bo) * 30, 0.96 + 0.04 * bo, bo);

    /* Ami: cảm xúc, nói, xuất hiện */
    let mi = -1; MOODS.forEach(([a], i) => { if (t >= a) mi = i; });
    if (mi !== moodI && mi >= 0) { moodI = mi; window.dispatchEvent(new CustomEvent("ami:debug", { detail: { mood: MOODS[mi][1], text: "" } })); }
    const talking = VO.some((v) => t >= v.a && t <= v.b);
    if (talking !== lastTalk) { lastTalk = talking; window.__amiTalk = talking; }
    const sg = stage();
    if (sg && !window.__noPop) { const q = ob(P(t, 0.15, 0.85)); sg.style.transformOrigin = "50% 100%"; sg.style.transform = `scale(${0.25 + 0.75 * q}) translateY(${(1 - q) * 120}px)`; sg.style.opacity = P(t, 0.1, 0.35); }
  };
  window.__vidReady = true;
})();
