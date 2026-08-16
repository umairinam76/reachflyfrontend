import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Lock,
  Mail,
  UserRound,
  Zap,
} from "../components/icons";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAuth } from "../auth/AuthContext";
import AuthLayout from "./AuthLayout";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  accountType: "",
  role: "",
  companyName: "",
};

export default function Signup() {
  const navigate = useNavigate();
  const { signup, googleAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const isCompany = form.accountType === "company";
  const workspaceLabel = useMemo(
    () => (isCompany ? "Company workspace" : "Individual workspace"),
    [isCompany]
  );

  const set = (key, value) => {
    if (loading || googleLoading) return;
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const nextStep = () => {
    if (!form.accountType) {
      setError("Please choose how you want to use ReachFly.Ai.");
      return;
    }
    setError("");
    setStep(2);
  };

  async function finishSignup(action) {
    try {
      await action();
      navigate("/app/voice-agent?onboarding=1", { replace: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "We could not create your ReachFly workspace. Please try again."
      );
      throw requestError;
    }
  }

  const submit = async (event) => {
    event.preventDefault();
    if (loading || googleLoading) return;

    const name = form.name.trim();
    const companyName = form.companyName.trim();
    const role = form.role.trim();
    const email = form.email.trim().toLowerCase();

    if (!form.accountType) {
      setStep(1);
      setError("Please choose your workspace type.");
      return;
    }
    if (!name) return setError("Please enter your name.");
    if (isCompany && !companyName) return setError("Company name is required for company accounts.");
    if (!role) return setError(isCompany ? "Please enter your role at the company." : "Please tell us what you do.");
    if (!isValidEmail(email)) return setError("Please enter a valid email address.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");

    try {
      setLoading(true);
      setError("");
      await finishSignup(() =>
        signup({
          name,
          email,
          password: form.password,
          accountType: form.accountType,
          role,
          companyName: isCompany ? companyName : "",
        })
      );
    } catch {
      // finishSignup already surfaced the message.
    } finally {
      setLoading(false);
    }
  };

  async function handleGoogleCredential(credential) {
    if (loading || googleLoading) return;
    const companyName = form.companyName.trim();
    if (isCompany && !companyName) {
      setError("Enter your company name before continuing with Google.");
      return;
    }

    try {
      setGoogleLoading(true);
      setError("");
      await finishSignup(() =>
        googleAuth({
          credential,
          mode: "signup",
          accountType: form.accountType,
          companyName: isCompany ? companyName : "",
          role: form.role.trim() || (isCompany ? "Owner" : "Founder"),
        })
      );
    } catch {
      // finishSignup already surfaced the message.
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Create your ReachFly.Ai sales workspace."
      text="Create the workspace once, connect your channels, then launch AI agents and campaigns from one guided flow."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      {step === 1 ? (
        <section className="rf-auth-form">
          <AuthStepBar step={1} />
          <div className="rf-auth-card-head">
            <h2>How will you use ReachFly?</h2>
            <p>Choose the workspace type first. ReachFly will tailor onboarding around how you sell.</p>
          </div>

          {error ? <p className="rf-auth-error" role="alert">{error}</p> : null}

          <div className="rf-auth-type-grid">
            <WorkspaceTypeCard
              active={form.accountType === "individual"}
              icon={UserRound}
              title="I’m an individual"
              text="Founder, freelancer, consultant, or specialist operating your own pipeline."
              onClick={() => set("accountType", "individual")}
            />
            <WorkspaceTypeCard
              active={form.accountType === "company"}
              icon={Building2}
              title="We’re a company"
              text="Agency, service business, sales team, or company sharing one ReachFly workspace."
              onClick={() => set("accountType", "company")}
            />
          </div>

          <div className="rf-auth-selected-note">
            <span><Zap size={16} /></span>
            <div>
              <b>What happens next?</b>
              <small>Create your account, connect a phone number and channels, configure your first AI agent, make a test call, then launch a campaign.</small>
            </div>
          </div>

          <button className="rf-auth-submit" type="button" onClick={nextStep}>
            Continue <ArrowRight size={17} />
          </button>
        </section>
      ) : (
        <section className="rf-auth-form">
          <AuthStepBar step={2} />
          <div className="rf-auth-card-head">
            <h2>Create your account</h2>
            <p>{isCompany ? "Add your company name, then use Google or email to create the owner account." : "Use Google for the fastest setup, or create an email/password login."}</p>
          </div>

          <div className="rf-auth-selected-note">
            <span>{isCompany ? <Building2 size={16} /> : <UserRound size={16} />}</span>
            <div>
              <b>{workspaceLabel}</b>
              <small>{isCompany ? "Shared workspace for your AI workforce, channels, leads, campaigns and billing." : "Personal sales workspace with the same AI-agent and campaign capabilities."}</small>
            </div>
          </div>

          {error ? <p className="rf-auth-error" role="alert">{error}</p> : null}

          {isCompany ? (
            <AuthField
              label="Company name"
              name="organization"
              autoComplete="organization"
              icon={Building2}
              value={form.companyName}
              onChange={(value) => set("companyName", value)}
              placeholder="e.g. Northstar Digital"
              required
              disabled={loading || googleLoading}
            />
          ) : null}

          <GoogleAuthButton
            mode="signup"
            disabled={loading || googleLoading}
            onCredential={handleGoogleCredential}
            onError={(requestError) => setError(requestError?.message || "Google signup could not be loaded.")}
          />

          <div className="rf-auth-divider"><span>or create with email</span></div>

          <form onSubmit={submit} noValidate>
            <div className="rf-auth-grid">
              <AuthField label="Your name" name="name" autoComplete="name" icon={UserRound} value={form.name} onChange={(value) => set("name", value)} placeholder="Your full name" required disabled={loading || googleLoading} />
              {!isCompany ? null : <div className="rf-auth-google-company-spacer" aria-hidden="true" />}
              <AuthField label={isCompany ? "Your role" : "What do you do?"} name="role" autoComplete="organization-title" icon={UserRound} value={form.role} onChange={(value) => set("role", value)} placeholder={isCompany ? "e.g. Founder, Head of Sales" : "e.g. Growth consultant, founder"} required disabled={loading || googleLoading} />
              <AuthField label="Email address" name="email" type="email" inputMode="email" autoComplete="email" icon={Mail} value={form.email} onChange={(value) => set("email", value)} placeholder="you@company.com" required disabled={loading || googleLoading} />
              <AuthField label="Password" name="password" type="password" autoComplete="new-password" icon={Lock} value={form.password} onChange={(value) => set("password", value)} placeholder="Minimum 8 characters" minLength={8} required disabled={loading || googleLoading} />
            </div>

            <div className="rf-auth-selected-note">
              <span><Lock size={16} /></span>
              <div>
                <b>10 AI call credits are added to a new workspace</b>
                <small>AI call credits stay separate from general ReachFly credits. You can buy standalone packs or number + credit bundles during onboarding.</small>
              </div>
            </div>

            <div className="rf-auth-form-actions">
              <button className="rf-auth-back-btn" type="button" disabled={loading || googleLoading} onClick={() => { setError(""); setStep(1); }}>
                <ArrowLeft size={16} /> Back
              </button>
              <button className="rf-auth-submit" type="submit" disabled={loading || googleLoading}>
                {loading ? "Creating workspace…" : <>Create workspace <ArrowRight size={17} /></>}
              </button>
            </div>
          </form>
        </section>
      )}
    </AuthLayout>
  );
}

function WorkspaceTypeCard({ active, icon: Icon, title, text, onClick }) {
  return (
    <button type="button" className={`rf-auth-type-card ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active}>
      <span className="rf-auth-type-icon"><Icon size={28} /></span>
      <div><b>{title}</b><small>{text}</small></div>
      {active ? <i aria-hidden="true"><Check size={15} /></i> : null}
    </button>
  );
}

function AuthStepBar({ step }) {
  return (
    <div className="rf-auth-stepbar" aria-label={`Signup step ${step} of 2`}>
      <span className={step >= 1 ? "active" : ""}><b>1</b>Workspace type</span>
      <i aria-hidden="true" />
      <span className={step >= 2 ? "active" : ""}><b>2</b>Account details</span>
    </div>
  );
}

function AuthField({ label, name, icon: Icon, value, onChange, placeholder, type = "text", inputMode, autoComplete, required, minLength, disabled }) {
  return (
    <label className="rf-auth-field">
      <span>{label}</span>
      <div>
        <Icon size={17} />
        <input name={name} type={type} inputMode={inputMode} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={minLength} disabled={disabled} />
      </div>
    </label>
  );
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}
