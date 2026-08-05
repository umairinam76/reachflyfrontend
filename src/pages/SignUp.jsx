import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Lock,
  Mail,
  UserRound,
} from "../components/icons";
import { useAuth } from "../auth/AuthContext";
import AuthLayout from "./AuthLayout";

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    accountType: "",
    role: "",
    companyName: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key, value) => {
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

  const submit = async (event) => {
    event.preventDefault();

    if (!form.accountType) {
      setStep(1);
      setError("Please choose your workspace type.");
      return;
    }

    if (!form.name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (form.accountType === "company" && !form.companyName.trim()) {
      setError("Company name is required for company accounts.");
      return;
    }

    if (!form.role.trim()) {
      setError("Please enter your role.");
      return;
    }

    if (!form.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await signup(form);

      navigate("/app/dashboard", { replace: true });
    } catch (e) {
      setError(e.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Set up your ReachFly.Ai workspace."
      text="Tell us who is using the platform once. Campaign Builder will stay focused only on niche, market, leads, and outreach."
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
            <p>Choose your workspace type first. You can update details later from settings.</p>
          </div>

          {error ? <p className="rf-auth-error">{error}</p> : null}

          <div className="rf-auth-type-grid">
            <button
              type="button"
              className={`rf-auth-type-card ${
                form.accountType === "individual" ? "active" : ""
              }`}
              onClick={() => set("accountType", "individual")}
            >
              <span className="rf-auth-type-icon">
                <UserRound size={28} />
              </span>

              <div>
                <b>I’m an individual</b>
                <small>Freelancer, consultant, founder, or specialist using ReachFly personally.</small>
              </div>

              {form.accountType === "individual" ? (
                <i>
                  <Check size={15} />
                </i>
              ) : null}
            </button>

            <button
              type="button"
              className={`rf-auth-type-card ${form.accountType === "company" ? "active" : ""}`}
              onClick={() => set("accountType", "company")}
            >
              <span className="rf-auth-type-icon">
                <Building2 size={28} />
              </span>

              <div>
                <b>We’re a company</b>
                <small>Agency, sales team, service business, or company workspace.</small>
              </div>

              {form.accountType === "company" ? (
                <i>
                  <Check size={15} />
                </i>
              ) : null}
            </button>
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
        <form className="rf-auth-form" onSubmit={submit}>
          <AuthStepBar step={2} />

          <div className="rf-auth-card-head">
            <h2>Create your account</h2>
            <p>
              {form.accountType === "company"
                ? "Add your company and login details."
                : "Add your profile and login details."}
            </p>
          </div>

          <div className="rf-auth-selected-note">
            <span>
              {form.accountType === "company" ? <Building2 size={16} /> : <UserRound size={16} />}
            </span>

            <div>
              <b>{form.accountType === "company" ? "Company workspace" : "Individual workspace"}</b>
              <small>
                {form.accountType === "company"
                  ? "Built for agencies, teams, and service businesses."
                  : "Built for freelancers, consultants, founders, and specialists."}
              </small>
            </div>
          </div>

          {error ? <p className="rf-auth-error">{error}</p> : null}

          <div className="rf-auth-grid">
            <AuthField
              label="Your name"
              icon={UserRound}
              value={form.name}
              onChange={(value) => set("name", value)}
              placeholder="Your full name"
              required
            />

            {form.accountType === "company" ? (
              <AuthField
                label="Company name"
                icon={Building2}
                value={form.companyName}
                onChange={(value) => set("companyName", value)}
                placeholder="e.g. Northstar Digital"
                required
              />
            ) : null}

            <AuthField
              label={form.accountType === "company" ? "Your role" : "What do you do?"}
              icon={UserRound}
              value={form.role}
              onChange={(value) => set("role", value)}
              placeholder="e.g. Web developer, growth consultant"
              required
            />

            <AuthField
              label="Email address"
              type="email"
              icon={Mail}
              value={form.email}
              onChange={(value) => set("email", value)}
              placeholder="you@company.com"
              required
            />

            <AuthField
              label="Password"
              type="password"
              icon={Lock}
              value={form.password}
              onChange={(value) => set("password", value)}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
            />
          </div>

          <div className="rf-auth-form-actions">
            <button
              className="rf-auth-back-btn"
              type="button"
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <button className="rf-auth-submit" type="submit" disabled={loading}>
              {loading ? (
                "Creating account…"
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
    <div className="rf-auth-stepbar">
      <span className={step >= 1 ? "active" : ""}>
        <b>1</b>
        Workspace type
      </span>

      <i />

      <span className={step >= 2 ? "active" : ""}>
        <b>2</b>
        Account details
      </span>
    </div>
  );
}

function AuthField({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  minLength,
}) {
  return (
    <label className="rf-auth-field">
      <span>{label}</span>

      <div>
        <Icon size={17} />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
        />
      </div>
    </label>
  );
}