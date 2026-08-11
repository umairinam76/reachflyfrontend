import {
  useMemo,
  useState,
} from "react";

const AUDIT_PENDING_STATUSES = new Set([
  "queued",
  "pending",
  "processing",
  "running",
  "generating",
]);

const AUDIT_FAILED_STATUSES = new Set([
  "failed",
  "error",
  "cancelled",
]);

export default function MiniAuditPanel({
  lead,
  audit,
  status,
  generating = false,
  generatingFullAudit = false,
  generatingCompetitorAnalysis = false,
  onGenerateMiniAudit,
  onGenerateFullAudit,
  onGenerateCompetitorAnalysis,
}) {
  const [expandedIssue, setExpandedIssue] =
    useState("");

  const normalizedStatus = normalizeStatus(
    status ||
      audit?.status ||
      lead?.miniAuditStatus ||
      ""
  );

  const auditReady = Boolean(
    audit &&
      !AUDIT_PENDING_STATUSES.has(
        normalizedStatus
      ) &&
      !AUDIT_FAILED_STATUSES.has(
        normalizedStatus
      )
  );

  const auditPending =
    generating ||
    AUDIT_PENDING_STATUSES.has(
      normalizedStatus
    );

  const auditFailed =
    AUDIT_FAILED_STATUSES.has(
      normalizedStatus
    );

  const report = useMemo(
    () =>
      normalizeMiniAudit({
        audit,
        lead,
      }),
    [audit, lead]
  );

  const campaignType = normalizeCampaignType(
    audit?.track ||
      audit?.campaignType ||
      lead?.auditTrack ||
      lead?.dailyCampaignType ||
      lead?.campaignType ||
      lead?.auditCampaignType ||
      "website"
  );

  const canGenerate = Boolean(
    lead?.website ||
      (campaignType === "gmb" &&
        (lead?.id ||
          lead?.business ||
          lead?.name ||
          lead?.placeId ||
          lead?.address))
  );

  if (!canGenerate) {
    return (
      <section className="rf-mini-audit-panel">
        <AuditPanelHeader
          report={report}
          status="unavailable"
          campaignType={campaignType}
        />

        <AuditEmptyState
          icon="WEB"
          title="Lead evidence required"
          description="Website campaigns require a public website. GMB campaigns can generate the Mini Audit from the business/profile identity even when no website is available."
        />
      </section>
    );
  }

  if (auditPending) {
    return (
      <section className="rf-mini-audit-panel">
        <AuditPanelHeader
          report={report}
          status="processing"
          campaignType={campaignType}
        />

        <AuditProgressState
          lead={lead}
          campaignType={campaignType}
        />

        <AuditActionGrid
          campaignType={campaignType}
          auditReady={false}
          generating={generating}
          generatingFullAudit={
            generatingFullAudit
          }
          generatingCompetitorAnalysis={
            generatingCompetitorAnalysis
          }
          onGenerateMiniAudit={
            onGenerateMiniAudit
          }
          onGenerateFullAudit={
            onGenerateFullAudit
          }
          onGenerateCompetitorAnalysis={
            onGenerateCompetitorAnalysis
          }
        />
      </section>
    );
  }

  if (auditFailed) {
    return (
      <section className="rf-mini-audit-panel">
        <AuditPanelHeader
          report={report}
          status="failed"
        />

        <AuditEmptyState
          icon="!"
          title="Mini audit could not be completed"
          description={
            audit?.error ||
            audit?.message ||
            lead?.miniAuditError ||
            (campaignType === "gmb"
              ? "The public GMB/local evidence could not be reviewed. Retry the report or verify the business identity and location."
              : "The website could not be reviewed. Retry the report or confirm that the website is publicly accessible.")
          }
        />

        <AuditActionGrid
          campaignType={campaignType}
          auditReady={false}
          generating={generating}
          generatingFullAudit={
            generatingFullAudit
          }
          generatingCompetitorAnalysis={
            generatingCompetitorAnalysis
          }
          onGenerateMiniAudit={
            onGenerateMiniAudit
          }
          onGenerateFullAudit={
            onGenerateFullAudit
          }
          onGenerateCompetitorAnalysis={
            onGenerateCompetitorAnalysis
          }
        />
      </section>
    );
  }

  if (!auditReady) {
    return (
      <section className="rf-mini-audit-panel">
        <AuditPanelHeader
          report={report}
          status="not_started"
        />

        <AuditEmptyState
          icon="MA"
          title="Mini audit not generated"
          description={
            campaignType === "gmb"
              ? "ReachFly generates the same one-page Mini Audit before calling, using verified public GMB/local evidence. No manager upload is required."
              : "ReachFly generates the same one-page Mini Audit before calling, using verified public website and search evidence. No manager upload is required."
          }
        />

        <AuditActionGrid
          campaignType={campaignType}
          auditReady={false}
          generating={generating}
          generatingFullAudit={
            generatingFullAudit
          }
          generatingCompetitorAnalysis={
            generatingCompetitorAnalysis
          }
          onGenerateMiniAudit={
            onGenerateMiniAudit
          }
          onGenerateFullAudit={
            onGenerateFullAudit
          }
          onGenerateCompetitorAnalysis={
            onGenerateCompetitorAnalysis
          }
        />
      </section>
    );
  }

  return (
    <section className="rf-mini-audit-panel">
      <AuditPanelHeader
        report={report}
        status="completed"
        campaignType={campaignType}
      />

      <AuditReportBanner
        report={report}
      />

      <AuditCallHook report={report} />

      <BusinessSnapshot
        snapshot={report.snapshot}
      />

      <IssuesList
        issues={report.issues}
        noMajorIssues={report.noMajorIssues}
        workingWell={report.workingWell}
        expandedIssue={expandedIssue}
        onToggleIssue={(issueId) =>
          setExpandedIssue(
            (current) =>
              current === issueId
                ? ""
                : issueId
          )
        }
      />

      <AuditSourceFooter
        report={report}
      />

      <AuditDownloadActions
        report={report}
        lead={lead}
      />

      <AuditActionGrid
        campaignType={campaignType}
        auditReady
        generating={generating}
        generatingFullAudit={
          generatingFullAudit
        }
        generatingCompetitorAnalysis={
          generatingCompetitorAnalysis
        }
        onGenerateMiniAudit={
          onGenerateMiniAudit
        }
        onGenerateFullAudit={
          onGenerateFullAudit
        }
        onGenerateCompetitorAnalysis={
          onGenerateCompetitorAnalysis
        }
      />
    </section>
  );
}

