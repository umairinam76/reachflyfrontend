import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Mail,
  MapPin,
  Search,
  Target,
  UserRound,
  Users,
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
              member.role ===
                "caller" &&
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
            "The team API returned no active caller accounts for this workspace."
          );
        }
      } else {

        setCallers([]);
        setSelectedCallerId("");

        setAssignmentError(
          teamResult.reason
            ?.message ||
            "Caller resources could not be loaded."
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
      "/app/builder?view=results"
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
      "Select a caller before assigning leads."
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
      "the selected caller";

    setAssignmentMessage(
      `${updated} lead${
        updated === 1
          ? ""
          : "s"
      } assigned to ${callerName}. They will appear on that caller's My Leads page.`
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
    navigate("/app/builder", {
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
      text="Review lead discovery and outreach readiness. Generated leads can then be assigned to callers or launched through AI Voice from the results screen."
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
  const leads = Array.isArray(
    result?.leads
  )
    ? result.leads
    : [];
  const queuedAuditWebsitesRef =
    useRef(new Set());

  useEffect(() => {
    const pending = leads
      .filter((lead) => lead?.website)
      .filter((lead) => {
        const website = String(
          lead.website || ""
        ).trim();

        if (
          !website ||
          queuedAuditWebsitesRef.current.has(
            website
          )
        ) {
          return false;
        }

        queuedAuditWebsitesRef.current.add(
          website
        );
        return true;
      });

    if (!pending.length) return;

    const timer = window.setTimeout(
      () => {
        auditApi(
          "/lead-audits/mini/batch",
          {
            method: "POST",
            body: {
              leads: pending,
              niche: form.niche,
              location:
                form.location,
              workspaceName:
                workspace?.title || "",
            },
          }
        ).catch(() => {
          for (const lead of pending) {
            queuedAuditWebsitesRef.current.delete(
              String(
                lead.website || ""
              ).trim()
            );
          }
        });
      },
      700
    );

    return () =>
      window.clearTimeout(timer);
  }, [
    leads,
    form.niche,
    form.location,
    workspace?.title,
  ]);

  const normalizedSearch =
    String(search || "")
      .trim()
      .toLowerCase();

  const filteredLeads =
    normalizedSearch
      ? leads.filter((lead) =>
          [
            lead.business,
            lead.name,
            lead.website,
            lead.domain,
            lead.email,
            lead.phone,
            lead.address,
            lead.category,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(
              normalizedSearch
            )
        )
      : leads;

  const requested = Number(
    result?.requested ||
      form.limit ||
      100
  );
  const delivered = leads.length;
  const percent = Math.max(
    0,
    Math.min(
      100,
      Number(
        result?.percent || 0
      )
    )
  );
  const isLoading =
    result?.streaming === true ||
    result?.status === "loading";
  const hasError =
    result?.status === "error";

  const emailCount = leads.filter(
    (lead) =>
      isDisplayableEmail(
        lead.email
      )
  ).length;
  const phoneCount = leads.filter(
    (lead) => lead.phone
  ).length;
  const websiteCount = leads.filter(
    (lead) => lead.website
  ).length;


  return (
    <div className="live-results-page">
      <div className="live-results-topbar">
        <button
          type="button"
          className="btn ghost live-results-back"
          onClick={onBack}
        >
          <ArrowLeft /> Back to builder
        </button>

        <div className="live-results-top-actions">
          <button
            type="button"
            className="btn ghost"
            disabled={!leads.length}
            onClick={onDownload}
          >
            Download CSV
          </button>

          <button
            type="button"
            className="btn primary"
            disabled={isLoading}
            onClick={onRetry}
          >
            <Search /> Run again
          </button>
        </div>
      </div>

      <section className="live-results-hero">
        <div>
          <span className="eyebrow">
            Live Google Places results
          </span>

          <h1>
            {isLoading
              ? "Building your lead list"
              : hasError
                ? "Lead search interrupted"
                : "Your lead list is ready"}
          </h1>

          <p>
            <b>{form.niche}</b> in{" "}
            <b>{form.location}</b>
          </p>
        </div>

        <div
          className={`live-status-pill ${
            hasError
              ? "error"
              : isLoading
                ? "loading"
                : "complete"
          }`}
        >
          <i />
          {hasError
            ? "Needs attention"
            : isLoading
              ? "Live search"
              : "Complete"}
        </div>
      </section>

      <section className="live-progress-card">
        <div className="live-progress-main">
          <div
            className={`live-progress-icon ${
              isLoading
                ? "spinning"
                : hasError
                  ? "failed"
                  : "finished"
            }`}
            aria-hidden="true"
          >
            {isLoading
              ? ""
              : hasError
                ? "!"
                : "✓"}
          </div>

          <div className="live-progress-copy">
            <div className="live-progress-title-row">
              <div>
                <h2>
                  {hasError
                    ? "Search stopped"
                    : result?.message ||
                      "Searching Google Places…"}
                </h2>

                <p>
                  Results appear below as each Google page is processed and each business website is checked.
                </p>
              </div>

              <strong>
                {isLoading
                  ? `${percent}%`
                  : `${delivered}/${requested}`}
              </strong>
            </div>

            <div
              className="live-progress-track"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={percent}
            >
              <span
                style={{
                  width: `${
                    hasError
                      ? Math.max(
                          percent,
                          6
                        )
                      : percent
                  }%`,
                }}
              />
            </div>

            <div className="live-progress-meta">
              <span>
                <b>{delivered}</b> leads loaded
              </span>
              <span>
                Goal: <b>{requested}</b>
              </span>
              <span>
                Source: <b>Google Places</b>
              </span>
            </div>

            {hasError ? (
              <div className="live-results-error">
                {result?.error ||
                  result?.message ||
                  "The lead search could not be completed."}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="live-results-stats">
        <ResultStat
          label="Leads found"
          value={delivered}
          detail={`${Math.max(
            0,
            requested - delivered
          )} remaining`}
        />
        <ResultStat
          label="With email"
          value={emailCount}
          detail="Public contact emails"
        />
        <ResultStat
          label="With phone"
          value={phoneCount}
          detail="Direct business numbers"
        />
        <ResultStat
          label="With website"
          value={websiteCount}
          detail="Official web presence"
        />
      </section>

      {!isLoading &&
    leads.length > 0 ? (
      <section className="live-assignment-panel">
        <div className="live-assignment-header">
          <div>
            <span className="eyebrow">
              Assign to a caller
            </span>

            <h2>
              Choose a caller and lead quantity
            </h2>

            <p>
              Select exactly how many generated leads should
              be assigned to one calling resource.
            </p>
          </div>

          <Users />
        </div>

        {assignmentError ? (
          <div className="error-banner">
            {assignmentError}
          </div>
        ) : null}

        {assignmentMessage ? (
          <div className="success-banner">
            {assignmentMessage}
          </div>
        ) : null}

        <div className="live-assignment-form">
          <label className="field">
            <span>
              Caller resource
            </span>

            <select
              value={
                selectedCallerId
              }
              onChange={(
                event
              ) =>
                onSelectCaller(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                Select caller
              </option>

              {callers.map(
                (caller) => (
                  <option
                    key={
                      caller.id
                    }
                    value={
                      caller.id
                    }
                  >
                    {caller.name ||
                      caller.fullName ||
                      caller.email ||
                      "Caller"}
                    {caller.email
                      ? ` — ${caller.email}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="field">
            <span>
              Number of leads
            </span>

            <input
              type="number"
              min="1"
              max={
                leads.length
              }
              value={
                assignmentLeadCount
              }
              onChange={(
                event
              ) =>
                onAssignmentLeadCountChange(
                  Math.max(
                    1,
                    Math.min(
                      leads.length,
                      Number(
                        event
                          .target
                          .value ||
                          1
                      )
                    )
                  )
                )
              }
            />

            <small>
              Maximum available:{" "}
              {leads.length}
            </small>
          </label>
        </div>

        {!callers.length ? (
          <div className="safe-note-v54">
            No active caller accounts were found.
          </div>
        ) : null}

        <div className="live-assignment-summary">
          <span>
            <b>
              {Math.min(
                leads.length,
                Number(
                  assignmentLeadCount ||
                    1
                )
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
          onClick={
            onAssign
          }
        >
          <Users />

          {assignmentSaving
            ? "Assigning…"
            : "Assign leads to caller"}
        </button>
      </section>
    ) : null}

    {!isLoading && leads.length > 0 ? (
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
    ) : null}

    <section className="live-results-content">
        <div className="live-results-toolbar">
          <div>
            <span className="eyebrow">
              Lead directory
            </span>
            <h2>
              {filteredLeads.length}{" "}
              {filteredLeads.length === 1
                ? "business"
                : "businesses"}
            </h2>
          </div>

          <label className="live-results-search">
            <Search />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                onSearch(
                  event.target.value
                )
              }
              placeholder="Search business, city, email…"
            />
          </label>
        </div>

        {filteredLeads.length ? (
          <div className="live-lead-grid">
            {filteredLeads.map(
              (lead, index) => (
                <LiveLeadCard
                  key={
                    leadIdentity(lead) ||
                    index
                  }
                  lead={lead}
                  index={
                    leads.indexOf(lead) + 1
                  }
                  onOpenAudit={
                    onOpenAudit
                  }
                  onCall={onCall}
                />
              )
            )}
          </div>
        ) : isLoading ? (
          <LeadCardSkeletons />
        ) : (
          <div className="live-results-empty">
            <Search />
            <h3>No matching leads</h3>
            <p>
              Clear the search field or run the Google Places search again.
            </p>
          </div>
        )}

        {isLoading && leads.length ? (
          <div className="live-results-loading-more">
            <span />
            Loading and verifying more businesses…
          </div>
        ) : null}
      </section>

      <p className="builder-promise live-results-promise">
        <Check /> Google Places lead discovery · Results update live · Official business websites
      </p>
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

function LiveLeadCard({
  lead,
  index,
  onOpenAudit,
  onCall,
}) {
  const business =
    lead.business ||
    lead.name ||
    `Lead ${index}`;
  const hostname =
    lead.domain ||
    safeHostname(lead.website);
  const email =
    isDisplayableEmail(lead.email)
      ? lead.email
      : "";
  const initials = business
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const openAudit = () => {
    if (lead.website) {
      onOpenAudit?.(lead);
    }
  };

  return (
    <article
      className={`live-lead-card ${
        lead.website
          ? "audit-ready"
          : ""
      }`}
      onClick={openAudit}
      onKeyDown={(event) => {
        if (
          lead.website &&
          ["Enter", " "].includes(
            event.key
          )
        ) {
          event.preventDefault();
          openAudit();
        }
      }}
      role={
        lead.website
          ? "button"
          : undefined
      }
      tabIndex={
        lead.website ? 0 : -1
      }
    >
      <div className="live-lead-card-head">
        <div className="live-lead-avatar">
          {initials || "RF"}
        </div>

        <span className="live-lead-number">
          #{index}
        </span>
      </div>

      <div className="live-lead-card-title">
        <h3>{business}</h3>
        {lead.category ? (
          <span>{lead.category}</span>
        ) : null}
      </div>

      <div className="live-lead-details">
        {lead.address ? (
          <div>
            <MapPin />
            <span>{lead.address}</span>
          </div>
        ) : null}

        {email ? (
          <div>
            <Mail />
            <a
              href={`mailto:${email}`}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {email}
            </a>
          </div>
        ) : null}

        {lead.phone ? (
          <div>
            <span className="live-lead-detail-symbol">
              ☎
            </span>
            <a
              href={`tel:${String(
                lead.phone
              ).replace(/[^+\d]/g, "")}`}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {lead.phone}
            </a>
          </div>
        ) : null}
      </div>

      <div className="live-lead-card-footer">
        {lead.website ? (
          <a
            className="live-lead-website"
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <Building2 />
            <span>
              {hostname ||
                "Visit website"}
            </span>
            <ArrowRight />
          </a>
        ) : (
          <span className="live-lead-no-website">
            Website unavailable
          </span>
        )}

        <span
          className={`live-lead-quality ${
            lead.dataQuality ||
            "usable"
          }`}
        >
          {lead.qualityScore ||
            lead.confidence ||
            "—"}
        </span>
      </div>

      {lead.assignedToName ||
    lead.assigneeName ? (
      <div className="live-lead-assigned">
        <Users />
        Assigned to{" "}
        <b>
          {lead.assignedToName ||
            lead.assigneeName}
        </b>
      </div>
    ) : null}

    <div className="lead-action-row">
        <button
          type="button"
          className="lead-call-button"
          disabled={!lead.phone}
          onClick={(event) => {
            event.stopPropagation();
            onCall?.(lead);
          }}
        >
          <span>☎</span>
          Call lead
        </button>

      <button
        type="button"
        className="mini-audit-button"
        disabled={!lead.website}
        onClick={(event) => {
          event.stopPropagation();
          openAudit();
        }}
      >
        <span>✦</span>
        View mini audit
        <ArrowRight />
      </button>
      </div>
    </article>
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

  const inferredRole =
    permissions.includes(
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