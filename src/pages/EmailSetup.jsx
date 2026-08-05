import { useEffect, useMemo, useState } from "react";
import gmailLogo from "../assets/gmail.webp";
import { api } from "../api";
import {
  Check,
  Database,
  ExternalLink,
  Globe,
  Inbox,
  Lock,
  Mail,
  Plus,
  Send,
  Shield,
  Sparkles,
  Trash2,
} from "../components/icons";

const PROVIDERS = {
  gmail: {
    label: "Gmail",
    logo: gmailLogo,
    badge: "G",
    className: "gmail",
    text: "Google SMTP + Gmail IMAP",
    smtp: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
    },
    imap: {
      host: "imap.gmail.com",
      port: 993,
      secure: true,
    },
    usernameText: "Use your Gmail address",
    passwordText:
      "Use a Google App Password. Normal Gmail password usually will not work.",
    docsText: "Requires 2-Step Verification and Gmail IMAP enabled.",
  },
  outlook: {
    label: "Microsoft / Outlook",
    badge: "M",
    className: "outlook",
    text: "Office 365 SMTP + Outlook IMAP",
    smtp: {
      host: "smtp.office365.com",
      port: 587,
      secure: false,
    },
    imap: {
      host: "outlook.office365.com",
      port: 993,
      secure: true,
    },
    usernameText: "Use your Outlook or Microsoft 365 email",
    passwordText:
      "Use mailbox password or app password if your Microsoft account requires it.",
    docsText:
      "Some Microsoft 365 tenants block IMAP/basic auth. Enable IMAP or use an app password.",
  },
  custom: {
    label: "Custom SMTP / IMAP",
    badge: "SMTP",
    className: "custom",
    text: "Any provider with SMTP and IMAP",
    smtp: {
      host: "",
      port: 587,
      secure: false,
    },
    imap: {
      host: "",
      port: 993,
      secure: true,
    },
    usernameText: "Use provider mailbox username",
    passwordText: "Use provider SMTP/IMAP password or app password.",
    docsText: "Ask your provider for SMTP and IMAP host, port, and SSL settings.",
  },
};

const empty = {
  accountId: "",
  label: "",
  provider: "gmail",
  fromName: "ReachFly.Ai",
  fromEmail: "",
  replyTo: "",

  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  username: "",
  password: "",

  incomingHost: "imap.gmail.com",
  incomingPort: 993,
  incomingSecure: true,
  incomingUsername: "",
  incomingPassword: "",

  sameIncomingCredentials: true,
  hasPassword: false,
  hasIncomingPassword: false,
};

