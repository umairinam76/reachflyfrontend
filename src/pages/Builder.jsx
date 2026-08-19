import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from "../components/icons";
import { City, Country, State } from "country-state-city";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { apiRequest, getAccessToken } from "../lib/workspace-platform-client.js";
import "../styles.css";

const initial = {
  niche: "",
  location: "",
  radiusKm: 10,
  limit: 100,
  qualityLevel: "balanced",
  goal: "both",
  voiceEnabled: false,
  offer: "",
  emailAccountId: "",
};

const slide = {
  enter: (direction) => ({
    opacity: 0,
    x: direction > 0 ? 60 : -60,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction > 0 ? -60 : 60,
  }),
};

const MIN = 2;
const MAX_RADIUS_KM = 1000;
const MAX_LOCATION_RESULTS = 28;

const BROWSER_API_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8787/api`
    : "http://localhost:8787/api";

const CONFIGURED_API_BASE_URL = String(
  import.meta.env.VITE_API_URL || ""
).trim();

const CONFIGURED_API_USES_LOCALHOST =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(
    CONFIGURED_API_BASE_URL
  );

const PAGE_IS_OPENED_ON_LAN =
  typeof window !== "undefined" &&
  !["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname
  );

const RAW_API_BASE_URL =
  PAGE_IS_OPENED_ON_LAN &&
  CONFIGURED_API_USES_LOCALHOST
    ? BROWSER_API_BASE_URL
    : CONFIGURED_API_BASE_URL ||
      BROWSER_API_BASE_URL;

const NORMALIZED_API_BASE_URL = String(
  RAW_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api\/api$/i, "/api");

const API_BASE_URL = /\/api$/i.test(
  NORMALIZED_API_BASE_URL
)
  ? NORMALIZED_API_BASE_URL
  : `${NORMALIZED_API_BASE_URL}/api`;

const BUILDER_STORAGE_KEY = "reachfly.builder.state.v1";

function readPersistedBuilderState() {
  try {
    const raw = localStorage.getItem(
      BUILDER_STORAGE_KEY
    );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      parsed.version !== 1
    ) {
      localStorage.removeItem(
        BUILDER_STORAGE_KEY
      );

      return null;
    }

    return {
      step: Number.isInteger(
        parsed.step
      )
        ? Math.max(
            0,
            Math.min(
              3,
              parsed.step
            )
          )
        : 0,
      form:
        parsed.form &&
        typeof parsed.form ===
          "object"
          ? {
              ...initial,
              ...parsed.form,
            }
          : initial,
      leadResult:
        parsed.leadResult &&
        typeof parsed.leadResult ===
          "object"
          ? parsed.leadResult
          : null,
    };
  } catch {
    localStorage.removeItem(
      BUILDER_STORAGE_KEY
    );

    return null;
  }
}

function writePersistedBuilderState(state) {
  try {
    localStorage.setItem(
      BUILDER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        step: state.step,
        form: state.form,
        leadResult:
          state.leadResult,
      })
    );
  } catch {
    // Ignore storage quota/private-mode errors.
  }
}

function getAuthToken() {
  return getAccessToken() || "";
}

async function requestGoogleLeadsStream(
  {
    niche,
    location,
    radiusKm,
    limit,
    qualityLevel,
  },
  {
    signal,
    onEvent,
  } = {}
) {
  const token = getAuthToken();

  const response = await fetch(
    `${API_BASE_URL}/leads/find/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        Accept:
          "application/x-ndjson",
        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),
      },
      signal,
      body: JSON.stringify({
        niche,
        location,
        radiusKm:
          Number(radiusKm || 10),
        limit: Number(
          limit || 100
        ),
        qualityLevel:
          qualityLevel ||
          "balanced",
        exact: true,
      }),
    }
  );

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => null);

    const error = new Error(
    data?.error ||
      data?.message ||
      (
        response.status === 403
          ? "Only workspace managers can generate leads."
          : `Lead request failed with status ${response.status}.`
      )
  );

  error.status =
    response.status;

  error.code =
    data?.code || "";

  throw error;
  }

  if (!response.body) {
    throw new Error(
      "The browser could not open the live lead stream."
    );
  }

  const reader =
    response.body.getReader();
  const decoder =
    new TextDecoder();

  let buffer = "";
  let completed = false;
  let streamedLeads = [];

  const processLine = (line) => {
    const value = line.trim();

    if (!value) return;

    let event;

    try {
      event = JSON.parse(value);
    } catch {
      return;
    }

    if (event.type === "heartbeat") {
      return;
    }

    if (event.type === "error") {
      const streamError = new Error(
        event.error ||
          "Could not retrieve Google Places leads."
      );

      streamError.code =
        event.code || "";
      streamError.statusCode =
        event.statusCode || 500;
      streamError.details =
        event.details || null;

      throw streamError;
    }

    if (event.type === "leads") {
      streamedLeads =
        mergeLeadCollections(
          streamedLeads,
          event.leads
        );
    }

    if (event.type === "complete") {
      completed = true;

      if (
        Array.isArray(
          event.result?.leads
        )
      ) {
        streamedLeads =
          mergeLeadCollections(
            streamedLeads,
            event.result.leads
          );
      }
    }

    onEvent?.(event);
  };

  while (true) {
    const {
      value,
      done,
    } = await reader.read();

    buffer += decoder.decode(
      value || new Uint8Array(),
      { stream: !done }
    );

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      processLine(line);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    processLine(buffer);
  }

  if (!completed) {
    if (streamedLeads.length) {
      onEvent?.({
        type: "complete",
        result: {
          ok: true,
          status:
            "completed_partial",
          exact:
            streamedLeads.length >=
            Number(limit || 100),
          requested:
            Number(limit || 100),
          delivered:
            streamedLeads.length,
          shortfall: Math.max(
            0,
            Number(limit || 100) -
              streamedLeads.length
          ),
          message:
            `The live stream ended after loading ${streamedLeads.length} leads. The available leads were preserved.`,
          leads:
            streamedLeads.slice(
              0,
              Number(limit || 100)
            ),
          meta: {
            source:
              "google-places",
            streamEndedEarly: true,
          },
        },
      });

      return;
    }

    throw new Error(
      "The live lead stream ended before completion."
    );
  }
}



async function requestWorkspaceTeamResources() {
  const data = await apiRequest(
    "/team",
    { timeoutMs: 15_000 }
  );

  return {
    ...(data && typeof data === "object" ? data : {}),
    members: extractTeamMembers(data),
  };
}

