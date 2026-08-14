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
  useAuth,
} from "../auth/AuthContext";

import {
  apiRequest,
  emitWorkspaceSocket,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import "../styles.css";

const FAST_HUMAN_GREETING =
  "Hey {{greeting_name}}, James from {{company_name}}. Quick disclosure — I’m an AI sales agent with the team, and this call may be recorded. I’ll keep it brief. I was curious... is your website consistently turning visitors into real sales conversations, or do too many people land there and leave without ever becoming a lead?";

const FAST_HUMAN_PERSONA =
  "Warm, sharp, concise, and conversational. Keep most turns short, use contractions and plain words, and match the prospect’s pace. React naturally without repetitive acknowledgement phrases. Avoid canned AI or call-center filler such as got it, gotcha, absolutely, certainly, perfect, awesome, I understand, or that makes sense. Allow brief silence instead of filling every gap. Never use fake laughter, fake breathing, written stage directions, or claim to be human.";

const DEFAULT_FORM = {
  name: "James",
  description:
    "ReachFly outbound qualification and meeting-booking agent.",
  companyName: "",
  elevenLabsAgentId: "",
  voice: "fNZkPhLHNXqE8oMjamg6",
  model: "elevenlabs-managed-llm",
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
  context: "",
};

const TABS = [
  ["setup", "Agent setup"],
  ["leads", "Lead queue"],
  ["calls", "Live calls"],
  ["meetings", "Meetings"],
];

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

  const [dashboard, setDashboard] = useState(null);
  const [voiceCommerce, setVoiceCommerce] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [voices, setVoices] = useState([]);
  const [elevenLabsAgents, setElevenLabsAgents] = useState([]);
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
            timeoutMs: 45_000,
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
          loadedAgents.find((item) => item.agentId === configuredId) ||
          loadedAgents[0];
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
    if (onboardingMode) {
      setActiveTab("setup");
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
  const agent = dashboard?.agent || null;
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
            fromNumber: form.fromNumber,
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
      await persistVoiceAgent({ announce: true });
    } catch {
      // persistVoiceAgent already surfaced the save error.
    }
  }

  async function ensureVoiceAgentReady() {
    const activePurchasedNumber = voiceCommerce?.activeNumber;
    if (!activePurchasedNumber || normalizeStatus(activePurchasedNumber.status) !== "active") {
      throw new Error(
        "Buy and activate a ReachFly business number before configuring or launching the Voice Agent."
      );
    }

    const aiCallBalance = Number(
      billingData?.aiCalling?.wallet?.balance || 0
    );
    if (aiCallBalance <= 0) {
      throw new Error(
        "Buy AI call credits before configuring or launching paid Voice Agent calls. General ReachFly credits cannot fund AI calls."
      );
    }

    if (agent?.elevenLabsAgentId && agent?.elevenLabsPhoneNumberId) {
      return agent;
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

  function closeOnboarding(nextTab = "setup", announcement = "") {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("onboarding");
    setSearchParams(nextParams, { replace: true });
    setActiveTab(nextTab);
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

      setActiveTab("setup");
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
      <main className="rf-agent-page">
        <section className="rf-agent-loading">
          <span className="rf-agent-spinner" />
          <b>Loading ReachFly Voice Agent…</b>
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
          <span className="eyebrow">
            {onboardingMode ? "Voice Agent onboarding" : "ReachFly Voice"}
          </span>
          <h1>
            {onboardingMode ? "Set up your AI voice agent" : "Outbound voice agent"}
          </h1>
          <p>
            {onboardingMode
              ? "Buy and activate a business number, fund AI call credits, configure the agent and business context, approve calling policy, then save the runtime before adding leads."
              : "Qualify leads, run compliant AI conversations, monitor live calls, record outcomes and book confirmed meetings from one workspace."}
          </p>
        </div>

        <div className="rf-agent-header-actions">
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
                ? "Voice stack configured"
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

      {onboardingMode ? (
        <>
          <VoiceCommerceOnboarding
            commerce={voiceCommerce}
            billing={billingData}
            onRefresh={async () => {
              await Promise.all([
                loadVoiceCommerce(),
                loadBillingData(),
                loadDashboard({ silent: true }),
              ]);
            }}
            onError={setError}
            onSuccess={setSuccess}
          />

          <VoiceAgentOnboardingGuide
            state={onboardingState}
            form={form}
            diagnostics={diagnostics}
            commerce={voiceCommerce}
            billing={billingData}
            saving={saving}
            analyzingWebsite={analyzingWebsite}
            onFinish={finishOnboarding}
            onExit={() => closeOnboarding("setup")}
          />

          <AgentSetup
            form={form}
            voices={voices}
            elevenLabsAgents={elevenLabsAgents}
            recommendedVoice={recommendedVoice}
            diagnostics={diagnostics}
            saving={saving}
            analyzingWebsite={analyzingWebsite}
            onChange={updateForm}
            onAnalyzeWebsite={() => void analyzeWebsite()}
            onSave={() => void saveAgent()}
          />
        </>
      ) : (
        <>
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
            <b>ReachFly Calling</b>
            <small>
              {diagnostics.configured ? "Voice runtime connected" : "Voice runtime needs setup"}
            </small>
          </div>
        </div>

        <dl>
          <div>
            <dt>Voice agent</dt>
            <dd>{agent?.name || form.name || "Not configured"}</dd>
          </div>
          <div>
            <dt>Business number</dt>
            <dd>{diagnostics.selectedFromNumber || "Not connected"}</dd>
          </div>
          <div>
            <dt>Call events</dt>
            <dd>{diagnostics.configured ? "Connected" : "Needs attention"}</dd>
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
          elevenLabsAgents={elevenLabsAgents}
          recommendedVoice={recommendedVoice}
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
          onOpenCalls={() => setActiveTab("calls")}
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
          onRefresh={() => loadDashboard({ silent: true })}
        />
      ) : null}

      {activeTab === "meetings" ? (
        <MeetingsPanel meetings={meetings} />
      ) : null}
        </>
      )}
    </main>
  );
}

