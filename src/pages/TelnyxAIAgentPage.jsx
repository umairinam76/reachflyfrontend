import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Navigate,
} from "react-router-dom";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  apiRequest,
  emitWorkspaceSocket,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import "../styles.css";

const DEFAULT_FORM = {
  name: "",
  description:
    "ReachFly outbound qualification and meeting-booking agent.",
  companyName: "",
  voice: "Telnyx.NaturalHD.astra",
  model: "anthropic/claude-haiku-4-5",
  websiteUrl: "",
  websiteIntelligence: {},
  greeting:
    "Hi, this is the automated sales assistant calling from {{company_name}}. Is now an okay time for a quick question?",
  disclosure:
    "Clearly identify yourself as an automated AI sales assistant and identify the company at the beginning of the call.",
  persona:
    "Warm, confident, concise, curious, respectful, and conversational. Use short sentences and natural pauses. Never claim to be human.",
  offer: "",
  idealCustomer: "",
  qualificationQuestions: "",
  objectionHandling: "",
  meetingGoal:
    "Book a short discovery meeting only after the lead explicitly confirms the date and time.",
  bookingInstructions: "",
  calendarOwnerEmail: "",
  bookingTimezone: "America/New_York",
  meetingDurationMinutes: 30,
  voicemailMessage: "",
  fromNumber: "",
  defaultLeadTimezone: "America/New_York",
  callingWindowStartHour: 9,
  callingWindowEndHour: 17,
  dailyCallLimit: 25,
  concurrency: 1,
  maxAttempts: 3,
  maxCallSeconds: 600,
  ringTimeoutSeconds: 45,
  recordingEnabled: false,
  enabled: true,
  complianceConfirmed: false,
};

const DEFAULT_GOOGLE_LEAD_FORM = {
  niche: "",
  location: "",
  limit: 25,
  radiusKm: 25,
  qualityLevel: "balanced",
};

const DEFAULT_CUSTOM_LEAD_FORM = {
  contactName: "",
  companyName: "",
  jobTitle: "",
  phone: "",
  email: "",
  website: "",
  location: "",
  timezone: "America/New_York",
  context: "",
};

const TABS = [
  ["setup", "Agent setup"],
  ["leads", "Lead queue"],
  ["calls", "Calls"],
  ["meetings", "Meetings"],
];

const LIVE_CALL_STATES = new Set([
  "creating",
  "queued",
  "initiated",
  "ringing",
  "answered",
  "assistant_active",
  "active",
]);

