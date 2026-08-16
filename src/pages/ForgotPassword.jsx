import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "../components/icons";
import { api } from "../api";
import AuthLayout from "./AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await api.forgotPassword({ email: value });
      setMessage(response?.message || "If an account exists, password reset instructions have been sent.");
    } catch (requestError) {
      setError(requestError?.message || "Password recovery could not be started.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your ReachFly.Ai password."
      text="Enter your account email. ReachFly will send a secure, time-limited reset link."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      <form className="rf-auth-form" onSubmit={submit} noValidate>
        <div className="rf-auth-card-head">
          <h2>Forgot password?</h2>
          <p>No account details are exposed by this form.</p>
        </div>
        {error ? <p className="rf-auth-error" role="alert">{error}</p> : null}
        {message ? <p className="rf-auth-success" role="status">{message}</p> : null}
        <label className="rf-auth-input">
          <span>Email address</span>
          <div>
            <Mail size={17} />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              disabled={loading || Boolean(message)}
            />
          </div>
        </label>
        {!message ? (
          <button className="rf-auth-submit" type="submit" disabled={loading}>
            {loading ? "Sending reset link…" : "Send reset link"}
          </button>
        ) : (
          <Link className="rf-auth-submit rf-auth-submit-link" to="/login">Return to sign in</Link>
        )}
      </form>
    </AuthLayout>
  );
}
