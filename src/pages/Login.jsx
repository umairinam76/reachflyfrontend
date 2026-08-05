import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail } from "../components/icons";
import { useAuth } from "../auth/AuthContext";
import AuthLayout from "./AuthLayout";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      await login(form);

      navigate(location.state?.from || "/app/dashboard", {
        replace: true,
      });
    } catch (e) {
      setError(e.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to your growth workspace."
      text="Access your campaigns, leads, outreach pipelines, channels, territories, inbox, and analytics."
      footer={
        <>
          New to ReachFly.Ai?{" "}
          <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form className="rf-auth-form" onSubmit={submit}>
        <div className="rf-auth-card-head">
          <h2>Sign in</h2>
          <p>Continue to your ReachFly workspace.</p>
        </div>

        {error ? <p className="rf-auth-error">{error}</p> : null}

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
          type={showPassword ? "text" : "password"}
          icon={Lock}
          value={form.password}
          onChange={(value) => set("password", value)}
          placeholder="Your password"
          required
          showToggle
          showPassword={showPassword}
          onTogglePassword={() =>
            setShowPassword((current) => !current)
          }
        />

        <div className="rf-auth-row">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button
          className="rf-auth-submit"
          type="submit"
          disabled={loading}
        >
          {loading ? (
            "Signing in…"
          ) : (
            <>
              Sign in <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
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
  showToggle = false,
  showPassword = false,
  onTogglePassword,
}) {
  return (
    <label className="rf-auth-field">
      <span>{label}</span>

      <div className="rf-auth-input">
        <Icon size={17} />

        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
        />

        {showToggle && (
          <button
            type="button"
            className="rf-password-toggle"
            onClick={onTogglePassword}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </label>
  );
}