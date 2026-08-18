import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Globe2,
  History,
  Image as ImageIcon,
  Info,
  Lightbulb,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { upgradeApi } from "../api";

const EMPTY_FORM = {
  website: "",
  companyName: "",
  niche: "",
  location: "",
  benchmarkUrls: "",
  offer: "",
};

const CREATE_STAGES = [
  {
    title: "Checking public pages",
    detail: "Reviewing the target site and detectable public signals.",
  },
  {
    title: "Comparing market evidence",
    detail: "Evaluating benchmark and competitive signals that can be verified.",
  },
  {
    title: "Structuring the sales report",
    detail: "Turning the evidence into priorities, recommendations, and outreach context.",
  },
];

export default function WebsiteAudits() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedAuditId = searchParams.get("audit") || "";

  const [audits, setAudits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [newAuditOpen, setNewAuditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedFinding, setExpandedFinding] = useState(0);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [createStage, setCreateStage] = useState(0);
  const [historySearch, setHistorySearch] = useState("");

  const firstLoadRef = useRef(true);

  const loadAudits = async ({ quiet = false, keepSelection = true } = {}) => {
    try {
      if (!quiet) setLoadingList(true);
      else setRefreshing(true);
      setError("");

      const response = await upgradeApi.audits();
      const nextAudits = normalizeAudits(response);
      setAudits(nextAudits);

      setSelected((current) => {
        const requested = requestedAuditId
          ? nextAudits.find((item) => String(item?.id) === String(requestedAuditId))
          : null;

        if (requested) return requested;

        if (keepSelection && current?.id) {
          const stillExists = nextAudits.find(
            (item) => String(item?.id) === String(current.id)
          );
          if (stillExists) return stillExists;
        }

        return nextAudits[0] || null;
      });

      if (quiet) {
        showToast(
          "success",
          "Audits refreshed",
          "The latest website audit activity is now visible."
        );
      }

      return nextAudits;
    } catch (err) {
      const message =
        err?.message || "We couldn't load website audits. Please try again.";
      setError(message);
      if (quiet) {
        showToast("error", "Refresh failed", message);
      }
      return [];
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextAudits = await loadAudits({ quiet: false, keepSelection: false });
      if (cancelled) return;

      if (!nextAudits.length && firstLoadRef.current) {
        setNewAuditOpen(true);
      }
      firstLoadRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!requestedAuditId || !audits.length) return;
    const match = audits.find(
      (item) => String(item?.id) === String(requestedAuditId)
    );
    if (match && String(match?.id) !== String(selected?.id || "")) {
      setSelected(match);
    }
  }, [requestedAuditId, audits, selected?.id]);

  useEffect(() => {
    if (!creating) {
      setCreateStage(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCreateStage((current) => Math.min(current + 1, CREATE_STAGES.length - 1));
    }, 2600);

    return () => window.clearInterval(timer);
  }, [creating]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectAudit = (audit, { closeHistory = true } = {}) => {
    if (!audit) return;
    setSelected(audit);
    setExpandedFinding(0);
    setEvidenceOpen(false);
    setOutreachOpen(false);

    const next = new URLSearchParams(searchParams);
    if (audit.id) next.set("audit", audit.id);
    else next.delete("audit");
    setSearchParams(next, { replace: true });

    if (closeHistory) setHistoryOpen(false);
  };

  const createAudit = async (event) => {
    event.preventDefault();
    if (creating) return;

    const website = String(form.website || "").trim();
    if (!website) {
      setNotice({
        type: "error",
        title: "Website required",
        message: "Enter the lead website before generating an audit.",
      });
      return;
    }

    try {
      setCreating(true);
      setCreateStage(0);
      setError("");
      setNotice(null);

      const response = await upgradeApi.createAudit({
        ...form,
        website,
        benchmarkUrls: splitBenchmarkUrls(form.benchmarkUrls),
      });
      const audit = normalizeAudit(response);

      if (!audit) {
        throw new Error("The audit completed without returning a report.");
      }

      setAudits((current) => [
        audit,
        ...current.filter((item) => String(item?.id) !== String(audit?.id)),
      ]);
      selectAudit(audit);
      setForm(EMPTY_FORM);
      setNewAuditOpen(false);

      showToast(
        "success",
        "Audit generated",
        `${getAuditName(audit)} is ready to review.`
      );
      setNotice({
        type: "success",
        title: "Audit ready",
        message: "Verified findings and sales recommendations are now available.",
      });
    } catch (err) {
      const message =
        err?.message || "We couldn't generate this website audit. Please try again.";
      setNotice({
        type: "error",
        title: "Audit generation failed",
        message,
      });
      showToast("error", "Audit generation failed", message);
    } finally {
      setCreating(false);
    }
  };

  const deleteAudit = async () => {
    if (!deleteTarget?.id || deletingId) return;

    const id = deleteTarget.id;
    const label = getAuditName(deleteTarget);

    try {
      setDeletingId(id);
      await upgradeApi.deleteAudit(id);

      const nextAudits = audits.filter((item) => String(item?.id) !== String(id));
      setAudits(nextAudits);
      setDeleteTarget(null);

      if (String(selected?.id || "") === String(id)) {
        const nextSelected = nextAudits[0] || null;
        setSelected(nextSelected);
        const next = new URLSearchParams(searchParams);
        if (nextSelected?.id) next.set("audit", nextSelected.id);
        else next.delete("audit");
        setSearchParams(next, { replace: true });
      }

      showToast(
        "success",
        "Audit removed",
        `${label} was removed from audit history.`
      );
    } catch (err) {
      const message = err?.message || "We couldn't delete this audit.";
      showToast("error", "Delete failed", message);
      setNotice({ type: "error", title: "Delete failed", message });
    } finally {
      setDeletingId("");
    }
  };

  const shareAudit = async () => {
    if (!selected) return;

    const url = new URL(window.location.href);
    url.pathname = "/app/audits";
    url.searchParams.set("audit", selected.id || "");

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${getAuditName(selected)} · ReachFly AI Audit`,
          text: "Open this ReachFly website audit.",
          url: url.toString(),
        });
        showToast("success", "Audit shared", "The audit link was shared successfully.");
        return;
      }

      await copyText(url.toString());
      showToast("success", "Link copied", "The audit link is ready to share.");
    } catch (err) {
      if (err?.name === "AbortError") return;
      showToast(
        "error",
        "Couldn't share audit",
        "Copy the page URL manually and try again."
      );
    }
  };

  const exportPdf = () => {
    if (!selected) return;

    const previousEvidenceOpen = evidenceOpen;
    const previousOutreachOpen = outreachOpen;
    const previousExpandedFinding = expandedFinding;

    setEvidenceOpen(true);
    setOutreachOpen(true);
    setExpandedFinding(-2);

    const restorePrintState = () => {
      setEvidenceOpen(previousEvidenceOpen);
      setOutreachOpen(previousOutreachOpen);
      setExpandedFinding(previousExpandedFinding);
      window.removeEventListener("afterprint", restorePrintState);
    };

    window.addEventListener("afterprint", restorePrintState);

    showToast(
      "info",
      "Preparing print view",
      "Choose “Save as PDF” in your browser's print dialog."
    );

    window.setTimeout(() => window.print(), 240);
  };

  const report = selected?.report || {};
  const overallScore = getOverallScore(selected);
  const findings = useMemo(
    () => (Array.isArray(report?.priorityFindings) ? report.priorityFindings : []),
    [report?.priorityFindings]
  );
  const strengths = Array.isArray(report?.strengths) ? report.strengths : [];
  const roadmap = Array.isArray(report?.roadmap) ? report.roadmap : [];

  const metrics = useMemo(() => buildCoreMetrics(report), [report]);
  const recommendation = useMemo(
    () => buildPrimaryRecommendation(report, findings, roadmap),
    [report, findings, roadmap]
  );
  const strategicInsight =
    report?.competitorSummary || report?.executiveSummary || "";

  const filteredAudits = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return audits;
    return audits.filter((audit) => {
      const haystack = [
        getAuditName(audit),
        audit?.targetUrl,
        audit?.website,
        audit?.location,
        audit?.niche,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [audits, historySearch]);

  return (
    <>
      <style>{AUDIT_V7_CSS}</style>

      <div className="rf7-audit-page">
        {notice ? (
          <InlineNotice notice={notice} onDismiss={() => setNotice(null)} />
        ) : null}

        {loadingList ? (
          <AuditPageSkeleton />
        ) : selected ? (
          <>
            <AuditHero
              audit={selected}
              report={report}
              score={overallScore}
              onShare={shareAudit}
              onExport={exportPdf}
              onNew={() => setNewAuditOpen(true)}
              onHistory={() => setHistoryOpen(true)}
              onRefresh={() => loadAudits({ quiet: true })}
              refreshing={refreshing}
            />

            <section className="rf7-audit-section rf7-audit-core-section">
              <SectionTitle title="Core Metrics" />
              <div className="rf7-audit-metric-grid">
                {metrics.map((metric, index) => (
                  <AuditMetricCard key={metric.key} metric={metric} index={index} />
                ))}
              </div>
            </section>

            {strategicInsight ? (
              <section className="rf7-audit-ai-insight">
                <div className="rf7-audit-ai-icon" aria-hidden="true">
                  <Brain size={29} strokeWidth={1.9} />
                </div>
                <div className="rf7-audit-ai-copy">
                  <div className="rf7-audit-ai-heading">
                    <div>
                      <span>AI Strategic Insight</span>
                      <small>Grounded in the audit report and available public evidence.</small>
                    </div>
                    <Sparkles size={17} aria-hidden="true" />
                  </div>
                  <p>{strategicInsight}</p>
                  {report?.marketQuery ? (
                    <button
                      type="button"
                      className="rf7-audit-text-link"
                      onClick={() => setEvidenceOpen(true)}
                    >
                      View market evidence <ArrowRight size={15} />
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="rf7-audit-findings-layout">
              <div className="rf7-audit-findings-column">
                <SectionTitle title="Actionable Findings" neutral />

                {findings.length ? (
                  <div className="rf7-audit-findings-list">
                    {findings.map((finding, index) => (
                      <FindingCard
                        key={`${finding?.title || "finding"}-${index}`}
                        finding={finding}
                        index={index}
                        expanded={expandedFinding === index || expandedFinding === -2}
                        onToggle={() =>
                          setExpandedFinding((current) =>
                            current === index ? -1 : index
                          )
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyFindings />
                )}
              </div>

              <aside className="rf7-audit-recommendation-column">
                <SectionTitle title="Recommendations" />
                <RecommendationCard
                  recommendation={recommendation}
                  onOpen={() => setEvidenceOpen(true)}
                />
              </aside>
            </section>

            <section className="rf7-audit-details-grid">
              <article className="rf7-audit-detail-card">
                <div className="rf7-audit-detail-card-head">
                  <div className="rf7-audit-detail-icon success">
                    <CheckCircle2 size={19} />
                  </div>
                  <div>
                    <span>What is already working</span>
                    <h2>Strengths</h2>
                  </div>
                </div>

                {strengths.length ? (
                  <ul className="rf7-audit-strength-list">
                    {strengths.map((item, index) => (
                      <li key={`${item}-${index}`}>
                        <Check size={15} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rf7-audit-muted-copy">
                    This audit did not return a separate strengths list.
                  </p>
                )}
              </article>

              <article className="rf7-audit-detail-card">
                <div className="rf7-audit-detail-card-head">
                  <div className="rf7-audit-detail-icon primary">
                    <Zap size={19} />
                  </div>
                  <div>
                    <span>Sales enablement</span>
                    <h2>Turn insight into outreach</h2>
                  </div>
                </div>

                <p className="rf7-audit-muted-copy">
                  Use the audit's evidence-grounded opening and follow-up copy without
                  leaving ReachFly.
                </p>

                <button
                  type="button"
                  className="rf7-audit-wide-button"
                  onClick={() => setOutreachOpen((current) => !current)}
                >
                  <Wand2 size={16} />
                  {outreachOpen ? "Hide outreach kit" : "Open outreach kit"}
                  <ChevronDown
                    size={15}
                    className={outreachOpen ? "rotated" : ""}
                  />
                </button>
              </article>
            </section>

            {outreachOpen ? <OutreachKit report={report} /> : null}

            <section className="rf7-audit-evidence-section">
              <button
                type="button"
                className="rf7-audit-evidence-toggle"
                onClick={() => setEvidenceOpen((current) => !current)}
                aria-expanded={evidenceOpen}
              >
                <span className="rf7-audit-evidence-toggle-icon">
                  <FileText size={18} />
                </span>
                <span>
                  <b>Detailed evidence & roadmap</b>
                  <small>
                    Technical checks, SEO/local visibility, conversion/trust,
                    benchmarks, and next actions.
                  </small>
                </span>
                <ChevronDown
                  size={18}
                  className={evidenceOpen ? "rotated" : ""}
                />
              </button>

              {evidenceOpen ? (
                <AuditEvidence
                  report={report}
                  audit={selected}
                  roadmap={roadmap}
                />
              ) : null}
            </section>

            {report?.disclaimer ? (
              <div className="rf7-audit-disclaimer">
                <ShieldCheck size={17} />
                <p>{report.disclaimer}</p>
              </div>
            ) : null}
          </>
        ) : (
          <AuditEmptyState
            error={error}
            onCreate={() => setNewAuditOpen(true)}
            onRetry={() => loadAudits({ quiet: false, keepSelection: false })}
          />
        )}
      </div>

      {newAuditOpen ? (
        <NewAuditModal
          form={form}
          setForm={setForm}
          creating={creating}
          createStage={createStage}
          onSubmit={createAudit}
          onClose={() => {
            if (!creating) setNewAuditOpen(false);
          }}
        />
      ) : null}

      {historyOpen ? (
        <AuditHistoryDrawer
          audits={filteredAudits}
          selected={selected}
          query={historySearch}
          onQuery={setHistorySearch}
          onSelect={selectAudit}
          onDelete={setDeleteTarget}
          onNew={() => {
            setHistoryOpen(false);
            setNewAuditOpen(true);
          }}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteAuditDialog
          audit={deleteTarget}
          deleting={deletingId === deleteTarget?.id}
          onDelete={deleteAudit}
          onClose={() => {
            if (!deletingId) setDeleteTarget(null);
          }}
        />
      ) : null}
    </>
  );
}

function AuditHero({
  audit,
  report,
  score,
  onShare,
  onExport,
  onNew,
  onHistory,
  onRefresh,
  refreshing,
}) {
  const targetUrl = getAuditUrl(audit);
  const host = safeHost(targetUrl) || "Website audit";
  const title = getAuditName(audit);
  const summary =
    report?.executiveSummary ||
    "Website audit complete. Review the verified findings and recommended next actions below.";

  return (
    <header className="rf7-audit-hero">
      <div className="rf7-audit-hero-main">
        <div className="rf7-audit-chip-row">
          {targetUrl ? (
            <a
              href={normalizeExternalUrl(targetUrl)}
              target="_blank"
              rel="noreferrer"
              className="rf7-audit-site-chip"
              title={targetUrl}
            >
              <Globe2 size={13} />
              <span>{host}</span>
              <ExternalLink size={11} />
            </a>
          ) : null}

          <span className="rf7-audit-ai-chip">
            <Sparkles size={13} />
            AI Generated Audit
          </span>
        </div>

        <h1>{title}</h1>
        <p>{summary}</p>

        <div className="rf7-audit-meta-row">
          {audit?.createdAt ? (
            <span>
              <Clock3 size={13} />
              {formatAuditDate(audit.createdAt)}
            </span>
          ) : null}
          {audit?.niche ? <span>{audit.niche}</span> : null}
          {audit?.location ? <span>{audit.location}</span> : null}
        </div>
      </div>

      <div className="rf7-audit-hero-side">
        <div className="rf7-audit-health">
          <div className="rf7-audit-health-copy">
            <span>Overall health</span>
            <div>
              <strong>{score ?? "—"}</strong>
              <small>/100</small>
            </div>
          </div>
          <ScoreRing value={score} size={70} stroke={7} icon />
        </div>

        <div className="rf7-audit-hero-actions">
          <button type="button" className="rf7-audit-secondary" onClick={onShare}>
            <Share2 size={15} /> Share
          </button>
          <button type="button" className="rf7-audit-primary" onClick={onExport}>
            <Download size={15} /> Export PDF
          </button>
        </div>

        <div className="rf7-audit-hero-tools">
          <button type="button" onClick={onNew}>
            <Plus size={14} /> New audit
          </button>
          <button type="button" onClick={onHistory}>
            <History size={14} /> History
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh audits"
          >
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}

function AuditMetricCard({ metric, index }) {
  const value = metric.value;
  const tone = metric.tone || metricTone(value);

  return (
    <article
      className={`rf7-audit-metric-card ${tone}`}
      style={{ "--rf7-audit-delay": `${80 + index * 70}ms` }}
    >
      <div className="rf7-audit-metric-orb" aria-hidden="true" />
      <div className="rf7-audit-metric-head">
        <div>
          <span>{metric.label}</span>
          <strong>{value == null ? "—" : value}</strong>
        </div>
        <ScoreRing value={value} size={48} stroke={5} tone={tone} />
      </div>
      <p>
        <b>{metric.verdict}</b> {metric.detail}
      </p>
      <small>Derived from this audit's verified review checks.</small>
    </article>
  );
}

function ScoreRing({ value, size = 52, stroke = 6, tone = "primary", icon = false }) {
  const safe = clampScore(value);
  const color = ringColor(tone, safe);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dash = safe == null ? 0 : (safe / 100) * circumference;

  return (
    <div
      className={`rf7-audit-score-ring ${icon ? "with-icon" : ""}`}
      style={{ width: size, height: size }}
      aria-label={safe == null ? "Score not available" : `Score ${safe} out of 100`}
    >
      <svg viewBox="0 0 40 40" role="img" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="var(--rf7-audit-ring-track, #e7e8e9)"
          strokeWidth={stroke}
        />
        <circle
          className="rf7-audit-score-ring-value"
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      {icon ? (
        <span className="rf7-audit-ring-icon">
          <ShieldCheck size={17} />
        </span>
      ) : null}
    </div>
  );
}

function FindingCard({ finding, index, expanded, onToggle }) {
  const severity = normalizeSeverity(finding?.severity);
  const tone = severityTone(severity);
  const Icon =
    severity === "critical" || severity === "high"
      ? AlertTriangle
      : severity === "medium"
      ? Gauge
      : ImageIcon;

  return (
    <article
      className={`rf7-audit-finding ${tone} ${expanded ? "expanded" : ""}`}
      style={{ "--rf7-audit-delay": `${120 + index * 65}ms` }}
    >
      <span className="rf7-audit-finding-rail" aria-hidden="true" />
      <button type="button" className="rf7-audit-finding-main" onClick={onToggle}>
        <span className="rf7-audit-finding-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span className="rf7-audit-finding-copy">
          <span className="rf7-audit-finding-title-row">
            <b>{finding?.title || `Finding ${index + 1}`}</b>
            <em>{severityLabel(severity)}</em>
          </span>
          <span className="rf7-audit-finding-preview">
            {finding?.businessImpact || finding?.evidence || "Review this finding for details."}
          </span>
        </span>
        <ChevronDown size={16} className={expanded ? "rotated" : ""} />
      </button>

      {expanded ? (
        <div className="rf7-audit-finding-detail">
          {finding?.evidence ? (
            <div>
              <span>Evidence</span>
              <p>{finding.evidence}</p>
            </div>
          ) : null}
          {finding?.businessImpact ? (
            <div>
              <span>Business relevance</span>
              <p>{finding.businessImpact}</p>
            </div>
          ) : null}
          {finding?.recommendation ? (
            <div className="recommendation">
              <span>Recommendation</span>
              <p>{finding.recommendation}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function RecommendationCard({ recommendation, onOpen }) {
  if (!recommendation) {
    return (
      <article className="rf7-audit-recommendation-card empty">
        <div className="rf7-audit-rec-head">
          <span>Recommendation</span>
          <Lightbulb size={17} />
        </div>
        <div className="rf7-audit-rec-empty-icon">
          <Lightbulb size={28} />
        </div>
        <h3>No separate recommendation returned</h3>
        <p>
          Open the detailed evidence section to review any technical or market checks
          included in this audit.
        </p>
        <button type="button" onClick={onOpen}>
          View detailed evidence
        </button>
      </article>
    );
  }

  return (
    <article className="rf7-audit-recommendation-card">
      <div className="rf7-audit-rec-head">
        <span>{recommendation.label}</span>
        <Lightbulb size={17} />
      </div>

      <div className="rf7-audit-rec-visual" aria-hidden="true">
        <div className="rf7-audit-rec-browser">
          <span />
          <span />
          <span />
          <div className="rf7-audit-rec-before">
            <small>Current</small>
            <i />
            <i />
            <i className="short" />
            <b />
          </div>
          <div className="rf7-audit-rec-after">
            <small>Opportunity</small>
            <i />
            <i />
            <b />
            <em />
          </div>
        </div>
      </div>

      <h3>{recommendation.title}</h3>
      <p>{recommendation.text}</p>
      <button type="button" onClick={onOpen}>
        View recommendation details
      </button>
    </article>
  );
}

function OutreachKit({ report }) {
  const hasCall = Boolean(report?.callOpening);
  const hasEmail = Boolean(report?.emailSubject || report?.emailBody);

  return (
    <section className="rf7-audit-outreach-kit">
      <div className="rf7-audit-outreach-heading">
        <div>
          <span>Audit-powered outreach</span>
          <h2>Use the evidence in your next conversation.</h2>
        </div>
        <Sparkles size={20} />
      </div>

      <div className="rf7-audit-outreach-grid">
        <article>
          <div className="rf7-audit-outreach-title">
            <span className="phone"><Phone size={16} /></span>
            <div>
              <small>Cold-call opening</small>
              <b>Conversation opener</b>
            </div>
            {hasCall ? (
              <CopyButton text={report.callOpening} label="Copy opening" />
            ) : null}
          </div>
          <p>
            {hasCall
              ? report.callOpening
              : "This audit did not return a cold-call opening."}
          </p>
        </article>

        <article>
          <div className="rf7-audit-outreach-title">
            <span className="mail"><Mail size={16} /></span>
            <div>
              <small>Follow-up email</small>
              <b>{report?.emailSubject || "Email follow-up"}</b>
            </div>
            {hasEmail ? (
              <CopyButton
                text={[report?.emailSubject, report?.emailBody]
                  .filter(Boolean)
                  .join("\n\n")}
                label="Copy email"
              />
            ) : null}
          </div>
          <pre>
            {report?.emailBody || "This audit did not return follow-up email copy."}
          </pre>
        </article>
      </div>
    </section>
  );
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await copyText(text || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      showToast("success", "Copied", `${label} is on your clipboard.`);
    } catch {
      showToast("error", "Copy failed", "Select the text and copy it manually.");
    }
  };

  return (
    <button type="button" className="rf7-audit-copy-button" onClick={copy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function AuditEvidence({ report, audit, roadmap }) {
  const technical = Array.isArray(report?.technicalReview)
    ? report.technicalReview
    : [];
  const seo = Array.isArray(report?.seoAndLocalVisibility)
    ? report.seoAndLocalVisibility
    : [];
  const conversion = Array.isArray(report?.conversionAndTrust)
    ? report.conversionAndTrust
    : [];

  return (
    <div className="rf7-audit-evidence-content">
      <div className="rf7-audit-evidence-grid">
        <ReviewPanel title="Technical review" rows={technical} />
        <ReviewPanel title="SEO & local visibility" rows={seo} />
        <ReviewPanel title="Conversion & trust" rows={conversion} />
      </div>

      {report?.competitorSummary ? (
        <article className="rf7-audit-competitor-summary">
          <div>
            <BarChart3 size={19} />
            <span>Competitive context</span>
          </div>
          <p>{report.competitorSummary}</p>
        </article>
      ) : null}

      {roadmap.length ? (
        <div className="rf7-audit-roadmap-wrap">
          <div className="rf7-audit-subheading">
            <span>Recommended roadmap</span>
            <small>Prioritized actions returned by this audit.</small>
          </div>
          <div className="rf7-audit-roadmap">
            {roadmap.map((phase, index) => (
              <article key={`${phase?.phase || "phase"}-${index}`}>
                <span className="rf7-audit-roadmap-number">{index + 1}</span>
                <div>
                  {phase?.timeframe ? <small>{phase.timeframe}</small> : null}
                  <h3>{phase?.phase || `Phase ${index + 1}`}</h3>
                  {Array.isArray(phase?.actions) && phase.actions.length ? (
                    <ul>
                      {phase.actions.map((action, actionIndex) => (
                        <li key={`${action}-${actionIndex}`}>
                          <Check size={13} /> {action}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rf7-audit-benchmark-box">
        <div>
          <Globe2 size={18} />
          <span>Benchmark context</span>
        </div>
        <p>
          {Array.isArray(audit?.benchmarkUrls) && audit.benchmarkUrls.length
            ? audit.benchmarkUrls.join(" · ")
            : "No explicit benchmark URLs were attached to this audit."}
        </p>
      </div>
    </div>
  );
}

function ReviewPanel({ title, rows }) {
  return (
    <article className="rf7-audit-review-panel">
      <div className="rf7-audit-review-head">
        <span>{title}</span>
        <em>{rows.length} checks</em>
      </div>

      {rows.length ? (
        <div className="rf7-audit-review-list">
          {rows.map((row, index) => {
            const tone = reviewStatusTone(row?.status);
            return (
              <div key={`${row?.item || "check"}-${index}`}>
                <span className={`rf7-audit-review-status ${tone}`}>
                  {row?.status || "Review"}
                </span>
                <b>{row?.item || `Check ${index + 1}`}</b>
                {row?.evidence ? <p>{row.evidence}</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rf7-audit-review-empty">
          No separate {title.toLowerCase()} checks were returned.
        </p>
      )}
    </article>
  );
}

function NewAuditModal({
  form,
  setForm,
  creating,
  createStage,
  onSubmit,
  onClose,
}) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="rf7-audit-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="rf7-audit-modal rf7-audit-new-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rf7-new-audit-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="rf7-audit-modal-head">
          <div>
            <span className="rf7-audit-modal-kicker">
              <Sparkles size={13} /> AI website audit
            </span>
            <h2 id="rf7-new-audit-title">Generate a new audit</h2>
            <p>
              Add the prospect's website and useful market context. ReachFly will
              preserve verified evidence separately from AI-written recommendations.
            </p>
          </div>
          <button
            type="button"
            className="rf7-audit-icon-button"
            onClick={onClose}
            disabled={creating}
            aria-label="Close new audit"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="rf7-audit-form-v7">
          <label className="rf7-audit-field full">
            <span>Lead website *</span>
            <div className="rf7-audit-input-wrap">
              <Globe2 size={16} />
              <input
                value={form.website}
                onChange={(event) => update("website", event.target.value)}
                placeholder="https://exampleclinic.com"
                required
                disabled={creating}
              />
            </div>
          </label>

          <div className="rf7-audit-form-grid">
            <label className="rf7-audit-field">
              <span>Company name</span>
              <input
                value={form.companyName}
                onChange={(event) => update("companyName", event.target.value)}
                placeholder="BrightSmile Orthodontics"
                disabled={creating}
              />
            </label>

            <label className="rf7-audit-field">
              <span>Niche</span>
              <input
                value={form.niche}
                onChange={(event) => update("niche", event.target.value)}
                placeholder="Orthodontics"
                disabled={creating}
              />
            </label>

            <label className="rf7-audit-field">
              <span>Location</span>
              <input
                value={form.location}
                onChange={(event) => update("location", event.target.value)}
                placeholder="Austin, TX"
                disabled={creating}
              />
            </label>

            <label className="rf7-audit-field">
              <span>Your relevant offer</span>
              <input
                value={form.offer}
                onChange={(event) => update("offer", event.target.value)}
                placeholder="Patient enquiry automation"
                disabled={creating}
              />
            </label>
          </div>

          <label className="rf7-audit-field full">
            <span>Benchmark URLs — optional</span>
            <textarea
              rows={3}
              value={form.benchmarkUrls}
              onChange={(event) => update("benchmarkUrls", event.target.value)}
              placeholder="One URL per line. Leave blank to use verified workspace context where available."
              disabled={creating}
            />
          </label>

          {creating ? (
            <div className="rf7-audit-create-progress" aria-live="polite">
              <div className="rf7-audit-create-progress-head">
                <span>
                  <Loader2 size={16} className="spin" /> Generating audit
                </span>
                <small>This can take a couple of minutes.</small>
              </div>
              <div className="rf7-audit-create-steps">
                {CREATE_STAGES.map((stage, index) => {
                  const complete = index < createStage;
                  const active = index === createStage;
                  return (
                    <div
                      key={stage.title}
                      className={`${complete ? "complete" : ""} ${
                        active ? "active" : ""
                      }`}
                    >
                      <span>
                        {complete ? (
                          <Check size={13} />
                        ) : active ? (
                          <Loader2 size={13} className="spin" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <div>
                        <b>{stage.title}</b>
                        <small>{stage.detail}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="rf7-audit-modal-actions">
            <button
              type="button"
              className="rf7-audit-secondary"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rf7-audit-primary"
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="spin" /> Running audit…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Generate audit
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AuditHistoryDrawer({
  audits,
  selected,
  query,
  onQuery,
  onSelect,
  onDelete,
  onNew,
  onClose,
}) {
  return (
    <div className="rf7-audit-drawer-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="rf7-audit-history-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Audit history"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="rf7-audit-history-head">
          <div>
            <span>Workspace history</span>
            <h2>Website audits</h2>
          </div>
          <button type="button" className="rf7-audit-icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <button type="button" className="rf7-audit-primary rf7-audit-new-history" onClick={onNew}>
          <Plus size={15} /> New audit
        </button>

        <div className="rf7-audit-history-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search audits…"
          />
        </div>

        <div className="rf7-audit-history-list">
          {audits.length ? (
            audits.map((audit) => {
              const score = getOverallScore(audit);
              const active = String(selected?.id || "") === String(audit?.id || "");
              return (
                <div className={`rf7-audit-history-row ${active ? "active" : ""}`} key={audit.id}>
                  <button type="button" onClick={() => onSelect(audit)}>
                    <span className="rf7-audit-history-score">
                      {score == null ? "—" : score}
                    </span>
                    <span className="rf7-audit-history-copy">
                      <b>{getAuditName(audit)}</b>
                      <small>{safeHost(getAuditUrl(audit)) || getAuditUrl(audit)}</small>
                      <em>{formatAuditDate(audit.createdAt)}</em>
                    </span>
                    {active ? <CheckCircle2 size={17} /> : <ArrowRight size={16} />}
                  </button>
                  <button
                    type="button"
                    className="rf7-audit-history-delete"
                    onClick={() => onDelete(audit)}
                    aria-label={`Delete ${getAuditName(audit)}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="rf7-audit-history-empty">
              <Search size={22} />
              <b>No matching audits</b>
              <p>Try another company name, website, niche, or location.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function DeleteAuditDialog({ audit, deleting, onDelete, onClose }) {
  return (
    <div className="rf7-audit-overlay rf7-audit-delete-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="rf7-audit-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rf7-delete-audit-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="rf7-audit-confirm-icon">
          <Trash2 size={20} />
        </span>
        <h2 id="rf7-delete-audit-title">Delete this audit?</h2>
        <p>
          <b>{getAuditName(audit)}</b> will be removed from ReachFly audit history.
          This action cannot be undone.
        </p>
        <div>
          <button type="button" className="rf7-audit-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="rf7-audit-danger" onClick={onDelete} disabled={deleting}>
            {deleting ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
            {deleting ? "Deleting…" : "Delete audit"}
          </button>
        </div>
      </section>
    </div>
  );
}

function InlineNotice({ notice, onDismiss }) {
  const Icon =
    notice.type === "success"
      ? CheckCircle2
      : notice.type === "error"
      ? AlertTriangle
      : Info;

  return (
    <div className={`rf7-audit-inline-notice ${notice.type || "info"}`} role="status">
      <span>
        <Icon size={18} />
      </span>
      <div>
        <b>{notice.title}</b>
        {notice.message ? <p>{notice.message}</p> : null}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message">
        <X size={15} />
      </button>
      <i />
    </div>
  );
}

function AuditEmptyState({ error, onCreate, onRetry }) {
  return (
    <section className="rf7-audit-empty-page">
      <div className="rf7-audit-empty-art" aria-hidden="true">
        <div className="rf7-audit-empty-ring one" />
        <div className="rf7-audit-empty-ring two" />
        <span>
          {error ? <AlertTriangle size={32} /> : <Sparkles size={32} />}
        </span>
      </div>
      <span className="rf7-audit-empty-kicker">AI website intelligence</span>
      <h1>{error ? "We couldn't load your audits." : "Turn a website into a sales conversation."}</h1>
      <p>
        {error
          ? error
          : "Generate an evidence-grounded website audit, surface practical opportunities, and turn the findings into outreach your team can actually use."}
      </p>
      <div>
        {error ? (
          <button type="button" className="rf7-audit-secondary" onClick={onRetry}>
            <RefreshCw size={15} /> Retry
          </button>
        ) : null}
        <button type="button" className="rf7-audit-primary" onClick={onCreate}>
          <Plus size={16} /> Generate first audit
        </button>
      </div>
    </section>
  );
}

function EmptyFindings() {
  return (
    <div className="rf7-audit-no-findings">
      <CheckCircle2 size={23} />
      <div>
        <b>No priority findings returned</b>
        <p>
          This report did not include a separate priority findings list. Review the
          detailed evidence below for any available checks.
        </p>
      </div>
    </div>
  );
}

function AuditPageSkeleton() {
  return (
    <div className="rf7-audit-skeleton" aria-label="Loading website audits" aria-busy="true">
      <div className="rf7-audit-skeleton-hero">
        <div>
          <i className="w28" />
          <i className="w58 h36" />
          <i className="w72" />
          <i className="w49" />
        </div>
        <div className="rf7-audit-skeleton-score" />
      </div>
      <div className="rf7-audit-skeleton-label" />
      <div className="rf7-audit-skeleton-metrics">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} />
        ))}
      </div>
      <div className="rf7-audit-skeleton-insight" />
      <div className="rf7-audit-skeleton-lower">
        <div>
          <i />
          <i />
          <i />
        </div>
        <aside />
      </div>
    </div>
  );
}

