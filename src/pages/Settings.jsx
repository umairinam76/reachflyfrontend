import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Globe2,
  KeyRound,
  Lock,
  Phone,
  RefreshCw,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Target,
  Users,
  X,
} from "../components/icons";

import {
  Link,
} from "react-router-dom";

import {
  api,
} from "../api";

import {
  apiRequest,
} from "../lib/workspace-platform-client.js";

import {
  useAuth,
} from "../auth/AuthContext";

const DEFAULTS = {
  workspaceName:
    "ReachFlyAI Growth Workspace",
  defaultRadiusKm:
    10,
  defaultLeadLimit:
    100,
  complianceMode:
    true,
  allowDemoFallback:
    true,
  brandTagline:
    "From territory to client inbox in 5 clicks",
};

const TABS = [
  {
    id:
      "general",
    label:
      "General",
    icon:
      SettingsIcon,
    description:
      "Workspace defaults and brand context",
  },
  {
    id:
      "calling",
    label:
      "Calling",
    icon:
      Phone,
    description:
      "AI Voice readiness and workspace calling",
  },
  {
    id:
      "security",
    label:
      "Security",
    icon:
      Shield,
    description:
      "Password, sessions, and access controls",
  },
];

export default function Settings() {
  const {
    user,
  } = useAuth();

  const mountedRef =
    useRef(true);

  const [
    activeTab,
    setActiveTab,
  ] = useState("general");

  const [
    form,
    setForm,
  ] = useState(
    DEFAULTS
  );

  const [
    savedForm,
    setSavedForm,
  ] = useState(
    DEFAULTS
  );

  const [
    calling,
    setCalling,
  ] = useState({
    dashboard:
      null,
    commerce:
      null,
  });

  const [
    sessions,
    setSessions,
  ] = useState([]);

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
    error,
    setError,
  ] = useState("");

  const [
    warning,
    setWarning,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    passwordForm,
    setPasswordForm,
  ] = useState({
    currentPassword:
      "",
    newPassword:
      "",
    confirmPassword:
      "",
  });

  const [
    savingPassword,
    setSavingPassword,
  ] = useState(false);

  const [
    terminatingSessionId,
    setTerminatingSessionId,
  ] = useState("");

  const [
    terminatingOthers,
    setTerminatingOthers,
  ] = useState(false);

  const role =
    normalizeRole(
      user?.workspaceRole ||
      user?.role
    );

  const canManageWorkspace =
    [
      "owner",
      "admin",
    ].includes(
      role
    ) ||
    String(
      user?.accountType ||
      ""
    )
      .trim()
      .toLowerCase() ===
      "individual";

  const load =
    useCallback(
      async ({
        background = false,
        successToast = false,
      } = {}) => {
        if (
          background
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        setError("");
        setWarning("");

        try {
          const [
            settingsResult,
            dashboardResult,
            commerceResult,
            sessionsResult,
          ] =
            await Promise.allSettled(
              [
                api.appSettings(),
                apiRequest(
                  "/telnyx/ai-agent/dashboard",
                  {
                    timeoutMs:
                      30_000,
                  }
                ),
                apiRequest(
                  "/voice-commerce",
                  {
                    timeoutMs:
                      20_000,
                  }
                ),
                apiRequest(
                  "/profile/sessions",
                  {
                    timeoutMs:
                      20_000,
                  }
                ),
              ]
            );

          if (
            !mountedRef.current
          ) {
            return;
          }

          if (
            settingsResult.status !==
            "fulfilled"
          ) {
            throw settingsResult.reason;
          }

          const nextSettings = {
            ...DEFAULTS,
            ...normalizeAppSettings(
              settingsResult.value
            ),
          };

          setForm(
            nextSettings
          );
          setSavedForm(
            nextSettings
          );

          setCalling({
            dashboard:
              dashboardResult.status ===
              "fulfilled"
                ? dashboardResult.value ||
                  {}
                : null,
            commerce:
              commerceResult.status ===
              "fulfilled"
                ? commerceResult.value ||
                  {}
                : null,
          });

          if (
            sessionsResult.status ===
            "fulfilled"
          ) {
            setSessions(
              normalizeSessions(
                sessionsResult.value
              )
            );
          } else {
            setSessions(
              []
            );
          }

          const unavailable = [];

          if (
            dashboardResult.status !==
            "fulfilled"
          ) {
            unavailable.push(
              "AI Voice status"
            );
          }

          if (
            commerceResult.status !==
            "fulfilled"
          ) {
            unavailable.push(
              "business-number status"
            );
          }

          if (
            sessionsResult.status !==
            "fulfilled"
          ) {
            unavailable.push(
              "active sessions"
            );
          }

          if (
            unavailable.length
          ) {
            setWarning(
              `${unavailable.join(
                ", "
              )} ${
                unavailable.length ===
                1
                  ? "is"
                  : "are"
              } temporarily unavailable. Workspace settings are still editable.`
            );
          } else {
            setWarning("");
          }

          setSuccess("");

          if (
            successToast
          ) {
            notify(
              "success",
              "Settings refreshed",
              "Latest workspace and security state is now visible."
            );
          }
        } catch (
          requestError
        ) {
          if (
            !mountedRef.current
          ) {
            return;
          }

          const text =
            safeMessage(
              requestError?.message ||
                "Workspace settings could not be loaded."
            );

          setError(
            text
          );

          if (
            successToast
          ) {
            notify(
              "error",
              "Settings refresh failed",
              text
            );
          }
        } finally {
          if (
            mountedRef.current
          ) {
            setLoading(
              false
            );
            setRefreshing(
              false
            );
          }
        }
      },
      []
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  useEffect(() => {
    if (
      !canManageWorkspace
    ) {
      return undefined;
    }

    void load();

    return undefined;
  }, [
    canManageWorkspace,
    load,
  ]);

  const dirty =
    useMemo(
      () =>
        JSON.stringify(
          normalizeComparableSettings(
            form
          )
        ) !==
        JSON.stringify(
          normalizeComparableSettings(
            savedForm
          )
        ),
      [
        form,
        savedForm,
      ]
    );

  const voiceAgents =
    useMemo(
      () =>
        normalizeCollection(
          calling.dashboard
            ?.agents
        ),
      [
        calling.dashboard,
      ]
    );

  const calls =
    useMemo(
      () =>
        normalizeCollection(
          calling.dashboard
            ?.calls
        ),
      [
        calling.dashboard,
      ]
    );

  const meetings =
    useMemo(
      () =>
        normalizeCollection(
          calling.dashboard
            ?.meetings
        ),
      [
        calling.dashboard,
      ]
    );

  const businessNumbers =
    useMemo(
      () =>
        normalizeCollection(
          calling.commerce
            ?.numbers
        ),
      [
        calling.commerce,
      ]
    );

  const activeNumbers =
    useMemo(
      () =>
        businessNumbers.filter(
          (
            number
          ) =>
            normalizeStatus(
              number.status
            ) ===
            "active"
        ),
      [
        businessNumbers,
      ]
    );

  const activeAgents =
    useMemo(
      () =>
        voiceAgents.filter(
          (
            agent
          ) =>
            agent.enabled !==
              false &&
            ![
              "disabled",
              "inactive",
              "archived",
            ].includes(
              normalizeStatus(
                agent.status
              )
            )
        ),
      [
        voiceAgents,
      ]
    );

  const upcomingMeetings =
    useMemo(
      () =>
        meetings.filter(
          (
            meeting
          ) => {
            const status =
              normalizeStatus(
                meeting.status
              );

            if (
              [
                "cancelled",
                "canceled",
                "completed",
              ].includes(
                status
              )
            ) {
              return false;
            }

            const start =
              timestamp(
                meeting.startAt
              );

            return (
              !start ||
              start >=
                Date.now()
            );
          }
        ),
      [
        meetings,
      ]
    );

  const currentSession =
    useMemo(
      () =>
        sessions.find(
          (
            session
          ) =>
            session.current ===
              true ||
            session.isCurrent ===
              true
        ) ||
        sessions[0] ||
        null,
      [
        sessions,
      ]
    );

  function setValue(
    key,
    value
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,
        [key]:
          value,
      })
    );

    setSuccess("");
  }

  function discardChanges() {
    setForm(
      savedForm
    );
    setSuccess("");

    notify(
      "info",
      "Changes discarded",
      "Workspace settings were restored to the last saved values."
    );
  }

  async function saveSettings() {
    const validation =
      validateSettings(
        form
      );

    if (
      validation
    ) {
      setError(
        validation
      );

      notify(
        "warning",
        "Check workspace settings",
        validation
      );

      return;
    }

    setSaving(
      true
    );
    setError("");
    setWarning("");
    setSuccess("");

    try {
      const payload = {
        workspaceName:
          String(
            form.workspaceName ||
            ""
          )
            .trim()
            .slice(
              0,
              120
            ),
        brandTagline:
          String(
            form.brandTagline ||
            ""
          )
            .trim()
            .slice(
              0,
              180
            ),
        defaultRadiusKm:
          clampNumber(
            form.defaultRadiusKm,
            1,
            500,
            10
          ),
        defaultLeadLimit:
          clampNumber(
            form.defaultLeadLimit,
            1,
            5000,
            100
          ),
        complianceMode:
          form.complianceMode !==
          false,
        allowDemoFallback:
          form.allowDemoFallback !==
          false,
      };

      const response =
        await api.saveAppSettings(
          payload
        );

      const saved = {
        ...DEFAULTS,
        ...payload,
        ...normalizeAppSettings(
          response
        ),
      };

      if (
        !mountedRef.current
      ) {
        return;
      }

      setForm(
        saved
      );
      setSavedForm(
        saved
      );
      setSuccess(
        "Workspace settings saved."
      );

      notify(
        "success",
        "Workspace settings saved",
        "Your workspace defaults and guardrails are now live."
      );
    } catch (
      requestError
    ) {
      const text =
        safeMessage(
          requestError?.message ||
            "Workspace settings could not be saved."
        );

      setError(
        text
      );

      notify(
        "error",
        "Save failed",
        text
      );
    } finally {
      if (
        mountedRef.current
      ) {
        setSaving(
          false
        );
      }
    }
  }

  async function changePassword(
    event
  ) {
    event.preventDefault();

    const currentPassword =
      passwordForm.currentPassword;
    const newPassword =
      passwordForm.newPassword;
    const confirmPassword =
      passwordForm.confirmPassword;

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      const text =
        "Complete all password fields.";

      setError(
        text
      );
      notify(
        "warning",
        "Password fields required",
        text
      );
      return;
    }

    if (
      newPassword.length <
      10
    ) {
      const text =
        "The new password must contain at least 10 characters.";

      setError(
        text
      );
      notify(
        "warning",
        "Use a stronger password",
        text
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      const text =
        "The new password confirmation does not match.";

      setError(
        text
      );
      notify(
        "warning",
        "Passwords do not match",
        text
      );
      return;
    }

    setSavingPassword(
      true
    );
    setError("");
    setSuccess("");

    try {
      await apiRequest(
        "/profile/password",
        {
          method:
            "PUT",
          body: {
            currentPassword,
            newPassword,
          },
          timeoutMs:
            20_000,
        }
      );

      setPasswordForm({
        currentPassword:
          "",
        newPassword:
          "",
        confirmPassword:
          "",
      });

      setSuccess(
        "Your password was changed successfully."
      );

      notify(
        "success",
        "Password updated",
        "Your account password has been changed."
      );
    } catch (
      requestError
    ) {
      const text =
        safeMessage(
          requestError?.message ||
            "Your password could not be changed."
        );

      setError(
        text
      );

      notify(
        "error",
        "Password update failed",
        text
      );
    } finally {
      setSavingPassword(
        false
      );
    }
  }

  async function terminateSession(
    session
  ) {
    const sessionId =
      session?.id ||
      session?.sessionId ||
      "";

    if (
      !sessionId ||
      session.current ||
      session.isCurrent
    ) {
      return;
    }

    setTerminatingSessionId(
      String(
        sessionId
      )
    );
    setError("");

    try {
      await apiRequest(
        `/profile/sessions/${encodeURIComponent(
          sessionId
        )}`,
        {
          method:
            "DELETE",
          timeoutMs:
            20_000,
        }
      );

      setSessions(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              String(
                item.id ||
                item.sessionId
              ) !==
              String(
                sessionId
              )
          )
      );

      notify(
        "success",
        "Session signed out",
        "The selected device session has been terminated."
      );
    } catch (
      requestError
    ) {
      const text =
        safeMessage(
          requestError?.message ||
            "The selected session could not be terminated."
        );

      setError(
        text
      );
      notify(
        "error",
        "Session sign-out failed",
        text
      );
    } finally {
      setTerminatingSessionId(
        ""
      );
    }
  }

  async function terminateOtherSessions() {
    setTerminatingOthers(
      true
    );
    setError("");

    try {
      await apiRequest(
        "/profile/sessions/others",
        {
          method:
            "DELETE",
          timeoutMs:
            20_000,
        }
      );

      setSessions(
        (
          current
        ) =>
          current.filter(
            (
              session
            ) =>
              session.current ===
                true ||
              session.isCurrent ===
                true
          )
      );

      notify(
        "success",
        "Other sessions signed out",
        "All other account sessions have been terminated."
      );
    } catch (
      requestError
    ) {
      const text =
        safeMessage(
          requestError?.message ||
            "Other sessions could not be terminated."
        );

      setError(
        text
      );

      notify(
        "error",
        "Session sign-out failed",
        text
      );
    } finally {
      setTerminatingOthers(
        false
      );
    }
  }

  if (
    loading
  ) {
    return (
      <>
        <SettingsStyles />
        <SettingsSkeleton />
      </>
    );
  }

  if (
    !canManageWorkspace
  ) {
    return (
      <>
        <SettingsStyles />

        <main className="rf-settings-v7">
          <AccessDenied />
        </main>
      </>
    );
  }

  return (
    <>
      <SettingsStyles />

      <main className="rf-settings-v7">
        <header className="rfs-page-header">
          <div>
            <span className="rfs-eyebrow">
              Workspace
            </span>

            <h1>
              Settings
            </h1>

            <p>
              Manage workspace defaults, AI Voice readiness, and the security of
              your ReachFly account.
            </p>
          </div>

          <div className="rfs-header-actions">
            <button
              type="button"
              className="rfs-btn secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void load({
                  background:
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

            {dirty ? (
              <>
                <button
                  type="button"
                  className="rfs-btn secondary"
                  onClick={
                    discardChanges
                  }
                >
                  Discard
                </button>

                <button
                  type="button"
                  className="rfs-btn primary"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void saveSettings()
                  }
                >
                  {saving ? (
                    <RefreshCw
                      size={13}
                      className="spin"
                    />
                  ) : (
                    <Check size={13} />
                  )}

                  {saving
                    ? "Saving…"
                    : "Save Changes"}
                </button>
              </>
            ) : null}
          </div>
        </header>

        {error ? (
          <Notice
            tone="error"
            title="Settings need attention"
          >
            {error}
          </Notice>
        ) : null}

        {warning ? (
          <Notice
            tone="warning"
            title="Some live status is unavailable"
          >
            {warning}
          </Notice>
        ) : null}

        {success ? (
          <Notice
            tone="success"
            title="Update complete"
          >
            {success}
          </Notice>
        ) : null}

        <section className="rfs-layout">
          <aside className="rfs-nav-column">
            <div className="rfs-nav-card">
              <header>
                <span className="rfs-eyebrow">
                  Workspace Settings
                </span>

                <strong>
                  Configuration
                </strong>
              </header>

              <nav>
                {TABS.map(
                  (
                    item
                  ) => {
                    const Icon =
                      item.icon;

                    return (
                      <button
                        type="button"
                        key={
                          item.id
                        }
                        className={
                          activeTab ===
                          item.id
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setActiveTab(
                            item.id
                          )
                        }
                      >
                        <span>
                          <Icon size={15} />
                        </span>

                        <div>
                          <strong>
                            {item.label}
                          </strong>

                          <small>
                            {item.description}
                          </small>
                        </div>

                        <ChevronRight size={12} />
                      </button>
                    );
                  }
                )}
              </nav>
            </div>

            <WorkspacePreview
              form={
                form
              }
              user={
                user
              }
            />
          </aside>

          <section className="rfs-content">
            {activeTab ===
            "general" ? (
              <GeneralSettings
                form={
                  form
                }
                dirty={
                  dirty
                }
                saving={
                  saving
                }
                onChange={
                  setValue
                }
                onSave={() =>
                  void saveSettings()
                }
                onDiscard={
                  discardChanges
                }
              />
            ) : activeTab ===
              "calling" ? (
              <CallingSettings
                activeAgents={
                  activeAgents
                }
                activeNumbers={
                  activeNumbers
                }
                calls={
                  calls
                }
                upcomingMeetings={
                  upcomingMeetings
                }
                complianceMode={
                  form.complianceMode
                }
                dashboardAvailable={
                  calling.dashboard !==
                  null
                }
                commerceAvailable={
                  calling.commerce !==
                  null
                }
              />
            ) : (
              <SecuritySettings
                user={
                  user
                }
                currentSession={
                  currentSession
                }
                sessions={
                  sessions
                }
                passwordForm={
                  passwordForm
                }
                savingPassword={
                  savingPassword
                }
                terminatingSessionId={
                  terminatingSessionId
                }
                terminatingOthers={
                  terminatingOthers
                }
                onPasswordChange={(
                  key,
                  value
                ) =>
                  setPasswordForm(
                    (
                      current
                    ) => ({
                      ...current,
                      [key]:
                        value,
                    })
                  )
                }
                onPasswordSubmit={
                  changePassword
                }
                onTerminateSession={(
                  session
                ) =>
                  void terminateSession(
                    session
                  )
                }
                onTerminateOthers={() =>
                  void terminateOtherSessions()
                }
              />
            )}
          </section>
        </section>
      </main>
    </>
  );
}

