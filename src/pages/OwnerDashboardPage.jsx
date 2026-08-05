import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiRequest,
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
          apiRequest("/owner-dashboard/overview"),
          apiRequest("/team-management/performance"),
          apiRequest("/attendance/team/today"),
          apiRequest("/calls?limit=15"),
          apiRequest("/team-management/tasks?limit=15"),
          apiRequest("/team-management/assignments?limit=15"),
          apiRequest("/audit-jobs?limit=15"),
        ]);

        const overviewResponse = getSettledValue(results[0], {});
        const performanceResponse = getSettledValue(results[1], {});
        const attendanceResponse = getSettledValue(results[2], {});
        const callsResponse = getSettledValue(results[3], {});
        const tasksResponse = getSettledValue(results[4], {});
        const assignmentsResponse = getSettledValue(results[5], {});
        const auditResponse = getSettledValue(results[6], {});

        setOverview(
          overviewResponse.overview ||
            overviewResponse.metrics ||
            overviewResponse
        );

        setTeamPerformance(
          performanceResponse.performance ||
            performanceResponse.members ||
            []
        );

        setAttendance(
          attendanceResponse.attendance ||
            attendanceResponse.records ||
            attendanceResponse.members ||
            []
        );

        setRecentCalls(
          callsResponse.calls ||
            callsResponse.records ||
            []
        );

        setTasks(
          tasksResponse.tasks ||
            tasksResponse.records ||
            []
        );

        setAssignments(
          assignmentsResponse.assignments ||
            assignmentsResponse.records ||
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
    <main className="rf-role-dashboard">
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
            Workspace command center
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
        title="Audit operations"
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
      <span>{message}</span>

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
    <main className="rf-role-dashboard">
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
    <main className="rf-role-dashboard">
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