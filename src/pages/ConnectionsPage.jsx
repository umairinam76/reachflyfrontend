import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import QRCode from "qrcode";

import {
  ArrowRight,
  Bot,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Workflow,
  X,
} from "../components/icons";

import {
  Link,
} from "react-router-dom";

import {
  api,
} from "../api";

const FILTERS = [
  ["all", "All"],
  ["connected", "Connected"],
  ["attention", "Needs attention"],
  ["available", "Available"],
];

const INLINE_EMAIL_PROVIDERS = {
  gmail: {
    label: "Gmail / Google",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
  },
  outlook: {
    label: "Microsoft / Outlook",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
  },
  custom: {
    label: "Other provider",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
  },
};

function createInlineEmailForm(provider = "gmail") {
  const preset = INLINE_EMAIL_PROVIDERS[provider] || INLINE_EMAIL_PROVIDERS.gmail;
  return {
    provider,
    fromName: "ReachFlyAI",
    fromEmail: "",
    password: "",
    smtpHost: preset.smtpHost,
    smtpPort: preset.smtpPort,
    smtpSecure: preset.smtpSecure,
    imapHost: preset.imapHost,
    imapPort: preset.imapPort,
    imapSecure: preset.imapSecure,
  };
}

export default function ConnectionsPage() {
  const mountedRef = useRef(true);

  const [data, setData] = useState(null);
  const [whatsapp, setWhatsapp] = useState(null);
  const [voiceDashboard, setVoiceDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeIntegration, setActiveIntegration] = useState("");
  const [modalBusy, setModalBusy] = useState("");
  const [modalError, setModalError] = useState("");
  const [emailForm, setEmailForm] = useState(() => createInlineEmailForm("gmail"));
  const [calendlyForm, setCalendlyForm] = useState({
    accessToken: "",
    eventUrl: "",
  });

  const load = useCallback(
    async ({
      silent = false,
      successToast = false,
    } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [
          connectionResult,
          whatsappResult,
          voiceResult,
        ] = await Promise.allSettled([
          callApi("connections"),
          callApi("whatsappStatus", {
            optional: true,
          }),
          callApi("voiceAgentDashboard", {
            optional: true,
          }),
        ]);

        if (!mountedRef.current) {
          return;
        }

        const problems = [];

        if (
          connectionResult.status ===
          "fulfilled"
        ) {
          setData(
            normalizeConnectionDashboard(
              connectionResult.value
            )
          );
        } else {
          setData(
            normalizeConnectionDashboard(
              null
            )
          );

          problems.push(
            safeMessage(
              connectionResult.reason
                ?.message ||
                "Workspace connections could not be loaded."
            )
          );
        }

        if (
          whatsappResult.status ===
          "fulfilled"
        ) {
          setWhatsapp(
            whatsappResult.value
              ? normalizeWhatsAppStatus(
                  whatsappResult.value
                )
              : null
          );
        } else {
          setWhatsapp(null);
        }

        if (
          voiceResult.status ===
          "fulfilled"
        ) {
          setVoiceDashboard(
            normalizeVoiceDashboard(
              voiceResult.value
            )
          );
        } else {
          setVoiceDashboard(null);
        }

        const nextError =
          problems
            .filter(Boolean)
            .join(" ");

        setError(nextError);

        if (successToast) {
          if (nextError) {
            notify(
              "warning",
              "Integrations partially refreshed",
              nextError
            );
          } else {
            notify(
              "success",
              "Integrations refreshed",
              "Latest connection health is now visible."
            );
          }
        }
      } catch (requestError) {
        if (!mountedRef.current) {
          return;
        }

        const text = safeMessage(
          requestError?.message ||
            "Integrations could not be loaded."
        );

        setError(text);

        if (successToast) {
          notify(
            "error",
            "Refresh failed",
            text
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const status =
      params.get(
        "google_connection"
      );

    if (status && window.opener && window.opener !== window) {
      try {
        window.opener.postMessage(
          {
            type: "reachfly:google-connection",
            status,
            reason: params.get("reason") || "",
          },
          window.location.origin
        );
      } catch {}
      clearGoogleCallbackQuery();
      window.close();
      return;
    }

    if (status === "success") {
      const text =
        "Google Workspace connected successfully.";

      setMessage(text);
      setError("");

      notify(
        "success",
        "Google Workspace connected",
        text
      );

      clearGoogleCallbackQuery();

      void load({
        silent: true,
      });

      return;
    }

    if (status === "error") {
      const reason =
        safeMessage(
          params.get("reason") ||
          params.get(
            "google_connection_message"
          ) ||
          ""
        );

      const text =
        reason
          ? `Google Workspace connection could not be completed (${reason}).`
          : "Google Workspace connection could not be completed. Try again.";

      setError(text);
      setMessage("");

      notify(
        "error",
        "Google connection failed",
        text
      );

      clearGoogleCallbackQuery();
    }
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "reachfly:google-connection") return;

      setBusy("");
      if (event.data.status === "success") {
        const text = "Google Workspace connected successfully.";
        setMessage(text);
        setError("");
        notify("success", "Google Workspace connected", text);
        void load({ silent: true });
      } else {
        const reason = safeMessage(event.data.reason || "");
        const text = reason
          ? `Google Workspace connection could not be completed (${reason}).`
          : "Google Workspace connection could not be completed. Try again.";
        setError(text);
        notify("error", "Google connection failed", text);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [load]);

  useEffect(() => {
    if (activeIntegration !== "whatsapp" || whatsapp?.ready) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await callApi("whatsappStatus", { optional: true });
        if (!cancelled && result) {
          setWhatsapp(normalizeWhatsAppStatus(result));
        }
      } catch {}
    };

    void poll();
    const timer = window.setInterval(poll, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeIntegration, whatsapp?.ready]);

  const connections = useMemo(
    () => normalizeConnections(data),
    [data]
  );

  const connectedConnections = useMemo(
    () => connections.filter(isHealthyConnection),
    [connections]
  );

  const googleConnections = useMemo(
    () => connections.filter(isGoogleConnection),
    [connections]
  );

  const healthyGoogleConnections = useMemo(
    () => googleConnections.filter(isHealthyConnection),
    [googleConnections]
  );

  const googleEmailConnection = useMemo(
    () =>
      healthyGoogleConnections.find(
        (connection) => connection.capabilities?.emailSend
      ) ||
      googleConnections.find(
        (connection) => connection.capabilities?.emailSend
      ) ||
      null,
    [googleConnections, healthyGoogleConnections]
  );

  const googleCalendarConnection = useMemo(
    () =>
      healthyGoogleConnections.find(
        (connection) => connection.capabilities?.calendar
      ) ||
      googleConnections.find(
        (connection) => connection.capabilities?.calendar
      ) ||
      null,
    [googleConnections, healthyGoogleConnections]
  );

  const customEmailConnections = useMemo(
    () => connections.filter(isCustomEmailConnection),
    [connections]
  );

  const calendlyConnections = useMemo(
    () => connections.filter(isCalendlyConnection),
    [connections]
  );

  const agents = useMemo(
    () => normalizeAgents(voiceDashboard),
    [voiceDashboard]
  );

  const assignmentCounts = useMemo(
    () => buildAssignmentCounts(agents),
    [agents]
  );

  const agentCapabilityRows = useMemo(
    () => agents.map((agent) => buildAgentCapabilityRow(agent, connections)),
    [agents, connections]
  );

  const readyActionAgents = useMemo(
    () => agentCapabilityRows.filter((row) => row.actionReady).length,
    [agentCapabilityRows]
  );

  const integrationCards = useMemo(
    () => {
      const healthyGoogle = healthyGoogleConnections[0] || null;
      const anyGoogle = googleConnections[0] || null;
      const googleState = getProviderState({
        configured: data?.googleConfigured !== false,
        connection: healthyGoogle || anyGoogle,
      });

      const gmailState = getCapabilityState(
        googleEmailConnection,
        "emailSend",
        data?.googleConfigured !== false
      );

      const calendarState = getCapabilityState(
        googleCalendarConnection,
        "calendar",
        data?.googleConfigured !== false
      );

      const customEmailHealthy = customEmailConnections.find(isHealthyConnection);
      const customEmailAny = customEmailConnections[0] || null;
      const customEmailState = getProviderState({
        configured: true,
        connection: customEmailHealthy || customEmailAny,
      });

      const calendlyHealthy = calendlyConnections.find(isHealthyConnection);
      const calendlyAny = calendlyConnections[0] || null;
      const calendlyState = calendlyAny
        ? getProviderState({
            configured: true,
            connection: calendlyHealthy || calendlyAny,
          })
        : {
            key: "available",
            label: "Available",
            tone: "neutral",
          };

      const whatsappState = getWhatsAppState(whatsapp);

      return [
        {
          id: "google-workspace",
          title: "Google Workspace",
          description:
            "Connect Google once to enable controlled Gmail sending and calendar booking for ReachFly workflows.",
          icon: "google",
          state: googleState,
          meta: providerMeta(healthyGoogle || anyGoogle),
          account: (healthyGoogle || anyGoogle)?.accountEmail || "",
          assigned: sumAssignedForConnections(
            healthyGoogleConnections.length
              ? healthyGoogleConnections
              : googleConnections,
            assignmentCounts
          ),
          action: data?.googleConfigured === false
            ? {
                label: "Unavailable",
                disabled: true,
              }
            : {
                label: healthyGoogleConnections.length
                  ? "Connect another"
                  : googleConnections.length
                    ? "Reconnect"
                    : "Connect",
                onClick: connectGoogle,
                loading: busy === "google",
              },
          settings: healthyGoogle || anyGoogle
            ? () => setMessage(
                `Google Workspace is connected as ${(healthyGoogle || anyGoogle)?.accountEmail || "this account"}.`
              )
            : null,
        },
        {
          id: "gmail",
          title: "Gmail",
          description:
            "Send requested information and follow-ups from the Google account assigned to your workflow or AI Voice Agent.",
          icon: "gmail",
          state: gmailState,
          meta: providerMeta(googleEmailConnection),
          account: googleEmailConnection?.accountEmail || "",
          assigned: googleEmailConnection
            ? assignmentCounts.email.get(String(googleEmailConnection.id)) || 0
            : 0,
          action: googleEmailConnection?.capabilities?.emailSend
            ? {
                label: "Test sending",
                onClick: () => runAction(googleEmailConnection, "email"),
                loading: busy === `${googleEmailConnection.id}:email`,
              }
            : data?.googleConfigured === false
              ? {
                  label: "Unavailable",
                  disabled: true,
                }
              : {
                  label: googleEmailConnection ? "Reconnect" : "Connect",
                  onClick: connectGoogle,
                  loading: busy === "google",
                },
          settings: googleEmailConnection
            ? () => setMessage(
                `Gmail is available for ${googleEmailConnection.accountEmail || "this Google connection"}.`
              )
            : null,
        },
        {
          id: "google-calendar",
          title: "Google Calendar",
          description:
            "Check live availability and create confirmed meeting events from ReachFly booking workflows.",
          icon: "calendar",
          state: calendarState,
          meta: providerMeta(googleCalendarConnection),
          account: googleCalendarConnection?.accountEmail || "",
          assigned: googleCalendarConnection
            ? assignmentCounts.calendar.get(String(googleCalendarConnection.id)) || 0
            : 0,
          action: googleCalendarConnection?.capabilities?.calendar
            ? {
                label: "Test calendar",
                onClick: () => runAction(googleCalendarConnection, "calendar"),
                loading: busy === `${googleCalendarConnection.id}:calendar`,
              }
            : data?.googleConfigured === false
              ? {
                  label: "Unavailable",
                  disabled: true,
                }
              : {
                  label: googleCalendarConnection ? "Reconnect" : "Connect",
                  onClick: connectGoogle,
                  loading: busy === "google",
                },
          settings: googleCalendarConnection
            ? () => setMessage(
                `Calendar booking is available for ${googleCalendarConnection.accountEmail || "this Google connection"}.`
              )
            : null,
        },
        {
          id: "custom-email",
          title: "Custom Email",
          description:
            "Use another business mailbox for outbound sending and inbox synchronization when Google Workspace is not the right fit.",
          icon: "mail",
          state: customEmailState,
          meta: customEmailHealthy || customEmailAny
            ? providerMeta(customEmailHealthy || customEmailAny)
            : "Advanced email setup",
          account: (customEmailHealthy || customEmailAny)?.accountEmail || "",
          assigned: sumAssignedForConnections(
            customEmailConnections,
            assignmentCounts,
            "email"
          ),
          action: {
            label: customEmailConnections.length ? "Connect another" : "Connect",
            onClick: () => openIntegration("custom-email"),
          },
        },
        {
          id: "whatsapp",
          title: "WhatsApp Business",
          description:
            "Connect WhatsApp to support messaging workflows and keep conversation activity inside ReachFly.",
          icon: "whatsapp",
          state: whatsappState,
          meta: whatsapp?.phone
            ? formatPhone(whatsapp.phone)
            : whatsapp?.checkedAt
              ? `Checked ${formatRelativeTime(whatsapp.checkedAt)}`
              : "Messaging connection",
          account: whatsapp?.phone || "",
          assigned: 0,
          action: {
            label: whatsappState.key === "connected" ? "Manage" : "Connect",
            onClick: () => openIntegration("whatsapp"),
          },
        },
        {
          id: "calendly",
          title: "Calendly",
          description:
            "Use scheduling links in your meeting workflows when a dedicated Calendly connection is available to the workspace.",
          icon: "calendly",
          state: calendlyState,
          meta: calendlyHealthy || calendlyAny
            ? providerMeta(calendlyHealthy || calendlyAny)
            : "Managed through booking workflows",
          account: (calendlyHealthy || calendlyAny)?.accountEmail || "",
          assigned: sumAssignedForConnections(
            calendlyConnections,
            assignmentCounts
          ),
          action: {
            label: calendlyAny ? "Reconnect" : "Connect",
            onClick: () => openIntegration("calendly"),
          },
        },
      ];
    },
    [
      assignmentCounts,
      busy,
      calendlyConnections,
      customEmailConnections,
      data?.googleConfigured,
      googleCalendarConnection,
      googleConnections,
      googleEmailConnection,
      healthyGoogleConnections,
      whatsapp,
    ]
  );

  const visibleCards = useMemo(
    () => {
      const normalizedQuery = query.trim().toLowerCase();

      return integrationCards.filter((card) => {
        if (filter !== "all" && card.state.key !== filter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [
          card.title,
          card.description,
          card.state.label,
          card.meta,
          card.account,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });
    },
    [filter, integrationCards, query]
  );

  const metrics = useMemo(
    () => ({
      connected: integrationCards.filter((card) => card.state.key === "connected").length,
      attention: integrationCards.filter((card) => card.state.key === "attention").length,
      accounts: connectedConnections.length,
      agents: agents.length,
    }),
    [agents.length, connectedConnections.length, integrationCards]
  );

  function openIntegration(integrationId) {
    setModalError("");

    if (["google-workspace", "gmail", "google-calendar"].includes(integrationId)) {
      void connectGoogle();
      return;
    }

    if (integrationId === "calendly") {
      const existing = calendlyConnections.find(isHealthyConnection) || calendlyConnections[0];
      setCalendlyForm((current) => ({
        accessToken: "",
        eventUrl: firstString(existing?.calendlyEventUrl, existing?.schedulingUrl, current.eventUrl),
      }));
    }

    setActiveIntegration(integrationId);
  }

  function closeIntegration() {
    if (modalBusy) return;
    setActiveIntegration("");
    setModalError("");
  }

  function chooseInlineEmailProvider(provider) {
    const next = createInlineEmailForm(provider);
    setEmailForm((current) => ({
      ...next,
      fromName: current.fromName || next.fromName,
      fromEmail: current.fromEmail,
      password: current.password,
    }));
    setModalError("");
  }

  async function saveInlineEmail() {
    if (modalBusy) return;
    const fromEmail = String(emailForm.fromEmail || "").trim();
    const password = String(emailForm.password || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      setModalError("Enter a valid mailbox email address.");
      return;
    }
    if (!password) {
      setModalError("Enter the mailbox password or app password.");
      return;
    }
    if (!emailForm.smtpHost || !emailForm.imapHost) {
      setModalError("Enter both SMTP and IMAP server hosts.");
      return;
    }

    const payload = {
      accountId: "",
      label: fromEmail,
      provider: emailForm.provider,
      fromName: String(emailForm.fromName || "ReachFlyAI").trim(),
      fromEmail,
      replyTo: fromEmail,
      host: String(emailForm.smtpHost).trim(),
      port: Number(emailForm.smtpPort || 587),
      secure: Boolean(emailForm.smtpSecure),
      username: fromEmail,
      password,
      incomingHost: String(emailForm.imapHost).trim(),
      incomingPort: Number(emailForm.imapPort || 993),
      incomingSecure: Boolean(emailForm.imapSecure),
      incomingUsername: fromEmail,
      incomingPassword: password,
      sameIncomingCredentials: true,
    };

    try {
      setModalBusy("email");
      setModalError("");
      await api.testEmailSettings(payload);
      await api.testIncomingEmailSettings(payload);
      await api.saveEmailSettings(payload);
      const text = `${fromEmail} is connected for sending and inbox sync.`;
      setMessage(text);
      notify("success", "Email account connected", text);
      setEmailForm(createInlineEmailForm(emailForm.provider));
      setActiveIntegration("");
      await load({ silent: true });
    } catch (requestError) {
      setModalError(safeMessage(requestError?.message || "Email account could not be connected."));
    } finally {
      setModalBusy("");
    }
  }

  async function connectWhatsAppInline() {
    if (modalBusy) return;
    try {
      setModalBusy("whatsapp");
      setModalError("");
      const result = await api.whatsappConnect();
      const next = normalizeWhatsAppStatus(result);
      setWhatsapp(next);
      if (next.ready) {
        notify("success", "WhatsApp connected", "Your WhatsApp session is ready.");
      }
    } catch (requestError) {
      setModalError(safeMessage(requestError?.message || "WhatsApp linking could not start."));
    } finally {
      setModalBusy("");
    }
  }

  async function disconnectWhatsAppInline() {
    if (modalBusy) return;
    try {
      setModalBusy("whatsapp");
      setModalError("");
      const result = await api.whatsappLogout();
      setWhatsapp(normalizeWhatsAppStatus(result));
      notify("success", "WhatsApp disconnected", "The linked WhatsApp session was removed.");
    } catch (requestError) {
      setModalError(safeMessage(requestError?.message || "WhatsApp could not be disconnected."));
    } finally {
      setModalBusy("");
    }
  }

  async function connectCalendlyInline() {
    if (modalBusy) return;
    const accessToken = String(calendlyForm.accessToken || "").trim();
    const eventUrl = String(calendlyForm.eventUrl || "").trim();
    if (!accessToken || !eventUrl) {
      setModalError("Enter both the Calendly personal access token and event scheduling URL.");
      return;
    }

    try {
      setModalBusy("calendly");
      setModalError("");
      await api.connectCalendly({ accessToken, eventUrl });
      const text = "Calendly is connected to this workspace.";
      setMessage(text);
      notify("success", "Calendly connected", text);
      setCalendlyForm({ accessToken: "", eventUrl });
      setActiveIntegration("");
      await load({ silent: true });
    } catch (requestError) {
      setModalError(safeMessage(requestError?.message || "Calendly could not be connected."));
    } finally {
      setModalBusy("");
    }
  }

  async function connectGoogle() {
    if (busy) return;

    let popup = null;
    try {
      if (typeof window === "undefined") {
        throw new Error("Google authorization requires a browser session.");
      }

      popup = window.open(
        "about:blank",
        "reachfly-google-oauth",
        "popup=yes,width=560,height=720,resizable=yes,scrollbars=yes"
      );
      if (!popup) {
        throw new Error("Allow pop-ups for ReachFly to connect Google without leaving this page.");
      }

      popup.document.title = "Connect Google Workspace";
      setBusy("google");
      setError("");
      setMessage("");

      const response = await callApi("startGoogleConnection", {
        args: [{ returnTo: "/app/connections" }],
      });
      const authorizationUrl = String(response?.authorizationUrl || response?.url || "").trim();
      if (!/^https:\/\//i.test(authorizationUrl)) {
        throw new Error("Google authorization could not be opened.");
      }

      popup.location.replace(authorizationUrl);
      popup.focus();

      const watch = window.setInterval(() => {
        if (popup?.closed) {
          window.clearInterval(watch);
          if (mountedRef.current) setBusy("");
        }
      }, 500);
    } catch (requestError) {
      try { popup?.close(); } catch {}
      const text = safeMessage(
        requestError?.message || "Google Workspace connection could not start."
      );
      setError(text);
      setBusy("");
      notify("error", "Google connection unavailable", text);
    }
  }

  async function runAction(connection, action) {
    if (!connection?.id || busy) {
      return;
    }

    const key = `${connection.id}:${action}`;

    if (action === "disconnect") {
      const accepted = window.confirm(
        `Disconnect ${connection.accountEmail || "this account"} from ReachFly?`
      );

      if (!accepted) {
        return;
      }
    }

    try {
      setBusy(key);
      setError("");
      setMessage("");

      if (action === "email") {
        await callApi(
          "testConnectionEmail",
          {
            args: [
              connection.id,
              {},
            ],
          }
        );
        const text = `Email sending is healthy for ${connection.accountEmail || "this account"}.`;
        setMessage(text);
        notify("success", "Email test passed", text);
      } else if (action === "calendar") {
        await callApi(
          "testConnectionCalendar",
          {
            args: [
              connection.id,
              {},
            ],
          }
        );
        const text = `Calendar access is healthy for ${connection.accountEmail || "this account"}.`;
        setMessage(text);
        notify("success", "Calendar test passed", text);
      } else if (action === "disconnect") {
        await callApi(
          "disconnectConnection",
          {
            args: [
              connection.id,
            ],
          }
        );
        const text = `${connection.accountEmail || "The account"} was disconnected.`;
        setMessage(text);
        notify("success", "Connection removed", text);
        await load({ silent: true });
      }
    } catch (requestError) {
      const text = safeMessage(
        requestError?.message || "Connection action failed."
      );

      setError(text);
      notify("error", "Connection action failed", text);
    } finally {
      if (mountedRef.current) {
        setBusy("");
      }
    }
  }

  if (loading) {
    return (
      <>
        <ConnectionsStyles />
        <ConnectionsSkeleton />
      </>
    );
  }

  return (
    <>
      <ConnectionsStyles />

      <main className="rf-integrations-v7">
        <header className="rfi-page-header">
          <div>
            <span className="rfi-eyebrow">Workspace</span>
            <h1>Agent capabilities & integrations</h1>
            <p>
              Connect business systems once, then see exactly which AI agent can use
              each capability for calls, follow-up, booking, and customer workflows.
            </p>
          </div>

          <button
            type="button"
            className="rfi-btn secondary"
            disabled={refreshing}
            onClick={() =>
              void load({
                silent: true,
                successToast: true,
              })
            }
          >
            <RefreshCw
              size={15}
              className={refreshing ? "spin" : ""}
            />
            Refresh
          </button>
        </header>

        {error ? (
          <Notice
            tone="error"
            title="Integrations need attention"
            text={error}
            onClose={() => setError("")}
          />
        ) : null}

        {message ? (
          <Notice
            tone="success"
            title="Integration update"
            text={message}
            onClose={() => setMessage("")}
          />
        ) : null}

        <section className="rfi-summary-grid">
          <SummaryMetric
            label="Connected"
            value={metrics.connected}
            note="Integration types ready"
            icon={<CheckCircle2 size={16} />}
          />
          <SummaryMetric
            label="Needs Attention"
            value={metrics.attention}
            note="Review these connections"
            icon={<Shield size={16} />}
            warning={metrics.attention > 0}
          />
          <SummaryMetric
            label="Connected Accounts"
            value={metrics.accounts}
            note="Email and calendar identities"
            icon={<Globe2 size={16} />}
          />
          <SummaryMetric
            label="AI Agents"
            value={metrics.agents}
            note={`${readyActionAgents} ready for connected actions`}
            icon={<Sparkles size={16} />}
          />
        </section>

        <AgentCapabilityJourney rows={agentCapabilityRows} />

        <section className="rfi-toolbar">
          <div className="rfi-filters">
            {FILTERS.map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
                <span>
                  {key === "all"
                    ? integrationCards.length
                    : integrationCards.filter((card) => card.state.key === key).length}
                </span>
              </button>
            ))}
          </div>

          <label className="rfi-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search integrations..."
              aria-label="Search integrations"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear integration search"
                onClick={() => setQuery("")}
              >
                <X size={11} />
              </button>
            ) : null}
          </label>
        </section>

        {visibleCards.length ? (
          <section className="rfi-market-grid">
            {visibleCards.map((card, index) => (
              <IntegrationCard
                key={card.id}
                card={card}
                index={index}
                onOpen={() => openIntegration(card.id)}
              />
            ))}
          </section>
        ) : (
          <section className="rfi-empty-market">
            <span>
              <Search size={22} />
            </span>
            <h2>No matching integrations</h2>
            <p>
              Clear the current search or status filter to see all available
              workspace connections.
            </p>
            <button
              type="button"
              className="rfi-btn secondary"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </button>
          </section>
        )}

        <section className="rfi-connected-section">
          <header className="rfi-section-head">
            <div>
              <span className="rfi-eyebrow">Connected Accounts</span>
              <h2>Your workspace connections</h2>
              <p>
                Test a connection before assigning it to a workflow or AI Voice
                Agent. Provider credentials remain server-side.
              </p>
            </div>
            <span className="rfi-count-pill">
              {connections.length}
            </span>
          </header>

          {!connections.length ? (
            <div className="rfi-connected-empty">
              <span>
                <Globe2 size={22} />
              </span>
              <h3>No email or calendar account connected yet</h3>
              <p>
                Connect Google Workspace above or open advanced email setup to
                add another business mailbox.
              </p>
              <div>
                <button
                  type="button"
                  className="rfi-btn primary"
                  disabled={busy === "google" || data?.googleConfigured === false}
                  onClick={() => void connectGoogle()}
                >
                  {busy === "google" ? (
                    <RefreshCw size={12} className="spin" />
                  ) : null}
                  Connect Google
                </button>
                <button
                  type="button"
                  className="rfi-btn secondary"
                  onClick={() => openIntegration("custom-email")}
                >
                  Connect another mailbox
                </button>
              </div>
            </div>
          ) : (
            <ConnectionTable
              connections={connections}
              assignmentCounts={assignmentCounts}
              busy={busy}
              onAction={runAction}
              onOpenIntegration={openIntegration}
            />
          )}
        </section>

        <IntegrationModal
          active={activeIntegration}
          onClose={closeIntegration}
          busy={modalBusy}
          error={modalError}
          emailForm={emailForm}
          setEmailForm={setEmailForm}
          chooseEmailProvider={chooseInlineEmailProvider}
          onSaveEmail={saveInlineEmail}
          whatsapp={whatsapp}
          onConnectWhatsApp={connectWhatsAppInline}
          onDisconnectWhatsApp={disconnectWhatsAppInline}
          calendlyForm={calendlyForm}
          setCalendlyForm={setCalendlyForm}
          onConnectCalendly={connectCalendlyInline}
        />

        <section className="rfi-security-note">
          <span>
            <Shield size={15} />
          </span>
          <div>
            <strong>Controlled workspace access</strong>
            <p>
              ReachFly stores connection credentials on the server and exposes
              only the actions each workflow needs. Disconnecting an account
              removes it from future assignments without fabricating a local
              connection state.
            </p>
          </div>
          <Link to="/app/settings">
            Workspace settings
            <ChevronRight size={12} />
          </Link>
        </section>
      </main>
    </>
  );
}

