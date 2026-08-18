import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  KeyRound,
  Lock,
  Shield,
  Sparkles,
  X,
} from "../components/icons";
import { api } from "../api";
import AuthLayout from "./AuthLayout";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = String(searchParams.get("token") || "").trim();

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(
    () => getPasswordStrength(form.password),
    [form.password]
  );

  const valid =
    Boolean(token) &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword;

  function set(key, value) {
    if (loading) return;

    setError("");

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (loading) return;

    if (!token) {
      setError("This password reset link is missing its secure token.");
      return;
    }

    if (form.password.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await api.resetPassword({
        token,
        password: form.password,
      });

      setComplete(true);
      setForm({
        password: "",
        confirmPassword: "",
      });
    } catch (requestError) {
      setError(
        safeAuthMessage(
          requestError?.message ||
            "Your password could not be reset. The link may have expired."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return (
      <>
        <ResetPasswordStyles />

        <AuthLayout
          eyebrow="Password updated"
          title="Your ReachFly account is secure again."
          text="Your password has been changed. You can now return to sign in and continue your workspace."
          footer={
            <>
              Need another recovery link?{" "}
              <Link to="/forgot-password">
                Start password recovery
              </Link>
            </>
          }
        >
          <section className="rf-auth-form rf-reset-v7">
            <div className="rfr-success">
              <div className="rfr-success-mark">
                <span>
                  <CheckCircle2 size={27} />
                </span>
                <i />
              </div>

              <span className="rfr-eyebrow">
                Password changed
              </span>

              <h2>
                You're ready to sign in
              </h2>

              <p>
                The reset request has been completed. Use your new password the
                next time you access ReachFly.
              </p>

              <div className="rfr-security-card">
                <Shield size={15} />

                <div>
                  <strong>
                    Security update complete
                  </strong>

                  <small>
                    Your previous password should no longer be used for this
                    account.
                  </small>
                </div>
              </div>

              <button
                className="rf-auth-submit"
                type="button"
                onClick={() =>
                  navigate("/login", {
                    replace: true,
                  })
                }
              >
                Continue to sign in

                <ArrowRight size={15} />
              </button>
            </div>
          </section>
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <ResetPasswordStyles />

      <AuthLayout
        eyebrow="Secure recovery"
        title="Choose a new password for your ReachFly account."
        text="Use a strong password that you do not reuse elsewhere. The secure recovery token from your email is required to complete this change."
        footer={
          <>
            Need a new recovery link?{" "}
            <Link to="/forgot-password">
              Request another
            </Link>
          </>
        }
      >
        <section className="rf-auth-form rf-reset-v7">
          <div className="rfr-mobile-intro">
            <span>
              <Sparkles size={13} />
              ReachFly account recovery
            </span>

            <h1>
              Create a new password.
            </h1>

            <p>
              Secure your account and return to your workspace.
            </p>
          </div>

          <form onSubmit={submit} noValidate>
            <header className="rf-auth-card-head rfr-card-head">
              <span className="rfr-eyebrow">
                Final recovery step
              </span>

              <h2>
                Set a new password
              </h2>

              <p>
                Your password must contain at least 8 characters. A longer,
                unique passphrase is recommended.
              </p>
            </header>

            {!token ? (
              <div className="rfr-alert" role="alert">
                <span>
                  <X size={13} />
                </span>

                <div>
                  <strong>
                    Reset link is incomplete
                  </strong>

                  <p>
                    This page needs the secure token from your password reset
                    email.
                  </p>

                  <Link to="/forgot-password">
                    Request a new reset link
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rfr-alert" role="alert">
                <span>
                  <X size={13} />
                </span>

                <div>
                  <strong>
                    Password reset needs attention
                  </strong>

                  <p>
                    {error}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Dismiss password reset error"
                >
                  <X size={10} />
                </button>
              </div>
            ) : null}

            <div className="rfr-reset-visual">
              <div>
                <span>
                  <KeyRound size={21} />
                </span>

                <i />
              </div>

              <section>
                <strong>
                  Secure password replacement
                </strong>

                <p>
                  ReachFly sends only the recovery token required for this
                  reset. Your password is never displayed after submission.
                </p>
              </section>
            </div>

            <PasswordField
              label="New password"
              value={form.password}
              show={showPassword}
              disabled={loading || !token}
              onChange={(value) => set("password", value)}
              onToggle={() => setShowPassword((current) => !current)}
            />

            <PasswordStrength
              password={form.password}
              strength={strength}
            />

            <PasswordField
              label="Confirm new password"
              value={form.confirmPassword}
              show={showConfirmation}
              disabled={loading || !token}
              onChange={(value) => set("confirmPassword", value)}
              onToggle={() => setShowConfirmation((current) => !current)}
              confirmation
              matches={
                Boolean(form.confirmPassword) &&
                form.password === form.confirmPassword
              }
            />

            <div className="rfr-password-rules">
              <Rule
                met={form.password.length >= 8}
                text="At least 8 characters"
              />
              <Rule
                met={/[A-Z]/.test(form.password) && /[a-z]/.test(form.password)}
                text="Upper and lowercase letters"
              />
              <Rule
                met={/\d/.test(form.password)}
                text="At least one number"
              />
              <Rule
                met={
                  Boolean(form.confirmPassword) &&
                  form.password === form.confirmPassword
                }
                text="Passwords match"
              />
            </div>

            <div className="rfr-security-note">
              <Shield size={13} />

              <p>
                If you did not request this password reset, do not submit this
                form. Request a fresh recovery link only from ReachFly's own
                sign-in flow.
              </p>
            </div>

            <button
              className="rf-auth-submit rfr-submit"
              type="submit"
              disabled={loading || !valid}
            >
              {loading ? (
                <>
                  <span className="rfr-spinner" />
                  Updating password…
                </>
              ) : (
                <>
                  Update password
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            <Link className="rfr-back" to="/login">
              <ArrowLeft size={12} />
              Back to sign in
            </Link>
          </form>
        </section>
      </AuthLayout>
    </>
  );
}

function PasswordField({
  label,
  value,
  show,
  disabled,
  onChange,
  onToggle,
  confirmation = false,
  matches = false,
}) {
  return (
    <label className="rfr-field">
      <span>
        {label}
      </span>

      <div>
        <Lock size={15} />

        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={confirmation ? "Repeat your new password" : "Create a new password"}
          disabled={disabled}
          minLength={8}
          required
        />

        {confirmation && matches ? (
          <i className="rfr-match">
            <CheckCircle2 size={13} />
          </i>
        ) : null}

        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

function PasswordStrength({
  password,
  strength,
}) {
  const labels = ["", "Basic", "Fair", "Good", "Strong"];

  return (
    <div className="rfr-strength">
      <div>
        {[1, 2, 3, 4].map((level) => (
          <i
            key={level}
            className={level <= strength ? "active" : ""}
          />
        ))}
      </div>

      <span>
        {password ? labels[strength] : "Password strength"}
      </span>
    </div>
  );
}

function Rule({
  met,
  text,
}) {
  return (
    <span className={met ? "met" : ""}>
      <i>
        {met ? (
          <Check size={10} />
        ) : null}
      </i>

      {text}
    </span>
  );
}

function getPasswordStrength(value) {
  const password = String(value || "");

  if (!password) return 0;

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  return Math.min(4, score);
}

function safeAuthMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/Supabase/gi, "authentication service");
}

function ResetPasswordStyles() {
  return (
    <style>{`
      .rf-reset-v7{
        --rfr-text:#191c1d;
        --rfr-text2:#464554;
        --rfr-muted:#767586;
        --rfr-line:#e2e4e7;
        --rfr-soft:#f3f4f5;
        --rfr-primary:#4648d4;
        --rfr-psoft:#e8e9ff;
        --rfr-green:#087a51;
        --rfr-gsoft:#dff8eb;
        --rfr-red:#ba1a1a;
        --rfr-rsoft:#ffedeb;
        --rfr-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
      }

      .rf-reset-v7 *,
      .rf-reset-v7 *::before,
      .rf-reset-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfrIn{
        from{opacity:0;transform:translateY(7px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfrSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfrPulse{
        0%,100%{transform:scale(.95);opacity:.35}
        50%{transform:scale(1.04);opacity:.55}
      }

      .rf-reset-v7 > form,
      .rfr-success{
        animation:rfrIn .22s var(--rfr-ease);
      }

      .rfr-mobile-intro{
        display:none;
      }

      .rfr-eyebrow{
        display:block;
        margin-bottom:5px;
        color:var(--rfr-primary);
        font-size:6px;
        font-weight:800;
        letter-spacing:.1em;
        text-transform:uppercase;
      }

      .rfr-card-head{
        margin-bottom:14px!important;
      }

      .rfr-card-head h2,
      .rfr-success h2{
        margin:0;
        color:var(--rfr-text);
        font:600 26px/33px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rfr-card-head p{
        margin:5px 0 0;
        color:var(--rfr-text2);
        font-size:8px;
        line-height:13px;
      }

      .rfr-alert{
        display:grid;
        grid-template-columns:25px minmax(0,1fr) auto;
        align-items:start;
        gap:7px;
        padding:9px 10px;
        margin-bottom:12px;
        color:#7f1b1b;
        background:var(--rfr-rsoft);
        border:1px solid #ffd0cc;
        border-radius:8px;
      }

      .rfr-alert > span{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:7px;
      }

      .rfr-alert > div{
        min-width:0;
      }

      .rfr-alert strong{
        display:block;
        font-size:7px;
      }

      .rfr-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rfr-alert a{
        display:inline-flex;
        align-items:center;
        gap:4px;
        margin-top:5px;
        color:#7131bc;
        text-decoration:none;
        font-size:6px;
        font-weight:700;
      }

      .rfr-alert > button{
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        padding:0;
        color:currentColor;
        background:transparent;
        border:0;
        cursor:pointer;
      }

      .rfr-reset-visual{
        min-height:93px;
        display:grid;
        grid-template-columns:62px minmax(0,1fr);
        align-items:center;
        gap:12px;
        padding:11px;
        margin-bottom:13px;
        background:
          radial-gradient(circle at 8% 50%,rgba(70,72,212,.11),transparent 30%),
          linear-gradient(135deg,#f8f8fc,#f3f4f7);
        border:1px solid #eceef1;
        border-radius:10px;
      }

      .rfr-reset-visual > div{
        position:relative;
        width:58px;
        height:58px;
        display:grid;
        place-items:center;
      }

      .rfr-reset-visual > div > span{
        position:relative;
        z-index:2;
        width:41px;
        height:41px;
        display:grid;
        place-items:center;
        color:#fff;
        background:linear-gradient(135deg,#5557df,#4648d4);
        border-radius:11px;
        box-shadow:0 7px 16px rgba(70,72,212,.18);
      }

      .rfr-reset-visual > div > i{
        position:absolute;
        inset:0;
        border:1px solid rgba(70,72,212,.15);
        border-radius:50%;
      }

      .rfr-reset-visual section strong{
        display:block;
        font-size:8px;
      }

      .rfr-reset-visual section p{
        margin:3px 0 0;
        color:var(--rfr-muted);
        font-size:6.7px;
        line-height:11px;
      }

      .rfr-field{
        display:grid;
        gap:5px;
        margin-bottom:10px;
      }

      .rfr-field > span{
        font-size:7px;
        font-weight:700;
      }

      .rfr-field > div{
        min-height:45px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 9px;
        color:#8b8c95;
        background:#fff;
        border:1px solid var(--rfr-line);
        border-radius:8px;
      }

      .rfr-field > div:focus-within{
        border-color:rgba(70,72,212,.55);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rfr-field input{
        min-width:0;
        width:100%;
        height:43px;
        padding:0;
        color:var(--rfr-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:9px;
      }

      .rfr-field button{
        min-width:38px;
        height:27px;
        padding:0 7px;
        color:var(--rfr-primary);
        background:var(--rfr-psoft);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
      }

      .rfr-field button:disabled{
        opacity:.45;
      }

      .rfr-match{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        color:var(--rfr-green);
        background:var(--rfr-gsoft);
        border-radius:7px;
        font-style:normal;
      }

      .rfr-strength{
        display:flex;
        align-items:center;
        gap:8px;
        margin:-4px 0 10px;
      }

      .rfr-strength > div{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:4px;
        flex:1;
      }

      .rfr-strength i{
        height:4px;
        background:#e6e7e9;
        border-radius:999px;
      }

      .rfr-strength i.active{
        background:var(--rfr-primary);
      }

      .rfr-strength span{
        min-width:85px;
        color:var(--rfr-muted);
        text-align:right;
        font-size:6px;
      }

      .rfr-password-rules{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:5px 9px;
        padding:10px;
        margin:3px 0 10px;
        background:#f8f8fa;
        border-radius:8px;
      }

      .rfr-password-rules > span{
        display:flex;
        align-items:center;
        gap:5px;
        color:#8a8b94;
        font-size:6px;
      }

      .rfr-password-rules > span > i{
        width:15px;
        height:15px;
        display:grid;
        place-items:center;
        flex:0 0 15px;
        background:#e5e7e9;
        border-radius:50%;
      }

      .rfr-password-rules > span.met{
        color:#446359;
      }

      .rfr-password-rules > span.met > i{
        color:#fff;
        background:var(--rfr-green);
      }

      .rfr-security-note{
        display:flex;
        gap:7px;
        padding:9px 10px;
        margin-bottom:12px;
        color:var(--rfr-primary);
        background:var(--rfr-psoft);
        border-radius:8px;
      }

      .rfr-security-note p{
        margin:0;
        color:var(--rfr-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rfr-submit{
        min-height:45px!important;
      }

      .rfr-spinner{
        width:12px;
        height:12px;
        border:2px solid currentColor;
        border-right-color:transparent;
        border-radius:50%;
        animation:rfrSpin .7s linear infinite;
      }

      .rfr-back{
        width:max-content;
        display:flex;
        align-items:center;
        gap:5px;
        margin:11px auto 0;
        color:var(--rfr-muted)!important;
        text-decoration:none;
        font-size:6.5px;
        font-weight:650;
      }

      .rfr-success{
        display:grid;
        justify-items:center;
        text-align:center;
      }

      .rfr-success-mark{
        position:relative;
        width:80px;
        height:80px;
        display:grid;
        place-items:center;
        margin-bottom:12px;
      }

      .rfr-success-mark > span{
        position:relative;
        z-index:2;
        width:54px;
        height:54px;
        display:grid;
        place-items:center;
        color:var(--rfr-green);
        background:var(--rfr-gsoft);
        border-radius:15px;
      }

      .rfr-success-mark > i{
        position:absolute;
        inset:5px;
        background:rgba(8,122,81,.06);
        border-radius:50%;
        animation:rfrPulse 2s ease-in-out infinite;
      }

      .rfr-success > p{
        max-width:390px;
        margin:6px 0 14px;
        color:var(--rfr-text2);
        font-size:8px;
        line-height:13px;
      }

      .rfr-security-card{
        width:100%;
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:10px;
        margin-bottom:13px;
        color:var(--rfr-green);
        background:var(--rfr-gsoft);
        border-radius:8px;
        text-align:left;
      }

      .rfr-security-card > div{
        display:grid;
      }

      .rfr-security-card strong{
        color:#075b3d;
        font-size:7px;
      }

      .rfr-security-card small{
        color:#3f6b5d;
        font-size:6px;
        line-height:10px;
      }

      @media(max-width:620px){
        .rfr-mobile-intro{
          display:block;
          margin-bottom:20px;
        }

        .rfr-mobile-intro > span{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:var(--rfr-primary);
          font-size:6px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
        }

        .rfr-mobile-intro h1{
          margin:7px 0 0;
          font:600 27px/33px Geist,Inter,sans-serif;
          letter-spacing:-.03em;
        }

        .rfr-mobile-intro p{
          margin:4px 0 0;
          color:var(--rfr-text2);
          font-size:8px;
        }

        .rfr-card-head h2,
        .rfr-success h2{
          font-size:21px;
          line-height:27px;
        }
      }

      @media(max-width:400px){
        .rfr-password-rules{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-reset-v7 > form,
        .rfr-success,
        .rfr-spinner,
        .rfr-success-mark > i{
          animation:none!important;
        }

        .rf-reset-v7 *,
        .rf-reset-v7 *::before,
        .rf-reset-v7 *::after{
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