export default function TelnyxAIAgentPage() {
  const { user } = useAuth();
  const refreshTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const [dashboard, setDashboard] = useState(null);
  const [voices, setVoices] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState("setup");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzingWebsite, setAnalyzingWebsite] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busyCallId, setBusyCallId] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatus, setLeadStatus] = useState("all");
  const [queueStatus, setQueueStatus] = useState("all");
  const [campaignLimit, setCampaignLimit] = useState(10);
  const [googleLeadForm, setGoogleLeadForm] = useState(
    DEFAULT_GOOGLE_LEAD_FORM
  );
  const [findingGoogleLeads, setFindingGoogleLeads] = useState(false);
  const [googleLeadResult, setGoogleLeadResult] = useState(null);
  const [customLeadForm, setCustomLeadForm] = useState(
    DEFAULT_CUSTOM_LEAD_FORM
  );
  const [creatingCustomLead, setCreatingCustomLead] = useState(false);
  const [callingCustomLead, setCallingCustomLead] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await apiRequest(
          "/telnyx/ai-agent/dashboard",
          {
            timeoutMs: 20_000,
          }
        );

        if (!mountedRef.current) return;
        setDashboard(response);
        setAccessDenied(false);
        setForm((current) =>
          normalizeAgentForm({
            ...current,
            ...(response.agent || {}),
            companyName:
              response.agent?.companyName ||
              response.workspace?.name ||
              current.companyName,
            fromNumber:
              response.agent?.fromNumber ||
              response.diagnostics?.selectedFromNumber ||
              current.fromNumber,
          })
        );
      } catch (requestError) {
        if (!mountedRef.current) return;
        if ([403, 404].includes(Number(requestError?.status))) {
          setAccessDenied(true);
        } else {
          setError(
            requestError?.message ||
              "The Telnyx voice-agent workspace could not be loaded."
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

  const loadVoices = useCallback(async () => {
    try {
      const response = await apiRequest(
        "/telnyx/ai-agent/voices",
        {
          timeoutMs: 30_000,
        }
      );
      if (!mountedRef.current) return;
      setVoices(
        Array.isArray(response?.voices)
          ? response.voices
          : []
      );
    } catch (requestError) {
      if (!mountedRef.current) return;
      setError(
        requestError?.message ||
          "Telnyx voice options could not be loaded."
      );
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void Promise.all([
      loadDashboard(),
      loadVoices(),
    ]);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(refreshTimerRef.current);
    };
  }, [loadDashboard, loadVoices]);

  useEffect(() => {
    const scheduleSilentRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        void loadDashboard({ silent: true });
      }, 250);
    };

    const events = [
      "telnyx-ai-agent:updated",
      "telnyx-ai-agent:call-updated",
      "telnyx-ai-agent:meeting-booked",
      "lead:updated",
    ];
    const unsubscribers = events.map((eventName) =>
      onWorkspaceSocket(eventName, scheduleSilentRefresh)
    );

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadDashboard({ silent: true });
      }
    };
    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      unsubscribers.forEach((unsubscribe) =>
        unsubscribe?.()
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [loadDashboard]);

  const assignableLeads = useMemo(() => {
    const value = leadSearch.trim().toLowerCase();
    const leads = Array.isArray(dashboard?.assignableLeads)
      ? dashboard.assignableLeads
      : [];

    return leads.filter((lead) => {
      if (
        leadStatus !== "all" &&
        normalizeStatus(lead.status) !== leadStatus
      ) {
        return false;
      }
      if (!value) return true;
      return [
        lead.name,
        lead.phone,
        lead.email,
        lead.website,
        lead.campaignName,
        lead.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value);
    });
  }, [dashboard?.assignableLeads, leadSearch, leadStatus]);

  const queue = useMemo(() => {
    const records = Array.isArray(dashboard?.queue)
      ? dashboard.queue
      : [];
    if (queueStatus === "all") return records;
    return records.filter(
      (item) =>
        normalizeStatus(item.status) === queueStatus
    );
  }, [dashboard?.queue, queueStatus]);

  const calls = Array.isArray(dashboard?.calls)
    ? dashboard.calls
    : [];
  const meetings = Array.isArray(dashboard?.meetings)
    ? dashboard.meetings
    : [];
  const diagnostics = dashboard?.diagnostics || {};
  const agent = dashboard?.agent || null;

  const allVisibleSelected =
    assignableLeads.length > 0 &&
    assignableLeads.every((lead) =>
      selectedLeadIds.includes(lead.assignmentId)
    );

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleLead(id) {
    setSelectedLeadIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleAllVisible() {
    const visibleIds = assignableLeads.map(
      (lead) => lead.assignmentId
    );
    setSelectedLeadIds((current) => {
      if (allVisibleSelected) {
        return current.filter(
          (id) => !visibleIds.includes(id)
        );
      }
      return [...new Set([...current, ...visibleIds])];
    });
  }

  async function submitCustomLead(callNow = false) {
    const phone = String(customLeadForm.phone || "").trim();
    if (!phone) {
      setError("Enter the custom lead phone number first.");
      return;
    }

    if (callNow) {
      setCallingCustomLead(true);
    } else {
      setCreatingCustomLead(true);
    }
    setError("");
    setSuccess("");

    try {
      await ensureVoiceAgentReady();

      const response = await apiRequest(
        "/telnyx/ai-agent/leads/custom",
        {
          method: "POST",
          body: {
            ...customLeadForm,
            callNow,
            defaultTimezone:
              customLeadForm.timezone || form.defaultLeadTimezone,
            maxAttempts: Number(form.maxAttempts || 3),
            dailyCallLimit: Number(form.dailyCallLimit || 25),
            fromNumber: form.fromNumber,
          },
          timeoutMs: callNow ? 60_000 : 30_000,
        }
      );

      setCustomLeadForm((current) => ({
        ...DEFAULT_CUSTOM_LEAD_FORM,
        timezone:
          current.timezone ||
          form.defaultLeadTimezone ||
          "America/New_York",
      }));
      setSelectedLeadIds([]);
      await loadDashboard({ silent: true });

      if (callNow) {
        const result = response?.callResult || {};
        const started = Number(result.started || 0);
        const deferred = Number(result.deferred || 0);
        const failed = Number(result.failed || 0);
        setSuccess(
          started
            ? "The custom lead was queued and the AI call started."
            : deferred
              ? "The custom lead was queued, but the call was deferred by the configured calling policy or lead timezone."
              : failed
                ? "The custom lead was queued, but the call could not start. Check Calls and backend logs for the provider error."
                : response?.message || "The custom lead was queued for an AI call."
        );
        setActiveTab("calls");
      } else {
        setSuccess(
          response?.message ||
            "The custom lead was added to the AI-agent queue with its private call context."
        );
      }
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The custom lead could not be queued for the AI agent."
      );
    } finally {
      setCreatingCustomLead(false);
      setCallingCustomLead(false);
    }
  }

  async function findGoogleLeads() {
    const niche = String(googleLeadForm.niche || "").trim();
    const location = String(googleLeadForm.location || "").trim();

    if (!niche || !location) {
      setError("Enter both a business niche and target location for Google Places.");
      return;
    }

    setFindingGoogleLeads(true);
    setGoogleLeadResult(null);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        "/telnyx/ai-agent/leads/find",
        {
          method: "POST",
          body: {
            niche,
            location,
            limit: Number(googleLeadForm.limit || 25),
            radiusKm: Number(googleLeadForm.radiusKm || 25),
            qualityLevel:
              googleLeadForm.qualityLevel || "balanced",
            exact: true,
          },
          timeoutMs: 130_000,
        }
      );

      setGoogleLeadResult(response);
      await loadDashboard({ silent: true });

      const discoveredIds = Array.isArray(response?.assignmentIds)
        ? response.assignmentIds
        : [];
      setSelectedLeadIds(discoveredIds);
      setLeadSearch("");
      setLeadStatus("all");
      setSuccess(
        response?.message ||
          `${response?.imported || 0} new callable Google lead${
            response?.imported === 1 ? "" : "s"
          } added to the voice-agent lead pool.`
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "ReachFly could not retrieve Google Places leads."
      );
    } finally {
      setFindingGoogleLeads(false);
    }
  }

  async function analyzeWebsite() {
    if (!String(form.websiteUrl || "").trim()) {
      setError("Enter the company website URL first.");
      return;
    }

    setAnalyzingWebsite(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        "/telnyx/ai-agent/website/analyze",
        {
          method: "POST",
          body: {
            websiteUrl: form.websiteUrl,
            companyName: form.companyName,
          },
          timeoutMs: 120_000,
        }
      );

      setDashboard((current) => ({
        ...(current || {}),
        agent: response.agent,
      }));
      setForm((current) =>
        normalizeAgentForm({
          ...current,
          ...(response.agent || {}),
          websiteIntelligence:
            response.intelligence ||
            response.agent?.websiteIntelligence ||
            {},
          model:
            response.liveConversationModel ||
            response.agent?.model ||
            "anthropic/claude-haiku-4-5",
        })
      );
      setSuccess(
        `Claude analyzed ${response.pagesAnalyzed || 0} website page${
          response.pagesAnalyzed === 1 ? "" : "s"
        }. The live Telnyx voice agent can now use this knowledge naturally.`
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Claude could not analyze the company website."
      );
    } finally {
      setAnalyzingWebsite(false);
    }
  }

  async function persistVoiceAgent({ announce = false } = {}) {
    setSaving(true);

    if (announce) {
      setError("");
      setSuccess("");
    }

    try {
      let payload = normalizeAgentForm(form);
      const normalizedWebsite = String(payload.websiteUrl || "").trim();
      const analyzedSource = String(
        payload.websiteIntelligence?.sourceUrl || ""
      ).trim();

      if (
        normalizedWebsite &&
        (!payload.websiteIntelligence?.analyzedAt ||
          (!analyzedSource || analyzedSource !== normalizedWebsite))
      ) {
        const analyzed = await apiRequest(
          "/telnyx/ai-agent/website/analyze",
          {
            method: "POST",
            body: {
              websiteUrl: normalizedWebsite,
              companyName: payload.companyName,
            },
            timeoutMs: 120_000,
          }
        );

        payload = normalizeAgentForm({
          ...payload,
          ...(analyzed.agent || {}),
          websiteIntelligence:
            analyzed.intelligence ||
            analyzed.agent?.websiteIntelligence ||
            {},
          model:
            analyzed.liveConversationModel ||
            analyzed.agent?.model ||
            payload.model,
        });
        setForm(payload);
      }

      const response = await apiRequest(
        "/telnyx/ai-agent",
        {
          method: "PUT",
          body: payload,
          timeoutMs: 45_000,
        }
      );

      const savedAgent = response?.agent || null;

      setDashboard((current) => ({
        ...(current || {}),
        agent: savedAgent || current?.agent || null,
      }));

      if (savedAgent) {
        setForm((current) =>
          normalizeAgentForm({
            ...current,
            ...savedAgent,
          })
        );
      }

      if (announce) {
        setSuccess(
          "The ReachFly voice agent was saved and synchronized with Telnyx."
        );
      }

      await loadDashboard({ silent: true });
      return savedAgent;
    } catch (requestError) {
      if (announce) {
        setError(
          requestError?.message ||
            "The voice agent could not be saved."
        );
      }
      throw requestError;
    } finally {
      setSaving(false);
    }
  }

  async function saveAgent() {
    try {
      await persistVoiceAgent({ announce: true });
    } catch {
      // persistVoiceAgent already surfaced the save error.
    }
  }

  async function ensureVoiceAgentReady() {
    if (agent?.telnyxAssistantId) {
      return agent;
    }

    if (!form.complianceConfirmed) {
      throw new Error(
        "Approve the calling and suppression policy in Agent setup before assigning or calling leads."
      );
    }

    const savedAgent = await persistVoiceAgent({ announce: false });

    if (!savedAgent?.telnyxAssistantId) {
      throw new Error(
        "ReachFly could not link the Telnyx AI assistant. Open Agent setup, save the voice agent, and check the Telnyx configuration message."
      );
    }

    return savedAgent;
  }

  async function assignSelectedLeads() {
    if (!selectedLeadIds.length) {
      setError("Select at least one lead first.");
      return;
    }

    setAssigning(true);
    setError("");
    setSuccess("");

    try {
      await ensureVoiceAgentReady();

      const response = await apiRequest(
        "/telnyx/ai-agent/leads/assign",
        {
          method: "POST",
          body: {
            assignmentIds: selectedLeadIds,
            defaultTimezone:
              form.defaultLeadTimezone,
            maxAttempts: form.maxAttempts,
          },
          timeoutMs: 30_000,
        }
      );
      setSelectedLeadIds([]);
      setSuccess(
        `${response.queued || 0} lead${
          response.queued === 1 ? "" : "s"
        } added to the AI-agent queue.${
          response.skipped?.length
            ? ` ${response.skipped.length} skipped.`
            : ""
        }`
      );
      await loadDashboard({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The selected leads could not be assigned."
      );
    } finally {
      setAssigning(false);
    }
  }

  async function startCampaign() {
    setStarting(true);
    setError("");
    setSuccess("");

    try {
      await ensureVoiceAgentReady();

      const response = await apiRequest(
        "/telnyx/ai-agent/campaigns/start",
        {
          method: "POST",
          body: {
            limit: Number(campaignLimit),
            concurrency: Number(form.concurrency),
            dailyCallLimit: Number(form.dailyCallLimit),
            fromNumber: form.fromNumber,
          },
          timeoutMs: 60_000,
        }
      );
      setSuccess(
        `${response.started || 0} call${
          response.started === 1 ? "" : "s"
        } started.${
          response.deferred
            ? ` ${response.deferred} deferred by policy.`
            : ""
        }${
          response.failed
            ? ` ${response.failed} failed.`
            : ""
        }`
      );
      setActiveTab("calls");
      await loadDashboard({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The AI calling campaign could not start."
      );
    } finally {
      setStarting(false);
    }
  }

  async function cancelCall(callId) {
    setBusyCallId(callId);
    setError("");
    try {
      await apiRequest(
        `/telnyx/ai-agent/calls/${encodeURIComponent(
          callId
        )}/cancel`,
        {
          method: "POST",
          timeoutMs: 20_000,
        }
      );
      setSuccess("The AI-agent call was cancelled.");
      await loadDashboard({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The call could not be cancelled."
      );
    } finally {
      setBusyCallId("");
    }
  }

  if (accessDenied) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (loading && !dashboard) {
    return (
      <main className="rf-agent-page">
        <section className="rf-agent-loading">
          <span className="rf-agent-spinner" />
          <b>Loading Telnyx voice agent…</b>
          <small>
            Checking workspace access, configuration and lead queue.
          </small>
        </section>
      </main>
    );
  }

  return (
    <main className="rf-agent-page">
      <header className="rf-agent-header">
        <div>
          <span className="eyebrow">Telnyx AI voice</span>
          <h1>Outbound voice agent</h1>
          <p>
            Qualify leads, record outcomes and book confirmed meetings with a
            workspace-scoped Telnyx AI assistant.
          </p>
        </div>

        <div className="rf-agent-header-actions">
          <span
            className={`rf-agent-live-pill ${
              diagnostics.configured ? "ready" : "warning"
            }`}
          >
            <i />
            {diagnostics.configured
              ? "Telnyx configured"
              : "Configuration required"}
          </span>

          <button
            type="button"
            className="btn light"
            disabled={refreshing}
            onClick={() => void loadDashboard({ silent: true })}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="rf-agent-alert error">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      ) : null}

      {success ? (
        <div className="rf-agent-alert success">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      ) : null}

      <section className="rf-agent-metrics">
        <Metric
          label="Ready leads"
          value={dashboard?.summary?.assignableLeads || 0}
          text="Leads with callable numbers"
        />
        <Metric
          label="Queued"
          value={dashboard?.summary?.queuedLeads || 0}
          text="Awaiting an approved call window"
        />
        <Metric
          label="Live calls"
          value={dashboard?.summary?.activeCalls || 0}
          text="Current AI conversations"
        />
        <Metric
          label="Upcoming meetings"
          value={dashboard?.summary?.meetingsUpcoming || 0}
          text="Confirmed by leads"
        />
      </section>

      <section className="rf-agent-provider-card">
        <div>
          <span className="rf-agent-provider-logo">T</span>
          <div>
            <b>Telnyx voice infrastructure</b>
            <small>
              Assistant {diagnostics.assistantId || "not linked"}
            </small>
          </div>
        </div>

        <dl>
          <div>
            <dt>Call Control application</dt>
            <dd>{diagnostics.callControlApplicationId || "Missing"}</dd>
          </div>
          <div>
            <dt>Outbound caller ID</dt>
            <dd>{diagnostics.selectedFromNumber || "Missing"}</dd>
          </div>
          <div>
            <dt>Webhook</dt>
            <dd title={diagnostics.webhookUrl}>
              {shorten(diagnostics.webhookUrl, 52) || "Missing"}
            </dd>
          </div>
          <div>
            <dt>Workspace</dt>
            <dd>{dashboard?.workspace?.name || user?.companyName}</dd>
          </div>
        </dl>
      </section>

      <nav className="rf-agent-tabs" aria-label="Voice-agent sections">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={activeTab === value ? "active" : ""}
            onClick={() => setActiveTab(value)}
          >
            {label}
            {value === "leads" && dashboard?.summary?.queuedLeads ? (
              <b>{dashboard.summary.queuedLeads}</b>
            ) : null}
          </button>
        ))}
      </nav>

      {activeTab === "setup" ? (
        <AgentSetup
          form={form}
          voices={voices}
          diagnostics={diagnostics}
          saving={saving}
          analyzingWebsite={analyzingWebsite}
          onChange={updateForm}
          onAnalyzeWebsite={() => void analyzeWebsite()}
          onSave={() => void saveAgent()}
        />
      ) : null}

      {activeTab === "leads" ? (
        <LeadQueue
          agent={agent}
          leads={assignableLeads}
          queue={queue}
          selectedLeadIds={selectedLeadIds}
          allVisibleSelected={allVisibleSelected}
          search={leadSearch}
          leadStatus={leadStatus}
          queueStatus={queueStatus}
          campaignLimit={campaignLimit}
          googleLeadForm={googleLeadForm}
          googleLeadResult={googleLeadResult}
          findingGoogleLeads={findingGoogleLeads}
          customLeadForm={customLeadForm}
          creatingCustomLead={creatingCustomLead}
          callingCustomLead={callingCustomLead}
          assigning={assigning}
          starting={starting}
          onGoogleLeadForm={(key, value) =>
            setGoogleLeadForm((current) => ({
              ...current,
              [key]: value,
            }))
          }
          onFindGoogleLeads={() => void findGoogleLeads()}
          onCustomLeadForm={(key, value) =>
            setCustomLeadForm((current) => ({
              ...current,
              [key]: value,
            }))
          }
          onQueueCustomLead={() => void submitCustomLead(false)}
          onCallCustomLead={() => void submitCustomLead(true)}
          onSearch={setLeadSearch}
          onLeadStatus={setLeadStatus}
          onQueueStatus={setQueueStatus}
          onCampaignLimit={setCampaignLimit}
          onToggleLead={toggleLead}
          onToggleAll={toggleAllVisible}
          onAssign={() => void assignSelectedLeads()}
          onStart={() => void startCampaign()}
        />
      ) : null}

      {activeTab === "calls" ? (
        <CallsPanel
          calls={calls}
          busyCallId={busyCallId}
          onCancel={(id) => void cancelCall(id)}
        />
      ) : null}

      {activeTab === "meetings" ? (
        <MeetingsPanel meetings={meetings} />
      ) : null}
    </main>
  );
}