function AgentCapabilityJourney({ rows }) {
  if (!rows.length) {
    return (
      <section className="rfi-agent-journey empty">
        <div className="rfi-agent-journey-head">
          <div>
            <span className="rfi-eyebrow">Connected journey</span>
            <h2>Give an AI agent the tools it needs</h2>
            <p>
              Create an agent first, then connect its number, email, and booking calendar here.
            </p>
          </div>
          <Link className="rfi-btn primary" to="/app/ai-workforce">
            Create AI agent
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="rfi-journey-track muted">
          <JourneyNode icon={<Bot size={16} />} label="AI Agent" value="Create agent" ready={false} />
          <JourneyArrow />
          <JourneyNode icon={<Brain size={16} />} label="Business Brain" value="Agent context" ready={false} />
          <JourneyArrow />
          <JourneyNode icon={<Phone size={16} />} label="Business Number" value="Inbound / outbound" ready={false} />
          <JourneyArrow />
          <JourneyNode icon={<Workflow size={16} />} label="Actions" value="Email + booking" ready={false} />
        </div>
      </section>
    );
  }

  return (
    <section className="rfi-agent-journey">
      <div className="rfi-agent-journey-head">
        <div>
          <span className="rfi-eyebrow">Connected journey</span>
          <h2>What each AI agent can actually do</h2>
          <p>
            This is the live relationship between agent, business number, email, calendar,
            and the actions available during a customer conversation.
          </p>
        </div>
        <Link className="rfi-btn secondary" to="/app/ai-workforce">
          Manage agents
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className="rfi-agent-capability-list">
        {rows.map((row) => (
          <article className="rfi-agent-capability-row" key={row.id}>
            <header>
              <div className="rfi-agent-avatar">
                <Bot size={16} />
              </div>
              <div className="rfi-agent-copy">
                <strong>{row.name}</strong>
                <span>{row.modeLabel}</span>
              </div>
              <span className={`rfi-agent-ready ${row.actionReady ? "ready" : "partial"}`}>
                {row.actionReady ? "Action ready" : `${row.missing.length} setup item${row.missing.length === 1 ? "" : "s"}`}
              </span>
            </header>

            <div className="rfi-journey-track compact">
              <JourneyNode
                icon={<Brain size={15} />}
                label="Business Brain"
                value={row.businessBrainReady ? "Context ready" : "Add business context"}
                ready={row.businessBrainReady}
              />
              <JourneyArrow />
              <JourneyNode
                icon={<Phone size={15} />}
                label="Business Number"
                value={row.fromNumber || "Not assigned"}
                ready={Boolean(row.fromNumber)}
                mono={Boolean(row.fromNumber)}
              />
              <JourneyArrow />
              <JourneyNode
                icon={<Mail size={15} />}
                label="Email follow-up"
                value={row.emailLabel}
                ready={row.emailReady}
              />
              <JourneyArrow />
              <JourneyNode
                icon={<Calendar size={15} />}
                label="Booking"
                value={row.calendarLabel}
                ready={row.calendarReady}
              />
            </div>

            <footer>
              <span>
                <Workflow size={12} />
                {row.actionSummary}
              </span>
              <Link to={`/app/ai-workforce?agent=${encodeURIComponent(row.id)}`}>
                Configure agent
                <ChevronRight size={11} />
              </Link>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function JourneyNode({ icon, label, value, ready, mono = false }) {
  return (
    <div className={`rfi-journey-node ${ready ? "ready" : "missing"}`}>
      <span>{ready ? <CheckCircle2 size={13} /> : icon}</span>
      <div>
        <small>{label}</small>
        <strong className={mono ? "mono" : ""}>{value}</strong>
      </div>
    </div>
  );
}

function JourneyArrow() {
  return (
    <span className="rfi-journey-arrow" aria-hidden="true">
      <ArrowRight size={14} />
    </span>
  );
}

function IntegrationCard({
  card,
  index,
  onOpen,
}) {
  return (
    <article
      className="rfi-card clickable"
      style={{
        "--rfi-index": index,
      }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.();
        }
      }}
    >
      <header>
        <ProviderIcon type={card.icon} />
        <StateBadge state={card.state} />
      </header>

      <div className="rfi-card-copy">
        <h2>{card.title}</h2>
        <p>{card.description}</p>
      </div>

      <div className="rfi-card-details">
        {card.account ? (
          <span title={card.account}>
            {card.account}
          </span>
        ) : null}

        {card.assigned > 0 ? (
          <span>
            {card.assigned} agent{card.assigned === 1 ? "" : "s"} assigned
          </span>
        ) : null}
      </div>

      <footer>
        <div>
          <Clock3 size={11} />
          <span>{card.meta}</span>
        </div>

        <div className="rfi-card-actions">
          {card.settings ? (
            <button
              type="button"
              className="icon"
              aria-label={`View ${card.title} connection details`}
              onClick={(event) => {
                event.stopPropagation();
                card.settings?.();
              }}
            >
              <Settings size={14} />
            </button>
          ) : null}

          {card.action?.to ? (
            <Link
              className="text"
              to={card.action.to}
              onClick={(event) => event.stopPropagation()}
            >
              {card.action.label}
            </Link>
          ) : card.action ? (
            <button
              type="button"
              className="text"
              disabled={card.action.disabled || card.action.loading}
              onClick={(event) => {
                event.stopPropagation();
                card.action.onClick?.();
              }}
            >
              {card.action.loading ? (
                <RefreshCw size={11} className="spin" />
              ) : null}
              {card.action.loading ? "Working…" : card.action.label}
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

function IntegrationModal({
  active,
  onClose,
  busy,
  error,
  emailForm,
  setEmailForm,
  chooseEmailProvider,
  onSaveEmail,
  whatsapp,
  onConnectWhatsApp,
  onDisconnectWhatsApp,
  calendlyForm,
  setCalendlyForm,
  onConnectCalendly,
}) {
  const whatsappQrToken = firstString(
    whatsapp?.qr,
    whatsapp?.qrCode,
    whatsapp?.qrcode,
    whatsapp?.qrDataUrl
  );
  const [whatsappQrImage, setWhatsappQrImage] = useState("");
  const [whatsappQrRenderError, setWhatsappQrRenderError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderWhatsAppQr() {
      setWhatsappQrRenderError("");

      if (active !== "whatsapp" || whatsapp?.ready || !whatsappQrToken) {
        setWhatsappQrImage("");
        return;
      }

      if (/^data:image\//i.test(whatsappQrToken)) {
        setWhatsappQrImage(whatsappQrToken);
        return;
      }

      try {
        // whatsapp-web.js supplies the raw QR token. Render the image in the
        // browser so the API never spends time generating PNG/base64 QR data.
        const dataUrl = await QRCode.toDataURL(whatsappQrToken, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
          color: {
            dark: "#111827",
            light: "#ffffff",
          },
        });

        if (!cancelled) setWhatsappQrImage(dataUrl);
      } catch (error) {
        if (!cancelled) {
          setWhatsappQrImage("");
          setWhatsappQrRenderError(
            safeMessage(error?.message || "Could not render the WhatsApp QR code.")
          );
        }
      }
    }

    void renderWhatsAppQr();
    return () => {
      cancelled = true;
    };
  }, [active, whatsapp?.ready, whatsappQrToken]);

  if (!active) return null;

  const titles = {
    "custom-email": ["Custom Email", "Connect a mailbox without leaving Integrations."],
    whatsapp: ["WhatsApp Business", "Link a WhatsApp device directly from this page."],
    calendly: ["Calendly", "Connect a workspace-specific Calendly account for live booking."],
  };
  const [title, subtitle] = titles[active] || ["Integration", "Connect this account to ReachFly."];

  return (
    <div
      className="rfi-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="rfi-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} connection`}
      >
        <header className="rfi-modal-head">
          <div>
            <span className="rfi-eyebrow">Connect account</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            type="button"
            className="rfi-modal-close"
            aria-label="Close integration dialog"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        {error ? (
          <div className="rfi-modal-error" role="alert">
            <X size={13} />
            <span>{error}</span>
          </div>
        ) : null}

        {active === "custom-email" ? (
          <div className="rfi-modal-body">
            <div className="rfi-provider-choice">
              {Object.entries(INLINE_EMAIL_PROVIDERS).map(([key, provider]) => (
                <button
                  key={key}
                  type="button"
                  className={emailForm.provider === key ? "active" : ""}
                  onClick={() => chooseEmailProvider(key)}
                >
                  {provider.label}
                </button>
              ))}
            </div>

            <div className="rfi-form-grid two">
              <InlineField
                label="Sender name"
                value={emailForm.fromName}
                placeholder="ReachFlyAI"
                onChange={(value) =>
                  setEmailForm((current) => ({ ...current, fromName: value }))
                }
              />
              <InlineField
                label="Mailbox email"
                value={emailForm.fromEmail}
                type="email"
                placeholder="you@company.com"
                onChange={(value) =>
                  setEmailForm((current) => ({ ...current, fromEmail: value }))
                }
              />
            </div>

            <InlineField
              label={emailForm.provider === "gmail" ? "Google app password" : "Mailbox password / app password"}
              value={emailForm.password}
              type="password"
              placeholder="Enter the credential used by SMTP and IMAP"
              onChange={(value) =>
                setEmailForm((current) => ({ ...current, password: value }))
              }
            />

            <details className="rfi-advanced-email" open={emailForm.provider === "custom"}>
              <summary>Server settings</summary>
              <div className="rfi-form-grid two">
                <InlineField
                  label="SMTP host"
                  value={emailForm.smtpHost}
                  placeholder="smtp.example.com"
                  onChange={(value) =>
                    setEmailForm((current) => ({ ...current, smtpHost: value }))
                  }
                />
                <InlineField
                  label="SMTP port"
                  value={emailForm.smtpPort}
                  type="number"
                  placeholder="587"
                  onChange={(value) =>
                    setEmailForm((current) => ({ ...current, smtpPort: value }))
                  }
                />
                <InlineField
                  label="IMAP host"
                  value={emailForm.imapHost}
                  placeholder="imap.example.com"
                  onChange={(value) =>
                    setEmailForm((current) => ({ ...current, imapHost: value }))
                  }
                />
                <InlineField
                  label="IMAP port"
                  value={emailForm.imapPort}
                  type="number"
                  placeholder="993"
                  onChange={(value) =>
                    setEmailForm((current) => ({ ...current, imapPort: value }))
                  }
                />
              </div>
              <div className="rfi-toggle-line">
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(emailForm.smtpSecure)}
                    onChange={(event) =>
                      setEmailForm((current) => ({ ...current, smtpSecure: event.target.checked }))
                    }
                  />
                  SMTP uses TLS immediately
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(emailForm.imapSecure)}
                    onChange={(event) =>
                      setEmailForm((current) => ({ ...current, imapSecure: event.target.checked }))
                    }
                  />
                  IMAP uses TLS
                </label>
              </div>
            </details>

            <div className="rfi-modal-note">
              <Shield size={14} />
              <span>
                ReachFly verifies SMTP and IMAP before saving the account. Credentials stay on the server.
              </span>
            </div>
          </div>
        ) : null}

        {active === "whatsapp" ? (
          <div className="rfi-modal-body">
            {whatsapp?.ready ? (
              <div className="rfi-whatsapp-connected">
                <span><CheckCircle2 size={24} /></span>
                <div>
                  <strong>WhatsApp is connected</strong>
                  <p>{whatsapp.phone ? `Linked number: ${formatPhone(whatsapp.phone)}` : "The linked session is ready for messaging workflows."}</p>
                </div>
              </div>
            ) : whatsappQrImage ? (
              <div className="rfi-whatsapp-qr">
                <img src={whatsappQrImage} alt="WhatsApp linking QR code" />
                <div>
                  <strong>Scan from WhatsApp</strong>
                  <p>Open WhatsApp → Linked devices → Link a device, then scan this QR code.</p>
                  <small>This dialog checks the connection automatically every few seconds.</small>
                </div>
              </div>
            ) : (
              <div className="rfi-whatsapp-empty">
                <MessageCircle size={28} />
                <strong>{whatsappQrToken ? "Preparing QR code…" : "Generate a linking QR code"}</strong>
                <p>
                  {whatsappQrRenderError ||
                    (whatsappQrToken
                      ? "The WhatsApp Web token is ready. ReachFly is rendering it securely in your browser."
                      : "No WhatsApp password is entered into ReachFly. Start linking, then scan the QR code from your phone.")}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {active === "calendly" ? (
          <div className="rfi-modal-body">
            <InlineField
              label="Calendly personal access token"
              value={calendlyForm.accessToken}
              type="password"
              placeholder="Paste the token from Calendly Integrations"
              onChange={(value) =>
                setCalendlyForm((current) => ({ ...current, accessToken: value }))
              }
            />
            <InlineField
              label="Event scheduling URL"
              value={calendlyForm.eventUrl}
              type="url"
              placeholder="https://calendly.com/your-name/30min"
              onChange={(value) =>
                setCalendlyForm((current) => ({ ...current, eventUrl: value }))
              }
            />
            <div className="rfi-modal-note">
              <Shield size={14} />
              <span>
                The backend validates the token and confirms that this event link belongs to the connected Calendly account before saving it.
              </span>
            </div>
          </div>
        ) : null}

        <footer className="rfi-modal-footer">
          <button
            type="button"
            className="rfi-btn secondary"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            Cancel
          </button>

          {active === "custom-email" ? (
            <button
              type="button"
              className="rfi-btn primary"
              disabled={Boolean(busy)}
              onClick={() => void onSaveEmail()}
            >
              {busy === "email" ? <RefreshCw size={12} className="spin" /> : <Mail size={13} />}
              {busy === "email" ? "Verifying…" : "Verify & connect"}
            </button>
          ) : null}

          {active === "whatsapp" ? (
            whatsapp?.ready ? (
              <button
                type="button"
                className="rfi-btn danger"
                disabled={Boolean(busy)}
                onClick={() => void onDisconnectWhatsApp()}
              >
                {busy === "whatsapp" ? <RefreshCw size={12} className="spin" /> : null}
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="rfi-btn primary"
                disabled={Boolean(busy)}
                onClick={() => void onConnectWhatsApp()}
              >
                {busy === "whatsapp" ? <RefreshCw size={12} className="spin" /> : <MessageCircle size={13} />}
                {whatsappQrToken ? "Refresh QR" : "Start linking"}
              </button>
            )
          ) : null}

          {active === "calendly" ? (
            <button
              type="button"
              className="rfi-btn primary"
              disabled={Boolean(busy)}
              onClick={() => void onConnectCalendly()}
            >
              {busy === "calendly" ? <RefreshCw size={12} className="spin" /> : <Calendar size={13} />}
              {busy === "calendly" ? "Connecting…" : "Connect Calendly"}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function InlineField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
}) {
  return (
    <label className="rfi-inline-field">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        autoComplete={type === "password" ? "new-password" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ProviderIcon({
  type,
}) {
  if (type === "gmail") {
    return (
      <span className="rfi-provider-icon gmail">
        <Mail size={18} />
      </span>
    );
  }

  if (type === "calendar") {
    return (
      <span className="rfi-provider-icon calendar">
        <Calendar size={18} />
      </span>
    );
  }

  if (type === "whatsapp") {
    return (
      <span className="rfi-provider-icon whatsapp">
        <MessageCircle size={18} />
      </span>
    );
  }

  if (type === "calendly") {
    return (
      <span className="rfi-provider-icon calendly">
        <Calendar size={18} />
      </span>
    );
  }

  if (type === "mail") {
    return (
      <span className="rfi-provider-icon mail">
        <Mail size={18} />
      </span>
    );
  }

  return (
    <span className="rfi-provider-icon google">
      <strong>G</strong>
    </span>
  );
}

function StateBadge({
  state,
}) {
  return (
    <span className={`rfi-state ${state.tone}`}>
      <i />
      {state.label}
    </span>
  );
}

function SummaryMetric({
  label,
  value,
  note,
  icon,
  warning = false,
}) {
  return (
    <article className={`rfi-summary-card ${warning ? "warning" : ""}`}>
      <header>
        <span>{label}</span>
        <i>{icon}</i>
      </header>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Notice({
  tone,
  title,
  text,
  onClose,
}) {
  return (
    <section
      className={`rfi-notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span>
        {tone === "success" ? (
          <CheckCircle2 size={14} />
        ) : (
          <X size={14} />
        )}
      </span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={onClose}
      >
        <X size={12} />
      </button>
    </section>
  );
}

function ConnectionTable({
  connections,
  assignmentCounts,
  busy,
  onAction,
  onOpenIntegration,
}) {
  return (
    <>
      <div className="rfi-table-wrap">
        <table className="rfi-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Capabilities</th>
              <th>Assigned</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((connection, index) => (
              <ConnectionRow
                key={connection.id || index}
                connection={connection}
                assignmentCounts={assignmentCounts}
                busy={busy}
                index={index}
                onAction={onAction}
                onOpenIntegration={onOpenIntegration}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="rfi-mobile-connections">
        {connections.map((connection, index) => (
          <ConnectionMobileCard
            key={connection.id || index}
            connection={connection}
            assignmentCounts={assignmentCounts}
            busy={busy}
            index={index}
            onAction={onAction}
            onOpenIntegration={onOpenIntegration}
          />
        ))}
      </div>
    </>
  );
}

function ConnectionRow({
  connection,
  assignmentCounts,
  busy,
  index,
  onAction,
  onOpenIntegration,
}) {
  const state = getProviderState({
    configured: true,
    connection,
  });
  const assigned = getConnectionAssignmentCount(connection, assignmentCounts);

  return (
    <tr
      style={{
        "--rfi-index": index,
      }}
    >
      <td>
        <ConnectionIdentity connection={connection} />
      </td>
      <td>
        <CapabilityList connection={connection} />
      </td>
      <td>
        <span className="rfi-assigned-count">
          {assigned}
          <small>agent{assigned === 1 ? "" : "s"}</small>
        </span>
      </td>
      <td>
        <StateBadge state={state} />
      </td>
      <td>
        <ConnectionActions
          connection={connection}
          busy={busy}
          onAction={onAction}
          onOpenIntegration={onOpenIntegration}
        />
      </td>
    </tr>
  );
}

function ConnectionMobileCard({
  connection,
  assignmentCounts,
  busy,
  index,
  onAction,
  onOpenIntegration,
}) {
  const state = getProviderState({
    configured: true,
    connection,
  });
  const assigned = getConnectionAssignmentCount(connection, assignmentCounts);

  return (
    <article
      className="rfi-mobile-connection-card"
      style={{
        "--rfi-index": index,
      }}
    >
      <header>
        <ConnectionIdentity connection={connection} />
        <StateBadge state={state} />
      </header>

      <div className="rfi-mobile-capabilities">
        <CapabilityList connection={connection} />
      </div>

      <div className="rfi-mobile-assignment">
        <span>
          {assigned} AI Voice Agent{assigned === 1 ? "" : "s"} assigned
        </span>
      </div>

      <ConnectionActions
        connection={connection}
        busy={busy}
        onAction={onAction}
        onOpenIntegration={onOpenIntegration}
      />
    </article>
  );
}

function ConnectionIdentity({
  connection,
}) {
  const type = getConnectionTypeLabel(connection);

  return (
    <div className="rfi-connection-id">
      <ProviderIcon
        type={
          isGoogleConnection(connection)
            ? "google"
            : isCustomEmailConnection(connection)
              ? "mail"
              : isCalendlyConnection(connection)
                ? "calendly"
                : "mail"
        }
      />
      <div>
        <strong>
          {connection.accountEmail || connection.displayName || "Connected account"}
        </strong>
        <small>{type}</small>
      </div>
    </div>
  );
}

function CapabilityList({
  connection,
}) {
  const items = [];

  if (connection.capabilities?.emailSend) {
    items.push(["email", "Email"]);
  }

  if (connection.capabilities?.calendar) {
    items.push(["calendar", "Calendar"]);
  }

  if (isCalendlyConnection(connection)) {
    items.push(["calendar", "Scheduling"]);
  }

  if (!items.length) {
    return (
      <span className="rfi-capability muted">
        Connected
      </span>
    );
  }

  return (
    <div className="rfi-capability-list">
      {items.map(([key, label]) => (
        <span
          key={`${connection.id}-${key}`}
          className={`rfi-capability ${key}`}
        >
          {key === "calendar" ? (
            <Calendar size={10} />
          ) : (
            <Mail size={10} />
          )}
          {label}
        </span>
      ))}
    </div>
  );
}

function ConnectionActions({
  connection,
  busy,
  onAction,
  onOpenIntegration,
}) {
  const isBusy = Boolean(busy);
  const emailBusy = busy === `${connection.id}:email`;
  const calendarBusy = busy === `${connection.id}:calendar`;
  const disconnectBusy = busy === `${connection.id}:disconnect`;

  return (
    <div className="rfi-row-actions">
      {connection.capabilities?.emailSend ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void onAction(connection, "email")}
        >
          {emailBusy ? <RefreshCw size={10} className="spin" /> : null}
          {emailBusy ? "Testing…" : "Test email"}
        </button>
      ) : null}

      {connection.capabilities?.calendar ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void onAction(connection, "calendar")}
        >
          {calendarBusy ? <RefreshCw size={10} className="spin" /> : null}
          {calendarBusy ? "Testing…" : "Test calendar"}
        </button>
      ) : null}

      {isCustomEmailConnection(connection) ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onOpenIntegration?.("custom-email")}
        >
          Add mailbox
        </button>
      ) : isGoogleConnection(connection) || isCalendlyConnection(connection) ? (
        <button
          type="button"
          className="danger"
          disabled={isBusy}
          onClick={() => void onAction(connection, "disconnect")}
        >
          {disconnectBusy ? <RefreshCw size={10} className="spin" /> : null}
          {disconnectBusy ? "Removing…" : "Disconnect"}
        </button>
      ) : null}
    </div>
  );
}

