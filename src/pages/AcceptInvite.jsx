import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Shield,
  Sparkles,
  UserRound,
  Users,
  X,
} from "../components/icons";
import { useAuth } from "../auth/AuthContext";
import AuthLayout from "./AuthLayout";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { acceptInvite } = useAuth();

  const token = String(searchParams.get("token") || "").trim();

  const [form, setForm] = useState({
    name: "",
    password: "",
    confirmPassword: "",
    rememberMe: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedUser, setAcceptedUser] = useState(null);
  const [error, setError] = useState("");

  const strength = useMemo(
    () => getPasswordStrength(form.password),
    [form.password]
  );

  const canSubmit =
    Boolean(token) &&
    Boolean(form.name.trim()) &&
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
      setError("This invitation link is missing its secure token.");
      return;
    }

    if (!form.name.trim()) {
      setError("Enter your name to continue.");
      return;
    }

    if (form.password.length < 8) {
      setError("Create a password with at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await acceptInvite(
        {
          token,
          name: form.name.trim(),
          password: form.password,
        },
        {
          rememberMe: form.rememberMe,
        }
      );

      setAcceptedUser(
        response?.user ||
          response?.profile ||
          response ||
          null
      );

      setAccepted(true);
    } catch (requestError) {
      setError(
        safeAuthMessage(
          requestError?.message ||
            "This invitation could not be accepted."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  if (accepted) {
    return (
      <>
        <AcceptInviteStyles />

        <AuthLayout
          eyebrow="Welcome to ReachFly"
          title="Your workspace access is ready."
          text="The invitation has been accepted and your ReachFly session is active. Continue into the workspace to see the leads, campaigns, calling, and tools available to your role."
          footer={
            <>
              Need another account?{" "}
              <Link to="/login">
                Return to sign in
              </Link>
            </>
          }
        >
          <section className="rf-auth-form rf-invite-v7">
            <div className="rfi-success">
              <div className="rfi-success-icon">
                <span>
                  <CheckCircle2 size={27} />
                </span>
                <i />
              </div>

              <span className="rfi-eyebrow">
                Invitation accepted
              </span>

              <h2>
                Welcome{acceptedUser?.name ? `, ${acceptedUser.name}` : ""}
              </h2>

              <p>
                Your team account has been created and attached to the invited
                workspace.
              </p>

              <div className="rfi-success-summary">
                <span>
                  <Users size={15} />
                </span>

                <div>
                  <small>
                    Workspace access
                  </small>

                  <strong>
                    {formatRole(
                      acceptedUser?.workspaceRole ||
                        acceptedUser?.role ||
                        "team member"
                    )}
                  </strong>
                </div>

                <em>
                  Active
                </em>
              </div>

              <button
                className="rf-auth-submit"
                type="button"
                onClick={() =>
                  navigate("/app", {
                    replace: true,
                  })
                }
              >
                Open ReachFly workspace

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
      <AcceptInviteStyles />

      <AuthLayout
        eyebrow="Team invitation"
        title="Join your team inside the ReachFly sales workspace."
        text="Create your own secure login from the invitation link. Your workspace role and permissions are assigned by the team that invited you."
        footer={
          <>
            Already have a ReachFly account?{" "}
            <Link to="/login">
              Sign in
            </Link>
          </>
        }
      >
        <section className="rf-auth-form rf-invite-v7">
          <div className="rfi-mobile-intro">
            <span>
              <Sparkles size={13} />
              ReachFly team invitation
            </span>

            <h1>
              Join your workspace.
            </h1>

            <p>
              Create your account from the secure invitation.
            </p>
          </div>

          <form onSubmit={submit} noValidate>
            <header className="rf-auth-card-head rfi-card-head">
              <span className="rfi-eyebrow">
                Secure invitation
              </span>

              <h2>
                Create your team account
              </h2>

              <p>
                Your invited email and workspace role are controlled by the
                invitation. You only need to set your name and password.
              </p>
            </header>

            {!token ? (
              <div className="rfi-alert" role="alert">
                <span>
                  <X size={13} />
                </span>

                <div>
                  <strong>
                    Invitation link is incomplete
                  </strong>

                  <p>
                    Ask your workspace owner or manager to send you a fresh
                    ReachFly invitation.
                  </p>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rfi-alert" role="alert">
                <span>
                  <X size={13} />
                </span>

                <div>
                  <strong>
                    Invitation needs attention
                  </strong>

                  <p>
                    {error}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Dismiss invitation error"
                >
                  <X size={10} />
                </button>
              </div>
            ) : null}

            <div className="rfi-invite-visual">
              <div className="rfi-workspace-stack">
                <span>
                  <Building2 size={18} />
                </span>

                <i>
                  <Users size={15} />
                </i>

                <em>
                  <UserRound size={14} />
                </em>
              </div>

              <div>
                <strong>
                  Role-based team access
                </strong>

                <p>
                  The inviter chooses whether your workspace role is Manager,
                  Caller, or Viewer. ReachFly applies that role when the secure
                  invite is accepted.
                </p>
              </div>
            </div>

            <InviteField
              label="Your name"
              icon={UserRound}
            >
              <input
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={(event) =>
                  set("name", event.target.value)
                }
                placeholder="Your full name"
                disabled={loading || !token}
                required
                autoFocus
              />
            </InviteField>

            <InviteField
              label="Create password"
              icon={Lock}
              trailing={
                <button
                  type="button"
                  className="rfi-password-toggle"
                  disabled={loading || !token}
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              }
            >
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  set("password", event.target.value)
                }
                placeholder="Minimum 8 characters"
                disabled={loading || !token}
                minLength={8}
                required
              />
            </InviteField>

            <PasswordStrength
              value={form.password}
              strength={strength}
            />

            <InviteField
              label="Confirm password"
              icon={KeyRound}
              trailing={
                form.confirmPassword &&
                form.password === form.confirmPassword ? (
                  <span className="rfi-match">
                    <CheckCircle2 size={13} />
                  </span>
                ) : null
              }
            >
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) =>
                  set("confirmPassword", event.target.value)
                }
                placeholder="Repeat your password"
                disabled={loading || !token}
                minLength={8}
                required
              />
            </InviteField>

            <label className="rfi-remember">
              <input
                type="checkbox"
                checked={form.rememberMe}
                disabled={loading || !token}
                onChange={(event) =>
                  set("rememberMe", event.target.checked)
                }
              />

              <span>
                <Check size={10} />
              </span>

              <div>
                <strong>
                  Keep me signed in
                </strong>

                <small>
                  Use this only on a device you trust.
                </small>
              </div>
            </label>

            <div className="rfi-security-note">
              <Shield size={13} />

              <p>
                This invitation can only create the role assigned by the
                workspace. It cannot grant itself owner or administrator access.
              </p>
            </div>

            <button
              className="rf-auth-submit rfi-submit"
              type="submit"
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <>
                  <span className="rfi-spinner" />
                  Joining workspace…
                </>
              ) : (
                <>
                  Accept invitation
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </section>
      </AuthLayout>
    </>
  );
}