function SectionTitle({ title, neutral = false }) {
  return (
    <div className={`rf7-audit-section-title ${neutral ? "neutral" : ""}`}>
      <span aria-hidden="true" />
      <h2>{title}</h2>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Data helpers                                                               */
/* -------------------------------------------------------------------------- */

function normalizeAudits(response) {
  if (Array.isArray(response)) return response.filter(Boolean);
  if (Array.isArray(response?.audits)) return response.audits.filter(Boolean);
  if (Array.isArray(response?.items)) return response.items.filter(Boolean);
  if (Array.isArray(response?.data)) return response.data.filter(Boolean);
  return [];
}

function normalizeAudit(response) {
  if (!response) return null;
  return response?.audit || response?.data?.audit || response?.data || response;
}

function splitBenchmarkUrls(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAuditName(audit) {
  return (
    audit?.companyName ||
    audit?.report?.companyName ||
    safeHost(getAuditUrl(audit)) ||
    audit?.targetUrl ||
    audit?.website ||
    "Website Audit"
  );
}

function getAuditUrl(audit) {
  return (
    audit?.targetUrl ||
    audit?.website ||
    audit?.evidence?.target?.url ||
    audit?.report?.targetUrl ||
    ""
  );
}

function getOverallScore(audit) {
  const candidates = [
    audit?.report?.score,
    audit?.evidence?.target?.rawScore,
    audit?.score,
  ];

  for (const candidate of candidates) {
    const score = clampScore(candidate);
    if (score != null) return score;
  }
  return null;
}

function buildCoreMetrics(report = {}) {
  const technical = Array.isArray(report?.technicalReview)
    ? report.technicalReview
    : [];
  const seo = Array.isArray(report?.seoAndLocalVisibility)
    ? report.seoAndLocalVisibility
    : [];
  const conversion = Array.isArray(report?.conversionAndTrust)
    ? report.conversionAndTrust
    : [];

  const uxRows = [...technical, ...conversion].filter((row) =>
    /mobile|navigation|usability|user|access|layout|experience|form|cta|trust|contact/i.test(
      `${row?.item || ""} ${row?.evidence || ""}`
    )
  );

  return [
    buildMetric("seo", "SEO", scoreReviewRows(seo), seo, "primary"),
    buildMetric(
      "performance",
      "Performance",
      scoreReviewRows(
        technical.filter((row) =>
          /speed|performance|lcp|cls|inp|load|core web|image|script|technical/i.test(
            `${row?.item || ""} ${row?.evidence || ""}`
          )
        ).length
          ? technical.filter((row) =>
              /speed|performance|lcp|cls|inp|load|core web|image|script|technical/i.test(
                `${row?.item || ""} ${row?.evidence || ""}`
              )
            )
          : technical
      ),
      technical,
      "amber"
    ),
    buildMetric("ux", "User Exp", scoreReviewRows(uxRows), uxRows, "indigo"),
    buildMetric(
      "conversion",
      "Conversion",
      scoreReviewRows(conversion),
      conversion,
      "emerald"
    ),
  ];
}

function buildMetric(key, label, value, rows, preferredTone) {
  const firstEvidence = rows.find((row) => String(row?.evidence || "").trim())?.evidence;
  const verdict = metricVerdict(value);

  return {
    key,
    label,
    value,
    tone: preferredTone,
    verdict,
    detail:
      firstEvidence ||
      (value == null
        ? "Not separately scored in this audit."
        : "Based on the verified checks returned in this audit."),
  };
}

function scoreReviewRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;

  const values = rows.map((row) => reviewStatusValue(row?.status));
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100);
}

function reviewStatusValue(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return 0.55;
  if (/excellent|pass|passed|good|strong|healthy|success|complete|ok|present|yes/.test(value)) {
    return 1;
  }
  if (/warning|medium|partial|fair|mixed|improve|needs work|review/.test(value)) {
    return 0.62;
  }
  if (/critical|fail|failed|poor|error|high|missing|no|broken/.test(value)) {
    return 0.25;
  }
  return 0.55;
}

function reviewStatusTone(status) {
  const value = String(status || "").toLowerCase();
  if (/excellent|pass|good|strong|healthy|success|complete|ok|present/.test(value)) {
    return "success";
  }
  if (/critical|fail|poor|error|high|missing|broken/.test(value)) return "danger";
  return "warning";
}

function metricVerdict(value) {
  if (value == null) return "Not scored.";
  if (value >= 85) return "Excellent.";
  if (value >= 72) return "Good.";
  if (value >= 55) return "Needs work.";
  return "High priority.";
}

function metricTone(value) {
  if (value == null) return "primary";
  if (value >= 85) return "emerald";
  if (value >= 72) return "indigo";
  if (value >= 55) return "amber";
  return "danger";
}

function ringColor(tone, score) {
  if (score == null) return "#b7b6c2";
  if (tone === "emerald") return "#12b886";
  if (tone === "amber") return "#f59e0b";
  if (tone === "danger") return "#dc2626";
  if (tone === "indigo") return "#4f46e5";
  return "#4648d4";
}

function buildPrimaryRecommendation(report, findings, roadmap) {
  const finding = findings.find((item) => String(item?.recommendation || "").trim());
  if (finding) {
    return {
      label: `${severityLabel(normalizeSeverity(finding?.severity))} recommendation`,
      title: finding?.title || "Priority optimization",
      text: finding.recommendation,
    };
  }

  const firstPhase = roadmap.find(
    (phase) => Array.isArray(phase?.actions) && phase.actions.length
  );
  if (firstPhase) {
    return {
      label: firstPhase?.timeframe || "Recommended roadmap",
      title: firstPhase?.phase || "Next action",
      text: firstPhase.actions[0],
    };
  }

  if (report?.competitorSummary) {
    return {
      label: "Competitive opportunity",
      title: "Use the market gap",
      text: report.competitorSummary,
    };
  }

  return null;
}

function normalizeSeverity(value) {
  const severity = String(value || "medium").trim().toLowerCase();
  if (severity.includes("critical")) return "critical";
  if (severity.includes("high")) return "high";
  if (severity.includes("low") || severity.includes("quick")) return "low";
  return "medium";
}

function severityTone(severity) {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  if (severity === "low") return "success";
  return "primary";
}

function severityLabel(severity) {
  if (severity === "critical") return "Critical";
  if (severity === "high") return "High Impact";
  if (severity === "low") return "Quick Win";
  return "Priority";
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function safeHost(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return new URL(normalizeExternalUrl(text)).hostname.replace(/^www\./i, "");
  } catch {
    return text.replace(/^https?:\/\//i, "").split("/")[0];
  }
}

function normalizeExternalUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function formatAuditDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Recent audit";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Copy failed");
}

