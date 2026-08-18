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

import "../styles/role-dashboard.css";

export default function OwnerDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [overview, setOverview] = useState({});
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [recentCalls, setRecentCalls] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [auditJobs, setAuditJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const profileResponse = await apiRequest("/profile/me");

        const currentProfile =
          profileResponse.profile ||
          profileResponse.user ||
          profileResponse;

        setProfile(currentProfile);

        const role = normalizeRole(
          currentProfile?.workspaceRole ||
            currentProfile?.role
        );

        if (!["owner", "admin"].includes(role)) {
          return;
        }

        const results = await Promise.allSettled([
          getRoleDashboard(),
          apiRequest("/team/performance"),
          apiRequest("/attendance/team"),
          apiRequest("/telnyx/calls?limit=15"),
          apiRequest("/team-communication/tasks?limit=15"),
          apiRequest("/sales/assignments?limit=15"),
          apiRequest("/audit-jobs"),
        ]);

        const dashboardResponse = getSettledValue(results[0], {});
        const performanceResponse = getSettledValue(results[1], {});
        const attendanceResponse = getSettledValue(results[2], {});
        const callsResponse = getSettledValue(results[3], {});
        const tasksResponse = getSettledValue(results[4], {});
        const assignmentsResponse = getSettledValue(results[5], {});
        const auditResponse = getSettledValue(results[6], {});

        const failures = results
          .map((result, index) => ({ result, index }))
          .filter(({ result }) => result.status === "rejected");

        if (failures.length) {
          setError(
            failures.length === results.length
              ? "Workspace reporting is temporarily unavailable. Try refreshing in a moment."
              : "Some workspace sections could not be refreshed. Available data is still shown below."
          );
        }

        setOverview(
          dashboardResponse.summary ||
            dashboardResponse.metrics ||
            {}
        );

        setTeamPerformance(
          performanceResponse.rows ||
            performanceResponse.performance ||
            performanceResponse.members ||
            dashboardResponse.teamPerformance ||
            dashboardResponse.team ||
            []
        );

        setAttendance(
          attendanceResponse.attendance ||
            attendanceResponse.records ||
            attendanceResponse.members ||
            dashboardResponse.attendance?.members ||
            []
        );

        setRecentCalls(
          callsResponse.calls ||
            callsResponse.records ||
            dashboardResponse.recentCalls ||
            dashboardResponse.calls ||
            []
        );

        setTasks(
          tasksResponse.tasks ||
            tasksResponse.records ||
            dashboardResponse.tasks ||
            []
        );

        setAssignments(
          assignmentsResponse.assignments ||
            assignmentsResponse.records ||
            dashboardResponse.assignments ||
            []
        );

        setAuditJobs(
          auditResponse.jobs ||
            auditResponse.auditJobs ||
            auditResponse.records ||
            []
        );
      } catch (requestError) {
        setError(
          requestError?.message ||
            "The owner dashboard could not be loaded."
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
      "attendance:status-updated",
      "team:member-created",
      "team:member-updated",
      "team:assignment-created",
      "team:assignment-updated",
      "team:task-created",
      "team:task-updated",
      "call:completed",
      "call:failed",
      "lead:audit-updated",
      "audit:job-updated",
    ];

    const unsubscribe = events.map((eventName) =>
      onWorkspaceSocket(eventName, () => {
        loadDashboard({
          silent: true,
        });
      })
    );

    return () => {
      unsubscribe.forEach((stop) => stop());
    };
  }, [loadDashboard]);

  const role = normalizeRole(
    profile?.workspaceRole ||
      profile?.role
  );

  const metrics = useMemo(() => {
    const memberCount =
      numberValue(
        overview.totalMembers,
        overview.memberCount,
        teamPerformance.length
      );

    const activeMembers =
      numberValue(
        overview.activeMembers,
        overview.activeMemberCount,
        teamPerformance.filter((item) =>
          ["available", "busy", "away"].includes(
            normalizeStatus(
              item.member?.availabilityStatus ||
                item.availabilityStatus
            )
          )
        ).length
      );

    const checkedIn =
      numberValue(
        overview.checkedInToday,
        overview.checkedInMembers,
        attendance.filter((item) =>
          ["checked_in", "present", "late"].includes(
            normalizeStatus(item.status)
          )
        ).length
      );

    const totalCalls =
      numberValue(
        overview.totalCalls,
        overview.calls,
        teamPerformance.reduce(
          (sum, item) =>
            sum +
            Number(
              item.metrics?.totalCalls ||
                item.totalCalls ||
                0
            ),
          0
        )
      );

    const qualifiedLeads =
      numberValue(
        overview.qualifiedLeads,
        overview.qualified,
        teamPerformance.reduce(
          (sum, item) =>
            sum +
            Number(
              item.metrics?.qualifiedLeads ||
                item.qualifiedLeads ||
                0
            ),
          0
        )
      );

    const meetingsBooked =
      numberValue(
        overview.meetingsBooked,
        overview.meetings,
        teamPerformance.reduce(
          (sum, item) =>
            sum +
            Number(
              item.metrics?.meetingsBooked ||
                item.meetingsBooked ||
                0
            ),
          0
        )
      );

    const activeAssignments =
      numberValue(
        overview.activeAssignments,
        assignments.filter(
          (item) =>
            ![
              "completed",
              "cancelled",
              "do_not_contact",
            ].includes(
              normalizeStatus(item.status)
            )
        ).length
      );

    const pendingTasks =
      numberValue(
        overview.pendingTasks,
        tasks.filter(
          (item) =>
            ![
              "completed",
              "cancelled",
            ].includes(
              normalizeStatus(item.status)
            )
        ).length
      );

    const auditsCompleted =
      numberValue(
        overview.auditsCompleted,
        auditJobs.filter(
          (job) =>
            normalizeStatus(job.status) ===
            "completed"
        ).length
      );

    const conversionRate =
      totalCalls > 0
        ? Math.round(
            (qualifiedLeads / totalCalls) * 100
          )
        : 0;

    return {
      memberCount,
      activeMembers,
      checkedIn,
      totalCalls,
      qualifiedLeads,
      meetingsBooked,
      activeAssignments,
      pendingTasks,
      auditsCompleted,
      conversionRate,
    };
  }, [
    overview,
    teamPerformance,
    attendance,
    assignments,
    tasks,
    auditJobs,
  ]);

  if (loading) {
    return <OwnerDashboardSkeleton />;
  }

  if (!["owner", "admin"].includes(role)) {
    return <OwnerAccessDenied role={role} />;
  }

  return (
    <main className="rf-role-dashboard rf-owner-dashboard-v7">
      <OwnerDashboardV7Styles />
      <OwnerHeader
        profile={profile}
        refreshing={refreshing}
        onRefresh={() =>
          loadDashboard({
            silent: true,
          })
        }
      />

      {error ? (
        <DashboardAlert
          message={error}
          onClose={() => setError("")}
        />
      ) : null}

      <OwnerMetricGrid metrics={metrics} />

      <OwnerNavigation
        activeSection={activeSection}
        onChange={setActiveSection}
        counts={{
          team: teamPerformance.length,
          attendance: attendance.length,
          calls: recentCalls.length,
          assignments: assignments.length,
          audits: auditJobs.length,
        }}
      />

      {activeSection === "overview" ? (
        <OverviewSection
          metrics={metrics}
          teamPerformance={teamPerformance}
          attendance={attendance}
          recentCalls={recentCalls}
          assignments={assignments}
          tasks={tasks}
          auditJobs={auditJobs}
        />
      ) : null}

      {activeSection === "team" ? (
        <TeamPerformanceSection
          teamPerformance={teamPerformance}
        />
      ) : null}

      {activeSection === "attendance" ? (
        <AttendanceSection
          attendance={attendance}
        />
      ) : null}

      {activeSection === "calls" ? (
        <CallActivitySection
          calls={recentCalls}
        />
      ) : null}

      {activeSection === "work" ? (
        <WorkloadSection
          assignments={assignments}
          tasks={tasks}
        />
      ) : null}

      {activeSection === "audits" ? (
        <AuditOperationsSection
          auditJobs={auditJobs}
        />
      ) : null}
    </main>
  );
}

