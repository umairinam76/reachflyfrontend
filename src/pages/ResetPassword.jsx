import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock } from "../components/icons";
import { api } from "../api";
import AuthLayout from "./AuthLayout";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!token) {
      setError("This reset link is incomplete. Request a new password reset email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await api.resetPassword({ token, password });
      navigate("/login?reset=success", { replace: true });
    } catch (requestError) {
      setError(requestError?.message || "The password could not be reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Secure reset"
      title="Choose a new password."
      text="This secure reset link can be used once and expires after 30 minutes."
      footer={<Link to="/forgot-password">Request a new reset link</Link>}
    >
      <form className="rf-auth-form" onSubmit={submit} noValidate>
        <div className="rf-auth-card-head"><h2>New password</h2></div>
        {error ? <p className="rf-auth-error" role="alert">{error}</p> : null}
        <label className="rf-auth-input">
          <span>New password</span>
          <div><Lock size={17} /><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} /></div>
        </label>
        <label className="rf-auth-input">
          <span>Confirm new password</span>
          <div><Lock size={17} /><input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading} /></div>
        </label>
        <button className="rf-auth-submit" type="submit" disabled={loading || !token}>
          {loading ? "Updating password…" : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
}
