import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail } from "../components/icons";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAuth } from "../auth/AuthContext";
import AuthLayout from "./AuthLayout";

export default function Login() {
  const navigate = useNavigate();
  const { login, googleAuth } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", rememberMe: true });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key, value) => {
    if (loading || googleLoading) return;
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function submit(event) {
    event.preventDefault();
    if (loading || googleLoading) return;
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) {
      setError("Enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await login({ email, password: form.password }, { rememberMe: form.rememberMe });
      navigate("/app", { replace: true });
    } catch (requestError) {
      setError(requestError?.message || "We could not sign you in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCredential(credential) {
    if (loading || googleLoading) return;
    try {
      setGoogleLoading(true);
      setError("");
      await googleAuth(
        { credential, mode: "login" },
        { rememberMe: form.rememberMe }
      );
      navigate("/app", { replace: true });
    } catch (requestError) {
      if (requestError?.code === "GOOGLE_SIGNUP_REQUIRED") {
        setError("This Google account does not have a ReachFly workspace yet. Create an account first.");
      } else {
        setError(requestError?.message || "Google sign-in could not be completed.");
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to your ReachFly workspace."
      text="Continue your AI sales operations, campaigns, calls, email follow-ups and meetings from one workspace."
      footer={<>New to ReachFly? <Link to="/signup">Create account</Link></>}
    >
      <section className="rf-auth-form rf-auth-form-v6">
        <div className="rf-auth-card-head">
          <h2>Welcome back</h2>
          <p>Use Google for the fastest sign-in, or continue with your ReachFly password.</p>
        </div>

        {error ? <p className="rf-auth-error" role="alert">{error}</p> : null}

        <GoogleAuthButton
          mode="signin"
          disabled={loading || googleLoading}
          onCredential={handleGoogleCredential}
          onError={(requestError) => setError(requestError?.message || "Google sign-in could not be loaded.")}
        />

        <div className="rf-auth-divider"><span>or continue with email</span></div>

        <form onSubmit={submit} className="rf-auth-email-form">
          <label className="rf-auth-input">
            <span>Email address</span>
            <div><Mail size={17} /><input type="email" autoComplete="email" value={form.email} onChange={(event) => set("email", event.target.value)} placeholder="you@company.com" /></div>
          </label>

          <label className="rf-auth-input">
            <span>Password</span>
            <div><Lock size={17} /><input type="password" autoComplete="current-password" value={form.password} onChange={(event) => set("password", event.target.value)} placeholder="Your password" /></div>
          </label>

          <div className="rf-auth-login-options">
            <label><input type="checkbox" checked={form.rememberMe} onChange={(event) => set("rememberMe", event.target.checked)} /> Keep me signed in</label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button className="rf-auth-submit" type="submit" disabled={loading || googleLoading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </AuthLayout>
  );
}
