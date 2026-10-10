import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { drawFace } from "./face.ts";
import { effectiveMood, type Mood } from "./types.ts";

interface Props { mood: Mood; nonce: number; interactive?: boolean; reduced?: boolean; fps?: number }

const NAVY = 0x1b2a5c, CYAN = 0x38bdf8, VIOLET = 0x7c5cf0, GOLD = 0xf5c04a;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);

function glossy(color: number, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.26, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.12, ...extra });
}
function glow(color: number, intensity = 1.4) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}
function canvasTex(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  paint(cv.getContext("2d")!);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/** Logo ba chữ A lồng nhau trên ngực robot. */
function logoTexture() {
  return canvasTex(256, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, "#38bdf8"); g.addColorStop(1, "#7c5cf0");
    c.fillStyle = g; c.beginPath(); c.roundRect(8, 8, 240, 240, 56); c.fill();
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#fff";
    for (const [s, a, lw] of [[1, 0.45, 13], [0.66, 0.78, 15]] as const) {
      c.globalAlpha = a; c.lineWidth = lw; c.beginPath();
      c.moveTo(128 - 96 * s, 214); c.lineTo(128, 214 - 168 * s); c.lineTo(128 + 96 * s, 214); c.moveTo(128 - 60 * s, 166); c.lineTo(128 + 60 * s, 166); c.stroke();
    }
    c.globalAlpha = 1; c.fillStyle = "#fff"; c.beginPath(); c.moveTo(96, 214); c.lineTo(128, 150); c.lineTo(160, 214); c.closePath(); c.fill();
  });
}

function docTexture() {
  return canvasTex(256, 320, (c) => {
    c.fillStyle = "rgba(14,23,52,.92)"; c.beginPath(); c.roundRect(0, 0, 256, 320, 22); c.fill();
    c.strokeStyle = "#7dd3fc"; c.lineWidth = 4; c.stroke();
    c.fillStyle = "#e6ecf8"; c.fillRect(24, 28, 150, 14);
    c.fillStyle = "rgba(125,211,252,.85)";
    for (let i = 0; i < 9; i++) c.fillRect(24, 66 + i * 26, 208 - ((i * 37) % 70), 9);
    c.fillStyle = "rgba(252,211,77,.85)"; c.fillRect(24, 170, 120, 11);
  });
}

function shadowTexture() {
  return canvasTex(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "rgba(10,16,40,.55)"); g.addColorStop(1, "rgba(10,16,40,0)");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
}

