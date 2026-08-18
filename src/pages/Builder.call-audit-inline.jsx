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
  } from "../components/icons";
  import { City, Country, State } from "country-state-city";
  import { useEffect, useMemo, useRef, useState } from "react";
  import { useNavigate, useSearchParams } from "react-router-dom";
  import { api } from "../api";
  import { useAuth } from "../auth/AuthContext";
  import "./Builder.live-results.css";

  const initial = {
    niche: "",
    location: "",
    radiusKm: 10,
    limit: 100,
    qualityLevel: "balanced",
    goal: "both",
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

  const RAW_API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:8787/api";

  const API_BASE_URL =
    `${String(RAW_API_BASE_URL)
      .trim()
      .replace(/\/$/, "")}${
      /\/api$/i.test(
        String(RAW_API_BASE_URL)
          .trim()
          .replace(/\/$/, "")
      )
        ? ""
        : "/api"
    }`;

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
    return (
      localStorage.getItem(
        "token"
      ) ||
      sessionStorage.getItem(
        "token"
      ) ||
      ""
    );
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

      throw new Error(
        data?.error ||
          data?.message ||
          `Lead request failed with status ${response.status}.`
      );
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
            "Could not retrieve matching business leads."
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
        "Finding matching businesses…",
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

    const isCompany = user?.accountType === "company";

    const workspace = useMemo(() => {
      return {
        accountType: isCompany ? "company" : "individual",
        companyName: isCompany ? user?.companyName || "" : "",
        role: user?.role || "",
        name: user?.name || "",
        email: user?.email || "",
        title: isCompany
          ? user?.companyName || "Company workspace"
          : user?.name || "Individual workspace",
        label: isCompany ? "Company account" : "Individual account",
        icon: isCompany ? Building2 : UserRound,
      };
    }, [isCompany, user]);

    useEffect(() => {
      api.campaigns().then(setCampaigns).catch(() => setCampaigns([]));

      api
        .emailSettings()
        .then((settings) => {
          const accounts = Array.isArray(settings.accounts)
            ? settings.accounts
            : settings.fromEmail || settings.username
              ? [settings]
              : [];

          setEmailAccounts(accounts);

          const activeId =
            settings.activeAccountId ||
            settings.activeAccount?.id ||
            accounts[0]?.id ||
            "";

          if (activeId) {
            setForm((current) => ({
              ...current,
              emailAccountId: current.emailAccountId || activeId,
            }));
          }
        })
        .catch(() => setEmailAccounts([]));
    }, []);

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
          "Finding matching businesses…",
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
            "Could not retrieve matching business leads.",
          message:
            e?.message ||
            "Could not retrieve matching business leads.",
        }));

        setError(
          e?.message ||
            "Could not retrieve matching business leads."
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
        text="Set the lead volume, quality level, and preferred outreach channel."
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
            <span>Outreach channel</span>
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
        text="Review the campaign context and launch. You will see live backend progress on the campaign screen."
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
            ["Channel", formatChannel(form.goal)],
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
      <div className="builder-page rf-builder-call-audit-v7">
        <BuilderCallAuditV7Styles />
        <div className="page-top">
          <div>
            <span className="eyebrow">Campaign builder</span>
            <h1>Four clicks to your next market.</h1>
            <p className="builder-subtitle">
              Your signup details are already saved, so this builder only asks for
              campaign-specific details.
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

          {error ? <p className="form-error">{safeBuilderCallAuditMessage(error)}</p> : null}

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
          <Check /> Verified business discovery · Official business websites
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
          <Check /> Direct Google Places API · Results update live · Official business websites
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
    onOpenAudit,
    onClose,
  }) {
    const [call, setCall] = useState(null);
    const [policy, setPolicy] = useState(null);
    const [error, setError] = useState("");
    const [starting, setStarting] = useState(false);
    const [notes, setNotes] = useState("");
    const [outcome, setOutcome] = useState("follow_up");
    const [callMiniReport, setCallMiniReport] = useState(null);
    const [callMiniLoading, setCallMiniLoading] = useState(false);
    const pollRef = useRef(null);

    useEffect(() => {
      window.clearInterval(pollRef.current);
      setCall(null);
      setError("");
      setNotes("");
      if (!lead) return undefined;
      const encoded = encodeURIComponent(JSON.stringify({
        id: lead.id,
        name: lead.name || lead.business,
        phone: lead.phone,
        email: lead.email,
        website: lead.website,
        address: lead.address,
      }));
      auditApi(`/vonage/contact-policy?lead=${encoded}`)
        .then(setPolicy)
        .catch((e) => setError(e.message));
      if (lead.website) {
        setCallMiniLoading(true);
        auditApi(`/lead-audits?website=${encodeURIComponent(lead.website)}`)
          .then(async (data) => {
            const existing = (data.reports || []).find((report) => report.kind === "mini" && ["complete", "completed"].includes(report.status));
            if (existing) return existing;
            return auditApi("/lead-audits/mini", { method: "POST", body: { lead, niche: form?.niche || lead.category || "", location: form?.location || lead.address || "", brand: workspace } });
          })
          .then(async (report) => {
            let current = report;
            for (let attempt = 0; attempt < 40 && current?.id && !["complete", "completed", "failed"].includes(current.status); attempt += 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 1500));
              current = await auditApi(`/lead-audits/${encodeURIComponent(current.id)}`);
            }
            setCallMiniReport(current);
          })
          .catch((e) => setError((current) => current || e.message))
          .finally(() => setCallMiniLoading(false));
      }
      return () => window.clearInterval(pollRef.current);
    }, [lead]);

    useEffect(() => {
      if (!call?.id || ["completed", "failed", "rejected", "busy", "unanswered", "cancelled", "disconnected"].includes(call.status)) {
        window.clearInterval(pollRef.current);
        return undefined;
      }
      pollRef.current = window.setInterval(() => {
        auditApi(`/vonage/calls/${encodeURIComponent(call.id)}`)
          .then(setCall)
          .catch(() => {});
      }, 1800);
      return () => window.clearInterval(pollRef.current);
    }, [call?.id, call?.status]);

    if (!lead) return null;

    const startCall = async () => {
      setStarting(true);
      setError("");
      try {
        const response = await auditApi("/vonage/calls", {
          method: "POST",
          body: {
            lead,
            campaignId: lead.campaignId || "",
            leadId: lead.id || lead.placeId || "",
            destinationNumber: lead.phone,
          },
        });
        setCall(response);
        setPolicy((current) => ({ ...(current || {}), canContact: false, reason: "Call in progress." }));
      } catch (e) {
        setError(e.message);
      } finally {
        setStarting(false);
      }
    };

    const saveOutcome = async () => {
      if (!call?.id) return;
      try {
        const updated = await auditApi(`/vonage/calls/${encodeURIComponent(call.id)}`, {
          method: "PATCH",
          body: { outcome, notes, status: "completed" },
        });
        setCall(updated);
        notifyBuilderCallAudit(
          "success",
          "Call outcome saved",
          "The call result and notes were saved to the lead."
        );
      } catch (e) {
        setError(e.message);
      }
    };

    const business = lead.business || lead.name || "Lead";
    return (
      <AnimatePresence>
        <motion.div className="audit-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.aside className="call-drawer" initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="call-drawer-header">
              <div>
                <span className="eyebrow">Live call workspace</span>
                <h2>{business}</h2>
                <p>{lead.phone || "No phone number"} · {safeHostname(lead.website) || "Website unavailable"}</p>
              </div>
              <button type="button" className="audit-close" onClick={onClose}>×</button>
            </div>

            <div className="call-status-panel">
              <div className={`call-status-dot ${call?.status || "ready"}`} />
              <div>
                <small>Call status</small>
                <strong>{call?.status ? call.status.replace(/_/g, " ") : "Ready to call"}</strong>
                <span>{policy?.reason || "ReachFly will call your phone first, then connect the lead."}</span>
              </div>
              <button type="button" className="btn primary call-now-button" disabled={starting || !lead.phone || policy?.canContact === false || Boolean(call?.id)} onClick={startCall}>
                {starting ? "Starting…" : "☎ Start call"}
              </button>
            </div>

            {error ? <div className="live-results-error">{safeBuilderCallAuditMessage(error)}</div> : null}

            <section className="call-mini-audit-embedded call-mini-audit-expanded">
              <header>
                <div>
                  <span className="eyebrow">Mini audit · live call intelligence</span>
                  <h3>
                    {callMiniReport?.report?.header?.title ||
                      callMiniReport?.content?.header?.title ||
                      `${business} - Mini Audit`}
                  </h3>
                  <p>
                    Keep this report visible throughout the conversation. Use only verified findings and record the prospect's response in the call notes.
                  </p>
                </div>

                <span className={`call-audit-status ${callMiniLoading ? "working" : "ready"}`}>
                  {callMiniLoading ? "Generating" : "Ready"}
                </span>
              </header>

              {callMiniLoading ? (
                <div className="call-mini-loading">
                  Preparing verified talking points from the public website…
                </div>
              ) : (() => {
                  const content =
                    callMiniReport?.report ||
                    callMiniReport?.content ||
                    callMiniReport?.result ||
                    {};

                  const snapshot = content.snapshot || {};
                  const issues = Array.isArray(content.issues)
                    ? content.issues
                    : [];

                  return (
                    <>
                      <div className="call-audit-snapshot-grid">
                        <div>
                          <small>Business</small>
                          <b>{snapshot.businessName || business}</b>
                        </div>
                        <div>
                          <small>Website</small>
                          <b>{snapshot.website || safeHostname(lead.website) || "Not available"}</b>
                        </div>
                        <div>
                          <small>Platform</small>
                          <b>{snapshot.platform || "Not identified"}</b>
                        </div>
                        <div>
                          <small>Decision maker</small>
                          <b>{snapshot.decisionMaker || "Not publicly identified — verify on call"}</b>
                        </div>
                        <div>
                          <small>Business hours</small>
                          <b>{snapshot.businessHours || "Not publicly listed — verify on call"}</b>
                        </div>
                        <div>
                          <small>Contact</small>
                          <b>{snapshot.phone || lead.phone || "No phone"}</b>
                        </div>
                      </div>

                      {snapshot.whatTheyDo ? (
                        <div className="call-audit-description">
                          <small>What they do</small>
                          <p>{snapshot.whatTheyDo}</p>
                        </div>
                      ) : null}

                      <div className="call-audit-issues-heading">
                        <div>
                          <small>Verified findings</small>
                          <h4>Issues to discuss during the call</h4>
                        </div>
                        <strong>{issues.length}</strong>
                      </div>

                      <div className="call-audit-issues-list">
                        {issues.map((issue, index) => (
                          <article
                            className="call-audit-issue"
                            key={`${issue.tag || "issue"}-${index}`}
                          >
                            <span>{index + 1}</span>
                            <div>
                              <b>{issue.tag || "Verified finding"}</b>
                              <p>{issue.finding || issue.sayTheFinding || ""}</p>
                              <p className="call-audit-pain">
                                <strong>Business consequence:</strong>{" "}
                                {issue.pain || issue.thenThePain || ""}
                              </p>
                            </div>
                          </article>
                        ))}
                      </div>

                      {!issues.length ? (
                        <div className="call-mini-loading">
                          The mini audit is still being generated. It will appear here automatically without opening another screen.
                        </div>
                      ) : null}
                    </>
                  );
                })()}
            </section>

            <section className="call-script-card">
              <span className="eyebrow">Call context</span>
              <h3>{form?.niche || lead.category || "Business"} · {form?.location || lead.address || "Target market"}</h3>
              <p>Open with one verified issue from the mini audit, confirm the business impact, then ask permission to send the full report.</p>
            </section>

            {call?.id ? (
              <section className="call-outcome-card">
                <label>
                  <span>Outcome</span>
                  <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                    <option value="follow_up">Follow up</option>
                    <option value="interested">Interested</option>
                    <option value="meeting_booked">Meeting booked</option>
                    <option value="not_interested">Not interested</option>
                    <option value="wrong_number">Wrong number</option>
                    <option value="no_answer">No answer</option>
                  </select>
                </label>
                <label>
                  <span>Call notes</span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Capture objections, timing, decision maker, and next step…" />
                </label>
                <button type="button" className="btn primary" onClick={saveOutcome}>Save call outcome</button>
              </section>
            ) : null}
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

        notifyBuilderCallAudit(
          "success",
          "Audit started",
          kind === "competitor"
            ? "Competitor research is now running."
            : "The full website audit is now running."
        );
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
                  : "Generated on demand with live public research."}
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
              {safeBuilderCallAuditMessage(error)}
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
                  {safeBuilderCallAuditMessage(activeReport.error) ||
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
                "ReachFlyAI"
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

    if (form.goal === "email") {
      return [emailIntro, emailFollowUp];
    }

    if (form.goal === "whatsapp") {
      return [whatsappNudge];
    }

    return [emailIntro, emailFollowUp, whatsappNudge];
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

  function clampRadius(value) {
    const number = Number(value || 1);

    return Math.max(1, Math.min(MAX_RADIUS_KM, number));
  }

function safeBuilderCallAuditMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/Vonage/gi, "calling service")
    .replace(/Google Places/gi, "business discovery")
    .replace(/Claude/gi, "AI research")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function notifyBuilderCallAudit(type, title, message) {
  if (typeof window === "undefined") {
    return;
  }

  const bridge = window.reachflyToast;
  if (bridge && typeof bridge[type] === "function") {
    bridge[type](title, message);
    return;
  }

  window.dispatchEvent(
    new CustomEvent("reachfly:toast", {
      detail: { type, title, message },
    })
  );
}

