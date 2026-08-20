import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../lib/workspace-platform-client.js";
import {
  Clock3,
  GitBranch,
  Mail,
  Phone,
  Rocket,
  Search,
  Settings,
  Target,
  Users,
  Zap,
} from "../components/icons";

const steps = [
  "Lead source",
  "Map fields",
  "Campaign setup",
  "Review & save",
];

const standardFields = [
  { key: "firstName", label: "First name" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "website", label: "Website" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "notes", label: "Notes" },
  { key: "sheetPitch", label: "Personalized pitch" },
];

const DEFAULT_SHEET_FALLBACK_MESSAGE = `Hi {{firstName}},

I reviewed {{company}} and noticed one website issue that may be affecting trust, conversions, or lead capture: {{notes}}

I help startup and mid-sized businesses improve websites, connect leads into CRM, and set up AI-powered follow-up so more visitors turn into qualified leads.

Would you like me to send 2-3 quick fixes for {{company}}?`;

const DEFAULT_SHEET_PITCH_FORMAT = `{{sheetPitch}}`;

const nicheRules = [
  {
    key: "saas",
    label: "SaaS / Software",
    keywords: [
      "saas",
      "software",
      "platform",
      "crm",
      "dashboard",
      "api",
      "developer",
      "cloud",
      "b2b",
      "subscription",
    ],
  },
  {
    key: "ai_data",
    label: "AI / Data",
    keywords: [
      "ai",
      "artificial intelligence",
      "machine learning",
      "data",
      "analytics",
      "automation",
      "intelligence",
      "predictive",
    ],
  },
  {
    key: "healthcare",
    label: "Healthcare / MedTech",
    keywords: [
      "health",
      "medical",
      "clinic",
      "patient",
      "pharma",
      "biotech",
      "care",
      "dental",
      "therapy",
      "hospital",
    ],
  },
  {
    key: "logistics",
    label: "Logistics / Delivery",
    keywords: [
      "logistics",
      "delivery",
      "freight",
      "shipping",
      "warehouse",
      "supply chain",
      "transport",
      "tracking",
      "last-mile",
    ],
  },
  {
    key: "real_estate",
    label: "Real Estate / PropTech",
    keywords: [
      "real estate",
      "property",
      "proptech",
      "mortgage",
      "broker",
      "construction",
      "homes",
      "listing",
    ],
  },
  {
    key: "ecommerce",
    label: "Ecommerce / Retail",
    keywords: [
      "ecommerce",
      "e-commerce",
      "retail",
      "shopify",
      "marketplace",
      "store",
      "consumer",
      "brand",
      "inventory",
    ],
  },
  {
    key: "fintech",
    label: "Fintech / Payments",
    keywords: [
      "fintech",
      "payment",
      "banking",
      "finance",
      "billing",
      "stripe",
      "insurance",
      "loan",
      "wealth",
      "compliance",
    ],
  },
  {
    key: "restaurant",
    label: "Restaurant / Local Business",
    keywords: [
      "restaurant",
      "food",
      "hospitality",
      "hotel",
      "cafe",
      "bar",
      "salon",
      "fitness",
      "spa",
      "booking",
    ],
  },
  {
    key: "professional_services",
    label: "Professional Services",
    keywords: [
      "law",
      "legal",
      "accounting",
      "consulting",
      "agency",
      "marketing",
      "staffing",
      "recruiting",
      "advisory",
    ],
  },
];

