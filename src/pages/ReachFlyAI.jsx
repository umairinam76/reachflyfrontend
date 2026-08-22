import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  api,
  request,
} from "../api";

import {
  AlertTriangle,
  BarChart3,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Globe2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  Target,
  Wand2,
  Workflow,
  X,
  Zap,
} from "../components/icons";

const STARTERS = [
  {
    icon: Target,
    title: "Create a campaign",
    prompt: "Create a campaign for dentists in Miami with 100 leads",
  },
  {
    icon: Search,
    title: "Review active campaigns",
    prompt: "Show me active campaigns",
  },
  {
    icon: Workflow,
    title: "Build a follow-up flow",
    prompt: "Help me setup a 3 step email and WhatsApp pipeline",
  },
  {
    icon: Target,
    title: "Review targeted markets",
    prompt: "What territories have I already targeted?",
  },
];

const INITIAL_MESSAGE = {
  role: "assistant",
  text:
    "Hi, I’m ReachFly AI. I can help inside your ReachFly workspace with campaigns, lead audits, pipelines, integrations, metrics, contacts, inbox activity, territories, and AI Voice workflows.",
};

const AUDIT_POLL_INTERVAL_MS = 2200;

export default function ReachFlyAI() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState("");

  const [auditLeads, setAuditLeads] = useState([]);
  const [auditReports, setAuditReports] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditRefreshing, setAuditRefreshing] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const auditPollRef = useRef(null);

  const loadAuditData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setAuditRefreshing(true);
    } else {
      setAuditLoading(true);
    }

    try {
      const [leadPayload, reportPayload] = await Promise.all([
        request("/api/leads/scraped?limit=5000"),
        request("/api/lead-audits"),
      ]);

      setAuditLeads(normalizeLeads(leadPayload));
      setAuditReports(normalizeReports(reportPayload));
      setAuditError("");
    } catch (requestError) {
      setAuditError(
        safeMessage(
          requestError?.message ||
            "ReachFly could not load workspace lead audits."
        )
      );
    } finally {
      setAuditLoading(false);
      setAuditRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAuditData();
  }, [loadAuditData]);

  useEffect(() => {
    const hasPending = auditReports.some((report) =>
      ["queued", "generating"].includes(normalizeStatus(report?.status))
    );

    if (!hasPending) {
      if (auditPollRef.current) {
        window.clearInterval(auditPollRef.current);
      }
      auditPollRef.current = null;
      return undefined;
    }

    if (!auditPollRef.current) {
      auditPollRef.current = window.setInterval(async () => {
        try {
          const payload = await request("/api/lead-audits");
          setAuditReports(normalizeReports(payload));
          setAuditError("");
        } catch {
          // Keep the last real audit snapshot visible if a polling refresh fails.
        }
      }, AUDIT_POLL_INTERVAL_MS);
    }

    return () => {
      if (auditPollRef.current) {
        window.clearInterval(auditPollRef.current);
      }
      auditPollRef.current = null;
    };
  }, [auditReports]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [loading, messages]);

  const auditModel = useMemo(
    () => buildAuditModel(auditLeads, auditReports),
    [auditLeads, auditReports]
  );

  const visibleAuditRows = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return auditModel.rows.slice(0, 8);

    return auditModel.rows
      .filter((row) =>
        [
          row.leadName,
          row.website,
          row.category,
          row.kindLabel,
          row.summary,
          row.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 8);
  }, [auditModel.rows, auditSearch]);

  const conversationCount = useMemo(
    () => messages.filter((message) => message.role === "user").length,
    [messages]
  );

  const hasCampaignAction = useMemo(
    () => messages.some((message) => Boolean(message.campaign?.id)),
    [messages]
  );

  async function send(text = input) {
    const trimmed = String(text || "").trim();

    if (!trimmed || loading) {
      return;
    }

    setInput("");
    setLastError("");

    setMessages((current) =>
      current.concat({
        role: "user",
        text: trimmed,
      })
    );

    setLoading(true);

    try {
      const result = await api.reachflyCommand(trimmed, {
        pathname: "/app/ai",
        title: "ReachFly AI",
      });

      const reply = safeMessage(
        String(
          result?.reply ||
            result?.message ||
            "ReachFly completed the command."
        ).trim()
      );

      setMessages((current) =>
        current.concat({
          role: "assistant",
          text: reply,
          action: result?.action || null,
          campaign: result?.campaign || null,
        })
      );

      if (result?.campaign?.id) {
        notify(
          "success",
          "Campaign ready",
          "ReachFly AI created or updated a campaign you can open now."
        );
      }
    } catch (requestError) {
      const message = safeMessage(
        requestError?.message ||
          "ReachFly could not process that command."
      );

      setLastError(message);

      setMessages((current) =>
        current.concat({
          role: "assistant",
          text: message,
          error: true,
        })
      );

      notify(
        "error",
        "ReachFly AI couldn't complete that",
        message
      );
    } finally {
      setLoading(false);

      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function resetConversation() {
    if (loading) {
      return;
    }

    setMessages([INITIAL_MESSAGE]);
    setLastError("");
    setInput("");

    notify(
      "info",
      "Conversation cleared",
      "A fresh ReachFly AI conversation is ready."
    );

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <>
      <ReachFlyAIStyles />

      <main className="rf-ai-v8">
        <header className="rfai-page-header">
          <div>
            <span className="rfai-eyebrow">
              <Sparkles size={12} />
              ReachFly AI
            </span>

            <h1>Command your sales workspace.</h1>

            <p>
              Work with campaigns, contacts, integrations and AI Voice while
              seeing the real audit intelligence ReachFly has already produced
              for your saved leads.
            </p>
          </div>

          <div className="rfai-header-actions">
            <div className="rfai-session-pill">
              <span>
                <Sparkles size={13} />
              </span>

              <div>
                <small>Current session</small>
                <strong>
                  {conversationCount} {conversationCount === 1 ? "command" : "commands"}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="rfai-button secondary"
              disabled={loading || messages.length <= 1}
              onClick={resetConversation}
            >
              <RefreshCw size={14} />
              New conversation
            </button>
          </div>
        </header>

        {lastError ? (
          <section className="rfai-alert" role="alert">
            <span>
              <X size={13} />
            </span>

            <div>
              <strong>The latest command could not be completed</strong>
              <p>{lastError}</p>
            </div>

            <button
              type="button"
              onClick={() => setLastError("")}
              aria-label="Dismiss ReachFly AI error"
            >
              <X size={11} />
            </button>
          </section>
        ) : null}

        <section className="rfai-audit-hub">
          <header className="rfai-audit-hub-head">
            <div className="rfai-audit-title-wrap">
              <span className="rfai-audit-icon">
                <Brain size={18} />
              </span>

              <div>
                <span className="rfai-audit-live-label">
                  <i className={auditModel.processing ? "active" : ""} />
                  {auditModel.processing
                    ? `${auditModel.processing} processing now`
                    : "Workspace audit intelligence"}
                </span>
                <h2>Real lead audits</h2>
                <p>
                  These values come from your saved leads and ReachFly audit
                  records. No demo percentages or placeholder audit results are
                  used here.
                </p>
              </div>
            </div>

            <div className="rfai-audit-actions">
              <button
                type="button"
                className="rfai-button secondary"
                disabled={auditRefreshing}
                onClick={() => void loadAuditData({ silent: true })}
              >
                <RefreshCw
                  size={13}
                  className={auditRefreshing ? "rfai-spin" : ""}
                />
                Refresh audits
              </button>

              <Link className="rfai-button primary" to="/app/audits">
                Open audit workspace
                <ChevronRight size={13} />
              </Link>
            </div>
          </header>

          {auditError ? (
            <div className="rfai-audit-error">
              <AlertTriangle size={15} />
              <div>
                <strong>Audit data could not be refreshed</strong>
                <span>{auditError}</span>
              </div>
            </div>
          ) : null}

          <div className="rfai-audit-stat-grid">
            <AuditMetric
              label="Saved leads"
              value={auditLoading ? "…" : formatNumber(auditModel.totalLeads)}
              detail={`${formatNumber(auditModel.auditableLeads)} have a website`}
              icon={Globe2}
            />
            <AuditMetric
              label="Audited leads"
              value={auditLoading ? "…" : formatNumber(auditModel.auditedLeads)}
              detail={`${formatNumber(auditModel.completedReports)} completed reports`}
              icon={CheckCircle2}
            />
            <AuditMetric
              label="High-fit leads"
              value={auditLoading ? "…" : formatNumber(auditModel.highFit)}
              detail="Commercial fit ≥ 70"
              icon={Target}
            />
            <AuditMetric
              label="Average fit"
              value={
                auditLoading
                  ? "…"
                  : auditModel.averageFit == null
                    ? "—"
                    : `${auditModel.averageFit}/100`
              }
              detail={
                auditModel.scoredLeads
                  ? `${formatNumber(auditModel.scoredLeads)} scored audited leads`
                  : "No completed fit scores yet"
              }
              icon={BarChart3}
            />
          </div>

          <div className="rfai-audit-list-shell">
            <div className="rfai-audit-list-head">
              <div>
                <strong>Latest audited leads</strong>
                <span>
                  Latest report per lead · queued audits update automatically
                </span>
              </div>

              <label className="rfai-audit-search">
                <Search size={13} />
                <input
                  value={auditSearch}
                  onChange={(event) => setAuditSearch(event.target.value)}
                  placeholder="Search audited leads…"
                  aria-label="Search audited leads"
                />
              </label>
            </div>

            {auditLoading ? (
              <AuditListSkeleton />
            ) : visibleAuditRows.length ? (
              <div className="rfai-audit-list">
                {visibleAuditRows.map((row) => (
                  <AuditLeadRow key={row.key} row={row} />
                ))}
              </div>
            ) : (
              <div className="rfai-audit-empty">
                <Brain size={22} />
                <div>
                  <strong>
                    {auditSearch
                      ? "No audited leads match this search"
                      : "No lead audits have been created yet"}
                  </strong>
                  <p>
                    {auditSearch
                      ? "Clear the search to see the latest workspace audit records."
                      : "Open AI Audits, select saved leads with websites, and run Mini Audits. Real results will appear here as soon as they are queued."}
                  </p>
                </div>
                {!auditSearch ? (
                  <Link className="rfai-button primary" to="/app/audits">
                    Run lead audits
                    <ChevronRight size={13} />
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section className="rfai-journey-strip" aria-label="ReachFly audit journey">
          <JourneyStep
            index="01"
            title="Saved lead"
            detail={`${formatNumber(auditModel.auditableLeads)} website-ready`}
            active={auditModel.auditableLeads > 0}
          />
          <ChevronRight size={14} />
          <JourneyStep
            index="02"
            title="AI audit"
            detail={`${formatNumber(auditModel.auditedLeads)} audited`}
            active={auditModel.auditedLeads > 0}
          />
          <ChevronRight size={14} />
          <JourneyStep
            index="03"
            title="Private context"
            detail={`${formatNumber(auditModel.scoredLeads)} scored`}
            active={auditModel.scoredLeads > 0}
          />
          <ChevronRight size={14} />
          <JourneyStep
            index="04"
            title="AI agent"
            detail="Uses verified context"
            active={auditModel.auditedLeads > 0}
          />
          <ChevronRight size={14} />
          <JourneyStep
            index="05"
            title="Campaign"
            detail="Personalized conversation"
            active={auditModel.highFit > 0}
          />
        </section>

        <section className="rfai-layout">
          <section className="rfai-chat-card">
            <header className="rfai-chat-header">
              <span className="rfai-assistant-mark">
                <Bot size={19} />
              </span>

              <div>
                <strong>ReachFly assistant</strong>
                <small>
                  Workspace-restricted sales operations assistant
                </small>
              </div>

              <span className="rfai-online">
                <i />
                Ready
              </span>
            </header>

            <div className="rfai-messages" aria-live="polite">
              {messages.map((message, index) => (
                <MessageBubble
                  key={`${message.role}-${index}`}
                  message={message}
                />
              ))}

              {loading ? (
                <div className="rfai-message assistant thinking">
                  <span className="rfai-message-avatar">
                    <Bot size={13} />
                  </span>

                  <div className="rfai-message-content">
                    <small>ReachFly AI</small>

                    <div className="rfai-thinking">
                      <i />
                      <i />
                      <i />
                      <span>Working inside your workspace…</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={endRef} />
            </div>

            <form
              className="rfai-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <div className="rfai-composer-input">
                <Sparkles size={15} />

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Tell ReachFly what to do…"
                  rows={1}
                  disabled={loading}
                />

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Send ReachFly AI command"
                >
                  {loading ? (
                    <RefreshCw size={15} className="rfai-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                </button>
              </div>

              <footer>
                <span>Press Enter to send · Shift + Enter for a new line</span>
                <span>
                  <Shield size={11} />
                  Restricted to ReachFly workspace actions
                </span>
              </footer>
            </form>
          </section>

          <aside className="rfai-side">
            <section className="rfai-side-card rfai-scope-card">
              <header>
                <span>
                  <Shield size={16} />
                </span>

                <div>
                  <small>Connected workspace</small>
                  <strong>Real data, real actions</strong>
                </div>
              </header>

              <p>
                ReachFly AI works inside your product data. Lead audit results
                above are read from the same workspace records used by AI Audits
                and AI Voice context.
              </p>

              <div className="rfai-scope-list">
                {[
                  "Lead audits",
                  "Campaigns",
                  "Pipelines",
                  "Contacts",
                  "Inbox",
                  "Metrics",
                  "Territories",
                ].map((item) => (
                  <span key={item}>
                    <Check size={10} />
                    {item}
                  </span>
                ))}
              </div>
            </section>

            <section className="rfai-side-card rfai-audit-side-card">
              <header>
                <span className="violet">
                  <Brain size={16} />
                </span>

                <div>
                  <small>Audit signal</small>
                  <strong>What your agents can use</strong>
                </div>
              </header>

              {auditModel.topFitRows.length ? (
                <div className="rfai-top-fit-list">
                  {auditModel.topFitRows.map((row) => (
                    <Link key={row.key} to={row.href}>
                      <span>{initials(row.leadName)}</span>
                      <div>
                        <strong>{row.leadName}</strong>
                        <small>
                          {row.scoreLabel || "Audit ready"}
                          {row.findingCount
                            ? ` · ${row.findingCount} findings`
                            : ""}
                        </small>
                      </div>
                      <ChevronRight size={12} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p>
                  Completed lead audits with fit scores will appear here. ReachFly
                  Voice can use that verified context privately during outbound calls.
                </p>
              )}

              <Link className="rfai-inline-link" to="/app/audits">
                Review all audits
                <ExternalLink size={11} />
              </Link>
            </section>

            <section className="rfai-side-card">
              <header>
                <span className="violet">
                  <Wand2 size={16} />
                </span>

                <div>
                  <small>Suggested commands</small>
                  <strong>Start with a real workflow</strong>
                </div>
              </header>

              <div className="rfai-starters">
                {STARTERS.map((starter) => {
                  const Icon = starter.icon;

                  return (
                    <button
                      type="button"
                      key={starter.prompt}
                      disabled={loading}
                      onClick={() => void send(starter.prompt)}
                    >
                      <span>
                        <Icon size={14} />
                      </span>

                      <div>
                        <strong>{starter.title}</strong>
                        <small>{starter.prompt}</small>
                      </div>

                      <ChevronRight size={12} />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rfai-side-card rfai-builder-card">
              <span>
                <Zap size={17} />
              </span>

              <div>
                <small>Prefer a visual workflow?</small>
                <strong>Use the lead builder</strong>

                <p>
                  Configure a market, lead volume, and campaign flow using the
                  structured builder instead.
                </p>
              </div>

              <Link className="rfai-button dark full" to="/app/builder">
                <Plus size={13} />
                Open visual builder
              </Link>
            </section>

            {hasCampaignAction ? (
              <section className="rfai-side-card rfai-success-card">
                <CheckCircle2 size={18} />

                <div>
                  <strong>Campaign action available</strong>
                  <p>
                    A ReachFly AI response in this conversation includes a real
                    campaign link.
                  </p>
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </main>
    </>
  );
}

function AuditMetric({ label, value, detail, icon: Icon }) {
  return (
    <article className="rfai-audit-stat">
      <span className="rfai-audit-stat-icon">
        <Icon size={15} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function AuditLeadRow({ row }) {
  return (
    <Link className="rfai-audit-row" to={row.href}>
      <span className="rfai-audit-avatar">{initials(row.leadName)}</span>

      <div className="rfai-audit-row-main">
        <div className="rfai-audit-row-title">
          <strong>{row.leadName}</strong>
          <span className={`rfai-audit-status ${row.status}`}>
            {statusLabel(row.status)}
          </span>
        </div>

        <small>
          {row.category || row.website || "Saved lead"}
          {row.kindLabel ? ` · ${row.kindLabel}` : ""}
        </small>

        <p>{row.summary}</p>
      </div>

      <div className="rfai-audit-row-meta">
        {row.scoreLabel ? <strong>{row.scoreLabel}</strong> : <strong>—</strong>}
        <small>{row.scoreType || "Fit"}</small>
        <span>
          {row.findingCount} {row.findingCount === 1 ? "finding" : "findings"}
        </span>
        <time>{formatRelativeTime(row.updatedAt)}</time>
      </div>

      <ChevronRight size={14} />
    </Link>
  );
}

function AuditListSkeleton() {
  return (
    <div className="rfai-audit-list skeleton">
      {[0, 1, 2].map((item) => (
        <div className="rfai-audit-row" key={item}>
          <span className="rfai-skeleton-block avatar" />
          <div>
            <span className="rfai-skeleton-block line wide" />
            <span className="rfai-skeleton-block line medium" />
            <span className="rfai-skeleton-block line full" />
          </div>
          <span className="rfai-skeleton-block score" />
        </div>
      ))}
    </div>
  );
}

function JourneyStep({ index, title, detail, active }) {
  return (
    <div className={`rfai-journey-step ${active ? "active" : ""}`}>
      <span>{active ? <Check size={11} /> : index}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`rfai-message ${isUser ? "user" : "assistant"} ${
        message.error ? "error" : ""
      }`}
    >
      <span className="rfai-message-avatar">
        {isUser ? <Target size={13} /> : <Bot size={13} />}
      </span>

      <div className="rfai-message-content">
        <small>{isUser ? "You" : "ReachFly AI"}</small>
        <p>{message.text}</p>

        {message.campaign?.id ? (
          <Link
            className="rfai-action-link"
            to={`/app/campaigns/${encodeURIComponent(message.campaign.id)}`}
          >
            Open campaign
            <ChevronRight size={12} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function buildAuditModel(leads, reports) {
  const normalizedLeads = Array.isArray(leads) ? leads : [];
  const normalizedReports = Array.isArray(reports) ? reports : [];

  const leadsByWebsite = new Map();
  for (const lead of normalizedLeads) {
    const websiteKey = normalizeWebsite(lead?.website);
    if (websiteKey && !leadsByWebsite.has(websiteKey)) {
      leadsByWebsite.set(websiteKey, lead);
    }
  }

  const sortedReports = [...normalizedReports].sort(
    (a, b) => reportTimestamp(b) - reportTimestamp(a)
  );

  const latestByLead = new Map();

  for (const report of sortedReports) {
    const websiteKey = normalizeWebsite(report?.website || report?.lead?.website);
    const lead = websiteKey
      ? leadsByWebsite.get(websiteKey) || report?.lead || null
      : report?.lead || null;
    const identity =
      websiteKey ||
      String(report?.lead?.sourceLeadId || report?.lead?.id || report?.id || "").trim();

    if (!identity || latestByLead.has(identity)) {
      continue;
    }

    latestByLead.set(identity, buildAuditRow(report, lead, websiteKey));
  }

  const rows = [...latestByLead.values()].sort(
    (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)
  );

  const completedReports = normalizedReports.filter(
    (report) => normalizeStatus(report?.status) === "complete"
  ).length;

  const auditedRows = rows.filter((row) => row.status === "complete");
  const scoredRows = auditedRows.filter((row) => Number.isFinite(row.fitScore));
  const highFit = scoredRows.filter((row) => row.fitScore >= 70).length;
  const averageFit = scoredRows.length
    ? Math.round(
        scoredRows.reduce((sum, row) => sum + row.fitScore, 0) /
          scoredRows.length
      )
    : null;

  const processing = normalizedReports.filter((report) =>
    ["queued", "generating"].includes(normalizeStatus(report?.status))
  ).length;

  return {
    totalLeads: normalizedLeads.length,
    auditableLeads: normalizedLeads.filter((lead) => normalizeWebsite(lead?.website)).length,
    completedReports,
    auditedLeads: auditedRows.length,
    scoredLeads: scoredRows.length,
    highFit,
    averageFit,
    processing,
    rows,
    topFitRows: [...scoredRows]
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 4),
  };
}

function buildAuditRow(report, lead, websiteKey) {
  const status = normalizeStatus(report?.status) || "not_run";
  const reportBody = report?.report || {};
  const fitScore = getFitScore(report);
  const auditScore = getAuditScore(report);
  const issues = getReportIssues(reportBody);
  const leadRecord = lead || report?.lead || {};
  const leadName = String(
    leadRecord?.business ||
      leadRecord?.name ||
      reportBody?.snapshot?.businessName ||
      websiteKey ||
      "Business"
  ).trim();

  const scoreValue = Number.isFinite(fitScore)
    ? fitScore
    : Number.isFinite(auditScore)
      ? auditScore
      : null;

  return {
    key: String(report?.id || `${websiteKey || leadName}-${report?.kind || "audit"}`),
    reportId: report?.id || "",
    leadName,
    category: String(leadRecord?.category || report?.niche || "").trim(),
    website: websiteKey || normalizeWebsite(leadRecord?.website),
    status,
    kind: String(report?.kind || "mini").toLowerCase(),
    kindLabel: auditKindLabel(report?.kind),
    fitScore,
    auditScore,
    scoreLabel: scoreValue == null ? "" : `${scoreValue}/100`,
    scoreType: Number.isFinite(fitScore) ? "Sales fit" : "Audit score",
    findingCount: issues.length,
    summary: auditSummary(reportBody, issues, status),
    updatedAt:
      report?.completedAt ||
      report?.updatedAt ||
      report?.createdAt ||
      "",
    href: auditHref(leadRecord, websiteKey || normalizeWebsite(leadRecord?.website)),
  };
}

function normalizeLeads(payload) {
  const source =
    payload?.items ||
    payload?.leads ||
    payload?.records ||
    payload?.data ||
    [];

  return Array.isArray(source) ? source.filter(Boolean) : [];
}

function normalizeReports(payload) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.reports)
      ? payload.reports
      : payload?.id
        ? [payload]
        : [];

  return source.filter(Boolean);
}

function normalizeWebsite(value) {
  try {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function statusLabel(status) {
  if (status === "complete") return "Ready";
  if (status === "generating") return "Running";
  if (status === "queued") return "Queued";
  if (status === "failed") return "Failed";
  return "Not run";
}

function auditKindLabel(kind) {
  const normalized = String(kind || "mini").toLowerCase();
  if (normalized === "full") return "Deep audit";
  if (normalized === "competitor") return "Competitor audit";
  return "Mini audit";
}

function getFitScore(report) {
  const value =
    report?.report?.salesFit?.fitScore ??
    report?.report?.salesFit?.score ??
    null;
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.max(0, Math.min(100, Math.round(number)))
    : null;
}

function getAuditScore(report) {
  const number = Number(report?.report?.score);
  return Number.isFinite(number)
    ? Math.max(0, Math.min(100, Math.round(number)))
    : null;
}

function getReportIssues(reportBody) {
  if (Array.isArray(reportBody?.issues)) {
    return reportBody.issues.filter(Boolean);
  }

  if (Array.isArray(reportBody?.priorityFindings)) {
    return reportBody.priorityFindings.filter(Boolean);
  }

  if (Array.isArray(reportBody?.competitiveGaps)) {
    return reportBody.competitiveGaps.filter(Boolean);
  }

  return [];
}

function auditSummary(reportBody, issues, status) {
  if (["queued", "generating"].includes(status)) {
    return status === "queued"
      ? "The audit is queued and waiting for the ReachFly audit worker."
      : "ReachFly is checking public evidence and building the audit now.";
  }

  if (status === "failed") {
    return "This audit did not complete. Open the audit workspace to retry it.";
  }

  const summary = String(
    reportBody?.salesFit?.summary ||
      reportBody?.executiveSummary ||
      reportBody?.snapshot?.whatTheyDo ||
      issues?.[0]?.finding ||
      issues?.[0]?.evidence ||
      "Audit completed with verified workspace intelligence."
  ).trim();

  return summary.length > 180 ? `${summary.slice(0, 177)}…` : summary;
}

function auditHref(lead, website) {
  const leadId = String(lead?.sourceLeadId || lead?.id || "").trim();
  if (leadId) {
    return `/app/audits?lead=${encodeURIComponent(leadId)}`;
  }

  if (website) {
    return `/app/audits?website=${encodeURIComponent(website)}`;
  }

  return "/app/audits";
}

function reportTimestamp(report) {
  const value = Date.parse(
    report?.completedAt ||
      report?.updatedAt ||
      report?.createdAt ||
      0
  );
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function formatRelativeTime(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return "";

  const difference = Date.now() - timestamp;
  const minutes = Math.max(0, Math.round(difference / 60_000));

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function initials(value) {
  const words = String(value || "Business")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word.charAt(0).toUpperCase()).join("") || "B";
}

function safeMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/Anthropic/gi, "AI intelligence service")
    .replace(/Claude/gi, "ReachFly AI")
    .replace(/\bSIP\b/gi, "voice connection");
}

function notify(type, title, message) {
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
      detail: {
        type,
        title,
        message,
      },
    })
  );
}

function ReachFlyAIStyles() {
  return (
    <style>{`
      .rf-ai-v8{
        --rfai-card:#fff;
        --rfai-soft:#f5f6f8;
        --rfai-text:#191c1d;
        --rfai-text2:#4c4b59;
        --rfai-muted:#777784;
        --rfai-line:#e2e4e7;
        --rfai-primary:#4648d4;
        --rfai-primary-dark:#3739bd;
        --rfai-primary-soft:#e8e9ff;
        --rfai-violet:#6b38d4;
        --rfai-violet-soft:#f0eaff;
        --rfai-green:#087a51;
        --rfai-green-soft:#dff8eb;
        --rfai-amber:#986408;
        --rfai-amber-soft:#fff4df;
        --rfai-red:#ba1a1a;
        --rfai-red-soft:#ffedeb;
        --rfai-dark:#2e3132;
        --rfai-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 42px;
        color:var(--rfai-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfaiPageIn .24s var(--rfai-ease);
      }

      .rf-ai-v8 *,
      .rf-ai-v8 *::before,
      .rf-ai-v8 *::after{box-sizing:border-box}

      @keyframes rfaiPageIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      @keyframes rfaiDot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-3px);opacity:1}}
      @keyframes rfaiSpin{to{transform:rotate(360deg)}}
      @keyframes rfaiPulse{70%{box-shadow:0 0 0 7px rgba(70,72,212,0)}100%{box-shadow:0 0 0 0 rgba(70,72,212,0)}}
      @keyframes rfaiSkeleton{0%{opacity:.45}50%{opacity:.9}100%{opacity:.45}}

      .rfai-spin{animation:rfaiSpin .75s linear infinite}

      .rfai-page-header{
        display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:17px;
      }
      .rfai-eyebrow{
        display:flex;align-items:center;gap:6px;margin-bottom:5px;color:var(--rfai-primary);
        font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
      }
      .rfai-page-header h1{margin:0;font:600 32px/40px Geist,Inter,sans-serif;letter-spacing:-.025em}
      .rfai-page-header p{max-width:790px;margin:4px 0 0;color:var(--rfai-text2);font-size:12px;line-height:18px}
      .rfai-header-actions{display:flex;align-items:center;gap:8px}
      .rfai-session-pill{
        min-height:45px;display:flex;align-items:center;gap:8px;padding:7px 10px;background:#fff;
        border:1px solid var(--rfai-line);border-radius:9px;
      }
      .rfai-session-pill>span{width:29px;height:29px;display:grid;place-items:center;color:var(--rfai-primary);background:var(--rfai-primary-soft);border-radius:7px}
      .rfai-session-pill>div{display:grid}.rfai-session-pill small{color:var(--rfai-muted);font-size:7px}.rfai-session-pill strong{font-size:8px}

      .rfai-button{
        min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;
        border:1px solid transparent;border-radius:8px;cursor:pointer;text-decoration:none;font-size:8px;font-weight:700;
        transition:.14s var(--rfai-ease);
      }
      .rfai-button:hover:not(:disabled){transform:translateY(-1px)}
      .rfai-button:disabled{opacity:.45;cursor:not-allowed}
      .rfai-button.secondary{color:var(--rfai-text);background:#fff;border-color:var(--rfai-line)}
      .rfai-button.primary{color:#fff;background:var(--rfai-primary);border-color:var(--rfai-primary)}
      .rfai-button.dark{color:#fff;background:var(--rfai-dark)}
      .rfai-button.full{width:100%}

      .rfai-alert{
        display:grid;grid-template-columns:27px minmax(0,1fr) 24px;align-items:start;gap:8px;padding:10px 11px;
        margin-bottom:11px;color:#7f1b1b;background:var(--rfai-red-soft);border:1px solid #ffd0cc;border-radius:9px;
      }
      .rfai-alert>span{width:27px;height:27px;display:grid;place-items:center;background:#fff;border-radius:7px}
      .rfai-alert strong{display:block;font-size:8px}.rfai-alert p{margin:1px 0 0;font-size:8px;line-height:12px}
      .rfai-alert>button{width:24px;height:24px;display:grid;place-items:center;padding:0;color:currentColor;background:transparent;border:0;border-radius:6px;cursor:pointer}

      .rfai-audit-hub{
        margin-bottom:12px;background:#fff;border:1px solid var(--rfai-line);border-radius:14px;overflow:hidden;
        box-shadow:0 7px 24px rgba(25,28,29,.035);
      }
      .rfai-audit-hub-head{
        display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 15px;
        background:linear-gradient(135deg,#fbfbff,#fff 65%);border-bottom:1px solid #eceef2;
      }
      .rfai-audit-title-wrap{display:flex;align-items:flex-start;gap:10px;min-width:0}
      .rfai-audit-icon{width:39px;height:39px;display:grid;place-items:center;flex:0 0 39px;color:var(--rfai-primary);background:var(--rfai-primary-soft);border-radius:10px}
      .rfai-audit-live-label{display:flex;align-items:center;gap:5px;color:var(--rfai-primary);font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
      .rfai-audit-live-label i{width:6px;height:6px;border-radius:50%;background:#a9abb4}
      .rfai-audit-live-label i.active{background:var(--rfai-primary);box-shadow:0 0 0 0 rgba(70,72,212,.3);animation:rfaiPulse 1.4s infinite}
      .rfai-audit-title-wrap h2{margin:2px 0 0;font-size:14px;letter-spacing:-.02em}
      .rfai-audit-title-wrap p{max-width:740px;margin:3px 0 0;color:var(--rfai-muted);font-size:8px;line-height:13px}
      .rfai-audit-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto}
      .rfai-audit-error{display:flex;align-items:flex-start;gap:7px;padding:8px 15px;color:#8b5f14;background:#fff8e9;border-bottom:1px solid #f4e5c3}
      .rfai-audit-error strong,.rfai-audit-error span{display:block}.rfai-audit-error strong{font-size:8px}.rfai-audit-error span{margin-top:1px;font-size:7px;line-height:11px}

      .rfai-audit-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#eceef2;border-bottom:1px solid #eceef2}
      .rfai-audit-stat{display:grid;grid-template-columns:31px minmax(0,1fr);align-items:center;gap:8px;min-height:78px;padding:10px 12px;background:#fff}
      .rfai-audit-stat-icon{width:31px;height:31px;display:grid;place-items:center;color:var(--rfai-primary);background:#f1f1ff;border-radius:8px}
      .rfai-audit-stat>div{min-width:0}.rfai-audit-stat>div>span,.rfai-audit-stat>div>small{display:block;color:var(--rfai-muted);font-size:7px}
      .rfai-audit-stat strong{display:block;margin:3px 0 2px;font-size:18px;line-height:1;letter-spacing:-.035em}

      .rfai-audit-list-shell{background:#fff}
      .rfai-audit-list-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid #eceef2;background:#fcfcfd}
      .rfai-audit-list-head>div>strong,.rfai-audit-list-head>div>span{display:block}.rfai-audit-list-head>div>strong{font-size:9px}.rfai-audit-list-head>div>span{margin-top:1px;color:var(--rfai-muted);font-size:7px}
      .rfai-audit-search{width:min(260px,100%);height:34px;display:flex;align-items:center;gap:6px;padding:0 9px;color:#999ba5;background:#fff;border:1px solid var(--rfai-line);border-radius:8px}
      .rfai-audit-search input{width:100%;border:0;outline:0;background:transparent;color:var(--rfai-text);font:inherit;font-size:8px}
      .rfai-audit-list{display:grid}
      .rfai-audit-row{
        display:grid;grid-template-columns:36px minmax(0,1fr) 100px 16px;align-items:center;gap:10px;min-height:78px;padding:9px 12px;
        color:inherit;text-decoration:none;border-bottom:1px solid #f0f1f3;transition:.13s ease;
      }
      .rfai-audit-row:last-child{border-bottom:0}.rfai-audit-row:hover{background:#fafaff}
      .rfai-audit-avatar{width:36px;height:36px;display:grid;place-items:center;color:var(--rfai-primary);background:var(--rfai-primary-soft);border-radius:9px;font-size:9px;font-weight:800}
      .rfai-audit-row-main{min-width:0}.rfai-audit-row-title{display:flex;align-items:center;gap:6px;min-width:0}
      .rfai-audit-row-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}
      .rfai-audit-row-main>small{display:block;margin-top:2px;color:var(--rfai-muted);font-size:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .rfai-audit-row-main>p{margin:4px 0 0;color:var(--rfai-text2);font-size:7px;line-height:11px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .rfai-audit-status{flex:0 0 auto;padding:3px 5px;border-radius:999px;background:#f0f1f3;color:#777a84;font-size:6px;font-weight:800}
      .rfai-audit-status.complete{background:var(--rfai-green-soft);color:var(--rfai-green)}
      .rfai-audit-status.queued,.rfai-audit-status.generating{background:var(--rfai-amber-soft);color:var(--rfai-amber)}
      .rfai-audit-status.failed{background:var(--rfai-red-soft);color:var(--rfai-red)}
      .rfai-audit-row-meta{display:grid;justify-items:end;gap:1px}.rfai-audit-row-meta strong{color:var(--rfai-primary);font-size:12px}.rfai-audit-row-meta small,.rfai-audit-row-meta span,.rfai-audit-row-meta time{color:var(--rfai-muted);font-size:6px}
      .rfai-audit-row>svg{color:#a1a3ab}
      .rfai-audit-empty{min-height:120px;display:flex;align-items:center;justify-content:center;gap:10px;padding:18px;color:var(--rfai-muted)}
      .rfai-audit-empty>svg{color:var(--rfai-primary)}.rfai-audit-empty>div{max-width:620px}.rfai-audit-empty strong{display:block;color:var(--rfai-text);font-size:9px}.rfai-audit-empty p{margin:3px 0 0;font-size:7px;line-height:12px}
      .rfai-skeleton-block{display:block;background:#eef0f3;border-radius:6px;animation:rfaiSkeleton 1.2s ease-in-out infinite}.rfai-skeleton-block.avatar{width:36px;height:36px}.rfai-skeleton-block.line{height:7px;margin:5px 0}.rfai-skeleton-block.line.wide{width:55%}.rfai-skeleton-block.line.medium{width:35%}.rfai-skeleton-block.line.full{width:85%}.rfai-skeleton-block.score{width:54px;height:26px;justify-self:end}

      .rfai-journey-strip{
        display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr auto 1fr;align-items:center;gap:7px;margin-bottom:12px;padding:8px;
        background:#fff;border:1px solid var(--rfai-line);border-radius:11px;
      }
      .rfai-journey-strip>svg{color:#c0c1c8}.rfai-journey-step{display:flex;align-items:center;gap:7px;min-width:0;padding:7px;border-radius:8px;background:#f8f8fa}
      .rfai-journey-step>span{width:23px;height:23px;display:grid;place-items:center;flex:0 0 23px;color:#8b8d96;background:#fff;border:1px solid #e4e5e9;border-radius:7px;font-size:6px;font-weight:800}
      .rfai-journey-step.active{background:#f6f6ff}.rfai-journey-step.active>span{color:#fff;background:var(--rfai-primary);border-color:var(--rfai-primary)}
      .rfai-journey-step>div{min-width:0}.rfai-journey-step strong,.rfai-journey-step small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rfai-journey-step strong{font-size:7px}.rfai-journey-step small{margin-top:1px;color:var(--rfai-muted);font-size:6px}

      .rfai-layout{display:grid;grid-template-columns:minmax(0,1fr) 315px;align-items:start;gap:15px}
      .rfai-chat-card,.rfai-side-card{background:#fff;border:1px solid var(--rfai-line);border-radius:13px;box-shadow:0 1px 3px rgba(25,28,29,.03)}
      .rfai-chat-card{min-height:650px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}
      .rfai-chat-header{min-height:77px;display:grid;grid-template-columns:39px minmax(0,1fr) auto;align-items:center;gap:9px;padding:13px 15px;background:#fbfbfc;border-bottom:1px solid var(--rfai-line)}
      .rfai-assistant-mark{width:39px;height:39px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#5557df,#4648d4);border-radius:10px;box-shadow:0 7px 16px rgba(70,72,212,.15)}
      .rfai-chat-header>div{display:grid}.rfai-chat-header strong{font:600 10px/14px Geist,Inter,sans-serif}.rfai-chat-header small{margin-top:1px;color:var(--rfai-muted);font-size:7px}
      .rfai-online{display:flex;align-items:center;gap:5px;padding:5px 7px;color:var(--rfai-green);background:var(--rfai-green-soft);border-radius:999px;font-size:7px;font-weight:750}.rfai-online i{width:6px;height:6px;background:currentColor;border-radius:50%}
      .rfai-messages{max-height:560px;overflow:auto;display:grid;align-content:start;gap:13px;padding:18px;background:radial-gradient(circle at 95% 10%,rgba(70,72,212,.04),transparent 28%),#fff}
      .rfai-message{max-width:78%;display:grid;grid-template-columns:31px minmax(0,1fr);align-items:start;gap:8px}.rfai-message.user{justify-self:end;grid-template-columns:minmax(0,1fr) 31px}.rfai-message.user .rfai-message-avatar{grid-column:2}.rfai-message.user .rfai-message-content{grid-column:1;grid-row:1;color:#fff;background:var(--rfai-primary);border-color:var(--rfai-primary)}
      .rfai-message-avatar{width:31px;height:31px;display:grid;place-items:center;color:var(--rfai-primary);background:var(--rfai-primary-soft);border-radius:8px}.rfai-message.user .rfai-message-avatar{color:#fff;background:var(--rfai-dark)}
      .rfai-message-content{min-width:0;padding:10px 11px;background:#f6f7f8;border:1px solid #edefef;border-radius:10px}.rfai-message.error .rfai-message-content{background:var(--rfai-red-soft);border-color:#ffd6d2}
      .rfai-message-content>small{display:block;margin-bottom:3px;color:var(--rfai-muted);font-size:6px;font-weight:750;text-transform:uppercase}.rfai-message.user .rfai-message-content>small{color:rgba(255,255,255,.63)}
      .rfai-message-content>p{margin:0;color:var(--rfai-text2);white-space:pre-wrap;font-size:8px;line-height:14px}.rfai-message.user .rfai-message-content>p{color:#fff}
      .rfai-action-link{width:max-content;display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:6px 8px;color:var(--rfai-primary)!important;background:#fff;border:1px solid #dfe0ff;border-radius:7px;text-decoration:none;font-size:7px;font-weight:750}
      .rfai-thinking{display:flex;align-items:center;gap:4px}.rfai-thinking>i{width:5px;height:5px;background:var(--rfai-primary);border-radius:50%;animation:rfaiDot 1s infinite ease-in-out}.rfai-thinking>i:nth-child(2){animation-delay:.12s}.rfai-thinking>i:nth-child(3){animation-delay:.24s}.rfai-thinking>span{margin-left:4px;color:var(--rfai-muted);font-size:7px}
      .rfai-composer{padding:12px 14px 13px;background:#fbfbfc;border-top:1px solid var(--rfai-line)}
      .rfai-composer-input{min-height:50px;display:flex;align-items:center;gap:8px;padding:5px 6px 5px 10px;color:#8b8c95;background:#fff;border:1px solid var(--rfai-line);border-radius:10px}.rfai-composer-input:focus-within{border-color:rgba(70,72,212,.5);box-shadow:0 0 0 3px rgba(70,72,212,.07)}
      .rfai-composer textarea{min-width:0;width:100%;max-height:110px;resize:none;padding:9px 0;color:var(--rfai-text);background:transparent;border:0;outline:0;font:400 8px/13px Inter,sans-serif}
      .rfai-composer-input>button{width:38px;height:38px;display:grid;place-items:center;flex:0 0 38px;padding:0;color:#fff;background:var(--rfai-primary);border:0;border-radius:8px;cursor:pointer}.rfai-composer-input>button:disabled{opacity:.4;cursor:not-allowed}
      .rfai-composer footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 2px 0;color:var(--rfai-muted);font-size:6px}.rfai-composer footer span:last-child{display:flex;align-items:center;gap:4px}

      .rfai-side{position:sticky;top:78px;display:grid;gap:11px}.rfai-side-card{overflow:hidden;padding:13px}.rfai-side-card>header{display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:8px;margin-bottom:9px}.rfai-side-card>header>span{width:34px;height:34px;display:grid;place-items:center;color:var(--rfai-primary);background:var(--rfai-primary-soft);border-radius:8px}.rfai-side-card>header>span.violet{color:var(--rfai-violet);background:var(--rfai-violet-soft)}
      .rfai-side-card>header>div{display:grid}.rfai-side-card>header small{color:var(--rfai-muted);font-size:6px;text-transform:uppercase}.rfai-side-card>header strong{font-size:8px}.rfai-side-card>p{margin:0;color:var(--rfai-text2);font-size:7px;line-height:11px}
      .rfai-scope-card{background:linear-gradient(135deg,#fbfbff,#f6f6ff);border-color:#dfdfff}.rfai-scope-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.rfai-scope-list span{display:flex;align-items:center;gap:4px;padding:5px 6px;color:var(--rfai-primary);background:#fff;border:1px solid #e1e1ff;border-radius:999px;font-size:6px;font-weight:700}
      .rfai-audit-side-card{background:linear-gradient(145deg,#fff,#fbfbff)}.rfai-top-fit-list{display:grid;gap:5px}.rfai-top-fit-list>a{display:grid;grid-template-columns:29px minmax(0,1fr) 14px;align-items:center;gap:7px;padding:6px;color:inherit;text-decoration:none;background:#f7f7fa;border-radius:8px}.rfai-top-fit-list>a:hover{background:#f0f0ff}.rfai-top-fit-list>a>span{width:29px;height:29px;display:grid;place-items:center;color:var(--rfai-primary);background:#fff;border-radius:7px;font-size:7px;font-weight:800}.rfai-top-fit-list>a>div{min-width:0}.rfai-top-fit-list strong,.rfai-top-fit-list small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rfai-top-fit-list strong{font-size:7px}.rfai-top-fit-list small{margin-top:1px;color:var(--rfai-muted);font-size:6px}.rfai-top-fit-list>a>svg{color:#a0a1aa}
      .rfai-inline-link{display:inline-flex;align-items:center;gap:4px;margin-top:9px;color:var(--rfai-primary);text-decoration:none;font-size:7px;font-weight:750}
      .rfai-starters{display:grid;gap:6px}.rfai-starters button{min-height:59px;display:grid;grid-template-columns:31px minmax(0,1fr) 16px;align-items:center;gap:7px;width:100%;padding:7px;color:inherit;background:#f6f7f8;border:1px solid transparent;border-radius:8px;text-align:left;cursor:pointer;transition:.13s var(--rfai-ease)}.rfai-starters button:hover:not(:disabled){background:#f0f0fb;border-color:#ddddff}.rfai-starters button:disabled{opacity:.45;cursor:not-allowed}.rfai-starters button>span{width:31px;height:31px;display:grid;place-items:center;color:var(--rfai-primary);background:#fff;border-radius:7px}.rfai-starters button>div{min-width:0}.rfai-starters strong{display:block;font-size:7px}.rfai-starters small{display:block;margin-top:1px;overflow:hidden;color:var(--rfai-muted);text-overflow:ellipsis;white-space:nowrap;font-size:6px}.rfai-starters button>svg{color:#a0a1aa}
      .rfai-builder-card{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px}.rfai-builder-card>span{width:34px;height:34px;display:grid;place-items:center;color:#fff;background:var(--rfai-dark);border-radius:8px}.rfai-builder-card>div{min-width:0}.rfai-builder-card small{display:block;color:var(--rfai-muted);font-size:6px;text-transform:uppercase}.rfai-builder-card strong{display:block;margin-top:1px;font-size:8px}.rfai-builder-card p{margin:3px 0 0;color:var(--rfai-muted);font-size:6px;line-height:10px}.rfai-builder-card .rfai-button{grid-column:1/-1;margin-top:3px}
      .rfai-success-card{display:grid;grid-template-columns:31px minmax(0,1fr);gap:8px;color:var(--rfai-green);background:var(--rfai-green-soft);border-color:#c9ead9}.rfai-success-card>svg{margin-top:1px}.rfai-success-card strong{display:block;font-size:7px}.rfai-success-card p{margin:2px 0 0;color:#3f6b5d;font-size:6px;line-height:10px}

      @media(max-width:1100px){
        .rf-ai-v8{padding:22px}.rfai-layout{grid-template-columns:minmax(0,1fr) 280px}.rfai-audit-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rfai-journey-strip{grid-template-columns:1fr 1fr 1fr 1fr 1fr}.rfai-journey-strip>svg{display:none}
      }
      @media(max-width:880px){
        .rfai-page-header,.rfai-audit-hub-head{align-items:flex-start;flex-direction:column}.rfai-header-actions,.rfai-audit-actions{width:100%;flex-wrap:wrap}.rfai-layout{grid-template-columns:1fr}.rfai-side{position:static;grid-template-columns:1fr 1fr}.rfai-audit-row{grid-template-columns:36px minmax(0,1fr) 80px 16px}.rfai-journey-strip{overflow:auto;grid-template-columns:repeat(5,minmax(145px,1fr))}
      }
      @media(max-width:640px){
        .rf-ai-v8{padding:18px 12px 80px}.rfai-page-header h1{font-size:25px;line-height:32px}.rfai-page-header p{font-size:10px;line-height:16px}.rfai-header-actions{display:grid;grid-template-columns:1fr}.rfai-session-pill{width:100%}.rfai-audit-actions{display:grid;grid-template-columns:1fr}.rfai-audit-stat-grid{grid-template-columns:1fr 1fr}.rfai-audit-list-head{align-items:stretch;flex-direction:column}.rfai-audit-search{width:100%}.rfai-audit-row{grid-template-columns:34px minmax(0,1fr) 16px}.rfai-audit-row-meta{grid-column:2;grid-row:2;justify-items:start;display:flex;align-items:center;gap:6px}.rfai-audit-row>svg{grid-column:3;grid-row:1}.rfai-audit-empty{align-items:flex-start;flex-direction:column}.rfai-chat-card{min-height:600px}.rfai-messages{padding:13px}.rfai-message{max-width:92%}.rfai-composer footer{align-items:flex-start;flex-direction:column}.rfai-side{grid-template-columns:1fr}
      }
      @media(prefers-reduced-motion:reduce){
        .rf-ai-v8,.rfai-thinking>i,.rfai-spin,.rfai-audit-live-label i.active,.rfai-skeleton-block{animation:none!important}.rf-ai-v8 *,.rf-ai-v8 *::before,.rf-ai-v8 *::after{transition-duration:.01ms!important;scroll-behavior:auto!important}
      }
    `}</style>
  );
}