export default function EmailSetup() {
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState("");
  const [form, setForm] = useState(empty);

  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingInbox, setTestingInbox] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const provider = PROVIDERS[form.provider] || PROVIDERS.custom;

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === form.accountId) || null,
    [accounts, form.accountId]
  );

  const normalizedForm = useMemo(() => {
    if (!form.sameIncomingCredentials) return form;

    return {
      ...form,
      incomingUsername: form.username,
      incomingPassword: form.incomingPassword || form.password,
    };
  }, [form]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await api.emailSettings();
      applySettings(settings);
    } catch {
      setAccounts([]);
    }
  };

  const applySettings = (settings = {}) => {
    const nextAccounts = Array.isArray(settings.accounts) ? settings.accounts : [];
    const activeId = settings.activeAccountId || settings.activeAccount?.id || "";

    setAccounts(nextAccounts);
    setActiveAccountId(activeId);

    const active =
      nextAccounts.find((account) => account.id === activeId) ||
      settings.activeAccount ||
      nextAccounts[0] ||
      (settings.fromEmail || settings.host ? settings : null);

    if (active) {
      setForm(formFromAccount(active));
    } else {
      setForm(createEmptyForm("gmail"));
    }
  };

  const set = (key, value) => {
    setMessage("");
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseProvider = (providerKey) => {
    const next = PROVIDERS[providerKey];

    setMessage("");
    setError("");

    setForm((current) => ({
      ...current,
      provider: providerKey,
      host: next.smtp.host,
      port: next.smtp.port,
      secure: next.smtp.secure,
      incomingHost: next.imap.host,
      incomingPort: next.imap.port,
      incomingSecure: next.imap.secure,
    }));
  };

  const addNewAccount = () => {
    setMessage("");
    setError("");
    setForm(createEmptyForm("custom"));
  };

  const selectAccount = (account) => {
    setMessage("");
    setError("");
    setForm(formFromAccount(account));
    setActiveAccountId(account.id);
  };

  const payload = () => {
    const next = {
      ...normalizedForm,
      accountId: normalizedForm.accountId || "",
      label:
        normalizedForm.label ||
        normalizedForm.fromEmail ||
        normalizedForm.username ||
        "Email account",
      port: Number(normalizedForm.port || 587),
      incomingPort: Number(normalizedForm.incomingPort || 993),
    };

    if (!next.password) delete next.password;
    if (!next.incomingPassword) delete next.incomingPassword;

    return next;
  };

  const save = async () => {
    try {
      setSaving(true);
      setError("");

      const saved = await api.saveEmailSettings(payload());

      applySettings(saved);

      setMessage("Email account saved successfully.");
    } catch (e) {
      setError(e.message || "Could not save email settings.");
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async () => {
    if (!form.accountId) {
      addNewAccount();
      return;
    }

    const confirmed = window.confirm(
      `Remove ${form.fromEmail || form.label || "this email account"} from ReachFly.Ai?`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");
      setMessage("");

      const updated = await api.deleteEmailAccount(form.accountId);
      applySettings(updated);

      setMessage("Email account removed.");
    } catch (e) {
      setError(e.message || "Could not delete email account.");
    } finally {
      setDeleting(false);
    }
  };

  const testSmtp = async () => {
    try {
      setTestingSmtp(true);
      setError("");

      const result = await api.testEmailSettings(payload());

      if (!result.ok) {
        setError(result.message || "SMTP test failed.");
      } else {
        setMessage(result.message || "SMTP setup test completed.");
      }
    } catch (e) {
      setError(e.message || "SMTP test failed.");
    } finally {
      setTestingSmtp(false);
    }
  };

  const testInbox = async () => {
    try {
      setTestingInbox(true);
      setError("");

      const result = await api.testIncomingEmailSettings(payload());

      if (!result.ok) {
        setError(result.message || "Incoming mailbox test failed.");
      } else {
        setMessage(result.message || "Incoming mailbox verified.");
      }
    } catch (e) {
      setError(e.message || "Incoming mailbox test failed.");
    } finally {
      setTestingInbox(false);
    }
  };

  const syncInbox = async () => {
    try {
      setSyncing(true);
      setError("");

      const result = await api.syncInbox(25, form.accountId || activeAccountId);

      if (!result.ok) {
        setError(result.message || "Inbox sync failed.");
      } else {
        setMessage(result.message || "Inbox synced successfully.");
      }
    } catch (e) {
      setError(e.message || "Inbox sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="setup-page-v54 email-setup-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Email setup</span>
          <h1>Manage sending accounts and inbox syncing.</h1>
          <p>
            Add multiple SMTP/IMAP accounts, sync their inboxes, and later assign
            a different sender email to each campaign.
          </p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      {message ? (
        <p className="success-banner">
          <Check size={17} /> {message}
        </p>
      ) : null}

      <section className="email-accounts-panel">
        <div className="email-accounts-head">
          <div>
            <h2>Connected email accounts</h2>
            <p>
              These accounts are stored in your backend and can be selected for
              campaign sending later.
            </p>
          </div>

          <button className="btn primary small" type="button" onClick={addNewAccount}>
            <Plus size={14} /> Add email account
          </button>
        </div>

        {accounts.length ? (
          <div className="email-account-grid">
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                className={`email-account-card ${
                  form.accountId === account.id ? "active" : ""
                }`}
                onClick={() => selectAccount(account)}
              >
                <ProviderLogo provider={PROVIDERS[account.provider] || PROVIDERS.custom} />

                <div>
                  <b>{account.label || account.fromEmail || "Email account"}</b>
                  <small>{account.fromEmail || account.username || "No email set"}</small>

                  <span>
                    {account.id === activeAccountId ? "Active sender" : "Saved account"}
                  </span>
                </div>

                <div className="email-account-tags">
                  {account.hasPassword ? <em>SMTP saved</em> : <em>Needs SMTP</em>}
                  {account.incomingHost ? <em>IMAP ready</em> : <em>No IMAP</em>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="email-accounts-empty">
            <Mail size={20} />
            <div>
              <b>No email account saved yet</b>
              <small>Add Gmail, Outlook, or custom SMTP/IMAP details to begin.</small>
            </div>
          </div>
        )}
      </section>

      <section className="setup-layout-v54 email-setup-layout">
        <div className="cardish setup-main-card email-config-card">
          <div className="email-editor-head">
            <div>
              <h2>{form.accountId ? "Edit email account" : "Add new email account"}</h2>
              <p className="text-muted">
                {form.accountId
                  ? "Update this saved sender and mailbox configuration."
                  : "Choose a provider and save this as another sender account."}
              </p>
            </div>

            {form.accountId ? (
              <button
                className="btn ghost small danger"
                type="button"
                disabled={deleting}
                onClick={removeAccount}
              >
                <Trash2 size={14} /> {deleting ? "Removing…" : "Remove"}
              </button>
            ) : null}
          </div>

          {selectedAccount ? (
            <div className="email-current-pill">
              <ProviderLogo provider={PROVIDERS[selectedAccount.provider] || PROVIDERS.custom} />
              <div>
                <b>Already set up</b>
                <small>
                  {selectedAccount.fromEmail || selectedAccount.username} ·{" "}
                  {selectedAccount.provider || "custom"}
                </small>
              </div>
            </div>
          ) : null}

          <div className="section-title-row mb16">
            <div>
              <h2>Choose provider</h2>
              <p className="text-muted">
                Pick a preset or use custom SMTP/IMAP details.
              </p>
            </div>
          </div>

          <div className="provider-grid-v54 email-provider-grid">
            {Object.entries(PROVIDERS).map(([key, item]) => (
              <Provider
                key={key}
                active={form.provider === key}
                provider={item}
                onClick={() => chooseProvider(key)}
              />
            ))}
          </div>

          <div className="email-provider-summary">
            <ProviderLogo provider={provider} />

            <div>
              <b>{provider.label} configuration</b>
              <small>{provider.docsText}</small>
            </div>
          </div>

          <div className="email-config-split">
            <section className="email-config-panel">
              <div className="email-config-panel-head">
                <span>
                  <Send size={18} />
                </span>

                <div>
                  <h3>Outgoing SMTP</h3>
                  <p>Used to send campaign emails and test messages.</p>
                </div>
              </div>

              <div className="form-grid-v54">
                <Field
                  label="Account label"
                  value={form.label}
                  onChange={(value) => set("label", value)}
                  placeholder="e.g. 3D Pak Sales, Support, Gmail Outreach"
                />

                <Field
                  label="From name"
                  value={form.fromName}
                  onChange={(value) => set("fromName", value)}
                  placeholder="ReachFly.Ai"
                />

                <Field
                  label="From email"
                  value={form.fromEmail}
                  onChange={(value) => {
                    set("fromEmail", value);

                    if (!form.username) {
                      set("username", value);
                    }
                  }}
                  placeholder="you@company.com"
                />

                <Field
                  label="Reply-to email"
                  value={form.replyTo}
                  onChange={(value) => set("replyTo", value)}
                  placeholder="optional"
                />

                <Field
                  label="SMTP username"
                  value={form.username}
                  onChange={(value) => set("username", value)}
                  placeholder={provider.usernameText}
                />

                <Field
                  label="SMTP host"
                  value={form.host}
                  onChange={(value) => set("host", value)}
                  placeholder="smtp.gmail.com"
                />

                <Field
                  label="SMTP port"
                  value={form.port}
                  onChange={(value) => set("port", Number(value || 0))}
                  type="number"
                />

                <CheckField
                  label="SMTP security"
                  checked={Boolean(form.secure)}
                  onChange={(value) => set("secure", value)}
                  text="Use SSL/TLS secure connection"
                />

                <Field
                  label={
                    form.hasPassword
                      ? "New SMTP password / app password"
                      : "SMTP password / app password"
                  }
                  value={form.password}
                  onChange={(value) => set("password", value)}
                  type="password"
                  placeholder={
                    form.hasPassword
                      ? "Saved. Leave blank to keep current password"
                      : provider.passwordText
                  }
                />
              </div>
            </section>

            <section className="email-config-panel">
              <div className="email-config-panel-head">
                <span>
                  <Inbox size={18} />
                </span>

                <div>
                  <h3>Incoming IMAP</h3>
                  <p>Used to sync incoming replies into the Inbox screen.</p>
                </div>
              </div>

              <div className="form-grid-v54">
                <Field
                  label="IMAP host"
                  value={form.incomingHost}
                  onChange={(value) => set("incomingHost", value)}
                  placeholder="imap.gmail.com"
                />

                <Field
                  label="IMAP port"
                  value={form.incomingPort}
                  onChange={(value) => set("incomingPort", Number(value || 0))}
                  type="number"
                />

                <CheckField
                  label="IMAP security"
                  checked={Boolean(form.incomingSecure)}
                  onChange={(value) => set("incomingSecure", value)}
                  text="Use SSL/TLS secure connection"
                />

                <CheckField
                  label="Credentials"
                  checked={Boolean(form.sameIncomingCredentials)}
                  onChange={(value) => set("sameIncomingCredentials", value)}
                  text="Use same username/password as SMTP"
                />

                {!form.sameIncomingCredentials ? (
                  <>
                    <Field
                      label="IMAP username"
                      value={form.incomingUsername}
                      onChange={(value) => set("incomingUsername", value)}
                      placeholder="mailbox username"
                    />

                    <Field
                      label={
                        form.hasIncomingPassword
                          ? "New IMAP password / app password"
                          : "IMAP password / app password"
                      }
                      value={form.incomingPassword}
                      onChange={(value) => set("incomingPassword", value)}
                      type="password"
                      placeholder={
                        form.hasIncomingPassword
                          ? "Saved. Leave blank to keep current password"
                          : "paste app password"
                      }
                    />
                  </>
                ) : (
                  <div className="email-same-credentials-note">
                    <Lock size={16} />
                    <span>
                      IMAP will use your SMTP username and saved password.
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="setup-actions-v54 email-actions">
            <button className="btn primary" disabled={saving} onClick={save}>
              {saving ? "Saving…" : form.accountId ? "Update account" : "Save account"}
            </button>

            <button className="btn" disabled={testingSmtp} onClick={testSmtp}>
              {testingSmtp ? "Testing…" : "Test SMTP"}
            </button>

            <button className="btn" disabled={testingInbox} onClick={testInbox}>
              {testingInbox ? "Testing…" : "Test inbox"}
            </button>

            <button
              className="btn light"
              disabled={syncing || !form.accountId}
              onClick={syncInbox}
            >
              {syncing ? "Syncing…" : "Sync this inbox"}
            </button>
          </div>
        </div>

        <aside className="cardish setup-guide-card email-guide-card">
          <Sparkles size={26} />

          <h2>{provider.label} setup guide</h2>

          <div className="email-guide-block">
            <b>
              <Mail size={15} /> Outgoing SMTP
            </b>
            <span>{form.host || provider.smtp.host || "Your SMTP host"}</span>
            <small>
              Port {form.port || provider.smtp.port} ·{" "}
              {form.secure ? "SSL/TLS" : "STARTTLS"}
            </small>
          </div>

          <div className="email-guide-block">
            <b>
              <Inbox size={15} /> Incoming IMAP
            </b>
            <span>{form.incomingHost || provider.imap.host || "Your IMAP host"}</span>
            <small>
              Port {form.incomingPort || provider.imap.port} ·{" "}
              {form.incomingSecure ? "SSL/TLS" : "STARTTLS"}
            </small>
          </div>

          <ol>
            <li>Add one or more sender accounts.</li>
            <li>Save SMTP and IMAP settings for each account.</li>
            <li>Test SMTP and inbox before using the sender.</li>
            <li>Sync each inbox when needed.</li>
            <li>Campaigns can later save an emailAccountId to choose a sender.</li>
          </ol>

          <div className="safe-note-v54">
            <Shield size={18} /> In production, encrypt credentials with a
            server-side secret or vault.
          </div>

          <div className="email-guide-links">
            <span>
              <Database size={15} /> Multiple accounts are stored in your backend
              data store.
            </span>
            <span>
              <Globe size={15} /> Works with providers that allow SMTP + IMAP.
            </span>
            <span>
              <ExternalLink size={15} /> OAuth can be added later for Google and
              Microsoft.
            </span>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Provider({ active, provider, onClick }) {
  return (
    <button
      type="button"
      className={`provider-card-v54 email-provider-card ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <ProviderLogo provider={provider} />

      <b>{provider.label}</b>
      <small>{provider.text}</small>

      {active ? <Check size={17} /> : null}
    </button>
  );
}

function ProviderLogo({ provider }) {
  return (
    <span className={`email-provider-logo ${provider.className}`}>
      {provider.logo ? (
        <img src={provider.logo} alt={`${provider.label} logo`} />
      ) : (
        provider.badge
      )}
    </span>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function CheckField({ label, checked, onChange, text }) {
  return (
    <label className="field checkbox-field-v54">
      <span>{label}</span>

      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        {text}
      </label>
    </label>
  );
}

function createEmptyForm(providerKey = "gmail") {
  const provider = PROVIDERS[providerKey] || PROVIDERS.gmail;

  return {
    ...empty,
    accountId: "",
    label: "",
    provider: providerKey,
    host: provider.smtp.host,
    port: provider.smtp.port,
    secure: provider.smtp.secure,
    incomingHost: provider.imap.host,
    incomingPort: provider.imap.port,
    incomingSecure: provider.imap.secure,
    password: "",
    incomingPassword: "",
  };
}

function formFromAccount(account = {}) {
  const providerKey = account.provider || "gmail";
  const provider = PROVIDERS[providerKey] || PROVIDERS.gmail;

  return {
    ...empty,
    provider: providerKey,
    host: provider.smtp.host,
    port: provider.smtp.port,
    secure: provider.smtp.secure,
    incomingHost: provider.imap.host,
    incomingPort: provider.imap.port,
    incomingSecure: provider.imap.secure,
    ...account,
    accountId: account.id || account.accountId || "",
    label: account.label || account.fromEmail || account.username || "",
    password: "",
    incomingPassword: "",
    sameIncomingCredentials:
      !account.incomingUsername || account.incomingUsername === account.username,
  };
}