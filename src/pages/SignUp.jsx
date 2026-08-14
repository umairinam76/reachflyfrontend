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
  const { signup } = useAuth();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isCompany = form.accountType === "company";

  const workspaceLabel = useMemo(
    () => (isCompany ? "Company workspace" : "Individual workspace"),
    [isCompany]
  );

  const set = (key, value) => {
    if (loading) return;

    setError("");
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const nextStep = () => {
    if (!form.accountType) {
      setError("Please choose how you want to use ReachFly.Ai.");
      return;
    }

    setError("");
    setStep(2);
  };

  const submit = async (event) => {
    event.preventDefault();

    if (loading) return;

    const name = form.name.trim();
    const companyName = form.companyName.trim();
    const role = form.role.trim();
    const email = form.email.trim().toLowerCase();

    if (!form.accountType) {
      setStep(1);
      setError("Please choose your workspace type.");
      return;
    }

    if (!name) {
      setError("Please enter your name.");
      return;
    }

    if (isCompany && !companyName) {
      setError("Company name is required for company accounts.");
      return;
    }

    if (!role) {
      setError(
        isCompany
          ? "Please enter your role at the company."
          : "Please tell us what you do."
      );
      return;
    }

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      /*
       * Keep the public signup payload compatible with the existing
       * ReachFly backend contract. Do not add onboarding-only fields here.
       */
      await signup({
        name,
        email,
        password: form.password,
        accountType: form.accountType,
        role,
        companyName: isCompany ? companyName : "",
      });

      /*
       * New workspace owners should enter the product through the
       * Voice Agent onboarding journey instead of being dropped on a
       * generic dashboard with no clear next action.
       */
      navigate("/app/voice-agent?onboarding=1", {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "We could not create your ReachFly workspace. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Create your ReachFly.Ai sales workspace."
      text="Set up the workspace once, then continue directly into AI Voice Agent onboarding to configure your calling workflow."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {step === 1 ? (
        <section className="rf-auth-form">
          <AuthStepBar step={1} />

          <div className="rf-auth-card-head">
            <h2>How will you use ReachFly?</h2>
            <p>
              Choose the workspace that matches how you sell. Your new workspace
              will continue into Voice Agent setup after account creation.
            </p>
          </div>

          {error ? (
            <p className="rf-auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="rf-auth-type-grid">
            <button
              type="button"
              className={`rf-auth-type-card ${
                form.accountType === "individual" ? "active" : ""
              }`}
              onClick={() => set("accountType", "individual")}
              aria-pressed={form.accountType === "individual"}
            >
              <span className="rf-auth-type-icon">
                <UserRound size={28} />
              </span>

              <div>
                <b>I’m an individual</b>
                <small>
                  Freelancer, consultant, founder, or specialist using ReachFly
                  for your own sales pipeline.
                </small>
              </div>

              {form.accountType === "individual" ? (
                <i aria-hidden="true">
                  <Check size={15} />
                </i>
              ) : null}
            </button>

            <button
              type="button"
              className={`rf-auth-type-card ${
                form.accountType === "company" ? "active" : ""
              }`}
              onClick={() => set("accountType", "company")}
              aria-pressed={form.accountType === "company"}
            >
              <span className="rf-auth-type-icon">
                <Building2 size={28} />
              </span>

              <div>
                <b>We’re a company</b>
                <small>
                  Agency, sales team, service business, or company operating a
                  shared ReachFly workspace.
                </small>
              </div>

              {form.accountType === "company" ? (
                <i aria-hidden="true">
                  <Check size={15} />
                </i>
              ) : null}
            </button>
          </div>

          <div className="rf-auth-selected-note">
            <span>
              <Zap size={16} />
            </span>

            <div>
              <b>What happens next?</b>
              <small>
                After signup, ReachFly opens Voice Agent onboarding so you can
                configure the agent, calling setup, lead context, and launch
                workflow.
              </small>
            </div>
          </div>

          <button
            className="rf-auth-submit"
            type="button"
            onClick={nextStep}
            disabled={!form.accountType}
          >
            Continue <ArrowRight size={17} />
          </button>
        </section>
      ) : (
        <form className="rf-auth-form" onSubmit={submit} noValidate>
          <AuthStepBar step={2} />

          <div className="rf-auth-card-head">
            <h2>Create your account</h2>
            <p>
              {isCompany
                ? "Add the workspace owner and company details."
                : "Add your profile and login details."}
            </p>
          </div>

          <div className="rf-auth-selected-note">
            <span>
              {isCompany ? (
                <Building2 size={16} />
              ) : (
                <UserRound size={16} />
              )}
            </span>

            <div>
              <b>{workspaceLabel}</b>

              <small>
                {isCompany
                  ? "Built for owners, sales managers, agencies, and service teams."
                  : "Built for founders, consultants, freelancers, and specialists."}
              </small>
            </div>
          </div>

          {error ? (
            <p className="rf-auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="rf-auth-grid">
            <AuthField
              label="Your name"
              name="name"
              autoComplete="name"
              icon={UserRound}
              value={form.name}
              onChange={(value) => set("name", value)}
              placeholder="Your full name"
              required
              disabled={loading}
            />

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
                disabled={loading}
              />
            ) : null}

            <AuthField
              label={isCompany ? "Your role" : "What do you do?"}
              name="role"
              autoComplete="organization-title"
              icon={UserRound}
              value={form.role}
              onChange={(value) => set("role", value)}
              placeholder={
                isCompany
                  ? "e.g. Founder, Head of Sales"
                  : "e.g. Growth consultant, founder"
              }
              required
              disabled={loading}
            />

            <AuthField
              label="Email address"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              icon={Mail}
              value={form.email}
              onChange={(value) => set("email", value)}
              placeholder="you@company.com"
              required
              disabled={loading}
            />

            <AuthField
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              icon={Lock}
              value={form.password}
              onChange={(value) => set("password", value)}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
              disabled={loading}
            />
          </div>

          <div className="rf-auth-selected-note">
            <span>
              <Lock size={16} />
            </span>

            <div>
              <b>Your workspace stays scoped to your account</b>
              <small>
                Team roles, billing, leads, calls, tasks, and Voice Agent data
                are handled inside the authenticated ReachFly workspace.
              </small>
            </div>
          </div>

          <div className="rf-auth-form-actions">
            <button
              className="rf-auth-back-btn"
              type="button"
              disabled={loading}
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <button className="rf-auth-submit" type="submit" disabled={loading}>
              {loading ? (
                "Creating workspace…"
              ) : (
                <>
                  Create workspace <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

function AuthStepBar({ step }) {
  return (
    <div className="rf-auth-stepbar" aria-label={`Signup step ${step} of 2`}>
      <span className={step >= 1 ? "active" : ""}>
        <b>1</b>
        Workspace type
      </span>

      <i aria-hidden="true" />

      <span className={step >= 2 ? "active" : ""}>
        <b>2</b>
        Account details
      </span>
    </div>
  );
}

function AuthField({
  label,
  name,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  required,
  minLength,
  disabled,
}) {
  return (
    <label className="rf-auth-field">
      <span>{label}</span>

      <div>
        <Icon size={17} />

        <input
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          disabled={disabled}
        />
      </div>
    </label>
  );
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}