function AgentSetup({
  form,
  voices,
  diagnostics,
  saving,
  analyzingWebsite,
  onChange,
  onAnalyzeWebsite,
  onSave,
}) {
  const numberOptions = Array.isArray(diagnostics.fromNumbers)
    ? diagnostics.fromNumbers
    : [];

  return (
    <section className="rf-agent-setup-grid">
      <article className="rf-agent-card rf-agent-form-card">
        <div className="rf-agent-card-heading">
          <div>
            <span>Identity and voice</span>
            <h2>Make the agent natural, clear and on-brand</h2>
          </div>
          <span className="rf-agent-section-number">01</span>
        </div>

        <div className="rf-agent-field-grid two">
          <Field
            label="Agent name"
            value={form.name}
            onChange={(value) => onChange("name", value)}
            placeholder="Codesync Growth Assistant"
          />
          <Field
            label="Company name"
            value={form.companyName}
            onChange={(value) => onChange("companyName", value)}
            placeholder="Codesync Labs"
          />
        </div>

        <label className="rf-agent-field">
          <span>Telnyx voice</span>
          <select
            value={form.voice}
            onChange={(event) =>
              onChange("voice", event.target.value)
            }
          >
            {!voices.length ? (
              <option value={form.voice}>{form.voice}</option>
            ) : null}
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label || voice.id}
              </option>
            ))}
          </select>
          <small>
            NaturalHD is a strong starting point; available voices are loaded
            directly from Telnyx.
          </small>
        </label>

        <TextArea
          label="Opening greeting"
          value={form.greeting}
          onChange={(value) => onChange("greeting", value)}
          rows={3}
        />

        <TextArea
          label="Voice and personality"
          value={form.persona}
          onChange={(value) => onChange("persona", value)}
          rows={4}
        />

        <TextArea
          label="AI disclosure rule"
          value={form.disclosure}
          onChange={(value) => onChange("disclosure", value)}
          rows={3}
        />
      </article>

      <article className="rf-agent-card rf-agent-form-card">
        <div className="rf-agent-card-heading">
          <div>
            <span>Claude website intelligence</span>
            <h2>Give ReachFly your website, not a call script</h2>
          </div>
          <span className="rf-agent-section-number">02</span>
        </div>

        <Field
          label="Company website URL"
          value={form.websiteUrl}
          onChange={(value) => onChange("websiteUrl", value)}
          placeholder="https://codesynclabs.com"
        />

        <div className="rf-agent-website-actions">
          <button
            type="button"
            className="btn primary"
            disabled={analyzingWebsite || !String(form.websiteUrl || "").trim()}
            onClick={onAnalyzeWebsite}
          >
            {analyzingWebsite
              ? "Claude is reading the website…"
              : form.websiteIntelligence?.analyzedAt
                ? "Re-analyze website with Claude"
                : "Analyze website with Claude"}
          </button>

          <div className="rf-agent-brain-pill">
            <b>Live conversation brain</b>
            <span>Claude Haiku 4.5 through Telnyx</span>
          </div>
        </div>

        {form.websiteIntelligence?.analyzedAt ? (
          <WebsiteIntelligencePreview
            intelligence={form.websiteIntelligence}
            websiteUrl={form.websiteUrl}
          />
        ) : (
          <div className="rf-agent-intel-empty">
            <b>What happens after Analyze</b>
            <p>
              ReachFly safely crawls the public website, Claude extracts the
              services, target customers, value propositions, proof points,
              qualification questions, objections and booking angles, and that
              knowledge becomes the live voice agent's grounded sales context.
            </p>
          </div>
        )}

        <small className="rf-agent-field-note">
          The website is analyzed before calls. During a live call, Telnyx
          handles speech recognition and voice output while Claude reasons over
          the ongoing transcript and the website-derived knowledge. This avoids
          a rigid word-for-word script.
        </small>
      </article>

      <article className="rf-agent-card rf-agent-form-card">
        <div className="rf-agent-card-heading">
          <div>
            <span>Meeting booking</span>
            <h2>Book only confirmed appointments</h2>
          </div>
          <span className="rf-agent-section-number">03</span>
        </div>

        <TextArea
          label="Meeting goal"
          value={form.meetingGoal}
          onChange={(value) => onChange("meetingGoal", value)}
          rows={3}
        />

        <TextArea
          label="Booking instructions"
          value={form.bookingInstructions}
          onChange={(value) =>
            onChange("bookingInstructions", value)
          }
          placeholder="Available days/hours, who attends, required information, and when to offer a human follow-up."
          rows={5}
        />

        <div className="rf-agent-field-grid two">
          <Field
            label="Meeting owner email"
            type="email"
            value={form.calendarOwnerEmail}
            onChange={(value) =>
              onChange("calendarOwnerEmail", value)
            }
            placeholder="sales@codesynclabs.com"
          />
          <Field
            label="Booking timezone"
            value={form.bookingTimezone}
            onChange={(value) =>
              onChange("bookingTimezone", value)
            }
            placeholder="America/New_York"
          />
          <NumberField
            label="Meeting duration"
            value={form.meetingDurationMinutes}
            min={10}
            max={180}
            suffix="minutes"
            onChange={(value) =>
              onChange("meetingDurationMinutes", value)
            }
          />
          <Field
            label="Default lead timezone"
            value={form.defaultLeadTimezone}
            onChange={(value) =>
              onChange("defaultLeadTimezone", value)
            }
            placeholder="America/New_York"
          />
        </div>
      </article>

      <article className="rf-agent-card rf-agent-form-card">
        <div className="rf-agent-card-heading">
          <div>
            <span>Calling controls</span>
            <h2>Keep volume and timing controlled</h2>
          </div>
          <span className="rf-agent-section-number">04</span>
        </div>

        <label className="rf-agent-field">
          <span>Outbound Telnyx number</span>
          {numberOptions.length ? (
            <select
              value={form.fromNumber}
              onChange={(event) =>
                onChange("fromNumber", event.target.value)
              }
            >
              <option value="">Use server default</option>
              {numberOptions.map((number) => (
                <option key={number} value={number}>
                  {formatPhone(number)}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={form.fromNumber}
              onChange={(event) =>
                onChange("fromNumber", event.target.value)
              }
              placeholder="+1…"
            />
          )}
          <small>
            Use a number assigned to the Telnyx Call Control application for
            the AI agent.
          </small>
        </label>

        <div className="rf-agent-field-grid three">
          <NumberField
            label="Daily call limit"
            value={form.dailyCallLimit}
            min={1}
            max={5000}
            onChange={(value) =>
              onChange("dailyCallLimit", value)
            }
          />
          <NumberField
            label="Concurrent calls"
            value={form.concurrency}
            min={1}
            max={5}
            onChange={(value) =>
              onChange("concurrency", value)
            }
          />
          <NumberField
            label="Maximum attempts"
            value={form.maxAttempts}
            min={1}
            max={10}
            onChange={(value) =>
              onChange("maxAttempts", value)
            }
          />
          <NumberField
            label="Call window starts"
            value={form.callingWindowStartHour}
            min={8}
            max={20}
            suffix=":00"
            onChange={(value) =>
              onChange("callingWindowStartHour", value)
            }
          />
          <NumberField
            label="Call window ends"
            value={form.callingWindowEndHour}
            min={9}
            max={21}
            suffix=":00"
            onChange={(value) =>
              onChange("callingWindowEndHour", value)
            }
          />
          <NumberField
            label="Max call length"
            value={form.maxCallSeconds}
            min={60}
            max={3600}
            suffix="seconds"
            onChange={(value) =>
              onChange("maxCallSeconds", value)
            }
          />
        </div>

        <label className="rf-agent-check-row">
          <input
            type="checkbox"
            checked={form.recordingEnabled}
            onChange={(event) =>
              onChange("recordingEnabled", event.target.checked)
            }
          />
          <span>
            <b>Enable call recording</b>
            <small>
              Turn this on only after the workspace has approved disclosure,
              consent, access and retention rules.
            </small>
          </span>
        </label>

        <label className="rf-agent-check-row important">
          <input
            type="checkbox"
            checked={form.complianceConfirmed}
            onChange={(event) =>
              onChange(
                "complianceConfirmed",
                event.target.checked
              )
            }
          />
          <span>
            <b>Calling and suppression policy approved</b>
            <small>
              I confirm that the selected leads, calling windows, consent
              basis, DNC process, caller ID and recording policy have been
              reviewed for this campaign.
            </small>
          </span>
        </label>

        <label className="rf-agent-toggle-row">
          <span>
            <b>Agent enabled</b>
            <small>
              Disabling prevents new campaigns from starting.
            </small>
          </span>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) =>
              onChange("enabled", event.target.checked)
            }
          />
        </label>

        <button
          type="button"
          className="btn primary full rf-agent-save"
          disabled={
            saving ||
            analyzingWebsite ||
            !form.complianceConfirmed ||
            (Boolean(String(form.websiteUrl || "").trim()) &&
              !form.websiteIntelligence?.analyzedAt)
          }
          onClick={onSave}
        >
          {saving
            ? "Saving and syncing with Telnyx…"
            : "Save voice agent"}
        </button>
      </article>
    </section>
  );
}

