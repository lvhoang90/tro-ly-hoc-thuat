import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Mood } from "./types.ts";

interface MascotState { mood: Mood; text: string; nonce: number }
interface MascotApi extends MascotState {
  enabled: boolean;
  /** Đặt cảm xúc kèm lời nhắn; lời nhắn tự ẩn sau `ms` mili giây (0 = giữ lại). */
  say: (text: string, mood?: Mood, ms?: number) => void;
  setMood: (mood: Mood) => void;
  setEnabled: (v: boolean) => void;
}

const Ctx = createContext<MascotApi | null>(null);
const KEY = "tl-ali";

export function MascotProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<MascotState>({ mood: "idle", text: "", nonce: 0 });
  const [enabled, setEnabledState] = useState(() => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } });
  const timer = useRef<number>(0);

  const say = useCallback((text: string, mood: Mood = "idle", ms = 7000) => {
    window.clearTimeout(timer.current);
    setS((p) => ({ mood, text, nonce: p.nonce + 1 }));
    if (ms > 0 && text) timer.current = window.setTimeout(() => setS((p) => ({ ...p, text: "" })), ms);
  }, []);
  const setMood = useCallback((mood: Mood) => setS((p) => (p.mood === mood ? p : { ...p, mood, nonce: p.nonce + 1 })), []);
  const setEnabled = useCallback((v: boolean) => { setEnabledState(v); try { localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* bỏ qua */ } }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Gỡ lỗi/xem thử cảm xúc: thêm ?alidebug vào địa chỉ rồi gửi sự kiện window "ali:debug" với detail { mood, text }.
  useEffect(() => {
    if (!location.search.includes("alidebug")) return;
    const h = (e: Event) => { const d = (e as CustomEvent<{ mood: Mood; text?: string }>).detail; say(d.text ?? "", d.mood, 0); };
    window.addEventListener("ali:debug", h);
    return () => window.removeEventListener("ali:debug", h);
  }, [say]);

  const value = useMemo(() => ({ ...s, enabled, say, setMood, setEnabled }), [s, enabled, say, setMood, setEnabled]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMascot(): MascotApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("MascotProvider missing");
  return v;
}
