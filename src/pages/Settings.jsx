import { useEffect, useState } from "react";
import { api } from "../api";
import { Check, Settings as SettingsIcon, Shield, Sparkles } from "../components/icons";

const defaults = {
  workspaceName: "ReachFly.Ai Growth Workspace",
  defaultRadiusKm: 10,
  defaultLeadLimit: 100,
  complianceMode: true,
  allowDemoFallback: true,
  brandTagline: "From territory to client inbox in 5 clicks",
};

export default function Settings() {
  const [form, setForm] = useState(defaults);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.appSettings()
      .then((settings) => setForm({ ...defaults, ...settings }))
      .catch(() => {});
  }, []);

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const saved = await api.saveAppSettings(form);
      setForm({ ...defaults, ...saved });
      setMessage("Workspace settings saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page-v54">
      <div className="page-heading">
        <div>
          <span className="eyebrow">System settings</span>
          <h1>Production workspace controls.</h1>
          <p>Configure workspace defaults, compliance guardrails, and demo behavior.</p>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {message && (
        <p className="success-banner">
          <Check /> {message}
        </p>
      )}

      <section className="settings-layout-v54">
        <div className="cardish">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">Workspace</span>
              <h2>General defaults</h2>
            </div>

            <SettingsIcon />
          </div>

          <div className="form-grid-v54">
            <Field
              label="Workspace name"
              value={form.workspaceName}
              onChange={(v) => set("workspaceName", v)}
            />

            <Field
              label="Brand tagline"
              value={form.brandTagline}
              onChange={(v) => set("brandTagline", v)}
            />

            <Field
              label="Default radius km"
              type="number"
              value={form.defaultRadiusKm}
              onChange={(v) => set("defaultRadiusKm", Number(v || 1))}
            />

            <Field
              label="Default lead limit"
              type="number"
              value={form.defaultLeadLimit}
              onChange={(v) => set("defaultLeadLimit", Number(v || 1))}
            />
          </div>

          <div className="settings-switches-v54">
            <label>
              <input
                type="checkbox"
                checked={form.complianceMode}
                onChange={(e) => set("complianceMode", e.target.checked)}
              />
              Compliance guardrails enabled
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.allowDemoFallback}
                onChange={(e) => set("allowDemoFallback", e.target.checked)}
              />
              Allow demo fallback when public search adapters are blocked
            </label>
          </div>

          <button className="btn primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>

        <aside className="cardish setup-guide-card">
          <Sparkles />

          <h2>Production checklist</h2>

          <ol>
            <li>Encrypted credential storage.</li>
            <li>Authentication and multi-user workspaces.</li>
            <li>Usage limits and billing.</li>
            <li>Legal review for outreach compliance.</li>
            <li>Reliable job queue such as BullMQ/Redis for scale.</li>
          </ol>

          <div className="safe-note-v54">
            <Shield /> This build is structured for product demos, with clear places
            to add production infrastructure.
          </div>
        </aside>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}