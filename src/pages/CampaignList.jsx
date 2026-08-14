import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  ArrowRight,
  Calendar,
  Mail,
  MapPin,
  Search,
  Trash2,
  Users,
  Workflow,
} from "../components/icons";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  api,
} from "../api";

import EmptyState from "../components/EmptyState";

const meta = {
  active: [
    "Active campaigns",
    "Campaigns with leads ready for review, pipeline setup, assignment, or outreach.",
  ],

  queued: [
    "In queue",
    "Campaigns waiting to begin processing or lead discovery.",
  ],

  history: [
    "Campaign history",
    "Completed campaigns, imported lists, and previous outreach runs.",
  ],
};

export default function CampaignList({
  status,
}) {
  const navigate =
    useNavigate();

  const {
    user,
  } = useAuth();

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    deletingId,
    setDeletingId,
  ] = useState("");

  const role =
    normalizeWorkspaceRole(
      user?.workspaceRole ||
        user?.role ||
        ""
    );

  const canManageCampaignsRole =
    ["owner", "admin", "manager"].includes(role);

  const isPrivilegedAdmin =
    ["owner", "admin"].includes(role);

  const permissions =
    Array.isArray(
      user?.permissions
    )
      ? user.permissions
      : [];

  const canManageCampaigns =
    canManageCampaignsRole &&
    (
      isPrivilegedAdmin ||
      permissions.includes(
        "manage_campaigns"
      )
    );

  const canDeleteCampaigns =
    canManageCampaignsRole &&
    (
      isPrivilegedAdmin ||
      permissions.includes(
        "manage_campaigns"
      ) ||
      permissions.includes(
        "delete_campaigns"
      )
    );

  async function load({
    silent = false,
  } = {}) {
    if (
      !canManageCampaignsRole ||
      !status
    ) {
      setItems([]);
      setLoading(false);

      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      const response =
        await api.campaigns(
          status
        );

      const campaigns =
        Array.isArray(response)
          ? response
          : Array.isArray(
                response?.campaigns
              )
            ? response.campaigns
            : [];

      setItems(
        campaigns
      );

      setError("");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Campaigns could not be loaded."
      );

      if (!silent) {
        setItems([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!canManageCampaignsRole) {
      navigate(
        "/app/dashboard",
        {
          replace: true,
        }
      );

      return;
    }

    void load();

    const timer =
      window.setInterval(
        () => {
          void load({
            silent: true,
          });
        },
        30_000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    canManageCampaignsRole,
    navigate,
    status,
    user,
  ]);

  async function remove(
    campaign
  ) {
    if (
      !campaign?.id ||
      !canDeleteCampaigns
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${
          campaign.name ||
          "this campaign"
        }" and all of its leads? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      campaign.id
    );

    setError("");

    try {
      await api.deleteCampaign(
        campaign.id
      );

      setItems(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              campaign.id
          )
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The campaign could not be deleted."
      );
    } finally {
      setDeletingId("");
    }
  }

  const filtered =
    useMemo(() => {
      const value =
        query
          .trim()
          .toLowerCase();

      if (!value) {
        return items;
      }

      return items.filter(
        (campaign) =>
          [
            campaign.name,
            campaign.niche,
            campaign.location,
            campaign.source,
            campaign.senderEmail,
            campaign.fromEmail,
            campaign.selectedSegment,
            campaign.status,
            campaign.pipelineStatus,
            campaign.aiVoiceStatus,
            campaign.voiceStatus,
            JSON.stringify(campaign.outreachPlan || {}),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(value)
      );
    }, [
      items,
      query,
    ]);

  const pageMeta =
    meta[status] || [
      "Campaigns",
      "Manage your workspace campaigns.",
    ];

  if (!canManageCampaignsRole) {
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
            Campaign lists, lead generation, pipeline management, and lead
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

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            Manager campaign workspace
          </span>

          <h1>
            {pageMeta[0]}
          </h1>

          <p>
            {pageMeta[1]}
          </p>
        </div>

        <div className="flex flex-gap">
          <Link
            className="btn light"
            to="/app/campaigns/external-leads"
          >
            Import leads
          </Link>

          <Link
            className="btn primary"
            to="/app/builder"
          >
            New campaign
          </Link>
        </div>
      </div>

      {error ? (
        <div
          className="error-banner mb16"
          role="alert"
        >
          <span>
            {error}
          </span>

          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              void load();
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {role === "manager" && !canManageCampaigns ? (
        <div
          className="error-banner mb16"
          role="alert"
        >
          Your manager account does not currently have the
          manage_campaigns permission. Campaigns remain visible, but management
          actions may be limited until that permission is granted.
        </div>
      ) : null}

      <div className="toolbar">
        <div className="search">
          <Search />

          <input
            placeholder="Search campaigns"
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
          />
        </div>

        <span>
          {filtered.length}{" "}
          campaign
          {filtered.length === 1
            ? ""
            : "s"}
        </span>
      </div>

      {loading ? (
        <div className="skeleton-list">
          <i />
          <i />
          <i />
        </div>
      ) : filtered.length ===
        0 ? (
        <EmptyState
          title={
            query.trim()
              ? "No matching campaigns"
              : `No ${
                  status ||
                  ""
                } campaigns`
          }
          text={
            query.trim()
              ? "Try another campaign name, location, niche, sender, or status."
              : "Campaigns appear here as they move through the manager workflow."
          }
        />
      ) : (
        <div className="campaign-grid">
          {filtered.map(
            (campaign) => (
              <CampaignCard
                key={
                  campaign.id
                }
                campaign={
                  campaign
                }
                canDelete={
                  canDeleteCampaigns
                }
                canManage={
                  canManageCampaigns
                }
                deleting={
                  deletingId ===
                  campaign.id
                }
                onDelete={() => {
                  void remove(
                    campaign
                  );
                }}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  canDelete,
  canManage,
  deleting,
  onDelete,
}) {
  const isImported =
    campaign.source ===
      "external-import" ||
    campaign.externalImport ===
      true;

  const leadsReady =
    Number(
      campaign.leadCount ||
        campaign.leads?.length ||
        0
    );

  const senderEmail =
    getSenderEmail(
      campaign
    );

  const isReady =
    leadsReady > 0 &&
    ![
      "discovering",
      "running",
      "failed",
    ].includes(
      campaign.pipelineStatus
    );

  const progressPercent =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          campaign.progress
            ?.percent ||
            campaign.outreachProgress
              ?.percent ||
            0
        )
      )
    );

  const statusLabel =
    getStatusLabel(
      campaign,
      isImported,
      isReady
    );

  const statusClass =
    getStatusClass(
      campaign,
      isReady
    );

  const assignedCount =
    getAssignedLeadCount(
      campaign
    );

  const voiceEnabled =
    isAiVoiceEnabled(campaign);

  const leads =
    Array.isArray(campaign?.leads)
      ? campaign.leads
      : [];

  const phoneReadyCount =
    leads.filter((lead) =>
      Boolean(lead?.phone)
    ).length;

  const connectedCount =
    leads.filter((lead) =>
      ["connected", "qualified", "interested", "meeting_booked"].includes(
        getLeadOutcome(lead)
      )
    ).length;

  const meetingCount =
    leads.filter((lead) =>
      getLeadOutcome(lead) === "meeting_booked" ||
      Boolean(lead?.meetingId || lead?.meeting?.id || lead?.meetingBookedAt)
    ).length;

  const followUpCount =
    leads.filter((lead) =>
      ["callback", "follow_up", "call_due", "send_information"].includes(
        getLeadOutcome(lead)
      )
    ).length;

  return (
    <article className="campaign-card">
      <div className="campaign-card-top">
        <div className="flex flex-gap flex-wrap">
          <span
            className={`status ${statusClass}`}
          >
            {statusLabel}
          </span>

          {voiceEnabled ? (
            <span className="badge badge-neutral">
              AI Voice
            </span>
          ) : null}
        </div>

        {canDelete ? (
          <button
            className="icon-btn"
            onClick={
              onDelete
            }
            aria-label="Delete campaign"
            title="Delete campaign"
            type="button"
            disabled={
              deleting
            }
          >
            <Trash2 />
          </button>
        ) : null}
      </div>

      <h3>
        {campaign.name ||
          "Untitled campaign"}
      </h3>

      <p>
        <MapPin />

        {campaign.location ||
          "Imported list"}

        {campaign.radiusKm &&
        !isImported
          ? ` · ${campaign.radiusKm} km`
          : ""}

        {isImported &&
        campaign.selectedSegment
          ? ` · ${campaign.selectedSegment}`
          : ""}
      </p>

      {voiceEnabled || senderEmail ? (
        <p>
          {voiceEnabled ? <PhoneGlyph /> : <Mail />}

          {voiceEnabled && senderEmail
            ? `AI Voice + ${senderEmail}`
            : voiceEnabled
              ? "AI Voice enabled"
              : `Sending from ${senderEmail}`}
        </p>
      ) : (
        <p>
          <Mail />
          No outreach channel configured
        </p>
      )}

      <div className="campaign-stats">
        <span>
          <Users />

          <b>
            {leadsReady}
          </b>

          <small>
            {isImported
              ? "imported leads"
              : "leads"}
          </small>
        </span>

        <span>
          <Users />

          <b>
            {assignedCount}
          </b>

          <small>
            assigned
          </small>
        </span>

        <span>
          <Calendar />

          <b>
            {formatDate(
              campaign.createdAt
            )}
          </b>

          <small>
            created
          </small>
        </span>
      </div>

      {voiceEnabled ? (
        <div className="campaign-stats">
          <span>
            <b>{phoneReadyCount}</b>
            <small>phone ready</small>
          </span>

          <span>
            <b>{connectedCount}</b>
            <small>connected</small>
          </span>

          <span>
            <b>{meetingCount}</b>
            <small>meetings</small>
          </span>

          <span>
            <b>{followUpCount}</b>
            <small>follow-ups</small>
          </span>
        </div>
      ) : null}

      {isImported ? (
        <div className="card-progress imported">
          <span>
            <i
              style={{
                width: "100%",
              }}
            />
          </span>

          <small>
            Imported list ready.
            Open the campaign to
            assign leads or configure
            outreach.
          </small>
        </div>
      ) : campaign.pipelineStatus ===
        "running" ? (
        <div className="card-progress">
          <span>
            <i
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </span>

          <small>
            {campaign.outreachProgress
              ?.message ||
              campaign.progress
                ?.message ||
              "Campaign outreach is running"}
          </small>
        </div>
      ) : campaign.status ===
        "active" ? (
        <div className="card-progress">
          <span>
            <i
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </span>

          <small>
            {campaign.progress
              ?.message ||
              "Campaign ready"}
          </small>
        </div>
      ) : campaign.pipelineStatus ===
        "complete" ? (
        <div className="card-progress imported">
          <span>
            <i
              style={{
                width: "100%",
              }}
            />
          </span>

          <small>
            Outreach completed.
            Open the campaign to review
            calls, meetings, follow-ups,
            assignments, and replies.
          </small>
        </div>
      ) : null}

      <div className="campaign-card-actions">
        <Link
          to={`/app/campaigns/${campaign.id}`}
        >
          Open campaign

          <ArrowRight />
        </Link>

        {isReady && canManage ? (
          <Link
            to={`/app/campaigns/${campaign.id}/pipeline`}
          >
            <Workflow />
            Pipeline
          </Link>
        ) : null}

        {voiceEnabled ? (
          <Link to="/app/voice-agent">
            <span aria-hidden="true">☎</span>
            Voice Agent
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function PhoneGlyph() {
  return <span aria-hidden="true">☎</span>;
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

function getAssignedLeadCount(
  campaign
) {
  const leads =
    Array.isArray(
      campaign?.leads
    )
      ? campaign.leads
      : [];

  return leads.filter(
    (lead) =>
      Boolean(
        lead.assignedTo ||
          lead.assigneeId ||
          lead.assignedUserId
      )
  ).length;
}

function getSenderEmail(
  campaign
) {
  return (
    campaign.senderEmail ||
    campaign.fromEmail ||
    campaign.replyToEmail ||
    campaign.email ||
    ""
  );
}

function getStatusLabel(
  campaign,
  isImported,
  isReady
) {
  if (
    campaign.pipelineStatus ===
    "running"
  ) {
    return "running";
  }

  if (
    campaign.pipelineStatus ===
    "complete"
  ) {
    return "complete";
  }

  if (
    campaign.pipelineStatus ===
    "failed"
  ) {
    return "failed";
  }

  if (
    isImported &&
    isReady
  ) {
    return "imported";
  }

  if (isReady) {
    return "ready";
  }

  return (
    campaign.status ||
    "active"
  );
}

function getStatusClass(
  campaign,
  isReady
) {
  if (
    campaign.pipelineStatus ===
    "failed"
  ) {
    return "failed";
  }

  if (
    campaign.pipelineStatus ===
    "running"
  ) {
    return "queued";
  }

  if (
    campaign.pipelineStatus ===
    "complete"
  ) {
    return "history";
  }

  if (isReady) {
    return "active";
  }

  return (
    campaign.status ||
    "active"
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !==
        new Date().getFullYear()
          ? "numeric"
          : undefined,
    }
  );
}

function normalizeWorkspaceRole(
  value
) {
  const role =
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        "_"
      )
      .replace(
        /-/g,
        "_"
      );

  if (
    role.includes(
      "owner"
    )
  ) {
    return "owner";
  }

  if (
    role.includes(
      "admin"
    )
  ) {
    return "admin";
  }

  if (
    role.includes(
      "manager"
    )
  ) {
    return "manager";
  }

  if (
    role === "caller" ||
    role.includes(
      "cold_caller"
    ) ||
    role.includes(
      "sales_representative"
    ) ||
    role.includes(
      "sales_rep"
    ) ||
    role.includes(
      "telemarketer"
    )
  ) {
    return "caller";
  }

  return (
    role ||
    "caller"
  );
}