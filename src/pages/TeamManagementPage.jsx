import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiRequest,
  listWorkspaceProfiles,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import "../styles/team-management.css";

const MANAGEMENT_ROLES = new Set([
  "owner",
  "admin",
  "manager",
]);

const MEMBER_ROLES = [
  {
    value: "admin",
    label: "Administrator",
  },
  {
    value: "manager",
    label: "Manager",
  },
  {
    value: "caller",
    label: "Caller",
  },
  {
    value: "viewer",
    label: "Viewer",
  },
];

const MEMBER_STATUSES = [
  {
    value: "active",
    label: "Active",
  },
  {
    value: "suspended",
    label: "Suspended",
  },
  {
    value: "disabled",
    label: "Disabled",
  },
];

const TASK_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
];

const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

const ASSIGNMENT_STATUSES = [
  "assigned",
  "in_progress",
  "follow_up",
  "qualified",
  "completed",
  "do_not_contact",
];

export default function TeamManagementPage() {
  const [currentUser, setCurrentUser] =
    useState(null);

  const [members, setMembers] =
    useState([]);

  const [performance, setPerformance] =
    useState([]);

  const [tasks, setTasks] =
    useState([]);

  const [assignments, setAssignments] =
    useState([]);

  const [dialers, setDialers] =
    useState([]);

  const [senders, setSenders] =
    useState([]);

  const [leads, setLeads] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [activeSection, setActiveSection] =
    useState("members");

  const [memberSearch, setMemberSearch] =
    useState("");

  const [roleFilter, setRoleFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [selectedMember, setSelectedMember] =
    useState(null);

  const [showInviteDialog, setShowInviteDialog] =
    useState(false);

  const [showAssignmentDialog, setShowAssignmentDialog] =
    useState(false);

  const [showTaskDialog, setShowTaskDialog] =
    useState(false);

  const [showToolAssignmentDialog, setShowToolAssignmentDialog] =
    useState(false);

  useEffect(() => {
    if (!success) {
      return;
    }

    notifyTeamManagement(
      "success",
      "Team operations updated",
      success
    );
  }, [success]);

  const currentRole = normalizeRole(
    currentUser?.workspaceRole ||
      currentUser?.role
  );

  const canManageTeam =
    MANAGEMENT_ROLES.has(currentRole);

  const loadPage = useCallback(
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

        const profile =
          profileResponse.profile ||
          profileResponse.user ||
          profileResponse;

        setCurrentUser(profile);

        const role = normalizeRole(
          profile?.workspaceRole ||
            profile?.role
        );

        if (!MANAGEMENT_ROLES.has(role)) {
          setMembers([]);
          setPerformance([]);
          setTasks([]);
          setAssignments([]);
          setDialers([]);
          setSenders([]);
          setLeads([]);

          return;
        }

        const [
          memberResult,
          performanceResult,
          taskResult,
          assignmentResult,
          dialerResult,
          senderResult,
          leadResult,
        ] = await Promise.allSettled([
          listWorkspaceProfiles(),

          apiRequest(
            "/team-management/performance"
          ),

          apiRequest(
            "/team-management/tasks?limit=250"
          ),

          apiRequest(
            "/team-management/assignments?limit=250"
          ),

          apiRequest(
            "/team-management/dialers"
          ),

          apiRequest(
            "/team-management/senders"
          ),

          apiRequest(
            "/team-management/leads?limit=500&assignmentStatus=unassigned"
          ),
        ]);

        setMembers(
          getSettledValue(
            memberResult,
            []
          )
        );

        const performanceData =
          getSettledValue(
            performanceResult,
            {}
          );

        setPerformance(
          performanceData.performance ||
            performanceData.members ||
            []
        );

        const taskData =
          getSettledValue(
            taskResult,
            {}
          );

        setTasks(
          taskData.tasks || []
        );

        const assignmentData =
          getSettledValue(
            assignmentResult,
            {}
          );

        setAssignments(
          assignmentData.assignments ||
            []
        );

        const dialerData =
          getSettledValue(
            dialerResult,
            {}
          );

        setDialers(
          dialerData.dialers || []
        );

        const senderData =
          getSettledValue(
            senderResult,
            {}
          );

        setSenders(
          senderData.senders || []
        );

        const leadData =
          getSettledValue(
            leadResult,
            {}
          );

        setLeads(
          leadData.leads || []
        );
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Team management information could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    const events = [
      "profile:updated",
      "profile:availability-updated",
      "attendance:checked-in",
      "attendance:checked-out",
      "attendance:status-updated",
      "team:member-created",
      "team:member-updated",
      "team:member-deleted",
      "team:assignment-created",
      "team:assignment-updated",
      "team:task-created",
      "team:task-updated",
      "team:tools-updated",
      "webrtc:call:ended",
    ];

    const unsubscribe = events.map(
      (event) =>
        onWorkspaceSocket(
          event,
          () => {
            loadPage({
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
  }, [loadPage]);

  const filteredMembers = useMemo(() => {
    const query =
      memberSearch
        .trim()
        .toLowerCase();

    return members.filter((member) => {
      const role = normalizeRole(
        member.workspaceRole ||
          member.role
      );

      const status = normalizeStatus(
        member.status ||
          "active"
      );

      if (
        roleFilter &&
        role !== roleFilter
      ) {
        return false;
      }

      if (
        statusFilter &&
        status !== statusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        member.name,
        member.email,
        member.phone,
        member.jobTitle,
        role,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    members,
    memberSearch,
    roleFilter,
    statusFilter,
  ]);

  const dashboardMetrics = useMemo(() => {
    const activeMembers =
      members.filter(
        (member) =>
          normalizeStatus(
            member.status ||
              "active"
          ) === "active"
      ).length;

    const onlineMembers =
      members.filter(
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

    const callers =
      members.filter(
        (member) =>
          normalizeRole(
            member.workspaceRole ||
              member.role
          ) === "caller"
      ).length;

    const activeAssignments =
      assignments.filter(
        (assignment) =>
          ![
            "completed",
            "do_not_contact",
            "cancelled",
          ].includes(
            normalizeStatus(
              assignment.status
            )
          )
      ).length;

    const pendingTasks =
      tasks.filter(
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

    const completedCalls =
      performance.reduce(
        (sum, item) =>
          sum +
          Number(
            item.metrics?.totalCalls ||
              item.totalCalls ||
              0
          ),
        0
      );

    return {
      activeMembers,
      onlineMembers,
      callers,
      activeAssignments,
      pendingTasks,
      completedCalls,
    };
  }, [
    members,
    assignments,
    tasks,
    performance,
  ]);

  async function updateMember(
    userId,
    patch
  ) {
    setError("");
    setSuccess("");

    try {
      const result =
        await apiRequest(
          `/team-management/members/${encodeURIComponent(
            userId
          )}`,
          {
            method: "PATCH",
            body: patch,
          }
        );

      const updated =
        result.member ||
        result.profile ||
        result;

      setMembers((current) =>
        current.map((member) =>
          member.id === userId
            ? {
                ...member,
                ...updated,
              }
            : member
        )
      );

      setSelectedMember((current) =>
        current?.id === userId
          ? {
              ...current,
              ...updated,
            }
          : current
      );

      setSuccess(
        "The team member was updated successfully."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The team member could not be updated."
      );

      throw requestError;
    }
  }

  async function removeMember(
    member
  ) {
    const confirmed =
      window.confirm(
        `Remove ${member.name} from this workspace? Their historical records will be retained.`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `/team-management/members/${encodeURIComponent(
          member.id
        )}`,
        {
          method: "DELETE",
        }
      );

      setMembers((current) =>
        current.filter(
          (item) =>
            item.id !== member.id
        )
      );

      setSelectedMember(null);

      setSuccess(
        `${member.name} was removed from the workspace.`
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The team member could not be removed."
      );
    }
  }

  if (loading) {
    return <TeamManagementSkeleton />;
  }

  if (!canManageTeam) {
    return (
      <AccessDenied
        currentUser={currentUser}
      />
    );
  }

  return (
    <main className="rf-team-management-page rf-team-management-v7">
      <TeamManagementV7Styles />
      <TeamManagementHeader
        refreshing={refreshing}
        onRefresh={() =>
          loadPage({
            silent: true,
          })
        }
        onInvite={() =>
          setShowInviteDialog(true)
        }
      />

      {error ? (
        <ManagementAlert
          type="error"
          message={error}
          onClose={() =>
            setError("")
          }
        />
      ) : null}

      {success ? (
        <ManagementAlert
          type="success"
          message={success}
          onClose={() =>
            setSuccess("")
          }
        />
      ) : null}

      <ManagementMetricGrid
        metrics={dashboardMetrics}
      />

      <ManagementNavigation
        activeSection={activeSection}
        onChange={setActiveSection}
        counts={{
          members: members.length,
          assignments:
            assignments.length,
          tasks: tasks.length,
          performance:
            performance.length,
          tools:
            dialers.length +
            senders.length,
        }}
      />

      {activeSection ===
      "members" ? (
        <MembersSection
          members={filteredMembers}
          searchValue={memberSearch}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          onSearchChange={
            setMemberSearch
          }
          onRoleFilterChange={
            setRoleFilter
          }
          onStatusFilterChange={
            setStatusFilter
          }
          onSelectMember={
            setSelectedMember
          }
          onAssignLead={(
            member
          ) => {
            setSelectedMember(
              member
            );

            setShowAssignmentDialog(
              true
            );
          }}
          onAssignTask={(
            member
          ) => {
            setSelectedMember(
              member
            );

            setShowTaskDialog(
              true
            );
          }}
          onAssignTools={(
            member
          ) => {
            setSelectedMember(
              member
            );

            setShowToolAssignmentDialog(
              true
            );
          }}
        />
      ) : null}

      {activeSection ===
      "assignments" ? (
        <AssignmentsSection
          assignments={
            assignments
          }
          members={members}
          onCreate={() =>
            setShowAssignmentDialog(
              true
            )
          }
          onUpdated={(
            updated
          ) =>
            setAssignments(
              (current) =>
                current.map(
                  (item) =>
                    item.id ===
                    updated.id
                      ? updated
                      : item
                )
            )
          }
          onError={setError}
          onSuccess={setSuccess}
        />
      ) : null}

      {activeSection ===
      "tasks" ? (
        <TasksSection
          tasks={tasks}
          members={members}
          onCreate={() =>
            setShowTaskDialog(
              true
            )
          }
          onUpdated={(
            updated
          ) =>
            setTasks((current) =>
              current.map(
                (item) =>
                  item.id ===
                  updated.id
                    ? updated
                    : item
              )
            )
          }
          onError={setError}
          onSuccess={setSuccess}
        />
      ) : null}

      {activeSection ===
      "performance" ? (
        <PerformanceSection
          performance={
            performance
          }
          members={members}
        />
      ) : null}

      {activeSection ===
      "tools" ? (
        <ToolsSection
          members={members}
          dialers={dialers}
          senders={senders}
          onAssign={(
            member
          ) => {
            setSelectedMember(
              member
            );

            setShowToolAssignmentDialog(
              true
            );
          }}
        />
      ) : null}

      {selectedMember &&
      !showAssignmentDialog &&
      !showTaskDialog &&
      !showToolAssignmentDialog ? (
        <MemberDetailsDrawer
          member={selectedMember}
          performance={findPerformance(
            selectedMember.id,
            performance
          )}
          assignments={assignments.filter(
            (assignment) =>
              getAssigneeId(
                assignment
              ) ===
              selectedMember.id
          )}
          tasks={tasks.filter(
            (task) =>
              getAssigneeId(task) ===
              selectedMember.id
          )}
          currentRole={currentRole}
          onClose={() =>
            setSelectedMember(null)
          }
          onUpdate={updateMember}
          onRemove={() =>
            removeMember(
              selectedMember
            )
          }
          onAssignLead={() =>
            setShowAssignmentDialog(
              true
            )
          }
          onAssignTask={() =>
            setShowTaskDialog(true)
          }
          onAssignTools={() =>
            setShowToolAssignmentDialog(
              true
            )
          }
        />
      ) : null}

      {showInviteDialog ? (
        <InviteMemberDialog
          currentRole={currentRole}
          onClose={() =>
            setShowInviteDialog(false)
          }
          onCreated={(member) => {
            setMembers((current) => [
              member,
              ...current,
            ]);

            setShowInviteDialog(false);

            setSuccess(
              `${member.name} was added to the workspace.`
            );
          }}
          onError={setError}
        />
      ) : null}

      {showAssignmentDialog ? (
        <LeadAssignmentDialog
          members={members}
          leads={leads}
          selectedMember={
            selectedMember
          }
          onClose={() => {
            setShowAssignmentDialog(
              false
            );
          }}
          onCreated={(created) => {
            setAssignments(
              (current) => [
                ...created,
                ...current,
              ]
            );

            const assignedIds =
              new Set(
                created.map(
                  (assignment) =>
                    assignment.leadId
                )
              );

            setLeads((current) =>
              current.filter(
                (lead) =>
                  !assignedIds.has(
                    lead.id
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
              } created.`
            );
          }}
          onError={setError}
        />
      ) : null}

      {showTaskDialog ? (
        <TaskAssignmentDialog
          members={members}
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

      {showToolAssignmentDialog ? (
        <ToolAssignmentDialog
          member={selectedMember}
          members={members}
          dialers={dialers}
          senders={senders}
          onClose={() =>
            setShowToolAssignmentDialog(
              false
            )
          }
          onUpdated={(updatedMember) => {
            setMembers((current) =>
              current.map(
                (member) =>
                  member.id ===
                  updatedMember.id
                    ? {
                        ...member,
                        ...updatedMember,
                      }
                    : member
              )
            );

            setSelectedMember(
              updatedMember
            );

            setShowToolAssignmentDialog(
              false
            );

            setSuccess(
              "Work tools were assigned successfully."
            );
          }}
          onError={setError}
        />
      ) : null}
    </main>
  );
}

function TeamManagementHeader({
  refreshing,
  onRefresh,
  onInvite,
}) {
  return (
    <header className="rf-team-management-header">
      <div>
        <p className="rf-management-eyebrow">
          Team operations
        </p>

        <h1>Team management</h1>

        <p>
          Manage workspace members, distribute leads and tasks,
          review performance, and configure approved work resources.
        </p>
      </div>

      <div className="rf-team-management-header__actions">
        <button
          type="button"
          className="rf-management-button rf-management-button--secondary"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing…"
            : "Refresh"}
        </button>

        <button
          type="button"
          className="rf-management-button"
          onClick={onInvite}
        >
          Add team member
        </button>
      </div>
    </header>
  );
}

function ManagementMetricGrid({
  metrics,
}) {
  const items = [
    {
      label: "Active members",
      value:
        metrics.activeMembers,
      note: `${metrics.onlineMembers} available now`,
      icon: "AM",
    },
    {
      label: "Callers",
      value: metrics.callers,
      note: "Active calling team",
      icon: "CL",
    },
    {
      label: "Active assignments",
      value:
        metrics.activeAssignments,
      note: "Leads in progress",
      icon: "LA",
    },
    {
      label: "Pending tasks",
      value:
        metrics.pendingTasks,
      note: "Open workload",
      icon: "PT",
    },
    {
      label: "Recorded calls",
      value:
        metrics.completedCalls,
      note: "Across the team",
      icon: "RC",
    },
  ];

  return (
    <section className="rf-management-metric-grid">
      {items.map((item) => (
        <article
          key={item.label}
          className="rf-management-metric"
        >
          <div>{item.icon}</div>

          <span>
            <small>
              {item.label}
            </small>

            <strong>
              {item.value}
            </strong>

            <em>{item.note}</em>
          </span>
        </article>
      ))}
    </section>
  );
}

function ManagementNavigation({
  activeSection,
  onChange,
  counts,
}) {
  const items = [
    {
      id: "members",
      label: "Team members",
      count: counts.members,
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
      id: "performance",
      label: "Performance",
      count: counts.performance,
    },
    {
      id: "tools",
      label: "Work tools",
      count: counts.tools,
    },
  ];

  return (
    <nav className="rf-management-navigation">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={
            activeSection ===
            item.id
              ? "is-active"
              : ""
          }
          onClick={() =>
            onChange(item.id)
          }
        >
          <span>{item.label}</span>
          <b>{item.count}</b>
        </button>
      ))}
    </nav>
  );
}

function MembersSection({
  members,
  searchValue,
  roleFilter,
  statusFilter,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onSelectMember,
  onAssignLead,
  onAssignTask,
  onAssignTools,
}) {
  return (
    <section className="rf-management-panel">
      <PanelHeader
        title="Workspace members"
        subtitle="Review roles, availability, attendance and assigned work."
      />

      <div className="rf-management-filters">
        <label className="rf-management-search">
          <span>Search</span>

          <input
            value={searchValue}
            onChange={(event) =>
              onSearchChange(
                event.target.value
              )
            }
            placeholder="Search by name, email or role…"
          />
        </label>

        <label>
          <span>Role</span>

          <select
            value={roleFilter}
            onChange={(event) =>
              onRoleFilterChange(
                event.target.value
              )
            }
          >
            <option value="">
              All roles
            </option>

            {MEMBER_ROLES.map(
              (role) => (
                <option
                  key={role.value}
                  value={role.value}
                >
                  {role.label}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          <span>Status</span>

          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value
              )
            }
          >
            <option value="">
              All statuses
            </option>

            {MEMBER_STATUSES.map(
              (status) => (
                <option
                  key={status.value}
                  value={status.value}
                >
                  {status.label}
                </option>
              )
            )}
          </select>
        </label>
      </div>

      {!members.length ? (
        <ManagementEmptyState
          title="No matching team members"
          description="Adjust the search and filter options or add a new team member."
        />
      ) : (
        <div className="rf-team-member-grid">
          {members.map((member) => (
            <TeamMemberCard
              key={member.id}
              member={member}
              onOpen={() =>
                onSelectMember(
                  member
                )
              }
              onAssignLead={() =>
                onAssignLead(member)
              }
              onAssignTask={() =>
                onAssignTask(member)
              }
              onAssignTools={() =>
                onAssignTools(
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

function TeamMemberCard({
  member,
  onOpen,
  onAssignLead,
  onAssignTask,
  onAssignTools,
}) {
  const role = normalizeRole(
    member.workspaceRole ||
      member.role
  );

  return (
    <article className="rf-team-member-card">
      <header>
        <MemberAvatar
          member={member}
          size="large"
        />

        <div>
          <h3>{member.name}</h3>

          <p>
            {member.jobTitle ||
              formatLabel(role)}
          </p>

          <span>
            {member.email}
          </span>
        </div>

        <MemberStatus
          value={
            member.status ||
            "active"
          }
        />
      </header>

      <div className="rf-member-status-row">
        <AvailabilityIndicator
          value={
            member.availabilityStatus ||
            "offline"
          }
        />

        <AttendanceIndicator
          attendance={
            member.todayAttendance ||
            member.attendance
          }
        />
      </div>

      <div className="rf-member-stat-grid">
        <MemberStat
          label="Assigned leads"
          value={
            member.assignedLeadCount ||
            member.metrics
              ?.assignedLeads ||
            0
          }
        />

        <MemberStat
          label="Calls"
          value={
            member.metrics
              ?.totalCalls ||
            member.totalCalls ||
            0
          }
        />

        <MemberStat
          label="Tasks"
          value={
            member.pendingTaskCount ||
            member.metrics
              ?.pendingTasks ||
            0
          }
        />
      </div>

      <div className="rf-member-tool-summary">
        <ToolSummary
          label="Dialer"
          value={
            member.assignedDialer
              ?.name ||
            member.dialer?.name ||
            "Not assigned"
          }
        />

        <ToolSummary
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
          onClick={onOpen}
        >
          View details
        </button>

        <div>
          <button
            type="button"
            onClick={onAssignLead}
            title="Assign leads"
          >
            Leads
          </button>

          <button
            type="button"
            onClick={onAssignTask}
            title="Assign task"
          >
            Task
          </button>

          <button
            type="button"
            onClick={onAssignTools}
            title="Assign work tools"
          >
            Tools
          </button>
        </div>
      </footer>
    </article>
  );
}

function AssignmentsSection({
  assignments,
  members,
  onCreate,
  onUpdated,
  onError,
  onSuccess,
}) {
  const memberMap = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          member,
        ])
      ),
    [members]
  );

  async function updateStatus(
    assignment,
    status
  ) {
    try {
      const result =
        await apiRequest(
          `/team-management/assignments/${encodeURIComponent(
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
        result.assignment ||
          result
      );

      onSuccess(
        "The lead assignment was updated."
      );
    } catch (error) {
      onError(
        error?.message ||
          "The assignment could not be updated."
      );
    }
  }

  return (
    <section className="rf-management-panel">
      <PanelHeader
        title="Lead assignments"
        subtitle="Track assigned leads, ownership, status and follow-up work."
        action={
          <button
            type="button"
            className="rf-management-button"
            onClick={onCreate}
          >
            Assign leads
          </button>
        }
      />

      {!assignments.length ? (
        <ManagementEmptyState
          title="No lead assignments"
          description="Assign leads to callers or managers to begin tracking outreach."
        />
      ) : (
        <div className="rf-management-table-wrap">
          <table className="rf-management-table rf-management-table--assignments">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Assigned to</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned</th>
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

                  return (
                    <tr
                      key={
                        assignment.id
                      }
                    >
                      <td>
                        <LeadIdentity
                          assignment={
                            assignment
                          }
                        />
                      </td>

                      <td>
                        {member ? (
                          <CompactMember
                            member={
                              member
                            }
                          />
                        ) : (
                          "Unassigned"
                        )}
                      </td>

                      <td>
                        <ManagementStatus
                          value={
                            assignment.status
                          }
                        />
                      </td>

                      <td>
                        <ManagementStatus
                          value={
                            assignment.priority ||
                            "normal"
                          }
                        />
                      </td>

                      <td>
                        {formatDateTime(
                          assignment.assignedAt ||
                            assignment.createdAt
                        )}
                      </td>

                      <td>
                        {assignment.nextActionAt
                          ? formatDateTime(
                              assignment.nextActionAt
                            )
                          : "Not scheduled"}
                      </td>

                      <td>
                        <select
                          className="rf-table-status-select"
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
                          {ASSIGNMENT_STATUSES.map(
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

function TasksSection({
  tasks,
  members,
  onCreate,
  onUpdated,
  onError,
  onSuccess,
}) {
  const memberMap = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          member,
        ])
      ),
    [members]
  );

  async function updateTask(
    task,
    patch
  ) {
    try {
      const result =
        await apiRequest(
          `/team-management/tasks/${encodeURIComponent(
            task.id
          )}`,
          {
            method: "PATCH",
            body: patch,
          }
        );

      onUpdated(
        result.task || result
      );

      onSuccess(
        "The task was updated."
      );
    } catch (error) {
      onError(
        error?.message ||
          "The task could not be updated."
      );
    }
  }

  return (
    <section className="rf-management-panel">
      <PanelHeader
        title="Team tasks"
        subtitle="Assign and monitor operational work across your team."
        action={
          <button
            type="button"
            className="rf-management-button"
            onClick={onCreate}
          >
            Create task
          </button>
        }
      />

      {!tasks.length ? (
        <ManagementEmptyState
          title="No team tasks"
          description="Create tasks to organize follow-ups, calls and internal work."
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
                  <ManagementStatus
                    value={
                      task.priority ||
                      "normal"
                    }
                  />

                  <ManagementStatus
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
                    "No description was provided."}
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
                    <small>
                      Due
                    </small>

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
                      updateTask(
                        task,
                        {
                          status:
                            event
                              .target
                              .value,
                        }
                      )
                    }
                  >
                    {TASK_STATUSES.map(
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

function PerformanceSection({
  performance,
  members,
}) {
  const rows = useMemo(() => {
    const map = new Map(
      performance.map((item) => [
        item.member?.id ||
          item.userId ||
          item.id,
        item,
      ])
    );

    return members
      .filter((member) =>
        [
          "manager",
          "caller",
        ].includes(
          normalizeRole(
            member.workspaceRole ||
              member.role
          )
        )
      )
      .map((member) => ({
        member,
        performance:
          map.get(member.id) || {},
      }));
  }, [performance, members]);

  return (
    <section className="rf-management-panel">
      <PanelHeader
        title="Team performance"
        subtitle="Review calling activity, lead progress, meetings and attendance."
      />

      {!rows.length ? (
        <ManagementEmptyState
          title="No performance information"
          description="Performance information appears after team members begin assigned work."
        />
      ) : (
        <div className="rf-management-table-wrap">
          <table className="rf-management-table rf-management-table--performance">
            <thead>
              <tr>
                <th>Team member</th>
                <th>Attendance</th>
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
              {rows.map(
                ({
                  member,
                  performance: item,
                }) => {
                  const metrics =
                    item.metrics ||
                    item;

                  const assigned =
                    Number(
                      metrics.assignedLeads ||
                        0
                    );

                  const qualified =
                    Number(
                      metrics.qualifiedLeads ||
                        0
                    );

                  const conversion =
                    assigned > 0
                      ? Math.round(
                          (qualified /
                            assigned) *
                            100
                        )
                      : 0;

                  return (
                    <tr
                      key={member.id}
                    >
                      <td>
                        <CompactMember
                          member={
                            member
                          }
                        />
                      </td>

                      <td>
                        <ManagementStatus
                          value={
                            item.attendance
                              ?.status ||
                            member
                              .todayAttendance
                              ?.status ||
                            "not_checked_in"
                          }
                        />
                      </td>

                      <td>
                        {assigned}
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
                        {qualified}
                      </td>

                      <td>
                        {metrics.meetingsBooked ||
                          0}
                      </td>

                      <td>
                        {formatDuration(
                          metrics.totalCallSeconds ||
                            0
                        )}
                      </td>

                      <td>
                        <ConversionValue
                          value={
                            conversion
                          }
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

function ToolsSection({
  members,
  dialers,
  senders,
  onAssign,
}) {
  const workers =
    members.filter((member) =>
      [
        "manager",
        "caller",
      ].includes(
        normalizeRole(
          member.workspaceRole ||
            member.role
        )
      )
    );

  return (
    <section className="rf-management-panel">
      <PanelHeader
        title="Assigned work tools"
        subtitle="Control which dialer and sender identity each team member can use."
      />

      <div className="rf-tool-overview-grid">
        <ToolOverviewCard
          title="Configured dialers"
          value={dialers.length}
          description="Calling identities and Vonage configurations available to the workspace."
          items={dialers.map(
            (dialer) =>
              dialer.name ||
              dialer.fromNumber
          )}
        />

        <ToolOverviewCard
          title="Sender identities"
          value={senders.length}
          description="Approved SMTP sender identities available for campaign outreach."
          items={senders.map(
            (sender) =>
              sender.fromName ||
              sender.fromEmail
          )}
        />
      </div>

      {!workers.length ? (
        <ManagementEmptyState
          title="No assignable team members"
          description="Add callers or managers before assigning work tools."
        />
      ) : (
        <div className="rf-team-tool-list">
          {workers.map((member) => (
            <article
              key={member.id}
              className="rf-team-tool-row"
            >
              <CompactMember
                member={member}
              />

              <ToolSummary
                label="Dialer"
                value={
                  member
                    .assignedDialer
                    ?.name ||
                  member.dialer
                    ?.name ||
                  "Not assigned"
                }
              />

              <ToolSummary
                label="Sender identity"
                value={
                  member
                    .assignedSender
                    ?.fromEmail ||
                  member.sender
                    ?.fromEmail ||
                  "Not assigned"
                }
              />

              <button
                type="button"
                onClick={() =>
                  onAssign(member)
                }
              >
                Configure
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function InviteMemberDialog({
  currentRole,
  onClose,
  onCreated,
  onError,
}) {
  const [form, setForm] =
    useState({
      name: "",
      email: "",
      phone: "",
      jobTitle: "",
      role: "caller",
      temporaryPassword: "",
      sendInvitation: true,
    });

  const [saving, setSaving] =
    useState(false);

  const availableRoles =
    currentRole === "manager"
      ? MEMBER_ROLES.filter(
          (role) =>
            role.value ===
              "caller" ||
            role.value ===
              "viewer"
        )
      : MEMBER_ROLES;

  async function submit(event) {
    event.preventDefault();

    setSaving(true);

    try {
      const result =
        await apiRequest(
          "/team-management/members",
          {
            method: "POST",
            body: form,
          }
        );

      onCreated(
        result.member ||
          result.profile ||
          result
      );
    } catch (requestError) {
      onError(
        requestError?.message ||
          "The team member could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ManagementDialog
      title="Add team member"
      eyebrow="Workspace access"
      description="Create a secure workspace account and assign the appropriate role."
      onClose={onClose}
    >
      <form
        className="rf-management-dialog-form"
        onSubmit={submit}
      >
        <div className="rf-dialog-form-grid">
          <DialogField
            label="Full name"
            required
          >
            <input
              value={form.name}
              onChange={(event) =>
                updateForm(
                  setForm,
                  "name",
                  event.target.value
                )
              }
              required
              maxLength={120}
            />
          </DialogField>

          <DialogField
            label="Email address"
            required
          >
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                updateForm(
                  setForm,
                  "email",
                  event.target.value
                )
              }
              required
            />
          </DialogField>

          <DialogField label="Phone number">
            <input
              value={form.phone}
              onChange={(event) =>
                updateForm(
                  setForm,
                  "phone",
                  event.target.value
                )
              }
            />
          </DialogField>

          <DialogField label="Job title">
            <input
              value={
                form.jobTitle
              }
              onChange={(event) =>
                updateForm(
                  setForm,
                  "jobTitle",
                  event.target.value
                )
              }
            />
          </DialogField>

          <DialogField
            label="Workspace role"
            required
          >
            <select
              value={form.role}
              onChange={(event) =>
                updateForm(
                  setForm,
                  "role",
                  event.target.value
                )
              }
            >
              {availableRoles.map(
                (role) => (
                  <option
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
                  </option>
                )
              )}
            </select>
          </DialogField>

          <DialogField label="Temporary password">
            <input
              type="password"
              value={
                form.temporaryPassword
              }
              onChange={(event) =>
                updateForm(
                  setForm,
                  "temporaryPassword",
                  event.target.value
                )
              }
              placeholder="Generate automatically when blank"
            />
          </DialogField>
        </div>

        <label className="rf-management-checkbox">
          <input
            type="checkbox"
            checked={
              form.sendInvitation
            }
            onChange={(event) =>
              updateForm(
                setForm,
                "sendInvitation",
                event.target.checked
              )
            }
          />

          <span>
            Send account invitation and
            login instructions by email
          </span>
        </label>

        <DialogFooter
          saving={saving}
          submitLabel="Add member"
          onCancel={onClose}
        />
      </form>
    </ManagementDialog>
  );
}

function LeadAssignmentDialog({
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

  const [leadSearch, setLeadSearch] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const assignableMembers =
    members.filter((member) =>
      [
        "manager",
        "caller",
      ].includes(
        normalizeRole(
          member.workspaceRole ||
            member.role
        )
      )
    );

  const filteredLeads =
    leads.filter((lead) => {
      const query =
        leadSearch
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
      const result =
        await apiRequest(
          "/team-management/assignments",
          {
            method: "POST",
            body: {
              assigneeId,
              leadIds:
                selectedLeadIds,
              priority,
              instructions,
              dueAt:
                dueAt || null,
            },
          }
        );

      onCreated(
        result.assignments ||
          [
            result.assignment ||
              result,
          ]
      );
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
    <ManagementDialog
      title="Assign leads"
      eyebrow="Lead distribution"
      description="Assign one or more leads to a caller or manager."
      onClose={onClose}
      wide
    >
      <form
        className="rf-management-dialog-form"
        onSubmit={submit}
      >
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
                Select team member
              </option>

              {assignableMembers.map(
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
              {TASK_PRIORITIES.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {formatLabel(item)}
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
              placeholder="Add call objectives, qualification notes or follow-up instructions."
            />
          </DialogField>
        </div>

        <div className="rf-lead-selection">
          <header>
            <div>
              <h3>
                Select leads
              </h3>

              <p>
                {
                  selectedLeadIds.length
                }{" "}
                selected
              </p>
            </div>

            <input
              value={leadSearch}
              onChange={(event) =>
                setLeadSearch(
                  event.target.value
                )
              }
              placeholder="Search leads…"
            />
          </header>

          {!filteredLeads.length ? (
            <div className="rf-lead-selection-empty">
              No unassigned leads are
              available.
            </div>
          ) : (
            <div className="rf-lead-selection-list">
              {filteredLeads.map(
                (lead) => (
                  <label
                    key={lead.id}
                    className="rf-lead-selection-item"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(
                        lead.id
                      )}
                      onChange={() =>
                        toggleLead(
                          lead.id
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
                          "No contact details"}
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
          submitLabel={`Assign ${selectedLeadIds.length || ""} lead${
            selectedLeadIds.length === 1
              ? ""
              : "s"
          }`}
          disabled={
            !assigneeId ||
            !selectedLeadIds.length
          }
          onCancel={onClose}
        />
      </form>
    </ManagementDialog>
  );
}

function TaskAssignmentDialog({
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
      relatedLeadId: "",
    });

  const [saving, setSaving] =
    useState(false);

  const assignableMembers =
    members.filter((member) =>
      [
        "manager",
        "caller",
        "viewer",
      ].includes(
        normalizeRole(
          member.workspaceRole ||
            member.role
        )
      )
    );

  async function submit(event) {
    event.preventDefault();

    setSaving(true);

    try {
      const result =
        await apiRequest(
          "/team-management/tasks",
          {
            method: "POST",
            body: {
              ...form,
              dueAt:
                form.dueAt ||
                null,
              relatedLeadId:
                form.relatedLeadId ||
                null,
            },
          }
        );

      onCreated(
        result.task || result
      );
    } catch (requestError) {
      onError(
        requestError?.message ||
          "The task could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ManagementDialog
      title="Assign a task"
      eyebrow="Team workflow"
      description="Create a clear, trackable task for a member of your team."
      onClose={onClose}
    >
      <form
        className="rf-management-dialog-form"
        onSubmit={submit}
      >
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

              {assignableMembers.map(
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
              {TASK_PRIORITIES.map(
                (priority) => (
                  <option
                    key={priority}
                    value={priority}
                  >
                    {formatLabel(
                      priority
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
            label="Related lead ID"
          >
            <input
              value={
                form.relatedLeadId
              }
              onChange={(event) =>
                updateForm(
                  setForm,
                  "relatedLeadId",
                  event.target.value
                )
              }
              placeholder="Optional"
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
              placeholder="Describe the expected outcome and any relevant instructions."
            />
          </DialogField>
        </div>

        <DialogFooter
          saving={saving}
          submitLabel="Assign task"
          disabled={
            !form.title.trim() ||
            !form.assigneeId
          }
          onCancel={onClose}
        />
      </form>
    </ManagementDialog>
  );
}

function ToolAssignmentDialog({
  member,
  members,
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

  const selected =
    members.find(
      (item) =>
        item.id === memberId
    ) || member;

  async function submit(event) {
    event.preventDefault();

    if (!memberId) {
      return;
    }

    setSaving(true);

    try {
      const result =
        await apiRequest(
          `/team-management/members/${encodeURIComponent(
            memberId
          )}/tools`,
          {
            method: "PATCH",
            body: {
              dialerId:
                dialerId || null,
              senderId:
                senderId || null,
            },
          }
        );

      onUpdated(
        result.member ||
          result.profile ||
          {
            ...selected,
            assignedDialerId:
              dialerId || "",
            assignedSenderId:
              senderId || "",
            assignedDialer:
              dialers.find(
                (dialer) =>
                  dialer.id ===
                  dialerId
              ) || null,
            assignedSender:
              senders.find(
                (sender) =>
                  sender.id ===
                  senderId
              ) || null,
          }
      );
    } catch (requestError) {
      onError(
        requestError?.message ||
          "The work tools could not be assigned."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ManagementDialog
      title="Assign work tools"
      eyebrow="Calling and outreach"
      description="Select the dialer and approved sender identity this team member can use."
      onClose={onClose}
    >
      <form
        className="rf-management-dialog-form"
        onSubmit={submit}
      >
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

              {members
                .filter((item) =>
                  [
                    "manager",
                    "caller",
                  ].includes(
                    normalizeRole(
                      item.workspaceRole ||
                        item.role
                    )
                  )
                )
                .map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
            </select>
          </DialogField>

          <DialogField label="Dialer">
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
                      sender.name}{" "}
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
            Access control
          </strong>

          <p>
            The selected user will only
            be able to use the assigned
            dialer and sender identity.
            Credentials remain encrypted
            and are never exposed to the
            user interface.
          </p>
        </div>

        <DialogFooter
          saving={saving}
          submitLabel="Save tool assignment"
          disabled={!memberId}
          onCancel={onClose}
        />
      </form>
    </ManagementDialog>
  );
}

function MemberDetailsDrawer({
  member,
  performance,
  assignments,
  tasks,
  currentRole,
  onClose,
  onUpdate,
  onRemove,
  onAssignLead,
  onAssignTask,
  onAssignTools,
}) {
  const [editing, setEditing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [form, setForm] =
    useState({
      name: member.name || "",
      phone: member.phone || "",
      jobTitle:
        member.jobTitle || "",
      role:
        normalizeRole(
          member.workspaceRole ||
            member.role
        ) || "caller",
      status:
        normalizeStatus(
          member.status ||
            "active"
        ),
      managerId:
        member.managerId || "",
    });

  const allowedRoles =
    currentRole === "manager"
      ? MEMBER_ROLES.filter(
          (role) =>
            role.value ===
              "caller" ||
            role.value ===
              "viewer"
        )
      : MEMBER_ROLES;

  async function save(event) {
    event.preventDefault();

    setSaving(true);

    try {
      await onUpdate(
        member.id,
        form
      );

      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const metrics =
    performance?.metrics ||
    performance ||
    {};

  return (
    <div className="rf-management-drawer-backdrop">
      <aside className="rf-member-details-drawer">
        <header>
          <div>
            <MemberAvatar
              member={member}
              size="extra-large"
            />

            <span>
              <h2>
                {member.name}
              </h2>

              <p>
                {member.jobTitle ||
                  formatLabel(
                    member.workspaceRole ||
                      member.role
                  )}
              </p>

              <small>
                {member.email}
              </small>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="rf-drawer-action-row">
          <button
            type="button"
            onClick={onAssignLead}
          >
            Assign leads
          </button>

          <button
            type="button"
            onClick={onAssignTask}
          >
            Assign task
          </button>

          <button
            type="button"
            onClick={onAssignTools}
          >
            Configure tools
          </button>
        </div>

        <section className="rf-drawer-section">
          <SectionTitle
            title="Current status"
          />

          <div className="rf-drawer-status-grid">
            <MemberStatus
              value={
                member.status ||
                "active"
              }
            />

            <AvailabilityIndicator
              value={
                member.availabilityStatus ||
                "offline"
              }
            />

            <AttendanceIndicator
              attendance={
                member.todayAttendance ||
                performance?.attendance
              }
            />
          </div>
        </section>

        <section className="rf-drawer-section">
          <SectionTitle
            title="Performance"
          />

          <div className="rf-drawer-metric-grid">
            <MemberStat
              label="Assigned"
              value={
                metrics.assignedLeads ||
                assignments.length
              }
            />

            <MemberStat
              label="Calls"
              value={
                metrics.totalCalls ||
                0
              }
            />

            <MemberStat
              label="Answered"
              value={
                metrics.answeredCalls ||
                0
              }
            />

            <MemberStat
              label="Qualified"
              value={
                metrics.qualifiedLeads ||
                0
              }
            />

            <MemberStat
              label="Meetings"
              value={
                metrics.meetingsBooked ||
                0
              }
            />

            <MemberStat
              label="Talk time"
              value={formatDuration(
                metrics.totalCallSeconds ||
                  0
              )}
            />
          </div>
        </section>

        <section className="rf-drawer-section">
          <SectionTitle
            title="Assigned workload"
          />

          <div className="rf-drawer-summary-list">
            <ToolSummary
              label="Active lead assignments"
              value={
                assignments.filter(
                  (assignment) =>
                    ![
                      "completed",
                      "do_not_contact",
                    ].includes(
                      normalizeStatus(
                        assignment.status
                      )
                    )
                ).length
              }
            />

            <ToolSummary
              label="Pending tasks"
              value={
                tasks.filter(
                  (task) =>
                    ![
                      "completed",
                      "cancelled",
                    ].includes(
                      normalizeStatus(
                        task.status
                      )
                    )
                ).length
              }
            />

            <ToolSummary
              label="Assigned dialer"
              value={
                member
                  .assignedDialer
                  ?.name ||
                member.dialer?.name ||
                "Not assigned"
              }
            />

            <ToolSummary
              label="Sender identity"
              value={
                member
                  .assignedSender
                  ?.fromEmail ||
                member.sender
                  ?.fromEmail ||
                "Not assigned"
              }
            />
          </div>
        </section>

        <section className="rf-drawer-section">
          <SectionTitle
            title="Member settings"
            action={
              <button
                type="button"
                onClick={() =>
                  setEditing(
                    (current) =>
                      !current
                  )
                }
              >
                {editing
                  ? "Cancel"
                  : "Edit"}
              </button>
            }
          />

          {editing ? (
            <form
              className="rf-member-edit-form"
              onSubmit={save}
            >
              <DialogField label="Full name">
                <input
                  value={form.name}
                  onChange={(event) =>
                    updateForm(
                      setForm,
                      "name",
                      event.target
                        .value
                    )
                  }
                />
              </DialogField>

              <DialogField label="Phone">
                <input
                  value={form.phone}
                  onChange={(event) =>
                    updateForm(
                      setForm,
                      "phone",
                      event.target
                        .value
                    )
                  }
                />
              </DialogField>

              <DialogField label="Job title">
                <input
                  value={
                    form.jobTitle
                  }
                  onChange={(event) =>
                    updateForm(
                      setForm,
                      "jobTitle",
                      event.target
                        .value
                    )
                  }
                />
              </DialogField>

              <DialogField label="Role">
                <select
                  value={form.role}
                  onChange={(event) =>
                    updateForm(
                      setForm,
                      "role",
                      event.target
                        .value
                    )
                  }
                >
                  {allowedRoles.map(
                    (role) => (
                      <option
                        key={
                          role.value
                        }
                        value={
                          role.value
                        }
                      >
                        {role.label}
                      </option>
                    )
                  )}
                </select>
              </DialogField>

              <DialogField label="Account status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm(
                      setForm,
                      "status",
                      event.target
                        .value
                    )
                  }
                >
                  {MEMBER_STATUSES.map(
                    (status) => (
                      <option
                        key={
                          status.value
                        }
                        value={
                          status.value
                        }
                      >
                        {status.label}
                      </option>
                    )
                  )}
                </select>
              </DialogField>

              <button
                type="submit"
                className="rf-management-button"
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : "Save changes"}
              </button>
            </form>
          ) : (
            <div className="rf-member-information-list">
              <InformationRow
                label="Full name"
                value={member.name}
              />

              <InformationRow
                label="Email"
                value={member.email}
              />

              <InformationRow
                label="Phone"
                value={
                  member.phone ||
                  "Not provided"
                }
              />

              <InformationRow
                label="Job title"
                value={
                  member.jobTitle ||
                  "Not provided"
                }
              />

              <InformationRow
                label="Role"
                value={formatLabel(
                  member.workspaceRole ||
                    member.role
                )}
              />

              <InformationRow
                label="Created"
                value={formatDateTime(
                  member.createdAt
                )}
              />
            </div>
          )}
        </section>

        <footer>
          <button
            type="button"
            className="rf-remove-member-button"
            onClick={onRemove}
          >
            Remove from workspace
          </button>
        </footer>
      </aside>
    </div>
  );
}

function ManagementDialog({
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

        {children}
      </section>
    </div>
  );
}

function DialogFooter({
  saving,
  submitLabel,
  disabled = false,
  onCancel,
}) {
  return (
    <footer className="rf-management-dialog-footer">
      <button
        type="button"
        className="rf-management-button rf-management-button--secondary"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </button>

      <button
        type="submit"
        className="rf-management-button"
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

function PanelHeader({
  title,
  subtitle,
  action,
}) {
  return (
    <header className="rf-management-panel-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {action}
    </header>
  );
}

function SectionTitle({
  title,
  action,
}) {
  return (
    <header className="rf-drawer-section-title">
      <h3>{title}</h3>
      {action}
    </header>
  );
}

function MemberAvatar({
  member = {},
  size = "normal",
}) {
  const [failed, setFailed] =
    useState(false);

  return (
    <span
      className={`rf-management-avatar rf-management-avatar--${size}`}
    >
      {member.avatarUrl &&
      !failed ? (
        <img
          src={member.avatarUrl}
          alt={
            member.name ||
            "Team member"
          }
          onError={() =>
            setFailed(true)
          }
        />
      ) : (
        <b>
          {getInitials(
            member.name ||
              member.email ||
              "RF"
          )}
        </b>
      )}
    </span>
  );
}

function CompactMember({
  member,
}) {
  return (
    <div className="rf-compact-member">
      <MemberAvatar
        member={member}
      />

      <span>
        <strong>
          {member.name}
        </strong>

        <small>
          {member.jobTitle ||
            formatLabel(
              member.workspaceRole ||
                member.role
            )}
        </small>
      </span>
    </div>
  );
}

function MemberStatus({
  value,
}) {
  return (
    <ManagementStatus
      value={value}
    />
  );
}

function AvailabilityIndicator({
  value,
}) {
  const status =
    normalizeStatus(
      value || "offline"
    );

  return (
    <span
      className={`rf-availability-indicator rf-availability-indicator--${status}`}
    >
      <i />
      {formatLabel(status)}
    </span>
  );
}

function AttendanceIndicator({
  attendance,
}) {
  const status =
    attendance?.status ||
    (attendance?.checkedInAt
      ? attendance.checkedOutAt
        ? "checked_out"
        : "checked_in"
      : "not_checked_in");

  return (
    <ManagementStatus
      value={status}
    />
  );
}

function ManagementStatus({
  value,
}) {
  const status =
    normalizeStatus(
      value || "unknown"
    );

  return (
    <span
      className={`rf-management-status rf-management-status--${status}`}
    >
      {formatLabel(status)}
    </span>
  );
}

function MemberStat({
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

function ToolSummary({
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

function LeadIdentity({
  assignment,
}) {
  const lead =
    assignment.lead || {};

  return (
    <div className="rf-lead-identity">
      <span>
        {getInitials(
          lead.business ||
            lead.name ||
            "Lead"
        )}
      </span>

      <div>
        <strong>
          {lead.business ||
            lead.name ||
            assignment.leadName ||
            "Unnamed lead"}
        </strong>

        <small>
          {lead.phone ||
            lead.email ||
            lead.website ||
            assignment.leadId}
        </small>
      </div>
    </div>
  );
}

function ConversionValue({
  value,
}) {
  return (
    <div className="rf-conversion-value">
      <div>
        <span
          style={{
            width: `${Math.max(
              0,
              Math.min(100, value)
            )}%`,
          }}
        />
      </div>

      <strong>{value}%</strong>
    </div>
  );
}

function ToolOverviewCard({
  title,
  value,
  description,
  items,
}) {
  return (
    <article className="rf-tool-overview-card">
      <header>
        <div>
          <small>{title}</small>
          <strong>{value}</strong>
        </div>
      </header>

      <p>{description}</p>

      <div>
        {items
          .filter(Boolean)
          .slice(0, 5)
          .map((item) => (
            <span key={item}>
              {item}
            </span>
          ))}
      </div>
    </article>
  );
}

function InformationRow({
  label,
  value,
}) {
  return (
    <div className="rf-information-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

function ManagementAlert({
  type,
  message,
  onClose,
}) {
  return (
    <div
      className={`rf-management-alert rf-management-alert--${type}`}
    >
      <span>{safeTeamManagementMessage(message)}</span>

      <button
        type="button"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}

function ManagementEmptyState({
  title,
  description,
}) {
  return (
    <div className="rf-management-empty">
      <div>TM</div>

      <strong>{title}</strong>

      <p>{description}</p>
    </div>
  );
}

function AccessDenied({
  currentUser,
}) {
  return (
    <main className="rf-team-management-page rf-team-management-v7">
      <TeamManagementV7Styles />
      <section className="rf-management-access-denied">
        <div>!</div>

        <h1>
          Management access required
        </h1>

        <p>
          The{" "}
          {formatLabel(
            currentUser?.workspaceRole ||
              currentUser?.role ||
              "current"
          )}{" "}
          role cannot manage workspace
          members, assignments or work
          tools.
        </p>

        <a href="/app/dashboard">
          Return to dashboard
        </a>
      </section>
    </main>
  );
}

function TeamManagementSkeleton() {
  return (
    <main className="rf-team-management-page rf-team-management-v7">
      <TeamManagementV7Styles />
      <div className="rf-management-skeleton-header" />

      <div className="rf-management-skeleton-metrics">
        {Array.from({
          length: 5,
        }).map((_, index) => (
          <div key={index} />
        ))}
      </div>

      <div className="rf-management-skeleton-navigation" />

      <div className="rf-management-skeleton-panel" />
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

function findPerformance(
  userId,
  performance
) {
  return (
    performance.find(
      (item) =>
        item.userId === userId ||
        item.member?.id === userId ||
        item.id === userId
    ) || {}
  );
}

function getAssigneeId(item) {
  return (
    item?.assigneeId ||
    item?.assignedToUserId ||
    item?.userId ||
    item?.assignee?.id ||
    ""
  );
}

function getSettledValue(
  result,
  fallback
) {
  return result.status ===
    "fulfilled"
    ? result.value
    : fallback;
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
      month: "short",
      day: "numeric",
      year: "numeric",
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

function safeTeamManagementMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function notifyTeamManagement(
  type,
  title,
  message
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const bridge =
    window.reachflyToast;

  if (
    bridge &&
    typeof bridge[type] ===
      "function"
  ) {
    bridge[type](
      title,
      message
    );
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      "reachfly:toast",
      {
        detail: {
          type,
          title,
          message,
        },
      }
    )
  );
}

function TeamManagementV7Styles() {
  return (
    <style>{`
      .rf-team-management-v7{
        --rftm-card:#fff;
        --rftm-soft:#f6f7f8;
        --rftm-text:#191c1d;
        --rftm-text2:#4d4c59;
        --rftm-muted:#777784;
        --rftm-line:#e2e4e7;
        --rftm-primary:#4648d4;
        --rftm-primary-dark:#393bbb;
        --rftm-primary-soft:#e8e9ff;
        --rftm-green:#087a51;
        --rftm-green-soft:#e4f7ee;
        --rftm-red:#ba1a1a;
        --rftm-red-soft:#ffedeb;
        --rftm-amber:#965900;
        --rftm-amber-soft:#fff3d8;
        --rftm-dark:#2e3132;
        --rftm-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rftm-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rftmPageIn .24s var(--rftm-ease);
      }

      .rf-team-management-v7 *,
      .rf-team-management-v7 *::before,
      .rf-team-management-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rftmPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rftmPulse{
        0%,100%{opacity:.4}
        50%{opacity:1}
      }

      .rf-team-management-v7 .rf-team-management-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        margin-bottom:16px;
      }

      .rf-team-management-v7 .rf-team-management-header > div:first-child{
        min-width:0;
      }

      .rf-team-management-v7 .rf-management-eyebrow{
        margin:0 0 4px;
        color:var(--rftm-primary);
        font-size:8px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-team-management-v7 .rf-team-management-header h1{
        margin:0;
        font:600 31px/39px Geist,Inter,sans-serif;
        letter-spacing:-.028em;
      }

      .rf-team-management-v7 .rf-team-management-header p:not(.rf-management-eyebrow){
        max-width:760px;
        margin:5px 0 0;
        color:var(--rftm-text2);
        font-size:10px;
        line-height:16px;
      }

      .rf-team-management-v7 .rf-team-management-header__actions{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
      }

      .rf-team-management-v7 .rf-management-button{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        color:#fff;
        background:var(--rftm-primary);
        border:1px solid var(--rftm-primary);
        border-radius:8px;
        cursor:pointer;
        font-size:7px;
        font-weight:750;
        box-shadow:0 7px 16px rgba(70,72,212,.12);
        transition:.14s var(--rftm-ease);
      }

      .rf-team-management-v7 .rf-management-button:hover:not(:disabled){
        transform:translateY(-1px);
        background:var(--rftm-primary-dark);
      }

      .rf-team-management-v7 .rf-management-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-team-management-v7 .rf-management-button--secondary{
        color:var(--rftm-text);
        background:#fff;
        border-color:var(--rftm-line);
        box-shadow:none;
      }

      .rf-team-management-v7 .rf-management-alert{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 11px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        font-size:7px;
        line-height:12px;
        animation:rftmPageIn .16s var(--rftm-ease);
      }

      .rf-team-management-v7 .rf-management-alert--error{
        color:#7c1d1d;
        background:var(--rftm-red-soft);
        border-color:#ffd0cc;
      }

      .rf-team-management-v7 .rf-management-alert--success{
        color:#086846;
        background:var(--rftm-green-soft);
        border-color:#caeadb;
      }

      .rf-team-management-v7 .rf-management-alert button{
        min-height:28px;
        padding:4px 7px;
        color:inherit;
        background:#fff;
        border:1px solid currentColor;
        border-radius:6px;
        cursor:pointer;
        font-size:5.4px;
        font-weight:750;
      }

      .rf-team-management-v7 .rf-management-metric-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin-bottom:10px;
      }

      .rf-team-management-v7 .rf-management-metric{
        min-height:120px;
        display:grid;
        align-content:end;
        padding:13px;
        background:
          radial-gradient(circle at 92% 10%,rgba(70,72,212,.045),transparent 30%),
          #fff;
        border:1px solid var(--rftm-line);
        border-radius:10px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-team-management-v7 .rf-management-metric > div:first-child{
        color:var(--rftm-primary);
      }

      .rf-team-management-v7 .rf-management-metric strong{
        font:600 23px/29px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-team-management-v7 .rf-management-metric small,
      .rf-team-management-v7 .rf-management-metric span{
        color:var(--rftm-muted);
        font-size:5.6px;
        line-height:9px;
      }

      .rf-team-management-v7 .rf-management-navigation{
        position:sticky;
        z-index:20;
        top:64px;
        display:flex;
        gap:4px;
        overflow-x:auto;
        padding:5px;
        margin-bottom:10px;
        background:rgba(255,255,255,.95);
        border:1px solid var(--rftm-line);
        border-radius:10px;
        backdrop-filter:blur(12px);
        scrollbar-width:none;
      }

      .rf-team-management-v7 .rf-management-navigation::-webkit-scrollbar{
        display:none;
      }

      .rf-team-management-v7 .rf-management-navigation button{
        min-height:35px;
        flex:0 0 auto;
        padding:6px 8px;
        color:var(--rftm-text2);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
      }

      .rf-team-management-v7 .rf-management-navigation button.active,
      .rf-team-management-v7 .rf-management-navigation button[aria-selected="true"]{
        color:var(--rftm-primary);
        background:var(--rftm-primary-soft);
      }

      .rf-team-management-v7 .rf-management-panel{
        min-width:0;
        padding:13px;
        margin-bottom:10px;
        background:#fff;
        border:1px solid var(--rftm-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-team-management-v7 .rf-management-panel-header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        padding-bottom:9px;
        margin-bottom:9px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-team-management-v7 .rf-management-panel-header h2,
      .rf-team-management-v7 .rf-management-panel-header h3{
        margin:0;
        font:600 14px/19px Geist,Inter,sans-serif;
      }

      .rf-team-management-v7 .rf-management-panel-header p{
        margin:3px 0 0;
        color:var(--rftm-muted);
        font-size:6px;
        line-height:10px;
      }

      .rf-team-management-v7 .rf-management-filters{
        display:grid;
        grid-template-columns:minmax(180px,1fr) 160px 160px;
        gap:7px;
        margin-bottom:9px;
      }

      .rf-team-management-v7 .rf-management-search,
      .rf-team-management-v7 input,
      .rf-team-management-v7 select,
      .rf-team-management-v7 textarea{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rftm-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 7px/12px Inter,sans-serif;
      }

      .rf-team-management-v7 textarea{
        min-height:88px;
        resize:vertical;
      }

      .rf-team-management-v7 input:focus,
      .rf-team-management-v7 select:focus,
      .rf-team-management-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-team-management-v7 .rf-team-member-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf-team-management-v7 .rf-team-member-card{
        min-width:0;
        padding:10px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
        transition:.13s var(--rftm-ease);
      }

      .rf-team-management-v7 .rf-team-member-card:hover{
        background:#f4f4ff;
        border-color:#dddefa;
        transform:translateY(-1px);
      }

      .rf-team-management-v7 .rf-compact-member{
        min-width:0;
        display:grid;
        grid-template-columns:36px minmax(0,1fr) auto;
        align-items:center;
        gap:7px;
      }

      .rf-team-management-v7 .rf-member-status-row{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:4px;
        margin-top:7px;
      }

      .rf-team-management-v7 .rf-management-table-wrap{
        overflow-x:auto;
        border:1px solid var(--rftm-line);
        border-radius:9px;
      }

      .rf-team-management-v7 .rf-management-table{
        width:100%;
        min-width:850px;
        border-collapse:collapse;
      }

      .rf-team-management-v7 .rf-management-table th{
        height:40px;
        padding:8px 9px;
        color:#686973;
        background:#f7f8f9;
        border-bottom:1px solid var(--rftm-line);
        text-align:left;
        white-space:nowrap;
        font-size:5.4px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rf-team-management-v7 .rf-management-table td{
        padding:9px;
        color:var(--rftm-text2);
        border-bottom:1px solid #eff0f1;
        font-size:5.9px;
        line-height:10px;
      }

      .rf-team-management-v7 .rf-management-table tbody tr:hover td{
        background:#fafaff;
      }

      .rf-team-management-v7 .rf-task-management-grid,
      .rf-team-management-v7 .rf-tool-overview-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf-team-management-v7 .rf-managed-task-card,
      .rf-team-management-v7 .rf-tool-overview-card{
        min-width:0;
        padding:10px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
      }

      .rf-team-management-v7 .rf-team-tool-list{
        display:grid;
        gap:5px;
      }

      .rf-team-management-v7 .rf-team-tool-row{
        min-height:56px;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:8px 9px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-team-management-v7 .rf-management-empty{
        min-height:170px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:20px;
        color:var(--rftm-muted);
        background:#f8f9fa;
        border:1px dashed #d8dade;
        border-radius:9px;
        text-align:center;
      }

      .rf-team-management-v7 .rf-management-modal-backdrop,
      .rf-team-management-v7 .rf-management-drawer-backdrop{
        position:fixed;
        z-index:2147481000;
        inset:0;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(25,28,29,.58);
        backdrop-filter:blur(8px);
      }

      .rf-team-management-v7 .rf-management-dialog,
      .rf-team-management-v7 .rf-member-details-drawer{
        width:min(760px,100%);
        max-height:calc(100vh - 36px);
        overflow:auto;
        padding:15px;
        background:#fff;
        border:1px solid rgba(255,255,255,.3);
        border-radius:13px;
        box-shadow:0 24px 70px rgba(0,0,0,.18);
      }

      .rf-team-management-v7 .rf-member-details-drawer{
        justify-self:end;
        width:min(530px,100%);
        height:100%;
        max-height:100vh;
        border-radius:13px 0 0 13px;
      }

      .rf-team-management-v7 .rf-dialog-form-grid,
      .rf-team-management-v7 .rf-member-edit-form,
      .rf-team-management-v7 .rf-drawer-metric-grid,
      .rf-team-management-v7 .rf-member-stat-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
      }

      .rf-team-management-v7 .rf-management-access-denied{
        max-width:720px;
        min-height:330px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:7px;
        padding:28px;
        margin:40px auto 0;
        background:#fff;
        border:1px solid var(--rftm-line);
        border-radius:14px;
        text-align:center;
      }

      .rf-team-management-v7 .rf-management-skeleton-header,
      .rf-team-management-v7 .rf-management-skeleton-navigation,
      .rf-team-management-v7 .rf-management-skeleton-panel,
      .rf-team-management-v7 .rf-management-skeleton-metrics > div{
        background:linear-gradient(90deg,#eceef0,#f8f9fa,#eceef0);
        background-size:220% 100%;
        animation:rftmPulse 1.15s infinite ease-in-out;
      }

      @media(max-width:1080px){
        .rf-team-management-v7{
          padding:22px;
        }

        .rf-team-management-v7 .rf-team-member-grid,
        .rf-team-management-v7 .rf-task-management-grid,
        .rf-team-management-v7 .rf-tool-overview-grid{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:760px){
        .rf-team-management-v7 .rf-team-management-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-team-management-v7 .rf-team-management-header__actions{
          width:100%;
        }

        .rf-team-management-v7 .rf-team-management-header__actions .rf-management-button{
          flex:1;
        }

        .rf-team-management-v7 .rf-management-metric-grid{
          grid-template-columns:1fr 1fr;
        }

        .rf-team-management-v7 .rf-management-filters{
          grid-template-columns:1fr;
        }

        .rf-team-management-v7 .rf-dialog-form-grid,
        .rf-team-management-v7 .rf-member-edit-form,
        .rf-team-management-v7 .rf-drawer-metric-grid,
        .rf-team-management-v7 .rf-member-stat-grid{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:620px){
        .rf-team-management-v7{
          padding:18px 12px 80px;
        }

        .rf-team-management-v7 .rf-team-management-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rf-team-management-v7 .rf-management-navigation{
          top:61px;
          margin-left:-12px;
          margin-right:-12px;
          border-left:0;
          border-right:0;
          border-radius:0;
        }

        .rf-team-management-v7 .rf-team-member-grid,
        .rf-team-management-v7 .rf-task-management-grid,
        .rf-team-management-v7 .rf-tool-overview-grid{
          grid-template-columns:1fr;
        }

        .rf-team-management-v7 .rf-management-modal-backdrop,
        .rf-team-management-v7 .rf-management-drawer-backdrop{
          padding:0;
        }

        .rf-team-management-v7 .rf-management-dialog,
        .rf-team-management-v7 .rf-member-details-drawer{
          width:100%;
          min-height:100vh;
          max-height:100vh;
          border-radius:0;
        }
      }

      @media(max-width:420px){
        .rf-team-management-v7 .rf-management-metric-grid{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-team-management-v7,
        .rf-team-management-v7 *,
        .rf-team-management-v7 *::before,
        .rf-team-management-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
