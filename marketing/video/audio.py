"""Dựng âm thanh clip Ami: giọng nói (Piper TTS) + nhạc nền + hiệu ứng tổng hợp bằng numpy.
Dùng: python3 audio.py <thư mục chứa các tệp giọng *.wav> <đầu ra .wav>"""
import sys, wave, numpy as np
SR = 44100; DUR = 30.0; N = int(SR * DUR)
vo_dir, out = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(7)
def tt(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.005, r=0.2):
    e = np.ones(n); na = max(1, int(SR * a)); nr = max(1, int(SR * r))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def put(buf, x, t0, g=1.0):
    i = int(t0 * SR)
    if i >= len(buf): return
    x = x[: len(buf) - i]; buf[i : i + len(x)] += x * g
def lp(x, fc):  # lọc thông thấp một cực (đệ quy theo khối, dùng cumulative trick qua FFT)
    n = len(x); k = np.exp(-2 * np.pi * fc / SR * np.arange(min(n, 4096)))
    k = k * (2 * np.pi * fc / SR); return np.convolve(x, k)[:n]
def tone(f, d, harm=(1, .5, .25, .12), a=0.005, r=0.3):
    t = tt(d); s = sum(h * np.sin(2 * np.pi * f * (i + 1) * t) for i, h in enumerate(harm)); return s * env(len(t), a, r) / sum(harm)
def whoosh(d=0.6, f0=250, f1=3500, g=1.0):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    s = sum(np.sin(ph * m + k) for k, m in enumerate((1, 1.01, 0.99, 1.5)))
    n = np.diff(rng.standard_normal(len(t) + 1)); n = lp(n, 6000)
    e = np.sin(np.pi * t / d) ** 2; return (s / 4 * 0.5 + n * 0.8) * e * g
def pop(f=520, d=0.18): t = tt(d); return np.sin(2 * np.pi * (f * (1 + 1.2 * np.exp(-t * 40))) * t) * np.exp(-t * 22)
def ding(f=1318, d=1.0): t = tt(d); return (np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 2.01 * t) + .2 * np.sin(2 * np.pi * f * 3.02 * t)) * np.exp(-t * 4.5) / 1.6
def boom(d=0.9): t = tt(d); return (np.sin(2 * np.pi * (60 + 120 * np.exp(-t * 9)) * t) * np.exp(-t * 4.5) * 1.2 + lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 8) * .4)
def click(): t = tt(0.05); return lp(rng.standard_normal(len(t)), 5000) * np.exp(-t * 90)
def sparkle(d=1.0):
    y = np.zeros(int(SR * d))
    for k in range(14): put(y, ding(1800 + rng.integers(0, 1800), 0.35), rng.random() * (d - 0.4), 0.18)
    return y
def riser(d=0.8, f0=300, f1=2400): t = tt(d); f = f0 * (f1 / f0) ** (t / d); return np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / d) ** 2 * 0.5 + np.diff(rng.standard_normal(len(t) + 1)) * (t / d) ** 2 * 0.25

# ---------- giọng nói ----------
def load(name):
    with wave.open(f"{vo_dir}/{name}.wav") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    return x
vo = np.zeros(N)
starts = {"hook": 0.45, "upload": 5.85, "score": 9.5, "pass": 13.3, "cite": 18.0, "end": 23.3}
mask = np.zeros(N)
for k, t0 in starts.items():
    x = load(k); put(vo, x, t0, 1.0); i = int(t0 * SR); mask[i : i + len(x)] = 1
vo = vo / np.max(np.abs(vo)) * 0.9
# làm mượt mặt nạ nhường tiếng (ducking)
kk = np.hanning(int(SR * 0.25)); kk /= kk.sum(); duck = np.convolve(mask, kk, mode="same")

