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

export default function ManagerDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [calls, setCalls] = useState([]);
  const [unassignedLeads, setUnassignedLeads] = useState([]);
  const [dialers, setDialers] = useState([]);
  const [senders, setSenders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeSection, setActiveSection] =
    useState("overview");

  const [showAssignmentDialog, setShowAssignmentDialog] =
    useState(false);

  const [showTaskDialog, setShowTaskDialog] =
    useState(false);

  const [showToolDialog, setShowToolDialog] =
    useState(false);

  const [selectedMember, setSelectedMember] =
    useState(null);

  useEffect(() => {
    if (!success) {
      return;
    }

    notifyManagerDashboard(
      "success",
      "Team operations updated",
      success
    );
  }, [success]);

  const role = normalizeRole(
    profile?.workspaceRole ||
      profile?.role
  );

  const canAccess = [
    "owner",
    "admin",
    "manager",
  ].includes(role);

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
        const profileResponse =
          await apiRequest("/profile/me");

        const currentProfile =
          profileResponse.profile ||
          profileResponse.user ||
          profileResponse;

        setProfile(currentProfile);

        const currentRole =
          normalizeRole(
            currentProfile?.workspaceRole ||
              currentProfile?.role
          );

        if (
          ![
            "owner",
            "admin",
            "manager",
          ].includes(currentRole)
        ) {
          return;
        }

        const results =
          await Promise.allSettled([
            apiRequest(
              "/team"
            ),

            apiRequest(
              "/team/performance"
            ),

            apiRequest(
              "/attendance/team"
            ),

            apiRequest(
              "/sales/assignments?limit=250"
            ),

            apiRequest(
              "/team-communication/tasks?limit=250"
            ),

            apiRequest(
              "/telnyx/calls?limit=100"
            ),

            apiRequest(
              "/resource-board/unassigned-leads?limit=500"
            ),

            apiRequest(
              "/dialers"
            ),

            apiRequest(
              "/senders"
            ),
          ]);

        const failures = [];

        const memberResponse =
          getSettledValue(
            results[0],
            {},
            "team",
            failures
          );

        const performanceResponse =
          getSettledValue(
            results[1],
            {},
            "team performance",
            failures
          );

        const attendanceResponse =
          getSettledValue(
            results[2],
            {},
            "team attendance",
            failures
          );

        const assignmentResponse =
          getSettledValue(
            results[3],
            {},
            "lead assignments",
            failures
          );

        const taskResponse =
          getSettledValue(
            results[4],
            {},
            "team tasks",
            failures
          );

        const callResponse =
          getSettledValue(
            results[5],
            {},
            "Telnyx calls",
            failures
          );

        const leadResponse =
          getSettledValue(
            results[6],
            {},
            "unassigned leads",
            failures
          );

        const dialerResponse =
          getSettledValue(
            results[7],
            {},
            "dialers",
            failures
          );

        const senderResponse =
          getSettledValue(
            results[8],
            {},
            "senders",
            failures
          );

        setTeamMembers(
          extractList(
            memberResponse,
            ["members", "profiles", "users"]
          )
        );

        setPerformance(
          extractList(
            performanceResponse,
            ["performance", "members", "records"]
          )
        );

        setAttendance(
          extractList(
            attendanceResponse,
            ["attendance", "records", "members"]
          )
        );

        setAssignments(
          extractList(
            assignmentResponse,
            ["assignments", "records"]
          )
        );

        setTasks(
          extractList(
            taskResponse,
            ["tasks", "records"]
          )
        );

        setCalls(
          extractList(
            callResponse,
            ["calls", "records"]
          )
        );

        setUnassignedLeads(
          extractList(
            leadResponse,
            ["leads", "records"]
          )
        );

        setDialers(
          extractList(
            dialerResponse,
            ["dialers", "records"]
          )
        );

        setSenders(
          extractList(
            senderResponse,
            ["senders", "records"]
          )
        );

        if (failures.length) {
          setError(
            `Some manager data could not be loaded: ${failures.join(", ")}.`
          );
        }
      } catch (requestError) {
        setError(
          requestError?.message ||
            "The manager dashboard could not be loaded."
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
      "profile:availability-updated",
      "team:member-created",
      "team:member-updated",
      "team:assignment-created",
      "team:assignment-updated",
      "team:task-created",
      "team:task-updated",
      "team:tools-updated",
      "call:completed",
      "call:failed",
      "lead:updated",
    ];

    const unsubscribe = events.map(
      (eventName) =>
        onWorkspaceSocket(
          eventName,
          () => {
            loadDashboard({
              silent: true,
            });
          }
        )
    );

    return () => {
      unsubscribe.forEach(
        (stop) => stop()
      );
    };
  }, [loadDashboard]);

  const managedMembers = useMemo(
    () =>
      teamMembers.filter((member) => {
        const memberRole =
          normalizeRole(
            member.workspaceRole ||
              member.role
          );

        if (
          role === "owner" ||
          role === "admin"
        ) {
          return [
            "manager",
            "caller",
            "viewer",
          ].includes(memberRole);
        }

        return (
          memberRole === "caller" ||
          member.managerId === profile?.id ||
          member.manager?.id === profile?.id
        );
      }),
    [
      teamMembers,
      role,
      profile?.id,
    ]
  );

  const callerMembers = useMemo(
    () =>
      managedMembers.filter(
        (member) =>
          normalizeRole(
            member.workspaceRole ||
              member.role
          ) === "caller"
      ),
    [managedMembers]
  );

  const metrics = useMemo(() => {
    const managedIds =
      new Set(
        managedMembers.map(
          (member) => member.id
        )
      );

    const managedAssignments =
      assignments.filter(
        (assignment) =>
          managedIds.has(
            getAssigneeId(
              assignment
            )
          )
      );

    const managedTasks =
      tasks.filter((task) =>
        managedIds.has(
          getAssigneeId(task)
        )
      );

    const managedCalls =
      calls.filter((call) =>
        managedIds.has(
          getCallerId(call)
        )
      );

    const checkedIn =
      attendance.filter(
        (record) =>
          managedIds.has(
            getAttendanceUserId(
              record
            )
          ) &&
          [
            "checked_in",
            "present",
            "late",
          ].includes(
            normalizeStatus(
              record.status
            )
          )
      ).length;

    const activeMembers =
      managedMembers.filter(
        (member) =>
          [
            "available",
            "busy",
            "away",
          ].includes(
            normalizeStatus(
              member.availabilityStatus
            )
          )
      ).length;

    const activeAssignments =
      managedAssignments.filter(
        (assignment) =>
          ![
            "completed",
            "cancelled",
            "do_not_contact",
          ].includes(
            normalizeStatus(
              assignment.status
            )
          )
      ).length;

    const pendingTasks =
      managedTasks.filter(
        (task) =>
          ![
            "completed",
            "cancelled",
          ].includes(
            normalizeStatus(
              task.status
            )
          )
      ).length;

    const qualified =
      managedAssignments.filter(
        (assignment) =>
          [
            "qualified",
            "meeting_booked",
          ].includes(
            normalizeStatus(
              assignment.status
            )
          )
      ).length;

    const meetings =
      managedAssignments.filter(
        (assignment) =>
          normalizeStatus(
            assignment.status
          ) === "meeting_booked"
      ).length;

    const answeredCalls =
      managedCalls.filter((call) =>
        [
          "answered",
          "connected",
          "completed",
          "qualified",
          "meeting_booked",
        ].includes(
          normalizeStatus(
            call.outcome ||
              call.status
          )
        )
      ).length;

    return {
      memberCount:
        managedMembers.length,
      activeMembers,
      checkedIn,
      activeAssignments,
      pendingTasks,
      totalCalls:
        managedCalls.length,
      answeredCalls,
      qualified,
      meetings,
      unassignedLeads:
        unassignedLeads.length,
    };
  }, [
    managedMembers,
    assignments,
    tasks,
    calls,
    attendance,
    unassignedLeads,
  ]);

  const rankedPerformance =
    useMemo(() => {
      const performanceMap =
        new Map(
          performance.map((item) => [
            item.userId ||
              item.member?.id ||
              item.id,
            item,
          ])
        );

      return managedMembers
        .map((member) => ({
          member,
          performance:
            performanceMap.get(
              member.id
            ) || {},
        }))
        .sort((a, b) => {
          const aMetrics =
            a.performance.metrics ||
            a.performance;

          const bMetrics =
            b.performance.metrics ||
            b.performance;

          const aScore =
            Number(
              aMetrics.qualifiedLeads ||
                0
            ) *
              4 +
            Number(
              aMetrics.meetingsBooked ||
                0
            ) *
              6 +
            Number(
              aMetrics.answeredCalls ||
                0
            );

          const bScore =
            Number(
              bMetrics.qualifiedLeads ||
                0
            ) *
              4 +
            Number(
              bMetrics.meetingsBooked ||
                0
            ) *
              6 +
            Number(
              bMetrics.answeredCalls ||
                0
            );

          return bScore - aScore;
        });
    }, [
      managedMembers,
      performance,
    ]);

  if (loading) {
    return (
      <ManagerDashboardSkeleton />
    );
  }

  if (!canAccess) {
    return (
      <ManagerAccessDenied
        role={role}
      />
    );
  }

  return (
    <main className="rf-role-dashboard rf-manager-dashboard-v7">
      <ManagerDashboardV7Styles />
      <ManagerHeader
        profile={profile}
        refreshing={refreshing}
        onRefresh={() =>
          loadDashboard({
            silent: true,
          })
        }
        onAssignLeads={() => {
          setSelectedMember(null);
          setShowAssignmentDialog(
            true
          );
        }}
        onCreateTask={() => {
          setSelectedMember(null);
          setShowTaskDialog(true);
        }}
      />

      {error ? (
        <DashboardAlert
          type="error"
          message={error}
          onClose={() =>
            setError("")
          }
        />
      ) : null}

      {success ? (
        <DashboardAlert
          type="success"
          message={success}
          onClose={() =>
            setSuccess("")
          }
        />
      ) : null}

      <ManagerMetricGrid
        metrics={metrics}
      />

      <ManagerNavigation
        activeSection={activeSection}
        onChange={setActiveSection}
        counts={{
          team:
            managedMembers.length,
          assignments:
            assignments.length,
          tasks: tasks.length,
          calls: calls.length,
        }}
      />

      {activeSection ===
      "overview" ? (
        <ManagerOverview
          metrics={metrics}
          performance={
            rankedPerformance
          }
          attendance={attendance}
          managedMembers={
            managedMembers
          }
          assignments={
            assignments
          }
          tasks={tasks}
          calls={calls}
          onAssignLead={(member) => {
            setSelectedMember(member);
            setShowAssignmentDialog(
              true
            );
          }}
          onAssignTask={(member) => {
            setSelectedMember(member);
            setShowTaskDialog(true);
          }}
          onConfigureTools={(
            member
          ) => {
            setSelectedMember(member);
            setShowToolDialog(true);
          }}
        />
      ) : null}

      {activeSection === "team" ? (
        <ManagerTeamSection
          members={managedMembers}
          performance={
            rankedPerformance
          }
          attendance={attendance}
          onAssignLead={(member) => {
            setSelectedMember(member);
            setShowAssignmentDialog(
              true
            );
          }}
          onAssignTask={(member) => {
            setSelectedMember(member);
            setShowTaskDialog(true);
          }}
          onConfigureTools={(
            member
          ) => {
            setSelectedMember(member);
            setShowToolDialog(true);
          }}
        />
      ) : null}

      {activeSection ===
      "assignments" ? (
        <ManagerAssignmentsSection
          assignments={
            assignments
          }
          managedMembers={
            managedMembers
          }
          onCreate={() => {
            setSelectedMember(null);
            setShowAssignmentDialog(
              true
            );
          }}
          onUpdated={(updated) => {
            setAssignments(
              (current) =>
                current.map((item) =>
                  item.id === updated.id
                    ? updated
                    : item
                )
            );

            setSuccess(
              "The lead assignment was updated."
            );
          }}
          onError={setError}
        />
      ) : null}

      {activeSection === "tasks" ? (
        <ManagerTasksSection
          tasks={tasks}
          managedMembers={
            managedMembers
          }
          onCreate={() => {
            setSelectedMember(null);
            setShowTaskDialog(true);
          }}
          onUpdated={(updated) => {
            setTasks((current) =>
              current.map((item) =>
                item.id === updated.id
                  ? updated
                  : item
              )
            );

            setSuccess(
              "The task was updated."
            );
          }}
          onError={setError}
        />
      ) : null}

      {activeSection === "calls" ? (
        <ManagerCallsSection
          calls={calls}
          managedMembers={
            managedMembers
          }
        />
      ) : null}

      {activeSection === "tools" ? (
        <ManagerToolsSection
          members={callerMembers}
          dialers={dialers}
          senders={senders}
          onConfigure={(member) => {
            setSelectedMember(member);
            setShowToolDialog(true);
          }}
        />
      ) : null}

      {showAssignmentDialog ? (
        <ManagerAssignmentDialog
          members={callerMembers}
          leads={unassignedLeads}
          selectedMember={
            callerMembers.find(
              (member) =>
                member.id ===
                selectedMember?.id
            ) || null
          }
          onClose={() =>
            setShowAssignmentDialog(
              false
            )
          }
          onCreated={(created) => {
            setAssignments(
              (current) => [
                ...created,
                ...current,
              ]
            );

            const assignedLeadIds =
              new Set(
                created
                  .map(
                    (item) =>
                      item.leadId ||
                      item.lead?.id
                  )
                  .filter(Boolean)
              );

            const assignedAssignmentIds =
              new Set(
                created
                  .map(
                    (item) =>
                      item.assignmentId ||
                      item.id
                  )
                  .filter(Boolean)
              );

            setUnassignedLeads(
              (current) =>
                current.filter(
                  (lead) =>
                    !assignedLeadIds.has(
                      lead.leadId ||
                        lead.id
                    ) &&
                    !assignedAssignmentIds.has(
                      lead.assignmentId ||
                        ""
                    )
                )
            );

            setShowAssignmentDialog(
              false
            );

            setSuccess(
              `${created.length} lead assignment${
                created.length === 1
                  ? ""
                  : "s"
              } created successfully.`
            );
          }}
          onError={setError}
        />
      ) : null}

      {showTaskDialog ? (
        <ManagerTaskDialog
          members={managedMembers}
          selectedMember={
            selectedMember
          }
          onClose={() =>
            setShowTaskDialog(false)
          }
          onCreated={(task) => {
            setTasks((current) => [
              task,
              ...current,
            ]);

            setShowTaskDialog(false);

            setSuccess(
              "The task was assigned successfully."
            );
          }}
          onError={setError}
        />
      ) : null}

      {showToolDialog ? (
        <ManagerToolDialog
          members={callerMembers}
          member={
            callerMembers.find(
              (member) =>
                member.id ===
                selectedMember?.id
            ) || null
          }
          dialers={dialers}
          senders={senders}
          onClose={() =>
            setShowToolDialog(false)
          }
          onUpdated={(
            updatedMember
          ) => {
            setTeamMembers(
              (current) =>
                current.map((member) =>
                  member.id ===
                  updatedMember.id
                    ? {
                        ...member,
                        ...updatedMember,
                      }
                    : member
                )
            );

            setShowToolDialog(false);

            setSuccess(
              "The caller work tools were updated."
            );
          }}
          onError={setError}
        />
      ) : null}
    </main>
  );
}

