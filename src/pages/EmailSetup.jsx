import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import gmailLogo from "../assets/gmail.webp";

import {
  api,
} from "../api";

import {
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  Globe,
  Inbox,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Trash2,
  X,
} from "../components/icons";

const PROVIDERS = {
  gmail: {
    label: "Gmail",
    logo: gmailLogo,
    badge: "G",
    className: "gmail",
    text: "Google mailbox",
    technicalText: "Google SMTP + Gmail IMAP",
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
      "Use a Google App Password. A normal Gmail password usually will not work.",
    docsText:
      "Requires 2-Step Verification and an App Password for mailbox access.",
  },

  outlook: {
    label: "Microsoft / Outlook",
    badge: "M",
    className: "outlook",
    text: "Microsoft mailbox",
    technicalText: "Microsoft 365 SMTP + Outlook IMAP",
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
    usernameText:
      "Use your Outlook or Microsoft 365 email",
    passwordText:
      "Use the mailbox password or an app password when your Microsoft account requires one.",
    docsText:
      "Some Microsoft 365 tenants restrict mailbox-password access. Your administrator may need to enable it.",
  },

  custom: {
    label: "Other email provider",
    badge: "SMTP",
    className: "custom",
    text: "Custom mailbox",
    technicalText: "Custom SMTP + IMAP",
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
    usernameText:
      "Use the mailbox username from your provider",
    passwordText:
      "Use the SMTP/IMAP password or app password from your provider.",
    docsText:
      "Use the outgoing and incoming server details supplied by your email provider.",
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
  const [
    accounts,
    setAccounts,
  ] = useState([]);

  const [
    activeAccountId,
    setActiveAccountId,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState(empty);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    testingSmtp,
    setTestingSmtp,
  ] = useState(false);

  const [
    testingInbox,
    setTestingInbox,
  ] = useState(false);

  const [
    syncing,
    setSyncing,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState({});

  const [
    advancedOpen,
    setAdvancedOpen,
  ] = useState(true);

  const provider =
    PROVIDERS[
      form.provider
    ] ||
    PROVIDERS.custom;

  const selectedAccount =
    useMemo(
      () =>
        accounts.find(
          (account) =>
            String(
              account.id
            ) ===
            String(
              form.accountId
            )
        ) ||
        null,
      [
        accounts,
        form.accountId,
      ]
    );

  const normalizedForm =
    useMemo(() => {
      if (
        !form.sameIncomingCredentials
      ) {
        return form;
      }

      return {
        ...form,
        incomingUsername:
          form.username,
        incomingPassword:
          form.incomingPassword ||
          form.password,
      };
    }, [
      form,
    ]);

  const metrics =
    useMemo(
      () =>
        buildEmailMetrics(
          accounts,
          activeAccountId
        ),
      [
        accounts,
        activeAccountId,
      ]
    );

  const applySettings =
    useCallback(
      (
        settings = {}
      ) => {
        const nextAccounts =
          normalizeEmailAccounts(
            settings
          );

        const activeId =
          firstString(
            settings.activeAccountId,
            settings.activeAccount?.id
          );

        setAccounts(
          nextAccounts
        );

        setActiveAccountId(
          activeId
        );

        const active =
          nextAccounts.find(
            (account) =>
              String(
                account.id
              ) ===
              String(
                activeId
              )
          ) ||
          settings.activeAccount ||
          nextAccounts[0] ||
          (
            settings.fromEmail ||
            settings.host
              ? settings
              : null
          );

        if (active) {
          setForm(
            formFromAccount(
              active
            )
          );
        } else {
          setForm(
            createEmptyForm(
              "gmail"
            )
          );
        }
      },
      []
    );

  const loadSettings =
    useCallback(
      async ({
        silent = false,
        successToast = false,
      } = {}) => {
        try {
          if (silent) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          setError("");

          const settings =
            await api.emailSettings();

          applySettings(
            settings ||
            {}
          );

          if (
            successToast
          ) {
            notify(
              "success",
              "Email settings refreshed",
              "Your latest sending-account configuration is now visible."
            );
          }
        } catch (requestError) {
          const text =
            requestError?.message ||
            "Could not load email settings.";

          setError(
            text
          );

          if (
            !silent
          ) {
            setAccounts(
              []
            );
          }

          if (
            successToast
          ) {
            notify(
              "error",
              "Refresh failed",
              text
            );
          }
        } finally {
          setLoading(
            false
          );
          setRefreshing(
            false
          );
        }
      },
      [
        applySettings,
      ]
    );

  useEffect(() => {
    void loadSettings();
  }, [
    loadSettings,
  ]);

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function setValue(
    key,
    value
  ) {
    clearFeedback();

    setFieldErrors(
      (current) => {
        if (
          !current[
            key
          ]
        ) {
          return current;
        }

        const next = {
          ...current,
        };

        delete next[
          key
        ];

        return next;
      }
    );

    setForm(
      (current) => ({
        ...current,
        [key]:
          value,
      })
    );
  }

  function setFromEmail(
    value
  ) {
    clearFeedback();

    setFieldErrors(
      (current) => {
        const next = {
          ...current,
        };

        delete next.fromEmail;

        return next;
      }
    );

    setForm(
      (current) => ({
        ...current,
        fromEmail:
          value,
        username:
          current.username ||
          value,
      })
    );
  }

  function chooseProvider(
    providerKey
  ) {
    const next =
      PROVIDERS[
        providerKey
      ];

    if (!next) {
      return;
    }

    clearFeedback();
    setFieldErrors({});

    setForm(
      (current) => ({
        ...current,
        provider:
          providerKey,
        host:
          next.smtp.host,
        port:
          next.smtp.port,
        secure:
          next.smtp.secure,
        incomingHost:
          next.imap.host,
        incomingPort:
          next.imap.port,
        incomingSecure:
          next.imap.secure,
      })
    );
  }

  function addNewAccount() {
    clearFeedback();
    setFieldErrors({});
    setAdvancedOpen(
      true
    );
    setForm(
      createEmptyForm(
        "custom"
      )
    );
  }

  function selectAccount(
    account
  ) {
    clearFeedback();
    setFieldErrors({});
    setForm(
      formFromAccount(
        account
      )
    );
  }

  function payload() {
    const next = {
      ...normalizedForm,
      accountId:
        normalizedForm.accountId ||
        "",
      label:
        normalizedForm.label ||
        normalizedForm.fromEmail ||
        normalizedForm.username ||
        "Email account",
      port:
        Number(
          normalizedForm.port ||
          587
        ),
      incomingPort:
        Number(
          normalizedForm.incomingPort ||
          993
        ),
    };

    if (
      !next.password
    ) {
      delete next.password;
    }

    if (
      !next.incomingPassword
    ) {
      delete next.incomingPassword;
    }

    return next;
  }

  function validate({
    requireIncoming = true,
  } = {}) {
    const nextErrors = {};

    if (
      !String(
        form.fromEmail ||
        ""
      ).trim()
    ) {
      nextErrors.fromEmail =
        "Enter the sender email address.";
    } else if (
      !isValidEmail(
        form.fromEmail
      )
    ) {
      nextErrors.fromEmail =
        "Enter a valid sender email address.";
    }

    if (
      form.replyTo &&
      !isValidEmail(
        form.replyTo
      )
    ) {
      nextErrors.replyTo =
        "Enter a valid reply-to email address.";
    }

    if (
      !String(
        form.username ||
        ""
      ).trim()
    ) {
      nextErrors.username =
        "Enter the outgoing-mail username.";
    }

    if (
      !String(
        form.host ||
        ""
      ).trim()
    ) {
      nextErrors.host =
        "Enter the outgoing-mail host.";
    }

    if (
      !isValidPort(
        form.port
      )
    ) {
      nextErrors.port =
        "Enter a valid port between 1 and 65535.";
    }

    if (
      !form.hasPassword &&
      !String(
        form.password ||
        ""
      ).trim()
    ) {
      nextErrors.password =
        "Enter the mailbox password or app password.";
    }

    if (
      requireIncoming
    ) {
      if (
        !String(
          form.incomingHost ||
          ""
        ).trim()
      ) {
        nextErrors.incomingHost =
          "Enter the incoming-mail host.";
      }

      if (
        !isValidPort(
          form.incomingPort
        )
      ) {
        nextErrors.incomingPort =
          "Enter a valid port between 1 and 65535.";
      }

      if (
        !form.sameIncomingCredentials
      ) {
        if (
          !String(
            form.incomingUsername ||
            ""
          ).trim()
        ) {
          nextErrors.incomingUsername =
            "Enter the incoming-mail username.";
        }

        if (
          !form.hasIncomingPassword &&
          !String(
            form.incomingPassword ||
            ""
          ).trim()
        ) {
          nextErrors.incomingPassword =
            "Enter the incoming mailbox password or app password.";
        }
      }
    }

    setFieldErrors(
      nextErrors
    );

    const firstError =
      Object.values(
        nextErrors
      )[0];

    if (firstError) {
      setError(
        firstError
      );

      notify(
        "warning",
        "Check the email account",
        firstError
      );

      return false;
    }

    return true;
  }

  async function save() {
    if (
      !validate({
        requireIncoming:
          true,
      })
    ) {
      return;
    }

    try {
      setSaving(
        true
      );
      setError("");
      setMessage("");

      const saved =
        await api.saveEmailSettings(
          payload()
        );

      if (
        looksLikeSettingsPayload(
          saved
        )
      ) {
        applySettings(
          saved
        );
      } else {
        await loadSettings({
          silent:
            true,
        });
      }

      const text =
        form.accountId
          ? "Email account updated successfully."
          : "Email account saved successfully.";

      setMessage(
        text
      );

      notify(
        "success",
        form.accountId
          ? "Email account updated"
          : "Email account connected",
        "ReachFly saved the mailbox configuration."
      );
    } catch (requestError) {
      const text =
        requestError?.message ||
        "Could not save email settings.";

      setError(
        text
      );

      notify(
        "error",
        "Couldn't save email account",
        text
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  async function removeAccount() {
    if (
      !form.accountId
    ) {
      addNewAccount();
      return;
    }

    const confirmed =
      window.confirm(
        `Remove ${
          form.fromEmail ||
          form.label ||
          "this email account"
        } from ReachFly.AI?`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setDeleting(
        true
      );
      setError("");
      setMessage("");

      const updated =
        await api.deleteEmailAccount(
          form.accountId
        );

      if (
        looksLikeSettingsPayload(
          updated
        )
      ) {
        applySettings(
          updated
        );
      } else {
        await loadSettings({
          silent:
            true,
        });
      }

      setMessage(
        "Email account removed."
      );

      notify(
        "success",
        "Email account removed",
        "The mailbox is no longer available for ReachFly sending or inbox sync."
      );
    } catch (requestError) {
      const text =
        requestError?.message ||
        "Could not delete email account.";

      setError(
        text
      );

      notify(
        "error",
        "Couldn't remove email account",
        text
      );
    } finally {
      setDeleting(
        false
      );
    }
  }

  async function testSmtp() {
    if (
      !validate({
        requireIncoming:
          false,
      })
    ) {
      return;
    }

    try {
      setTestingSmtp(
        true
      );
      setError("");
      setMessage("");

      const result =
        await api.testEmailSettings(
          payload()
        );

      if (
        result?.ok ===
        false
      ) {
        const text =
          result.message ||
          "Sending test failed.";

        setError(
          text
        );

        notify(
          "error",
          "Sending test failed",
          text
        );
      } else {
        const text =
          result?.message ||
          "Outgoing email connection verified.";

        setMessage(
          text
        );

        notify(
          "success",
          "Sending connection verified",
          text
        );
      }
    } catch (requestError) {
      const text =
        requestError?.message ||
        "Sending test failed.";

      setError(
        text
      );

      notify(
        "error",
        "Sending test failed",
        text
      );
    } finally {
      setTestingSmtp(
        false
      );
    }
  }

  async function testInbox() {
    if (
      !validate({
        requireIncoming:
          true,
      })
    ) {
      return;
    }

    try {
      setTestingInbox(
        true
      );
      setError("");
      setMessage("");

      const result =
        await api.testIncomingEmailSettings(
          payload()
        );

      if (
        result?.ok ===
        false
      ) {
        const text =
          result.message ||
          "Incoming mailbox test failed.";

        setError(
          text
        );

        notify(
          "error",
          "Inbox connection failed",
          text
        );
      } else {
        const text =
          result?.message ||
          "Incoming mailbox verified.";

        setMessage(
          text
        );

        notify(
          "success",
          "Inbox connection verified",
          text
        );
      }
    } catch (requestError) {
      const text =
        requestError?.message ||
        "Incoming mailbox test failed.";

      setError(
        text
      );

      notify(
        "error",
        "Inbox connection failed",
        text
      );
    } finally {
      setTestingInbox(
        false
      );
    }
  }

  async function syncInbox() {
    if (
      !form.accountId
    ) {
      const text =
        "Save this email account before syncing its inbox.";

      setError(
        text
      );

      notify(
        "warning",
        "Save the account first",
        text
      );

      return;
    }

    try {
      setSyncing(
        true
      );
      setError("");
      setMessage("");

      const result =
        await api.syncInbox(
          25,
          form.accountId ||
          activeAccountId
        );

      if (
        result?.ok ===
        false
      ) {
        const text =
          result.message ||
          "Inbox sync failed.";

        setError(
          text
        );

        notify(
          "error",
          "Inbox sync failed",
          text
        );
      } else {
        const text =
          result?.message ||
          "Inbox synced successfully.";

        setMessage(
          text
        );

        notify(
          "success",
          "Inbox synced",
          text
        );
      }
    } catch (requestError) {
      const text =
        requestError?.message ||
        "Inbox sync failed.";

      setError(
        text
      );

      notify(
        "error",
        "Inbox sync failed",
        text
      );
    } finally {
      setSyncing(
        false
      );
    }
  }

  return (
    <>
      <EmailSetupStyles />

      <div className="rf-email-v7">
        <header className="rfe-page-header">
          <div>
            <span className="rfe-eyebrow">
              Communication
            </span>

            <h1>
              Email
            </h1>

            <p>
              Connect sender mailboxes, receive campaign replies, and keep
              outreach conversations synchronized.
            </p>
          </div>

          <div className="rfe-header-actions">
            <Link
              className="rfe-btn rfe-btn-secondary"
              to="/app/inbox"
            >
              <Inbox size={15} />
              Open Inbox
            </Link>

            <button
              type="button"
              className="rfe-btn rfe-btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadSettings({
                  silent:
                    true,
                  successToast:
                    true,
                })
              }
            >
              <RefreshCw
                size={15}
                className={
                  refreshing
                    ? "spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="rfe-btn rfe-btn-primary"
              onClick={
                addNewAccount
              }
            >
              <Plus size={15} />
              Add Email Account
            </button>
          </div>
        </header>

        <section className="rfe-metrics">
          <EmailMetric
            icon={
              <Mail size={16} />
            }
            label="Connected Accounts"
            value={
              metrics.total
            }
            note="Saved mailboxes"
          />

          <EmailMetric
            icon={
              <Send size={16} />
            }
            label="Active Sender"
            value={
              metrics.active
                ? "1"
                : "—"
            }
            note={
              metrics.activeLabel ||
              "No active sender"
            }
            tone="violet"
          />

          <EmailMetric
            icon={
              <Inbox size={16} />
            }
            label="Inbox Configured"
            value={
              metrics.inboxReady
            }
            note="Incoming replies enabled"
            tone="success"
          />
        </section>

        {error ? (
          <section
            className="rfe-message error"
            role="alert"
          >
            <span>
              <X size={15} />
            </span>

            <div>
              <strong>
                Email setup needs attention
              </strong>

              <small>
                {error}
              </small>
            </div>
          </section>
        ) : null}

        {message ? (
          <section
            className="rfe-message success"
            role="status"
          >
            <span>
              <CheckCircle2 size={15} />
            </span>

            <div>
              <strong>
                Email setup updated
              </strong>

              <small>
                {message}
              </small>
            </div>
          </section>
        ) : null}

        <section className="rfe-workspace">
          <aside className="rfe-account-rail">
            <div className="rfe-account-rail-head">
              <div>
                <span className="rfe-eyebrow">
                  Mailboxes
                </span>

                <h2>
                  Sending Accounts
                </h2>

                <p>
                  Choose an account to edit or add another sender.
                </p>
              </div>

              <button
                type="button"
                aria-label="Add email account"
                title="Add email account"
                onClick={
                  addNewAccount
                }
              >
                <Plus size={15} />
              </button>
            </div>

            <div className="rfe-account-list">
              {loading ? (
                <AccountSkeleton />
              ) : accounts.length ? (
                accounts.map(
                  (
                    account,
                    index
                  ) => (
                    <AccountCard
                      key={
                        account.id ||
                        index
                      }
                      account={
                        account
                      }
                      activeAccountId={
                        activeAccountId
                      }
                      selected={
                        String(
                          form.accountId
                        ) ===
                        String(
                          account.id
                        )
                      }
                      onClick={() =>
                        selectAccount(
                          account
                        )
                      }
                      index={
                        index
                      }
                    />
                  )
                )
              ) : (
                <AccountEmpty
                  onAdd={
                    addNewAccount
                  }
                />
              )}
            </div>

            <div className="rfe-account-rail-foot">
              <Shield size={14} />

              <p>
                Password fields are never re-filled into the browser after
                they have been saved.
              </p>
            </div>
          </aside>

          <main className="rfe-editor">
            <div className="rfe-editor-head">
              <div>
                <span className="rfe-eyebrow">
                  {form.accountId
                    ? "Account settings"
                    : "New account"}
                </span>

                <h2>
                  {form.accountId
                    ? form.label ||
                      form.fromEmail ||
                      "Email account"
                    : "Connect an email account"}
                </h2>

                <p>
                  {form.accountId
                    ? "Update sender identity, sending access, and incoming reply sync."
                    : "Choose your mailbox provider, then add the credentials ReachFly needs for sending and reply sync."}
                </p>
              </div>

              {form.accountId ? (
                <div className="rfe-editor-head-actions">
                  {String(
                    form.accountId
                  ) ===
                  String(
                    activeAccountId
                  ) ? (
                    <span className="rfe-active-pill">
                      <Check size={13} />
                      Active sender
                    </span>
                  ) : (
                    <span className="rfe-saved-pill">
                      Saved account
                    </span>
                  )}

                  <button
                    type="button"
                    className="rfe-delete-btn"
                    disabled={
                      deleting
                    }
                    onClick={() =>
                      void removeAccount()
                    }
                  >
                    {deleting ? (
                      <RefreshCw
                        size={14}
                        className="spin"
                      />
                    ) : (
                      <Trash2 size={14} />
                    )}

                    Remove
                  </button>
                </div>
              ) : null}
            </div>

            <section className="rfe-provider-section">
              <div className="rfe-section-heading">
                <div>
                  <h3>
                    Choose provider
                  </h3>

                  <p>
                    Start with a preset or enter another provider's mailbox
                    details.
                  </p>
                </div>
              </div>

              <div className="rfe-provider-grid">
                {Object.entries(
                  PROVIDERS
                ).map(
                  ([
                    key,
                    item,
                  ]) => (
                    <ProviderCard
                      key={
                        key
                      }
                      active={
                        form.provider ===
                        key
                      }
                      provider={
                        item
                      }
                      onClick={() =>
                        chooseProvider(
                          key
                        )
                      }
                    />
                  )
                )}
              </div>

              <div className="rfe-provider-note">
                <ProviderLogo
                  provider={
                    provider
                  }
                />

                <div>
                  <strong>
                    {provider.label}
                  </strong>

                  <p>
                    {provider.docsText}
                  </p>
                </div>

                <span>
                  {provider.technicalText}
                </span>
              </div>
            </section>

            <section className="rfe-identity-card">
              <div className="rfe-section-heading">
                <div>
                  <span className="rfe-section-icon">
                    <Mail size={15} />
                  </span>

                  <div>
                    <h3>
                      Sender identity
                    </h3>

                    <p>
                      The name and address recipients see when ReachFly sends
                      campaign emails.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rfe-form-grid">
                <Field
                  label="Account label"
                  value={
                    form.label
                  }
                  onChange={(
                    value
                  ) =>
                    setValue(
                      "label",
                      value
                    )
                  }
                  placeholder="e.g. Sales, Founder Outreach"
                />

                <Field
                  label="From name"
                  value={
                    form.fromName
                  }
                  onChange={(
                    value
                  ) =>
                    setValue(
                      "fromName",
                      value
                    )
                  }
                  placeholder="Your name or team"
                />

                <Field
                  label="From email"
                  value={
                    form.fromEmail
                  }
                  onChange={
                    setFromEmail
                  }
                  placeholder="you@company.com"
                  error={
                    fieldErrors.fromEmail
                  }
                />

                <Field
                  label="Reply-to email"
                  value={
                    form.replyTo
                  }
                  onChange={(
                    value
                  ) =>
                    setValue(
                      "replyTo",
                      value
                    )
                  }
                  placeholder="Optional"
                  error={
                    fieldErrors.replyTo
                  }
                />
              </div>
            </section>

            <section className="rfe-connection-grid">
              <ConnectionCard
                tone="primary"
                icon={
                  <Send size={16} />
                }
                eyebrow="Sending"
                title="Outgoing mail"
                description="Used to send campaign emails and connection tests."
                status={
                  form.hasPassword
                    ? "Credentials saved"
                    : "Credentials required"
                }
              >
                <div className="rfe-form-grid">
                  <Field
                    label="Mailbox username"
                    value={
                      form.username
                    }
                    onChange={(
                      value
                    ) =>
                      setValue(
                        "username",
                        value
                      )
                    }
                    placeholder={
                      provider.usernameText
                    }
                    error={
                      fieldErrors.username
                    }
                  />

                  <Field
                    label={
                      form.hasPassword
                        ? "New password / app password"
                        : "Password / app password"
                    }
                    value={
                      form.password
                    }
                    onChange={(
                      value
                    ) =>
                      setValue(
                        "password",
                        value
                      )
                    }
                    type="password"
                    placeholder={
                      form.hasPassword
                        ? "Saved — leave blank to keep it"
                        : provider.passwordText
                    }
                    error={
                      fieldErrors.password
                    }
                  />
                </div>

                <AdvancedConnection
                  open={
                    advancedOpen
                  }
                  onToggle={() =>
                    setAdvancedOpen(
                      (value) =>
                        !value
                    )
                  }
                  title="Outgoing server details"
                >
                  <div className="rfe-form-grid technical">
                    <Field
                      label="SMTP host"
                      value={
                        form.host
                      }
                      onChange={(
                        value
                      ) =>
                        setValue(
                          "host",
                          value
                        )
                      }
                      placeholder="smtp.example.com"
                      error={
                        fieldErrors.host
                      }
                    />

                    <Field
                      label="SMTP port"
                      value={
                        form.port
                      }
                      onChange={(
                        value
                      ) =>
                        setValue(
                          "port",
                          Number(
                            value ||
                            0
                          )
                        )
                      }
                      type="number"
                      error={
                        fieldErrors.port
                      }
                    />

                    <ToggleField
                      label="Secure connection"
                      checked={
                        Boolean(
                          form.secure
                        )
                      }
                      onChange={(
                        value
                      ) =>
                        setValue(
                          "secure",
                          value
                        )
                      }
                      text="Use SSL/TLS for outgoing mail"
                    />
                  </div>
                </AdvancedConnection>
              </ConnectionCard>

              <ConnectionCard
                tone="violet"
                icon={
                  <Inbox size={16} />
                }
                eyebrow="Replies"
                title="Incoming mailbox"
                description="Used to sync incoming campaign replies into ReachFly Inbox."
                status={
                  form.incomingHost
                    ? "Inbox configured"
                    : "Setup required"
                }
              >
                <ToggleField
                  label="Credentials"
                  checked={
                    Boolean(
                      form.sameIncomingCredentials
                    )
                  }
                  onChange={(
                    value
                  ) =>
                    setValue(
                      "sameIncomingCredentials",
                      value
                    )
                  }
                  text="Use the same username and password as outgoing mail"
                />

                {!form.sameIncomingCredentials ? (
                  <div className="rfe-form-grid">
                    <Field
                      label="Mailbox username"
                      value={
                        form.incomingUsername
                      }
                      onChange={(
                        value
                      ) =>
                        setValue(
                          "incomingUsername",
                          value
                        )
                      }
                      placeholder="Incoming mailbox username"
                      error={
                        fieldErrors.incomingUsername
                      }
                    />

                    <Field
                      label={
                        form.hasIncomingPassword
                          ? "New password / app password"
                          : "Password / app password"
                      }
                      value={
                        form.incomingPassword
                      }
                      onChange={(
                        value
                      ) =>
                        setValue(
                          "incomingPassword",
                          value
                        )
                      }
                      type="password"
                      placeholder={
                        form.hasIncomingPassword
                          ? "Saved — leave blank to keep it"
                          : "Incoming mailbox password"
                      }
                      error={
                        fieldErrors.incomingPassword
                      }
                    />
                  </div>
                ) : (
                  <div className="rfe-credential-note">
                    <Lock size={14} />

                    <span>
                      Incoming mail will use the outgoing mailbox username and
                      saved password.
                    </span>
                  </div>
                )}

                <AdvancedConnection
                  open={
                    advancedOpen
                  }
                  onToggle={() =>
                    setAdvancedOpen(
                      (value) =>
                        !value
                    )
                  }
                  title="Incoming server details"
                >
                  <div className="rfe-form-grid technical">
                    <Field
                      label="IMAP host"
                      value={
                        form.incomingHost
                      }
                      onChange={(
                        value
                      ) =>
                        setValue(
                          "incomingHost",
                          value
                        )
                      }
                      placeholder="imap.example.com"
                      error={
                        fieldErrors.incomingHost
                      }
                    />

                    <Field
                      label="IMAP port"
                      value={
                        form.incomingPort
                      }
                      onChange={(
                        value
                      ) =>
                        setValue(
                          "incomingPort",
                          Number(
                            value ||
                            0
                          )
                        )
                      }
                      type="number"
                      error={
                        fieldErrors.incomingPort
                      }
                    />

                    <ToggleField
                      label="Secure connection"
                      checked={
                        Boolean(
                          form.incomingSecure
                        )
                      }
                      onChange={(
                        value
                      ) =>
                        setValue(
                          "incomingSecure",
                          value
                        )
                      }
                      text="Use SSL/TLS for incoming mail"
                    />
                  </div>
                </AdvancedConnection>
              </ConnectionCard>
            </section>

            <section className="rfe-action-card">
              <div>
                <span className="rfe-eyebrow">
                  Verify & save
                </span>

                <h3>
                  Finish this email account
                </h3>

                <p>
                  Test the sending and inbox connections before using this
                  mailbox for outreach.
                </p>
              </div>

              <div className="rfe-action-grid">
                <button
                  type="button"
                  className="rfe-action-button"
                  disabled={
                    testingSmtp ||
                    saving
                  }
                  onClick={() =>
                    void testSmtp()
                  }
                >
                  <span>
                    {testingSmtp ? (
                      <RefreshCw
                        size={16}
                        className="spin"
                      />
                    ) : (
                      <Send size={16} />
                    )}
                  </span>

                  <div>
                    <strong>
                      Test sending
                    </strong>

                    <small>
                      Verify the outgoing connection.
                    </small>
                  </div>

                  <ChevronRight size={14} />
                </button>

                <button
                  type="button"
                  className="rfe-action-button"
                  disabled={
                    testingInbox ||
                    saving
                  }
                  onClick={() =>
                    void testInbox()
                  }
                >
                  <span className="violet">
                    {testingInbox ? (
                      <RefreshCw
                        size={16}
                        className="spin"
                      />
                    ) : (
                      <Inbox size={16} />
                    )}
                  </span>

                  <div>
                    <strong>
                      Test inbox
                    </strong>

                    <small>
                      Verify incoming reply access.
                    </small>
                  </div>

                  <ChevronRight size={14} />
                </button>

                <button
                  type="button"
                  className="rfe-action-button"
                  disabled={
                    syncing ||
                    !form.accountId
                  }
                  onClick={() =>
                    void syncInbox()
                  }
                >
                  <span className="success">
                    {syncing ? (
                      <RefreshCw
                        size={16}
                        className="spin"
                      />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </span>

                  <div>
                    <strong>
                      Sync inbox now
                    </strong>

                    <small>
                      Pull the latest campaign replies.
                    </small>
                  </div>

                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="rfe-save-row">
                <span>
                  {form.accountId
                    ? "Changes only affect this saved mailbox."
                    : "The account is not saved until you choose Save account."}
                </span>

                <button
                  type="button"
                  className="rfe-btn rfe-btn-primary save"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void save()
                  }
                >
                  {saving ? (
                    <RefreshCw
                      size={15}
                      className="spin"
                    />
                  ) : (
                    <Check size={15} />
                  )}

                  {saving
                    ? "Saving…"
                    : form.accountId
                      ? "Update Account"
                      : "Save Account"}
                </button>
              </div>
            </section>
          </main>

          <aside className="rfe-guide">
            <section className="rfe-guide-card provider">
              <div className="rfe-guide-title">
                <ProviderLogo
                  provider={
                    provider
                  }
                />

                <div>
                  <span className="rfe-eyebrow">
                    Setup guide
                  </span>

                  <h2>
                    {provider.label}
                  </h2>
                </div>
              </div>

              <p>
                {provider.docsText}
              </p>

              <div className="rfe-guide-connection">
                <span>
                  <Send size={14} />
                </span>

                <div>
                  <small>
                    Outgoing mail
                  </small>

                  <strong>
                    {form.host ||
                      provider.smtp.host ||
                      "Provider SMTP host"}
                  </strong>

                  <em>
                    Port{" "}
                    {form.port ||
                      provider.smtp.port}{" "}
                    ·{" "}
                    {form.secure
                      ? "SSL/TLS"
                      : "STARTTLS"}
                  </em>
                </div>
              </div>

              <div className="rfe-guide-connection">
                <span className="violet">
                  <Inbox size={14} />
                </span>

                <div>
                  <small>
                    Incoming replies
                  </small>

                  <strong>
                    {form.incomingHost ||
                      provider.imap.host ||
                      "Provider IMAP host"}
                  </strong>

                  <em>
                    Port{" "}
                    {form.incomingPort ||
                      provider.imap.port}{" "}
                    ·{" "}
                    {form.incomingSecure
                      ? "SSL/TLS"
                      : "STARTTLS"}
                  </em>
                </div>
              </div>
            </section>

            <section className="rfe-guide-card workflow">
              <div className="rfe-guide-heading">
                <Sparkles size={17} />

                <h3>
                  Recommended setup
                </h3>
              </div>

              <ol>
                <li>
                  Add the sender email and mailbox username.
                </li>
                <li>
                  Use an app password when your provider requires one.
                </li>
                <li>
                  Test sending and incoming reply access.
                </li>
                <li>
                  Save the mailbox before syncing its inbox.
                </li>
                <li>
                  Choose the saved account when configuring campaign sending.
                </li>
              </ol>

              <Link
                className="rfe-guide-link"
                to="/app/campaigns"
              >
                Open Campaigns
                <ChevronRight size={13} />
              </Link>
            </section>

            <section className="rfe-guide-card security">
              <div className="rfe-guide-heading">
                <Shield size={17} />

                <h3>
                  Credential safety
                </h3>
              </div>

              <p>
                Saved passwords are represented only as a saved-credential
                state in this form. ReachFly does not re-fill the secret value
                into the browser.
              </p>

              <div className="rfe-security-list">
                <span>
                  <Lock size={13} />
                  Leave a saved password blank to keep it unchanged.
                </span>

                <span>
                  <Database size={13} />
                  Mailbox accounts are stored through your ReachFly backend.
                </span>

                <span>
                  <Globe size={13} />
                  Custom providers work when they allow outgoing and incoming
                  mailbox access.
                </span>
              </div>
            </section>

            <section className="rfe-guide-card links">
              <div className="rfe-guide-heading">
                <ExternalLink size={17} />

                <h3>
                  Related pages
                </h3>
              </div>

              <div className="rfe-related-links">
                <Link to="/app/inbox">
                  <Inbox size={13} />
                  Inbox
                  <ChevronRight size={12} />
                </Link>

                <Link to="/app/campaigns">
                  <Send size={13} />
                  Campaigns
                  <ChevronRight size={12} />
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </>
  );
}

function EmailMetric({
  icon,
  label,
  value,
  note,
  tone = "primary",
}) {
  return (
    <article
      className={`rfe-metric ${tone}`}
    >
      <span>
        {icon}
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {formatMetricValue(
            value
          )}
        </strong>

        <em>
          {note}
        </em>
      </div>
    </article>
  );
}

function AccountCard({
  account,
  activeAccountId,
  selected,
  onClick,
  index,
}) {
  const accountProvider =
    PROVIDERS[
      account.provider
    ] ||
    PROVIDERS.custom;

  const active =
    String(
      account.id
    ) ===
    String(
      activeAccountId
    );

  const fromEmail =
    firstString(
      account.fromEmail,
      account.username,
      "No email set"
    );

  const inboxReady =
    Boolean(
      account.incomingHost
    );

  return (
    <button
      type="button"
      className={`rfe-account-card ${
        selected
          ? "selected"
          : ""
      }`}
      style={{
        "--rfe-account-index":
          index,
      }}
      onClick={
        onClick
      }
    >
      <ProviderLogo
        provider={
          accountProvider
        }
      />

      <div className="rfe-account-card-copy">
        <strong>
          {account.label ||
            fromEmail ||
            "Email account"}
        </strong>

        <small>
          {fromEmail}
        </small>

        <span>
          {active
            ? "Active sender"
            : accountProvider.label}
        </span>
      </div>

      <div className="rfe-account-card-status">
        <i
          className={
            account.hasPassword
              ? "ready"
              : "attention"
          }
          title={
            account.hasPassword
              ? "Sending credentials saved"
              : "Sending credentials needed"
          }
        />

        <i
          className={
            inboxReady
              ? "ready"
              : "attention"
          }
          title={
            inboxReady
              ? "Incoming mailbox configured"
              : "Incoming mailbox not configured"
          }
        />
      </div>
    </button>
  );
}

function AccountEmpty({
  onAdd,
}) {
  return (
    <div className="rfe-account-empty">
      <span>
        <Mail size={20} />
      </span>

      <strong>
        No email accounts yet
      </strong>

      <p>
        Add Gmail, Microsoft, or another mailbox to start sending and syncing
        campaign replies.
      </p>

      <button
        type="button"
        onClick={
          onAdd
        }
      >
        <Plus size={13} />
        Add account
      </button>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div
      className="rfe-account-skeleton"
      aria-busy="true"
      aria-label="Loading email accounts"
    >
      {Array.from({
        length: 4,
      }).map(
        (
          _,
          index
        ) => (
          <div
            key={
              index
            }
          >
            <i />

            <span>
              <i />
              <i />
              <i />
            </span>
          </div>
        )
      )}
    </div>
  );
}

function ProviderCard({
  active,
  provider,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`rfe-provider-card ${
        active
          ? "active"
          : ""
      }`}
      onClick={
        onClick
      }
    >
      <ProviderLogo
        provider={
          provider
        }
      />

      <div>
        <strong>
          {provider.label}
        </strong>

        <small>
          {provider.text}
        </small>
      </div>

      <span className="rfe-provider-check">
        {active ? (
          <Check size={13} />
        ) : null}
      </span>
    </button>
  );
}

function ProviderLogo({
  provider,
}) {
  return (
    <span
      className={`rfe-provider-logo ${provider.className}`}
    >
      {provider.logo ? (
        <img
          src={
            provider.logo
          }
          alt={`${provider.label} logo`}
        />
      ) : (
        provider.badge
      )}
    </span>
  );
}

function ConnectionCard({
  tone,
  icon,
  eyebrow,
  title,
  description,
  status,
  children,
}) {
  return (
    <section
      className={`rfe-connection-card ${tone}`}
    >
      <div className="rfe-connection-head">
        <span>
          {icon}
        </span>

        <div>
          <small>
            {eyebrow}
          </small>

          <h3>
            {title}
          </h3>

          <p>
            {description}
          </p>
        </div>

        <em>
          {status}
        </em>
      </div>

      <div className="rfe-connection-body">
        {children}
      </div>
    </section>
  );
}

function AdvancedConnection({
  open,
  onToggle,
  title,
  children,
}) {
  return (
    <div className="rfe-advanced">
      <button
        type="button"
        className="rfe-advanced-toggle"
        aria-expanded={
          open
        }
        onClick={
          onToggle
        }
      >
        <span>
          {title}
        </span>

        <ChevronRight
          size={13}
          className={
            open
              ? "open"
              : ""
          }
        />
      </button>

      {open ? (
        <div className="rfe-advanced-content">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error = "",
}) {
  return (
    <label
      className={`rfe-field ${
        error
          ? "has-error"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <input
        type={
          type
        }
        value={
          value ??
          ""
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }
        placeholder={
          placeholder
        }
        autoComplete={
          type ===
          "password"
            ? "new-password"
            : undefined
        }
      />

      {error ? (
        <small>
          {error}
        </small>
      ) : null}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  text,
}) {
  return (
    <label className="rfe-toggle-field">
      <span className="rfe-toggle-field-label">
        {label}
      </span>

      <span className="rfe-toggle-row">
        <input
          type="checkbox"
          checked={
            checked
          }
          onChange={(
            event
          ) =>
            onChange(
              event.target
                .checked
            )
          }
        />

        <span
          className={`rfe-toggle ${
            checked
              ? "on"
              : ""
          }`}
          aria-hidden="true"
        >
          <i />
        </span>

        <span>
          {text}
        </span>
      </span>
    </label>
  );
}

/* ==========================================================================
 * Data helpers
 * ======================================================================= */

function createEmptyForm(
  providerKey = "gmail"
) {
  const provider =
    PROVIDERS[
      providerKey
    ] ||
    PROVIDERS.gmail;

  return {
    ...empty,
    accountId: "",
    label: "",
    provider:
      providerKey,
    host:
      provider.smtp.host,
    port:
      provider.smtp.port,
    secure:
      provider.smtp.secure,
    incomingHost:
      provider.imap.host,
    incomingPort:
      provider.imap.port,
    incomingSecure:
      provider.imap.secure,
    username: "",
    password: "",
    incomingUsername: "",
    incomingPassword: "",
    hasPassword: false,
    hasIncomingPassword: false,
  };
}

function formFromAccount(
  account = {}
) {
  const providerKey =
    account.provider ||
    "gmail";

  const provider =
    PROVIDERS[
      providerKey
    ] ||
    PROVIDERS.gmail;

  return {
    ...empty,
    provider:
      providerKey,
    host:
      provider.smtp.host,
    port:
      provider.smtp.port,
    secure:
      provider.smtp.secure,
    incomingHost:
      provider.imap.host,
    incomingPort:
      provider.imap.port,
    incomingSecure:
      provider.imap.secure,
    ...account,
    accountId:
      account.id ||
      account.accountId ||
      "",
    label:
      account.label ||
      account.fromEmail ||
      account.username ||
      "",
    password: "",
    incomingPassword: "",
    hasPassword:
      Boolean(
        account.hasPassword
      ),
    hasIncomingPassword:
      Boolean(
        account.hasIncomingPassword
      ),
    sameIncomingCredentials:
      typeof account.sameIncomingCredentials ===
      "boolean"
        ? account.sameIncomingCredentials
        : !account.incomingUsername ||
          account.incomingUsername ===
            account.username,
  };
}

function normalizeEmailAccounts(
  settings
) {
  if (
    Array.isArray(
      settings
    )
  ) {
    return settings;
  }

  if (
    Array.isArray(
      settings?.accounts
    )
  ) {
    return settings.accounts;
  }

  if (
    Array.isArray(
      settings?.data?.accounts
    )
  ) {
    return settings.data.accounts;
  }

  return [];
}

function looksLikeSettingsPayload(
  value
) {
  return Boolean(
    value &&
    (
      Array.isArray(
        value.accounts
      ) ||
      value.activeAccount ||
      value.activeAccountId ||
      value.fromEmail ||
      value.host
    )
  );
}

function buildEmailMetrics(
  accounts,
  activeAccountId
) {
  const active =
    accounts.find(
      (account) =>
        String(
          account.id
        ) ===
        String(
          activeAccountId
        )
    ) ||
    null;

  return {
    total:
      accounts.length,
    active:
      Boolean(
        active
      ),
    activeLabel:
      firstString(
        active?.label,
        active?.fromEmail,
        active?.username
      ),
    inboxReady:
      accounts.filter(
        (account) =>
          Boolean(
            account.incomingHost
          )
      ).length,
  };
}

function firstString(
  ...values
) {
  for (const value of values) {
    if (
      value ===
        null ||
      value ===
        undefined
    ) {
      continue;
    }

    const text =
      String(
        value
      ).trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function isValidEmail(
  value
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(
      value ||
      ""
    ).trim()
  );
}

function isValidPort(
  value
) {
  const number =
    Number(
      value
    );

  return (
    Number.isInteger(
      number
    ) &&
    number >= 1 &&
    number <= 65535
  );
}

function formatMetricValue(
  value
) {
  if (
    value ===
    "—"
  ) {
    return value;
  }

  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return String(
      value ||
      "0"
    );
  }

  return new Intl.NumberFormat().format(
    Math.round(
      number
    )
  );
}

function notify(
  type,
  title,
  message
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const bridge =
    window.reachflyToast;

  if (
    bridge &&
    typeof bridge[
      type
    ] ===
      "function"
  ) {
    bridge[
      type
    ](
      title,
      message
    );

    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      "reachfly:toast",
      {
        detail: {
          type,
          title,
          message,
        },
      }
    )
  );
}

/* ==========================================================================
 * Scoped Stitch V7 styling
 * ======================================================================= */

function EmailSetupStyles() {
  return (
    <style>{`
      .rf-email-v7{
        --rfe-bg:#f8f9fa;
        --rfe-card:#fff;
        --rfe-soft:#f3f4f5;
        --rfe-high:#e7e8e9;
        --rfe-highest:#e1e3e4;
        --rfe-text:#191c1d;
        --rfe-text-soft:#464554;
        --rfe-muted:#767586;
        --rfe-outline:#e3e5e7;
        --rfe-outline-strong:#c7c4d7;
        --rfe-primary:#4648d4;
        --rfe-primary-dark:#3537bb;
        --rfe-primary-soft:#e8e9ff;
        --rfe-violet:#6b38d4;
        --rfe-violet-soft:#f0eaff;
        --rfe-success:#087a51;
        --rfe-success-soft:#dcfce7;
        --rfe-warning:#8a6100;
        --rfe-warning-soft:#fff4d6;
        --rfe-danger:#ba1a1a;
        --rfe-danger-soft:#ffedeb;
        --rfe-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 42px;
        color:var(--rfe-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfePageIn 260ms var(--rfe-ease);
      }

      .rf-email-v7 *,
      .rf-email-v7 *::before,
      .rf-email-v7 *::after{
        box-sizing:border-box;
      }

      .rf-email-v7 a{
        color:inherit;
      }

      .rf-email-v7 .spin{
        animation:rfeSpin 800ms linear infinite;
      }

      @keyframes rfePageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfeFadeUp{
        from{opacity:0;transform:translate3d(0,7px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfeCardIn{
        from{opacity:0;transform:scale(.988)}
        to{opacity:1;transform:scale(1)}
      }

      @keyframes rfeSlideIn{
        from{opacity:0;transform:translate3d(-5px,0,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfeSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfeShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfe-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:22px;
      }

      .rfe-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfe-primary);
        font-size:9px;
        font-weight:750;
        line-height:13px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfe-page-header h1{
        margin:0;
        color:var(--rfe-text);
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfe-page-header p{
        max-width:670px;
        margin:3px 0 0;
        color:var(--rfe-text-soft);
        font-size:13px;
        line-height:19px;
      }

      .rfe-header-actions{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rfe-btn{
        appearance:none;
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:7px 12px;
        border:1px solid transparent;
        border-radius:8px;
        text-decoration:none;
        white-space:nowrap;
        cursor:pointer;
        font:600 10px/15px Inter,sans-serif;
        transition:
          color 140ms var(--rfe-ease),
          background 140ms var(--rfe-ease),
          border-color 140ms var(--rfe-ease),
          transform 140ms var(--rfe-ease),
          box-shadow 140ms var(--rfe-ease);
      }

      .rfe-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfe-btn:active:not(:disabled){
        transform:translateY(0) scale(.985);
      }

      .rfe-btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfe-btn-primary{
        color:#fff!important;
        background:var(--rfe-primary);
        border-color:var(--rfe-primary);
        box-shadow:0 5px 14px rgba(70,72,212,.17);
      }

      .rfe-btn-primary:hover:not(:disabled){
        background:var(--rfe-primary-dark);
        border-color:var(--rfe-primary-dark);
      }

      .rfe-btn-secondary{
        color:var(--rfe-text)!important;
        background:#fff;
        border-color:var(--rfe-outline);
      }

      .rfe-btn-secondary:hover:not(:disabled){
        color:var(--rfe-primary)!important;
        background:var(--rfe-primary-soft);
        border-color:rgba(70,72,212,.18);
      }

      .rfe-metrics{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
        margin-bottom:14px;
      }

      .rfe-metric{
        min-height:77px;
        display:flex;
        align-items:center;
        gap:11px;
        padding:14px 15px;
        background:#fff;
        border:1px solid var(--rfe-outline);
        border-radius:11px;
        animation:rfeCardIn 240ms var(--rfe-ease) both;
      }

      .rfe-metric:nth-child(2){
        animation-delay:40ms;
      }

      .rfe-metric:nth-child(3){
        animation-delay:80ms;
      }

      .rfe-metric > span{
        width:35px;
        height:35px;
        display:grid;
        place-items:center;
        flex:0 0 35px;
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
        border-radius:9px;
      }

      .rfe-metric.violet > span{
        color:var(--rfe-violet);
        background:var(--rfe-violet-soft);
      }

      .rfe-metric.success > span{
        color:var(--rfe-success);
        background:var(--rfe-success-soft);
      }

      .rfe-metric > div{
        min-width:0;
        display:grid;
        grid-template-columns:auto minmax(0,1fr);
        align-items:baseline;
        column-gap:7px;
      }

      .rfe-metric small{
        grid-column:1/-1;
        color:var(--rfe-muted);
        font-size:7px;
        font-weight:750;
        line-height:11px;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfe-metric strong{
        color:var(--rfe-text);
        font:600 20px/25px Geist,Inter,sans-serif;
      }

      .rfe-metric em{
        min-width:0;
        overflow:hidden;
        color:var(--rfe-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
        font-style:normal;
        line-height:11px;
      }

      .rfe-message{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        animation:rfeFadeUp 180ms var(--rfe-ease);
      }

      .rfe-message > span{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        flex:0 0 26px;
        background:rgba(255,255,255,.7);
        border-radius:7px;
      }

      .rfe-message > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfe-message strong{
        font-size:9px;
        line-height:13px;
      }

      .rfe-message small{
        font-size:8px;
        line-height:13px;
      }

      .rfe-message.error{
        color:#7d1717;
        background:var(--rfe-danger-soft);
        border-color:#ffd0cc;
      }

      .rfe-message.success{
        color:#075b3d;
        background:var(--rfe-success-soft);
        border-color:#b8efd6;
      }

      .rfe-workspace{
        display:grid;
        grid-template-columns:260px minmax(0,1fr) 270px;
        gap:16px;
        align-items:start;
      }

      .rfe-account-rail,
      .rfe-guide{
        position:sticky;
        top:80px;
      }

      .rfe-account-rail{
        min-width:0;
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfe-outline);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rfe-account-rail-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:10px;
        padding:16px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfe-outline);
      }

      .rfe-account-rail-head > div{
        min-width:0;
      }

      .rfe-account-rail-head h2{
        margin:0;
        color:var(--rfe-text);
        font:600 13px/18px Geist,Inter,sans-serif;
      }

      .rfe-account-rail-head p{
        margin:3px 0 0;
        color:var(--rfe-muted);
        font-size:7px;
        line-height:12px;
      }

      .rfe-account-rail-head > button{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        flex:0 0 31px;
        padding:0;
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
        border:0;
        border-radius:8px;
        cursor:pointer;
      }

      .rfe-account-rail-head > button:hover{
        background:#dddeff;
      }

      .rfe-account-list{
        max-height:520px;
        overflow:auto;
        padding:7px;
      }

      .rfe-account-card{
        width:100%;
        min-height:76px;
        display:flex;
        align-items:center;
        gap:9px;
        padding:10px 9px;
        color:inherit;
        background:transparent;
        border:1px solid transparent;
        border-radius:9px;
        text-align:left;
        cursor:pointer;
        animation:rfeSlideIn 220ms var(--rfe-ease) both;
        animation-delay:calc(var(--rfe-account-index) * 24ms);
        transition:
          background 140ms var(--rfe-ease),
          border-color 140ms var(--rfe-ease),
          box-shadow 140ms var(--rfe-ease);
      }

      .rfe-account-card + .rfe-account-card{
        margin-top:2px;
      }

      .rfe-account-card:hover{
        background:var(--rfe-soft);
      }

      .rfe-account-card.selected{
        background:#f1f1ff;
        border-color:rgba(70,72,212,.18);
        box-shadow:inset 3px 0 0 var(--rfe-primary);
      }

      .rfe-provider-logo{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        flex:0 0 36px;
        overflow:hidden;
        color:#fff;
        border:1px solid var(--rfe-outline);
        border-radius:9px;
        font-size:7px;
        font-weight:800;
      }

      .rfe-provider-logo img{
        width:22px;
        height:22px;
        object-fit:contain;
      }

      .rfe-provider-logo.gmail{
        background:#fff;
      }

      .rfe-provider-logo.outlook{
        background:#2478d4;
        border-color:#2478d4;
      }

      .rfe-provider-logo.custom{
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
        border-color:#d9daff;
      }

      .rfe-account-card-copy{
        min-width:0;
        flex:1;
        display:grid;
        gap:1px;
      }

      .rfe-account-card-copy strong,
      .rfe-account-card-copy small,
      .rfe-account-card-copy span{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfe-account-card-copy strong{
        color:var(--rfe-text);
        font-size:9px;
        line-height:13px;
      }

      .rfe-account-card-copy small{
        color:var(--rfe-text-soft);
        font-size:7px;
        line-height:11px;
      }

      .rfe-account-card-copy span{
        color:var(--rfe-primary);
        font-size:6px;
        font-weight:700;
        line-height:10px;
      }

      .rfe-account-card-status{
        display:flex;
        flex-direction:column;
        gap:5px;
        flex:0 0 auto;
      }

      .rfe-account-card-status i{
        width:7px;
        height:7px;
        display:block;
        border-radius:50%;
      }

      .rfe-account-card-status i.ready{
        background:#24a475;
        box-shadow:0 0 0 3px rgba(36,164,117,.11);
      }

      .rfe-account-card-status i.attention{
        background:#d29a28;
        box-shadow:0 0 0 3px rgba(210,154,40,.11);
      }

      .rfe-account-empty{
        min-height:240px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:20px 14px;
        text-align:center;
      }

      .rfe-account-empty > span{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
        border-radius:12px;
      }

      .rfe-account-empty strong{
        color:var(--rfe-text);
        font-size:9px;
        line-height:13px;
      }

      .rfe-account-empty p{
        margin:0;
        color:var(--rfe-muted);
        font-size:7px;
        line-height:12px;
      }

      .rfe-account-empty button{
        display:inline-flex;
        align-items:center;
        gap:5px;
        margin-top:5px;
        padding:6px 8px;
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
      }

      .rfe-account-rail-foot{
        display:flex;
        align-items:flex-start;
        gap:7px;
        padding:11px 12px;
        color:var(--rfe-muted);
        background:#fbfbfc;
        border-top:1px solid var(--rfe-outline);
      }

      .rfe-account-rail-foot > svg{
        flex:0 0 auto;
        margin-top:1px;
        color:var(--rfe-success);
      }

      .rfe-account-rail-foot p{
        margin:0;
        font-size:6px;
        line-height:11px;
      }

      .rfe-account-skeleton{
        display:grid;
        gap:3px;
      }

      .rfe-account-skeleton > div{
        min-height:72px;
        display:flex;
        gap:9px;
        padding:10px 9px;
      }

      .rfe-account-skeleton i{
        display:block;
        background:linear-gradient(90deg,#e9ebed 25%,#f8f9fa 45%,#e9ebed 65%);
        background-size:220% 100%;
        border-radius:999px;
        animation:rfeShimmer 1.25s linear infinite;
      }

      .rfe-account-skeleton > div > i{
        width:36px;
        height:36px;
        flex:0 0 36px;
        border-radius:9px;
      }

      .rfe-account-skeleton > div > span{
        flex:1;
        display:grid;
        align-content:start;
        gap:6px;
      }

      .rfe-account-skeleton > div > span i:nth-child(1){
        width:70%;
        height:8px;
      }

      .rfe-account-skeleton > div > span i:nth-child(2){
        width:90%;
        height:7px;
      }

      .rfe-account-skeleton > div > span i:nth-child(3){
        width:46%;
        height:6px;
      }

      .rfe-editor{
        min-width:0;
        display:grid;
        gap:12px;
      }

      .rfe-editor-head,
      .rfe-provider-section,
      .rfe-identity-card,
      .rfe-connection-card,
      .rfe-action-card{
        background:#fff;
        border:1px solid var(--rfe-outline);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.028);
      }

      .rfe-editor-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:18px;
        padding:18px 19px;
      }

      .rfe-editor-head h2{
        margin:0;
        color:var(--rfe-text);
        font:600 18px/24px Geist,Inter,sans-serif;
      }

      .rfe-editor-head p{
        max-width:650px;
        margin:3px 0 0;
        color:var(--rfe-text-soft);
        font-size:9px;
        line-height:14px;
      }

      .rfe-editor-head-actions{
        display:flex;
        align-items:center;
        gap:6px;
        flex:0 0 auto;
      }

      .rfe-active-pill,
      .rfe-saved-pill{
        min-height:28px;
        display:inline-flex;
        align-items:center;
        gap:4px;
        padding:5px 7px;
        border-radius:999px;
        font-size:7px;
        font-weight:700;
      }

      .rfe-active-pill{
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
      }

      .rfe-saved-pill{
        color:var(--rfe-text-soft);
        background:var(--rfe-soft);
      }

      .rfe-delete-btn{
        min-height:30px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:5px 7px;
        color:var(--rfe-danger);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
      }

      .rfe-delete-btn:hover:not(:disabled){
        background:var(--rfe-danger-soft);
      }

      .rfe-delete-btn:disabled{
        opacity:.45;
      }

      .rfe-provider-section,
      .rfe-identity-card,
      .rfe-action-card{
        padding:17px 18px;
      }

      .rfe-section-heading{
        margin-bottom:12px;
      }

      .rfe-section-heading > div{
        display:flex;
        align-items:flex-start;
        gap:8px;
      }

      .rfe-section-heading h3,
      .rfe-action-card h3{
        margin:0;
        color:var(--rfe-text);
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfe-section-heading p,
      .rfe-action-card > div:first-child > p{
        margin:2px 0 0;
        color:var(--rfe-muted);
        font-size:8px;
        line-height:13px;
      }

      .rfe-section-icon{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        flex:0 0 29px;
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
        border-radius:8px;
      }

      .rfe-provider-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .rfe-provider-card{
        position:relative;
        min-height:70px;
        display:flex;
        align-items:center;
        gap:9px;
        padding:10px;
        color:inherit;
        background:#fff;
        border:1px solid var(--rfe-outline);
        border-radius:9px;
        text-align:left;
        cursor:pointer;
        transition:
          border-color 140ms var(--rfe-ease),
          background 140ms var(--rfe-ease),
          transform 140ms var(--rfe-ease),
          box-shadow 140ms var(--rfe-ease);
      }

      .rfe-provider-card:hover{
        transform:translateY(-1px);
        border-color:var(--rfe-outline-strong);
      }

      .rfe-provider-card.active{
        background:#f3f3ff;
        border-color:rgba(70,72,212,.4);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rfe-provider-card > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:1px;
      }

      .rfe-provider-card strong{
        color:var(--rfe-text);
        font-size:9px;
        line-height:13px;
      }

      .rfe-provider-card small{
        color:var(--rfe-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfe-provider-check{
        width:19px;
        height:19px;
        display:grid;
        place-items:center;
        flex:0 0 19px;
        color:#fff;
        background:var(--rfe-primary);
        border-radius:50%;
      }

      .rfe-provider-card:not(.active) .rfe-provider-check{
        background:transparent;
        border:1px solid var(--rfe-outline);
      }

      .rfe-provider-note{
        display:flex;
        align-items:center;
        gap:9px;
        padding:9px 10px;
        margin-top:9px;
        background:var(--rfe-soft);
        border-radius:8px;
      }

      .rfe-provider-note > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:1px;
      }

      .rfe-provider-note strong{
        color:var(--rfe-text);
        font-size:8px;
        line-height:12px;
      }

      .rfe-provider-note p{
        margin:0;
        color:var(--rfe-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfe-provider-note > span:last-child{
        flex:0 0 auto;
        color:var(--rfe-primary);
        font-size:6px;
        font-weight:700;
      }

      .rfe-form-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }

      .rfe-form-grid.technical{
        padding-top:9px;
      }

      .rfe-field{
        min-width:0;
        display:grid;
        gap:5px;
      }

      .rfe-field > span,
      .rfe-toggle-field-label{
        color:var(--rfe-text-soft);
        font-size:7px;
        font-weight:700;
        line-height:11px;
        letter-spacing:.05em;
        text-transform:uppercase;
      }

      .rfe-field input{
        width:100%;
        height:38px;
        padding:0 10px;
        color:var(--rfe-text);
        background:#fff;
        border:1px solid var(--rfe-outline);
        border-radius:7px;
        outline:0;
        font:400 9px/14px Inter,sans-serif;
        transition:
          border-color 140ms var(--rfe-ease),
          box-shadow 140ms var(--rfe-ease),
          background 140ms var(--rfe-ease);
      }

      .rfe-field input::placeholder{
        color:#9a99a4;
      }

      .rfe-field input:focus{
        border-color:rgba(70,72,212,.48);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rfe-field.has-error input{
        border-color:rgba(186,26,26,.45);
        background:#fffafa;
      }

      .rfe-field > small{
        color:var(--rfe-danger);
        font-size:7px;
        line-height:11px;
      }

      .rfe-connection-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
      }

      .rfe-connection-card{
        min-width:0;
        overflow:hidden;
      }

      .rfe-connection-head{
        min-height:92px;
        display:grid;
        grid-template-columns:34px minmax(0,1fr) auto;
        gap:9px;
        align-items:flex-start;
        padding:14px 15px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfe-outline);
      }

      .rfe-connection-head > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
        border-radius:9px;
      }

      .rfe-connection-card.violet .rfe-connection-head > span{
        color:var(--rfe-violet);
        background:var(--rfe-violet-soft);
      }

      .rfe-connection-head > div{
        min-width:0;
      }

      .rfe-connection-head small{
        color:var(--rfe-primary);
        font-size:6px;
        font-weight:800;
        line-height:10px;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfe-connection-card.violet .rfe-connection-head small{
        color:var(--rfe-violet);
      }

      .rfe-connection-head h3{
        margin:0;
        color:var(--rfe-text);
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfe-connection-head p{
        margin:2px 0 0;
        color:var(--rfe-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfe-connection-head em{
        min-height:22px;
        display:inline-flex;
        align-items:center;
        padding:4px 7px;
        color:var(--rfe-text-soft);
        background:var(--rfe-high);
        border-radius:999px;
        font-size:6px;
        font-style:normal;
        font-weight:700;
        white-space:nowrap;
      }

      .rfe-connection-body{
        display:grid;
        gap:11px;
        padding:14px 15px 15px;
      }

      .rfe-toggle-field{
        display:grid;
        gap:5px;
      }

      .rfe-toggle-row{
        min-height:38px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:7px 8px;
        color:var(--rfe-text-soft);
        background:var(--rfe-soft);
        border-radius:7px;
        cursor:pointer;
        font-size:7px;
        line-height:11px;
      }

      .rfe-toggle-row > input{
        position:absolute;
        opacity:0;
        pointer-events:none;
      }

      .rfe-toggle{
        position:relative;
        width:30px;
        height:17px;
        flex:0 0 30px;
        background:#cfd1d4;
        border-radius:999px;
        transition:background 140ms var(--rfe-ease);
      }

      .rfe-toggle i{
        position:absolute;
        top:2px;
        left:2px;
        width:13px;
        height:13px;
        background:#fff;
        border-radius:50%;
        box-shadow:0 1px 2px rgba(25,28,29,.18);
        transition:transform 140ms var(--rfe-ease);
      }

      .rfe-toggle.on{
        background:var(--rfe-primary);
      }

      .rfe-toggle.on i{
        transform:translateX(13px);
      }

      .rfe-credential-note{
        min-height:38px;
        display:flex;
        align-items:center;
        gap:7px;
        padding:8px 9px;
        color:var(--rfe-text-soft);
        background:#f7f7fa;
        border:1px dashed var(--rfe-outline-strong);
        border-radius:7px;
        font-size:7px;
        line-height:11px;
      }

      .rfe-credential-note svg{
        flex:0 0 auto;
        color:var(--rfe-success);
      }

      .rfe-advanced{
        overflow:hidden;
        border:1px solid var(--rfe-outline);
        border-radius:8px;
      }

      .rfe-advanced-toggle{
        width:100%;
        min-height:35px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:7px 9px;
        color:var(--rfe-text-soft);
        background:#fbfbfc;
        border:0;
        cursor:pointer;
        text-align:left;
        font-size:7px;
        font-weight:700;
      }

      .rfe-advanced-toggle:hover{
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
      }

      .rfe-advanced-toggle svg{
        transition:transform 140ms var(--rfe-ease);
      }

      .rfe-advanced-toggle svg.open{
        transform:rotate(90deg);
      }

      .rfe-advanced-content{
        padding:0 9px 10px;
        border-top:1px solid var(--rfe-outline);
        animation:rfeFadeUp 150ms var(--rfe-ease);
      }

      .rfe-action-card{
        display:grid;
        gap:13px;
      }

      .rfe-action-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .rfe-action-button{
        min-width:0;
        min-height:72px;
        display:grid;
        grid-template-columns:31px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:10px;
        color:inherit;
        background:#fff;
        border:1px solid var(--rfe-outline);
        border-radius:9px;
        text-align:left;
        cursor:pointer;
        transition:
          background 140ms var(--rfe-ease),
          border-color 140ms var(--rfe-ease),
          transform 140ms var(--rfe-ease);
      }

      .rfe-action-button:hover:not(:disabled){
        transform:translateY(-1px);
        background:#fbfbff;
        border-color:rgba(70,72,212,.26);
      }

      .rfe-action-button:disabled{
        opacity:.5;
        cursor:not-allowed;
      }

      .rfe-action-button > span{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
        border-radius:8px;
      }

      .rfe-action-button > span.violet{
        color:var(--rfe-violet);
        background:var(--rfe-violet-soft);
      }

      .rfe-action-button > span.success{
        color:var(--rfe-success);
        background:var(--rfe-success-soft);
      }

      .rfe-action-button > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfe-action-button strong{
        color:var(--rfe-text);
        font-size:8px;
        line-height:12px;
      }

      .rfe-action-button small{
        color:var(--rfe-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfe-action-button > svg{
        color:var(--rfe-muted);
      }

      .rfe-save-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding-top:11px;
        border-top:1px solid var(--rfe-outline);
      }

      .rfe-save-row > span{
        color:var(--rfe-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfe-btn.save{
        min-width:140px;
      }

      .rfe-guide{
        display:grid;
        gap:10px;
      }

      .rfe-guide-card{
        padding:15px;
        background:#fff;
        border:1px solid var(--rfe-outline);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rfe-guide-title{
        display:flex;
        align-items:center;
        gap:9px;
        margin-bottom:9px;
      }

      .rfe-guide-title h2{
        margin:0;
        color:var(--rfe-text);
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfe-guide-card > p{
        margin:0 0 11px;
        color:var(--rfe-text-soft);
        font-size:8px;
        line-height:13px;
      }

      .rfe-guide-connection{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:8px;
        background:var(--rfe-soft);
        border-radius:8px;
      }

      .rfe-guide-connection + .rfe-guide-connection{
        margin-top:6px;
      }

      .rfe-guide-connection > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        flex:0 0 27px;
        color:var(--rfe-primary);
        background:#fff;
        border-radius:7px;
      }

      .rfe-guide-connection > span.violet{
        color:var(--rfe-violet);
      }

      .rfe-guide-connection > div{
        min-width:0;
        display:grid;
        gap:0;
      }

      .rfe-guide-connection small{
        color:var(--rfe-muted);
        font-size:6px;
        line-height:9px;
      }

      .rfe-guide-connection strong{
        overflow:hidden;
        color:var(--rfe-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
        line-height:11px;
      }

      .rfe-guide-connection em{
        color:var(--rfe-muted);
        font-size:6px;
        font-style:normal;
        line-height:10px;
      }

      .rfe-guide-heading{
        display:flex;
        align-items:center;
        gap:7px;
        margin-bottom:9px;
      }

      .rfe-guide-heading svg{
        color:var(--rfe-violet);
      }

      .rfe-guide-heading h3{
        margin:0;
        color:var(--rfe-text);
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rfe-guide-card ol{
        display:grid;
        gap:7px;
        margin:0;
        padding-left:18px;
        color:var(--rfe-text-soft);
        font-size:7px;
        line-height:12px;
      }

      .rfe-guide-link{
        min-height:32px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:7px;
        padding:6px 8px;
        margin-top:11px;
        color:var(--rfe-primary)!important;
        background:var(--rfe-primary-soft);
        border-radius:7px;
        text-decoration:none;
        font-size:7px;
        font-weight:700;
      }

      .rfe-security-list{
        display:grid;
        gap:7px;
      }

      .rfe-security-list > span{
        display:flex;
        align-items:flex-start;
        gap:6px;
        color:var(--rfe-text-soft);
        font-size:7px;
        line-height:11px;
      }

      .rfe-security-list svg{
        flex:0 0 auto;
        margin-top:1px;
        color:var(--rfe-success);
      }

      .rfe-related-links{
        display:grid;
        gap:4px;
      }

      .rfe-related-links a{
        min-height:34px;
        display:grid;
        grid-template-columns:20px minmax(0,1fr) auto;
        align-items:center;
        gap:6px;
        padding:6px 7px;
        color:var(--rfe-text-soft)!important;
        border-radius:7px;
        text-decoration:none;
        font-size:7px;
        font-weight:650;
      }

      .rfe-related-links a:hover{
        color:var(--rfe-primary)!important;
        background:var(--rfe-primary-soft);
      }

      .rfe-related-links svg:first-child{
        color:var(--rfe-primary);
      }

      @media(max-width:1280px){
        .rf-email-v7{
          padding:22px 22px 40px;
        }

        .rfe-workspace{
          grid-template-columns:235px minmax(0,1fr);
        }

        .rfe-guide{
          position:static;
          grid-column:1/-1;
          grid-template-columns:repeat(4,minmax(0,1fr));
        }

        .rfe-guide-card{
          min-width:0;
        }
      }

      @media(max-width:980px){
        .rfe-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfe-header-actions{
          width:100%;
          justify-content:flex-end;
        }

        .rfe-workspace{
          grid-template-columns:1fr;
        }

        .rfe-account-rail{
          position:static;
        }

        .rfe-account-list{
          max-height:none;
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:5px;
        }

        .rfe-account-card + .rfe-account-card{
          margin-top:0;
        }

        .rfe-account-rail-foot{
          display:none;
        }

        .rfe-guide{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:760px){
        .rf-email-v7{
          padding:18px 14px 84px;
        }

        .rfe-metrics{
          grid-template-columns:1fr;
          gap:7px;
        }

        .rfe-metric{
          min-height:64px;
          padding:10px 12px;
        }

        .rfe-provider-grid,
        .rfe-form-grid,
        .rfe-connection-grid,
        .rfe-action-grid{
          grid-template-columns:1fr;
        }

        .rfe-provider-note{
          align-items:flex-start;
        }

        .rfe-provider-note > span:last-child{
          display:none;
        }

        .rfe-editor-head{
          flex-direction:column;
        }

        .rfe-editor-head-actions{
          width:100%;
          justify-content:space-between;
        }

        .rfe-save-row{
          align-items:stretch;
          flex-direction:column;
        }

        .rfe-btn.save{
          width:100%;
        }
      }

      @media(max-width:560px){
        .rf-email-v7{
          padding:16px 11px 84px;
        }

        .rfe-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfe-page-header p{
          font-size:11px;
          line-height:17px;
        }

        .rfe-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .rfe-header-actions .rfe-btn-primary{
          grid-column:1/-1;
        }

        .rfe-account-list{
          grid-template-columns:1fr;
        }

        .rfe-guide{
          grid-template-columns:1fr;
        }

        .rfe-editor-head,
        .rfe-provider-section,
        .rfe-identity-card,
        .rfe-action-card{
          padding:14px;
        }

        .rfe-connection-head{
          grid-template-columns:32px minmax(0,1fr);
        }

        .rfe-connection-head > em{
          grid-column:2;
          justify-self:start;
        }

        .rfe-reply-actions{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-email-v7,
        .rfe-metric,
        .rfe-account-card,
        .rfe-message,
        .rfe-advanced-content,
        .rfe-account-skeleton i,
        .rf-email-v7 .spin{
          animation:none!important;
        }

        .rf-email-v7 *,
        .rf-email-v7 *::before,
        .rf-email-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