function ConnectionsSkeleton() {
  return (
    <main
      className="rf-integrations-v7"
      aria-busy="true"
      aria-label="Loading integrations"
    >
      <header className="rfi-page-header">
        <div>
          <span className="rfi-eyebrow">Workspace</span>
          <h1>Integration Marketplace</h1>
          <p>Loading workspace connections…</p>
        </div>
      </header>

      <section className="rfi-summary-grid loading">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index}>
            <i />
            <i />
            <i />
          </article>
        ))}
      </section>

      <section className="rfi-market-grid loading">
        {Array.from({ length: 6 }).map((_, index) => (
          <article key={index}>
            <i />
            <i />
            <i />
            <i />
          </article>
        ))}
      </section>
    </main>
  );
}

function normalizeConnectionDashboard(value) {
  const source =
    unwrapData(value);

  return {
    ...source,
    connections:
      Array.isArray(
        source.connections
      )
        ? source.connections
        : [],
    emailConnections:
      Array.isArray(
        source.emailConnections
      )
        ? source.emailConnections
        : [],
    calendarConnections:
      Array.isArray(
        source.calendarConnections
      )
        ? source.calendarConnections
        : [],
    googleConfigured:
      source.googleConfigured !==
      false,
  };
}

function normalizeVoiceDashboard(value) {
  const source =
    unwrapData(value);

  return source &&
    typeof source ===
      "object"
    ? source
    : {};
}

