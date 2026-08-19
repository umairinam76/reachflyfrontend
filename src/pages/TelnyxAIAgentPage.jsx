import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Navigate,
  useSearchParams,
} from "react-router-dom";

import {
  Activity,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Phone,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  Users,
  Zap,
} from "../components/icons";

import {
  Avatar,
  Style,
} from "@dicebear/core";
import loreleiDefinition from "@dicebear/styles/lorelei.json" with { type: "json" };

import {
  useAuth,
} from "../auth/AuthContext";

import {
  apiRequest,
  emitWorkspaceSocket,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import "../styles.css";
// import "../voice-agent-v55.css";
// import "../voice-agent-onboarding-wizard.css";

const REACHFLY_VOICE_ART_STYLE = new Style(loreleiDefinition);

const FAST_HUMAN_GREETING =
  "Hey {{greeting_name}}, James from {{company_name}}. Quick disclosure — I’m an AI sales agent with the team, and this call may be recorded. I’ll keep it brief. I was curious... is your website consistently turning visitors into real sales conversations, or do too many people land there and leave without ever becoming a lead?";

const FAST_HUMAN_PERSONA =
  "Warm, sharp, concise, and conversational. Keep most turns short, use contractions and plain words, and match the prospect’s pace. React naturally without repetitive acknowledgement phrases. Avoid canned AI or call-center filler such as got it, gotcha, absolutely, certainly, perfect, awesome, I understand, or that makes sense. Allow brief silence instead of filling every gap. Never use fake laughter, fake breathing, written stage directions, or claim to be human.";

const LANGUAGE_OPTIONS = [
  ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"],
  ["pt", "Portuguese"], ["it", "Italian"], ["nl", "Dutch"], ["ar", "Arabic"],
  ["hi", "Hindi"], ["ur", "Urdu"], ["zh", "Chinese"], ["ja", "Japanese"], ["ko", "Korean"],
  ["ru", "Russian"], ["tr", "Turkish"], ["pl", "Polish"], ["id", "Indonesian"],
  ["vi", "Vietnamese"], ["uk", "Ukrainian"],
];

const DEFAULT_FORM = {
  name: "James",
  description:
    "ReachFly outbound qualification and meeting-booking agent.",
  companyName: "",
  elevenLabsAgentId: "",
  voice: "fNZkPhLHNXqE8oMjamg6",
  model: "elevenlabs-managed-llm",
  primaryLanguage: "en",
  supportedLanguages: ["en"],
  autoDetectLanguage: true,
  languageVoices: {},
  languageGreetings: {},
  websiteUrl: "",
  websiteIntelligence: {},
  greeting: FAST_HUMAN_GREETING,
  disclosure:
    "Clearly identify yourself as an automated AI sales assistant and identify the company at the beginning of the call.",
  persona: FAST_HUMAN_PERSONA,
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
  callingMode: "outbound",
  inboundObjective: "general",
  inboundGreeting:
    "Thanks for calling {{company_name}}. I'm {{agent_name}}, the team's AI phone assistant. How can I help?",
  inboundInstructions: "",
  inboundBusinessHoursStart: 9,
  inboundBusinessHoursEnd: 18,
  inboundAfterHoursMode: "message",
  humanTransferNumber: "",
  inboundActions: {
    captureCaller: true,
    sendEmail: false,
    sendWhatsApp: false,
    bookMeeting: true,
    updateCrm: true,
    transferHuman: false,
  },
  outboundActions: {
    sendEmail: false,
    sendWhatsApp: false,
    bookMeeting: true,
    updateCrm: true,
  },
  defaultLeadTimezone: "America/New_York",
  callingWindowStartHour: 9,
  callingWindowEndHour: 17,
  dailyCallLimit: 25,
  concurrency: 1,
  maxAttempts: 3,
  maxCallSeconds: 300,
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
  timezone: "",
  preferredLanguage: "",
  context: "",
};

const TABS = [
  ["setup", "Voice setup"],
  ["leads", "Lead queue"],
  ["calls", "Live calls"],
  ["meetings", "Meetings"],
];

const DEFAULT_VOICE_VIEWS = {
  setup: "calling",
  leads: "dialer",
  calls: "active-calls",
  meetings: "upcoming",
};

const SETUP_VIEW_CONFIG = {
  calling: { step: 0, numberPath: "owned" },
  "my-numbers": { step: 1, numberPath: "owned" },
  "buy-numbers": { step: 1, numberPath: "buy" },
  "connect-number": { step: 1, numberPath: "existing" },
  agent: { step: 2, numberPath: "owned" },
  business: { step: 3, numberPath: "owned" },
  workflow: { step: 4, numberPath: "owned" },
  activate: { step: 5, numberPath: "owned" },
};

const SETUP_STEP_VIEWS = [
  "calling",
  "my-numbers",
  "agent",
  "business",
  "workflow",
  "activate",
];

const LEAD_VIEW_TO_STEP = {
  dialer: 0,
  "quick-lead": 0,
  "google-leads": 1,
  "lead-pool": 2,
  "queue-activity": 3,
  "launch-calls": 4,
};

const LEAD_STEP_VIEWS = [
  "dialer",
  "google-leads",
  "lead-pool",
  "queue-activity",
  "launch-calls",
];

const VOICE_UI_VERSION = "7.0-stitch-voice-workspace";

const LIVE_CALL_STATES = new Set([
  "creating",
  "queued",
  "initiated",
  "ringing",
  "answered",
  "assistant_active",
  "assistant_failed",
  "active",
]);

export default function TelnyxAIAgentPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const onboardingMode = searchParams.get("onboarding") === "1";
  const refreshTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const lastToastRef = useRef({
    error: "",
    success: "",
  });

  const [dashboard, setDashboard] = useState(null);
  const [voiceCommerce, setVoiceCommerce] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [voices, setVoices] = useState([]);
  const [elevenLabsAgents, setElevenLabsAgents] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const requestedTab = searchParams.get("tab");
  const activeTab = TABS.some(
    ([value]) => value === requestedTab
  )
    ? requestedTab
    : "setup";
  const requestedView =
    searchParams.get("view") ||
    DEFAULT_VOICE_VIEWS[activeTab] ||
    DEFAULT_VOICE_VIEWS.setup;
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
  const [executionAgentId, setExecutionAgentId] = useState("");
  const [campaignContext, setCampaignContext] = useState("");
  const [campaignLanguage, setCampaignLanguage] = useState("");
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
            timeoutMs: 45_000,
          }
        );

        if (!mountedRef.current) return;
        setDashboard(response);
        setAccessDenied(false);
        const urlAgentId = new URLSearchParams(window.location.search).get("agentId") || "";
        const responseAgents = Array.isArray(response?.agents) ? response.agents : [];
        const selectedResponseAgent =
          responseAgents.find((item) => item.id === urlAgentId) ||
          response.agent ||
          responseAgents[0] ||
          null;
        setForm((current) =>
          normalizeAgentForm({
            ...current,
            ...(selectedResponseAgent || {}),
            companyName:
              selectedResponseAgent?.companyName ||
              response.workspace?.name ||
              current.companyName,
            fromNumber:
              selectedResponseAgent?.fromNumber ||
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
              "The ReachFly Voice workspace could not be loaded."
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

  const loadVoiceCommerce = useCallback(async () => {
    try {
      const response = await apiRequest(
        "/voice-commerce",
        { timeoutMs: 20_000 }
      );
      if (!mountedRef.current) return null;
      setVoiceCommerce(response);
      return response;
    } catch (requestError) {
      if (!mountedRef.current) return null;
      if (![403, 404].includes(Number(requestError?.status))) {
        setError(
          requestError?.message ||
            "Business-number purchase status could not be loaded."
        );
      }
      return null;
    }
  }, []);

  const loadBillingData = useCallback(async () => {
    try {
      const response = await apiRequest(
        "/billing/credits",
        { timeoutMs: 20_000 }
      );
      if (!mountedRef.current) return null;
      setBillingData(response);
      return response;
    } catch (requestError) {
      if (!mountedRef.current) return null;
      if (![403, 404].includes(Number(requestError?.status))) {
        setError(
          requestError?.message ||
            "AI call-credit balance could not be loaded."
        );
      }
      return null;
    }
  }, []);

  const loadVoices = useCallback(async () => {
    try {
      const response = await apiRequest(
        "/telnyx/ai-agent/voices",
        {
          timeoutMs: 30_000,
        }
      );
      if (!mountedRef.current) return;
      const loadedVoices = Array.isArray(response?.voices)
        ? response.voices
        : [];

      setVoices(loadedVoices);
      setForm((current) => {
        if (!loadedVoices.length) return current;

        const exact = loadedVoices.find(
          (voice) =>
            String(voice.id || "").toLowerCase() ===
            String(current.voice || "").toLowerCase()
        );
        if (exact) return current;

        const mapped =
          resolveFrontendFriendlyVoice(
            loadedVoices,
            current.voice
          ) ||
          chooseFrontendRecommendedVoice(
            loadedVoices
          );

        return mapped
          ? {
              ...current,
              voice: mapped.id,
            }
          : current;
      });
    } catch (requestError) {
      if (!mountedRef.current) return;
      setError(
        requestError?.message ||
          "The linked voice could not be loaded."
      );
    }
  }, []);

  const loadElevenLabsAgents = useCallback(async () => {
    try {
      const response = await apiRequest(
        "/telnyx/ai-agent/agents",
        { timeoutMs: 45_000 }
      );
      if (!mountedRef.current) return;
      const loadedAgents = Array.isArray(response?.agents)
        ? response.agents
        : [];
      setElevenLabsAgents(loadedAgents);
      setForm((current) => {
        if (current.elevenLabsAgentId || !loadedAgents.length) return current;
        const configuredId = dashboard?.agent?.elevenLabsAgentId ||
          dashboard?.diagnostics?.elevenLabsAgentId ||
          "";
        const selected =
          loadedAgents.find((item) => item.agentId === configuredId) || null;

        // Never attach a fresh customer workspace to the first provider agent.
        // Customer workspaces receive their own managed ElevenLabs agent when
        // activation is saved; Codesync's provider profile must not leak into
        // another tenant's form.
        return selected
          ? {
              ...current,
              elevenLabsAgentId: selected.agentId,
              voice: current.voice || selected.voiceId || "fNZkPhLHNXqE8oMjamg6",
            }
          : current;
      });
    } catch (requestError) {
      if (!mountedRef.current) return;
      if (![403, 404].includes(Number(requestError?.status))) {
        setError(
          requestError?.message ||
            "Voice-agent profiles could not be loaded."
        );
      }
    }
  }, [dashboard?.agent?.elevenLabsAgentId, dashboard?.diagnostics?.elevenLabsAgentId]);

  useEffect(() => {
    mountedRef.current = true;
    void Promise.all([
      loadDashboard(),
      loadVoiceCommerce(),
      loadBillingData(),
      loadVoices(),
      loadElevenLabsAgents(),
    ]);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(refreshTimerRef.current);
    };
  }, [
    loadDashboard,
    loadVoiceCommerce,
    loadBillingData,
    loadVoices,
    loadElevenLabsAgents,
  ]);

  useEffect(() => {
    const scheduleSilentRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        void Promise.all([
          loadDashboard({ silent: true }),
          loadVoiceCommerce(),
          loadBillingData(),
        ]);
      }, 250);
    };

    const events = [
      "telnyx-ai-agent:updated",
      "telnyx-ai-agent:call-updated",
      "telnyx-ai-agent:meeting-booked",
      "voice-commerce:number-active",
      "billing:ai-call-credits-updated",
      "lead:updated",
    ];
    const unsubscribers = events.map((eventName) =>
      onWorkspaceSocket(eventName, scheduleSilentRefresh)
    );

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void Promise.all([
          loadDashboard({ silent: true }),
          loadVoiceCommerce(),
          loadBillingData(),
        ]);
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
  }, [loadDashboard, loadVoiceCommerce, loadBillingData]);

  useEffect(() => {
    if (!error || lastToastRef.current.error === error) return;
    lastToastRef.current.error = error;
    notifyVoice(
      "error",
      "Voice workspace needs attention",
      error
    );
  }, [error]);

  useEffect(() => {
    if (!success || lastToastRef.current.success === success) return;
    lastToastRef.current.success = success;
    notifyVoice(
      "success",
      "Voice workspace updated",
      success
    );
  }, [success]);

  useEffect(() => {
    if (onboardingMode) {
      selectVoiceTab("setup");
    }
  }, [onboardingMode]);

  useEffect(() => {
    const numberPayment = searchParams.get("numberPayment");
    const orderId = searchParams.get("order");
    const voicePayment = searchParams.get("voicePayment");
    let cancelled = false;

    const clearCommerceReturnParams = (...names) => {
      const next = new URLSearchParams(searchParams);
      names.forEach((name) => next.delete(name));
      setSearchParams(next, { replace: true });
    };

    async function pollNumberOrder() {
      if (numberPayment === "cancelled") {
        setSuccess("");
        setError("Business-number purchase was cancelled. No number was provisioned.");
        clearCommerceReturnParams("numberPayment", "order");
        return;
      }

      if (numberPayment !== "success" || !orderId) return;

      setError("");
      setSuccess(
        "Payment returned successfully. ReachFly is verifying payment and provisioning your business number."
      );

      for (let attempt = 0; attempt < 30 && !cancelled; attempt += 1) {
        try {
          const response = await apiRequest(
            `/voice-commerce/orders/${encodeURIComponent(orderId)}`,
            { timeoutMs: 20_000 }
          );
          const order = response?.order || response;
          const status = normalizeStatus(order?.status);

          if (status === "active") {
            await Promise.all([
              loadVoiceCommerce(),
              loadBillingData(),
              loadDashboard({ silent: true }),
            ]);
            if (!cancelled) {
              setSuccess(
                `${formatPhone(order.phoneNumber)} is active and linked to this workspace. Buy AI call credits next, then save the Voice Agent.`
              );
              clearCommerceReturnParams("numberPayment", "order");
            }
            return;
          }

          if ([
            "payment_failed",
            "provision_failed",
            "failure",
            "refund_review_required",
          ].includes(status)) {
            if (!cancelled) {
              setSuccess("");
              setError(
                order?.error ||
                  "Payment was received but the business number could not be activated automatically. Use Retry provisioning or contact support before calling."
              );
              await loadVoiceCommerce();
              clearCommerceReturnParams("numberPayment", "order");
            }
            return;
          }
        } catch (requestError) {
          if (attempt >= 29 && !cancelled) {
            setError(
              requestError?.message ||
                "Number provisioning status could not be verified. Refresh this page to check the order."
            );
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
    }

    async function refreshVoiceCredits() {
      if (voicePayment === "cancelled") {
        setSuccess("");
        setError("AI call-credit purchase was cancelled. No call credits were added.");
        clearCommerceReturnParams("voicePayment", "purchase");
        return;
      }
      if (voicePayment !== "success") return;

      setError("");
      setSuccess(
        "AI call-credit payment returned successfully. ReachFly is verifying the payment and funding the dedicated call wallet."
      );
      for (const delay of [1200, 3000, 6000]) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
        if (cancelled) return;
        const nextBilling = await loadBillingData();
        if (Number(nextBilling?.aiCalling?.wallet?.balance || 0) > 0) {
          setSuccess(
            `${formatCreditsCompact(nextBilling.aiCalling.wallet.balance)} AI call credits are available. You can now finish Voice Agent setup.`
          );
          clearCommerceReturnParams("voicePayment", "purchase");
          return;
        }
      }
      clearCommerceReturnParams("voicePayment", "purchase");
    }

    void pollNumberOrder();
    void refreshVoiceCredits();

    return () => {
      cancelled = true;
    };
  }, [
    searchParams,
    setSearchParams,
    loadVoiceCommerce,
    loadBillingData,
    loadDashboard,
  ]);

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
  const activeCalls = useMemo(
    () =>
      calls.filter((call) =>
        LIVE_CALL_STATES.has(normalizeStatus(call.status))
      ),
    [calls]
  );
  const activeCustomPhoneCall = useMemo(() => {
    const phone = normalizePhoneKey(customLeadForm.phone);
    if (!phone) return null;
    return (
      activeCalls.find(
        (call) =>
          normalizePhoneKey(call.toNumber) === phone
      ) || null
    );
  }, [activeCalls, customLeadForm.phone]);
  const meetings = Array.isArray(dashboard?.meetings)
    ? dashboard.meetings
    : [];
  const diagnostics = dashboard?.diagnostics || {};
  const workspaceAgents = Array.isArray(dashboard?.agents)
    ? dashboard.agents
    : dashboard?.agent
      ? [dashboard.agent]
      : [];
  const requestedAgentId = searchParams.get("agentId") || "";
  const agent =
    workspaceAgents.find((item) => item.id === requestedAgentId) ||
    dashboard?.agent ||
    workspaceAgents[0] ||
    null;
  const executionAgent =
    workspaceAgents.find((item) => item.id === executionAgentId) ||
    agent ||
    null;
  useEffect(() => {
    if (!workspaceAgents.length) {
      if (executionAgentId) setExecutionAgentId("");
      return;
    }
    if (!workspaceAgents.some((item) => item.id === executionAgentId)) {
      setExecutionAgentId(agent?.id || workspaceAgents[0].id);
    }
  }, [workspaceAgents, executionAgentId, agent?.id]);

  const onboardingState = useMemo(
    () =>
      buildVoiceOnboardingState({
        form,
        agent,
        diagnostics,
        voiceCommerce,
        billingData,
        workspaceName:
          dashboard?.workspace?.name ||
          user?.companyName ||
          "",
      }),
    [
      form,
      agent,
      diagnostics,
      voiceCommerce,
      billingData,
      dashboard?.workspace?.name,
      user?.companyName,
    ]
  );
  const recommendedVoice = useMemo(
    () => chooseFrontendRecommendedVoice(voices),
    [voices]
  );

  const voiceOverview = useMemo(
    () =>
      buildVoiceOverview({
        calls,
        meetings,
        dashboard,
        diagnostics,
        billingData,
        voiceCommerce,
        form,
        agent,
      }),
    [
      calls,
      meetings,
      dashboard,
      diagnostics,
      billingData,
      voiceCommerce,
      form,
      agent,
    ]
  );

  const allVisibleSelected =
    assignableLeads.length > 0 &&
    assignableLeads.every((lead) =>
      selectedLeadIds.includes(lead.assignmentId)
    );

  function selectVoiceTab(value, { replace = false } = {}) {
    const safeTab = TABS.some(([tabValue]) => tabValue === value)
      ? value
      : "setup";

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", safeTab);
    nextParams.set(
      "view",
      DEFAULT_VOICE_VIEWS[safeTab] ||
        DEFAULT_VOICE_VIEWS.setup
    );

    // onboarding=1 intentionally renders AgentSetup across the whole page.
    // Remove it when navigating to a real workspace section.
    if (safeTab !== "setup") {
      nextParams.delete("onboarding");
    }

    setSearchParams(nextParams, { replace });
  }

  function selectVoiceView(
    tab,
    view,
    { replace = false } = {}
  ) {
    const safeTab = TABS.some(([tabValue]) => tabValue === tab)
      ? tab
      : "setup";
    const safeView =
      String(view || "").trim() ||
      DEFAULT_VOICE_VIEWS[safeTab] ||
      DEFAULT_VOICE_VIEWS.setup;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", safeTab);
    nextParams.set("view", safeView);

    if (safeTab !== "setup") {
      nextParams.delete("onboarding");
    }

    setSearchParams(nextParams, { replace });
  }

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

  async function submitCustomLead(callNow = false, testCall = false) {
    const phone = String(customLeadForm.phone || "").trim();
    if (!phone) {
      setError("Enter the custom lead phone number first.");
      return;
    }

    if (callNow && activeCustomPhoneCall) {
      setError("");
      setSuccess(
        "This number is already on an active AI call. End the current call below or open Calls to monitor it."
      );
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
            testCall,
            testCallConfirmed: testCall,
            // Leave this blank when the manager did not enter a timezone so
            // the backend can infer a safe single-timezone country from the
            // phone prefix (for example +92 -> Asia/Karachi).
            defaultTimezone: customLeadForm.timezone || "",
            maxAttempts: Number(form.maxAttempts || 3),
            dailyCallLimit: Number(form.dailyCallLimit || 25),
            fromNumber: executionAgent?.fromNumber || form.fromNumber,
            agentId: executionAgent?.id || executionAgentId,
            campaignContext,
          },
          timeoutMs: callNow ? 60_000 : 30_000,
        }
      );

      if (response?.alreadyActive && response?.activeCall?.id) {
        setError("");
        setSuccess(
          "This number is already on an active AI call. Use End current call or open Calls to monitor it."
        );
        await loadDashboard({ silent: true });
        return;
      }

      setCustomLeadForm({
        ...DEFAULT_CUSTOM_LEAD_FORM,
      });
      setSelectedLeadIds([]);
      await loadDashboard({ silent: true });

      if (callNow) {
        const result = response?.callResult || {};
        const started = Number(result.started || 0);
        const deferred = Number(result.deferred || 0);
        const failed = Number(result.failed || 0);
        const firstResult = Array.isArray(result.results)
          ? result.results.find((item) => item?.reason || item?.error)
          : null;
        const providerReason =
          firstResult?.reason || firstResult?.error || "";
        const reusedPrefix = response?.reusedQueueItem
          ? "The existing pending/deferred queue entry was refreshed. "
          : "";
        setSuccess(
          started
            ? testCall
              ? `${reusedPrefix}The controlled test call started through ReachFly Voice and bypassed only the configured calling-time window. Open Live Calls to track or end it.`
              : `${reusedPrefix}The AI call started through ReachFly Voice. Open Live Calls to track or end it.`
            : deferred
              ? `${reusedPrefix}The call is queued but was not dialed yet${providerReason ? `: ${providerReason}` : ". Check the lead timezone and calling window."}`
              : failed
                ? `${reusedPrefix}The call could not start${providerReason ? `: ${providerReason}` : ". Check Calls and backend logs for the provider error."}`
                : response?.message || "The custom lead was queued for an AI call."
        );
        selectVoiceTab("calls");
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

  function startControlledTestCall() {
    const confirmed = window.confirm(
      "This test call bypasses the configured local calling-time window for this ONE manually entered Custom AI Call. DNC/suppression, valid-number, active-call, concurrency and daily-limit protections still apply. Use only a number you control or where you have permission to test. Continue?"
    );
    if (!confirmed) return;
    void submitCustomLead(true, true);
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
            "elevenlabs-managed-llm",
        })
      );
      setSuccess(
        `ReachFly analyzed ${response.pagesAnalyzed || 0} website page${
          response.pagesAnalyzed === 1 ? "" : "s"
        }. The voice agent can now use this knowledge naturally.`
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "ReachFly could not analyze the company website."
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
      let payload = {
        ...normalizeAgentForm(form),
        ...(agent?.id || requestedAgentId
          ? { agentId: agent?.id || requestedAgentId }
          : {}),
      };
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
              ...(agent?.id || requestedAgentId
                ? { agentId: agent?.id || requestedAgentId }
                : {}),
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

      setDashboard((current) => {
        const currentAgents = Array.isArray(current?.agents) ? current.agents : [];
        const nextAgents = savedAgent
          ? currentAgents.some((item) => item.id === savedAgent.id)
            ? currentAgents.map((item) => item.id === savedAgent.id ? savedAgent : item)
            : [...currentAgents, savedAgent]
          : currentAgents;
        return {
          ...(current || {}),
          agent:
            savedAgent?.primary === true || !current?.agent
              ? savedAgent || current?.agent || null
              : current?.agent,
          agents: nextAgents,
        };
      });

      if (savedAgent) {
        setForm((current) =>
          normalizeAgentForm({
            ...current,
            ...savedAgent,
          })
        );
      }

      if (announce) {
        const voiceResolution =
          response?.voiceResolution;

        setSuccess(
          voiceResolution?.changed
            ? `The voice agent was saved with ${voiceResolution.selectedLabel || "the selected voice"}.`
            : "The ReachFly voice agent was saved and synchronized."
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
      const savedAgent = await persistVoiceAgent({ announce: true });

      if (savedAgent) {
        setSuccess(
          "The ReachFly voice agent was saved and synchronized. Next, add or select leads for the calling queue."
        );
        selectVoiceTab("leads");
      }
    } catch {
      // persistVoiceAgent already surfaced the save error.
    }
  }

  async function ensureVoiceAgentReady(agentId = executionAgentId) {
    const purchasedNumberRequired =
      diagnostics?.purchasedNumberRequired !== false;
    const paidCreditsRequired =
      diagnostics?.paidCreditsRequired !== false;

    const activePurchasedNumber = voiceCommerce?.activeNumber;
    if (
      purchasedNumberRequired &&
      (!activePurchasedNumber ||
        normalizeStatus(activePurchasedNumber.status) !== "active")
    ) {
      throw new Error(
        "Buy and activate a ReachFly business number before configuring or launching the Voice Agent."
      );
    }

    const aiCallBalance = Number(
      billingData?.aiCalling?.wallet?.balance || 0
    );
    if (paidCreditsRequired && aiCallBalance <= 0) {
      throw new Error(
        "Buy AI call credits before configuring or launching paid Voice Agent calls. General ReachFly credits cannot fund AI calls."
      );
    }

    const targetAgent =
      workspaceAgents.find((item) => item.id === agentId) || agent || null;
    if (targetAgent?.elevenLabsAgentId && targetAgent?.elevenLabsPhoneNumberId) {
      return targetAgent;
    }

    if (workspaceAgents.length > 1 || (targetAgent && targetAgent.id !== agent?.id)) {
      throw new Error(
        "Configure and activate the selected AI agent from AI Workforce before assigning or starting calls."
      );
    }

    if (!form.complianceConfirmed) {
      throw new Error(
        "Approve the calling and suppression policy in Agent setup before assigning or calling leads."
      );
    }

    const savedAgent = await persistVoiceAgent({ announce: false });

    if (!savedAgent?.elevenLabsAgentId || !savedAgent?.elevenLabsPhoneNumberId) {
      throw new Error(
        "ReachFly could not link the voice agent and business phone number. Open Agent setup, save the agent, and review the configuration message."
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
            agentId: executionAgent?.id || executionAgentId,
            campaignContext,
            preferredLanguage: campaignLanguage,
            contextVersion: Date.now(),
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
            fromNumber: executionAgent?.fromNumber || form.fromNumber,
            agentId: executionAgent?.id || executionAgentId,
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
      selectVoiceTab("calls");
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

  function closeOnboarding(nextTab = "setup", announcement = "") {
    const safeTab = TABS.some(([value]) => value === nextTab)
      ? nextTab
      : "setup";
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("onboarding");
    nextParams.set("tab", safeTab);
    nextParams.set(
      "view",
      DEFAULT_VOICE_VIEWS[safeTab] ||
        DEFAULT_VOICE_VIEWS.setup
    );
    setSearchParams(nextParams, { replace: true });
    setError("");

    if (announcement) {
      setSuccess(announcement);
    }
  }

  function finishOnboarding() {
    if (!onboardingState.ready) {
      const remaining = onboardingState.steps
        .filter((step) => step.required && !step.done)
        .map((step) => step.title);

      selectVoiceTab("setup");
      setSuccess("");
      setError(
        remaining.length
          ? `Finish the required setup items first: ${remaining.join(", ")}.`
          : "Finish the required Voice Agent setup before continuing."
      );
      return;
    }

    closeOnboarding(
      "leads",
      "Voice Agent setup is ready. Add or select a lead, then use a controlled test call before launching a larger campaign."
    );
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
      <>
        <VoiceWorkspaceV7Styles />
        <main className="rf-agent-page rf-agent-v7">
          <section className="rf-agent-loading">
            <span className="rf-agent-spinner" />
            <b>Loading ReachFly Voice Agent…</b>
            <small>
              Checking workspace access, configuration and lead queue.
            </small>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <VoiceWorkspaceV7Styles />

      <main
        className="rf-agent-page rf-agent-v7"
        data-voice-ui-version={VOICE_UI_VERSION}
      >
        <header className="rf-agent-header rf-agent-header-v7">
          <div className="rf-agent-identity-v7">
            <span
              className={`rf-agent-avatar-v7 ${
                diagnostics.configured ? "ready" : "pending"
              }`}
            >
              {String(agent?.name || form.name || "AI")
                .trim()
                .slice(0, 1)
                .toUpperCase()}
            </span>

            <div>
              <span className="rf-agent-kicker-v7">
                {onboardingMode ? "Voice Agent onboarding" : "AI Voice Agent"}
              </span>

              <div className="rf-agent-title-line-v7">
                <h1>
                  {onboardingMode
                    ? "Set up your AI phone agent"
                    : agent?.name || form.name || "Voice Agent"}
                </h1>

                <span
                  className={`rf-agent-live-pill ${
                    diagnostics.configured ? "ready" : "warning"
                  }`}
                >
                  <i />
                  {onboardingMode
                    ? onboardingState.ready
                      ? "Setup ready"
                      : "Setup in progress"
                    : diagnostics.configured
                      ? "Active"
                      : "Setup required"}
                </span>

                {!onboardingMode ? (
                  <span className="rf-agent-mode-pill-v7">
                    <Phone size={13} />
                    {formatCallingModeLabel(form.callingMode)}
                  </span>
                ) : null}
              </div>

              <p>
                {onboardingMode
                  ? diagnostics?.purchasedNumberRequired !== false ||
                    diagnostics?.paidCreditsRequired !== false
                    ? "Complete calling activation, configure the agent and business context, approve the calling policy, then save before adding leads."
                    : "Configure the agent and business context, approve the calling policy, then save before adding leads."
                  : voiceOverview.businessNumber
                    ? `${formatPhone(voiceOverview.businessNumber)} · ${dashboard?.workspace?.name || user?.companyName || "ReachFly workspace"}`
                    : "Inbound and outbound AI calling, lead qualification, call outcomes and booked meetings in one workspace."}
              </p>
            </div>
          </div>

          <div className="rf-agent-header-actions rf-agent-header-actions-v7">
            {!onboardingMode ? (
              <>
                <button
                  type="button"
                  className="rf-agent-action-v7 secondary"
                  onClick={() => selectVoiceView("setup", "agent")}
                >
                  <Settings size={15} />
                  Configure Agent
                </button>

                <button
                  type="button"
                  className="rf-agent-action-v7 primary"
                  onClick={() => selectVoiceView("leads", "quick-lead")}
                >
                  <Phone size={15} />
                  Test Call
                </button>
              </>
            ) : null}

            <button
              type="button"
              className="rf-agent-icon-action-v7"
              disabled={refreshing}
              title="Refresh Voice workspace"
              aria-label="Refresh Voice workspace"
              onClick={() =>
                void Promise.all([
                  loadDashboard({ silent: true }),
                  loadVoiceCommerce(),
                  loadBillingData(),
                ])
              }
            >
              <RefreshCw
                size={15}
                className={refreshing ? "spin" : ""}
              />
            </button>
          </div>
        </header>

        {error ? (
          <div className="rf-agent-alert error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>
              ×
            </button>
          </div>
        ) : null}

        {success ? (
          <div className="rf-agent-alert success" role="status">
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess("")}>
              ×
            </button>
          </div>
        ) : null}

        {!onboardingMode ? (
          <section className="rf-voice-overview-grid-v7">
            <div className="rf-voice-overview-main-v7">
              <section className="rf-agent-metrics rf-agent-metrics-v7">
                <VoiceOverviewMetric
                  icon={<Phone size={16} />}
                  label="Total Calls"
                  value={voiceOverview.totalCalls}
                  note="Loaded call history"
                />

                <VoiceOverviewMetric
                  icon={<Activity size={16} />}
                  label="Connected Rate"
                  value={
                    voiceOverview.connectedRate === null
                      ? "—"
                      : `${voiceOverview.connectedRate}%`
                  }
                  note={`${voiceOverview.connectedCalls} connected`}
                  tone="primary"
                />

                <VoiceOverviewMetric
                  icon={<Target size={16} />}
                  label="Ready Leads"
                  value={voiceOverview.readyLeads}
                  note="Callable prospects"
                  tone="violet"
                />

                <VoiceOverviewMetric
                  icon={<Calendar size={16} />}
                  label="Meetings Booked"
                  value={voiceOverview.meetingsBooked}
                  note="Recorded meetings"
                  tone="success"
                />

                <VoiceOverviewMetric
                  icon={<Clock3 size={16} />}
                  label="Avg Duration"
                  value={voiceOverview.averageDuration}
                  note="Calls with duration"
                  tone="neutral"
                />

                <VoiceOverviewMetric
                  icon={<Zap size={16} />}
                  label="AI Call Credits"
                  value={voiceOverview.callCredits}
                  note="Available balance"
                  tone="neutral"
                />
              </section>

              <section className="rf-voice-performance-v7">
                <div className="rf-voice-performance-head-v7">
                  <div>
                    <span className="rf-agent-kicker-v7">Live workspace</span>
                    <h2>Calling operations</h2>
                    <p>
                      Lead queue, active calls, recent outcomes and meetings update from the same Voice workspace.
                    </p>
                  </div>

                  <span className="rf-voice-performance-status-v7">
                    <i className={diagnostics.configured ? "ready" : "pending"} />
                    {diagnostics.configured ? "Ready for calls" : "Finish setup"}
                  </span>
                </div>

                <div className="rf-voice-performance-grid-v7">
                  <VoicePerformanceItem
                    label="Business Number"
                    value={
                      voiceOverview.businessNumber
                        ? formatPhone(voiceOverview.businessNumber)
                        : "Not connected"
                    }
                    icon={<Building2 size={15} />}
                  />

                  <VoicePerformanceItem
                    label="Agent"
                    value={agent?.name || form.name || "Not configured"}
                    icon={<Bot size={15} />}
                  />

                  <VoicePerformanceItem
                    label="Queued Leads"
                    value={voiceOverview.queuedLeads}
                    icon={<Users size={15} />}
                  />

                  <VoicePerformanceItem
                    label="Live Calls"
                    value={voiceOverview.liveCalls}
                    icon={<Activity size={15} />}
                  />
                </div>
              </section>
            </div>

            <VoiceHealthPanel
              overview={voiceOverview}
              diagnostics={diagnostics}
              form={form}
              onSetup={() => selectVoiceView("setup", "calling")}
            />
          </section>
        ) : null}

        {onboardingMode ? (
        <AgentSetup
          form={form}
          voices={voices}
          recommendedVoice={recommendedVoice}
          diagnostics={diagnostics}
          commerce={voiceCommerce}
          billing={billingData}
          saving={saving}
          analyzingWebsite={analyzingWebsite}
          onboarding
          requestedView={requestedView}
          onViewChange={(view) =>
            selectVoiceView("setup", view, { replace: true })
          }
          onChange={updateForm}
          onAnalyzeWebsite={() => void analyzeWebsite()}
          onError={setError}
          onSuccess={setSuccess}
          onRefresh={async () => {
            await Promise.all([
              loadVoiceCommerce(),
              loadBillingData(),
              loadDashboard({ silent: true }),
            ]);
          }}
          onSave={async () => {
            const saved = await persistVoiceAgent({ announce: true });
            if (saved) {
              const mode = String(form.callingMode || "outbound").toLowerCase();
              closeOnboarding(
                mode === "inbound" ? "calls" : "leads",
                mode === "inbound"
                  ? "Voice Agent activated. Call the connected business number to test inbound handling."
                  : "Voice Agent activated. Add one lead and place a controlled test call before launching a campaign."
              );
            }
            return saved;
          }}
        />
      ) : (
        <>
      <nav className="rf-agent-tabs rf-agent-tabs-v7" aria-label="Voice-agent sections">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={activeTab === value ? "active" : ""}
            onClick={() => selectVoiceTab(value)}
          >
            <VoiceTabIcon value={value} />
            <span>{label}</span>
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
          recommendedVoice={recommendedVoice}
          diagnostics={diagnostics}
          commerce={voiceCommerce}
          billing={billingData}
          saving={saving}
          analyzingWebsite={analyzingWebsite}
          requestedView={requestedView}
          onViewChange={(view) =>
            selectVoiceView("setup", view, { replace: true })
          }
          onChange={updateForm}
          onAnalyzeWebsite={() => void analyzeWebsite()}
          onError={setError}
          onSuccess={setSuccess}
          onRefresh={async () => {
            await Promise.all([
              loadVoiceCommerce(),
              loadBillingData(),
              loadDashboard({ silent: true }),
            ]);
          }}
          onSave={() => saveAgent()}
        />
      ) : null}

      {activeTab === "leads" ? (
        <LeadQueue
          agent={executionAgent || agent}
          agents={workspaceAgents}
          executionAgentId={executionAgent?.id || executionAgentId}
          campaignContext={campaignContext}
          campaignLanguage={campaignLanguage}
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
          activeCustomPhoneCall={activeCustomPhoneCall}
          activeCalls={activeCalls}
          busyCallId={busyCallId}
          creatingCustomLead={creatingCustomLead}
          callingCustomLead={callingCustomLead}
          canTestCall={["owner", "admin"].includes(
            String(dashboard?.access?.role || "").toLowerCase()
          )}
          assigning={assigning}
          starting={starting}
          requestedView={requestedView}
          onViewChange={(view) =>
            selectVoiceView("leads", view, { replace: true })
          }
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
          onTestCustomLead={startControlledTestCall}
          onEndCall={(id) => void cancelCall(id)}
          onOpenCalls={() => selectVoiceView("calls", "active-calls")}
          onSearch={setLeadSearch}
          onLeadStatus={setLeadStatus}
          onQueueStatus={setQueueStatus}
          onCampaignLimit={setCampaignLimit}
          onExecutionAgentId={setExecutionAgentId}
          onCampaignContext={setCampaignContext}
          onCampaignLanguage={setCampaignLanguage}
          onToggleLead={toggleLead}
          onToggleAll={toggleAllVisible}
          onAssign={() => void assignSelectedLeads()}
          onStart={() => void startCampaign()}
        />
      ) : null}

      {activeTab === "calls" ? (
        <CallsPanel
          calls={calls}
          view={requestedView}
          busyCallId={busyCallId}
          onCancel={(id) => void cancelCall(id)}
          onRefresh={() => loadDashboard({ silent: true })}
        />
      ) : null}

      {activeTab === "meetings" ? (
        <MeetingsPanel
          meetings={meetings}
          view={requestedView}
        />
      ) : null}
        </>
      )}
      </main>
    </>
  );
}

