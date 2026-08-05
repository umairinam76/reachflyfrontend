import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Lock, Mail } from "../components/icons";
import AuthLayout from "./AuthLayout";
import { upgradeApi } from "../api/upgradeApi";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [form, setForm] = useState({ name: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!token) return setError("Invitation token is missing.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");

    try {
      setLoading(true);
      setError("");
      const result = await upgradeApi.acceptInvite({ token, name: form.name, password: form.password });
      localStorage.setItem("token", result.token);
      navigate("/app/my-leads", { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Workspace invitation"
      title="Join your ReachFly calling workspace."
      text="Create your password. Your owner or manager will assign the leads and permissions you need."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form className="rf-auth-form" onSubmit={submit}>
        <div className="rf-auth-card-head"><h2>Accept invitation</h2><p>Use your real name so call and email activity is attributed correctly.</p></div>
        {error ? <p className="rf-auth-error">{error}</p> : null}
        <Field label="Full name" icon={Mail} value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Your full name" />
        <Field label="Password" icon={Lock} type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} placeholder="Minimum 8 characters" />
        <Field label="Confirm password" icon={Lock} type="password" value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} placeholder="Repeat password" />
        <button className="rf-auth-submit" type="submit" disabled={loading}>{loading ? "Joining…" : <>Join workspace <ArrowRight size={17} /></>}</button>
      </form>
    </AuthLayout>
  );
}

function Field({ label, icon: Icon, value, onChange, placeholder, type = "text" }) {
  return <label className="rf-auth-field"><span>{label}</span><div><Icon size={17} /><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required /></div></label>;
}
