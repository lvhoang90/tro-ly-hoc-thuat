import { useEffect, useState, type FormEvent } from "react";
import { Ami } from "../mascot/Ami.tsx";
import { useMascot } from "../mascot/ctx.tsx";
import { useI18n } from "../i18n.tsx";
import { supabase } from "../lib/supabase.ts";
import { clearRef, getRef } from "../lib/ref.ts";
import { track } from "../lib/isa.ts";
import { Logo } from "../components/Chrome.tsx";
import { APP } from "../lib/config.ts";
import { Icon, type IconName } from "../components/Icon.tsx";

type Mode = "in" | "up" | "reset" | "sent";

export default function Auth() {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [unverified, setUnverified] = useState(false);

  const ami = useMascot();
  useEffect(() => {
    ami.say(t(mode === "up" ? "ami_signup" : mode === "reset" ? "ami_reset" : mode === "sent" ? "ami_sent" : "ami_hello"), mode === "in" ? "wave" : "happy", 9000);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (err) ami.say(t("ami_oops"), "care", 6000); }, [err]); // eslint-disable-line react-hooks/exhaustive-deps

  const redirect = APP.siteUrl || location.origin;

  const msg = (m: string) => {
    const s = m.toLowerCase();
    if (s.includes("invalid login")) return t("err_login");
    if (s.includes("already") || s.includes("registered")) return t("err_exists");
    if (s.includes("rate") || s.includes("seconds")) return t("err_rate");
    if (s.includes("password")) return t("err_weak");
    return m;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(""); setInfo(""); setUnverified(false); setBusy(true);
    try {
      if (mode === "up") {
        if (!agree) { setErr(t("err_agree")); return; }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password: pw,
          options: { emailRedirectTo: redirect, data: { full_name: name.trim(), ...(getRef() ? { ref: getRef() } : {}) } },
        });
        if (error) { setErr(msg(error.message)); return; }
        // Email đã tồn tại: Supabase trả về user không có identities (chống dò email).
        if (data.user && data.user.identities?.length === 0) { setErr(t("err_exists")); return; }
        track("ami_dang_ky", getRef() ? "ref" : "");
        clearRef();
        if (!data.session) setMode("sent");
      } else if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) {
          if (error.message.toLowerCase().includes("not confirmed")) setUnverified(true);
          setErr(error.message.toLowerCase().includes("not confirmed") ? t("err_unverified") : msg(error.message));
        }
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
        if (error) setErr(msg(error.message)); else setInfo(t("reset_sent"));
      }
    } finally { setBusy(false); }
  }

  async function resend() {
    setErr(""); setInfo("");
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: redirect } });
    if (error) setErr(msg(error.message)); else setInfo(t("resent"));
  }

  const features: [IconName, string, string][] = [
    ["target", t("f1_t"), t("f1_d")], ["quote", t("f2_t"), t("f2_d")], ["book", t("f3_t"), t("f3_d")], ["shield", t("f4_t"), t("f4_d")],
  ];

  return (
    <div className="landing">
      <section className="hero">
        <Ami variant="hero" />
        <div className="eyebrow">{t("hero_eyebrow")}</div>
        <h1>{APP.name[lang]}<span className="grad"> | {lang === "vi" ? APP.name.en : APP.name.vi} {APP.version}</span></h1>
        <p className="lead">{t("hero_lead")}</p>
        <ol className="flow">
          {([1, 2, 3, 4] as const).map((n) => (
            <li key={n}><span className="n">{n}</span><div><b>{t(`flow${n}` as "flow1")}</b><small>{t(`flow${n}d` as "flow1d")}</small></div></li>
          ))}
        </ol>
        <div className="features">
          {features.map(([i, h, d]) => <div key={h} className="feat"><span className="ico"><Icon name={i} size={22} /></span><b>{h}</b><p>{d}</p></div>)}
        </div>
      </section>

      <section className="auth-card card">
        <div className="auth-head"><Logo size={40} /><h2>{mode === "up" ? t("signup") : mode === "reset" ? t("reset") : mode === "sent" ? t("check_email") : t("signin")}</h2></div>

        {mode === "sent" ? (
          <div className="stack">
            <p>{t("sent_body", { email })}</p>
            <p className="muted small">{t("sent_hint")}</p>
            <button className="btn" onClick={resend}>{t("resend")}</button>
            {info && <p className="ok">{info}</p>}{err && <p className="err">{err}</p>}
            <button className="link" onClick={() => setMode("in")}>{t("back_signin")}</button>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            {mode === "up" && (
              <label>{t("full_name")}
                <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </label>
            )}
            <label>Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            {mode !== "reset" && (
              <label>{t("password")}
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8}
                  autoComplete={mode === "up" ? "new-password" : "current-password"} />
                {mode === "up" && <small className="muted">{t("pw_hint")}</small>}
              </label>
            )}
            {mode === "up" && (
              <label className="check">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{t("agree")}</span>
              </label>
            )}
            {err && <p className="err" role="alert">{err}</p>}
            {info && <p className="ok">{info}</p>}
            <button className="btn primary" disabled={busy}>{busy ? "…" : mode === "up" ? t("signup") : mode === "reset" ? t("send_reset") : t("signin")}</button>
            {unverified && <button type="button" className="btn" onClick={resend}>{t("resend")}</button>}
            <div className="auth-links">
              {mode !== "in" && <button type="button" className="link" onClick={() => setMode("in")}>{t("have_account")}</button>}
              {mode !== "up" && <button type="button" className="link" onClick={() => setMode("up")}>{t("no_account")}</button>}
              {mode === "in" && <button type="button" className="link" onClick={() => setMode("reset")}>{t("forgot")}</button>}
            </div>
            {mode === "up" && <p className="muted small">{t("free_note")}</p>}
          </form>
        )}
      </section>
    </div>
  );
}
