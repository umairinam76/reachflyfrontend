import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiRequest,
  getRoleDashboard,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import DailyLeadManagerPanel from "./DailyLeadManagerPanel.jsx";
import AuditStudioPanel from "./AuditStudioPanel.jsx";

const ROLE_LABELS = {
  owner: "Owner workspace",
  admin: "Administration",
  manager: "Manager workspace",
  caller: "Caller workspace",
  viewer: "Workspace",
};

export default function RoleDashboard() {
  const [dashboard, setDashboard] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [workspacePulse, setWorkspacePulse] =
    useState({
      voice: null,
      billing: null,
      loaded: false,
    });

  const loadWorkspacePulse = useCallback(
    async (role) => {
      const normalizedRole =
        String(role || "")
          .trim()
          .toLowerCase();

      const canUseVoice =
        ["owner", "admin", "manager"].includes(
          normalizedRole
        );

      const canViewBilling =
        ["owner", "admin"].includes(
          normalizedRole
        );

      if (!canUseVoice && !canViewBilling) {
        setWorkspacePulse({
          voice: null,
          billing: null,
          loaded: true,
        });
        return;
      }

      const [voiceResult, billingResult] =
        await Promise.all([
          canUseVoice
            ? apiRequest(
                "/telnyx/ai-agent/dashboard",
                {
                  timeoutMs: 15_000,
                }
              )
                .then((value) => ({
                  ok: true,
                  value,
                }))
                .catch(() => ({
                  ok: false,
                  value: null,
                }))
            : Promise.resolve({
                ok: false,
                value: null,
              }),

          canViewBilling
            ? apiRequest(
                "/billing/credits",
                {
                  timeoutMs: 15_000,
                }
              )
                .then((value) => ({
                  ok: true,
                  value,
                }))
                .catch(() => ({
                  ok: false,
                  value: null,
                }))
            : Promise.resolve({
                ok: false,
                value: null,
              }),
        ]);

      setWorkspacePulse({
        voice: voiceResult.ok
          ? voiceResult.value
          : null,
        billing: billingResult.ok
          ? billingResult.value
          : null,
        loaded: true,
      });
    },
    []
  );

  const loadDashboard = useCallback(
    async ({
      silent = false,
    } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result =
          await getRoleDashboard();

        setDashboard(result);

        void loadWorkspacePulse(
          result?.role || "viewer"
        );
      } catch (requestError) {
        setError(
          requestError?.message ||
            "The dashboard could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadWorkspacePulse]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const events = [
      "attendance:checked-in",
      "attendance:checked-out",
      "attendance:reviewed",
      "attendance:status-updated",
      "profile:updated",
      "profile:availability-updated",
      "presence:update",
      "message:new",
      "webrtc:call:ended",
      "lead:updated",
      "task:created",
      "task:updated",
      "task:completed",
      "telnyx-ai-agent:updated",
      "telnyx-ai-agent:call-updated",
      "telnyx-ai-agent:meeting-booked",
    ];

    const unsubscribe = events.map(
      (event) =>
        onWorkspaceSocket(
          event,
          () => {
            loadDashboard({
              silent: true,
            });
          }
        )
    );

    return () => {
      for (const stop of unsubscribe) {
        stop();
      }
    };
  }, [loadDashboard]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error && !dashboard) {
    return (
      <DashboardError
        message={error}
        onRetry={() =>
          loadDashboard()
        }
      />
    );
  }

  const role =
    dashboard?.role || "viewer";

  return (
    <main className="rf-role-dashboard rf-role-dashboard-v7">
      <RoleDashboardV7Styles />
      <DashboardHeader
        dashboard={dashboard}
        refreshing={refreshing}
        onRefresh={() =>
          loadDashboard({
            silent: true,
          })
        }
      />

      {error ? (
        <div className="rf-inline-alert">
          <span>{safeDashboardMessage(error)}</span>

          <button
            type="button"
            onClick={() =>
              loadDashboard({
                silent: true,
              })
            }
          >
            Retry
          </button>
        </div>
      ) : null}

      {["owner", "admin", "manager"].includes(
        role
      ) ? (
        <WorkspaceSalesPulse
          role={role}
          pulse={workspacePulse}
        />
      ) : null}

      {role === "owner" ? (
        <OwnerDashboard
          dashboard={dashboard}
        />
      ) : null}

      {role === "admin" ? (
        <AdminDashboard
          dashboard={dashboard}
        />
      ) : null}

      {role === "manager" ? (
        <ManagerDashboard
          dashboard={dashboard}
        />
      ) : null}

      {[
        "caller",
        "viewer",
      ].includes(role) ? (
        <CallerDashboard
          dashboard={dashboard}
        />
      ) : null}
    </main>
  );
}

function DashboardHeader({
  dashboard,
  refreshing,
  onRefresh,
}) {
  const currentUser =
    dashboard?.currentUser || {};

  const workspace =
    dashboard?.workspace || {};

  const role =
    dashboard?.role || "viewer";

  return (
    <header className="rf-dashboard-header">
      <div className="rf-dashboard-header__identity">
        <Avatar
          user={currentUser}
          size="large"
        />

        <div>
          <p className="rf-dashboard-eyebrow">
            {ROLE_LABELS[role] ||
              "Workspace"}
          </p>

          <h1>
            Welcome back,{" "}
            {firstName(
              currentUser.name
            )}
          </h1>

          <p className="rf-dashboard-subtitle">
            {workspace.companyName ||
              workspace.name ||
              "ReachFly workspace"}
          </p>
        </div>
      </div>

      <div className="rf-dashboard-header__actions">
        <div className="rf-server-status">
          <span className="rf-status-dot" />

          <div>
            <strong>Workspace data</strong>
            <small>
              Live updates + manual refresh
            </small>
          </div>
        </div>

        <button
          type="button"
          className="rf-button rf-button--secondary"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing…"
            : "Refresh"}
        </button>
      </div>
    </header>
  );
}