function WebsiteIntelligencePreview({ intelligence, websiteUrl }) {
  const sourcePages = Array.isArray(intelligence?.sourcePages)
    ? intelligence.sourcePages
    : [];
  const services = Array.isArray(intelligence?.services)
    ? intelligence.services
    : [];
  const customers = Array.isArray(intelligence?.targetCustomers)
    ? intelligence.targetCustomers
    : [];
  const values = Array.isArray(intelligence?.valuePropositions)
    ? intelligence.valuePropositions
    : [];
  const questions = Array.isArray(intelligence?.qualificationQuestions)
    ? intelligence.qualificationQuestions
    : [];

  return (
    <div className="rf-agent-intel-preview">
      <div className="rf-agent-intel-meta">
        <span>
          <b>Claude profile ready</b>
          <small>{formatDateTime(intelligence.analyzedAt)}</small>
        </span>
        <span>
          <b>{sourcePages.length}</b>
          <small>pages analyzed</small>
        </span>
        <span>
          <b>{intelligence.claudeModel || "Claude"}</b>
          <small>website analysis model</small>
        </span>
      </div>

      <div className="rf-agent-intel-summary">
        <b>{intelligence.oneLinePitch || intelligence.companyName}</b>
        <p>{intelligence.companySummary || "Website profile generated."}</p>
        <small>{websiteUrl}</small>
      </div>

      <div className="rf-agent-intel-grid">
        <IntelList title="Services" items={services} />
        <IntelList title="Target customers" items={customers} />
        <IntelList title="Value propositions" items={values} />
        <IntelList title="Discovery questions" items={questions} />
      </div>
    </div>
  );
}

