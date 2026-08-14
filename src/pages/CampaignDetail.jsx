import {
  ArrowLeft,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Send,
  Star,
  Users,
} from "../components/icons";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import Loader from "../components/Loader";
import { useAuth } from "../auth/AuthContext";
import CampaignTeamAssignment from "../components/CampaignTeamAssignment";
import CampaignAuditBatch from "../components/CampaignAuditBatch";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState(null);
  const [error, setError] = useState("");

  const role = normalizeWorkspaceRole(
    user?.workspaceRole ||
      user?.role ||
      ""
  );

  const canManageCampaigns =
    ["owner", "admin", "manager"].includes(role);

  const isPrivilegedAdmin =
    ["owner", "admin"].includes(role);

  const load = () => {
    if (!canManageCampaigns || !id) {
      return Promise.resolve(null);
    }

    return api
      .campaign(id)
      .then((item) => {
        setCampaign(item);
        setError("");

        return item;
      })
      .catch((requestError) => {
        setError(
          requestError?.message ||
            "The campaign could not be loaded."
        );

        return null;
      });
  };

  useEffect(() => {
    if (!canManageCampaigns || !id) {
      return undefined;
    }

    let mounted = true;

    void load();

    const source = new EventSource(
      api.eventsUrl(id)
    );

    source.onmessage = (event) => {
      if (!mounted) return;

      let parsed;

      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (parsed.campaign) {
        setCampaign((current) => ({
          ...(current || {}),
          ...parsed.campaign,
        }));
      }

      if (
        [
          "complete",
          "error",
          "pipeline_started",
          "pipeline_progress",
          "pipeline_complete",
          "lead_updated",
          "call_updated",
          "voice_call_updated",
          "meeting_booked",
        ].includes(parsed.type)
      ) {
        load();
      }
    };

    source.onerror = () => {};

    return () => {
      mounted = false;
      source.close();
    };
  }, [
    id,
    canManageCampaigns,
  ]);

  useEffect(() => {
    if (!user || canManageCampaigns) {
      return;
    }

    navigate("/app/dashboard", {
      replace: true,
    });
  }, [
    canManageCampaigns,
    navigate,
    user,
  ]);

  const leads = useMemo(
    () =>
      Array.isArray(
        campaign?.leads
      )
        ? campaign.leads
        : [],
    [
      campaign,
    ]
  );

  const permissions =
    Array.isArray(
      user?.permissions
    )
      ? user.permissions
      : [];

  const canAssign =
    canManageCampaigns &&
    (
      isPrivilegedAdmin ||
      permissions.includes(
        "assign_leads"
      )
    );

  if (!canManageCampaigns) {
    return (
      <div className="page">
        <div className="card">
          <span className="eyebrow">
            Restricted workspace feature
          </span>

          <h1>
            Campaign access required
          </h1>

          <p className="text-muted">
            Campaign details, lead audits, pipeline controls, and lead
            assignment are available to workspace owners, administrators,
            and managers.
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

  if (error && !campaign) {
    return (
      <div className="empty">
        <h3>{error}</h3>
        <Link to="/app/campaigns/history">Back to campaigns</Link>
      </div>
    );
  }

  if (!campaign) {
    return <Loader visible percent={5} message="Opening campaign" />;
  }

  const isImported =
    campaign.source === "external-import" ||
    campaign.externalImport === true;

  const isDiscoveryRunning =
    !isImported &&
    campaign.pipelineStatus === "discovering" &&
    ["queued", "active"].includes(campaign.status);

  const isSending = campaign.pipelineStatus === "running";
  const isComplete = campaign.pipelineStatus === "complete";
  const isFailed = campaign.pipelineStatus === "failed";
  const isImportedReady = isImported && !isSending && !isComplete && !isFailed;

  const showLoader =
    campaign.pipelineStatus === "discovering" ||
    campaign.pipelineStatus === "running";

  const progress = isSending
    ? campaign.outreachProgress || {
        percent: 1,
        message: "Running outreach pipeline",
      }
    : campaign.progress || {
        percent: 0,
        message: "Opening campaign",
      };

  const senderEmail = getSenderEmail(campaign);
  const backTarget = getBackTarget(campaign);
  const statusLabel = getStatusLabel(campaign, isImported);
  const statusClass = getStatusClass(campaign, isImported);
  const leadsLabel = isImported ? "imported leads" : "leads discovered";
  const voiceEnabled = isAiVoiceEnabled(campaign);
  const phoneReadyCount = leads.filter((lead) => Boolean(lead?.phone)).length;
  const assignedCount = getAssignedLeadCount(campaign);
  const connectedCount = leads.filter((lead) =>
    ["connected", "qualified", "interested", "meeting_booked"].includes(
      getLeadOutcome(lead)
    )
  ).length;
  const meetingCount = leads.filter((lead) =>
    getLeadOutcome(lead) === "meeting_booked" ||
    Boolean(lead?.meetingId || lead?.meeting?.id || lead?.meetingBookedAt)
  ).length;
  const followUpCount = leads.filter((lead) =>
    ["callback", "follow_up", "call_due", "send_information"].includes(
      getLeadOutcome(lead)
    )
  ).length;
  const unansweredCount = leads.filter((lead) =>
    ["no_answer", "busy", "voicemail", "unanswered"].includes(
      getLeadOutcome(lead)
    )
  ).length;

  return (
    <div className="detail-page">
      <Loader
        visible={showLoader}
        percent={progress.percent || 2}
        message={progress.message || "Processing campaign"}
        title={isSending ? "Running campaign outreach" : "Processing campaign"}
      />

      <Link className="back-link" to={backTarget}>
        <ArrowLeft /> Back to campaigns
      </Link>

      <div className="detail-hero">
        <div>
          <span className={`status ${statusClass}`}>{statusLabel}</span>

          <h1>{campaign.name}</h1>

          <p>
            <MapPin /> {campaign.location || "Imported lead list"}
            {campaign.radiusKm && !isImported
              ? ` · ${campaign.radiusKm} km`
              : ""}
            {campaign.niche ? ` · ${campaign.niche}` : ""}
          </p>

          {senderEmail ? (
            <p>
              <Mail /> Sending from {senderEmail}
            </p>
          ) : (
            <p>
              <Mail /> No sender email linked yet
            </p>
          )}
        </div>

        <div className="detail-actions">
          <Link
            className="btn light"
            to={`/app/campaigns/${campaign.id}/pipeline`}
          >
            <Send /> Pipeline builder
          </Link>

          {voiceEnabled ? (
            <Link
              className="btn light"
              to="/app/voice-agent"
            >
              <Phone /> Voice Agent
            </Link>
          ) : null}

          <div className="big-metric">
            <Users />
            <span>
              <b>{leads.length}</b>
              <small>{leadsLabel}</small>
            </span>
          </div>
        </div>
      </div>

      {campaign.error ? (
        <div className="error-banner">{campaign.error}</div>
      ) : null}

      {isImportedReady ? (
        <div className="lead-quality-note">
          <Globe2 />
          <div>
            <b>Imported lead list is ready.</b>
            These leads came from your uploaded sheet. Review assignments and
            outreach readiness below, then open Pipeline Builder when you need to
            adjust the digital sequence.
          </div>
        </div>
      ) : null}

      {isDiscoveryRunning ? (
        <div className="lead-quality-note">
          <Globe2 />
          <div>
            <b>Lead discovery is running live.</b>
            The table updates automatically through backend events. You do not
            need to refresh.
          </div>
        </div>
      ) : null}

      {isSending ? (
        <div className="lead-quality-note">
          <Send />
          <div>
            <b>Campaign outreach is running.</b>
            {progress.message ||
              (voiceEnabled
                ? "AI Voice and configured follow-up activity are being processed."
                : `Digital outreach is being processed from ${
                    senderEmail || "the configured sender"
                  }.`)}
          </div>
        </div>
      ) : null}

      {isComplete ? (
        <div className="success-banner">
          <Send />
          Campaign outreach completed. Review connected calls, follow-ups,
          meetings, assignments, and lead-level outcomes below.
        </div>
      ) : null}

      {leads.length > 0 ? (
        <div className="grid4 mt24">
          <MetricCard label="Leads" value={leads.length} />
          <MetricCard label="Phone ready" value={phoneReadyCount} />
          <MetricCard label="Assigned" value={assignedCount} />
          <MetricCard label="Connected" value={connectedCount} />
          <MetricCard label="Meetings" value={meetingCount} />
          <MetricCard label="Follow-ups" value={followUpCount} />
          <MetricCard label="Unanswered" value={unansweredCount} />
          <MetricCard
            label="AI Voice"
            value={voiceEnabled ? "Enabled" : "Not enabled"}
          />
        </div>
      ) : null}

      {voiceEnabled ? (
        <div className="lead-quality-note">
          <Phone />
          <div>
            <b>AI Voice is enabled for this campaign.</b>
            Voice Agent call state is authoritative. Use the Voice Agent workspace
            for live calls, transcripts, recordings, meetings, and call-level
            diagnostics. This campaign view summarizes outcomes already attached
            to campaign leads.
          </div>
        </div>
      ) : null}

      {campaign.leadMeta ? (
        <div className="grid4 mt24">
          <MetricCard
            label={isImported ? "Imported rows" : "Requested leads"}
            value={
              campaign.leadMeta.totalRows ??
              campaign.leadMeta.requested ??
              leads.length
            }
          />

          <MetricCard
            label={isImported ? "Valid emails" : "Delivered"}
            value={
              campaign.leadMeta.validEmails ??
              campaign.leadMeta.delivered ??
              leads.length
            }
          />

          <MetricCard
            label={isImported ? "Missing emails" : "Shortfall"}
            value={
              campaign.leadMeta.missingEmails ??
              campaign.leadMeta.shortfall ??
              0
            }
          />

          <MetricCard label="Replies" value={campaign.replies || 0} />
        </div>
      ) : null}

      {canAssign &&
      leads.length > 0 &&
      !isDiscoveryRunning ? (
        <>
          <CampaignAuditBatch
            campaign={campaign}
            onUpdated={load}
          />

          <CampaignTeamAssignment
            campaign={campaign}
            onAssigned={load}
          />
        </>
      ) : null}

      {role === "manager" &&
      !canAssign &&
      leads.length > 0 &&
      !isDiscoveryRunning ? (
        <div className="error-banner">
          Your manager account does not currently have the assign_leads
          permission. Assignment controls remain hidden until the workspace grants
          that permission.
        </div>
      ) : null}

      {!isDiscoveryRunning && leads.length === 0 ? (
        <div className="no-real-leads">
          <div className="empty">
            <span>
              <Globe2 />
            </span>
            <h3>No leads found yet.</h3>
            <p>
              Try expanded depth, a broader niche, a nearby city, or import your
              own lead sheet.
            </p>
          </div>
        </div>
      ) : null}

      {leads.length > 0 ? (
        <div className="table-wrap">
          <div className="table-title">
            <div>
              <h2>{isImported ? "Imported lead list" : "Lead market"}</h2>
              <p>
                {isImported
                  ? "Campaign-ready records imported from your sheet and prepared for outreach."
                  : "Campaign-ready lead records enriched for outreach and audit-based personalization."}
              </p>
            </div>

            <span>{leads.length} records</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Contact</th>
                <th>Outreach</th>
                <th>Rating</th>
                <th>Website</th>
                <th>Outcome / next action</th>
                <th>Assigned to</th>
                <th>Source / Map</th>
              </tr>
            </thead>

            <tbody>
              {leads.map((lead, index) => {
                const businessName =
                  lead.business || lead.name || "Unknown lead";

                const leadLocation =
                  lead.address || lead.location || campaign.location;

                const mapsUrl =
                  lead.mapsUrl ||
                  `https://www.google.com/search?q=${encodeURIComponent(
                    `${businessName} ${leadLocation || ""}`
                  )}`;

                return (
                  <tr key={lead.id || `${businessName}-${index}`}>
                    <td>
                      <b>{businessName}</b>
                      <small>{leadLocation || "Location not available"}</small>

                      <span className="source-pill">
                        {lead.confidence || lead.qualityScore || 100}% match
                      </span>
                    </td>

                    <td>
                      <div className="contact-stack">
                        {lead.phone ? (
                          <span>
                            <Phone /> {lead.phone}
                          </span>
                        ) : (
                          <span className="muted">Phone not listed</span>
                        )}

                        {lead.email ? (
                          <a href={`mailto:${lead.email}`}>
                            <Mail /> {lead.email}
                          </a>
                        ) : (
                          <span className="muted">Email not found</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="contact-stack">
                        {voiceEnabled ? (
                          <span>
                            <Phone /> AI Voice enabled
                          </span>
                        ) : null}

                        {senderEmail ? (
                          <span>
                            <Mail /> {senderEmail}
                          </span>
                        ) : null}

                        {!voiceEnabled && !senderEmail ? (
                          <span className="muted">
                            No outreach channel configured
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td>
                      {lead.rating ? (
                        <>
                          <Star className="star" />{" "}
                          {Number(lead.rating).toFixed(1)}
                          <small>({lead.reviews || 0})</small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>
                      {lead.website ? (
                        <a
                          href={normalizeWebsiteUrl(lead.website)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Globe2 /> Visit
                        </a>
                      ) : (
                        <span className="opportunity">
                          Website opportunity
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="contact-stack">
                        <span
                          className={`badge ${leadStatusBadge(
                            getLeadOutcome(lead)
                          )}`}
                        >
                          {leadStatusLabel(getLeadOutcome(lead))}
                        </span>

                        {getNextActionAt(lead) ? (
                          <small>
                            Next: {formatDateTime(getNextActionAt(lead))}
                          </small>
                        ) : null}

                        {(lead.tags || []).length ? (
                          <div className="rf-table-tags">
                            {(lead.tags || []).slice(0, 3).map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td>
                      {getAssignedUserName(lead) ? (
                        <div className="contact-stack">
                          <span>
                            <Users />{" "}
                            {getAssignedUserName(
                              lead
                            )}
                          </span>

                          <small>
                            {Number(
                              lead.callAttempts ??
                                lead.attempts ??
                                lead.voiceCallAttempts ??
                                0
                            )}{" "}
                            attempts
                          </small>
                        </div>
                      ) : (
                        <span className="muted">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td>
                      <a href={mapsUrl} target="_blank" rel="noreferrer">
                        <ExternalLink /> Open
                      </a>
                      <small>{lead.source || "ReachFly source"}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
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

function getAssignedUserName(lead = {}) {
  return (
    lead.assignedToName ||
    lead.assigneeName ||
    lead.assignedUserName ||
    lead.assignee?.name ||
    lead.assignedUser?.name ||
    ""
  );
}

function getAssignedLeadCount(campaign) {
  const leads =
    Array.isArray(campaign?.leads)
      ? campaign.leads
      : [];

  return leads.filter((lead) =>
    Boolean(
      lead?.assignedTo ||
        lead?.assigneeId ||
        lead?.assignedUserId ||
        lead?.assignmentId
    )
  ).length;
}

function isAiVoiceEnabled(campaign) {
  return Boolean(
    campaign?.outreachPlan?.aiVoice ||
      campaign?.aiVoiceEnabled ||
      campaign?.voiceEnabled ||
      campaign?.voiceCampaignEnabled ||
      campaign?.channels?.includes?.("ai_voice")
  );
}

function getLeadOutcome(lead = {}) {
  const value =
    lead.lastCallOutcome ||
    lead.callOutcome ||
    lead.outcome ||
    lead.disposition ||
    lead.lastDisposition ||
    lead.voiceOutcome ||
    lead.aiCall?.outcome ||
    lead.lastCall?.outcome ||
    lead.latestCall?.outcome ||
    lead.status ||
    "new";

  return String(value || "new")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getNextActionAt(lead = {}) {
  return (
    lead.nextActionAt ||
    lead.followUpAt ||
    lead.callbackAt ||
    lead.scheduledAt ||
    lead.task?.dueAt ||
    lead.task?.dueDate ||
    lead.lead?.nextActionAt ||
    ""
  );
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString();
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <div className="metric-num sm">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function getSenderEmail(campaign) {
  if (!campaign) return "";

  return (
    campaign.senderEmail ||
    campaign.fromEmail ||
    campaign.replyToEmail ||
    campaign.ownerEmail ||
    ""
  );
}

function getBackTarget(campaign) {
  if (!campaign) return "/app/campaigns/history";

  if (campaign.pipelineStatus === "running") {
    return "/app/campaigns/active";
  }

  if (campaign.status === "active") {
    return "/app/campaigns/active";
  }

  if (campaign.status === "queued") {
    return "/app/campaigns/queued";
  }

  return "/app/campaigns/history";
}

function getStatusLabel(campaign, isImported) {
  if (!campaign) return "campaign";
  if (campaign.pipelineStatus === "running") return "sending";
  if (campaign.pipelineStatus === "complete") return "complete";
  if (campaign.pipelineStatus === "failed") return "failed";
  if (isImported) return "imported";

  return campaign.status || "campaign";
}

function getStatusClass(campaign, isImported) {
  if (!campaign) return "active";
  if (campaign.pipelineStatus === "running") return "queued";
  if (campaign.pipelineStatus === "complete") return "history";
  if (campaign.pipelineStatus === "failed") return "failed";
  if (isImported) return "active";

  return campaign.status || "active";
}

function normalizeWebsiteUrl(value) {
  const url = String(value || "").trim();

  if (!url) return "#";

  if (/^https?:\/\//i.test(url)) return url;

  return `https://${url}`;
}

function leadStatusLabel(value) {
  return String(value || "new").replace(/_/g, " ");
}

function leadStatusBadge(value) {
  const status = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    ["qualified", "meeting_booked", "connected", "interested"].includes(status)
  ) {
    return "badge-green";
  }

  if (
    ["callback", "follow_up", "send_information", "call_due"].includes(status)
  ) {
    return "badge-amber";
  }

  if (
    ["not_interested", "wrong_number", "invalid_number", "do_not_call"].includes(
      status
    )
  ) {
    return "badge-red";
  }

  return "badge-gray";
}