function WorkspaceSalesPulse({
  role,
  pulse = {},
}) {
  const voice = pulse.voice;
  const billing = pulse.billing;

  const voiceSummary =
    voice?.summary || {};

  const voiceDiagnostics =
    voice?.diagnostics || {};

  const voiceAgent =
    voice?.agent || null;

  const billingWallet =
    billing?.wallet || null;

  const callWallet =
    billing?.aiCalling?.wallet || null;

  const canViewBilling =
    ["owner", "admin"].includes(
      String(role || "")
        .trim()
        .toLowerCase()
    );

  if (
    pulse.loaded &&
    !voice &&
    !billing
  ) {
    return (
      <section className="rf-panel">
        <PanelHeader
          title="Sales command center"
          subtitle="Voice Agent and billing status will appear here when those workspace services are available."
          action={
            <a
              href="/app/voice-agent"
              className="rf-text-link"
            >
              Open Voice Agent
            </a>
          }
        />

        <EmptyState
          title="Workspace services still connecting"
          description="The main dashboard is available. Voice Agent and billing are loaded independently so a temporary optional-service error does not block the workspace."
        />
      </section>
    );
  }

  const items = [];

  if (voice) {
    items.push(
      {
        label: "Voice Agent",
        value:
          voiceDiagnostics.configured &&
          voiceAgent
            ? "Ready"
            : "Setup",
        note:
          voiceAgent?.name ||
          "Configuration required",
        icon: "VA",
      },
      {
        label: "AI calls live",
        value: firstNumber(
          voiceSummary,
          [
            "activeCalls",
            "liveCalls",
          ],
          0
        ),
        note: "Current conversations",
        icon: "AI",
      },
      {
        label: "Voice queue",
        value: firstNumber(
          voiceSummary,
          [
            "queuedLeads",
            "queued",
          ],
          0
        ),
        note: "Waiting to be called",
        icon: "VQ",
      },
      {
        label: "Meetings",
        value: firstNumber(
          voiceSummary,
          [
            "meetingsUpcoming",
            "upcomingMeetings",
          ],
          0
        ),
        note: "Upcoming AI-booked meetings",
        icon: "MT",
      }
    );
  }

  if (
    canViewBilling &&
    billingWallet
  ) {
    items.push({
      label: "ReachFly credits",
      value: formatCreditNumber(
        billingWallet.balance
      ),
      note: `${formatCreditNumber(
        billingWallet.reserved
      )} reserved`,
      icon: "CR",
    });
  }

  if (
    canViewBilling &&
    callWallet
  ) {
    items.push({
      label: "AI call credits",
      value: formatCreditNumber(
        callWallet.balance
      ),
      note: callWallet.testGrantAppliedAt
        ? "Dedicated calling balance"
        : "Onboarding grant available",
      icon: "CC",
    });
  }

  if (!items.length) {
    return null;
  }

  return (
    <>
      <MetricGrid items={items} />

      <section className="rf-panel">
        <PanelHeader
          title="Sales command center"
          subtitle="Current Voice Agent, calling and workspace-credit status."
          action={
            <div className="rf-dashboard-header__actions">
              <a
                href="/app/voice-agent"
                className="rf-text-link"
              >
                Voice Agent
              </a>

              {canViewBilling ? (
                <a
                  href="/app/billing"
                  className="rf-text-link"
                >
                  Credits & usage
                </a>
              ) : null}
            </div>
          }
        />

        <div className="rf-tool-card-list">
          <ToolRow
            label="Voice configuration"
            value={
              voice
                ? voiceDiagnostics.configured
                  ? "Ready"
                  : "Needs setup"
                : "Unavailable"
            }
            secondary={
              voiceAgent?.name || ""
            }
          />

          <ToolRow
            label="Business number"
            value={
              voice?.diagnostics
                ?.selectedFromNumber ||
              voiceAgent?.fromNumber ||
              "Not connected"
            }
          />

          <ToolRow
            label="Callable leads"
            value={
              voice
                ? firstNumber(
                    voiceSummary,
                    [
                      "assignableLeads",
                      "readyLeads",
                    ],
                    0
                  )
                : "—"
            }
          />

          {canViewBilling ? (
            <ToolRow
              label="Billing"
              value={
                billing
                  ? "Connected"
                  : "Unavailable"
              }
              secondary={
                billing?.safepay
                  ?.configured
                  ? "Checkout configured"
                  : "Usage tracking available"
              }
            />
          ) : null}
        </div>
      </section>
    </>
  );
}

function OwnerDashboard({
  dashboard,
}) {
  const summary =
    dashboard.summary || {};

  return (
    <>
      <MetricGrid
        items={[
          {
            label: "Team members",
            value:
              summary.teamMembers || 0,
            note: `${
              summary.managers || 0
            } managers · ${
              summary.callers || 0
            } callers`,
            icon: "TM",
          },
          {
            label: "Active campaigns",
            value:
              summary.activeCampaigns ||
              0,
            note: `${
              summary.totalLeads || 0
            } total leads`,
            icon: "AC",
          },
          {
            label: "Calls today",
            value:
              summary.callsToday || 0,
            note: `${
              summary.answeredCallsToday ||
              0
            } answered`,
            icon: "CT",
          },
          {
            label: "Attendance",
            value:
              summary.checkedInToday ||
              0,
            note: `${
              summary.onlineNow || 0
            } currently online`,
            icon: "AT",
          },
          {
            label: "Assigned leads",
            value:
              summary.assignedLeads ||
              0,
            note: "Across all teams",
            icon: "AL",
          },
          {
            label: "Audit reports",
            value:
              summary.auditsGenerated ||
              0,
            note: "Completed reports",
            icon: "AR",
          },
        ]}
      />

      <DashboardColumns
        primary={
          <TeamPerformanceTable
            rows={
              dashboard.teamPerformance ||
              []
            }
            title="Team performance"
            subtitle="Live caller, manager and attendance performance."
          />
        }
        secondary={
          <AttendanceSummaryCard
            attendance={
              dashboard.attendance
            }
          />
        }
      />

      <DashboardColumns
        primary={
          <RecentCallsCard
            calls={
              dashboard.recentCalls ||
              []
            }
          />
        }
        secondary={
          <SystemConfigurationCard
            system={dashboard.system}
            reportConfiguration={
              dashboard.reportConfiguration
            }
          />
        }
      />

      <ActivityCard
        items={
          dashboard.recentActivity ||
          []
        }
      />
    </>
  );
}

function AdminDashboard({
  dashboard,
}) {
  const summary =
    dashboard.summary || {};

  return (
    <>
      <MetricGrid
        items={[
          {
            label: "Active members",
            value:
              summary.activeMembers || 0,
            note: `${
              summary.suspendedMembers ||
              0
            } suspended`,
            icon: "AM",
          },
          {
            label: "Calling connections",
            value:
              summary.configuredDialers ||
              0,
            note: "Ready calling resources",
            icon: "DL",
          },
          {
            label: "Sender identities",
            value:
              summary.configuredSenders ||
              0,
            note: "Approved sender identities",
            icon: "SI",
          },
          {
            label: "Team channels",
            value:
              summary.teamChannels || 0,
            note: "Internal communication",
            icon: "TC",
          },
          {
            label: "Calls today",
            value:
              summary.callsToday || 0,
            note: "Workspace activity",
            icon: "CL",
          },
          {
            label: "Security events",
            value:
              summary.unreadSecurityEvents ||
              0,
            note: "Awaiting review",
            icon: "SE",
          },
        ]}
      />

      <TeamDirectoryCard
        members={
          dashboard.members || []
        }
      />

      <DashboardColumns
        primary={
          <ActivityCard
            title="Security events"
            items={
              dashboard.securityEvents ||
              []
            }
          />
        }
        secondary={
          <ActivityCard
            title="System activity"
            items={
              dashboard.systemActivity ||
              []
            }
          />
        }
      />
    </>
  );
}

function ManagerDashboard({
  dashboard,
}) {
  const summary =
    dashboard.summary || {};

  return (
    <>
      <DailyLeadManagerPanel />
      <AuditStudioPanel />

      <MetricGrid
        items={[
          {
            label: "Managed members",
            value:
              summary.managedMembers ||
              0,
            note: `${
              summary.onlineNow || 0
            } online`,
            icon: "MM",
          },
          {
            label: "Checked in",
            value:
              summary.checkedIn || 0,
            note: "Today's attendance",
            icon: "CI",
          },
          {
            label: "Assigned leads",
            value:
              summary.assignedLeads || 0,
            note: `${
              summary.followUpsDue || 0
            } follow-ups due`,
            icon: "LD",
          },
          {
            label: "Calls today",
            value:
              summary.callsToday || 0,
            note: `${
              summary.answeredToday || 0
            } answered`,
            icon: "CT",
          },
          {
            label: "Pending tasks",
            value:
              summary.pendingTasks || 0,
            note: "Team workload",
            icon: "PT",
          },
        ]}
      />

      <TeamPerformanceTable
        rows={dashboard.team || []}
        title="Managed team"
        subtitle="Attendance, calls, assigned leads and conversion progress."
      />

      <DashboardColumns
        primary={
          <AssignmentsCard
            assignments={
              dashboard.assignments || []
            }
          />
        }
        secondary={
          <TaskListCard
            tasks={
              dashboard.tasks || []
            }
          />
        }
      />

      <DashboardColumns
        primary={
          <RecentCallsCard
            calls={
              dashboard.recentCalls ||
              []
            }
          />
        }
        secondary={
          <OverdueActionsCard
            actions={
              dashboard.overdueActions ||
              []
            }
          />
        }
      />
    </>
  );
}