export default function ExternalLeadCampaign() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const role = normalizeWorkspaceRole(
    user?.workspaceRole ||
      user?.role ||
      ""
  );

  const canManage = ["owner", "admin", "manager"].includes(role);

  const [step, setStep] = useState(0);
  const [sourceType, setSourceType] = useState("file");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [parseError, setParseError] = useState("");
  const [fieldMap, setFieldMap] = useState({});
  const [tableSearch, setTableSearch] = useState("");

  const [campaignName, setCampaignName] = useState("");
  const [channel, setChannel] = useState("email");
  const [goal, setGoal] = useState("Book meetings");
  const [dailyLimit, setDailyLimit] = useState(30);

  const [messageMode, setMessageMode] = useState("custom");
  const [subjectLine, setSubjectLine] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [sheetPitchFormat, setSheetPitchFormat] = useState(
    DEFAULT_SHEET_PITCH_FORMAT
  );
  const [aiInstruction, setAiInstruction] = useState(
    "Write a short, natural B2B cold email that feels personal, relevant, and focused on a real business problem. Keep it under 120 words."
  );
  const [selectedSegmentKey, setSelectedSegmentKey] = useState("all");
  const [isWritingMessage, setIsWritingMessage] = useState(false);

  const [emailAccounts, setEmailAccounts] = useState([]);
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceWorkspace, setVoiceWorkspace] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");

  useEffect(() => {
    if (!canManage) {
      setEmailAccounts([]);
      setSelectedEmailAccountId("");
      setVoiceWorkspace(null);
      setBillingData(null);
      return undefined;
    }

    let active = true;

    async function loadWorkspaceReadiness() {
      const [emailResult, voiceResult, billingResult] =
        await Promise.allSettled([
          api.emailSettings(),
          apiRequest(
            "/telnyx/ai-agent/dashboard",
            { timeoutMs: 20_000 }
          ),
          apiRequest(
            "/billing/credits",
            { timeoutMs: 15_000 }
          ),
        ]);

      if (!active) return;

      if (emailResult.status === "fulfilled") {
        const settings = emailResult.value || {};
        const accounts = Array.isArray(settings.accounts)
          ? settings.accounts
          : settings.fromEmail || settings.username
            ? [settings]
            : [];

        setEmailAccounts(accounts);
        setSelectedEmailAccountId(
          settings.activeAccountId ||
            settings.activeAccount?.id ||
            accounts[0]?.id ||
            ""
        );
      } else {
        setEmailAccounts([]);
        setSelectedEmailAccountId("");
      }

      setVoiceWorkspace(
        voiceResult.status === "fulfilled"
          ? voiceResult.value || null
          : null
      );

      setBillingData(
        billingResult.status === "fulfilled"
          ? billingResult.value || null
          : null
      );
    }

    void loadWorkspaceReadiness();

    return () => {
      active = false;
    };
  }, [canManage]);

  useEffect(() => {
    if (!user || canManage) return;

    navigate("/app/dashboard", {
      replace: true,
    });
  }, [canManage, navigate, user]);


  const selectedEmailAccount = useMemo(() => {
    return (
      emailAccounts.find((account) => account.id === selectedEmailAccountId) ||
      null
    );
  }, [emailAccounts, selectedEmailAccountId]);


  const emailEnabled =
    channel === "email" ||
    channel === "multi-channel";

  const whatsappEnabled =
    channel === "whatsapp" ||
    channel === "multi-channel";

  const digitalEnabled =
    emailEnabled || whatsappEnabled;

  const voiceAgent =
    voiceWorkspace?.agent || {};

  const voiceDiagnostics =
    voiceWorkspace?.diagnostics || {};

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

  const aiCalling =
    billingData?.aiCalling || null;

  const aiCallBalance = Number(
    aiCalling?.wallet?.balance ??
      aiCalling?.wallet?.available ??
      0
  );

  const aiCallCreditsKnown =
    Boolean(aiCalling?.wallet);

  const stats = useMemo(() => {
    const emailHeader = fieldMap.email;
    const phoneHeader = fieldMap.phone;
    const companyHeader = fieldMap.company;
    const websiteHeader = fieldMap.website;

    const validEmails = records
      .map((row) => getPrimaryEmail(row[emailHeader]))
      .filter(Boolean);

    const normalizedEmails = validEmails.map((email) => email.toLowerCase());
    const duplicateEmails =
      normalizedEmails.length - new Set(normalizedEmails).size;

    const validPhones = records
      .map((row) => normalizePhone(getValue(row, phoneHeader)))
      .filter(isCallablePhone);

    const companies = new Set(
      records
        .map((row) => formatCell(row[companyHeader]))
        .filter(Boolean)
        .map((value) => value.toLowerCase())
    );

    const websites = new Set(
      records
        .map((row) => formatCell(row[websiteHeader]))
        .filter(Boolean)
        .map((value) => value.toLowerCase())
    );

    return {
      total: records.length,
      columns: headers.length,
      validEmails: validEmails.length,
      missingEmails: Math.max(records.length - validEmails.length, 0),
      duplicateEmails,
      validPhones: validPhones.length,
      missingPhones: Math.max(records.length - validPhones.length, 0),
      companies: companies.size,
      websites: websites.size,
    };
  }, [records, headers, fieldMap]);

  const sheetPitchStats = useMemo(() => {
    if (!fieldMap.sheetPitch) {
      return { hasColumn: false, rowsWithPitch: 0 };
    }

    return {
      hasColumn: true,
      rowsWithPitch: records.filter((row) => getValue(row, fieldMap.sheetPitch))
        .length,
    };
  }, [records, fieldMap]);

  const filteredRecords = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();

    if (!query) return records;

    return records.filter((row) =>
      headers.some((header) =>
        formatCell(row[header]).toLowerCase().includes(query)
      )
    );
  }, [records, headers, tableSearch]);

  const segments = useMemo(() => {
    return segmentRecords(records, fieldMap);
  }, [records, fieldMap]);

  const selectedSegment = useMemo(() => {
    if (selectedSegmentKey === "all") {
      return {
        key: "all",
        label: "All detected niches",
        count: records.length,
        records,
      };
    }

    return (
      segments.find((segment) => segment.key === selectedSegmentKey) || {
        key: "all",
        label: "All detected niches",
        count: records.length,
        records,
      }
    );
  }, [selectedSegmentKey, segments, records]);

  const importedSegmentLeads = useMemo(() => {
    const sourceRows =
      Array.isArray(selectedSegment?.records)
        ? selectedSegment.records
        : records;

    return sourceRows.map((row, index) =>
      mapImportedLead(row, fieldMap, index, {
        useSheetPitch: messageMode === "sheet",
        sheetPitchFormat,
        fallbackTemplate:
          messageMode === "sheet"
            ? messageTemplate || DEFAULT_SHEET_FALLBACK_MESSAGE
            : messageTemplate,
      })
    );
  }, [
    selectedSegment,
    records,
    fieldMap,
    messageMode,
    messageTemplate,
    sheetPitchFormat,
  ]);

  const campaignEligibleLeads = useMemo(() => {
    return importedSegmentLeads.filter((lead) => {
      const emailReady =
        emailEnabled && isValidEmail(lead.email);

      const phoneReady =
        (whatsappEnabled || voiceEnabled) &&
        isCallablePhone(lead.phone);

      return emailReady || phoneReady;
    });
  }, [
    importedSegmentLeads,
    emailEnabled,
    whatsappEnabled,
    voiceEnabled,
  ]);

  const selectedEmailReadyCount = useMemo(
    () =>
      importedSegmentLeads.filter((lead) =>
        isValidEmail(lead.email)
      ).length,
    [importedSegmentLeads]
  );

  const selectedPhoneReadyCount = useMemo(
    () =>
      importedSegmentLeads.filter((lead) =>
        isCallablePhone(lead.phone)
      ).length,
    [importedSegmentLeads]
  );


  const canContinue = useMemo(() => {
    if (step === 0) return records.length > 0;

    if (step === 2) {
      const hasSubject =
        !emailEnabled ||
        subjectLine.trim().length > 0;

      const hasCustomMessage =
        messageTemplate.trim().length > 0;

      const hasSheetPitch =
        emailEnabled &&
        messageMode === "sheet" &&
        fieldMap.sheetPitch &&
        sheetPitchStats.rowsWithPitch > 0 &&
        sheetPitchFormat.trim().length > 0 &&
        sheetPitchFormat.includes("{{sheetPitch}}");

      const digitalMessageReady =
        !digitalEnabled ||
        hasCustomMessage ||
        hasSheetPitch;

      return (
        campaignName.trim().length > 0 &&
        (digitalEnabled || voiceEnabled) &&
        hasSubject &&
        digitalMessageReady
      );
    }

    return true;
  }, [
    step,
    records,
    campaignName,
    subjectLine,
    messageTemplate,
    messageMode,
    fieldMap.sheetPitch,
    sheetPitchStats.rowsWithPitch,
    sheetPitchFormat,
    emailEnabled,
    digitalEnabled,
    voiceEnabled,
  ]);


  const applySheet = (sheet) => {
    setSelectedSheet(sheet.name);
    setRecords(sheet.rows);
    setHeaders(sheet.headers);
    setFieldMap(autoDetectFields(sheet.headers));
    setTableSearch("");
    setSelectedSegmentKey("all");
    setSubjectLine("");
    setMessageTemplate("");
    setSheetPitchFormat(DEFAULT_SHEET_PITCH_FORMAT);
    setLaunchError("");
  };

  const handleSheetChange = (event) => {
    const nextSheet = sheets.find((sheet) => sheet.name === event.target.value);

    if (nextSheet) applySheet(nextSheet);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setParseError("");
    setFileName(file.name);
    setLaunchError("");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      const parsedSheets = workbook.SheetNames.map((name) => {
        const worksheet = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          raw: false,
        });

        const sheetHeaders = collectHeaders(rows);

        return {
          name,
          rows,
          headers: sheetHeaders,
        };
      }).filter((sheet) => sheet.headers.length > 0);

      if (!parsedSheets.length) {
        setParseError("No readable rows were found in this file.");
        setSheets([]);
        setRecords([]);
        setHeaders([]);
        return;
      }

      setSheets(parsedSheets);
      applySheet(parsedSheets[0]);
    } catch (error) {
      console.error(error);
      setParseError(
        "Could not read this file. Please upload a valid .xlsx or .csv file."
      );
      setSheets([]);
      setRecords([]);
      setHeaders([]);
    }
  };

  const updateFieldMap = (field, value) => {
    setFieldMap((current) => ({
      ...current,
      [field]: value,
    }));
    setLaunchError("");
  };

  const nextStep = () => {
    if (!canContinue) return;

    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const previousStep = () => {
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetFlow = () => {
    setStep(0);
    setSourceType("file");
    setFileName("");
    setSheets([]);
    setSelectedSheet("");
    setRecords([]);
    setHeaders([]);
    setParseError("");
    setFieldMap({});
    setTableSearch("");
    setCampaignName("");
    setChannel("email");
    setVoiceEnabled(false);
    setGoal("Book meetings");
    setDailyLimit(30);
    setMessageMode("custom");
    setSubjectLine("");
    setMessageTemplate("");
    setSheetPitchFormat(DEFAULT_SHEET_PITCH_FORMAT);
    setSelectedSegmentKey("all");
    setLaunchError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const insertVariable = (variable) => {
    setMessageTemplate((current) => {
      const spacer = current && !current.endsWith(" ") ? " " : "";
      return `${current}${spacer}{{${variable}}}`;
    });
  };

  const insertSheetFormatVariable = (variable) => {
    setSheetPitchFormat((current) => {
      const spacer = current && !current.endsWith(" ") ? " " : "";
      return `${current}${spacer}{{${variable}}}`;
    });
  };

  const writeSuggestedMessage = () => {
    setMessageMode("ai");
    setIsWritingMessage(true);

    try {
      const draft = generateNicheEmail({
        segment: selectedSegment,
        goal,
        aiInstruction,
      });

      setSubjectLine(draft.subject);
      setMessageTemplate(draft.body);
    } finally {
      setIsWritingMessage(false);
    }
  };


  const launchCampaign = async () => {
    try {
      setLaunchError("");

      if (!canManage) {
        setLaunchError(
          "Only workspace owners, administrators, and managers can create campaigns."
        );
        return;
      }

      if (!digitalEnabled && !voiceEnabled) {
        setLaunchError(
          "Select at least one outreach path: digital follow-up or AI Voice Agent."
        );
        return;
      }

      if (emailEnabled && !selectedEmailAccountId) {
        setLaunchError(
          "Please select a sender email account for email follow-up."
        );
        return;
      }

      if (!campaignEligibleLeads.length) {
        setLaunchError(
          "No imported leads are eligible for the selected outreach paths. Map a valid email for email outreach or a callable phone number for WhatsApp / AI Voice Agent."
        );
        return;
      }

      if (!campaignName.trim()) {
        setLaunchError("Campaign name is required.");
        return;
      }

      if (
        emailEnabled &&
        messageMode === "sheet" &&
        (
          !sheetPitchFormat.trim() ||
          !sheetPitchFormat.includes("{{sheetPitch}}")
        )
      ) {
        setLaunchError(
          "Sheet pitch email format must include {{sheetPitch}} so each row pitch can be inserted."
        );
        return;
      }

      setLaunching(true);

      const selectedRows =
        Array.isArray(selectedSegment?.records)
          ? selectedSegment.records
          : records;

      const location = getImportedCampaignLocation(
        selectedRows,
        fieldMap
      );

      const senderEmail =
        emailEnabled
          ? selectedEmailAccount?.fromEmail ||
            selectedEmailAccount?.username ||
            ""
          : "";

      const pipeline = buildExternalCampaignPipeline({
        channel,
        voiceEnabled,
        messageMode,
        subjectLine,
        messageTemplate,
        sheetPitchFormat,
      });

      const created = await api.createCampaign({
        source: "external-import",
        externalImport: true,

        name: campaignName || "External lead campaign",
        niche: selectedSegment.label || "External leads",
        location,
        goal,
        offer: "External lead outreach campaign",

        emailAccountId:
          emailEnabled
            ? selectedEmailAccountId
            : "",
        senderEmail,

        messageMode,
        sheetPitchField: fieldMap.sheetPitch || "",
        sheetPitchFormat,
        usesSheetPitch:
          emailEnabled &&
          messageMode === "sheet",

        voiceEnabled,
        aiVoiceEnabled: voiceEnabled,
        dailyLimit: Number(dailyLimit || 30),
        outreachPlan: {
          aiVoice: voiceEnabled,
          digitalChannel: channel,
          disclosureRequired: voiceEnabled,
          recordingPolicy:
            voiceEnabled
              ? "workspace_policy"
              : "",
        },

        limit: campaignEligibleLeads.length,
        totalRows: selectedRows.length,
        validEmails: selectedEmailReadyCount,
        missingEmails: Math.max(
          selectedRows.length - selectedEmailReadyCount,
          0
        ),
        validPhones: selectedPhoneReadyCount,
        missingPhones: Math.max(
          selectedRows.length - selectedPhoneReadyCount,
          0
        ),
        duplicateEmails: stats.duplicateEmails,
        selectedSegment: selectedSegment.label,

        leads: campaignEligibleLeads,
        pipeline,
      });

      const campaignId =
        created?.id ||
        created?.campaign?.id ||
        "";

      if (!campaignId) {
        throw new Error(
          "The campaign was saved without a campaign ID."
        );
      }

      notifyExternalCampaign(
        "success",
        "Campaign created",
        `${campaignName || "External lead campaign"} was created and is ready in Pipeline Builder.`
      );

      navigate(
        `/app/campaigns/${campaignId}/pipeline`
      );
    } catch (error) {
      const message =
        safeExternalCampaignMessage(
          error?.message ||
            "Could not save the campaign."
        );

      setLaunchError(
        message
      );

      notifyExternalCampaign(
        "error",
        "Campaign could not be created",
        message
      );
    } finally {
      setLaunching(false);
    }
  };


  const firstRecord = selectedSegment?.records?.[0] || records[0] || {};

  if (!canManage) {
    return (
      <div className="page rf-external-restricted-v7">
        <ExternalLeadCampaignV7Styles />
        <div className="card">
          <span className="eyebrow">
            Restricted workspace feature
          </span>
          <h1>
            Campaign management access required
          </h1>
          <p className="text-muted">
            External lead imports and campaign creation are available to workspace owners, administrators, and managers.
          </p>
          <button
            type="button"
            className="btn primary mt16"
            onClick={() =>
              navigate("/app/dashboard", {
                replace: true,
              })
            }
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="external-campaign-page rf-external-campaign-v7">
      <ExternalLeadCampaignV7Styles />
      <div className="external-campaign-hero">
        <div>
          <h1>Run campaigns from your own lead lists</h1>
          <p>
            Upload an Excel/CSV lead list, map email and phone fields, segment the
            audience, configure digital follow-up and optional AI Voice Agent, then save
            the campaign into the same pipeline and Voice Agent workflow used by
            discovered leads.
          </p>
        </div>

        <button type="button" className="btn primary" onClick={resetFlow}>
          <Rocket />
          Start new campaign
        </button>
      </div>

      <div className="external-stepper">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`external-step ${step === index ? "active" : ""} ${
              step > index ? "done" : ""
            }`}
          >
            <span>{index + 1}</span>
            <div>
              <small>Step {index + 1}</small>
              <b>{label}</b>
            </div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="external-card">
          <div className="external-card-head">
            <div>
              <h2>Choose lead source</h2>
              <p>
                Start from a spreadsheet. Connector-based imports are shown as
                unavailable until a real connector API is wired.
              </p>
            </div>
          </div>

          <div className="external-source-grid">
            <button
              type="button"
              onClick={() => setSourceType("file")}
              className={`external-source-card ${
                sourceType === "file" ? "active" : ""
              }`}
            >
              <span>
                <Users />
              </span>
              <div>
                <b>Upload Excel / CSV</b>
                <small>
                  Import leads from .xlsx or .csv with fields like name, email,
                  company, website, phone, city, notes, and personalized pitch.
                </small>
              </div>
            </button>

            <button
              type="button"
              className="external-source-card"
              disabled
              title="Connector import is not enabled in this build."
            >
              <span>
                <GitBranch />
              </span>
              <div>
                <b>Connected source</b>
                <small>
                  Connector-based imports are not enabled in this build. Use Excel
                  or CSV so the page only offers an import path that is actually
                  available.
                </small>
              </div>
            </button>
          </div>

          {sourceType === "file" ? (
            <>
              <label className="external-upload-box">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                />

                <span>
                  <Zap />
                </span>

                <b>Upload your lead file</b>
                <small>Supported formats: .xlsx, .xls and .csv</small>

                {fileName && <em>Selected: {fileName}</em>}
              </label>

              {parseError && <div className="external-error">{parseError}</div>}

              {records.length > 0 && (
                <LeadPreview
                  sheets={sheets}
                  selectedSheet={selectedSheet}
                  handleSheetChange={handleSheetChange}
                  records={records}
                  filteredRecords={filteredRecords}
                  headers={headers}
                  stats={stats}
                  tableSearch={tableSearch}
                  setTableSearch={setTableSearch}
                />
              )}
            </>
          ) : (
            <div className="external-warning">
              <GitBranch />
              <div>
                <b>Connected imports are not enabled.</b>
                <p>Use Excel or CSV for this campaign. This screen does not claim an external connector until a real connector API is wired.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="external-card">
          <div className="external-card-head">
            <div>
              <h2>Map lead fields</h2>
              <p>
                Match spreadsheet columns with ReachFly fields. This works even
                if every uploaded sheet has a different format.
              </p>
            </div>
          </div>

          <div className="external-field-grid">
            {standardFields.map((field) => (
              <label key={field.key} className="field">
                <span>{field.label}</span>
                <select
                  value={fieldMap[field.key] || ""}
                  onChange={(event) =>
                    updateFieldMap(field.key, event.target.value)
                  }
                >
                  <option value="">Do not map</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="external-launch-layout">
          <div className="external-launch-main">
            <div className="external-card">
              <div className="external-card-head">
                <div>
                  <h2>Campaign setup</h2>
                  <p>
                    Configure the campaign, choose a niche segment, and generate
                    a message that fits the actual lead data.
                  </p>
                </div>
              </div>

              <div className="external-field-grid">
                <label className="field">
                  <span>Campaign name</span>
                  <input
                    value={campaignName}
                    onChange={(event) => setCampaignName(event.target.value)}
                    placeholder="AI and tech campaign"
                  />
                </label>

                <label className="field">
                  <span>Digital follow-up</span>
                  <select
                    value={channel}
                    onChange={(event) => {
                      const nextChannel = event.target.value;
                      setChannel(nextChannel);

                      if (
                        nextChannel === "whatsapp" &&
                        messageMode === "sheet"
                      ) {
                        setMessageMode("custom");
                      }
                    }}
                  >
                    <option value="none">No digital follow-up</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="multi-channel">Email + WhatsApp</option>
                  </select>
                </label>

                <label className="field">
                  <span>Campaign goal</span>
                  <select
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                  >
                    <option>Book meetings</option>
                    <option>Sell AI automation</option>
                    <option>Offer website audit</option>
                    <option>Offer CRM / dashboard build</option>
                    <option>Offer API integration</option>
                    <option>Follow up with existing leads</option>
                  </select>
                </label>

                <label className="field">
                  <span>Digital daily limit</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={dailyLimit}
                    onChange={(event) => setDailyLimit(event.target.value)}
                  />
                </label>
              </div>

              <div className="external-card">
                <div className="external-card-head">
                  <div>
                    <h3>ReachFly AI Voice</h3>
                    <p>
                      Optionally call imported leads that have a mapped phone
                      number. Calls use the dedicated Voice Agent workflow,
                      calling policy, and AI call-credit wallet.
                    </p>
                  </div>
                  <Phone />
                </div>

                <label className="field">
                  <span>AI Voice calling</span>
                  <select
                    value={voiceEnabled ? "enabled" : "disabled"}
                    onChange={(event) =>
                      setVoiceEnabled(
                        event.target.value === "enabled"
                      )
                    }
                  >
                    <option value="disabled">Not enabled</option>
                    <option value="enabled">Enable AI Voice stage</option>
                  </select>
                </label>

                <div className="external-summary-grid">
                  <SummaryItem
                    label="Voice Agent"
                    value={
                      voiceReady
                        ? "Ready"
                        : "Setup required"
                    }
                  />
                  <SummaryItem
                    label="Business number"
                    value={
                      voiceNumber ||
                      "Not selected"
                    }
                  />
                  <SummaryItem
                    label="Phone-ready leads"
                    value={selectedPhoneReadyCount}
                  />
                  <SummaryItem
                    label="AI call credits"
                    value={
                      aiCallCreditsKnown
                        ? aiCallBalance
                        : "Not available"
                    }
                  />
                </div>

                {voiceEnabled ? (
                  <div className="external-warning">
                    <Phone />
                    <div>
                      <b>
                        Automated AI calling disclosure is required.
                      </b>
                      <p>
                        The Voice Agent must identify itself as an AI sales agent.
                        Recording behavior follows the workspace recording policy.
                        Voice call limits come from Voice Agent settings, not the
                        digital daily limit above. Saving this campaign does not
                        bypass calling windows, suppression rules, number
                        verification, or call-credit checks.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-gap mt16">
                  <Link
                    className="btn light"
                    to="/app/voice-agent"
                  >
                    Voice Agent
                  </Link>
                  <Link
                    className="btn light"
                    to="/app/billing"
                  >
                    Credits &amp; usage
                  </Link>
                </div>
              </div>

              <LeadSegmentPanel
                records={records}
                segments={segments}
                selectedSegmentKey={selectedSegmentKey}
                setSelectedSegmentKey={setSelectedSegmentKey}
              />

              {digitalEnabled ? (
              <div className="external-message-composer">
                <div className="external-message-head">
                  <div>
                    <h3>Digital follow-up message</h3>
                    <p>
                      Write your own message, let ReachFly AI create one, or use
                      a personalized pitch directly from your uploaded sheet.
                    </p>
                  </div>

                  <div className="external-message-tabs">
                    <button
                      type="button"
                      className={messageMode === "custom" ? "active" : ""}
                      onClick={() => setMessageMode("custom")}
                    >
                      Custom
                    </button>

                    <button
                      type="button"
                      className={messageMode === "ai" ? "active" : ""}
                      onClick={() => setMessageMode("ai")}
                    >
                      Smart template
                    </button>

                    {emailEnabled ? (
                    <button
                      type="button"
                      className={messageMode === "sheet" ? "active" : ""}
                      onClick={() => {
                        setMessageMode("sheet");

                        if (!subjectLine.trim()) {
                          setSubjectLine("Quick idea for {{company}}");
                        }

                        if (!sheetPitchFormat.trim()) {
                          setSheetPitchFormat(DEFAULT_SHEET_PITCH_FORMAT);
                        }
                      }}
                    >
                      Sheet pitch
                    </button>
                    ) : null}
                  </div>
                </div>

                {messageMode === "ai" && (
                  <div className="external-ai-writer">
                    <label className="field">
                      <span>Template guidance</span>
                      <textarea
                        value={aiInstruction}
                        onChange={(event) =>
                          setAiInstruction(event.target.value)
                        }
                        placeholder="Describe the tone or focus for the starter template..."
                      />
                    </label>

                    <div className="external-ai-context">
                      <span>
                        <Target />
                      </span>
                      <div>
                        <b>{selectedSegment.label}</b>
                        <small>
                          This screen uses a deterministic niche template based on
                          the selected segment. It does not call a generative model.
                        </small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn primary"
                      onClick={writeSuggestedMessage}
                      disabled={isWritingMessage}
                    >
                      <Zap />
                      {isWritingMessage
                        ? "Preparing template..."
                        : "Generate starter template"}
                    </button>
                  </div>
                )}

                {messageMode === "sheet" && (
                  <div className="external-sheet-pitch-box">
                    <div className="external-ai-context">
                      <span>
                        <Mail />
                      </span>
                      <div>
                        <b>Use personalized pitch from your sheet</b>
                        <small>
                          ReachFly will insert every row’s personalized pitch
                          into your email format below. This lets you control
                          spacing, intro, CTA, and signature.
                        </small>
                      </div>
                    </div>

                    <label className="field">
                      <span>Personalized pitch column</span>
                      <select
                        value={fieldMap.sheetPitch || ""}
                        onChange={(event) =>
                          updateFieldMap("sheetPitch", event.target.value)
                        }
                      >
                        <option value="">Select pitch column</option>
                        {headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="external-sheet-pitch-stats">
                      <b>{sheetPitchStats.rowsWithPitch}</b>
                      <span>rows have a personalized pitch</span>
                    </div>

                    <label className="field external-message-field">
                      <span>Sheet pitch email format</span>
                      <textarea
                        value={sheetPitchFormat}
                        onChange={(event) =>
                          setSheetPitchFormat(event.target.value)
                        }
                        placeholder={DEFAULT_SHEET_PITCH_FORMAT}
                      />
                      <small className="external-field-help">
                        Use {"{{sheetPitch}}"} where the personalized pitch from
                        each row should appear. This format will stay editable
                        inside Pipeline Builder.
                      </small>
                    </label>

                    <div className="external-variable-row">
                      {[
                        "firstName",
                        "company",
                        "website",
                        "city",
                        "state",
                        "niche",
                        "notes",
                        "sheetPitch",
                      ].map((variable) => (
                        <button
                          key={variable}
                          type="button"
                          onClick={() => insertSheetFormatVariable(variable)}
                        >
                          {"{{"}
                          {variable}
                          {"}}"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {emailEnabled ? (
                  <label className="field external-message-field">
                    <span>Subject line</span>
                    <input
                      value={subjectLine}
                      onChange={(event) => setSubjectLine(event.target.value)}
                      placeholder="Quick idea for {{company}}"
                    />
                  </label>
                ) : null}

                <label className="field external-message-field">
                  <span>
                    {messageMode === "sheet"
                      ? "Fallback email body"
                      : "Email body"}
                  </span>
                  <textarea
                    value={messageTemplate}
                    onChange={(event) =>
                      setMessageTemplate(event.target.value)
                    }
                    placeholder={
                      messageMode === "sheet"
                        ? "Optional fallback message for rows that do not have a personalized pitch..."
                        : "Write your campaign message here..."
                    }
                  />
                </label>

                {messageMode !== "sheet" && (
                  <div className="external-variable-row">
                    {[
                      "firstName",
                      "company",
                      "website",
                      "city",
                      "state",
                      "niche",
                      "notes",
                      "sheetPitch",
                    ].map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(variable)}
                      >
                        {"{{"}
                        {variable}
                        {"}}"}
                      </button>
                    ))}
                  </div>
                )}

                <div className="external-preview-message">
                  <small>Personalized preview</small>
                  <b>{personalizeMessage(subjectLine, firstRecord, fieldMap)}</b>
                  <p>
                    {getPreviewBody({
                      messageMode,
                      messageTemplate,
                      sheetPitchFormat,
                      row: firstRecord,
                      fieldMap,
                    }) || "Your personalized preview will appear here."}
                  </p>
                </div>
              </div>
              ) : (
                <div className="external-warning">
                  <Phone />
                  <div>
                    <b>No digital follow-up selected.</b>
                    <p>
                      This campaign will save the imported lead context for your AI Voice Agent.
                      Email and WhatsApp execution remain disabled until you add a
                      digital stage in Pipeline Builder.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="external-launch-side">
            <div className="external-card">
              <h3>Lead data health</h3>

              <div className="external-data-health">
                <SummaryItem label="Total leads" value={stats.total} />
                <SummaryItem label="Valid emails" value={stats.validEmails} />
                <SummaryItem label="Callable phones" value={stats.validPhones} />
                <SummaryItem
                  label="Missing emails"
                  value={stats.missingEmails}
                />
                <SummaryItem
                  label="Missing phones"
                  value={stats.missingPhones}
                />
                <SummaryItem
                  label="Duplicates"
                  value={stats.duplicateEmails}
                />
              </div>

              <h3 className="mt24">Detected niches</h3>

              <div className="external-mapped-fields">
                {segments.length ? (
                  segments.map((segment) => (
                    <div key={segment.key}>
                      <span>{segment.label}</span>
                      <b>{segment.count} leads</b>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">No niche data detected yet.</p>
                )}
              </div>

              <h3 className="mt24">Mapped fields</h3>

              <div className="external-mapped-fields">
                {standardFields.map((field) => (
                  <div key={field.key}>
                    <span>{field.label}</span>
                    <b>{fieldMap[field.key] || "Not mapped"}</b>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <MappedLeadPreview records={records} fieldMap={fieldMap} />
        </div>
      )}

      {step === 3 && (
        <div className="external-card">
          <div className="external-card-head">
            <div>
              <h2>Review and launch</h2>
              <p>
                Confirm contact eligibility and outreach readiness, then save this
                imported campaign into Pipeline Builder. AI Voice execution remains
                in the dedicated Voice Agent workflow.
              </p>
            </div>
          </div>

          <div className="external-summary-grid">
            <SummaryItem label="Campaign" value={campaignName || "Untitled"} />
            <SummaryItem label="Digital follow-up" value={formatDigitalChannel(channel)} />
            <SummaryItem
              label="AI Voice"
              value={
                voiceEnabled
                  ? voiceReady
                    ? "Enabled · ready"
                    : "Enabled · setup required"
                  : "Not enabled"
              }
            />
            <SummaryItem label="Goal" value={goal} />
            <SummaryItem label="Digital daily limit" value={dailyLimit} />
            <SummaryItem label="Selected rows" value={importedSegmentLeads.length} />
            <SummaryItem label="Email-ready" value={selectedEmailReadyCount} />
            <SummaryItem label="Phone-ready" value={selectedPhoneReadyCount} />
            <SummaryItem label="Campaign-ready" value={campaignEligibleLeads.length} />
            <SummaryItem label="Selected segment" value={selectedSegment.label} />
            <SummaryItem
              label="Message source"
              value={
                messageMode === "sheet"
                  ? "Personalized pitch from sheet"
                  : messageMode === "ai"
                  ? "Smart niche template"
                  : "Custom message"
              }
            />
            <SummaryItem
              label="Sender"
              value={
                emailEnabled
                  ? selectedEmailAccount?.fromEmail ||
                    selectedEmailAccount?.username ||
                    "Not selected"
                  : "Not required"
              }
            />
          </div>

          <div className="external-email-link-card">
            <div>
              <h3>Sender email account</h3>
              <p>
                {emailEnabled
                  ? "Choose the configured email account for email stages."
                  : "Email is not selected, so no sender account is required."}
              </p>
            </div>

            {!emailEnabled ? (
              <div className="external-email-empty">
                <Mail />
                <div>
                  <b>No sender required</b>
                  <small>Add an email stage later in Pipeline Builder if needed.</small>
                </div>
              </div>
            ) : emailAccounts.length ? (
              <label className="field">
                <span>Send from</span>
                <select
                  value={selectedEmailAccountId}
                  onChange={(event) =>
                    setSelectedEmailAccountId(event.target.value)
                  }
                >
                  <option value="">Select sender email</option>
                  {emailAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label || account.fromEmail || account.username} ·{" "}
                      {account.fromEmail || account.username}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="external-email-empty">
                <Mail />
                <div>
                  <b>No sender email connected</b>
                  <small>Add an email account before launching this campaign.</small>
                </div>
                <Link className="btn small" to="/app/connections">
                  Open integrations
                </Link>
              </div>
            )}
          </div>

          {launchError ? <div className="error-banner">{launchError}</div> : null}

          {digitalEnabled ? (
            <div className="external-message-preview">
              <h3>Digital message preview</h3>
              {emailEnabled ? (
                <>
                  <small>Subject</small>
                  <b>{personalizeMessage(subjectLine, firstRecord, fieldMap)}</b>
                </>
              ) : null}
              <p>
                {getPreviewBody({
                  messageMode,
                  messageTemplate,
                  sheetPitchFormat,
                  row: firstRecord,
                  fieldMap,
                })}
              </p>
            </div>
          ) : null}

          {emailEnabled && selectedEmailReadyCount < importedSegmentLeads.length ? (
            <div className="external-warning">
              <Clock3 />
              <div>
                <b>
                  {importedSegmentLeads.length - selectedEmailReadyCount} selected leads do not have valid emails.
                </b>
                <p>
                  They are kept only when another selected path, such as AI Voice
                  or WhatsApp, has a usable phone number.
                </p>
              </div>
            </div>
          ) : null}

          {(voiceEnabled || whatsappEnabled) &&
          selectedPhoneReadyCount < importedSegmentLeads.length ? (
            <div className="external-warning">
              <Phone />
              <div>
                <b>
                  {importedSegmentLeads.length - selectedPhoneReadyCount} selected leads do not have callable phone numbers.
                </b>
                <p>
                  AI Voice and WhatsApp can only use records with a mapped,
                  callable phone number.
                </p>
              </div>
            </div>
          ) : null}

          {voiceEnabled && !voiceReady ? (
            <div className="external-warning">
              <Phone />
              <div>
                <b>AI Voice setup is not launch-ready.</b>
                <p>
                  You can save the campaign and configure its sequence, but complete
                  the Voice Agent identity, verified business number, compliance
                  confirmation, and activation before starting calls.
                </p>
              </div>
            </div>
          ) : null}

          {voiceEnabled && aiCallCreditsKnown && aiCallBalance <= 0 ? (
            <div className="external-warning">
              <Clock3 />
              <div>
                <b>No AI call credits are currently available.</b>
                <p>
                  Saving the campaign is still allowed. Calls remain blocked by the
                  Voice Agent until the dedicated AI call-credit wallet is funded.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="external-actions">
        <button
          type="button"
          className="btn ghost"
          onClick={previousStep}
          disabled={step === 0 || launching}
        >
          Back
        </button>

        <span>
          {step === 0 && records.length > 0
            ? `${records.length} leads ready`
            : step === 2
            ? messageMode === "sheet"
              ? "Edit sheet pitch format or fallback message"
              : "Add a subject and campaign message"
            : step === 3
            ? `${campaignEligibleLeads.length} campaign-ready leads will be saved`
            : ""}
        </span>

        {step < steps.length - 1 ? (
          <button
            type="button"
            className="btn primary"
            onClick={nextStep}
            disabled={!canContinue}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            onClick={launchCampaign}
            disabled={
              launching ||
              !campaignEligibleLeads.length ||
              (emailEnabled && !selectedEmailAccountId)
            }
          >
            <Rocket />
            {launching
              ? "Saving campaign..."
              : "Save campaign & open pipeline"}
          </button>
        )}
      </div>
    </div>
  );
}

function LeadPreview({
  sheets,
  selectedSheet,
  handleSheetChange,
  records,
  filteredRecords,
  headers,
  stats,
  tableSearch,
  setTableSearch,
}) {
  return (
    <div className="external-records-panel">
      <div className="external-records-head">
        <div>
          <h3>Uploaded lead data</h3>
          <p>
            Previewing every row and column from your file. This table adapts to
            any sheet format.
          </p>
        </div>

        {sheets.length > 1 && (
          <label className="field">
            <span>Sheet</span>
            <select value={selectedSheet} onChange={handleSheetChange}>
              {sheets.map((sheet) => (
                <option key={sheet.name} value={sheet.name}>
                  {sheet.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="external-record-stats">
        <RecordStat label="Rows" value={stats.total} />
        <RecordStat label="Columns" value={stats.columns} />
        <RecordStat label="Valid emails" value={stats.validEmails} />
        <RecordStat label="Callable phones" value={stats.validPhones} />
        <RecordStat label="Companies" value={stats.companies} />
      </div>

      <div className="external-table-toolbar">
        <label className="external-table-search">
          <Search />
          <input
            value={tableSearch}
            onChange={(event) => setTableSearch(event.target.value)}
            placeholder="Search uploaded data..."
          />
        </label>

        <span className="external-table-meta">
          Showing {filteredRecords.length} of {records.length} rows
        </span>
      </div>

      <div className="external-column-cloud all-columns">
        {headers.map((header) => (
          <span key={header}>{header}</span>
        ))}
      </div>

      <div className="external-table-wrap full-sheet">
        <table className="external-preview-table">
          <thead>
            <tr>
              <th>#</th>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredRecords.slice(0, 100).map((row, index) => (
              <tr key={`${index}-${JSON.stringify(row).slice(0, 30)}`}>
                <td>{index + 1}</td>
                {headers.map((header) => (
                  <td key={header}>{formatCell(row[header]) || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRecords.length > 100 && (
        <p className="text-muted text-xs mt16">
          Showing first 100 matching rows for performance. The full file is
          still available for mapping and campaign launch.
        </p>
      )}
    </div>
  );
}

function LeadSegmentPanel({
  records,
  segments,
  selectedSegmentKey,
  setSelectedSegmentKey,
}) {
  return (
    <div className="external-segment-panel">
      <div className="external-message-head">
        <div>
          <h3>Detected lead segments</h3>
          <p>
            ReachFly groups leads by niche so the starter message can be more
            relevant instead of using one generic pitch for every audience.
          </p>
        </div>
      </div>

      <div className="external-segment-grid">
        <button
          type="button"
          className={`external-segment-card ${
            selectedSegmentKey === "all" ? "active" : ""
          }`}
          onClick={() => setSelectedSegmentKey("all")}
        >
          <span>
            <Users />
          </span>
          <div>
            <b>All detected niches</b>
            <small>{records.length} leads</small>
          </div>
        </button>

        {segments.map((segment) => (
          <button
            type="button"
            key={segment.key}
            className={`external-segment-card ${
              selectedSegmentKey === segment.key ? "active" : ""
            }`}
            onClick={() => setSelectedSegmentKey(segment.key)}
          >
            <span>
              <Target />
            </span>
            <div>
              <b>{segment.label}</b>
              <small>{segment.count} leads</small>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MappedLeadPreview({ records, fieldMap }) {
  const previewRecords = records.slice(0, 5);

  if (!previewRecords.length) return null;

  return (
    <div className="external-card external-mapped-preview">
      <div className="external-card-head">
        <div>
          <h2>Mapped lead preview</h2>
          <p>
            This is how ReachFly understands the uploaded data after field
            mapping and niche detection.
          </p>
        </div>

        <span>{records.length} leads ready</span>
      </div>

      <div className="external-mapped-lead-grid">
        {previewRecords.map((row, index) => {
          const niche = detectLeadNiche(row, fieldMap);
          const rawEmail = getValue(row, fieldMap.email);
          const primaryEmail = getPrimaryEmail(rawEmail);

          return (
            <article key={index} className="external-mapped-lead-card">
              <div className="external-mapped-avatar">
                {getInitial(getValue(row, fieldMap.company))}
              </div>

              <div>
                <div className="external-mapped-card-top">
                  <h3>{getValue(row, fieldMap.company) || "Unknown company"}</h3>
                  <em>{niche.label}</em>
                </div>

                <p>
                  {primaryEmail || rawEmail || "No email"}
                  {" · "}
                  {getValue(row, fieldMap.phone) || "No phone"}
                </p>

                <div>
                  <small>Company</small>
                  <b>{getValue(row, fieldMap.company) || "Not available"}</b>
                </div>

                <div>
                  <small>Website</small>
                  <b>{getValue(row, fieldMap.website) || "Not available"}</b>
                </div>

                <div>
                  <small>Location</small>
                  <b>
                    {[getValue(row, fieldMap.city), getValue(row, fieldMap.state)]
                      .filter(Boolean)
                      .join(", ") || "Not available"}
                  </b>
                </div>

                <div>
                  <small>Notes</small>
                  <b>{getValue(row, fieldMap.notes) || "Not available"}</b>
                </div>

                {fieldMap.sheetPitch && (
                  <div>
                    <small>Personalized pitch</small>
                    <b>{getValue(row, fieldMap.sheetPitch) || "Not available"}</b>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function RecordStat({ label, value }) {
  return (
    <div className="external-record-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="external-summary-item">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function collectHeaders(rows) {
  const headerSet = new Set();

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (key && !key.startsWith("__EMPTY")) headerSet.add(key);
    });
  });

  return Array.from(headerSet);
}

function autoDetectFields(headers) {
  const findHeader = (patterns) => {
    return (
      headers.find((header) => {
        const normalizedHeader = normalize(header);
        return patterns.some((pattern) => normalizedHeader.includes(pattern));
      }) || ""
    );
  };

  return {
    firstName: findHeader(["first", "name", "contact", "person"]),
    email: findHeader(["email", "mail"]),
    company: findHeader(["company", "business", "organization", "name"]),
    website: findHeader(["website", "domain", "url", "site"]),
    phone: findHeader(["phone", "mobile", "number"]),
    city: findHeader(["city", "town", "hq"]),
    state: findHeader(["state", "province", "region"]),
    notes: findHeader([
      "real issue",
      "notes",
      "description",
      "summary",
      "about",
      "bio",
    ]),
    sheetPitch: findHeader([
      "personalized pitch",
      "pitch",
      "email body",
      "message",
      "personalized message",
      "custom pitch",
      "outreach",
    ]),
  };
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatCell(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") return JSON.stringify(value);

  return String(value).trim();
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function extractEmails(value) {
  return (
    formatCell(value)
      .match(EMAIL_REGEX)
      ?.map((email) => email.trim().toLowerCase()) || []
  );
}

function getPrimaryEmail(value) {
  return extractEmails(value)[0] || "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formatCell(value));
}

function getValue(row, header) {
  if (!header) return "";

  return formatCell(row?.[header]);
}

function getInitial(value) {
  return formatCell(value).charAt(0).toUpperCase() || "?";
}

function detectLeadNiche(row, fieldMap) {
  const mappedText = [
    getValue(row, fieldMap.company),
    getValue(row, fieldMap.website),
    getValue(row, fieldMap.notes),
    getValue(row, fieldMap.city),
    getValue(row, fieldMap.state),
    getValue(row, fieldMap.sheetPitch),
    ...Object.values(row || {}).map(formatCell),
  ]
    .join(" ")
    .toLowerCase();

  let bestMatch = {
    key: "general",
    label: "General Business",
    score: 0,
  };

  nicheRules.forEach((rule) => {
    const score = rule.keywords.reduce((total, keyword) => {
      return mappedText.includes(keyword.toLowerCase()) ? total + 1 : total;
    }, 0);

    if (score > bestMatch.score) {
      bestMatch = {
        key: rule.key,
        label: rule.label,
        score,
      };
    }
  });

  return bestMatch;
}

function segmentRecords(records, fieldMap) {
  const segmentMap = new Map();

  records.forEach((row) => {
    const niche = detectLeadNiche(row, fieldMap);

    if (!segmentMap.has(niche.key)) {
      segmentMap.set(niche.key, {
        key: niche.key,
        label: niche.label,
        count: 0,
        records: [],
      });
    }

    const segment = segmentMap.get(niche.key);
    segment.count += 1;
    segment.records.push(row);
  });

  return Array.from(segmentMap.values()).sort((a, b) => b.count - a.count);
}

function personalizeMessage(template, row, fieldMap) {
  if (!template) return "";

  const niche = detectLeadNiche(row, fieldMap);

  const variables = {
    firstName: getValue(row, fieldMap.firstName) || "there",
    email: getPrimaryEmail(getValue(row, fieldMap.email)),
    emailRaw: getValue(row, fieldMap.email),
    company: getValue(row, fieldMap.company) || "your company",
    website: getValue(row, fieldMap.website),
    phone: getValue(row, fieldMap.phone),
    city: getValue(row, fieldMap.city),
    state: getValue(row, fieldMap.state),
    notes: getValue(row, fieldMap.notes),
    sheetPitch: getValue(row, fieldMap.sheetPitch),
    niche: niche.label,
  };

  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    return variables[key.trim()] || "";
  });
}

function getPreviewBody({
  messageMode,
  messageTemplate,
  sheetPitchFormat,
  row,
  fieldMap,
}) {
  if (messageMode === "sheet") {
    const sheetPitch = getValue(row, fieldMap.sheetPitch);

    if (sheetPitch) {
      return personalizeMessage(
        sheetPitchFormat || DEFAULT_SHEET_PITCH_FORMAT,
        row,
        fieldMap
      );
    }

    return personalizeMessage(
      messageTemplate || DEFAULT_SHEET_FALLBACK_MESSAGE,
      row,
      fieldMap
    );
  }

  return messageTemplate
    ? personalizeMessage(messageTemplate, row, fieldMap)
    : "";
}

function mapImportedLead(row, fieldMap, index, options = {}) {
  const company =
    getValue(row, fieldMap.company) ||
    getValue(row, fieldMap.website) ||
    `Imported lead ${index + 1}`;

  const firstName = getValue(row, fieldMap.firstName);
  const city = getValue(row, fieldMap.city);
  const state = getValue(row, fieldMap.state);
  const location = [city, state].filter(Boolean).join(", ");
  const niche = detectLeadNiche(row, fieldMap);

  const rawEmail = getValue(row, fieldMap.email);
  const primaryEmail = getPrimaryEmail(rawEmail);
  const personalizedPitch = getValue(row, fieldMap.sheetPitch);

  const formattedPersonalizedMessage =
    options.useSheetPitch && personalizedPitch
      ? personalizeMessage(
          options.sheetPitchFormat || DEFAULT_SHEET_PITCH_FORMAT,
          row,
          fieldMap
        )
      : options.fallbackTemplate
      ? personalizeMessage(options.fallbackTemplate, row, fieldMap)
      : "";

  return {
    id: `external_${index + 1}`,
    name: firstName || company,
    business: company,
    contact_name: firstName,

    email: primaryEmail,
    emailRaw: rawEmail,
    emailCandidates: extractEmails(rawEmail),

    phone: normalizePhone(getValue(row, fieldMap.phone)),
    website: getValue(row, fieldMap.website),
    address: location,
    location,
    city,
    state,
    notes: getValue(row, fieldMap.notes),

    personalizedPitch,
    sheetPitch: personalizedPitch,

    personalizedMessage: personalizedPitch,
    formattedPersonalizedMessage,

    category: niche.label,
    source: "External import",
    confidence: 100,
    qualityScore: 100,
    dataQuality: "imported",

    firstIssue: getValue(row, fieldMap.notes) || niche.label,
    firstImprovement:
      options.useSheetPitch && personalizedPitch
        ? personalizedPitch
        : getValue(row, fieldMap.notes) ||
          "replace one manual workflow with automation",

    status: "new",
    conversionStatus: "new",
    pipelineStatus: "new",
    timeline: [],
    stageStatus: {},
    signals: [
      "external_import",
      ...(primaryEmail ? ["email_found"] : []),
      ...(isCallablePhone(
        normalizePhone(getValue(row, fieldMap.phone))
      )
        ? ["phone_found"]
        : []),
    ],
  };
}


function normalizePhone(value) {
  const raw = formatCell(value);

  if (!raw) return "";

  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (!digits) return "";

  return `${hasPlus ? "+" : ""}${digits}`;
}

function isCallablePhone(value) {
  const digits = normalizePhone(value).replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function formatDigitalChannel(value) {
  if (value === "email") return "Email";
  if (value === "whatsapp") return "WhatsApp";
  if (value === "multi-channel") return "Email + WhatsApp";
  return "None";
}

function buildExternalCampaignPipeline({
  channel,
  voiceEnabled,
  messageMode,
  subjectLine,
  messageTemplate,
  sheetPitchFormat,
}) {
  const stages = [];
  const emailEnabled =
    channel === "email" ||
    channel === "multi-channel";
  const whatsappEnabled =
    channel === "whatsapp" ||
    channel === "multi-channel";

  if (voiceEnabled) {
    stages.push({
      name: "ReachFly AI Voice",
      channel: "ai_voice",
      delayMinutes: 0,
      subject: "",
      body:
        "Use the imported lead profile, mapped business context, notes, and campaign goal as Voice Agent context.",
      enabled: true,
      executionMode: "voice_agent",
      disclosureRequired: true,
      recordingPolicy: "workspace_policy",
    });
  }

  if (emailEnabled) {
    stages.push({
      name:
        messageMode === "sheet"
          ? "Sheet personalized intro"
          : "Imported lead intro",
      channel: "email",
      delayMinutes: 0,
      subject: toPipelineTemplate(subjectLine),
      body:
        messageMode === "sheet"
          ? toPipelineTemplate(
              sheetPitchFormat || "{{sheetPitch}}"
            )
          : toPipelineTemplate(messageTemplate),
      usesLeadPersonalizedMessage:
        messageMode === "sheet",
      dynamicBodyField:
        messageMode === "sheet"
          ? "firstImprovement"
          : "",
      enabled: true,
    });

    stages.push({
      name: "Helpful email follow-up",
      channel: "email",
      delayMinutes: 2880,
      subject: "Quick follow-up for {business}",
      body:
        "Hi {name},\n\nJust following up on my previous note about {business}.\n\nIf useful, I can send a short 2–3 point improvement plan.\n\nShould I send it over?",
      enabled: true,
    });
  }

  if (whatsappEnabled) {
    stages.push({
      name: "Short WhatsApp follow-up",
      channel: "whatsapp",
      delayMinutes:
        emailEnabled ? 1440 : 0,
      subject: "",
      body:
        toPipelineTemplate(messageTemplate) ||
        "Hi {name}, I noticed one opportunity for {business}. Want me to send the quick notes?",
      enabled: true,
    });
  }

  return stages;
}

function normalizeWorkspaceRole(value) {
  const role = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (role.includes("owner")) return "owner";
  if (role.includes("admin")) return "admin";
  if (role.includes("manager")) return "manager";
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

function getImportedCampaignLocation(records, fieldMap) {
  const locations = records
    .map((row) =>
      [getValue(row, fieldMap.city), getValue(row, fieldMap.state)]
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean);

  return locations[0] || "External imported leads";
}

function toPipelineTemplate(value = "") {
  return String(value)
    .replace(/{{\s*firstName\s*}}/gi, "{name}")
    .replace(/{{\s*company\s*}}/gi, "{business}")
    .replace(/{{\s*website\s*}}/gi, "{website}")
    .replace(/{{\s*city\s*}}/gi, "{location}")
    .replace(/{{\s*state\s*}}/gi, "{location}")
    .replace(/{{\s*niche\s*}}/gi, "{firstIssue}")
    .replace(/{{\s*notes\s*}}/gi, "{firstIssue}")
    .replace(/{{\s*sheetPitch\s*}}/gi, "{firstImprovement}");
}

function generateNicheEmail({ segment, aiInstruction }) {
  const key = segment?.key || "general";

  const templates = {
    all: {
      subject: "Quick idea for {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and noticed you're in the {{niche}} space.

A lot of teams in this area lose time on manual follow-ups, scattered lead data, and disconnected systems. I help businesses turn that into simple AI/workflow automation, dashboards, CRM flows, and integrations that reduce manual work and make growth easier to track.

If useful, I can send over 2-3 practical ideas specific to {{company}}.

Would you be open to a quick chat?`,
    },

    saas: {
      subject: "Quick product workflow idea for {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and noticed you're in the SaaS/software space.

For SaaS teams, I usually help with dashboards, CRM workflows, API integrations, onboarding flows, and automation that reduces manual product/support work.

I had a quick idea around improving lead tracking, customer workflows, or internal ops for {{company}}.

Would you be open to a quick chat this week?`,
    },

    ai_data: {
      subject: "AI workflow idea for {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and noticed your work around data/AI.

I help teams build practical AI workflows, internal dashboards, data pipelines, and automations that turn scattered processes into something easier to operate and measure.

I think there may be a useful opportunity to improve one workflow at {{company}} without overcomplicating the system.

Open to a quick conversation?`,
    },

    healthcare: {
      subject: "Reducing admin work at {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and noticed you're in healthcare/medtech.

A common issue I see in this space is too much manual admin work across intake, scheduling, patient communication, reporting, or internal coordination.

I build secure dashboards, workflow automation, and API integrations that help teams reduce repetitive work while keeping the process clear.

Would it make sense to discuss one workflow at {{company}} that could be automated?`,
    },

    logistics: {
      subject: "Workflow automation idea for {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and noticed you're in logistics/delivery.

Teams in this space often deal with manual updates, tracking gaps, order coordination, and disconnected tools. I help build dashboards, automation flows, and API integrations to make those workflows faster and easier to monitor.

I had a practical idea that may fit {{company}}.

Would you be open to a quick chat?`,
    },

    real_estate: {
      subject: "Lead workflow idea for {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and noticed you're in real estate/property.

A lot of real estate teams lose leads because follow-ups, listings, inquiries, and CRM updates are handled manually. I help build lead dashboards, automation flows, CRM systems, and website integrations that keep opportunities moving.

I can share a simple workflow idea for {{company}} if useful.

Open to a quick chat?`,
    },

    ecommerce: {
      subject: "Operations idea for {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and noticed you're in ecommerce/retail.

For ecommerce teams, I usually help with inventory workflows, CRM automation, order dashboards, Shopify/API integrations, and customer follow-up systems.

There may be a practical way to reduce manual work and improve visibility for {{company}}.

Would you be open to a quick conversation?`,
    },

    fintech: {
      subject: "Workflow idea for {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and noticed you're in fintech/finance.

I help teams build secure dashboards, workflow automation, reporting systems, billing/API integrations, and AI-assisted internal tools that make operations easier to track.

I had a quick idea around improving one manual or repetitive workflow at {{company}}.

Would you be open to discussing it?`,
    },

    restaurant: {
      subject: "More bookings without more manual work",
      body: `Hi {{firstName}},

I came across {{company}} and noticed you're in the restaurant/local business space.

Many local businesses lose time on manual bookings, customer follow-ups, reviews, offers, and repetitive messages. I help set up simple AI and automation systems that bring more visibility and save staff time.

I can share a practical idea for {{company}} if useful.

Would you be open to a quick chat?`,
    },

    professional_services: {
      subject: "Quick automation idea for {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and noticed you're in professional services.

Teams like yours often have manual lead follow-up, intake, reporting, proposal, or client communication workflows that can be made much smoother with CRM automation and AI-assisted systems.

I had a quick idea that could help {{company}} save time without changing your whole process.

Open to a quick chat?`,
    },

    general: {
      subject: "Quick idea for {{company}}",
      body: `Hi {{firstName}},

I came across {{company}} and thought there may be a useful opportunity to improve one manual workflow with AI, automation, dashboards, or API integrations.

I help businesses replace repetitive work with simple systems that make leads, customers, operations, and reporting easier to manage.

If helpful, I can take a quick look and suggest 2-3 practical ideas for {{company}}.

Would you be open to a quick chat?`,
    },
  };

  const draft = templates[key] || templates.general;

  if (aiInstruction.toLowerCase().includes("short")) {
    return draft;
  }

  return draft;
}

function safeExternalCampaignMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function notifyExternalCampaign(
  type,
  title,
  message
) {
  if (typeof window === "undefined") {
    return;
  }

  const bridge =
    window.reachflyToast;

  if (
    bridge &&
    typeof bridge[type] === "function"
  ) {
    bridge[type](title, message);
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

function ExternalLeadCampaignV7Styles() {
  return (
    <style>{`
      .rf-external-campaign-v7,
      .rf-external-restricted-v7{
        --rfec-card:#fff;
        --rfec-soft:#f6f7f8;
        --rfec-text:#191c1d;
        --rfec-text2:#4d4c59;
        --rfec-muted:#777784;
        --rfec-line:#e2e4e7;
        --rfec-primary:#4648d4;
        --rfec-primary-dark:#393bbb;
        --rfec-primary-soft:#e8e9ff;
        --rfec-violet:#6b38d4;
        --rfec-violet-soft:#f1ebff;
        --rfec-green:#087a51;
        --rfec-green-soft:#e4f7ee;
        --rfec-red:#ba1a1a;
        --rfec-red-soft:#ffedeb;
        --rfec-amber:#965900;
        --rfec-amber-soft:#fff3d8;
        --rfec-dark:#2e3132;
        --rfec-ease:cubic-bezier(.2,.8,.2,1);
        color:var(--rfec-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-external-campaign-v7{
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        animation:rfecPageIn .24s var(--rfec-ease);
      }

      .rf-external-restricted-v7{
        min-height:100%;
        padding:24px 30px 52px;
      }

      .rf-external-campaign-v7 *,
      .rf-external-campaign-v7 *::before,
      .rf-external-campaign-v7 *::after,
      .rf-external-restricted-v7 *,
      .rf-external-restricted-v7 *::before,
      .rf-external-restricted-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfecPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfecAlertIn{
        from{opacity:0;transform:translateY(-4px)}
        to{opacity:1;transform:none}
      }

      .rf-external-restricted-v7 > .card{
        max-width:760px;
        min-height:320px;
        display:grid;
        place-items:start;
        align-content:center;
        gap:8px;
        padding:28px;
        margin:40px auto 0;
        background:#fff;
        border:1px solid var(--rfec-line);
        border-radius:14px;
        box-shadow:0 16px 40px rgba(25,28,29,.06);
      }

      .rf-external-restricted-v7 .eyebrow,
      .rf-external-campaign-v7 .eyebrow{
        display:block;
        margin:0 0 4px;
        color:var(--rfec-primary);
        font-size:8px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rf-external-restricted-v7 h1{
        margin:0;
        font:600 28px/35px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-external-restricted-v7 p{
        margin:0;
        color:var(--rfec-text2);
        font-size:9px;
        line-height:15px;
      }

      .rf-external-campaign-v7 .external-campaign-hero{
        min-height:160px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        padding:22px;
        margin-bottom:12px;
        overflow:hidden;
        color:#fff;
        background:
          radial-gradient(circle at 88% 16%,rgba(94,97,232,.28),transparent 32%),
          radial-gradient(circle at 14% 86%,rgba(107,56,212,.18),transparent 27%),
          #2e3132;
        border:1px solid rgba(255,255,255,.06);
        border-radius:14px;
      }

      .rf-external-campaign-v7 .external-campaign-hero > div:first-child{
        min-width:0;
      }

      .eyebrow{
      background: #5658d6;
      }
      .rf-external-campaign-v7 .external-campaign-hero .eyebrow{
        color:#c8caff;
      }

      .rf-external-campaign-v7 .external-campaign-hero h1{
        margin:0;
        color:#fff;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rf-external-campaign-v7 .external-campaign-hero p{
        max-width:850px;
        margin:5px 0 0;
        color:rgba(242,244,245,.66);
        font-size:10px;
        line-height:16px;
      }

      .rf-external-campaign-v7 .btn,
      .rf-external-restricted-v7 .btn{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 11px;
        color:var(--rfec-text);
        background:#fff;
        border:1px solid var(--rfec-line);
        border-radius:8px;
        cursor:pointer;
        text-decoration:none;
        font:700 7px/1 Inter,sans-serif;
        transition:.14s var(--rfec-ease);
      }

      .rf-external-campaign-v7 .btn:hover:not(:disabled),
      .rf-external-restricted-v7 .btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-external-campaign-v7 .btn:disabled,
      .rf-external-restricted-v7 .btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-external-campaign-v7 .btn.primary,
      .rf-external-restricted-v7 .btn.primary{
        color:#fff;
        background:var(--rfec-primary);
        border-color:var(--rfec-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rf-external-campaign-v7 .btn.primary:hover:not(:disabled),
      .rf-external-restricted-v7 .btn.primary:hover:not(:disabled){
        background:var(--rfec-primary-dark);
      }

      .rf-external-campaign-v7 .btn.light,
      .rf-external-campaign-v7 .btn.ghost{
        color:var(--rfec-text);
        background:#fff;
        border-color:var(--rfec-line);
      }

      .rf-external-campaign-v7 .btn.small{
        min-height:33px;
        padding:6px 8px;
        font-size:6px;
      }

      .rf-external-campaign-v7 .external-stepper{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:7px;
        margin-bottom:11px;
      }

      .rf-external-campaign-v7 .external-step{
        min-height:64px;
        display:grid;
        grid-template-columns:30px minmax(0,1fr);
        align-items:center;
        gap:8px;
        padding:9px;
        color:var(--rfec-muted);
        background:#fff;
        border:1px solid var(--rfec-line);
        border-radius:9px;
        transition:.14s var(--rfec-ease);
      }

      .rf-external-campaign-v7 .external-step > span{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        background:#f0f1f2;
        border-radius:8px;
        font-size:6px;
        font-weight:800;
      }

      .rf-external-campaign-v7 .external-step > div{
        min-width:0;
        display:grid;
      }

      .rf-external-campaign-v7 .external-step small{
        font-size:5.2px;
        text-transform:uppercase;
      }

      .rf-external-campaign-v7 .external-step b{
        margin-top:2px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.5px;
      }

      .rf-external-campaign-v7 .external-step.active{
        color:var(--rfec-primary);
        background:var(--rfec-primary-soft);
        border-color:#d4d5ff;
      }

      .rf-external-campaign-v7 .external-step.active > span,
      .rf-external-campaign-v7 .external-step.done > span{
        color:#fff;
        background:var(--rfec-primary);
      }

      .rf-external-campaign-v7 .external-card,
      .rf-external-campaign-v7 .external-records-panel,
      .rf-external-campaign-v7 .external-segment-panel,
      .rf-external-campaign-v7 .external-message-composer{
        min-width:0;
        padding:14px;
        background:#fff;
        border:1px solid var(--rfec-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-external-campaign-v7 .external-card-head,
      .rf-external-campaign-v7 .external-message-head,
      .rf-external-campaign-v7 .external-records-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding-bottom:10px;
        margin-bottom:10px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-external-campaign-v7 .external-card-head > div,
      .rf-external-campaign-v7 .external-message-head > div,
      .rf-external-campaign-v7 .external-records-head > div{
        min-width:0;
      }

      .rf-external-campaign-v7 .external-card h2,
      .rf-external-campaign-v7 .external-card-head h2,
      .rf-external-campaign-v7 .external-message-head h3,
      .rf-external-campaign-v7 .external-records-head h3,
      .rf-external-campaign-v7 .external-segment-panel h3{
        margin:0;
        font:600 15px/20px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-external-campaign-v7 .external-card-head p,
      .rf-external-campaign-v7 .external-message-head p,
      .rf-external-campaign-v7 .external-records-head p{
        max-width:760px;
        margin:4px 0 0;
        color:var(--rfec-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rf-external-campaign-v7 .external-source-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
      }

      .rf-external-campaign-v7 .external-source-card{
        min-height:122px;
        display:grid;
        grid-template-columns:40px minmax(0,1fr);
        align-items:center;
        gap:10px;
        padding:12px;
        color:var(--rfec-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:10px;
        text-align:left;
        cursor:pointer;
        transition:.14s var(--rfec-ease);
      }

      .rf-external-campaign-v7 .external-source-card:not(:disabled):hover{
        transform:translateY(-1px);
        border-color:#d9daf7;
      }

      .rf-external-campaign-v7 .external-source-card.active{
        background:linear-gradient(135deg,#f4f4ff,#fff);
        border-color:#d4d5ff;
        box-shadow:0 0 0 2px rgba(70,72,212,.06);
      }

      .rf-external-campaign-v7 .external-source-card:disabled{
        opacity:.5;
        cursor:not-allowed;
      }

      .rf-external-campaign-v7 .external-source-card > span,
      .rf-external-campaign-v7 .external-ai-context > span{
        width:40px;
        height:40px;
        display:grid;
        place-items:center;
        color:var(--rfec-primary);
        background:var(--rfec-primary-soft);
        border-radius:9px;
      }

      .rf-external-campaign-v7 .external-source-card > div,
      .rf-external-campaign-v7 .external-ai-context > div{
        min-width:0;
        display:grid;
      }

      .rf-external-campaign-v7 .external-source-card b{
        font-size:7px;
      }

      .rf-external-campaign-v7 .external-source-card small{
        margin-top:3px;
        color:var(--rfec-muted);
        font-size:5.8px;
        line-height:10px;
      }

      .rf-external-campaign-v7 .external-upload-box{
        min-height:180px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        margin-top:10px;
        padding:22px;
        color:var(--rfec-text);
        background:
          radial-gradient(circle at 50% 0%,rgba(70,72,212,.055),transparent 40%),
          #fafaff;
        border:1px dashed #cfd0ef;
        border-radius:10px;
        text-align:center;
        cursor:pointer;
        transition:.14s var(--rfec-ease);
      }

      .rf-external-campaign-v7 .external-upload-box:hover{
        border-color:var(--rfec-primary);
        background:#f6f6ff;
      }

      .rf-external-campaign-v7 .external-upload-box input{
        display:none;
      }

      .rf-external-campaign-v7 .external-upload-box > span{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfec-primary);
        border-radius:10px;
      }

      .rf-external-campaign-v7 .external-upload-box b{
        margin-top:4px;
        font-size:7px;
      }

      .rf-external-campaign-v7 .external-upload-box small,
      .rf-external-campaign-v7 .external-upload-box em{
        color:var(--rfec-muted);
        font-size:5.8px;
        font-style:normal;
      }

      .rf-external-campaign-v7 .external-upload-box em{
        margin-top:4px;
        padding:5px 7px;
        color:var(--rfec-primary);
        background:var(--rfec-primary-soft);
        border-radius:999px;
      }

      .rf-external-campaign-v7 .external-error,
      .rf-external-campaign-v7 .error-banner{
        padding:10px 11px;
        margin-top:8px;
        color:#7c1d1d;
        background:var(--rfec-red-soft);
        border:1px solid #ffd0cc;
        border-radius:8px;
        font-size:6.5px;
        line-height:11px;
        animation:rfecAlertIn .16s var(--rfec-ease);
      }

      .rf-external-campaign-v7 .external-warning{
        display:grid;
        grid-template-columns:32px minmax(0,1fr);
        align-items:start;
        gap:8px;
        padding:10px;
        margin-top:8px;
        color:#6b4a08;
        background:var(--rfec-amber-soft);
        border:1px solid #efddb4;
        border-radius:8px;
      }

      .rf-external-campaign-v7 .external-warning > svg{
        color:var(--rfec-amber);
      }

      .rf-external-campaign-v7 .external-warning b{
        font-size:6.5px;
      }

      .rf-external-campaign-v7 .external-warning p{
        margin:2px 0 0;
        font-size:6px;
        line-height:10px;
      }

      .rf-external-campaign-v7 .external-table-toolbar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin:10px 0 7px;
      }

      .rf-external-campaign-v7 .external-table-search{
        min-width:220px;
        display:grid;
        grid-template-columns:18px minmax(0,1fr);
        align-items:center;
        gap:6px;
        padding:0 9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
      }

      .rf-external-campaign-v7 .external-table-search:focus-within{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-external-campaign-v7 .external-table-search svg{
        color:var(--rfec-muted);
      }

      .rf-external-campaign-v7 input,
      .rf-external-campaign-v7 select,
      .rf-external-campaign-v7 textarea{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfec-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 7px/12px Inter,sans-serif;
        transition:.13s var(--rfec-ease);
      }

      .rf-external-campaign-v7 textarea{
        min-height:104px;
        resize:vertical;
      }

      .rf-external-campaign-v7 .external-table-search input{
        min-height:37px;
        padding:0;
        background:transparent;
        border:0;
        box-shadow:none;
      }

      .rf-external-campaign-v7 input:focus,
      .rf-external-campaign-v7 select:focus,
      .rf-external-campaign-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-external-campaign-v7 .field{
        display:grid;
        gap:4px;
      }

      .rf-external-campaign-v7 .field > span{
        color:var(--rfec-muted);
        font-size:5.6px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rf-external-campaign-v7 .external-table-meta{
        color:var(--rfec-muted);
        font-size:5.7px;
      }

      .rf-external-campaign-v7 .external-column-cloud{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
        margin:7px 0;
      }

      .rf-external-campaign-v7 .external-column-cloud > span{
        padding:4px 6px;
        color:var(--rfec-text2);
        background:#f1f2f3;
        border:1px solid #e2e4e6;
        border-radius:999px;
        font-size:5.3px;
      }

      .rf-external-campaign-v7 .external-table-wrap{
        overflow:auto;
        border:1px solid var(--rfec-line);
        border-radius:9px;
      }

      .rf-external-campaign-v7 .external-preview-table{
        width:100%;
        min-width:880px;
        border-collapse:collapse;
      }

      .rf-external-campaign-v7 .external-preview-table th{
        height:40px;
        padding:8px 9px;
        color:#686973;
        background:#f7f8f9;
        border-bottom:1px solid var(--rfec-line);
        text-align:left;
        white-space:nowrap;
        font-size:5.4px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rf-external-campaign-v7 .external-preview-table td{
        max-width:220px;
        padding:8px 9px;
        overflow:hidden;
        color:var(--rfec-text2);
        border-bottom:1px solid #eff0f1;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.8px;
      }

      .rf-external-campaign-v7 .external-field-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .rf-external-campaign-v7 .external-field-help{
        padding:10px;
        margin-top:9px;
        color:var(--rfec-text2);
        background:#f7f7fc;
        border:1px solid #e3e3f3;
        border-radius:8px;
        font-size:6px;
        line-height:10px;
      }

      .rf-external-campaign-v7 .external-segment-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf-external-campaign-v7 .external-segment-card{
        min-height:74px;
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        align-items:center;
        gap:8px;
        padding:9px;
        color:var(--rfec-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
        text-align:left;
        cursor:pointer;
        transition:.13s var(--rfec-ease);
      }

      .rf-external-campaign-v7 .external-segment-card:hover{
        border-color:#d9daf7;
      }

      .rf-external-campaign-v7 .external-segment-card.active{
        background:var(--rfec-primary-soft);
        border-color:#d6d7ff;
      }

      .rf-external-campaign-v7 .external-segment-card > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfec-primary);
        background:#fff;
        border-radius:8px;
      }

      .rf-external-campaign-v7 .external-segment-card > div{
        min-width:0;
        display:grid;
      }

      .rf-external-campaign-v7 .external-segment-card b{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.4px;
      }

      .rf-external-campaign-v7 .external-segment-card small{
        margin-top:2px;
        color:var(--rfec-muted);
        font-size:5.3px;
      }

      .rf-external-campaign-v7 .external-mapped-lead-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:7px;
      }

      .rf-external-campaign-v7 .external-mapped-lead-card{
        min-width:0;
        padding:10px;
        background:#f7f8f9;
        border-radius:9px;
      }

      .rf-external-campaign-v7 .external-mapped-card-top{
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        align-items:center;
        gap:8px;
      }

      .rf-external-campaign-v7 .external-mapped-avatar{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfec-primary);
        border-radius:8px;
        font-size:7px;
        font-weight:800;
      }

      .rf-external-campaign-v7 .external-mapped-card-top > div{
        min-width:0;
        display:grid;
      }

      .rf-external-campaign-v7 .external-mapped-card-top b{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.4px;
      }

      .rf-external-campaign-v7 .external-mapped-card-top small{
        color:var(--rfec-muted);
        font-size:5.3px;
      }

      .rf-external-campaign-v7 .external-record-stats,
      .rf-external-campaign-v7 .external-summary-grid,
      .rf-external-campaign-v7 .external-data-health{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:6px;
      }

      .rf-external-campaign-v7 .external-record-stat,
      .rf-external-campaign-v7 .external-summary-item,
      .rf-external-campaign-v7 .external-data-health > div{
        min-height:64px;
        display:grid;
        align-content:center;
        padding:8px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-external-campaign-v7 .external-record-stat span,
      .rf-external-campaign-v7 .external-summary-item span,
      .rf-external-campaign-v7 .external-data-health span{
        color:var(--rfec-muted);
        font-size:5.3px;
      }

      .rf-external-campaign-v7 .external-record-stat strong,
      .rf-external-campaign-v7 .external-summary-item b,
      .rf-external-campaign-v7 .external-data-health b{
        margin-top:2px;
        font-size:8px;
      }

      .rf-external-campaign-v7 .external-launch-layout{
        display:grid;
        grid-template-columns:minmax(0,1.45fr) minmax(290px,.55fr);
        align-items:start;
        gap:11px;
      }

      .rf-external-campaign-v7 .external-launch-main{
        min-width:0;
        display:grid;
        gap:11px;
      }

      .rf-external-campaign-v7 .external-launch-side{
        position:sticky;
        top:78px;
        min-width:0;
        display:grid;
        gap:11px;
      }

      .rf-external-campaign-v7 .external-message-tabs{
        display:flex;
        gap:4px;
        padding:4px;
        background:#f2f3f4;
        border-radius:8px;
      }

      .rf-external-campaign-v7 .external-message-tabs button{
        min-height:31px;
        padding:5px 7px;
        color:var(--rfec-text2);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:5.7px;
        font-weight:700;
      }

      .rf-external-campaign-v7 .external-message-tabs button.active{
        color:var(--rfec-primary);
        background:#fff;
        box-shadow:0 1px 3px rgba(25,28,29,.05);
      }

      .rf-external-campaign-v7 .external-ai-writer,
      .rf-external-campaign-v7 .external-sheet-pitch-box{
        display:grid;
        gap:8px;
        padding:10px;
        margin-bottom:9px;
        background:linear-gradient(135deg,#f5f3ff,#fff);
        border:1px solid #e2dcf6;
        border-radius:9px;
      }

      .rf-external-campaign-v7 .external-ai-context{
        display:grid;
        grid-template-columns:40px minmax(0,1fr);
        align-items:center;
        gap:8px;
        padding:8px;
        background:#fff;
        border:1px solid #e8e5f4;
        border-radius:8px;
      }

      .rf-external-campaign-v7 .external-ai-context b{
        font-size:6.5px;
      }

      .rf-external-campaign-v7 .external-ai-context small{
        margin-top:2px;
        color:var(--rfec-muted);
        font-size:5.4px;
        line-height:9px;
      }

      .rf-external-campaign-v7 .external-variable-row{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
        margin:6px 0 9px;
      }

      .rf-external-campaign-v7 .external-variable-row button{
        min-height:27px;
        padding:4px 6px;
        color:var(--rfec-primary);
        background:var(--rfec-primary-soft);
        border:1px solid #dbdcff;
        border-radius:999px;
        cursor:pointer;
        font-size:5.2px;
        font-weight:700;
      }

      .rf-external-campaign-v7 .external-preview-message{
        padding:10px;
        margin-top:9px;
        color:#fff;
        background:#2e3132;
        border-radius:9px;
      }

      .rf-external-campaign-v7 .external-preview-message small{
        color:#c8caff;
        font-size:5.3px;
        text-transform:uppercase;
      }

      .rf-external-campaign-v7 .external-preview-message b{
        display:block;
        margin-top:4px;
        color:#fff;
        font-size:6.8px;
      }

      .rf-external-campaign-v7 .external-preview-message p{
        margin:4px 0 0;
        color:rgba(244,246,247,.65);
        white-space:pre-line;
        font-size:6.3px;
        line-height:11px;
      }

      .rf-external-campaign-v7 .external-sheet-pitch-stats{
        display:flex;
        align-items:center;
        gap:6px;
        color:var(--rfec-text2);
        font-size:5.6px;
      }

      .rf-external-campaign-v7 .external-sheet-pitch-stats b{
        color:var(--rfec-primary);
        font-size:9px;
      }

      .rf-external-campaign-v7 .external-mapped-fields{
        display:grid;
        gap:5px;
      }

      .rf-external-campaign-v7 .external-mapped-fields > div{
        min-height:36px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:7px 8px;
        background:#f7f8f9;
        border-radius:7px;
      }

      .rf-external-campaign-v7 .external-mapped-fields span{
        color:var(--rfec-muted);
        font-size:5.4px;
      }

      .rf-external-campaign-v7 .external-mapped-fields b{
        max-width:170px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.7px;
      }

      .rf-external-campaign-v7 .external-actions{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-top:11px;
      }

      .rf-external-campaign-v7 .external-actions > div{
        display:flex;
        gap:7px;
      }

      .rf-external-campaign-v7 .text-muted{
        color:var(--rfec-muted)!important;
      }

      .rf-external-campaign-v7 .text-xs{
        font-size:5.7px!important;
        line-height:9px!important;
      }

      .rf-external-campaign-v7 .mt16{
        margin-top:9px!important;
      }

      .rf-external-campaign-v7 .mt24{
        margin-top:12px!important;
      }

      /* ReachFly readability pass: this workflow previously used 5-9px text,
         which made the import/mapping experience look visually scaled down. */
      .rf-external-campaign-v7{
        font-size:14px;
      }

      .rf-external-campaign-v7 .external-campaign-hero h1{
        font-size:30px;
        line-height:38px;
      }

      .rf-external-campaign-v7 .external-campaign-hero p,
      .rf-external-campaign-v7 .external-card-head p,
      .rf-external-campaign-v7 .external-message-head p,
      .rf-external-campaign-v7 .external-records-head p,
      .rf-external-campaign-v7 .external-source-card small,
      .rf-external-campaign-v7 .external-upload-box small,
      .rf-external-campaign-v7 .external-upload-box em,
      .rf-external-campaign-v7 .external-warning p,
      .rf-external-campaign-v7 .external-ai-context small,
      .rf-external-campaign-v7 .external-preview-message p,
      .rf-external-campaign-v7 .external-mapped-card-top small,
      .rf-external-campaign-v7 .external-record-stat span,
      .rf-external-campaign-v7 .external-summary-item span,
      .rf-external-campaign-v7 .external-data-health span,
      .rf-external-campaign-v7 .external-table-meta,
      .rf-external-campaign-v7 .text-xs{
        font-size:13px!important;
        line-height:19px!important;
      }

      .rf-external-campaign-v7 .external-card h2,
      .rf-external-campaign-v7 .external-card-head h2,
      .rf-external-campaign-v7 .external-message-head h3,
      .rf-external-campaign-v7 .external-records-head h3,
      .rf-external-campaign-v7 .external-segment-panel h3{
        font-size:18px;
        line-height:25px;
      }

      .rf-external-campaign-v7 .external-source-card b,
      .rf-external-campaign-v7 .external-upload-box b,
      .rf-external-campaign-v7 .external-warning b,
      .rf-external-campaign-v7 .external-ai-context b,
      .rf-external-campaign-v7 .external-preview-message b,
      .rf-external-campaign-v7 .external-mapped-card-top b,
      .rf-external-campaign-v7 .external-mapped-fields b,
      .rf-external-campaign-v7 .external-segment-card b{
        font-size:14px!important;
        line-height:20px;
      }

      .rf-external-campaign-v7 input,
      .rf-external-campaign-v7 select,
      .rf-external-campaign-v7 textarea{
        min-height:42px;
        padding:10px 12px;
        font:400 14px/20px Inter,sans-serif;
      }

      .rf-external-campaign-v7 .field > span,
      .rf-external-campaign-v7 .external-preview-table th,
      .rf-external-campaign-v7 .external-preview-table td,
      .rf-external-campaign-v7 .external-column-cloud > span,
      .rf-external-campaign-v7 .external-variable-row button,
      .rf-external-campaign-v7 .external-message-tabs button,
      .rf-external-campaign-v7 .external-mapped-fields span,
      .rf-external-campaign-v7 .external-sheet-pitch-stats,
      .rf-external-campaign-v7 .external-segment-card small{
        font-size:12px!important;
        line-height:18px!important;
      }

      .rf-external-campaign-v7 .external-preview-table td{
        font-size:13px!important;
        line-height:19px!important;
      }

      .rf-external-campaign-v7 .btn,
      .rf-external-campaign-v7 button{
        font-size:13px;
      }

      .rf-external-campaign-v7 .external-step{
        min-height:58px;
      }

      .rf-external-campaign-v7 .external-step b,
      .rf-external-campaign-v7 .external-step strong,
      .rf-external-campaign-v7 .external-step small{
        font-size:12px!important;
        line-height:17px!important;
      }

      .rf-external-campaign-v7 .external-source-card{
        min-height:142px;
        padding:18px;
      }

      .rf-external-campaign-v7 .external-card,
      .rf-external-campaign-v7 .external-records-panel,
      .rf-external-campaign-v7 .external-segment-panel,
      .rf-external-campaign-v7 .external-message-composer{
        padding:20px;
        border-radius:14px;
      }

      .rf-external-campaign-v7 .external-record-stat,
      .rf-external-campaign-v7 .external-summary-item,
      .rf-external-campaign-v7 .external-data-health > div{
        min-height:82px;
        padding:12px;
      }

      .rf-external-campaign-v7 .external-record-stat strong,
      .rf-external-campaign-v7 .external-summary-item b,
      .rf-external-campaign-v7 .external-data-health b,
      .rf-external-campaign-v7 .external-sheet-pitch-stats b{
        font-size:18px!important;
      }

      @media(max-width:1080px){
        .rf-external-campaign-v7{
          padding:22px;
        }

        .rf-external-campaign-v7 .external-field-grid{
          grid-template-columns:1fr 1fr;
        }

        .rf-external-campaign-v7 .external-segment-grid{
          grid-template-columns:1fr 1fr;
        }

        .rf-external-campaign-v7 .external-launch-layout{
          grid-template-columns:minmax(0,1fr) 290px;
        }
      }

      @media(max-width:820px){
        .rf-external-campaign-v7 .external-campaign-hero{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-external-campaign-v7 .external-stepper{
          grid-template-columns:1fr 1fr;
        }

        .rf-external-campaign-v7 .external-launch-layout{
          grid-template-columns:1fr;
        }

        .rf-external-campaign-v7 .external-launch-side{
          position:static;
        }

        .rf-external-campaign-v7 .external-record-stats,
        .rf-external-campaign-v7 .external-summary-grid,
        .rf-external-campaign-v7 .external-data-health{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:620px){
        .rf-external-campaign-v7,
        .rf-external-restricted-v7{
          padding:18px 12px 80px;
        }

        .rf-external-campaign-v7 .external-campaign-hero{
          padding:16px;
        }

        .rf-external-campaign-v7 .external-campaign-hero h1{
          font-size:25px;
          line-height:32px;
        }

        .rf-external-campaign-v7 .external-campaign-hero p{
          font-size:9px;
          line-height:15px;
        }

        .rf-external-campaign-v7 .external-stepper,
        .rf-external-campaign-v7 .external-source-grid,
        .rf-external-campaign-v7 .external-field-grid,
        .rf-external-campaign-v7 .external-segment-grid,
        .rf-external-campaign-v7 .external-mapped-lead-grid,
        .rf-external-campaign-v7 .external-record-stats,
        .rf-external-campaign-v7 .external-summary-grid,
        .rf-external-campaign-v7 .external-data-health{
          grid-template-columns:1fr;
        }

        .rf-external-campaign-v7 .external-table-toolbar,
        .rf-external-campaign-v7 .external-card-head,
        .rf-external-campaign-v7 .external-message-head,
        .rf-external-campaign-v7 .external-records-head{
          align-items:stretch;
          flex-direction:column;
        }

        .rf-external-campaign-v7 .external-table-search{
          width:100%;
          min-width:0;
        }

        .rf-external-campaign-v7 .external-message-tabs{
          overflow-x:auto;
        }

        .rf-external-campaign-v7 .external-actions{
          align-items:stretch;
          flex-direction:column;
        }

        .rf-external-campaign-v7 .external-actions > div{
          display:grid;
          grid-template-columns:1fr;
        }

        .rf-external-campaign-v7 .external-actions .btn{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-external-campaign-v7,
        .rf-external-campaign-v7 *,
        .rf-external-campaign-v7 *::before,
        .rf-external-campaign-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