function normalizeConnections(value) {
  const source =
    normalizeConnectionDashboard(
      value
    );

  const primary =
    source.connections;

  const email =
    source.emailConnections;

  const calendar =
    source.calendarConnections;

  const byId = new Map();

  [...primary, ...email, ...calendar].forEach((connection, index) => {
    if (!connection || typeof connection !== "object") {
      return;
    }

    const normalized = {
      ...connection,
      id:
        connection.id ||
        connection.connectionId ||
        `${connection.type || "connection"}-${connection.accountEmail || index}`,
      status: normalizeStatus(connection.status || "connected"),
      capabilities: {
        ...(connection.capabilities || {}),
        emailSend:
          connection.capabilities?.emailSend === true ||
          connection.emailSend === true ||
          connection.canSendEmail === true,
        calendar:
          connection.capabilities?.calendar === true ||
          connection.calendar === true ||
          connection.canUseCalendar === true,
      },
    };

    const key = String(normalized.id);
    const previous = byId.get(key);

    if (!previous) {
      byId.set(key, normalized);
      return;
    }

    byId.set(key, {
      ...previous,
      ...normalized,
      capabilities: {
        ...previous.capabilities,
        ...normalized.capabilities,
        emailSend:
          previous.capabilities?.emailSend === true ||
          normalized.capabilities?.emailSend === true,
        calendar:
          previous.capabilities?.calendar === true ||
          normalized.capabilities?.calendar === true,
      },
    });
  });

  return [...byId.values()].sort((left, right) => {
    if (isHealthyConnection(left) !== isHealthyConnection(right)) {
      return isHealthyConnection(left) ? -1 : 1;
    }

    return (
      timestamp(right.updatedAt || right.createdAt) -
      timestamp(left.updatedAt || left.createdAt)
    );
  });
}