function CallerDashboard({
  dashboard,
}) {
  const summary =
    dashboard.summary || {};

  return (
    <>
      <AttendanceHero
        attendance={
          dashboard.attendance
        }
      />

      <MetricGrid
        items={[
          {
            label: "Assigned leads",
            value:
              summary.assignedLeads || 0,
            note: "Ready for outreach",
            icon: "AL",
          },
          {
            label: "Calls today",
            value:
              summary.callsToday || 0,
            note: `${
              summary.answeredCalls || 0
            } answered`,
            icon: "CT",
          },
          {
            label: "Callbacks due",
            value:
              summary.callbacksDue || 0,
            note: "Follow-up queue",
            icon: "CB",
          },
          {
            label: "Qualified leads",
            value:
              summary.qualifiedLeads || 0,
            note: `${
              summary.meetingsBooked ||
              0
            } meetings booked`,
            icon: "QL",
          },
          {
            label: "Pending tasks",
            value:
              summary.pendingTasks || 0,
            note: "Personal workload",
            icon: "PT",
          },
          {
            label: "Talk time",
            value: formatDuration(
              summary.totalCallSeconds ||
                0
            ),
            note: "Today",
            icon: "TT",
          },
        ]}
      />

      <DashboardColumns
        primary={
          <AssignedLeadCard
            assignments={
              dashboard.assignedLeads ||
              []
            }
          />
        }
        secondary={
          <AssignedToolsCard
            tools={
              dashboard.assignedTools
            }
            communication={
              dashboard.communication
            }
          />
        }
      />

      <DashboardColumns
        primary={
          <TaskListCard
            tasks={dashboard.tasks || []}
            title="My tasks"
          />
        }
        secondary={
          <CallbacksCard
            callbacks={
              dashboard.upcomingCallbacks ||
              []
            }
          />
        }
      />

      <RecentCallsCard
        calls={
          dashboard.recentCalls || []
        }
        title="My recent calls"
      />
    </>
  );
}

function MetricGrid({ items }) {
  return (
    <section className="rf-metric-grid">
      {items.map((item) => (
        <article
          className="rf-metric-card"
          key={item.label}
        >
          <div className="rf-metric-card__icon">
            {item.icon}
          </div>

          <div>
            <p>{item.label}</p>

            <strong>{item.value}</strong>

            <small>{item.note}</small>
          </div>
        </article>
      ))}
    </section>
  );
}

function DashboardColumns({
  primary,
  secondary,
}) {
  return (
    <section className="rf-dashboard-columns">
      <div className="rf-dashboard-columns__primary">
        {primary}
      </div>

      <div className="rf-dashboard-columns__secondary">
        {secondary}
      </div>
    </section>
  );
}

