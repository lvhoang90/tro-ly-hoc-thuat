import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "../shared/types.ts";
import { DICT, type Key } from "./dict.ts";

interface I18n { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, v?: Record<string, string | number>) => string }
const Ctx = createContext<I18n>(null as never);

const initial = (): Lang => {
  try { const s = localStorage.getItem("tl-lang"); if (s === "vi" || s === "en") return s; } catch { /* bỏ qua */ }
  return navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en";
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setL] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => { setL(l); try { localStorage.setItem("tl-lang", l); } catch { /* bỏ qua */ } }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const t = useCallback((k: Key, v?: Record<string, string | number>) => {
    let s = DICT[k]?.[lang] ?? DICT[k]?.en ?? k;
    if (v) for (const [a, b] of Object.entries(v)) s = s.split(`{${a}}`).join(String(b));
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