function normalizeWhatsAppStatus(value) {
  const source = unwrapData(value);
  const status = normalizeStatus(
    source.status ||
      source.state ||
      source.connectionStatus ||
      source.sessionStatus
  );

  const ready =
    source.ready === true ||
    source.connected === true ||
    source.authenticated === true ||
    ["ready", "connected", "authenticated", "open"].includes(status);

  const phone =
    firstString(
      source.phone,
      source.phoneNumber,
      source.number,
      source.account?.phone,
      source.account?.phoneNumber,
      source.me?.id?.user
    ) || "";

  return {
    ...source,
    status,
    ready,
    phone,
    checkedAt: new Date().toISOString(),
  };
}

function unwrapData(value) {
  let current = value;

  for (let index = 0; index < 4; index += 1) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      break;
    }

    if (current.data && typeof current.data === "object") {
      current = current.data;
      continue;
    }

    if (
      current.status &&
      typeof current.status === "object" &&
      !Array.isArray(current.status)
    ) {
      current = {
        ...current,
        ...current.status,
      };
    }

    break;
  }

  return current && typeof current === "object" ? current : {};
}

function normalizeAgents(value) {
  const source =
    normalizeVoiceDashboard(
      value
    );

  if (
    Array.isArray(
      source.agents
    )
  ) {
    return source.agents.filter(
      Boolean
    );
  }

  if (source.agent) {
    return [
      source.agent,
    ];
  }

  return [];
}

function buildAgentCapabilityRow(agent, connections) {
  const id = firstString(agent.id, agent.agentId, agent.elevenLabsAgentId, agent.name) || "agent";
  const name = firstString(agent.name, agent.displayName, agent.reachFlyName) || "ReachFly AI Agent";
  const mode = normalizeStatus(agent.callingMode || agent.mode || "outbound");
  const modeLabel = mode === "both"
    ? "Inbound + outbound"
    : mode === "inbound"
      ? "Inbound"
      : "Outbound";

  const emailId = firstString(agent.emailConnectionId, agent.emailConnection?.id);
  const calendarId = firstString(agent.calendarConnectionId, agent.calendarConnection?.id);
  const emailConnection = connections.find((item) => String(item.id) === String(emailId));
  const calendarConnection = connections.find((item) => String(item.id) === String(calendarId));

  const emailReady = Boolean(emailId && emailConnection && isHealthyConnection(emailConnection));
  const calendarReady = Boolean(calendarId && calendarConnection && isHealthyConnection(calendarConnection));
  const fromNumber = firstString(agent.fromNumber, agent.phoneNumber, agent.number);
  const businessBrainReady = Boolean(
    firstString(
      agent.businessKnowledge,
      agent.businessMemory,
      agent.systemPrompt,
      agent.context,
      agent.companyDescription,
      agent.businessProfile?.summary
    )
  );

  const sendEmail = agent.sendEmail === true || agent.permissions?.sendEmail === true || Boolean(emailId);
  const bookMeeting = agent.bookMeeting === true || agent.permissions?.bookMeeting === true || Boolean(calendarId);
  const missing = [];
  if (!businessBrainReady) missing.push("Business Brain");
  if (!fromNumber) missing.push("business number");
  if (sendEmail && !emailReady) missing.push("email");
  if (bookMeeting && !calendarReady) missing.push("calendar");

  const actions = [];
  if (sendEmail && emailReady) actions.push("send follow-up email");
  if (bookMeeting && calendarReady) actions.push("book meetings");
  if (mode === "inbound" || mode === "both") actions.push("handle inbound calls");
  if (mode === "outbound" || mode === "both" || !mode) actions.push("run outbound calls");

  return {
    id,
    name,
    modeLabel,
    fromNumber,
    businessBrainReady,
    emailReady,
    calendarReady,
    emailLabel: emailReady
      ? firstString(emailConnection.accountEmail, emailConnection.label, "Connected")
      : sendEmail
        ? "Connection required"
        : "Not enabled",
    calendarLabel: calendarReady
      ? firstString(calendarConnection.accountEmail, calendarConnection.label, "Connected")
      : bookMeeting
        ? "Connection required"
        : "Not enabled",
    actionReady: businessBrainReady && Boolean(fromNumber) && (!sendEmail || emailReady) && (!bookMeeting || calendarReady),
    missing,
    actionSummary: actions.length ? `Can ${actions.join(", ")}` : "Call handling is ready once capabilities are assigned",
  };
}

function buildAssignmentCounts(agents) {
  const email = new Map();
  const calendar = new Map();

  agents.forEach((agent) => {
    const emailId = firstString(
      agent.emailConnectionId,
      agent.emailConnection?.id
    );
    const calendarId = firstString(
      agent.calendarConnectionId,
      agent.calendarConnection?.id
    );

    if (emailId) {
      email.set(String(emailId), (email.get(String(emailId)) || 0) + 1);
    }

    if (calendarId) {
      calendar.set(
        String(calendarId),
        (calendar.get(String(calendarId)) || 0) + 1
      );
    }
  });

  return {
    email,
    calendar,
  };
}

function sumAssignedForConnections(
  connections,
  assignmentCounts,
  capability = "both"
) {
  const ids = new Set(
    connections.map((connection) => String(connection.id)).filter(Boolean)
  );

  const agentKeys = new Set();

  if (capability !== "calendar") {
    assignmentCounts.email.forEach((count, id) => {
      if (ids.has(String(id))) {
        for (let index = 0; index < count; index += 1) {
          agentKeys.add(`email:${id}:${index}`);
        }
      }
    });
  }

  if (capability !== "email") {
    assignmentCounts.calendar.forEach((count, id) => {
      if (ids.has(String(id))) {
        for (let index = 0; index < count; index += 1) {
          agentKeys.add(`calendar:${id}:${index}`);
        }
      }
    });
  }

  return agentKeys.size;
}

function getConnectionAssignmentCount(connection, assignmentCounts) {
  const id = String(connection.id || "");
  const email = assignmentCounts.email.get(id) || 0;
  const calendar = assignmentCounts.calendar.get(id) || 0;

  return Math.max(email, calendar, email + calendar > 0 ? 1 : 0);
}

function getProviderState({
  configured,
  connection,
}) {
  if (configured === false) {
    return {
      key: "attention",
      label: "Needs attention",
      tone: "warning",
    };
  }

  if (!connection) {
    return {
      key: "available",
      label: "Available",
      tone: "muted",
    };
  }

  if (isHealthyConnection(connection)) {
    return {
      key: "connected",
      label: "Connected",
      tone: "connected",
    };
  }

  return {
    key: "attention",
    label: "Needs attention",
    tone: "warning",
  };
}

