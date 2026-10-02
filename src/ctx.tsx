import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase, type Contact, type Profile } from "./lib/supabase.ts";
import type { Quota } from "../shared/types.ts";

interface Toast { id: number; text: string; kind: "ok" | "err" }
interface AppCtx {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  quota: Quota | null;
  setQuota: (q: Quota | null) => void;
  contact: Contact | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  toast: (text: string, kind?: "ok" | "err") => void;
  toasts: Toast[];
}
const Ctx = createContext<AppCtx>(null as never);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const toast = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = ++seq.current;
    setToasts((x) => [...x, { id, text, kind }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4200);
  }, []);

  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setQuota(null); return; }
    const [p, q] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", s.user.id).maybeSingle(),
      supabase.rpc("my_quota"),
    ]);
    setProfile((p.data as Profile) ?? null);
    setQuota((q.data as Quota) ?? null);
  }, []);

  const refresh = useCallback(async () => { await load((await supabase.auth.getSession()).data.session); }, [load]);

  useEffect(() => {
    if (!configured) { setReady(true); return; }
    supabase.auth.getSession().then(async ({ data }) => { setSession(data.session); await load(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); void load(s); });
    supabase.from("app_settings").select("value").eq("key", "contact").maybeSingle().then(({ data }) => setContact((data?.value as Contact) ?? null));
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);
  const value = useMemo(() => ({ ready, session, profile, quota, setQuota, contact, refresh, signOut, toast, toasts }),
    [ready, session, profile, quota, contact, refresh, signOut, toast, toasts]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useApp = () => useContext(Ctx);