function IntelList({ title, items }) {
  return (
    <div className="rf-agent-intel-list">
      <b>{title}</b>
      {items.length ? (
        <ul>
          {items.slice(0, 6).map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <small>No grounded items extracted.</small>
      )}
    </div>
  );
}

function LeadQueue({
  agent,
  leads,
  queue,
  selectedLeadIds,
  allVisibleSelected,
  search,
  leadStatus,
  queueStatus,
  campaignLimit,
  googleLeadForm,
  googleLeadResult,
  findingGoogleLeads,
  customLeadForm,
  creatingCustomLead,
  callingCustomLead,
  assigning,
  starting,
  onGoogleLeadForm,
  onFindGoogleLeads,
  onCustomLeadForm,
  onQueueCustomLead,
  onCallCustomLead,
  onSearch,
  onLeadStatus,
  onQueueStatus,
  onCampaignLimit,
  onToggleLead,
  onToggleAll,
  onAssign,
  onStart,
}) {
  return (
    <section className="rf-agent-leads-layout">
      <article className="rf-agent-card rf-agent-custom-lead-card">
        <div className="rf-agent-card-heading compact">
          <div>
            <span>Custom AI call</span>
            <h2>Call one lead with private context for Claude</h2>
          </div>
          <span className="rf-agent-custom-badge">One-off / high-priority lead</span>
        </div>

        <p className="rf-agent-google-copy">
          Enter only the phone number and the details you know. The context is
          added privately to Claude for this call so the agent can personalize
          the conversation without reading your notes word-for-word. Calling
          still respects DNC, workspace limits and the configured local-time window.
        </p>

        <div className="rf-agent-custom-grid">
          <label className="rf-agent-field">
            <span>Contact name</span>
            <input
              value={customLeadForm.contactName}
              onChange={(event) =>
                onCustomLeadForm("contactName", event.target.value)
              }
              placeholder="e.g. John Smith"
            />
          </label>

          <label className="rf-agent-field">
            <span>Company</span>
            <input
              value={customLeadForm.companyName}
              onChange={(event) =>
                onCustomLeadForm("companyName", event.target.value)
              }
              placeholder="e.g. Acme Dental"
            />
          </label>

          <label className="rf-agent-field">
            <span>Role / title</span>
            <input
              value={customLeadForm.jobTitle}
              onChange={(event) =>
                onCustomLeadForm("jobTitle", event.target.value)
              }
              placeholder="e.g. Owner, CTO"
            />
          </label>

          <label className="rf-agent-field required">
            <span>Phone number *</span>
            <input
              value={customLeadForm.phone}
              onChange={(event) =>
                onCustomLeadForm("phone", event.target.value)
              }
              placeholder="+12135551234"
              inputMode="tel"
            />
          </label>

          <label className="rf-agent-field">
            <span>Email</span>
            <input
              type="email"
              value={customLeadForm.email}
              onChange={(event) =>
                onCustomLeadForm("email", event.target.value)
              }
              placeholder="john@example.com"
            />
          </label>

          <label className="rf-agent-field">
            <span>Website</span>
            <input
              value={customLeadForm.website}
              onChange={(event) =>
                onCustomLeadForm("website", event.target.value)
              }
              placeholder="https://example.com"
            />
          </label>

          <label className="rf-agent-field">
            <span>Location</span>
            <input
              value={customLeadForm.location}
              onChange={(event) =>
                onCustomLeadForm("location", event.target.value)
              }
              placeholder="Dallas, TX"
            />
          </label>

          <label className="rf-agent-field">
            <span>Lead timezone</span>
            <input
              value={customLeadForm.timezone}
              onChange={(event) =>
                onCustomLeadForm("timezone", event.target.value)
              }
              placeholder="America/New_York"
            />
          </label>
        </div>

        <label className="rf-agent-field rf-agent-custom-context">
          <span>Private lead context for Claude</span>
          <textarea
            rows={6}
            maxLength={12000}
            value={customLeadForm.context}
            onChange={(event) =>
              onCustomLeadForm("context", event.target.value)
            }
            placeholder="Example: John requested a website redesign last quarter but delayed because of budget. Their current site is on WordPress, they want online booking, and the best angle is reducing manual appointment work. Do not mention that we know their budget unless they bring it up."
          />
          <small>
            {String(customLeadForm.context || "").length.toLocaleString()} / 12,000 characters. These notes are private model context, not a script.
          </small>
        </label>

        <div className="rf-agent-custom-actions">
          <button
            type="button"
            className="btn light"
            disabled={
              creatingCustomLead ||
              callingCustomLead
            }
            onClick={onQueueCustomLead}
          >
            {creatingCustomLead ? "Adding to queue…" : "Add to AI queue"}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={
              creatingCustomLead ||
              callingCustomLead
            }
            onClick={onCallCustomLead}
          >
            {callingCustomLead ? "Starting AI call…" : "Call this lead now"}
          </button>
        </div>
      </article>

      <article className="rf-agent-card rf-agent-google-leads-card">
        <div className="rf-agent-card-heading compact">
          <div>
            <span>Google Places lead finder</span>
            <h2>Find fresh leads for Claude to call</h2>
          </div>
          <span className="rf-agent-google-badge">Existing ReachFly Google pipeline</span>
        </div>

        <p className="rf-agent-google-copy">
          This uses the same server-side Google Places + ReachFly enrichment
          implementation already used by your campaign builder. New callable
          leads are saved into this workspace and selected for review; calls do
          not start until you explicitly assign and start the queue.
        </p>

        <div className="rf-agent-google-grid">
          <label className="rf-agent-field">
            <span>Business niche</span>
            <input
              value={googleLeadForm.niche}
              onChange={(event) =>
                onGoogleLeadForm("niche", event.target.value)
              }
              placeholder="e.g. dental clinics, roofing companies"
            />
          </label>
          <label className="rf-agent-field">
            <span>Target location</span>
            <input
              value={googleLeadForm.location}
              onChange={(event) =>
                onGoogleLeadForm("location", event.target.value)
              }
              placeholder="e.g. Dallas, TX"
            />
          </label>
          <label className="rf-agent-field">
            <span>Lead count</span>
            <input
              type="number"
              min="1"
              max="250"
              value={googleLeadForm.limit}
              onChange={(event) =>
                onGoogleLeadForm("limit", Number(event.target.value))
              }
            />
          </label>
          <label className="rf-agent-field">
            <span>Radius</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={googleLeadForm.radiusKm}
              onChange={(event) =>
                onGoogleLeadForm("radiusKm", Number(event.target.value))
              }
            />
            <small>kilometers</small>
          </label>
          <label className="rf-agent-field">
            <span>Quality</span>
            <select
              value={googleLeadForm.qualityLevel}
              onChange={(event) =>
                onGoogleLeadForm("qualityLevel", event.target.value)
              }
            >
              <option value="strict">Strict</option>
              <option value="balanced">Balanced</option>
              <option value="broad">Broad</option>
            </select>
          </label>
          <button
            type="button"
            className="btn primary rf-agent-google-find"
            disabled={
              findingGoogleLeads ||
              !String(googleLeadForm.niche || "").trim() ||
              !String(googleLeadForm.location || "").trim()
            }
            onClick={onFindGoogleLeads}
          >
            {findingGoogleLeads
              ? "Searching Google Places…"
              : "Find leads with Google"}
          </button>
        </div>

        {googleLeadResult ? (
          <div className="rf-agent-google-result">
            <span>
              <b>{googleLeadResult.imported || 0}</b>
              <small>new callable leads</small>
            </span>
            <span>
              <b>{googleLeadResult.delivered || 0}</b>
              <small>Google/ReachFly results</small>
            </span>
            <span>
              <b>{googleLeadResult.duplicateOrUncallable || 0}</b>
              <small>duplicate or uncallable</small>
            </span>
            <span>
              <b>{googleLeadResult.campaign?.name || "Ready"}</b>
              <small>saved lead pool</small>
            </span>
          </div>
        ) : null}
      </article>

      <article className="rf-agent-card rf-agent-lead-picker">
        <div className="rf-agent-card-heading compact">
          <div>
            <span>Workspace lead pool</span>
            <h2>Review and assign leads to Claude</h2>
          </div>
          <b className="rf-agent-count">
            {selectedLeadIds.length} selected
          </b>
        </div>

        <div className="rf-agent-toolbar">
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search business, phone, email or campaign…"
          />
          <select
            value={leadStatus}
            onChange={(event) => onLeadStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="ready">Ready</option>
            <option value="follow_up">Follow-up</option>
            <option value="qualified">Qualified</option>
          </select>
          <button type="button" className="btn light" onClick={onToggleAll}>
            {allVisibleSelected ? "Clear visible" : "Select visible"}
          </button>
        </div>

        <div className="rf-agent-table-wrap">
          <table className="rf-agent-table">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Lead</th>
                <th>Campaign</th>
                <th>Status</th>
                <th>AI queue</th>
              </tr>
            </thead>
            <tbody>
              {leads.length ? (
                leads.map((lead) => (
                  <tr
                    key={lead.assignmentId}
                    className={lead.doNotCall ? "disabled" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        disabled={lead.doNotCall || !lead.phone}
                        checked={selectedLeadIds.includes(
                          lead.assignmentId
                        )}
                        onChange={() =>
                          onToggleLead(lead.assignmentId)
                        }
                      />
                    </td>
                    <td>
                      <b>{lead.name}</b>
                      <small>{formatPhone(lead.phone)}</small>
                      {lead.email ? <small>{lead.email}</small> : null}
                    </td>
                    <td>{lead.campaignName || "Uncategorized"}</td>
                    <td>
                      <StatusBadge value={lead.status} />
                    </td>
                    <td>
                      {lead.doNotCall ? (
                        <StatusBadge value="do_not_call" />
                      ) : lead.aiAgentStatus ? (
                        <StatusBadge value={lead.aiAgentStatus} />
                      ) : (
                        <span className="rf-agent-muted">Not queued</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="rf-agent-empty-cell">
                    No matching callable leads are available yet. Use Google Places above or import leads through the existing campaign builder.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="btn primary full"
          disabled={assigning || creatingCustomLead || callingCustomLead}
          onClick={onAssign}
        >
          {assigning
            ? "Adding leads…"
            : `Assign ${selectedLeadIds.length || "selected"} lead${
                selectedLeadIds.length === 1 ? "" : "s"
              } to agent`}
        </button>
      </article>

      <article className="rf-agent-card rf-agent-queue-card">
        <div className="rf-agent-card-heading compact">
          <div>
            <span>Controlled queue</span>
            <h2>Start approved outbound calls</h2>
          </div>
        </div>

        <div className="rf-agent-campaign-controls">
          <label>
            <span>Queue status</span>
            <select
              value={queueStatus}
              onChange={(event) => onQueueStatus(event.target.value)}
            >
              <option value="all">All</option>
              <option value="queued">Queued</option>
              <option value="deferred">Deferred</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="meeting_booked">Meeting booked</option>
              <option value="failed">Failed</option>
            </select>
          </label>

          <label>
            <span>Calls to start now</span>
            <input
              type="number"
              min="1"
              max="100"
              value={campaignLimit}
              onChange={(event) =>
                onCampaignLimit(Number(event.target.value))
              }
            />
          </label>

          <button
            type="button"
            className="btn primary"
            disabled={
              starting ||
              !queue.some(
                (item) => normalizeStatus(item.status) === "queued"
              )
            }
            onClick={onStart}
          >
            {starting ? "Starting calls…" : "Start calling"}
          </button>
        </div>

        <div className="rf-agent-queue-list">
          {queue.length ? (
            queue.map((item) => (
              <article key={item.id} className="rf-agent-queue-item">
                <div>
                  <b>
                    {item.customLeadDetails?.contactName ||
                      item.leadName ||
                      item.lead?.name}
                  </b>
                  <small>
                    {item.customLeadDetails?.companyName
                      ? `${item.customLeadDetails.companyName} · `
                      : ""}
                    {formatPhone(item.phone || item.lead?.phone)} · {item.campaignName || "Lead"}
                  </small>
                  {item.customContext ? (
                    <small className="rf-agent-queue-context">
                      Context: {String(item.customContext).slice(0, 180)}
                      {String(item.customContext).length > 180 ? "…" : ""}
                    </small>
                  ) : null}
                </div>
                <div className="rf-agent-queue-meta">
                  <StatusBadge value={item.status} />
                  <small>
                    Attempt {item.attemptCount || 0}/{item.maxAttempts || 3}
                  </small>
                  {item.nextAttemptAt ? (
                    <small>{formatDateTime(item.nextAttemptAt)}</small>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="No leads in this queue"
              text="Select CRM leads on the left and assign them to the voice agent."
            />
          )}
        </div>
      </article>
    </section>
  );
}

function CallsPanel({ calls, busyCallId, onCancel }) {
  const [monitorCallId, setMonitorCallId] = useState("");
  const [listening, setListening] = useState(false);
  const [audioStatus, setAudioStatus] = useState("idle");
  const [audioError, setAudioError] = useState("");
  const audioContextRef = useRef(null);
  const listeningRef = useRef(false);
  const nextAudioAtRef = useRef({
    inbound: 0,
    outbound: 0,
  });

  const monitorCall = useMemo(
    () =>
      calls.find(
        (call) => call.id === monitorCallId
      ) || null,
    [calls, monitorCallId]
  );

  const transcript = useMemo(
    () =>
      normalizeLiveTranscript(
        monitorCall?.messageHistory ||
          monitorCall?.conversation ||
          []
      ),
    [
      monitorCall?.messageHistory,
      monitorCall?.conversation,
    ]
  );

  useEffect(() => {
    const unsubscribeMedia =
      onWorkspaceSocket(
        "telnyx-ai-agent:media",
        (packet) => {
          if (
            !listeningRef.current ||
            !monitorCallId ||
            packet?.callId !== monitorCallId
          ) {
            return;
          }

          playPcmuPacket({
            packet,
            audioContextRef,
            nextAudioAtRef,
          });
        }
      );

    const unsubscribeStatus =
      onWorkspaceSocket(
        "telnyx-ai-agent:media-status",
        (event) => {
          if (
            !monitorCallId ||
            event?.callId !== monitorCallId
          ) {
            return;
          }

          setAudioStatus(
            String(
              event.status || "waiting"
            )
          );
        }
      );

    return () => {
      unsubscribeMedia?.();
      unsubscribeStatus?.();
    };
  }, [monitorCallId]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;

      if (monitorCallId) {
        void emitWorkspaceSocket(
          "telnyx-ai-agent:monitor:leave",
          {
            callId: monitorCallId,
          },
          {
            waitForAcknowledgement: false,
          }
        ).catch(() => {});
      }

      const context =
        audioContextRef.current;

      audioContextRef.current = null;

      if (context) {
        void context.close().catch(
          () => {}
        );
      }
    };
  }, [monitorCallId]);

  async function openMonitor(call) {
    if (!call?.id) return;

    if (
      monitorCallId &&
      monitorCallId !== call.id
    ) {
      await stopListening();
    }

    setMonitorCallId(call.id);
    setAudioError("");
    setAudioStatus(
      call.mediaStreamStatus ||
        (LIVE_CALL_STATES.has(
          normalizeStatus(call.status)
        )
          ? "waiting"
          : "ended")
    );
  }

  async function startListening() {
    if (!monitorCall?.id) {
      return;
    }

    const live =
      LIVE_CALL_STATES.has(
        normalizeStatus(
          monitorCall.status
        )
      );

    if (!live) {
      setAudioError(
        "This call has already ended. The live audio stream is only available while the call is active."
      );
      return;
    }

    setAudioError("");

    try {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error(
          "This browser does not support Web Audio."
        );
      }

      let context =
        audioContextRef.current;

      if (!context) {
        context =
          new AudioContextClass();

        audioContextRef.current =
          context;
      }

      await context.resume();

      nextAudioAtRef.current = {
        inbound:
          context.currentTime +
          0.05,
        outbound:
          context.currentTime +
          0.05,
      };

      /*
       * Set the ref before waiting for the socket acknowledgement so the
       * first media packets are not discarded if Telnyx is already streaming.
       */
      listeningRef.current = true;

      const joined =
        await emitWorkspaceSocket(
          "telnyx-ai-agent:monitor:join",
          {
            callId:
              monitorCall.id,
          },
          {
            timeoutMs: 15_000,
          }
        );

      setListening(true);
      setAudioStatus(
        joined?.status ||
          monitorCall.mediaStreamStatus ||
          "waiting"
      );
    } catch (error) {
      listeningRef.current = false;
      setListening(false);
      setAudioStatus("failed");
      setAudioError(
        error?.message ||
          "ReachFly could not start the live audio monitor."
      );
    }
  }

  async function stopListening() {
    const callId =
      monitorCallId;

    listeningRef.current = false;
    setListening(false);

    if (callId) {
      try {
        await emitWorkspaceSocket(
          "telnyx-ai-agent:monitor:leave",
          {
            callId,
          },
          {
            timeoutMs: 5_000,
          }
        );
      } catch {
        // The socket may already have disconnected. Local audio still stops.
      }
    }

    const context =
      audioContextRef.current;

    audioContextRef.current = null;
    nextAudioAtRef.current = {
      inbound: 0,
      outbound: 0,
    };

    if (context) {
      try {
        await context.close();
      } catch {
        // Ignore browser AudioContext close errors.
      }
    }

    setAudioStatus(
      monitorCall?.mediaStreamStatus ||
        "idle"
    );
  }

  return (
    <section className="rf-agent-call-monitor-layout">
      {monitorCall ? (
        <article className="rf-agent-card rf-agent-live-monitor">
          <div className="rf-agent-card-heading compact">
            <div>
              <span>Live conversation monitor</span>
              <h2>
                {monitorCall.leadName ||
                  "AI-agent call"}
              </h2>
              <small>
                {formatPhone(
                  monitorCall.toNumber
                )}
              </small>
            </div>

            <StatusBadge
              value={
                monitorCall.status ||
                "unknown"
              }
            />
          </div>

          <div className="rf-agent-live-monitor-actions">
            <button
              type="button"
              className={
                listening
                  ? "btn danger"
                  : "btn primary"
              }
              disabled={
                !LIVE_CALL_STATES.has(
                  normalizeStatus(
                    monitorCall.status
                  )
                )
              }
              onClick={() =>
                void (
                  listening
                    ? stopListening()
                    : startListening()
                )
              }
            >
              {listening
                ? "Stop listening"
                : "🔊 Listen live"}
            </button>

            {LIVE_CALL_STATES.has(
              normalizeStatus(
                monitorCall.status
              )
            ) ? (
              <button
                type="button"
                className="btn danger"
                disabled={
                  busyCallId ===
                  monitorCall.id
                }
                onClick={() =>
                  onCancel(
                    monitorCall.id
                  )
                }
              >
                {busyCallId ===
                monitorCall.id
                  ? "Ending…"
                  : "End call"}
              </button>
            ) : null}

            <button
              type="button"
              className="btn light"
              onClick={() =>
                setMonitorCallId("")
              }
            >
              Close monitor
            </button>
          </div>

          {audioError ? (
            <div className="rf-agent-monitor-warning">
              {audioError}
            </div>
          ) : null}

          <div className="rf-agent-monitor-status-grid">
            <MonitorStatus
              label="Phone"
              value={
                monitorCall.answeredAt
                  ? "Connected"
                  : formatLabel(
                      normalizeStatus(
                        monitorCall.status
                      )
                    )
              }
              good={Boolean(
                monitorCall.answeredAt
              )}
            />
            <MonitorStatus
              label="Claude"
              value={
                monitorCall.assistantStartedAt
                  ? "Attached"
                  : monitorCall.error
                    ? "Failed"
                    : "Waiting"
              }
              good={Boolean(
                monitorCall.assistantStartedAt
              )}
            />
            <MonitorStatus
              label="Live audio"
              value={
                listening
                  ? formatLabel(
                      audioStatus
                    )
                  : formatLabel(
                      monitorCall.mediaStreamStatus ||
                        audioStatus ||
                        "idle"
                    )
              }
              good={
                listening &&
                [
                  "connected",
                  "requested",
                ].includes(
                  normalizeStatus(
                    audioStatus
                  )
                )
              }
            />
            <MonitorStatus
              label="Transcript"
              value={
                transcript.length
                  ? `${transcript.length} messages`
                  : monitorCall.assistantStartedAt
                    ? "Waiting"
                    : "Unavailable"
              }
              good={
                transcript.length > 0
              }
            />
          </div>

          {monitorCall.error ? (
            <div className="rf-agent-monitor-warning">
              <b>Call error</b>
              <span>
                {monitorCall.error}
              </span>
            </div>
          ) : null}

          {monitorCall.contextInjectionWarning ? (
            <div className="rf-agent-monitor-warning">
              <b>Lead context warning</b>
              <span>
                {
                  monitorCall.contextInjectionWarning
                }
              </span>
            </div>
          ) : null}

          {monitorCall.mediaStreamError ? (
            <div className="rf-agent-monitor-warning">
              <b>Live-audio warning</b>
              <span>
                {
                  monitorCall.mediaStreamError
                }
              </span>
            </div>
          ) : null}

          <div className="rf-agent-live-transcript">
            <div className="rf-agent-live-transcript-heading">
              <div>
                <b>Live transcript</b>
                <small>
                  Updates arrive from the Telnyx AI conversation while the call is active.
                </small>
              </div>
              <span
                className={`rf-agent-live-dot ${
                  LIVE_CALL_STATES.has(
                    normalizeStatus(
                      monitorCall.status
                    )
                  )
                    ? "active"
                    : ""
                }`}
              />
            </div>

            <div className="rf-agent-live-transcript-body">
              {transcript.length ? (
                transcript.map(
                  (
                    message,
                    index
                  ) => (
                    <div
                      key={`${message.role}-${index}-${message.text.slice(
                        0,
                        24
                      )}`}
                      className={`rf-agent-transcript-message ${
                        message.role ===
                        "assistant"
                          ? "assistant"
                          : "lead"
                      }`}
                    >
                      <span>
                        {message.role ===
                        "assistant"
                          ? "AI"
                          : "Lead"}
                      </span>
                      <p>
                        {message.text}
                      </p>
                    </div>
                  )
                )
              ) : (
                <div className="rf-agent-transcript-empty">
                  {monitorCall.assistantStartedAt
                    ? "Waiting for the first conversation turn…"
                    : "The AI assistant has not attached to this call yet."}
                </div>
              )}
            </div>
          </div>

          <small className="rf-agent-monitor-privacy-note">
            Live monitoring is listen-only. ReachFly does not send your browser microphone into the call. Use monitoring only where your calling, notice, consent and supervision policies permit it.
          </small>
        </article>
      ) : null}

      <article className="rf-agent-card">
        <div className="rf-agent-card-heading compact">
          <div>
            <span>Conversation activity</span>
            <h2>AI-agent calls</h2>
          </div>
          <b className="rf-agent-count">{calls.length} records</b>
        </div>

        <div className="rf-agent-table-wrap">
          <table className="rf-agent-table calls">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Status</th>
                <th>Outcome</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Monitor</th>
                <th>Details</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {calls.length ? (
                calls.map((call) => {
                  const live = LIVE_CALL_STATES.has(
                    normalizeStatus(call.status)
                  );

                  return (
                    <tr key={call.id}>
                      <td>
                        <b>{call.leadName || "Unknown lead"}</b>
                        <small>{formatPhone(call.toNumber)}</small>
                      </td>
                      <td><StatusBadge value={call.status} /></td>
                      <td>
                        {call.outcome ? (
                          <StatusBadge value={call.outcome} />
                        ) : (
                          <span className="rf-agent-muted">Pending</span>
                        )}
                      </td>
                      <td>{formatDateTime(call.createdAt)}</td>
                      <td>{formatDuration(call.durationSeconds)}</td>
                      <td>
                        <button
                          type="button"
                          className={
                            live
                              ? "btn primary small"
                              : "btn light small"
                          }
                          onClick={() =>
                            void openMonitor(call)
                          }
                        >
                          {live
                            ? "Open live"
                            : "Transcript"}
                        </button>
                      </td>
                      <td>
                        <details className="rf-agent-call-details">
                          <summary>View</summary>
                          <dl>
                            <div>
                              <dt>Call control ID</dt>
                              <dd>{call.callControlId || "—"}</dd>
                            </div>
                            <div>
                              <dt>Conversation</dt>
                              <dd>{call.conversationId || "—"}</dd>
                            </div>
                            <div>
                              <dt>AI attached</dt>
                              <dd>
                                {call.assistantStartedAt
                                  ? formatDateTime(call.assistantStartedAt)
                                  : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt>Live audio</dt>
                              <dd>
                                {formatLabel(
                                  normalizeStatus(
                                    call.mediaStreamStatus ||
                                      "not_started"
                                  )
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt>Notes</dt>
                              <dd>{call.notes || call.error || "—"}</dd>
                            </div>
                            <div>
                              <dt>Hangup</dt>
                              <dd>{call.hangupCause || "—"}</dd>
                            </div>
                          </dl>
                        </details>
                      </td>
                      <td>
                        {live ? (
                          <button
                            type="button"
                            className="btn danger small"
                            disabled={busyCallId === call.id}
                            onClick={() => onCancel(call.id)}
                          >
                            {busyCallId === call.id ? "Ending…" : "End"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="rf-agent-empty-cell">
                    No AI-agent calls have been made yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function MonitorStatus({
  label,
  value,
  good = false,
}) {
  return (
    <div
      className={`rf-agent-monitor-status ${
        good ? "good" : ""
      }`}
    >
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function normalizeLiveTranscript(value) {
  const messages =
    findConversationMessages(
      value
    );

  return messages
    .map((message) => {
      const role =
        normalizeStatus(
          message?.role
        );

      if (
        ![
          "assistant",
          "user",
        ].includes(role)
      ) {
        return null;
      }

      const text =
        conversationMessageText(
          message?.content ??
            message?.text
        );

      if (!text) {
        return null;
      }

      return {
        role,
        text,
      };
    })
    .filter(Boolean)
    .slice(-100);
}

function findConversationMessages(
  value,
  depth = 0
) {
  if (depth > 6) {
    return [];
  }

  if (Array.isArray(value)) {
    if (
      value.some(
        (item) =>
          item &&
          typeof item ===
            "object" &&
          (
            "role" in item ||
            "content" in item
          )
      )
    ) {
      return value;
    }

    for (const item of value) {
      const nested =
        findConversationMessages(
          item,
          depth + 1
        );

      if (nested.length) {
        return nested;
      }
    }

    return [];
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return [];
  }

  for (const key of [
    "message_history",
    "messageHistory",
    "messages",
    "conversation",
    "payload",
    "data",
  ]) {
    if (
      value[key] !==
      undefined
    ) {
      const nested =
        findConversationMessages(
          value[key],
          depth + 1
        );

      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
}

function conversationMessageText(
  value
) {
  if (
    typeof value ===
    "string"
  ) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (
          typeof item ===
          "string"
        ) {
          return item;
        }

        if (
          item &&
          typeof item ===
            "object"
        ) {
          return (
            item.text ||
            item.content ||
            ""
          );
        }

        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    return String(
      value.text ||
        value.content ||
        ""
    ).trim();
  }

  return "";
}

function playPcmuPacket({
  packet,
  audioContextRef,
  nextAudioAtRef,
}) {
  const context =
    audioContextRef.current;

  if (
    !context ||
    context.state === "closed"
  ) {
    return;
  }

  const payload =
    String(
      packet?.payload || ""
    );

  if (!payload) {
    return;
  }

  let bytes = null;

  try {
    const binary =
      window.atob(payload);

    bytes =
      new Uint8Array(
        binary.length
      );

    for (
      let index = 0;
      index < binary.length;
      index += 1
    ) {
      bytes[index] =
        binary.charCodeAt(
          index
        );
    }
  } catch {
    return;
  }

  if (!bytes.length) {
    return;
  }

  const sampleRate =
    Number(
      packet?.sampleRate ||
        8000
    ) || 8000;

  const audioBuffer =
    context.createBuffer(
      1,
      bytes.length,
      sampleRate
    );

  const samples =
    audioBuffer.getChannelData(
      0
    );

  for (
    let index = 0;
    index < bytes.length;
    index += 1
  ) {
    samples[index] =
      decodeMuLawSample(
        bytes[index]
      );
  }

  const source =
    context.createBufferSource();

  source.buffer =
    audioBuffer;

  const gain =
    context.createGain();

  gain.gain.value = 0.92;

  source.connect(gain);
  gain.connect(
    context.destination
  );

  const track =
    packet?.track ===
    "outbound"
      ? "outbound"
      : "inbound";

  const floor =
    context.currentTime +
    0.03;

  const scheduledAt =
    Math.max(
      floor,
      Number(
        nextAudioAtRef
          .current?.[track] ||
          0
      )
    );

  source.start(
    scheduledAt
  );

  nextAudioAtRef.current = {
    ...nextAudioAtRef.current,
    [track]:
      scheduledAt +
      audioBuffer.duration,
  };
}

function decodeMuLawSample(
  value
) {
  let sample =
    (~value) & 0xff;

  const sign =
    sample & 0x80;

  const exponent =
    (sample >> 4) & 0x07;

  const mantissa =
    sample & 0x0f;

  let magnitude =
    ((mantissa << 3) +
      0x84) <<
    exponent;

  magnitude -= 0x84;

  const signed =
    sign
      ? -magnitude
      : magnitude;

  return Math.max(
    -1,
    Math.min(
      1,
      signed / 32768
    )
  );
}

function MeetingsPanel({ meetings }) {
  return (
    <section className="rf-agent-meeting-grid">
      {meetings.length ? (
        meetings.map((meeting) => (
          <article className="rf-agent-meeting-card" key={meeting.id}>
            <header>
              <div className="rf-agent-calendar-date">
                <b>{formatDay(meeting.startAt)}</b>
                <span>{formatMonth(meeting.startAt)}</span>
              </div>
              <div>
                <span className="eyebrow">Confirmed meeting</span>
                <h3>{meeting.leadName || meeting.attendeeName || "Lead"}</h3>
                <p>{formatDateTime(meeting.startAt)}</p>
              </div>
              <StatusBadge value={meeting.status} />
            </header>
            <dl>
              <div>
                <dt>Timezone</dt>
                <dd>{meeting.timezone || "—"}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{meeting.durationMinutes || 30} minutes</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{meeting.attendeeEmail || "Not supplied"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{formatPhone(meeting.attendeePhone)}</dd>
              </div>
            </dl>
            {meeting.notes ? <p className="rf-agent-meeting-notes">{meeting.notes}</p> : null}
          </article>
        ))
      ) : (
        <div className="rf-agent-card">
          <EmptyState
            title="No meetings booked yet"
            text="Confirmed appointments created by the Telnyx assistant will appear here in real time."
          />
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, text }) {
  return (
    <article className="rf-agent-metric">
      <span>{label}</span>
      <b>{value}</b>
      <small>{text}</small>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}) {
  return (
    <label className="rf-agent-field">
      <span>{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix = "",
}) {
  return (
    <label className="rf-agent-field">
      <span>{label}</span>
      <div className="rf-agent-number-input">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <small>{suffix}</small> : null}
      </div>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder = "",
}) {
  return (
    <label className="rf-agent-field">
      <span>{label}</span>
      <textarea
        rows={rows}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function StatusBadge({ value }) {
  const normalized = normalizeStatus(value || "unknown");
  return (
    <span className={`rf-agent-status ${statusTone(normalized)}`}>
      {formatLabel(normalized)}
    </span>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="rf-agent-empty">
      <span>RF</span>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}

function normalizeAgentForm(value = {}) {
  return {
    ...DEFAULT_FORM,
    ...value,
    model:
      value.model ||
      DEFAULT_FORM.model,
    websiteUrl:
      value.websiteUrl ||
      DEFAULT_FORM.websiteUrl,
    websiteIntelligence:
      value.websiteIntelligence && typeof value.websiteIntelligence === "object"
        ? value.websiteIntelligence
        : {},
    meetingDurationMinutes: safeNumber(
      value.meetingDurationMinutes,
      30
    ),
    callingWindowStartHour: safeNumber(
      value.callingWindowStartHour,
      9
    ),
    callingWindowEndHour: safeNumber(
      value.callingWindowEndHour,
      17
    ),
    dailyCallLimit: safeNumber(value.dailyCallLimit, 25),
    concurrency: safeNumber(value.concurrency, 1),
    maxAttempts: safeNumber(value.maxAttempts, 3),
    maxCallSeconds: safeNumber(value.maxCallSeconds, 600),
    ringTimeoutSeconds: safeNumber(
      value.ringTimeoutSeconds,
      45
    ),
    recordingEnabled: value.recordingEnabled === true,
    complianceConfirmed: value.complianceConfirmed === true,
    enabled: value.enabled !== false,
  };
}

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function formatLabel(value) {
  return String(value || "Unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(value) {
  if (
    [
      "completed",
      "qualified",
      "meeting_booked",
      "confirmed",
      "assistant_active",
      "answered",
      "ready",
    ].includes(value)
  ) {
    return "green";
  }
  if (
    [
      "queued",
      "ringing",
      "initiated",
      "in_progress",
      "callback",
      "follow_up",
      "deferred",
    ].includes(value)
  ) {
    return "amber";
  }
  if (
    [
      "failed",
      "cancelled",
      "do_not_call",
      "invalid_number",
      "not_interested",
    ].includes(value)
  ) {
    return "red";
  }
  return "gray";
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value || "—";
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  if (!total) return "—";
  const minutes = Math.floor(total / 60);
  const remainder = Math.floor(total % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatDay(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { day: "2-digit" });
}

function formatMonth(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short" });
}

function shorten(value, length) {
  const text = String(value || "");
  return text.length > length
    ? `${text.slice(0, length - 1)}…`
    : text;
}