function TeamPerformanceTable({
  rows,
  title,
  subtitle,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title={title}
        subtitle={subtitle}
      />

      {!rows.length ? (
        <EmptyState
          title="No team performance yet"
          description="Performance appears after members receive work and begin activity."
        />
      ) : (
        <div className="rf-table-wrap">
          <table className="rf-table">
            <thead>
              <tr>
                <th>Team member</th>
                <th>Attendance</th>
                <th>Assigned</th>
                <th>Calls</th>
                <th>Answered</th>
                <th>Qualified</th>
                <th>Meetings</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const member =
                  row.member || {};

                const metrics =
                  row.metrics || {};

                return (
                  <tr key={member.id}>
                    <td>
                      <MemberIdentity
                        member={member}
                        online={row.online}
                      />
                    </td>

                    <td>
                      <StatusBadge
                        value={
                          row.attendance
                            ?.status ||
                          "not_checked_in"
                        }
                      />
                    </td>

                    <td>
                      {metrics.assignedLeads ||
                        0}
                    </td>

                    <td>
                      {metrics.totalCalls ||
                        0}
                    </td>

                    <td>
                      {metrics.answeredCalls ||
                        0}
                    </td>

                    <td>
                      {metrics.qualifiedLeads ||
                        0}
                    </td>

                    <td>
                      {metrics.meetingsBooked ||
                        0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AttendanceSummaryCard({
  attendance = {},
}) {
  const records =
    attendance.records || [];

  return (
    <section className="rf-panel">
      <PanelHeader
        title="Attendance today"
        subtitle={
          attendance.date ||
          "Current workday"
        }
      />

      <div className="rf-summary-list">
        <SummaryRow
          label="Checked in"
          value={
            attendance.checkedIn || 0
          }
        />

        <SummaryRow
          label="Checked out"
          value={
            attendance.checkedOut || 0
          }
        />

        <SummaryRow
          label="Present"
          value={
            attendance.present || 0
          }
        />

        <SummaryRow
          label="Late"
          value={attendance.late || 0}
        />

        <SummaryRow
          label="Half day"
          value={
            attendance.halfDay || 0
          }
        />
      </div>

      {records.length ? (
        <div className="rf-avatar-stack">
          {records
            .slice(0, 8)
            .map((record) => (
              <div
                key={record.id}
                title={record.userName}
              >
                <Avatar
                  user={{
                    name:
                      record.userName,
                    avatarUrl:
                      record.userAvatar,
                  }}
                />
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}

function AttendanceHero({
  attendance,
}) {
  const checkedIn =
    Boolean(
      attendance?.checkedInAt
    );

  const checkedOut =
    Boolean(
      attendance?.checkedOutAt
    );

  return (
    <section className="rf-attendance-hero">
      <div>
        <p className="rf-dashboard-eyebrow">
          Daily attendance
        </p>

        <h2>
          {!checkedIn
            ? "You have not checked in"
            : checkedOut
              ? "Workday completed"
              : "You are checked in"}
        </h2>

        <p>
          {!checkedIn
            ? "Capture a live picture from the attendance page to begin your workday."
            : checkedOut
              ? `Worked ${formatDuration(
                  attendance.totalWorkedSeconds ||
                    0
                )}.`
              : `Checked in at ${formatTime(
                  attendance.checkedInAt
                )}.`}
        </p>
      </div>

      <StatusBadge
        value={
          attendance?.status ||
          "not_checked_in"
        }
        large
      />
    </section>
  );
}

function AssignedLeadCard({
  assignments,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Assigned leads"
        subtitle="Lead details and mini audits are available directly from your call workspace."
        action={
          <a
            href="/app/my-leads"
            className="rf-text-link"
          >
            Open all
          </a>
        }
      />

      {!assignments.length ? (
        <EmptyState
          title="No leads assigned"
          description="New assignments from your manager will appear here."
        />
      ) : (
        <div className="rf-lead-list">
          {assignments
            .slice(0, 8)
            .map((assignment) => (
              <article
                className="rf-lead-item"
                key={assignment.id}
              >
                <Avatar
                  user={{
                    name:
                      assignment.lead
                        ?.business ||
                      assignment.lead
                        ?.name ||
                      "Lead",
                  }}
                />

                <div className="rf-lead-item__content">
                  <strong>
                    {assignment.lead
                      ?.business ||
                      assignment.lead
                        ?.name ||
                      "Unnamed lead"}
                  </strong>

                  <span>
                    {assignment.lead
                      ?.phone ||
                      "No phone available"}
                  </span>

                  <small>
                    {assignment.lead
                      ?.address ||
                      assignment.lead
                        ?.website ||
                      "Lead details pending"}
                  </small>
                </div>

                <div className="rf-lead-item__actions">
                  {assignment.miniAudit ? (
                    <span className="rf-audit-ready">
                      Mini audit ready
                    </span>
                  ) : (
                    <span className="rf-audit-pending">
                      Audit pending
                    </span>
                  )}

                  <a
                    href={`/app/my-leads?assignment=${encodeURIComponent(
                      assignment.id
                    )}`}
                    className="rf-button rf-button--compact"
                  >
                    Open
                  </a>
                </div>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}

function AssignmentsCard({
  assignments = [],
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Lead assignments"
        subtitle="Recently assigned and active leads."
        action={
          <a
            href="/app/resource-board"
            className="rf-text-link"
          >
            Manage
          </a>
        }
      />

      {!assignments.length ? (
        <EmptyState
          title="No assignments yet"
          description="Assign leads to team members to begin tracking activity."
        />
      ) : (
        <div className="rf-compact-list">
          {assignments
            .slice(0, 10)
            .map((assignment) => {
              const lead =
                assignment.lead || {};

              const leadName =
                lead.business ||
                lead.companyName ||
                lead.name ||
                assignment.leadName ||
                assignment.companyName ||
                "Lead";

              const assignee =
                assignment.assigneeName ||
                assignment.memberName ||
                assignment.callerName ||
                assignment.assignee?.name ||
                "";

              const nextActionAt =
                assignment.nextActionAt ||
                assignment.callbackAt ||
                assignment.dueAt ||
                "";

              return (
                <div
                  className="rf-compact-row"
                  key={
                    assignment.id ||
                    assignment.assignmentId ||
                    `${leadName}-${assignee}`
                  }
                >
                  <div>
                    <strong>
                      {leadName}
                    </strong>

                    <small>
                      {[
                        assignee
                          ? `Assigned to ${assignee}`
                          : "",
                        nextActionAt
                          ? `Next ${formatDateTime(
                              nextActionAt
                            )}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                        "Assignment active"}
                    </small>
                  </div>

                  <StatusBadge
                    value={
                      assignment.status ||
                      "assigned"
                    }
                  />
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}


function TaskListCard({
  tasks = [],
  title = "Team tasks",
}) {
  const visibleTasks =
    [...tasks]
      .sort(compareDashboardTasks)
      .slice(0, 10);

  return (
    <section className="rf-panel">
      <PanelHeader
        title={title}
        subtitle="Overdue work first, then the nearest upcoming deadlines."
      />

      {!visibleTasks.length ? (
        <EmptyState
          title="No pending tasks"
          description="Assigned tasks will appear here."
        />
      ) : (
        <div className="rf-task-list">
          {visibleTasks.map((task) => {
            const dueAt =
              resolveTaskDueAt(task);

            const completed =
              normalizeSimpleStatus(
                task.status
              ) === "completed";

            const overdue =
              !completed &&
              isPastDate(dueAt);

            return (
              <article
                key={
                  task.id ||
                  `${task.title}-${dueAt}`
                }
                className="rf-task-item"
              >
                <div className="rf-task-check">
                  {completed ? "✓" : ""}
                </div>

                <div>
                  <strong>
                    {task.title ||
                      "Task"}
                  </strong>

                  <small>
                    {dueAt
                      ? `${
                          overdue
                            ? "Overdue"
                            : "Due"
                        } ${formatDateTime(
                          dueAt
                        )}`
                      : "No due date"}
                    {task.leadName
                      ? ` · ${task.leadName}`
                      : ""}
                  </small>
                </div>

                {overdue ? (
                  <span className="rf-overdue-label">
                    Overdue
                  </span>
                ) : (
                  <StatusBadge
                    value={
                      task.priority ||
                      task.status ||
                      "pending"
                    }
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}


function RecentCallsCard({
  calls = [],
  title = "Recent calls",
}) {
  const visibleCalls =
    [...calls]
      .sort((left, right) => {
        const rightTime =
          dateValue(
            right.startedAt ||
              right.createdAt ||
              right.updatedAt
          );

        const leftTime =
          dateValue(
            left.startedAt ||
              left.createdAt ||
              left.updatedAt
          );

        return rightTime - leftTime;
      })
      .slice(0, 12);

  return (
    <section className="rf-panel">
      <PanelHeader
        title={title}
        subtitle="Latest human and AI call activity with the recorded outcome."
      />

      {!visibleCalls.length ? (
        <EmptyState
          title="No calls recorded"
          description="Completed and attempted calls will appear here."
        />
      ) : (
        <div className="rf-call-list">
          {visibleCalls.map((call) => {
            const destination =
              call.leadName ||
              call.contactName ||
              call.companyName ||
              call.destinationNumber ||
              call.toNumber ||
              call.phone ||
              "Call";

            const number =
              call.destinationNumber ||
              call.toNumber ||
              call.phone ||
              "";

            const startedAt =
              call.startedAt ||
              call.createdAt ||
              call.updatedAt;

            const duration =
              call.durationSeconds ??
              call.duration ??
              0;

            return (
              <article
                key={
                  call.id ||
                  call.callId ||
                  `${number}-${startedAt}`
                }
                className="rf-call-item"
              >
                <div className="rf-call-icon">
                  ☎
                </div>

                <div className="rf-call-item__content">
                  <strong>
                    {destination}
                  </strong>

                  <small>
                    {[
                      number &&
                      number !== destination
                        ? number
                        : "",
                      formatDateTime(
                        startedAt
                      ),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>

                <div className="rf-call-item__meta">
                  <StatusBadge
                    value={
                      call.outcome ||
                      call.disposition ||
                      call.status ||
                      "unknown"
                    }
                  />

                  <small>
                    {formatDuration(
                      duration
                    )}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}


function CallbacksCard({
  callbacks = [],
}) {
  const visibleCallbacks =
    [...callbacks]
      .sort(
        (left, right) =>
          dateValue(
            resolveCallbackAt(
              left
            )
          ) -
          dateValue(
            resolveCallbackAt(
              right
            )
          )
      )
      .slice(0, 10);

  return (
    <section className="rf-panel">
      <PanelHeader
        title="Upcoming callbacks"
        subtitle="Scheduled follow-ups requiring attention."
      />

      {!visibleCallbacks.length ? (
        <EmptyState
          title="No callbacks due"
          description="Scheduled callbacks will appear here."
        />
      ) : (
        <div className="rf-compact-list">
          {visibleCallbacks.map(
            (callback) => {
              const callbackAt =
                resolveCallbackAt(
                  callback
                );

              return (
                <div
                  className="rf-compact-row"
                  key={
                    callback.id ||
                    `${callback.leadId}-${callbackAt}`
                  }
                >
                  <div>
                    <strong>
                      {callback.leadName ||
                        callback.companyName ||
                        callback.title ||
                        "Follow-up"}
                    </strong>

                    <small>
                      {callbackAt
                        ? formatDateTime(
                            callbackAt
                          )
                        : "Not scheduled"}
                    </small>
                  </div>

                  <StatusBadge
                    value={
                      callback.priority ||
                      callback.status ||
                      "scheduled"
                    }
                  />
                </div>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}


function OverdueActionsCard({
  actions,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Needs attention"
        subtitle="Overdue callbacks and tasks."
      />

      {!actions.length ? (
        <EmptyState
          title="Everything is on track"
          description="No overdue actions were found."
        />
      ) : (
        <div className="rf-compact-list">
          {actions
            .slice(0, 10)
            .map((action) => (
              <div
                className="rf-compact-row"
                key={`${action.type}-${action.id}`}
              >
                <div>
                  <strong>
                    {action.title}
                  </strong>

                  <small>
                    Due{" "}
                    {formatDateTime(
                      action.dueAt ||
                        action.nextActionAt ||
                        action.callbackAt ||
                        action.scheduledAt
                    )}
                  </small>
                </div>

                <span className="rf-overdue-label">
                  Overdue
                </span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

function AssignedToolsCard({
  tools = {},
  communication = {},
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="My work tools"
        subtitle="Dialer, sender identity and communication status."
      />

      <div className="rf-tool-card-list">
        <ToolRow
          label="Assigned dialer"
          value={
            tools.dialer?.name ||
            "Not assigned"
          }
          secondary={
            tools.dialer
              ?.fromNumber || ""
          }
        />

        <ToolRow
          label="Sender identity"
          value={
            tools.sender?.fromName ||
            tools.sender?.name ||
            "Not assigned"
          }
          secondary={
            tools.sender
              ?.fromEmail || ""
          }
        />

        <ToolRow
          label="Unread messages"
          value={
            communication.unreadMessages ||
            0
          }
        />

        <ToolRow
          label="Missed team calls"
          value={
            communication.missedInternalCalls ||
            0
          }
        />
      </div>
    </section>
  );
}

function SystemConfigurationCard({
  system = {},
  reportConfiguration,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Workspace systems"
        subtitle="Configured communication and reporting resources."
      />

      <div className="rf-tool-card-list">
        <ToolRow
          label="Dialers"
          value={
            system.dialers?.length ||
            0
          }
        />

        <ToolRow
          label="Sender identities"
          value={
            system.senders?.length ||
            0
          }
        />

        <ToolRow
          label="Chat channels"
          value={
            system.chatChannels
              ?.length || 0
          }
        />

        <ToolRow
          label="Report format"
          value={
            reportConfiguration?.name ||
            "Default format"
          }
        />
      </div>
    </section>
  );
}

function TeamDirectoryCard({
  members,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Workspace members"
        subtitle="Account, attendance and operational status."
      />

      <div className="rf-member-grid">
        {members.map((item) => {
          const member =
            item.name
              ? item
              : item.member || {};

          return (
            <article
              className="rf-member-card"
              key={member.id}
            >
              <Avatar
                user={member}
                size="large"
              />

              <div>
                <strong>
                  {member.name}
                </strong>

                <span>
                  {member.jobTitle ||
                    formatStatus(
                      member.role
                    )}
                </span>

                <small>
                  {member.email}
                </small>
              </div>

              <StatusBadge
                value={
                  item.attendance
                    ?.status ||
                  member.availabilityStatus ||
                  "offline"
                }
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ActivityCard({
  items = [],
  title = "Recent activity",
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title={title}
        subtitle="Latest workspace operations and system events."
      />

      {!items.length ? (
        <EmptyState
          title="No recent activity"
          description="Workspace changes will appear here."
        />
      ) : (
        <div className="rf-activity-list">
          {items
            .slice(0, 30)
            .map((item, index) => (
              <article
                key={
                  item.id ||
                  `${item.createdAt}-${index}`
                }
                className="rf-activity-item"
              >
                <div className="rf-activity-dot" />

                <div>
                  <strong>
                    {item.title ||
                      formatStatus(
                        item.action ||
                          item.type
                      )}
                  </strong>

                  {item.detail ||
                  item.description ? (
                    <span>
                      {item.detail ||
                        item.description}
                    </span>
                  ) : null}

                  <small>
                    {formatDateTime(
                      item.createdAt
                    )}
                  </small>
                </div>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}


function PanelHeader({
  title,
  subtitle,
  action,
}) {
  return (
    <header className="rf-panel-header">
      <div>
        <h2>{title}</h2>

        {subtitle ? (
          <p>{subtitle}</p>
        ) : null}
      </div>

      {action}
    </header>
  );
}

function MemberIdentity({
  member,
  online,
}) {
  return (
    <div className="rf-member-identity">
      <Avatar user={member} />

      <div>
        <strong>{member.name}</strong>

        <small>
          {member.jobTitle ||
            formatStatus(
              member.role
            )}
        </small>
      </div>

      {online ? (
        <span
          className="rf-online-indicator"
          title="Online"
        />
      ) : null}
    </div>
  );
}

function Avatar({
  user = {},
  size = "normal",
}) {
  const [imageError, setImageError] =
    useState(false);

  const initials = useMemo(
    () =>
      getInitials(
        user.name ||
          user.email ||
          "User"
      ),
    [user.name, user.email]
  );

  return (
    <div
      className={`rf-avatar rf-avatar--${size}`}
    >
      {user.avatarUrl &&
      !imageError ? (
        <img
          src={user.avatarUrl}
          alt={user.name || "User"}
          onError={() =>
            setImageError(true)
          }
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function StatusBadge({
  value,
  large = false,
}) {
  const normalized =
    String(value || "unknown")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

  return (
    <span
      className={[
        "rf-status-badge",
        `rf-status-badge--${normalized}`,
        large
          ? "rf-status-badge--large"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {formatStatus(normalized)}
    </span>
  );
}

function SummaryRow({
  label,
  value,
}) {
  return (
    <div className="rf-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ToolRow({
  label,
  value,
  secondary,
}) {
  return (
    <div className="rf-tool-row">
      <div>
        <span>{label}</span>

        {secondary ? (
          <small>{secondary}</small>
        ) : null}
      </div>

      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({
  title,
  description,
}) {
  return (
    <div className="rf-empty-state">
      <div className="rf-empty-state__icon">
        RF
      </div>

      <strong>{title}</strong>

      <p>{description}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <main className="rf-role-dashboard rf-role-dashboard-v7">
      <RoleDashboardV7Styles />
      <div className="rf-dashboard-skeleton-header" />

      <section className="rf-metric-grid">
        {Array.from({
          length: 6,
        }).map((_, index) => (
          <div
            className="rf-skeleton-card"
            key={index}
          />
        ))}
      </section>

      <div className="rf-dashboard-skeleton-panel" />

      <div className="rf-dashboard-skeleton-panel" />
    </main>
  );
}

function DashboardError({
  message,
  onRetry,
}) {
  return (
    <main className="rf-dashboard-error rf-role-dashboard-v7 rf-dashboard-error-v7">
      <RoleDashboardV7Styles />
      <div className="rf-dashboard-error__icon">
        !
      </div>

      <h1>
        Dashboard unavailable
      </h1>

      <p>{safeDashboardMessage(message)}</p>

      <button
        type="button"
        className="rf-button"
        onClick={onRetry}
      >
        Try again
      </button>
    </main>
  );
}

function firstNumber(
  source = {},
  keys = [],
  fallback = 0
) {
  for (const key of keys) {
    const value =
      source?.[key];

    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(
        Number(value)
      )
    ) {
      return Number(value);
    }
  }

  return fallback;
}

function formatCreditNumber(
  value
) {
  return new Intl.NumberFormat(
    undefined,
    {
      maximumFractionDigits: 3,
    }
  ).format(
    Number(value || 0)
  );
}

function normalizeSimpleStatus(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function resolveTaskDueAt(
  task = {}
) {
  return (
    task.dueAt ||
    task.dueDate ||
    task.scheduledAt ||
    task.nextActionAt ||
    task.callbackAt ||
    ""
  );
}

function compareDashboardTasks(
  left,
  right
) {
  const leftStatus =
    normalizeSimpleStatus(
      left?.status
    );

  const rightStatus =
    normalizeSimpleStatus(
      right?.status
    );

  const completedStates =
    new Set([
      "completed",
      "done",
      "closed",
      "cancelled",
      "canceled",
    ]);

  const leftClosed =
    completedStates.has(
      leftStatus
    );

  const rightClosed =
    completedStates.has(
      rightStatus
    );

  if (
    leftClosed !== rightClosed
  ) {
    return leftClosed ? 1 : -1;
  }

  const leftDue =
    resolveTaskDueAt(left);

  const rightDue =
    resolveTaskDueAt(right);

  const leftOverdue =
    !leftClosed &&
    isPastDate(leftDue);

  const rightOverdue =
    !rightClosed &&
    isPastDate(rightDue);

  if (
    leftOverdue !==
    rightOverdue
  ) {
    return leftOverdue
      ? -1
      : 1;
  }

  if (
    leftDue &&
    rightDue
  ) {
    return (
      dateValue(leftDue) -
      dateValue(rightDue)
    );
  }

  if (leftDue) return -1;
  if (rightDue) return 1;

  return (
    dateValue(
      right?.updatedAt ||
        right?.createdAt
    ) -
    dateValue(
      left?.updatedAt ||
        left?.createdAt
    )
  );
}

function isPastDate(
  value
) {
  if (!value) return false;

  const timestamp =
    dateValue(value);

  return (
    timestamp > 0 &&
    timestamp < Date.now()
  );
}

function dateValue(
  value
) {
  if (!value) return 0;

  const parsed =
    new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function resolveCallbackAt(
  callback = {}
) {
  return (
    callback.nextActionAt ||
    callback.callbackAt ||
    callback.dueAt ||
    callback.dueDate ||
    callback.scheduledAt ||
    ""
  );
}

function firstName(value) {
  return (
    String(value || "")
      .trim()
      .split(/\s+/)[0] ||
    "there"
  );
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

function formatStatus(value) {
  const normalized = String(
    value || "unknown"
  )
    .replace(/_/g, " ")
    .trim();

  return normalized
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function formatDuration(
  seconds
) {
  const total = Math.max(
    0,
    Number(seconds || 0)
  );

  if (total < 60) {
    return `${Math.round(
      total
    )} sec`;
  }

  const hours = Math.floor(
    total / 3600
  );

  const minutes = Math.floor(
    (total % 3600) / 60
  );

  if (!hours) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}m`;
}

function safeDashboardMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function RoleDashboardV7Styles() {
  return (
    <style>{`
      .rf-role-dashboard-v7{
        --rfd-card:#fff;
        --rfd-soft:#f6f7f8;
        --rfd-text:#191c1d;
        --rfd-text2:#4d4c59;
        --rfd-muted:#777784;
        --rfd-line:#e2e4e7;
        --rfd-primary:#4648d4;
        --rfd-primary-dark:#393bbb;
        --rfd-primary-soft:#e8e9ff;
        --rfd-violet:#6b38d4;
        --rfd-violet-soft:#f1ebff;
        --rfd-green:#087a51;
        --rfd-green-soft:#e4f7ee;
        --rfd-red:#ba1a1a;
        --rfd-red-soft:#ffedeb;
        --rfd-amber:#965900;
        --rfd-amber-soft:#fff3d8;
        --rfd-dark:#2e3132;
        --rfd-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfd-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfdPageIn .24s var(--rfd-ease);
      }

      .rf-role-dashboard-v7 *,
      .rf-role-dashboard-v7 *::before,
      .rf-role-dashboard-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfdPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfdPulse{
        0%,100%{opacity:.42}
        50%{opacity:1}
      }

      @keyframes rfdShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rf-role-dashboard-v7 .rf-dashboard-header{
        min-height:136px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:20px;
        padding:18px;
        margin-bottom:11px;
        overflow:hidden;
        color:#fff;
        background:
          radial-gradient(circle at 89% 14%,rgba(86,89,223,.25),transparent 33%),
          radial-gradient(circle at 14% 92%,rgba(107,56,212,.15),transparent 30%),
          #2e3132;
        border:1px solid rgba(255,255,255,.06);
        border-radius:14px;
        box-shadow:0 8px 22px rgba(25,28,29,.06);
      }

      .rf-role-dashboard-v7 .rf-dashboard-header__identity{
        min-width:0;
        display:grid;
        grid-template-columns:46px minmax(0,1fr);
        align-items:center;
        gap:11px;
      }

      .rf-role-dashboard-v7 .rf-dashboard-header__identity > div:last-child{
        min-width:0;
      }

      .rf-role-dashboard-v7 .rf-dashboard-eyebrow{
        margin:0 0 3px;
        color:var(--rfd-primary);
        font-size:5.8px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-role-dashboard-v7 .rf-dashboard-header .rf-dashboard-eyebrow{
        color:#c9caff;
      }

      .rf-role-dashboard-v7 .rf-dashboard-header h1{
        margin:0;
        overflow:hidden;
        color:#fff;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 28px/35px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rf-role-dashboard-v7 .rf-dashboard-subtitle{
        margin:4px 0 0;
        overflow:hidden;
        color:rgba(244,246,247,.62);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
      }

      .rf-role-dashboard-v7 .rf-dashboard-header__actions{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rf-role-dashboard-v7 .rf-server-status{
        min-width:165px;
        display:grid;
        grid-template-columns:9px minmax(0,1fr);
        align-items:center;
        gap:7px;
        padding:8px 9px;
        color:#fff;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.09);
        border-radius:9px;
      }

      .rf-role-dashboard-v7 .rf-status-dot{
        width:8px;
        height:8px;
        background:#67d7a9;
        border:2px solid rgba(255,255,255,.42);
        border-radius:50%;
        animation:rfdPulse 1.3s infinite ease-in-out;
      }

      .rf-role-dashboard-v7 .rf-server-status > div{
        min-width:0;
        display:grid;
      }

      .rf-role-dashboard-v7 .rf-server-status strong{
        color:#fff;
        font-size:6px;
      }

      .rf-role-dashboard-v7 .rf-server-status small{
        margin-top:1px;
        color:rgba(244,246,247,.57);
        font-size:5px;
      }

      .rf-role-dashboard-v7 .rf-button{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        color:#fff;
        background:var(--rfd-primary);
        border:1px solid var(--rfd-primary);
        border-radius:8px;
        cursor:pointer;
        text-decoration:none;
        font-size:6.5px;
        font-weight:750;
        transition:.14s var(--rfd-ease);
      }

      .rf-role-dashboard-v7 .rf-button:hover:not(:disabled){
        transform:translateY(-1px);
        background:var(--rfd-primary-dark);
      }

      .rf-role-dashboard-v7 .rf-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-role-dashboard-v7 .rf-button--secondary{
        color:var(--rfd-text);
        background:#fff;
        border-color:var(--rfd-line);
      }

      .rf-role-dashboard-v7 .rf-dashboard-header .rf-button--secondary{
        color:#fff;
        background:rgba(255,255,255,.08);
        border-color:rgba(255,255,255,.12);
      }

      .rf-role-dashboard-v7 .rf-button--compact{
        min-height:30px;
        padding:5px 7px;
        font-size:5.4px;
      }

      .rf-role-dashboard-v7 .rf-inline-alert{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:9px 10px;
        margin-bottom:10px;
        color:#7c1d1d;
        background:var(--rfd-red-soft);
        border:1px solid #ffd0cc;
        border-radius:8px;
        font-size:6.3px;
        line-height:10px;
      }

      .rf-role-dashboard-v7 .rf-inline-alert button{
        min-height:28px;
        padding:4px 7px;
        color:#7c1d1d;
        background:#fff;
        border:1px solid #ffd0cc;
        border-radius:6px;
        cursor:pointer;
        font-size:5.3px;
        font-weight:750;
      }

      .rf-role-dashboard-v7 .rf-metric-grid{
        display:grid;
        grid-template-columns:repeat(6,minmax(0,1fr));
        gap:8px;
        margin-bottom:10px;
      }

      .rf-role-dashboard-v7 .rf-metric-card{
        min-height:115px;
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        align-content:end;
        gap:8px;
        padding:11px;
        background:
          radial-gradient(circle at 92% 8%,rgba(70,72,212,.045),transparent 28%),
          #fff;
        border:1px solid var(--rfd-line);
        border-radius:10px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
        transition:.14s var(--rfd-ease);
      }

      .rf-role-dashboard-v7 .rf-metric-card:hover{
        transform:translateY(-1px);
        border-color:#d8d9ef;
        box-shadow:0 8px 20px rgba(25,28,29,.045);
      }

      .rf-role-dashboard-v7 .rf-metric-card__icon{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        align-self:end;
        color:var(--rfd-primary);
        background:var(--rfd-primary-soft);
        border-radius:8px;
        font-size:5.4px;
        font-weight:850;
        letter-spacing:.03em;
      }

      .rf-role-dashboard-v7 .rf-metric-card > div:last-child{
        min-width:0;
        display:grid;
        align-content:end;
      }

      .rf-role-dashboard-v7 .rf-metric-card p{
        margin:0;
        color:var(--rfd-muted);
        font-size:5.4px;
        font-weight:700;
      }

      .rf-role-dashboard-v7 .rf-metric-card strong{
        margin-top:2px;
        overflow:hidden;
        color:var(--rfd-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 17px/22px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rf-role-dashboard-v7 .rf-metric-card small{
        margin-top:1px;
        overflow:hidden;
        color:var(--rfd-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5px;
      }

      .rf-role-dashboard-v7 .rf-dashboard-columns{
        display:grid;
        grid-template-columns:minmax(0,1.45fr) minmax(290px,.55fr);
        align-items:start;
        gap:10px;
        margin-bottom:10px;
      }

      .rf-role-dashboard-v7 .rf-dashboard-columns__primary,
      .rf-role-dashboard-v7 .rf-dashboard-columns__secondary{
        min-width:0;
        display:grid;
        gap:10px;
      }

      .rf-role-dashboard-v7 .rf-panel{
        min-width:0;
        padding:13px;
        margin-bottom:10px;
        background:#fff;
        border:1px solid var(--rfd-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-role-dashboard-v7 .rf-panel-header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        min-height:53px;
        padding-bottom:9px;
        margin-bottom:9px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-role-dashboard-v7 .rf-panel-header > div{
        min-width:0;
      }

      .rf-role-dashboard-v7 .rf-panel-header h2,
      .rf-role-dashboard-v7 .rf-panel-header h3{
        margin:0;
        font:600 13px/18px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-role-dashboard-v7 .rf-panel-header p{
        max-width:680px;
        margin:3px 0 0;
        color:var(--rfd-muted);
        font-size:5.8px;
        line-height:10px;
      }

      .rf-role-dashboard-v7 .rf-text-link{
        flex:0 0 auto;
        color:var(--rfd-primary);
        text-decoration:none;
        font-size:5.8px;
        font-weight:750;
      }

      .rf-role-dashboard-v7 .rf-table-wrap{
        overflow-x:auto;
        border:1px solid var(--rfd-line);
        border-radius:8px;
      }

      .rf-role-dashboard-v7 .rf-table{
        width:100%;
        min-width:720px;
        border-collapse:collapse;
      }

      .rf-role-dashboard-v7 .rf-table th{
        height:39px;
        padding:7px 8px;
        color:#676873;
        background:#f7f8f9;
        border-bottom:1px solid var(--rfd-line);
        text-align:left;
        white-space:nowrap;
        font-size:5.2px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rf-role-dashboard-v7 .rf-table td{
        padding:8px;
        color:var(--rfd-text2);
        border-bottom:1px solid #eff0f1;
        vertical-align:middle;
        font-size:5.7px;
        line-height:9px;
      }

      .rf-role-dashboard-v7 .rf-table tbody tr:hover td{
        background:#fafaff;
      }

      .rf-role-dashboard-v7 .rf-member-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf-role-dashboard-v7 .rf-member-card{
        min-width:0;
        padding:9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
      }

      .rf-role-dashboard-v7 .rf-member-identity{
        min-width:0;
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        align-items:center;
        gap:7px;
      }

      .rf-role-dashboard-v7 .rf-avatar-stack{
        position:relative;
        width:34px;
        height:34px;
      }

      .rf-role-dashboard-v7 .rf-online-indicator{
        position:absolute;
        right:-1px;
        bottom:-1px;
        width:9px;
        height:9px;
        background:var(--rfd-green);
        border:2px solid #fff;
        border-radius:50%;
      }

      .rf-role-dashboard-v7 .rf-compact-list,
      .rf-role-dashboard-v7 .rf-task-list,
      .rf-role-dashboard-v7 .rf-lead-list,
      .rf-role-dashboard-v7 .rf-call-list,
      .rf-role-dashboard-v7 .rf-activity-list,
      .rf-role-dashboard-v7 .rf-tool-card-list,
      .rf-role-dashboard-v7 .rf-summary-list{
        display:grid;
        gap:5px;
      }

      .rf-role-dashboard-v7 .rf-compact-row,
      .rf-role-dashboard-v7 .rf-task-item,
      .rf-role-dashboard-v7 .rf-lead-item,
      .rf-role-dashboard-v7 .rf-call-item,
      .rf-role-dashboard-v7 .rf-activity-item,
      .rf-role-dashboard-v7 .rf-tool-row,
      .rf-role-dashboard-v7 .rf-summary-row{
        min-width:0;
        min-height:55px;
        display:grid;
        align-items:center;
        gap:7px;
        padding:8px 9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        transition:.13s var(--rfd-ease);
      }

      .rf-role-dashboard-v7 .rf-compact-row:hover,
      .rf-role-dashboard-v7 .rf-task-item:hover,
      .rf-role-dashboard-v7 .rf-lead-item:hover,
      .rf-role-dashboard-v7 .rf-call-item:hover,
      .rf-role-dashboard-v7 .rf-activity-item:hover,
      .rf-role-dashboard-v7 .rf-tool-row:hover{
        background:#f4f4ff;
        border-color:#e1e1f7;
      }

      .rf-role-dashboard-v7 .rf-lead-item{
        grid-template-columns:34px minmax(0,1fr) auto;
      }

      .rf-role-dashboard-v7 .rf-lead-item__content,
      .rf-role-dashboard-v7 .rf-call-item__content{
        min-width:0;
        display:grid;
      }

      .rf-role-dashboard-v7 .rf-lead-item__content strong,
      .rf-role-dashboard-v7 .rf-call-item__content strong,
      .rf-role-dashboard-v7 .rf-task-item strong,
      .rf-role-dashboard-v7 .rf-tool-row strong{
        overflow:hidden;
        color:var(--rfd-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6px;
      }

      .rf-role-dashboard-v7 .rf-lead-item__content small,
      .rf-role-dashboard-v7 .rf-call-item__content small,
      .rf-role-dashboard-v7 .rf-task-item small,
      .rf-role-dashboard-v7 .rf-tool-row small{
        margin-top:2px;
        overflow:hidden;
        color:var(--rfd-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.1px;
      }

      .rf-role-dashboard-v7 .rf-lead-item__actions{
        display:flex;
        gap:4px;
      }

      .rf-role-dashboard-v7 .rf-call-item{
        grid-template-columns:34px minmax(0,1fr) auto;
      }

      .rf-role-dashboard-v7 .rf-call-icon{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfd-primary);
        background:#fff;
        border-radius:8px;
        font-size:5.4px;
        font-weight:800;
      }

      .rf-role-dashboard-v7 .rf-call-item__meta{
        display:grid;
        justify-items:end;
        gap:2px;
        color:var(--rfd-muted);
        font-size:5px;
      }

      .rf-role-dashboard-v7 .rf-task-item{
        grid-template-columns:24px minmax(0,1fr) auto;
      }

      .rf-role-dashboard-v7 .rf-task-check{
        width:21px;
        height:21px;
        display:grid;
        place-items:center;
        color:var(--rfd-primary);
        background:var(--rfd-primary-soft);
        border-radius:6px;
        font-size:5px;
        font-weight:800;
      }

      .rf-role-dashboard-v7 .rf-overdue-label{
        width:max-content;
        padding:4px 6px;
        color:var(--rfd-red);
        background:var(--rfd-red-soft);
        border-radius:999px;
        font-size:4.8px;
        font-weight:750;
      }

      .rf-role-dashboard-v7 .rf-activity-item{
        grid-template-columns:9px minmax(0,1fr) auto;
      }

      .rf-role-dashboard-v7 .rf-activity-dot{
        width:7px;
        height:7px;
        background:var(--rfd-primary);
        border-radius:50%;
      }

      .rf-role-dashboard-v7 .rf-summary-row{
        grid-template-columns:minmax(0,1fr) auto;
      }

      .rf-role-dashboard-v7 .rf-attendance-hero{
        min-height:120px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:15px;
        margin-bottom:10px;
        color:#fff;
        background:
          radial-gradient(circle at 90% 15%,rgba(83,86,222,.24),transparent 33%),
          #2e3132;
        border-radius:12px;
      }

      .rf-role-dashboard-v7 .rf-attendance-hero .rf-dashboard-eyebrow{
        color:#c8caff;
      }

      .rf-role-dashboard-v7 .rf-attendance-hero h2{
        margin:0;
        color:#fff;
        font:600 16px/21px Geist,Inter,sans-serif;
      }

      .rf-role-dashboard-v7 .rf-attendance-hero p:not(.rf-dashboard-eyebrow){
        margin:4px 0 0;
        color:rgba(244,246,247,.62);
        font-size:6px;
        line-height:10px;
      }

      .rf-role-dashboard-v7 .rf-empty-state{
        min-height:150px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:20px;
        color:var(--rfd-muted);
        background:#f8f9fa;
        border:1px dashed #d8dade;
        border-radius:8px;
        text-align:center;
      }

      .rf-role-dashboard-v7 .rf-empty-state__icon{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        color:var(--rfd-primary);
        background:var(--rfd-primary-soft);
        border-radius:9px;
        font-size:9px;
        font-weight:800;
      }

      .rf-role-dashboard-v7 .rf-empty-state h3{
        margin:3px 0 0;
        color:var(--rfd-text);
        font:600 8px/12px Geist,Inter,sans-serif;
      }

      .rf-role-dashboard-v7 .rf-empty-state p{
        max-width:390px;
        margin:0;
        font-size:5.5px;
        line-height:9px;
      }

      .rf-role-dashboard-v7 .rf-dashboard-skeleton-header,
      .rf-role-dashboard-v7 .rf-skeleton-card,
      .rf-role-dashboard-v7 .rf-dashboard-skeleton-panel{
        background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);
        background-size:220% 100%;
        animation:rfdShimmer 1.15s linear infinite;
      }

      .rf-role-dashboard-v7 .rf-dashboard-skeleton-header{
        height:136px;
        margin-bottom:10px;
        border-radius:14px;
      }

      .rf-role-dashboard-v7 .rf-skeleton-card{
        height:115px;
        border-radius:10px;
      }

      .rf-role-dashboard-v7 .rf-dashboard-skeleton-panel{
        height:240px;
        margin-bottom:10px;
        border-radius:11px;
      }

      .rf-dashboard-error-v7{
        min-height:100%;
        display:grid;
        place-items:center;
        align-content:center;
        max-width:none;
        text-align:center;
      }

      .rf-dashboard-error-v7 .rf-dashboard-error__icon{
        width:52px;
        height:52px;
        display:grid;
        place-items:center;
        margin-bottom:7px;
        color:#fff;
        background:#b42318;
        border-radius:13px;
        font-size:14px;
        font-weight:800;
      }

      .rf-dashboard-error-v7 h1{
        margin:0;
        font:600 22px/29px Geist,Inter,sans-serif;
      }

      .rf-dashboard-error-v7 p{
        max-width:480px;
        margin:5px 0 10px;
        color:var(--rfd-text2);
        font-size:7px;
        line-height:12px;
      }

      @media(max-width:1200px){
        .rf-role-dashboard-v7 .rf-metric-grid{
          grid-template-columns:repeat(3,minmax(0,1fr));
        }
      }

      @media(max-width:1000px){
        .rf-role-dashboard-v7{
          padding:22px;
        }

        .rf-role-dashboard-v7 .rf-dashboard-columns{
          grid-template-columns:1fr;
        }

        .rf-role-dashboard-v7 .rf-member-grid{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:720px){
        .rf-role-dashboard-v7 .rf-dashboard-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-role-dashboard-v7 .rf-dashboard-header__actions{
          width:100%;
        }

        .rf-role-dashboard-v7 .rf-server-status{
          flex:1;
        }

        .rf-role-dashboard-v7 .rf-metric-grid{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:620px){
        .rf-role-dashboard-v7{
          padding:18px 12px 80px;
        }

        .rf-role-dashboard-v7 .rf-dashboard-header{
          padding:15px;
        }

        .rf-role-dashboard-v7 .rf-dashboard-header h1{
          font-size:23px;
          line-height:30px;
        }

        .rf-role-dashboard-v7 .rf-dashboard-header__actions{
          display:grid;
          grid-template-columns:1fr;
        }

        .rf-role-dashboard-v7 .rf-server-status{
          width:100%;
        }

        .rf-role-dashboard-v7 .rf-dashboard-header .rf-button{
          width:100%;
        }

        .rf-role-dashboard-v7 .rf-member-grid{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:420px){
        .rf-role-dashboard-v7 .rf-metric-grid{
          grid-template-columns:1fr;
        }

        .rf-role-dashboard-v7 .rf-dashboard-header__identity{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-role-dashboard-v7,
        .rf-role-dashboard-v7 *,
        .rf-role-dashboard-v7 *::before,
        .rf-role-dashboard-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