export default function Robot3D({ mood, nonce, interactive = true, reduced = false, fps = 60 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ mood, nonce, t0: 0, interactive, reduced });
  const poke = useRef<(() => void) | null>(null);
  live.current.mood = mood; live.current.interactive = interactive; live.current.reduced = reduced;
  useEffect(() => { live.current.nonce = nonce; live.current.t0 = -1; poke.current?.(); }, [nonce, mood]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromScene(new RoomEnvironment(), 0.04); scene.environment = env.texture; scene.environmentIntensity = 0.75;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 0.6, 7.6); camera.lookAt(0, 0.62, 0);
    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(2.5, 4, 5); scene.add(key);
    const rimA = new THREE.DirectionalLight(CYAN, 2.4); rimA.position.set(-4, 2, -3); scene.add(rimA);
    const rimB = new THREE.DirectionalLight(VIOLET, 1.8); rimB.position.set(4, 1, -3); scene.add(rimB);
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.5));

    const disposables: { dispose(): void }[] = [env];
    const keep = <T extends { dispose(): void }>(o: T) => { disposables.push(o); return o; };

    const pearl = keep(glossy(0xf4f7ff)), navy = keep(glossy(NAVY, { roughness: 0.4 })), visorM = keep(glossy(0x070b18, { roughness: 0.06, metalness: 0.3 }));
    const accent = keep(glossy(CYAN, { emissive: CYAN, emissiveIntensity: 0.35 })), gold = keep(glossy(GOLD, { metalness: 0.6, roughness: 0.3 }));
    const orbMat = keep(glow(CYAN, 1.8)), ringMat = keep(glow(CYAN, 1.6));

    const root = new THREE.Group(); scene.add(root);

    // Thân: viên nang bóng, logo ba chữ A trước ngực
    const torso = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 48, 32)), pearl); torso.scale.set(0.58, 0.7, 0.52); torso.position.y = 0.12; root.add(torso);
    const belt = new THREE.Mesh(keep(new THREE.TorusGeometry(0.5, 0.045, 16, 48)), accent); belt.rotation.x = Math.PI / 2; belt.position.y = -0.3; belt.scale.set(1, 0.9, 1); root.add(belt);
    const chestTex = keep(logoTexture());
    const chest = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.4, 0.4)), keep(new THREE.MeshBasicMaterial({ map: chestTex, transparent: true }))); chest.position.set(0, 0.2, 0.545); root.add(chest);
    const base = new THREE.Mesh(keep(new THREE.ConeGeometry(0.36, 0.55, 32)), navy); base.rotation.x = Math.PI; base.position.y = -0.62; root.add(base);
    const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.3, 0.035, 12, 40)), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = -0.95; root.add(ring);
    const jet = new THREE.Mesh(keep(new THREE.CircleGeometry(0.27, 32)), keep(new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })));
    jet.rotation.x = -Math.PI / 2; jet.position.y = -0.96; root.add(jet);

    // Đầu
    const head = new THREE.Group(); head.position.y = 1.32; root.add(head);
    head.add(new THREE.Mesh(keep(new RoundedBoxGeometry(1.32, 1.04, 1.1, 8, 0.34)), pearl));
    const visor = new THREE.Mesh(keep(new RoundedBoxGeometry(1.08, 0.74, 0.24, 6, 0.24)), visorM); visor.position.set(0, -0.02, 0.5); head.add(visor);
    const faceCv = document.createElement("canvas"); faceCv.width = 512; faceCv.height = 320;
    const faceCtx = faceCv.getContext("2d")!; const faceTex = keep(new THREE.CanvasTexture(faceCv)); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
    const face = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.98, 0.612)), keep(new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }))); face.position.set(0, -0.02, 0.626); head.add(face);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 32)), accent); ear.rotation.z = Math.PI / 2; ear.position.set(sx * 0.72, -0.02, 0); head.add(ear);
      const cap = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 24)), pearl); cap.rotation.z = Math.PI / 2; cap.position.set(sx * 0.8, -0.02, 0); head.add(cap);
    }
    const neck = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.17, 0.2, 0.18, 24)), navy); neck.position.y = -0.58; head.add(neck);

    // Mũ cử nhân với tua vàng: biểu tượng tri thức
    const hat = new THREE.Group(); hat.position.y = 0.6; hat.rotation.z = 0.06; head.add(hat);
    const skull = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.4, 0.46, 0.2, 32)), navy); skull.position.y = 0.02; hat.add(skull);
    const board = new THREE.Mesh(keep(new RoundedBoxGeometry(1.18, 0.07, 1.18, 3, 0.02)), navy); board.position.y = 0.16; board.rotation.y = Math.PI / 4; hat.add(board);
    const orb = new THREE.Mesh(keep(new THREE.SphereGeometry(0.075, 20, 16)), orbMat); orb.position.y = 0.24; hat.add(orb);
    const tassel = new THREE.Group(); tassel.position.set(0.55, 0.16, 0.55); hat.add(tassel);
    const cord = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8)), gold); cord.position.y = -0.17; tassel.add(cord);
    const tip = new THREE.Mesh(keep(new THREE.SphereGeometry(0.06, 14, 12)), gold); tip.position.y = -0.37; tassel.add(tip);

    // Tay: hai cánh tay có khớp vai, gắn liền vào thân (vai nằm sát mặt thân, tay buông lại chạm nhẹ vào hông)
    const arms = [-1, 1].map((sx) => {
      const pivot = new THREE.Group(); pivot.position.set(sx * 0.5, 0.4, 0); root.add(pivot);
      const sh = new THREE.Mesh(keep(new THREE.SphereGeometry(0.17, 24, 18)), accent); pivot.add(sh);
      const up = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.115, 0.34, 8, 16)), pearl); up.position.y = -0.3; pivot.add(up);
      const cuff = new THREE.Mesh(keep(new THREE.TorusGeometry(0.105, 0.03, 12, 28)), accent); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.54; pivot.add(cuff);
      const hand = new THREE.Mesh(keep(new THREE.SphereGeometry(0.165, 24, 18)), accent); hand.position.y = -0.64; pivot.add(hand);
      return pivot;
    });

    // Tài liệu holo khi đang đọc
    const doc = new THREE.Group(); doc.position.set(1.35, 0.7, 0.35); doc.rotation.y = -0.45; doc.scale.setScalar(0.001); root.add(doc);
    const docTex = keep(docTexture());
    doc.add(new THREE.Mesh(keep(new THREE.PlaneGeometry(0.88, 1.1)), keep(new THREE.MeshBasicMaterial({ map: docTex, transparent: true, side: THREE.DoubleSide }))));
    const scan = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.9, 0.06)), keep(new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }))); scan.position.z = 0.01; doc.add(scan);

    // Bóng đổ giả dưới sàn
    const shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.8, 1.8)), keep(new THREE.MeshBasicMaterial({ map: keep(shadowTexture()), transparent: true, depthWrite: false })));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.32; scene.add(shadow);

    // Hạt lấp lánh khi ăn mừng
    const N = 30, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
    const pgeo = keep(new THREE.BufferGeometry()); pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const sparks = new THREE.Points(pgeo, keep(new THREE.PointsMaterial({ color: 0xfde68a, size: 0.11, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })));
    sparks.frustumCulled = false; scene.add(sparks);
    const burst = () => { for (let i = 0; i < N; i++) { pos.set([(Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 0.5, 0.4], i * 3); vel.set([(Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 2, (Math.random() - 0.3) * 1.2], i * 3); life[i] = 0.9 + Math.random() * 0.8; } };
    for (let i = 0; i < N; i++) pos[i * 3 + 1] = -99;

    // Con trỏ: robot nhìn theo
    const ptr = { x: 0, y: 0, tx: 0, ty: 0, lastMove: 0 };
    const onMove = (e: PointerEvent) => {
      if (!live.current.interactive) return;
      const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height * 0.35;
      ptr.tx = clamp((e.clientX - cx) / Math.max(320, window.innerWidth * 0.45), -1, 1); ptr.ty = clamp(-(e.clientY - cy) / Math.max(260, window.innerHeight * 0.45), -1, 1);
      ptr.lastMove = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      const wide = Math.max(1, 0.78 / camera.aspect); camera.position.z = 7.4 * wide; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    let visible = true;
    const io = new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; }, { threshold: 0.01 }); io.observe(el);

    let last = performance.now();
    let t = 0, raf = 0, acc = 0, nextBlink = 2.2, blinkT = -1, sparkOn = 0, lastMoodKey = "", moodStart = 0, drawn = "";
    /** Mức mở miệng 0..4 khi Ami đang nói (cờ window.__amiTalk, dùng cho video/giọng nói). */
    const talkLv = () => ((window as unknown as { __amiTalk?: boolean }).__amiTalk ? 1 + Math.floor(Math.abs(Math.sin(t * 13)) * 3.99) : 0);
    const faceKey = (m: Mood, b: number, gx: number, gy: number) => `${m}|${Math.round(b * 8)}|${Math.round(gx * 6)}|${Math.round(gy * 6)}|${m === "read" || m === "celebrate" || m === "sleep" || m === "wave" ? Math.round(t * 20) : 0}|${talkLv()}`;

    const frame = (dt: number, still: boolean) => {
      const L = live.current;
      if (L.t0 < 0) { L.t0 = t; moodStart = t; }
      const elapsed = t - moodStart; const m = effectiveMood(L.mood, elapsed);
      const key = `${L.mood}#${L.nonce}`; if (key !== lastMoodKey) { lastMoodKey = key; if (L.mood === "celebrate") { burst(); sparkOn = t; } }

      // ánh nhìn
      const idleWander = performance.now() - ptr.lastMove > 3500;
      if (idleWander) { ptr.tx = Math.sin(t * 0.37) * 0.55; ptr.ty = Math.sin(t * 0.23 + 1) * 0.25; }
      ptr.x = lerp(ptr.x, ptr.tx, 1 - Math.exp(-dt * 5)); ptr.y = lerp(ptr.y, ptr.ty, 1 - Math.exp(-dt * 5));

      // chớp mắt
      if (t > nextBlink && blinkT < 0) { blinkT = t; nextBlink = t + 2.4 + Math.random() * 3; }
      let blink = 0; if (blinkT >= 0) { const k = (t - blinkT) / 0.16; blink = k < 1 ? Math.sin(k * Math.PI) : 0; if (k >= 1) blinkT = -1; }

      // nhịp lơ lửng
      const speed = m === "celebrate" ? 2.4 : m === "sleep" ? 0.7 : 1.4;
      let y = Math.sin(t * speed) * 0.06, tilt = Math.sin(t * 0.8) * 0.03;
      let yaw = ptr.x * 0.5, pitch = -ptr.y * 0.22 + 0.03, hz = 0;
      let aL = -0.14 + Math.sin(t * 1.4) * 0.04, aR = 0.14 - Math.sin(t * 1.4 + 1) * 0.04, fwdL = 0, fwdR = 0;
      let docT = 0, orbCol = CYAN, orbI = 1.6 + Math.sin(t * 3) * 0.5;

      if (m === "wave") { aR = 2.35 + Math.sin(t * 9) * 0.32; yaw = lerp(yaw, -0.15, 0.7); hz = 0.05; fwdR = 0; }
      if (m === "celebrate") { const b = Math.abs(Math.sin(t * 5)); y += b * 0.34; aL = -2.6 + Math.sin(t * 10) * 0.2; aR = 2.6 - Math.sin(t * 10) * 0.2; pitch -= 0.08; tilt = Math.sin(t * 5) * 0.08; orbCol = 0x86efac; orbI = 3; }
      if (m === "happy") { y += Math.max(0, Math.sin(t * 2.2)) * 0.06; aL = -0.35 + Math.sin(t * 2) * 0.08; aR = 0.35 - Math.sin(t * 2) * 0.08; orbCol = 0x86efac; }
      if (m === "think") { hz = 0.17; pitch = -0.1; yaw = -0.25 + Math.sin(t * 0.9) * 0.06; aR = 0.5; fwdR = 0.9; aL = -0.1; orbCol = 0xc4b5fd; orbI = 1.4 + Math.sin(t * 6) * 0.9; }
      if (m === "read") { yaw = Math.sin(t * 1.8) * 0.3 + 0.15; pitch = 0.1; aR = 1.15; fwdR = 0.3; docT = ease(Math.min(1, elapsed / 0.6)); orbI = 2.4; }
      if (m === "care") { pitch = 0.12; y -= 0.02; aL = -0.45; aR = 0.45; fwdL = 0.6; fwdR = 0.6; hz = -0.07; orbCol = 0xfda4af; }
      if (m === "alert") { y += Math.abs(Math.sin(t * 7)) * 0.05; aL = -1.0; aR = 1.0; orbCol = 0xfcd34d; orbI = 2.4 + Math.sin(t * 14); }
      if (m === "sleep") { pitch = 0.35; yaw = 0; aL = -0.1; aR = 0.1; y -= 0.05; orbI = 0.5 + Math.sin(t * 1.2) * 0.3; }
      if (L.reduced || still) { y = 0; tilt = 0; }

      root.position.y = y; root.rotation.z = tilt;
      head.rotation.set(pitch, yaw, hz);
      const ka = 1 - Math.exp(-dt * 10);
      arms[0].rotation.z = lerp(arms[0].rotation.z, aL, ka); arms[1].rotation.z = lerp(arms[1].rotation.z, aR, ka);
      arms[0].rotation.x = lerp(arms[0].rotation.x, -fwdL, ka); arms[1].rotation.x = lerp(arms[1].rotation.x, -fwdR, ka);
      tassel.rotation.z = Math.sin(t * 2.2) * 0.25 + yaw * 0.4; tassel.rotation.x = Math.cos(t * 1.7) * 0.12;
      hat.rotation.z = 0.06 + hz * 0.3;
      orbMat.color.setHex(orbCol); orbMat.emissive.setHex(orbCol); orbMat.emissiveIntensity = orbI;
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06); (jet.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 4) * 0.12;
      shadow.scale.setScalar(1 - y * 0.6); (shadow.material as THREE.MeshBasicMaterial).opacity = 0.9 - y * 0.8;
      belt.rotation.z = t * 0.6;
      doc.scale.setScalar(Math.max(0.001, lerp(doc.scale.x, docT, 1 - Math.exp(-dt * 8)))); doc.position.y = 0.7 + Math.sin(t * 1.6) * 0.05; scan.position.y = ((t * 0.7) % 1) * 1.0 - 0.5;

      // hạt
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue; life[i] -= dt; vel[i * 3 + 1] -= 3.2 * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; if (life[i] <= 0) pos[i * 3 + 1] = -99;
      }
      pgeo.attributes.position!.needsUpdate = true; void sparkOn;

      // khuôn mặt: chỉ vẽ lại khi thay đổi
      const k = faceKey(m, blink, ptr.x, ptr.y);
      if (k !== drawn || m !== (lastMoodKey.split("#")[0] as Mood)) { drawFace(faceCtx, faceCv.width, faceCv.height, { mood: m, blink, gx: ptr.x, gy: -ptr.y, t, talk: talkLv() / 4 }); faceTex.needsUpdate = true; drawn = k; }
      renderer.render(scene, camera);
    };

    // Tự hạ chất lượng trên máy yếu: khung hình nặng → giảm độ phân giải và còn 30 khung/giây → vẫn nặng thì dừng, chỉ vẽ lại khi đổi cảm xúc.
    let fpsCap = fps, slow = 0, tier = 0, stopped = false;
    const tick = () => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const now = performance.now(); const dt = Math.max(0, Math.min((now - last) / 1000, 0.05)); last = now; acc += dt;
      if (document.hidden || !visible) return;
      if (fpsCap < 60 && acc < 1 / fpsCap - 0.002) return;
      t += acc; const step = acc; acc = 0;
      const t0 = performance.now(); frame(step, false); const cost = performance.now() - t0;
      slow = cost > 22 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 24 && !(window as unknown as { __amiLock?: boolean }).__amiLock) { // __amiLock: dựng video, không hạ chất lượng
        slow = 0; tier++;
        if (tier === 1) { renderer.setPixelRatio(1); resize(); fpsCap = 30; }
        else { stopped = true; cancelAnimationFrame(raf); poke.current = () => frame(0.016, true); }
      }
    };
    if (live.current.reduced) { frame(0.016, true); poke.current = () => frame(0.016, true); } else { raf = requestAnimationFrame(tick); poke.current = null; }

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener("pointermove", onMove);
      disposables.forEach((d) => d.dispose()); pm.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, [fps]);

  return <div ref={host} className="ami-3d" aria-hidden="true" />;
}