function getCapabilityState(
  connection,
  capability,
  configured
) {
  if (configured === false) {
    return {
      key: "attention",
      label: "Needs attention",
      tone: "warning",
    };
  }

  if (!connection) {
    return {
      key: "available",
      label: "Available",
      tone: "muted",
    };
  }

  if (
    isHealthyConnection(connection) &&
    connection.capabilities?.[capability] === true
  ) {
    return {
      key: "connected",
      label: "Connected",
      tone: "connected",
    };
  }

  return {
    key: "attention",
    label: "Needs attention",
    tone: "warning",
  };
}

function getWhatsAppState(whatsapp) {
  if (!whatsapp) {
    return {
      key: "available",
      label: "Available",
      tone: "muted",
    };
  }

  if (whatsapp.ready) {
    return {
      key: "connected",
      label: "Connected",
      tone: "connected",
    };
  }

  if (
    [
      "error",
      "failed",
      "disconnected",
      "logged_out",
      "unauthorized",
    ].includes(whatsapp.status)
  ) {
    return {
      key: "attention",
      label: "Needs attention",
      tone: "warning",
    };
  }

  return {
    key: "available",
    label: "Available",
    tone: "muted",
  };
}

function isHealthyConnection(connection) {
  return [
    "connected",
    "active",
    "ready",
    "healthy",
  ].includes(normalizeStatus(connection?.status));
}

function isGoogleConnection(connection) {
  const type = normalizeStatus(connection?.type);
  const provider = normalizeStatus(connection?.provider);
  const display = String(connection?.displayName || "").toLowerCase();

  return (
    type.includes("google") ||
    provider.includes("google") ||
    display.includes("google")
  );
}

function isCustomEmailConnection(connection) {
  const type = normalizeStatus(connection?.type);

  return (
    type === "emailbox_smtp" ||
    type.includes("smtp") ||
    type.includes("imap") ||
    type.includes("emailbox")
  );
}

function isCalendlyConnection(connection) {
  const type = normalizeStatus(connection?.type);
  const provider = normalizeStatus(connection?.provider);
  const display = String(connection?.displayName || "").toLowerCase();

  return (
    type.includes("calendly") ||
    provider.includes("calendly") ||
    display.includes("calendly")
  );
}

function providerMeta(connection) {
  if (!connection) {
    return "Not connected";
  }

  const date = connection.updatedAt || connection.lastSyncedAt || connection.createdAt;

  if (date) {
    return `Updated ${formatRelativeTime(date)}`;
  }

  return isHealthyConnection(connection)
    ? "Connected to workspace"
    : "Connection needs review";
}

function getConnectionTypeLabel(connection) {
  if (isGoogleConnection(connection)) {
    return "Google Workspace";
  }

  if (isCustomEmailConnection(connection)) {
    return "Custom Email";
  }

  if (isCalendlyConnection(connection)) {
    return "Calendly";
  }

  return firstString(
    connection.displayName,
    titleCase(connection.type),
    "Workspace connection"
  );
}

