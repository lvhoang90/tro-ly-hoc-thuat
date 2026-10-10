import { TierWatcher } from "./components/Tier.tsx";
import { Suspense, lazy, useEffect, useState } from "react";
import { useI18n } from "./i18n.tsx";
import { useApp } from "./ctx.tsx";
import { configured } from "./lib/supabase.ts";
import Background from "./components/Background.tsx";
import { Footer, Header, ScrollTop, Toasts, VisitChip, WhatsNew, type Route } from "./components/Chrome.tsx";
import Auth from "./pages/Auth.tsx";
import Workspace from "./pages/Workspace.tsx";
import { captureHandoff, clearHandoff, getHandoff } from "./lib/handoff.ts";
import { captureRef } from "./lib/ref.ts";
import { APP, withUtm } from "./lib/config.ts";

captureHandoff();
captureRef();

const Profile = lazy(() => import("./pages/Profile.tsx"));
const History = lazy(() => import("./pages/History.tsx"));
const Review = lazy(() => import("./pages/Review.tsx"));
import { Ami } from "./mascot/Ami.tsx";
import { useMascot } from "./mascot/ctx.tsx";
const Admin = lazy(() => import("./pages/Admin.tsx"));

const fromHash = (): Route => {
  const h = location.hash.replace(/^#\/?/, "").split(/[?&]/)[0];
  return h === "history" || h === "profile" || h === "admin" || h === "review" ? h : "work";
};

export default function App() {
  const { t } = useI18n();
  const { ready, session, profile, contact } = useApp();
  const [route, setRoute] = useState<Route>(fromHash);
  const [handoff, setHandoff] = useState(getHandoff);
  useEffect(() => { const f = () => setRoute(fromHash()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);

  const ami = useMascot();
  useEffect(() => {
    if (!session || !ready) return;
    if (route === "history") ami.say(t("ami_history"), "happy", 7000);
    else if (route === "profile") ami.say(t("ami_profile"), "idle", 7000);
    else if (route === "review") ami.say(t("ami_review"), "happy", 7000);
    else if (route === "admin") ami.say(t("ami_admin"), "wave", 6000);
  }, [route, session, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  if (!configured) body = <div className="card setup"><h2>{t("setup_title")}</h2><p>{t("setup_body")}</p><pre>VITE_SUPABASE_URL=…{"\n"}VITE_SUPABASE_ANON_KEY=…</pre></div>;
  else if (!ready) body = <div className="center"><div className="spinner" /></div>;
  else if (!session) body = <Auth />;
  else if (profile?.status === "suspended") body = <div className="card err"><h3>{t("err_suspended")}</h3><p className="muted">{contact?.email}</p></div>;
  else body = (
    <Suspense fallback={<div className="center"><div className="spinner" /></div>}>
      {route === "work" && <Workspace />}
      {route === "review" && <Review />}
      {route === "history" && <History />}
      {route === "profile" && <Profile />}
      {route === "admin" && <Admin />}
    </Suspense>
  );

  return (
    <>
      <Background />
      <TierWatcher />
      <div className="shell">
        <Header route={route} go={setRoute} />
        {handoff && session && ready && route === "work" && (
          <div className="card handoff" role="status">
            <b>{t("handoff_title")}: {handoff}</b>
            <p className="muted small">{t("handoff_body")}</p>
            <div className="row">
              <a className="btn" href={withUtm(`${APP.author.edufind}#q=${encodeURIComponent(handoff)}`, "handoff")} target="_blank" rel="noopener noreferrer">{t("handoff_view")}</a>
              <button type="button" className="btn" onClick={() => { clearHandoff(); setHandoff(""); }}>{t("handoff_dismiss")}</button>
            </div>
          </div>
        )}
        <main className="main">{body}</main>
        {(ready || !configured) && <Footer />}
      </div>
      <VisitChip />
      {ready && session && <Ami variant="companion" />}
      {ready && <WhatsNew />}
      <ScrollTop />
      <Toasts />
    </>
  );
}