function GeneralSettings({
  form,
  dirty,
  saving,
  onChange,
  onSave,
  onDiscard,
}) {
  return (
    <div className="rfs-section-stack">
      <SectionTitle
        eyebrow="General"
        title="Workspace basics"
        text="Configure the settings ReachFly uses as defaults when your team creates new lead and outreach workflows."
      />

      <section className="rfs-card">
        <CardHeader
          icon={
            <Building2 size={17} />
          }
          title="Workspace Details"
          text="These values identify your workspace and provide customer-facing brand context."
        />

        <div className="rfs-card-body rfs-form-grid">
          <Field
            label="Workspace Name"
            required
            value={
              form.workspaceName
            }
            onChange={(
              value
            ) =>
              onChange(
                "workspaceName",
                value
              )
            }
            maxLength={
              120
            }
            placeholder="ReachFlyAi Growth Workspace"
            icon={
              <Building2 size={13} />
            }
          />

          <Field
            label="Brand Tagline"
            value={
              form.brandTagline
            }
            onChange={(
              value
            ) =>
              onChange(
                "brandTagline",
                value
              )
            }
            maxLength={
              180
            }
            placeholder="Describe your workspace in one line"
            icon={
              <Sparkles size={13} />
            }
          />
        </div>
      </section>

      <section className="rfs-card">
        <CardHeader
          icon={
            <Globe2 size={17} />
          }
          title="Lead Discovery Defaults"
          text="Used as starting values when new searches are created. Individual searches can still override them."
        />

        <div className="rfs-card-body rfs-form-grid two">
          <NumberField
            label="Default Radius"
            value={
              form.defaultRadiusKm
            }
            onChange={(
              value
            ) =>
              onChange(
                "defaultRadiusKm",
                value
              )
            }
            min={
              1
            }
            max={
              500
            }
            suffix="km"
            hint="Recommended starting search radius."
          />

          <NumberField
            label="Default Lead Limit"
            value={
              form.defaultLeadLimit
            }
            onChange={(
              value
            ) =>
              onChange(
                "defaultLeadLimit",
                value
              )
            }
            min={
              1
            }
            max={
              5000
            }
            suffix="leads"
            hint="Starting result limit for new lead searches."
          />
        </div>
      </section>

      <section className="rfs-card">
        <CardHeader
          icon={
            <Shield size={17} />
          }
          title="Workspace Guardrails"
          text="Control the real guardrail switches exposed by the current ReachFly workspace settings API."
        />

        <div className="rfs-card-body rfs-switch-list">
          <SwitchRow
            icon={
              <Shield size={15} />
            }
            title="Compliance guardrails"
            text="Keep outreach workflows operating with the workspace's compliance protections enabled."
            checked={
              form.complianceMode !==
              false
            }
            onChange={(
              value
            ) =>
              onChange(
                "complianceMode",
                value
              )
            }
            recommended
          />

          <SwitchRow
            icon={
              <Target size={15} />
            }
            title="Public search fallback"
            text="Allow the workspace to use its configured fallback behavior when public lead-search adapters are unavailable."
            checked={
              form.allowDemoFallback !==
              false
            }
            onChange={(
              value
            ) =>
              onChange(
                "allowDemoFallback",
                value
              )
            }
          />
        </div>
      </section>

      <section className="rfs-save-card">
        <div>
          <strong>
            {dirty
              ? "You have unsaved workspace changes."
              : "Workspace settings are up to date."}
          </strong>

          <small>
            Save only writes fields supported by the current workspace settings
            endpoint.
          </small>
        </div>

        <div>
          {dirty ? (
            <button
              type="button"
              className="rfs-btn secondary"
              onClick={
                onDiscard
              }
            >
              Discard
            </button>
          ) : null}

          <button
            type="button"
            className="rfs-btn primary"
            disabled={
              !dirty ||
              saving
            }
            onClick={
              onSave
            }
          >
            {saving ? (
              <RefreshCw
                size={13}
                className="spin"
              />
            ) : (
              <Check size={13} />
            )}

            {saving
              ? "Saving…"
              : "Save Workspace Settings"}
          </button>
        </div>
      </section>
    </div>
  );
}

