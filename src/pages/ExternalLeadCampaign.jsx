import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { api } from "../api";
import {
  Clock3,
  GitBranch,
  Mail,
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
  "Review & launch",
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

const DEFAULT_SHEET_PITCH_FORMAT = `{{sheetPitch}}

A few relevant links:
Loom intro: https://www.loom.com/share/52001dc60f894d359eecb85814618ab2
LinkedIn: https://www.linkedin.com/in/umair-inam-b1a064158/
Upwork: https://www.upwork.com/freelancers/~01d25155cf2184ac9c

Best,
Muhammad Umair`;

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
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");

  useEffect(() => {
    api
      .emailSettings()
      .then((settings) => {
        const accounts = Array.isArray(settings.accounts)
          ? settings.accounts
          : [];

        setEmailAccounts(accounts);
        setSelectedEmailAccountId(
          settings.activeAccountId || accounts[0]?.id || ""
        );
      })
      .catch(() => {
        setEmailAccounts([]);
        setSelectedEmailAccountId("");
      });
  }, []);

  const selectedEmailAccount = useMemo(() => {
    return (
      emailAccounts.find((account) => account.id === selectedEmailAccountId) ||
      null
    );
  }, [emailAccounts, selectedEmailAccountId]);

  const stats = useMemo(() => {
    const emailHeader = fieldMap.email;
    const companyHeader = fieldMap.company;
    const websiteHeader = fieldMap.website;

    const validEmails = records
      .map((row) => getPrimaryEmail(row[emailHeader]))
      .filter(Boolean);

    const normalizedEmails = validEmails.map((email) => email.toLowerCase());
    const duplicateEmails =
      normalizedEmails.length - new Set(normalizedEmails).size;

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

  const validImportedLeads = useMemo(() => {
    return records
      .map((row, index) =>
        mapImportedLead(row, fieldMap, index, {
          useSheetPitch: messageMode === "sheet",
          sheetPitchFormat,
          fallbackTemplate:
            messageMode === "sheet"
              ? messageTemplate || DEFAULT_SHEET_FALLBACK_MESSAGE
              : messageTemplate,
        })
      )
      .filter((lead) => isValidEmail(lead.email));
  }, [records, fieldMap, messageMode, messageTemplate, sheetPitchFormat]);

  const canContinue = useMemo(() => {
    if (step === 0) return records.length > 0;

    if (step === 2) {
      const hasSubject = subjectLine.trim().length > 0;
      const hasCustomMessage = messageTemplate.trim().length > 0;
      const hasSheetPitch =
        messageMode === "sheet" &&
        fieldMap.sheetPitch &&
        sheetPitchStats.rowsWithPitch > 0 &&
        sheetPitchFormat.trim().length > 0 &&
        sheetPitchFormat.includes("{{sheetPitch}}");

      return (
        campaignName.trim().length > 0 &&
        hasSubject &&
        (hasCustomMessage || hasSheetPitch)
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

  const writeAiMessage = () => {
    setMessageMode("ai");
    setIsWritingMessage(true);

    window.setTimeout(() => {
      const draft = generateNicheEmail({
        segment: selectedSegment,
        goal,
        aiInstruction,
      });

      setSubjectLine(draft.subject);
      setMessageTemplate(draft.body);
      setIsWritingMessage(false);
    }, 650);
  };

  const launchCampaign = async () => {
    try {
      setLaunchError("");

      if (!selectedEmailAccountId) {
        setLaunchError("Please select a sender email account before launching.");
        return;
      }

      if (!validImportedLeads.length) {
        setLaunchError("No valid email leads found in this file.");
        return;
      }

      if (!campaignName.trim()) {
        setLaunchError("Campaign name is required.");
        return;
      }

      if (
        messageMode === "sheet" &&
        (!sheetPitchFormat.trim() || !sheetPitchFormat.includes("{{sheetPitch}}"))
      ) {
        setLaunchError(
          "Sheet pitch email format must include {{sheetPitch}} so each row pitch can be inserted."
        );
        return;
      }

      setLaunching(true);

      const location = getImportedCampaignLocation(records, fieldMap);
      const senderEmail =
        selectedEmailAccount?.fromEmail || selectedEmailAccount?.username || "";

      const created = await api.createCampaign({
        source: "external-import",
        externalImport: true,

        name: campaignName || "External lead campaign",
        niche: selectedSegment.label || "External leads",
        location,
        goal,
        offer: "External lead outreach campaign",

        emailAccountId: selectedEmailAccountId,
        senderEmail,

        messageMode,
        sheetPitchField: fieldMap.sheetPitch || "",
        sheetPitchFormat,
        usesSheetPitch: messageMode === "sheet",

        limit: validImportedLeads.length,
        totalRows: records.length,
        validEmails: stats.validEmails,
        missingEmails: stats.missingEmails,
        duplicateEmails: stats.duplicateEmails,
        selectedSegment: selectedSegment.label,

        leads: validImportedLeads,

        pipeline: [
          {
            name:
              messageMode === "sheet"
                ? "Sheet personalized intro"
                : "Imported lead intro",
            channel: channel === "whatsapp" ? "whatsapp" : "email",
            delayMinutes: 0,
            subject: toPipelineTemplate(subjectLine),
            body:
              messageMode === "sheet"
                ? toPipelineTemplate(sheetPitchFormat || "{{sheetPitch}}")
                : toPipelineTemplate(messageTemplate),
            usesLeadPersonalizedMessage: messageMode === "sheet",
            dynamicBodyField: messageMode === "sheet" ? "firstImprovement" : "",
            enabled: true,
          },
          {
            name: "Helpful follow-up",
            channel: "email",
            delayMinutes: 2880,
            subject: "Quick follow-up for {business}",
            body:
              "Hi {name},\n\nJust following up on my previous note about {business}.\n\nI noticed one website/lead-capture issue that may be affecting trust, conversions, or inquiries.\n\nIf useful, I can send a short 2–3 point improvement plan.\n\nShould I send it over?",
            enabled: true,
          },
        ],
      });

      navigate(`/app/campaigns/${created.id}/pipeline`);
    } catch (error) {
      setLaunchError(error.message || "Could not launch campaign.");
    } finally {
      setLaunching(false);
    }
  };

  const firstRecord = records[0] || {};

  return (
    <div className="external-campaign-page">
      <div className="external-campaign-hero">
        <div>
          <span className="eyebrow">External lead campaigns</span>
          <h1>Run campaigns from your own lead lists</h1>
          <p>
            Upload any Excel/CSV file, preview every row and column, map fields
            dynamically, detect lead niches, generate relevant campaign messages,
            choose a sender email, and launch into the pipeline builder.
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
                Start from a spreadsheet or connect a source where your leads
                already live.
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
              onClick={() => setSourceType("external")}
              className={`external-source-card ${
                sourceType === "external" ? "active" : ""
              }`}
            >
              <span>
                <GitBranch />
              </span>
              <div>
                <b>External source</b>
                <small>
                  Connect Google Sheets, Airtable, Apollo export, CRM, webhook,
                  API, or another external database.
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
            <div className="external-integration-grid">
              {[
                "Google Sheets",
                "Airtable",
                "Webhook / API",
                "CRM Export",
              ].map((item) => (
                <button key={item} type="button">
                  <span>
                    <Settings />
                  </span>
                  <b>{item}</b>
                  <small>Import and sync leads from {item}.</small>
                </button>
              ))}
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
                  <span>Outreach channel</span>
                  <select
                    value={channel}
                    onChange={(event) => setChannel(event.target.value)}
                  >
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
                  <span>Daily sending limit</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={dailyLimit}
                    onChange={(event) => setDailyLimit(event.target.value)}
                  />
                </label>
              </div>

              <LeadSegmentPanel
                records={records}
                segments={segments}
                selectedSegmentKey={selectedSegmentKey}
                setSelectedSegmentKey={setSelectedSegmentKey}
              />

              <div className="external-message-composer">
                <div className="external-message-head">
                  <div>
                    <h3>Campaign message</h3>
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
                      AI writer
                    </button>

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
                  </div>
                </div>

                {messageMode === "ai" && (
                  <div className="external-ai-writer">
                    <label className="field">
                      <span>AI instructions</span>
                      <textarea
                        value={aiInstruction}
                        onChange={(event) =>
                          setAiInstruction(event.target.value)
                        }
                        placeholder="Tell AI what kind of pitch to write..."
                      />
                    </label>

                    <div className="external-ai-context">
                      <span>
                        <Target />
                      </span>
                      <div>
                        <b>{selectedSegment.label}</b>
                        <small>
                          AI will write for this segment using mapped fields,
                          niche signal, location, company, website, and notes.
                        </small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn primary"
                      onClick={writeAiMessage}
                      disabled={isWritingMessage}
                    >
                      <Zap />
                      {isWritingMessage
                        ? "Writing message..."
                        : "AI write best message"}
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

                <label className="field external-message-field">
                  <span>Subject line</span>
                  <input
                    value={subjectLine}
                    onChange={(event) => setSubjectLine(event.target.value)}
                    placeholder="Quick idea for {{company}}"
                  />
                </label>

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
            </div>
          </div>

          <aside className="external-launch-side">
            <div className="external-card">
              <h3>Lead data health</h3>

              <div className="external-data-health">
                <SummaryItem label="Total leads" value={stats.total} />
                <SummaryItem label="Valid emails" value={stats.validEmails} />
                <SummaryItem
                  label="Missing emails"
                  value={stats.missingEmails}
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
                Confirm the campaign setup, select a sender email, and launch
                this imported lead list into the pipeline builder.
              </p>
            </div>
          </div>

          <div className="external-summary-grid">
            <SummaryItem label="Campaign" value={campaignName || "Untitled"} />
            <SummaryItem label="Channel" value={channel} />
            <SummaryItem label="Goal" value={goal} />
            <SummaryItem label="Daily limit" value={dailyLimit} />
            <SummaryItem label="Total leads" value={stats.total} />
            <SummaryItem label="Valid emails" value={stats.validEmails} />
            <SummaryItem label="Selected segment" value={selectedSegment.label} />
            <SummaryItem
              label="Message source"
              value={
                messageMode === "sheet"
                  ? "Personalized pitch from sheet"
                  : messageMode === "ai"
                  ? "AI writer"
                  : "Custom message"
              }
            />
            <SummaryItem
              label="Sender"
              value={
                selectedEmailAccount?.fromEmail ||
                selectedEmailAccount?.username ||
                "Not selected"
              }
            />
          </div>

          <div className="external-email-link-card">
            <div>
              <h3>Sender email account</h3>
              <p>
                Choose which configured email account should be linked to this
                campaign before it moves to the pipeline builder.
              </p>
            </div>

            {emailAccounts.length ? (
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
                <Link className="btn small" to="/app/email">
                  Add email
                </Link>
              </div>
            )}
          </div>

          {launchError ? <div className="error-banner">{launchError}</div> : null}

          <div className="external-message-preview">
            <h3>Final message preview</h3>
            <small>Subject</small>
            <b>{personalizeMessage(subjectLine, firstRecord, fieldMap)}</b>
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

          {stats.missingEmails > 0 && (
            <div className="external-warning">
              <Clock3 />
              <div>
                <b>{stats.missingEmails} leads do not have valid emails.</b>
                <p>
                  These records can still stay in your list, but email outreach
                  will only run for leads with valid email addresses.
                </p>
              </div>
            </div>
          )}
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
            ? `${validImportedLeads.length} valid email leads will be saved`
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
            disabled={launching || !selectedEmailAccountId}
          >
            <Rocket />
            {launching ? "Saving campaign..." : "Launch campaign"}
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
            ReachFly groups leads by niche so the AI writer can create a more
            relevant email instead of sending one generic pitch to everyone.
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

                <p>{primaryEmail || rawEmail || "No email"}</p>

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

    phone: getValue(row, fieldMap.phone),
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
    signals: ["external_import", "email_found"],
  };
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