function ManagerHeader({
  profile,
  refreshing,
  onRefresh,
  onAssignLeads,
  onCreateTask,
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
            Team operations
          </p>

          <h1>Manager dashboard</h1>

          <p className="rf-dashboard-subtitle">
            Assign leads, monitor caller
            performance, review attendance
            and manage daily team
            workload.
          </p>
        </div>
      </div>

      <div className="rf-dashboard-header__actions">
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

        <button
          type="button"
          className="rf-button rf-button--secondary"
          onClick={onCreateTask}
        >
          Assign task
        </button>

        <button
          type="button"
          className="rf-button"
          onClick={onAssignLeads}
        >
          Assign leads
        </button>
      </div>
    </header>
  );
}

function ManagerMetricGrid({
  metrics,
}) {
  const cards = [
    {
      label: "Managed team",
      value: metrics.memberCount,
      note: `${metrics.activeMembers} available now`,
      icon: "TM",
    },
    {
      label: "Checked in",
      value: metrics.checkedIn,
      note: "Attendance today",
      icon: "AT",
    },
    {
      label: "Unassigned leads",
      value:
        metrics.unassignedLeads,
      note: "Ready for distribution",
      icon: "UL",
    },
    {
      label: "Active assignments",
      value:
        metrics.activeAssignments,
      note: "Leads in progress",
      icon: "LA",
    },
    {
      label: "Calls recorded",
      value: metrics.totalCalls,
      note: `${metrics.answeredCalls} connected`,
      icon: "CL",
    },
    {
      label: "Qualified",
      value: metrics.qualified,
      note: `${metrics.meetings} meetings booked`,
      icon: "QL",
    },
    {
      label: "Pending tasks",
      value: metrics.pendingTasks,
      note: "Open team workload",
      icon: "TK",
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

function ManagerNavigation({
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
      label: "My team",
      count: counts.team,
    },
    {
      id: "assignments",
      label: "Lead assignments",
      count: counts.assignments,
    },
    {
      id: "tasks",
      label: "Tasks",
      count: counts.tasks,
    },
    {
      id: "calls",
      label: "Call performance",
      count: counts.calls,
    },
    {
      id: "tools",
      label: "Dialers and senders",
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
          onClick={() =>
            onChange(item.id)
          }
        >
          <span>{item.label}</span>

          {Number.isFinite(
            item.count
          ) ? (
            <b>{item.count}</b>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function ManagerOverview({
  metrics,
  performance,
  attendance,
  managedMembers,
  assignments,
  tasks,
  calls,
  onAssignLead,
  onAssignTask,
  onConfigureTools,
}) {
  return (
    <section className="rf-dashboard-grid">
      <div className="rf-dashboard-grid__main">
        <section className="rf-panel">
          <PanelHeader
            title="Caller performance"
            subtitle="The strongest recent performance across your managed team."
          />

          {!performance.length ? (
            <EmptyState
              icon="CP"
              title="No performance data"
              description="Caller performance appears after calls and lead outcomes are recorded."
            />
          ) : (
            <div className="rf-performance-list">
              {performance
                .slice(0, 6)
                .map(
                  (
                    item,
                    index
                  ) => (
                    <ManagerPerformanceRow
                      key={
                        item.member.id
                      }
                      rank={index + 1}
                      member={
                        item.member
                      }
                      performance={
                        item.performance
                      }
                      onAssignLead={() =>
                        onAssignLead(
                          item.member
                        )
                      }
                    />
                  )
                )}
            </div>
          )}
        </section>

        <section className="rf-panel">
          <PanelHeader
            title="Recent call activity"
            subtitle="Latest call attempts and outcomes from your callers."
          />

          <ManagerCallList
            calls={calls.slice(0, 10)}
          />
        </section>
      </div>

      <aside className="rf-dashboard-grid__aside">
        <section className="rf-panel">
          <PanelHeader
            title="Attendance today"
            subtitle="Live caller check-in status."
          />

          <ManagerAttendanceList
            attendance={attendance}
            members={managedMembers}
          />
        </section>

        <section className="rf-panel">
          <PanelHeader
            title="Workload summary"
            subtitle="Current assignments and tasks."
          />

          <WorkloadSummary
            metrics={metrics}
            assignments={assignments}
            tasks={tasks}
          />
        </section>

        <section className="rf-panel">
          <PanelHeader
            title="Quick team actions"
            subtitle="Assign work or configure caller resources."
          />

          <div className="rf-simple-list">
            {managedMembers
              .slice(0, 6)
              .map((member) => (
                <article
                  key={member.id}
                  className="rf-simple-list-item rf-simple-list-item--stacked"
                >
                  <MemberIdentity
                    member={member}
                  />

                  <div className="rf-dashboard-quick-actions">
                    <button
                      type="button"
                      onClick={() =>
                        onAssignLead(
                          member
                        )
                      }
                    >
                      Leads
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onAssignTask(
                          member
                        )
                      }
                    >
                      Task
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onConfigureTools(
                          member
                        )
                      }
                    >
                      Tools
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </section>
      </aside>
    </section>
  );
}

function ManagerTeamSection({
  members,
  performance,
  attendance,
  onAssignLead,
  onAssignTask,
  onConfigureTools,
}) {
  const performanceMap =
    new Map(
      performance.map((item) => [
        item.member.id,
        item.performance,
      ])
    );

  const attendanceMap =
    new Map(
      attendance.map((record) => [
        getAttendanceUserId(
          record
        ),
        record,
      ])
    );

  return (
    <section className="rf-panel">
      <PanelHeader
        title="Managed team"
        subtitle="Review caller availability, attendance, activity and assigned resources."
      />

      {!members.length ? (
        <EmptyState
          icon="TM"
          title="No managed team members"
          description="Callers assigned to this manager will appear here."
        />
      ) : (
        <div className="rf-team-overview-grid">
          {members.map((member) => (
            <ManagerMemberCard
              key={member.id}
              member={member}
              performance={
                performanceMap.get(
                  member.id
                ) || {}
              }
              attendance={
                attendanceMap.get(
                  member.id
                ) || null
              }
              onAssignLead={() =>
                onAssignLead(member)
              }
              onAssignTask={() =>
                onAssignTask(member)
              }
              onConfigureTools={() =>
                onConfigureTools(
                  member
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ManagerMemberCard({
  member,
  performance,
  attendance,
  onAssignLead,
  onAssignTask,
  onConfigureTools,
}) {
  const metrics =
    performance.metrics ||
    performance;

  return (
    <article className="rf-team-member-card">
      <header>
        <DashboardAvatar
          profile={member}
        />

        <div>
          <h3>{member.name}</h3>

          <p>
            {member.jobTitle ||
              formatLabel(
                member.workspaceRole ||
                  member.role
              )}
          </p>

          <span>
            {member.email}
          </span>
        </div>

        <StatusBadge
          value={
            member.availabilityStatus ||
            "offline"
          }
        />
      </header>

      <div className="rf-member-status-row">
        <StatusBadge
          value={
            attendance?.status ||
            "not_checked_in"
          }
        />

        <StatusBadge
          value={
            member.status ||
            "active"
          }
        />
      </div>

      <div className="rf-member-stat-grid">
        <SmallStat
          label="Calls"
          value={
            metrics.totalCalls || 0
          }
        />

        <SmallStat
          label="Qualified"
          value={
            metrics.qualifiedLeads ||
            0
          }
        />

        <SmallStat
          label="Meetings"
          value={
            metrics.meetingsBooked ||
            0
          }
        />
      </div>

      <div className="rf-member-tool-summary">
        <SummaryValue
          label="Calling connection"
          value={
            member.assignedDialer
              ?.name ||
            member.dialer?.name ||
            "Not assigned"
          }
        />

        <SummaryValue
          label="Sender"
          value={
            member.assignedSender
              ?.fromEmail ||
            member.sender
              ?.fromEmail ||
            "Not assigned"
          }
        />
      </div>

      <footer>
        <button
          type="button"
          onClick={onAssignLead}
        >
          Assign leads
        </button>

        <div>
          <button
            type="button"
            onClick={onAssignTask}
          >
            Task
          </button>

          <button
            type="button"
            onClick={
              onConfigureTools
            }
          >
            Tools
          </button>
        </div>
      </footer>
    </article>
  );
}

function ManagerAssignmentsSection({
  assignments,
  managedMembers,
  onCreate,
  onUpdated,
  onError,
}) {
  const memberMap =
    new Map(
      managedMembers.map(
        (member) => [
          member.id,
          member,
        ]
      )
    );

  async function updateStatus(
    assignment,
    status
  ) {
    try {
      const response =
        await apiRequest(
          `/sales/assignments/${encodeURIComponent(
            assignment.id
          )}`,
          {
            method: "PATCH",
            body: {
              status,
            },
          }
        );

      onUpdated(
        response.assignment ||
          response
      );
    } catch (requestError) {
      onError(
        requestError?.message ||
          "The assignment could not be updated."
      );
    }
  }

  return (
    <section className="rf-panel">
      <PanelHeader
        title="Lead assignments"
        subtitle="Distribute leads and monitor each caller's progress."
        action={
          <button
            type="button"
            className="rf-button"
            onClick={onCreate}
          >
            Assign leads
          </button>
        }
      />

      {!assignments.length ? (
        <EmptyState
          icon="LA"
          title="No assignments"
          description="Assign leads to a caller to begin tracking outreach."
        />
      ) : (
        <div className="rf-table-container">
          <table className="rf-dashboard-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Caller</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Last contact</th>
                <th>Next action</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {assignments.map(
                (assignment) => {
                  const member =
                    memberMap.get(
                      getAssigneeId(
                        assignment
                      )
                    );

                  const lead =
                    assignment.lead ||
                    {};

                  return (
                    <tr
                      key={
                        assignment.id
                      }
                    >
                      <td>
                        <LeadIdentity
                          lead={lead}
                        />
                      </td>

                      <td>
                        {member ? (
                          <MemberIdentity
                            member={
                              member
                            }
                          />
                        ) : (
                          "Unassigned"
                        )}
                      </td>

                      <td>
                        <StatusBadge
                          value={
                            assignment.status ||
                            "assigned"
                          }
                        />
                      </td>

                      <td>
                        <StatusBadge
                          value={
                            assignment.priority ||
                            "normal"
                          }
                        />
                      </td>

                      <td>
                        {formatDateTime(
                          assignment.lastContactedAt
                        )}
                      </td>

                      <td>
                        {formatDateTime(
                          assignment.nextActionAt
                        )}
                      </td>

                      <td>
                        <select
                          value={
                            assignment.status ||
                            "assigned"
                          }
                          onChange={(
                            event
                          ) =>
                            updateStatus(
                              assignment,
                              event.target
                                .value
                            )
                          }
                        >
                          {[
                            "assigned",
                            "in_progress",
                            "follow_up",
                            "qualified",
                            "meeting_booked",
                            "completed",
                            "do_not_contact",
                          ].map(
                            (
                              status
                            ) => (
                              <option
                                key={
                                  status
                                }
                                value={
                                  status
                                }
                              >
                                {formatLabel(
                                  status
                                )}
                              </option>
                            )
                          )}
                        </select>
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

function ManagerTasksSection({
  tasks,
  managedMembers,
  onCreate,
  onUpdated,
  onError,
}) {
  const memberMap =
    new Map(
      managedMembers.map(
        (member) => [
          member.id,
          member,
        ]
      )
    );

  async function updateTaskStatus(
    task,
    status
  ) {
    try {
      const response =
        await apiRequest(
          `/team-communication/tasks/${encodeURIComponent(
            task.id
          )}`,
          {
            method: "PATCH",
            body: {
              status,
            },
          }
        );

      onUpdated(
        response.task ||
          response
      );
    } catch (requestError) {
      onError(
        requestError?.message ||
          "The task could not be updated."
      );
    }
  }

  return (
    <section className="rf-panel">
      <PanelHeader
        title="Team tasks"
        subtitle="Create, monitor and complete team operational tasks."
        action={
          <button
            type="button"
            className="rf-button"
            onClick={onCreate}
          >
            Assign task
          </button>
        }
      />

      {!tasks.length ? (
        <EmptyState
          icon="TK"
          title="No team tasks"
          description="Create a task for a caller or team member."
        />
      ) : (
        <div className="rf-task-management-grid">
          {tasks.map((task) => {
            const member =
              memberMap.get(
                getAssigneeId(task)
              );

            return (
              <article
                key={task.id}
                className="rf-managed-task-card"
              >
                <header>
                  <StatusBadge
                    value={
                      task.priority ||
                      "normal"
                    }
                  />

                  <StatusBadge
                    value={
                      task.status ||
                      "pending"
                    }
                  />
                </header>

                <h3>
                  {task.title ||
                    "Team task"}
                </h3>

                <p>
                  {task.description ||
                    "No task description was provided."}
                </p>

                <div className="rf-managed-task-card__meta">
                  <div>
                    <small>
                      Assigned to
                    </small>

                    <strong>
                      {member?.name ||
                        "Unassigned"}
                    </strong>
                  </div>

                  <div>
                    <small>Due</small>

                    <strong>
                      {task.dueAt
                        ? formatDateTime(
                            task.dueAt
                          )
                        : "No due date"}
                    </strong>
                  </div>
                </div>

                <footer>
                  <select
                    value={
                      task.status ||
                      "pending"
                    }
                    onChange={(
                      event
                    ) =>
                      updateTaskStatus(
                        task,
                        event.target
                          .value
                      )
                    }
                  >
                    {[
                      "pending",
                      "in_progress",
                      "completed",
                      "cancelled",
                    ].map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {formatLabel(
                            status
                          )}
                        </option>
                      )
                    )}
                  </select>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ManagerCallsSection({
  calls,
  managedMembers,
}) {
  const managedIds =
    new Set(
      managedMembers.map(
        (member) => member.id
      )
    );

  const visibleCalls =
    calls.filter((call) => {
      const callerId =
        getCallerId(call);

      return (
        !callerId ||
        managedIds.has(callerId)
      );
    });

  return (
    <section className="rf-panel">
      <PanelHeader
        title="Call performance"
        subtitle="Review caller activity, duration and recorded outcomes."
      />

      <ManagerCallList
        calls={visibleCalls}
      />
    </section>
  );
}

function ManagerToolsSection({
  members,
  dialers,
  senders,
  onConfigure,
}) {
  return (
    <section className="rf-panel">
      <PanelHeader
        title="Caller resources"
        subtitle="Assign an approved dialer and SMTP sender identity to each caller."
      />

      <div className="rf-performance-summary-grid">
        <PerformanceSummary
          label="Configured dialers"
          value={dialers.length}
          note="Available calling configurations"
        />

        <PerformanceSummary
          label="Sender identities"
          value={senders.length}
          note="Approved SMTP configurations"
        />

        <PerformanceSummary
          label="Callers"
          value={
            members.filter(
              (member) =>
                normalizeRole(
                  member.workspaceRole ||
                    member.role
                ) === "caller"
            ).length
          }
          note="Team members requiring tools"
        />
      </div>

      <div className="rf-team-tool-list">
        {members.map((member) => (
          <article
            key={member.id}
            className="rf-team-tool-row"
          >
            <MemberIdentity
              member={member}
            />

            <SummaryValue
              label="Calling connection"
              value={
                member.assignedDialer
                  ?.name ||
                member.dialer?.name ||
                "Not assigned"
              }
            />

            <SummaryValue
              label="Sender identity"
              value={
                member.assignedSender
                  ?.fromEmail ||
                member.sender
                  ?.fromEmail ||
                "Not assigned"
              }
            />

            <button
              type="button"
              onClick={() =>
                onConfigure(member)
              }
            >
              Configure
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ManagerPerformanceRow({
  rank,
  member,
  performance,
  onAssignLead,
}) {
  const metrics =
    performance.metrics ||
    performance;

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
    <article className="rf-performance-row">
      <span className="rf-performance-rank">
        {rank}
      </span>

      <MemberIdentity
        member={member}
      />

      <div className="rf-performance-row__metric">
        <small>Calls</small>
        <strong>{calls}</strong>
      </div>

      <div className="rf-performance-row__metric">
        <small>Qualified</small>
        <strong>{qualified}</strong>
      </div>

      <div className="rf-performance-row__metric">
        <small>Conversion</small>
        <strong>
          {conversion}%
        </strong>
      </div>

      <button
        type="button"
        className="rf-button rf-button--secondary rf-button--compact"
        onClick={onAssignLead}
      >
        Assign leads
      </button>
    </article>
  );
}

function ManagerAttendanceList({
  attendance,
  members,
}) {
  const attendanceMap =
    new Map(
      attendance.map((record) => [
        getAttendanceUserId(
          record
        ),
        record,
      ])
    );

  if (!members.length) {
    return (
      <EmptyState
        icon="AT"
        title="No team members"
        description="Attendance will appear when callers are added."
        compact
      />
    );
  }

  return (
    <div className="rf-simple-list">
      {members.map((member) => {
        const record =
          attendanceMap.get(
            member.id
          );

        return (
          <article
            key={member.id}
            className="rf-simple-list-item"
          >
            <MemberIdentity
              member={member}
            />

            <div className="rf-simple-list-item__right">
              <StatusBadge
                value={
                  record?.status ||
                  "not_checked_in"
                }
              />

              <small>
                {record?.checkedInAt
                  ? formatTime(
                      record.checkedInAt
                    )
                  : "Not checked in"}
              </small>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ManagerCallList({
  calls,
}) {
  if (!calls.length) {
    return (
      <EmptyState
        icon="CL"
        title="No calls recorded"
        description="Caller activity will appear here after calls are made."
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

function WorkloadSummary({
  metrics,
  assignments,
  tasks,
}) {
  const items = [
    {
      label: "Unassigned leads",
      value:
        metrics.unassignedLeads,
    },
    {
      label: "Active assignments",
      value:
        metrics.activeAssignments,
    },
    {
      label: "Follow-ups",
      value:
        assignments.filter(
          (item) =>
            normalizeStatus(
              item.status
            ) === "follow_up"
        ).length,
    },
    {
      label: "Pending tasks",
      value:
        tasks.filter(
          (item) =>
            ![
              "completed",
              "cancelled",
            ].includes(
              normalizeStatus(
                item.status
              )
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

function ManagerAssignmentDialog({
  members,
  leads,
  selectedMember,
  onClose,
  onCreated,
  onError,
}) {
  const [assigneeId, setAssigneeId] =
    useState(
      selectedMember?.id || ""
    );

  const [
    selectedLeadIds,
    setSelectedLeadIds,
  ] = useState([]);

  const [priority, setPriority] =
    useState("normal");

  const [instructions, setInstructions] =
    useState("");

  const [dueAt, setDueAt] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const filteredLeads =
    leads.filter((lead) => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return true;
      }

      return [
        lead.name,
        lead.business,
        lead.email,
        lead.phone,
        lead.website,
        lead.address,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

  function toggleLead(leadId) {
    setSelectedLeadIds(
      (current) =>
        current.includes(leadId)
          ? current.filter(
              (id) =>
                id !== leadId
            )
          : [...current, leadId]
    );
  }

  async function submit(event) {
    event.preventDefault();

    if (
      !assigneeId ||
      !selectedLeadIds.length
    ) {
      return;
    }

    setSaving(true);

    try {
      const response =
        await apiRequest(
          "/resource-board/leads/assign",
          {
            method: "POST",
            body: {
              resourceId: assigneeId,
              assignmentIds:
                selectedLeadIds,
            },
          }
        );

      let created = Array.isArray(
        response?.results
      )
        ? response.results
            .filter(
              (item) =>
                item?.ok &&
                item?.assignment
            )
            .map(
              (item) =>
                item.assignment
            )
        : extractList(
            response,
            ["assignments"]
          );

      if (
        !created.length &&
        response?.assignment
      ) {
        created = [response.assignment];
      }

      if (!created.length) {
        const firstFailure =
          Array.isArray(response?.results)
            ? response.results.find(
                (item) => !item?.ok
              )
            : null;

        throw new Error(
          firstFailure?.error ||
            "No leads were assigned."
        );
      }

      const shouldPatchMetadata =
        priority !== "normal" ||
        Boolean(instructions.trim()) ||
        Boolean(dueAt);

      if (shouldPatchMetadata) {
        const metadataResults =
          await Promise.allSettled(
            created.map(
              (assignment) =>
                apiRequest(
                  `/sales/assignments/${encodeURIComponent(
                    assignment.assignmentId ||
                      assignment.id
                  )}`,
                  {
                    method: "PATCH",
                    body: {
                      priority,
                      notes:
                        instructions.trim(),
                      nextActionAt:
                        dueAt || null,
                    },
                  }
                )
            )
          );

        created = created.map(
          (assignment, index) => {
            const metadataResult =
              metadataResults[index];

            if (
              metadataResult?.status ===
              "fulfilled"
            ) {
              return (
                metadataResult.value
                  ?.assignment ||
                metadataResult.value ||
                assignment
              );
            }

            console.error(
              "[manager-dashboard] assignment metadata update failed",
              metadataResult?.reason
            );

            return {
              ...assignment,
              priority,
              notes:
                instructions.trim(),
              nextActionAt:
                dueAt || "",
            };
          }
        );
      }

      onCreated(created);
    } catch (requestError) {
      onError(
        requestError?.message ||
          "The leads could not be assigned."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardDialog
      title="Assign leads"
      eyebrow="Lead distribution"
      description="Select a caller and assign one or more available leads."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="rf-dialog-form-grid">
          <DialogField
            label="Assign to"
            required
          >
            <select
              value={assigneeId}
              onChange={(event) =>
                setAssigneeId(
                  event.target.value
                )
              }
              required
            >
              <option value="">
                Select caller
              </option>

              {members.map(
                (member) => (
                  <option
                    key={member.id}
                    value={member.id}
                  >
                    {member.name} —{" "}
                    {formatLabel(
                      member.workspaceRole ||
                        member.role
                    )}
                  </option>
                )
              )}
            </select>
          </DialogField>

          <DialogField label="Priority">
            <select
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value
                )
              }
            >
              {[
                "low",
                "normal",
                "high",
                "urgent",
              ].map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {formatLabel(
                      value
                    )}
                  </option>
                )
              )}
            </select>
          </DialogField>

          <DialogField label="Due date">
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) =>
                setDueAt(
                  event.target.value
                )
              }
            />
          </DialogField>

          <DialogField
            label="Instructions"
            wide
          >
            <textarea
              value={instructions}
              onChange={(event) =>
                setInstructions(
                  event.target.value
                )
              }
              placeholder="Add call objectives, qualification requirements and follow-up instructions."
            />
          </DialogField>
        </div>

        <div className="rf-lead-selection">
          <header>
            <div>
              <h3>
                Available leads
              </h3>

              <p>
                {
                  selectedLeadIds.length
                }{" "}
                selected
              </p>
            </div>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search leads…"
            />
          </header>

          {!filteredLeads.length ? (
            <div className="rf-lead-selection-empty">
              No unassigned leads are
              currently available.
            </div>
          ) : (
            <div className="rf-lead-selection-list">
              {filteredLeads.map(
                (lead) => (
                  <label
                    key={getLeadSelectionId(
                      lead
                    )}
                    className="rf-lead-selection-item"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(
                        getLeadSelectionId(
                          lead
                        )
                      )}
                      onChange={() =>
                        toggleLead(
                          getLeadSelectionId(
                            lead
                          )
                        )
                      }
                    />

                    <span>
                      <strong>
                        {lead.business ||
                          lead.name ||
                          "Unnamed business"}
                      </strong>

                      <small>
                        {lead.phone ||
                          lead.email ||
                          lead.website ||
                          "No contact information"}
                      </small>
                    </span>

                    <em>
                      {lead.address ||
                        lead.location ||
                        ""}
                    </em>
                  </label>
                )
              )}
            </div>
          )}
        </div>

        <DialogFooter
          saving={saving}
          disabled={
            !assigneeId ||
            !selectedLeadIds.length
          }
          submitLabel={`Assign ${
            selectedLeadIds.length ||
            ""
          } lead${
            selectedLeadIds.length === 1
              ? ""
              : "s"
          }`}
          onCancel={onClose}
        />
      </form>
    </DashboardDialog>
  );
}

function ManagerTaskDialog({
  members,
  selectedMember,
  onClose,
  onCreated,
  onError,
}) {
  const [form, setForm] =
    useState({
      title: "",
      description: "",
      assigneeId:
        selectedMember?.id || "",
      priority: "normal",
      dueAt: "",
    });

  const [saving, setSaving] =
    useState(false);

  async function submit(event) {
    event.preventDefault();

    setSaving(true);

    try {
      const response =
        await apiRequest(
          "/team-communication/tasks",
          {
            method: "POST",
            body: {
              ...form,
              dueAt:
                form.dueAt ||
                null,
            },
          }
        );

      onCreated(
        response.task ||
          response
      );
    } catch (requestError) {
      onError(
        requestError?.message ||
          "The task could not be assigned."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardDialog
      title="Assign task"
      eyebrow="Team workflow"
      description="Create a clear and trackable task for a team member."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="rf-dialog-form-grid">
          <DialogField
            label="Task title"
            required
            wide
          >
            <input
              value={form.title}
              onChange={(event) =>
                updateForm(
                  setForm,
                  "title",
                  event.target.value
                )
              }
              required
            />
          </DialogField>

          <DialogField
            label="Assign to"
            required
          >
            <select
              value={
                form.assigneeId
              }
              onChange={(event) =>
                updateForm(
                  setForm,
                  "assigneeId",
                  event.target.value
                )
              }
              required
            >
              <option value="">
                Select team member
              </option>

              {members.map(
                (member) => (
                  <option
                    key={member.id}
                    value={member.id}
                  >
                    {member.name}
                  </option>
                )
              )}
            </select>
          </DialogField>

          <DialogField label="Priority">
            <select
              value={form.priority}
              onChange={(event) =>
                updateForm(
                  setForm,
                  "priority",
                  event.target.value
                )
              }
            >
              {[
                "low",
                "normal",
                "high",
                "urgent",
              ].map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {formatLabel(
                      value
                    )}
                  </option>
                )
              )}
            </select>
          </DialogField>

          <DialogField label="Due date">
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) =>
                updateForm(
                  setForm,
                  "dueAt",
                  event.target.value
                )
              }
            />
          </DialogField>

          <DialogField
            label="Description"
            wide
          >
            <textarea
              value={
                form.description
              }
              onChange={(event) =>
                updateForm(
                  setForm,
                  "description",
                  event.target.value
                )
              }
              placeholder="Describe the expected outcome and any important instructions."
            />
          </DialogField>
        </div>

        <DialogFooter
          saving={saving}
          disabled={
            !form.title.trim() ||
            !form.assigneeId
          }
          submitLabel="Assign task"
          onCancel={onClose}
        />
      </form>
    </DashboardDialog>
  );
}

function ManagerToolDialog({
  members,
  member,
  dialers,
  senders,
  onClose,
  onUpdated,
  onError,
}) {
  const [memberId, setMemberId] =
    useState(member?.id || "");

  const [dialerId, setDialerId] =
    useState(
      member?.assignedDialerId ||
        member?.assignedDialer?.id ||
        member?.dialer?.id ||
        ""
    );

  const [senderId, setSenderId] =
    useState(
      member?.assignedSenderId ||
        member?.assignedSender?.id ||
        member?.sender?.id ||
        ""
    );

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    const selected =
      members.find(
        (item) =>
          item.id === memberId
      );

    if (!selected) {
      return;
    }

    setDialerId(
      selected.assignedDialerId ||
        selected.assignedDialer?.id ||
        selected.dialer?.id ||
        ""
    );

    setSenderId(
      selected.assignedSenderId ||
        selected.assignedSender?.id ||
        selected.sender?.id ||
        ""
    );
  }, [
    memberId,
    members,
  ]);

  async function submit(event) {
    event.preventDefault();

    if (!memberId) {
      return;
    }

    setSaving(true);

    try {
      const selected =
        members.find(
          (item) =>
            item.id === memberId
        );

      const selectedDialer =
        dialers.find(
          (dialer) =>
            dialer.id === dialerId
        ) || null;

      const selectedSender =
        senders.find(
          (sender) =>
            sender.id === senderId
        ) || null;

      const response =
        await apiRequest(
          `/resource-board/resources/${encodeURIComponent(
            memberId
          )}/channels`,
          {
            method: "PATCH",
            body: {
              phoneNumber:
                selectedDialer?.fromNumber ||
                selectedDialer?.phoneNumber ||
                selectedDialer?.number ||
                "",
              emailAccountId:
                selectedSender?.emailAccountId ||
                selectedSender?.senderId ||
                selectedSender?.accountId ||
                selectedSender?.id ||
                "",
            },
          }
        );

      onUpdated({
        ...selected,
        ...(response.resource || {}),
        assignedDialerId:
          dialerId || "",
        assignedSenderId:
          senderId || "",
        assignedDialer:
          response.dialer ||
          selectedDialer,
        assignedSender:
          selectedSender,
        emailAccountId:
          response.emailAccount?.id ||
          selectedSender?.emailAccountId ||
          selected?.emailAccountId ||
          "",
      });
    } catch (requestError) {
      onError(
        requestError?.message ||
          "The caller resources could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardDialog
      title="Configure caller resources"
      eyebrow="Calling and email"
      description="Assign the approved dialer and sender identity this team member can use."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="rf-dialog-form-grid">
          <DialogField
            label="Team member"
            required
            wide
          >
            <select
              value={memberId}
              onChange={(event) =>
                setMemberId(
                  event.target.value
                )
              }
              required
            >
              <option value="">
                Select team member
              </option>

              {members.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                )
              )}
            </select>
          </DialogField>

          <DialogField label="Calling connection">
            <select
              value={dialerId}
              onChange={(event) =>
                setDialerId(
                  event.target.value
                )
              }
            >
              <option value="">
                No dialer assigned
              </option>

              {dialers.map(
                (dialer) => (
                  <option
                    key={dialer.id}
                    value={dialer.id}
                  >
                    {dialer.name ||
                      dialer.fromNumber}
                  </option>
                )
              )}
            </select>
          </DialogField>

          <DialogField label="Sender identity">
            <select
              value={senderId}
              onChange={(event) =>
                setSenderId(
                  event.target.value
                )
              }
            >
              <option value="">
                No sender assigned
              </option>

              {senders.map(
                (sender) => (
                  <option
                    key={sender.id}
                    value={sender.id}
                  >
                    {sender.fromName ||
                      sender.name ||
                      "Sender"}{" "}
                    —{" "}
                    {sender.fromEmail}
                  </option>
                )
              )}
            </select>
          </DialogField>
        </div>

        <div className="rf-tool-assignment-note">
          <strong>
            Secure access
          </strong>

          <p>
            The caller can use only the
            assigned dialer and sender
            identity. Credentials remain
            encrypted and are never
            displayed in the browser.
          </p>
        </div>

        <DialogFooter
          saving={saving}
          disabled={!memberId}
          submitLabel="Save configuration"
          onCancel={onClose}
        />
      </form>
    </DashboardDialog>
  );
}

function DashboardDialog({
  title,
  eyebrow,
  description,
  onClose,
  children,
  wide = false,
}) {
  return (
    <div className="rf-management-modal-backdrop">
      <section
        className={`rf-management-dialog ${
          wide
            ? "rf-management-dialog--wide"
            : ""
        }`}
      >
        <header>
          <div>
            <p className="rf-management-eyebrow">
              {eyebrow}
            </p>

            <h2>{title}</h2>

            <span>
              {description}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="rf-management-dialog-form">
          {children}
        </div>
      </section>
    </div>
  );
}

function DialogFooter({
  saving,
  disabled,
  submitLabel,
  onCancel,
}) {
  return (
    <footer className="rf-management-dialog-footer">
      <button
        type="button"
        className="rf-button rf-button--secondary"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </button>

      <button
        type="submit"
        className="rf-button"
        disabled={
          saving || disabled
        }
      >
        {saving
          ? "Saving…"
          : submitLabel}
      </button>
    </footer>
  );
}

function DialogField({
  label,
  required = false,
  wide = false,
  children,
}) {
  return (
    <label
      className={`rf-management-field ${
        wide
          ? "rf-management-field--wide"
          : ""
      }`}
    >
      <span>
        {label}
        {required ? <b> *</b> : null}
      </span>

      {children}
    </label>
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
                "caller"
            )}
        </small>
      </div>
    </div>
  );
}

function LeadIdentity({
  lead = {},
}) {
  return (
    <div className="rf-member-identity">
      <span className="rf-avatar">
        <span>
          {getInitials(
            lead.business ||
              lead.name ||
              "Lead"
          )}
        </span>
      </span>

      <div>
        <strong>
          {lead.business ||
            lead.name ||
            "Business lead"}
        </strong>

        <small>
          {lead.phone ||
            lead.email ||
            lead.website ||
            "No contact details"}
        </small>
      </div>
    </div>
  );
}

function DashboardAvatar({
  profile = {},
  large = false,
}) {
  const [failed, setFailed] =
    useState(false);

  return (
    <span
      className={`rf-avatar ${
        large
          ? "rf-avatar--large"
          : ""
      }`}
    >
      {profile.avatarUrl &&
      !failed ? (
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
  const status =
    normalizeStatus(
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

function SmallStat({
  label,
  value,
}) {
  return (
    <div className="rf-member-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryValue({
  label,
  value,
}) {
  return (
    <div className="rf-tool-summary">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function DashboardAlert({
  type,
  message,
  onClose,
}) {
  const success =
    type === "success";

  return (
    <div
      className="rf-inline-alert"
      style={
        success
          ? {
              color: "#16794d",
              background:
                "#eaf8f1",
              borderColor:
                "#cbe9da",
            }
          : undefined
      }
    >
      <span>{safeManagerDashboardMessage(message)}</span>

      <button
        type="button"
        onClick={onClose}
        style={
          success
            ? {
                color:
                  "#16794d",
              }
            : undefined
        }
      >
        Close
      </button>
    </div>
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

function ManagerAccessDenied({
  role,
}) {
  return (
    <main className="rf-role-dashboard rf-manager-dashboard-v7">
      <ManagerDashboardV7Styles />
      <section className="rf-access-denied">
        <div>!</div>

        <h1>
          Manager access required
        </h1>

        <p>
          The{" "}
          {formatLabel(
            role || "current"
          )}{" "}
          role cannot access team
          management operations.
        </p>

        <a href="/app/dashboard">
          Return to dashboard
        </a>
      </section>
    </main>
  );
}

function ManagerDashboardSkeleton() {
  return (
    <main className="rf-role-dashboard rf-manager-dashboard-v7">
      <ManagerDashboardV7Styles />
      <div className="rf-dashboard-skeleton-header" />

      <section className="rf-metric-grid">
        {Array.from({
          length: 7,
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

function updateForm(
  setter,
  field,
  value
) {
  setter((current) => ({
    ...current,
    [field]: value,
  }));
}

function getSettledValue(
  result,
  fallback,
  label = "request",
  failures = null
) {
  if (result.status === "fulfilled") {
    return result.value;
  }

  console.error(
    `[manager-dashboard] ${label} failed`,
    result.reason
  );

  if (Array.isArray(failures)) {
    failures.push(label);
  }

  return fallback;
}

function extractList(
  response,
  keys = []
) {
  if (Array.isArray(response)) {
    return response;
  }

  if (!response || typeof response !== "object") {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(response[key])) {
      return response[key];
    }
  }

  return [];
}

function getLeadSelectionId(lead) {
  return (
    lead?.assignmentId ||
    lead?.id ||
    ""
  );
}

function getAssigneeId(item) {
  return (
    item?.assigneeId ||
    item?.assignedToUserId ||
    item?.userId ||
    item?.assignee?.id ||
    item?.user?.id ||
    ""
  );
}

function getCallerId(call) {
  return (
    call?.userId ||
    call?.callerId ||
    call?.createdByUserId ||
    call?.user?.id ||
    call?.caller?.id ||
    call?.createdBy?.id ||
    ""
  );
}

function getAttendanceUserId(
  record
) {
  return (
    record?.userId ||
    record?.memberId ||
    record?.profileId ||
    record?.member?.id ||
    record?.user?.id ||
    record?.profile?.id ||
    ""
  );
}

function normalizeRole(value) {
  const role =
    normalizeStatus(value);

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

  if (
    Number.isNaN(date.getTime())
  ) {
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

function safeManagerDashboardMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function notifyManagerDashboard(type, title, message) {
  if (typeof window === "undefined") {
    return;
  }

  const bridge = window.reachflyToast;

  if (bridge && typeof bridge[type] === "function") {
    bridge[type](title, message);
    return;
  }

  window.dispatchEvent(
    new CustomEvent("reachfly:toast", {
      detail: {
        type,
        title,
        message,
      },
    })
  );
}


function ManagerDashboardV7Styles() {
  return (
    <style>{`
      .rf-manager-dashboard-v7{
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

      .rf-manager-dashboard-v7 *,
      .rf-manager-dashboard-v7 *::before,
      .rf-manager-dashboard-v7 *::after{
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

      .rf-manager-dashboard-v7 .rf-dashboard-header{
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

      .rf-manager-dashboard-v7 .rf-dashboard-header__identity{
        min-width:0;
        display:grid;
        grid-template-columns:46px minmax(0,1fr);
        align-items:center;
        gap:11px;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-header__identity > div:last-child{
        min-width:0;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-eyebrow,
      .rf-manager-dashboard-v7 .rf-management-eyebrow{
        margin:0 0 3px;
        color:#c9caff;
        font-size:5.7px;
        font-weight:800;
        letter-spacing:.085em;
        text-transform:uppercase;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-header h1{
        margin:0;
        overflow:hidden;
        color:#fff;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 28px/35px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-subtitle{
        max-width:760px;
        margin:4px 0 0;
        color:rgba(244,246,247,.62);
        font-size:7px;
        line-height:12px;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-header__actions{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:7px;
      }

      .rf-manager-dashboard-v7 .rf-server-status{
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

      .rf-manager-dashboard-v7 .rf-status-dot{
        width:8px;
        height:8px;
        background:#67d7a9;
        border:2px solid rgba(255,255,255,.42);
        border-radius:50%;
        animation:rfxPulse 1.3s infinite ease-in-out;
      }

      .rf-manager-dashboard-v7 .rf-server-status > div{
        display:grid;
        min-width:0;
      }

      .rf-manager-dashboard-v7 .rf-server-status strong{
        color:#fff;
        font-size:5.8px;
      }

      .rf-manager-dashboard-v7 .rf-server-status small{
        margin-top:1px;
        color:rgba(244,246,247,.57);
        font-size:5px;
      }

      .rf-manager-dashboard-v7 .rf-button{
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

      .rf-manager-dashboard-v7 .rf-button:hover:not(:disabled){
        transform:translateY(-1px);
        background:var(--rfx-primary-dark);
      }

      .rf-manager-dashboard-v7 .rf-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-manager-dashboard-v7 .rf-button--secondary{
        color:var(--rfx-text);
        background:#fff;
        border-color:var(--rfx-line);
        box-shadow:none;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-header .rf-button--secondary{
        color:#fff;
        background:rgba(255,255,255,.08);
        border-color:rgba(255,255,255,.12);
      }

      .rf-manager-dashboard-v7 .rf-button--compact{
        min-height:30px;
        padding:5px 7px;
        font-size:5.3px;
      }

      .rf-manager-dashboard-v7 .rf-inline-alert{
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

      .rf-manager-dashboard-v7 .rf-inline-alert button{
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

      .rf-manager-dashboard-v7 .rf-metric-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin-bottom:10px;
      }

      .rf-manager-dashboard-v7 .rf-metric-card{
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

      .rf-manager-dashboard-v7 .rf-metric-card:hover{
        transform:translateY(-1px);
        border-color:#d8d9ef;
        box-shadow:0 8px 20px rgba(25,28,29,.045);
      }

      .rf-manager-dashboard-v7 .rf-metric-card__icon{
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

      .rf-manager-dashboard-v7 .rf-metric-card > div:last-child{
        min-width:0;
        display:grid;
        align-content:end;
      }

      .rf-manager-dashboard-v7 .rf-metric-card p{
        margin:0;
        color:var(--rfx-muted);
        font-size:5.2px;
        font-weight:700;
      }

      .rf-manager-dashboard-v7 .rf-metric-card strong{
        margin-top:2px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 17px/22px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rf-manager-dashboard-v7 .rf-metric-card small{
        margin-top:1px;
        overflow:hidden;
        color:var(--rfx-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:4.9px;
      }

      .rf-manager-dashboard-v7 .rf-management-navigation{
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

      .rf-manager-dashboard-v7 .rf-management-navigation::-webkit-scrollbar{display:none}

      .rf-manager-dashboard-v7 .rf-management-navigation button{
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

      .rf-manager-dashboard-v7 .rf-management-navigation button.is-active,
      .rf-manager-dashboard-v7 .rf-management-navigation button.active{
        color:var(--rfx-primary);
        background:var(--rfx-primary-soft);
      }

      .rf-manager-dashboard-v7 .rf-management-navigation button b{
        min-width:18px;
        padding:3px 5px;
        color:inherit;
        background:#fff;
        border-radius:999px;
        text-align:center;
        font-size:4.8px;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-grid{
        display:grid;
        grid-template-columns:minmax(0,1.45fr) minmax(290px,.55fr);
        align-items:start;
        gap:10px;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-grid__main,
      .rf-manager-dashboard-v7 .rf-dashboard-grid__aside{
        min-width:0;
        display:grid;
        gap:10px;
      }

      .rf-manager-dashboard-v7 .rf-panel,
      .rf-manager-dashboard-v7 .rf-summary-card{
        min-width:0;
        padding:13px;
        margin-bottom:10px;
        background:#fff;
        border:1px solid var(--rfx-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-manager-dashboard-v7 .rf-panel-header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        min-height:52px;
        padding-bottom:9px;
        margin-bottom:9px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-manager-dashboard-v7 .rf-panel-header h2,
      .rf-manager-dashboard-v7 .rf-panel-header h3{
        margin:0;
        font:600 13px/18px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-manager-dashboard-v7 .rf-panel-header p{
        margin:3px 0 0;
        color:var(--rfx-muted);
        font-size:5.7px;
        line-height:9px;
      }

      .rf-manager-dashboard-v7 .rf-performance-summary-grid,
      .rf-manager-dashboard-v7 .rf-operation-summary-list,
      .rf-manager-dashboard-v7 .rf-member-stat-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:6px;
      }

      .rf-manager-dashboard-v7 .rf-performance-summary-grid > *,
      .rf-manager-dashboard-v7 .rf-operation-summary-list > article,
      .rf-manager-dashboard-v7 .rf-member-stat{
        min-height:70px;
        display:grid;
        align-content:center;
        padding:8px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-manager-dashboard-v7 .rf-performance-list,
      .rf-manager-dashboard-v7 .rf-simple-list,
      .rf-manager-dashboard-v7 .rf-call-activity-list,
      .rf-manager-dashboard-v7 .rf-team-tool-list{
        display:grid;
        gap:5px;
      }

      .rf-manager-dashboard-v7 .rf-performance-row,
      .rf-manager-dashboard-v7 .rf-simple-list-item,
      .rf-manager-dashboard-v7 .rf-call-activity-row,
      .rf-manager-dashboard-v7 .rf-team-tool-row{
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

      .rf-manager-dashboard-v7 .rf-performance-row:hover,
      .rf-manager-dashboard-v7 .rf-simple-list-item:hover,
      .rf-manager-dashboard-v7 .rf-call-activity-row:hover,
      .rf-manager-dashboard-v7 .rf-team-tool-row:hover{
        background:#f4f4ff;
        border-color:#e1e1f7;
      }

      .rf-manager-dashboard-v7 .rf-performance-row{
        grid-template-columns:30px minmax(0,1fr) repeat(3,64px);
      }

      .rf-manager-dashboard-v7 .rf-performance-rank,
      .rf-manager-dashboard-v7 .rf-call-activity-icon{
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

      .rf-manager-dashboard-v7 .rf-call-activity-row{
        grid-template-columns:34px minmax(0,1fr) auto auto;
      }

      .rf-manager-dashboard-v7 .rf-call-activity-icon{
        width:34px;
        height:34px;
      }

      .rf-manager-dashboard-v7 .rf-call-activity-business{
        min-width:0;
        display:grid;
      }

      .rf-manager-dashboard-v7 .rf-call-activity-business strong{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6px;
      }

      .rf-manager-dashboard-v7 .rf-call-activity-business small,
      .rf-manager-dashboard-v7 .rf-call-activity-meta small{
        margin-top:2px;
        color:var(--rfx-muted);
        font-size:5px;
      }

      .rf-manager-dashboard-v7 .rf-team-overview-grid,
      .rf-manager-dashboard-v7 .rf-task-management-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf-manager-dashboard-v7 .rf-team-member-card,
      .rf-manager-dashboard-v7 .rf-managed-task-card{
        min-width:0;
        padding:10px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
      }

      .rf-manager-dashboard-v7 .rf-team-member-card header,
      .rf-manager-dashboard-v7 .rf-member-identity{
        min-width:0;
        display:grid;
        grid-template-columns:36px minmax(0,1fr) auto;
        align-items:center;
        gap:7px;
      }

      .rf-manager-dashboard-v7 .rf-member-status-row{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
        margin-top:7px;
      }

      .rf-manager-dashboard-v7 .rf-member-tool-summary,
      .rf-manager-dashboard-v7 .rf-tool-summary{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:5px;
        margin-top:7px;
      }

      .rf-manager-dashboard-v7 .rf-table-container{
        overflow-x:auto;
        border:1px solid var(--rfx-line);
        border-radius:8px;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-table{
        width:100%;
        min-width:850px;
        border-collapse:collapse;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-table th{
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

      .rf-manager-dashboard-v7 .rf-dashboard-table td{
        padding:8px;
        color:var(--rfx-text2);
        border-bottom:1px solid #eff0f1;
        font-size:5.7px;
        line-height:9px;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-table tbody tr:hover td{
        background:#fafaff;
      }

      .rf-manager-dashboard-v7 .rf-management-modal-backdrop{
        position:fixed;
        z-index:2147481000;
        inset:0;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(25,28,29,.58);
        backdrop-filter:blur(8px);
      }

      .rf-manager-dashboard-v7 .rf-management-dialog{
        width:min(720px,100%);
        max-height:calc(100vh - 36px);
        overflow:auto;
        padding:15px;
        background:#fff;
        border:1px solid rgba(255,255,255,.3);
        border-radius:13px;
        box-shadow:0 24px 70px rgba(0,0,0,.18);
      }

      .rf-manager-dashboard-v7 .rf-management-dialog--wide{
        width:min(900px,100%);
      }

      .rf-manager-dashboard-v7 .rf-management-dialog-form,
      .rf-manager-dashboard-v7 .rf-dialog-form-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
      }

      .rf-manager-dashboard-v7 .rf-management-field{
        display:grid;
        gap:4px;
      }

      .rf-manager-dashboard-v7 .rf-management-field--wide{
        grid-column:1/-1;
      }

      .rf-manager-dashboard-v7 input,
      .rf-manager-dashboard-v7 select,
      .rf-manager-dashboard-v7 textarea{
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

      .rf-manager-dashboard-v7 textarea{
        min-height:86px;
        resize:vertical;
      }

      .rf-manager-dashboard-v7 input:focus,
      .rf-manager-dashboard-v7 select:focus,
      .rf-manager-dashboard-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-manager-dashboard-v7 .rf-management-dialog-footer{
        display:flex;
        justify-content:flex-end;
        gap:7px;
        grid-column:1/-1;
        padding-top:9px;
        border-top:1px solid #eff0f1;
      }

      .rf-manager-dashboard-v7 .rf-lead-selection-list{
        display:grid;
        gap:5px;
        max-height:300px;
        overflow:auto;
      }

      .rf-manager-dashboard-v7 .rf-lead-selection-item{
        min-height:50px;
        display:grid;
        grid-template-columns:15px minmax(0,1fr);
        align-items:center;
        gap:7px;
        padding:7px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-manager-dashboard-v7 .rf-empty-state,
      .rf-manager-dashboard-v7 .rf-access-denied{
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

      .rf-manager-dashboard-v7 .rf-access-denied{
        min-height:330px;
        max-width:720px;
        margin:40px auto 0;
        border-style:solid;
      }

      .rf-manager-dashboard-v7 .rf-access-denied h1,
      .rf-manager-dashboard-v7 .rf-empty-state h3{
        margin:3px 0 0;
        color:var(--rfx-text);
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rf-manager-dashboard-v7 .rf-access-denied p,
      .rf-manager-dashboard-v7 .rf-empty-state p{
        max-width:440px;
        margin:0;
        font-size:5.8px;
        line-height:10px;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-skeleton-header,
      .rf-manager-dashboard-v7 .rf-skeleton-card,
      .rf-manager-dashboard-v7 .rf-dashboard-skeleton-panel{
        background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);
        background-size:220% 100%;
        animation:rfxShimmer 1.15s linear infinite;
      }

      .rf-manager-dashboard-v7 .rf-dashboard-skeleton-header{height:140px;margin-bottom:10px;border-radius:14px}
      .rf-manager-dashboard-v7 .rf-skeleton-card{height:116px;border-radius:10px}
      .rf-manager-dashboard-v7 .rf-dashboard-skeleton-panel{height:245px;margin-bottom:10px;border-radius:11px}

      @media(max-width:1120px){
        .rf-manager-dashboard-v7{padding:22px}
        .rf-manager-dashboard-v7 .rf-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .rf-manager-dashboard-v7 .rf-dashboard-grid{grid-template-columns:1fr}
        .rf-manager-dashboard-v7 .rf-team-overview-grid,
        .rf-manager-dashboard-v7 .rf-task-management-grid{grid-template-columns:1fr 1fr}
      }

      @media(max-width:760px){
        .rf-manager-dashboard-v7 .rf-dashboard-header{align-items:flex-start;flex-direction:column}
        .rf-manager-dashboard-v7 .rf-dashboard-header__actions{width:100%}
        .rf-manager-dashboard-v7 .rf-server-status{flex:1}
        .rf-manager-dashboard-v7 .rf-performance-summary-grid,
        .rf-manager-dashboard-v7 .rf-operation-summary-list,
        .rf-manager-dashboard-v7 .rf-member-stat-grid{grid-template-columns:1fr 1fr}
        .rf-manager-dashboard-v7 .rf-performance-row{grid-template-columns:30px minmax(0,1fr) auto}
        .rf-manager-dashboard-v7 .rf-performance-row__metric:nth-last-child(-n+2){display:none}
      }

      @media(max-width:620px){
        .rf-manager-dashboard-v7{padding:18px 12px 80px}
        .rf-manager-dashboard-v7 .rf-dashboard-header{padding:15px}
        .rf-manager-dashboard-v7 .rf-dashboard-header h1{font-size:23px;line-height:30px}
        .rf-manager-dashboard-v7 .rf-dashboard-header__actions{display:grid;grid-template-columns:1fr}
        .rf-manager-dashboard-v7 .rf-server-status,
        .rf-manager-dashboard-v7 .rf-dashboard-header .rf-button{width:100%}
        .rf-manager-dashboard-v7 .rf-management-navigation{top:61px;margin-left:-12px;margin-right:-12px;border-left:0;border-right:0;border-radius:0}
        .rf-manager-dashboard-v7 .rf-team-overview-grid,
        .rf-manager-dashboard-v7 .rf-task-management-grid,
        .rf-manager-dashboard-v7 .rf-dialog-form-grid,
        .rf-manager-dashboard-v7 .rf-management-dialog-form{grid-template-columns:1fr}
        .rf-manager-dashboard-v7 .rf-management-field--wide{grid-column:auto}
        .rf-manager-dashboard-v7 .rf-call-activity-row{grid-template-columns:34px minmax(0,1fr)}
        .rf-manager-dashboard-v7 .rf-call-activity-row > *:nth-child(n+3){grid-column:2}
        .rf-manager-dashboard-v7 .rf-management-modal-backdrop{padding:0}
        .rf-manager-dashboard-v7 .rf-management-dialog,
        .rf-manager-dashboard-v7 .rf-management-dialog--wide{width:100%;min-height:100vh;max-height:100vh;border-radius:0}
      }

      @media(max-width:430px){
        .rf-manager-dashboard-v7 .rf-metric-grid,
        .rf-manager-dashboard-v7 .rf-performance-summary-grid,
        .rf-manager-dashboard-v7 .rf-operation-summary-list,
        .rf-manager-dashboard-v7 .rf-member-stat-grid{grid-template-columns:1fr}
        .rf-manager-dashboard-v7 .rf-dashboard-header__identity{grid-template-columns:1fr}
      }

      @media(prefers-reduced-motion:reduce){
        .rf-manager-dashboard-v7,
        .rf-manager-dashboard-v7 *,
        .rf-manager-dashboard-v7 *::before,
        .rf-manager-dashboard-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
