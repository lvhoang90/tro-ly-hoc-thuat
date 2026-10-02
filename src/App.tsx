import { Suspense, lazy, useEffect, useState } from "react";
import { useI18n } from "./i18n.tsx";
import { useApp } from "./ctx.tsx";
import { configured } from "./lib/supabase.ts";
import Background from "./components/Background.tsx";
import { Footer, Header, ScrollTop, Toasts, VisitChip, type Route } from "./components/Chrome.tsx";
import Auth from "./pages/Auth.tsx";
import Workspace from "./pages/Workspace.tsx";

const Profile = lazy(() => import("./pages/Profile.tsx"));
const History = lazy(() => import("./pages/History.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));

const fromHash = (): Route => {
  const h = location.hash.replace(/^#\/?/, "").split(/[?&]/)[0];
  return h === "history" || h === "profile" || h === "admin" ? h : "work";
};

export default function App() {
  const { t } = useI18n();
  const { ready, session, profile, contact } = useApp();
  const [route, setRoute] = useState<Route>(fromHash);
  useEffect(() => { const f = () => setRoute(fromHash()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);

  let body;
  if (!configured) body = <div className="card setup"><h2>{t("setup_title")}</h2><p>{t("setup_body")}</p><pre>VITE_SUPABASE_URL=…{"\n"}VITE_SUPABASE_ANON_KEY=…</pre></div>;
  else if (!ready) body = <div className="center"><div className="spinner" /></div>;
  else if (!session) body = <Auth />;
  else if (profile?.status === "suspended") body = <div className="card err"><h3>{t("err_suspended")}</h3><p className="muted">{contact?.email}</p></div>;
  else body = (
    <Suspense fallback={<div className="center"><div className="spinner" /></div>}>
      {route === "work" && <Workspace />}
      {route === "history" && <History />}
      {route === "profile" && <Profile />}
      {route === "admin" && <Admin />}
    </Suspense>
  );

  return (
    <>
      <Background />
      <div className="shell">
        <Header route={route} go={setRoute} />
        <main className="main">{body}</main>
        {(ready || !configured) && <Footer />}
      </div>
      <VisitChip />
      <ScrollTop />
      <Toasts />
    </>
  );
}