function InviteField({
  label,
  icon: Icon,
  children,
  trailing,
}) {
  return (
    <label className="rfi-field">
      <span>
        {label}
      </span>

      <div>
        <Icon size={15} />
        {children}
        {trailing}
      </div>
    </label>
  );
}

function PasswordStrength({
  value,
  strength,
}) {
  const labels = ["", "Basic", "Fair", "Good", "Strong"];

  return (
    <div className="rfi-strength">
      <div>
        {[1, 2, 3, 4].map((level) => (
          <i
            key={level}
            className={level <= strength ? "active" : ""}
          />
        ))}
      </div>

      <span>
        {value ? labels[strength] : "Password strength"}
      </span>
    </div>
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

function formatRole(value) {
  const role = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (role.includes("manager")) return "Manager";
  if (role.includes("caller")) return "Caller";
  if (role.includes("viewer")) return "Viewer";
  if (role.includes("admin")) return "Administrator";
  if (role.includes("owner")) return "Owner";

  return role
    ? role.replace(/\b\w/g, (character) => character.toUpperCase())
    : "Team member";
}

function safeAuthMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/Supabase/gi, "authentication service");
}

function AcceptInviteStyles() {
  return (
    <style>{`
      .rf-invite-v7{
        --rfi-text:#191c1d;
        --rfi-text2:#464554;
        --rfi-muted:#767586;
        --rfi-line:#e2e4e7;
        --rfi-soft:#f3f4f5;
        --rfi-primary:#4648d4;
        --rfi-psoft:#e8e9ff;
        --rfi-green:#087a51;
        --rfi-gsoft:#dff8eb;
        --rfi-red:#ba1a1a;
        --rfi-rsoft:#ffedeb;
        --rfi-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
      }

      .rf-invite-v7 *,
      .rf-invite-v7 *::before,
      .rf-invite-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfiIn{
        from{opacity:0;transform:translateY(7px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfiSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfiPulse{
        0%,100%{transform:scale(.94);opacity:.35}
        50%{transform:scale(1.05);opacity:.55}
      }

      .rf-invite-v7 > form,
      .rfi-success{
        animation:rfiIn .22s var(--rfi-ease);
      }

      .rfi-mobile-intro{
        display:none;
      }

      .rfi-eyebrow{
        display:block;
        margin-bottom:5px;
        color:var(--rfi-primary);
        font-size:6px;
        font-weight:800;
        letter-spacing:.1em;
        text-transform:uppercase;
      }

      .rfi-card-head{
        margin-bottom:14px!important;
      }

      .rfi-card-head h2,
      .rfi-success h2{
        margin:0;
        color:var(--rfi-text);
        font:600 25px/31px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rfi-card-head p{
        margin:5px 0 0;
        color:var(--rfi-text2);
        font-size:8px;
        line-height:13px;
      }

      .rfi-alert{
        display:grid;
        grid-template-columns:25px minmax(0,1fr) auto;
        align-items:start;
        gap:7px;
        padding:9px 10px;
        margin-bottom:12px;
        color:#7f1b1b;
        background:var(--rfi-rsoft);
        border:1px solid #ffd0cc;
        border-radius:8px;
      }

      .rfi-alert > span{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:7px;
      }

      .rfi-alert strong{
        display:block;
        font-size:7px;
      }

      .rfi-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rfi-alert > button{
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

      .rfi-invite-visual{
        min-height:97px;
        display:grid;
        grid-template-columns:75px minmax(0,1fr);
        align-items:center;
        gap:12px;
        padding:11px;
        margin-bottom:13px;
        background:
          radial-gradient(circle at 10% 50%,rgba(70,72,212,.11),transparent 33%),
          linear-gradient(135deg,#f8f8fc,#f3f4f7);
        border:1px solid #eceef1;
        border-radius:10px;
      }

      .rfi-workspace-stack{
        position:relative;
        width:69px;
        height:65px;
      }

      .rfi-workspace-stack > span,
      .rfi-workspace-stack > i,
      .rfi-workspace-stack > em{
        position:absolute;
        display:grid;
        place-items:center;
        border-radius:9px;
      }

      .rfi-workspace-stack > span{
        left:0;
        top:8px;
        width:39px;
        height:39px;
        color:#fff;
        background:var(--rfi-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.16);
      }

      .rfi-workspace-stack > i{
        right:3px;
        top:0;
        width:32px;
        height:32px;
        color:#6b38d4;
        background:#f0eaff;
        border:1px solid #e4d8fa;
        font-style:normal;
      }

      .rfi-workspace-stack > em{
        right:8px;
        bottom:0;
        width:29px;
        height:29px;
        color:#087a51;
        background:#dff8eb;
        border:1px solid #c7ecd9;
        font-style:normal;
      }

      .rfi-invite-visual > div:last-child strong{
        display:block;
        font-size:8px;
      }

      .rfi-invite-visual > div:last-child p{
        margin:3px 0 0;
        color:var(--rfi-muted);
        font-size:6.7px;
        line-height:11px;
      }

      .rfi-field{
        display:grid;
        gap:5px;
        margin-bottom:10px;
      }

      .rfi-field > span{
        font-size:7px;
        font-weight:700;
      }

      .rfi-field > div{
        min-height:44px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 9px;
        color:#8b8c95;
        background:#fff;
        border:1px solid var(--rfi-line);
        border-radius:8px;
      }

      .rfi-field > div:focus-within{
        border-color:rgba(70,72,212,.55);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rfi-field input{
        min-width:0;
        width:100%;
        height:42px;
        padding:0;
        color:var(--rfi-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:9px;
      }

      .rfi-password-toggle{
        min-width:38px;
        height:27px;
        padding:0 7px;
        color:var(--rfi-primary);
        background:var(--rfi-psoft);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
      }

      .rfi-match{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        color:var(--rfi-green);
        background:var(--rfi-gsoft);
        border-radius:7px;
      }

      .rfi-strength{
        display:flex;
        align-items:center;
        gap:8px;
        margin:-4px 0 10px;
      }

      .rfi-strength > div{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:4px;
        flex:1;
      }

      .rfi-strength i{
        height:4px;
        background:#e6e7e9;
        border-radius:999px;
      }

      .rfi-strength i.active{
        background:var(--rfi-primary);
      }

      .rfi-strength span{
        min-width:85px;
        color:var(--rfi-muted);
        text-align:right;
        font-size:6px;
      }

      .rfi-remember{
        display:grid;
        grid-template-columns:17px minmax(0,1fr);
        align-items:center;
        gap:7px;
        padding:8px 0;
        cursor:pointer;
      }

      .rfi-remember > input{
        position:absolute;
        opacity:0;
        pointer-events:none;
      }

      .rfi-remember > span{
        width:17px;
        height:17px;
        display:grid;
        place-items:center;
        color:transparent;
        background:#fff;
        border:1px solid #cfd2d6;
        border-radius:5px;
      }

      .rfi-remember > input:checked + span{
        color:#fff;
        background:var(--rfi-primary);
        border-color:var(--rfi-primary);
      }

      .rfi-remember > div{
        display:grid;
      }

      .rfi-remember strong{
        font-size:7px;
      }

      .rfi-remember small{
        color:var(--rfi-muted);
        font-size:6px;
      }

      .rfi-security-note{
        display:flex;
        gap:7px;
        padding:9px 10px;
        margin-bottom:12px;
        color:var(--rfi-primary);
        background:var(--rfi-psoft);
        border-radius:8px;
      }

      .rfi-security-note p{
        margin:0;
        color:var(--rfi-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rfi-submit{
        min-height:45px!important;
      }

      .rfi-spinner{
        width:12px;
        height:12px;
        border:2px solid currentColor;
        border-right-color:transparent;
        border-radius:50%;
        animation:rfiSpin .7s linear infinite;
      }

      .rfi-success{
        display:grid;
        justify-items:center;
        text-align:center;
      }

      .rfi-success-icon{
        position:relative;
        width:80px;
        height:80px;
        display:grid;
        place-items:center;
        margin-bottom:12px;
      }

      .rfi-success-icon > span{
        position:relative;
        z-index:2;
        width:54px;
        height:54px;
        display:grid;
        place-items:center;
        color:var(--rfi-green);
        background:var(--rfi-gsoft);
        border-radius:15px;
      }

      .rfi-success-icon > i{
        position:absolute;
        inset:5px;
        background:rgba(8,122,81,.06);
        border-radius:50%;
        animation:rfiPulse 2s ease-in-out infinite;
      }

      .rfi-success > p{
        max-width:390px;
        margin:6px 0 13px;
        color:var(--rfi-text2);
        font-size:8px;
        line-height:13px;
      }

      .rfi-success-summary{
        width:100%;
        display:grid;
        grid-template-columns:34px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:10px;
        margin-bottom:13px;
        background:#f7f8f9;
        border-radius:8px;
        text-align:left;
      }

      .rfi-success-summary > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfi-primary);
        background:#fff;
        border-radius:8px;
      }

      .rfi-success-summary > div{
        display:grid;
      }

      .rfi-success-summary small{
        color:var(--rfi-muted);
        font-size:6px;
      }

      .rfi-success-summary strong{
        font-size:8px;
      }

      .rfi-success-summary em{
        padding:4px 7px;
        color:var(--rfi-green);
        background:var(--rfi-gsoft);
        border-radius:999px;
        font-size:6px;
        font-style:normal;
        font-weight:750;
      }

      @media(max-width:620px){
        .rfi-mobile-intro{
          display:block;
          margin-bottom:20px;
        }

        .rfi-mobile-intro > span{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:var(--rfi-primary);
          font-size:6px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
        }

        .rfi-mobile-intro h1{
          margin:7px 0 0;
          font:600 27px/33px Geist,Inter,sans-serif;
          letter-spacing:-.03em;
        }

        .rfi-mobile-intro p{
          margin:4px 0 0;
          color:var(--rfi-text2);
          font-size:8px;
        }

        .rfi-card-head h2,
        .rfi-success h2{
          font-size:21px;
          line-height:27px;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-invite-v7 > form,
        .rfi-success,
        .rfi-spinner,
        .rfi-success-icon > i{
          animation:none!important;
        }

        .rf-invite-v7 *,
        .rf-invite-v7 *::before,
        .rf-invite-v7 *::after{
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