function BuilderCallAuditV7Styles() {
  return (
    <style>{`
      .rf-builder-call-audit-v7{
        --rfbca-text:#191c1d;
        --rfbca-text2:#4d4c59;
        --rfbca-muted:#777784;
        --rfbca-line:#e2e4e7;
        --rfbca-primary:#4648d4;
        --rfbca-primary-dark:#393bbb;
        --rfbca-primary-soft:#e8e9ff;
        --rfbca-violet:#6b38d4;
        --rfbca-violet-soft:#f1ebff;
        --rfbca-green:#087a51;
        --rfbca-green-soft:#e4f7ee;
        --rfbca-red:#ba1a1a;
        --rfbca-red-soft:#ffedeb;
        --rfbca-dark:#2e3132;
        --rfbca-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfbca-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-builder-call-audit-v7 *,
      .rf-builder-call-audit-v7 *::before,
      .rf-builder-call-audit-v7 *::after{box-sizing:border-box}

      .rf-builder-call-audit-v7 .page-top{
        min-height:150px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        padding:19px;
        margin-bottom:10px;
        color:#fff;
        background:
          radial-gradient(circle at 88% 15%,rgba(86,89,223,.26),transparent 32%),
          radial-gradient(circle at 15% 90%,rgba(107,56,212,.16),transparent 29%),
          #2e3132;
        border-radius:14px;
      }

      .rf-builder-call-audit-v7 .page-top .eyebrow{
        color:#c9caff;
        font-size:6px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-builder-call-audit-v7 .page-top h1{
        margin:4px 0 0;
        color:#fff;
        font:600 30px/38px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rf-builder-call-audit-v7 .builder-subtitle{
        max-width:760px;
        margin:5px 0 0;
        color:rgba(244,246,247,.62);
        font-size:8px;
        line-height:13px;
      }

      .rf-builder-call-audit-v7 .step-count{
        min-width:64px;
        min-height:64px;
        display:grid;
        place-items:center;
        align-content:center;
        color:#fff;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.1);
        border-radius:12px;
        font:600 19px/22px Geist,Inter,sans-serif;
      }

      .rf-builder-call-audit-v7 .step-count small{font-size:6px;color:rgba(255,255,255,.55)}

      .rf-builder-call-audit-v7 .step-line{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:5px;
        margin-bottom:10px;
      }

      .rf-builder-call-audit-v7 .step-line i{
        height:5px;
        background:#e7e8eb;
        border-radius:999px;
      }

      .rf-builder-call-audit-v7 .step-line i.active{
        background:linear-gradient(90deg,#5658df,#4648d4,#6b38d4);
      }

      .rf-builder-call-audit-v7 .builder-card{
        min-width:0;
        padding:15px;
        background:#fff;
        border:1px solid var(--rfbca-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-builder-call-audit-v7 .builder-step{
        display:grid;
        gap:10px;
      }

      .rf-builder-call-audit-v7 .builder-step > .eyebrow{
        color:var(--rfbca-primary);
        font-size:5.8px;
        font-weight:800;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rf-builder-call-audit-v7 .builder-step h2{
        margin:0;
        font:600 17px/23px Geist,Inter,sans-serif;
        letter-spacing:-.018em;
      }

      .rf-builder-call-audit-v7 .builder-step > p{
        margin:0;
        color:var(--rfbca-muted);
        font-size:6.2px;
        line-height:10px;
      }

      .rf-builder-call-audit-v7 .builder-workspace-summary,
      .rf-builder-call-audit-v7 .sentence-card,
      .rf-builder-call-audit-v7 .builder-review-grid > div,
      .rf-builder-call-audit-v7 .launch-settings > label,
      .rf-builder-call-audit-v7 .range-label{
        padding:10px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
      }

      .rf-builder-call-audit-v7 .launch-settings,
      .rf-builder-call-audit-v7 .builder-review-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf-builder-call-audit-v7 label{
        display:grid;
        gap:4px;
      }

      .rf-builder-call-audit-v7 label > span,
      .rf-builder-call-audit-v7 .field-label{
        color:var(--rfbca-muted);
        font-size:5.5px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rf-builder-call-audit-v7 input,
      .rf-builder-call-audit-v7 select,
      .rf-builder-call-audit-v7 textarea{
        width:100%;
        min-height:39px;
        padding:8px 9px;
        color:var(--rfbca-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 6.5px/11px Inter,sans-serif;
      }

      .rf-builder-call-audit-v7 textarea{min-height:90px;resize:vertical}
      .rf-builder-call-audit-v7 input:focus,
      .rf-builder-call-audit-v7 select:focus,
      .rf-builder-call-audit-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-builder-call-audit-v7 .suggestions,
      .rf-builder-call-audit-v7 .radius-quick-options{
        display:flex;
        flex-wrap:wrap;
        gap:5px;
      }

      .rf-builder-call-audit-v7 .suggestions button,
      .rf-builder-call-audit-v7 .radius-quick-options button{
        min-height:29px;
        padding:5px 7px;
        color:#56577a;
        background:var(--rfbca-primary-soft);
        border:1px solid #dddfff;
        border-radius:999px;
        cursor:pointer;
        font-size:5.3px;
        font-weight:700;
      }

      .rf-builder-call-audit-v7 .radius-quick-options button.active{
        color:#fff;
        background:var(--rfbca-primary);
        border-color:var(--rfbca-primary);
      }

      .rf-builder-call-audit-v7 .builder-actions{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:7px;
        padding-top:11px;
        margin-top:11px;
        border-top:1px solid #eff0f1;
      }

      .rf-builder-call-audit-v7 .btn,
      .audit-drawer-backdrop .btn{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        color:var(--rfbca-text,#191c1d);
        background:#fff;
        border:1px solid var(--rfbca-line,#e2e4e7);
        border-radius:8px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
        transition:.14s var(--rfbca-ease,cubic-bezier(.2,.8,.2,1));
      }

      .rf-builder-call-audit-v7 .btn.primary,
      .audit-drawer-backdrop .btn.primary{
        color:#fff;
        background:var(--rfbca-primary,#4648d4);
        border-color:var(--rfbca-primary,#4648d4);
      }

      .rf-builder-call-audit-v7 .btn:hover:not(:disabled),
      .audit-drawer-backdrop .btn:hover:not(:disabled){transform:translateY(-1px)}
      .rf-builder-call-audit-v7 .btn:disabled,
      .audit-drawer-backdrop .btn:disabled{opacity:.43;cursor:not-allowed}

      .rf-builder-call-audit-v7 .form-error,
      .live-results-error,
      .audit-inline-error{
        padding:9px 10px;
        margin-top:8px;
        color:#7c1d1d;
        background:#ffedeb;
        border:1px solid #ffd0cc;
        border-radius:8px;
        font-size:6.2px;
        line-height:10px;
      }

      .rf-builder-call-audit-v7 .builder-promise{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        margin:10px 0 0;
        color:var(--rfbca-muted);
        font-size:5.4px;
      }

      .audit-drawer-backdrop{
        position:fixed;
        z-index:2147481100;
        inset:0;
        display:grid;
        justify-items:end;
        padding:0;
        background:rgba(25,28,29,.58);
        backdrop-filter:blur(8px);
      }

      .lead-audit-drawer,
      .call-drawer{
        width:min(760px,92vw);
        height:100vh;
        display:grid;
        grid-template-rows:auto auto auto minmax(0,1fr) auto;
        overflow:hidden;
        color:#191c1d;
        background:#fff;
        border-left:1px solid #e2e4e7;
        box-shadow:-18px 0 55px rgba(25,28,29,.16);
      }

      .call-drawer{width:min(700px,92vw);grid-template-rows:auto auto minmax(0,1fr)}

      .audit-drawer-header,
      .call-drawer-header{
        min-height:82px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:13px 15px;
        color:#fff;
        background:
          radial-gradient(circle at 90% 10%,rgba(86,89,223,.24),transparent 32%),
          #2e3132;
        border-bottom:1px solid rgba(255,255,255,.06);
      }

      .audit-drawer-header .eyebrow,
      .call-drawer-header .eyebrow{color:#c9caff;font-size:5.5px;font-weight:800;text-transform:uppercase}
      .audit-drawer-header h2,
      .call-drawer-header h2{margin:2px 0 0;color:#fff;font:600 16px/21px Geist,Inter,sans-serif}
      .audit-drawer-header p,
      .call-drawer-header p{margin:2px 0 0;color:rgba(244,246,247,.6);font-size:5.5px}

      .audit-close-button,
      .audit-close{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:#fff;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.12);
        border-radius:8px;
        cursor:pointer;
        font-size:14px;
      }

      .audit-kind-tabs{
        display:flex;
        gap:4px;
        overflow-x:auto;
        padding:6px 10px;
        background:#fafbfb;
        border-bottom:1px solid #e2e4e7;
      }

      .audit-kind-tabs button{
        min-height:33px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:5px 8px;
        color:#4d4c59;
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:5.6px;
        font-weight:750;
      }

      .audit-kind-tabs button.active{color:#4648d4;background:#e8e9ff}

      .audit-action-bar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:9px 11px;
        background:#fff;
        border-bottom:1px solid #e2e4e7;
      }

      .audit-status{
        display:inline-flex;
        width:max-content;
        padding:4px 6px;
        color:#57587a;
        background:#e8e9ff;
        border-radius:999px;
        font-size:5px;
        font-weight:800;
      }

      .audit-report-scroll{
        min-height:0;
        overflow-y:auto;
        padding:13px;
        background:#f8f9fa;
      }

      .mini-audit-sheet,
      .expanded-audit-sheet{
        display:grid;
        gap:10px;
        padding:14px;
        background:#fff;
        border:1px solid #e2e4e7;
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .mini-audit-confidential{
        padding:7px 8px;
        color:#825400;
        background:#fff3d8;
        border-radius:7px;
        text-align:center;
        font-size:5px;
        font-weight:800;
      }

      .mini-audit-brandline{color:#4648d4;font-size:5.5px;font-weight:800;letter-spacing:.06em}
      .mini-audit-title h1,
      .audit-report-heading h1{margin:0;font:600 20px/27px Geist,Inter,sans-serif;letter-spacing:-.025em}
      .mini-audit-title p,
      .audit-report-heading p{margin:4px 0 0;color:#777784;font-size:6px;line-height:10px}

      .audit-section-title{
        padding:7px 0 5px;
        border-bottom:1px solid #eff0f1;
        color:#4648d4;
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .mini-audit-snapshot,
      .call-audit-snapshot-grid,
      .audit-highlight-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:6px;
      }

      .mini-audit-snapshot > div,
      .call-audit-snapshot-grid > div,
      .audit-highlight-grid > div{
        min-width:0;
        min-height:60px;
        display:grid;
        align-content:center;
        padding:8px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .mini-audit-snapshot span,
      .call-audit-snapshot-grid small,
      .audit-highlight-grid span{color:#777784;font-size:4.8px}
      .mini-audit-snapshot b,
      .call-audit-snapshot-grid b,
      .audit-highlight-grid b{margin-top:2px;overflow:hidden;text-overflow:ellipsis;font-size:5.7px}

      .mini-audit-issues,
      .call-audit-issues-list,
      .audit-finding-list,
      .full-audit-findings,
      .competitor-report-grid,
      .audit-roadmap{display:grid;gap:6px}

      .mini-audit-issue,
      .call-audit-issue,
      .audit-finding-list > article,
      .full-audit-findings > article,
      .competitor-report-grid > article,
      .audit-roadmap > article{
        min-width:0;
        padding:9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
      }

      .call-status-panel{
        display:grid;
        grid-template-columns:10px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:10px 12px;
        background:#fafbfb;
        border-bottom:1px solid #e2e4e7;
      }

      .call-status-dot{width:9px;height:9px;background:#087a51;border-radius:50%}
      .call-status-panel > div{min-width:0;display:grid}
      .call-status-panel small{color:#777784;font-size:4.8px}
      .call-status-panel strong{font-size:6.2px}
      .call-status-panel span{margin-top:2px;color:#777784;font-size:5.2px}

      .call-mini-audit-embedded,
      .call-script-card,
      .call-outcome-card{
        margin:10px 12px 0;
        padding:11px;
        background:#fff;
        border:1px solid #e2e4e7;
        border-radius:9px;
      }

      .audit-report-loader,
      .audit-failed-state{
        min-height:360px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:7px;
        padding:24px;
        text-align:center;
        background:#fff;
        border:1px dashed #d9dbdf;
        border-radius:10px;
      }

      .audit-loader-orbit{
        width:52px;
        height:52px;
        border:2px solid #e8e9ff;
        border-top-color:#4648d4;
        border-radius:50%;
      }

      .audit-drawer-footer{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:7px;
        padding:9px 11px;
        background:#fff;
        border-top:1px solid #e2e4e7;
      }

      @media(max-width:900px){
        .rf-builder-call-audit-v7{padding:22px}
        .rf-builder-call-audit-v7 .launch-settings,
        .rf-builder-call-audit-v7 .builder-review-grid{grid-template-columns:1fr 1fr}
      }

      @media(max-width:620px){
        .rf-builder-call-audit-v7{padding:18px 12px 80px}
        .rf-builder-call-audit-v7 .page-top{padding:15px;align-items:flex-start;flex-direction:column}
        .rf-builder-call-audit-v7 .page-top h1{font-size:24px;line-height:31px}
        .rf-builder-call-audit-v7 .launch-settings,
        .rf-builder-call-audit-v7 .builder-review-grid,
        .mini-audit-snapshot,
        .call-audit-snapshot-grid,
        .audit-highlight-grid{grid-template-columns:1fr}
        .rf-builder-call-audit-v7 .builder-actions{align-items:stretch;flex-direction:column-reverse}
        .rf-builder-call-audit-v7 .builder-actions .btn{width:100%}
        .lead-audit-drawer,
        .call-drawer{width:100vw}
        .audit-action-bar,
        .audit-drawer-footer{align-items:stretch;flex-direction:column}
        .audit-action-bar .btn,
        .audit-drawer-footer button{width:100%}
        .call-status-panel{grid-template-columns:10px minmax(0,1fr)}
        .call-status-panel .call-now-button{grid-column:1/-1;width:100%}
      }

      @media(prefers-reduced-motion:reduce){
        .rf-builder-call-audit-v7,
        .rf-builder-call-audit-v7 *,
        .audit-drawer-backdrop,
        .audit-drawer-backdrop *{animation:none!important;transition-duration:.01ms!important}
      }
    `}</style>
  );
}