function AuditPanelHeader({
  report,
  status,
  campaignType = "website",
}) {
  const trackLabel = campaignType === "gmb" ? "GMB" : "Website";
  return (
    <header className="rf-mini-audit-panel__header">
      <div>
        <p className="rf-mini-audit-eyebrow">
          Default pre-call intelligence · {trackLabel} track
        </p>

        <h2>{trackLabel} Mini Audit</h2>

        <p>
          Verified {campaignType === "gmb" ? "Google Business Profile / local" : "website"} findings only. Website and GMB scores are never blended.
        </p>
      </div>

      <AuditStatusBadge
        status={status}
        generatedAt={report.generatedAt}
      />
    </header>
  );
}

function AuditStatusBadge({
  status,
  generatedAt,
}) {
  const normalized =
    normalizeStatus(status);

  let label = "Not generated";

  if (normalized === "completed") {
    label = "Report ready";
  }

  if (normalized === "processing") {
    label = "Generating";
  }

  if (normalized === "failed") {
    label = "Needs attention";
  }

  if (normalized === "unavailable") {
    label = "Unavailable";
  }

  return (
    <div
      className={`rf-mini-audit-status rf-mini-audit-status--${normalized}`}
    >
      <span />

      <div>
        <strong>{label}</strong>

        {generatedAt &&
        normalized === "completed" ? (
          <small>
            {formatDateTime(
              generatedAt
            )}
          </small>
        ) : null}
      </div>
    </div>
  );
}

function AuditReportBanner({
  report,
}) {
  return (
    <section className="rf-mini-audit-banner">
      <div className="rf-mini-audit-banner__brand">
        <span>
          {getInitials(
            report.workspaceName
          )}
        </span>

        <div>
          <small>
            INTERNAL — SALES TEAM USE
            ONLY
          </small>

          <strong>
            {report.workspaceName} ·
            MINI AUDIT REPORT
          </strong>
        </div>
      </div>

      <div className="rf-mini-audit-banner__date">
        <small>Report date</small>

        <strong>
          {formatReportDate(
            report.reportDate
          )}
        </strong>
      </div>
    </section>
  );
}