function CallingSettings({
  activeAgents,
  activeNumbers,
  calls,
  upcomingMeetings,
  complianceMode,
  dashboardAvailable,
  commerceAvailable,
}) {
  return (
    <div className="rfs-section-stack">
      <SectionTitle
        eyebrow="Calling"
        title="AI Voice readiness"
        text="Review the live components that make up your workspace calling setup. Calling behavior is configured in the dedicated Voice Agent workflows."
      />

      <section className="rfs-calling-metrics">
        <CallingMetric
          icon={
            <Bot size={17} />
          }
          label="Active Voice Agents"
          value={
            dashboardAvailable
              ? activeAgents.length
              : "—"
          }
          note={
            dashboardAvailable
              ? "Configured in AI Voice"
              : "Status unavailable"
          }
          to="/app/voice-agents"
        />

        <CallingMetric
          icon={
            <Phone size={17} />
          }
          label="Active Numbers"
          value={
            commerceAvailable
              ? activeNumbers.length
              : "—"
          }
          note={
            commerceAvailable
              ? "Ready for calling"
              : "Status unavailable"
          }
          to="/app/phone-numbers"
        />

        <CallingMetric
          icon={
            <Clock3 size={17} />
          }
          label="Recent Calls"
          value={
            dashboardAvailable
              ? calls.length
              : "—"
          }
          note="Visible call history"
          to="/app/calls"
        />

        <CallingMetric
          icon={
            <Calendar size={17} />
          }
          label="Upcoming Meetings"
          value={
            dashboardAvailable
              ? upcomingMeetings.length
              : "—"
          }
          note="AI Voice booking activity"
          to="/app/meetings"
        />
      </section>

      <section className="rfs-card">
        <CardHeader
          icon={
            <Phone size={17} />
          }
          title="Calling Configuration"
          text="ReachFly keeps calling configuration close to the workflow that owns it instead of duplicating settings here."
        />

        <div className="rfs-card-body rfs-routing-list">
          <RouteCard
            icon={
              <Bot size={16} />
            }
            title="Voice Agent behavior"
            text="Voice, prompts, conversation behavior, calendar booking, and agent-specific calling options."
            status={
              activeAgents.length
                ? `${activeAgents.length} active`
                : "Configure"
            }
            statusTone={
              activeAgents.length
                ? "success"
                : "neutral"
            }
            to="/app/voice-agents"
          />

          <RouteCard
            icon={
              <Phone size={16} />
            }
            title="Business Numbers"
            text="Buy or connect the business numbers used by AI Voice."
            status={
              activeNumbers.length
                ? `${activeNumbers.length} active`
                : "Add number"
            }
            statusTone={
              activeNumbers.length
                ? "success"
                : "warning"
            }
            to="/app/phone-numbers"
          />

          <RouteCard
            icon={
              <Calendar size={16} />
            }
            title="Meeting booking"
            text="Review appointments created through your Voice Agent and connected calendar workflows."
            status="Open"
            statusTone="neutral"
            to="/app/meetings"
          />

          <RouteCard
            icon={
              <Clock3 size={16} />
            }
            title="Call history & intelligence"
            text="Review live call status, outcomes, recordings, and available call intelligence."
            status="Open"
            statusTone="neutral"
            to="/app/calls"
          />
        </div>
      </section>

      <section className="rfs-card">
        <CardHeader
          icon={
            <Shield size={17} />
          }
          title="Calling Guardrails"
          text="Workspace compliance mode is a real persisted setting. More detailed Voice Agent controls remain in the AI Voice workspace."
        />

        <div className="rfs-card-body">
          <div className="rfs-guardrail-banner">
            <span
              className={
                complianceMode
                  ? "ready"
                  : "attention"
              }
            >
              {complianceMode ? (
                <CheckCircle2 size={15} />
              ) : (
                <Shield size={15} />
              )}
            </span>

            <div>
              <strong>
                Compliance guardrails are{" "}
                {complianceMode
                  ? "enabled"
                  : "disabled"}
              </strong>

              <p>
                Change this real workspace setting from the General tab. Agent
                prompts, schedules, and campaign-level behavior are managed in
                the Voice Agent and campaign workflows.
              </p>
            </div>

            <Link
              className="rfs-inline-link"
              to="/app/voice-agents"
            >
              Open Voice Agents

              <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      <section className="rfs-info-card">
        <Sparkles size={15} />

        <div>
          <strong>
            Why are schedule, throttle, and recording toggles not duplicated
            here?
          </strong>

          <p>
            The current ReachFly workspace-settings API does not expose global
            persistence for those controls. This page therefore links to the
            real AI Voice workflows instead of displaying switches that would
            only look saved.
          </p>
        </div>
      </section>
    </div>
  );
}