# ---------- nhạc nền (C – Am – F – G, 120 bpm) ----------
bpm = 120; beat = 60 / bpm
music = np.zeros(N)
chords = [(261.63, [261.63, 329.63, 392.0, 493.88]), (220.0, [220.0, 261.63, 329.63, 392.0]), (174.61, [174.61, 220.0, 261.63, 329.63]), (196.0, [196.0, 246.94, 293.66, 392.0])]
def at(bar): return chords[int(bar) % 4]
bars = int(DUR / (beat * 4)) + 1
for b in range(bars):
    t0 = b * beat * 4; root, notes = at(b)
    for f in notes: put(music, tone(f, beat * 4 + 0.3, (1, .35, .12), 0.25, 0.6), t0, 0.07)       # pad
    if t0 >= 3.9:                                                                                    # sau "Not anymore": vào nhịp
        for s in range(8):                                                                           # arpeggio
            f = notes[(s * 3) % 4] * (2 if s % 2 else 1); put(music, tone(f * 2, beat * .9, (1, .3, .1), 0.003, 0.25), t0 + s * beat / 2, 0.11)
        put(music, tone(root / 2, beat * 1.8, (1, .5), 0.01, 0.4), t0, 0.26); put(music, tone(root / 2, beat * 1.8, (1, .5), 0.01, 0.4), t0 + beat * 2, 0.22)  # bass
        for s in range(4):                                                                           # kick
            put(music, boom(0.25) * 0.5, t0 + s * beat, 0.45)
        for s in range(8): put(music, lp(np.diff(rng.standard_normal(int(SR * .06) + 1)), 9000) * np.exp(-tt(.06) * 60), t0 + s * beat / 2 + beat / 4, 0.18)  # hi-hat
    else:
        for s in range(4): put(music, tone(notes[s] * 2, beat * 1.2, (1, .3), 0.005, 0.5), t0 + s * beat, 0.07)  # intro nhẹ
music *= np.concatenate([np.minimum(1, tt(DUR) / 0.8)]) * np.minimum(1, (DUR - tt(DUR)) / 1.5)
music = music / (np.max(np.abs(music)) + 1e-9) * 0.5
music *= (1 - 0.62 * duck)

# ---------- hiệu ứng ----------
sfx = np.zeros(N)
put(sfx, pop(420, .3), 0.2, 0.6); put(sfx, whoosh(.5, 300, 2500), 0.05, 0.5)
for i in range(18): put(sfx, boom(.12), 0.9 + i * 0.1, 0.12); put(sfx, pop(200 + (i % 5) * 30, .1), 0.9 + i * 0.1, 0.05)    # giấy rơi
put(sfx, riser(.8, 300, 2800), 2.8, 0.55); put(sfx, whoosh(.65, 400, 4000), 3.5, 0.7)
put(sfx, boom(1.0), 3.95, 0.9); put(sfx, sparkle(1.3), 3.98, 0.9)
for t0 in (5.7, 9.4, 13.15, 17.85): put(sfx, whoosh(.45, 300, 2800), t0 - 0.05, 0.5)
for i in range(4): put(sfx, pop(520 + 110 * i, .2), 6.15 + i * 0.5, 0.55)
put(sfx, tone(880, .25, (1, .3), 0.005, 0.2), 9.0, 0.3); put(sfx, tone(1318, .5, (1, .3), 0.005, 0.4), 9.1, 0.3)
for i in range(5): put(sfx, click() * 0.5, 10.5 + i * 0.28, 0.5)
put(sfx, ding(1318, 1.2), 11.4, 0.8); put(sfx, ding(1760, 1.0), 11.5, 0.4); put(sfx, sparkle(1.0), 11.45, 0.7)
put(sfx, boom(.5), 15.7, 0.8); put(sfx, click(), 15.7, 0.6)
for t0 in (18.25, 19.45, 20.6, 21.65): put(sfx, pop(780, .12), t0, 0.5)
put(sfx, click(), 22.0, 0.9); put(sfx, ding(1046, .8), 22.15, 0.7); put(sfx, ding(1568, .9), 22.22, 0.6); put(sfx, sparkle(1.4), 22.25, 0.9)
put(sfx, riser(.85, 300, 3200), 22.65, 0.6); put(sfx, boom(1.2), 23.5, 1.0); put(sfx, whoosh(.6, 600, 5000), 23.15, 0.5)
for f in (523.25, 659.25, 783.99, 1046.5): put(sfx, tone(f, 3.2, (1, .4, .15), 0.01, 1.2), 23.5, 0.16)       # hợp âm kết
put(sfx, sparkle(1.5), 23.6, 0.8); put(sfx, sparkle(1.0), 26.8, 0.5)
sfx = sfx / (np.max(np.abs(sfx)) + 1e-9) * 0.8

mix = vo * 1.0 + music * 0.8 + sfx * 0.55
mix *= np.minimum(1, (DUR - tt(DUR)) / 0.6)
mix = np.tanh(mix * 1.1) / np.tanh(1.1) * 0.93
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok", len(pcm) / SR)