function AuditCallHook({ report }) {
  if (!report?.hook && !report?.suggestedOpener && !report?.currentStanding) return null;
  return (
    <section className="rf-mini-audit-section">
      <SectionHeader number="00" title="Call opener" subtitle="The strongest verified angle before you dial." />
      <div className="rf-mini-audit-snapshot">
        {report.currentStanding ? <SnapshotRow label="Current standing" value={report.currentStanding} wide /> : null}
        {report.hook ? <SnapshotRow label="The hook" value={report.hook} wide /> : null}
        {report.suggestedOpener ? <SnapshotRow label="Suggested opener" value={report.suggestedOpener} wide /> : null}
        {report.grade ? <SnapshotRow label="Audit grade" value={`${report.grade}${Number(report.score10) ? ` · ${report.score10}/10` : ""}`} /> : null}
      </div>
    </section>
  );
}

function BusinessSnapshot({
  snapshot,
}) {
  return (
    <section className="rf-mini-audit-section">
      <SectionHeader
        number="01"
        title="Business snapshot"
        subtitle="Verified public business information."
      />

      <div className="rf-mini-audit-snapshot">
        <SnapshotRow
          label="Business name"
          value={
            snapshot.businessName ||
            "Not identified"
          }
        />

        {snapshot.category ? (
          <SnapshotRow label="Category" value={snapshot.category} />
        ) : null}

        {snapshot.rating !== null && snapshot.rating !== undefined ? (
          <SnapshotRow label="Google rating" value={`${snapshot.rating}${snapshot.reviewCount !== null && snapshot.reviewCount !== undefined ? ` · ${snapshot.reviewCount} reviews` : ""}`} />
        ) : null}

        {snapshot.address ? (
          <SnapshotRow label="Address / market" value={snapshot.address} wide />
        ) : null}

        {snapshot.mobilePageSpeed !== null && snapshot.mobilePageSpeed !== undefined ? (
          <SnapshotRow label="Mobile PageSpeed" value={`${snapshot.mobilePageSpeed}/100`} />
        ) : null}

        <SnapshotRow
          label="Phone"
          value={
            snapshot.phone ||
            "Not publicly listed"
          }
          href={
            snapshot.phone
              ? `tel:${snapshot.phone}`
              : ""
          }
        />

        <SnapshotRow
          label="Email"
          value={
            snapshot.email ||
            "Not publicly listed"
          }
          href={
            snapshot.email
              ? `mailto:${snapshot.email}`
              : ""
          }
        />

        <SnapshotRow
          label="Website"
          value={
            snapshot.website ||
            "Not available"
          }
          href={
            snapshot.website
          }
        />

        <SnapshotRow
          label="Platform"
          value={
            snapshot.platform ||
            "Not identifiable from public source"
          }
        />

        <SnapshotRow
          label="Decision maker"
          value={
            snapshot.decisionMaker ||
            "Not publicly identified — verify on call"
          }
        />

        <SnapshotRow
          label="Business hours"
          value={
            snapshot.businessHours ||
            "Not publicly listed — verify on call"
          }
        />

        <SnapshotRow
          label="What they do"
          value={
            snapshot.description ||
            "No verified business description was returned."
          }
          wide
        />
      </div>
    </section>
  );
}

