import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Lock } from "../components/icons";
import { api } from "../api";
import AuthLayout from "./AuthLayout";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const token = useMemo(() => params.get("token") || "", [params]);

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!token) {
      setError("Reset token is missing.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const result = await api.resetPassword({
        token,
        password: form.password,
      });

      setMessage(result.message || "Password updated successfully.");

      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 900);
    } catch (e) {
      setError(e.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="New password"
      title="Create a new password."
      text="Choose a secure password to regain access to your ReachFly.Ai workspace."
      footer={
        <>
          Back to <Link to="/login">sign in</Link>
        </>
      }
    >
      <form className="rf-auth-form" onSubmit={submit}>
        <div className="rf-auth-card-head">
          <h2>Reset password</h2>
          <p>Use a new password with at least 8 characters.</p>
        </div>

        {error ? <p className="rf-auth-error">{error}</p> : null}
        {message ? <p className="rf-auth-success">{message}</p> : null}

        <AuthField
          label="New password"
          type="password"
          icon={Lock}
          value={form.password}
          onChange={(value) => set("password", value)}
          placeholder="Minimum 8 characters"
          minLength={8}
          required
        />

        <AuthField
          label="Confirm password"
          type="password"
          icon={Lock}
          value={form.confirmPassword}
          onChange={(value) => set("confirmPassword", value)}
          placeholder="Repeat password"
          minLength={8}
          required
        />

        <button className="rf-auth-submit" type="submit" disabled={loading}>
          {loading ? (
            "Updating…"
          ) : (
            <>
              Update password <ArrowRight size={17} />
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