function firstString(...values) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    const text = String(value).trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function timestamp(value) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatRelativeTime(value) {
  if (!value) {
    return "recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  const diff = Date.now() - date.getTime();

  if (diff < 0) {
    return date.toLocaleDateString();
  }

  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 14) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPhone(value) {
  const text = String(value || "").trim();
  const digits = text.replace(/\D+/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return text || "Connected number";
}

async function callApi(
  methodName,
  {
    optional = false,
    args = [],
  } = {}
) {
  const method =
    api?.[methodName];

  if (
    typeof method !==
    "function"
  ) {
    if (optional) {
      return null;
    }

    throw new Error(
      `ReachFly API method "${methodName}" is unavailable in this frontend build.`
    );
  }

  return method(
    ...args
  );
}

function clearGoogleCallbackQuery() {
  try {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const url =
      new URL(
        window.location.href
      );

    [
      "google_connection",
      "google_connection_message",
      "reason",
      "code",
      "state",
    ].forEach(
      (key) =>
        url.searchParams.delete(
          key
        )
    );

    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    // Callback cleanup must never break the page.
  }
}

function safeMessage(value) {
  return String(value || "")
    .replace(/Emailbox/gi, "email account")
    .replace(/ElevenLabs/gi, "voice runtime")
    .replace(/Telnyx/gi, "calling provider")
    .replace(/\bSIP\b/gi, "voice connection");
}

function notify(
  type,
  title,
  message
) {
  if (typeof window === "undefined") {
    return;
  }

  if (
    window.reachflyToast &&
    typeof window.reachflyToast[type] === "function"
  ) {
    window.reachflyToast[type](title, message);
    return;
  }

  window.dispatchEvent(
    new CustomEvent("reachfly:toast", {
      detail: {
        type,
        title,
        message,
      },
    })
  );
}

function ConnectionsStyles() {
  return (
    <style>{`
      .rf-integrations-v7{
        --rfi-card:#ffffff;
        --rfi-soft:#f3f4f5;
        --rfi-soft2:#eceeef;
        --rfi-text:#191c1d;
        --rfi-text2:#464554;
        --rfi-muted:#767586;
        --rfi-line:#e3e5e7;
        --rfi-primary:#4648d4;
        --rfi-primary-dark:#3537bb;
        --rfi-primary-soft:#e8e9ff;
        --rfi-violet:#6b38d4;
        --rfi-violet-soft:#f0eaff;
        --rfi-success:#087a51;
        --rfi-success-soft:#dff8eb;
        --rfi-warning:#9a3100;
        --rfi-warning-soft:#ffdeda;
        --rfi-danger:#ba1a1a;
        --rfi-danger-soft:#ffedeb;
        --rfi-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 46px;
        color:var(--rfi-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfiPageIn 260ms var(--rfi-ease);
      }

      .rf-integrations-v7 *,
      .rf-integrations-v7 *::before,
      .rf-integrations-v7 *::after{
        box-sizing:border-box;
      }

      .rf-integrations-v7 a{
        color:inherit;
      }

      .rf-integrations-v7 .spin{
        animation:rfiSpin 800ms linear infinite;
      }

      @keyframes rfiPageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfiFadeUp{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfiSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfiShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfi-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:18px;
      }

      .rfi-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfi-primary);
        font-size:9px;
        font-weight:750;
        line-height:13px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfi-page-header h1{
        margin:0;
        color:var(--rfi-text);
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfi-page-header p{
        max-width:760px;
        margin:3px 0 0;
        color:var(--rfi-text2);
        font-size:13px;
        line-height:19px;
      }

      .rfi-btn{
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
          color 140ms var(--rfi-ease),
          background 140ms var(--rfi-ease),
          border-color 140ms var(--rfi-ease),
          transform 140ms var(--rfi-ease),
          box-shadow 140ms var(--rfi-ease);
      }

      .rfi-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfi-btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfi-btn.primary{
        color:#fff;
        background:var(--rfi-primary);
        border-color:var(--rfi-primary);
        box-shadow:0 5px 14px rgba(70,72,212,.17);
      }

      .rfi-btn.primary:hover:not(:disabled){
        background:var(--rfi-primary-dark);
      }

      .rfi-btn.secondary{
        color:var(--rfi-text);
        background:#fff;
        border-color:var(--rfi-line);
      }

      .rfi-btn.secondary:hover:not(:disabled){
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
      }

      .rfi-notice{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        animation:rfiFadeUp 180ms var(--rfi-ease);
      }

      .rfi-notice > span{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        flex:0 0 26px;
        background:#fff;
        border-radius:7px;
      }

      .rfi-notice > div{
        min-width:0;
        flex:1;
        display:grid;
      }

      .rfi-notice strong{
        font-size:9px;
      }

      .rfi-notice small{
        font-size:8px;
        line-height:13px;
      }

      .rfi-notice > button{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        padding:0;
        color:inherit;
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
      }

      .rfi-notice.error{
        color:#7d1717;
        background:var(--rfi-danger-soft);
        border-color:#ffd0cc;
      }

      .rfi-notice.success{
        color:#075d40;
        background:var(--rfi-success-soft);
        border-color:#bee9d6;
      }

      .rfi-summary-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin-bottom:14px;
      }

      .rfi-summary-card{
        min-height:130px;
        display:grid;
        align-content:space-between;
        padding:16px;
        background:#fff;
        border:1px solid var(--rfi-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rfi-summary-card.warning{
        border-color:#f0d9cd;
      }

      .rfi-summary-card header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .rfi-summary-card header > span{
        color:var(--rfi-text2);
        font-size:7px;
        font-weight:750;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfi-summary-card header > i{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border-radius:8px;
        font-style:normal;
      }

      .rfi-summary-card.warning header > i{
        color:var(--rfi-warning);
        background:#fff0e8;
      }

      .rfi-summary-card > strong{
        margin-top:11px;
        font:600 25px/31px Geist,Inter,sans-serif;
      }

      .rfi-summary-card > small{
        color:var(--rfi-muted);
        font-size:7px;
      }

      .rfi-agent-journey{
        margin-bottom:14px;
        padding:18px;
        background:linear-gradient(135deg,#f8f8ff 0%,#ffffff 58%);
        border:1px solid #dedff8;
        border-radius:14px;
        box-shadow:0 5px 18px rgba(70,72,212,.045);
      }

      .rfi-agent-journey.empty{
        background:linear-gradient(135deg,#fbfbfd,#fff);
        border-color:var(--rfi-line);
      }

      .rfi-agent-journey-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
        margin-bottom:14px;
      }

      .rfi-agent-journey-head h2{
        margin:0;
        color:var(--rfi-text);
        font:600 18px/24px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rfi-agent-journey-head p{
        max-width:760px;
        margin:4px 0 0;
        color:var(--rfi-muted);
        font-size:9px;
        line-height:15px;
      }

      .rfi-agent-capability-list{
        display:grid;
        gap:9px;
      }

      .rfi-agent-capability-row{
        padding:12px;
        background:#fff;
        border:1px solid var(--rfi-line);
        border-radius:11px;
      }

      .rfi-agent-capability-row > header{
        display:grid;
        grid-template-columns:32px minmax(0,1fr) auto;
        align-items:center;
        gap:9px;
        margin-bottom:10px;
      }

      .rfi-agent-avatar{
        width:32px;
        height:32px;
        display:grid;
        place-items:center;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border-radius:9px;
      }

      .rfi-agent-copy{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfi-agent-copy strong{
        overflow:hidden;
        color:var(--rfi-text);
        font-size:10px;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfi-agent-copy span{
        color:var(--rfi-muted);
        font-size:7px;
      }

      .rfi-agent-ready{
        padding:5px 7px;
        border-radius:999px;
        font-size:7px;
        font-weight:800;
        white-space:nowrap;
      }

      .rfi-agent-ready.ready{
        color:var(--rfi-success);
        background:var(--rfi-success-soft);
      }

      .rfi-agent-ready.partial{
        color:var(--rfi-warning);
        background:#fff0e8;
      }

      .rfi-journey-track{
        display:grid;
        grid-template-columns:minmax(0,1fr) 22px minmax(0,1fr) 22px minmax(0,1fr) 22px minmax(0,1fr);
        align-items:stretch;
        gap:5px;
      }

      .rfi-journey-track.muted{
        opacity:.78;
      }

      .rfi-journey-node{
        min-width:0;
        display:grid;
        grid-template-columns:28px minmax(0,1fr);
        align-items:center;
        gap:7px;
        min-height:58px;
        padding:8px;
        border:1px solid var(--rfi-line);
        border-radius:9px;
        background:#fafafa;
      }

      .rfi-journey-node.ready{
        border-color:#ccebdc;
        background:#f5fcf8;
      }

      .rfi-journey-node.missing{
        border-style:dashed;
      }

      .rfi-journey-node > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        color:var(--rfi-muted);
        background:#fff;
        border:1px solid #e7e8eb;
        border-radius:8px;
      }

      .rfi-journey-node.ready > span{
        color:var(--rfi-success);
        background:var(--rfi-success-soft);
        border-color:#ccebdc;
      }

      .rfi-journey-node > div{
        min-width:0;
        display:grid;
        gap:2px;
      }

      .rfi-journey-node small{
        color:var(--rfi-muted);
        font-size:6px;
        font-weight:750;
        letter-spacing:.035em;
        text-transform:uppercase;
      }

      .rfi-journey-node strong{
        overflow:hidden;
        color:var(--rfi-text2);
        font-size:8px;
        font-weight:700;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfi-journey-node strong.mono{
        font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
        font-size:7px;
      }

      .rfi-journey-arrow{
        display:grid;
        place-items:center;
        color:#b5b6c6;
      }

      .rfi-agent-capability-row > footer{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-top:9px;
        padding-top:9px;
        border-top:1px solid #eef0f2;
      }

      .rfi-agent-capability-row > footer > span,
      .rfi-agent-capability-row > footer > a{
        display:inline-flex;
        align-items:center;
        gap:5px;
        font-size:7px;
        line-height:12px;
      }

      .rfi-agent-capability-row > footer > span{
        color:var(--rfi-muted);
      }

      .rfi-agent-capability-row > footer > a{
        color:var(--rfi-primary);
        font-weight:750;
        text-decoration:none;
        white-space:nowrap;
      }

      .rfi-toolbar{
        min-height:66px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:10px 12px;
        margin-bottom:14px;
        background:var(--rfi-soft);
        border-radius:11px;
      }

      .rfi-filters{
        display:flex;
        align-items:center;
        gap:5px;
      }

      .rfi-filters button{
        min-height:36px;
        display:flex;
        align-items:center;
        gap:6px;
        padding:7px 10px;
        color:var(--rfi-text2);
        background:transparent;
        border:0;
        border-radius:999px;
        cursor:pointer;
        font-size:8px;
        font-weight:650;
      }

      .rfi-filters button.active{
        color:#3f42bd;
        background:#dfe0ff;
      }

      .rfi-filters button span{
        min-width:19px;
        height:19px;
        display:grid;
        place-items:center;
        padding:0 5px;
        background:rgba(255,255,255,.65);
        border-radius:999px;
        font-size:6px;
        font-weight:800;
      }

      .rfi-search{
        width:260px;
        height:40px;
        display:flex;
        align-items:center;
        gap:7px;
        padding:0 10px;
        color:var(--rfi-muted);
        background:#fff;
        border:1px solid transparent;
        border-radius:8px;
      }

      .rfi-search:focus-within{
        border-color:rgba(70,72,212,.42);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rfi-search input{
        min-width:0;
        flex:1;
        height:38px;
        padding:0;
        color:var(--rfi-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:9px;
      }

      .rfi-search button{
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfi-muted);
        background:transparent;
        border:0;
        border-radius:5px;
        cursor:pointer;
      }

      .rfi-market-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin-bottom:16px;
      }

      .rfi-card{
        min-width:0;
        min-height:300px;
        display:grid;
        grid-template-rows:auto minmax(0,1fr) auto auto;
        gap:13px;
        padding:18px;
        background:#f0f1f2;
        border:1px solid #dcdee1;
        border-radius:12px;
        animation:rfiFadeUp 210ms var(--rfi-ease) both;
        animation-delay:calc(var(--rfi-index) * 28ms);
        transition:
          transform 150ms var(--rfi-ease),
          border-color 150ms var(--rfi-ease),
          box-shadow 150ms var(--rfi-ease);
      }

      .rfi-card:hover{
        transform:translateY(-2px);
        border-color:#cfd0da;
        box-shadow:0 12px 28px rgba(25,28,29,.06);
      }

      .rfi-card > header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }

      .rfi-provider-icon{
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        flex:0 0 48px;
        color:var(--rfi-text2);
        background:#fff;
        border:1px solid #e5e7e9;
        border-radius:9px;
        box-shadow:0 1px 2px rgba(25,28,29,.03);
      }

      .rfi-provider-icon.google strong{
        color:#4285f4;
        font:700 18px/1 Geist,Inter,sans-serif;
      }

      .rfi-provider-icon.gmail{
        color:#d7463f;
      }

      .rfi-provider-icon.calendar{
        color:#4285f4;
      }

      .rfi-provider-icon.mail{
        color:#5f6570;
      }

      .rfi-provider-icon.whatsapp{
        color:#fff;
        background:#20c968;
        border-color:#20c968;
      }

      .rfi-provider-icon.calendly{
        color:#0878ff;
        background:#fff;
      }

      .rfi-state{
        min-height:27px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        width:max-content;
        padding:5px 8px;
        border-radius:999px;
        font-size:7px;
        font-weight:750;
      }

      .rfi-state i{
        width:6px;
        height:6px;
        display:block;
        background:currentColor;
        border-radius:50%;
      }

      .rfi-state.connected{
        color:var(--rfi-primary);
        background:#dfe0ff;
      }

      .rfi-state.warning{
        color:#b5261f;
        background:#ffd2ce;
      }

      .rfi-state.muted{
        color:#565b67;
        background:#e0e3e5;
      }

      .rfi-card-copy{
        min-width:0;
      }

      .rfi-card-copy h2{
        margin:0 0 5px;
        color:#111315;
        font:600 18px/24px Geist,Inter,sans-serif;
        letter-spacing:-.01em;
      }

      .rfi-card-copy p{
        margin:0;
        color:#3f4350;
        font-size:10px;
        line-height:15px;
      }

      .rfi-card-details{
        min-height:30px;
        display:grid;
        gap:2px;
      }

      .rfi-card-details span{
        overflow:hidden;
        color:var(--rfi-text2);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
      }

      .rfi-card-details span + span{
        color:var(--rfi-primary);
        font-weight:650;
      }

      .rfi-card > footer{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding-top:13px;
        border-top:1px solid #dadee1;
      }

      .rfi-card > footer > div:first-child{
        min-width:0;
        display:flex;
        align-items:center;
        gap:5px;
        color:var(--rfi-text2);
      }

      .rfi-card > footer > div:first-child span{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
      }

      .rfi-card-actions{
        display:flex;
        align-items:center;
        gap:4px;
        flex:0 0 auto;
      }

      .rfi-card-actions .icon{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfi-text2);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
      }

      .rfi-card-actions .icon:hover{
        background:#fff;
      }

      .rfi-card-actions .text{
        min-height:29px;
        display:inline-flex;
        align-items:center;
        gap:4px;
        padding:5px 7px;
        color:var(--rfi-primary);
        background:transparent;
        border:0;
        border-radius:6px;
        text-decoration:none;
        cursor:pointer;
        font-size:7px;
        font-weight:750;
      }

      .rfi-card-actions .text:hover:not(:disabled){
        background:#fff;
      }

      .rfi-card-actions .text:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfi-empty-market{
        min-height:280px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:6px;
        padding:28px;
        margin-bottom:16px;
        background:#fff;
        border:1px solid var(--rfi-line);
        border-radius:12px;
        text-align:center;
      }

      .rfi-empty-market > span{
        width:50px;
        height:50px;
        display:grid;
        place-items:center;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border-radius:14px;
      }

      .rfi-empty-market h2{
        margin:0;
        font:600 13px/18px Geist,Inter,sans-serif;
      }

      .rfi-empty-market p{
        max-width:440px;
        margin:0 0 4px;
        color:var(--rfi-muted);
        font-size:8px;
        line-height:13px;
      }

      .rfi-empty-market .rfi-btn{
        min-height:34px;
        font-size:7px;
      }

      .rfi-connected-section{
        overflow:hidden;
        margin-top:4px;
        background:#fff;
        border:1px solid var(--rfi-line);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rfi-section-head{
        min-height:82px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:15px 17px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfi-line);
      }

      .rfi-section-head h2{
        margin:0;
        font:600 15px/20px Geist,Inter,sans-serif;
      }

      .rfi-section-head p{
        max-width:700px;
        margin:2px 0 0;
        color:var(--rfi-muted);
        font-size:8px;
        line-height:12px;
      }

      .rfi-count-pill{
        min-width:31px;
        height:31px;
        display:grid;
        place-items:center;
        flex:0 0 auto;
        padding:0 8px;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border-radius:999px;
        font-size:8px;
        font-weight:800;
      }

      .rfi-table-wrap{
        width:100%;
        overflow:auto;
      }

      .rfi-table{
        width:100%;
        min-width:900px;
        border-collapse:separate;
        border-spacing:0;
        text-align:left;
      }

      .rfi-table th{
        padding:12px 14px;
        color:var(--rfi-text2);
        background:#eceeef;
        border-bottom:1px solid var(--rfi-line);
        font-size:7px;
        font-weight:700;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .rfi-table td{
        min-height:70px;
        padding:11px 14px;
        color:var(--rfi-text2);
        vertical-align:middle;
        font-size:8px;
      }

      .rfi-table tbody tr{
        animation:rfiFadeUp 200ms var(--rfi-ease) both;
        animation-delay:calc(var(--rfi-index) * 24ms);
      }

      .rfi-table tbody tr + tr td{
        border-top:1px solid #f0f1f2;
      }

      .rfi-table tbody tr:hover{
        background:#fafafd;
      }

      .rfi-connection-id{
        min-width:210px;
        display:flex;
        align-items:center;
        gap:9px;
      }

      .rfi-connection-id .rfi-provider-icon{
        width:36px;
        height:36px;
        flex-basis:36px;
        border-radius:8px;
      }

      .rfi-connection-id .rfi-provider-icon.google strong{
        font-size:14px;
      }

      .rfi-connection-id > div{
        min-width:0;
        display:grid;
      }

      .rfi-connection-id strong,
      .rfi-connection-id small{
        max-width:210px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfi-connection-id strong{
        color:var(--rfi-text);
        font:600 9px/13px Geist,Inter,sans-serif;
      }

      .rfi-connection-id small{
        color:var(--rfi-muted);
        font-size:7px;
      }

      .rfi-capability-list{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:5px;
      }

      .rfi-capability{
        min-height:24px;
        display:inline-flex;
        align-items:center;
        gap:4px;
        width:max-content;
        padding:4px 7px;
        border-radius:6px;
        font-size:6.5px;
        font-weight:700;
      }

      .rfi-capability.email{
        color:#4c55a8;
        background:#e8e9ff;
      }

      .rfi-capability.calendar{
        color:#5f2cb7;
        background:#efe7ff;
      }

      .rfi-capability.muted{
        color:#656b73;
        background:#eceeef;
      }

      .rfi-assigned-count{
        display:grid;
        gap:1px;
        color:var(--rfi-text);
        font-weight:700;
      }

      .rfi-assigned-count small{
        color:var(--rfi-muted);
        font-size:6px;
        font-weight:500;
      }

      .rfi-row-actions{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:5px;
      }

      .rfi-row-actions button,
      .rfi-row-actions a{
        min-height:28px;
        display:inline-flex;
        align-items:center;
        gap:4px;
        padding:5px 7px;
        color:var(--rfi-primary);
        background:#f4f4ff;
        border:0;
        border-radius:6px;
        text-decoration:none;
        cursor:pointer;
        font-size:6.5px;
        font-weight:700;
      }

      .rfi-row-actions button.danger{
        color:#a32424;
        background:#fff0ee;
      }

      .rfi-row-actions button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfi-connected-empty{
        min-height:250px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:6px;
        padding:28px;
        text-align:center;
      }

      .rfi-connected-empty > span{
        width:49px;
        height:49px;
        display:grid;
        place-items:center;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border-radius:13px;
      }

      .rfi-connected-empty h3{
        margin:0;
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfi-connected-empty p{
        max-width:500px;
        margin:0;
        color:var(--rfi-muted);
        font-size:8px;
        line-height:13px;
      }

      .rfi-connected-empty > div{
        display:flex;
        gap:7px;
        margin-top:6px;
      }

      .rfi-connected-empty .rfi-btn{
        min-height:35px;
        font-size:7px;
      }

      .rfi-mobile-connections{
        display:none;
      }

      .rfi-security-note{
        display:grid;
        grid-template-columns:34px minmax(0,1fr) auto;
        align-items:center;
        gap:10px;
        padding:12px 14px;
        margin-top:14px;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border:1px solid #d8d9ff;
        border-radius:10px;
      }

      .rfi-security-note > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:8px;
      }

      .rfi-security-note > div{
        min-width:0;
      }

      .rfi-security-note strong{
        display:block;
        color:#3638a8;
        font-size:8px;
      }

      .rfi-security-note p{
        margin:2px 0 0;
        color:var(--rfi-text2);
        font-size:7px;
        line-height:11px;
      }

      .rfi-security-note > a{
        display:flex;
        align-items:center;
        gap:5px;
        color:var(--rfi-primary);
        text-decoration:none;
        white-space:nowrap;
        font-size:7px;
        font-weight:700;
      }

      .rfi-summary-grid.loading article,
      .rfi-market-grid.loading article{
        background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);
        background-size:220% 100%;
        animation:rfiShimmer 1.25s linear infinite;
      }

      .rfi-summary-grid.loading article{
        min-height:130px;
        display:grid;
        align-content:center;
        gap:9px;
        border-radius:12px;
      }

      .rfi-summary-grid.loading article > i,
      .rfi-market-grid.loading article > i{
        display:block;
        height:10px;
        margin:0 16px;
        background:rgba(255,255,255,.75);
        border-radius:999px;
      }

      .rfi-summary-grid.loading article > i:nth-child(2){
        width:45%;
        height:26px;
      }

      .rfi-market-grid.loading article{
        min-height:300px;
        display:grid;
        align-content:center;
        gap:12px;
        border-radius:12px;
      }

      .rfi-market-grid.loading article > i:first-child{
        width:48px;
        height:48px;
        border-radius:9px;
      }

      .rfi-market-grid.loading article > i:nth-child(2){
        width:60%;
        height:20px;
      }

      .rfi-market-grid.loading article > i:nth-child(3){
        width:86%;
        height:55px;
        border-radius:8px;
      }

      @media(max-width:1220px){
        .rf-integrations-v7{
          padding:22px;
        }

        .rfi-market-grid{
          grid-template-columns:repeat(3,minmax(0,1fr));
        }
      }

      @media(max-width:980px){
        .rfi-summary-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rfi-market-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rfi-toolbar{
          align-items:stretch;
          flex-direction:column;
        }

        .rfi-search{
          width:100%;
        }
      }

      @media(max-width:780px){
        .rfi-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfi-filters{
          width:100%;
          overflow:auto;
        }

        .rfi-filters button{
          flex:0 0 auto;
        }

        .rfi-table-wrap{
          display:none;
        }

        .rfi-mobile-connections{
          display:grid;
        }

        .rfi-mobile-connection-card{
          display:grid;
          gap:10px;
          padding:13px 14px;
          border-bottom:1px solid #f0f1f2;
          animation:rfiFadeUp 200ms var(--rfi-ease) both;
          animation-delay:calc(var(--rfi-index) * 24ms);
        }

        .rfi-mobile-connection-card > header{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
        }

        .rfi-mobile-connection-card > header .rfi-connection-id{
          min-width:0;
          flex:1;
        }

        .rfi-mobile-capabilities{
          padding-left:45px;
        }

        .rfi-mobile-assignment{
          padding:8px 0 0 45px;
          color:var(--rfi-muted);
          border-top:1px solid #f0f1f2;
          font-size:7px;
        }

        .rfi-mobile-connection-card > .rfi-row-actions{
          padding-left:45px;
        }
      }

      .rfi-card.clickable{
        cursor:pointer;
      }

      .rfi-card.clickable:focus-visible{
        outline:2px solid var(--rfi-primary);
        outline-offset:3px;
      }

      .rfi-modal-backdrop{
        position:fixed;
        inset:0;
        z-index:1200;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:24px;
        background:rgba(20,22,28,.46);
        backdrop-filter:blur(3px);
        animation:rfiPageIn 160ms var(--rfi-ease);
      }

      .rfi-modal{
        width:min(640px,100%);
        max-height:min(820px,calc(100vh - 48px));
        overflow:auto;
        border:1px solid var(--rfi-line);
        border-radius:18px;
        background:#fff;
        box-shadow:0 24px 70px rgba(27,28,37,.22);
      }

      .rfi-modal-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:20px;
        padding:22px 24px 17px;
        border-bottom:1px solid var(--rfi-line);
      }

      .rfi-modal-head h2{
        margin:3px 0 5px;
        font-size:20px;
        line-height:26px;
      }

      .rfi-modal-head p{
        margin:0;
        max-width:500px;
        color:var(--rfi-muted);
        font-size:10px;
        line-height:16px;
      }

      .rfi-modal-close{
        width:34px;
        height:34px;
        flex:0 0 auto;
        display:grid;
        place-items:center;
        border:1px solid var(--rfi-line);
        border-radius:10px;
        background:#fff;
        color:var(--rfi-text2);
        cursor:pointer;
      }

      .rfi-modal-error{
        display:flex;
        align-items:flex-start;
        gap:9px;
        margin:16px 24px 0;
        padding:10px 12px;
        border:1px solid #ffc8c3;
        border-radius:10px;
        background:var(--rfi-danger-soft);
        color:var(--rfi-danger);
        font-size:9px;
        line-height:14px;
      }

      .rfi-modal-body{
        display:grid;
        gap:15px;
        padding:20px 24px;
      }

      .rfi-provider-choice{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .rfi-provider-choice button{
        min-height:40px;
        border:1px solid var(--rfi-line);
        border-radius:10px;
        background:#fff;
        color:var(--rfi-text2);
        font:inherit;
        font-size:9px;
        font-weight:700;
        cursor:pointer;
      }

      .rfi-provider-choice button.active{
        border-color:#a9aaf7;
        background:var(--rfi-primary-soft);
        color:var(--rfi-primary-dark);
      }

      .rfi-form-grid{
        display:grid;
        gap:12px;
      }

      .rfi-form-grid.two{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }

      .rfi-inline-field{
        display:grid;
        gap:6px;
      }

      .rfi-inline-field > span{
        color:var(--rfi-text2);
        font-size:8px;
        font-weight:750;
        letter-spacing:.01em;
      }

      .rfi-inline-field input{
        width:100%;
        min-height:41px;
        padding:0 12px;
        border:1px solid var(--rfi-line);
        border-radius:10px;
        outline:none;
        background:#fff;
        color:var(--rfi-text);
        font:inherit;
        font-size:10px;
      }

      .rfi-inline-field input:focus{
        border-color:#aaaaf2;
        box-shadow:0 0 0 3px rgba(70,72,212,.09);
      }

      .rfi-advanced-email{
        padding:12px;
        border:1px solid var(--rfi-line);
        border-radius:11px;
        background:#fafafb;
      }

      .rfi-advanced-email summary{
        color:var(--rfi-text2);
        font-size:9px;
        font-weight:750;
        cursor:pointer;
      }

      .rfi-advanced-email[open] summary{
        margin-bottom:12px;
      }

      .rfi-toggle-line{
        display:flex;
        flex-wrap:wrap;
        gap:12px 18px;
        margin-top:12px;
        color:var(--rfi-muted);
        font-size:8px;
      }

      .rfi-toggle-line label{
        display:flex;
        align-items:center;
        gap:6px;
      }

      .rfi-modal-note{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        border-radius:10px;
        background:#f6f7f8;
        color:var(--rfi-muted);
        font-size:8px;
        line-height:14px;
      }

      .rfi-whatsapp-empty,
      .rfi-whatsapp-connected{
        display:flex;
        align-items:flex-start;
        gap:14px;
        padding:18px;
        border:1px solid var(--rfi-line);
        border-radius:13px;
        background:#fafbfb;
      }

      .rfi-whatsapp-empty{
        align-items:center;
        flex-direction:column;
        text-align:center;
      }

      .rfi-whatsapp-empty strong,
      .rfi-whatsapp-connected strong,
      .rfi-whatsapp-qr strong{
        display:block;
        margin-bottom:4px;
        font-size:11px;
      }

      .rfi-whatsapp-empty p,
      .rfi-whatsapp-connected p,
      .rfi-whatsapp-qr p{
        margin:0;
        color:var(--rfi-muted);
        font-size:9px;
        line-height:15px;
      }

      .rfi-whatsapp-connected > span{
        display:grid;
        place-items:center;
        width:42px;
        height:42px;
        flex:0 0 auto;
        border-radius:50%;
        background:var(--rfi-success-soft);
        color:var(--rfi-success);
      }

      .rfi-whatsapp-qr{
        display:grid;
        grid-template-columns:190px minmax(0,1fr);
        gap:22px;
        align-items:center;
      }

      .rfi-whatsapp-qr img{
        width:190px;
        height:190px;
        display:block;
        border:10px solid #fff;
        border-radius:12px;
        object-fit:contain;
        box-shadow:0 0 0 1px var(--rfi-line);
      }

      .rfi-whatsapp-qr small{
        display:block;
        margin-top:8px;
        color:var(--rfi-muted);
        font-size:8px;
        line-height:13px;
      }

      .rfi-modal-footer{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:8px;
        padding:15px 24px 20px;
        border-top:1px solid var(--rfi-line);
      }

      .rfi-btn.danger{
        border-color:#ffc9c5;
        background:var(--rfi-danger-soft);
        color:var(--rfi-danger);
      }

      @media(max-width:650px){
        .rfi-modal-backdrop{
          align-items:flex-end;
          padding:0;
        }

        .rfi-modal{
          max-height:92vh;
          border-radius:18px 18px 0 0;
        }

        .rfi-form-grid.two,
        .rfi-provider-choice,
        .rfi-whatsapp-qr{
          grid-template-columns:1fr;
        }

        .rfi-whatsapp-qr img{
          width:min(220px,100%);
          height:auto;
          justify-self:center;
        }

        .rfi-modal-head,
        .rfi-modal-body,
        .rfi-modal-footer{
          padding-left:16px;
          padding-right:16px;
        }

        .rf-integrations-v7{
          padding:18px 12px 84px;
        }

        .rfi-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfi-page-header p{
          font-size:11px;
          line-height:17px;
        }

        .rfi-summary-grid,
        .rfi-market-grid{
          grid-template-columns:1fr;
          gap:8px;
        }

        .rfi-card{
          min-height:260px;
        }

        .rfi-security-note{
          grid-template-columns:34px minmax(0,1fr);
        }

        .rfi-security-note > a{
          grid-column:2;
        }
      }

      @media(max-width:440px){
        .rfi-page-header > .rfi-btn{
          width:100%;
        }

        .rfi-connected-empty > div{
          align-items:stretch;
          flex-direction:column;
          width:100%;
        }

        .rfi-connected-empty .rfi-btn{
          width:100%;
        }

        .rfi-card > footer{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfi-card-actions{
          width:100%;
        }
      }

      @media(max-width:680px){
        .rfi-agent-journey-head,.rfi-agent-capability-row > footer{align-items:stretch;flex-direction:column}
        .rfi-journey-track{grid-template-columns:1fr}.rfi-journey-arrow{display:none}
        .rfi-agent-capability-row > header{grid-template-columns:32px minmax(0,1fr)}
        .rfi-agent-ready{grid-column:1/-1;justify-self:start}
      }

      @media(prefers-reduced-motion:reduce){
        .rf-integrations-v7,
        .rfi-card,
        .rfi-table tbody tr,
        .rfi-mobile-connection-card,
        .rfi-notice,
        .rfi-summary-grid.loading article,
        .rfi-market-grid.loading article,
        .rf-integrations-v7 .spin{
          animation:none!important;
        }

        .rf-integrations-v7 *,
        .rf-integrations-v7 *::before,
        .rf-integrations-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
