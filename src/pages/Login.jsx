import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Shield,
  Sparkles,
  Target,
  X,
} from "../components/icons";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAuth } from "../auth/AuthContext";
import AuthLayout from "./AuthLayout";

const VALUE_POINTS = [
  {
    icon: Target,
    title: "Lead discovery",
    text: "Build focused prospect lists and move them directly into your sales workflow.",
  },
  {
    icon: Bot,
    title: "AI Voice Agents",
    text: "Run AI-assisted conversations, call follow-up, and meeting-booking workflows.",
  },
  {
    icon: Mail,
    title: "Outreach workspace",
    text: "Keep email, campaigns, inbox activity, CRM context, and follow-up in one place.",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleAuth } = useAuth();
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState({
    email: "",
    password: "",
    rememberMe: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleSignupRequired, setGoogleSignupRequired] = useState(false);

  const busy = loading || googleLoading;

  const destination = useMemo(
    () => resolvePostLoginPath(location.state?.from),
    [location.state?.from]
  );

  function set(key, value) {
    if (busy) return;

    setError("");
    setGoogleSignupRequired(false);

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

    const email = form.email.trim().toLowerCase();

    if (!email || !form.password) {
      setError("Enter your email address and password.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setGoogleSignupRequired(false);

      await login(
        {
          email,
          password: form.password,
        },
        {
          rememberMe: form.rememberMe,
        }
      );

      navigate(destination, {
        replace: true,
      });
    } catch (requestError) {
      setError(
        safeAuthMessage(
          requestError?.message ||
            "We could not sign you in. Check your details and try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCredential(credential) {
    if (busy) return;

    try {
      setGoogleLoading(true);
      setError("");
      setGoogleSignupRequired(false);

      await googleAuth(
        {
          credential,
          mode: "login",
        },
        {
          rememberMe: form.rememberMe,
        }
      );

      navigate(destination, {
        replace: true,
      });
    } catch (requestError) {
      if (requestError?.code === "GOOGLE_SIGNUP_REQUIRED") {
        setGoogleSignupRequired(true);
        setError(
          "This Google account does not have a ReachFly workspace yet."
        );
      } else {
        setError(
          safeAuthMessage(
            requestError?.message ||
              "Google sign-in could not be completed."
          )
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <>
      <LoginStyles />

      <AuthLayout
        eyebrow="Welcome back"
        title="Your sales workspace is ready when you are."
        text="Sign in to continue managing leads, campaigns, AI Voice conversations, follow-up, and meetings from one focused workspace."
        footer={
          <>
            New to ReachFly?{" "}
            <Link to="/signup">
              Create your workspace
            </Link>
          </>
        }
      >
        <section className="rf-auth-form rf-auth-form-v7">
          <div className="rfl-mobile-brand-copy">
            <span>
              <Sparkles size={14} />
              ReachFly Sales OS
            </span>

            <h1>
              Welcome back.
            </h1>

            <p>
              Sign in to continue your sales workflow.
            </p>
          </div>

          <div className="rf-auth-card-head">
            <span className="rfl-card-eyebrow">
              Secure workspace access
            </span>

            <h2>
              Sign in to ReachFly
            </h2>

            <p>
              Use Google for the fastest sign-in, or continue with your
              workspace email and password.
            </p>
          </div>

          <AnimatePresence initial={false}>
            {error ? (
              <motion.div
                className="rfl-auth-alert"
                role="alert"
                key="login-alert"
                initial={reduceMotion ? false : { opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22 }}
              >
                <span>
                  <X size={14} />
                </span>

                <div>
                  <strong>
                    Sign-in needs attention
                  </strong>

                  <p>
                    {error}
                  </p>

                  {googleSignupRequired ? (
                    <Link to="/signup">
                      Create a workspace
                      <ArrowRight size={12} />
                    </Link>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="rfl-google-zone">
            <GoogleAuthButton
              mode="signin"
              disabled={busy}
              onCredential={handleGoogleCredential}
              onError={(requestError) =>
                setError(
                  safeAuthMessage(
                    requestError?.message ||
                      "Google sign-in could not be loaded."
                  )
                )
              }
            />

            {googleLoading ? (
              <span className="rfl-google-loading">
                <i />
                Completing secure Google sign-in…
              </span>
            ) : null}
          </div>

          <div className="rf-auth-divider">
            <span>
              or continue with email
            </span>
          </div>

          <form
            onSubmit={submit}
            className="rf-auth-email-form"
          >
            <AuthField
              label="Email address"
              icon={Mail}
            >
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  set(
                    "email",
                    event.target.value
                  )
                }
                placeholder="you@company.com"
                disabled={busy}
                required
                autoFocus
              />
            </AuthField>

            <AuthField
              label="Password"
              icon={Lock}
              trailing={
                <button
                  type="button"
                  className="rfl-password-toggle"
                  disabled={busy}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              }
            >
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="current-password"
                value={form.password}
                onChange={(event) =>
                  set(
                    "password",
                    event.target.value
                  )
                }
                placeholder="Your password"
                disabled={busy}
                required
              />
            </AuthField>

            <div className="rf-auth-login-options">
              <label className="rfl-remember">
                <input
                  type="checkbox"
                  checked={form.rememberMe}
                  disabled={busy}
                  onChange={(event) =>
                    set(
                      "rememberMe",
                      event.target.checked
                    )
                  }
                />

                <span aria-hidden="true">
                  <CheckCircle2 size={12} />
                </span>

                <b>
                  Keep me signed in
                </b>
              </label>

              <Link to="/forgot-password">
                Forgot password?
              </Link>
            </div>

            <button
              className="rf-auth-submit"
              type="submit"
              disabled={busy}
            >
              {loading ? (
                <>
                  <i className="rfl-button-spinner" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="rfl-trust-row">
            <span>
              <Shield size={12} />
              Workspace-scoped access
            </span>

            <i />

            <span>
              <Lock size={12} />
              Secure session
            </span>
          </div>
        </section>

        <LoginHeroEnhancement />
      </AuthLayout>
    </>
  );
}

function AuthField({
  label,
  icon: Icon,
  children,
  trailing,
}) {
  return (
    <label className="rf-auth-input rfl-field">
      <span className="rfl-field-label">
        {label}
      </span>

      <div>
        <Icon size={16} />

        {children}

        {trailing}
      </div>
    </label>
  );
}

function LoginHeroEnhancement() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="rfl-hero-enhancement"
      aria-hidden="true"
    >
      <div className="rfl-hero-orbit orbit-one" />
      <div className="rfl-hero-orbit orbit-two" />

      <motion.section
        className="rfl-product-window"
        initial={reduceMotion ? false : { opacity: 0, y: 22, rotateY: -4 }}
        animate={{ opacity: 1, y: 0, rotateY: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, delay: 0.18 }}
      >
        <header>
          <div>
            <span className="rfl-window-dot" />
            <span className="rfl-window-dot" />
            <span className="rfl-window-dot" />
          </div>

          <small>
            ReachFly workspace
          </small>

          <Shield size={12} />
        </header>

        <div className="rfl-product-window-body">
          <aside>
            <span className="active" />
            <span />
            <span />
            <span />
            <span />
          </aside>

          <main>
            <div className="rfl-product-topline">
              <span />
              <i />
            </div>

            <div className="rfl-product-metrics">
              <article>
                <Target size={12} />
                <span />
                <strong />
              </article>

              <article>
                <Phone size={12} />
                <span />
                <strong />
              </article>

              <article>
                <Bot size={12} />
                <span />
                <strong />
              </article>
            </div>

            <div className="rfl-product-table">
              <header>
                <span />
                <span />
                <span />
              </header>

              {Array.from({
                length: 4,
              }).map((_, index) => (
                <div key={index}>
                  <i />
                  <span />
                  <span />
                  <em />
                </div>
              ))}
            </div>
          </main>
        </div>
      </motion.section>

      <div className="rfl-value-stack">
        {VALUE_POINTS.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.title}>
              <span>
                <Icon size={14} />
              </span>

              <div>
                <strong>
                  {item.title}
                </strong>

                <small>
                  {item.text}
                </small>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function resolvePostLoginPath(value) {
  const target =
    typeof value === "string"
      ? value.trim()
      : "";

  if (
    target.startsWith("/app") &&
    !target.startsWith("//")
  ) {
    return target;
  }

  return "/app";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim()
  );
}

function safeAuthMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/Supabase/gi, "authentication service");
}

function LoginStyles() {
  return (
    <style>{`
      :root{
        --rfl-bg:#f8f9fa;
        --rfl-card:#ffffff;
        --rfl-text:#191c1d;
        --rfl-text2:#464554;
        --rfl-muted:#767586;
        --rfl-line:#e2e4e7;
        --rfl-primary:#4648d4;
        --rfl-primary-dark:#3537bb;
        --rfl-primary-soft:#e8e9ff;
        --rfl-violet:#6b38d4;
        --rfl-success:#087a51;
        --rfl-danger:#ba1a1a;
        --rfl-danger-soft:#ffedeb;
        --rfl-sidebar:#2e3132;
        --rfl-ease:cubic-bezier(.2,.8,.2,1);
      }

      .rf-auth-page{
        min-height:100vh!important;
        display:grid!important;
        place-items:center!important;
        overflow:hidden!important;
        padding:24px!important;
        color:var(--rfl-text)!important;
        background:
          radial-gradient(circle at 18% 18%,rgba(70,72,212,.09),transparent 28%),
          radial-gradient(circle at 82% 80%,rgba(107,56,212,.07),transparent 30%),
          linear-gradient(180deg,#fafbfc 0%,#f5f6f7 100%)!important;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
        animation:rfl-page-in .35s var(--rfl-ease);
      }

      .rf-auth-page *,
      .rf-auth-page *::before,
      .rf-auth-page *::after{
        box-sizing:border-box;
      }

      @keyframes rfl-page-in{
        from{opacity:0}
        to{opacity:1}
      }

      @keyframes rfl-panel-in{
        from{opacity:0;transform:translate3d(0,10px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfl-float{
        0%,100%{transform:translate3d(0,0,0)}
        50%{transform:translate3d(0,-5px,0)}
      }

      @keyframes rfl-spin{
        to{transform:rotate(360deg)}
      }

      .rf-auth-shell{
        position:relative!important;
        width:min(1180px,100%)!important;
        min-height:min(760px,calc(100vh - 48px))!important;
        display:grid!important;
        grid-template-columns:minmax(0,1.08fr) minmax(440px,.92fr)!important;
        overflow:hidden!important;
        background:#fff!important;
        border:1px solid rgba(221,224,227,.95)!important;
        border-radius:22px!important;
        box-shadow:
          0 28px 80px rgba(25,28,29,.10),
          0 4px 14px rgba(25,28,29,.04)!important;
      }

      .rf-auth-hero{
        position:relative!important;
        min-width:0!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:space-between!important;
        overflow:hidden!important;
        padding:34px 38px!important;
        color:#fff!important;
        background:
          radial-gradient(circle at 18% 22%,rgba(112,116,255,.30),transparent 34%),
          radial-gradient(circle at 78% 73%,rgba(118,61,216,.26),transparent 35%),
          linear-gradient(145deg,#282b2d 0%,#2f3235 52%,#292c2f 100%)!important;
      }

      .rf-auth-hero::before{
        content:"";
        position:absolute;
        inset:0;
        pointer-events:none;
        opacity:.34;
        background-image:
          linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
        background-size:28px 28px;
        mask-image:linear-gradient(to bottom,#000,transparent 82%);
      }

      .rf-auth-hero::after{
        content:"";
        position:absolute;
        width:420px;
        height:420px;
        left:-160px;
        bottom:-210px;
        pointer-events:none;
        border:1px solid rgba(138,141,255,.18);
        border-radius:50%;
        box-shadow:
          0 0 0 38px rgba(104,106,220,.025),
          0 0 0 80px rgba(104,106,220,.018);
      }

      .rf-auth-brand{
        position:relative!important;
        z-index:3!important;
        display:inline-flex!important;
        align-items:center!important;
        gap:10px!important;
        width:max-content!important;
        color:#fff!important;
        text-decoration:none!important;
      }

      .rf-auth-brand b{
        font:600 17px/22px Geist,Inter,sans-serif!important;
        letter-spacing:-.02em!important;
      }

      .rf-auth-brand svg,
      .rf-auth-brand img{
        filter:drop-shadow(0 5px 14px rgba(0,0,0,.12));
      }

      .rf-auth-copy{
        position:relative!important;
        z-index:3!important;
        max-width:510px!important;
        margin:36px 0 18px!important;
      }

      .rf-auth-eyebrow{
        display:inline-flex!important;
        align-items:center!important;
        min-height:27px!important;
        padding:5px 8px!important;
        color:#cfd0ff!important;
        background:rgba(86,89,218,.16)!important;
        border:1px solid rgba(157,159,255,.14)!important;
        border-radius:999px!important;
        font-size:7px!important;
        font-weight:800!important;
        letter-spacing:.11em!important;
        text-transform:uppercase!important;
      }

      .rf-auth-copy h1{
        max-width:500px!important;
        margin:13px 0 0!important;
        color:#fff!important;
        font:600 clamp(32px,4vw,48px)/1.08 Geist,Inter,sans-serif!important;
        letter-spacing:-.045em!important;
      }

      .rf-auth-copy p{
        max-width:470px!important;
        margin:13px 0 0!important;
        color:rgba(242,244,245,.72)!important;
        font-size:11px!important;
        line-height:18px!important;
      }

      .rf-auth-proof{
        position:relative!important;
        z-index:3!important;
        display:none!important;
      }

      .rfl-hero-enhancement{
        position:absolute;
        z-index:2;
        inset:150px auto 22px 30px;
        width:calc(54% - 55px);
        pointer-events:none;
      }

      .rfl-hero-orbit{
        position:absolute;
        border:1px solid rgba(122,125,250,.11);
        border-radius:50%;
      }

      .rfl-hero-orbit.orbit-one{
        width:250px;
        height:250px;
        right:-70px;
        top:20px;
      }

      .rfl-hero-orbit.orbit-two{
        width:150px;
        height:150px;
        right:-20px;
        top:70px;
      }

      .rfl-product-window{
        position:absolute;
        left:7%;
        right:3%;
        bottom:118px;
        min-height:245px;
        overflow:hidden;
        background:rgba(255,255,255,.975);
        border:1px solid rgba(255,255,255,.78);
        border-radius:12px;
        box-shadow:
          0 24px 55px rgba(0,0,0,.25),
          0 4px 12px rgba(0,0,0,.10);
        transform:perspective(900px) rotateY(-4deg) rotateX(1deg);
        transform-origin:center;
        animation:rfl-float 6s ease-in-out infinite;
      }

      .rfl-product-window > header{
        height:32px;
        display:grid;
        grid-template-columns:1fr auto 1fr;
        align-items:center;
        gap:8px;
        padding:0 10px;
        color:#71747d;
        background:#f7f8f9;
        border-bottom:1px solid #e6e7e9;
      }

      .rfl-product-window > header > div{
        display:flex;
        gap:4px;
      }

      .rfl-window-dot{
        width:6px;
        height:6px;
        background:#d2d4d7;
        border-radius:50%;
      }

      .rfl-product-window > header small{
        font-size:5.5px;
        font-weight:700;
        letter-spacing:.05em;
        text-transform:uppercase;
      }

      .rfl-product-window > header > svg{
        justify-self:end;
      }

      .rfl-product-window-body{
        min-height:210px;
        display:grid;
        grid-template-columns:45px minmax(0,1fr);
      }

      .rfl-product-window-body > aside{
        display:grid;
        align-content:start;
        gap:8px;
        padding:13px 11px;
        background:#303335;
      }

      .rfl-product-window-body > aside span{
        width:22px;
        height:7px;
        display:block;
        background:#55595d;
        border-radius:999px;
      }

      .rfl-product-window-body > aside span.active{
        background:#8688f2;
      }

      .rfl-product-window-body > main{
        display:grid;
        align-content:start;
        gap:11px;
        padding:13px;
        background:#fbfbfc;
      }

      .rfl-product-topline{
        display:flex;
        align-items:center;
        justify-content:space-between;
      }

      .rfl-product-topline > span{
        width:72px;
        height:9px;
        background:#2b2e31;
        border-radius:3px;
      }

      .rfl-product-topline > i{
        width:49px;
        height:17px;
        background:#4648d4;
        border-radius:5px;
      }

      .rfl-product-metrics{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:6px;
      }

      .rfl-product-metrics article{
        min-height:50px;
        display:grid;
        grid-template-columns:20px minmax(0,1fr);
        align-items:start;
        gap:5px;
        padding:8px;
        color:#4648d4;
        background:#fff;
        border:1px solid #e8e9eb;
        border-radius:6px;
      }

      .rfl-product-metrics article svg{
        grid-row:1/3;
      }

      .rfl-product-metrics article span{
        width:60%;
        height:5px;
        background:#c7c9ce;
        border-radius:999px;
      }

      .rfl-product-metrics article strong{
        width:38%;
        height:10px;
        background:#373a3e;
        border-radius:2px;
      }

      .rfl-product-table{
        overflow:hidden;
        background:#fff;
        border:1px solid #e7e8ea;
        border-radius:6px;
      }

      .rfl-product-table > header,
      .rfl-product-table > div{
        display:grid;
        grid-template-columns:1.4fr .75fr .7fr .4fr;
        align-items:center;
        gap:8px;
        padding:0 8px;
      }

      .rfl-product-table > header{
        height:20px;
        background:#f1f2f4;
      }

      .rfl-product-table > div{
        height:29px;
        border-top:1px solid #eff0f1;
      }

      .rfl-product-table header span{
        width:60%;
        height:4px;
        background:#b9bcc1;
        border-radius:999px;
      }

      .rfl-product-table > div i{
        width:65%;
        height:5px;
        background:#43474b;
        border-radius:999px;
      }

      .rfl-product-table > div span{
        width:50%;
        height:4px;
        background:#c9cbd0;
        border-radius:999px;
      }

      .rfl-product-table > div em{
        width:22px;
        height:9px;
        justify-self:end;
        background:#e1f7eb;
        border-radius:999px;
      }

      .rfl-value-stack{
        position:absolute;
        left:3%;
        right:2%;
        bottom:4px;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rfl-value-stack article{
        min-width:0;
        display:flex;
        align-items:flex-start;
        gap:7px;
        padding:9px;
        background:rgba(35,38,40,.72);
        border:1px solid rgba(255,255,255,.07);
        border-radius:8px;
        backdrop-filter:blur(8px);
      }

      .rfl-value-stack article > span{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        flex:0 0 28px;
        color:#c8c9ff;
        background:rgba(98,100,226,.14);
        border-radius:7px;
      }

      .rfl-value-stack article > div{
        min-width:0;
      }

      .rfl-value-stack strong{
        display:block;
        color:#f6f7f8;
        font-size:6.5px;
      }

      .rfl-value-stack small{
        display:block;
        margin-top:2px;
        color:rgba(239,241,242,.50);
        font-size:5.5px;
        line-height:8px;
      }

      .rf-auth-panel{
        position:relative!important;
        z-index:4!important;
        min-width:0!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:center!important;
        padding:34px clamp(30px,4vw,52px)!important;
        background:
          radial-gradient(circle at 100% 0,rgba(70,72,212,.035),transparent 35%),
          #fff!important;
      }

      .rf-auth-card{
        width:100%!important;
        max-width:430px!important;
        margin:0 auto!important;
        padding:0!important;
        background:transparent!important;
        border:0!important;
        border-radius:0!important;
        box-shadow:none!important;
        animation:rfl-panel-in .32s var(--rfl-ease) both;
      }

      .rf-auth-form-v7{
        display:grid!important;
        gap:0!important;
        padding:0!important;
        background:transparent!important;
        border:0!important;
        box-shadow:none!important;
      }

      .rfl-mobile-brand-copy{
        display:none;
      }

      .rf-auth-card-head{
        margin-bottom:20px!important;
      }

      .rfl-card-eyebrow{
        display:block;
        margin-bottom:5px;
        color:var(--rfl-primary);
        font-size:7px;
        font-weight:800;
        letter-spacing:.10em;
        text-transform:uppercase;
      }

      .rf-auth-card-head h2{
        margin:0!important;
        color:var(--rfl-text)!important;
        font:600 27px/34px Geist,Inter,sans-serif!important;
        letter-spacing:-.025em!important;
      }

      .rf-auth-card-head p{
        max-width:390px!important;
        margin:5px 0 0!important;
        color:var(--rfl-text2)!important;
        font-size:9px!important;
        line-height:15px!important;
      }

      .rfl-auth-alert{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:10px 11px;
        margin-bottom:14px;
        color:#7e1b1b;
        background:var(--rfl-danger-soft);
        border:1px solid #ffd0cc;
        border-radius:9px;
        animation:rfl-panel-in .18s var(--rfl-ease);
      }

      .rfl-auth-alert > span{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        flex:0 0 25px;
        color:var(--rfl-danger);
        background:#fff;
        border-radius:7px;
      }

      .rfl-auth-alert > div{
        min-width:0;
      }

      .rfl-auth-alert strong{
        display:block;
        font-size:7px;
      }

      .rfl-auth-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rfl-auth-alert a{
        display:inline-flex;
        align-items:center;
        gap:4px;
        margin-top:5px;
        color:#7431bc;
        font-size:6px;
        font-weight:750;
        text-decoration:none;
      }

      .rfl-google-zone{
        position:relative;
        min-height:45px;
      }

      .rf-google-auth-wrap{
        position:relative!important;
        width:100%!important;
        min-height:44px!important;
      }

      .rf-google-auth-button{
        width:100%!important;
        min-height:44px!important;
        overflow:hidden!important;
        border-radius:8px!important;
      }

      .rf-google-auth-button > div,
      .rf-google-auth-button iframe{
        max-width:100%!important;
      }

      .rf-google-auth-wrap.disabled{
        opacity:.6!important;
      }

      .rf-google-auth-blocker{
        position:absolute!important;
        inset:0!important;
        z-index:5!important;
        cursor:wait!important;
      }

      .rf-google-auth-unavailable{
        min-height:44px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        padding:8px 10px!important;
        color:var(--rfl-muted)!important;
        background:#f5f6f7!important;
        border:1px dashed #d7d9dd!important;
        border-radius:8px!important;
        text-align:center!important;
        font-size:7px!important;
      }

      .rfl-google-loading{
        position:absolute;
        z-index:7;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        color:#4b4d59;
        background:rgba(255,255,255,.93);
        border:1px solid var(--rfl-line);
        border-radius:8px;
        font-size:7px;
        font-weight:650;
      }

      .rfl-google-loading i,
      .rfl-button-spinner{
        width:12px;
        height:12px;
        display:block;
        border:2px solid currentColor;
        border-right-color:transparent;
        border-radius:50%;
        animation:rfl-spin .7s linear infinite;
      }

      .rf-auth-divider{
        position:relative!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        min-height:43px!important;
        margin:1px 0!important;
      }

      .rf-auth-divider::before{
        content:"";
        position:absolute;
        left:0;
        right:0;
        top:50%;
        height:1px;
        background:var(--rfl-line);
      }

      .rf-auth-divider span{
        position:relative!important;
        z-index:1!important;
        padding:0 9px!important;
        color:#8a8995!important;
        background:#fff!important;
        font-size:6px!important;
        font-weight:650!important;
        letter-spacing:.05em!important;
        text-transform:uppercase!important;
      }

      .rf-auth-email-form{
        display:grid!important;
        gap:13px!important;
      }

      .rf-auth-input.rfl-field{
        display:grid!important;
        gap:6px!important;
        margin:0!important;
      }

      .rfl-field-label{
        color:var(--rfl-text)!important;
        font-size:7px!important;
        font-weight:700!important;
      }

      .rf-auth-input.rfl-field > div{
        min-height:45px!important;
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        padding:0 10px!important;
        color:#8c8d95!important;
        background:#fff!important;
        border:1px solid var(--rfl-line)!important;
        border-radius:8px!important;
        box-shadow:0 1px 2px rgba(25,28,29,.015)!important;
        transition:
          border-color .14s var(--rfl-ease),
          box-shadow .14s var(--rfl-ease),
          background .14s var(--rfl-ease)!important;
      }

      .rf-auth-input.rfl-field > div:focus-within{
        background:#fefeff!important;
        border-color:rgba(70,72,212,.55)!important;
        box-shadow:0 0 0 3px rgba(70,72,212,.07)!important;
      }

      .rf-auth-input.rfl-field > div > svg{
        flex:0 0 auto!important;
      }

      .rf-auth-input.rfl-field input{
        min-width:0!important;
        width:100%!important;
        height:43px!important;
        padding:0!important;
        color:var(--rfl-text)!important;
        background:transparent!important;
        border:0!important;
        outline:0!important;
        box-shadow:none!important;
        font-size:9px!important;
      }

      .rf-auth-input.rfl-field input::placeholder{
        color:#a4a4ad!important;
      }

      .rfl-password-toggle{
        min-width:38px;
        height:27px;
        padding:0 7px;
        color:var(--rfl-primary);
        background:var(--rfl-primary-soft);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
      }

      .rfl-password-toggle:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-auth-login-options{
        min-height:26px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:10px!important;
        margin:0!important;
      }

      .rfl-remember{
        display:flex!important;
        align-items:center!important;
        gap:6px!important;
        color:var(--rfl-text2)!important;
        cursor:pointer!important;
      }

      .rfl-remember > input{
        position:absolute!important;
        opacity:0!important;
        pointer-events:none!important;
      }

      .rfl-remember > span{
        width:16px;
        height:16px;
        display:grid;
        place-items:center;
        color:transparent;
        background:#fff;
        border:1px solid #cfd2d6;
        border-radius:5px;
        transition:.14s var(--rfl-ease);
      }

      .rfl-remember > input:checked + span{
        color:#fff;
        background:var(--rfl-primary);
        border-color:var(--rfl-primary);
      }

      .rfl-remember b{
        font-size:7px;
        font-weight:600;
      }

      .rf-auth-login-options > a{
        color:var(--rfl-primary)!important;
        font-size:7px!important;
        font-weight:700!important;
        text-decoration:none!important;
      }

      .rf-auth-login-options > a:hover{
        text-decoration:underline!important;
      }

      .rf-auth-submit{
        min-height:45px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:7px!important;
        width:100%!important;
        margin-top:1px!important;
        padding:9px 13px!important;
        color:#fff!important;
        background:linear-gradient(135deg,#4a4cd8,#4143cb)!important;
        border:1px solid #4143c6!important;
        border-radius:8px!important;
        box-shadow:
          0 8px 18px rgba(70,72,212,.18),
          inset 0 1px rgba(255,255,255,.10)!important;
        cursor:pointer!important;
        font-size:8px!important;
        font-weight:750!important;
        transition:
          transform .14s var(--rfl-ease),
          background .14s var(--rfl-ease),
          box-shadow .14s var(--rfl-ease)!important;
      }

      .rf-auth-submit:hover:not(:disabled){
        transform:translateY(-1px)!important;
        background:linear-gradient(135deg,#4143cb,#3739bb)!important;
        box-shadow:0 11px 24px rgba(70,72,212,.22)!important;
      }

      .rf-auth-submit:disabled{
        opacity:.58!important;
        cursor:not-allowed!important;
      }

      .rfl-trust-row{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:9px;
        margin-top:17px;
        color:#8b8b94;
      }

      .rfl-trust-row span{
        display:flex;
        align-items:center;
        gap:4px;
        font-size:5.8px;
      }

      .rfl-trust-row i{
        width:3px;
        height:3px;
        background:#c6c7cb;
        border-radius:50%;
      }

      .rf-auth-footer{
        width:100%!important;
        max-width:430px!important;
        margin:18px auto 0!important;
        color:var(--rfl-muted)!important;
        text-align:center!important;
        font-size:7px!important;
      }

      .rf-auth-footer a{
        color:var(--rfl-primary)!important;
        font-weight:750!important;
        text-decoration:none!important;
      }

      .rf-auth-footer a:hover{
        text-decoration:underline!important;
      }

      @media(max-width:980px){
        .rf-auth-page{
          overflow:auto!important;
          padding:18px!important;
        }

        .rf-auth-shell{
          width:min(640px,100%)!important;
          min-height:0!important;
          grid-template-columns:1fr!important;
        }

        .rf-auth-hero{
          min-height:240px!important;
          padding:26px 28px!important;
        }

        .rf-auth-copy{
          max-width:500px!important;
          margin:28px 0 0!important;
        }

        .rf-auth-copy h1{
          font-size:34px!important;
        }

        .rf-auth-copy p{
          max-width:500px!important;
        }

        .rfl-hero-enhancement{
          display:none;
        }

        .rf-auth-panel{
          padding:35px 30px!important;
        }
      }

      @media(max-width:620px){
        .rf-auth-page{
          display:block!important;
          min-height:100svh!important;
          padding:0!important;
          background:#fff!important;
        }

        .rf-auth-shell{
          width:100%!important;
          min-height:100svh!important;
          display:block!important;
          border:0!important;
          border-radius:0!important;
          box-shadow:none!important;
        }

        .rf-auth-hero{
          min-height:0!important;
          display:block!important;
          padding:18px 18px 16px!important;
          background:#2e3132!important;
        }

        .rf-auth-hero::before,
        .rf-auth-hero::after{
          display:none!important;
        }

        .rf-auth-brand{
          gap:7px!important;
        }

        .rf-auth-brand b{
          font-size:14px!important;
        }

        .rf-auth-copy{
          display:none!important;
        }

        .rf-auth-panel{
          min-height:calc(100svh - 78px)!important;
          justify-content:flex-start!important;
          padding:26px 18px 34px!important;
        }

        .rfl-mobile-brand-copy{
          display:block;
          margin-bottom:22px;
        }

        .rfl-mobile-brand-copy > span{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:var(--rfl-primary);
          font-size:6px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
        }

        .rfl-mobile-brand-copy h1{
          margin:7px 0 0;
          font:600 28px/34px Geist,Inter,sans-serif;
          letter-spacing:-.03em;
        }

        .rfl-mobile-brand-copy p{
          margin:4px 0 0;
          color:var(--rfl-text2);
          font-size:9px;
        }

        .rf-auth-card-head h2{
          font-size:21px!important;
          line-height:27px!important;
        }

        .rf-auth-card-head p{
          font-size:8px!important;
          line-height:13px!important;
        }
      }

      @media(max-width:390px){
        .rf-auth-login-options{
          align-items:flex-start!important;
          flex-direction:column!important;
        }

        .rfl-trust-row{
          flex-wrap:wrap;
        }
      }



      /* V9 premium login polish */
      .rf-auth-form-v7 .rf-auth-input>div{transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;background:rgba(255,255,255,.92)}
      .rf-auth-form-v7 .rf-auth-input>div:focus-within{transform:translateY(-1px);box-shadow:0 0 0 4px rgba(70,72,212,.08),0 11px 24px rgba(25,28,38,.06)}
      .rf-auth-form-v7 .rf-auth-submit{position:relative;overflow:hidden;box-shadow:0 14px 34px rgba(70,72,212,.24)}
      .rf-auth-form-v7 .rf-auth-submit::after{content:"";position:absolute;inset:-2px auto -2px -40%;width:34%;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);transition:left .55s ease}
      .rf-auth-form-v7 .rf-auth-submit:hover::after{left:112%}
      .rfl-product-window{transform-style:preserve-3d;box-shadow:0 32px 70px rgba(0,0,0,.3),0 0 0 1px rgba(255,255,255,.06)}
      .rfl-value-stack article{transition:transform .22s cubic-bezier(.2,.8,.2,1),background .22s ease}.rfl-value-stack article:hover{transform:translateX(6px);background:rgba(255,255,255,.08)}

            @media(prefers-reduced-motion:reduce){
        .rf-auth-page,
        .rf-auth-card,
        .rfl-auth-alert,
        .rfl-product-window,
        .rfl-google-loading i,
        .rfl-button-spinner{
          animation:none!important;
        }

        .rf-auth-page *,
        .rf-auth-page *::before,
        .rf-auth-page *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