function OwnerHeader({
  profile,
  refreshing,
  onRefresh,
}) {
  return (
    <header className="rf-dashboard-header">
      <div className="rf-dashboard-header__identity">
        <DashboardAvatar
          profile={profile}
          large
        />

        <div>
          <p className="rf-dashboard-eyebrow">
            Workspace operations
          </p>

          <h1>Owner dashboard</h1>

          <p className="rf-dashboard-subtitle">
            Review team activity, calling performance,
            attendance, assignments and audit operations
            across the entire workspace.
          </p>
        </div>
      </div>

      <div className="rf-dashboard-header__actions">
        <div className="rf-server-status">
          <span className="rf-status-dot" />

          <div>
            <strong>Live workspace reporting</strong>
            <small>
              Operational data updates automatically
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
            : "Refresh dashboard"}
        </button>
      </div>
    </header>
  );
}

function OwnerMetricGrid({
  metrics,
}) {
  const cards = [
    {
      label: "Team members",
      value: metrics.memberCount,
      note: `${metrics.activeMembers} currently available`,
      icon: "TM",
    },
    {
      label: "Checked in today",
      value: metrics.checkedIn,
      note: "Live attendance status",
      icon: "AT",
    },
    {
      label: "Calls recorded",
      value: metrics.totalCalls,
      note: "Across all callers",
      icon: "CL",
    },
    {
      label: "Qualified leads",
      value: metrics.qualifiedLeads,
      note: `${metrics.conversionRate}% call conversion`,
      icon: "QL",
    },
    {
      label: "Meetings booked",
      value: metrics.meetingsBooked,
      note: "Positive call outcomes",
      icon: "MB",
    },
    {
      label: "Active assignments",
      value: metrics.activeAssignments,
      note: "Leads currently in progress",
      icon: "LA",
    },
    {
      label: "Pending tasks",
      value: metrics.pendingTasks,
      note: "Operational workload",
      icon: "TK",
    },
    {
      label: "Audits completed",
      value: metrics.auditsCompleted,
      note: "Generated lead reports",
      icon: "AU",
    },
  ];

  return (
    <section className="rf-metric-grid">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rf-metric-card"
        >
          <div className="rf-metric-card__icon">
            {card.icon}
          </div>

          <div>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </div>
        </article>
      ))}
    </section>
  );
}

