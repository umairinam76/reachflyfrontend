import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "../components/icons";
import { api } from "../api";
import AuthLayout from "./AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("");
      setResetUrl("");

      const result = await api.forgotPassword({ email });

      setMessage(result.message || "Password reset instructions have been created.");
      if (result.resetUrl) setResetUrl(result.resetUrl);
    } catch (e) {
      setError(e.message || "Could not create reset instructions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Recover access"
      title="Reset your ReachFly.Ai password."
      text="Enter your email address and we will create a secure password reset link for your workspace."
      footer={
        <>
          Remember your password? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="rf-auth-form" onSubmit={submit}>
        <div className="rf-auth-card-head">
          <h2>Forgot password</h2>
          <p>We’ll help you get back into your workspace.</p>
        </div>

        {error ? <p className="rf-auth-error">{error}</p> : null}
        {message ? <p className="rf-auth-success">{message}</p> : null}

        {resetUrl ? (
          <div className="rf-auth-dev-link">
            <b>Development reset link</b>
            <a href={resetUrl}>{resetUrl}</a>
          </div>
        ) : null}

        <AuthField
          label="Email address"
          type="email"
          icon={Mail}
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          required
        />

        <button className="rf-auth-submit" type="submit" disabled={loading}>
          {loading ? (
            "Sending…"
          ) : (
            <>
              Send reset link <ArrowRight size={17} />
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
        />
      </div>
    </label>
  );
}