function IssuesList({
  issues,
  noMajorIssues = false,
  workingWell = "",
  expandedIssue,
  onToggleIssue,
}) {
  return (
    <section className="rf-mini-audit-section">
      <SectionHeader
        number="02"
        title={
          noMajorIssues
            ? "Talking points"
            : "Issues found"
        }
        subtitle={
          noMajorIssues
            ? "Verified strengths are shown when no material issue is confirmed."
            : "Technical finding first, followed by the business consequence."
        }
        count={issues.length}
      />

      {!issues.length ? (
        <AuditEmptyState
          icon="OK"
          title={
            noMajorIssues
              ? "✓ No major issues found"
              : "No verified issues returned"
          }
          description={
            noMajorIssues && workingWell
              ? workingWell
              : "The report completed, but no structured findings were available. Review the source report or regenerate the audit."
          }
          compact
        />
      ) : (
        <div className="rf-mini-audit-issues">
          {issues.map(
            (issue, index) => {
              const issueId =
                issue.id ||
                `issue-${index}`;

              const expanded =
                expandedIssue ===
                issueId;

              return (
                <article
                  key={issueId}
                  className={`rf-mini-audit-issue ${
                    expanded
                      ? "is-expanded"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    className="rf-mini-audit-issue__summary"
                    onClick={() =>
                      onToggleIssue(
                        issueId
                      )
                    }
                  >
                    <span className="rf-mini-audit-issue__number">
                      {String(
                        index + 1
                      ).padStart(2, "0")}
                    </span>

                    <div>
                      <small>
                        Issue found
                      </small>

                      <strong>
                        {issue.tag ||
                          issue.title ||
                          "Verified audit finding"}
                      </strong>
                    </div>

                    <span
                      className={`rf-mini-audit-severity rf-mini-audit-severity--${normalizeStatus(
                        issue.severity ||
                          getIssueSeverity(
                            index
                          )
                      )}`}
                    >
                      {formatLabel(
                        issue.severity ||
                          getIssueSeverity(
                            index
                          )
                      )}
                    </span>

                    <b>
                      {expanded
                        ? "−"
                        : "+"}
                    </b>
                  </button>

                  <div className="rf-mini-audit-issue__content">
                    <div>
                      <small>
                        What to say
                      </small>

                      <p>
                        {issue.whatToSay ||
                          issue.statement ||
                          issue.description ||
                          issue.finding ||
                          "No call statement was returned."}
                      </p>
                    </div>

                    {issue.evidence ? (
                      <div className="rf-mini-audit-evidence">
                        <small>
                          Public evidence
                        </small>

                        <p>
                          {issue.evidence}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}

function AuditSourceFooter({
  report,
}) {
  return (
    <footer className="rf-mini-audit-source-footer">
      <strong>
        INTERNAL USE ONLY
      </strong>

      <p>
        Do not forward this document to
        the client. Findings were sourced
        from{" "}
        {report.domain ||
          "verified public sources"}{" "}
        and publicly available
        evidence on{" "}
        {formatReportDate(
          report.reportDate
        )}
        . Send the client-facing
        technical audit after the call.
      </p>

      <span>
        {report.workspaceName}
        {report.workspaceDomain
          ? ` — ${report.workspaceDomain}`
          : ""}
      </span>
    </footer>
  );
}

function AuditDownloadActions({
  report,
  lead,
}) {
  const pdfUrl =
    report.pdfUrl ||
    lead?.miniAuditPdfUrl ||
    "";

  const textUrl =
    report.textUrl ||
    lead?.miniAuditTextUrl ||
    "";

  return (
    <div className="rf-mini-audit-downloads">
      {pdfUrl ? (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="rf-mini-audit-download-button rf-mini-audit-download-button--primary"
        >
          <span>PDF</span>

          <div>
            <strong>
              Download PDF
            </strong>

            <small>
              One-page sales report
            </small>
          </div>
        </a>
      ) : (
        <button
          type="button"
          className="rf-mini-audit-download-button rf-mini-audit-download-button--disabled"
          disabled
        >
          <span>PDF</span>

          <div>
            <strong>
              PDF unavailable
            </strong>

            <small>
              Report file not created
            </small>
          </div>
        </button>
      )}

      {textUrl ? (
        <a
          href={textUrl}
          target="_blank"
          rel="noreferrer"
          className="rf-mini-audit-download-button"
        >
          <span>TXT</span>

          <div>
            <strong>
              Open report text
            </strong>

            <small>
              View the source report
            </small>
          </div>
        </a>
      ) : (
        <button
          type="button"
          className="rf-mini-audit-download-button"
          onClick={() =>
            copyAuditToClipboard(
              report
            )
          }
        >
          <span>CPY</span>

          <div>
            <strong>
              Copy report
            </strong>

            <small>
              Copy report to clipboard
            </small>
          </div>
        </button>
      )}
    </div>
  );
}

function AuditActionGrid({
  campaignType = "website",
  auditReady,
  generating,
  generatingFullAudit,
  generatingCompetitorAnalysis,
  onGenerateMiniAudit,
  onGenerateFullAudit,
  onGenerateCompetitorAnalysis,
}) {
  return (
    <section className="rf-mini-audit-actions">
      <button
        type="button"
        className="rf-mini-audit-action rf-mini-audit-action--primary"
        onClick={onGenerateMiniAudit}
        disabled={generating}
      >
        <span>
          {generating ? "…" : "MA"}
        </span>

        <div>
          <strong>
            {generating
              ? "Generating mini audit"
              : auditReady
                ? `Regenerate ${campaignType === "gmb" ? "GMB" : "Website"} Mini Audit`
                : `Generate ${campaignType === "gmb" ? "GMB" : "Website"} Mini Audit`}
          </strong>

          <small>
            {auditReady
              ? "Refresh public findings"
              : "Create the internal call report"}
          </small>
        </div>
      </button>

      <button
        type="button"
        className="rf-mini-audit-action"
        onClick={
          onGenerateCompetitorAnalysis
        }
        disabled={
          generatingCompetitorAnalysis
        }
      >
        <span>
          {generatingCompetitorAnalysis
            ? "…"
            : "CA"}
        </span>

        <div>
          <strong>
            {generatingCompetitorAnalysis
              ? "Generating analysis"
              : `${campaignType === "gmb" ? "GMB" : "Website"} Competitor Analysis`}
          </strong>

          <small>
            Compare local competitors
          </small>
        </div>
      </button>

      <button
        type="button"
        className="rf-mini-audit-action"
        onClick={
          onGenerateFullAudit
        }
        disabled={
          generatingFullAudit
        }
      >
        <span>
          {generatingFullAudit
            ? "…"
            : "FA"}
        </span>

        <div>
          <strong>
            {generatingFullAudit
              ? "Generating full audit"
              : campaignType === "gmb"
                ? "GMB Full Audit"
                : "Website Full Audit"}
          </strong>

          <small>
            {campaignType === "gmb"
              ? "Internal detailed GMB opportunity analysis"
              : "Internal detailed Website opportunity analysis"}
          </small>
        </div>
      </button>
    </section>
  );
}

function AuditProgressState({
  lead,
  campaignType = "website",
}) {
  const steps = campaignType === "gmb"
    ? [
        {
          title: "Public profile search",
          description:
            "Finding the business and public local-search evidence.",
        },
        {
          title: "Business verification",
          description:
            "Checking identity, address/NAP, category, hours and contact details where verifiable.",
        },
        {
          title: "Local trust signals",
          description:
            "Reviewing reviews, profile signals and nearby competitor context.",
        },
        {
          title: "Report preparation",
          description:
            "Formatting the universal one-page caller Mini Audit.",
        },
      ]
    : [
        {
          title: "Website access",
          description:
            "Fetching the public homepage and metadata.",
        },
        {
          title: "Business verification",
          description:
            "Reviewing public contact and business details.",
        },
        {
          title: "Website findings",
          description:
            "Checking public conversion, trust, SEO and usability signals.",
        },
        {
          title: "Report preparation",
          description:
            "Formatting the universal one-page caller Mini Audit.",
        },
      ];

  return (
    <div className="rf-mini-audit-progress">
      <div className="rf-mini-audit-progress__spinner">
        <span />
        <b>AI</b>
      </div>

      <div className="rf-mini-audit-progress__content">
        <p className="rf-mini-audit-eyebrow">
          Real-time audit job
        </p>

        <h3>
          Reviewing{" "}
          {lead?.business ||
            lead?.name ||
            getDomain(
              lead?.website
            )}
        </h3>

        <p>
          The report will appear here
          automatically when the
          background worker finishes.
        </p>
      </div>

      <div className="rf-mini-audit-progress__steps">
        {steps.map(
          (step, index) => (
            <article
              key={step.title}
              className={
                index === 0
                  ? "is-active"
                  : ""
              }
            >
              <span>
                {index + 1}
              </span>

              <div>
                <strong>
                  {step.title}
                </strong>

                <small>
                  {step.description}
                </small>
              </div>
            </article>
          )
        )}
      </div>
    </div>
  );
}

function AuditEmptyState({
  icon,
  title,
  description,
  compact = false,
}) {
  return (
    <div
      className={`rf-mini-audit-empty ${
        compact
          ? "rf-mini-audit-empty--compact"
          : ""
      }`}
    >
      <span>{icon}</span>

      <strong>{title}</strong>

      <p>{description}</p>
    </div>
  );
}

function SectionHeader({
  number,
  title,
  subtitle,
  count,
}) {
  return (
    <header className="rf-mini-audit-section__header">
      <span>{number}</span>

      <div>
        <h3>{title}</h3>

        <p>{subtitle}</p>
      </div>

      {Number.isFinite(count) ? (
        <b>
          {count}{" "}
          {count === 1
            ? "finding"
            : "findings"}
        </b>
      ) : null}
    </header>
  );
}

function SnapshotRow({
  label,
  value,
  href,
  wide = false,
}) {
  const normalizedHref =
    href
      ? normalizeExternalUrl(href)
      : "";

  return (
    <article
      className={`rf-mini-audit-snapshot-row ${
        wide
          ? "rf-mini-audit-snapshot-row--wide"
          : ""
      }`}
    >
      <small>{label}</small>

      {normalizedHref ? (
        <a
          href={normalizedHref}
          target={
            normalizedHref.startsWith(
              "http"
            )
              ? "_blank"
              : undefined
          }
          rel={
            normalizedHref.startsWith(
              "http"
            )
              ? "noreferrer"
              : undefined
          }
        >
          {value}
        </a>
      ) : (
        <strong>{value}</strong>
      )}
    </article>
  );
}

function normalizeMiniAudit({
  audit,
  lead,
}) {
  const envelope = audit || {};
  const source = envelope.report || envelope;

  const snapshotSource =
    source.businessSnapshot ||
    source.snapshot ||
    source.business ||
    {};

  const rawIssues =
    source.issues ||
    source.findings ||
    source.auditFindings ||
    [];

  const issues = Array.isArray(
    rawIssues
  )
    ? rawIssues
        .map((issue, index) =>
          normalizeIssue(
            issue,
            index
          )
        )
        .filter(Boolean)
    : [];

  const workspace =
    envelope.brand ||
    source.workspace ||
    source.brand ||
    source.organization ||
    {};

  const website =
    snapshotSource.website ||
    source.website ||
    lead?.website ||
    "";

  return {
    id:
      envelope.id ||
      source.id ||
      source.auditId ||
      "",
    track:
      envelope.track ||
      envelope.campaignType ||
      source.track ||
      "",
    hook:
      source.hook ||
      "",
    suggestedOpener:
      source.suggestedOpener ||
      "",
    noMajorIssues:
      Boolean(source.noMajorIssues),
    workingWell:
      source.workingWell ||
      "",
    currentStanding:
      source.currentStanding ||
      "",
    score10:
      Number(source.score10 || 0),
    grade:
      source.grade ||
      "",
    status:
      envelope.status ||
      source.status ||
      lead?.miniAuditStatus ||
      "",
    generatedAt:
      source.generatedAt ||
      source.completedAt ||
      source.updatedAt ||
      "",
    reportDate:
      source.reportDate ||
      source.generatedAt ||
      source.completedAt ||
      new Date().toISOString(),
    workspaceName:
      source.workspaceName ||
      source.brandName ||
      workspace.name ||
      source.parentAccountName ||
      "ReachFly AI",
    workspaceDomain:
      source.workspaceDomain ||
      source.brandDomain ||
      workspace.domain ||
      "",
    domain: getDomain(website),
    pdfUrl:
      source.pdfUrl ||
      source.downloadUrl ||
      source.reportPdfUrl ||
      "",
    textUrl:
      source.textUrl ||
      source.reportTextUrl ||
      "",
    snapshot: {
      businessName:
        snapshotSource.businessName ||
        snapshotSource.name ||
        source.businessName ||
        lead?.business ||
        lead?.name ||
        "",
      phone:
        snapshotSource.phone ||
        source.phone ||
        lead?.phone ||
        "",
      email:
        snapshotSource.email ||
        source.email ||
        lead?.email ||
        "",
      website,
      platform:
        snapshotSource.platform ||
        snapshotSource.cms ||
        source.platform ||
        source.cms ||
        "",
      decisionMaker:
        snapshotSource.decisionMaker ||
        snapshotSource.owner ||
        source.decisionMaker ||
        "",
      businessHours:
        snapshotSource.businessHours ||
        snapshotSource.hours ||
        source.businessHours ||
        "",
      description:
        snapshotSource.description ||
        snapshotSource.whatTheyDo ||
        source.description ||
        source.whatTheyDo ||
        lead?.description ||
        "",
      category:
        snapshotSource.category ||
        source.category ||
        lead?.category ||
        lead?.primaryType ||
        "",
      address:
        snapshotSource.address ||
        source.address ||
        lead?.address ||
        lead?.formattedAddress ||
        "",
      rating:
        snapshotSource.rating ?? source.rating ?? null,
      reviewCount:
        snapshotSource.reviewCount ?? source.reviewCount ?? null,
      mobilePageSpeed:
        snapshotSource.mobilePageSpeed ?? source.mobilePageSpeed ?? null,
    },
    issues,
  };
}

function normalizeIssue(
  issue,
  index
) {
  if (!issue) {
    return null;
  }

  if (
    typeof issue === "string"
  ) {
    return {
      id: `issue-${index}`,
      tag: "Verified audit finding",
      whatToSay: issue,
      severity:
        getIssueSeverity(index),
      evidence: "",
    };
  }

  const fact =
    issue.sayTheFinding ||
    issue.fact ||
    issue.finding ||
    issue.statement ||
    "";

  const pain =
    issue.thenThePain ||
    issue.pain ||
    issue.consequence ||
    issue.businessImpact ||
    "";

  const combined =
    issue.whatToSay ||
    issue.script ||
    issue.description ||
    [fact, pain]
      .filter(Boolean)
      .join(" ");

  return {
    id:
      issue.id ||
      `issue-${index}`,
    tag:
      issue.tag ||
      issue.technicalTag ||
      issue.title ||
      issue.issue ||
      "Verified audit finding",
    whatToSay: combined,
    severity:
      issue.severity ||
      issue.priority ||
      getIssueSeverity(index),
    evidence:
      issue.evidence ||
      issue.source ||
      "",
  };
}

function getIssueSeverity(index) {
  if (index < 2) {
    return "high";
  }

  if (index < 5) {
    return "medium";
  }

  return "low";
}

async function copyAuditToClipboard(
  report
) {
  const lines = [
    "INTERNAL - SALES TEAM USE ONLY - DO NOT SEND TO CLIENT",
    `${report.workspaceName.toUpperCase()} · MINI AUDIT REPORT · ${formatReportDate(
      report.reportDate
    )}`,
    "",
    `${report.snapshot.businessName} - Mini Audit`,
    "One page. Everything you need before you dial.",
    "",
    "BUSINESS SNAPSHOT",
    `Business name: ${report.snapshot.businessName}`,
    `Phone: ${
      report.snapshot.phone ||
      "Not publicly listed"
    }`,
    `Email: ${
      report.snapshot.email ||
      "Not publicly listed"
    }`,
    `Website: ${
      report.snapshot.website ||
      "Not available"
    } · built on ${
      report.snapshot.platform ||
      "Not identified"
    }`,
    `Decision maker: ${
      report.snapshot.decisionMaker ||
      "Not publicly identified - verify on call"
    }`,
    `Business hours: ${
      report.snapshot.businessHours ||
      "Not publicly listed - verify on call"
    }`,
    `What they do: ${
      report.snapshot.description ||
      "Not available"
    }`,
    "",
    "ISSUES FOUND",
    ...report.issues.flatMap(
      (issue, index) => [
        `${index + 1}. ${
          issue.tag
        }`,
        issue.whatToSay,
        "",
      ]
    ),
    "INTERNAL USE ONLY. Do not forward this document to the client.",
  ];

  try {
    await navigator.clipboard.writeText(
      lines.join("\n")
    );
  } catch {
    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value =
      lines.join("\n");

    textarea.style.position =
      "fixed";

    textarea.style.opacity = "0";

    document.body.appendChild(
      textarea
    );

    textarea.select();

    document.execCommand("copy");

    textarea.remove();
  }
}

function normalizeCampaignType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return [
    "gmb",
    "gmb_audit",
    "google_business_profile",
    "local_visibility",
  ].includes(normalized)
    ? "gmb"
    : "website";
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function formatReportDate(value) {
  const date = value
    ? new Date(value)
    : new Date();

  if (
    Number.isNaN(date.getTime())
  ) {
    return new Intl.DateTimeFormat(
      undefined,
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      }
    ).format(new Date());
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  ).format(date);
}

function normalizeExternalUrl(value) {
  if (!value) {
    return "";
  }

  if (
    /^(tel:|mailto:|https?:\/\/)/i.test(
      value
    )
  ) {
    return value;
  }

  return `https://${value}`;
}

function getDomain(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(
      /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`
    ).hostname.replace(
      /^www\./,
      ""
    );
  } catch {
    return value;
  }
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "RF";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[words.length - 1][0]
  }`.toUpperCase();
}