function OwnerNavigation({
  activeSection,
  onChange,
  counts,
}) {
  const items = [
    {
      id: "overview",
      label: "Overview",
    },
    {
      id: "team",
      label: "Team performance",
      count: counts.team,
    },
    {
      id: "attendance",
      label: "Attendance",
      count: counts.attendance,
    },
    {
      id: "calls",
      label: "Call activity",
      count: counts.calls,
    },
    {
      id: "work",
      label: "Assignments and tasks",
      count: counts.assignments,
    },
    {
      id: "audits",
      label: "Audit operations",
      count: counts.audits,
    },
  ];

  return (
    <nav className="rf-management-navigation">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={
            activeSection === item.id
              ? "is-active"
              : ""
          }
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>

          {Number.isFinite(item.count) ? (
            <b>{item.count}</b>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function OverviewSection({
  metrics,
  teamPerformance,
  attendance,
  recentCalls,
  assignments,
  tasks,
  auditJobs,
}) {
  const topPerformers = [...teamPerformance]
    .sort((a, b) => {
      const aMetrics = a.metrics || a;
      const bMetrics = b.metrics || b;

      return (
        Number(
          bMetrics.qualifiedLeads ||
            bMetrics.meetingsBooked ||
            0
        ) -
        Number(
          aMetrics.qualifiedLeads ||
            aMetrics.meetingsBooked ||
            0
        )
      );
    })
    .slice(0, 5);

  return (
    <section className="rf-dashboard-grid">
      <div className="rf-dashboard-grid__main">
        <section className="rf-panel">
          <PanelHeader
            title="Workspace performance"
            subtitle="Current operational performance across the calling team."
          />

          <div className="rf-performance-summary-grid">
            <PerformanceSummary
              label="Call conversion"
              value={`${metrics.conversionRate}%`}
              note="Qualified leads from recorded calls"
            />

            <PerformanceSummary
              label="Attendance coverage"
              value={
                metrics.memberCount
                  ? `${Math.round(
                      (metrics.checkedIn /
                        metrics.memberCount) *
                        100
                    )}%`
                  : "0%"
              }
              note="Members checked in today"
            />

            <PerformanceSummary
              label="Lead workload"
              value={metrics.activeAssignments}
              note="Assignments currently in progress"
            />

            <PerformanceSummary
              label="Audit output"
              value={metrics.auditsCompleted}
              note="Completed reports in the current view"
            />
          </div>
        </section>

        <section className="rf-panel">
          <PanelHeader
            title="Top team performance"
            subtitle="Team members producing the strongest lead outcomes."
            action={
              <a
                href="/app/team-management"
                className="rf-button rf-button--secondary rf-button--compact"
              >
                Manage team
              </a>
            }
          />

          {!topPerformers.length ? (
            <EmptyState
              title="No performance data"
              description="Performance information appears after callers begin working assigned leads."
              icon="TP"
            />
          ) : (
            <div className="rf-performance-list">
              {topPerformers.map(
                (item, index) => (
                  <PerformanceRow
                    key={
                      item.userId ||
                      item.member?.id ||
                      index
                    }
                    item={item}
                    rank={index + 1}
                  />
                )
              )}
            </div>
          )}
        </section>

        <section className="rf-panel">
          <PanelHeader
            title="Recent calling activity"
            subtitle="Latest calls recorded across the workspace."
          />

          <CallList
            calls={recentCalls.slice(0, 8)}
          />
        </section>
      </div>

      <aside className="rf-dashboard-grid__aside">
        <section className="rf-panel">
          <PanelHeader
            title="Attendance today"
            subtitle="Live check-in status."
          />

          <AttendanceList
            attendance={attendance.slice(0, 8)}
          />
        </section>

        <section className="rf-panel">
          <PanelHeader
            title="Operational workload"
            subtitle="Assignments and tasks requiring attention."
          />

          <OperationsSummary
            assignments={assignments}
            tasks={tasks}
          />
        </section>

        <section className="rf-panel">
          <PanelHeader
            title="Audit queue"
            subtitle="Latest mini and full audit jobs."
          />

          <AuditJobList
            jobs={auditJobs.slice(0, 7)}
          />
        </section>
      </aside>
    </section>
  );
}

function TeamPerformanceSection({
  teamPerformance,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Team performance"
        subtitle="Compare calls, qualifications, meetings and talk time for each team member."
      />

      {!teamPerformance.length ? (
        <EmptyState
          icon="TP"
          title="No team performance data"
          description="Performance metrics appear after team members begin making calls."
        />
      ) : (
        <div className="rf-table-container">
          <table className="rf-dashboard-table">
            <thead>
              <tr>
                <th>Team member</th>
                <th>Assigned leads</th>
                <th>Total calls</th>
                <th>Answered</th>
                <th>Qualified</th>
                <th>Meetings</th>
                <th>Talk time</th>
                <th>Conversion</th>
              </tr>
            </thead>

            <tbody>
              {teamPerformance.map(
                (item, index) => {
                  const member =
                    item.member ||
                    item.user ||
                    item;

                  const metrics =
                    item.metrics ||
                    item;

                  const calls = Number(
                    metrics.totalCalls || 0
                  );

                  const qualified = Number(
                    metrics.qualifiedLeads || 0
                  );

                  const conversion =
                    calls > 0
                      ? Math.round(
                          (qualified / calls) * 100
                        )
                      : 0;

                  return (
                    <tr
                      key={
                        member.id ||
                        item.userId ||
                        index
                      }
                    >
                      <td>
                        <MemberIdentity
                          member={member}
                        />
                      </td>

                      <td>
                        {metrics.assignedLeads || 0}
                      </td>

                      <td>{calls}</td>

                      <td>
                        {metrics.answeredCalls || 0}
                      </td>

                      <td>{qualified}</td>

                      <td>
                        {metrics.meetingsBooked || 0}
                      </td>

                      <td>
                        {formatDuration(
                          metrics.totalCallSeconds || 0
                        )}
                      </td>

                      <td>
                        <ProgressValue
                          value={conversion}
                        />
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AttendanceSection({
  attendance,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Team attendance"
        subtitle="Review today's live check-in and check-out records."
      />

      {!attendance.length ? (
        <EmptyState
          icon="AT"
          title="No attendance records"
          description="Attendance records appear when team members check in."
        />
      ) : (
        <div className="rf-table-container">
          <table className="rf-dashboard-table">
            <thead>
              <tr>
                <th>Team member</th>
                <th>Status</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Worked time</th>
                <th>Verification</th>
              </tr>
            </thead>

            <tbody>
              {attendance.map(
                (record, index) => {
                  const member =
                    record.member ||
                    record.user ||
                    record.profile ||
                    {};

                  return (
                    <tr
                      key={
                        record.id ||
                        member.id ||
                        index
                      }
                    >
                      <td>
                        <MemberIdentity
                          member={member}
                        />
                      </td>

                      <td>
                        <StatusBadge
                          value={
                            record.status ||
                            "not_checked_in"
                          }
                        />
                      </td>

                      <td>
                        {formatDateTime(
                          record.checkedInAt ||
                            record.checkInAt
                        )}
                      </td>

                      <td>
                        {formatDateTime(
                          record.checkedOutAt ||
                            record.checkOutAt
                        )}
                      </td>

                      <td>
                        {formatDuration(
                          record.workedSeconds ||
                            record.durationSeconds ||
                            0
                        )}
                      </td>

                      <td>
                        {record.checkInPhotoUrl ||
                        record.photoUrl ? (
                          <a
                            href={
                              record.checkInPhotoUrl ||
                              record.photoUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="rf-text-link"
                          >
                            View photo
                          </a>
                        ) : (
                          "No photo"
                        )}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CallActivitySection({
  calls,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Call activity"
        subtitle="Recent calls and recorded outcomes across the entire workspace."
      />

      <CallList calls={calls} />
    </section>
  );
}

function WorkloadSection({
  assignments,
  tasks,
}) {
  return (
    <section className="rf-dashboard-grid">
      <div className="rf-dashboard-grid__main">
        <section className="rf-panel">
          <PanelHeader
            title="Lead assignments"
            subtitle="Latest leads distributed to callers and managers."
            action={
              <a
                href="/app/team-management"
                className="rf-button rf-button--secondary rf-button--compact"
              >
                Manage assignments
              </a>
            }
          />

          <AssignmentList
            assignments={assignments}
          />
        </section>
      </div>

      <aside className="rf-dashboard-grid__aside">
        <section className="rf-panel">
          <PanelHeader
            title="Team tasks"
            subtitle="Current operational tasks."
          />

          <TaskList tasks={tasks} />
        </section>
      </aside>
    </section>
  );
}

function AuditOperationsSection({
  auditJobs,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="AI audit operations"
        subtitle="Monitor mini audit, competitor analysis and full audit generation jobs."
      />

      {!auditJobs.length ? (
        <EmptyState
          icon="AU"
          title="No audit jobs"
          description="Audit jobs appear after reports are requested for leads."
        />
      ) : (
        <div className="rf-table-container">
          <table className="rf-dashboard-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Report type</th>
                <th>Status</th>
                <th>Requested by</th>
                <th>Created</th>
                <th>Completed</th>
              </tr>
            </thead>

            <tbody>
              {auditJobs.map(
                (job, index) => (
                  <tr
                    key={job.id || index}
                  >
                    <td>
                      <strong>
                        {job.lead?.business ||
                          job.lead?.name ||
                          job.businessName ||
                          "Business lead"}
                      </strong>
                    </td>

                    <td>
                      {formatLabel(
                        job.type ||
                          job.reportType ||
                          "mini_audit"
                      )}
                    </td>

                    <td>
                      <StatusBadge
                        value={
                          job.status ||
                          "queued"
                        }
                      />
                    </td>

                    <td>
                      {job.requestedBy?.name ||
                        job.user?.name ||
                        "System"}
                    </td>

                    <td>
                      {formatDateTime(
                        job.createdAt
                      )}
                    </td>

                    <td>
                      {formatDateTime(
                        job.completedAt
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PerformanceSummary({
  label,
  value,
  note,
}) {
  return (
    <article className="rf-summary-card">
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function PerformanceRow({
  item,
  rank,
}) {
  const member =
    item.member ||
    item.user ||
    item;

  const metrics =
    item.metrics ||
    item;

  return (
    <article className="rf-performance-row">
      <span className="rf-performance-rank">
        {rank}
      </span>

      <MemberIdentity member={member} />

      <div className="rf-performance-row__metric">
        <small>Calls</small>
        <strong>
          {metrics.totalCalls || 0}
        </strong>
      </div>

      <div className="rf-performance-row__metric">
        <small>Qualified</small>
        <strong>
          {metrics.qualifiedLeads || 0}
        </strong>
      </div>

      <div className="rf-performance-row__metric">
        <small>Meetings</small>
        <strong>
          {metrics.meetingsBooked || 0}
        </strong>
      </div>
    </article>
  );
}

function AttendanceList({
  attendance,
}) {
  if (!attendance.length) {
    return (
      <EmptyState
        icon="AT"
        title="No attendance today"
        description="Team check-ins will appear here."
        compact
      />
    );
  }

  return (
    <div className="rf-simple-list">
      {attendance.map(
        (record, index) => {
          const member =
            record.member ||
            record.user ||
            record.profile ||
            {};

          return (
            <article
              key={
                record.id ||
                member.id ||
                index
              }
              className="rf-simple-list-item"
            >
              <MemberIdentity
                member={member}
              />

              <div className="rf-simple-list-item__right">
                <StatusBadge
                  value={
                    record.status ||
                    "not_checked_in"
                  }
                />

                <small>
                  {record.checkedInAt
                    ? formatTime(
                        record.checkedInAt
                      )
                    : "Not checked in"}
                </small>
              </div>
            </article>
          );
        }
      )}
    </div>
  );
}

function CallList({
  calls,
}) {
  if (!calls.length) {
    return (
      <EmptyState
        icon="CL"
        title="No calls recorded"
        description="Completed and attempted calls will appear here."
      />
    );
  }

  return (
    <div className="rf-call-activity-list">
      {calls.map((call, index) => (
        <article
          key={
            call.id ||
            call.callId ||
            index
          }
          className="rf-call-activity-row"
        >
          <div className="rf-call-activity-icon">
            ☎
          </div>

          <div className="rf-call-activity-business">
            <strong>
              {call.lead?.business ||
                call.lead?.name ||
                call.businessName ||
                call.toNumber ||
                "Business lead"}
            </strong>

            <small>
              {call.user?.name ||
                call.caller?.name ||
                call.createdBy?.name ||
                "Unknown caller"}
            </small>
          </div>

          <StatusBadge
            value={
              call.outcome ||
              call.status ||
              "completed"
            }
          />

          <div className="rf-call-activity-meta">
            <strong>
              {formatDuration(
                call.durationSeconds ||
                  call.duration ||
                  0
              )}
            </strong>

            <small>
              {formatDateTime(
                call.startedAt ||
                  call.createdAt
              )}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}

function OperationsSummary({
  assignments,
  tasks,
}) {
  const items = [
    {
      label: "Unstarted assignments",
      value: assignments.filter(
        (item) =>
          normalizeStatus(item.status) ===
          "assigned"
      ).length,
    },
    {
      label: "Follow-ups required",
      value: assignments.filter(
        (item) =>
          normalizeStatus(item.status) ===
          "follow_up"
      ).length,
    },
    {
      label: "Qualified leads",
      value: assignments.filter((item) =>
        [
          "qualified",
          "meeting_booked",
        ].includes(
          normalizeStatus(item.status)
        )
      ).length,
    },
    {
      label: "Pending tasks",
      value: tasks.filter(
        (item) =>
          ![
            "completed",
            "cancelled",
          ].includes(
            normalizeStatus(item.status)
          )
      ).length,
    },
  ];

  return (
    <div className="rf-operation-summary-list">
      {items.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </div>
  );
}

function AuditJobList({
  jobs,
}) {
  if (!jobs.length) {
    return (
      <EmptyState
        icon="AU"
        title="No audit jobs"
        description="Generated reports will appear here."
        compact
      />
    );
  }

  return (
    <div className="rf-simple-list">
      {jobs.map((job, index) => (
        <article
          key={job.id || index}
          className="rf-simple-list-item"
        >
          <div className="rf-audit-job-identity">
            <strong>
              {job.lead?.business ||
                job.lead?.name ||
                job.businessName ||
                "Business lead"}
            </strong>

            <small>
              {formatLabel(
                job.type ||
                  job.reportType ||
                  "mini_audit"
              )}
            </small>
          </div>

          <StatusBadge
            value={
              job.status ||
              "queued"
            }
          />
        </article>
      ))}
    </div>
  );
}

function AssignmentList({
  assignments,
}) {
  if (!assignments.length) {
    return (
      <EmptyState
        icon="LA"
        title="No lead assignments"
        description="Assigned lead work will appear here."
      />
    );
  }

  return (
    <div className="rf-call-activity-list">
      {assignments.map(
        (assignment, index) => (
          <article
            key={
              assignment.id || index
            }
            className="rf-call-activity-row"
          >
            <div className="rf-call-activity-icon">
              LA
            </div>

            <div className="rf-call-activity-business">
              <strong>
                {assignment.lead?.business ||
                  assignment.lead?.name ||
                  assignment.leadName ||
                  "Business lead"}
              </strong>

              <small>
                Assigned to{" "}
                {assignment.assignee?.name ||
                  assignment.user?.name ||
                  "team member"}
              </small>
            </div>

            <StatusBadge
              value={
                assignment.status ||
                "assigned"
              }
            />

            <div className="rf-call-activity-meta">
              <strong>
                {formatLabel(
                  assignment.priority ||
                    "normal"
                )}
              </strong>

              <small>
                {formatDateTime(
                  assignment.assignedAt ||
                    assignment.createdAt
                )}
              </small>
            </div>
          </article>
        )
      )}
    </div>
  );
}

function TaskList({
  tasks,
}) {
  if (!tasks.length) {
    return (
      <EmptyState
        icon="TK"
        title="No team tasks"
        description="Operational tasks will appear here."
        compact
      />
    );
  }

  return (
    <div className="rf-simple-list">
      {tasks.map((task, index) => (
        <article
          key={task.id || index}
          className="rf-simple-list-item rf-simple-list-item--stacked"
        >
          <div>
            <strong>
              {task.title ||
                "Team task"}
            </strong>

            <small>
              {task.assignee?.name ||
                task.user?.name ||
                "Unassigned"}
            </small>
          </div>

          <div className="rf-simple-list-item__right">
            <StatusBadge
              value={
                task.status ||
                "pending"
              }
            />

            <small>
              {task.dueAt
                ? formatDateTime(task.dueAt)
                : "No due date"}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}

function MemberIdentity({
  member = {},
}) {
  return (
    <div className="rf-member-identity">
      <DashboardAvatar
        profile={member}
      />

      <div>
        <strong>
          {member.name ||
            "Team member"}
        </strong>

        <small>
          {member.jobTitle ||
            formatLabel(
              member.workspaceRole ||
                member.role ||
                "member"
            )}
        </small>
      </div>
    </div>
  );
}

function DashboardAvatar({
  profile = {},
  large = false,
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`rf-avatar ${
        large ? "rf-avatar--large" : ""
      }`}
    >
      {profile.avatarUrl && !failed ? (
        <img
          src={profile.avatarUrl}
          alt={
            profile.name ||
            "Team member"
          }
          onError={() =>
            setFailed(true)
          }
        />
      ) : (
        <span>
          {getInitials(
            profile.name ||
              profile.email ||
              "RF"
          )}
        </span>
      )}
    </span>
  );
}

function StatusBadge({
  value,
}) {
  const status = normalizeStatus(
    value || "unknown"
  );

  return (
    <span
      className={`rf-dashboard-status rf-dashboard-status--${status}`}
    >
      {formatLabel(status)}
    </span>
  );
}

function ProgressValue({
  value,
}) {
  const safeValue = Math.max(
    0,
    Math.min(100, Number(value || 0))
  );

  return (
    <div className="rf-progress-value">
      <div>
        <span
          style={{
            width: `${safeValue}%`,
          }}
        />
      </div>

      <strong>{safeValue}%</strong>
    </div>
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
        <p>{subtitle}</p>
      </div>

      {action}
    </header>
  );
}

function EmptyState({
  icon,
  title,
  description,
  compact = false,
}) {
  return (
    <div
      className={`rf-empty-state ${
        compact
          ? "rf-empty-state--compact"
          : ""
      }`}
    >
      <div className="rf-empty-state__icon">
        {icon}
      </div>

      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function DashboardAlert({
  message,
  onClose,
}) {
  return (
    <div className="rf-inline-alert">
      <span>{safeOwnerDashboardMessage(message)}</span>

      <button
        type="button"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}

function OwnerAccessDenied({
  role,
}) {
  return (
    <main className="rf-role-dashboard rf-owner-dashboard-v7">
      <OwnerDashboardV7Styles />
      <section className="rf-access-denied">
        <div>!</div>

        <h1>Owner access required</h1>

        <p>
          The {formatLabel(role || "current")} role
          cannot access workspace-wide operational
          reporting.
        </p>

        <a href="/app/dashboard">
          Return to dashboard
        </a>
      </section>
    </main>
  );
}

function OwnerDashboardSkeleton() {
  return (
    <main className="rf-role-dashboard rf-owner-dashboard-v7">
      <OwnerDashboardV7Styles />
      <div className="rf-dashboard-skeleton-header" />

      <section className="rf-metric-grid">
        {Array.from({
          length: 8,
        }).map((_, index) => (
          <div
            key={index}
            className="rf-skeleton-card"
          />
        ))}
      </section>

      <div className="rf-dashboard-skeleton-panel" />
    </main>
  );
}

function getSettledValue(
  result,
  fallback
) {
  return result.status === "fulfilled"
    ? result.value
    : fallback;
}

function numberValue(...values) {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return 0;
}

function normalizeRole(value) {
  const role = normalizeStatus(value);

  if (role.includes("owner")) {
    return "owner";
  }

  if (role.includes("admin")) {
    return "admin";
  }

  if (role.includes("manager")) {
    return "manager";
  }

  if (role.includes("caller")) {
    return "caller";
  }

  return role || "viewer";
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
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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

function formatDuration(seconds) {
  const total = Math.max(
    0,
    Number(seconds || 0)
  );

  const hours = Math.floor(
    total / 3600
  );

  const minutes = Math.floor(
    (total % 3600) / 60
  );

  if (!hours && !minutes) {
    return "0 min";
  }

  if (!hours) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}m`;
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

function safeOwnerDashboardMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}


function OwnerDashboardV7Styles() {
  return (
    <style>{`
      .rf-owner-dashboard-v7{
        --rfx-card:#fff;
        --rfx-soft:#f6f7f8;
        --rfx-text:#191c1d;
        --rfx-text2:#4d4c59;
        --rfx-muted:#777784;
        --rfx-line:#e2e4e7;
        --rfx-primary:#4648d4;
        --rfx-primary-dark:#393bbb;
        --rfx-primary-soft:#e8e9ff;
        --rfx-violet:#6b38d4;
        --rfx-violet-soft:#f1ebff;
        --rfx-green:#087a51;
        --rfx-green-soft:#e4f7ee;
        --rfx-red:#ba1a1a;
        --rfx-red-soft:#ffedeb;
        --rfx-amber:#965900;
        --rfx-amber-soft:#fff3d8;
        --rfx-dark:#2e3132;
        --rfx-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfx-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfxPageIn .24s var(--rfx-ease);
      }

      .rf-owner-dashboard-v7 *,
      .rf-owner-dashboard-v7 *::before,
      .rf-owner-dashboard-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfxPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfxPulse{
        0%,100%{opacity:.4}
        50%{opacity:1}
      }

      @keyframes rfxShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rf-owner-dashboard-v7 .rf-dashboard-header{
        min-height:140px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:20px;
        padding:19px;
        margin-bottom:11px;
        overflow:hidden;
        color:#fff;
        background:
          radial-gradient(circle at 88% 15%,rgba(86,89,223,.26),transparent 32%),
          radial-gradient(circle at 14% 90%,rgba(107,56,212,.16),transparent 29%),
          #2e3132;
        border:1px solid rgba(255,255,255,.06);
        border-radius:14px;
        box-shadow:0 9px 24px rgba(25,28,29,.065);
      }

      .rf-owner-dashboard-v7 .rf-dashboard-header__identity{
        min-width:0;
        display:grid;
        grid-template-columns:46px minmax(0,1fr);
        align-items:center;
        gap:11px;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-header__identity > div:last-child{
        min-width:0;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-eyebrow,
      .rf-owner-dashboard-v7 .rf-management-eyebrow{
        margin:0 0 3px;
        color:#c9caff;
        font-size:5.7px;
        font-weight:800;
        letter-spacing:.085em;
        text-transform:uppercase;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-header h1{
        margin:0;
        overflow:hidden;
        color:#fff;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 28px/35px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-subtitle{
        max-width:760px;
        margin:4px 0 0;
        color:rgba(244,246,247,.62);
        font-size:7px;
        line-height:12px;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-header__actions{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:7px;
      }

      .rf-owner-dashboard-v7 .rf-server-status{
        min-width:170px;
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

      .rf-owner-dashboard-v7 .rf-status-dot{
        width:8px;
        height:8px;
        background:#67d7a9;
        border:2px solid rgba(255,255,255,.42);
        border-radius:50%;
        animation:rfxPulse 1.3s infinite ease-in-out;
      }

      .rf-owner-dashboard-v7 .rf-server-status > div{
        display:grid;
        min-width:0;
      }

      .rf-owner-dashboard-v7 .rf-server-status strong{
        color:#fff;
        font-size:5.8px;
      }

      .rf-owner-dashboard-v7 .rf-server-status small{
        margin-top:1px;
        color:rgba(244,246,247,.57);
        font-size:5px;
      }

      .rf-owner-dashboard-v7 .rf-button{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        color:#fff;
        background:var(--rfx-primary);
        border:1px solid var(--rfx-primary);
        border-radius:8px;
        cursor:pointer;
        text-decoration:none;
        font-size:6.3px;
        font-weight:750;
        transition:.14s var(--rfx-ease);
      }

      .rf-owner-dashboard-v7 .rf-button:hover:not(:disabled){
        transform:translateY(-1px);
        background:var(--rfx-primary-dark);
      }

      .rf-owner-dashboard-v7 .rf-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-owner-dashboard-v7 .rf-button--secondary{
        color:var(--rfx-text);
        background:#fff;
        border-color:var(--rfx-line);
        box-shadow:none;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-header .rf-button--secondary{
        color:#fff;
        background:rgba(255,255,255,.08);
        border-color:rgba(255,255,255,.12);
      }

      .rf-owner-dashboard-v7 .rf-button--compact{
        min-height:30px;
        padding:5px 7px;
        font-size:5.3px;
      }

      .rf-owner-dashboard-v7 .rf-inline-alert{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:9px 10px;
        margin-bottom:10px;
        color:#7c1d1d;
        background:var(--rfx-red-soft);
        border:1px solid #ffd0cc;
        border-radius:8px;
        font-size:6.3px;
        line-height:10px;
      }

      .rf-owner-dashboard-v7 .rf-inline-alert button{
        min-height:27px;
        padding:4px 7px;
        color:inherit;
        background:#fff;
        border:1px solid currentColor;
        border-radius:6px;
        cursor:pointer;
        font-size:5.2px;
        font-weight:750;
      }

      .rf-owner-dashboard-v7 .rf-metric-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin-bottom:10px;
      }

      .rf-owner-dashboard-v7 .rf-metric-card{
        min-height:116px;
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        align-content:end;
        gap:8px;
        padding:11px;
        background:
          radial-gradient(circle at 92% 8%,rgba(70,72,212,.045),transparent 28%),
          #fff;
        border:1px solid var(--rfx-line);
        border-radius:10px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
        transition:.14s var(--rfx-ease);
      }

      .rf-owner-dashboard-v7 .rf-metric-card:hover{
        transform:translateY(-1px);
        border-color:#d8d9ef;
        box-shadow:0 8px 20px rgba(25,28,29,.045);
      }

      .rf-owner-dashboard-v7 .rf-metric-card__icon{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        align-self:end;
        color:var(--rfx-primary);
        background:var(--rfx-primary-soft);
        border-radius:8px;
        font-size:5.3px;
        font-weight:850;
      }

      .rf-owner-dashboard-v7 .rf-metric-card > div:last-child{
        min-width:0;
        display:grid;
        align-content:end;
      }

      .rf-owner-dashboard-v7 .rf-metric-card p{
        margin:0;
        color:var(--rfx-muted);
        font-size:5.2px;
        font-weight:700;
      }

      .rf-owner-dashboard-v7 .rf-metric-card strong{
        margin-top:2px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 17px/22px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rf-owner-dashboard-v7 .rf-metric-card small{
        margin-top:1px;
        overflow:hidden;
        color:var(--rfx-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:4.9px;
      }

      .rf-owner-dashboard-v7 .rf-management-navigation{
        position:sticky;
        z-index:20;
        top:64px;
        display:flex;
        gap:4px;
        overflow-x:auto;
        padding:5px;
        margin-bottom:10px;
        background:rgba(255,255,255,.95);
        border:1px solid var(--rfx-line);
        border-radius:10px;
        backdrop-filter:blur(12px);
        scrollbar-width:none;
      }

      .rf-owner-dashboard-v7 .rf-management-navigation::-webkit-scrollbar{display:none}

      .rf-owner-dashboard-v7 .rf-management-navigation button{
        min-height:35px;
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:6px 8px;
        color:var(--rfx-text2);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:5.8px;
        font-weight:750;
      }

      .rf-owner-dashboard-v7 .rf-management-navigation button.is-active,
      .rf-owner-dashboard-v7 .rf-management-navigation button.active{
        color:var(--rfx-primary);
        background:var(--rfx-primary-soft);
      }

      .rf-owner-dashboard-v7 .rf-management-navigation button b{
        min-width:18px;
        padding:3px 5px;
        color:inherit;
        background:#fff;
        border-radius:999px;
        text-align:center;
        font-size:4.8px;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-grid{
        display:grid;
        grid-template-columns:minmax(0,1.45fr) minmax(290px,.55fr);
        align-items:start;
        gap:10px;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-grid__main,
      .rf-owner-dashboard-v7 .rf-dashboard-grid__aside{
        min-width:0;
        display:grid;
        gap:10px;
      }

      .rf-owner-dashboard-v7 .rf-panel,
      .rf-owner-dashboard-v7 .rf-summary-card{
        min-width:0;
        padding:13px;
        margin-bottom:10px;
        background:#fff;
        border:1px solid var(--rfx-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-owner-dashboard-v7 .rf-panel-header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        min-height:52px;
        padding-bottom:9px;
        margin-bottom:9px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-owner-dashboard-v7 .rf-panel-header h2,
      .rf-owner-dashboard-v7 .rf-panel-header h3{
        margin:0;
        font:600 13px/18px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-owner-dashboard-v7 .rf-panel-header p{
        margin:3px 0 0;
        color:var(--rfx-muted);
        font-size:5.7px;
        line-height:9px;
      }

      .rf-owner-dashboard-v7 .rf-performance-summary-grid,
      .rf-owner-dashboard-v7 .rf-operation-summary-list,
      .rf-owner-dashboard-v7 .rf-member-stat-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:6px;
      }

      .rf-owner-dashboard-v7 .rf-performance-summary-grid > *,
      .rf-owner-dashboard-v7 .rf-operation-summary-list > article,
      .rf-owner-dashboard-v7 .rf-member-stat{
        min-height:70px;
        display:grid;
        align-content:center;
        padding:8px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-owner-dashboard-v7 .rf-performance-list,
      .rf-owner-dashboard-v7 .rf-simple-list,
      .rf-owner-dashboard-v7 .rf-call-activity-list,
      .rf-owner-dashboard-v7 .rf-team-tool-list{
        display:grid;
        gap:5px;
      }

      .rf-owner-dashboard-v7 .rf-performance-row,
      .rf-owner-dashboard-v7 .rf-simple-list-item,
      .rf-owner-dashboard-v7 .rf-call-activity-row,
      .rf-owner-dashboard-v7 .rf-team-tool-row{
        min-width:0;
        min-height:56px;
        display:grid;
        align-items:center;
        gap:7px;
        padding:8px 9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        transition:.13s var(--rfx-ease);
      }

      .rf-owner-dashboard-v7 .rf-performance-row:hover,
      .rf-owner-dashboard-v7 .rf-simple-list-item:hover,
      .rf-owner-dashboard-v7 .rf-call-activity-row:hover,
      .rf-owner-dashboard-v7 .rf-team-tool-row:hover{
        background:#f4f4ff;
        border-color:#e1e1f7;
      }

      .rf-owner-dashboard-v7 .rf-performance-row{
        grid-template-columns:30px minmax(0,1fr) repeat(3,64px);
      }

      .rf-owner-dashboard-v7 .rf-performance-rank,
      .rf-owner-dashboard-v7 .rf-call-activity-icon{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        color:var(--rfx-primary);
        background:#fff;
        border-radius:7px;
        font-size:5.3px;
        font-weight:800;
      }

      .rf-owner-dashboard-v7 .rf-call-activity-row{
        grid-template-columns:34px minmax(0,1fr) auto auto;
      }

      .rf-owner-dashboard-v7 .rf-call-activity-icon{
        width:34px;
        height:34px;
      }

      .rf-owner-dashboard-v7 .rf-call-activity-business{
        min-width:0;
        display:grid;
      }

      .rf-owner-dashboard-v7 .rf-call-activity-business strong{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6px;
      }

      .rf-owner-dashboard-v7 .rf-call-activity-business small,
      .rf-owner-dashboard-v7 .rf-call-activity-meta small{
        margin-top:2px;
        color:var(--rfx-muted);
        font-size:5px;
      }

      .rf-owner-dashboard-v7 .rf-team-overview-grid,
      .rf-owner-dashboard-v7 .rf-task-management-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf-owner-dashboard-v7 .rf-team-member-card,
      .rf-owner-dashboard-v7 .rf-managed-task-card{
        min-width:0;
        padding:10px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
      }

      .rf-owner-dashboard-v7 .rf-team-member-card header,
      .rf-owner-dashboard-v7 .rf-member-identity{
        min-width:0;
        display:grid;
        grid-template-columns:36px minmax(0,1fr) auto;
        align-items:center;
        gap:7px;
      }

      .rf-owner-dashboard-v7 .rf-member-status-row{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
        margin-top:7px;
      }

      .rf-owner-dashboard-v7 .rf-member-tool-summary,
      .rf-owner-dashboard-v7 .rf-tool-summary{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:5px;
        margin-top:7px;
      }

      .rf-owner-dashboard-v7 .rf-table-container{
        overflow-x:auto;
        border:1px solid var(--rfx-line);
        border-radius:8px;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-table{
        width:100%;
        min-width:850px;
        border-collapse:collapse;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-table th{
        height:39px;
        padding:7px 8px;
        color:#676873;
        background:#f7f8f9;
        border-bottom:1px solid var(--rfx-line);
        text-align:left;
        white-space:nowrap;
        font-size:5.1px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-table td{
        padding:8px;
        color:var(--rfx-text2);
        border-bottom:1px solid #eff0f1;
        font-size:5.7px;
        line-height:9px;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-table tbody tr:hover td{
        background:#fafaff;
      }

      .rf-owner-dashboard-v7 .rf-management-modal-backdrop{
        position:fixed;
        z-index:2147481000;
        inset:0;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(25,28,29,.58);
        backdrop-filter:blur(8px);
      }

      .rf-owner-dashboard-v7 .rf-management-dialog{
        width:min(720px,100%);
        max-height:calc(100vh - 36px);
        overflow:auto;
        padding:15px;
        background:#fff;
        border:1px solid rgba(255,255,255,.3);
        border-radius:13px;
        box-shadow:0 24px 70px rgba(0,0,0,.18);
      }

      .rf-owner-dashboard-v7 .rf-management-dialog--wide{
        width:min(900px,100%);
      }

      .rf-owner-dashboard-v7 .rf-management-dialog-form,
      .rf-owner-dashboard-v7 .rf-dialog-form-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
      }

      .rf-owner-dashboard-v7 .rf-management-field{
        display:grid;
        gap:4px;
      }

      .rf-owner-dashboard-v7 .rf-management-field--wide{
        grid-column:1/-1;
      }

      .rf-owner-dashboard-v7 input,
      .rf-owner-dashboard-v7 select,
      .rf-owner-dashboard-v7 textarea{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfx-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 6.5px/11px Inter,sans-serif;
      }

      .rf-owner-dashboard-v7 textarea{
        min-height:86px;
        resize:vertical;
      }

      .rf-owner-dashboard-v7 input:focus,
      .rf-owner-dashboard-v7 select:focus,
      .rf-owner-dashboard-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-owner-dashboard-v7 .rf-management-dialog-footer{
        display:flex;
        justify-content:flex-end;
        gap:7px;
        grid-column:1/-1;
        padding-top:9px;
        border-top:1px solid #eff0f1;
      }

      .rf-owner-dashboard-v7 .rf-lead-selection-list{
        display:grid;
        gap:5px;
        max-height:300px;
        overflow:auto;
      }

      .rf-owner-dashboard-v7 .rf-lead-selection-item{
        min-height:50px;
        display:grid;
        grid-template-columns:15px minmax(0,1fr);
        align-items:center;
        gap:7px;
        padding:7px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-owner-dashboard-v7 .rf-empty-state,
      .rf-owner-dashboard-v7 .rf-access-denied{
        min-height:170px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:22px;
        color:var(--rfx-muted);
        background:#fff;
        border:1px dashed #d8dade;
        border-radius:10px;
        text-align:center;
      }

      .rf-owner-dashboard-v7 .rf-access-denied{
        min-height:330px;
        max-width:720px;
        margin:40px auto 0;
        border-style:solid;
      }

      .rf-owner-dashboard-v7 .rf-access-denied h1,
      .rf-owner-dashboard-v7 .rf-empty-state h3{
        margin:3px 0 0;
        color:var(--rfx-text);
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rf-owner-dashboard-v7 .rf-access-denied p,
      .rf-owner-dashboard-v7 .rf-empty-state p{
        max-width:440px;
        margin:0;
        font-size:5.8px;
        line-height:10px;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-skeleton-header,
      .rf-owner-dashboard-v7 .rf-skeleton-card,
      .rf-owner-dashboard-v7 .rf-dashboard-skeleton-panel{
        background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);
        background-size:220% 100%;
        animation:rfxShimmer 1.15s linear infinite;
      }

      .rf-owner-dashboard-v7 .rf-dashboard-skeleton-header{height:140px;margin-bottom:10px;border-radius:14px}
      .rf-owner-dashboard-v7 .rf-skeleton-card{height:116px;border-radius:10px}
      .rf-owner-dashboard-v7 .rf-dashboard-skeleton-panel{height:245px;margin-bottom:10px;border-radius:11px}

      @media(max-width:1120px){
        .rf-owner-dashboard-v7{padding:22px}
        .rf-owner-dashboard-v7 .rf-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .rf-owner-dashboard-v7 .rf-dashboard-grid{grid-template-columns:1fr}
        .rf-owner-dashboard-v7 .rf-team-overview-grid,
        .rf-owner-dashboard-v7 .rf-task-management-grid{grid-template-columns:1fr 1fr}
      }

      @media(max-width:760px){
        .rf-owner-dashboard-v7 .rf-dashboard-header{align-items:flex-start;flex-direction:column}
        .rf-owner-dashboard-v7 .rf-dashboard-header__actions{width:100%}
        .rf-owner-dashboard-v7 .rf-server-status{flex:1}
        .rf-owner-dashboard-v7 .rf-performance-summary-grid,
        .rf-owner-dashboard-v7 .rf-operation-summary-list,
        .rf-owner-dashboard-v7 .rf-member-stat-grid{grid-template-columns:1fr 1fr}
        .rf-owner-dashboard-v7 .rf-performance-row{grid-template-columns:30px minmax(0,1fr) auto}
        .rf-owner-dashboard-v7 .rf-performance-row__metric:nth-last-child(-n+2){display:none}
      }

      @media(max-width:620px){
        .rf-owner-dashboard-v7{padding:18px 12px 80px}
        .rf-owner-dashboard-v7 .rf-dashboard-header{padding:15px}
        .rf-owner-dashboard-v7 .rf-dashboard-header h1{font-size:23px;line-height:30px}
        .rf-owner-dashboard-v7 .rf-dashboard-header__actions{display:grid;grid-template-columns:1fr}
        .rf-owner-dashboard-v7 .rf-server-status,
        .rf-owner-dashboard-v7 .rf-dashboard-header .rf-button{width:100%}
        .rf-owner-dashboard-v7 .rf-management-navigation{top:61px;margin-left:-12px;margin-right:-12px;border-left:0;border-right:0;border-radius:0}
        .rf-owner-dashboard-v7 .rf-team-overview-grid,
        .rf-owner-dashboard-v7 .rf-task-management-grid,
        .rf-owner-dashboard-v7 .rf-dialog-form-grid,
        .rf-owner-dashboard-v7 .rf-management-dialog-form{grid-template-columns:1fr}
        .rf-owner-dashboard-v7 .rf-management-field--wide{grid-column:auto}
        .rf-owner-dashboard-v7 .rf-call-activity-row{grid-template-columns:34px minmax(0,1fr)}
        .rf-owner-dashboard-v7 .rf-call-activity-row > *:nth-child(n+3){grid-column:2}
        .rf-owner-dashboard-v7 .rf-management-modal-backdrop{padding:0}
        .rf-owner-dashboard-v7 .rf-management-dialog,
        .rf-owner-dashboard-v7 .rf-management-dialog--wide{width:100%;min-height:100vh;max-height:100vh;border-radius:0}
      }

      @media(max-width:430px){
        .rf-owner-dashboard-v7 .rf-metric-grid,
        .rf-owner-dashboard-v7 .rf-performance-summary-grid,
        .rf-owner-dashboard-v7 .rf-operation-summary-list,
        .rf-owner-dashboard-v7 .rf-member-stat-grid{grid-template-columns:1fr}
        .rf-owner-dashboard-v7 .rf-dashboard-header__identity{grid-template-columns:1fr}
      }

      @media(prefers-reduced-motion:reduce){
        .rf-owner-dashboard-v7,
        .rf-owner-dashboard-v7 *,
        .rf-owner-dashboard-v7 *::before,
        .rf-owner-dashboard-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
