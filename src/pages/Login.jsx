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
      <LoginContrastStyles />
      <LoginV12ClarityStyles />

      <AuthLayout
        eyebrow="Welcome back"
        title="Return to the conversations that move pipeline."
        text="Your market, context, AI Voice activity, follow-up, and meetings stay connected inside one ReachFly workspace."
        footer={
          <>
            New to ReachFly?{" "}
            <Link to="/signup">
              Create your workspace
            </Link>
          </>
        }
      >
        <section className="rf11-auth-form rf11-auth-form-v7">
          <div className="rf11-login-mobile-brand-copy">
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

          <div className="rf11-auth-card-head">
            <span className="rf11-login-card-eyebrow">
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
                className="rf11-login-auth-alert"
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

          <div className="rf11-login-google-zone">
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
              <span className="rf11-login-google-loading">
                <i />
                Completing secure Google sign-in…
              </span>
            ) : null}
          </div>

          <div className="rf11-auth-divider">
            <span>
              or continue with email
            </span>
          </div>

          <form
            onSubmit={submit}
            className="rf11-auth-email-form"
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
                  className="rf11-login-password-toggle"
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

            <div className="rf11-auth-login-options">
              <label className="rf11-login-remember">
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
              className="rf11-auth-submit"
              type="submit"
              disabled={busy}
            >
              {loading ? (
                <>
                  <i className="rf11-login-button-spinner" />
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

          <div className="rf11-login-trust-row">
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
    <label className="rf11-auth-input rf11-login-field">
      <span className="rf11-login-field-label">
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
      className="rf11-login-hero-enhancement"
      aria-hidden="true"
    >
      <div className="rf11-login-hero-orbit orbit-one" />
      <div className="rf11-login-hero-orbit orbit-two" />

      <motion.section
        className="rf11-login-product-window"
        initial={reduceMotion ? false : { opacity: 0, y: 22, rotateY: -4 }}
        animate={{ opacity: 1, y: 0, rotateY: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, delay: 0.18 }}
      >
        <header>
          <div>
            <span className="rf11-login-window-dot" />
            <span className="rf11-login-window-dot" />
            <span className="rf11-login-window-dot" />
          </div>

          <small>
            ReachFly workspace
          </small>

          <Shield size={12} />
        </header>

        <div className="rf11-login-product-window-body">
          <aside>
            <span className="active" />
            <span />
            <span />
            <span />
            <span />
          </aside>

          <main>
            <div className="rf11-login-product-topline">
              <span />
              <i />
            </div>

            <div className="rf11-login-product-metrics">
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

            <div className="rf11-login-product-table">
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

      <div className="rf11-login-value-stack">
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
        --rf11-login-bg:#f8f9fa;
        --rf11-login-card:#ffffff;
        --rf11-login-text:#191c1d;
        --rf11-login-text2:#464554;
        --rf11-login-muted:#767586;
        --rf11-login-line:#e2e4e7;
        --rf11-login-primary:#4648d4;
        --rf11-login-primary-dark:#3537bb;
        --rf11-login-primary-soft:#e8e9ff;
        --rf11-login-violet:#6b38d4;
        --rf11-login-success:#087a51;
        --rf11-login-danger:#ba1a1a;
        --rf11-login-danger-soft:#ffedeb;
        --rf11-login-sidebar:#2e3132;
        --rf11-login-ease:cubic-bezier(.2,.8,.2,1);
      }

      .rf11-auth-page{
        min-height:100vh!important;
        display:grid!important;
        place-items:center!important;
        overflow:hidden!important;
        padding:24px!important;
        color:var(--rf11-login-text)!important;
        background:
          radial-gradient(circle at 18% 18%,rgba(70,72,212,.09),transparent 28%),
          radial-gradient(circle at 82% 80%,rgba(107,56,212,.07),transparent 30%),
          linear-gradient(180deg,#fafbfc 0%,#f5f6f7 100%)!important;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
        animation:rf11-login-page-in .35s var(--rf11-login-ease);
      }

      .rf11-auth-page *,
      .rf11-auth-page *::before,
      .rf11-auth-page *::after{
        box-sizing:border-box;
      }

      @keyframes rf11-login-page-in{
        from{opacity:0}
        to{opacity:1}
      }

      @keyframes rf11-login-panel-in{
        from{opacity:0;transform:translate3d(0,10px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rf11-login-float{
        0%,100%{transform:translate3d(0,0,0)}
        50%{transform:translate3d(0,-5px,0)}
      }

      @keyframes rf11-login-spin{
        to{transform:rotate(360deg)}
      }

      .rf11-auth-shell{
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

      .rf11-auth-hero{
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

      .rf11-auth-hero::before{
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

      .rf11-auth-hero::after{
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

      .rf11-auth-brand{
        position:relative!important;
        z-index:3!important;
        display:inline-flex!important;
        align-items:center!important;
        gap:10px!important;
        width:max-content!important;
        color:#fff!important;
        text-decoration:none!important;
      }

      .rf11-auth-brand b{
        font:600 17px/22px Geist,Inter,sans-serif!important;
        letter-spacing:-.02em!important;
      }

      .rf11-auth-brand svg,
      .rf11-auth-brand img{
        filter:drop-shadow(0 5px 14px rgba(0,0,0,.12));
      }

      .rf11-auth-copy{
        position:relative!important;
        z-index:3!important;
        max-width:510px!important;
        margin:36px 0 18px!important;
      }

      .rf11-auth-eyebrow{
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

      .rf11-auth-copy h1{
        max-width:500px!important;
        margin:13px 0 0!important;
        color:#fff!important;
        font:600 clamp(32px,4vw,48px)/1.08 Geist,Inter,sans-serif!important;
        letter-spacing:-.045em!important;
      }

      .rf11-auth-copy p{
        max-width:470px!important;
        margin:13px 0 0!important;
        color:rgba(242,244,245,.72)!important;
        font-size:11px!important;
        line-height:18px!important;
      }

      .rf11-auth-proof{
        position:relative!important;
        z-index:3!important;
        display:none!important;
      }

      .rf11-login-hero-enhancement{
        position:absolute;
        z-index:2;
        inset:150px auto 22px 30px;
        width:calc(54% - 55px);
        pointer-events:none;
      }

      .rf11-login-hero-orbit{
        position:absolute;
        border:1px solid rgba(122,125,250,.11);
        border-radius:50%;
      }

      .rf11-login-hero-orbit.orbit-one{
        width:250px;
        height:250px;
        right:-70px;
        top:20px;
      }

      .rf11-login-hero-orbit.orbit-two{
        width:150px;
        height:150px;
        right:-20px;
        top:70px;
      }

      .rf11-login-product-window{
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
        animation:rf11-login-float 6s ease-in-out infinite;
      }

      .rf11-login-product-window > header{
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

      .rf11-login-product-window > header > div{
        display:flex;
        gap:4px;
      }

      .rf11-login-window-dot{
        width:6px;
        height:6px;
        background:#d2d4d7;
        border-radius:50%;
      }

      .rf11-login-product-window > header small{
        font-size:5.5px;
        font-weight:700;
        letter-spacing:.05em;
        text-transform:uppercase;
      }

      .rf11-login-product-window > header > svg{
        justify-self:end;
      }

      .rf11-login-product-window-body{
        min-height:210px;
        display:grid;
        grid-template-columns:45px minmax(0,1fr);
      }

      .rf11-login-product-window-body > aside{
        display:grid;
        align-content:start;
        gap:8px;
        padding:13px 11px;
        background:#303335;
      }

      .rf11-login-product-window-body > aside span{
        width:22px;
        height:7px;
        display:block;
        background:#55595d;
        border-radius:999px;
      }

      .rf11-login-product-window-body > aside span.active{
        background:#8688f2;
      }

      .rf11-login-product-window-body > main{
        display:grid;
        align-content:start;
        gap:11px;
        padding:13px;
        background:#fbfbfc;
      }

      .rf11-login-product-topline{
        display:flex;
        align-items:center;
        justify-content:space-between;
      }

      .rf11-login-product-topline > span{
        width:72px;
        height:9px;
        background:#2b2e31;
        border-radius:3px;
      }

      .rf11-login-product-topline > i{
        width:49px;
        height:17px;
        background:#4648d4;
        border-radius:5px;
      }

      .rf11-login-product-metrics{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:6px;
      }

      .rf11-login-product-metrics article{
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

      .rf11-login-product-metrics article svg{
        grid-row:1/3;
      }

      .rf11-login-product-metrics article span{
        width:60%;
        height:5px;
        background:#c7c9ce;
        border-radius:999px;
      }

      .rf11-login-product-metrics article strong{
        width:38%;
        height:10px;
        background:#373a3e;
        border-radius:2px;
      }

      .rf11-login-product-table{
        overflow:hidden;
        background:#fff;
        border:1px solid #e7e8ea;
        border-radius:6px;
      }

      .rf11-login-product-table > header,
      .rf11-login-product-table > div{
        display:grid;
        grid-template-columns:1.4fr .75fr .7fr .4fr;
        align-items:center;
        gap:8px;
        padding:0 8px;
      }

      .rf11-login-product-table > header{
        height:20px;
        background:#f1f2f4;
      }

      .rf11-login-product-table > div{
        height:29px;
        border-top:1px solid #eff0f1;
      }

      .rf11-login-product-table header span{
        width:60%;
        height:4px;
        background:#b9bcc1;
        border-radius:999px;
      }

      .rf11-login-product-table > div i{
        width:65%;
        height:5px;
        background:#43474b;
        border-radius:999px;
      }

      .rf11-login-product-table > div span{
        width:50%;
        height:4px;
        background:#c9cbd0;
        border-radius:999px;
      }

      .rf11-login-product-table > div em{
        width:22px;
        height:9px;
        justify-self:end;
        background:#e1f7eb;
        border-radius:999px;
      }

      .rf11-login-value-stack{
        position:absolute;
        left:3%;
        right:2%;
        bottom:4px;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf11-login-value-stack article{
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

      .rf11-login-value-stack article > span{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        flex:0 0 28px;
        color:#c8c9ff;
        background:rgba(98,100,226,.14);
        border-radius:7px;
      }

      .rf11-login-value-stack article > div{
        min-width:0;
      }

      .rf11-login-value-stack strong{
        display:block;
        color:#f6f7f8;
        font-size:6.5px;
      }

      .rf11-login-value-stack small{
        display:block;
        margin-top:2px;
        color:rgba(239,241,242,.50);
        font-size:5.5px;
        line-height:8px;
      }

      .rf11-auth-panel{
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

      .rf11-auth-card{
        width:100%!important;
        max-width:430px!important;
        margin:0 auto!important;
        padding:0!important;
        background:transparent!important;
        border:0!important;
        border-radius:0!important;
        box-shadow:none!important;
        animation:rf11-login-panel-in .32s var(--rf11-login-ease) both;
      }

      .rf11-auth-form-v7{
        display:grid!important;
        gap:0!important;
        padding:0!important;
        background:transparent!important;
        border:0!important;
        box-shadow:none!important;
      }

      .rf11-login-mobile-brand-copy{
        display:none;
      }

      .rf11-auth-card-head{
        margin-bottom:20px!important;
      }

      .rf11-login-card-eyebrow{
        display:block;
        margin-bottom:5px;
        color:var(--rf11-login-primary);
        font-size:7px;
        font-weight:800;
        letter-spacing:.10em;
        text-transform:uppercase;
      }

      .rf11-auth-card-head h2{
        margin:0!important;
        color:var(--rf11-login-text)!important;
        font:600 27px/34px Geist,Inter,sans-serif!important;
        letter-spacing:-.025em!important;
      }

      .rf11-auth-card-head p{
        max-width:390px!important;
        margin:5px 0 0!important;
        color:var(--rf11-login-text2)!important;
        font-size:9px!important;
        line-height:15px!important;
      }

      .rf11-login-auth-alert{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:10px 11px;
        margin-bottom:14px;
        color:#7e1b1b;
        background:var(--rf11-login-danger-soft);
        border:1px solid #ffd0cc;
        border-radius:9px;
        animation:rf11-login-panel-in .18s var(--rf11-login-ease);
      }

      .rf11-login-auth-alert > span{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        flex:0 0 25px;
        color:var(--rf11-login-danger);
        background:#fff;
        border-radius:7px;
      }

      .rf11-login-auth-alert > div{
        min-width:0;
      }

      .rf11-login-auth-alert strong{
        display:block;
        font-size:7px;
      }

      .rf11-login-auth-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rf11-login-auth-alert a{
        display:inline-flex;
        align-items:center;
        gap:4px;
        margin-top:5px;
        color:#7431bc;
        font-size:6px;
        font-weight:750;
        text-decoration:none;
      }

      .rf11-login-google-zone{
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
        color:var(--rf11-login-muted)!important;
        background:#f5f6f7!important;
        border:1px dashed #d7d9dd!important;
        border-radius:8px!important;
        text-align:center!important;
        font-size:7px!important;
      }

      .rf11-login-google-loading{
        position:absolute;
        z-index:7;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        color:#4b4d59;
        background:rgba(255,255,255,.93);
        border:1px solid var(--rf11-login-line);
        border-radius:8px;
        font-size:7px;
        font-weight:650;
      }

      .rf11-login-google-loading i,
      .rf11-login-button-spinner{
        width:12px;
        height:12px;
        display:block;
        border:2px solid currentColor;
        border-right-color:transparent;
        border-radius:50%;
        animation:rf11-login-spin .7s linear infinite;
      }

      .rf11-auth-divider{
        position:relative!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        min-height:43px!important;
        margin:1px 0!important;
      }

      .rf11-auth-divider::before{
        content:"";
        position:absolute;
        left:0;
        right:0;
        top:50%;
        height:1px;
        background:var(--rf11-login-line);
      }

      .rf11-auth-divider span{
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

      .rf11-auth-email-form{
        display:grid!important;
        gap:13px!important;
      }

      .rf11-auth-input.rf11-login-field{
        display:grid!important;
        gap:6px!important;
        margin:0!important;
      }

      .rf11-login-field-label{
        color:var(--rf11-login-text)!important;
        font-size:7px!important;
        font-weight:700!important;
      }

      .rf11-auth-input.rf11-login-field > div{
        min-height:45px!important;
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        padding:0 10px!important;
        color:#8c8d95!important;
        background:#fff!important;
        border:1px solid var(--rf11-login-line)!important;
        border-radius:8px!important;
        box-shadow:0 1px 2px rgba(25,28,29,.015)!important;
        transition:
          border-color .14s var(--rf11-login-ease),
          box-shadow .14s var(--rf11-login-ease),
          background .14s var(--rf11-login-ease)!important;
      }

      .rf11-auth-input.rf11-login-field > div:focus-within{
        background:#fefeff!important;
        border-color:rgba(70,72,212,.55)!important;
        box-shadow:0 0 0 3px rgba(70,72,212,.07)!important;
      }

      .rf11-auth-input.rf11-login-field > div > svg{
        flex:0 0 auto!important;
      }

      .rf11-auth-input.rf11-login-field input{
        min-width:0!important;
        width:100%!important;
        height:43px!important;
        padding:0!important;
        color:var(--rf11-login-text)!important;
        background:transparent!important;
        border:0!important;
        outline:0!important;
        box-shadow:none!important;
        font-size:9px!important;
      }

      .rf11-auth-input.rf11-login-field input::placeholder{
        color:#a4a4ad!important;
      }

      .rf11-login-password-toggle{
        min-width:38px;
        height:27px;
        padding:0 7px;
        color:var(--rf11-login-primary);
        background:var(--rf11-login-primary-soft);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
      }

      .rf11-login-password-toggle:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf11-auth-login-options{
        min-height:26px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:10px!important;
        margin:0!important;
      }

      .rf11-login-remember{
        display:flex!important;
        align-items:center!important;
        gap:6px!important;
        color:var(--rf11-login-text2)!important;
        cursor:pointer!important;
      }

      .rf11-login-remember > input{
        position:absolute!important;
        opacity:0!important;
        pointer-events:none!important;
      }

      .rf11-login-remember > span{
        width:16px;
        height:16px;
        display:grid;
        place-items:center;
        color:transparent;
        background:#fff;
        border:1px solid #cfd2d6;
        border-radius:5px;
        transition:.14s var(--rf11-login-ease);
      }

      .rf11-login-remember > input:checked + span{
        color:#fff;
        background:var(--rf11-login-primary);
        border-color:var(--rf11-login-primary);
      }

      .rf11-login-remember b{
        font-size:7px;
        font-weight:600;
      }

      .rf11-auth-login-options > a{
        color:var(--rf11-login-primary)!important;
        font-size:7px!important;
        font-weight:700!important;
        text-decoration:none!important;
      }

      .rf11-auth-login-options > a:hover{
        text-decoration:underline!important;
      }

      .rf11-auth-submit{
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
          transform .14s var(--rf11-login-ease),
          background .14s var(--rf11-login-ease),
          box-shadow .14s var(--rf11-login-ease)!important;
      }

      .rf11-auth-submit:hover:not(:disabled){
        transform:translateY(-1px)!important;
        background:linear-gradient(135deg,#4143cb,#3739bb)!important;
        box-shadow:0 11px 24px rgba(70,72,212,.22)!important;
      }

      .rf11-auth-submit:disabled{
        opacity:.58!important;
        cursor:not-allowed!important;
      }

      .rf11-login-trust-row{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:9px;
        margin-top:17px;
        color:#8b8b94;
      }

      .rf11-login-trust-row span{
        display:flex;
        align-items:center;
        gap:4px;
        font-size:5.8px;
      }

      .rf11-login-trust-row i{
        width:3px;
        height:3px;
        background:#c6c7cb;
        border-radius:50%;
      }

      .rf11-auth-footer{
        width:100%!important;
        max-width:430px!important;
        margin:18px auto 0!important;
        color:var(--rf11-login-muted)!important;
        text-align:center!important;
        font-size:7px!important;
      }

      .rf11-auth-footer a{
        color:var(--rf11-login-primary)!important;
        font-weight:750!important;
        text-decoration:none!important;
      }

      .rf11-auth-footer a:hover{
        text-decoration:underline!important;
      }

      @media(max-width:980px){
        .rf11-auth-page{
          overflow:auto!important;
          padding:18px!important;
        }

        .rf11-auth-shell{
          width:min(640px,100%)!important;
          min-height:0!important;
          grid-template-columns:1fr!important;
        }

        .rf11-auth-hero{
          min-height:240px!important;
          padding:26px 28px!important;
        }

        .rf11-auth-copy{
          max-width:500px!important;
          margin:28px 0 0!important;
        }

        .rf11-auth-copy h1{
          font-size:34px!important;
        }

        .rf11-auth-copy p{
          max-width:500px!important;
        }

        .rf11-login-hero-enhancement{
          display:none;
        }

        .rf11-auth-panel{
          padding:35px 30px!important;
        }
      }

      @media(max-width:620px){
        .rf11-auth-page{
          display:block!important;
          min-height:100svh!important;
          padding:0!important;
          background:#fff!important;
        }

        .rf11-auth-shell{
          width:100%!important;
          min-height:100svh!important;
          display:block!important;
          border:0!important;
          border-radius:0!important;
          box-shadow:none!important;
        }

        .rf11-auth-hero{
          min-height:0!important;
          display:block!important;
          padding:18px 18px 16px!important;
          background:#2e3132!important;
        }

        .rf11-auth-hero::before,
        .rf11-auth-hero::after{
          display:none!important;
        }

        .rf11-auth-brand{
          gap:7px!important;
        }

        .rf11-auth-brand b{
          font-size:14px!important;
        }

        .rf11-auth-copy{
          display:none!important;
        }

        .rf11-auth-panel{
          min-height:calc(100svh - 78px)!important;
          justify-content:flex-start!important;
          padding:26px 18px 34px!important;
        }

        .rf11-login-mobile-brand-copy{
          display:block;
          margin-bottom:22px;
        }

        .rf11-login-mobile-brand-copy > span{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:var(--rf11-login-primary);
          font-size:6px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
        }

        .rf11-login-mobile-brand-copy h1{
          margin:7px 0 0;
          font:600 28px/34px Geist,Inter,sans-serif;
          letter-spacing:-.03em;
        }

        .rf11-login-mobile-brand-copy p{
          margin:4px 0 0;
          color:var(--rf11-login-text2);
          font-size:9px;
        }

        .rf11-auth-card-head h2{
          font-size:21px!important;
          line-height:27px!important;
        }

        .rf11-auth-card-head p{
          font-size:8px!important;
          line-height:13px!important;
        }
      }

      @media(max-width:390px){
        .rf11-auth-login-options{
          align-items:flex-start!important;
          flex-direction:column!important;
        }

        .rf11-login-trust-row{
          flex-wrap:wrap;
        }
      }



      /* V9 premium login polish */
      .rf11-auth-form-v7 .rf11-auth-input>div{transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;background:rgba(255,255,255,.92)}
      .rf11-auth-form-v7 .rf11-auth-input>div:focus-within{transform:translateY(-1px);box-shadow:0 0 0 4px rgba(70,72,212,.08),0 11px 24px rgba(25,28,38,.06)}
      .rf11-auth-form-v7 .rf11-auth-submit{position:relative;overflow:hidden;box-shadow:0 14px 34px rgba(70,72,212,.24)}
      .rf11-auth-form-v7 .rf11-auth-submit::after{content:"";position:absolute;inset:-2px auto -2px -40%;width:34%;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);transition:left .55s ease}
      .rf11-auth-form-v7 .rf11-auth-submit:hover::after{left:112%}
      .rf11-login-product-window{transform-style:preserve-3d;box-shadow:0 32px 70px rgba(0,0,0,.3),0 0 0 1px rgba(255,255,255,.06)}
      .rf11-login-value-stack article{transition:transform .22s cubic-bezier(.2,.8,.2,1),background .22s ease}.rf11-login-value-stack article:hover{transform:translateX(6px);background:rgba(255,255,255,.08)}

            @media(prefers-reduced-motion:reduce){
        .rf11-auth-page,
        .rf11-auth-card,
        .rf11-login-auth-alert,
        .rf11-login-product-window,
        .rf11-login-google-loading i,
        .rf11-login-button-spinner{
          animation:none!important;
        }

        .rf11-auth-page *,
        .rf11-auth-page *::before,
        .rf11-auth-page *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}


function LoginV12ClarityStyles() {
  return <style>{`
/* ReachFly V12 — Login clarity */
.rf11-login-card-eyebrow{margin-bottom:9px!important}.rf11-login-google-zone{margin-top:22px!important}.rf11-auth-email-form{gap:16px!important}.rf11-login-auth-alert{color:#ffc8c8!important;background:rgba(162,45,68,.14)!important;border-color:rgba(255,113,133,.22)!important}.rf11-login-auth-alert>span{color:#ff91a2!important;background:rgba(255,255,255,.055)!important}.rf11-login-auth-alert p{font-size:10px!important;line-height:1.45!important}.rf11-login-auth-alert strong{font-size:11px!important}.rf11-login-auth-alert a{color:#c6bfff!important;font-size:10px!important}
.rf11-login-mobile-brand-copy{color:#f8f9ff!important}.rf11-login-mobile-brand-copy p{color:#aeb6ce!important}
`}</style>;
}

function LoginContrastStyles() {
  return (
    <style>{`
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-form.rf11-auth-form-v7{color:#172019!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-card-eyebrow{color:#506056!important;background:#eef3ee!important;border:1px solid #dce5dd!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-card-head h2{color:#111814!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-card-head p{color:#556159!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-input.rf11-login-field .rf11-login-field-label{color:#2b382f!important;font-weight:700!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-input.rf11-login-field>div{min-height:58px!important;color:#536159!important;background:#f6f8f5!important;border:1px solid #cbd5cc!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 5px 16px rgba(32,48,36,.035)!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-input.rf11-login-field>div:hover{border-color:#b8c6ba!important;background:#f3f6f2!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-input.rf11-login-field>div:focus-within{color:#31463a!important;background:#fff!important;border-color:#87998a!important;box-shadow:0 0 0 4px rgba(45,73,52,.075),0 10px 28px rgba(31,48,35,.055)!important;transform:none!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-input.rf11-login-field>div>svg{color:#66746a!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-input.rf11-login-field input{color:#172019!important;background:transparent!important;caret-color:#1c2e1e!important;font-size:14px!important;font-weight:550!important;opacity:1!important;-webkit-text-fill-color:#172019!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-input.rf11-login-field input::placeholder{color:#748077!important;opacity:1!important;font-weight:500!important;-webkit-text-fill-color:#748077!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-password-toggle{min-width:58px!important;min-height:38px!important;color:#304136!important;background:#edf2ed!important;border:1px solid #d3ddd5!important;border-radius:11px!important;font-weight:700!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-password-toggle:hover{color:#172019!important;background:#e6ede7!important;border-color:#c5d1c7!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-login-options,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-remember,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-remember b{color:#405046!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-login-options>a{color:#233b2a!important;font-weight:700!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-divider,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-divider span{color:#66736a!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-divider span{background:#fbfcfa!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-divider:before,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-divider:after{background:#d9e0da!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-submit{color:#fff!important;background:#1c2e1e!important;border-color:#1c2e1e!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-trust-row,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-trust-row span{color:#647168!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-trust-row svg{color:#66786b!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-auth-alert{color:#7e2f32!important;background:#fff4f4!important;border-color:#eccdce!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-auth-alert strong{color:#672226!important}.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-login-auth-alert p{color:#7d3d40!important}
      @media(max-width:680px){.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-input.rf11-login-field>div{min-height:54px!important}.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-input.rf11-login-field input{font-size:15px!important}}
    `}</style>
  );
}