function SecuritySettings({
  user,
  currentSession,
  sessions,
  passwordForm,
  savingPassword,
  terminatingSessionId,
  terminatingOthers,
  onPasswordChange,
  onPasswordSubmit,
  onTerminateSession,
  onTerminateOthers,
}) {
  const otherSessions =
    sessions.filter(
      (
        session
      ) =>
        !(
          session.current ===
            true ||
          session.isCurrent ===
            true
        )
    );

  return (
    <div className="rfs-section-stack">
      <SectionTitle
        eyebrow="Security"
        title="Security & access"
        text="Update your password, review active sessions, and manage the people who can access your workspace."
      />

      <section className="rfs-security-layout">
        <div className="rfs-security-main">
          <section className="rfs-card">
            <CardHeader
              icon={
                <KeyRound size={17} />
              }
              title="Authentication"
              text="Change the password for your current ReachFly account."
            />

            <form
              className="rfs-card-body rfs-password-form"
              onSubmit={
                onPasswordSubmit
              }
            >
              <PasswordField
                label="Current Password"
                value={
                  passwordForm.currentPassword
                }
                onChange={(
                  value
                ) =>
                  onPasswordChange(
                    "currentPassword",
                    value
                  )
                }
                autoComplete="current-password"
              />

              <div className="rfs-password-grid">
                <PasswordField
                  label="New Password"
                  value={
                    passwordForm.newPassword
                  }
                  onChange={(
                    value
                  ) =>
                    onPasswordChange(
                      "newPassword",
                      value
                    )
                  }
                  autoComplete="new-password"
                />

                <PasswordField
                  label="Confirm New Password"
                  value={
                    passwordForm.confirmPassword
                  }
                  onChange={(
                    value
                  ) =>
                    onPasswordChange(
                      "confirmPassword",
                      value
                    )
                  }
                  autoComplete="new-password"
                />
              </div>

              <div className="rfs-password-note">
                <Shield size={13} />

                <p>
                  Use a unique password with at least 10 characters. ReachFly
                  verifies your current password before accepting a replacement.
                </p>
              </div>

              <div className="rfs-form-actions">
                <button
                  type="submit"
                  className="rfs-btn primary"
                  disabled={
                    savingPassword
                  }
                >
                  {savingPassword ? (
                    <RefreshCw
                      size={13}
                      className="spin"
                    />
                  ) : (
                    <Lock size={13} />
                  )}

                  {savingPassword
                    ? "Updating…"
                    : "Update Password"}
                </button>
              </div>
            </form>
          </section>

          <section className="rfs-card">
            <CardHeader
              icon={
                <Lock size={17} />
              }
              title="Active Sessions"
              text="Devices currently authenticated with your account."
              action={
                otherSessions.length ? (
                  <button
                    type="button"
                    className="rfs-text-danger"
                    disabled={
                      terminatingOthers
                    }
                    onClick={
                      onTerminateOthers
                    }
                  >
                    {terminatingOthers ? (
                      <RefreshCw
                        size={12}
                        className="spin"
                      />
                    ) : (
                      <X size={12} />
                    )}

                    Sign out others
                  </button>
                ) : null
              }
            />

            <div className="rfs-session-list">
              {sessions.length ? (
                sessions.map(
                  (
                    session,
                    index
                  ) => (
                    <SessionRow
                      key={
                        session.id ||
                        session.sessionId ||
                        index
                      }
                      session={
                        session
                      }
                      current={
                        session.current ===
                          true ||
                        session.isCurrent ===
                          true ||
                        (
                          !sessions.some(
                            (
                              item
                            ) =>
                              item.current ===
                                true ||
                              item.isCurrent ===
                                true
                          ) &&
                          index ===
                            0
                        )
                      }
                      terminating={
                        String(
                          terminatingSessionId
                        ) ===
                        String(
                          session.id ||
                          session.sessionId ||
                          ""
                        )
                      }
                      onTerminate={() =>
                        onTerminateSession(
                          session
                        )
                      }
                    />
                  )
                )
              ) : (
                <div className="rfs-session-empty">
                  Active-session details are not available from the current
                  profile response.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="rfs-security-side">
          <section className="rfs-side-card">
            <header>
              <span>
                <Shield size={15} />
              </span>

              <div>
                <small>
                  Workspace Access
                </small>

                <strong>
                  Role-based access
                </strong>
              </div>
            </header>

            <div className="rfs-side-body">
              <p>
                Workspace owners and administrators control membership and role
                assignments from the Team screen.
              </p>

              <div className="rfs-access-summary">
                <span>
                  <Users size={13} />
                </span>

                <div>
                  <small>
                    Your current role
                  </small>

                  <strong>
                    {formatRole(
                      user?.workspaceRole ||
                      user?.role
                    )}
                  </strong>
                </div>
              </div>

              <Link
                className="rfs-side-link"
                to="/app/team"
              >
                Manage Team Access

                <ChevronRight size={12} />
              </Link>
            </div>
          </section>

          <section className="rfs-side-card">
            <header>
              <span className="violet">
                <KeyRound size={15} />
              </span>

              <div>
                <small>
                  Two-factor authentication
                </small>

                <strong>
                  API capability required
                </strong>
              </div>
            </header>

            <div className="rfs-side-body">
              <p>
                The current ReachFly profile API does not expose a two-factor
                enrollment endpoint. No fake 2FA toggle is shown here.
              </p>

              <span className="rfs-unavailable-badge">
                Not available in current API
              </span>
            </div>
          </section>

          <section className="rfs-side-card">
            <header>
              <span className="green">
                <CheckCircle2 size={15} />
              </span>

              <div>
                <small>
                  Current Session
                </small>

                <strong>
                  {currentSession
                    ? "Session detected"
                    : "Session details unavailable"}
                </strong>
              </div>
            </header>

            <div className="rfs-side-body">
              {currentSession ? (
                <dl className="rfs-mini-dl">
                  <InfoRow
                    label="Device"
                    value={
                      sessionDeviceLabel(
                        currentSession
                      )
                    }
                  />

                  <InfoRow
                    label="Location"
                    value={
                      sessionLocationLabel(
                        currentSession
                      )
                    }
                  />

                  <InfoRow
                    label="Last active"
                    value={
                      formatRelativeTime(
                        currentSession.lastActiveAt ||
                        currentSession.updatedAt ||
                        currentSession.createdAt
                      )
                    }
                  />
                </dl>
              ) : (
                <p>
                  Session metadata is managed by your profile-security endpoint.
                </p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function WorkspacePreview({
  form,
  user,
}) {
  return (
    <section className="rfs-preview-card">
      <div className="rfs-preview-art">
        <span>
          <Sparkles size={17} />
        </span>

        <i />
        <i />
        <i />
      </div>

      <div className="rfs-preview-copy">
        <small>
          Workspace Preview
        </small>

        <strong>
          {form.workspaceName ||
            "ReachFly Workspace"}
        </strong>

        <p>
          {form.brandTagline ||
            "Your ReachFly workspace"}
        </p>

        <span>
          <Shield size={11} />

          {formatRole(
            user?.workspaceRole ||
            user?.role
          )}
        </span>
      </div>
    </section>
  );
}

function SectionTitle({
  eyebrow,
  title,
  text,
}) {
  return (
    <header className="rfs-section-title">
      <span className="rfs-eyebrow">
        {eyebrow}
      </span>

      <h2>
        {title}
      </h2>

      <p>
        {text}
      </p>
    </header>
  );
}

function CardHeader({
  icon,
  title,
  text,
  action,
}) {
  return (
    <header className="rfs-card-head">
      <span>
        {icon}
      </span>

      <div>
        <h3>
          {title}
        </h3>

        <p>
          {text}
        </p>
      </div>

      {action ? (
        <div className="rfs-card-action">
          {action}
        </div>
      ) : null}
    </header>
  );
}

function Field({
  label,
  required = false,
  value,
  onChange,
  placeholder,
  maxLength,
  icon,
}) {
  return (
    <label className="rfs-field">
      <span>
        {label}

        {required ? (
          <em>
            *
          </em>
        ) : null}
      </span>

      <div>
        {icon ? (
          <i>
            {icon}
          </i>
        ) : null}

        <input
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
          maxLength={
            maxLength
          }
        />
      </div>

      {maxLength ? (
        <small>
          {String(
            value ||
            ""
          ).length}
          /
          {maxLength}
        </small>
      ) : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  hint,
}) {
  return (
    <label className="rfs-field">
      <span>
        {label}
      </span>

      <div className="number">
        <input
          type="number"
          min={
            min
          }
          max={
            max
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
                .value ===
                ""
                ? ""
                : Number(
                    event.target
                      .value
                  )
            )
          }
        />

        <b>
          {suffix}
        </b>
      </div>

      <small className="hint">
        {hint}
      </small>
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}) {
  return (
    <label className="rfs-field">
      <span>
        {label}
      </span>

      <div>
        <Lock size={13} />

        <input
          type="password"
          value={
            value
          }
          onChange={(
            event
          ) =>
            onChange(
              event.target
                .value
            )
          }
          autoComplete={
            autoComplete
          }
        />
      </div>
    </label>
  );
}

function SwitchRow({
  icon,
  title,
  text,
  checked,
  onChange,
  recommended = false,
}) {
  return (
    <article className="rfs-switch-row">
      <span>
        {icon}
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <p>
          {text}
        </p>

        {recommended ? (
          <em>
            Recommended
          </em>
        ) : null}
      </div>

      <button
        type="button"
        className={
          checked
            ? "on"
            : ""
        }
        aria-pressed={
          checked
        }
        onClick={() =>
          onChange(
            !checked
          )
        }
      >
        <i />
      </button>
    </article>
  );
}

function CallingMetric({
  icon,
  label,
  value,
  note,
  to,
}) {
  return (
    <Link
      className="rfs-calling-metric"
      to={
        to
      }
    >
      <header>
        <span>
          {icon}
        </span>

        <ChevronRight size={12} />
      </header>

      <strong>
        {value}
      </strong>

      <small>
        {label}
      </small>

      <p>
        {note}
      </p>
    </Link>
  );
}

function RouteCard({
  icon,
  title,
  text,
  status,
  statusTone,
  to,
}) {
  return (
    <Link
      className="rfs-route-card"
      to={
        to
      }
    >
      <span>
        {icon}
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <p>
          {text}
        </p>
      </div>

      <em
        className={
          statusTone
        }
      >
        {status}
      </em>

      <ChevronRight size={12} />
    </Link>
  );
}

function SessionRow({
  session,
  current,
  terminating,
  onTerminate,
}) {
  return (
    <article className="rfs-session-row">
      <span>
        <Globe2 size={15} />
      </span>

      <div>
        <strong>
          {sessionDeviceLabel(
            session
          )}
        </strong>

        <p>
          {[
            sessionIpLabel(
              session
            ),
            sessionLocationLabel(
              session
            ),
            formatRelativeTime(
              session.lastActiveAt ||
              session.updatedAt ||
              session.createdAt
            ),
          ]
            .filter(
              Boolean
            )
            .join(
              " • "
            )}
        </p>
      </div>

      {current ? (
        <em>
          Current session
        </em>
      ) : (
        <button
          type="button"
          disabled={
            terminating
          }
          onClick={
            onTerminate
          }
        >
          {terminating ? (
            <RefreshCw
              size={11}
              className="spin"
            />
          ) : (
            <X size={11} />
          )}

          Sign out
        </button>
      )}
    </article>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <div>
      <dt>
        {label}
      </dt>

      <dd>
        {value}
      </dd>
    </div>
  );
}

function Notice({
  tone,
  title,
  children,
}) {
  return (
    <section
      className={`rfs-notice ${tone}`}
      role={
        tone ===
        "error"
          ? "alert"
          : "status"
      }
    >
      <span>
        {tone ===
        "error" ? (
          <X size={14} />
        ) : tone ===
          "success" ? (
          <CheckCircle2 size={14} />
        ) : (
          <Shield size={14} />
        )}
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <small>
          {children}
        </small>
      </div>
    </section>
  );
}

function AccessDenied() {
  return (
    <section className="rfs-access-denied">
      <span>
        <Shield size={25} />
      </span>

      <h1>
        Workspace settings are restricted
      </h1>

      <p>
        Only workspace owners and administrators can manage these settings.
      </p>
    </section>
  );
}

function SettingsSkeleton() {
  return (
    <main
      className="rf-settings-v7"
      aria-busy="true"
      aria-label="Loading workspace settings"
    >
      <header className="rfs-page-header">
        <div>
          <span className="rfs-eyebrow">
            Workspace
          </span>

          <h1>
            Settings
          </h1>

          <p>
            Loading workspace settings…
          </p>
        </div>
      </header>

      <section className="rfs-layout">
        <aside className="rfs-nav-column">
          <div className="rfs-nav-card skeleton">
            <i />
            <i />
            <i />
            <i />
          </div>
        </aside>

        <section className="rfs-content">
          <div className="rfs-section-skeleton">
            <i />
            <i />
            <i />
          </div>
        </section>
      </section>
    </main>
  );
}

/* ==========================================================================
 * Data helpers
 * ======================================================================= */

function normalizeAppSettings(
  value
) {
  const source =
    value &&
    typeof value ===
      "object"
      ? value
      : {};

  return {
    workspaceName:
      source.workspaceName ??
      DEFAULTS.workspaceName,
    brandTagline:
      source.brandTagline ??
      DEFAULTS.brandTagline,
    defaultRadiusKm:
      Number.isFinite(
        Number(
          source.defaultRadiusKm
        )
      )
        ? Number(
            source.defaultRadiusKm
          )
        : DEFAULTS.defaultRadiusKm,
    defaultLeadLimit:
      Number.isFinite(
        Number(
          source.defaultLeadLimit
        )
      )
        ? Number(
            source.defaultLeadLimit
          )
        : DEFAULTS.defaultLeadLimit,
    complianceMode:
      source.complianceMode !==
      false,
    allowDemoFallback:
      source.allowDemoFallback !==
      false,
  };
}

function normalizeComparableSettings(
  value
) {
  return {
    workspaceName:
      String(
        value.workspaceName ||
        ""
      ).trim(),
    brandTagline:
      String(
        value.brandTagline ||
        ""
      ).trim(),
    defaultRadiusKm:
      Number(
        value.defaultRadiusKm ||
        0
      ),
    defaultLeadLimit:
      Number(
        value.defaultLeadLimit ||
        0
      ),
    complianceMode:
      value.complianceMode !==
      false,
    allowDemoFallback:
      value.allowDemoFallback !==
      false,
  };
}

function validateSettings(
  value
) {
  const workspaceName =
    String(
      value.workspaceName ||
      ""
    ).trim();

  if (
    !workspaceName
  ) {
    return "Workspace name is required.";
  }

  if (
    workspaceName.length >
    120
  ) {
    return "Workspace name must be 120 characters or fewer.";
  }

  if (
    String(
      value.brandTagline ||
      ""
    ).length >
    180
  ) {
    return "Brand tagline must be 180 characters or fewer.";
  }

  const radius =
    Number(
      value.defaultRadiusKm
    );

  if (
    !Number.isFinite(
      radius
    ) ||
    radius <
      1 ||
    radius >
      500
  ) {
    return "Default radius must be between 1 and 500 km.";
  }

  const leadLimit =
    Number(
      value.defaultLeadLimit
    );

  if (
    !Number.isFinite(
      leadLimit
    ) ||
    leadLimit <
      1 ||
    leadLimit >
      5000
  ) {
    return "Default lead limit must be between 1 and 5,000.";
  }

  return "";
}

function normalizeCollection(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }

  if (
    Array.isArray(
      value?.items
    )
  ) {
    return value.items;
  }

  if (
    Array.isArray(
      value?.data
    )
  ) {
    return value.data;
  }

  return [];
}

function normalizeSessions(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }

  return normalizeCollection(
    value?.sessions ||
    value?.records ||
    value?.items
  );
}

function normalizeStatus(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function normalizeRole(
  value
) {
  const role =
    normalizeStatus(
      value
    );

  if (
    role.includes(
      "owner"
    )
  ) {
    return "owner";
  }

  if (
    role.includes(
      "admin"
    )
  ) {
    return "admin";
  }

  if (
    role.includes(
      "manager"
    )
  ) {
    return "manager";
  }

  if (
    role.includes(
      "caller"
    )
  ) {
    return "caller";
  }

  if (
    role.includes(
      "viewer"
    )
  ) {
    return "viewer";
  }

  return role ||
    "member";
}

function formatRole(
  value
) {
  const role =
    normalizeRole(
      value
    );

  return {
    owner:
      "Owner",
    admin:
      "Administrator",
    manager:
      "Manager",
    caller:
      "Caller",
    viewer:
      "Viewer",
    member:
      "Member",
  }[
    role
  ] ||
  titleCase(
    role
  );
}

function sessionDeviceLabel(
  session
) {
  return (
    firstString(
      session.deviceName,
      session.device,
      session.browser,
      session.userAgentLabel,
      session.userAgent
    ) ||
    "Signed-in device"
  );
}

function sessionLocationLabel(
  session
) {
  const direct =
    firstString(
      session.location,
      session.locationLabel
    );

  if (
    direct
  ) {
    return direct;
  }

  return [
    session.city,
    session.region,
    session.country,
  ]
    .filter(
      Boolean
    )
    .join(
      ", "
    );
}

function sessionIpLabel(
  session
) {
  return firstString(
    session.ip,
    session.ipAddress
  );
}

function clampNumber(
  value,
  min,
  max,
  fallback
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      min,
      number
    )
  );
}

function timestamp(
  value
) {
  if (!value) {
    return 0;
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();
}

function formatRelativeTime(
  value
) {
  const time =
    timestamp(
      value
    );

  if (!time) {
    return "Activity time unavailable";
  }

  const diff =
    Date.now() -
    time;

  if (
    diff <
    0
  ) {
    return "Recently";
  }

  const minutes =
    Math.floor(
      diff /
      60_000
    );

  if (
    minutes <
    1
  ) {
    return "Active just now";
  }

  if (
    minutes <
    60
  ) {
    return `Active ${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes /
      60
    );

  if (
    hours <
    24
  ) {
    return `Active ${hours}h ago`;
  }

  const days =
    Math.floor(
      hours /
      24
    );

  return days <
    14
    ? `Active ${days}d ago`
    : new Date(
        time
      ).toLocaleDateString(
        undefined,
        {
          month:
            "short",
          day:
            "numeric",
          year:
            "numeric",
        }
      );
}

function firstString(
  ...values
) {
  for (
    const value of
    values
  ) {
    if (
      value ===
        undefined ||
      value ===
        null
    ) {
      continue;
    }

    const text =
      String(
        value
      ).trim();

    if (
      text
    ) {
      return text;
    }
  }

  return "";
}

function titleCase(
  value
) {
  return String(
    value ||
    ""
  )
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}

function safeMessage(
  value
) {
  return String(
    value ||
    ""
  )
    .replace(
      /ElevenLabs/gi,
      "voice runtime"
    )
    .replace(
      /ElevenAgent/gi,
      "voice agent"
    )
    .replace(
      /Telnyx/gi,
      "calling provider"
    )
    .replace(
      /\bSIP\b/gi,
      "voice connection"
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
 * Scoped ReachFly V7 styling
 * ======================================================================= */

function SettingsStyles() {
  return (
    <style>{`
      .rf-settings-v7{
        --rfs-card:#fff;
        --rfs-soft:#f3f4f5;
        --rfs-soft2:#eceeef;
        --rfs-text:#191c1d;
        --rfs-text2:#464554;
        --rfs-muted:#767586;
        --rfs-line:#e3e5e7;
        --rfs-primary:#4648d4;
        --rfs-primary-dark:#3537bb;
        --rfs-psoft:#e8e9ff;
        --rfs-violet:#6b38d4;
        --rfs-vsoft:#f0eaff;
        --rfs-success:#087a51;
        --rfs-ssoft:#dff8eb;
        --rfs-warning:#8a6100;
        --rfs-wsoft:#fff4d6;
        --rfs-danger:#ba1a1a;
        --rfs-dsoft:#ffedeb;
        --rfs-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 46px;
        color:var(--rfs-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfsPageIn 260ms var(--rfs-ease);
      }

      .rf-settings-v7 *,
      .rf-settings-v7 *::before,
      .rf-settings-v7 *::after{
        box-sizing:border-box;
      }

      .rf-settings-v7 a{
        color:inherit;
      }

      .rf-settings-v7 .spin{
        animation:rfsSpin 800ms linear infinite;
      }

      @keyframes rfsPageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfsFadeUp{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfsShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      @keyframes rfsSpin{
        to{transform:rotate(360deg)}
      }

      .rfs-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:18px;
      }

      .rfs-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfs-primary);
        font-size:9px;
        font-weight:750;
        line-height:13px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfs-page-header h1{
        margin:0;
        color:var(--rfs-text);
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfs-page-header p{
        max-width:760px;
        margin:3px 0 0;
        color:var(--rfs-text2);
        font-size:13px;
        line-height:19px;
      }

      .rfs-header-actions{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        justify-content:flex-end;
        gap:8px;
      }

      .rfs-btn{
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
          color 140ms var(--rfs-ease),
          background 140ms var(--rfs-ease),
          border-color 140ms var(--rfs-ease),
          transform 140ms var(--rfs-ease),
          box-shadow 140ms var(--rfs-ease);
      }

      .rfs-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfs-btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfs-btn.primary{
        color:#fff;
        background:var(--rfs-primary);
        border-color:var(--rfs-primary);
        box-shadow:0 5px 14px rgba(70,72,212,.17);
      }

      .rfs-btn.primary:hover:not(:disabled){
        background:var(--rfs-primary-dark);
      }

      .rfs-btn.secondary{
        color:var(--rfs-text);
        background:#fff;
        border-color:var(--rfs-line);
      }

      .rfs-btn.secondary:hover:not(:disabled){
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
      }

      .rfs-notice{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        animation:rfsFadeUp 180ms var(--rfs-ease);
      }

      .rfs-notice > span{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        flex:0 0 26px;
        background:#fff;
        border-radius:7px;
      }

      .rfs-notice > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfs-notice strong{
        font-size:9px;
      }

      .rfs-notice small{
        font-size:8px;
        line-height:13px;
      }

      .rfs-notice.error{
        color:#7d1717;
        background:var(--rfs-dsoft);
        border-color:#ffd0cc;
      }

      .rfs-notice.warning{
        color:#765600;
        background:var(--rfs-wsoft);
        border-color:#f4dda0;
      }

      .rfs-notice.success{
        color:#075b3d;
        background:var(--rfs-ssoft);
        border-color:#bdebd7;
      }

      .rfs-layout{
        display:grid;
        grid-template-columns:280px minmax(0,1fr);
        gap:26px;
        align-items:start;
      }

      .rfs-nav-column{
        position:sticky;
        top:78px;
        display:grid;
        gap:12px;
      }

      .rfs-nav-card,
      .rfs-preview-card,
      .rfs-card,
      .rfs-save-card,
      .rfs-info-card,
      .rfs-side-card{
        background:#fff;
        border:1px solid var(--rfs-line);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rfs-nav-card{
        overflow:hidden;
      }

      .rfs-nav-card > header{
        display:grid;
        gap:1px;
        padding:15px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfs-line);
      }

      .rfs-nav-card > header strong{
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfs-nav-card nav{
        display:grid;
        padding:8px;
      }

      .rfs-nav-card nav button{
        min-height:66px;
        display:grid;
        grid-template-columns:32px minmax(0,1fr) 18px;
        align-items:center;
        gap:8px;
        padding:9px;
        color:inherit;
        background:transparent;
        border:0;
        border-radius:8px;
        text-align:left;
        cursor:pointer;
        transition:.14s var(--rfs-ease);
      }

      .rfs-nav-card nav button:hover{
        background:var(--rfs-soft);
      }

      .rfs-nav-card nav button.active{
        color:#3b3db6;
        background:var(--rfs-psoft);
      }

      .rfs-nav-card nav button > span{
        width:32px;
        height:32px;
        display:grid;
        place-items:center;
        color:var(--rfs-text2);
        background:#f0f1f2;
        border-radius:8px;
      }

      .rfs-nav-card nav button.active > span{
        color:var(--rfs-primary);
        background:#fff;
      }

      .rfs-nav-card nav button > div{
        min-width:0;
        display:grid;
      }

      .rfs-nav-card nav button strong{
        font-size:8px;
        line-height:12px;
      }

      .rfs-nav-card nav button small{
        overflow:hidden;
        color:var(--rfs-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6px;
        line-height:10px;
      }

      .rfs-nav-card nav button > svg{
        color:var(--rfs-muted);
      }

      .rfs-preview-card{
        overflow:hidden;
      }

      .rfs-preview-art{
        position:relative;
        min-height:110px;
        overflow:hidden;
        background:
          radial-gradient(circle at 15% 25%,rgba(70,72,212,.16),transparent 30%),
          radial-gradient(circle at 85% 70%,rgba(107,56,212,.12),transparent 28%),
          linear-gradient(135deg,#eff0f5,#f8f8fb);
        border-bottom:1px solid var(--rfs-line);
      }

      .rfs-preview-art > span{
        position:absolute;
        left:22px;
        top:21px;
        width:40px;
        height:40px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfs-primary);
        border-radius:10px;
        box-shadow:0 7px 18px rgba(70,72,212,.16);
      }

      .rfs-preview-art > i{
        position:absolute;
        display:block;
        background:#fff;
        border:1px solid rgba(227,229,231,.9);
        border-radius:8px;
        box-shadow:0 5px 16px rgba(25,28,29,.04);
      }

      .rfs-preview-art > i:nth-of-type(1){
        right:24px;
        top:17px;
        width:82px;
        height:26px;
      }

      .rfs-preview-art > i:nth-of-type(2){
        right:46px;
        top:52px;
        width:104px;
        height:18px;
      }

      .rfs-preview-art > i:nth-of-type(3){
        right:24px;
        top:78px;
        width:68px;
        height:13px;
      }

      .rfs-preview-copy{
        display:grid;
        padding:13px 14px;
      }

      .rfs-preview-copy > small{
        color:var(--rfs-muted);
        font-size:6px;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfs-preview-copy > strong{
        overflow:hidden;
        margin-top:2px;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rfs-preview-copy > p{
        margin:3px 0 8px;
        color:var(--rfs-text2);
        font-size:7px;
        line-height:11px;
      }

      .rfs-preview-copy > span{
        display:flex;
        align-items:center;
        gap:4px;
        width:max-content;
        padding:4px 6px;
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
        border-radius:6px;
        font-size:6px;
        font-weight:700;
      }

      .rfs-content{
        min-width:0;
      }

      .rfs-section-stack{
        display:grid;
        gap:14px;
        animation:rfsFadeUp 200ms var(--rfs-ease);
      }

      .rfs-section-title{
        padding:3px 0 7px;
      }

      .rfs-section-title h2{
        margin:0;
        font:600 29px/35px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfs-section-title p{
        max-width:780px;
        margin:4px 0 0;
        color:var(--rfs-text2);
        font-size:11px;
        line-height:17px;
      }

      .rfs-card{
        overflow:hidden;
      }

      .rfs-card-head{
        min-height:82px;
        display:grid;
        grid-template-columns:38px minmax(0,1fr) auto;
        align-items:center;
        gap:10px;
        padding:15px 17px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfs-line);
      }

      .rfs-card-head > span{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
        border-radius:10px;
      }

      .rfs-card-head > div:not(.rfs-card-action){
        min-width:0;
      }

      .rfs-card-head h3{
        margin:0;
        font:600 13px/18px Geist,Inter,sans-serif;
      }

      .rfs-card-head p{
        margin:2px 0 0;
        color:var(--rfs-text2);
        font-size:8px;
        line-height:13px;
      }

      .rfs-card-action{
        display:flex;
        justify-content:flex-end;
      }

      .rfs-card-body{
        padding:17px;
      }

      .rfs-form-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
      }

      .rfs-form-grid.two{
        grid-template-columns:1fr 1fr;
      }

      .rfs-field{
        position:relative;
        min-width:0;
        display:grid;
        gap:6px;
      }

      .rfs-field > span{
        color:var(--rfs-text);
        font-size:8px;
        font-weight:650;
      }

      .rfs-field > span em{
        color:var(--rfs-danger);
        font-style:normal;
      }

      .rfs-field > div{
        min-height:43px;
        display:flex;
        align-items:center;
        gap:7px;
        padding:0 10px;
        color:var(--rfs-muted);
        background:#fff;
        border:1px solid var(--rfs-line);
        border-radius:8px;
      }

      .rfs-field > div:focus-within{
        border-color:rgba(70,72,212,.45);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rfs-field > div > i{
        display:grid;
        place-items:center;
        color:var(--rfs-muted);
        font-style:normal;
      }

      .rfs-field input{
        min-width:0;
        width:100%;
        height:41px;
        padding:0;
        color:var(--rfs-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:9px;
      }

      .rfs-field > small{
        color:var(--rfs-muted);
        text-align:right;
        font-size:6px;
      }

      .rfs-field > small.hint{
        text-align:left;
        line-height:10px;
      }

      .rfs-field > div.number{
        padding-right:8px;
      }

      .rfs-field > div.number b{
        flex:0 0 auto;
        padding:4px 6px;
        color:var(--rfs-text2);
        background:var(--rfs-soft);
        border-radius:5px;
        font-size:6px;
        font-weight:700;
        text-transform:uppercase;
      }

      .rfs-switch-list{
        display:grid;
        gap:8px;
      }

      .rfs-switch-row{
        min-height:82px;
        display:grid;
        grid-template-columns:36px minmax(0,1fr) 42px;
        align-items:center;
        gap:10px;
        padding:12px;
        background:var(--rfs-soft);
        border-radius:9px;
      }

      .rfs-switch-row > span{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:#fff;
        border-radius:9px;
      }

      .rfs-switch-row > div{
        min-width:0;
      }

      .rfs-switch-row strong{
        display:block;
        font-size:8px;
      }

      .rfs-switch-row p{
        margin:2px 0 0;
        color:var(--rfs-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfs-switch-row em{
        display:inline-block;
        margin-top:5px;
        padding:3px 5px;
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
        border-radius:5px;
        font-size:5.5px;
        font-style:normal;
        font-weight:750;
        text-transform:uppercase;
      }

      .rfs-switch-row > button{
        position:relative;
        width:42px;
        height:24px;
        padding:0;
        background:#c8cbd0;
        border:0;
        border-radius:999px;
        cursor:pointer;
        transition:.15s var(--rfs-ease);
      }

      .rfs-switch-row > button i{
        position:absolute;
        left:3px;
        top:3px;
        width:18px;
        height:18px;
        background:#fff;
        border-radius:50%;
        box-shadow:0 1px 3px rgba(25,28,29,.12);
        transition:.15s var(--rfs-ease);
      }

      .rfs-switch-row > button.on{
        background:var(--rfs-primary);
      }

      .rfs-switch-row > button.on i{
        transform:translateX(18px);
      }

      .rfs-save-card{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:13px 15px;
      }

      .rfs-save-card > div:first-child{
        min-width:0;
        display:grid;
      }

      .rfs-save-card strong{
        font-size:8px;
      }

      .rfs-save-card small{
        color:var(--rfs-muted);
        font-size:6.5px;
        line-height:10px;
      }

      .rfs-save-card > div:last-child{
        display:flex;
        gap:7px;
      }

      .rfs-save-card .rfs-btn{
        min-height:35px;
        font-size:7px;
      }

      .rfs-calling-metrics{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
      }

      .rfs-calling-metric{
        min-height:145px;
        display:grid;
        align-content:space-between;
        padding:15px;
        color:inherit;
        background:#fff;
        border:1px solid var(--rfs-line);
        border-radius:11px;
        text-decoration:none;
        transition:.15s var(--rfs-ease);
      }

      .rfs-calling-metric:hover{
        transform:translateY(-2px);
        border-color:#d1d2ff;
        box-shadow:0 9px 22px rgba(25,28,29,.05);
      }

      .rfs-calling-metric header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        color:var(--rfs-muted);
      }

      .rfs-calling-metric header > span{
        width:33px;
        height:33px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
        border-radius:8px;
      }

      .rfs-calling-metric > strong{
        margin-top:11px;
        font:600 24px/29px Geist,Inter,sans-serif;
      }

      .rfs-calling-metric > small{
        color:var(--rfs-text);
        font-size:7px;
        font-weight:700;
      }

      .rfs-calling-metric > p{
        margin:2px 0 0;
        color:var(--rfs-muted);
        font-size:6.5px;
        line-height:10px;
      }

      .rfs-routing-list{
        display:grid;
        gap:7px;
      }

      .rfs-route-card{
        min-height:74px;
        display:grid;
        grid-template-columns:36px minmax(0,1fr) auto 17px;
        align-items:center;
        gap:10px;
        padding:10px 11px;
        color:inherit;
        background:var(--rfs-soft);
        border:1px solid transparent;
        border-radius:9px;
        text-decoration:none;
        transition:.14s var(--rfs-ease);
      }

      .rfs-route-card:hover{
        background:#f0f0fb;
        border-color:#dcdcff;
      }

      .rfs-route-card > span{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:#fff;
        border-radius:8px;
      }

      .rfs-route-card > div{
        min-width:0;
      }

      .rfs-route-card strong{
        display:block;
        font-size:8px;
      }

      .rfs-route-card p{
        margin:2px 0 0;
        color:var(--rfs-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfs-route-card em{
        padding:4px 7px;
        border-radius:999px;
        font-size:6px;
        font-style:normal;
        font-weight:750;
      }

      .rfs-route-card em.success{
        color:var(--rfs-success);
        background:var(--rfs-ssoft);
      }

      .rfs-route-card em.warning{
        color:var(--rfs-warning);
        background:var(--rfs-wsoft);
      }

      .rfs-route-card em.neutral{
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
      }

      .rfs-route-card > svg{
        color:var(--rfs-muted);
      }

      .rfs-guardrail-banner{
        display:grid;
        grid-template-columns:39px minmax(0,1fr) auto;
        align-items:center;
        gap:10px;
        padding:11px;
        background:var(--rfs-soft);
        border-radius:9px;
      }

      .rfs-guardrail-banner > span{
        width:39px;
        height:39px;
        display:grid;
        place-items:center;
        border-radius:10px;
      }

      .rfs-guardrail-banner > span.ready{
        color:var(--rfs-success);
        background:var(--rfs-ssoft);
      }

      .rfs-guardrail-banner > span.attention{
        color:var(--rfs-warning);
        background:var(--rfs-wsoft);
      }

      .rfs-guardrail-banner > div{
        min-width:0;
      }

      .rfs-guardrail-banner strong{
        font-size:8px;
      }

      .rfs-guardrail-banner p{
        margin:2px 0 0;
        color:var(--rfs-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfs-inline-link{
        min-height:32px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:6px 8px;
        color:var(--rfs-primary)!important;
        background:#fff;
        border-radius:7px;
        text-decoration:none;
        white-space:nowrap;
        font-size:7px;
        font-weight:700;
      }

      .rfs-info-card{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:12px 14px;
        color:var(--rfs-violet);
        background:linear-gradient(135deg,#f4efff,#faf8ff);
        border-color:#e1d4f8;
      }

      .rfs-info-card > svg{
        flex:0 0 auto;
        margin-top:1px;
      }

      .rfs-info-card strong{
        display:block;
        font-size:8px;
      }

      .rfs-info-card p{
        margin:2px 0 0;
        color:var(--rfs-text2);
        font-size:7px;
        line-height:11px;
      }

      .rfs-security-layout{
        display:grid;
        grid-template-columns:minmax(0,1fr) 280px;
        gap:14px;
        align-items:start;
      }

      .rfs-security-main,
      .rfs-security-side{
        display:grid;
        gap:14px;
      }

      .rfs-security-side{
        position:sticky;
        top:78px;
      }

      .rfs-password-form{
        display:grid;
        gap:13px;
      }

      .rfs-password-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
      }

      .rfs-password-note{
        display:flex;
        align-items:flex-start;
        gap:7px;
        padding:10px;
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
        border-radius:8px;
      }

      .rfs-password-note > svg{
        flex:0 0 auto;
        margin-top:1px;
      }

      .rfs-password-note p{
        margin:0;
        color:var(--rfs-text2);
        font-size:7px;
        line-height:11px;
      }

      .rfs-form-actions{
        display:flex;
        justify-content:flex-end;
      }

      .rfs-form-actions .rfs-btn{
        min-height:35px;
        font-size:7px;
      }

      .rfs-text-danger{
        min-height:31px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:5px 8px;
        color:var(--rfs-danger);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
      }

      .rfs-text-danger:hover:not(:disabled){
        background:var(--rfs-dsoft);
      }

      .rfs-text-danger:disabled{
        opacity:.45;
      }

      .rfs-session-list{
        display:grid;
        padding:7px;
      }

      .rfs-session-row{
        min-height:69px;
        display:grid;
        grid-template-columns:35px minmax(0,1fr) auto;
        align-items:center;
        gap:9px;
        padding:9px;
        border-radius:8px;
      }

      .rfs-session-row + .rfs-session-row{
        border-top:1px solid #f0f1f2;
      }

      .rfs-session-row > span{
        width:35px;
        height:35px;
        display:grid;
        place-items:center;
        color:#606672;
        background:var(--rfs-soft);
        border-radius:8px;
      }

      .rfs-session-row > div{
        min-width:0;
      }

      .rfs-session-row strong{
        display:block;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
      }

      .rfs-session-row p{
        margin:2px 0 0;
        overflow:hidden;
        color:var(--rfs-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.5px;
      }

      .rfs-session-row > em{
        padding:4px 6px;
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
        border-radius:999px;
        font-size:5.5px;
        font-style:normal;
        font-weight:750;
        text-transform:uppercase;
      }

      .rfs-session-row > button{
        min-height:29px;
        display:inline-flex;
        align-items:center;
        gap:4px;
        padding:5px 7px;
        color:var(--rfs-danger);
        background:#fff;
        border:1px solid #f1d2d2;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:700;
      }

      .rfs-session-row > button:disabled{
        opacity:.45;
      }

      .rfs-session-empty{
        padding:20px 14px;
        color:var(--rfs-muted);
        text-align:center;
        font-size:7px;
      }

      .rfs-side-card{
        overflow:hidden;
      }

      .rfs-side-card > header{
        display:flex;
        align-items:center;
        gap:8px;
        padding:12px 13px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfs-line);
      }

      .rfs-side-card > header > span{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
        border-radius:8px;
      }

      .rfs-side-card > header > span.violet{
        color:var(--rfs-violet);
        background:var(--rfs-vsoft);
      }

      .rfs-side-card > header > span.green{
        color:var(--rfs-success);
        background:var(--rfs-ssoft);
      }

      .rfs-side-card > header > div{
        min-width:0;
        display:grid;
      }

      .rfs-side-card > header small{
        color:var(--rfs-muted);
        font-size:6px;
        text-transform:uppercase;
      }

      .rfs-side-card > header strong{
        font-size:8px;
      }

      .rfs-side-body{
        display:grid;
        gap:9px;
        padding:12px 13px;
      }

      .rfs-side-body > p{
        margin:0;
        color:var(--rfs-text2);
        font-size:7px;
        line-height:11px;
      }

      .rfs-access-summary{
        min-height:53px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:8px;
        background:var(--rfs-soft);
        border-radius:8px;
      }

      .rfs-access-summary > span{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:#fff;
        border-radius:7px;
      }

      .rfs-access-summary > div{
        display:grid;
      }

      .rfs-access-summary small{
        color:var(--rfs-muted);
        font-size:6px;
      }

      .rfs-access-summary strong{
        font-size:8px;
      }

      .rfs-side-link{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:7px;
        padding:9px 0 0;
        color:var(--rfs-primary)!important;
        border-top:1px solid #f0f1f2;
        text-decoration:none;
        font-size:7px;
        font-weight:700;
      }

      .rfs-unavailable-badge{
        width:max-content;
        padding:5px 7px;
        color:#686d78;
        background:#eceeef;
        border-radius:6px;
        font-size:6px;
        font-weight:750;
      }

      .rfs-mini-dl{
        display:grid;
        gap:0;
        margin:0;
      }

      .rfs-mini-dl > div{
        display:grid;
        grid-template-columns:70px minmax(0,1fr);
        gap:7px;
        padding:6px 0;
      }

      .rfs-mini-dl > div + div{
        border-top:1px solid #f0f1f2;
      }

      .rfs-mini-dl dt{
        color:var(--rfs-muted);
        font-size:6px;
      }

      .rfs-mini-dl dd{
        margin:0;
        overflow:hidden;
        text-align:right;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.5px;
        font-weight:650;
      }

      .rfs-access-denied{
        min-height:460px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:7px;
        text-align:center;
      }

      .rfs-access-denied > span{
        width:58px;
        height:58px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:var(--rfs-psoft);
        border-radius:16px;
      }

      .rfs-access-denied h1{
        margin:0;
        font:600 20px/27px Geist,Inter,sans-serif;
      }

      .rfs-access-denied p{
        margin:0;
        color:var(--rfs-muted);
        font-size:9px;
      }

      .rfs-nav-card.skeleton,
      .rfs-section-skeleton{
        display:grid;
        gap:9px;
        padding:14px;
      }

      .rfs-nav-card.skeleton > i,
      .rfs-section-skeleton > i{
        display:block;
        background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);
        background-size:220% 100%;
        border-radius:8px;
        animation:rfsShimmer 1.25s linear infinite;
      }

      .rfs-nav-card.skeleton > i{
        height:58px;
      }

      .rfs-section-skeleton > i{
        height:210px;
      }

      .rfs-section-skeleton > i:first-child{
        height:80px;
      }

      .rfs-section-skeleton > i:last-child{
        height:260px;
      }

      @media(max-width:1180px){
        .rf-settings-v7{
          padding:22px;
        }

        .rfs-layout{
          grid-template-columns:245px minmax(0,1fr);
          gap:18px;
        }

        .rfs-security-layout{
          grid-template-columns:minmax(0,1fr) 250px;
        }

        .rfs-calling-metrics{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:940px){
        .rfs-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfs-header-actions{
          width:100%;
        }

        .rfs-layout{
          grid-template-columns:1fr;
        }

        .rfs-nav-column{
          position:static;
        }

        .rfs-nav-card nav{
          grid-template-columns:repeat(3,1fr);
        }

        .rfs-nav-card nav button{
          grid-template-columns:28px minmax(0,1fr);
        }

        .rfs-nav-card nav button > svg{
          display:none;
        }

        .rfs-preview-card{
          display:none;
        }

        .rfs-security-layout{
          grid-template-columns:1fr;
        }

        .rfs-security-side{
          position:static;
          grid-template-columns:repeat(3,minmax(0,1fr));
        }
      }

      @media(max-width:720px){
        .rf-settings-v7{
          padding:18px 12px 84px;
        }

        .rfs-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfs-page-header p{
          font-size:11px;
          line-height:17px;
        }

        .rfs-nav-card nav{
          display:flex;
          overflow:auto;
        }

        .rfs-nav-card nav button{
          min-width:180px;
          flex:0 0 auto;
        }

        .rfs-form-grid,
        .rfs-form-grid.two,
        .rfs-password-grid{
          grid-template-columns:1fr;
        }

        .rfs-calling-metrics{
          grid-template-columns:1fr 1fr;
        }

        .rfs-security-side{
          grid-template-columns:1fr;
        }

        .rfs-save-card{
          align-items:stretch;
          flex-direction:column;
        }

        .rfs-save-card > div:last-child{
          justify-content:flex-end;
        }

        .rfs-guardrail-banner{
          grid-template-columns:39px minmax(0,1fr);
        }

        .rfs-guardrail-banner .rfs-inline-link{
          grid-column:1/-1;
          justify-content:center;
        }
      }

      @media(max-width:520px){
        .rfs-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .rfs-header-actions .rfs-btn.primary{
          grid-column:1/-1;
        }

        .rfs-card-head{
          grid-template-columns:36px minmax(0,1fr);
        }

        .rfs-card-action{
          grid-column:1/-1;
          justify-content:flex-start;
        }

        .rfs-calling-metrics{
          grid-template-columns:1fr;
        }

        .rfs-route-card{
          grid-template-columns:36px minmax(0,1fr) 17px;
        }

        .rfs-route-card > em{
          grid-column:2;
          width:max-content;
        }

        .rfs-save-card > div:last-child{
          display:grid;
          grid-template-columns:1fr;
        }

        .rfs-save-card .rfs-btn{
          width:100%;
        }

        .rfs-session-row{
          grid-template-columns:35px minmax(0,1fr);
        }

        .rfs-session-row > em,
        .rfs-session-row > button{
          grid-column:2;
          justify-self:start;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-settings-v7,
        .rfs-section-stack,
        .rfs-notice,
        .rfs-nav-card.skeleton > i,
        .rfs-section-skeleton > i,
        .rf-settings-v7 .spin{
          animation:none!important;
        }

        .rf-settings-v7 *,
        .rf-settings-v7 *::before,
        .rf-settings-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