function VoiceCommerceOnboarding({
  commerce,
  billing,
  onRefresh,
  onError,
  onSuccess,
}) {
  const [searchForm, setSearchForm] = useState({
    countryCode: "US",
    areaCode: "",
    locality: "",
    administrativeArea: "",
    phoneNumberType: "local",
  });
  const [quote, setQuote] = useState(null);
  const [searching, setSearching] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState("");
  const [buyingBundle, setBuyingBundle] = useState("");
  const [buyingCredits, setBuyingCredits] = useState("");
  const [retryingOrder, setRetryingOrder] = useState("");

  const activeNumber = commerce?.activeNumber || null;
  const callWallet = billing?.aiCalling?.wallet || {};
  const callBalance = Number(callWallet.balance || 0);
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

  async function searchNumbers() {
    if (!commerce?.canPurchase) {
      onError?.("Only a workspace owner or administrator can buy a business number.");
      return;
    }

    setSearching(true);
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
            administrativeArea: searchForm.administrativeArea,
            phoneNumberType: searchForm.phoneNumberType,
            limit: 12,
          },
          timeoutMs: 30_000,
        }
      );
      setQuote(response);
      if (!response?.items?.length) {
        onSuccess?.("No matching voice-capable numbers were returned. Try a broader area or another location.");
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

  async function buyNumberBundle(item, bundle) {
    const busyKey = `${item?.phoneNumber || ""}:${bundle?.id || ""}`;
    if (
      !quote?.quoteId ||
      !item?.phoneNumber ||
      !bundle?.id ||
      buyingBundle
    ) {
      return;
    }

    setBuyingBundle(busyKey);
    onError?.("");
    onSuccess?.("");

    try {
      const response = await apiRequest(
        "/voice-commerce/bundles/checkout",
        {
          method: "POST",
          body: {
            quoteId: quote.quoteId,
            phoneNumber: item.phoneNumber,
            bundleId: bundle.id,
          },
          timeoutMs: 30_000,
        }
      );

      if (
        !response?.checkoutUrl ||
        !/^https?:\/\//i.test(response.checkoutUrl)
      ) {
        throw new Error("Secure Voice Agent bundle checkout could not be opened.");
      }

      window.location.assign(response.checkoutUrl);
    } catch (requestError) {
      setBuyingBundle("");
      onError?.(
        requestError?.message ||
          "Voice Agent bundle checkout could not be started."
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
          `${formatPhone(order.phoneNumber)} is now active and linked to your Voice Agent.`
        );
      } else {
        onSuccess?.(
          "Provisioning retry was accepted. Refresh this page to check the latest number status."
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
    <section className="rf-agent-card rf-agent-form-card">
      <div className="rf-agent-card-heading">
        <div>
          <span>Commerce activation</span>
          <h2>Buy the calling identity and fund the Voice Agent first</h2>
        </div>
        <span className="rf-agent-section-number">PAY</span>
      </div>

      <p className="rf-agent-google-copy">
        Voice Agent activation is locked until this workspace owns an active
        ReachFly-purchased business number and has a positive dedicated AI
        call-credit balance. General ReachFly credits cannot fund AI calls.
      </p>

      <section className="rf-agent-metrics">
        <Metric
          label="1. Business number"
          value={activeNumber ? "Active" : "Required"}
          text={
            activeNumber
              ? formatPhone(activeNumber.phoneNumber)
              : "Search inventory, pay securely, then ReachFly provisions the number."
          }
        />
        <Metric
          label="2. AI call credits"
          value={formatCreditsCompact(callBalance)}
          text={
            callBalance > 0
              ? "Dedicated paid call credits available"
              : "Buy a server-priced AI call-credit pack before activation"
          }
        />
        <Metric
          label="3. Voice Agent"
          value={activeNumber && callBalance > 0 ? "Unlocked" : "Locked"}
          text="Agent configuration and paid calling remain server-gated."
        />
      </section>

      <article className="rf-agent-card" style={{ marginTop: 16 }}>
        <div className="rf-agent-card-heading">
          <div>
            <span>Step 1</span>
            <h3>{activeNumber ? "Business number active" : "Find and buy a business number"}</h3>
          </div>
        </div>

        {activeNumber ? (
          <section className="rf-agent-provider-card">
            <div>
              <span className="rf-agent-provider-logo">RF</span>
              <div>
                <b>{formatPhone(activeNumber.phoneNumber)}</b>
                <small>Purchased and activated for this workspace</small>
              </div>
            </div>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{formatLabel(activeNumber.status || "active")}</dd>
              </div>
              <div>
                <dt>Provider monthly cost</dt>
                <dd>
                  {formatMoneyMinorVoice(
                    activeNumber.providerMonthlyMinor,
                    activeNumber.currency
                  )}
                </dd>
              </div>
            </dl>
          </section>
        ) : (
          <>
            <div className="rf-agent-field-grid three">
              <Field
                label="Country code"
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
                label="Area code"
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
                label="City / locality"
                value={searchForm.locality}
                onChange={(value) =>
                  setSearchForm((current) => ({ ...current, locality: value }))
                }
                placeholder="Los Angeles"
              />
              <Field
                label="State / region"
                value={searchForm.administrativeArea}
                onChange={(value) =>
                  setSearchForm((current) => ({
                    ...current,
                    administrativeArea: value,
                  }))
                }
                placeholder="CA"
              />
              <label className="rf-agent-field">
                <span>Number type</span>
                <select
                  value={searchForm.phoneNumberType}
                  onChange={(event) =>
                    setSearchForm((current) => ({
                      ...current,
                      phoneNumberType: event.target.value,
                    }))
                  }
                >
                  <option value="local">Local</option>
                  <option value="toll_free">Toll-free</option>
                  <option value="mobile">Mobile</option>
                </select>
              </label>
            </div>

            <div className="rf-agent-website-actions">
              <button
                type="button"
                className="btn primary"
                disabled={searching || !commerce?.canPurchase}
                onClick={() => void searchNumbers()}
              >
                {searching ? "Searching…" : "Find available numbers"}
              </button>
            </div>

            {!commerce?.canPurchase ? (
              <small className="rf-agent-field-note">
                Only a workspace owner or administrator can purchase the calling number.
              </small>
            ) : null}

            {quote?.items?.length ? (
              <div className="rf-agent-queue-list" style={{ marginTop: 16 }}>
                {quote.items.map((item) => (
                  <article className="rf-agent-queue-row" key={item.phoneNumber}>
                    <div>
                      <b>{formatPhone(item.phoneNumber)}</b>
                      <small>
                        {(item.regionInformation || [])
                          .map((region) => region.name)
                          .filter(Boolean)
                          .slice(0, 2)
                          .join(" · ") || "Voice-capable business number"}
                      </small>
                    </div>
                    <div>
                      <small>Initial activation</small>
                      <b>
                        {formatMoneyMinorVoice(
                          item.initialChargeMinor,
                          item.currency
                        )}
                      </b>
                      <small>
                        First provider month {formatMoneyMinorVoice(
                          item.providerMonthlyMinor,
                          item.currency
                        )}
                      </small>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        minWidth: 230,
                      }}
                    >
                      <button
                        type="button"
                        className="btn light"
                        disabled={Boolean(buyingNumber || buyingBundle)}
                        onClick={() => void buyNumber(item)}
                      >
                        {buyingNumber === item.phoneNumber
                          ? "Opening checkout…"
                          : `Number only · ${formatMoneyMinorVoice(
                              item.initialChargeMinor,
                              item.currency
                            )}`}
                      </button>

                      {(Array.isArray(item.bundles) ? item.bundles : [])
                        .filter((bundle) => bundle?.active !== false)
                        .map((bundle) => {
                          const busyKey = `${item.phoneNumber}:${bundle.id}`;
                          return (
                            <button
                              key={bundle.id}
                              type="button"
                              className={bundle.recommended ? "btn primary" : "btn light"}
                              disabled={Boolean(buyingNumber || buyingBundle)}
                              onClick={() => void buyNumberBundle(item, bundle)}
                            >
                              {buyingBundle === busyKey
                                ? "Opening checkout…"
                                : `${bundle.label} · ${formatMoneyMinorVoice(
                                    bundle.totalInitialChargeMinor,
                                    bundle.currency || item.currency
                                  )}`}
                            </button>
                          );
                        })}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {quote?.pricingNote ? (
              <small className="rf-agent-field-note">
                {quote.pricingNote} Bundle totals are also calculated by the
                backend from that live number quote plus the server-owned AI
                call-credit price. The browser cannot override either amount.
              </small>
            ) : null}
          </>
        )}

        {failedOrder && !activeNumber ? (
          <div className="rf-agent-alert error" style={{ marginTop: 16 }}>
            <span>
              {failedOrder.error ||
                `Number order ${formatLabel(failedOrder.status)}. Provisioning may require another attempt or regulatory review.`}
            </span>
            {["provision_failed", "paid", "pending_activation"].includes(
              normalizeStatus(failedOrder.status)
            ) ? (
              <button
                type="button"
                disabled={retryingOrder === failedOrder.id}
                onClick={() => void retryProvision(failedOrder.id)}
              >
                {retryingOrder === failedOrder.id ? "Retrying…" : "Retry provisioning"}
              </button>
            ) : null}
          </div>
        ) : null}

        <small className="rf-agent-field-note">
          The number checkout covers initial activation, including the provider
          upfront charge and first provider monthly charge when returned by the
          inventory quote. Automatic recurring customer renewal billing is not
          part of this first commerce build and must be added before recurring
          number fees are collected from customers.
        </small>
      </article>

      <article className="rf-agent-card" style={{ marginTop: 16 }}>
        <div className="rf-agent-card-heading">
          <div>
            <span>Step 2</span>
            <h3>Fund the dedicated AI calling wallet</h3>
          </div>
          <span className="rf-agent-section-number">
            {formatCreditsCompact(callBalance)}
          </span>
        </div>

        <p className="rf-agent-google-copy">
          AI Voice uses a separate prepaid call-credit wallet. The browser sends
          only the selected pack ID; pack size and amount are controlled by the
          backend. The current workspace policy prices one connected AI call at{" "}
          <b>
            {formatMoneyMinorVoice(
              commerce?.pricing?.aiConnectedCallPriceMinor ||
                billing?.aiCalling?.policy?.connectedCallPriceMinor ||
                100,
              commerce?.pricing?.aiConnectedCallCurrency ||
                billing?.aiCalling?.policy?.currency ||
                "USD"
            )}
          </b>{" "}
          per connected call.
        </p>

        {!activeNumber ? (
          <div className="rf-agent-empty">
            Buy and activate the business number first. Call-credit funding is
            the next activation step.
          </div>
        ) : !billing?.aiCalling?.canPurchase ? (
          <div className="rf-agent-empty">
            Only a workspace owner or administrator can buy AI call credits.
          </div>
        ) : !billing?.safepay?.configured ? (
          <div className="rf-agent-empty">
            Secure payment checkout is not configured for this workspace.
          </div>
        ) : !callPacks.length ? (
          <div className="rf-agent-empty">
            No AI call-credit packs are active. Configure server-owned packs before launch.
          </div>
        ) : (
          <div className="rf-agent-queue-list">
            {callPacks.map((pack) => (
              <article className="rf-agent-queue-row" key={pack.id}>
                <div>
                  <b>{formatCreditsCompact(pack.credits)} AI call credits</b>
                  <small>Dedicated Voice Agent wallet</small>
                </div>
                <div>
                  <b>{formatMoneyMinorVoice(pack.amountMinor, pack.currency)}</b>
                  <small>Server-priced pack</small>
                </div>
                <button
                  type="button"
                  className="btn primary"
                  disabled={Boolean(buyingCredits)}
                  onClick={() => void buyCallCredits(pack)}
                >
                  {buyingCredits === pack.id
                    ? "Opening checkout…"
                    : "Buy call credits"}
                </button>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
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
  elevenLabsAgents,
  recommendedVoice,
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
          <span>Voice-agent profile</span>
          <select
            value={form.elevenLabsAgentId || ""}
            onChange={(event) => {
              const agentId = event.target.value;
              const selected = (elevenLabsAgents || []).find(
                (item) => item.agentId === agentId
              );
              onChange("elevenLabsAgentId", agentId);
              if (selected?.voiceId) {
                onChange("voice", selected.voiceId);
              }
            }}
          >
            {!elevenLabsAgents?.length ? (
              <option value={form.elevenLabsAgentId || ""}>
                {form.elevenLabsAgentId ? "Linked profile" : "No voice-agent profiles loaded"}
              </option>
            ) : null}
            {(elevenLabsAgents || []).map((item) => (
              <option key={item.agentId} value={item.agentId}>
                {item.name}{item.voiceName ? ` — ${item.voiceName}` : ""}
              </option>
            ))}
          </select>
          <small>
            Choose the managed voice-agent profile available to this workspace. Provider identifiers stay hidden from customer-facing screens.
          </small>
        </label>

        <label className="rf-agent-field">
          <span>Voice</span>
          <select
            value={form.voice}
            onChange={(event) =>
              onChange("voice", event.target.value)
            }
          >
            {!voices.length ? (
              <option value={form.voice}>{recommendedVoice?.name || "Current voice"}</option>
            ) : null}
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name || voice.accent || voice.language || "Voice"}
              </option>
            ))}
          </select>
          <small>
            Choose the customer-facing voice for this agent. ReachFly keeps provider IDs and runtime configuration behind the scenes.
          </small>

          <div className="rf-agent-website-actions">
            <button
              type="button"
              className="btn light"
              disabled={!recommendedVoice?.id}
              onClick={() =>
                recommendedVoice?.id &&
                onChange("voice", recommendedVoice.id)
              }
            >
              {recommendedVoice?.id
                ? `Use linked voice: ${recommendedVoice.name || "Recommended voice"}`
                : "No linked voice available"}
            </button>

            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (recommendedVoice?.id) {
                  onChange("voice", recommendedVoice.id);
                }
                onChange("greeting", FAST_HUMAN_GREETING);
                onChange("persona", FAST_HUMAN_PERSONA);
              }}
            >
              ⚡ Apply fast-natural preset
            </button>

            <span className="rf-agent-brain-pill">
              <b>Natural conversation mode</b>
              <span>
                {(recommendedVoice?.name || "Linked voice")} · balanced turn-taking · low-latency conversation
              </span>
            </span>
          </div>
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
            <span>Website intelligence</span>
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
              ? "ReachFly is reading the website…"
              : form.websiteIntelligence?.analyzedAt
                ? "Re-analyze website"
                : "Analyze website"}
          </button>

          <div className="rf-agent-brain-pill">
            <b>Live conversation brain</b>
            <span>ReachFly real-time voice runtime</span>
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
              ReachFly safely reads the public website, extracts services, target
              customers, value propositions, proof points, qualification questions,
              objections and booking angles, and prepares that knowledge for the
              voice agent before each call.
            </p>
          </div>
        )}

        <small className="rf-agent-field-note">
          The website is analyzed before calls. ReachFly prepares the resulting
          sales context before dialing so the agent can stay focused and responsive
          during the conversation.
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
          <span>Outbound business number</span>
          <select
            value={form.fromNumber}
            disabled={!numberOptions.length}
            onChange={(event) =>
              onChange("fromNumber", event.target.value)
            }
          >
            <option value="">
              {numberOptions.length
                ? "Select purchased business number"
                : "Buy a business number in onboarding first"}
            </option>
            {numberOptions.map((number) => (
              <option key={number} value={number}>
                {formatPhone(number)}
              </option>
            ))}
          </select>
          <small>
            Only a ReachFly-purchased, successfully activated business number can be used for outbound Voice Agent calls in this build.
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
            ? "Saving and syncing voice agent…"
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
    </section>
  );
}

function CallsPanel({
  calls,
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
            <span>Conversation activity</span>
            <h2>AI-agent calls</h2>
          </div>
          <b className="rf-agent-count">
            {calls.length} records
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
              {calls.length ? (
                calls.map((call) => {
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
                      title="No AI-agent calls yet"
                      text="When ReachFly starts a call, live status appears here. Completed conversations keep their transcript and recording when available."
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
            text="Confirmed appointments created by the voice agent will appear here in real time."
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

  const numberDone = Boolean(
    voiceCommerce?.activeNumber?.phoneNumber &&
      normalizeStatus(voiceCommerce.activeNumber.status) === "active"
  );

  const creditsDone =
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
      required: true,
      done: numberDone,
      text: numberDone
        ? "A paid ReachFly business number is active for this workspace."
        : "Buy and activate a business number before saving the Voice Agent.",
    },
    {
      key: "credits",
      title: "AI call credits",
      required: true,
      done: creditsDone,
      text: creditsDone
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
