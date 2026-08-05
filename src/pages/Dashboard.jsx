import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  ArrowRight,
  Building2,
  Mail,
  MessageCircle,
  TrendingUp,
  UserRound,
  Users,
  Zap,
} from "../components/icons";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  api,
} from "../api";

import BrandLogo from "../components/BrandLogo";
import EmptyState from "../components/EmptyState";

const defaultMetrics = {
  totalLeads: 0,
  emailsSent: 0,
  whatsappSent: 0,
  replies: 0,
  replyRate: 0,
  openRate: 0,
  activeCampaigns: [],
  activity: [],
  channelHealth: [],
  weekly: [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ],
};

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Administrator",
  manager: "Manager",
  caller: "Caller",
};

export default function Dashboard() {
  const {
    user,
  } = useAuth();

  const [
    data,
    setData,
  ] = useState(
    defaultMetrics
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const role = useMemo(
    () =>
      normalizeRole(
        user?.workspaceRole ||
          user?.role ||
          "caller"
      ),
    [
      user?.workspaceRole,
      user?.role,
    ]
  );

  const isOwner =
    role === "owner";

  const isAdmin =
    role === "admin";

  const isManager =
    role === "manager";

  const isCaller =
    role === "caller";

  const canViewCampaignMetrics =
    isManager;

  const canManageChannels =
    isOwner ||
    isAdmin ||
    isManager;

  useEffect(() => {
    let alive = true;

    async function loadDashboard() {
      try {
        setError("");

        const payload =
          await api.dashboard();

        if (!alive) {
          return;
        }

        setData({
          ...defaultMetrics,
          ...(payload || {}),
          activeCampaigns:
            Array.isArray(
              payload?.activeCampaigns
            )
              ? payload.activeCampaigns
              : [],
          activity:
            Array.isArray(
              payload?.activity
            )
              ? payload.activity
              : [],
          channelHealth:
            Array.isArray(
              payload?.channelHealth
            )
              ? payload.channelHealth
              : [],
          weekly:
            Array.isArray(
              payload?.weekly
            )
              ? payload.weekly
              : defaultMetrics.weekly,
        });
      } catch (requestError) {
        if (!alive) {
          return;
        }

        setError(
          requestError?.message ||
            "The dashboard could not be loaded."
        );
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    const timer =
      window.setInterval(
        () => {
          void loadDashboard();
        },
        15_000
      );

    return () => {
      alive = false;

      window.clearInterval(
        timer
      );
    };
  }, []);

  const account =
    useMemo(() => {
      const isCompany =
        user?.accountType ===
          "company" ||
        user?.workspaceType ===
          "company" ||
        user?.companyAccount ===
          true;

      return {
        isCompany,

        title: isCompany
          ? user?.companyName ||
            user?.workspaceName ||
            "Company workspace"
          : user?.name ||
            user?.fullName ||
            "Individual workspace",

        type: isCompany
          ? "Company account"
          : "Individual account",

        role:
          ROLE_LABELS[role] ||
          "Workspace member",

        email:
          user?.email ||
          "No email found",

        icon: isCompany
          ? Building2
          : UserRound,
      };
    }, [
      user,
      role,
    ]);

  const cards =
    useMemo(() => {
      if (isCaller) {
        return [
          {
            label:
              "Assigned leads",
            value:
              Number(
                data.assignedLeads ??
                  data.totalLeads ??
                  0
              ),
            trend:
              "available in My assigned leads",
            color:
              "purple",
            icon:
              Users,
          },
          {
            label:
              "Calls completed",
            value:
              Number(
                data.callsCompleted ??
                  data.completedCalls ??
                  0
              ),
            trend:
              "caller activity",
            color:
              "green",
            icon:
              MessageCircle,
          },
          {
            label:
              "Tasks completed",
            value:
              Number(
                data.completedTasks ??
                  0
              ),
            trend:
              "workspace assignments",
            color:
              "amber",
            icon:
              Zap,
          },
          {
            label:
              "Reply rate",
            value:
              `${Number(
                data.replyRate ||
                  0
              )}%`,
            trend:
              `${Number(
                data.openRate ||
                  0
              )}% open rate`,
            color:
              "blue",
            icon:
              TrendingUp,
          },
        ];
      }

      if (
        isOwner ||
        isAdmin
      ) {
        return [
          {
            label:
              "Workspace leads",
            value:
              Number(
                data.totalLeads ||
                  0
              ),
            trend:
              "workspace visibility",
            color:
              "purple",
            icon:
              Users,
          },
          {
            label:
              "Emails sent",
            value:
              Number(
                data.emailsSent ||
                  0
              ),
            trend:
              "team outreach",
            color:
              "green",
            icon:
              Mail,
          },
          {
            label:
              "WhatsApp sent",
            value:
              Number(
                data.whatsappSent ||
                  0
              ),
            trend:
              "team outreach",
            color:
              "amber",
            icon:
              MessageCircle,
          },
          {
            label:
              "Reply rate",
            value:
              `${Number(
                data.replyRate ||
                  0
              )}%`,
            trend:
              `${Number(
                data.openRate ||
                  0
              )}% open rate`,
            color:
              "blue",
            icon:
              TrendingUp,
          },
        ];
      }

      return [
        {
          label:
            "Total leads generated",
          value:
            Number(
              data.totalLeads ||
                0
            ),
          trend:
            "from manager campaigns",
          color:
            "purple",
          icon:
            Users,
        },
        {
          label:
            "Emails sent",
          value:
            Number(
              data.emailsSent ||
                0
            ),
          trend:
            "campaign activity",
          color:
            "green",
          icon:
            Mail,
        },
        {
          label:
            "WhatsApp sent",
          value:
            Number(
              data.whatsappSent ||
                0
            ),
          trend:
            "campaign activity",
          color:
            "amber",
          icon:
            MessageCircle,
        },
        {
          label:
            "Reply rate",
          value:
            `${Number(
              data.replyRate ||
                0
            )}%`,
          trend:
            `${Number(
              data.openRate ||
                0
            )}% open rate`,
          color:
            "blue",
          icon:
            TrendingUp,
        },
      ];
    }, [
      data,
      isCaller,
      isOwner,
      isAdmin,
    ]);

  const pageContent =
    getPageContent(role);

  return (
    <div className="page dashboard-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {pageContent.eyebrow}
          </span>

          <h1>
            {pageContent.title}
          </h1>

          <p>
            {pageContent.description}
          </p>
        </div>

        <div className="flex flex-gap">
          {(isOwner ||
            isAdmin ||
            isManager) ? (
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                window.print();
              }}
            >
              Export report
            </button>
          ) : null}

          {isManager ? (
            <Link
              to="/app/builder"
              className="btn primary"
            >
              <Zap size={14} />

              Generate leads
            </Link>
          ) : null}

          {isCaller ? (
            <Link
              to="/app/my-leads"
              className="btn primary"
            >
              <Users size={14} />

              My assigned leads
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          className="alert alert-error mb24"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="dashboard-account-card mb24">
        <div className="dashboard-account-main">
          <span className="dashboard-brand-logo">
            <BrandLogo size={62} />
          </span>

          <div>
            <small>
              Signed in workspace
            </small>

            <h2>
              {account.title}
            </h2>

            <p>
              {account.type} ·{" "}
              {account.role}
            </p>
          </div>
        </div>

        <div className="dashboard-account-meta">
          <div>
            <small>
              Email
            </small>

            <b>
              {account.email}
            </b>
          </div>

          <div>
            <small>
              Workspace type
            </small>

            <b>
              {account.isCompany
                ? "Company"
                : "Individual"}
            </b>
          </div>

          <Link
            to="/app/profile-settings"
            className="btn light small"
          >
            Manage profile
          </Link>
        </div>
      </section>

      <div className="grid4 mt24 mb24">
        {cards.map(
          ({
            label,
            value,
            trend,
            color,
            icon: Icon,
          }) => (
            <div
              key={label}
              className={`metric-card ${color}`}
            >
              <div
                className={`metric-icon ${color}`}
              >
                <Icon size={18} />
              </div>

              <div className="metric-num">
                {loading
                  ? "…"
                  : value}
              </div>

              <div className="metric-label">
                {label}
              </div>

              <div className="metric-trend up">
                ↑ {trend}
              </div>
            </div>
          )
        )}
      </div>

      {isCaller ? (
        <CallerDashboardContent
          data={data}
          loading={loading}
        />
      ) : (
        <ManagementDashboardContent
          data={data}
          loading={loading}
          isManager={isManager}
          canManageChannels={
            canManageChannels
          }
          canViewCampaignMetrics={
            canViewCampaignMetrics
          }
        />
      )}
    </div>
  );
}

function ManagementDashboardContent({
  data,
  isManager,
  canManageChannels,
  canViewCampaignMetrics,
}) {
  return (
    <>
      <div className="grid2 mb24">
        <div className="card">
          <div className="flex flex-between mb16">
            <h3>
              Workspace performance
            </h3>

            <span className="badge badge-gray">
              Last 7 days
            </span>
          </div>

          <WeeklyChart
            values={data.weekly}
          />

          <div className="flex mt16 stats-row">
            {[
              [
                data.emailsSent ||
                  0,
                "Emails sent",
              ],
              [
                data.whatsappSent ||
                  0,
                "WhatsApp sent",
              ],
              [
                data.replies ||
                  0,
                "Replies",
              ],
            ].map(
              ([
                number,
                label,
              ]) => (
                <div key={label}>
                  <div className="metric-num sm">
                    {number}
                  </div>

                  <div className="text-xs text-muted">
                    {label}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {isManager &&
        canViewCampaignMetrics ? (
          <div className="card">
            <div className="flex flex-between mb16">
              <h3>
                Active campaigns
              </h3>

              <Link
                to="/app/campaigns/active"
                className="btn ghost small"
              >
                View all
              </Link>
            </div>

            <CampaignSummary
              campaigns={
                data.activeCampaigns
              }
            />

            <Link
              to="/app/builder"
              className="btn primary small full mt16"
            >
              <Zap size={13} />

              Generate new leads
            </Link>
          </div>
        ) : (
          <div className="card">
            <div className="flex flex-between mb16">
              <h3>
                Team oversight
              </h3>

              <Link
                to="/app/role-operations"
                className="btn ghost small"
              >
                Open team
              </Link>
            </div>

            <EmptyState
              title="Workspace oversight"
              text="Review team activity, assignments, calls, performance, and workspace settings from Team operations."
            />

            <Link
              to="/app/role-operations"
              className="btn primary small full mt16"
            >
              <Users size={13} />

              View team operations
            </Link>
          </div>
        )}
      </div>

      <div className="grid2">
        <RecentActivity
          activity={data.activity}
        />

        <ChannelHealth
          channelHealth={
            data.channelHealth
          }
          canManageChannels={
            canManageChannels
          }
        />
      </div>
    </>
  );
}

function CallerDashboardContent({
  data,
}) {
  return (
    <>
      <div className="grid2 mb24">
        <div className="card">
          <div className="flex flex-between mb16">
            <h3>
              My work activity
            </h3>

            <span className="badge badge-gray">
              Last 7 days
            </span>
          </div>

          <WeeklyChart
            values={data.weekly}
          />

          <div className="flex mt16 stats-row">
            {[
              [
                data.callsCompleted ||
                  data.completedCalls ||
                  0,
                "Calls completed",
              ],
              [
                data.completedTasks ||
                  0,
                "Tasks completed",
              ],
              [
                data.replies ||
                  0,
                "Replies",
              ],
            ].map(
              ([
                number,
                label,
              ]) => (
                <div key={label}>
                  <div className="metric-num sm">
                    {number}
                  </div>

                  <div className="text-xs text-muted">
                    {label}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex flex-between mb16">
            <h3>
              Assigned leads
            </h3>

            <Link
              to="/app/my-leads"
              className="btn ghost small"
            >
              Open leads
            </Link>
          </div>

          <EmptyState
            title="Your caller workspace"
            text="Review assigned leads, contact history, tasks, mini audits, and calling actions from My assigned leads."
          />

          <Link
            to="/app/my-leads"
            className="btn primary small full mt16"
          >
            <Users size={13} />

            View assigned leads
          </Link>
        </div>
      </div>

      <div className="grid2">
        <RecentActivity
          activity={data.activity}
        />

        <div className="card">
          <h3 className="mb12">
            Team communication
          </h3>

          <EmptyState
            title="Stay connected"
            text="Open team communication to message coworkers, review work assignments, or start an internal call."
          />

          <Link
            to="/app/role-operations?tab=communication"
            className="btn ghost small full mt16"
          >
            <MessageCircle size={13} />

            Open team communication
          </Link>
        </div>
      </div>
    </>
  );
}

function WeeklyChart({
  values,
}) {
  const weekly =
    Array.isArray(values)
      ? values
      : defaultMetrics.weekly;

  return (
    <>
      <div className="mini-chart">
        {weekly.map(
          (
            height,
            index
          ) => (
            <div
              key={index}
              className={`mini-bar ${
                index ===
                weekly.length - 1
                  ? "accent"
                  : ""
              }`}
              style={{
                height: `${Math.max(
                  10,
                  Number(
                    height || 0
                  )
                )}%`,
              }}
            />
          )
        )}
      </div>

      <div className="flex flex-between mt8">
        {[
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
          "Sun",
        ].map(
          (day) => (
            <span
              key={day}
              className="text-xs text-muted"
            >
              {day}
            </span>
          )
        )}
      </div>
    </>
  );
}

function CampaignSummary({
  campaigns,
}) {
  const items =
    Array.isArray(campaigns)
      ? campaigns
      : [];

  if (
    items.length === 0
  ) {
    return (
      <EmptyState
        title="No active campaigns"
        text="Generate leads and launch a manager campaign to see live progress here."
      />
    );
  }

  return items
    .slice(0, 4)
    .map(
      (campaign) => (
        <div
          key={campaign.id}
          className="campaign-row"
        >
          <div className="flex flex-gap">
            <div
              className={`status-dot ${
                campaign.status ||
                "active"
              }`}
            />

            <div>
              <div className="fw700">
                {campaign.name ||
                  "Untitled campaign"}
              </div>

              <div className="text-xs text-muted">
                {campaign.leadCount ||
                  campaign.leads?.length ||
                  0}{" "}
                leads ·{" "}
                {campaign.progress
                  ?.percent ||
                  0}
                % complete
              </div>
            </div>
          </div>

          <span
            className={`badge badge-${
              campaign.status ===
              "active"
                ? "green"
                : "amber"
            }`}
          >
            {campaign.status ||
              "active"}
          </span>
        </div>
      )
    );
}

function RecentActivity({
  activity,
}) {
  const items =
    Array.isArray(activity)
      ? activity
      : [];

  return (
    <div className="card">
      <h3 className="mb12">
        Recent activity
      </h3>

      {items.length === 0 ? (
        <p className="text-muted">
          No activity yet.
        </p>
      ) : (
        items.map(
          (item) => (
            <div
              key={
                item.id ||
                `${item.title}-${item.time}`
              }
              className="activity-row"
            >
              <div>
                {item.icon ||
                  "🎯"}
              </div>

              <div>
                <b>
                  {item.title ||
                    "Workspace activity"}
                </b>

                <small>
                  {item.sub ||
                    item.description ||
                    ""}
                </small>
              </div>

              <span>
                {item.time ||
                  ""}
              </span>
            </div>
          )
        )
      )}
    </div>
  );
}

function ChannelHealth({
  channelHealth,
  canManageChannels,
}) {
  const items =
    Array.isArray(
      channelHealth
    )
      ? channelHealth
      : [];

  return (
    <div className="card">
      <h3 className="mb12">
        Channel health
      </h3>

      {items.length === 0 ? (
        <EmptyState
          title="No channel health data"
          text="Configure email and communication channels to view their status here."
        />
      ) : (
        items.map(
          (item) => (
            <div
              key={
                item.name
              }
              className="channel-row"
            >
              <b>
                {item.name}
              </b>

              <span
                className={`badge badge-${
                  item.color ||
                  "gray"
                }`}
              >
                {item.status ||
                  "Unknown"}
              </span>
            </div>
          )
        )
      )}

      {canManageChannels ? (
        <Link
          to="/app/email"
          className="btn ghost small full mt16"
        >
          <ArrowRight size={13} />

          Manage channels
        </Link>
      ) : null}
    </div>
  );
}

function getPageContent(
  role
) {
  if (role === "manager") {
    return {
      eyebrow:
        "Manager overview",

      title:
        "Lead generation dashboard",

      description:
        "Generate leads, launch campaigns, assign prospects to callers, and monitor outreach performance.",
    };
  }

  if (role === "caller") {
    return {
      eyebrow:
        "Caller overview",

      title:
        "My work dashboard",

      description:
        "Review assigned leads, calling activity, tasks, replies, and team communication.",
    };
  }

  if (
    role === "owner" ||
    role === "admin"
  ) {
    return {
      eyebrow:
        "Workspace overview",

      title:
        "Company dashboard",

      description:
        "Monitor workspace health, team performance, communication channels, and company operations.",
    };
  }

  return {
    eyebrow:
      "Overview",

    title:
      "Growth dashboard",

    description:
      "Review workspace activity and performance.",
  };
}

function normalizeRole(value) {
  const role = String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

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

  return role || "caller";
}