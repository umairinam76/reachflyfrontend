import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getRoleDashboard,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import DailyLeadManagerPanel from "./DailyLeadManagerPanel.jsx";

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
    []
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
    <main className="rf-role-dashboard">
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
          <span>{error}</span>

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
            <strong>Workspace live</strong>
            <small>
              Real-time updates enabled
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
            label: "Dialers",
            value:
              summary.configuredDialers ||
              0,
            note: "Configured systems",
            icon: "DL",
          },
          {
            label: "Sender identities",
            value:
              summary.configuredSenders ||
              0,
            note: "Approved SMTP senders",
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
  assignments,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Lead assignments"
        subtitle="Recently assigned and active leads."
        action={
          <a
            href="/app/assignments"
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
            .map((assignment) => (
              <div
                className="rf-compact-row"
                key={assignment.id}
              >
                <div>
                  <strong>
                    Lead assignment
                  </strong>

                  <small>
                    {assignment.leadId ||
                      "Lead"}
                  </small>
                </div>

                <StatusBadge
                  value={
                    assignment.status
                  }
                />
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

function TaskListCard({
  tasks,
  title = "Team tasks",
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title={title}
        subtitle="Priority work and upcoming deadlines."
      />

      {!tasks.length ? (
        <EmptyState
          title="No pending tasks"
          description="Assigned tasks will appear here."
        />
      ) : (
        <div className="rf-task-list">
          {tasks
            .slice(0, 10)
            .map((task) => (
              <article
                key={task.id}
                className="rf-task-item"
              >
                <div className="rf-task-check">
                  {task.status ===
                  "completed"
                    ? "✓"
                    : ""}
                </div>

                <div>
                  <strong>
                    {task.title ||
                      "Task"}
                  </strong>

                  <small>
                    {task.dueAt
                      ? `Due ${formatDateTime(
                          task.dueAt
                        )}`
                      : "No due date"}
                  </small>
                </div>

                <StatusBadge
                  value={
                    task.priority ||
                    task.status
                  }
                />
              </article>
            ))}
        </div>
      )}
    </section>
  );
}

function RecentCallsCard({
  calls,
  title = "Recent calls",
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title={title}
        subtitle="Latest call activity and outcomes."
      />

      {!calls.length ? (
        <EmptyState
          title="No calls recorded"
          description="Completed and attempted calls will appear here."
        />
      ) : (
        <div className="rf-call-list">
          {calls
            .slice(0, 12)
            .map((call) => (
              <article
                key={call.id}
                className="rf-call-item"
              >
                <div className="rf-call-icon">
                  ☎
                </div>

                <div className="rf-call-item__content">
                  <strong>
                    {call.destinationNumber ||
                      "Internal call"}
                  </strong>

                  <small>
                    {formatDateTime(
                      call.startedAt
                    )}
                  </small>
                </div>

                <div className="rf-call-item__meta">
                  <StatusBadge
                    value={
                      call.outcome ||
                      call.status
                    }
                  />

                  <small>
                    {formatDuration(
                      call.durationSeconds ||
                        0
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

function CallbacksCard({
  callbacks,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Upcoming callbacks"
        subtitle="Scheduled follow-ups requiring attention."
      />

      {!callbacks.length ? (
        <EmptyState
          title="No callbacks due"
          description="Scheduled callbacks will appear here."
        />
      ) : (
        <div className="rf-compact-list">
          {callbacks
            .slice(0, 10)
            .map((callback) => (
              <div
                className="rf-compact-row"
                key={callback.id}
              >
                <div>
                  <strong>
                    Follow-up
                  </strong>

                  <small>
                    {formatDateTime(
                      callback.nextActionAt
                    )}
                  </small>
                </div>

                <StatusBadge
                  value={
                    callback.priority ||
                    callback.status
                  }
                />
              </div>
            ))}
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
                      action.dueAt
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
  items,
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
            .map((item) => (
              <article
                key={item.id}
                className="rf-activity-item"
              >
                <div className="rf-activity-dot" />

                <div>
                  <strong>
                    {formatStatus(
                      item.action ||
                        item.type
                    )}
                  </strong>

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
    <main className="rf-role-dashboard">
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
    <main className="rf-dashboard-error">
      <div className="rf-dashboard-error__icon">
        !
      </div>

      <h1>
        Dashboard unavailable
      </h1>

      <p>{message}</p>

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