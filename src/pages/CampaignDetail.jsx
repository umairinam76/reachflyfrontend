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

  const isManager =
    role === "manager";

  const load = () => {
    if (!isManager || !id) {
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
    if (!isManager || !id) {
      return undefined;
    }

    let mounted = true;

    void load();

    const source = new EventSource(
      api.eventsUrl(id)
    );

    source.onmessage = (event) => {
      if (!mounted) return;

      const parsed = JSON.parse(event.data);

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
    isManager,
  ]);

  useEffect(() => {
    if (!user || isManager) {
      return;
    }

    navigate("/app/dashboard", {
      replace: true,
    });
  }, [
    isManager,
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
    isManager &&
    permissions.includes(
      "assign_leads"
    );

  if (!isManager) {
    return (
      <div className="page">
        <div className="card">
          <span className="eyebrow">
            Restricted workspace feature
          </span>

          <h1>
            Manager access required
          </h1>

          <p className="text-muted">
            Campaign details, lead audits, pipeline controls, and
            lead assignment are available only to workspace managers.
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

  return (
    <div className="detail-page">
      <Loader
        visible={showLoader}
        percent={progress.percent || 2}
        message={progress.message || "Processing campaign"}
        title={isSending ? "Sending campaign emails" : "Processing campaign"}
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
            These leads came from your uploaded sheet. Open Pipeline Builder to
            review the sequence and run outreach.
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
            <b>Campaign sending is running.</b>
            {progress.message ||
              `Emails are being processed from ${
                senderEmail || "selected sender"
              }.`}
          </div>
        </div>
      ) : null}

      {isComplete ? (
        <div className="success-banner">
          <Send />
          Campaign completed. Emails were processed from{" "}
          {senderEmail || "the selected sender"}.
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

      {isManager &&
      !canAssign &&
      leads.length > 0 &&
      !isDiscoveryRunning ? (
        <div className="error-banner">
          Your manager account does not currently have the
          assign_leads permission. Rerun the AH Growth seed and sign
          in again before assigning leads.
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
                <th>Sender</th>
                <th>Rating</th>
                <th>Website</th>
                <th>Calling status</th>
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
                      {senderEmail ? (
                        <div className="contact-stack">
                          <span>
                            <Mail /> {senderEmail}
                          </span>
                          <small>Campaign sender</small>
                        </div>
                      ) : (
                        <span className="muted">No sender selected</span>
                      )}
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
                      <span className={`badge ${leadStatusBadge(lead.status)}`}>
                        {leadStatusLabel(lead.status)}
                      </span>
                      {(lead.tags || []).length ? (
                        <div className="rf-table-tags">
                          {(lead.tags || []).slice(0, 3).map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      ) : null}
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
                            {lead.callAttempts ||
                              0}{" "}
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
  if (["qualified", "meeting_booked", "connected"].includes(value)) return "badge-green";
  if (["callback", "send_information", "call_due"].includes(value)) return "badge-amber";
  if (["not_interested", "wrong_number", "do_not_call"].includes(value)) return "badge-red";
  return "badge-gray";
}