function showToast(type, title, message) {
  if (typeof window === "undefined") return;
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

/* -------------------------------------------------------------------------- */
/* Stitch-matched scoped styling                                              */
/* -------------------------------------------------------------------------- */

const AUDIT_V7_CSS = `
.rf7-audit-page {
  --audit-primary: var(--rf7-primary, #4648d4);
  --audit-primary-soft: var(--rf7-primary-soft, #eeeeff);
  --audit-surface: var(--rf7-surface, #f8f9fa);
  --audit-card: var(--rf7-card, #ffffff);
  --audit-border: var(--rf7-outline, #e4e5e9);
  --audit-text: var(--rf7-text, #191c1d);
  --audit-soft: var(--rf7-text-soft, #5f6270);
  --audit-muted: var(--rf7-text-muted, #8a8d99);
  --audit-success: #0a9f73;
  --audit-success-soft: #e7f8f2;
  --audit-warning: #e98200;
  --audit-warning-soft: #fff4df;
  --audit-danger: #cf2e2e;
  --audit-danger-soft: #ffebea;
  min-height: calc(100vh - 62px);
  padding: 0 0 54px;
  color: var(--audit-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.rf7-audit-page *,
.rf7-audit-page *::before,
.rf7-audit-page *::after,
.rf7-audit-overlay *,
.rf7-audit-drawer-overlay * {
  box-sizing: border-box;
}

.rf7-audit-page button,
.rf7-audit-overlay button,
.rf7-audit-drawer-overlay button,
.rf7-audit-page input,
.rf7-audit-page textarea,
.rf7-audit-overlay input,
.rf7-audit-overlay textarea,
.rf7-audit-drawer-overlay input {
  font: inherit;
}

.rf7-audit-page button,
.rf7-audit-overlay button,
.rf7-audit-drawer-overlay button {
  -webkit-tap-highlight-color: transparent;
}

.rf7-audit-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 42px;
  align-items: center;
  margin: 0 -28px 0;
  padding: 42px 30px 38px;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid var(--audit-border);
  animation: rf7AuditHeroIn 420ms cubic-bezier(.2,.75,.2,1) both;
}

.rf7-audit-hero-main {
  min-width: 0;
}

.rf7-audit-chip-row,
.rf7-audit-meta-row,
.rf7-audit-hero-actions,
.rf7-audit-hero-tools,
.rf7-audit-health,
.rf7-audit-health-copy > div,
.rf7-audit-ai-heading,
.rf7-audit-detail-card-head,
.rf7-audit-outreach-title,
.rf7-audit-review-head,
.rf7-audit-competitor-summary > div,
.rf7-audit-benchmark-box > div,
.rf7-audit-modal-kicker,
.rf7-audit-create-progress-head,
.rf7-audit-inline-notice,
.rf7-audit-history-head,
.rf7-audit-section-title {
  display: flex;
  align-items: center;
}

.rf7-audit-chip-row {
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 13px;
}

.rf7-audit-site-chip,
.rf7-audit-ai-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 25px;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 15px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.rf7-audit-site-chip {
  max-width: 260px;
  color: #41434b;
  background: #f0f1f2;
  border: 1px solid #e6e7e9;
}

.rf7-audit-site-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.rf7-audit-site-chip:hover {
  color: var(--audit-primary);
  border-color: color-mix(in srgb, var(--audit-primary) 24%, #e6e7e9);
}

.rf7-audit-ai-chip {
  color: #4338ca;
  background: #eeecff;
  border: 1px solid #e5e1ff;
}

.rf7-audit-hero h1 {
  margin: 0;
  max-width: 820px;
  font-family: Geist, Inter, sans-serif;
  font-size: clamp(27px, 2.35vw, 38px);
  line-height: 1.08;
  letter-spacing: -0.038em;
  font-weight: 650;
  color: #151719;
}

.rf7-audit-hero-main > p {
  max-width: 810px;
  margin: 12px 0 0;
  color: #4d5060;
  font-size: 14px;
  line-height: 1.58;
}

.rf7-audit-meta-row {
  flex-wrap: wrap;
  gap: 8px 15px;
  margin-top: 13px;
  color: #818490;
  font-size: 10px;
  line-height: 15px;
}

.rf7-audit-meta-row span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.rf7-audit-hero-side {
  display: grid;
  justify-items: end;
  gap: 13px;
  min-width: 270px;
}

.rf7-audit-health {
  justify-content: flex-end;
  gap: 18px;
}

.rf7-audit-health-copy {
  text-align: right;
}

.rf7-audit-health-copy > span {
  display: block;
  margin-bottom: 2px;
  color: #30323a;
  font-size: 10px;
  line-height: 14px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: .075em;
}

.rf7-audit-health-copy > div {
  justify-content: flex-end;
  gap: 3px;
}

.rf7-audit-health-copy strong {
  font-family: Geist, Inter, sans-serif;
  font-size: 30px;
  line-height: 34px;
  font-weight: 650;
  letter-spacing: -.03em;
}

.rf7-audit-health-copy small {
  margin-top: 8px;
  color: #333642;
  font-size: 11px;
}

.rf7-audit-score-ring {
  position: relative;
  flex: 0 0 auto;
}

.rf7-audit-score-ring svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.rf7-audit-score-ring-value {
  animation: rf7AuditRingDraw 820ms cubic-bezier(.18,.78,.24,1) both;
}

.rf7-audit-ring-icon {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--audit-primary);
}

.rf7-audit-hero-actions {
  gap: 8px;
}

.rf7-audit-primary,
.rf7-audit-secondary,
.rf7-audit-danger,
.rf7-audit-wide-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 36px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 11px;
  line-height: 16px;
  font-weight: 650;
  transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease,
    color 180ms ease, border-color 180ms ease, opacity 180ms ease;
}

.rf7-audit-primary {
  color: #fff;
  background: linear-gradient(135deg, #4648d4, #5658e3);
  box-shadow: 0 5px 14px rgba(70, 72, 212, .18);
}

.rf7-audit-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 19px rgba(70, 72, 212, .23);
}

.rf7-audit-secondary {
  color: #25272e;
  background: #f2f3f4;
  border-color: #ececee;
}

.rf7-audit-secondary:hover:not(:disabled) {
  background: #e9eaec;
  transform: translateY(-1px);
}

.rf7-audit-danger {
  color: #fff;
  background: #c83232;
  box-shadow: 0 5px 13px rgba(200, 50, 50, .17);
}

.rf7-audit-danger:hover:not(:disabled) {
  background: #b52525;
  transform: translateY(-1px);
}

.rf7-audit-primary:active:not(:disabled),
.rf7-audit-secondary:active:not(:disabled),
.rf7-audit-danger:active:not(:disabled),
.rf7-audit-wide-button:active:not(:disabled) {
  transform: translateY(0) scale(.985);
}

.rf7-audit-primary:disabled,
.rf7-audit-secondary:disabled,
.rf7-audit-danger:disabled,
.rf7-audit-wide-button:disabled {
  opacity: .58;
  cursor: not-allowed;
}

.rf7-audit-hero-tools {
  gap: 3px;
}

.rf7-audit-hero-tools button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 7px;
  color: #7b7e89;
  background: transparent;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  font-size: 9px;
  font-weight: 650;
  transition: color 160ms ease, background 160ms ease;
}

.rf7-audit-hero-tools button:hover:not(:disabled) {
  color: #393c47;
  background: #f3f4f5;
}

.rf7-audit-section {
  margin-top: 28px;
}

.rf7-audit-section-title {
  gap: 9px;
  margin-bottom: 15px;
}

.rf7-audit-section-title > span {
  width: 3px;
  height: 24px;
  flex: 0 0 3px;
  border-radius: 999px;
  background: var(--audit-primary);
}

.rf7-audit-section-title.neutral > span {
  background: #e2e3e6;
}

.rf7-audit-section-title h2 {
  margin: 0;
  font-family: Geist, Inter, sans-serif;
  font-size: 17px;
  line-height: 24px;
  font-weight: 650;
  letter-spacing: -.02em;
}

.rf7-audit-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.rf7-audit-metric-card {
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 144px;
  overflow: hidden;
  padding: 20px;
  background: #fff;
  border: 1px solid #ececef;
  border-radius: 13px;
  box-shadow: 0 4px 13px rgba(20, 24, 31, .035);
  animation: rf7AuditCardIn 440ms cubic-bezier(.2,.72,.2,1) var(--rf7-audit-delay, 0ms) both;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.rf7-audit-metric-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 11px 24px rgba(20, 24, 31, .075);
  border-color: #e1e2e7;
}

.rf7-audit-metric-orb {
  position: absolute;
  z-index: -1;
  top: -43px;
  right: -38px;
  width: 115px;
  height: 115px;
  border-radius: 0 0 0 95px;
  background: rgba(70,72,212,.08);
  transition: transform 260ms ease;
}

.rf7-audit-metric-card:hover .rf7-audit-metric-orb {
  transform: scale(1.13);
}

.rf7-audit-metric-card.amber .rf7-audit-metric-orb { background: rgba(245,158,11,.10); }
.rf7-audit-metric-card.indigo .rf7-audit-metric-orb { background: rgba(79,70,229,.09); }
.rf7-audit-metric-card.emerald .rf7-audit-metric-orb { background: rgba(16,185,129,.09); }
.rf7-audit-metric-card.danger .rf7-audit-metric-orb { background: rgba(220,38,38,.08); }

.rf7-audit-metric-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.rf7-audit-metric-head > div:first-child > span {
  display: block;
  color: #5d606a;
  font-size: 10px;
  line-height: 14px;
  font-weight: 650;
  letter-spacing: .07em;
  text-transform: uppercase;
}

.rf7-audit-metric-head strong {
  display: block;
  margin-top: 5px;
  font-family: Geist, Inter, sans-serif;
  font-size: 25px;
  line-height: 29px;
  letter-spacing: -.035em;
  font-weight: 650;
}

.rf7-audit-metric-card > p {
  position: relative;
  z-index: 1;
  margin: 12px 0 0;
  color: #525561;
  font-size: 11px;
  line-height: 1.48;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.rf7-audit-metric-card > p b {
  color: var(--audit-primary);
  font-weight: 650;
}

.rf7-audit-metric-card.amber > p b { color: #dd7100; }
.rf7-audit-metric-card.emerald > p b { color: #07855f; }
.rf7-audit-metric-card.danger > p b { color: #c52b2b; }

.rf7-audit-metric-card > small {
  display: block;
  margin-top: 8px;
  color: #a0a2aa;
  font-size: 8px;
  line-height: 12px;
}

.rf7-audit-ai-insight {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 20px;
  overflow: hidden;
  margin-top: 34px;
  padding: 28px 30px;
  background:
    radial-gradient(circle at 98% -10%, rgba(83,79,222,.16), transparent 36%),
    linear-gradient(135deg, rgba(239,239,255,.82), rgba(246,246,255,.96));
  border: 1px solid #e6e5ff;
  border-radius: 15px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 6px 18px rgba(70,72,212,.035);
  animation: rf7AuditCardIn 480ms cubic-bezier(.2,.72,.2,1) 300ms both;
}

.rf7-audit-ai-insight::after {
  content: "";
  position: absolute;
  top: -90px;
  right: -65px;
  width: 230px;
  height: 230px;
  border-radius: 50%;
  background: rgba(70,72,212,.06);
  filter: blur(18px);
  animation: rf7AuditPulse 5s ease-in-out infinite;
}

.rf7-audit-ai-icon {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  color: var(--audit-primary);
  background: #fff;
  border: 1px solid #ecebff;
  border-radius: 11px;
  box-shadow: 0 4px 12px rgba(35,37,45,.055);
}

.rf7-audit-ai-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: 1;
}

.rf7-audit-ai-heading {
  justify-content: space-between;
  gap: 14px;
}

.rf7-audit-ai-heading > div {
  min-width: 0;
}

.rf7-audit-ai-heading span {
  display: block;
  font-family: Geist, Inter, sans-serif;
  font-size: 14px;
  line-height: 20px;
  font-weight: 650;
}

.rf7-audit-ai-heading small {
  display: block;
  margin-top: 2px;
  color: #8a88a2;
  font-size: 9px;
  line-height: 13px;
}

.rf7-audit-ai-heading > svg {
  color: #7572df;
  animation: rf7AuditTwinkle 2.2s ease-in-out infinite;
}

.rf7-audit-ai-copy > p {
  max-width: 1010px;
  margin: 11px 0 0;
  color: #474957;
  font-size: 13px;
  line-height: 1.65;
}

.rf7-audit-text-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 0;
  color: #3f42cd;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 10px;
  font-weight: 650;
}

.rf7-audit-text-link:hover {
  color: #292cb0;
}

.rf7-audit-text-link svg {
  transition: transform 150ms ease;
}

.rf7-audit-text-link:hover svg {
  transform: translateX(3px);
}

.rf7-audit-findings-layout {
  display: grid;
  grid-template-columns: minmax(0, 2.05fr) minmax(270px, .78fr);
  gap: 30px;
  margin-top: 34px;
}

.rf7-audit-findings-list {
  display: grid;
  gap: 11px;
}

.rf7-audit-finding {
  position: relative;
  overflow: hidden;
  background: #fff;
  border: 1px solid #ececef;
  border-radius: 12px;
  box-shadow: 0 3px 10px rgba(20,24,31,.03);
  animation: rf7AuditCardIn 420ms cubic-bezier(.2,.72,.2,1) var(--rf7-audit-delay, 0ms) both;
  transition: box-shadow 180ms ease, border-color 180ms ease, transform 180ms ease;
}

.rf7-audit-finding:hover,
.rf7-audit-finding.expanded {
  border-color: #e1e2e7;
  box-shadow: 0 8px 21px rgba(20,24,31,.065);
}

.rf7-audit-finding-rail {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: var(--audit-primary);
}

.rf7-audit-finding.danger .rf7-audit-finding-rail { background: #dd2d2d; }
.rf7-audit-finding.warning .rf7-audit-finding-rail { background: #f59e0b; }
.rf7-audit-finding.success .rf7-audit-finding-rail { background: #10b981; }

.rf7-audit-finding-main {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  width: 100%;
  padding: 15px 14px 15px 16px;
  text-align: left;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.rf7-audit-finding-main > svg {
  margin-top: 8px;
  color: #9b9da5;
  transition: transform 180ms ease;
}

.rf7-audit-finding-main > svg.rotated,
.rf7-audit-wide-button svg.rotated,
.rf7-audit-evidence-toggle > svg.rotated {
  transform: rotate(180deg);
}

.rf7-audit-finding-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: #554fd0;
  background: #efefff;
  border-radius: 8px;
}

.rf7-audit-finding.danger .rf7-audit-finding-icon {
  color: #b62323;
  background: #ffe3e1;
}

.rf7-audit-finding.warning .rf7-audit-finding-icon {
  color: #c46a00;
  background: #fff0c9;
}

.rf7-audit-finding.success .rf7-audit-finding-icon {
  color: #087e5b;
  background: #dff8ee;
}

.rf7-audit-finding-copy {
  min-width: 0;
}

.rf7-audit-finding-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rf7-audit-finding-title-row b {
  overflow: hidden;
  color: #24262d;
  font-family: Geist, Inter, sans-serif;
  font-size: 12px;
  line-height: 17px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-audit-finding-title-row em {
  flex: 0 0 auto;
  padding: 3px 7px;
  color: #4f46e5;
  background: #efefff;
  border-radius: 5px;
  font-size: 8px;
  line-height: 11px;
  font-style: normal;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.rf7-audit-finding.danger .rf7-audit-finding-title-row em {
  color: #c12828;
  background: #fff0ef;
}

.rf7-audit-finding.warning .rf7-audit-finding-title-row em {
  color: #c76d00;
  background: #fff4df;
}

.rf7-audit-finding.success .rf7-audit-finding-title-row em {
  color: #087e5b;
  background: #e7f8f2;
}

.rf7-audit-finding-preview {
  display: -webkit-box;
  margin-top: 4px;
  overflow: hidden;
  color: #575a65;
  font-size: 10px;
  line-height: 15px;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.rf7-audit-finding-detail {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0 14px 14px 62px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f2;
  animation: rf7AuditExpand 210ms ease both;
}

.rf7-audit-finding-detail > div {
  min-width: 0;
  padding: 11px;
  background: #f8f9fa;
  border: 1px solid #f0f0f2;
  border-radius: 8px;
}

.rf7-audit-finding-detail > div.recommendation {
  background: #f3f2ff;
  border-color: #e8e6ff;
}

.rf7-audit-finding-detail span {
  color: #8a8d96;
  font-size: 8px;
  line-height: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .055em;
}

.rf7-audit-finding-detail p {
  margin: 5px 0 0;
  color: #525560;
  font-size: 9px;
  line-height: 14px;
}

.rf7-audit-recommendation-card {
  overflow: hidden;
  min-height: 338px;
  background: #fff;
  border: 1px solid #ececef;
  border-radius: 12px;
  box-shadow: 0 4px 13px rgba(20,24,31,.035);
  animation: rf7AuditCardIn 460ms cubic-bezier(.2,.72,.2,1) 240ms both;
}

.rf7-audit-rec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 43px;
  padding: 11px 13px;
  color: #595c67;
  background: #f5f6f7;
  border-bottom: 1px solid #ececef;
}

.rf7-audit-rec-head span {
  overflow: hidden;
  font-size: 9px;
  line-height: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .055em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-audit-rec-head svg {
  flex: 0 0 auto;
  color: #827ed2;
}

.rf7-audit-rec-visual {
  padding: 13px 13px 0;
}

.rf7-audit-rec-browser {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  height: 125px;
  overflow: hidden;
  padding: 22px 8px 8px;
  background: linear-gradient(145deg, #eef0f3, #dfe4e8);
  border: 1px solid #e1e3e6;
  border-radius: 8px;
}

.rf7-audit-rec-browser > span {
  position: absolute;
  top: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #c2c5ca;
}

.rf7-audit-rec-browser > span:nth-child(1) { left: 9px; }
.rf7-audit-rec-browser > span:nth-child(2) { left: 18px; }
.rf7-audit-rec-browser > span:nth-child(3) { left: 27px; }

.rf7-audit-rec-before,
.rf7-audit-rec-after {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow: hidden;
  padding: 9px 7px;
  background: rgba(255,255,255,.89);
  border: 1px solid rgba(255,255,255,.75);
  border-radius: 6px;
}

.rf7-audit-rec-before small,
.rf7-audit-rec-after small {
  margin-bottom: 2px;
  font-size: 6px;
  line-height: 8px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: .05em;
}

.rf7-audit-rec-before small { color: #d15a5a; }
.rf7-audit-rec-after small { color: #138766; }

.rf7-audit-rec-before i,
.rf7-audit-rec-after i {
  display: block;
  height: 5px;
  margin: 0;
  background: #d8dce1;
  border-radius: 999px;
}

.rf7-audit-rec-before i.short { width: 68%; }
.rf7-audit-rec-before b,
.rf7-audit-rec-after b,
.rf7-audit-rec-after em {
  display: block;
  height: 18px;
  margin-top: auto;
  border-radius: 4px;
}

.rf7-audit-rec-before b { background: #e7e8ea; }
.rf7-audit-rec-after b { background: #5355d8; }
.rf7-audit-rec-after em {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 25px;
  height: 7px;
  background: #dff5ed;
}

.rf7-audit-recommendation-card h3 {
  margin: 13px 13px 0;
  color: #24262d;
  font-family: Geist, Inter, sans-serif;
  font-size: 12px;
  line-height: 17px;
  font-weight: 650;
}

.rf7-audit-recommendation-card > p {
  margin: 6px 13px 0;
  color: #565965;
  font-size: 10px;
  line-height: 15px;
}

.rf7-audit-recommendation-card > button {
  display: block;
  width: calc(100% - 26px);
  min-height: 32px;
  margin: 14px 13px 13px;
  padding: 7px 10px;
  color: #30323a;
  background: #f0f1f2;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  font-size: 9px;
  font-weight: 650;
  transition: background 160ms ease, color 160ms ease;
}

.rf7-audit-recommendation-card > button:hover {
  color: var(--audit-primary);
  background: #e8e9eb;
}

.rf7-audit-recommendation-card.empty {
  display: flex;
  flex-direction: column;
  text-align: center;
}

.rf7-audit-rec-empty-icon {
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  margin: 30px auto 4px;
  color: #7773dc;
  background: #f1f0ff;
  border-radius: 18px;
}

.rf7-audit-details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 34px;
}

.rf7-audit-detail-card {
  min-width: 0;
  padding: 18px;
  background: #fff;
  border: 1px solid #ececef;
  border-radius: 12px;
  box-shadow: 0 3px 10px rgba(20,24,31,.025);
}

.rf7-audit-detail-card-head {
  gap: 11px;
}

.rf7-audit-detail-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 9px;
}

.rf7-audit-detail-icon.success {
  color: #07855f;
  background: #e5f8f1;
}

.rf7-audit-detail-icon.primary {
  color: #494bd6;
  background: #eeeeff;
}

.rf7-audit-detail-card-head span {
  display: block;
  color: #8b8e97;
  font-size: 8px;
  line-height: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .055em;
}

.rf7-audit-detail-card-head h2 {
  margin: 1px 0 0;
  font-family: Geist, Inter, sans-serif;
  font-size: 13px;
  line-height: 18px;
  font-weight: 650;
}

.rf7-audit-strength-list {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.rf7-audit-strength-list li {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 7px;
  align-items: start;
  color: #535661;
  font-size: 10px;
  line-height: 15px;
}

.rf7-audit-strength-list li svg {
  margin-top: 1px;
  color: #0a9f73;
}

.rf7-audit-muted-copy {
  margin: 13px 0 0;
  color: #666975;
  font-size: 10px;
  line-height: 15px;
}

.rf7-audit-wide-button {
  width: 100%;
  margin-top: 14px;
  color: #383a45;
  background: #f4f5f6;
  border-color: #ececef;
}

.rf7-audit-wide-button:hover {
  color: var(--audit-primary);
  background: #eeeeff;
  border-color: #e2e0ff;
}

.rf7-audit-wide-button svg:last-child {
  margin-left: auto;
  transition: transform 180ms ease;
}

.rf7-audit-outreach-kit {
  margin-top: 16px;
  overflow: hidden;
  padding: 20px;
  background: linear-gradient(150deg, #fff, #fbfbff);
  border: 1px solid #e9e8f7;
  border-radius: 13px;
  box-shadow: 0 5px 14px rgba(49,48,117,.035);
  animation: rf7AuditExpand 240ms ease both;
}

.rf7-audit-outreach-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.rf7-audit-outreach-heading > div > span {
  color: #706dbd;
  font-size: 8px;
  line-height: 12px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.rf7-audit-outreach-heading h2 {
  margin: 3px 0 0;
  font-family: Geist, Inter, sans-serif;
  font-size: 15px;
  line-height: 21px;
  font-weight: 650;
}

.rf7-audit-outreach-heading > svg {
  color: #6865d9;
}

.rf7-audit-outreach-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
  margin-top: 15px;
}

.rf7-audit-outreach-grid > article {
  min-width: 0;
  padding: 14px;
  background: #fff;
  border: 1px solid #ececef;
  border-radius: 10px;
}

.rf7-audit-outreach-title {
  gap: 9px;
}

.rf7-audit-outreach-title > span:first-child {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  border-radius: 8px;
}

.rf7-audit-outreach-title > span.phone {
  color: #4b4dd1;
  background: #eeeeff;
}

.rf7-audit-outreach-title > span.mail {
  color: #0b8a66;
  background: #e7f8f2;
}

.rf7-audit-outreach-title > div {
  min-width: 0;
  flex: 1;
}

.rf7-audit-outreach-title small {
  display: block;
  color: #92949d;
  font-size: 8px;
  line-height: 11px;
}

.rf7-audit-outreach-title b {
  display: block;
  margin-top: 1px;
  overflow: hidden;
  color: #30323a;
  font-size: 10px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-audit-copy-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 5px 7px;
  color: #6b6e79;
  background: #f4f5f6;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 8px;
  font-weight: 650;
}

.rf7-audit-copy-button:hover {
  color: var(--audit-primary);
  background: #eeeeff;
}

.rf7-audit-outreach-grid article > p,
.rf7-audit-outreach-grid article > pre {
  margin: 12px 0 0;
  color: #555864;
  font-family: Inter, sans-serif;
  font-size: 10px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.rf7-audit-evidence-section {
  margin-top: 17px;
}

.rf7-audit-evidence-toggle {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: center;
  width: 100%;
  padding: 13px 14px;
  color: inherit;
  text-align: left;
  background: #fff;
  border: 1px solid #ececef;
  border-radius: 11px;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(20,24,31,.025);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.rf7-audit-evidence-toggle:hover {
  border-color: #dedfe5;
  box-shadow: 0 7px 17px rgba(20,24,31,.05);
}

.rf7-audit-evidence-toggle-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  color: #5153d2;
  background: #eeeeff;
  border-radius: 9px;
}

.rf7-audit-evidence-toggle b,
.rf7-audit-evidence-toggle small {
  display: block;
}

.rf7-audit-evidence-toggle b {
  color: #30323a;
  font-family: Geist, Inter, sans-serif;
  font-size: 11px;
  line-height: 15px;
  font-weight: 650;
}

.rf7-audit-evidence-toggle small {
  margin-top: 2px;
  color: #8a8d96;
  font-size: 9px;
  line-height: 13px;
}

.rf7-audit-evidence-toggle > svg {
  color: #8e9099;
  transition: transform 180ms ease;
}

.rf7-audit-evidence-content {
  margin-top: 10px;
  padding: 17px;
  background: #fff;
  border: 1px solid #ececef;
  border-radius: 11px;
  animation: rf7AuditExpand 230ms ease both;
}

.rf7-audit-evidence-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.rf7-audit-review-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #ececef;
  border-radius: 9px;
}

.rf7-audit-review-head {
  justify-content: space-between;
  gap: 10px;
  padding: 10px 11px;
  background: #f5f6f7;
  border-bottom: 1px solid #ececef;
}

.rf7-audit-review-head span {
  color: #4b4e59;
  font-size: 9px;
  line-height: 13px;
  font-weight: 700;
}

.rf7-audit-review-head em {
  color: #9698a1;
  font-size: 8px;
  line-height: 11px;
  font-style: normal;
}

.rf7-audit-review-list {
  display: grid;
}

.rf7-audit-review-list > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 3px 7px;
  align-items: center;
  padding: 10px 11px;
  border-bottom: 1px solid #f0f0f2;
}

.rf7-audit-review-list > div:last-child {
  border-bottom: 0;
}

.rf7-audit-review-status {
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 7px;
  line-height: 10px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: .035em;
}

.rf7-audit-review-status.success {
  color: #087e5b;
  background: #e6f8f1;
}

.rf7-audit-review-status.warning {
  color: #b96a08;
  background: #fff2dd;
}

.rf7-audit-review-status.danger {
  color: #ba2e2e;
  background: #ffebea;
}

.rf7-audit-review-list b {
  min-width: 0;
  overflow: hidden;
  color: #393b44;
  font-size: 9px;
  line-height: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-audit-review-list p {
  grid-column: 1 / -1;
  margin: 3px 0 0;
  color: #6b6e78;
  font-size: 8px;
  line-height: 12px;
}

.rf7-audit-review-empty {
  margin: 0;
  padding: 18px 11px;
  color: #94969e;
  font-size: 9px;
  line-height: 14px;
  text-align: center;
}

.rf7-audit-competitor-summary,
.rf7-audit-benchmark-box {
  margin-top: 12px;
  padding: 13px;
  background: #f8f9fa;
  border: 1px solid #eff0f2;
  border-radius: 9px;
}

.rf7-audit-competitor-summary > div,
.rf7-audit-benchmark-box > div {
  gap: 7px;
  color: #4f51c9;
}

.rf7-audit-competitor-summary > div span,
.rf7-audit-benchmark-box > div span {
  color: #41434d;
  font-size: 9px;
  line-height: 13px;
  font-weight: 700;
}

.rf7-audit-competitor-summary p,
.rf7-audit-benchmark-box p {
  margin: 7px 0 0;
  color: #626570;
  font-size: 9px;
  line-height: 14px;
  word-break: break-word;
}

.rf7-audit-roadmap-wrap {
  margin-top: 16px;
}

.rf7-audit-subheading span {
  display: block;
  color: #383a43;
  font-family: Geist, Inter, sans-serif;
  font-size: 11px;
  line-height: 15px;
  font-weight: 650;
}

.rf7-audit-subheading small {
  display: block;
  margin-top: 2px;
  color: #92949d;
  font-size: 8px;
}

.rf7-audit-roadmap {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 11px;
  margin-top: 11px;
}

.rf7-audit-roadmap article {
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr);
  gap: 9px;
  min-width: 0;
  padding: 12px;
  background: #fff;
  border: 1px solid #ececef;
  border-radius: 9px;
}

.rf7-audit-roadmap-number {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  color: #fff;
  background: #5153d4;
  border-radius: 7px;
  font-size: 9px;
  font-weight: 750;
}

.rf7-audit-roadmap article small {
  color: #817eb2;
  font-size: 7px;
  line-height: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.rf7-audit-roadmap article h3 {
  margin: 2px 0 0;
  color: #383a43;
  font-size: 10px;
  line-height: 14px;
}

.rf7-audit-roadmap article ul {
  display: grid;
  gap: 5px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.rf7-audit-roadmap article li {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 4px;
  color: #676a75;
  font-size: 8px;
  line-height: 12px;
}

.rf7-audit-roadmap article li svg {
  color: #0a9f73;
}

.rf7-audit-disclaimer {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 17px;
  padding: 11px 13px;
  color: #6e717b;
  background: #f3f4f5;
  border: 1px solid #e9eaec;
  border-radius: 9px;
}

.rf7-audit-disclaimer svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #777a85;
}

.rf7-audit-disclaimer p {
  margin: 0;
  font-size: 8px;
  line-height: 13px;
}

.rf7-audit-no-findings {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 18px;
  color: #0b7f5f;
  background: #f0faf6;
  border: 1px solid #dff4eb;
  border-radius: 11px;
}

.rf7-audit-no-findings div {
  min-width: 0;
}

.rf7-audit-no-findings b {
  color: #2c4039;
  font-size: 10px;
}

.rf7-audit-no-findings p {
  margin: 4px 0 0;
  color: #61736c;
  font-size: 9px;
  line-height: 14px;
}

/* Inline animated state message */
.rf7-audit-inline-notice {
  position: sticky;
  z-index: 20;
  top: 70px;
  gap: 9px;
  overflow: hidden;
  width: min(620px, calc(100% - 24px));
  margin: 12px auto -2px;
  padding: 11px 39px 11px 11px;
  color: #2f323a;
  background: rgba(255,255,255,.97);
  border: 1px solid #e5e6e9;
  border-left: 3px solid #5b5ddb;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(25,28,35,.10);
  backdrop-filter: blur(12px);
  animation: rf7AuditNoticeIn 260ms cubic-bezier(.2,.8,.2,1) both;
}

.rf7-audit-inline-notice.success { border-left-color: #10a879; }
.rf7-audit-inline-notice.error { border-left-color: #d43d3d; }

.rf7-audit-inline-notice > span {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  color: #5153d4;
  background: #eeeeff;
  border-radius: 8px;
}

.rf7-audit-inline-notice.success > span {
  color: #087e5b;
  background: #e5f8f1;
}

.rf7-audit-inline-notice.error > span {
  color: #b92b2b;
  background: #ffebea;
}

.rf7-audit-inline-notice > div {
  min-width: 0;
  flex: 1;
}

.rf7-audit-inline-notice b {
  display: block;
  font-size: 10px;
  line-height: 14px;
}

.rf7-audit-inline-notice p {
  margin: 2px 0 0;
  color: #6b6e78;
  font-size: 9px;
  line-height: 13px;
}

.rf7-audit-inline-notice > button {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  color: #868892;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.rf7-audit-inline-notice > button:hover {
  color: #34363e;
  background: #f2f3f4;
}

.rf7-audit-inline-notice > i {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: #5b5ddb;
  transform-origin: left;
  animation: rf7AuditNoticeProgress 5.2s linear both;
}

.rf7-audit-inline-notice.success > i { background: #10a879; }
.rf7-audit-inline-notice.error > i { background: #d43d3d; }

/* Modal + drawers */
.rf7-audit-overlay,
.rf7-audit-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 160;
  display: grid;
  padding: 18px;
  background: rgba(18,20,27,.45);
  backdrop-filter: blur(5px);
  animation: rf7AuditOverlayIn 180ms ease both;
}

.rf7-audit-overlay {
  place-items: center;
}

.rf7-audit-modal {
  width: min(760px, 100%);
  max-height: calc(100vh - 36px);
  overflow: auto;
  background: #fff;
  border: 1px solid rgba(255,255,255,.8);
  border-radius: 15px;
  box-shadow: 0 24px 70px rgba(17,20,29,.24);
  animation: rf7AuditModalIn 260ms cubic-bezier(.18,.78,.22,1) both;
}

.rf7-audit-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22px;
  padding: 22px 22px 17px;
  border-bottom: 1px solid #ececef;
}

.rf7-audit-modal-kicker {
  gap: 5px;
  width: max-content;
  margin-bottom: 7px;
  padding: 4px 7px;
  color: #494bd6;
  background: #eeeeff;
  border-radius: 999px;
  font-size: 8px;
  line-height: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .055em;
}

.rf7-audit-modal-head h2,
.rf7-audit-history-head h2,
.rf7-audit-confirm-dialog h2 {
  margin: 0;
  font-family: Geist, Inter, sans-serif;
  color: #212329;
  font-weight: 650;
  letter-spacing: -.025em;
}

.rf7-audit-modal-head h2 {
  font-size: 20px;
  line-height: 27px;
}

.rf7-audit-modal-head p {
  max-width: 590px;
  margin: 6px 0 0;
  color: #686b76;
  font-size: 10px;
  line-height: 15px;
}

.rf7-audit-icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  color: #777a84;
  background: #f4f5f6;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
}

.rf7-audit-icon-button:hover:not(:disabled) {
  color: #31333a;
  background: #e9eaec;
  transform: rotate(3deg);
}

.rf7-audit-form-v7 {
  padding: 18px 22px 22px;
}

.rf7-audit-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.rf7-audit-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.rf7-audit-field.full {
  margin-bottom: 12px;
}

.rf7-audit-form-grid + .rf7-audit-field.full {
  margin-top: 12px;
}

.rf7-audit-field > span {
  color: #555862;
  font-size: 9px;
  line-height: 13px;
  font-weight: 650;
}

.rf7-audit-field input,
.rf7-audit-field textarea,
.rf7-audit-input-wrap {
  width: 100%;
  color: #2f323a;
  background: #fff;
  border: 1px solid #dddee3;
  border-radius: 8px;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.rf7-audit-field input {
  min-height: 38px;
  padding: 8px 10px;
  font-size: 10px;
}

.rf7-audit-field textarea {
  resize: vertical;
  min-height: 78px;
  padding: 9px 10px;
  font-size: 10px;
  line-height: 15px;
}

.rf7-audit-input-wrap {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 10px;
}

.rf7-audit-input-wrap > svg {
  flex: 0 0 auto;
  color: #8b8d96;
}

.rf7-audit-input-wrap input {
  min-width: 0;
  flex: 1;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none !important;
}

.rf7-audit-field input:focus,
.rf7-audit-field textarea:focus,
.rf7-audit-input-wrap:focus-within {
  border-color: #7778e0;
  box-shadow: 0 0 0 3px rgba(70,72,212,.09);
}

.rf7-audit-field input:disabled,
.rf7-audit-field textarea:disabled {
  color: #777a84;
  background: #f6f7f8;
}

.rf7-audit-field input::placeholder,
.rf7-audit-field textarea::placeholder {
  color: #aaacb3;
}

.rf7-audit-create-progress {
  margin-top: 14px;
  padding: 13px;
  background: #f7f7ff;
  border: 1px solid #e9e8ff;
  border-radius: 10px;
}

.rf7-audit-create-progress-head {
  justify-content: space-between;
  gap: 12px;
}

.rf7-audit-create-progress-head span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #494bd6;
  font-size: 9px;
  font-weight: 700;
}

.rf7-audit-create-progress-head small {
  color: #9693b0;
  font-size: 8px;
}

.rf7-audit-create-steps {
  display: grid;
  gap: 8px;
  margin-top: 11px;
}

.rf7-audit-create-steps > div {
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  opacity: .42;
  transition: opacity 220ms ease, transform 220ms ease;
}

.rf7-audit-create-steps > div.active,
.rf7-audit-create-steps > div.complete {
  opacity: 1;
}

.rf7-audit-create-steps > div.active {
  transform: translateX(2px);
}

.rf7-audit-create-steps > div > span {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  color: #73758a;
  background: #fff;
  border: 1px solid #deddf4;
  border-radius: 7px;
  font-size: 8px;
  font-weight: 750;
}

.rf7-audit-create-steps > div.active > span {
  color: #fff;
  background: #5153d4;
  border-color: #5153d4;
}

.rf7-audit-create-steps > div.complete > span {
  color: #087e5b;
  background: #e5f8f1;
  border-color: #d6f1e7;
}

.rf7-audit-create-steps b,
.rf7-audit-create-steps small {
  display: block;
}

.rf7-audit-create-steps b {
  color: #474955;
  font-size: 9px;
  line-height: 13px;
}

.rf7-audit-create-steps small {
  margin-top: 1px;
  color: #8b8d98;
  font-size: 8px;
  line-height: 12px;
}

.rf7-audit-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 17px;
  padding-top: 15px;
  border-top: 1px solid #eff0f2;
}

.rf7-audit-drawer-overlay {
  place-items: stretch end;
  padding: 0;
}

.rf7-audit-history-drawer {
  display: flex;
  flex-direction: column;
  width: min(410px, 100vw);
  height: 100%;
  padding: 18px;
  background: #fff;
  box-shadow: -18px 0 50px rgba(15,18,25,.18);
  animation: rf7AuditDrawerIn 260ms cubic-bezier(.18,.78,.22,1) both;
}

.rf7-audit-history-head {
  justify-content: space-between;
  gap: 12px;
}

.rf7-audit-history-head > div > span {
  color: #8b8d96;
  font-size: 8px;
  line-height: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .055em;
}

.rf7-audit-history-head h2 {
  margin-top: 2px;
  font-size: 18px;
  line-height: 24px;
}

.rf7-audit-new-history {
  width: 100%;
  margin-top: 15px;
}

.rf7-audit-history-search {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  margin-top: 12px;
  padding: 0 10px;
  color: #8b8e98;
  background: #f6f7f8;
  border: 1px solid #ececef;
  border-radius: 8px;
}

.rf7-audit-history-search input {
  min-width: 0;
  flex: 1;
  padding: 0;
  color: #34363e;
  background: transparent;
  border: 0;
  outline: none;
  font-size: 10px;
}

.rf7-audit-history-list {
  display: grid;
  align-content: start;
  gap: 8px;
  overflow: auto;
  min-height: 0;
  margin-top: 13px;
  padding-right: 2px;
}

.rf7-audit-history-row {
  position: relative;
  overflow: hidden;
  background: #fff;
  border: 1px solid #ececef;
  border-radius: 9px;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.rf7-audit-history-row:hover {
  transform: translateX(-2px);
  border-color: #dfe0e5;
}

.rf7-audit-history-row.active {
  background: #f7f7ff;
  border-color: #dcdcff;
}

.rf7-audit-history-row > button:first-child {
  display: grid;
  grid-template-columns: 37px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  width: 100%;
  min-height: 67px;
  padding: 9px 38px 9px 9px;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.rf7-audit-history-score {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  color: #4c4ecf;
  background: #eeeeff;
  border-radius: 10px;
  font-family: Geist, Inter, sans-serif;
  font-size: 12px;
  font-weight: 700;
}

.rf7-audit-history-copy {
  min-width: 0;
}

.rf7-audit-history-copy b,
.rf7-audit-history-copy small,
.rf7-audit-history-copy em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-audit-history-copy b {
  color: #33353d;
  font-size: 10px;
  line-height: 14px;
}

.rf7-audit-history-copy small {
  margin-top: 1px;
  color: #787b85;
  font-size: 8px;
  line-height: 11px;
}

.rf7-audit-history-copy em {
  margin-top: 2px;
  color: #a0a2aa;
  font-size: 7px;
  line-height: 10px;
  font-style: normal;
}

.rf7-audit-history-row > button:first-child > svg {
  color: #8f919a;
}

.rf7-audit-history-row.active > button:first-child > svg {
  color: #5658d6;
}

.rf7-audit-history-delete {
  position: absolute;
  top: 20px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  color: #a0a2aa;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 160ms ease, color 160ms ease, background 160ms ease;
}

.rf7-audit-history-row:hover .rf7-audit-history-delete,
.rf7-audit-history-row:focus-within .rf7-audit-history-delete {
  opacity: 1;
}

.rf7-audit-history-delete:hover {
  color: #c42b2b;
  background: #ffebea;
}

.rf7-audit-history-empty {
  display: grid;
  place-items: center;
  padding: 42px 20px;
  color: #9a9ca4;
  text-align: center;
}

.rf7-audit-history-empty b {
  margin-top: 9px;
  color: #474a53;
  font-size: 10px;
}

.rf7-audit-history-empty p {
  max-width: 240px;
  margin: 4px 0 0;
  font-size: 9px;
  line-height: 14px;
}

.rf7-audit-confirm-dialog {
  width: min(410px, 100%);
  padding: 22px;
  text-align: center;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 70px rgba(17,20,29,.24);
  animation: rf7AuditModalIn 240ms cubic-bezier(.18,.78,.22,1) both;
}

.rf7-audit-confirm-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  color: #bd2a2a;
  background: #ffebea;
  border-radius: 12px;
}

.rf7-audit-confirm-dialog h2 {
  font-size: 18px;
  line-height: 24px;
}

.rf7-audit-confirm-dialog > p {
  margin: 7px auto 0;
  color: #686b75;
  font-size: 10px;
  line-height: 15px;
}

.rf7-audit-confirm-dialog > div:last-child {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 17px;
}

/* Empty + skeleton */
.rf7-audit-empty-page {
  display: grid;
  place-items: center;
  max-width: 720px;
  min-height: 610px;
  margin: 0 auto;
  padding: 65px 24px;
  text-align: center;
}

.rf7-audit-empty-art {
  position: relative;
  display: grid;
  place-items: center;
  width: 126px;
  height: 126px;
  margin-bottom: 20px;
}

.rf7-audit-empty-art > span {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  color: #4c4ed1;
  background: #fff;
  border: 1px solid #e5e4ff;
  border-radius: 17px;
  box-shadow: 0 12px 30px rgba(70,72,212,.13);
}

.rf7-audit-empty-ring {
  position: absolute;
  border: 1px solid #dcdbff;
  border-radius: 50%;
  animation: rf7AuditEmptyPulse 3s ease-in-out infinite;
}

.rf7-audit-empty-ring.one { inset: 19px; }
.rf7-audit-empty-ring.two { inset: 2px; animation-delay: .6s; }

.rf7-audit-empty-kicker {
  color: #5557d4;
  font-size: 9px;
  line-height: 13px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: .07em;
}

.rf7-audit-empty-page h1 {
  max-width: 630px;
  margin: 8px 0 0;
  font-family: Geist, Inter, sans-serif;
  font-size: clamp(26px, 3vw, 38px);
  line-height: 1.13;
  letter-spacing: -.035em;
  font-weight: 650;
}

.rf7-audit-empty-page > p {
  max-width: 570px;
  margin: 12px 0 0;
  color: #656873;
  font-size: 12px;
  line-height: 18px;
}

.rf7-audit-empty-page > div:last-child {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.rf7-audit-skeleton {
  padding-top: 25px;
}

.rf7-audit-skeleton-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  min-height: 175px;
  margin: -25px -28px 0;
  padding: 34px 30px;
  background: #fff;
  border-bottom: 1px solid #ececef;
}

.rf7-audit-skeleton-hero > div:first-child {
  display: grid;
  gap: 10px;
  width: min(720px, 70%);
}

.rf7-audit-skeleton i,
.rf7-audit-skeleton-score,
.rf7-audit-skeleton-label,
.rf7-audit-skeleton-metrics > div,
.rf7-audit-skeleton-insight,
.rf7-audit-skeleton-lower i,
.rf7-audit-skeleton-lower aside {
  position: relative;
  overflow: hidden;
  display: block;
  background: #e9eaec;
  border-radius: 8px;
}

.rf7-audit-skeleton i::after,
.rf7-audit-skeleton-score::after,
.rf7-audit-skeleton-label::after,
.rf7-audit-skeleton-metrics > div::after,
.rf7-audit-skeleton-insight::after,
.rf7-audit-skeleton-lower i::after,
.rf7-audit-skeleton-lower aside::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 15%, rgba(255,255,255,.72) 48%, transparent 82%);
  transform: translateX(-100%);
  animation: rf7AuditShimmer 1.35s linear infinite;
}

.rf7-audit-skeleton-hero i { height: 14px; }
.rf7-audit-skeleton-hero i.w28 { width: 28%; height: 22px; }
.rf7-audit-skeleton-hero i.w58 { width: 58%; }
.rf7-audit-skeleton-hero i.h36 { height: 34px; }
.rf7-audit-skeleton-hero i.w72 { width: 72%; }
.rf7-audit-skeleton-hero i.w49 { width: 49%; }
.rf7-audit-skeleton-score { width: 86px; height: 86px; border-radius: 50%; }
.rf7-audit-skeleton-label { width: 135px; height: 22px; margin-top: 29px; }

.rf7-audit-skeleton-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 18px;
  margin-top: 14px;
}

.rf7-audit-skeleton-metrics > div { height: 145px; border-radius: 13px; }
.rf7-audit-skeleton-insight { height: 154px; margin-top: 34px; border-radius: 15px; }

.rf7-audit-skeleton-lower {
  display: grid;
  grid-template-columns: minmax(0,2fr) minmax(270px,.8fr);
  gap: 30px;
  margin-top: 34px;
}

.rf7-audit-skeleton-lower > div {
  display: grid;
  gap: 11px;
}

.rf7-audit-skeleton-lower i { height: 76px; border-radius: 11px; }
.rf7-audit-skeleton-lower aside { height: 330px; border-radius: 11px; }

.spin {
  animation: rf7AuditSpin .85s linear infinite !important;
}

/* Animations */
@keyframes rf7AuditHeroIn {
  from { opacity: 0; transform: translateY(-9px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes rf7AuditCardIn {
  from { opacity: 0; transform: translateY(12px) scale(.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes rf7AuditRingDraw {
  from { stroke-dasharray: 0 101; }
}

@keyframes rf7AuditPulse {
  0%,100% { transform: scale(.92); opacity: .65; }
  50% { transform: scale(1.07); opacity: 1; }
}

@keyframes rf7AuditTwinkle {
  0%,100% { transform: rotate(-4deg) scale(.92); opacity: .62; }
  50% { transform: rotate(5deg) scale(1.08); opacity: 1; }
}

@keyframes rf7AuditExpand {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes rf7AuditNoticeIn {
  from { opacity: 0; transform: translateY(-8px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes rf7AuditNoticeProgress {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

@keyframes rf7AuditOverlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes rf7AuditModalIn {
  from { opacity: 0; transform: translateY(14px) scale(.975); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes rf7AuditDrawerIn {
  from { transform: translateX(100%); opacity: .75; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes rf7AuditShimmer {
  to { transform: translateX(100%); }
}

@keyframes rf7AuditEmptyPulse {
  0%,100% { transform: scale(.96); opacity: .55; }
  50% { transform: scale(1.04); opacity: 1; }
}

@keyframes rf7AuditSpin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 1180px) {
  .rf7-audit-metric-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .rf7-audit-evidence-grid { grid-template-columns: 1fr 1fr; }
  .rf7-audit-roadmap { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 980px) {
  .rf7-audit-hero {
    grid-template-columns: 1fr;
    gap: 22px;
  }
  .rf7-audit-hero-side {
    grid-template-columns: auto minmax(0,1fr);
    align-items: center;
    justify-items: start;
    width: 100%;
  }
  .rf7-audit-health { justify-content: flex-start; }
  .rf7-audit-health-copy { text-align: left; }
  .rf7-audit-health-copy > div { justify-content: flex-start; }
  .rf7-audit-hero-actions { justify-self: end; }
  .rf7-audit-hero-tools { grid-column: 1 / -1; }
  .rf7-audit-findings-layout { grid-template-columns: 1fr; }
  .rf7-audit-recommendation-card { min-height: 0; }
  .rf7-audit-rec-visual { max-width: 430px; }
  .rf7-audit-finding-detail { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .rf7-audit-page { padding-bottom: 88px; }
  .rf7-audit-hero {
    margin-right: -16px;
    margin-left: -16px;
    padding: 28px 18px 25px;
  }
  .rf7-audit-hero-side { grid-template-columns: 1fr; }
  .rf7-audit-hero-actions { justify-self: stretch; width: 100%; }
  .rf7-audit-hero-actions button { flex: 1; }
  .rf7-audit-hero-tools { overflow-x: auto; width: 100%; padding-bottom: 2px; }
  .rf7-audit-hero-tools button { white-space: nowrap; }
  .rf7-audit-metric-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
  .rf7-audit-metric-card { padding: 16px; }
  .rf7-audit-ai-insight { padding: 21px 18px; gap: 14px; }
  .rf7-audit-ai-icon { width: 44px; height: 44px; flex-basis: 44px; }
  .rf7-audit-details-grid,
  .rf7-audit-outreach-grid,
  .rf7-audit-evidence-grid,
  .rf7-audit-roadmap { grid-template-columns: 1fr; }
  .rf7-audit-form-grid { grid-template-columns: 1fr; }
  .rf7-audit-modal { max-height: calc(100vh - 20px); }
  .rf7-audit-overlay { padding: 10px; }
  .rf7-audit-modal-head { padding: 18px 17px 14px; }
  .rf7-audit-form-v7 { padding: 15px 17px 18px; }
  .rf7-audit-skeleton-hero { margin-right: -16px; margin-left: -16px; }
  .rf7-audit-skeleton-metrics { grid-template-columns: 1fr 1fr; }
  .rf7-audit-skeleton-lower { grid-template-columns: 1fr; }
}

@media (max-width: 520px) {
  .rf7-audit-hero h1 { font-size: 26px; }
  .rf7-audit-hero-main > p { font-size: 12px; }
  .rf7-audit-health { width: 100%; justify-content: space-between; }
  .rf7-audit-metric-grid { grid-template-columns: 1fr; }
  .rf7-audit-metric-card { min-height: 128px; }
  .rf7-audit-ai-insight { flex-direction: column; }
  .rf7-audit-findings-layout { gap: 22px; }
  .rf7-audit-finding-main { grid-template-columns: 32px minmax(0,1fr) auto; gap: 9px; padding-right: 10px; }
  .rf7-audit-finding-title-row { align-items: flex-start; flex-direction: column; gap: 5px; }
  .rf7-audit-finding-title-row b { white-space: normal; }
  .rf7-audit-finding-detail { margin-left: 51px; }
  .rf7-audit-evidence-toggle { grid-template-columns: 34px minmax(0,1fr) auto; padding: 11px; }
  .rf7-audit-evidence-toggle-icon { width: 34px; height: 34px; }
  .rf7-audit-create-progress-head { align-items: flex-start; flex-direction: column; gap: 3px; }
  .rf7-audit-modal-actions { flex-direction: column-reverse; }
  .rf7-audit-modal-actions button { width: 100%; }
  .rf7-audit-history-drawer { width: 100vw; }
  .rf7-audit-inline-notice { top: 62px; width: calc(100% - 16px); }
  .rf7-audit-skeleton-metrics { grid-template-columns: 1fr; }
}

/* Print / PDF */
@media print {
  body * { visibility: hidden !important; }
  .rf7-audit-page,
  .rf7-audit-page * { visibility: visible !important; }
  .rf7-audit-page {
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    padding: 0 !important;
    background: #fff !important;
  }
  .rf7-audit-hero {
    margin: 0 !important;
    padding: 20px 0 18px !important;
    border-bottom: 1px solid #ddd !important;
  }
  .rf7-audit-hero-actions,
  .rf7-audit-hero-tools,
  .rf7-audit-inline-notice,
  .rf7-audit-wide-button,
  .rf7-audit-copy-button,
  .rf7-audit-recommendation-card > button,
  .rf7-audit-evidence-toggle > svg { display: none !important; }
  .rf7-audit-evidence-content { display: block !important; }
  .rf7-audit-metric-card,
  .rf7-audit-finding,
  .rf7-audit-recommendation-card,
  .rf7-audit-ai-insight,
  .rf7-audit-detail-card,
  .rf7-audit-evidence-content {
    break-inside: avoid;
    box-shadow: none !important;
  }
  .rf7-audit-finding-detail { display: grid !important; }
}

@media (prefers-reduced-motion: reduce) {
  .rf7-audit-page *,
  .rf7-audit-page *::before,
  .rf7-audit-page *::after,
  .rf7-audit-overlay *,
  .rf7-audit-drawer-overlay * {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .001ms !important;
  }
}
`;