async function auditApi(
  path,
  {
    method = "GET",
    body,
    signal,
  } = {}
) {
  const token = getAuthToken();
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method,
      headers: {
        Accept: "application/json",
        ...(body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),
      },
      signal,
      ...(body
        ? {
            body: JSON.stringify(body),
          }
        : {}),
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Audit request failed with status ${response.status}.`
    );
  }

  return data;
}

async function downloadAuditPdf(
  report
) {
  if (!report?.id) return;

  const token = getAuthToken();
  const response = await fetch(
    `${API_BASE_URL}/lead-audits/${encodeURIComponent(
      report.id
    )}/pdf`,
    {
      headers: {
        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),
      },
    }
  );

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => null);

    throw new Error(
      data?.error ||
        "Could not download the audit PDF."
    );
  }

  const blob = await response.blob();
  const disposition =
    response.headers.get(
      "content-disposition"
    ) || "";
  const filename =
    disposition.match(
      /filename="?([^";]+)"?/i
    )?.[1] ||
    `${report.kind || "mini"}-audit.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function leadIdentity(lead = {}) {
  return (
    String(lead.placeId || "").trim() ||
    String(lead.domain || "").trim().toLowerCase() ||
    safeHostname(lead.website) ||
    String(lead.email || "").trim().toLowerCase() ||
    String(lead.phone || "").replace(/\D/g, "") ||
    `${String(lead.name || lead.business || "").trim().toLowerCase()}|${String(
      lead.address || ""
    )
      .trim()
      .toLowerCase()}`
  );
}

function safeHostname(value) {
  try {
    return new URL(String(value || ""))
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function mergeLeadCollections(
  current = [],
  incoming = []
) {
  const map = new Map();

  for (const lead of [
    ...(Array.isArray(current) ? current : []),
    ...(Array.isArray(incoming) ? incoming : []),
  ]) {
    if (!lead) continue;

    const key =
      leadIdentity(lead) ||
      `lead-${map.size}`;
    const existing = map.get(key);

    map.set(
      key,
      existing
        ? {
            ...existing,
            ...lead,
            name:
              lead.name ||
              existing.name,
            business:
              lead.business ||
              existing.business,
            website:
              lead.website ||
              existing.website,
            domain:
              lead.domain ||
              existing.domain,
            email:
              lead.email ||
              existing.email,
            phone:
              lead.phone ||
              existing.phone,
            address:
              lead.address ||
              existing.address,
            signals: [
              ...new Set([
                ...(existing.signals || []),
                ...(lead.signals || []),
              ]),
            ],
          }
        : lead
    );
  }

  return [...map.values()];
}

function applyLeadStreamEvent(
  current,
  event,
  requestedLimit
) {
  const base = current || {
    status: "loading",
    streaming: true,
    requested: requestedLimit,
    delivered: 0,
    shortfall: requestedLimit,
    percent: 2,
    message:
      "Connecting to Google Places…",
    leads: [],
    startedAt: Date.now(),
  };

  if (event.type === "started") {
    return {
      ...base,
      status: "loading",
      streaming: true,
      requested:
        Number(event.requested) ||
        requestedLimit,
      percent: Math.max(
        2,
        Number(base.percent || 0)
      ),
      message:
        event.message ||
        base.message,
    };
  }

  if (event.type === "progress") {
    const progressEvent =
      event.progress || {};

    return {
      ...base,
      status: "loading",
      streaming: true,
      percent: Math.max(
        Number(base.percent || 0),
        Math.min(
          99,
          Number(
            progressEvent.percent ||
              base.percent ||
              2
          )
        )
      ),
      stage:
        progressEvent.type ||
        base.stage ||
        "searching",
      message:
        progressEvent.message ||
        base.message,
      meta: {
        ...(base.meta || {}),
        progress:
          progressEvent.meta || {},
      },
    };
  }

  if (event.type === "leads") {
    const leads =
      mergeLeadCollections(
        base.leads,
        event.leads
      );

    return {
      ...base,
      status: "loading",
      streaming: true,
      leads,
      delivered: leads.length,
      shortfall: Math.max(
        0,
        Number(
          base.requested ||
            requestedLimit
        ) - leads.length
      ),
      phase:
        event.phase ||
        base.phase ||
        "discovery",
      message:
        event.phase === "enrichment"
          ? `Verifying contact details while ${leads.length} leads are ready to review.`
          : `${leads.length} leads discovered. More results are loading…`,
    };
  }

  if (event.type === "complete") {
    const result =
      event.result || {};
    const leads =
      Array.isArray(result.leads)
        ? mergeLeadCollections(
            [],
            result.leads
          )
        : base.leads || [];

    return {
      ...base,
      ...result,
      leads,
      status:
        result.status ||
        "completed",
      streaming: false,
      percent: 100,
      requested:
        Number(
          result.requested ||
            base.requested ||
            requestedLimit
        ),
      delivered:
        Number(
          result.delivered ??
            leads.length
        ),
      shortfall:
        Number(
          result.shortfall ??
            Math.max(
              0,
              requestedLimit -
                leads.length
            )
        ),
      completedAt: Date.now(),
      error: "",
    };
  }

  return base;
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactNormalize(value) {
  return normalize(value).replace(/\s+/g, "");
}

function cityValue(city, stateName, countryName) {
  return [city.name, stateName || city.stateCode, countryName]
    .filter(Boolean)
    .join(", ");
}

function unique(options) {
  const seen = new Set();

  return options.filter((option) => {
    const key = compactNormalize(option.value || option.label);

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function locationAliases(country) {
  const name = country.name;
  const code = country.isoCode;
  const aliases = [];

  if (code === "US") aliases.push("usa", "u s a", "united states america", "america");
  if (code === "GB") aliases.push("uk", "u k", "great britain", "england");
  if (code === "AE") aliases.push("uae", "u a e", "emirates", "dubai");
  if (code === "PK") aliases.push("pak", "pakistan");
  if (code === "SA") aliases.push("ksa", "saudi", "saudi arabia");

  return [name, code, ...aliases].join(" ");
}

function cityAliases(city, stateName, countryName) {
  const cityName = normalize(city.name);
  const aliases = [];

  if (cityName === "new york") {
    aliases.push("newyork", "nyc", "new york city");
  }

  if (cityName === "los angeles") {
    aliases.push("losangeles", "la", "l a");
  }

  if (cityName === "san francisco") {
    aliases.push("sanfrancisco", "sf", "s f");
  }

  if (cityName === "las vegas") {
    aliases.push("lasvegas");
  }

  if (cityName === "abu dhabi") {
    aliases.push("abudhabi");
  }

  return [
    city.name,
    stateName,
    city.stateCode,
    countryName,
    city.countryCode,
    ...aliases,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function Builder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const streamControllerRef = useRef(null);

  const builderBootstrapRef =
    useRef({
      key: "",
      promise: null,
      loadedAt: 0,
    });

  const role = normalizeWorkspaceRole(
    user?.workspaceRole ||
      user?.role ||
      ""
  );

  const canManage = [
    "owner",
    "admin",
    "manager",
  ].includes(role);

  const showingResults =
    searchParams.get("view") ===
    "results";

  const [restoredState] = useState(() => readPersistedBuilderState());

  const [step, setStep] = useState(
    () => restoredState?.step ?? 0
  );
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState(
    () => restoredState?.form || initial
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [leadResult, setLeadResult] = useState(
    () => restoredState?.leadResult || null
  );
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedCallLead, setSelectedCallLead] = useState(null);

  const [callers, setCallers] = useState([]);
  const [selectedCallerId, setSelectedCallerId] = useState("");
  const [assignmentLeadCount, setAssignmentLeadCount] = useState(10);
  const [assignmentCampaignId, setAssignmentCampaignId] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignmentError, setAssignmentError] = useState("");

  const [voiceWorkspace, setVoiceWorkspace] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [voiceLaunchCount, setVoiceLaunchCount] = useState(10);
  const [voiceLaunchConfirmed, setVoiceLaunchConfirmed] = useState(false);
  const [voiceLaunching, setVoiceLaunching] = useState(false);
  const [voiceLaunchMessage, setVoiceLaunchMessage] = useState("");
  const [voiceLaunchError, setVoiceLaunchError] = useState("");

  const isCompany =
  user?.accountType === "company" ||
  user?.workspaceType === "company" ||
  user?.companyAccount === true;

  const workspace = useMemo(() => {
    return {
      accountType: isCompany ? "company" : "individual",
      companyName: isCompany ? user?.companyName || "" : "",
      role:
      user?.workspaceRole ||
      user?.role ||
      "",
      name: user?.name || "",
      email: user?.email || "",
      title: isCompany
        ? user?.companyName || "Company workspace"
        : user?.name || "Individual workspace",
      label: isCompany ? "Company account" : "Individual account",
      icon: isCompany ? Building2 : UserRound,
    };
  }, [isCompany, user]);

  const voiceAgent = voiceWorkspace?.agent || {};
  const voiceDiagnostics = voiceWorkspace?.diagnostics || {};
  const voiceNumber =
    voiceAgent.fromNumber ||
    voiceDiagnostics.selectedFromNumber ||
    "";
  const voiceReady = Boolean(
    voiceWorkspace &&
      voiceAgent.enabled !== false &&
      voiceAgent.complianceConfirmed === true &&
      voiceNumber &&
      (
        voiceDiagnostics.configured === true ||
        voiceWorkspace?.ready === true ||
        voiceWorkspace?.status?.ready === true
      )
  );
  const aiCalling = billingData?.aiCalling || null;
  const aiCallBalance = Number(
    aiCalling?.wallet?.balance ??
      aiCalling?.wallet?.available ??
      0
  );
  const aiCallCreditsKnown = Boolean(aiCalling?.wallet);

  useEffect(() => {
    if (!canManage) {
      setCampaigns([]);
      setEmailAccounts([]);
      setCallers([]);
      setSelectedCallerId("");

      return undefined;
    }

    let active = true;

    const bootstrapKey = [
      user?.id || "",
      user?.workspaceId ||
        "",
      role,
    ].join(":");

    async function loadBuilderData() {
      const cached =
        builderBootstrapRef
          .current;

      let requestPromise;

      if (
        cached.key ===
          bootstrapKey &&
        cached.promise &&
        Date.now() -
          cached.loadedAt <
          30_000
      ) {
        /*
         * React StrictMode runs this effect twice in development.
         * Reuse the existing request, but still await and process
         * its results in the currently active effect.
         */

        requestPromise =
          cached.promise;
      } else {
        requestPromise =
          Promise.allSettled([
            api.campaigns(),
            api.emailSettings(),
            requestWorkspaceTeamResources(),
            apiRequest(
              "/telnyx/ai-agent/dashboard",
              { timeoutMs: 20_000 }
            ),
            apiRequest(
              "/billing/credits",
              { timeoutMs: 15_000 }
            ),
          ]);

        builderBootstrapRef.current =
          {
            key:
              bootstrapKey,

            promise:
              requestPromise,

            loadedAt:
              Date.now(),
          };
      }

      const [
        campaignResult,
        emailResult,
        teamResult,
        voiceResult,
        billingResult,
      ] =
        await requestPromise;

      if (!active) {
        return;
      }

      if (
        campaignResult.status ===
        "fulfilled"
      ) {
        const response =
          campaignResult.value;

        setCampaigns(
          Array.isArray(
            response
          )
            ? response
            : Array.isArray(
                  response
                    ?.campaigns
                )
              ? response
                  .campaigns
              : []
        );
      } else {
        setCampaigns([]);
      }

      if (
        emailResult.status ===
        "fulfilled"
      ) {
        const settings =
          emailResult.value ||
          {};

        const accounts =
          Array.isArray(
            settings.accounts
          )
            ? settings.accounts
            : settings.fromEmail ||
                settings.username
              ? [
                  settings,
                ]
              : [];

        setEmailAccounts(
          accounts
        );

        const activeId =
          settings
            .activeAccountId ||
          settings
            .activeAccount
            ?.id ||
          accounts[0]?.id ||
          "";

        if (activeId) {
          setForm(
            (current) => ({
              ...current,

              emailAccountId:
                current.emailAccountId ||
                activeId,
            })
          );
        }
      } else {

        setEmailAccounts([]);
      }

      if (
        teamResult.status ===
        "fulfilled"
      ) {
        const extractedMembers =
          extractTeamMembers(
            teamResult.value
          );

        const normalizedMembers =
          extractedMembers
            .map(
              normalizeTeamMember
            )
            .filter(Boolean);

        const members =
          normalizedMembers.filter(
            (member) =>
              [
                "owner",
                "admin",
                "manager",
                "caller",
              ].includes(member.role) &&
              member.active !==
                false &&
              member.isActive !==
                false &&
              member.status !==
                "suspended"
          );

        setCallers(
          members
        );

        setSelectedCallerId(
          (current) =>
            members.some(
              (member) =>
                member.id ===
                current
            )
              ? current
              : members[0]?.id ||
                ""
        );

        if (
          members.length ===
          0
        ) {
          setAssignmentError(
            "The team API returned no active assignment-capable team members for this workspace."
          );
        } else {
          setAssignmentError("");
        }
      } else {

        setCallers([]);
        setSelectedCallerId("");

        setAssignmentError(
          teamResult.reason
            ?.message ||
            "Team assignment resources could not be loaded."
        );
      }

      setVoiceWorkspace(
        voiceResult?.status === "fulfilled"
          ? voiceResult.value || null
          : null
      );

      setBillingData(
        billingResult?.status === "fulfilled"
          ? billingResult.value || null
          : null
      );
    }

    void loadBuilderData();

    return () => {
      active = false;
    };
  }, [
    canManage,
    role,
    user?.id,
    user?.workspaceId,
  ]);

  useEffect(() => {
    const saveTimer = window.setTimeout(() => {
      writePersistedBuilderState({
        step,
        form,
        leadResult,
      });
    }, 150);

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [step, form, leadResult]);

  useEffect(() => {
    if (!showingResults) {
      streamControllerRef.current?.abort();
      streamControllerRef.current = null;
    }
  }, [showingResults]);

  useEffect(() => {
  return () => {
    streamControllerRef.current?.abort();
  };
}, []);

useEffect(() => {
  if (!user || canManage) {
    return;
  }

  streamControllerRef.current?.abort();
  streamControllerRef.current = null;

  navigate("/app/dashboard", {
    replace: true,
  });
}, [
  canManage,
  navigate,
  user,
]);

const set = (key, value) => {
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const valid = [
    form.niche.trim().length > 1,
    form.location.trim().length > 1,
    true,
    true,
  ][step];

  const countries = useMemo(() => Country.getAllCountries(), []);

  const locationIndex = useMemo(() => {
    const countryByCode = countries.reduce((acc, country) => {
      acc[country.isoCode] = country;
      return acc;
    }, {});

    const stateByKey = State.getAllStates().reduce((acc, state) => {
      acc[`${state.countryCode}-${state.isoCode}`] = state;
      return acc;
    }, {});

    const countryOptions = countries.map((country) => {
      const searchSource = locationAliases(country);

      return {
        id: `country-${country.isoCode}`,
        type: "country",
        value: country.name,
        label: country.name,
        meta: "Country / region",
        flag: country.flag || "🏳️",
        priority: 1,
        searchText: normalize(searchSource),
        compactSearchText: compactNormalize(searchSource),
      };
    });

    const stateOptions = State.getAllStates().map((state) => {
      const country = countryByCode[state.countryCode];
      const countryName = country?.name || state.countryCode;
      const value = [state.name, countryName].filter(Boolean).join(", ");
      const searchSource = `${state.name} ${state.isoCode} ${countryName} ${state.countryCode}`;

      return {
        id: `state-${state.countryCode}-${state.isoCode}`,
        type: "state",
        value,
        label: state.name,
        meta: countryName,
        flag: country?.flag || "🏳️",
        priority: 2,
        searchText: normalize(searchSource),
        compactSearchText: compactNormalize(searchSource),
      };
    });

    const cityOptions = City.getAllCities().map((city, index) => {
      const country = countryByCode[city.countryCode];
      const countryName = country?.name || city.countryCode;
      const state = stateByKey[`${city.countryCode}-${city.stateCode}`];
      const stateName = state?.name || city.stateCode;
      const value = cityValue(city, stateName, countryName);
      const searchSource = cityAliases(city, stateName, countryName);

      return {
        id: `city-${city.countryCode}-${city.stateCode}-${city.name}-${index}`,
        type: "city",
        value,
        label: city.name,
        meta: [stateName, countryName].filter(Boolean).join(", "),
        flag: country?.flag || "🏳️",
        priority: 3,
        searchText: normalize(searchSource),
        compactSearchText: compactNormalize(searchSource),
      };
    });

    return [...countryOptions, ...stateOptions, ...cityOptions];
  }, [countries]);

  const suggestions = useMemo(() => {
    const query = normalize(form.location);
    const compactQuery = compactNormalize(form.location);
    const typedValue = form.location.trim();

    if (query.length < MIN) return [];

    const typedOption = {
      id: `typed-${compactQuery}`,
      type: "typed",
      value: typedValue,
      label: typedValue,
      meta: "Use this custom location",
      flag: "➕",
      priority: 9,
    };

    const saved = campaigns
      .filter((campaign) => {
        const savedLocation = campaign.location || "";
        return (
          normalize(savedLocation).includes(query) ||
          compactNormalize(savedLocation).includes(compactQuery)
        );
      })
      .map((campaign) => ({
        id: `saved-${campaign.id}`,
        type: "saved",
        value: campaign.location,
        label: campaign.location,
        meta: "Saved campaign market",
        flag: "📌",
        priority: 0,
      }));

    const exact = [];
    const starts = [];
    const compactStarts = [];
    const wordStarts = [];
    const contains = [];

    for (const item of locationIndex) {
      const label = normalize(item.label);
      const value = normalize(item.value);
      const compactLabel = compactNormalize(item.label);
      const compactValue = compactNormalize(item.value);

      if (
        label === query ||
        value === query ||
        compactLabel === compactQuery ||
        compactValue === compactQuery
      ) {
        exact.push(item);
      } else if (label.startsWith(query) || value.startsWith(query)) {
        starts.push(item);
      } else if (
        compactLabel.startsWith(compactQuery) ||
        compactValue.startsWith(compactQuery) ||
        item.compactSearchText.startsWith(compactQuery)
      ) {
        compactStarts.push(item);
      } else if (item.searchText.split(" ").some((part) => part.startsWith(query))) {
        wordStarts.push(item);
      } else if (
        item.searchText.includes(query) ||
        item.compactSearchText.includes(compactQuery)
      ) {
        contains.push(item);
      }
    }

    return unique([
      ...saved,
      ...exact,
      ...starts,
      ...compactStarts,
      ...wordStarts,
      ...contains,
      typedOption,
    ])
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return String(a.label).localeCompare(String(b.label));
      })
      .slice(0, MAX_LOCATION_RESULTS);
  }, [campaigns, form.location, locationIndex]);

  const duplicateMatches = useMemo(() => {
    const niche = normalize(form.niche);
    const location = normalize(form.location);

    if (!niche || !location) return [];

    return campaigns.filter(
      (campaign) =>
        normalize(campaign.niche) === niche &&
        normalize(campaign.location) === location
    );
  }, [campaigns, form.niche, form.location]);

  function move(next) {
    if (next > step && !valid) {
      setError("Please complete this detail before continuing.");
      return;
    }

    setError("");
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setLocationOpen(false);
  }

  async function submit() {
  if (!canManage) {
    setError(
      "Only workspace managers can generate leads and create campaigns."
    );

    return;
  }

  if (!form.niche.trim()) {
      setError(
        "Target niche is required."
      );

      return;
    }

    if (!form.location.trim()) {
      setError(
        "Location is required."
      );

      return;
    }

    streamControllerRef.current?.abort();

    const controller =
      new AbortController();
    streamControllerRef.current =
      controller;

    const requestedLimit = Number(
      form.limit || 100
    );

    setSaving(true);
    setError("");
    setLeadSearch("");
    setLeadResult({
      status: "loading",
      streaming: true,
      requested: requestedLimit,
      delivered: 0,
      shortfall: requestedLimit,
      percent: 2,
      message:
        "Connecting to Google Places…",
      leads: [],
      startedAt: Date.now(),
      search: {
        niche: form.niche.trim(),
        location:
          form.location.trim(),
        qualityLevel:
          form.qualityLevel,
      },
    });

    navigate(
      "/app/leads?view=results"
    );

    try {
      await requestGoogleLeadsStream(
        {
          niche:
            form.niche.trim(),
          location:
            form.location.trim(),
          radiusKm:
            form.radiusKm,
          limit:
            requestedLimit,
          qualityLevel:
            form.qualityLevel,
        },
        {
          signal:
            controller.signal,
          onEvent: (event) => {
            setLeadResult(
              (current) =>
                applyLeadStreamEvent(
                  current,
                  event,
                  requestedLimit
                )
            );
          },
        }
      );
    } catch (e) {
      if (
        e?.name ===
        "AbortError"
      ) {
        return;
      }

      setLeadResult((current) => ({
        ...(current || {}),
        status: "error",
        streaming: false,
        percent:
          Number(
            current?.percent || 0
          ),
        error:
          e?.message ||
          "Could not retrieve Google Places leads.",
        message:
          e?.message ||
          "Could not retrieve Google Places leads.",
      }));

      setError(
        e?.message ||
          "Could not retrieve Google Places leads."
      );
    } finally {
      if (
        streamControllerRef.current ===
        controller
      ) {
        streamControllerRef.current =
          null;
      }

      setSaving(false);
    }
  }

  async function createAssignmentCampaign(
  leads
) {
  const created =
    await api.createCampaign({
      name:
        `${form.niche.trim()} — ${form.location.trim()}`,
      niche:
        form.niche.trim(),
      location:
        form.location.trim(),
      radiusKm:
        Number(
          form.radiusKm ||
            10
        ),
      limit:
        leads.length,
      qualityLevel:
        form.qualityLevel ||
        "balanced",
      goal:
        form.goal ||
        "both",
      offer:
        form.offer ||
        "",
      emailAccountId:
        form.emailAccountId ||
        "",
      voiceEnabled:
        form.voiceEnabled === true,
      outreachPlan: {
        aiVoice: form.voiceEnabled === true,
        digitalChannel: form.goal || "both",
        pipeline: buildBuilderPipeline(form),
      },
      source:
        "external-import",
      externalImport:
        true,
      selectedSegment:
        form.niche.trim(),
      leads,
      totalRows:
        leads.length,
      validEmails:
        leads.filter(
          (lead) =>
            isDisplayableEmail(
              lead.email
            )
        ).length,
      missingEmails:
        leads.filter(
          (lead) =>
            !isDisplayableEmail(
              lead.email
            )
        ).length,
    });

  const campaignId =
    created?.id ||
    created?.campaign?.id ||
    "";

  if (!campaignId) {
    throw new Error(
      "The campaign was created without a campaign ID."
    );
  }

  setAssignmentCampaignId(
    campaignId
  );

  return campaignId;
}

async function assignLeadsToCaller() {
  const leads =
    Array.isArray(
      leadResult?.leads
    )
      ? leadResult.leads
      : [];

  const requestedCount =
    Math.max(
      1,
      Math.min(
        leads.length,
        Number(
          assignmentLeadCount ||
            1
        )
      )
    );

  const selectedLeads =
    leads.slice(
      0,
      requestedCount
    );

  if (!selectedLeads.length) {
    setAssignmentError(
      "There are no generated leads available to assign."
    );
    return;
  }

  if (!selectedCallerId) {
    setAssignmentError(
      "Select a team member before assigning leads."
    );
    return;
  }

  setAssignmentSaving(true);
  setAssignmentError("");
  setAssignmentMessage("");

  try {
    /*
     * Save only the exact number of leads selected by the
     * manager. This avoids identity mismatches between the
     * generated result and the saved campaign.
     */
    const campaignId =
      await createAssignmentCampaign(
        selectedLeads
      );

    const result =
      await api.bulkAssignLeads(
        campaignId,
        {
          memberIds: [
            selectedCallerId,
          ],
          assigneeIds: [
            selectedCallerId,
          ],
          strategy:
            "round_robin",
          onlyUnassigned:
            true,
        }
      );

    const updated =
      Number(
        result?.updated ??
          result?.assigned ??
          selectedLeads.length
      );

    const caller =
      callers.find(
        (member) =>
          member.id ===
          selectedCallerId
      );

    const callerName =
      caller?.name ||
      caller?.fullName ||
      caller?.email ||
      "the selected team member";

    setAssignmentMessage(
      `${updated} lead${
        updated === 1
          ? ""
          : "s"
      } assigned to ${callerName}. They will appear in that team member's assigned lead queue.`
    );

    const assignedKeys =
      new Set(
        selectedLeads
          .map(
            leadIdentity
          )
          .filter(Boolean)
      );

    setLeadResult(
      (current) => ({
        ...(current || {}),
        leads:
          (
            current?.leads ||
            []
          ).map(
            (lead) =>
              assignedKeys.has(
                leadIdentity(
                  lead
                )
              )
                ? {
                    ...lead,
                    assignedTo:
                      selectedCallerId,
                    assigneeId:
                      selectedCallerId,
                    assignedToName:
                      callerName,
                  }
                : lead
          ),
      })
    );
  } catch (
    requestError
  ) {
    setAssignmentError(
      requestError?.message ||
        "The leads could not be assigned."
    );
  } finally {
    setAssignmentSaving(false);
  }
}

async function launchGeneratedLeadsWithVoice() {
  const leads = Array.isArray(leadResult?.leads)
    ? leadResult.leads
    : [];
  const eligible = leads
    .filter((lead) => String(lead?.phone || "").trim())
    .slice(0, Math.max(1, Math.min(100, Number(voiceLaunchCount || 1))));

  if (!form.voiceEnabled) {
    setVoiceLaunchError(
      "Enable AI Voice in the campaign settings before launching automated calls."
    );
    return;
  }

  if (!voiceReady) {
    setVoiceLaunchError(
      "The Voice Agent is not launch-ready. Complete agent identity, verified business number, calling policy, and activation first."
    );
    return;
  }

  if (aiCallCreditsKnown && aiCallBalance <= 0) {
    setVoiceLaunchError(
      "This workspace has no AI call credits available. Review Credits & usage before launching calls."
    );
    return;
  }

  if (!voiceLaunchConfirmed) {
    setVoiceLaunchError(
      "Confirm the AI calling disclosure and recording-aware launch acknowledgement first."
    );
    return;
  }

  if (!eligible.length) {
    setVoiceLaunchError(
      "No generated leads with phone numbers are available for AI calling."
    );
    return;
  }

  setVoiceLaunching(true);
  setVoiceLaunchError("");
  setVoiceLaunchMessage("");

  try {
    const campaignId = await createAssignmentCampaign(eligible);
    const queueResults = await mapWithConcurrency(
      eligible,
      4,
      async (lead) =>
        apiRequest(
          "/telnyx/ai-agent/leads/custom",
          {
            method: "POST",
            body: {
              contactName: lead.contactName || lead.name || "",
              companyName: lead.business || lead.companyName || lead.name || "",
              phone: lead.phone,
              email: isDisplayableEmail(lead.email) ? lead.email : "",
              website: lead.website || "",
              location: lead.address || lead.location || form.location || "",
              timezone: lead.timezone || lead.timeZone || "",
              context: [
                `Campaign: ${form.niche} in ${form.location}`,
                form.offer ? `Offer: ${form.offer}` : "",
                lead.category ? `Lead category: ${lead.category}` : "",
              ].filter(Boolean).join(" · "),
              callNow: false,
              testCall: false,
              testCallConfirmed: false,
              defaultTimezone: voiceAgent.defaultLeadTimezone || "",
              maxAttempts: Number(voiceAgent.maxAttempts || 3),
              dailyCallLimit: Number(voiceAgent.dailyCallLimit || 25),
              fromNumber: voiceNumber,
              campaignId,
            },
            timeoutMs: 30_000,
          }
        )
    );

    const queued = queueResults.filter(
      (item) => item.status === "fulfilled"
    );
    const failed = queueResults.filter(
      (item) => item.status === "rejected"
    );

    if (!queued.length) {
      throw new Error(
        failed[0]?.reason?.message ||
          "No generated leads could be added to the AI calling queue."
      );
    }

    const queueIds = queued
      .map((item) => item.value?.queueId)
      .filter(Boolean);

    const launch = await apiRequest(
      "/telnyx/ai-agent/campaigns/start",
      {
        method: "POST",
        body: {
          queueIds,
          limit: queued.length,
          concurrency: Number(voiceAgent.concurrency || 1),
          dailyCallLimit: Number(voiceAgent.dailyCallLimit || 25),
          fromNumber: voiceNumber,
        },
        timeoutMs: 60_000,
      }
    );

    const launched = Number(launch?.started || 0);
    const deferred = Number(launch?.deferred || 0);
    const launchFailed = Number(launch?.failed || 0);

    setVoiceLaunchMessage(
      `${queued.length} lead${queued.length === 1 ? "" : "s"} queued for AI Voice. ` +
        `${launched} call${launched === 1 ? "" : "s"} started` +
        `${deferred ? ` · ${deferred} deferred by policy` : ""}` +
        `${launchFailed || failed.length ? ` · ${launchFailed + failed.length} not started` : ""}.`
    );

    const launchedKeys = new Set(
      eligible.map(leadIdentity).filter(Boolean)
    );
    setLeadResult((current) => ({
      ...(current || {}),
      leads: (current?.leads || []).map((lead) =>
        launchedKeys.has(leadIdentity(lead))
          ? { ...lead, aiVoiceQueued: true, campaignId }
          : lead
      ),
    }));

    const [voiceRefresh, billingRefresh] = await Promise.allSettled([
      apiRequest("/telnyx/ai-agent/dashboard", { timeoutMs: 20_000 }),
      apiRequest("/billing/credits", { timeoutMs: 15_000 }),
    ]);

    if (voiceRefresh.status === "fulfilled") {
      setVoiceWorkspace(voiceRefresh.value);
    }
    if (billingRefresh.status === "fulfilled") {
      setBillingData(billingRefresh.value);
    }
  } catch (requestError) {
    setVoiceLaunchError(
      requestError?.message ||
        "The AI Voice campaign could not be launched."
    );
  } finally {
    setVoiceLaunching(false);
  }
}

function clearLeadResponse() {
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    setLeadResult(null);
    setLeadSearch("");
    setSelectedLead(null);
    setError("");
    navigate("/app/leads", {
      replace: true,
    });
  }

  function downloadLeads(
    leads = []
  ) {
    const safeLeads =
      Array.isArray(leads)
        ? leads.filter(Boolean)
        : [];

    const headers = [
      "Business",
      "Website",
      "Email",
      "Phone",
      "Address",
      "Category",
      "Quality Score",
      "Place ID",
    ];

    const escapeCsv = (
      value
    ) => {
      const text = String(
        value ?? ""
      );

      return `"${text.replace(
        /"/g,
        '""'
      )}"`;
    };

    const rows =
      safeLeads.map(
        (lead) => [
          lead.business ||
            lead.name ||
            "",
          lead.website || "",
          isDisplayableEmail(lead.email)
            ? lead.email
            : "",
          lead.phone || "",
          lead.address || "",
          lead.category || "",
          lead.qualityScore ??
            lead.confidence ??
            "",
          lead.placeId || "",
        ]
          .map(escapeCsv)
          .join(",")
      );

    const csv = [
      headers
        .map(escapeCsv)
        .join(","),
      ...rows,
    ].join("\n");

    const blob = new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href = url;
    anchor.download =
      `reachfly-google-leads-${safeLeads.length}.csv`;

    document.body.appendChild(
      anchor
    );

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(
      url
    );
  }

  const WorkspaceIcon = workspace.icon;

if (!canManage) {
  return (
    <div className="page builder-page">
      <style>{BUILDER_V7_CSS}</style>
      <div className="card">
        <span className="eyebrow">
          Restricted workspace feature
        </span>

        <h1>
          Campaign management access required
        </h1>

        <p className="text-muted">
          Lead generation and campaign controls are available to workspace owners, administrators, and managers.
        </p>

        <button
          type="button"
          className="btn primary mt16"
          onClick={() =>
            navigate(
              "/app/dashboard",
              {
                replace: true,
              }
            )
          }
        >
          Return to dashboard
        </button>
      </div>
    </div>
  );
}

if (showingResults) {
    return (
      <>
        <LiveLeadResultsPage
          result={leadResult}
          form={form}
          workspace={workspace}
          search={leadSearch}
          onSearch={setLeadSearch}
          onBack={clearLeadResponse}
          onRetry={submit}
          onOpenAudit={setSelectedLead}
          onCall={setSelectedCallLead}
          callers={callers}
          selectedCallerId={
            selectedCallerId
          }
          onSelectCaller={
            setSelectedCallerId
          }
          assignmentLeadCount={
            assignmentLeadCount
          }
          onAssignmentLeadCountChange={
            setAssignmentLeadCount
          }
          onAssign={
            assignLeadsToCaller
          }
          assignmentSaving={
            assignmentSaving
          }
          assignmentMessage={
            assignmentMessage
          }
          assignmentError={
            assignmentError
          }
          assignmentCampaignId={
            assignmentCampaignId
          }
          voiceEnabled={form.voiceEnabled === true}
          voiceReady={voiceReady}
          voiceNumber={voiceNumber}
          voiceLaunchCount={voiceLaunchCount}
          onVoiceLaunchCount={setVoiceLaunchCount}
          voiceLaunchConfirmed={voiceLaunchConfirmed}
          onVoiceLaunchConfirmed={setVoiceLaunchConfirmed}
          voiceLaunching={voiceLaunching}
          voiceLaunchMessage={voiceLaunchMessage}
          voiceLaunchError={voiceLaunchError}
          aiCallBalance={aiCallBalance}
          aiCallCreditsKnown={aiCallCreditsKnown}
          onLaunchVoice={() => void launchGeneratedLeadsWithVoice()}
          onOpenVoice={() => navigate("/app/voice-agent")}
          onOpenBilling={() => navigate("/app/billing")}
          onDownload={() =>
            downloadLeads(
              leadResult?.leads || []
            )
          }
        />

        <CallLeadDrawer
          lead={selectedCallLead}
          form={form}
          workspace={workspace}
          voiceWorkspace={voiceWorkspace}
          billingData={billingData}
          onOpenVoice={() => navigate("/app/voice-agent")}
          onOpenBilling={() => navigate("/app/billing")}
          onOpenAudit={() => {
            setSelectedLead(selectedCallLead);
            setSelectedCallLead(null);
          }}
          onClose={() => setSelectedCallLead(null)}
        />

        <LeadAuditDrawer
          lead={selectedLead}
          form={form}
          workspace={workspace}
          onClose={() =>
            setSelectedLead(null)
          }
        />
      </>
    );
  }

  const panels = [
    <Step
      eyebrow="Click 1 of 4"
      title="Who do you want to reach?"
      text="Choose the business niche you want to contact and convert into clients."
    >
      <WorkspaceSummary workspace={workspace} icon={WorkspaceIcon} />

      <Field
        label="Target niche"
        value={form.niche}
        onChange={(value) => set("niche", value)}
        placeholder="e.g. Dentists, med spas, law firms"
        icon={Target}
        autoFocus
      />

      <div className="suggestions">
        {[
          "Dentists",
          "Med spas",
          "Roofing companies",
          "Law firms",
          "Real estate agents",
        ].map((item) => (
          <button key={item} type="button" onClick={() => set("niche", item)}>
            {item}
          </button>
        ))}
      </div>

      {duplicateMatches.length > 0 ? (
        <Duplicate
          matches={duplicateMatches}
          onOpen={() => navigate(`/app/campaigns/${duplicateMatches[0].id}`)}
        />
      ) : null}
    </Step>,

    <Step
      eyebrow="Click 2 of 4"
      title="Where should we find them?"
      text="Search by city, state, country, or region. You can also use a custom location."
    >
      <LocationField
        value={form.location}
        onChange={(value) => {
          set("location", value);
          setLocationOpen(value.trim().length >= MIN);
        }}
        onSelect={(value) => {
          set("location", value);
          setLocationOpen(false);
        }}
        suggestions={suggestions}
        open={locationOpen}
        setOpen={setLocationOpen}
      />

      {duplicateMatches.length > 0 ? (
        <Duplicate
          matches={duplicateMatches}
          onOpen={() => navigate(`/app/campaigns/${duplicateMatches[0].id}`)}
        />
      ) : null}

      <label className="range-label campaign-radius-range">
        <span>
          Search radius <b>{form.radiusKm} km</b>
        </span>

        <input
          type="range"
          min="1"
          max={MAX_RADIUS_KM}
          step="1"
          value={form.radiusKm}
          onChange={(event) => set("radiusKm", clampRadius(event.target.value))}
        />

        <div className="radius-quick-options">
          {[10, 25, 50, 100, 250, 500, 1000].map((radius) => (
            <button
              key={radius}
              type="button"
              className={Number(form.radiusKm) === radius ? "active" : ""}
              onClick={() => set("radiusKm", radius)}
            >
              {radius} km
            </button>
          ))}
        </div>

        <small>Focused local search</small>
        <small>Wide regional search up to 1000 km</small>
      </label>
    </Step>,

    <Step
      eyebrow="Click 3 of 4"
      title="How should this campaign run?"
      text="Set lead volume, digital follow-up, and whether the ReachFly AI Voice Agent should call generated leads."
    >
      <div className="launch-settings">
        <label>
          <span>Lead goal</span>
          <select
            value={form.limit}
            onChange={(event) => set("limit", Number(event.target.value))}
          >
            <option value="50">50 leads</option>
            <option value="100">100 leads</option>
            <option value="250">250 leads</option>
            <option value="500">500 leads</option>
            <option value="1000">1,000 leads</option>
          </select>
        </label>

        <label>
          <span>Search depth</span>
          <select
            value={form.qualityLevel}
            onChange={(event) => set("qualityLevel", event.target.value)}
          >
            <option value="strict">Strict</option>
            <option value="balanced">Balanced</option>
            <option value="expanded">Expanded</option>
          </select>
        </label>

        <label>
          <span>Digital follow-up</span>
          <select
            value={form.goal}
            onChange={(event) => set("goal", event.target.value)}
          >
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="both">Email + WhatsApp</option>
          </select>
        </label>
      </div>

      <CampaignVoiceOption
        enabled={form.voiceEnabled === true}
        onChange={(enabled) => set("voiceEnabled", enabled)}
        ready={voiceReady}
        number={voiceNumber}
        aiCallBalance={aiCallBalance}
        creditsKnown={aiCallCreditsKnown}
        onSetup={() => navigate("/app/voice-agent")}
        onBilling={() => navigate("/app/billing")}
      />

      {["email", "both"].includes(form.goal) ? (
        <EmailAccountSelector
          accounts={emailAccounts}
          value={form.emailAccountId}
          onChange={(value) => set("emailAccountId", value)}
          onSetup={() => navigate("/app/email")}
        />
      ) : null}

      <Field
        label="Offer / service"
        value={form.offer}
        onChange={(value) => set("offer", value)}
        placeholder="e.g. A conversion-focused website redesign"
      />
    </Step>,

    <Step
      eyebrow="Click 4 of 4"
      title="Ready to build your market?"
      text="Review lead discovery and outreach readiness. Generated leads can then be assigned to an active workspace team member or launched through AI Voice from the results screen."
    >
      <div className="sentence-card">
        <span className="sentence-card-eyebrow">Campaign summary</span>

        <p>
          <b>{workspace.title}</b>{" "}
          {workspace.role ? (
            <>
              represented by <b>{workspace.role}</b>{" "}
            </>
          ) : null}
          wants to reach <b>{form.niche || "selected niche"}</b> in{" "}
          <b>{form.location || "selected market"}</b>.
        </p>

        {form.offer ? (
          <small>
            Offer: <b>{form.offer}</b>
          </small>
        ) : null}
      </div>

      {duplicateMatches.length > 0 ? (
        <Duplicate
          matches={duplicateMatches}
          onOpen={() => navigate(`/app/campaigns/${duplicateMatches[0].id}`)}
        />
      ) : null}

      <ReviewGrid
        items={[
          ["Workspace", workspace.title],
          ["Account type", workspace.label],
          ["Target niche", form.niche || "Not selected"],
          ["Market", form.location || "Not selected"],
          ["Radius", `${form.radiusKm} km`],
          ["Lead goal", `${form.limit} leads`],
          ["Search depth", form.qualityLevel],
          ["Digital follow-up", formatChannel(form.goal)],
          [
            "AI Voice",
            form.voiceEnabled
              ? voiceReady
                ? "Enabled · ready to launch"
                : "Enabled · setup required"
              : "Not enabled",
          ],
          [
            "Sender email",
            getSelectedEmailLabel(emailAccounts, form.emailAccountId) ||
              (["email", "both"].includes(form.goal)
                ? "No sender selected"
                : "Not required"),
          ],
        ]}
      />
    </Step>,
  ];

  return (
    <div className="builder-page">
      <style>{BUILDER_V7_CSS}</style>
      <div className="page-top">
        <div>
          <span className="eyebrow">Campaign builder</span>
          <h1>Four clicks from market to outreach.</h1>
          <p className="builder-subtitle">
            Your signup details are already saved, so this builder only asks for
            campaign-specific targeting and outreach details.
          </p>
        </div>

        <span className="step-count">
          {step + 1}
          <small>/ 4</small>
        </span>
      </div>

      <div className="step-line">
        {panels.map((_, index) => (
          <i key={index} className={index <= step ? "active" : ""} />
        ))}
      </div>

      <div className="builder-card">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            {panels[step]}
          </motion.div>
        </AnimatePresence>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="builder-actions">
          <button
            className="btn ghost"
            type="button"
            disabled={step === 0 || saving}
            onClick={() => move(step - 1)}
          >
            <ArrowLeft /> Previous
          </button>

          {step < panels.length - 1 ? (
            <button className="btn primary" type="button" onClick={() => move(step + 1)}>
              Next <ArrowRight />
            </button>
          ) : (
            <button
              className="btn primary launch"
              type="button"
              disabled={saving}
              onClick={submit}
            >
              {saving ? (
                "Getting leads…"
              ) : (
                <>
                  Get leads <Search />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <p className="builder-promise">
        <Check /> Google Places lead discovery · Official business websites
      </p>
    </div>
  );
}

function Step({ eyebrow, title, text, children }) {
  return (
    <section className="builder-step">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>

      <div className="step-fields">{children}</div>
    </section>
  );
}

function WorkspaceSummary({ workspace, icon: Icon }) {
  return (
    <div className="builder-workspace-summary">
      <span>
        <Icon size={20} />
      </span>

      <div>
        <small>Using saved signup profile</small>
        <b>{workspace.title}</b>
        <p>
          {workspace.label}
          {workspace.role ? ` · ${workspace.role}` : ""}
          {workspace.email ? ` · ${workspace.email}` : ""}
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, icon: Icon, autoFocus }) {
  return (
    <label className="field">
      <span>{label}</span>

      <div className="input-wrap">
        {Icon ? <Icon /> : null}

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
      </div>
    </label>
  );
}

function LocationField({
  value,
  onChange,
  onSelect,
  suggestions,
  open,
  setOpen,
}) {
  const show = open && value.trim().length >= MIN;

  return (
    <label className="field location-field">
      <span>City, state, country, or region</span>

      <div className="input-wrap autocomplete-wrap">
        <MapPin />

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => value.trim().length >= MIN && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 180)}
          placeholder="Type at least 2 characters, e.g. New York, Lahore, London, Dubai"
          autoComplete="off"
        />

        {show ? (
          <div className="autocomplete-menu location-menu">
            {suggestions.length === 0 ? (
              <div className="autocomplete-empty">
                No location match found. You can still use this typed location.
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion.id}
                  className={`location-option ${suggestion.type}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(suggestion.value)}
                >
                  <span className="location-flag">{suggestion.flag}</span>

                  <span className="location-copy">
                    <b>{suggestion.label}</b>
                    <small>{suggestion.meta}</small>
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <small className="location-helper">
        Search all countries, states, cities, saved markets, or use a custom
        typed location.
      </small>
    </label>
  );
}

function CampaignVoiceOption({
  enabled,
  onChange,
  ready,
  number,
  aiCallBalance,
  creditsKnown,
  onSetup,
  onBilling,
}) {
  return (
    <section className="builder-email-empty" aria-label="AI Voice campaign option">
      <span className="live-lead-detail-symbol" aria-hidden="true">☎</span>

      <div>
        <b>ReachFly AI Voice Agent</b>
        <small>
          {enabled
            ? ready
              ? `Ready${number ? ` · ${number}` : ""}. Calls identify the agent as AI and follow the workspace calling policy.`
              : "Enabled for this campaign, but Voice Agent setup must be completed before calls can launch."
            : "Optional. Enable automated AI calls alongside your selected digital follow-up."}
        </small>
        {enabled ? (
          <small>
            AI call credits: {creditsKnown ? formatCompactNumber(aiCallBalance) : "Check billing at launch"}.
            Connected-call charging remains server-authoritative.
          </small>
        ) : null}
      </div>

      <div className="flex flex-gap flex-wrap">
        <label className="option-card" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span><b>{enabled ? "AI Voice enabled" : "Enable AI Voice"}</b></span>
        </label>

        {enabled && !ready ? (
          <button className="btn small" type="button" onClick={onSetup}>
            Complete Voice Agent setup
          </button>
        ) : null}

        {enabled ? (
          <button className="btn small light" type="button" onClick={onBilling}>
            Credits & usage
          </button>
        ) : null}
      </div>
    </section>
  );
}

function AiVoiceLaunchPanel({
  enabled,
  ready,
  number,
  phoneLeadCount,
  value,
  max,
  onChange,
  confirmed,
  onConfirmed,
  launching,
  message,
  error,
  aiCallBalance,
  creditsKnown,
  onLaunch,
  onSetup,
  onBilling,
}) {
  const safeMax = Math.max(1, Number(max || 1));

  return (
    <section className="live-assignment-panel">
      <div className="live-assignment-header">
        <div>
          <span className="eyebrow">AI Voice launch</span>
          <h2>Launch generated leads through the Voice Agent</h2>
          <p>
            Queue leads with phone numbers, then start calls under the Voice Agent's
            configured calling window, suppression rules, concurrency and daily limit.
          </p>
        </div>
        <span className="live-lead-detail-symbol" aria-hidden="true">☎</span>
      </div>

      {error ? <div className="error-banner" role="alert">{error}</div> : null}
      {message ? <div className="success-banner" role="status">{message}</div> : null}

      {!enabled ? (
        <div className="safe-note-v54">
          AI Voice is not enabled for this campaign. Return to campaign settings if you want automated calls.
        </div>
      ) : null}

      {enabled && !ready ? (
        <div className="safe-note-v54">
          Voice Agent setup is incomplete. A verified business number, AI disclosure,
          calling policy and active voice runtime are required before launch.
        </div>
      ) : null}

      <div className="live-assignment-form">
        <label className="field">
          <span>Leads to call</span>
          <input
            type="number"
            min="1"
            max={safeMax}
            value={Math.max(1, Math.min(safeMax, Number(value || 1)))}
            onChange={(event) =>
              onChange(
                Math.max(1, Math.min(safeMax, Number(event.target.value || 1)))
              )
            }
          />
          <small>{phoneLeadCount} generated leads currently have phone numbers.</small>
        </label>

        <div className="field">
          <span>Launch readiness</span>
          <div className="safe-note-v54">
            {ready ? `Ready${number ? ` · ${number}` : ""}` : "Voice Agent setup required"}
            {" · "}AI call credits: {creditsKnown ? formatCompactNumber(aiCallBalance) : "unknown until billing loads"}
          </div>
        </div>
      </div>

      <label className="option-card">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmed(event.target.checked)}
          disabled={!enabled || !ready || launching}
        />
        <span>
          <b>Confirm automated AI calling launch</b>
          <small>
            I understand these are automated AI sales calls. The agent must identify
            itself as AI at the start of the call, and calls may be recorded when the
            workspace recording policy allows it.
          </small>
        </span>
      </label>

      <div className="flex flex-gap flex-wrap mt16">
        <button
          type="button"
          className="btn primary"
          disabled={
            launching || !enabled || !ready || !confirmed || !phoneLeadCount ||
            (creditsKnown && aiCallBalance <= 0)
          }
          onClick={onLaunch}
        >
          {launching ? "Launching AI calls…" : "Launch AI calls"}
        </button>

        {!ready ? (
          <button type="button" className="btn light" onClick={onSetup}>
            Open Voice Agent setup
          </button>
        ) : null}

        <button type="button" className="btn light" onClick={onBilling}>
          Credits & usage
        </button>
      </div>

      <small className="location-helper">
        ReachFly charges AI call credits only according to the billing service's
        connected-call policy. Ringing, failed, suppressed or quota-rejected calls
        must not be treated as connected by this page.
      </small>
    </section>
  );
}

function EmailAccountSelector({ accounts, value, onChange, onSetup }) {
  if (!accounts.length) {
    return (
      <div className="builder-email-empty">
        <Mail size={18} />

        <div>
          <b>No sender email connected yet</b>
          <small>
            You can launch the campaign, but email sending will need a connected
            account.
          </small>
        </div>

        <button className="btn small" type="button" onClick={onSetup}>
          Set up email
        </button>
      </div>
    );
  }

  return (
    <label className="field">
      <span>Sender email for this campaign</span>

      <div className="builder-email-select">
        <Mail size={17} />

        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Use active/default sender</option>

          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label || account.fromEmail || account.username} —{" "}
              {account.fromEmail || account.username}
            </option>
          ))}
        </select>
      </div>

      <small className="location-helper">
        This campaign will remember the selected sender account.
      </small>
    </label>
  );
}

function ReviewGrid({ items }) {
  return (
    <div className="builder-review-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

function Duplicate({ matches, onOpen }) {
  return (
    <div className="duplicate-warning">
      <div>
        <b>Leads already exist for this niche and area.</b>
        <p>
          Found {matches.length} existing campaign
          {matches.length === 1 ? "" : "s"}. Open it or continue to refresh the
          market.
        </p>
        <small>Latest: {matches[0]?.name}</small>
      </div>

      <button type="button" className="btn small" onClick={onOpen}>
        View existing
      </button>
    </div>
  );
}
const BUILDER_V7_CSS = `
.rf7-leads-page {
  min-height: calc(100vh - 128px);
  color: var(--rf7-text, #191c1d);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.rf7-leads-page *,
.rf7-leads-page *::before,
.rf7-leads-page *::after {
  box-sizing: border-box;
}

.rf7-leads-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.rf7-leads-head h1 {
  margin: 0;
  color: #191c1d;
  font-family: Geist, Inter, sans-serif;
  font-size: 32px;
  line-height: 40px;
  letter-spacing: -0.02em;
  font-weight: 650;
}

.rf7-leads-head p {
  margin: 4px 0 0;
  color: #464554;
  font-size: 14px;
  line-height: 20px;
}

.rf7-leads-head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rf7-filter-wrap {
  position: relative;
}

.rf7-leads-secondary,
.rf7-leads-primary,
.rf7-table-action {
  appearance: none;
  border: 0;
  font: inherit;
  cursor: pointer;
}

.rf7-leads-secondary,
.rf7-leads-primary {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 650;
  transition:
    transform 150ms cubic-bezier(.2,.7,.2,1),
    box-shadow 150ms cubic-bezier(.2,.7,.2,1),
    background 150ms cubic-bezier(.2,.7,.2,1);
}

.rf7-leads-secondary {
  color: #191c1d;
  background: #e7e8e9;
  border: 1px solid #e1e3e4;
}

.rf7-leads-secondary:hover,
.rf7-leads-secondary.active {
  background: #dfe0e2;
  transform: translateY(-1px);
}

.rf7-leads-primary {
  min-width: 154px;
  color: #fff;
  background: #4648d4;
  box-shadow: 0 4px 12px rgba(70,72,212,.18);
}

.rf7-leads-primary:hover {
  background: #3f41c7;
  box-shadow: 0 8px 18px rgba(70,72,212,.22);
  transform: translateY(-1px);
}

.rf7-leads-primary:active,
.rf7-leads-secondary:active {
  transform: translateY(0) scale(.985);
}

.rf7-filter-glyph {
  display: grid;
  width: 18px;
  place-items: center;
  font-size: 22px;
  line-height: 14px;
  transform: rotate(90deg);
}

.rf7-filter-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 40;
  width: 292px;
  padding: 16px;
  border: 1px solid #dfe0e5;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(20,24,31,.14);
}

.rf7-filter-popover-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #edeeef;
}

.rf7-filter-popover-head strong,
.rf7-filter-popover-head span {
  display: block;
}

.rf7-filter-popover-head strong {
  font-family: Geist, Inter, sans-serif;
  font-size: 15px;
}

.rf7-filter-popover-head span {
  margin-top: 2px;
  color: #767586;
  font-size: 12px;
}

.rf7-filter-close {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: #464554;
  background: transparent;
  cursor: pointer;
}

.rf7-filter-close:hover {
  background: #f3f4f5;
}

.rf7-filter-check {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  color: #464554;
  font-size: 13px;
  cursor: pointer;
}

.rf7-filter-check:first-of-type {
  margin-top: 10px;
}

.rf7-filter-check input {
  width: 16px;
  height: 16px;
  accent-color: #4648d4;
}

.rf7-filter-check b {
  color: #767586;
  font-size: 11px;
  font-weight: 600;
}

.rf7-filter-quality {
  display: block;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid #edeeef;
}

.rf7-filter-quality > span {
  display: flex;
  justify-content: space-between;
  color: #464554;
  font-size: 12px;
  font-weight: 600;
}

.rf7-filter-quality > span b {
  color: #4648d4;
}

.rf7-filter-quality input {
  width: 100%;
  margin-top: 10px;
  accent-color: #4648d4;
}

.rf7-filter-reset {
  width: 100%;
  margin-top: 12px;
  padding: 9px 12px;
  border: 1px solid #dfe0e5;
  border-radius: 8px;
  color: #464554;
  background: #f8f9fa;
  font-weight: 650;
  cursor: pointer;
}

.rf7-filter-reset:hover {
  background: #f3f4f5;
}

.rf7-lead-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.rf7-lead-tabs button {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 18px;
  border: 0;
  border-radius: 999px;
  color: #191c1d;
  background: #e7e8e9;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease,
    transform 150ms ease;
}

.rf7-lead-tabs button:hover {
  transform: translateY(-1px);
  background: #e1e3e4;
}

.rf7-lead-tabs button.active {
  color: #fff;
  background: #6063ee;
}

.rf7-lead-tabs button span {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 999px;
  color: inherit;
  background: rgba(255,255,255,.17);
  font-size: 10px;
}

.rf7-discovery-progress {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid #dfe0e5;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(20,24,31,.04);
}

.rf7-discovery-progress.error {
  border-color: rgba(186,26,26,.2);
  background: #fff8f7;
}

.rf7-discovery-progress-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
}

.rf7-discovery-progress-top strong,
.rf7-discovery-progress-top span {
  display: block;
}

.rf7-discovery-progress-top strong {
  font-family: Geist, Inter, sans-serif;
  font-size: 14px;
  color: #191c1d;
}

.rf7-discovery-progress-top span {
  margin-top: 1px;
  color: #767586;
  font-size: 12px;
}

.rf7-discovery-progress-top > b {
  color: #4648d4;
  font-size: 12px;
}

.rf7-discovery-orb {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #4648d4;
  background: #e9e9ff;
}

.rf7-discovery-orb.running svg {
  animation: rf7-search-pulse 1.4s ease-in-out infinite;
}

@keyframes rf7-search-pulse {
  0%, 100% { transform: scale(1); opacity: .72; }
  50% { transform: scale(1.14); opacity: 1; }
}

.rf7-discovery-track {
  height: 5px;
  margin-top: 12px;
  overflow: hidden;
  border-radius: 99px;
  background: #edeeef;
}

.rf7-discovery-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4648d4, #6b38d4);
}

.rf7-discovery-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  color: #93000a;
  font-size: 12px;
}

.rf7-discovery-error button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid rgba(186,26,26,.18);
  border-radius: 7px;
  color: #93000a;
  background: #fff;
  font-weight: 650;
  cursor: pointer;
}

.rf7-leads-table-card {
  min-height: 530px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #edeeef;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(20,24,31,.04);
}

.rf7-leads-toolbar {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 16px;
  border-bottom: 1px solid #edeeef;
  background: #fff;
}

.rf7-leads-search {
  width: min(420px, 48vw);
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #767586;
  background: #f3f4f5;
  transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
}

.rf7-leads-search:focus-within {
  border-color: rgba(70,72,212,.35);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(70,72,212,.08);
}

.rf7-leads-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: #191c1d;
  background: transparent;
  font: inherit;
  font-size: 13px;
}

.rf7-leads-toolbar-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rf7-selected-pill {
  padding: 4px 8px;
  border-radius: 999px;
  color: #2f2ebe;
  background: #e1e0ff;
  font-size: 11px;
  font-weight: 700;
}

.rf7-table-action {
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid #dfe0e5;
  border-radius: 8px;
  color: #464554;
  background: #fff;
  font-size: 12px;
  font-weight: 650;
  transition: background 150ms ease, transform 150ms ease;
}

.rf7-table-action.icon {
  width: 34px;
  padding: 0;
  display: grid;
  place-items: center;
}

.rf7-table-action:hover:not(:disabled) {
  background: #f3f4f5;
  transform: translateY(-1px);
}

.rf7-table-action:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.rf7-table-action .spin {
  animation: rf7-spin .8s linear infinite;
}

@keyframes rf7-spin {
  to { transform: rotate(360deg); }
}

.rf7-leads-table-scroll {
  overflow: auto;
  flex: 1;
}

.rf7-leads-table {
  width: 100%;
  min-width: 930px;
  border-collapse: collapse;
  table-layout: fixed;
}

.rf7-leads-table th {
  height: 50px;
  padding: 0 16px;
  color: #30313f;
  background: #f3f4f5;
  text-align: left;
  font-size: 11px;
  line-height: 16px;
  font-weight: 750;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.rf7-leads-table th.check,
.rf7-leads-table td.check {
  width: 52px;
  text-align: center;
}

.rf7-leads-table th:nth-child(2) { width: 31%; }
.rf7-leads-table th:nth-child(3) { width: 17%; }
.rf7-leads-table th:nth-child(4) { width: 20%; }
.rf7-leads-table th:nth-child(5) { width: 14%; }
.rf7-leads-table th:nth-child(6) { width: 14%; }
.rf7-leads-table th:nth-child(7) { width: 108px; }

.rf7-leads-table input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #4648d4;
  cursor: pointer;
}

.rf7-leads-table tbody tr {
  height: 80px;
  border-bottom: 1px solid #edeeef;
  background: #fff;
  cursor: pointer;
  transition: background 130ms ease, box-shadow 130ms ease;
}

.rf7-leads-table tbody tr:hover {
  background: #fafafa;
}

.rf7-leads-table tbody tr.selected {
  background: #f7f7ff;
  box-shadow: inset 3px 0 0 #4648d4;
}

.rf7-leads-table td {
  padding: 12px 16px;
  color: #191c1d;
  vertical-align: middle;
  font-size: 13px;
  line-height: 19px;
}

.rf7-company-cell {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.rf7-company-avatar {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  font-family: Geist, Inter, sans-serif;
  font-size: 14px;
  font-weight: 700;
}

.rf7-company-avatar.tone-0 { color: #23005c; background: #e9ddff; }
.rf7-company-avatar.tone-1 { color: #131b2e; background: #dae2fd; }
.rf7-company-avatar.tone-2 { color: #93000a; background: #ffdad6; }
.rf7-company-avatar.tone-3 { color: #2f2ebe; background: #e1e0ff; }

.rf7-company-copy {
  min-width: 0;
}

.rf7-company-copy strong {
  display: block;
  overflow: hidden;
  color: #191c1d;
  font-family: Geist, Inter, sans-serif;
  font-size: 15px;
  line-height: 21px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-company-copy a,
.rf7-company-copy > span {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  overflow: hidden;
  color: #464554;
  font-size: 11px;
  line-height: 16px;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-company-copy a:hover {
  color: #4648d4;
}

.rf7-table-muted {
  display: block;
  overflow: hidden;
  color: #464554;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-contact-cell span,
.rf7-contact-cell small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-contact-cell span {
  color: #464554;
}

.rf7-contact-cell small {
  margin-top: 1px;
  color: #464554;
  font-size: 11px;
}

.rf7-quality-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}

.rf7-quality-track {
  width: 78px;
  height: 7px;
  overflow: hidden;
  border-radius: 99px;
  background: #e7e8e9;
}

.rf7-quality-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.rf7-quality-track span.good { background: #6b38d4; }
.rf7-quality-track span.medium { background: #565e74; }
.rf7-quality-track span.low { background: #8a8995; }

.rf7-quality-cell b {
  min-width: 24px;
  color: #464554;
  font-size: 11px;
  font-weight: 650;
}

.rf7-status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 9px;
  border-radius: 999px;
  color: #2f2ebe;
  background: #e1e0ff;
  font-size: 11px;
  font-weight: 650;
}

.rf7-status-pill.qualified {
  color: #5516be;
  background: #e9ddff;
}

.rf7-status-pill.interested {
  color: #0f6b46;
  background: #e9f8f0;
}

.rf7-status-pill.meeting {
  color: #275fba;
  background: #edf4ff;
}

.rf7-status-pill.won {
  color: #0f6b46;
  background: #dff5e9;
}

.rf7-status-pill.unqualified {
  color: #464554;
  background: #e1e3e4;
}

.rf7-row-actions {
  white-space: nowrap;
  opacity: 0;
  transition: opacity 130ms ease;
}

.rf7-leads-table tbody tr:hover .rf7-row-actions,
.rf7-leads-table tbody tr:focus-within .rf7-row-actions {
  opacity: 1;
}

.rf7-row-actions button {
  width: 30px;
  height: 30px;
  display: inline-grid;
  place-items: center;
  margin-left: 2px;
  border: 0;
  border-radius: 7px;
  color: #464554;
  background: transparent;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease, transform 120ms ease;
}

.rf7-row-actions button:hover:not(:disabled) {
  color: #4648d4;
  background: #e9e9ff;
  transform: translateY(-1px);
}

.rf7-row-actions button:disabled {
  opacity: .3;
  cursor: not-allowed;
}

.rf7-leads-empty {
  min-height: 360px;
  display: grid;
  place-items: center;
  align-content: center;
  padding: 40px 24px;
  text-align: center;
}

.rf7-leads-empty-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  border-radius: 14px;
  color: #4648d4;
  background: #e9e9ff;
}

.rf7-leads-empty h3 {
  margin: 0;
  font-family: Geist, Inter, sans-serif;
  font-size: 18px;
}

.rf7-leads-empty p {
  max-width: 420px;
  margin: 6px 0 18px;
  color: #767586;
  font-size: 13px;
}

.rf7-table-skeletons {
  min-height: 360px;
  padding: 8px 16px;
}

.rf7-table-skeleton-row {
  height: 70px;
  display: grid;
  grid-template-columns: 42px 2fr 1fr 1fr .8fr;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid #edeeef;
}

.rf7-table-skeleton-row span {
  height: 12px;
  border-radius: 999px;
  background:
    linear-gradient(90deg, #f3f4f5 25%, #e7e8e9 37%, #f3f4f5 63%);
  background-size: 400% 100%;
  animation: rf7-shimmer 1.25s ease infinite;
}

.rf7-table-skeleton-row span:first-child {
  width: 36px;
  height: 36px;
  border-radius: 7px;
}

@keyframes rf7-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

.rf7-leads-table-footer {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: auto;
  padding: 0 16px;
  border-top: 1px solid #edeeef;
  color: #464554;
  background: #fff;
  font-size: 11px;
  font-weight: 600;
}

.rf7-lead-foot-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rf7-lead-foot-meta span + span {
  position: relative;
  padding-left: 12px;
}

.rf7-lead-foot-meta span + span::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #c7c4d7;
  transform: translateY(-50%);
}

.rf7-lead-ops-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.rf7-operational-card,
.rf7-lead-ops-grid > .ai-voice-launch-panel {
  margin: 0 !important;
  border: 1px solid #dfe0e5 !important;
  border-radius: 16px !important;
  background: #fff !important;
  box-shadow: 0 1px 2px rgba(20,24,31,.04) !important;
}

.rf7-inline-alert {
  animation: rf7-alert-in 260ms cubic-bezier(.2,.7,.2,1) both;
}

.rf7-inline-alert.success {
  border-color: rgba(15,138,85,.18) !important;
  color: #0f6b46 !important;
  background: #e9f8f0 !important;
}

.rf7-inline-alert.error {
  border-color: rgba(186,26,26,.18) !important;
  color: #93000a !important;
  background: #fff0ee !important;
}

@keyframes rf7-alert-in {
  from { opacity: 0; transform: translateY(-7px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.rf7-drawer-backdrop {
  position: fixed;
  inset: 64px 0 0 260px;
  z-index: 80;
  border: 0;
  background: rgba(25,28,29,.18);
  backdrop-filter: blur(1.5px);
  cursor: default;
}

.rf7-lead-drawer {
  position: fixed;
  z-index: 90;
  top: 80px;
  right: 24px;
  bottom: 24px;
  width: min(480px, calc(100vw - 32px));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid #edeeef;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(20,24,31,.20);
}

.rf7-lead-drawer-head {
  position: relative;
  padding: 24px;
  border-bottom: 1px solid #edeeef;
}

.rf7-drawer-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: #464554;
  background: transparent;
  cursor: pointer;
}

.rf7-drawer-close:hover {
  background: #f3f4f5;
}

.rf7-drawer-identity {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding-right: 28px;
}

.rf7-drawer-avatar {
  width: 62px;
  height: 62px;
  flex: 0 0 62px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: #23005c;
  background: #e9ddff;
  font-family: Geist, Inter, sans-serif;
  font-size: 22px;
  font-weight: 700;
}

.rf7-drawer-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rf7-drawer-badges span,
.rf7-drawer-badges b {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 14px;
  font-weight: 700;
}

.rf7-drawer-badges span {
  color: #2f2ebe;
  background: #e1e0ff;
}

.rf7-drawer-badges b {
  color: #6b38d4;
  background: transparent;
}

.rf7-drawer-identity h2 {
  margin: 5px 0 0;
  font-family: Geist, Inter, sans-serif;
  font-size: 20px;
  line-height: 28px;
  font-weight: 650;
}

.rf7-drawer-identity a,
.rf7-drawer-identity p {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 3px 0 0;
  color: #4648d4;
  font-size: 12px;
  text-decoration: none;
}

.rf7-drawer-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-top: 18px;
}

.rf7-drawer-actions button {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 8px;
  color: #191c1d;
  background: #e7e8e9;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 130ms ease, background 130ms ease;
}

.rf7-drawer-actions button.primary {
  color: #fff;
  background: #4648d4;
}

.rf7-drawer-actions button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.rf7-drawer-actions button:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.rf7-drawer-tabs {
  display: flex;
  gap: 4px;
  padding: 0 18px;
  border-bottom: 1px solid #edeeef;
  background: rgba(248,249,250,.75);
}

.rf7-drawer-tabs button {
  min-height: 42px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: #464554;
  background: transparent;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}

.rf7-drawer-tabs button.active {
  color: #4648d4;
  border-bottom-color: #4648d4;
}

.rf7-drawer-tabs button:disabled {
  opacity: .45;
}

.rf7-drawer-body {
  flex: 1;
  overflow: auto;
  padding: 22px;
  background: #f8f9fa;
}

.rf7-drawer-body section + section {
  margin-top: 22px;
}

.rf7-drawer-body h3 {
  margin: 0 0 10px;
  font-family: Geist, Inter, sans-serif;
  font-size: 14px;
  line-height: 20px;
  font-weight: 650;
}

.rf7-drawer-detail-card {
  overflow: hidden;
  border: 1px solid #edeeef;
  border-radius: 10px;
  background: #fff;
}

.rf7-drawer-detail-card > div {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 12px 14px;
}

.rf7-drawer-detail-card > div + div {
  border-top: 1px solid #edeeef;
}

.rf7-drawer-detail-card svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #767586;
}

.rf7-drawer-detail-card span {
  min-width: 0;
}

.rf7-drawer-detail-card small,
.rf7-drawer-detail-card b {
  display: block;
}

.rf7-drawer-detail-card small {
  color: #767586;
  font-size: 10px;
}

.rf7-drawer-detail-card b {
  margin-top: 1px;
  overflow: hidden;
  color: #191c1d;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
}

.rf7-drawer-ai-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid #e9ddff;
  border-radius: 10px;
  background: rgba(233,221,255,.34);
}

.rf7-drawer-score {
  width: 58px;
  height: 58px;
  flex: 0 0 58px;
  display: grid;
  place-items: center;
  border: 4px solid #6b38d4;
  border-radius: 50%;
  color: #6b38d4;
  background: #fff;
  font-family: Geist, Inter, sans-serif;
  font-size: 20px;
  font-weight: 700;
}

.rf7-drawer-ai-card strong {
  display: block;
  font-size: 13px;
}

.rf7-drawer-ai-card p,
.rf7-drawer-next p {
  margin: 3px 0 0;
  color: #464554;
  font-size: 11px;
  line-height: 17px;
}

.rf7-drawer-next {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border: 1px solid #dfe0e5;
  border-radius: 10px;
  background: #fff;
}

.rf7-drawer-next svg {
  color: #6b38d4;
}

.rf7-drawer-next strong {
  font-size: 12px;
}

.builder-page {
  max-width: 980px;
  margin: 0 auto;
  color: #191c1d;
}

.builder-page .page-top {
  align-items: flex-start;
}

.builder-page .page-top .eyebrow {
  color: #4648d4;
}

.builder-page .page-top h1 {
  margin-top: 6px;
  font-family: Geist, Inter, sans-serif;
  font-size: 30px;
  line-height: 38px;
  letter-spacing: -.02em;
}

.builder-page .builder-subtitle {
  max-width: 680px;
  color: #464554;
}

.builder-page .step-count {
  min-width: 62px;
  min-height: 42px;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  border: 1px solid #dfe0e5;
  border-radius: 10px;
  color: #4648d4;
  background: #fff;
  font-family: Geist, Inter, sans-serif;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(20,24,31,.04);
}

.builder-page .step-line {
  height: 5px;
  gap: 6px;
  margin: 18px 0;
  background: transparent;
}

.builder-page .step-line i {
  flex: 1;
  height: 5px;
  border-radius: 999px;
  background: #e1e3e4;
  transition: background 220ms ease, transform 220ms ease;
}

.builder-page .step-line i.active {
  background: #4648d4;
}

.builder-page .builder-card {
  overflow: hidden;
  border: 1px solid #dfe0e5;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 10px 32px rgba(20,24,31,.06);
}

.builder-page .builder-step {
  padding: 30px 32px 8px;
}

.builder-page .builder-step h2 {
  margin-top: 6px;
  font-family: Geist, Inter, sans-serif;
  font-size: 22px;
  line-height: 30px;
  letter-spacing: -.01em;
}

.builder-page .builder-step > p {
  color: #464554;
}

.builder-page .builder-workspace-summary,
.builder-page .sentence-card,
.builder-page .launch-settings,
.builder-page .review-grid {
  border-color: #edeeef;
  border-radius: 12px;
}

.builder-page .field input,
.builder-page .field select,
.builder-page .launch-settings select {
  min-height: 44px;
  border-color: #dfe0e5;
  border-radius: 9px;
  background: #fff;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.builder-page .field input:focus,
.builder-page .field select:focus,
.builder-page .launch-settings select:focus {
  border-color: rgba(70,72,212,.5);
  box-shadow: 0 0 0 3px rgba(70,72,212,.08);
}

.builder-page .suggestions button,
.builder-page .radius-quick-options button {
  border-color: #dfe0e5;
  border-radius: 999px;
  color: #464554;
  background: #f8f9fa;
  transition: transform 130ms ease, background 130ms ease, border-color 130ms ease;
}

.builder-page .suggestions button:hover,
.builder-page .radius-quick-options button:hover,
.builder-page .radius-quick-options button.active {
  color: #2f2ebe;
  border-color: #c0c1ff;
  background: #e9e9ff;
  transform: translateY(-1px);
}

.builder-page .builder-actions {
  margin-top: 20px;
  padding: 18px 32px 24px;
  border-top: 1px solid #edeeef;
  background: #fbfbfc;
}

.builder-page .builder-actions .btn {
  min-height: 42px;
  border-radius: 8px;
  transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
}

.builder-page .builder-actions .btn.primary {
  background: #4648d4;
  box-shadow: 0 4px 12px rgba(70,72,212,.16);
}

.builder-page .builder-actions .btn.primary:hover {
  background: #3f41c7;
  transform: translateY(-1px);
  box-shadow: 0 7px 16px rgba(70,72,212,.2);
}

.builder-page .form-error,
.builder-page .error-banner,
.builder-page .success-banner {
  animation: rf7-alert-in 260ms cubic-bezier(.2,.7,.2,1) both;
}

@media (max-width: 1100px) {
  .rf7-lead-ops-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .rf7-drawer-backdrop {
    inset: 64px 0 0 0;
  }

  .rf7-lead-drawer {
    top: 76px;
    right: 12px;
    bottom: 12px;
  }

  .rf7-leads-head {
    align-items: stretch;
    flex-direction: column;
  }

  .rf7-leads-head-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 700px) {
  .rf7-leads-head h1 {
    font-size: 26px;
    line-height: 34px;
  }

  .rf7-leads-head-actions {
    display: grid;
    grid-template-columns: 1fr 1.25fr;
  }

  .rf7-leads-secondary,
  .rf7-leads-primary {
    width: 100%;
    min-width: 0;
  }

  .rf7-filter-popover {
    position: fixed;
    z-index: 120;
    left: 12px;
    right: 12px;
    bottom: 82px;
    top: auto;
    width: auto;
  }

  .rf7-lead-tabs {
    flex-wrap: nowrap;
    margin-right: -16px;
    padding-right: 16px;
    overflow-x: auto;
  }

  .rf7-lead-tabs button {
    flex: 0 0 auto;
  }

  .rf7-leads-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .rf7-leads-search {
    width: 100%;
  }

  .rf7-leads-toolbar-meta {
    justify-content: flex-end;
  }

  .rf7-leads-table-card {
    min-height: 500px;
  }

  .rf7-leads-table-footer {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .rf7-drawer-backdrop {
    inset: 0;
  }

  .rf7-lead-drawer {
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    border: 0;
    border-radius: 0;
  }

  .rf7-drawer-actions {
    grid-template-columns: 1fr;
  }

  .builder-page .builder-step {
    padding: 22px 18px 6px;
  }

  .builder-page .builder-actions {
    padding: 16px 18px 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rf7-leads-page *,
  .builder-page * {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }
}
`;

function LiveLeadResultsPage({
  result,
  form,
  workspace,
  search,
  onSearch,
  onBack,
  onRetry,
  onDownload,
  onOpenAudit,
  onCall,
  callers,
  selectedCallerId,
  onSelectCaller,
  assignmentLeadCount,
  onAssignmentLeadCountChange,
  onAssign,
  assignmentSaving,
  assignmentMessage,
  assignmentError,
  assignmentCampaignId,
  voiceEnabled,
  voiceReady,
  voiceNumber,
  voiceLaunchCount,
  onVoiceLaunchCount,
  voiceLaunchConfirmed,
  onVoiceLaunchConfirmed,
  voiceLaunching,
  voiceLaunchMessage,
  voiceLaunchError,
  aiCallBalance,
  aiCallCreditsKnown,
  onLaunchVoice,
  onOpenVoice,
  onOpenBilling,
}) {
  const leads = Array.isArray(result?.leads) ? result.leads : [];
  const queuedAuditWebsitesRef = useRef(new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [onlyEmail, setOnlyEmail] = useState(false);
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [onlyWebsite, setOnlyWebsite] = useState(false);
  const [minQuality, setMinQuality] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [drawerLead, setDrawerLead] = useState(null);
  const previousStatusRef = useRef("");

  useEffect(() => {
    const pending = leads
      .filter((lead) => lead?.website)
      .filter((lead) => {
        const website = String(lead.website || "").trim();

        if (!website || queuedAuditWebsitesRef.current.has(website)) {
          return false;
        }

        queuedAuditWebsitesRef.current.add(website);
        return true;
      });

    if (!pending.length) return undefined;

    const timer = window.setTimeout(() => {
      auditApi("/lead-audits/mini/batch", {
        method: "POST",
        body: {
          leads: pending,
          niche: form.niche,
          location: form.location,
          workspaceName: workspace?.title || "",
        },
      }).catch(() => {
        for (const lead of pending) {
          queuedAuditWebsitesRef.current.delete(
            String(lead.website || "").trim()
          );
        }
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [leads, form.niche, form.location, workspace?.title]);

  useEffect(() => {
    const status = String(result?.status || "").toLowerCase();
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;

    if (!status || status === previousStatus) return;

    if (status === "error") {
      window.reachflyToast?.error?.(
        "Lead discovery interrupted",
        result?.error || result?.message || "We couldn't complete this lead search."
      );
    }

    if (
      ["complete", "completed", "success", "ready"].includes(status) &&
      leads.length > 0
    ) {
      window.reachflyToast?.success?.(
        "Lead list ready",
        `${leads.length.toLocaleString()} ${
          leads.length === 1 ? "lead is" : "leads are"
        } ready to review.`
      );
    }
  }, [result?.status, result?.error, result?.message, leads.length]);

  useEffect(() => {
    if (!assignmentMessage) return;
    window.reachflyToast?.success?.(
      "Leads assigned",
      assignmentMessage
    );
  }, [assignmentMessage]);

  useEffect(() => {
    if (!assignmentError) return;
    window.reachflyToast?.error?.(
      "Assignment failed",
      assignmentError
    );
  }, [assignmentError]);

  useEffect(() => {
    if (!voiceLaunchMessage) return;
    window.reachflyToast?.success?.(
      "AI Voice campaign started",
      voiceLaunchMessage
    );
  }, [voiceLaunchMessage]);

  useEffect(() => {
    if (!voiceLaunchError) return;
    window.reachflyToast?.error?.(
      "AI Voice launch failed",
      voiceLaunchError
    );
  }, [voiceLaunchError]);

  const normalizedSearch = String(search || "").trim().toLowerCase();

  const enrichedLeads = useMemo(
    () =>
      leads.map((lead, index) => {
        const quality = Number(
          lead.qualityScore ??
            lead.confidence ??
            lead.score ??
            lead.dataQualityScore ??
            0
        );

        const sourceStatus = String(
          lead.status ||
            lead.pipelineStatus ||
            lead.stage ||
            lead.disposition ||
            ""
        )
          .trim()
          .toLowerCase();

        const status =
          sourceStatus ||
          (quality >= 80 ? "qualified" : "new");

        return {
          lead,
          index,
          quality: Number.isFinite(quality)
            ? Math.max(0, Math.min(100, Math.round(quality)))
            : 0,
          status,
          id: leadIdentity(lead) || `lead-${index}`,
        };
      }),
    [leads]
  );

  const filteredLeads = enrichedLeads.filter(({ lead, quality, status }) => {
    if (
      normalizedSearch &&
      ![
        lead.business,
        lead.name,
        lead.website,
        lead.domain,
        lead.email,
        lead.phone,
        lead.address,
        lead.city,
        lead.state,
        lead.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    ) {
      return false;
    }

    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (onlyEmail && !isDisplayableEmail(lead.email)) return false;
    if (onlyPhone && !lead.phone) return false;
    if (onlyWebsite && !lead.website) return false;
    if (quality < minQuality) return false;

    return true;
  });

  const requested = Number(result?.requested || form.limit || 100);
  const delivered = leads.length;
  const percent = Math.max(0, Math.min(100, Number(result?.percent || 0)));
  const isLoading =
    result?.streaming === true || String(result?.status || "").toLowerCase() === "loading";
  const hasError = String(result?.status || "").toLowerCase() === "error";
  const emailCount = leads.filter((lead) => isDisplayableEmail(lead.email)).length;
  const phoneCount = leads.filter((lead) => lead.phone).length;
  const websiteCount = leads.filter((lead) => lead.website).length;

  const statusCounts = useMemo(() => {
    const counts = {
      all: enrichedLeads.length,
      new: 0,
      qualified: 0,
      interested: 0,
      meeting: 0,
      won: 0,
    };

    enrichedLeads.forEach(({ status }) => {
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      }
    });

    return counts;
  }, [enrichedLeads]);

  const visibleIds = filteredLeads.map(({ id }) => id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }

  function toggleLead(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function statusLabel(value) {
    const labels = {
      all: "All Leads",
      new: "New",
      qualified: "Qualified",
      interested: "Interested",
      meeting: "Meeting",
      won: "Won",
    };
    return labels[value] || value;
  }

  function openEmail(lead) {
    const email = isDisplayableEmail(lead?.email) ? String(lead.email).trim() : "";
    if (!email) {
      window.reachflyToast?.warning?.(
        "Email unavailable",
        "This lead does not have a verified public email address."
      );
      return;
    }

    window.location.href = `mailto:${email}`;
  }

  return (
    <div className="rf7-leads-page">
      <style>{BUILDER_V7_CSS}</style>

      <motion.section
        className="rf7-leads-head"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <div>
          <h1>Leads</h1>
          <p>Manage and discover high-intent prospects.</p>
        </div>

        <div className="rf7-leads-head-actions">
          <div className="rf7-filter-wrap">
            <button
              type="button"
              className={`rf7-leads-secondary ${filterOpen ? "active" : ""}`}
              onClick={() => setFilterOpen((value) => !value)}
              aria-expanded={filterOpen}
            >
              <span className="rf7-filter-glyph" aria-hidden="true">
                ≡
              </span>
              Filter
            </button>

            <AnimatePresence>
              {filterOpen ? (
                <motion.div
                  className="rf7-filter-popover"
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                >
                  <div className="rf7-filter-popover-head">
                    <div>
                      <strong>Filter leads</strong>
                      <span>Narrow the current result set.</span>
                    </div>
                    <button
                      type="button"
                      className="rf7-filter-close"
                      onClick={() => setFilterOpen(false)}
                      aria-label="Close filters"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <label className="rf7-filter-check">
                    <input
                      type="checkbox"
                      checked={onlyEmail}
                      onChange={(event) => setOnlyEmail(event.target.checked)}
                    />
                    <span>Has email</span>
                    <b>{emailCount}</b>
                  </label>

                  <label className="rf7-filter-check">
                    <input
                      type="checkbox"
                      checked={onlyPhone}
                      onChange={(event) => setOnlyPhone(event.target.checked)}
                    />
                    <span>Has phone</span>
                    <b>{phoneCount}</b>
                  </label>

                  <label className="rf7-filter-check">
                    <input
                      type="checkbox"
                      checked={onlyWebsite}
                      onChange={(event) => setOnlyWebsite(event.target.checked)}
                    />
                    <span>Has website</span>
                    <b>{websiteCount}</b>
                  </label>

                  <label className="rf7-filter-quality">
                    <span>
                      Minimum quality
                      <b>{minQuality || "Any"}</b>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={minQuality}
                      onChange={(event) => setMinQuality(Number(event.target.value))}
                    />
                  </label>

                  <button
                    type="button"
                    className="rf7-filter-reset"
                    onClick={() => {
                      setOnlyEmail(false);
                      setOnlyPhone(false);
                      setOnlyWebsite(false);
                      setMinQuality(0);
                    }}
                  >
                    Reset filters
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <button
            type="button"
            className="rf7-leads-primary"
            onClick={onBack}
          >
            <Search size={18} />
            Find Leads
          </button>
        </div>
      </motion.section>

      <motion.div
        className="rf7-lead-tabs"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.04 }}
      >
        {["all", "new", "qualified", "interested", "meeting", "won"].map(
          (item) => (
            <button
              key={item}
              type="button"
              className={statusFilter === item ? "active" : ""}
              onClick={() => setStatusFilter(item)}
            >
              {statusLabel(item)}
              {statusCounts[item] ? <span>{statusCounts[item]}</span> : null}
            </button>
          )
        )}
      </motion.div>

      {isLoading || hasError ? (
        <motion.section
          className={`rf7-discovery-progress ${hasError ? "error" : ""}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rf7-discovery-progress-top">
            <div className={`rf7-discovery-orb ${isLoading ? "running" : ""}`}>
              {hasError ? "!" : <Search size={18} />}
            </div>
            <div>
              <strong>
                {hasError
                  ? "Lead search interrupted"
                  : result?.message || "Discovering businesses…"}
              </strong>
              <span>
                {delivered.toLocaleString()} of {requested.toLocaleString()} leads loaded
              </span>
            </div>
            <b>{isLoading ? `${percent}%` : "Needs attention"}</b>
          </div>

          <div
            className="rf7-discovery-track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={percent}
          >
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(hasError ? 5 : 0, percent)}%` }}
              transition={{ duration: 0.35 }}
            />
          </div>

          {hasError ? (
            <div className="rf7-discovery-error">
              <span>{result?.error || result?.message || "The search could not be completed."}</span>
              <button type="button" onClick={onRetry}>
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          ) : null}
        </motion.section>
      ) : null}

      <motion.section
        className="rf7-leads-table-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.08 }}
      >
        <div className="rf7-leads-toolbar">
          <label className="rf7-leads-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search leads..."
            />
          </label>

          <div className="rf7-leads-toolbar-meta">
            {selectedIds.size ? (
              <span className="rf7-selected-pill">
                {selectedIds.size} selected
              </span>
            ) : null}

            <button
              type="button"
              className="rf7-table-action"
              disabled={!leads.length}
              onClick={onDownload}
            >
              Download CSV
            </button>

            <button
              type="button"
              className="rf7-table-action icon"
              disabled={isLoading}
              onClick={onRetry}
              title="Run this search again"
              aria-label="Run this search again"
            >
              <RefreshCw size={16} className={isLoading ? "spin" : ""} />
            </button>
          </div>
        </div>

        <div className="rf7-leads-table-scroll">
          <table className="rf7-leads-table">
            <thead>
              <tr>
                <th className="check">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select visible leads"
                  />
                </th>
                <th>Company</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Quality</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>

            <tbody>
              <AnimatePresence initial={false}>
                {filteredLeads.map(({ lead, index, quality, status, id }) => (
                  <LiveLeadTableRow
                    key={id}
                    lead={lead}
                    index={index + 1}
                    quality={quality}
                    status={status}
                    selected={selectedIds.has(id)}
                    onSelected={() => toggleLead(id)}
                    onOpen={() => setDrawerLead(lead)}
                    onOpenAudit={onOpenAudit}
                    onCall={onCall}
                  />
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {!filteredLeads.length && !isLoading ? (
          <div className="rf7-leads-empty">
            <div className="rf7-leads-empty-icon">
              <Search size={22} />
            </div>
            <h3>{leads.length ? "No leads match these filters" : "Build your first prospect list"}</h3>
            <p>
              {leads.length
                ? "Adjust the search or filter controls to see more leads."
                : "Search a market and ReachFly will build a live business prospect list."}
            </p>
            <button type="button" className="rf7-leads-primary" onClick={onBack}>
              <Search size={17} />
              Find Leads
            </button>
          </div>
        ) : null}

        {isLoading && !filteredLeads.length ? <LeadTableSkeletons /> : null}

        <div className="rf7-leads-table-footer">
          <span>
            Showing {filteredLeads.length ? 1 : 0}-
            {filteredLeads.length.toLocaleString()} of {leads.length.toLocaleString()} leads
          </span>

          <div className="rf7-lead-foot-meta">
            <span>{emailCount} emails</span>
            <span>{phoneCount} phones</span>
            <span>{websiteCount} websites</span>
          </div>
        </div>
      </motion.section>

      {!isLoading && leads.length > 0 ? (
        <motion.section
          className="rf7-lead-ops-grid"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
        >
          <section className="live-assignment-panel rf7-operational-card">
            <div className="live-assignment-header">
              <div>
                <span className="eyebrow">Assign to a team member</span>
                <h2>Move leads into the team calling queue.</h2>
                <p>
                  Pick an active owner, admin, manager, or caller and the exact number of generated leads to assign.
                </p>
              </div>
              <Users />
            </div>

            {assignmentError ? (
              <div className="error-banner rf7-inline-alert error">
                {assignmentError}
              </div>
            ) : null}

            {assignmentMessage ? (
              <div className="success-banner rf7-inline-alert success">
                {assignmentMessage}
              </div>
            ) : null}

            <div className="live-assignment-form">
              <label className="field">
                <span>Assignee</span>
                <select
                  value={selectedCallerId}
                  onChange={(event) => onSelectCaller(event.target.value)}
                >
                  <option value="">Select team member</option>
                  {callers.map((caller) => (
                    <option key={caller.id} value={caller.id}>
                      {caller.name || caller.fullName || caller.email || "Team member"}
                      {caller.email ? ` — ${caller.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Number of leads</span>
                <input
                  type="number"
                  min="1"
                  max={leads.length}
                  value={assignmentLeadCount}
                  onChange={(event) =>
                    onAssignmentLeadCountChange(
                      Math.max(
                        1,
                        Math.min(leads.length, Number(event.target.value || 1))
                      )
                    )
                  }
                />
                <small>Maximum available: {leads.length}</small>
              </label>
            </div>

            {!callers.length ? (
              <div className="safe-note-v54">
                No active assignment-capable team members were found.
              </div>
            ) : null}

            <div className="live-assignment-summary">
              <span>
                <b>
                  {Math.min(
                    leads.length,
                    Number(assignmentLeadCount || 1)
                  )}
                </b>{" "}
                leads will be assigned
              </span>
              <span>
                {assignmentCampaignId
                  ? "Campaign saved"
                  : "A campaign will be created automatically"}
              </span>
            </div>

            <button
              type="button"
              className="btn primary"
              disabled={
                assignmentSaving ||
                !callers.length ||
                !selectedCallerId ||
                !assignmentLeadCount
              }
              onClick={onAssign}
            >
              <Users />
              {assignmentSaving ? "Assigning…" : "Assign leads"}
            </button>
          </section>

          <AiVoiceLaunchPanel
            enabled={voiceEnabled}
            ready={voiceReady}
            number={voiceNumber}
            phoneLeadCount={phoneCount}
            value={voiceLaunchCount}
            max={phoneCount}
            onChange={onVoiceLaunchCount}
            confirmed={voiceLaunchConfirmed}
            onConfirmed={onVoiceLaunchConfirmed}
            launching={voiceLaunching}
            message={voiceLaunchMessage}
            error={voiceLaunchError}
            aiCallBalance={aiCallBalance}
            creditsKnown={aiCallCreditsKnown}
            onLaunch={onLaunchVoice}
            onSetup={onOpenVoice}
            onBilling={onOpenBilling}
          />
        </motion.section>
      ) : null}

      <AnimatePresence>
        {drawerLead ? (
          <LeadQuickDrawer
            lead={drawerLead}
            onClose={() => setDrawerLead(null)}
            onAudit={() => {
              setDrawerLead(null);
              onOpenAudit?.(drawerLead);
            }}
            onCall={() => {
              setDrawerLead(null);
              onCall?.(drawerLead);
            }}
            onEmail={() => openEmail(drawerLead)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ResultStat({
  label,
  value,
  detail,
}) {
  return (
    <article className="live-result-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function LiveLeadTableRow({
  lead,
  index,
  quality,
  status,
  selected,
  onSelected,
  onOpen,
  onOpenAudit,
  onCall,
}) {
  const business = lead.business || lead.name || `Lead ${index}`;
  const hostname = lead.domain || safeHostname(lead.website);
  const email = isDisplayableEmail(lead.email) ? lead.email : "";
  const contactName =
    lead.contactName ||
    lead.contact ||
    lead.ownerName ||
    lead.personName ||
    "";
  const location =
    lead.location ||
    lead.city ||
    lead.address ||
    [lead.city, lead.state].filter(Boolean).join(", ") ||
    "—";
  const initials = business
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const normalizedStatus = String(status || "new").toLowerCase();
  const statusText =
    normalizedStatus === "qualified"
      ? "Qualified"
      : normalizedStatus === "interested"
        ? "Interested"
        : normalizedStatus === "meeting"
          ? "Meeting"
          : normalizedStatus === "won"
            ? "Won"
            : normalizedStatus === "unqualified"
              ? "Unqualified"
              : "New";

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.18 }}
      className={selected ? "selected" : ""}
      onClick={onOpen}
    >
      <td className="check" onClick={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelected}
          aria-label={`Select ${business}`}
        />
      </td>

      <td>
        <div className="rf7-company-cell">
          <div
            className={`rf7-company-avatar tone-${index % 4}`}
            aria-hidden="true"
          >
            {initials || "RF"}
          </div>
          <div className="rf7-company-copy">
            <strong>{business}</strong>
            {lead.website ? (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                <Building2 size={13} />
                {hostname || "Visit website"}
              </a>
            ) : (
              <span>
                <Building2 size={13} />
                No Website
              </span>
            )}
          </div>
        </div>
      </td>

      <td>
        <span className="rf7-table-muted">{location}</span>
      </td>

      <td>
        <div className="rf7-contact-cell">
          <span>{contactName || (email ? "Public contact" : "Unknown")}</span>
          <small>{email || lead.phone || "No public contact"}</small>
        </div>
      </td>

      <td>
        <div className="rf7-quality-cell">
          <div className="rf7-quality-track">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${quality}%` }}
              transition={{ duration: 0.45, delay: 0.04 }}
              className={quality >= 70 ? "good" : quality >= 45 ? "medium" : "low"}
            />
          </div>
          <b>{quality || "—"}</b>
        </div>
      </td>

      <td>
        <span className={`rf7-status-pill ${normalizedStatus}`}>
          {statusText}
        </span>
      </td>

      <td className="rf7-row-actions" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={!lead.phone}
          onClick={() => onCall?.(lead)}
          title="Call lead"
          aria-label={`Call ${business}`}
        >
          <Phone size={15} />
        </button>
        <button
          type="button"
          disabled={!lead.website}
          onClick={() => onOpenAudit?.(lead)}
          title="Run AI Audit"
          aria-label={`Run AI Audit for ${business}`}
        >
          <Sparkles size={15} />
        </button>
        <button
          type="button"
          onClick={onOpen}
          title="Open lead details"
          aria-label={`Open ${business}`}
        >
          <ChevronRight size={16} />
        </button>
      </td>
    </motion.tr>
  );
}

function LeadQuickDrawer({
  lead,
  onClose,
  onAudit,
  onCall,
  onEmail,
}) {
  const business = lead?.business || lead?.name || "Lead";
  const hostname = lead?.domain || safeHostname(lead?.website);
  const email = isDisplayableEmail(lead?.email) ? lead.email : "";
  const initials = business
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const quality = Math.max(
    0,
    Math.min(
      100,
      Number(
        lead?.qualityScore ??
          lead?.confidence ??
          lead?.score ??
          0
      ) || 0
    )
  );

  return (
    <>
      <motion.button
        type="button"
        className="rf7-drawer-backdrop"
        aria-label="Close lead details"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.aside
        className="rf7-lead-drawer"
        initial={{ x: "105%" }}
        animate={{ x: 0 }}
        exit={{ x: "105%" }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
      >
        <div className="rf7-lead-drawer-head">
          <button
            type="button"
            className="rf7-drawer-close"
            onClick={onClose}
            aria-label="Close lead details"
          >
            <X size={18} />
          </button>

          <div className="rf7-drawer-identity">
            <div className="rf7-drawer-avatar">{initials || "RF"}</div>
            <div>
              <div className="rf7-drawer-badges">
                <span>New Lead</span>
                {quality >= 80 ? <b>Hot</b> : null}
              </div>
              <h2>{business}</h2>
              {lead.website ? (
                <a href={lead.website} target="_blank" rel="noopener noreferrer">
                  {hostname || "Visit website"}
                  <ArrowRight size={14} />
                </a>
              ) : (
                <p>No website available</p>
              )}
            </div>
          </div>

          <div className="rf7-drawer-actions">
            <button
              type="button"
              className="primary"
              disabled={!lead.website}
              onClick={onAudit}
            >
              <Sparkles size={16} />
              Run Audit
            </button>
            <button type="button" disabled={!email} onClick={onEmail}>
              <Mail size={16} />
              Email
            </button>
            <button type="button" disabled={!lead.phone} onClick={onCall}>
              <Phone size={16} />
              Call
            </button>
          </div>
        </div>

        <div className="rf7-drawer-tabs">
          <button type="button" className="active">Overview</button>
          <button type="button" onClick={onAudit} disabled={!lead.website}>Audit</button>
        </div>

        <div className="rf7-drawer-body">
          <section>
            <h3>Company Details</h3>
            <div className="rf7-drawer-detail-card">
              <div>
                <MapPin size={18} />
                <span>
                  <small>Address</small>
                  <b>{lead.address || lead.location || "Not available"}</b>
                </span>
              </div>
              <div>
                <Target size={18} />
                <span>
                  <small>Industry</small>
                  <b>{lead.category || lead.niche || "Not classified"}</b>
                </span>
              </div>
              <div>
                <Phone size={18} />
                <span>
                  <small>Phone</small>
                  <b>{lead.phone || "Not available"}</b>
                </span>
              </div>
              <div>
                <Mail size={18} />
                <span>
                  <small>Email</small>
                  <b>{email || "Not available"}</b>
                </span>
              </div>
            </div>
          </section>

          <section>
            <h3>AI Lead Scoring</h3>
            <div className="rf7-drawer-ai-card">
              <div className="rf7-drawer-score">
                {quality || "—"}
              </div>
              <div>
                <strong>
                  {quality >= 80
                    ? "High Intent Match"
                    : quality >= 60
                      ? "Promising Match"
                      : quality
                        ? "Needs Qualification"
                        : "Awaiting Score"}
                </strong>
                <p>
                  Quality is calculated from the currently available business and contact data.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3>Next action</h3>
            <div className="rf7-drawer-next">
              <Sparkles size={18} />
              <div>
                <strong>
                  {lead.website
                    ? "Run an AI Audit before outreach"
                    : lead.phone
                      ? "Qualify the lead by phone"
                      : "Review contact information"}
                </strong>
                <p>
                  Keep the lead context attached as you move into outreach.
                </p>
              </div>
            </div>
          </section>
        </div>
      </motion.aside>
    </>
  );
}

function LeadTableSkeletons() {
  return (
    <div className="rf7-table-skeletons" aria-label="Loading lead results">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rf7-table-skeleton-row">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}


function CallLeadDrawer({
  lead,
  form,
  workspace,
  voiceWorkspace,
  billingData,
  onOpenVoice,
  onOpenBilling,
  onOpenAudit,
  onClose,
}) {
  const [call, setCall] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [callMiniReport, setCallMiniReport] = useState(null);
  const [callMiniLoading, setCallMiniLoading] = useState(false);
  const pollRef = useRef(null);

  const agent = voiceWorkspace?.agent || {};
  const diagnostics = voiceWorkspace?.diagnostics || {};
  const fromNumber = agent.fromNumber || diagnostics.selectedFromNumber || "";
  const ready = Boolean(
    voiceWorkspace &&
      agent.enabled !== false &&
      agent.complianceConfirmed === true &&
      fromNumber &&
      (diagnostics.configured === true || voiceWorkspace?.ready === true || voiceWorkspace?.status?.ready === true)
  );
  const aiWallet = billingData?.aiCalling?.wallet || null;
  const aiBalance = Number(aiWallet?.balance ?? aiWallet?.available ?? 0);
  const creditsKnown = Boolean(aiWallet);

  useEffect(() => {
    window.clearInterval(pollRef.current);
    setCall(null);
    setError("");
    setConfirmed(false);
    setCallMiniReport(null);
    if (!lead) return undefined;

    if (lead.website) {
      setCallMiniLoading(true);
      auditApi(`/lead-audits?website=${encodeURIComponent(lead.website)}`)
        .then(async (data) => {
          const existing = (data.reports || []).find(
            (report) => report.kind === "mini" && ["complete", "completed"].includes(report.status)
          );
          if (existing) return existing;
          return auditApi("/lead-audits/mini", {
            method: "POST",
            body: {
              lead,
              niche: form?.niche || lead.category || "",
              location: form?.location || lead.address || "",
              brand: workspace,
            },
          });
        })
        .then(async (report) => {
          let current = report;
          for (
            let attempt = 0;
            attempt < 30 &&
            current?.id &&
            !["complete", "completed", "failed"].includes(current.status);
            attempt += 1
          ) {
            await new Promise((resolve) => window.setTimeout(resolve, 2000));
            current = await auditApi(`/lead-audits/${encodeURIComponent(current.id)}`);
          }
          setCallMiniReport(current);
        })
        .catch((requestError) =>
          setError((current) => current || requestError?.message || "The Mini Audit could not be loaded.")
        )
        .finally(() => setCallMiniLoading(false));
    }

    return () => window.clearInterval(pollRef.current);
  }, [lead?.phone, lead?.website]);

  useEffect(() => {
    if (!lead?.phone || !call) return undefined;
    if (isTerminalVoiceCallStatus(call.status)) return undefined;

    const refresh = () => {
      apiRequest("/telnyx/ai-agent/dashboard", { timeoutMs: 20_000 })
        .then((dashboard) => {
          const next = findVoiceCallForLead(dashboard, lead, call?.id);
          if (next) setCall(next);
        })
        .catch(() => {});
    };

    pollRef.current = window.setInterval(refresh, 3000);
    return () => window.clearInterval(pollRef.current);
  }, [call?.id, call?.status, lead?.phone]);

  if (!lead) return null;

  const startCall = async () => {
    if (!ready) {
      setError(
        "The Voice Agent is not ready. Complete the verified business number, AI disclosure, calling policy and activation first."
      );
      return;
    }
    if (creditsKnown && aiBalance <= 0) {
      setError("No AI call credits are available for this workspace.");
      return;
    }
    if (!confirmed) {
      setError("Confirm the automated AI calling acknowledgement before starting the call.");
      return;
    }

    setStarting(true);
    setError("");
    try {
      const response = await apiRequest("/telnyx/ai-agent/leads/custom", {
        method: "POST",
        body: {
          contactName: lead.contactName || lead.name || "",
          companyName: lead.business || lead.companyName || lead.name || "",
          phone: lead.phone,
          email: isDisplayableEmail(lead.email) ? lead.email : "",
          website: lead.website || "",
          location: lead.address || lead.location || form?.location || "",
          timezone: lead.timezone || lead.timeZone || "",
          context: [
            `Campaign: ${form?.niche || lead.category || "Business"} in ${form?.location || lead.address || "target market"}`,
            form?.offer ? `Offer: ${form.offer}` : "",
          ].filter(Boolean).join(" · "),
          callNow: true,
          testCall: false,
          testCallConfirmed: false,
          defaultTimezone: agent.defaultLeadTimezone || "",
          maxAttempts: Number(agent.maxAttempts || 3),
          dailyCallLimit: Number(agent.dailyCallLimit || 25),
          fromNumber,
        },
        timeoutMs: 60_000,
      });

      const initialCall =
        response?.activeCall ||
        response?.callResult?.calls?.[0] ||
        response?.callResult?.call ||
        response?.call ||
        {
          id: response?.callResult?.callIds?.[0] || response?.queueId || "",
          status: response?.callResult?.started ? "starting" : "queued",
          destinationNumber: lead.phone,
        };
      setCall(initialCall);
    } catch (requestError) {
      setError(requestError?.message || "The AI call could not be started.");
    } finally {
      setStarting(false);
    }
  };

  const business = lead.business || lead.name || "Lead";

  return (
    <AnimatePresence>
      <motion.div
        className="audit-drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={onClose}
      >
        <motion.aside
          className="call-drawer"
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 80, opacity: 0 }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="call-drawer-header">
            <div>
              <span className="eyebrow">ReachFly AI Voice</span>
              <h2>{business}</h2>
              <p>{lead.phone || "No phone number"} · {safeHostname(lead.website) || "Website unavailable"}</p>
            </div>
            <button type="button" className="audit-close" onClick={onClose}>×</button>
          </div>

          <div className="call-status-panel">
            <div className={`call-status-dot ${call?.status || (ready ? "ready" : "blocked")}`} />
            <div>
              <small>AI call status</small>
              <strong>
                {call?.status
                  ? formatVoiceStatus(call.status)
                  : ready
                    ? "Ready to call"
                    : "Voice Agent setup required"}
              </strong>
              <span>
                {call
                  ? "ReachFly updates the final outcome from the AI call record."
                  : ready
                    ? "The AI agent identifies itself as AI at the start of the call and follows the configured calling policy."
                    : "Open Voice Agent setup to finish activation before calling."}
              </span>
            </div>
          </div>

          {error ? <div className="live-results-error" role="alert">{error}</div> : null}

          <section className="call-mini-audit-embedded">
            <header>
              <div>
                <span className="eyebrow">Mini audit · call intelligence</span>
                <h3>{callMiniReport?.report?.header?.title || callMiniReport?.content?.header?.title || `${business} - Mini Audit`}</h3>
              </div>
              <button type="button" className="mini-audit-button" disabled={!lead.website} onClick={onOpenAudit}>
                Open full view <ArrowRight />
              </button>
            </header>
            {callMiniLoading ? (
              <div className="call-mini-loading">Preparing verified talking points…</div>
            ) : (() => {
              const content = callMiniReport?.report || callMiniReport?.content || callMiniReport?.result || {};
              const snapshot = content.snapshot || {};
              const issues = content.issues || [];
              return (
                <>
                  <div className="snapshot">
                    <div><small>Website</small><b>{snapshot.website || safeHostname(lead.website) || "Not available"}</b></div>
                    <div><small>Platform</small><b>{snapshot.platform || "Not identified"}</b></div>
                    <div><small>Decision maker</small><b>{snapshot.decisionMaker || "Verify on call"}</b></div>
                    <div><small>Business hours</small><b>{snapshot.businessHours || "Verify on call"}</b></div>
                  </div>
                  {issues.slice(0, 4).map((issue, index) => (
                    <div className="issue" key={`${issue.tag || "issue"}-${index}`}>
                      <b>{index + 1}. {issue.tag || issue.title || "Finding"}</b>
                      <p>{issue.finding || issue.description || ""}</p>
                      <p><strong>Business consequence:</strong> {issue.pain || issue.businessImpact || "Discuss on the call"}</p>
                    </div>
                  ))}
                  {!issues.length ? (
                    <div className="call-mini-loading">The Mini Audit is not ready yet. The AI call service remains responsible for its configured business context and disclosure.</div>
                  ) : null}
                </>
              );
            })()}
          </section>

          <section className="call-script-card">
            <span className="eyebrow">Launch policy</span>
            <h3>{form?.niche || lead.category || "Business"} · {form?.location || lead.address || "Target market"}</h3>
            <p>
              Calls use the saved Voice Agent policy, including suppression checks,
              calling windows, AI disclosure and recording settings. This page does
              not bypass those backend controls.
            </p>
          </section>

          {!call ? (
            <section className="call-outcome-card">
              <label className="option-card">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  disabled={!ready || starting}
                />
                <span>
                  <b>Confirm automated AI call</b>
                  <small>
                    I understand this starts an automated AI sales call. The agent
                    identifies itself as AI and the call may be recorded when the
                    workspace recording policy allows it.
                  </small>
                </span>
              </label>

              <div className="flex flex-gap flex-wrap">
                <button
                  type="button"
                  className="btn primary call-now-button"
                  disabled={
                    starting || !lead.phone || !ready || !confirmed ||
                    (creditsKnown && aiBalance <= 0)
                  }
                  onClick={startCall}
                >
                  {starting ? "Starting AI call…" : "☎ Start AI call"}
                </button>
                {!ready ? (
                  <button type="button" className="btn light" onClick={onOpenVoice}>
                    Open Voice Agent setup
                  </button>
                ) : null}
                <button type="button" className="btn light" onClick={onOpenBilling}>
                  AI call credits: {creditsKnown ? formatCompactNumber(aiBalance) : "View"}
                </button>
              </div>
            </section>
          ) : (
            <section className="call-outcome-card">
              <p>
                This call is now tracked by the Voice Agent workspace. Outcomes,
                transcripts, recordings and meetings should come from the authoritative
                AI call record rather than a manual outcome entered here.
              </p>
              <button type="button" className="btn primary" onClick={onOpenVoice}>
                Open Voice Agent workspace
              </button>
            </section>
          )}
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}

function LeadAuditDrawer({
  lead,
  form,
  workspace,
  onClose,
}) {
  const [reports, setReports] =
    useState({});
  const [activeKind, setActiveKind] =
    useState("mini");
  const [error, setError] =
    useState("");
  const [downloading, setDownloading] =
    useState(false);
  const pollRef = useRef(null);

  const activeReport =
    reports[activeKind] || null;
  const isWorking = [
    "queued",
    "generating",
  ].includes(activeReport?.status);

  const loadReports = async ({
    createMini = false,
    signal,
  } = {}) => {
    if (!lead?.website) return;

    const data = await auditApi(
      `/lead-audits?website=${encodeURIComponent(
        lead.website
      )}`,
      { signal }
    );
    const next = {};

    for (const report of
      data?.reports || []) {
      if (!next[report.kind]) {
        next[report.kind] = report;
      }
    }

    if (!next.mini && createMini) {
      next.mini = await auditApi(
        "/lead-audits/mini",
        {
          method: "POST",
          signal,
          body: {
            website: lead.website,
            lead,
            niche:
              form.niche ||
              lead.category,
            location:
              form.location ||
              lead.address,
            workspaceName:
              workspace?.title || "",
          },
        }
      );
    }

    setReports(next);
    return next;
  };

  useEffect(() => {
    if (!lead?.website) {
      setReports({});
      return undefined;
    }

    const controller =
      new AbortController();

    setReports({});
    setActiveKind("mini");
    setError("");

    loadReports({
      createMini: true,
      signal: controller.signal,
    }).catch((requestError) => {
      if (
        requestError?.name !==
        "AbortError"
      ) {
        setError(
          requestError?.message ||
            "Could not start the mini audit."
        );
      }
    });

    return () =>
      controller.abort();
  }, [lead?.website]);

  useEffect(() => {
    window.clearInterval(
      pollRef.current
    );

    const hasPending = Object.values(
      reports
    ).some((report) =>
      ["queued", "generating"].includes(
        report?.status
      )
    );

    if (!lead?.website || !hasPending) {
      return undefined;
    }

    pollRef.current =
      window.setInterval(() => {
        loadReports().catch(() => {});
      }, 1800);

    return () =>
      window.clearInterval(
        pollRef.current
      );
  }, [lead?.website, reports]);

  useEffect(() => {
    if (!lead) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener(
      "keydown",
      closeOnEscape
    );
    document.body.classList.add(
      "audit-drawer-open"
    );

    return () => {
      document.removeEventListener(
        "keydown",
        closeOnEscape
      );
      document.body.classList.remove(
        "audit-drawer-open"
      );
    };
  }, [lead, onClose]);

  if (!lead) return null;

  const business =
    lead.business ||
    lead.name ||
    "Business";

  const generate = async (kind) => {
    setActiveKind(kind);
    setError("");

    try {
      const report = await auditApi(
        "/lead-audits/generate",
        {
          method: "POST",
          body: {
            kind,
            website: lead.website,
            lead,
            niche:
              form.niche ||
              lead.category,
            location:
              form.location ||
              lead.address,
            workspaceName:
              workspace?.title || "",
          },
        }
      );

      setReports((current) => ({
        ...current,
        [kind]: report,
      }));
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Could not start the report."
      );
    }
  };

  const download = async () => {
    if (
      !activeReport ||
      activeReport.status !==
        "complete"
    ) {
      return;
    }

    setDownloading(true);
    setError("");

    try {
      await downloadAuditPdf(
        activeReport
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Could not download the PDF."
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="audit-drawer-backdrop"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose?.();
        }
      }}
    >
      <aside
        className="lead-audit-drawer"
        aria-label={`${business} audit report`}
      >
        <header className="audit-drawer-header">
          <div>
            <span className="eyebrow">
              Website intelligence
            </span>
            <h2>{business}</h2>
            <p>
              {safeHostname(
                lead.website
              )}
            </p>
          </div>

          <button
            type="button"
            className="audit-close-button"
            onClick={onClose}
            aria-label="Close audit"
          >
            ×
          </button>
        </header>

        <div className="audit-kind-tabs">
          {["mini", "competitor", "full"].map(
            (kind) => {
              const report =
                reports[kind];

              return (
                <button
                  key={kind}
                  type="button"
                  className={
                    activeKind === kind
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    if (report) {
                      setActiveKind(kind);
                    } else if (
                      kind === "mini"
                    ) {
                      setActiveKind(kind);
                    } else {
                      generate(kind);
                    }
                  }}
                >
                  <span>
                    {kind === "mini"
                      ? "Mini audit"
                      : kind ===
                          "competitor"
                        ? "Competitors"
                        : "Full audit"}
                  </span>
                  {report?.status ===
                  "complete" ? (
                    <i>✓</i>
                  ) : [
                      "queued",
                      "generating",
                    ].includes(
                      report?.status
                    ) ? (
                    <i className="pending" />
                  ) : null}
                </button>
              );
            }
          )}
        </div>

        <div className="audit-action-bar">
          <div>
            <span
              className={`audit-status ${
                activeReport?.status ||
                "queued"
              }`}
            >
              {activeReport?.status ===
              "complete"
                ? "Report ready"
                : activeReport?.status ===
                    "failed"
                  ? "Needs attention"
                  : "Generating report"}
            </span>

            <small>
              {activeKind === "mini"
                ? "Created automatically from public website and directory evidence."
                : "Generated on demand with Claude and live public research."}
            </small>
          </div>

          <button
            type="button"
            className="btn primary audit-download-button"
            disabled={
              activeReport?.status !==
                "complete" ||
              downloading
            }
            onClick={download}
          >
            {downloading
              ? "Preparing PDF…"
              : "Download PDF"}
          </button>
        </div>

        {error ? (
          <div className="audit-inline-error">
            {error}
          </div>
        ) : null}

        <main className="audit-report-scroll">
          {!activeReport || isWorking ? (
            <AuditReportLoader
              kind={activeKind}
            />
          ) : activeReport.status ===
            "failed" ? (
            <div className="audit-failed-state">
              <span>!</span>
              <h3>Report generation stopped</h3>
              <p>
                {activeReport.error ||
                  "The report could not be generated."}
              </p>
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  activeKind === "mini"
                    ? loadReports({
                        createMini: true,
                      })
                    : generate(
                        activeKind
                      )
                }
              >
                Try again
              </button>
            </div>
          ) : activeKind === "mini" ? (
            <MiniAuditReport
              report={
                activeReport.report
              }
              brand={
                activeReport.brand
              }
            />
          ) : activeKind ===
            "competitor" ? (
            <CompetitorAuditReport
              report={
                activeReport.report
              }
            />
          ) : (
            <FullAuditReport
              report={
                activeReport.report
              }
            />
          )}
        </main>

        <footer className="audit-drawer-footer">
          <button
            type="button"
            className="audit-secondary-action"
            onClick={() =>
              reports.competitor
                ? setActiveKind(
                    "competitor"
                  )
                : generate(
                    "competitor"
                  )
            }
            disabled={[
              "queued",
              "generating",
            ].includes(
              reports.competitor
                ?.status
            )}
          >
            <span>◎</span>
            {reports.competitor
              ? "View competitor analysis"
              : "Generate competitor analysis"}
          </button>

          <button
            type="button"
            className="audit-primary-action"
            onClick={() =>
              reports.full
                ? setActiveKind("full")
                : generate("full")
            }
            disabled={[
              "queued",
              "generating",
            ].includes(
              reports.full?.status
            )}
          >
            <span>✦</span>
            {reports.full
              ? "View full audit report"
              : "Generate full audit report"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function AuditReportLoader({ kind }) {
  return (
    <div className="audit-report-loader">
      <div className="audit-loader-orbit">
        <span />
      </div>
      <h3>
        {kind === "mini"
          ? "Preparing the mini audit"
          : kind === "competitor"
            ? "Researching competitors"
            : "Building the full audit"}
      </h3>
      <p>
        Reviewing public website evidence and live search results. This panel updates automatically.
      </p>
      <div className="audit-loader-lines">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function MiniAuditReport({
  report = {},
  brand = {},
}) {
  const snapshot =
    report.snapshot || {};

  return (
    <article className="mini-audit-sheet">
      <div className="mini-audit-confidential">
        {report.header
          ?.confidentiality ||
          "INTERNAL - SALES TEAM USE ONLY - DO NOT SEND TO CLIENT"}
      </div>

      <div className="mini-audit-brandline">
        {report.header?.brandLine ||
          `${String(
            brand.name ||
              "ReachFly.Ai"
          ).toUpperCase()} · MINI AUDIT REPORT`}
      </div>

      <div className="mini-audit-title">
        <h1>
          {report.header?.title ||
            `${snapshot.businessName || "Business"} - Mini Audit`}
        </h1>
        <p>
          {report.header?.subtitle ||
            "One page. Everything you need before you dial."}
        </p>
      </div>

      <AuditSectionTitle>
        Business snapshot
      </AuditSectionTitle>

      <div className="mini-audit-snapshot">
        <AuditSnapshotRow
          label="Business name"
          value={
            snapshot.businessName
          }
        />
        <AuditSnapshotRow
          label="Phone"
          value={snapshot.phone}
        />
        <AuditSnapshotRow
          label="Email"
          value={snapshot.email}
        />
        <AuditSnapshotRow
          label="Website"
          value={`${
            snapshot.website || ""
          }${
            snapshot.platform
              ? ` · built on ${snapshot.platform}`
              : ""
          }`}
        />
        <AuditSnapshotRow
          label="Decision maker"
          value={
            snapshot.decisionMaker
          }
        />
        <AuditSnapshotRow
          label="Business hours"
          value={
            snapshot.businessHours
          }
        />
        <AuditSnapshotRow
          label="What they do"
          value={snapshot.whatTheyDo}
        />
      </div>

      <AuditSectionTitle>
        Issues found
      </AuditSectionTitle>

      <div className="mini-audit-issues">
        {(report.issues || []).map(
          (issue, index) => (
            <div
              className="mini-audit-issue"
              key={`${
                issue.tag
              }-${index}`}
            >
              <span>{index + 1}</span>
              <div>
                <h3>{issue.tag}</h3>
                <p>
                  <b>
                    Say the finding:
                  </b>{" "}
                  {issue.finding}
                </p>
                <p className="pain">
                  <b>
                    Then the pain:
                  </b>{" "}
                  {issue.pain}
                </p>
                {issue.source ? (
                  <small>
                    Source: {issue.source}
                  </small>
                ) : null}
              </div>
            </div>
          )
        )}
      </div>

      <p className="mini-audit-footer-copy">
        {report.footer}
      </p>
    </article>
  );
}

function AuditSnapshotRow({
  label,
  value,
}) {
  return (
    <div>
      <span>{label}</span>
      <b>
        {value ||
          "Not publicly listed - verify on call"}
      </b>
    </div>
  );
}

function AuditSectionTitle({
  children,
}) {
  return (
    <div className="audit-section-title">
      <span>{children}</span>
    </div>
  );
}

function CompetitorAuditReport({
  report = {},
}) {
  return (
    <article className="expanded-audit-sheet">
      <AuditReportHeading
        eyebrow="Live market comparison"
        title={
          report.title ||
          "Competitor Analysis"
        }
        text={
          report.executiveSummary
        }
      />

      <div className="audit-highlight-grid">
        <AuditHighlight
          label="Market query"
          value={report.marketQuery}
        />
        <AuditHighlight
          label="Target visibility"
          value={
            report.targetVisibility
          }
        />
      </div>

      <AuditSectionTitle>
        Competitors observed
      </AuditSectionTitle>

      <div className="competitor-report-grid">
        {(report.competitors || []).map(
          (competitor, index) => (
            <article key={index}>
              <span>
                #{index + 1}
              </span>
              <h3>
                {competitor.name ||
                  competitor.domain}
              </h3>
              <a
                href={
                  competitor.domain
                    ? `https://${competitor.domain}`
                    : undefined
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                {competitor.domain}
              </a>
              <ul>
                {(
                  competitor.observedAdvantages ||
                  []
                ).map((item, itemIndex) => (
                  <li key={itemIndex}>
                    {item}
                  </li>
                ))}
              </ul>
              <small>
                {(
                  competitor.evidence ||
                  []
                ).join(" · ")}
              </small>
            </article>
          )
        )}
      </div>

      <AuditSectionTitle>
        Competitive gaps
      </AuditSectionTitle>

      <div className="audit-finding-list">
        {(report.competitiveGaps || []).map(
          (item, index) => (
            <article key={index}>
              <span>{index + 1}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.evidence}</p>
                <b>
                  {item.businessImpact}
                </b>
              </div>
            </article>
          )
        )}
      </div>

      <AuditSectionTitle>
        Sales talking points
      </AuditSectionTitle>
      <AuditBulletList
        items={
          report.salesTalkingPoints
        }
      />

      <p className="expanded-audit-disclaimer">
        {report.disclaimer}
      </p>
    </article>
  );
}

function FullAuditReport({
  report = {},
}) {
  return (
    <article className="expanded-audit-sheet">
      <AuditReportHeading
        eyebrow="Evidence-grounded review"
        title={
          report.title ||
          "Full Website Audit"
        }
        text={
          report.executiveSummary
        }
        score={report.score}
      />

      <AuditSectionTitle>
        Strengths
      </AuditSectionTitle>
      <AuditBulletList
        items={report.strengths}
        positive
      />

      <AuditSectionTitle>
        Priority findings
      </AuditSectionTitle>
      <div className="full-audit-findings">
        {(report.priorityFindings || []).map(
          (item, index) => (
            <article key={index}>
              <div>
                <span
                  className={`severity ${
                    item.severity ||
                    "medium"
                  }`}
                >
                  {item.severity ||
                    "medium"}
                </span>
                <h3>{item.title}</h3>
              </div>
              <p>
                <b>Evidence:</b>{" "}
                {item.evidence}
              </p>
              <p>
                <b>
                  Business impact:
                </b>{" "}
                {item.businessImpact}
              </p>
              <p className="recommendation">
                <b>Recommendation:</b>{" "}
                {item.recommendation}
              </p>
            </article>
          )
        )}
      </div>

      <AuditReviewTable
        title="Technical review"
        rows={report.technicalReview}
      />
      <AuditReviewTable
        title="SEO and local visibility"
        rows={
          report.seoAndLocalVisibility
        }
      />
      <AuditReviewTable
        title="Conversion and trust"
        rows={
          report.conversionAndTrust
        }
      />

      <AuditSectionTitle>
        Competitor summary
      </AuditSectionTitle>
      <p className="audit-long-copy">
        {report.competitorSummary}
      </p>

      <AuditSectionTitle>
        Recommended roadmap
      </AuditSectionTitle>
      <div className="audit-roadmap">
        {(report.roadmap || []).map(
          (phase, index) => (
            <article key={index}>
              <span>{index + 1}</span>
              <div>
                <small>
                  {phase.timeframe}
                </small>
                <h3>{phase.phase}</h3>
                <AuditBulletList
                  items={phase.actions}
                />
              </div>
            </article>
          )
        )}
      </div>

      <p className="expanded-audit-disclaimer">
        {report.disclaimer}
      </p>
    </article>
  );
}

function AuditReportHeading({
  eyebrow,
  title,
  text,
  score,
}) {
  return (
    <header className="audit-report-heading">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {Number.isFinite(
        Number(score)
      ) ? (
        <div className="audit-score-ring">
          <strong>
            {Number(score)}
          </strong>
          <small>/100</small>
        </div>
      ) : null}
    </header>
  );
}

function AuditHighlight({
  label,
  value,
}) {
  return (
    <article>
      <span>{label}</span>
      <b>{value || "Not verified"}</b>
    </article>
  );
}

function AuditBulletList({
  items = [],
  positive = false,
}) {
  return (
    <ul
      className={`audit-bullet-list ${
        positive ? "positive" : ""
      }`}
    >
      {(items || []).map(
        (item, index) => (
          <li key={index}>
            <span>
              {positive ? "✓" : "•"}
            </span>
            {item}
          </li>
        )
      )}
    </ul>
  );
}

function AuditReviewTable({
  title,
  rows = [],
}) {
  if (!rows?.length) return null;

  return (
    <>
      <AuditSectionTitle>
        {title}
      </AuditSectionTitle>
      <div className="audit-review-table">
        {rows.map((row, index) => (
          <div key={index}>
            <span
              className={`review-status ${
                row.status ||
                "warning"
              }`}
            >
              {row.status ||
                "warning"}
            </span>
            <b>{row.item}</b>
            <p>{row.evidence}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function LeadCardSkeletons() {
  return (
    <div className="live-lead-grid">
      {Array.from({ length: 6 }).map(
        (_, index) => (
          <div
            className="live-lead-card live-lead-skeleton"
            key={index}
          >
            <i />
            <b />
            <span />
            <span />
            <span />
          </div>
        )
      )}
    </div>
  );
}

function isDisplayableEmail(value) {
  const email = String(
    value || ""
  )
    .trim()
    .toLowerCase();

  if (
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      email
    )
  ) {
    return false;
  }

  if (
    /\.\.|^\.|\.@|@\.|\.$/.test(
      email
    )
  ) {
    return false;
  }

  return !/(@yoursite\.|@example\.|@test\.|@domain\.|\.join$|\.follow$|\.our$|\.invalid$|\.local$)/i.test(
    email
  );
}

function buildBuilderPipeline(form) {
  const offer = String(form.offer || "").trim();

  const serviceLine = offer
    ? `I can help with ${offer}, then connect the lead flow into a simple CRM/follow-up system.`
    : "I can help improve the website, lead capture, CRM flow, and follow-up system so more visitors turn into qualified leads.";

  const emailIntro = {
    name: "Value-first intro",
    channel: "email",
    delayMinutes: 0,
    subject: "Quick idea for {business}",
    body: `Hi {name},

I noticed a quick opportunity for {business}: {firstIssue}.

${serviceLine}

Would you be open to a quick conversation?`,
    enabled: true,
  };

  const emailFollowUp = {
    name: "Helpful follow-up",
    channel: "email",
    delayMinutes: 2880,
    subject: "Quick follow-up for {business}",
    body: `Hi {name},

Just following up on my previous note about {business}.

I noticed one website/lead-capture issue that may be affecting trust, conversions, or inquiries.

If useful, I can send a short 2–3 point improvement plan.

Should I send it over?`,
    enabled: true,
  };

  const whatsappNudge = {
    name: "Short WhatsApp nudge",
    channel: "whatsapp",
    delayMinutes: 4320,
    subject: "",
    body: "Hi {name}, I noticed one growth opportunity for {business}. Want me to send the quick notes?",
    enabled: true,
  };

  const digital =
    form.goal === "email"
      ? [emailIntro, emailFollowUp]
      : form.goal === "whatsapp"
        ? [whatsappNudge]
        : [emailIntro, emailFollowUp, whatsappNudge];

  if (!form.voiceEnabled) {
    return digital;
  }

  return [
    {
      name: "ReachFly AI Voice",
      channel: "ai_voice",
      delayMinutes: 0,
      enabled: true,
      disclosureRequired: true,
      chargingRule: "connected_call_policy",
    },
    ...digital,
  ];
}
function formatChannel(value) {
  if (value === "email") return "Email";
  if (value === "whatsapp") return "WhatsApp";
  return "Email + WhatsApp";
}

function getSelectedEmailLabel(accounts, id) {
  const account = accounts.find((item) => item.id === id);

  if (!account) return "";

  return account.fromEmail || account.username || account.label || "";
}


async function mapWithConcurrency(items, concurrency, worker) {
  const safeItems = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(8, Number(concurrency || 1)));
  const results = new Array(safeItems.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= safeItems.length) return;
      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(safeItems[index], index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, safeItems.length || 1) }, run)
  );
  return results;
}

function findVoiceCallForLead(dashboard, lead, preferredId = "") {
  const calls = Array.isArray(dashboard?.calls) ? dashboard.calls : [];
  const preferred = String(preferredId || "").trim();
  if (preferred) {
    const exact = calls.find(
      (call) => String(call?.id || call?.callId || "") === preferred
    );
    if (exact) return exact;
  }

  const phone = String(lead?.phone || "").replace(/\D/g, "");
  if (!phone) return null;

  return (
    calls.find((call) => {
      const destination = String(
        call?.destinationNumber || call?.toNumber || call?.phone || ""
      ).replace(/\D/g, "");
      return destination && destination === phone;
    }) || null
  );
}

function isTerminalVoiceCallStatus(value) {
  return [
    "completed",
    "failed",
    "rejected",
    "busy",
    "unanswered",
    "cancelled",
    "canceled",
    "disconnected",
    "ended",
  ].includes(
    String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_")
  );
}

function formatVoiceStatus(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ");
  return normalized
    ? normalized.replace(/\b\w/g, (character) => character.toUpperCase())
    : "Unknown";
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function extractTeamMembers(
  response
) {
  const candidates = [
    response?.members,
    response?.users,
    response?.team,
    response?.records,
    response?.dashboard?.members,
    response?.owner?.members,
    response?.data?.members,
    response?.data?.users,
    response?.data?.team,
    response?.workspace?.members,
    response,
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      Array.isArray(
        candidate
      )
    ) {
      return candidate;
    }
  }

  return [];
}

function normalizeTeamMember(
  member
) {
  if (
    !member ||
    typeof member !==
      "object"
  ) {
    return null;
  }

  const sourceUser =
    member.user &&
    typeof member.user ===
      "object"
      ? member.user
      : member;

  const id =
    sourceUser.id ||
    member.userId ||
    member.memberId ||
    member.id ||
    "";

  if (!id) {
    return null;
  }

  const rawRole =
    member.workspaceRole ||
    member.memberRole ||
    member.role ||
    member.membership
      ?.workspaceRole ||
    member.membership?.role ||
    member.workspaceMember
      ?.workspaceRole ||
    member.workspaceMember
      ?.role ||
    sourceUser.workspaceRole ||
    sourceUser.role ||
    member.jobTitle ||
    sourceUser.jobTitle ||
    "";

  const permissions =
    Array.isArray(
      member.permissions
    )
      ? member.permissions
      : Array.isArray(
            sourceUser.permissions
          )
        ? sourceUser.permissions
        : [];

  const normalizedRawRole =
    normalizeWorkspaceRole(rawRole);

  const inferredRole =
    rawRole
      ? normalizedRawRole
      : permissions.includes(
            "make_calls"
          ) ||
          permissions.includes(
            "view_assigned_leads"
          )
        ? "caller"
        : rawRole;

  const role =
    normalizeWorkspaceRole(
      inferredRole
    );

  const normalizedMember = {
    ...sourceUser,
    ...member,

    id,

    name:
      sourceUser.name ||
      sourceUser.fullName ||
      member.name ||
      member.fullName ||
      member.email ||
      sourceUser.email ||
      "Caller",

    email:
      sourceUser.email ||
      member.email ||
      "",

    role,

    workspaceRole:
      role,

    active:
      member.active ??
      sourceUser.active ??
      true,

    isActive:
      member.isActive ??
      sourceUser.isActive ??
      true,

    status:
      member.status ||
      sourceUser.status ||
      "active",

    jobTitle:
      sourceUser.jobTitle ||
      member.jobTitle ||
      (
        role === "caller"
          ? "Caller"
          : ""
      ),

    avatarUrl:
      sourceUser.avatarUrl ||
      member.avatarUrl ||
      sourceUser
        .profileImageUrl ||
      member.profileImageUrl ||
      "",
  };

  console.debug(
    "[Builder] normalizeTeamMember:",
    {
      input:
        member,
      rawRole,
      inferredRole,
      normalized:
        normalizedMember,
    }
  );

  return normalizedMember;
}

function normalizeWorkspaceRole(value) {
  const role = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (role.includes("owner")) {
    return "owner";
  }

  if (role.includes("admin")) {
    return "admin";
  }

  if (role.includes("manager")) {
    return "manager";
  }

  if (
    role === "caller" ||
    role.includes("cold_caller") ||
    role.includes("sales_representative") ||
    role.includes("sales_rep") ||
    role.includes("telemarketer")
  ) {
    return "caller";
  }

  return role || "caller";
}

function clampRadius(value) {
  const number = Number(value || 1);

  return Math.max(1, Math.min(MAX_RADIUS_KM, number));
}