function VoiceOverviewMetric({
  icon,
  label,
  value,
  note,
  tone = "primary",
}) {
  return (
    <article className={`rf-voice-overview-metric-v7 ${tone}`}>
      <div className="rf-voice-overview-metric-top-v7">
        <span>{icon}</span>
        <small>{label}</small>
      </div>
      <strong>{value}</strong>
      <em>{note}</em>
    </article>
  );
}

function VoicePerformanceItem({ label, value, icon }) {
  return (
    <div className="rf-voice-performance-item-v7">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function VoiceHealthPanel({
  overview,
  diagnostics,
  form,
  onSetup,
}) {
  const healthItems = [
    {
      key: "number",
      label: "Business Number",
      text: overview.businessNumber
        ? formatPhone(overview.businessNumber)
        : "Connect a number",
      ready: overview.numberReady,
      icon: Building2,
    },
    {
      key: "agent",
      label: "Voice Agent",
      text: diagnostics.configured
        ? "Runtime connected"
        : "Finish agent activation",
      ready: Boolean(diagnostics.configured),
      icon: Bot,
    },
    {
      key: "policy",
      label: "Calling Policy",
      text: form.complianceConfirmed
        ? "Approved"
        : "Approval required",
      ready: Boolean(form.complianceConfirmed),
      icon: CheckCircle2,
    },
    {
      key: "credits",
      label: "AI Call Credits",
      text: overview.creditsReady
        ? `${overview.callCredits} available`
        : "Add call credits",
      ready: overview.creditsReady,
      icon: Zap,
    },
  ];

  const readyCount = healthItems.filter((item) => item.ready).length;
  const healthy = readyCount === healthItems.length;

  return (
    <aside className="rf-voice-health-v7">
      <div className="rf-voice-health-head-v7">
        <div>
          <span className="rf-agent-kicker-v7">Agent health</span>
          <h2>Calling readiness</h2>
        </div>
        <span className={healthy ? "excellent" : "attention"}>
          {healthy ? "Ready" : `${readyCount}/${healthItems.length} ready`}
        </span>
      </div>

      <div className="rf-voice-health-list-v7">
        {healthItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key}>
              <span className="rf-voice-health-icon-v7">
                <Icon size={14} />
              </span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.text}</small>
              </div>
              <span
                className={`rf-voice-health-check-v7 ${
                  item.ready ? "ready" : "pending"
                }`}
              >
                {item.ready ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rf-voice-health-balance-v7">
        <div>
          <small>AI call credits</small>
          <strong>{overview.callCredits}</strong>
        </div>
        <button type="button" onClick={onSetup}>
          {healthy ? "Configure" : "Finish setup"}
        </button>
      </div>
    </aside>
  );
}

function VoiceTabIcon({ value }) {
  if (value === "leads") return <Users size={14} />;
  if (value === "calls") return <Phone size={14} />;
  if (value === "meetings") return <Calendar size={14} />;
  return <Settings size={14} />;
}

function VoiceCommerceOnboarding({
  commerce,
  billing,
  diagnostics,
  onRefresh,
  onError,
  onSuccess,
}) {
  const [searchForm, setSearchForm] = useState({
    countryCode: "US",
    areaCode: "",
    locality: "",
    phoneNumberType: "local",
  });
  const [quote, setQuote] = useState(null);
  const [searching, setSearching] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState("");
  const [buyingCredits, setBuyingCredits] = useState("");
  const [retryingOrder, setRetryingOrder] = useState("");

  const numberRequired = diagnostics?.purchasedNumberRequired !== false;
  const creditsRequired = diagnostics?.paidCreditsRequired !== false;
  const activeNumber = commerce?.activeNumber || null;
  const numberReady =
    !numberRequired || normalizeStatus(activeNumber?.status) === "active";
  const callWallet = billing?.aiCalling?.wallet || {};
  const callBalance = Number(callWallet.balance || 0);
  const creditsReady = !creditsRequired || callBalance > 0;

  const callPacks = (Array.isArray(billing?.aiCalling?.packs)
    ? billing.aiCalling.packs
    : []
  )
    .filter(
      (pack) =>
        pack?.active === true &&
        Number(pack?.credits || 0) > 0 &&
        Number(pack?.amountMinor || 0) > 0
    )
    .sort(
      (left, right) =>
        Number(left?.credits || 0) - Number(right?.credits || 0)
    );

  const failedOrder = (Array.isArray(commerce?.orders)
    ? commerce.orders
    : []
  ).find((order) =>
    [
      "provision_failed",
      "failure",
      "pending_activation",
      "paid",
    ].includes(normalizeStatus(order?.status))
  );

  const stage = !numberReady ? "number" : !creditsReady ? "credits" : "done";

  function useOwnedNumber(number) {
    if (!number?.phoneNumber || normalizeStatus(number.status) !== "active") {
      onError?.("Only an active owned business number can be selected.");
      return;
    }

    onChange("fromNumber", number.phoneNumber);

    if (number.callingMode) {
      onChange("callingMode", number.callingMode);
    }

    onError?.("");
    onSuccess?.(
      `${formatPhone(number.phoneNumber)} selected as this workspace's business number.`
    );
  }

  async function searchNumbers() {
    if (!commerce?.canPurchase) {
      onError?.("Only a workspace owner or administrator can buy a business number.");
      return;
    }

    setSearching(true);
    setQuote(null);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        "/voice-commerce/numbers/search",
        {
          method: "POST",
          body: {
            countryCode: searchForm.countryCode,
            areaCode: searchForm.areaCode,
            locality: searchForm.locality,
            phoneNumberType: "local",
            limit: 8,
          },
          timeoutMs: 30_000,
        }
      );

      setQuote(response);
      if (!response?.items?.length) {
        onSuccess?.(
          "No matching local numbers were returned. Try only the country, another area code, or a nearby city."
        );
      }
    } catch (requestError) {
      setQuote(null);
      onError?.(
        requestError?.message ||
          "Available business numbers could not be loaded."
      );
    } finally {
      setSearching(false);
    }
  }

  async function buyNumber(item) {
    if (!quote?.quoteId || !item?.phoneNumber || buyingNumber) return;

    setBuyingNumber(item.phoneNumber);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        "/voice-commerce/numbers/checkout",
        {
          method: "POST",
          body: {
            quoteId: quote.quoteId,
            phoneNumber: item.phoneNumber,
          },
          timeoutMs: 30_000,
        }
      );

      if (!response?.checkoutUrl || !/^https?:\/\//i.test(response.checkoutUrl)) {
        throw new Error("Secure business-number checkout could not be opened.");
      }

      window.location.assign(response.checkoutUrl);
    } catch (requestError) {
      setBuyingNumber("");
      onError?.(
        requestError?.message ||
          "Business-number checkout could not be started."
      );
    }
  }

  async function buyCallCredits(pack) {
    if (!pack?.id || buyingCredits) return;

    setBuyingCredits(pack.id);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        "/billing/ai-calling/checkout",
        {
          method: "POST",
          body: {
            packId: pack.id,
            returnPath: "/app/voice-agent?onboarding=1",
          },
          timeoutMs: 30_000,
        }
      );

      if (!response?.checkoutUrl || !/^https?:\/\//i.test(response.checkoutUrl)) {
        throw new Error("Secure AI call-credit checkout could not be opened.");
      }

      window.location.assign(response.checkoutUrl);
    } catch (requestError) {
      setBuyingCredits("");
      onError?.(
        requestError?.message ||
          "AI call-credit checkout could not be started."
      );
    }
  }

  async function retryProvision(orderId) {
    if (!orderId || retryingOrder) return;

    setRetryingOrder(orderId);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        `/voice-commerce/orders/${encodeURIComponent(orderId)}/retry`,
        {
          method: "POST",
          timeoutMs: 60_000,
        }
      );

      await onRefresh?.();
      const order = response?.order || response;

      if (normalizeStatus(order?.status) === "active") {
        onSuccess?.(
          `${formatPhone(order.phoneNumber)} is active. Continue to AI call credits.`
        );
      } else {
        onSuccess?.(
          "Provisioning retry accepted. ReachFly will keep checking the number status."
        );
      }
    } catch (requestError) {
      onError?.(
        requestError?.message ||
          "Business-number provisioning could not be retried."
      );
    } finally {
      setRetryingOrder("");
    }
  }

  return (
    <section className="rf-voice-wizard">
      <div className="rf-voice-wizard-top">
        <div>
          <span className="rf-voice-wizard-kicker">Voice Agent setup</span>
          <h2>
            {stage === "number"
              ? "Choose your business number"
              : stage === "credits"
                ? "Fund AI calling"
                : "Calling activation complete"}
          </h2>
          <p>
            {stage === "number"
              ? "Pick a local number for outbound calls. You only need a location preference."
              : stage === "credits"
                ? "Choose how many connected AI calls you want to prepay. General CRM credits stay separate."
                : "Your business number and AI calling wallet are ready."}
          </p>
        </div>
        <span className="rf-voice-wizard-step-count">
          {stage === "number" ? "1 / 5" : stage === "credits" ? "2 / 5" : "2 / 5"}
        </span>
      </div>

      <WizardProgress
        current={stage === "number" ? 0 : 1}
        items={[
          { label: "Number", done: numberReady },
          { label: "Calls", done: creditsReady },
          { label: "Agent", done: false },
          { label: "Business", done: false },
          { label: "Activate", done: false },
        ]}
      />

      {stage === "number" ? (
        <div className="rf-voice-wizard-body">
          <div className="rf-voice-starter-balance">
            <div>
              <span>Included with your workspace</span>
              <strong>{formatCreditsCompact(callBalance)} free AI call credits</strong>
              <small>1 credit is used only after a completed connected AI conversation.</small>
            </div>
            <b>{commerce?.testMode?.enabled ? "SANDBOX" : "READY"}</b>
          </div>

          <div className="rf-voice-wizard-note">
            <b>What we need</b>
            <span>
              Country plus an optional area code or city. ReachFly handles provider
              capabilities, SIP setup and provisioning in the background.
            </span>
          </div>

          <div className="rf-voice-essential-grid">
            <Field
              label="Country"
              value={searchForm.countryCode}
              onChange={(value) =>
                setSearchForm((current) => ({
                  ...current,
                  countryCode: String(value || "").toUpperCase().slice(0, 2),
                }))
              }
              placeholder="US"
            />
            <Field
              label="Area code (optional)"
              value={searchForm.areaCode}
              onChange={(value) =>
                setSearchForm((current) => ({
                  ...current,
                  areaCode: String(value || "").replace(/\D/g, "").slice(0, 8),
                }))
              }
              placeholder="213"
            />
            <Field
              label="City (optional)"
              value={searchForm.locality}
              onChange={(value) =>
                setSearchForm((current) => ({
                  ...current,
                  locality: value,
                }))
              }
              placeholder="Los Angeles"
            />
          </div>

          <div className="rf-voice-wizard-actions">
            <button
              type="button"
              className="btn primary rf-voice-primary-action"
              disabled={searching || !commerce?.canPurchase}
              onClick={() => void searchNumbers()}
            >
              {searching
                ? commerce?.testMode?.enabled
                  ? "Loading sandbox numbers…"
                  : "Searching number inventory…"
                : commerce?.testMode?.enabled
                  ? "Show test business numbers"
                  : "Find available numbers"}
            </button>
          </div>

          {!commerce?.canPurchase ? (
            <div className="rf-voice-inline-warning">
              Only the workspace owner or an administrator can purchase a number.
            </div>
          ) : null}

          {quote?.items?.length ? (
            <div className="rf-voice-number-grid">
              {quote.items.map((item) => (
                <article className="rf-voice-number-card" key={item.phoneNumber}>
                  <div className="rf-voice-number-card-main">
                    <span className="rf-voice-number-badge">
                      {item.testMode ? "Sandbox number" : "Local voice"}
                    </span>
                    <h3>{formatPhone(item.phoneNumber)}</h3>
                    <p>
                      {(item.regionInformation || [])
                        .map((region) => region.name)
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(" · ") || "Voice-capable business number"}
                    </p>
                  </div>

                  <div className="rf-voice-number-price">
                    <small>Initial activation</small>
                    <b>
                      {formatMoneyMinorVoice(
                        item.initialChargeMinor,
                        item.currency
                      )}
                    </b>
                    <span>
                      {item.testMode
                        ? "Sandbox activation only · no live number is purchased"
                        : "Includes the first service month when available"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn primary"
                    disabled={Boolean(buyingNumber)}
                    onClick={() => void buyNumber(item)}
                  >
                    {buyingNumber === item.phoneNumber
                      ? "Opening secure checkout…"
                      : "Choose this number"}
                  </button>
                </article>
              ))}
            </div>
          ) : null}

          {failedOrder ? (
            <div className="rf-voice-inline-warning">
              <span>
                {failedOrder.error ||
                  `Number order ${formatLabel(failedOrder.status)}.`}
              </span>
              {["provision_failed", "paid", "pending_activation"].includes(
                normalizeStatus(failedOrder.status)
              ) ? (
                <button
                  type="button"
                  className="btn light"
                  disabled={retryingOrder === failedOrder.id}
                  onClick={() => void retryProvision(failedOrder.id)}
                >
                  {retryingOrder === failedOrder.id
                    ? "Retrying…"
                    : "Retry provisioning"}
                </button>
              ) : null}
            </div>
          ) : null}

          <small className="rf-voice-legal-note">
            This checkout is for initial number activation. Automatic recurring
            customer renewal billing is not enabled in this build.
          </small>
        </div>
      ) : null}

      {stage === "credits" ? (
        <div className="rf-voice-wizard-body">
          <div className="rf-voice-active-number">
            <span>Business number active</span>
            <b>{formatPhone(activeNumber?.phoneNumber)}</b>
          </div>

          <div className="rf-voice-wizard-note">
            <b>Connected-call billing</b>
            <span>
              One dedicated AI call credit is charged only for a connected
              conversation according to the server billing policy.
            </span>
          </div>

          {!billing?.aiCalling?.canPurchase ? (
            <div className="rf-voice-inline-warning">
              Only the workspace owner or an administrator can buy AI call credits.
            </div>
          ) : !billing?.safepay?.configured ? (
            <div className="rf-voice-inline-warning">
              Secure payment checkout is not configured.
            </div>
          ) : !callPacks.length ? (
            <div className="rf-voice-inline-warning">
              No AI call-credit packs are currently active.
            </div>
          ) : (
            <div className="rf-voice-credit-grid">
              {callPacks.map((pack, index) => (
                <article
                  className={`rf-voice-credit-card ${index === 0 ? "recommended" : ""}`}
                  key={pack.id}
                >
                  {index === 0 ? (
                    <span className="rf-voice-number-badge">Best for testing</span>
                  ) : null}
                  <h3>{formatCreditsCompact(pack.credits)} calls</h3>
                  <b>{formatMoneyMinorVoice(pack.amountMinor, pack.currency)}</b>
                  <small>Dedicated AI calling wallet</small>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={Boolean(buyingCredits)}
                    onClick={() => void buyCallCredits(pack)}
                  >
                    {buyingCredits === pack.id
                      ? "Opening secure checkout…"
                      : "Buy call credits"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {stage === "done" ? (
        <div className="rf-voice-wizard-body">
          <div className="rf-voice-success-panel">
            <span>✓</span>
            <div>
              <b>Calling activation is ready</b>
              <p>Continue to the agent basics. Provider configuration stays hidden.</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}


function VoiceAgentGuidedWizard({
  form,
  voices,
  recommendedVoice,
  commerce,
  billing,
  saving,
  analyzingWebsite,
  onChange,
  onAnalyzeWebsite,
  onActivate,
  onError,
}) {
  const [step, setStep] = useState(0);

  const steps = [
    { label: "Number", done: true },
    { label: "Calls", done: true },
    { label: "Agent", done: step > 0 },
    { label: "Business", done: step > 1 },
    { label: "Activate", done: false },
  ];

  const selectedVoice =
    voices.find((voice) => voice.id === form.voice) ||
    recommendedVoice ||
    null;

  const canContinueAgent =
    Boolean(String(form.name || "").trim()) &&
    Boolean(String(form.voice || "").trim());

  function nextFromAgent() {
    if (!canContinueAgent) {
      onError?.("Choose an agent name and voice to continue.");
      return;
    }
    onError?.("");
    setStep(1);
  }

  function nextFromBusiness() {
    onError?.("");
    setStep(2);
  }

  async function activate() {
    if (!form.complianceConfirmed) {
      onError?.("Approve the calling and suppression policy before activation.");
      return;
    }

    onError?.("");
    await onActivate?.();
  }

  return (
    <section className="rf-voice-wizard">
      <div className="rf-voice-wizard-top">
        <div>
          <span className="rf-voice-wizard-kicker">Voice Agent setup</span>
          <h2>
            {step === 0
              ? "Choose how your agent sounds"
              : step === 1
                ? "Add your business context"
                : "Review and activate"}
          </h2>
          <p>
            {step === 0
              ? "ReachFly already knows your workspace. Only choose the customer-facing name and voice."
              : step === 1
                ? "Website and meeting details are optional. Add them only if you want the agent to use them."
                : "Approve the calling policy and ReachFly will create and link the managed runtime."}
          </p>
        </div>
        <span className="rf-voice-wizard-step-count">{step + 3} / 5</span>
      </div>

      <WizardProgress current={step + 2} items={steps} />

      {step === 0 ? (
        <div className="rf-voice-wizard-body">
          <div className="rf-voice-summary-strip">
            <div>
              <small>Business number</small>
              <b>{formatPhone(commerce?.activeNumber?.phoneNumber)}</b>
            </div>
            <div>
              <small>AI call credits</small>
              <b>{formatCreditsCompact(billing?.aiCalling?.wallet?.balance || 0)}</b>
            </div>
            <div>
              <small>Company</small>
              <b>{form.companyName || "Workspace company"}</b>
            </div>
          </div>

          <div className="rf-voice-wizard-note">
            <b>Provider setup is automatic</b>
            <span>
              Customers never choose ElevenLabs agent IDs, SIP trunks, provider
              profiles, or phone-number IDs. ReachFly manages those per workspace.
            </span>
          </div>

          <div className="rf-voice-essential-grid two">
            <Field
              label="Agent name"
              value={form.name}
              onChange={(value) => onChange("name", value)}
              placeholder="James"
            />

            <label className="rf-agent-field">
              <span>Voice</span>
              <select
                value={form.voice}
                onChange={(event) => onChange("voice", event.target.value)}
              >
                {!voices.length ? (
                  <option value={form.voice}>
                    {selectedVoice?.name || "Managed voice"}
                  </option>
                ) : null}
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name || voice.accent || voice.language || "Voice"}
                  </option>
                ))}
              </select>
              <small>
                {selectedVoice?.name
                  ? `${selectedVoice.name} is selected.`
                  : "Choose the voice prospects will hear."}
              </small>
            </label>
          </div>

          <div className="rf-voice-wizard-actions end">
            <button
              type="button"
              className="btn primary rf-voice-primary-action"
              onClick={nextFromAgent}
            >
              Continue
            </button>
          </div>

          <small className="rf-voice-legal-note">
            Greeting, personality, turn-taking, call limits and other advanced
            settings use ReachFly defaults and can be changed later.
          </small>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="rf-voice-wizard-body">
          <div className="rf-voice-wizard-note">
            <b>Optional business intelligence</b>
            <span>
              Add a website if you want ReachFly to learn services, customers,
              proof points and objections before calls. Leave it blank to continue
              with the safe default agent.
            </span>
          </div>

          <div className="rf-voice-essential-grid two">
            <Field
              label="Company website (optional)"
              value={form.websiteUrl}
              onChange={(value) => onChange("websiteUrl", value)}
              placeholder="https://yourcompany.com"
            />
            <Field
              label="Meeting owner email (optional)"
              value={form.calendarOwnerEmail}
              onChange={(value) => onChange("calendarOwnerEmail", value)}
              placeholder="sales@yourcompany.com"
            />
          </div>

          {String(form.websiteUrl || "").trim() ? (
            <div className="rf-voice-wizard-actions">
              <button
                type="button"
                className="btn light"
                disabled={analyzingWebsite}
                onClick={onAnalyzeWebsite}
              >
                {analyzingWebsite
                  ? "Analyzing website…"
                  : form.websiteIntelligence?.analyzedAt
                    ? "Website analyzed ✓"
                    : "Analyze website now"}
              </button>
            </div>
          ) : null}

          <div className="rf-voice-wizard-actions split">
            <button
              type="button"
              className="btn light"
              onClick={() => setStep(0)}
            >
              Back
            </button>
            <button
              type="button"
              className="btn primary rf-voice-primary-action"
              disabled={analyzingWebsite}
              onClick={nextFromBusiness}
            >
              {form.websiteUrl ? "Continue" : "Skip and continue"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="rf-voice-wizard-body">
          <div className="rf-voice-review-card">
            <div>
              <small>Agent</small>
              <b>{form.name}</b>
            </div>
            <div>
              <small>Company</small>
              <b>{form.companyName}</b>
            </div>
            <div>
              <small>Number</small>
              <b>{formatPhone(commerce?.activeNumber?.phoneNumber)}</b>
            </div>
            <div>
              <small>Calling wallet</small>
              <b>{formatCreditsCompact(billing?.aiCalling?.wallet?.balance || 0)} credits</b>
            </div>
          </div>

          <label className="rf-voice-policy-check">
            <input
              type="checkbox"
              checked={Boolean(form.complianceConfirmed)}
              onChange={(event) =>
                onChange("complianceConfirmed", event.target.checked)
              }
            />
            <span>
              <b>Approve calling & suppression policy</b>
              <small>
                I confirm that this workspace will call permitted leads, respect
                DNC/suppression requests, use approved calling windows and follow
                applicable disclosure/recording requirements.
              </small>
            </span>
          </label>

          <label className="rf-voice-policy-check secondary">
            <input
              type="checkbox"
              checked={Boolean(form.recordingEnabled)}
              onChange={(event) =>
                onChange("recordingEnabled", event.target.checked)
              }
            />
            <span>
              <b>Enable call recording</b>
              <small>
                Optional. Enable only when your consent and disclosure policy allows it.
              </small>
            </span>
          </label>

          <div className="rf-voice-wizard-actions split">
            <button
              type="button"
              className="btn light"
              disabled={saving}
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="btn primary rf-voice-primary-action"
              disabled={!form.complianceConfirmed || saving || analyzingWebsite}
              onClick={() => void activate()}
            >
              {saving ? "Creating your Voice Agent…" : "Activate Voice Agent"}
            </button>
          </div>

          <small className="rf-voice-legal-note">
            ReachFly creates and links the workspace-managed provider agent in the
            background. Provider credentials and IDs are never requested from the customer.
          </small>
        </div>
      ) : null}
    </section>
  );
}

function WizardProgress({ current = 0, items = [] }) {
  return (
    <div className="rf-voice-progress" aria-label="Voice Agent setup progress">
      {items.map((item, index) => (
        <div
          className={`rf-voice-progress-item ${
            item.done ? "done" : index === current ? "current" : ""
          }`}
          key={item.label}
        >
          <span>{item.done ? "✓" : index + 1}</span>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}


function VoiceAgentOnboardingGuide({
  state,
  form,
  diagnostics,
  commerce,
  billing,
  saving,
  analyzingWebsite,
  onFinish,
  onExit,
}) {
  const progress = state.total
    ? Math.round((state.completed / state.total) * 100)
    : 0;

  return (
    <section className="rf-agent-card rf-agent-form-card">
      <div className="rf-agent-card-heading">
        <div>
          <span>First-run setup</span>
          <h2>Get the Voice Agent ready before you dial a lead</h2>
        </div>

        <span className="rf-agent-section-number">
          {state.completed}/{state.total}
        </span>
      </div>

      <p className="rf-agent-google-copy">
        Complete the required items below, then save and synchronize the agent.
        Website intelligence is recommended and becomes required automatically
        when you enter a website URL.
      </p>

      <progress
        value={progress}
        max="100"
        aria-label={`${progress}% setup complete`}
        style={{ width: "100%" }}
      />

      <section className="rf-agent-metrics">
        {state.steps.map((step) => (
          <Metric
            key={step.key}
            label={step.title}
            value={step.done ? "Ready" : step.required ? "Required" : "Optional"}
            text={step.text}
          />
        ))}
      </section>

      <section className="rf-agent-provider-card">
        <div>
          <span className="rf-agent-provider-logo">RF</span>
          <div>
            <b>Activation readiness</b>
            <small>
              {state.ready
                ? "Required setup is complete"
                : "Finish the required setup items below"}
            </small>
          </div>
        </div>

        <dl>
          <div>
            <dt>Agent identity</dt>
            <dd>{form.name || "Not configured"}</dd>
          </div>

          <div>
            <dt>Business context</dt>
            <dd>
              {form.websiteIntelligence?.analyzedAt
                ? "Website profile ready"
                : form.websiteUrl
                  ? "Website analysis required"
                  : "Website context recommended"}
            </dd>
          </div>

          <div>
            <dt>Business number</dt>
            <dd>
              {commerce?.activeNumber?.phoneNumber ||
                diagnostics.selectedFromNumber ||
                "Purchase required"}
            </dd>
          </div>

          <div>
            <dt>AI call credits</dt>
            <dd>
              {Number(billing?.aiCalling?.wallet?.balance || 0) > 0
                ? `${formatCreditsCompact(billing.aiCalling.wallet.balance)} available`
                : "Purchase required"}
            </dd>
          </div>

          <div>
            <dt>Calling policy</dt>
            <dd>{form.complianceConfirmed ? "Approved" : "Approval required"}</dd>
          </div>
        </dl>
      </section>

      <div className="rf-agent-website-actions">
        <button
          type="button"
          className="btn light"
          disabled={saving || analyzingWebsite}
          onClick={onExit}
        >
          Open full workspace
        </button>

        <button
          type="button"
          className="btn primary"
          disabled={!state.ready || saving || analyzingWebsite}
          onClick={onFinish}
        >
          {state.ready ? "Finish setup and add leads" : "Complete required setup first"}
        </button>
      </div>

      {!state.ready ? (
        <small className="rf-agent-field-note">
          The finish button does not bypass activation requirements. Saving the
          agent, verified calling identity, disclosure/suppression approval, and
          runtime linkage remain authoritative.
        </small>
      ) : null}
    </section>
  );
}

function AgentSetup({
  form,
  voices,
  recommendedVoice,
  diagnostics,
  commerce,
  billing,
  saving,
  analyzingWebsite,
  onboarding = false,
  requestedView = "calling",
  onViewChange,
  onChange,
  onAnalyzeWebsite,
  onSave,
  onError,
  onSuccess,
  onRefresh,
}) {
  const initialSetupView =
    SETUP_VIEW_CONFIG[requestedView] ||
    SETUP_VIEW_CONFIG.calling;
  const [step, setStep] = useState(initialSetupView.step);
  const [buyingCredits, setBuyingCredits] = useState("");
  const [numberPath, setNumberPath] = useState(
    initialSetupView.numberPath || "owned"
  );
  const [searchForm, setSearchForm] = useState({
    countryCode: "US",
    areaCode: "",
    locality: "",
  });
  const [quote, setQuote] = useState(null);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState("");
  const [existingNumberForm, setExistingNumberForm] = useState({
    phoneNumber: "",
    method: "sip_byoc",
  });
  const [existingPending, setExistingPending] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [connectingExisting, setConnectingExisting] = useState(false);
  const [verifyingExisting, setVerifyingExisting] = useState(false);
  const [unlinkingNumberId, setUnlinkingNumberId] = useState("");

  const normalizedMode = ["inbound", "outbound", "both"].includes(
    String(form.callingMode || "").toLowerCase()
  )
    ? String(form.callingMode).toLowerCase()
    : "outbound";
  const inboundEnabled =
    normalizedMode === "inbound" || normalizedMode === "both";
  const outboundEnabled =
    normalizedMode === "outbound" || normalizedMode === "both";

  const numberOptions = Array.isArray(diagnostics?.fromNumbers)
    ? diagnostics.fromNumbers
    : [];
  const ownedNumbers = Array.isArray(commerce?.numbers)
    ? commerce.numbers
    : [];
  const activeNumber = commerce?.activeNumber || null;
  const selectedNumber =
    form.fromNumber ||
    activeNumber?.phoneNumber ||
    diagnostics?.selectedFromNumber ||
    numberOptions[0] ||
    "";
  const selectedOwnedNumber =
    ownedNumbers.find(
      (item) =>
        normalizeStatus(item?.status) === "active" &&
        normalizePhoneForUi(item?.phoneNumber) ===
          normalizePhoneForUi(selectedNumber)
    ) ||
    (activeNumber &&
    normalizeStatus(activeNumber?.status) === "active"
      ? activeNumber
      : null);

  const purchasedNumberRequired =
    diagnostics?.purchasedNumberRequired !== false;
  const numberReady =
    !purchasedNumberRequired
      ? Boolean(selectedNumber)
      : Boolean(selectedOwnedNumber?.phoneNumber);

  const callWallet = billing?.aiCalling?.wallet || {};
  const callBalance = Number(callWallet.balance || 0);
  const paidCreditsRequired =
    diagnostics?.paidCreditsRequired !== false;
  const signupFreeCredits = Number(
    billing?.aiCalling?.signupFreeCredits ||
      billing?.aiCalling?.policy?.signupFreeCredits ||
      10
  );

  const callPacks = (Array.isArray(billing?.aiCalling?.packs)
    ? billing.aiCalling.packs
    : []
  )
    .filter(
      (pack) =>
        pack?.active === true &&
        Number(pack?.credits || 0) > 0 &&
        Number(pack?.amountMinor || 0) > 0
    )
    .sort(
      (left, right) =>
        Number(left?.credits || 0) - Number(right?.credits || 0)
    );

  const selectedVoice =
    voices.find((voice) => voice.id === form.voice) ||
    recommendedVoice ||
    null;

  const steps = [
    { key: "mode", label: "Calling", short: "Inbound / outbound" },
    { key: "number", label: "Number", short: "Manage numbers" },
    { key: "identity", label: "Agent", short: "Name & voice" },
    { key: "business", label: "Business", short: "Website context" },
    { key: "workflow", label: "Workflow", short: "Actions & handoff" },
    { key: "review", label: "Activate", short: "Review & save" },
  ];

  useEffect(() => {
    const requested =
      SETUP_VIEW_CONFIG[requestedView] ||
      SETUP_VIEW_CONFIG.calling;

    setStep(requested.step);
    setNumberPath(
      requested.numberPath || "owned"
    );
  }, [requestedView]);

  function moveTo(nextStep) {
    onError?.("");
    const resolved = Math.max(
      0,
      Math.min(steps.length - 1, nextStep)
    );
    setStep(resolved);
    onViewChange?.(
      SETUP_STEP_VIEWS[resolved] ||
        SETUP_STEP_VIEWS[0]
    );
  }

  function selectNumberPath(path) {
    const safePath = ["owned", "buy", "existing"].includes(path)
      ? path
      : "owned";

    setNumberPath(safePath);
    onError?.("");
    onViewChange?.(
      safePath === "buy"
        ? "buy-numbers"
        : safePath === "existing"
          ? "connect-number"
          : "my-numbers"
    );
  }

  function updateNested(key, nestedKey, value) {
    onChange(key, {
      ...(form[key] && typeof form[key] === "object"
        ? form[key]
        : {}),
      [nestedKey]: value,
    });
  }

  function next() {
    if (step === 0 && !normalizedMode) {
      onError?.("Choose inbound, outbound, or both to continue.");
      return;
    }

    if (step === 1 && !numberReady) {
      onError?.(
        "Buy and activate a ReachFly number or verify an existing business number before continuing."
      );
      return;
    }

    if (step === 2) {
      if (!String(form.name || "").trim()) {
        onError?.("Give your Voice Agent a name to continue.");
        return;
      }
      if (!String(form.voice || "").trim()) {
        onError?.("Choose a voice to continue.");
        return;
      }
    }

    if (step === 3 && String(form.websiteUrl || "").trim()) {
      const sourceUrl = String(
        form.websiteIntelligence?.sourceUrl || ""
      ).trim();
      if (
        !form.websiteIntelligence?.analyzedAt ||
        sourceUrl !== String(form.websiteUrl).trim()
      ) {
        onError?.(
          "Analyze the website before continuing, or clear the website field to skip business intelligence."
        );
        return;
      }
    }

    if (
      step === 4 &&
      inboundEnabled &&
      form.inboundActions?.transferHuman === true &&
      !String(form.humanTransferNumber || "").trim()
    ) {
      onError?.(
        "Add the human transfer number or turn off human transfer."
      );
      return;
    }

    moveTo(step + 1);
  }

  async function searchNumbers() {
    setSearchingNumbers(true);
    setQuote(null);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        "/voice-commerce/numbers/search",
        {
          method: "POST",
          body: {
            countryCode: searchForm.countryCode,
            areaCode: searchForm.areaCode,
            locality: searchForm.locality,
            phoneNumberType: "local",
            callingMode: normalizedMode,
            limit: 8,
          },
          timeoutMs: 30_000,
        }
      );
      setQuote(response);
      if (!response?.items?.length) {
        onSuccess?.(
          "No matching numbers were returned. Try another area code or city."
        );
      }
    } catch (requestError) {
      onError?.(
        requestError?.message ||
          "Available business numbers could not be loaded."
      );
    } finally {
      setSearchingNumbers(false);
    }
  }

  async function buyNumber(item) {
    if (!quote?.quoteId || !item?.phoneNumber || buyingNumber) return;
    setBuyingNumber(item.phoneNumber);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        "/voice-commerce/numbers/checkout",
        {
          method: "POST",
          body: {
            quoteId: quote.quoteId,
            phoneNumber: item.phoneNumber,
            callingMode: normalizedMode,
            returnPath: onboarding
              ? "/app/voice-agent?onboarding=1&tab=setup&view=buy-numbers"
              : "/app/voice-agent?tab=setup&view=buy-numbers",
          },
          timeoutMs: 30_000,
        }
      );

      if (
        !response?.checkoutUrl ||
        !/^https?:\/\//i.test(response.checkoutUrl)
      ) {
        throw new Error(
          "Secure business-number checkout could not be opened."
        );
      }

      window.location.assign(response.checkoutUrl);
    } catch (requestError) {
      setBuyingNumber("");
      onError?.(
        requestError?.message ||
          "Business-number checkout could not be started."
      );
    }
  }

  async function connectExistingNumber() {
    const phoneNumber = String(
      existingNumberForm.phoneNumber || ""
    ).trim();

    if (!phoneNumber) {
      onError?.("Enter the business number you own.");
      return;
    }

    setConnectingExisting(true);
    setExistingPending(null);
    setVerificationCode("");
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        "/voice-commerce/numbers/existing",
        {
          method: "POST",
          body: {
            phoneNumber,
            method: existingNumberForm.method,
            callingMode: normalizedMode,
          },
          timeoutMs: 30_000,
        }
      );
      setExistingPending(response);
      if (response?.testVerificationCode) {
        setVerificationCode(response.testVerificationCode);
        onSuccess?.(
          "Sandbox ownership verification is ready. Confirm the code below to activate the QA number."
        );
      } else {
        onSuccess?.(
          response?.verification ||
            "The existing-number connection is pending carrier verification."
        );
      }
    } catch (requestError) {
      onError?.(
        requestError?.message ||
          "The existing business number could not be added."
      );
    } finally {
      setConnectingExisting(false);
    }
  }

  async function verifyExistingNumber() {
    const numberId =
      existingPending?.number?.id ||
      existingPending?.id ||
      "";
    const sandboxVerification = Boolean(
      existingPending?.testVerificationCode
    );
    const requiresVerificationCode =
      sandboxVerification ||
      existingPending?.requiresVerificationCode === true ||
      normalizeStatus(existingPending?.number?.verificationProvider) ===
        "telnyx_verified_numbers";

    if (!numberId) {
      onError?.("Start existing-number verification first.");
      return;
    }
    if (requiresVerificationCode && !verificationCode) {
      onError?.("Enter the ownership verification code.");
      return;
    }

    setVerifyingExisting(true);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        `/voice-commerce/numbers/${encodeURIComponent(
          numberId
        )}/verify`,
        {
          method: "POST",
          body: requiresVerificationCode
            ? { code: verificationCode }
            : {},
          timeoutMs: 30_000,
        }
      );
      setExistingPending(response);
      await onRefresh?.();

      const status = normalizeStatus(
        response?.number?.status
      );
      if (response?.pending) {
        onSuccess?.(
          response?.verification ||
            "Ownership verification is still pending."
        );
      } else if (status === "routing_required") {
        onSuccess?.(
          "Ownership verified. Complete the inbound routing test below to activate calling."
        );
      } else if (status === "carrier_action_required") {
        onSuccess?.(
          response?.verification ||
            "Ownership verified. Complete the remaining carrier step to activate the number."
        );
      } else {
        onSuccess?.(
          `${formatPhone(
            response?.number?.phoneNumber ||
              existingNumberForm.phoneNumber
          )} is verified and active for this workspace.`
        );
      }
    } catch (requestError) {
      onError?.(
        requestError?.message ||
          "The business-number verification could not be completed."
      );
    } finally {
      setVerifyingExisting(false);
    }
  }

  async function unlinkExistingNumber(number) {
    const id = String(number?.id || "").trim();
    const phoneNumber = String(number?.phoneNumber || "").trim();
    if (!id || !phoneNumber || unlinkingNumberId) return;

    const confirmed = window.confirm(
      `Unlink ${formatPhone(phoneNumber)} from ReachFly?\n\n` +
        "This removes the connected existing number from this workspace, removes its Telnyx verified-number authorization, and removes its managed ElevenLabs phone-number route. It does not release a ReachFly-purchased carrier number."
    );
    if (!confirmed) return;

    setUnlinkingNumberId(id);
    onError?.("");
    onSuccess?.("");

    try {
      await apiRequest(
        `/voice-commerce/numbers/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          timeoutMs: 30_000,
        }
      );

      if (
        normalizePhoneForUi(form.fromNumber) ===
        normalizePhoneForUi(phoneNumber)
      ) {
        onChange("fromNumber", "");
      }

      const pendingId =
        existingPending?.number?.id || existingPending?.id || "";
      if (pendingId === id) {
        setExistingPending(null);
        setVerificationCode("");
      }

      await onRefresh?.();
      onSuccess?.(
        `${formatPhone(phoneNumber)} was unlinked from this workspace and disconnected from the managed Telnyx/ElevenLabs number route.`
      );
    } catch (requestError) {
      onError?.(
        requestError?.message ||
          "The existing business number could not be unlinked."
      );
    } finally {
      setUnlinkingNumberId("");
    }
  }

  async function testExistingNumberRouting() {
    const numberId =
      existingPending?.number?.id ||
      existingPending?.id ||
      "";
    if (!numberId) {
      onError?.("Verify the existing business number first.");
      return;
    }

    setVerifyingExisting(true);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        `/voice-commerce/numbers/${encodeURIComponent(
          numberId
        )}/routing-test`,
        {
          method: "POST",
          body: {},
          timeoutMs: 30_000,
        }
      );
      setExistingPending(response);
      await onRefresh?.();
      onSuccess?.(
        response?.message ||
          (response?.routingVerified
            ? "Existing-number routing is verified and active."
            : "Inbound routing has not reached ReachFly yet.")
      );
    } catch (requestError) {
      onError?.(
        requestError?.message ||
          "The inbound routing test could not be completed."
      );
    } finally {
      setVerifyingExisting(false);
    }
  }

  async function buyCallCredits(pack) {
    if (!pack?.id || buyingCredits) return;
    setBuyingCredits(pack.id);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        "/billing/ai-calling/checkout",
        {
          method: "POST",
          body: {
            packId: pack.id,
            returnPath: onboarding
              ? "/app/voice-agent?onboarding=1"
              : "/app/voice-agent",
          },
          timeoutMs: 30_000,
        }
      );

      if (
        !response?.checkoutUrl ||
        !/^https?:\/\//i.test(response.checkoutUrl)
      ) {
        throw new Error(
          "Secure AI call-credit checkout could not be opened."
        );
      }
      window.location.assign(response.checkoutUrl);
    } catch (requestError) {
      setBuyingCredits("");
      onError?.(
        requestError?.message ||
          "AI call-credit checkout could not be started."
      );
    }
  }

  async function save() {
    if (!numberReady) {
      onError?.(
        "Activate or verify a business number before activation."
      );
      moveTo(1);
      return;
    }

    if (!form.complianceConfirmed) {
      onError?.(
        "Approve the calling and suppression policy before activation."
      );
      return;
    }

    if (paidCreditsRequired && callBalance <= 0) {
      onError?.(
        "Add AI call credits before activating paid calling."
      );
      return;
    }

    try {
      await onSave?.();
      await onRefresh?.();
    } catch (requestError) {
      onError?.(
        requestError?.message ||
          "The Voice Agent could not be activated."
      );
    }
  }

  const objectiveOptions = [
    ["general", "General receptionist"],
    ["lead_qualification", "Qualify inbound leads"],
    ["appointment_booking", "Book appointments"],
    ["customer_support", "Customer support"],
    ["order_intake", "Take orders / requests"],
  ];

  return (
    <section className="rf-voice-setup-shell">
      <div className="rf-voice-setup-hero">
        <div>
          <span className="rf-voice-wizard-kicker">
            {onboarding
              ? "Voice Agent onboarding"
              : "Voice setup"}
          </span>
          <h2>
            Set up inbound and outbound calling in one guided flow.
          </h2>
          <p>
            ReachFly manages the calling infrastructure. Your workspace
            chooses the calling mode, business number, voice and business
            workflow without exposing technical routing details.
          </p>
        </div>

        <div
          className="rf-voice-credit-orb"
          aria-label={
            paidCreditsRequired
              ? `${callBalance} AI call credits available`
              : "AI call credits are not required for this workspace"
          }
        >
          <span>AI call credits</span>
          <strong>
            {paidCreditsRequired
              ? formatCreditsCompact(callBalance)
              : "Ready"}
          </strong>
          <small>
            {!paidCreditsRequired
              ? "not required for this workspace"
              : callBalance === signupFreeCredits &&
                  callBalance > 0
                ? `${signupFreeCredits} included with signup`
                : "available connected calls"}
          </small>
        </div>
      </div>

      <div className="rf-voice-setup-progress six">
        {steps.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={`${index === step ? "current" : ""} ${
              index < step ? "done" : ""
            }`}
            onClick={() =>
              index <= step && moveTo(index)
            }
          >
            <span>{index < step ? "✓" : index + 1}</span>
            <b>{item.label}</b>
            <small>{item.short}</small>
          </button>
        ))}
      </div>

      <div className="rf-voice-setup-stage">
        <div className="rf-voice-setup-stage-head">
          <div>
            <span>
              Step {step + 1} of {steps.length}
            </span>
            <h3>
              {step === 0
                ? "How should ReachFly handle phone calls?"
                : step === 1
                  ? "Choose the business number customers will know."
                  : step === 2
                    ? "Who should callers and prospects hear?"
                    : step === 3
                      ? "What should the agent know about your business?"
                      : step === 4
                        ? "What should happen during and after a call?"
                        : "Review and activate your phone agent."}
            </h3>
            <p>
              {step === 0
                ? "Choose inbound, outbound, or both. You can use the same real business number for both directions."
                : step === 1
                  ? "Buy a ReachFly-managed number or connect a supported number you already own. ReachFly manages the calling infrastructure for you."
                  : step === 2
                    ? "Choose the customer-facing name and voice. Technical calling configuration stays managed automatically."
                    : step === 3
                      ? "Website intelligence is optional. When added, ReachFly prepares the context before calls."
                      : step === 4
                        ? "Configure only the workflow details that change how calls are handled; safe technical defaults stay automatic."
                        : "Confirm the number, workflow, calling policy and available call balance."}
            </p>
          </div>
          <span className="rf-voice-setup-step-number">
            0{step + 1}
          </span>
        </div>

        {step === 0 ? (
          <div className="rf-voice-setup-pane">
            <div className="rf-voice-mode-grid">
              {[
                [
                  "inbound",
                  "Inbound",
                  "Answer customers who call your business.",
                  "Reception, qualification, booking, support and order intake.",
                ],
                [
                  "outbound",
                  "Outbound",
                  "Call leads and prospects from ReachFly.",
                  "Qualification, follow-up, callbacks and booked meetings.",
                ],
                [
                  "both",
                  "Inbound + outbound",
                  "Use one phone workflow in both directions.",
                  "Answer incoming calls and run outbound sales from the same workspace.",
                ],
              ].map(
                ([value, title, description, detail]) => (
                  <button
                    type="button"
                    key={value}
                    className={`rf-voice-mode-card ${
                      normalizedMode === value
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      onChange("callingMode", value)
                    }
                  >
                    <span>
                      {value === "inbound"
                        ? "↓"
                        : value === "outbound"
                          ? "↑"
                          : "↕"}
                    </span>
                    <h4>{title}</h4>
                    <p>{description}</p>
                    <small>{detail}</small>
                  </button>
                )
              )}
            </div>

          </div>
        ) : null}

        {step === 1 ? (
          <div className="rf-voice-setup-pane">
            <div className="rf-voice-number-paths three">
              <button
                type="button"
                className={
                  numberPath === "owned"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  selectNumberPath("owned")
                }
              >
                <b>My numbers</b>
                <small>
                  View and select numbers already owned or verified by this workspace.
                </small>
              </button>

              <button
                type="button"
                className={
                  numberPath === "buy"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  selectNumberPath("buy")
                }
              >
                <b>Buy number</b>
                <small>
                  Search inventory, pay securely and let ReachFly provision the number.
                </small>
              </button>

              <button
                type="button"
                className={
                  numberPath === "existing"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  selectNumberPath("existing")
                }
              >
                <b>Connect existing number</b>
                <small>
                  Use supported SIP/BYOC, forwarding or porting with ownership verification.
                </small>
              </button>
            </div>

            {numberPath === "owned" ? (
              <>
                <section className="rf-owned-numbers-section">
                              <div className="rf-owned-numbers-head">
                                <div>
                                  <span>Owned numbers</span>
                                  <h4>Your ReachFly business numbers</h4>
                                  <p>
                                    Active numbers already owned or verified by this workspace can
                                    be selected immediately for Voice Agent calling.
                                  </p>
                                </div>
                                <b>{ownedNumbers.length}</b>
                              </div>

                              {ownedNumbers.length ? (
                                <div className="rf-owned-number-grid">
                                  {ownedNumbers.map((number) => {
                                    const isActive =
                                      normalizeStatus(number.status) === "active";
                                    const isSelected =
                                      normalizePhoneForUi(number.phoneNumber) ===
                                      normalizePhoneForUi(selectedNumber);

                                    return (
                                      <article
                                        key={number.id || number.phoneNumber}
                                        className={`rf-owned-number-card ${
                                          isSelected ? "selected" : ""
                                        }`}
                                      >
                                        <div className="rf-owned-number-top">
                                          <span className="rf-owned-number-icon">☎</span>
                                          <div>
                                            <strong>{formatPhone(number.phoneNumber)}</strong>
                                            <small>
                                              {number.source === "existing_number"
                                                ? "Connected existing number"
                                                : number.testMode
                                                  ? "Sandbox ReachFly number"
                                                  : "ReachFly managed number"}
                                            </small>
                                          </div>
                                          <em className={isActive ? "active" : ""}>
                                            {formatLabel(number.status || "pending")}
                                          </em>
                                        </div>

                                        <div className="rf-owned-number-capabilities">
                                          <span
                                            className={
                                              number.inboundEnabled ? "ready" : ""
                                            }
                                          >
                                            ↓ Inbound
                                          </span>
                                          <span
                                            className={
                                              number.outboundEnabled !== false ? "ready" : ""
                                            }
                                          >
                                            ↑ Outbound
                                          </span>
                                          <span>
                                            {number.callingMode === "both"
                                              ? "Both directions"
                                              : formatLabel(number.callingMode || "outbound")}
                                          </span>
                                        </div>

                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 8,
                                            flexWrap: "wrap",
                                            alignItems: "center",
                                          }}
                                        >
                                          <button
                                            type="button"
                                            className={isSelected ? "btn light" : "btn primary"}
                                            disabled={!isActive || isSelected}
                                            onClick={() => useOwnedNumber(number)}
                                          >
                                            {isSelected
                                              ? "Selected"
                                              : isActive
                                                ? "Use this number"
                                                : "Activation pending"}
                                          </button>

                                          {number.source === "existing_number" ? (
                                            <button
                                              type="button"
                                              className="btn light"
                                              disabled={
                                                unlinkingNumberId === number.id ||
                                                verifyingExisting
                                              }
                                              onClick={() =>
                                                void unlinkExistingNumber(number)
                                              }
                                            >
                                              {unlinkingNumberId === number.id
                                                ? "Unlinking…"
                                                : "Unlink number"}
                                            </button>
                                          ) : null}
                                        </div>
                                      </article>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="rf-owned-numbers-empty">
                                  <span>☎</span>
                                  <div>
                                    <b>No owned business numbers yet</b>
                                    <p>
                                      Buy a ReachFly number below or connect a number you already
                                      own. New customer workspaces cannot skip this activation step.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </section>

                {numberReady ? (
                  <div className="rf-voice-number-ready-panel">
                                  <div>
                                    <span>Business number active</span>
                                    <strong>
                                      {formatPhone(selectedNumber)}
                                    </strong>
                                    <small>
                                      {!purchasedNumberRequired
                                        ? "Existing ReachFly calling identity for this workspace"
                                        : selectedOwnedNumber?.testMode
                                          ? "Sandbox workspace identity · outbound QA routes through the shared ReachFly test line"
                                          : `${normalizedMode === "both" ? "Inbound + outbound" : normalizedMode} calling identity`}
                                    </small>
                                  </div>
                                  <b>✓ Active</b>
                                </div>
                ) : null}
              </>
            ) : null}

            {numberPath === "buy" ? (
              <>
                <div className="rf-voice-essential-grid three">
                  <Field
                    label="Country"
                    value={searchForm.countryCode}
                    onChange={(value) =>
                      setSearchForm((current) => ({
                        ...current,
                        countryCode: String(
                          value || ""
                        )
                          .toUpperCase()
                          .slice(0, 2),
                      }))
                    }
                    placeholder="US"
                  />
                  <Field
                    label="Area code (optional)"
                    value={searchForm.areaCode}
                    onChange={(value) =>
                      setSearchForm((current) => ({
                        ...current,
                        areaCode: String(
                          value || ""
                        )
                          .replace(/\D/g, "")
                          .slice(0, 8),
                      }))
                    }
                    placeholder="213"
                  />
                  <Field
                    label="City (optional)"
                    value={searchForm.locality}
                    onChange={(value) =>
                      setSearchForm((current) => ({
                        ...current,
                        locality: value,
                      }))
                    }
                    placeholder="Los Angeles"
                  />
                </div>

                <div className="rf-voice-wizard-actions">
                  <button
                    type="button"
                    className="btn primary rf-voice-primary-action"
                    disabled={
                      searchingNumbers ||
                      !commerce?.canPurchase
                    }
                    onClick={() =>
                      void searchNumbers()
                    }
                  >
                    {searchingNumbers
                      ? "Finding numbers…"
                      : "Find available numbers"}
                  </button>
                </div>

                {quote?.items?.length ? (
                  <div className="rf-voice-number-grid">
                    {quote.items.map((item) => (
                      <article
                        className="rf-voice-number-card"
                        key={item.phoneNumber}
                      >
                        <div className="rf-voice-number-card-main">
                          <span className="rf-voice-number-badge">
                            {commerce?.testMode?.enabled
                              ? "Sandbox"
                              : "Business number"}
                          </span>
                          <h3>
                            {formatPhone(
                              item.phoneNumber
                            )}
                          </h3>
                          <p>
                            {(item.regionInformation ||
                              [])
                              .map(
                                (region) =>
                                  region.name
                              )
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(" · ") ||
                              "Voice-capable local number"}
                          </p>
                        </div>

                        <div className="rf-voice-number-price">
                          <small>
                            Initial activation
                          </small>
                          <b>
                            {formatMoneyMinorVoice(
                              item.initialChargeMinor,
                              item.currency
                            )}
                          </b>
                        </div>

                        <button
                          type="button"
                          className="btn primary"
                          disabled={Boolean(
                            buyingNumber
                          )}
                          onClick={() =>
                            void buyNumber(item)
                          }
                        >
                          {buyingNumber ===
                          item.phoneNumber
                            ? "Opening secure checkout…"
                            : "Choose this number"}
                        </button>
                      </article>
                    ))}
                  </div>
                ) : null}

                {commerce?.testMode?.enabled &&
                inboundEnabled ? (
                  <div className="rf-voice-inline-warning">
                    Sandbox numbers can complete purchase,
                    activation and outbound QA. They cannot
                    receive a real PSTN inbound call. Real
                    inbound becomes available after a real
                    ReachFly-provisioned or verified BYOC
                    number is attached.
                  </div>
                ) : null}
              </>
            ) : null}

            {numberPath === "existing" ? (
              <div className="rf-voice-existing-number-panel">
                                  <div className="rf-voice-essential-grid two">
                                    <Field
                                      label="Business number"
                                      value={
                                        existingNumberForm.phoneNumber
                                      }
                                      onChange={(value) =>
                                        setExistingNumberForm(
                                          (current) => ({
                                            ...current,
                                            phoneNumber: value,
                                          })
                                        )
                                      }
                                      placeholder="+1 213 555 0100"
                                    />

                                    <label className="rf-agent-field">
                                      <span>
                                        Connection method
                                      </span>
                                      <select
                                        value={
                                          existingNumberForm.method
                                        }
                                        onChange={(event) =>
                                          setExistingNumberForm(
                                            (current) => ({
                                              ...current,
                                              method:
                                                event.target.value,
                                            })
                                          )
                                        }
                                      >
                                        <option value="sip_byoc">
                                          Advanced carrier routing
                                        </option>
                                        <option value="forwarding">
                                          Verified forwarding
                                        </option>
                                        <option value="porting">
                                          Port to ReachFly
                                        </option>
                                      </select>
                                      <small>
                                        Use advanced carrier routing
                                        when your current provider supports
                                        direct inbound and outbound calling.
                                      </small>
                                    </label>
                                  </div>

                                  <div className="rf-voice-wizard-actions">
                                    <button
                                      type="button"
                                      className="btn primary"
                                      disabled={
                                        connectingExisting ||
                                        !commerce?.canPurchase
                                      }
                                      onClick={() =>
                                        void connectExistingNumber()
                                      }
                                    >
                                      {connectingExisting
                                        ? "Starting verification…"
                                        : "Verify and connect number"}
                                    </button>
                                  </div>

                                  {existingPending ? (
                                    <div className="rf-voice-verification-card">
                                      <span>
                                        Ownership verification
                                      </span>
                                      <strong>
                                        {formatPhone(
                                          existingPending?.number
                                            ?.phoneNumber ||
                                            existingNumberForm.phoneNumber
                                        )}
                                      </strong>
                                      <p>
                                        {existingPending?.verification ||
                                          "Complete ownership verification to activate this number."}
                                      </p>

                                      {existingPending?.testVerificationCode ||
                                      existingPending?.requiresVerificationCode === true ||
                                      normalizeStatus(
                                        existingPending?.number?.verificationProvider
                                      ) === "telnyx_verified_numbers" ? (
                                        <div className="rf-voice-verification-code">
                                          <Field
                                            label={
                                              existingPending?.testVerificationCode
                                                ? "Sandbox verification code"
                                                : "Verification code"
                                            }
                                            value={verificationCode}
                                            onChange={setVerificationCode}
                                            placeholder="123456"
                                          />
                                          {!existingPending?.testVerificationCode ? (
                                            <small>
                                              Enter the code delivered by the Telnyx ownership-verification call or SMS.
                                            </small>
                                          ) : null}
                                          <button
                                            type="button"
                                            className="btn primary"
                                            disabled={
                                              verifyingExisting || !verificationCode.trim()
                                            }
                                            onClick={() =>
                                              void verifyExistingNumber()
                                            }
                                          >
                                            {verifyingExisting
                                              ? "Verifying…"
                                              : existingPending?.testVerificationCode
                                                ? "Confirm ownership"
                                                : "Verify code"}
                                          </button>
                                        </div>
                                      ) : null}

                                      {normalizeStatus(
                                        existingPending?.number?.status
                                      ) === "routing_required" ? (
                                        <div className="rf-voice-sip-routing-step">
                                          <span>Inbound routing destination</span>
                                          <code>
                                            {existingPending?.sipDestination ||
                                              `sip:${normalizePhoneForUi(
                                                existingPending?.number?.phoneNumber ||
                                                  existingNumberForm.phoneNumber
                                              )}@sip.rtc.elevenlabs.io:5060`}
                                          </code>
                                          <p>
                                            Route the existing number to this destination from your carrier or PBX, place one inbound test call, then verify the route.
                                          </p>
                                          <button
                                            type="button"
                                            className="btn primary"
                                            disabled={verifyingExisting}
                                            onClick={() =>
                                              void testExistingNumberRouting()
                                            }
                                          >
                                            {verifyingExisting
                                              ? "Checking route…"
                                              : "Check inbound routing"}
                                          </button>
                                        </div>
                                      ) : null}

                                      {normalizeStatus(
                                        existingPending?.number?.status
                                      ) === "carrier_action_required" ? (
                                        <div className="rf-voice-carrier-assisted-step">
                                          <b>Ownership verified</b>
                                          <span>
                                            {existingPending?.verification ||
                                              "Complete the guided carrier step before ReachFly marks this number active."}
                                          </span>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="rf-voice-setup-pane">
            <div className="rf-voice-identity-stack">
              <Field
                label="Agent name"
                value={form.name}
                onChange={(value) =>
                  onChange("name", value)
                }
                placeholder="James"
              />

              <div className="rf-agent-field rf-voice-picker-field">
                <span>Voice</span>
                <VoiceLibraryPicker
                  voices={voices}
                  value={form.voice}
                  recommendedVoice={recommendedVoice}
                  onChange={(voiceId) =>
                    onChange("voice", voiceId)
                  }
                />
              </div>
            </div>

            <div className="rf-voice-language-panel">
              <div className="rf-agent-card-heading compact">
                <div>
                  <span>Languages</span>
                  <h3>Speak to every lead in the right language</h3>
                </div>
                <b className="rf-agent-count">
                  {normalizeLanguageList(form.supportedLanguages, form.primaryLanguage).length} enabled
                </b>
              </div>

              <div className="rf-voice-essential-grid two">
                <label className="rf-agent-field">
                  <span>Primary language</span>
                  <select
                    value={normalizeLanguageCode(form.primaryLanguage)}
                    onChange={(event) => {
                      const language = normalizeLanguageCode(event.target.value);
                      onChange("primaryLanguage", language);
                      onChange(
                        "supportedLanguages",
                        Array.from(
                          new Set([language, ...(form.supportedLanguages || [])])
                        )
                      );
                    }}
                  >
                    {LANGUAGE_OPTIONS.map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                  <small>Used when a lead or campaign has no explicit language.</small>
                </label>

                <label className="rf-agent-checkbox-card">
                  <input
                    type="checkbox"
                    checked={form.autoDetectLanguage !== false}
                    onChange={(event) =>
                      onChange("autoDetectLanguage", event.target.checked)
                    }
                  />
                  <span>
                    <b>Auto-detect caller language</b>
                    <small>For inbound or mid-call language changes, switch only between languages enabled below.</small>
                  </span>
                </label>
              </div>

              <div className="rf-v6-language-chips">
                {LANGUAGE_OPTIONS.map(([code, name]) => {
                  const supported = normalizeLanguageList(
                    form.supportedLanguages,
                    form.primaryLanguage
                  );
                  const checked = supported.includes(code);
                  const locked = code === normalizeLanguageCode(form.primaryLanguage);
                  return (
                    <label key={code} className={checked ? "active" : ""}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={(event) =>
                          onChange(
                            "supportedLanguages",
                            event.target.checked
                              ? Array.from(new Set([...supported, code]))
                              : supported.filter((item) => item !== code)
                          )
                        }
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </div>

              <div className="rf-v6-language-overrides">
                {normalizeLanguageList(
                  form.supportedLanguages,
                  form.primaryLanguage
                ).map((code) => (
                  <div className="rf-v6-language-row" key={code}>
                    <strong>{languageLabel(code)}</strong>
                    <label className="rf-agent-field">
                      <span>Voice override <em>optional</em></span>
                      <select
                        value={form.languageVoices?.[code] || ""}
                        onChange={(event) =>
                          onChange("languageVoices", {
                            ...(form.languageVoices || {}),
                            [code]: event.target.value,
                          })
                        }
                      >
                        <option value="">Use primary agent voice</option>
                        {voices.map((voice) => (
                          <option key={`${code}-${voice.id}`} value={voice.id}>
                            {voice.name || voice.label || voice.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="rf-agent-field">
                      <span>Opening line <em>optional</em></span>
                      <textarea
                        rows={2}
                        value={form.languageGreetings?.[code] || ""}
                        onChange={(event) =>
                          onChange("languageGreetings", {
                            ...(form.languageGreetings || {}),
                            [code]: event.target.value,
                          })
                        }
                        placeholder={`Leave blank for ReachFly's managed ${languageLabel(code)} opening.`}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="rf-voice-summary-strip">
              <div>
                <small>Company</small>
                <b>
                  {form.companyName ||
                    "Workspace company"}
                </b>
              </div>
              <div>
                <small>Calling mode</small>
                <b>
                  {normalizedMode === "both"
                    ? "Inbound + outbound"
                    : normalizedMode === "inbound"
                      ? "Inbound"
                      : "Outbound"}
                </b>
              </div>
              <div>
                <small>Business number</small>
                <b>
                  {selectedNumber
                    ? formatPhone(selectedNumber)
                    : "Not connected"}
                </b>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="rf-voice-setup-pane">
            <div className="rf-voice-wizard-note">
              <b>Optional business intelligence</b>
              <span>
                Add a public website when you want the
                agent grounded in your services, ideal
                customers, proof points and common
                objections.
              </span>
            </div>

            <div className="rf-voice-essential-grid two">
              <Field
                label="Company website (optional)"
                value={form.websiteUrl}
                onChange={(value) =>
                  onChange("websiteUrl", value)
                }
                placeholder="https://yourcompany.com"
              />

              <Field
                label="Meeting owner email (optional)"
                value={form.calendarOwnerEmail}
                onChange={(value) =>
                  onChange(
                    "calendarOwnerEmail",
                    value
                  )
                }
                placeholder="sales@yourcompany.com"
              />
            </div>

            {String(form.websiteUrl || "").trim() ? (
              <div className="rf-voice-wizard-actions">
                <button
                  type="button"
                  className="btn light"
                  disabled={analyzingWebsite}
                  onClick={onAnalyzeWebsite}
                >
                  {analyzingWebsite
                    ? "Analyzing website…"
                    : form.websiteIntelligence
                          ?.analyzedAt
                      ? "Re-analyze website"
                      : "Analyze website"}
                </button>
              </div>
            ) : null}

            {form.websiteIntelligence?.analyzedAt ? (
              <WebsiteIntelligencePreview
                intelligence={
                  form.websiteIntelligence
                }
                websiteUrl={form.websiteUrl}
              />
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="rf-voice-setup-pane">
            {inboundEnabled ? (
              <section className="rf-voice-workflow-block">
                <div className="rf-voice-workflow-title">
                  <span>↓ Inbound workflow</span>
                  <h4>
                    What should happen when a customer
                    calls you?
                  </h4>
                </div>

                <div className="rf-voice-essential-grid two">
                  <label className="rf-agent-field">
                    <span>Primary inbound job</span>
                    <select
                      value={
                        form.inboundObjective ||
                        "general"
                      }
                      onChange={(event) =>
                        onChange(
                          "inboundObjective",
                          event.target.value
                        )
                      }
                    >
                      {objectiveOptions.map(
                        ([value, label]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        )
                      )}
                    </select>
                    <small>
                      ReachFly adapts the conversation
                      around this primary outcome.
                    </small>
                  </label>

                  <Field
                    label="Human transfer number (optional)"
                    value={
                      form.humanTransferNumber
                    }
                    onChange={(value) =>
                      onChange(
                        "humanTransferNumber",
                        value
                      )
                    }
                    placeholder="+1 555 123 4567"
                  />
                </div>

                <div className="rf-agent-field-grid three">
                  <NumberField
                    label="Business hours start"
                    value={
                      form.inboundBusinessHoursStart
                    }
                    min={0}
                    max={23}
                    suffix=":00"
                    onChange={(value) =>
                      onChange(
                        "inboundBusinessHoursStart",
                        value
                      )
                    }
                  />
                  <NumberField
                    label="Business hours end"
                    value={
                      form.inboundBusinessHoursEnd
                    }
                    min={1}
                    max={24}
                    suffix=":00"
                    onChange={(value) =>
                      onChange(
                        "inboundBusinessHoursEnd",
                        value
                      )
                    }
                  />
                  <label className="rf-agent-field">
                    <span>After hours</span>
                    <select
                      value={
                        form.inboundAfterHoursMode ||
                        "message"
                      }
                      onChange={(event) =>
                        onChange(
                          "inboundAfterHoursMode",
                          event.target.value
                        )
                      }
                    >
                      <option value="message">
                        Take a message
                      </option>
                      <option value="callback">
                        Offer a callback
                      </option>
                      <option value="answer">
                        Continue answering
                      </option>
                      <option value="transfer">
                        Transfer when allowed
                      </option>
                    </select>
                  </label>
                </div>

                <div className="rf-voice-action-grid">
                  {[
                    [
                      "captureCaller",
                      "Capture caller details",
                      true,
                    ],
                    [
                      "bookMeeting",
                      "Book confirmed meetings",
                      false,
                    ],
                    [
                      "updateCrm",
                      "Update ReachFly CRM outcome",
                      false,
                    ],
                    [
                      "transferHuman",
                      "Allow human transfer",
                      false,
                    ],
                  ].map(
                    ([key, label, locked]) => (
                      <label
                        className="rf-voice-action-toggle"
                        key={key}
                      >
                        <input
                          type="checkbox"
                          disabled={locked}
                          checked={
                            locked
                              ? true
                              : Boolean(
                                  form
                                    .inboundActions?.[
                                    key
                                  ]
                                )
                          }
                          onChange={(event) =>
                            updateNested(
                              "inboundActions",
                              key,
                              event.target.checked
                            )
                          }
                        />
                        <span>{label}</span>
                      </label>
                    )
                  )}
                </div>

                <label className="rf-agent-field">
                  <span>
                    Inbound instructions (optional)
                  </span>
                  <textarea
                    value={
                      form.inboundInstructions || ""
                    }
                    onChange={(event) =>
                      onChange(
                        "inboundInstructions",
                        event.target.value
                      )
                    }
                    placeholder="Examples: collect order number before support; ask new leads about timeline; never quote discounts without approval."
                    rows={4}
                  />
                </label>
              </section>
            ) : null}

            {outboundEnabled ? (
              <section className="rf-voice-workflow-block">
                <div className="rf-voice-workflow-title">
                  <span>↑ Outbound workflow</span>
                  <h4>
                    How should ReachFly call prospects?
                  </h4>
                </div>

                <div className="rf-voice-essential-grid two">
                  <Field
                    label="Meeting owner email (optional)"
                    value={
                      form.calendarOwnerEmail
                    }
                    onChange={(value) =>
                      onChange(
                        "calendarOwnerEmail",
                        value
                      )
                    }
                    placeholder="sales@yourcompany.com"
                  />
                  <Field
                    label="Booking timezone"
                    value={form.bookingTimezone}
                    onChange={(value) =>
                      onChange(
                        "bookingTimezone",
                        value
                      )
                    }
                    placeholder="America/New_York"
                  />
                </div>

                <div className="rf-voice-action-grid">
                  {[
                    [
                      "bookMeeting",
                      "Book confirmed meetings",
                    ],
                    [
                      "updateCrm",
                      "Write call outcome to CRM",
                    ],
                  ].map(([key, label]) => (
                    <label
                      className="rf-voice-action-toggle"
                      key={key}
                    >
                      <input
                        type="checkbox"
                        checked={
                          form.outboundActions?.[
                            key
                          ] !== false
                        }
                        onChange={(event) =>
                          updateNested(
                            "outboundActions",
                            key,
                            event.target.checked
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <details className="rf-voice-advanced">
                  <summary>
                    Advanced outbound controls
                  </summary>
                  <div className="rf-agent-field-grid three">
                    <NumberField
                      label="Daily call limit"
                      value={form.dailyCallLimit}
                      min={1}
                      max={5000}
                      onChange={(value) =>
                        onChange(
                          "dailyCallLimit",
                          value
                        )
                      }
                    />
                    <NumberField
                      label="Concurrent calls"
                      value={form.concurrency}
                      min={1}
                      max={5}
                      onChange={(value) =>
                        onChange(
                          "concurrency",
                          value
                        )
                      }
                    />
                    <NumberField
                      label="Maximum attempts"
                      value={form.maxAttempts}
                      min={1}
                      max={10}
                      onChange={(value) =>
                        onChange(
                          "maxAttempts",
                          value
                        )
                      }
                    />
                    <NumberField
                      label="Call window starts"
                      value={
                        form.callingWindowStartHour
                      }
                      min={8}
                      max={20}
                      suffix=":00"
                      onChange={(value) =>
                        onChange(
                          "callingWindowStartHour",
                          value
                        )
                      }
                    />
                    <NumberField
                      label="Call window ends"
                      value={
                        form.callingWindowEndHour
                      }
                      min={9}
                      max={21}
                      suffix=":00"
                      onChange={(value) =>
                        onChange(
                          "callingWindowEndHour",
                          value
                        )
                      }
                    />
                    <NumberField
                      label="Max call length"
                      value={form.maxCallSeconds}
                      min={60}
                      max={3600}
                      suffix="seconds"
                      onChange={(value) =>
                        onChange(
                          "maxCallSeconds",
                          value
                        )
                      }
                    />
                  </div>
                </details>
              </section>
            ) : null}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="rf-voice-setup-pane">
            <div className="rf-voice-review-grid">
              <article>
                <span>Calling</span>
                <strong>
                  {normalizedMode === "both"
                    ? "Inbound + outbound"
                    : normalizedMode === "inbound"
                      ? "Inbound"
                      : "Outbound"}
                </strong>
                <small>
                  {inboundEnabled &&
                  selectedOwnedNumber?.testMode
                    ? "Sandbox inbound is simulated"
                    : "Configured workspace mode"}
                </small>
              </article>

              <article>
                <span>Business number</span>
                <strong>
                  {selectedNumber
                    ? formatPhone(selectedNumber)
                    : "Not active"}
                </strong>
                <small>
                  {!purchasedNumberRequired
                    ? "Preconfigured ReachFly number"
                    : selectedOwnedNumber?.testMode
                      ? "Sandbox identity"
                      : selectedOwnedNumber?.source ===
                          "existing_number"
                        ? "Verified existing number"
                        : "ReachFly-provisioned number"}
                </small>
              </article>

              <article>
                <span>Agent</span>
                <strong>{form.name}</strong>
                <small>
                  {selectedVoice?.name ||
                    "Managed voice"}
                </small>
              </article>

              <article>
                <span>Business</span>
                <strong>
                  {form.companyName ||
                    "Workspace company"}
                </strong>
                <small>
                  {form.websiteIntelligence
                    ?.analyzedAt
                    ? "Website intelligence ready"
                    : "Default context"}
                </small>
              </article>
            </div>

            <label className="rf-voice-policy-check">
              <input
                type="checkbox"
                checked={Boolean(
                  form.complianceConfirmed
                )}
                onChange={(event) =>
                  onChange(
                    "complianceConfirmed",
                    event.target.checked
                  )
                }
              />
              <span>
                <b>
                  Approve calling, suppression &
                  disclosure policy
                </b>
                <small>
                  I confirm this workspace will use
                  permitted calling, respect DNC and
                  suppression requests, use approved
                  calling windows where applicable and
                  follow required automated-caller and
                  recording disclosures.
                </small>
              </span>
            </label>

            <label className="rf-voice-policy-check secondary">
              <input
                type="checkbox"
                checked={Boolean(
                  form.recordingEnabled
                )}
                onChange={(event) =>
                  onChange(
                    "recordingEnabled",
                    event.target.checked
                  )
                }
              />
              <span>
                <b>Enable call recording</b>
                <small>
                  Optional. Enable only when your consent,
                  disclosure, access and retention rules
                  allow recording.
                </small>
              </span>
            </label>

            <section className="rf-voice-credit-wallet">
              <div className="rf-voice-credit-wallet-head">
                <div>
                  <span>AI calling balance</span>
                  <strong>
                    {paidCreditsRequired
                      ? formatCreditsCompact(
                          callBalance
                        )
                      : "Not required"}
                  </strong>
                  <small>
                    {paidCreditsRequired
                      ? "1 credit = 1 completed connected conversation"
                      : "This workspace uses its existing preconfigured ReachFly calling access"}
                  </small>
                </div>

                {paidCreditsRequired ? (
                  <div>
                    <b>$1</b>
                    <small>
                      current connected-call price
                    </small>
                  </div>
                ) : (
                  <div>
                    <b>✓</b>
                    <small>
                      existing calling identity active
                    </small>
                  </div>
                )}
              </div>

              <div className="rf-voice-credit-meter">
                <span
                  style={{
                    width: paidCreditsRequired
                      ? `${Math.min(
                          100,
                          Math.max(
                            8,
                            callBalance * 4
                          )
                        )}%`
                      : "100%",
                  }}
                />
              </div>

              {!paidCreditsRequired ? (
                <p>
                  This workspace is exempt from the
                  customer purchase/credit activation gate.
                </p>
              ) : callBalance > 0 ? (
                <p>
                  {callBalance === signupFreeCredits
                    ? `Your ${signupFreeCredits} free signup credits are ready. `
                    : `${formatCreditsCompact(
                        callBalance
                      )} connected-call credits are available. `}
                  Failed, unanswered and zero-duration
                  outbound attempts do not consume a
                  connected-call credit.
                </p>
              ) : (
                <p>
                  Your calling wallet is empty. Add credits
                  before activation.
                </p>
              )}

              {paidCreditsRequired &&
              callPacks.length ? (
                <div className="rf-voice-credit-pack-row">
                  {callPacks.map((pack) => (
                    <button
                      type="button"
                      key={pack.id}
                      disabled={
                        Boolean(buyingCredits) ||
                        !billing?.aiCalling?.canPurchase
                      }
                      onClick={() =>
                        void buyCallCredits(pack)
                      }
                    >
                      <span>
                        {pack.credits} calls
                      </span>
                      <b>
                        {formatMoneyMinorVoice(
                          pack.amountMinor,
                          pack.currency
                        )}
                      </b>
                      <small>
                        {buyingCredits === pack.id
                          ? "Opening checkout…"
                          : "Add credits"}
                      </small>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            {inboundEnabled &&
            selectedOwnedNumber?.testMode ? (
              <div className="rf-voice-inline-warning">
                This sandbox number is enough to test
                ReachFly onboarding, payment, configuration
                and outbound QA. It is not a real inbound
                PSTN destination. Activate a real
                ReachFly-provisioned or verified BYOC
                number before testing a live inbound call.
              </div>
            ) : null}

            <button
              type="button"
              className="btn primary full rf-agent-save rf-voice-activate-button"
              disabled={
                saving ||
                analyzingWebsite ||
                !form.complianceConfirmed ||
                !numberReady ||
                (paidCreditsRequired &&
                  callBalance <= 0)
              }
              onClick={() => void save()}
            >
              {saving
                ? "Creating and synchronizing Voice Agent…"
                : onboarding
                  ? "Activate Voice Agent"
                  : "Save Voice Agent"}
            </button>
          </div>
        ) : null}

        <div className="rf-voice-setup-nav">
          <button
            type="button"
            className="rf-voice-arrow-button secondary"
            disabled={step === 0 || saving}
            onClick={() => moveTo(step - 1)}
            aria-label="Previous setup step"
          >
            <span>←</span>
            <div>
              <small>Previous</small>
              <b>
                {step > 0
                  ? steps[step - 1].label
                  : ""}
              </b>
            </div>
          </button>

          {step < steps.length - 1 ? (
            <button
              type="button"
              className="rf-voice-arrow-button primary"
              disabled={
                analyzingWebsite || saving
              }
              onClick={next}
              aria-label="Next setup step"
            >
              <div>
                <small>Next</small>
                <b>{steps[step + 1].label}</b>
              </div>
              <span>→</span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}



function VoiceLibraryPicker({
  voices = [],
  value = "",
  recommendedVoice = null,
  onChange,
}) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [accent, setAccent] = useState("all");
  const [age, setAge] = useState("all");
  const [niche, setNiche] = useState("all");
  const [playingId, setPlayingId] = useState("");
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const options = useMemo(() => {
    const unique = (key) =>
      [...new Set(
        voices
          .map((voice) => String(voice?.[key] || "").trim())
          .filter(Boolean)
      )].sort((left, right) => left.localeCompare(right));

    return {
      languages: unique("language"),
      accents: unique("accent"),
      ages: unique("age"),
      niches: [...new Set(
        voices
          .map((voice) =>
            String(
              voice?.niche ||
                voice?.useCase ||
                voice?.category ||
                ""
            ).trim()
          )
          .filter(Boolean)
      )].sort((left, right) => left.localeCompare(right)),
    };
  }, [voices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return voices.filter((voice) => {
      const voiceNiche = String(
        voice?.niche ||
          voice?.useCase ||
          voice?.category ||
          ""
      ).trim();

      const searchable = [
        voice?.name,
        voice?.language,
        voice?.accent,
        voice?.age,
        voice?.gender,
        voice?.useCase,
        voice?.niche,
        voice?.category,
        voice?.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !searchable.includes(q)) return false;
      if (
        language !== "all" &&
        String(voice?.language || "") !== language
      ) {
        return false;
      }
      if (
        accent !== "all" &&
        String(voice?.accent || "") !== accent
      ) {
        return false;
      }
      if (
        age !== "all" &&
        String(voice?.age || "") !== age
      ) {
        return false;
      }
      if (niche !== "all" && voiceNiche !== niche) {
        return false;
      }
      return true;
    });
  }, [voices, query, language, accent, age, niche]);

  const selected =
    voices.find((voice) => voice.id === value) ||
    recommendedVoice ||
    null;

  function stopPreview() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingId("");
  }

  function togglePreview(event, voice) {
    event.preventDefault();
    event.stopPropagation();

    if (!voice?.previewUrl) return;

    if (playingId === voice.id) {
      stopPreview();
      return;
    }

    stopPreview();

    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    setPlayingId(voice.id);

    audio.onended = () => {
      setPlayingId("");
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId("");
      audioRef.current = null;
    };

    void audio.play().catch(() => {
      setPlayingId("");
      audioRef.current = null;
    });
  }

  function clearFilters() {
    setQuery("");
    setLanguage("all");
    setAccent("all");
    setAge("all");
    setNiche("all");
  }

  return (
    <div className="rf-voice-library">
      {selected ? (
        <div className="rf-selected-voice-summary">
          <VoiceAvatar voice={selected} large />
          <div>
            <span>Selected voice</span>
            <strong>{selected.name || "Managed voice"}</strong>
            <small>
              {[
                selected.language,
                selected.accent,
                selected.age,
                selected.useCase || selected.niche || selected.category,
              ]
                .filter(Boolean)
                .join(" · ") || "Managed AI voice"}
            </small>
          </div>
          <button
            type="button"
            className="rf-voice-preview-main"
            disabled={!selected.previewUrl}
            onClick={(event) => togglePreview(event, selected)}
          >
            {playingId === selected.id ? "■ Stop preview" : "▶ Hear voice"}
          </button>
        </div>
      ) : null}

      <div className="rf-voice-library-toolbar">
        <label className="rf-voice-search">
          <span>Search voices</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, language, accent or use case…"
          />
        </label>

        <label>
          <span>Language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="all">All languages</option>
            {options.languages.map((item) => (
              <option value={item} key={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Accent</span>
          <select
            value={accent}
            onChange={(event) => setAccent(event.target.value)}
          >
            <option value="all">All accents</option>
            {options.accents.map((item) => (
              <option value={item} key={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Age</span>
          <select
            value={age}
            onChange={(event) => setAge(event.target.value)}
          >
            <option value="all">All ages</option>
            {options.ages.map((item) => (
              <option value={item} key={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Niche / use case</span>
          <select
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
          >
            <option value="all">All use cases</option>
            {options.niches.map((item) => (
              <option value={item} key={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rf-voice-library-meta">
        <span>
          {filtered.length} voice{filtered.length === 1 ? "" : "s"} available
        </span>
        <button type="button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      {filtered.length ? (
        <div className="rf-voice-card-grid">
          {filtered.map((voice) => {
            const selectedVoice = voice.id === value;
            const useCase =
              voice.niche || voice.useCase || voice.category || "";

            return (
              <article
                className={`rf-voice-card ${
                  selectedVoice ? "selected" : ""
                }`}
                key={voice.id}
              >
                <button
                  type="button"
                  className="rf-voice-card-select"
                  onClick={() => onChange?.(voice.id)}
                >
                  <VoiceAvatar voice={voice} />

                  <div className="rf-voice-card-copy">
                    <div>
                      <strong>{voice.name || "AI voice"}</strong>
                      {selectedVoice ? <em>Selected</em> : null}
                    </div>

                    <p>
                      {voice.description ||
                        [
                          voice.language,
                          voice.accent,
                          useCase,
                        ]
                          .filter(Boolean)
                          .join(" · ") ||
                        "Managed customer-facing voice"}
                    </p>

                    <div className="rf-voice-tags">
                      {voice.language ? (
                        <span>{formatLabel(voice.language)}</span>
                      ) : null}
                      {voice.accent ? (
                        <span>{formatLabel(voice.accent)}</span>
                      ) : null}
                      {voice.age ? (
                        <span>{formatLabel(voice.age)}</span>
                      ) : null}
                      {useCase ? (
                        <span>{formatLabel(useCase)}</span>
                      ) : null}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className="rf-voice-card-preview"
                  disabled={!voice.previewUrl}
                  onClick={(event) => togglePreview(event, voice)}
                  title={
                    voice.previewUrl
                      ? "Play AI voice preview"
                      : "No provider preview is available for this voice"
                  }
                >
                  <span>
                    {playingId === voice.id ? "■" : "▶"}
                  </span>
                  {playingId === voice.id ? "Stop" : "Preview"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rf-voice-library-empty">
          <b>No voices match these filters.</b>
          <p>Clear one or more filters to see the full voice library.</p>
          <button type="button" className="btn light" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function VoiceAvatar({ voice, large = false }) {
  const providerImageUrl = String(
    voice?.imageUrl ||
      voice?.image ||
      voice?.avatarUrl ||
      ""
  ).trim();

  const voiceSeed = String(
    voice?.id ||
      voice?.voiceId ||
      voice?.voice_id ||
      voice?.name ||
      voice?.voiceName ||
      "ReachFly Voice"
  ).trim();

  const generatedImageUrl = useMemo(
    () =>
      new Avatar(REACHFLY_VOICE_ART_STYLE, {
        seed: voiceSeed,
        size: large ? 256 : 180,
        backgroundColor: ["#ede9fe", "#fce7f3", "#e0f2fe"],
      }).toDataUri(),
    [voiceSeed, large]
  );

  const diceBearHttpFallback = useMemo(() => {
    const url = new URL("https://api.dicebear.com/10.x/lorelei/svg");
    url.searchParams.set("seed", voiceSeed);
    url.searchParams.set("size", String(large ? 256 : 180));
    return url.href;
  }, [voiceSeed, large]);

  const initials = String(
    voice?.name || voice?.voiceName || "RF"
  )
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  const [imageSrc, setImageSrc] = useState(
    providerImageUrl || generatedImageUrl
  );
  const [imageUnavailable, setImageUnavailable] = useState(false);

  useEffect(() => {
    setImageUnavailable(false);
    setImageSrc(providerImageUrl || generatedImageUrl);
  }, [providerImageUrl, generatedImageUrl]);

  function handleImageError() {
    if (imageSrc === providerImageUrl && providerImageUrl) {
      setImageSrc(generatedImageUrl);
      return;
    }

    if (imageSrc === generatedImageUrl) {
      setImageSrc(diceBearHttpFallback);
      return;
    }

    setImageUnavailable(true);
  }

  return (
    <span
      className={`rf-voice-avatar ${large ? "large" : ""}`}
      data-voice-art="dicebear-lorelei"
      aria-hidden="true"
    >
      {!imageUnavailable ? (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
          onError={handleImageError}
        />
      ) : (
        <b className="rf-voice-avatar-fallback">
          {initials || "RF"}
        </b>
      )}
    </span>
  );
}

function normalizePhoneForUi(value) {
  return String(value || "").replace(/[^\d+]/g, "");
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
          <b>Website profile ready</b>
          <small>{formatDateTime(intelligence.analyzedAt)}</small>
        </span>
        <span>
          <b>{sourcePages.length}</b>
          <small>pages analyzed</small>
        </span>
        <span>
          <b>ReachFly intelligence</b>
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
  agents = [],
  executionAgentId = "",
  campaignContext = "",
  campaignLanguage = "",
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
  activeCustomPhoneCall,
  activeCalls,
  busyCallId,
  creatingCustomLead,
  callingCustomLead,
  canTestCall,
  assigning,
  starting,
  requestedView = "dialer",
  onViewChange,
  onGoogleLeadForm,
  onFindGoogleLeads,
  onCustomLeadForm,
  onQueueCustomLead,
  onCallCustomLead,
  onTestCustomLead,
  onEndCall,
  onOpenCalls,
  onSearch,
  onLeadStatus,
  onQueueStatus,
  onCampaignLimit,
  onExecutionAgentId,
  onCampaignContext,
  onCampaignLanguage,
  onToggleLead,
  onToggleAll,
  onAssign,
  onStart,
}) {
  const leadFlowSteps = [
    {
      key: "dialer",
      view: "dialer",
      label: "Dialer",
      title: "Dial one lead now",
      description:
        "Enter a phone number, choose the AI agent and add private call context for a controlled one-off conversation.",
    },
    {
      key: "discover",
      view: "google-leads",
      label: "Google leads",
      title: "Find fresh prospects",
      description:
        "Use the existing ReachFly Google Places pipeline to discover callable businesses for this workspace.",
    },
    {
      key: "pool",
      view: "lead-pool",
      label: "Lead pool",
      title: "Review and assign",
      description:
        "Search the workspace lead pool, choose the right prospects and assign them to this Voice Agent.",
    },
    {
      key: "activity",
      view: "queue-activity",
      label: "Queue activity",
      title: "Review the calling queue",
      description:
        "Inspect queued, deferred, completed and failed items before starting the next controlled batch.",
    },
    {
      key: "launch",
      view: "launch-calls",
      label: "Launch calls",
      title: "Start approved outbound calls",
      description:
        "Choose the controlled batch size and start calling. ReachFly then moves you to Live calls automatically.",
    },
  ];

  const requestedLeadStep =
    LEAD_VIEW_TO_STEP[requestedView] ?? 0;
  const [leadFlowStep, setLeadFlowStep] = useState(
    requestedLeadStep
  );
  const activeLeadStep =
    leadFlowSteps[leadFlowStep] ||
    leadFlowSteps[0];
  const queuedCount = queue.filter(
    (item) => normalizeStatus(item.status) === "queued"
  ).length;

  useEffect(() => {
    setLeadFlowStep(
      LEAD_VIEW_TO_STEP[requestedView] ?? 0
    );
  }, [requestedView]);

  function moveLeadFlow(nextStep) {
    const resolved = Math.max(
      0,
      Math.min(leadFlowSteps.length - 1, Number(nextStep) || 0)
    );
    setLeadFlowStep(resolved);
    onViewChange?.(
      LEAD_STEP_VIEWS[resolved] ||
        LEAD_STEP_VIEWS[0]
    );
  }

  return (
    <section className="rf-agent-leads-layout rf-lead-flow-shell">
      <header className="rf-lead-flow-header">
        <div className="rf-lead-flow-heading">
          <div>
            <span>Lead queue workflow</span>
            <h2>{activeLeadStep.title}</h2>
            <p>{activeLeadStep.description}</p>
          </div>
          <strong>
            Step {leadFlowStep + 1} of {leadFlowSteps.length}
          </strong>
        </div>

        <div className="rf-lead-flow-progress" role="tablist" aria-label="Lead queue workflow">
          {leadFlowSteps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              role="tab"
              aria-selected={leadFlowStep === index}
              className={`${leadFlowStep === index ? "active" : ""} ${
                leadFlowStep > index ? "done" : ""
              }`}
              onClick={() => moveLeadFlow(index)}
            >
              <span>{leadFlowStep > index ? "✓" : index + 1}</span>
              <div>
                <b>{step.label}</b>
                <small>
                  {step.key === "pool"
                    ? `${selectedLeadIds.length} selected`
                    : step.key === "activity"
                      ? `${queue.length} items`
                      : step.key === "launch"
                        ? `${queuedCount} queued`
                        : step.key === "quick"
                          ? "One-off lead"
                          : "Fresh prospects"}
                </small>
              </div>
            </button>
          ))}
        </div>
      </header>

      <div className="rf-v6-lead-control-bar">
        <label>
          <span>AI agent</span>
          <select
            value={executionAgentId || agent?.id || ""}
            onChange={(event) => onExecutionAgentId?.(event.target.value)}
          >
            {agents.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {String(item.callingMode || "outbound").replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Campaign call language</span>
          <select
            value={
              supportedAgentLanguageOptions(agent).some(([code]) => code === campaignLanguage)
                ? campaignLanguage
                : ""
            }
            onChange={(event) => onCampaignLanguage?.(event.target.value)}
          >
            <option value="">Use each lead / agent default</option>
            {supportedAgentLanguageOptions(agent).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <small>Applied to newly assigned leads. A lead-specific language can override it.</small>
        </label>
        <label className="context">
          <span>Campaign call context</span>
          <textarea
            rows="2"
            value={campaignContext}
            onChange={(event) => onCampaignContext?.(event.target.value)}
            placeholder="Optional context for this calling batch: offer, goal, positioning, current promotion, constraints…"
          />
          <small>Agent context + this campaign context + each lead's private context are snapshotted when the call starts.</small>
        </label>
        <a href="/app/agents">Manage agents</a>
      </div>

      <div className="rf-lead-flow-stage">
        {leadFlowStep === 0 ? (
          <article className="rf-agent-card rf-agent-custom-lead-card">
                  <div className="rf-agent-card-heading compact">
                    <div>
                      <span>Custom AI call</span>
                      <h2>Call one lead with private context</h2>
                    </div>
                    <span className="rf-agent-custom-badge">One-off / high-priority lead</span>
                  </div>

                  <p className="rf-agent-google-copy">
                    Phone number is the only required field. Name, company and private
                    context are optional. ReachFly auto-detects a safe timezone when possible
                    from the phone prefix. Normal calls respect the local calling window;
                    owners and admins can use the controlled test button to bypass only that
                    time window for one manual test call.
                  </p>

                  <div className="rf-agent-custom-grid">
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
                      <small>Only the phone number is required.</small>
                    </label>

                    <label className="rf-agent-field">
                      <span>Contact name <em>optional</em></span>
                      <input
                        value={customLeadForm.contactName}
                        onChange={(event) =>
                          onCustomLeadForm("contactName", event.target.value)
                        }
                        placeholder="e.g. John"
                      />
                    </label>

                    <label className="rf-agent-field">
                      <span>Company <em>optional</em></span>
                      <input
                        value={customLeadForm.companyName}
                        onChange={(event) =>
                          onCustomLeadForm("companyName", event.target.value)
                        }
                        placeholder="e.g. Acme Dental"
                      />
                    </label>

                    <label className="rf-agent-field">
                      <span>Call language <em>optional</em></span>
                      <select
                        value={customLeadForm.preferredLanguage || ""}
                        onChange={(event) =>
                          onCustomLeadForm("preferredLanguage", event.target.value)
                        }
                      >
                        <option value="">Use agent default</option>
                        {supportedAgentLanguageOptions(agent).map(([code, name]) => (
                          <option key={code} value={code}>{name}</option>
                        ))}
                      </select>
                      <small>The outbound conversation starts in this language.</small>
                    </label>
                  </div>

                  <label className="rf-agent-field rf-agent-custom-context">
                    <span>What should the AI know? <em>optional</em></span>
                    <textarea
                      rows={4}
                      maxLength={12000}
                      value={customLeadForm.context}
                      onChange={(event) =>
                        onCustomLeadForm("context", event.target.value)
                      }
                      placeholder="Example: They do not have a website. Introduce CodeSync Labs, explain the value briefly, and try to book a discovery meeting."
                    />
                    <small>
                      {String(customLeadForm.context || "").length.toLocaleString()} / 12,000. Private context is prepared for the agent before the call; it is not read word-for-word.
                    </small>
                  </label>

                  {activeCustomPhoneCall ? (
                    <div className="rf-agent-monitor-warning">
                      <div>
                        <b>Active call already running</b>
                        <div>
                          {activeCustomPhoneCall.leadName || "This lead"} · {formatPhone(
                            activeCustomPhoneCall.toNumber
                          )} · {formatLabel(normalizeStatus(activeCustomPhoneCall.status))}
                        </div>
                      </div>
                      <div className="rf-agent-custom-actions">
                        <button
                          type="button"
                          className="btn light"
                          onClick={onOpenCalls}
                        >
                          Open live call
                        </button>
                        <button
                          type="button"
                          className="btn danger"
                          disabled={busyCallId === activeCustomPhoneCall.id}
                          onClick={() => onEndCall(activeCustomPhoneCall.id)}
                        >
                          {busyCallId === activeCustomPhoneCall.id
                            ? "Ending…"
                            : "End current call"}
                        </button>
                      </div>
                    </div>
                  ) : null}

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
                        callingCustomLead ||
                        Boolean(activeCustomPhoneCall)
                      }
                      onClick={onCallCustomLead}
                    >
                      {activeCustomPhoneCall
                        ? "Call already active"
                        : callingCustomLead
                          ? "Starting AI call…"
                          : "Call this lead now"}
                    </button>
                    {canTestCall ? (
                      <button
                        type="button"
                        className="btn light"
                        disabled={
                          creatingCustomLead ||
                          callingCustomLead ||
                          Boolean(activeCustomPhoneCall)
                        }
                        onClick={onTestCustomLead}
                        title="Bypasses only the configured calling-time window for one controlled Custom AI Call"
                      >
                        {callingCustomLead
                          ? "Starting test call…"
                          : "🧪 Test AI call now (bypass hours)"}
                      </button>
                    ) : null}
                  </div>
                </article>
        ) : null}

        {leadFlowStep === 1 ? (
          <article className="rf-agent-card rf-agent-google-leads-card">
                  <div className="rf-agent-card-heading compact">
                    <div>
                      <span>Google Places lead finder</span>
                      <h2>Find fresh leads for the AI agent</h2>
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
        ) : null}

        {leadFlowStep === 2 ? (
          <article className="rf-agent-card rf-agent-lead-picker">
                  <div className="rf-agent-card-heading compact">
                    <div>
                      <span>Workspace lead pool</span>
                      <h2>Review and assign leads to the voice agent</h2>
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
                                {lead.preferredLanguage ? (
                                  <small>Language: {languageLabel(lead.preferredLanguage)}</small>
                                ) : null}
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
        ) : null}

        {leadFlowStep === 3 ? (
          <article className="rf-agent-card rf-agent-queue-card rf-lead-flow-activity-card">
            <div className="rf-agent-card-heading compact">
              <div>
                <span>Queue activity</span>
                <h2>Review queued and previous AI-call items</h2>
              </div>
              <b className="rf-agent-count">{queue.length} items</b>
            </div>

            <div className="rf-lead-activity-toolbar">
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
              <div>
                <span>Ready now</span>
                <b>{queuedCount}</b>
              </div>
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
                                {item.preferredLanguage || item.lead?.preferredLanguage
                                  ? ` · ${languageLabel(item.preferredLanguage || item.lead?.preferredLanguage)}`
                                  : ""}
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
                              {(() => {
                                const matchingCall = activeCalls.find(
                                  (call) =>
                                    normalizePhoneKey(call.toNumber) ===
                                    normalizePhoneKey(item.phone || item.lead?.phone)
                                );
                                if (!matchingCall) return null;
                                return (
                                  <div className="rf-agent-custom-actions">
                                    <button
                                      type="button"
                                      className="btn light"
                                      onClick={onOpenCalls}
                                    >
                                      Open
                                    </button>
                                    <button
                                      type="button"
                                      className="btn danger"
                                      disabled={busyCallId === matchingCall.id}
                                      onClick={() => onEndCall(matchingCall.id)}
                                    >
                                      {busyCallId === matchingCall.id ? "Ending…" : "End call"}
                                    </button>
                                  </div>
                                );
                              })()}
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
        ) : null}

        {leadFlowStep === 4 ? (
          <article className="rf-agent-card rf-agent-queue-card rf-lead-flow-launch-card">
            <div className="rf-agent-card-heading compact">
              <div>
                <span>Controlled queue</span>
                <h2>Start approved outbound calls</h2>
              </div>
              <b className="rf-agent-count">{queuedCount} queued</b>
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

            <div className="rf-lead-launch-note">
              <b>What happens next</b>
              <p>
                Start calling uses the same policy, suppression, timezone, concurrency and daily-limit controls already configured for this Voice Agent. When the batch starts, ReachFly opens Live calls so the team can monitor active conversations.
              </p>
            </div>
          </article>
        ) : null}
      </div>

      <footer className="rf-lead-flow-footer">
        <button
          type="button"
          className="btn light"
          disabled={leadFlowStep === 0}
          onClick={() => moveLeadFlow(leadFlowStep - 1)}
        >
          ← Previous
        </button>

        <div>
          <span>{String(leadFlowStep + 1).padStart(2, "0")}</span>
          <div>
            <b>{activeLeadStep.label}</b>
            <small>
              {leadFlowStep < leadFlowSteps.length - 1
                ? `Next: ${leadFlowSteps[leadFlowStep + 1].label}`
                : "Start the controlled batch or open Live calls."}
            </small>
          </div>
        </div>

        {leadFlowStep < leadFlowSteps.length - 1 ? (
          <button
            type="button"
            className="btn primary"
            onClick={() => moveLeadFlow(leadFlowStep + 1)}
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            className="btn light"
            onClick={onOpenCalls}
          >
            Open Live calls →
          </button>
        )}
      </footer>
    </section>
  );
}

function CallsPanel({
  calls,
  view = "active-calls",
  busyCallId,
  onCancel,
  onRefresh,
}) {
  const [monitorCallId, setMonitorCallId] = useState("");
  const [monitorCapabilities, setMonitorCapabilities] = useState(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [audioStatus, setAudioStatus] = useState("idle");
  const [audioError, setAudioError] = useState("");
  const [monitorNotice, setMonitorNotice] = useState("");
  const [syncingConversation, setSyncingConversation] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingError, setRecordingError] = useState("");

  const audioContextRef = useRef(null);
  const listeningRef = useRef(false);
  const recordingUrlRef = useRef("");
  const nextAudioAtRef = useRef({
    inbound: 0,
    outbound: 0,
  });

  const callView =
    view === "call-history"
      ? "call-history"
      : "active-calls";

  const visibleCalls = useMemo(
    () =>
      calls.filter((call) => {
        const isLive = LIVE_CALL_STATES.has(
          normalizeStatus(call.status)
        );

        return callView === "active-calls"
          ? isLive
          : !isLive;
      }),
    [calls, callView]
  );

  const monitorCall = useMemo(
    () =>
      calls.find(
        (call) => call.id === monitorCallId
      ) || null,
    [calls, monitorCallId]
  );

  const live = Boolean(
    monitorCall &&
      LIVE_CALL_STATES.has(
        normalizeStatus(monitorCall.status)
      )
  );

  const transcript = useMemo(() => {
    const realtime = Array.isArray(
      monitorCall?.liveTranscript
    )
      ? [...monitorCall.liveTranscript]
      : [];

    if (monitorCall?.liveTranscriptInterim) {
      realtime.push(
        monitorCall.liveTranscriptInterim
      );
    }

    return normalizeLiveTranscript(
      realtime.length
        ? realtime
        : monitorCall?.messageHistory ||
            monitorCall?.conversation ||
            monitorCall?.transcript ||
            []
    );
  }, [
    monitorCall?.liveTranscript,
    monitorCall?.liveTranscriptInterim,
    monitorCall?.messageHistory,
    monitorCall?.conversation,
    monitorCall?.transcript,
  ]);

  const liveAudioAvailable =
    monitorCapabilities?.liveAudio?.available === true;

  const liveTranscriptAvailable =
    monitorCapabilities?.liveTranscript?.available === true ||
    ["starting", "requested", "streaming"].includes(
      normalizeStatus(
        monitorCall?.transcriptionStatus
      )
    );

  const postCallRecordingAvailable =
    monitorCapabilities?.postCallRecording?.available === true;

  function releaseRecordingUrl() {
    const currentUrl =
      recordingUrlRef.current;

    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      recordingUrlRef.current = "";
    }

    setRecordingUrl("");
  }

  async function loadMonitoringCapabilities(
    callId,
    {
      quiet = false,
    } = {}
  ) {
    if (!callId) {
      setMonitorCapabilities(null);
      return null;
    }

    if (!quiet) {
      setCapabilitiesLoading(true);
    }

    try {
      const result =
        await apiRequest(
          `/telnyx/ai-agent/calls/${encodeURIComponent(
            callId
          )}/monitoring`,
          {
            timeoutMs: 20_000,
          }
        );

      if (callId === monitorCallId) {
        setMonitorCapabilities(
          result || null
        );
      }

      return result;
    } catch (error) {
      if (callId === monitorCallId) {
        setMonitorCapabilities(null);

        if (!quiet) {
          setAudioError(
            safeVoiceRuntimeMessage(
              error?.message ||
                "ReachFly could not check monitoring availability."
            )
          );
        }
      }

      return null;
    } finally {
      if (
        !quiet &&
        callId === monitorCallId
      ) {
        setCapabilitiesLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!monitorCallId) {
      setMonitorCapabilities(null);
      setCapabilitiesLoading(false);
      return;
    }

    void loadMonitoringCapabilities(
      monitorCallId
    );
    // Refresh when the provider attaches the identifiers that determine whether
    // live audio, live transcript or a post-call recording are available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    monitorCallId,
    monitorCall?.callControlId,
    monitorCall?.conversationId,
    monitorCall?.hasAudio,
    monitorCall?.status,
  ]);

  useEffect(() => {
    const unsubscribeMedia =
      onWorkspaceSocket(
        "telnyx-ai-agent:media",
        (packet) => {
          if (
            !listeningRef.current ||
            !monitorCallId ||
            packet?.callId !==
              monitorCallId
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
            event?.callId !==
              monitorCallId
          ) {
            return;
          }

          const nextStatus =
            String(
              event.status ||
                "waiting"
            );

          setAudioStatus(
            nextStatus
          );

          if (
            [
              "ended",
              "stopped",
              "completed",
              "failed",
              "disconnected",
            ].includes(
              normalizeStatus(
                nextStatus
              )
            )
          ) {
            listeningRef.current =
              false;
            setListening(false);
          }
        }
      );

    return () => {
      unsubscribeMedia?.();
      unsubscribeStatus?.();
    };
  }, [monitorCallId]);

  useEffect(() => {
    if (
      monitorCall &&
      !live &&
      listeningRef.current
    ) {
      void stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    live,
    monitorCall?.id,
  ]);

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

      if (recordingUrlRef.current) {
        URL.revokeObjectURL(
          recordingUrlRef.current
        );
        recordingUrlRef.current =
          "";
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
      releaseRecordingUrl();
    }

    setMonitorCallId(call.id);
    setMonitorCapabilities(null);
    setCapabilitiesLoading(true);
    setMonitorNotice("");
    setAudioError("");
    setRecordingError("");

    setAudioStatus(
      call.mediaStreamStatus ||
        (LIVE_CALL_STATES.has(
          normalizeStatus(
            call.status
          )
        )
          ? "waiting"
          : "ended")
    );
  }

  async function closeMonitor() {
    await stopListening();
    releaseRecordingUrl();
    setMonitorCapabilities(null);
    setMonitorNotice("");
    setRecordingError("");
    setAudioError("");
    setMonitorCallId("");
  }

  async function startListening() {
    if (!monitorCall?.id) {
      return;
    }

    if (!live) {
      setAudioError(
        "This call has already ended. Live listening is available only while the call is active."
      );
      return;
    }

    let capabilities =
      monitorCapabilities;

    if (!capabilities) {
      capabilities =
        await loadMonitoringCapabilities(
          monitorCall.id
        );
    }

    if (
      !capabilities?.liveAudio
        ?.available
    ) {
      setAudioError(
        safeVoiceRuntimeMessage(
          capabilities?.liveAudio
            ?.note ||
            "This call path does not currently expose a listen-only live audio stream."
        )
      );
      return;
    }

    setAudioError("");
    setMonitorNotice("");

    try {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error(
          "This browser does not support live audio playback."
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
       * first media packets are not discarded when media is already flowing.
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
          monitorCall
            .mediaStreamStatus ||
          "waiting"
      );
      setMonitorNotice(
        "Listen-only monitoring is active. Your microphone is not connected to the call."
      );
    } catch (error) {
      listeningRef.current = false;
      setListening(false);
      setAudioStatus("failed");
      setAudioError(
        safeVoiceRuntimeMessage(
          error?.message ||
            "ReachFly could not start the live audio monitor."
        )
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
        // The socket may already be disconnected. Local audio still stops.
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

    if (monitorNotice) {
      setMonitorNotice("");
    }
  }

  async function syncConversation() {
    if (!monitorCall?.id) {
      return;
    }

    setSyncingConversation(true);
    setRecordingError("");
    setAudioError("");
    setMonitorNotice("");

    try {
      await apiRequest(
        `/telnyx/ai-agent/calls/${encodeURIComponent(
          monitorCall.id
        )}/sync`,
        {
          method: "POST",
          timeoutMs: 45_000,
        }
      );

      await onRefresh?.();
      await loadMonitoringCapabilities(
        monitorCall.id,
        {
          quiet: true,
        }
      );

      setMonitorNotice(
        "Conversation details were refreshed."
      );
    } catch (error) {
      setRecordingError(
        safeVoiceRuntimeMessage(
          error?.message ||
            "ReachFly could not refresh the completed conversation."
        )
      );
    } finally {
      setSyncingConversation(false);
    }
  }

  async function loadRecording() {
    if (!monitorCall?.id) {
      return;
    }

    if (
      !postCallRecordingAvailable
    ) {
      setRecordingError(
        "A post-call recording is not available for this conversation yet."
      );
      return;
    }

    setRecordingLoading(true);
    setRecordingError("");

    try {
      const blob =
        await apiRequest(
          `/telnyx/ai-agent/calls/${encodeURIComponent(
            monitorCall.id
          )}/audio`,
          {
            responseType: "blob",
            timeoutMs: 60_000,
          }
        );

      if (
        !blob ||
        typeof blob.size !==
          "number" ||
        blob.size <= 0
      ) {
        throw new Error(
          "The recording response was empty."
        );
      }

      releaseRecordingUrl();

      const url =
        URL.createObjectURL(blob);

      recordingUrlRef.current =
        url;
      setRecordingUrl(url);
    } catch (error) {
      setRecordingError(
        safeVoiceRuntimeMessage(
          error?.message ||
            "ReachFly could not load the call recording."
        )
      );
    } finally {
      setRecordingLoading(false);
    }
  }

  const liveAudioNote =
    safeVoiceRuntimeMessage(
      monitorCapabilities?.liveAudio
        ?.note || ""
    );

  const transcriptNote =
    live
      ? liveTranscriptAvailable
        ? "Live transcript monitoring is available for this call."
        : "The conversation is live. If real-time transcript monitoring is not enabled for this runtime, the completed transcript will appear after post-call processing."
      : transcript.length
        ? "Completed conversation transcript."
        : monitorCall?.conversationId
          ? "The call has ended. Refresh the conversation if the transcript has not arrived yet."
          : "No transcript is available yet.";

  return (
    <section className="rf-agent-call-monitor-layout">
      {monitorCall ? (
        <article className="rf-agent-card rf-agent-live-monitor">
          <div className="rf-agent-card-heading compact">
            <div>
              <span>
                {live
                  ? "Live conversation"
                  : "Conversation review"}
              </span>
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
            {live ? (
              <button
                type="button"
                className={
                  listening
                    ? "btn danger"
                    : "btn primary"
                }
                disabled={
                  capabilitiesLoading ||
                  (!listening &&
                    !liveAudioAvailable)
                }
                onClick={() =>
                  void (
                    listening
                      ? stopListening()
                      : startListening()
                  )
                }
                title={
                  !liveAudioAvailable
                    ? liveAudioNote ||
                      "Live audio is not available for this call."
                    : "Listen to both sides of the active call without joining it."
                }
              >
                {listening
                  ? "Stop listening"
                  : capabilitiesLoading
                    ? "Checking live audio…"
                    : liveAudioAvailable
                      ? "🔊 Listen live"
                      : "Live audio unavailable"}
              </button>
            ) : null}

            {!live &&
            monitorCall.conversationId ? (
              <button
                type="button"
                className="btn light"
                disabled={
                  syncingConversation
                }
                onClick={() =>
                  void syncConversation()
                }
              >
                {syncingConversation
                  ? "Refreshing…"
                  : "Refresh transcript"}
              </button>
            ) : null}

            {!live &&
            postCallRecordingAvailable ? (
              <button
                type="button"
                className="btn primary"
                disabled={recordingLoading}
                onClick={() =>
                  void loadRecording()
                }
              >
                {recordingLoading
                  ? "Loading recording…"
                  : recordingUrl
                    ? "Reload recording"
                    : "▶ Play recording"}
              </button>
            ) : null}

            {live ? (
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
                void closeMonitor()
              }
            >
              Close
            </button>
          </div>

          {monitorNotice ? (
            <div className="rf-agent-alert success">
              <span>
                {monitorNotice}
              </span>
            </div>
          ) : null}

          {audioError ? (
            <div className="rf-agent-monitor-warning">
              <b>Live listening</b>
              <span>{audioError}</span>
            </div>
          ) : null}

          {!capabilitiesLoading &&
          live &&
          !liveAudioAvailable &&
          liveAudioNote ? (
            <div className="rf-agent-monitor-warning">
              <b>Live audio unavailable</b>
              <span>
                {liveAudioNote}
              </span>
            </div>
          ) : null}

          {recordingError ? (
            <div className="rf-agent-monitor-warning">
              <b>Conversation media</b>
              <span>
                {recordingError}
              </span>
            </div>
          ) : null}

          {recordingUrl ? (
            <div className="rf-agent-live-transcript">
              <div className="rf-agent-live-transcript-heading">
                <div>
                  <b>Call recording</b>
                  <small>
                    Authorized post-call playback for this workspace.
                  </small>
                </div>
              </div>
              <audio
                controls
                preload="metadata"
                src={recordingUrl}
                style={{
                  width: "100%",
                }}
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : null}

          <div className="rf-agent-monitor-status-grid">
            <MonitorStatus
              label="Phone"
              value={
                monitorCall.answeredAt ||
                monitorCall.conversationId
                  ? "Connected"
                  : formatLabel(
                      normalizeStatus(
                        monitorCall.status
                      )
                    )
              }
              good={
                Boolean(
                  monitorCall.answeredAt ||
                    monitorCall.conversationId
                )
              }
            />

            <MonitorStatus
              label="Voice agent"
              value={
                monitorCall.error
                  ? "Needs attention"
                  : monitorCall.assistantStartedAt ||
                      monitorCall.conversationId
                    ? "Connected"
                    : live
                      ? "Starting"
                      : "Completed"
              }
              good={
                !monitorCall.error &&
                Boolean(
                  monitorCall.assistantStartedAt ||
                    monitorCall.conversationId ||
                    !live
                )
              }
            />

            <MonitorStatus
              label="Listen"
              value={
                listening
                  ? formatLabel(
                      audioStatus ||
                        "connected"
                    )
                  : liveAudioAvailable
                    ? "Available"
                    : live
                      ? capabilitiesLoading
                        ? "Checking"
                        : "Unavailable"
                      : "Ended"
              }
              good={
                listening ||
                liveAudioAvailable
              }
            />

            <MonitorStatus
              label="Transcript"
              value={
                transcript.length
                  ? `${transcript.length} messages`
                  : liveTranscriptAvailable
                    ? "Live available"
                    : monitorCall.conversationId
                      ? live
                        ? "Post-call"
                        : "Processing"
                      : "Unavailable"
              }
              good={
                transcript.length > 0 ||
                liveTranscriptAvailable
              }
            />
          </div>

          {monitorCall.error ? (
            <div className="rf-agent-monitor-warning">
              <b>Call error</b>
              <span>
                {safeVoiceRuntimeMessage(
                  monitorCall.error
                )}
              </span>
            </div>
          ) : null}

          {monitorCall.contextInjectionWarning ? (
            <div className="rf-agent-monitor-warning">
              <b>Lead context warning</b>
              <span>
                {safeVoiceRuntimeMessage(
                  monitorCall.contextInjectionWarning
                )}
              </span>
            </div>
          ) : null}

          {monitorCall.mediaStreamError ? (
            <div className="rf-agent-monitor-warning">
              <b>Live-audio warning</b>
              <span>
                {safeVoiceRuntimeMessage(
                  monitorCall.mediaStreamError
                )}
              </span>
            </div>
          ) : null}

          {monitorCall.transcriptionError ? (
            <div className="rf-agent-monitor-warning">
              <b>Transcript warning</b>
              <span>
                {safeVoiceRuntimeMessage(
                  monitorCall.transcriptionError
                )}
              </span>
            </div>
          ) : null}

          <div className="rf-agent-live-transcript">
            <div className="rf-agent-live-transcript-heading">
              <div>
                <b>
                  {live
                    ? "Conversation transcript"
                    : "Transcript"}
                </b>
                <small>
                  {transcriptNote}
                </small>
              </div>
              <span
                className={`rf-agent-live-dot ${
                  live
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
                          : message.role ===
                              "user"
                            ? "Lead"
                            : "Call"}
                      </span>
                      <p>
                        {message.text}
                      </p>
                    </div>
                  )
                )
              ) : (
                <div className="rf-agent-transcript-empty">
                  {transcriptNote}
                </div>
              )}
            </div>
          </div>

          <small className="rf-agent-monitor-privacy-note">
            Live monitoring is listen-only. ReachFly does not request or send your browser microphone into the AI-to-lead call. Use monitoring and recordings only where your notice, consent and supervision policies permit it.
          </small>
        </article>
      ) : null}

      <article className="rf-agent-card">
        <div className="rf-agent-card-heading compact">
          <div>
            <span>
              {callView === "active-calls"
                ? "Live call monitoring"
                : "Conversation history"}
            </span>
            <h2>
              {callView === "active-calls"
                ? "Active AI-agent calls"
                : "Completed and previous calls"}
            </h2>
          </div>
          <b className="rf-agent-count">
            {visibleCalls.length} records
          </b>
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
                <th>Conversation</th>
                <th>Details</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {visibleCalls.length ? (
                visibleCalls.map((call) => {
                  const callIsLive =
                    LIVE_CALL_STATES.has(
                      normalizeStatus(
                        call.status
                      )
                    );

                  return (
                    <tr key={call.id}>
                      <td>
                        <b>
                          {call.leadName ||
                            "Unknown lead"}
                        </b>
                        <small>
                          {formatPhone(
                            call.toNumber
                          )}
                        </small>
                      </td>

                      <td>
                        <StatusBadge
                          value={call.status}
                        />
                      </td>

                      <td>
                        {call.outcome ? (
                          <StatusBadge
                            value={
                              call.outcome
                            }
                          />
                        ) : (
                          <span className="rf-agent-muted">
                            Pending
                          </span>
                        )}
                      </td>

                      <td>
                        {formatDateTime(
                          call.createdAt
                        )}
                      </td>

                      <td>
                        {formatDuration(
                          call.durationSeconds
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className={
                            callIsLive
                              ? "btn primary small"
                              : "btn light small"
                          }
                          onClick={() =>
                            void openMonitor(
                              call
                            )
                          }
                        >
                          {callIsLive
                            ? "Open live"
                            : "Review"}
                        </button>
                      </td>

                      <td>
                        <details className="rf-agent-call-details">
                          <summary>
                            View
                          </summary>
                          <dl>
                            <div>
                              <dt>
                                Call reference
                              </dt>
                              <dd>
                                {shorten(
                                  call.id,
                                  20
                                ) || "—"}
                              </dd>
                            </div>

                            <div>
                              <dt>
                                Conversation
                              </dt>
                              <dd>
                                {call.conversationId
                                  ? "Linked"
                                  : "Waiting"}
                              </dd>
                            </div>

                            <div>
                              <dt>
                                Voice agent
                              </dt>
                              <dd>
                                {call.assistantStartedAt ||
                                call.conversationId
                                  ? "Connected"
                                  : call.error
                                    ? "Needs attention"
                                    : "Pending"}
                              </dd>
                            </div>

                            <div>
                              <dt>
                                Recording
                              </dt>
                              <dd>
                                {call.hasAudio ===
                                true
                                  ? "Available"
                                  : call.hasAudio ===
                                      false
                                    ? "Unavailable"
                                    : "Processing"}
                              </dd>
                            </div>

                            <div>
                              <dt>
                                Notes
                              </dt>
                              <dd>
                                {safeVoiceRuntimeMessage(
                                  call.notes ||
                                    call.error ||
                                    "—"
                                )}
                              </dd>
                            </div>

                            <div>
                              <dt>
                                End reason
                              </dt>
                              <dd>
                                {safeVoiceRuntimeMessage(
                                  call.hangupCause ||
                                    call.elevenLabsTerminationReason ||
                                    "—"
                                )}
                              </dd>
                            </div>
                          </dl>
                        </details>
                      </td>

                      <td>
                        {callIsLive ? (
                          <button
                            type="button"
                            className="btn danger small"
                            disabled={
                              busyCallId ===
                              call.id
                            }
                            onClick={() =>
                              onCancel(
                                call.id
                              )
                            }
                          >
                            {busyCallId ===
                            call.id
                              ? "Ending…"
                              : "End"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title={
                        callView === "active-calls"
                          ? "No active AI-agent calls"
                          : "No completed calls yet"
                      }
                      text={
                        callView === "active-calls"
                          ? "Calls that are ringing, answered or in an active AI conversation appear here in real time."
                          : "Completed, cancelled and failed conversations appear here with transcripts and recordings when available."
                      }
                    />
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

function safeVoiceRuntimeMessage(value) {
  return String(value || "")
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
      /Call Control ID/gi,
      "live-media control"
    )
    .replace(
      /\bSIP\b/gi,
      "voice connection"
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

      const normalizedRole = [
        "assistant",
        "user",
      ].includes(role)
        ? role
        : "unknown";

      const text =
        conversationMessageText(
          message?.content ??
            message?.text
        );

      if (!text) {
        return null;
      }

      return {
        role: normalizedRole,
        text,
        isFinal: message?.isFinal !== false,
        occurredAt:
          message?.occurredAt ||
          message?.createdAt ||
          "",
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

function MeetingsPanel({
  meetings,
  view = "upcoming",
}) {
  const meetingView =
    view === "meeting-history"
      ? "meeting-history"
      : "upcoming";
  const now = Date.now();
  const visibleMeetings = meetings.filter(
    (meeting) => {
      const startAt = Date.parse(
        meeting.startAt || ""
      );
      const isPast =
        Number.isFinite(startAt) &&
        startAt < now;

      return meetingView === "meeting-history"
        ? isPast
        : !isPast;
    }
  );

  return (
    <section className="rf-agent-meeting-grid">
      {visibleMeetings.length ? (
        visibleMeetings.map((meeting) => (
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
            title={
              meetingView === "meeting-history"
                ? "No previous meetings yet"
                : "No upcoming meetings booked"
            }
            text={
              meetingView === "meeting-history"
                ? "Past confirmed appointments created by the voice agent will appear here."
                : "New confirmed appointments created by the voice agent will appear here in real time."
            }
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

function buildVoiceOnboardingState({
  form = {},
  agent = null,
  diagnostics = {},
  voiceCommerce = null,
  billingData = null,
  workspaceName = "",
} = {}) {
  const identityDone = Boolean(
    String(form.name || "").trim() &&
      String(form.voice || "").trim() &&
      String(form.companyName || workspaceName || "").trim()
  );

  const websiteEntered = Boolean(
    String(form.websiteUrl || "").trim()
  );

  const contextDone = Boolean(
    form.websiteIntelligence?.analyzedAt
  );

  const purchasedNumberRequired =
    diagnostics?.purchasedNumberRequired !== false;
  const paidCreditsRequired =
    diagnostics?.paidCreditsRequired !== false;

  const numberDone =
    !purchasedNumberRequired ||
    Boolean(
      voiceCommerce?.activeNumber?.phoneNumber &&
        normalizeStatus(voiceCommerce.activeNumber.status) === "active"
    );

  const creditsDone =
    !paidCreditsRequired ||
    Number(billingData?.aiCalling?.wallet?.balance || 0) > 0;

  const complianceDone =
    form.complianceConfirmed === true;

  const runtimeDone = Boolean(
    diagnostics.configured &&
      agent?.elevenLabsAgentId &&
      agent?.elevenLabsPhoneNumberId
  );

  const steps = [
    {
      key: "identity",
      title: "Identity & voice",
      required: true,
      done: identityDone,
      text: identityDone
        ? "Agent identity and customer-facing voice selected."
        : "Add the agent/company identity and choose the voice.",
    },
    {
      key: "context",
      title: "Business context",
      required: websiteEntered,
      done: websiteEntered ? contextDone : false,
      text: contextDone
        ? "Website intelligence is ready for calls."
        : websiteEntered
          ? "Analyze the website before saving the agent."
          : "Add and analyze a website when you want the agent grounded in public business context.",
    },
    {
      key: "number",
      title: "Business number",
      required: purchasedNumberRequired,
      done: numberDone,
      text: !purchasedNumberRequired
        ? "This workspace uses the preconfigured ReachFly calling number."
        : numberDone
          ? "A paid ReachFly business number is active for this workspace."
          : "Buy and activate a business number before saving the Voice Agent.",
    },
    {
      key: "credits",
      title: "AI call credits",
      required: paidCreditsRequired,
      done: creditsDone,
      text: !paidCreditsRequired
        ? "Dedicated paid AI call credits are not required for this workspace."
        : creditsDone
          ? `${formatCreditsCompact(billingData?.aiCalling?.wallet?.balance)} dedicated call credits are available.`
          : "Buy dedicated AI call credits before Voice Agent activation.",
    },
    {
      key: "policy",
      title: "Calling policy",
      required: true,
      done: complianceDone,
      text: complianceDone
        ? "Calling, suppression, caller-ID and recording policy approved."
        : "Review and approve the campaign calling and suppression policy.",
    },
    {
      key: "runtime",
      title: "Save & activate",
      required: true,
      done: runtimeDone,
      text: runtimeDone
        ? "Voice runtime and business phone linkage are ready."
        : "Save the agent so ReachFly can synchronize the voice runtime and phone linkage.",
    },
  ];

  const requiredSteps = steps.filter(
    (step) => step.required
  );

  return {
    steps,
    total: steps.length,
    completed: steps.filter(
      (step) => step.done
    ).length,
    ready:
      requiredSteps.length > 0 &&
      requiredSteps.every(
        (step) => step.done
      ),
  };
}

function buildVoiceOverview({
  calls,
  meetings,
  dashboard,
  diagnostics,
  billingData,
  voiceCommerce,
  form,
  agent,
}) {
  const safeCalls = Array.isArray(calls) ? calls : [];
  const connectedCalls = safeCalls.filter(isConnectedVoiceCall);
  const durations = safeCalls
    .map((call) =>
      safeNumber(
        call.durationSeconds ??
          call.duration ??
          call.connectedSeconds ??
          call.billableSeconds,
        0
      )
    )
    .filter((value) => value > 0);

  const averageSeconds = durations.length
    ? Math.round(
        durations.reduce((total, value) => total + value, 0) /
          durations.length
      )
    : 0;

  const activeNumber = voiceCommerce?.activeNumber || null;
  const businessNumber =
    activeNumber?.phoneNumber ||
    agent?.fromNumber ||
    form?.fromNumber ||
    diagnostics?.selectedFromNumber ||
    "";
  const numberReady =
    diagnostics?.purchasedNumberRequired === false
      ? Boolean(businessNumber)
      : normalizeStatus(activeNumber?.status) === "active" &&
        Boolean(activeNumber?.phoneNumber);

  const credits = Number(
    billingData?.aiCalling?.wallet?.balance || 0
  );
  const creditsRequired = diagnostics?.paidCreditsRequired !== false;

  return {
    totalCalls: safeCalls.length,
    connectedCalls: connectedCalls.length,
    connectedRate: safeCalls.length
      ? Math.round((connectedCalls.length / safeCalls.length) * 100)
      : null,
    readyLeads: Number(dashboard?.summary?.assignableLeads || 0),
    queuedLeads: Number(dashboard?.summary?.queuedLeads || 0),
    liveCalls: Number(dashboard?.summary?.activeCalls || 0),
    meetingsBooked: Array.isArray(meetings) ? meetings.length : 0,
    averageDuration: averageSeconds ? formatDuration(averageSeconds) : "—",
    callCredits: creditsRequired ? formatCreditsCompact(credits) : "Ready",
    creditsReady: creditsRequired ? credits > 0 : true,
    creditsRequired,
    businessNumber,
    numberReady,
  };
}

function isConnectedVoiceCall(call) {
  if (!call || typeof call !== "object") return false;
  if (call.answeredAt || call.connectedAt || call.startedAt && call.endedAt) {
    return true;
  }

  return [
    "answered",
    "assistant_active",
    "active",
    "connected",
    "completed",
    "ended",
    "hangup",
    "meeting_booked",
  ].includes(normalizeStatus(call.status));
}

function formatCallingModeLabel(value) {
  const mode = normalizeStatus(value || "outbound");
  if (mode === "both") return "Inbound + Outbound";
  if (mode === "inbound") return "Inbound";
  return "Outbound";
}

function notifyVoice(type, title, message) {
  if (typeof window === "undefined" || !message) return;

  const bridge = window.reachflyToast;
  if (bridge && typeof bridge[type] === "function") {
    bridge[type](title, message);
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

function VoiceWorkspaceV7Styles() {
  return (
    <style>{`
      .rf-agent-page.rf-agent-v7{
        --rfv7-surface:#f8f9fa;
        --rfv7-card:#ffffff;
        --rfv7-soft:#f3f4f5;
        --rfv7-high:#e7e8e9;
        --rfv7-text:#191c1d;
        --rfv7-text-soft:#464554;
        --rfv7-muted:#767586;
        --rfv7-outline:#e3e5e7;
        --rfv7-outline-strong:#c7c4d7;
        --rfv7-primary:#4648d4;
        --rfv7-primary-dark:#3537bb;
        --rfv7-primary-soft:#e8e9ff;
        --rfv7-violet:#6b38d4;
        --rfv7-violet-soft:#f0eaff;
        --rfv7-success:#087a51;
        --rfv7-success-soft:#dcfce7;
        --rfv7-warning:#8a6100;
        --rfv7-warning-soft:#fff4d6;
        --rfv7-danger:#ba1a1a;
        --rfv7-danger-soft:#ffedeb;
        --rfv7-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:26px 32px 48px;
        color:var(--rfv7-text);
        background:transparent;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfv7PageIn 260ms var(--rfv7-ease);
      }

      .rf-agent-v7 *,
      .rf-agent-v7 *::before,
      .rf-agent-v7 *::after{
        box-sizing:border-box;
      }

      .rf-agent-v7 .spin{
        animation:rfv7Spin 800ms linear infinite;
      }

      @keyframes rfv7PageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfv7FadeUp{
        from{opacity:0;transform:translate3d(0,7px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfv7ScaleIn{
        from{opacity:0;transform:scale(.986)}
        to{opacity:1;transform:scale(1)}
      }

      @keyframes rfv7Spin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfv7Shimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rf-agent-header-v7{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:24px;
        padding:0;
        margin:0 0 22px;
        background:transparent;
        border:0;
      }

      .rf-agent-identity-v7{
        min-width:0;
        display:flex;
        align-items:center;
        gap:15px;
      }

      .rf-agent-avatar-v7{
        position:relative;
        width:66px;
        height:66px;
        display:grid;
        place-items:center;
        flex:0 0 66px;
        color:#fff;
        background:linear-gradient(145deg,#6668e8,#4648d4);
        border-radius:50%;
        box-shadow:0 8px 22px rgba(70,72,212,.22);
        font:700 24px/1 Geist,Inter,sans-serif;
      }

      .rf-agent-avatar-v7::after{
        content:"";
        position:absolute;
        right:3px;
        bottom:3px;
        width:12px;
        height:12px;
        background:#a8acb1;
        border:3px solid var(--rfv7-surface);
        border-radius:50%;
      }

      .rf-agent-avatar-v7.ready::after{
        background:#13a36f;
      }

      .rf-agent-identity-v7 > div{
        min-width:0;
      }

      .rf-agent-kicker-v7{
        display:block;
        margin-bottom:3px;
        color:var(--rfv7-primary);
        font-size:8px;
        font-weight:800;
        line-height:12px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rf-agent-title-line-v7{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:8px;
      }

      .rf-agent-title-line-v7 h1{
        margin:0;
        color:var(--rfv7-text);
        font:600 31px/39px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-agent-identity-v7 > div > p{
        margin:3px 0 0;
        color:var(--rfv7-text-soft);
        font-size:11px;
        line-height:17px;
      }

      .rf-agent-live-pill{
        min-height:24px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:4px 8px;
        border-radius:999px;
        font-size:8px;
        font-weight:700;
      }

      .rf-agent-live-pill > i{
        width:7px;
        height:7px;
        display:block;
        border-radius:50%;
      }

      .rf-agent-live-pill.ready{
        color:var(--rfv7-success);
        background:var(--rfv7-success-soft);
      }

      .rf-agent-live-pill.ready > i{
        background:#13a36f;
      }

      .rf-agent-live-pill.warning{
        color:var(--rfv7-warning);
        background:var(--rfv7-warning-soft);
      }

      .rf-agent-live-pill.warning > i{
        background:#d39b28;
      }

      .rf-agent-mode-pill-v7{
        min-height:24px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:4px 8px;
        color:#555965;
        background:#eceeef;
        border-radius:999px;
        font-size:8px;
        font-weight:650;
      }

      .rf-agent-header-actions-v7{
        display:flex;
        align-items:center;
        gap:8px;
        flex:0 0 auto;
      }

      .rf-agent-action-v7,
      .rf-agent-icon-action-v7{
        appearance:none;
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:7px 13px;
        border:1px solid transparent;
        border-radius:999px;
        cursor:pointer;
        font:600 9px/14px Inter,sans-serif;
        transition:transform 140ms var(--rfv7-ease),background 140ms var(--rfv7-ease),border-color 140ms var(--rfv7-ease),color 140ms var(--rfv7-ease),box-shadow 140ms var(--rfv7-ease);
      }

      .rf-agent-action-v7:hover:not(:disabled),
      .rf-agent-icon-action-v7:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-agent-action-v7.secondary{
        color:var(--rfv7-text);
        background:#fff;
        border-color:var(--rfv7-outline);
      }

      .rf-agent-action-v7.secondary:hover{
        color:var(--rfv7-primary);
        background:var(--rfv7-primary-soft);
      }

      .rf-agent-action-v7.primary{
        color:#fff;
        background:var(--rfv7-primary);
        border-color:var(--rfv7-primary);
        box-shadow:0 5px 14px rgba(70,72,212,.16);
      }

      .rf-agent-action-v7.primary:hover{
        background:var(--rfv7-primary-dark);
      }

      .rf-agent-icon-action-v7{
        width:39px;
        padding:0;
        color:var(--rfv7-text-soft);
        background:#fff;
        border-color:var(--rfv7-outline);
      }

      .rf-agent-alert{
        min-height:42px;
        display:flex;
        align-items:flex-start;
        gap:10px;
        padding:10px 12px;
        margin:0 0 12px;
        border:1px solid;
        border-radius:9px;
        animation:rfv7FadeUp 170ms var(--rfv7-ease);
      }

      .rf-agent-alert > span{
        flex:1;
        font-size:9px;
        line-height:14px;
      }

      .rf-agent-alert > button{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        padding:0;
        color:inherit;
        background:rgba(255,255,255,.6);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:15px;
      }

      .rf-agent-alert.error{
        color:#7d1717;
        background:var(--rfv7-danger-soft);
        border-color:#ffd0cc;
      }

      .rf-agent-alert.success{
        color:#075b3d;
        background:var(--rfv7-success-soft);
        border-color:#b8efd6;
      }

      .rf-voice-overview-grid-v7{
        display:grid;
        grid-template-columns:minmax(0,1fr) 310px;
        gap:16px;
        margin-bottom:16px;
        align-items:start;
      }

      .rf-voice-overview-main-v7{
        min-width:0;
        display:grid;
        gap:14px;
      }

      .rf-agent-metrics-v7{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
        margin:0;
      }

      .rf-voice-overview-metric-v7{
        min-width:0;
        min-height:125px;
        display:flex;
        flex-direction:column;
        gap:7px;
        justify-content:space-between;
        padding:17px 18px 15px;
        background:#fff;
        border:1px solid var(--rfv7-outline);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
        animation:rfv7ScaleIn 230ms var(--rfv7-ease) both;
      }

      .rf-voice-overview-metric-top-v7{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }

      .rf-voice-overview-metric-top-v7 > span{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        color:var(--rfv7-primary);
        background:var(--rfv7-primary-soft);
        border-radius:8px;
      }

      .rf-voice-overview-metric-v7.violet .rf-voice-overview-metric-top-v7 > span{
        color:var(--rfv7-violet);
        background:var(--rfv7-violet-soft);
      }

      .rf-voice-overview-metric-v7.success .rf-voice-overview-metric-top-v7 > span{
        color:var(--rfv7-success);
        background:var(--rfv7-success-soft);
      }

      .rf-voice-overview-metric-v7.neutral .rf-voice-overview-metric-top-v7 > span{
        color:#5e6470;
        background:#eef1f5;
      }

      .rf-voice-overview-metric-top-v7 > small{
        min-width:0;
        overflow:hidden;
        color:var(--rfv7-text-soft);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
        font-weight:750;
        line-height:11px;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-voice-overview-metric-v7 > strong{
        overflow:hidden;
        color:var(--rfv7-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 25px/31px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rf-voice-overview-metric-v7 > em{
        overflow:hidden;
        color:var(--rfv7-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
        font-style:normal;
        line-height:11px;
      }

      .rf-voice-performance-v7{
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfv7-outline);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rf-voice-performance-head-v7{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding:16px 18px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfv7-outline);
      }

      .rf-voice-performance-head-v7 h2,
      .rf-voice-health-head-v7 h2{
        margin:0;
        color:var(--rfv7-text);
        font:600 14px/19px Geist,Inter,sans-serif;
      }

      .rf-voice-performance-head-v7 p{
        margin:3px 0 0;
        color:var(--rfv7-muted);
        font-size:8px;
        line-height:13px;
      }

      .rf-voice-performance-status-v7{
        min-height:27px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        flex:0 0 auto;
        padding:5px 8px;
        color:var(--rfv7-text-soft);
        background:var(--rfv7-soft);
        border-radius:999px;
        font-size:7px;
        font-weight:700;
      }

      .rf-voice-performance-status-v7 > i{
        width:7px;
        height:7px;
        display:block;
        background:#a5a7ab;
        border-radius:50%;
      }

      .rf-voice-performance-status-v7 > i.ready{
        background:#13a36f;
      }

      .rf-voice-performance-grid-v7{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        padding:14px 15px;
      }

      .rf-voice-performance-item-v7{
        min-width:0;
        display:flex;
        align-items:center;
        gap:8px;
        padding:10px;
        background:var(--rfv7-soft);
        border-radius:9px;
      }

      .rf-voice-performance-item-v7 > span{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        flex:0 0 28px;
        color:var(--rfv7-primary);
        background:#fff;
        border-radius:7px;
      }

      .rf-voice-performance-item-v7 > div{
        min-width:0;
        display:grid;
        gap:0;
      }

      .rf-voice-performance-item-v7 small{
        color:var(--rfv7-muted);
        font-size:6px;
        line-height:9px;
      }

      .rf-voice-performance-item-v7 strong{
        overflow:hidden;
        color:var(--rfv7-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
        line-height:12px;
      }

      .rf-voice-health-v7{
        position:sticky;
        top:80px;
        min-width:0;
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfv7-outline);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rf-voice-health-head-v7{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:10px;
        padding:16px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfv7-outline);
      }

      .rf-voice-health-head-v7 > span{
        min-height:23px;
        display:inline-flex;
        align-items:center;
        padding:4px 7px;
        border-radius:999px;
        font-size:7px;
        font-weight:700;
      }

      .rf-voice-health-head-v7 > span.excellent{
        color:var(--rfv7-success);
        background:var(--rfv7-success-soft);
      }

      .rf-voice-health-head-v7 > span.attention{
        color:var(--rfv7-warning);
        background:var(--rfv7-warning-soft);
      }

      .rf-voice-health-list-v7{
        display:grid;
        padding:6px 0;
      }

      .rf-voice-health-list-v7 > div{
        min-height:58px;
        display:grid;
        grid-template-columns:32px minmax(0,1fr) 20px;
        align-items:center;
        gap:9px;
        padding:9px 14px;
      }

      .rf-voice-health-list-v7 > div + div{
        border-top:1px solid #f2f3f4;
      }

      .rf-voice-health-icon-v7{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfv7-primary);
        background:var(--rfv7-primary-soft);
        border-radius:50%;
      }

      .rf-voice-health-list-v7 > div > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rf-voice-health-list-v7 strong{
        overflow:hidden;
        color:var(--rfv7-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
        line-height:12px;
      }

      .rf-voice-health-list-v7 small{
        overflow:hidden;
        color:var(--rfv7-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6px;
        line-height:10px;
      }

      .rf-voice-health-check-v7{
        color:#9a9da4;
      }

      .rf-voice-health-check-v7.ready{
        color:#0aa36d;
      }

      .rf-voice-health-balance-v7{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:12px 14px;
        background:#f0f1f6;
        border-top:1px solid var(--rfv7-outline);
      }

      .rf-voice-health-balance-v7 > div{
        min-width:0;
        display:grid;
      }

      .rf-voice-health-balance-v7 small{
        color:var(--rfv7-muted);
        font-size:6px;
        line-height:9px;
      }

      .rf-voice-health-balance-v7 strong{
        color:var(--rfv7-text);
        font:600 14px/18px Geist,Inter,sans-serif;
      }

      .rf-voice-health-balance-v7 button{
        min-height:29px;
        padding:5px 8px;
        color:var(--rfv7-primary);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
      }

      .rf-voice-health-balance-v7 button:hover{
        background:#fff;
      }

      .rf-agent-tabs-v7{
        display:flex;
        align-items:center;
        gap:5px;
        padding:5px;
        margin:0 0 14px;
        overflow:auto;
        background:#eceeef;
        border:0;
        border-radius:10px;
      }

      .rf-agent-tabs-v7 button{
        min-height:36px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        flex:1 0 auto;
        padding:7px 11px;
        color:var(--rfv7-text-soft);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font:600 8px/12px Inter,sans-serif;
      }

      .rf-agent-tabs-v7 button:hover{
        color:var(--rfv7-primary);
      }

      .rf-agent-tabs-v7 button.active{
        color:var(--rfv7-text);
        background:#fff;
        box-shadow:0 1px 4px rgba(25,28,29,.08);
      }

      .rf-agent-tabs-v7 button b{
        min-width:18px;
        height:18px;
        display:grid;
        place-items:center;
        padding:0 4px;
        color:#fff;
        background:var(--rfv7-primary);
        border-radius:999px;
        font-size:6px;
      }

      .rf-agent-v7 .rf-voice-setup-shell,
      .rf-agent-v7 .rf-lead-flow-shell,
      .rf-agent-v7 .rf-agent-card,
      .rf-agent-v7 .rf-agent-form-card,
      .rf-agent-v7 .rf-agent-live-monitor,
      .rf-agent-v7 .rf-agent-meeting-card,
      .rf-agent-v7 .rf-agent-queue-card,
      .rf-agent-v7 .rf-agent-google-leads-card,
      .rf-agent-v7 .rf-agent-custom-lead-card{
        color:var(--rfv7-text);
        background:#fff;
        border-color:var(--rfv7-outline);
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rf-agent-v7 .rf-voice-setup-shell,
      .rf-agent-v7 .rf-lead-flow-shell{
        overflow:hidden;
        border:1px solid var(--rfv7-outline);
        border-radius:14px;
        animation:rfv7FadeUp 220ms var(--rfv7-ease);
      }

      .rf-agent-v7 .rf-voice-setup-hero{
        padding:21px 22px;
        background:radial-gradient(circle at 90% 0,rgba(107,56,212,.08),transparent 28%),#fff;
        border-bottom:1px solid var(--rfv7-outline);
      }

      .rf-agent-v7 .rf-voice-setup-hero h2{
        margin:0;
        color:var(--rfv7-text);
        font:600 20px/27px Geist,Inter,sans-serif;
      }

      .rf-agent-v7 .rf-voice-setup-hero p{
        max-width:760px;
        color:var(--rfv7-text-soft);
        font-size:9px;
        line-height:15px;
      }

      .rf-agent-v7 .rf-voice-wizard-kicker{
        color:var(--rfv7-primary);
        font-size:8px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-agent-v7 .rf-voice-credit-orb{
        min-width:150px;
        color:var(--rfv7-text);
        background:#f0f0fb;
        border-color:#dedfff;
      }

      .rf-agent-v7 .rf-voice-setup-progress{
        padding:14px 16px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfv7-outline);
      }

      .rf-agent-v7 .rf-voice-setup-progress button{
        color:var(--rfv7-muted);
        background:transparent;
      }

      .rf-agent-v7 .rf-voice-setup-progress button.current,
      .rf-agent-v7 .rf-voice-setup-progress button.done{
        color:var(--rfv7-primary);
      }

      .rf-agent-v7 .rf-voice-setup-stage{
        padding:20px 22px 24px;
        background:#fff;
      }

      .rf-agent-v7 .rf-voice-setup-stage-head{
        padding-bottom:15px;
        margin-bottom:16px;
        border-bottom:1px solid var(--rfv7-outline);
      }

      .rf-agent-v7 .rf-voice-setup-stage-head h3{
        color:var(--rfv7-text);
        font:600 17px/23px Geist,Inter,sans-serif;
      }

      .rf-agent-v7 .rf-voice-setup-stage-head p{
        color:var(--rfv7-text-soft);
        font-size:9px;
        line-height:14px;
      }

      .rf-agent-v7 .rf-voice-mode-card,
      .rf-agent-v7 .rf-voice-number-card,
      .rf-agent-v7 .rf-owned-number-card,
      .rf-agent-v7 .rf-voice-card,
      .rf-agent-v7 .rf-voice-review-card,
      .rf-agent-v7 .rf-voice-workflow-block,
      .rf-agent-v7 .rf-voice-existing-number-panel,
      .rf-agent-v7 .rf-voice-credit-card,
      .rf-agent-v7 .rf-voice-language-panel{
        background:#fff;
        border-color:var(--rfv7-outline);
        border-radius:11px;
      }

      .rf-agent-v7 .rf-voice-mode-card.selected,
      .rf-agent-v7 .rf-voice-number-card.selected,
      .rf-agent-v7 .rf-voice-card.selected,
      .rf-agent-v7 .rf-owned-number-card.selected{
        background:#f4f4ff;
        border-color:rgba(70,72,212,.35);
        box-shadow:inset 3px 0 0 var(--rfv7-primary);
      }

      .rf-agent-v7 .rf-agent-field input,
      .rf-agent-v7 .rf-agent-field select,
      .rf-agent-v7 .rf-agent-field textarea,
      .rf-agent-v7 .rf-voice-search input,
      .rf-agent-v7 .rf-voice-picker-field select,
      .rf-agent-v7 .rf-agent-number-input input{
        color:var(--rfv7-text);
        background:#fff;
        border-color:var(--rfv7-outline);
        border-radius:8px;
      }

      .rf-agent-v7 .rf-agent-field input:focus,
      .rf-agent-v7 .rf-agent-field select:focus,
      .rf-agent-v7 .rf-agent-field textarea:focus,
      .rf-agent-v7 .rf-voice-search input:focus{
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
        outline:none;
      }

      .rf-agent-v7 .rf-agent-toolbar,
      .rf-agent-v7 .rf-v6-lead-control-bar,
      .rf-agent-v7 .rf-lead-activity-toolbar{
        background:#fbfbfc;
        border-color:var(--rfv7-outline);
      }

      .rf-agent-v7 .rf-agent-table-wrap{
        overflow:auto;
        border:1px solid var(--rfv7-outline);
        border-radius:10px;
      }

      .rf-agent-v7 .rf-agent-table{
        min-width:820px;
        border-collapse:separate;
        border-spacing:0;
      }

      .rf-agent-v7 .rf-agent-table thead th{
        color:var(--rfv7-text-soft);
        background:#eceeef;
        border-color:var(--rfv7-outline);
        font-size:7px;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rf-agent-v7 .rf-agent-table tbody td{
        border-color:#f1f2f3;
      }

      .rf-agent-v7 .rf-agent-table tbody tr:hover{
        background:#f8f8fc;
      }

      .rf-agent-v7 .rf-agent-status,
      .rf-agent-v7 .rf-agent-custom-badge,
      .rf-agent-v7 .rf-agent-google-badge,
      .rf-agent-v7 .rf-voice-number-badge{
        border-radius:999px;
      }

      .rf-agent-v7 .rf-agent-live-monitor,
      .rf-agent-v7 .rf-agent-call-details,
      .rf-agent-v7 .rf-agent-live-transcript{
        border-radius:11px;
      }

      .rf-agent-v7 .rf-agent-live-transcript{
        background:#16191b;
        color:#fff;
      }

      .rf-agent-v7 .rf-agent-live-transcript-heading{
        border-color:rgba(255,255,255,.1);
      }

      .rf-agent-v7 .rf-agent-transcript-message{
        border-radius:9px;
      }

      .rf-agent-v7 .rf-agent-meeting-grid{
        gap:10px;
      }

      .rf-agent-v7 .rf-agent-meeting-card{
        border-radius:11px;
      }

      .rf-agent-v7 .btn,
      .rf-agent-v7 button.btn,
      .rf-agent-v7 .rf-voice-primary-action,
      .rf-agent-v7 .rf-voice-activate-button{
        border-radius:8px;
      }

      .rf-agent-loading{
        min-height:420px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:7px;
        padding:28px;
        color:var(--rfv7-muted);
        background:#fff;
        border:1px solid var(--rfv7-outline);
        border-radius:14px;
        text-align:center;
      }

      .rf-agent-loading b{
        color:var(--rfv7-text);
        font:600 13px/18px Geist,Inter,sans-serif;
      }

      .rf-agent-loading small{
        font-size:8px;
        line-height:13px;
      }

      .rf-agent-spinner{
        width:30px;
        height:30px;
        border:3px solid #e3e4ef;
        border-top-color:var(--rfv7-primary);
        border-radius:50%;
        animation:rfv7Spin 800ms linear infinite;
      }

      @media(max-width:1180px){
        .rf-agent-page.rf-agent-v7{
          padding:24px 24px 44px;
        }

        .rf-voice-overview-grid-v7{
          grid-template-columns:1fr;
        }

        .rf-voice-health-v7{
          position:static;
        }

        .rf-voice-health-list-v7{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rf-voice-health-list-v7 > div + div{
          border-top:0;
        }

        .rf-voice-health-list-v7 > div:nth-child(n+3){
          border-top:1px solid #f2f3f4;
        }
      }

      @media(max-width:900px){
        .rf-agent-header-v7{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-agent-header-actions-v7{
          width:100%;
          justify-content:flex-end;
        }

        .rf-agent-metrics-v7{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rf-voice-performance-grid-v7{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rf-agent-v7 .rf-voice-setup-progress.six{
          overflow:auto;
          display:flex;
        }

        .rf-agent-v7 .rf-voice-setup-progress.six > button{
          min-width:130px;
        }
      }

      @media(max-width:680px){
        .rf-agent-page.rf-agent-v7{
          padding:18px 12px 84px;
        }

        .rf-agent-avatar-v7{
          width:52px;
          height:52px;
          flex-basis:52px;
          font-size:19px;
        }

        .rf-agent-title-line-v7 h1{
          font-size:24px;
          line-height:31px;
        }

        .rf-agent-header-actions-v7{
          display:grid;
          grid-template-columns:1fr 1fr 40px;
        }

        .rf-agent-action-v7{
          padding:7px 9px;
          font-size:8px;
        }

        .rf-agent-metrics-v7{
          grid-template-columns:1fr 1fr;
          gap:7px;
        }

        .rf-voice-overview-metric-v7{
          min-height:104px;
          padding:13px;
        }

        .rf-voice-overview-metric-v7 > strong{
          font-size:21px;
          line-height:26px;
        }

        .rf-voice-health-list-v7{
          grid-template-columns:1fr;
        }

        .rf-voice-health-list-v7 > div:nth-child(n+2){
          border-top:1px solid #f2f3f4;
        }

        .rf-agent-tabs-v7 button{
          min-width:100px;
          flex:0 0 auto;
        }

        .rf-agent-v7 .rf-voice-setup-hero,
        .rf-agent-v7 .rf-voice-setup-stage{
          padding-left:14px;
          padding-right:14px;
        }
      }

      @media(max-width:470px){
        .rf-agent-header-actions-v7{
          grid-template-columns:1fr 1fr;
        }

        .rf-agent-icon-action-v7{
          grid-column:1/-1;
          width:100%;
          border-radius:8px;
        }

        .rf-agent-metrics-v7,
        .rf-voice-performance-grid-v7{
          grid-template-columns:1fr;
        }

        .rf-voice-performance-head-v7{
          flex-direction:column;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-agent-page.rf-agent-v7,
        .rf-agent-v7 .rf-agent-alert,
        .rf-agent-v7 .rf-voice-overview-metric-v7,
        .rf-agent-v7 .rf-voice-setup-shell,
        .rf-agent-v7 .rf-lead-flow-shell,
        .rf-agent-v7 .rf-agent-spinner,
        .rf-agent-v7 .spin{
          animation:none!important;
        }

        .rf-agent-v7 *,
        .rf-agent-v7 *::before,
        .rf-agent-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}

function normalizeAgentForm(value = {}) {
  const primaryLanguage = normalizeLanguageCode(
    value.primaryLanguage || value.language || DEFAULT_FORM.primaryLanguage
  );
  const supportedLanguages = normalizeLanguageList(
    value.supportedLanguages,
    primaryLanguage
  );
  return {
    ...DEFAULT_FORM,
    ...value,
    primaryLanguage,
    supportedLanguages,
    autoDetectLanguage: value.autoDetectLanguage !== false,
    languageVoices:
      value.languageVoices && typeof value.languageVoices === "object" && !Array.isArray(value.languageVoices)
        ? value.languageVoices
        : {},
    languageGreetings:
      value.languageGreetings && typeof value.languageGreetings === "object" && !Array.isArray(value.languageGreetings)
        ? value.languageGreetings
        : {},
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
    maxCallSeconds: safeNumber(value.maxCallSeconds, 300),
    ringTimeoutSeconds: safeNumber(
      value.ringTimeoutSeconds,
      45
    ),
    recordingEnabled: value.recordingEnabled === true,
    complianceConfirmed: value.complianceConfirmed === true,
    enabled: value.enabled !== false,
  };
}

function normalizeLanguageCode(value) {
  const raw = String(value || "en").trim().toLowerCase().replace(/_/g, "-");
  const aliases = {
    "en-us": "en", "en-gb": "en", "es-es": "es", "es-mx": "es",
    "pt-br": "pt", "pt-pt": "pt", "zh-cn": "zh", "zh-hans": "zh",
    "zh-tw": "zh", "zh-hant": "zh",
  };
  const code = aliases[raw] || raw.split("-")[0] || "en";
  return LANGUAGE_OPTIONS.some(([item]) => item === code) ? code : "en";
}

function normalizeLanguageList(value, primary = "en") {
  const raw = Array.isArray(value) ? value : [];
  return Array.from(
    new Set([normalizeLanguageCode(primary), ...raw.map(normalizeLanguageCode)])
  ).filter((code) => LANGUAGE_OPTIONS.some(([item]) => item === code));
}

function languageLabel(code) {
  return LANGUAGE_OPTIONS.find(([item]) => item === code)?.[1] || String(code || "").toUpperCase();
}

function supportedAgentLanguageOptions(agent) {
  const primary = normalizeLanguageCode(agent?.primaryLanguage || "en");
  const supported = normalizeLanguageList(agent?.supportedLanguages, primary);
  return supported.map((code) => [code, languageLabel(code)]);
}

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}


function chooseFrontendRecommendedVoice(voicesValue) {
  const voices = Array.isArray(voicesValue)
    ? voicesValue.filter((voice) => voice?.id)
    : [];

  if (!voices.length) return null;

  const score = (voice) => {
    const id = String(voice.id || "").toLowerCase();
    const name = String(voice.name || "").toLowerCase();
    const model = String(voice.model || "").toLowerCase();
    const language = String(voice.language || "").toLowerCase();
    const gender = String(voice.gender || "").toLowerCase();
    let value = 0;

    if (id === "fnzkphlhnxqe8omjamg6") value += 10000;

    const ultra =
      model === "ultra" || id.startsWith("telnyx.ultra.");
    if (ultra) value += 1500;

    if (id === "telnyx.ultra.2747b6cf-fa34-460c-97db-267566918881") value += 800;
    if (name.includes("allie")) value += 700;
    if (name.includes("natural conversationalist")) value += 650;
    if (name.includes("conversational")) value += 300;
    if (name.includes("approachable")) value += 220;
    if (name.includes("warm")) value += 210;
    if (name.includes("friendly")) value += 200;
    if (name.includes("encourager")) value += 180;
    if (name.includes("service specialist")) value += 150;
    if (name.includes("callie")) value += 140;
    if (name.includes("mia")) value += 130;
    if (name.includes("clara")) value += 90;

    if (
      language === "en-us" ||
      language.includes("american english")
    ) value += 100;
    else if (
      language.startsWith("en") ||
      language.includes("english")
    ) value += 80;

    if (gender.includes("female")) value += 40;

    if (
      !ultra &&
      (model === "naturalhd" || id.startsWith("telnyx.naturalhd."))
    ) value += 350;

    return value;
  };

  return [...voices].sort(
    (left, right) => score(right) - score(left)
  )[0] || null;
}

function resolveFrontendFriendlyVoice(
  voicesValue,
  requestedValue
) {
  const voices = Array.isArray(voicesValue)
    ? voicesValue
    : [];
  const requested = String(
    requestedValue || ""
  ).trim();

  const parts = requested.split(".");
  if (parts.length < 3) return null;

  const provider = String(
    parts[0] || ""
  ).toLowerCase();
  const model = String(
    parts[1] || ""
  ).toLowerCase();
  const friendlyName = parts
    .slice(2)
    .join(".")
    .trim()
    .toLowerCase();

  if (provider !== "telnyx" || !friendlyName) {
    return null;
  }

  return (
    voices.find((voice) => {
      const voiceModel = String(
        voice.model || ""
      ).toLowerCase();
      const voiceId = String(
        voice.id || ""
      ).toLowerCase();
      const voiceName = String(
        voice.name || ""
      ).toLowerCase();

      const sameModel =
        voiceModel === model ||
        voiceId.startsWith(
          `telnyx.${model}.`
        );

      return (
        sameModel &&
        (
          voiceName === friendlyName ||
          voiceName.includes(friendlyName) ||
          friendlyName.includes(voiceName)
        )
      );
    }) || null
  );
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

function normalizePhoneKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function formatMoneyMinorVoice(value, currency = "USD") {
  const amount = Number(value || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${String(currency || "USD").toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function formatCreditsCompact(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
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