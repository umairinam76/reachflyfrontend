import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  apiRequest,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import "../styles.css";
// import "../styles/manager-resource-board.css";

const BOARD_CACHE_KEY =
  "reachfly:manager-resource-board:v1";
const BOARD_CACHE_TTL_MS = 5 * 60 * 1000;
const BOARD_REFRESH_MS = 20_000;

const LEAD_STATUSES = [
  ["all", "All lead statuses"],
  ["assigned", "Assigned"],
  ["in_progress", "In progress"],
  ["follow_up", "Follow-up"],
  ["no_answer", "No answer"],
  ["busy", "Busy"],
  ["voicemail", "Voicemail"],
  ["qualified", "Qualified"],
  ["meeting_booked", "Meeting booked"],
  ["completed", "Completed"],
];

const TASK_STATUSES = [
  "assigned",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

const EMPTY_RESOURCE = {
  name: "",
  email: "",
  password: "",
  dailyLeadLimit: 100,
  phoneNumber: "",
  emailAccountId: "",
  jobTitle: "Caller",
  department: "Sales",
};

const EMPTY_TASK = {
  title: "",
  description: "",
  assigneeId: "",
  priority: "normal",
  dueAt: "",
  assignmentId: "",
};

export default function ManagerResourceBoard() {
  const {
    user,
  } = useAuth();

  const navigate = useNavigate();
  const initialCacheRef = useRef(
    readBoardCache(user?.id)
  );
  const refreshTimerRef = useRef(null);

  const [board, setBoard] = useState(
    () => initialCacheRef.current?.board || null
  );
  const [activeTab, setActiveTab] = useState("leads");
  const [search, setSearch] = useState("");
  const [leadStatus, setLeadStatus] = useState("all");
  const [campaignId, setCampaignId] = useState("all");
  const [loading, setLoading] = useState(
    () => !initialCacheRef.current?.board
  );
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragPayload, setDragPayload] = useState(null);
  const [showCreateResource, setShowCreateResource] = useState(false);
  const [resourceForm, setResourceForm] = useState(EMPTY_RESOURCE);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [credentials, setCredentials] = useState(null);

  const role = normalizeRole(
    user?.workspaceRole || user?.role
  );

  const canManage = [
    "owner",
    "admin",
    "manager",
  ].includes(role);

  const loadBoard = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const response = await apiRequest(
          "/resource-board",
          {
            timeoutMs: 15_000,
          }
        );

        setBoard(response);
        writeBoardCache(user?.id, response);
      } catch (requestError) {
        setError(
          requestError?.message ||
            "The manager resource board could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    if (!canManage) {
      navigate("/app/dashboard", {
        replace: true,
      });
      return undefined;
    }

    void loadBoard({
      silent: Boolean(board),
    });

    const intervalId = window.setInterval(
      () => {
        void loadBoard({ silent: true });
      },
      BOARD_REFRESH_MS
    );

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadBoard({ silent: true });
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
    };
  }, [
    board,
    canManage,
    loadBoard,
    navigate,
  ]);

  useEffect(() => {
    if (!canManage) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(
        refreshTimerRef.current
      );

      refreshTimerRef.current =
        window.setTimeout(() => {
          void loadBoard({ silent: true });
        }, 180);
    };

    const events = [
      "resource-board:updated",
      "resource-board:lead-updated",
      "resource-board:resource-updated",
      "lead:updated",
      "lead:call-updated",
      "team:task-created",
      "team:task-updated",
      "presence:updated",
      "profile:updated",
    ];

    const subscriptions = events.map(
      (eventName) =>
        onWorkspaceSocket(
          eventName,
          scheduleRefresh
        )
    );

    return () => {
      window.clearTimeout(
        refreshTimerRef.current
      );
      subscriptions.forEach(
        (unsubscribe) => unsubscribe()
      );
    };
  }, [canManage, loadBoard]);

  const resources = useMemo(
    () =>
      Array.isArray(board?.resources)
        ? board.resources
        : [],
    [board?.resources]
  );

  const assignments = useMemo(
    () =>
      Array.isArray(board?.assignments)
        ? board.assignments
        : [],
    [board?.assignments]
  );

  const tasks = useMemo(
    () =>
      Array.isArray(board?.tasks)
        ? board.tasks
        : [],
    [board?.tasks]
  );

  const campaigns = useMemo(() => {
    const map = new Map();

    for (const assignment of assignments) {
      if (assignment.campaignId) {
        map.set(
          assignment.campaignId,
          assignment.campaignName ||
            "Untitled campaign"
        );
      }
    }

    return [...map.entries()].sort(
      (left, right) =>
        left[1].localeCompare(right[1])
    );
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const lead = assignment.lead || {};
      const status = normalizeStatus(
        assignment.status || lead.status
      );

      if (
        leadStatus !== "all" &&
        status !== leadStatus
      ) {
        return false;
      }

      if (
        campaignId !== "all" &&
        assignment.campaignId !== campaignId
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        lead.business,
        lead.name,
        lead.phone,
        lead.email,
        lead.website,
        lead.address,
        assignment.campaignName,
        assignment.assignedToName,
        assignment.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    assignments,
    campaignId,
    leadStatus,
    search,
  ]);

  const unassignedLeads = useMemo(
    () =>
      filteredAssignments.filter(
        (assignment) =>
          !getAssigneeId(assignment)
      ),
    [filteredAssignments]
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return tasks;
    }

    return tasks.filter((task) =>
      [
        task.title,
        task.description,
        task.lead?.business,
        task.lead?.name,
        task.assigneeName,
        task.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, tasks]);

  async function moveLead(
    assignmentId,
    resourceId
  ) {
    const key = `lead:${assignmentId}`;
    setBusyKey(key);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/resource-board/leads/${encodeURIComponent(
          assignmentId
        )}/assignee`,
        {
          method: "PATCH",
          body: {
            resourceId,
          },
        }
      );

      setBoard((current) =>
        replaceBoardAssignment(
          current,
          response.assignment
        )
      );

      const resource = resources.find(
        (item) => item.id === resourceId
      );

      setSuccess(
        resourceId
          ? `Lead assigned to ${
              resource?.name || "the selected caller"
            }.`
          : "Lead moved to the unassigned pool."
      );

      void loadBoard({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The lead could not be reassigned."
      );
    } finally {
      setBusyKey("");
      setDragPayload(null);
    }
  }

  async function moveTask(taskId, resourceId) {
    const key = `task:${taskId}`;
    setBusyKey(key);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/resource-board/tasks/${encodeURIComponent(
          taskId
        )}/assignee`,
        {
          method: "PATCH",
          body: {
            resourceId,
          },
        }
      );

      setBoard((current) =>
        replaceBoardTask(
          current,
          response.task
        )
      );

      setSuccess(
        resourceId
          ? "Task reassigned successfully."
          : "Task moved to the unassigned pool."
      );

      void loadBoard({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The task could not be reassigned."
      );
    } finally {
      setBusyKey("");
      setDragPayload(null);
    }
  }

  async function updateTaskStatus(task, status) {
    const key = `task:${task.id}`;
    setBusyKey(key);
    setError("");

    try {
      const response = await apiRequest(
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

      setBoard((current) =>
        replaceBoardTask(
          current,
          response.task || response
        )
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The task status could not be updated."
      );
    } finally {
      setBusyKey("");
    }
  }

  async function createTask(event) {
    event.preventDefault();

    if (!taskForm.title.trim()) {
      setError("Task title is required.");
      return;
    }

    if (!taskForm.assigneeId) {
      setError("Select a caller resource for this task.");
      return;
    }

    setBusyKey("create-task");
    setError("");
    setSuccess("");

    const assignment = assignments.find(
      (item) =>
        item.id === taskForm.assignmentId
    );

    try {
      const response = await apiRequest(
        "/team-communication/tasks",
        {
          method: "POST",
          body: {
            ...taskForm,
            title: taskForm.title.trim(),
            description:
              taskForm.description.trim(),
            dueAt: taskForm.dueAt
              ? new Date(
                  taskForm.dueAt
                ).toISOString()
              : null,
            lead: assignment?.lead || null,
            leadId:
              assignment?.leadId ||
              assignment?.lead?.id ||
              "",
            campaignId:
              assignment?.campaignId || "",
          },
        }
      );

      setBoard((current) => ({
        ...(current || {}),
        tasks: upsertById(
          current?.tasks || [],
          response.task || response
        ),
      }));

      setTaskForm(EMPTY_TASK);
      setSuccess("Task created and assigned.");
      void loadBoard({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The task could not be created."
      );
    } finally {
      setBusyKey("");
    }
  }

  async function saveResourceSettings(
    resource,
    values
  ) {
    const key = `resource:${resource.id}`;
    setBusyKey(key);
    setError("");
    setSuccess("");

    try {
      await Promise.all([
        apiRequest(
          `/resource-board/resources/${encodeURIComponent(
            resource.id
          )}/limit`,
          {
            method: "PATCH",
            body: {
              dailyLeadLimit:
                Number(
                  values.dailyLeadLimit
                ),
            },
          }
        ),
        apiRequest(
          `/resource-board/resources/${encodeURIComponent(
            resource.id
          )}/channels`,
          {
            method: "PATCH",
            body: {
              phoneNumber:
                values.phoneNumber || "",
              emailAccountId:
                values.emailAccountId || "",
            },
          }
        ),
      ]);

      setSuccess(
        `Settings saved for ${resource.name}.`
      );
      await loadBoard({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The resource settings could not be saved."
      );
    } finally {
      setBusyKey("");
    }
  }

  async function createResource(event) {
    event.preventDefault();

    setBusyKey("create-resource");
    setError("");
    setSuccess("");
    setCredentials(null);

    try {
      const response = await apiRequest(
        "/resource-board/resources",
        {
          method: "POST",
          body: {
            ...resourceForm,
            dailyLeadLimit:
              Number(
                resourceForm.dailyLeadLimit ||
                  100
              ),
          },
          timeoutMs: 30_000,
        }
      );

      setCredentials(response.credentials);
      setResourceForm(EMPTY_RESOURCE);
      setShowCreateResource(false);
      setSuccess(
        `${response.resource?.name || "Caller resource"} was created successfully.`
      );
      await loadBoard({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The caller resource could not be created."
      );
    } finally {
      setBusyKey("");
    }
  }

  function startDrag(event, payload) {
    setDragPayload(payload);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/x-reachfly-board",
      JSON.stringify(payload)
    );
    event.dataTransfer.setData(
      "text/plain",
      payload.id
    );
  }

  function readDropPayload(event) {
    try {
      const raw = event.dataTransfer.getData(
        "application/x-reachfly-board"
      );
      return raw
        ? JSON.parse(raw)
        : dragPayload;
    } catch {
      return dragPayload;
    }
  }

  function handleDrop(event, resourceId) {
    event.preventDefault();
    const payload = readDropPayload(event);

    if (!payload?.id) {
      return;
    }

    if (payload.type === "lead") {
      void moveLead(payload.id, resourceId);
    }

    if (payload.type === "task") {
      void moveTask(payload.id, resourceId);
    }
  }

  if (!canManage) {
    return null;
  }

  return (
    <main className="rf-resource-board-page">
      <header className="rf-resource-board-header">
        <div>
          <span className="eyebrow">
            Manager control center
          </span>
          <h1>
            Resource whiteboard
          </h1>
          <p>
            Assign leads and tasks by drag and drop, enforce caller capacity,
            connect email senders and phone numbers, and monitor progress in
            real time.
          </p>
        </div>

        <div className="rf-resource-board-header__actions">
          <Link
            to="/app/email"
            className="btn light"
          >
            Connect email
          </Link>
          <button
            type="button"
            className="btn light"
            onClick={() =>
              void loadBoard()
            }
            disabled={refreshing}
          >
            {refreshing
              ? "Refreshing…"
              : "Refresh"}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              setShowCreateResource(true)
            }
          >
            + New resource
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="success-banner">
          {success}
        </div>
      ) : null}

      {credentials ? (
        <CredentialsPanel
          credentials={credentials}
          onClose={() =>
            setCredentials(null)
          }
        />
      ) : null}

      <BoardSummary
        summary={board?.summary}
        loading={loading}
      />

      <nav className="rf-resource-board-tabs">
        {[
          ["leads", "Lead board"],
          ["tasks", "Task board"],
          ["resources", "Resources & channels"],
          ["activity", "Live activity"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={
              activeTab === value
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab(value)
            }
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="rf-resource-board-toolbar">
        <label className="rf-resource-board-search">
          <span>Search</span>
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search leads, callers, campaigns or tasks…"
          />
        </label>

        {activeTab === "leads" ? (
          <>
            <label>
              <span>Status</span>
              <select
                value={leadStatus}
                onChange={(event) =>
                  setLeadStatus(
                    event.target.value
                  )
                }
              >
                {LEAD_STATUSES.map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>Campaign</span>
              <select
                value={campaignId}
                onChange={(event) =>
                  setCampaignId(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All campaigns
                </option>
                {campaigns.map(
                  ([id, name]) => (
                    <option
                      key={id}
                      value={id}
                    >
                      {name}
                    </option>
                  )
                )}
              </select>
            </label>
          </>
        ) : null}

        <div className="rf-resource-board-live">
          <i />
          Live updates
          {refreshing
            ? " · syncing"
            : ""}
        </div>
      </section>

      {loading && !board ? (
        <BoardSkeleton />
      ) : null}

      {!loading || board ? (
        <>
          {activeTab === "leads" ? (
            <LeadBoard
              resources={resources}
              assignments={filteredAssignments}
              unassigned={unassignedLeads}
              busyKey={busyKey}
              onDragStart={startDrag}
              onDrop={handleDrop}
              onAssign={moveLead}
            />
          ) : null}

          {activeTab === "tasks" ? (
            <TaskBoard
              resources={resources}
              tasks={filteredTasks}
              assignments={assignments}
              form={taskForm}
              setForm={setTaskForm}
              busyKey={busyKey}
              onCreate={createTask}
              onDragStart={startDrag}
              onDrop={handleDrop}
              onAssign={moveTask}
              onStatus={updateTaskStatus}
            />
          ) : null}

          {activeTab === "resources" ? (
            <ResourcesPanel
              resources={resources}
              phoneNumbers={
                board?.phoneNumbers || []
              }
              emailAccounts={
                board?.emailAccounts || []
              }
              busyKey={busyKey}
              onSave={saveResourceSettings}
              onCreate={() =>
                setShowCreateResource(true)
              }
            />
          ) : null}

          {activeTab === "activity" ? (
            <ActivityPanel
              activity={board?.activity || []}
            />
          ) : null}
        </>
      ) : null}

      {showCreateResource ? (
        <CreateResourceDialog
          form={resourceForm}
          setForm={setResourceForm}
          phoneNumbers={
            board?.phoneNumbers || []
          }
          emailAccounts={
            board?.emailAccounts || []
          }
          busy={
            busyKey === "create-resource"
          }
          onSubmit={createResource}
          onClose={() => {
            setShowCreateResource(false);
            setResourceForm(EMPTY_RESOURCE);
          }}
        />
      ) : null}
    </main>
  );
}

function BoardSummary({ summary = {}, loading }) {
  const cards = [
    ["Caller resources", summary.resources || 0],
    ["Active leads", summary.activeLeads || 0],
    ["Unassigned", summary.unassignedLeads || 0],
    ["Open tasks", summary.openTasks || 0],
    ["Spare numbers", summary.sparePhoneNumbers || 0],
    ["Email accounts", summary.connectedEmailAccounts || 0],
  ];

  return (
    <section className="rf-resource-board-summary">
      {cards.map(([label, value]) => (
        <article key={label}>
          <strong>
            {loading ? "…" : value}
          </strong>
          <span>{label}</span>
        </article>
      ))}
    </section>
  );
}

function LeadBoard({
  resources,
  assignments,
  unassigned,
  busyKey,
  onDragStart,
  onDrop,
  onAssign,
}) {
  return (
    <section className="rf-whiteboard">
      <BoardLane
        title="Unassigned pool"
        subtitle={`${unassigned.length} leads waiting`}
        status="unassigned"
        onDrop={(event) =>
          onDrop(event, "")
        }
      >
        {unassigned.map((assignment) => (
          <LeadBoardCard
            key={assignment.id}
            assignment={assignment}
            resources={resources}
            busy={
              busyKey ===
              `lead:${assignment.id}`
            }
            onDragStart={onDragStart}
            onAssign={onAssign}
          />
        ))}

        {!unassigned.length ? (
          <LaneEmpty text="No unassigned leads" />
        ) : null}
      </BoardLane>

      {resources.map((resource) => {
        const leads = assignments.filter(
          (assignment) =>
            getAssigneeId(assignment) ===
            resource.id
        );

        return (
          <BoardLane
            key={resource.id}
            title={resource.name}
            subtitle={`${leads.length} shown · ${resource.activeLeadCount}/${resource.dailyLeadLimit} active`}
            resource={resource}
            overLimit={
              resource.activeLeadCount >=
              resource.dailyLeadLimit
            }
            onDrop={(event) =>
              onDrop(event, resource.id)
            }
          >
            {leads.map((assignment) => (
              <LeadBoardCard
                key={assignment.id}
                assignment={assignment}
                resources={resources}
                busy={
                  busyKey ===
                  `lead:${assignment.id}`
                }
                onDragStart={onDragStart}
                onAssign={onAssign}
              />
            ))}

            {!leads.length ? (
              <LaneEmpty text="Drop leads here" />
            ) : null}
          </BoardLane>
        );
      })}
    </section>
  );
}

function TaskBoard({
  resources,
  tasks,
  assignments,
  form,
  setForm,
  busyKey,
  onCreate,
  onDragStart,
  onDrop,
  onAssign,
  onStatus,
}) {
  const unassigned = tasks.filter(
    (task) => !getTaskAssigneeId(task)
  );

  return (
    <div className="rf-task-board-layout">
      <form
        className="rf-quick-task-form"
        onSubmit={onCreate}
      >
        <div>
          <span className="eyebrow">
            Quick assignment
          </span>
          <h2>Create a task</h2>
          <p>
            Assign a task to a caller and optionally connect it to a lead.
          </p>
        </div>

        <label>
          <span>Task title</span>
          <input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="Follow up with decision maker"
          />
        </label>

        <label>
          <span>Instructions</span>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description:
                  event.target.value,
              }))
            }
            placeholder="Add the expected result and important context"
          />
        </label>

        <div className="rf-quick-task-grid">
          <label>
            <span>Caller</span>
            <select
              value={form.assigneeId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  assigneeId:
                    event.target.value,
                }))
              }
            >
              <option value="">
                Select resource
              </option>
              {resources.map((resource) => (
                <option
                  key={resource.id}
                  value={resource.id}
                >
                  {resource.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Priority</span>
            <select
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority:
                    event.target.value,
                }))
              }
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>

          <label>
            <span>Due date</span>
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dueAt: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>Related lead</span>
            <select
              value={form.assignmentId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  assignmentId:
                    event.target.value,
                }))
              }
            >
              <option value="">
                No linked lead
              </option>
              {assignments.slice(0, 500).map(
                (assignment) => (
                  <option
                    key={assignment.id}
                    value={assignment.id}
                  >
                    {getLeadName(assignment)}
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <button
          type="submit"
          className="btn primary"
          disabled={busyKey === "create-task"}
        >
          {busyKey === "create-task"
            ? "Creating…"
            : "Create and assign task"}
        </button>
      </form>

      <section className="rf-whiteboard rf-whiteboard--tasks">
        <BoardLane
          title="Unassigned tasks"
          subtitle={`${unassigned.length} tasks`}
          onDrop={(event) =>
            onDrop(event, "")
          }
        >
          {unassigned.map((task) => (
            <TaskBoardCard
              key={task.id}
              task={task}
              resources={resources}
              busy={
                busyKey ===
                `task:${task.id}`
              }
              onDragStart={onDragStart}
              onAssign={onAssign}
              onStatus={onStatus}
            />
          ))}
          {!unassigned.length ? (
            <LaneEmpty text="No unassigned tasks" />
          ) : null}
        </BoardLane>

        {resources.map((resource) => {
          const resourceTasks = tasks.filter(
            (task) =>
              getTaskAssigneeId(task) ===
              resource.id
          );

          return (
            <BoardLane
              key={resource.id}
              title={resource.name}
              subtitle={`${resourceTasks.length} tasks · ${resource.completedTaskCount} completed`}
              resource={resource}
              onDrop={(event) =>
                onDrop(event, resource.id)
              }
            >
              {resourceTasks.map((task) => (
                <TaskBoardCard
                  key={task.id}
                  task={task}
                  resources={resources}
                  busy={
                    busyKey ===
                    `task:${task.id}`
                  }
                  onDragStart={onDragStart}
                  onAssign={onAssign}
                  onStatus={onStatus}
                />
              ))}
              {!resourceTasks.length ? (
                <LaneEmpty text="Drop tasks here" />
              ) : null}
            </BoardLane>
          );
        })}
      </section>
    </div>
  );
}

function BoardLane({
  title,
  subtitle,
  resource,
  overLimit,
  onDrop,
  children,
}) {
  const [over, setOver] = useState(false);

  return (
    <article
      className={`rf-board-lane ${
        over ? "is-over" : ""
      } ${
        overLimit ? "is-at-capacity" : ""
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        onDrop(event);
      }}
    >
      <header className="rf-board-lane__header">
        <div className="rf-board-lane__identity">
          {resource ? (
            <ResourceAvatar resource={resource} />
          ) : (
            <span className="rf-board-pool-icon">
              IN
            </span>
          )}
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
        </div>

        {resource ? (
          <PresenceBadge
            presence={resource.presence}
          />
        ) : null}
      </header>

      {resource ? (
        <div className="rf-resource-capacity">
          <span>
            <i
              style={{
                width: `${Math.min(
                  100,
                  resource.leadUtilizationPercent || 0
                )}%`,
              }}
            />
          </span>
          <small>
            {resource.remainingLeadCapacity} lead slots remaining
          </small>
        </div>
      ) : null}

      <div className="rf-board-lane__body">
        {children}
      </div>
    </article>
  );
}

function LeadBoardCard({
  assignment,
  resources,
  busy,
  onDragStart,
  onAssign,
}) {
  const lead = assignment.lead || {};

  return (
    <article
      className={`rf-board-card rf-board-card--lead ${
        busy ? "is-busy" : ""
      }`}
      draggable={!busy}
      onDragStart={(event) =>
        onDragStart(event, {
          type: "lead",
          id: assignment.id,
        })
      }
    >
      <div className="rf-board-card__top">
        <span className="rf-drag-handle">
          ⋮⋮
        </span>
        <StatusBadge
          status={assignment.status}
        />
      </div>

      <h4>{getLeadName(assignment)}</h4>
      <p>
        {lead.phone || lead.email || lead.website || "No contact details"}
      </p>

      <div className="rf-board-card__meta">
        <span>
          {assignment.campaignName || "No campaign"}
        </span>
        <span>
          {Number(assignment.callAttempts || 0)} calls
        </span>
      </div>

      <div className="rf-board-card__mobile-assign">
        <select
          value={getAssigneeId(assignment)}
          onChange={(event) =>
            void onAssign(
              assignment.id,
              event.target.value
            )
          }
          disabled={busy}
          aria-label={`Assign ${getLeadName(
            assignment
          )}`}
        >
          <option value="">Unassigned</option>
          {resources.map((resource) => (
            <option
              key={resource.id}
              value={resource.id}
              disabled={
                resource.activeLeadCount >=
                  resource.dailyLeadLimit &&
                getAssigneeId(assignment) !==
                  resource.id
              }
            >
              {resource.name} ({resource.activeLeadCount}/{resource.dailyLeadLimit})
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}

function TaskBoardCard({
  task,
  resources,
  busy,
  onDragStart,
  onAssign,
  onStatus,
}) {
  return (
    <article
      className={`rf-board-card rf-board-card--task priority-${
        task.priority || "normal"
      } ${busy ? "is-busy" : ""}`}
      draggable={!busy}
      onDragStart={(event) =>
        onDragStart(event, {
          type: "task",
          id: task.id,
        })
      }
    >
      <div className="rf-board-card__top">
        <span className="rf-drag-handle">
          ⋮⋮
        </span>
        <StatusBadge status={task.status} />
      </div>

      <h4>{task.title}</h4>
      <p>
        {task.description || "No instructions provided."}
      </p>

      {task.lead ? (
        <div className="rf-task-linked-lead">
          Lead: {task.lead.business || task.lead.name || task.lead.phone}
        </div>
      ) : null}

      <div className="rf-board-card__meta">
        <span>{formatLabel(task.priority)}</span>
        <span>
          {task.dueAt
            ? `Due ${formatDateTime(task.dueAt)}`
            : "No due date"}
        </span>
      </div>

      <div className="rf-board-card__controls">
        <select
          value={getTaskAssigneeId(task)}
          onChange={(event) =>
            void onAssign(
              task.id,
              event.target.value
            )
          }
          disabled={busy}
          aria-label={`Assign ${task.title}`}
        >
          <option value="">Unassigned</option>
          {resources.map((resource) => (
            <option
              key={resource.id}
              value={resource.id}
            >
              {resource.name}
            </option>
          ))}
        </select>

        <select
          value={normalizeStatus(task.status || "assigned")}
          onChange={(event) =>
            void onStatus(
              task,
              event.target.value
            )
          }
          disabled={busy}
          aria-label={`Update status for ${task.title}`}
        >
          {TASK_STATUSES.map((status) => (
            <option
              key={status}
              value={status}
            >
              {formatLabel(status)}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}

function ResourcesPanel({
  resources,
  phoneNumbers,
  emailAccounts,
  busyKey,
  onSave,
  onCreate,
}) {
  return (
    <section className="rf-resources-panel">
      <header>
        <div>
          <span className="eyebrow">
            Resource administration
          </span>
          <h2>
            Capacity, email and phone assignments
          </h2>
          <p>
            Each Telnyx number can be assigned to only one caller. Email
            accounts shown here are connected through the Email setup page.
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={onCreate}
        >
          + Create caller
        </button>
      </header>

      <div className="rf-resource-settings-grid">
        {resources.map((resource) => (
          <ResourceSettingsCard
            key={resource.id}
            resource={resource}
            phoneNumbers={phoneNumbers}
            emailAccounts={emailAccounts}
            busy={
              busyKey ===
              `resource:${resource.id}`
            }
            onSave={onSave}
          />
        ))}
      </div>
    </section>
  );
}

function ResourceSettingsCard({
  resource,
  phoneNumbers,
  emailAccounts,
  busy,
  onSave,
}) {
  const [values, setValues] = useState({
    dailyLeadLimit:
      resource.dailyLeadLimit || 100,
    phoneNumber:
      resource.phoneNumber || "",
    emailAccountId:
      resource.emailAccountId || "",
  });

  useEffect(() => {
    setValues({
      dailyLeadLimit:
        resource.dailyLeadLimit || 100,
      phoneNumber:
        resource.phoneNumber || "",
      emailAccountId:
        resource.emailAccountId || "",
    });
  }, [
    resource.dailyLeadLimit,
    resource.emailAccountId,
    resource.phoneNumber,
  ]);

  return (
    <article className="rf-resource-settings-card">
      <header>
        <ResourceAvatar resource={resource} />
        <div>
          <h3>{resource.name}</h3>
          <p>{resource.email}</p>
        </div>
        <PresenceBadge
          presence={resource.presence}
        />
      </header>

      <div className="rf-resource-performance">
        <div>
          <strong>
            {resource.activeLeadCount}
          </strong>
          <span>Active leads</span>
        </div>
        <div>
          <strong>
            {resource.completedLeadCount}
          </strong>
          <span>Completed</span>
        </div>
        <div>
          <strong>
            {resource.openTaskCount}
          </strong>
          <span>Open tasks</span>
        </div>
      </div>

      <label>
        <span>Maximum active leads</span>
        <input
          type="number"
          min="1"
          max="5000"
          value={values.dailyLeadLimit}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              dailyLeadLimit:
                event.target.value,
            }))
          }
        />
      </label>

      <label>
        <span>Telnyx caller number</span>
        <select
          value={values.phoneNumber}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              phoneNumber:
                event.target.value,
            }))
          }
        >
          <option value="">
            No number assigned
          </option>
          {phoneNumbers.map((item) => (
            <option
              key={item.number}
              value={item.number}
              disabled={
                Boolean(item.assignedTo) &&
                item.assignedTo !== resource.id
              }
            >
              {item.number}
              {item.assignedTo &&
              item.assignedTo !== resource.id
                ? ` — ${item.assignedToName}`
                : item.spare
                  ? " — Spare"
                  : " — Current"}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Connected email sender</span>
        <select
          value={values.emailAccountId}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              emailAccountId:
                event.target.value,
            }))
          }
        >
          <option value="">
            No sender assigned
          </option>
          {emailAccounts.map((account) => (
            <option
              key={account.id}
              value={account.id}
            >
              {account.label || account.fromEmail} — {account.fromEmail}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="btn primary full"
        disabled={busy}
        onClick={() =>
          void onSave(resource, values)
        }
      >
        {busy
          ? "Saving…"
          : "Save resource settings"}
      </button>
    </article>
  );
}

function CreateResourceDialog({
  form,
  setForm,
  phoneNumbers,
  emailAccounts,
  busy,
  onSubmit,
  onClose,
}) {
  return (
    <div
      className="rf-resource-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        className="rf-resource-dialog"
        onSubmit={onSubmit}
      >
        <header>
          <div>
            <span className="eyebrow">
              New login resource
            </span>
            <h2>Create a caller account</h2>
            <p>
              The temporary password is returned once after creation. Share it
              securely and ask the caller to change it after signing in.
            </p>
          </div>
          <button
            type="button"
            className="rf-dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="rf-resource-dialog-grid">
          <label>
            <span>Full name</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="AH Growth Caller 9"
              required
            />
          </label>

          <label>
            <span>Login email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="caller9@company.com"
              required
            />
          </label>

          <label>
            <span>Temporary password</span>
            <input
              type="password"
              minLength="10"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              autoComplete="new-password"
              placeholder="At least 10 characters"
              required
            />
          </label>

          <label>
            <span>Lead capacity</span>
            <input
              type="number"
              min="1"
              max="5000"
              value={form.dailyLeadLimit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dailyLeadLimit:
                    event.target.value,
                }))
              }
              required
            />
          </label>

          <label>
            <span>Job title</span>
            <input
              value={form.jobTitle}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  jobTitle:
                    event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>Department</span>
            <input
              value={form.department}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  department:
                    event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>Spare phone number</span>
            <select
              value={form.phoneNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  phoneNumber:
                    event.target.value,
                }))
              }
            >
              <option value="">
                Assign later
              </option>
              {phoneNumbers
                .filter((item) => item.spare)
                .map((item) => (
                  <option
                    key={item.number}
                    value={item.number}
                  >
                    {item.number}
                  </option>
                ))}
            </select>
          </label>

          <label>
            <span>Email sender</span>
            <select
              value={form.emailAccountId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  emailAccountId:
                    event.target.value,
                }))
              }
            >
              <option value="">
                Assign later
              </option>
              {emailAccounts.map((account) => (
                <option
                  key={account.id}
                  value={account.id}
                >
                  {account.fromEmail}
                </option>
              ))}
            </select>
          </label>
        </div>

        <footer>
          <button
            type="button"
            className="btn light"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={busy}
          >
            {busy
              ? "Creating resource…"
              : "Create login resource"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function CredentialsPanel({
  credentials,
  onClose,
}) {
  async function copy(value) {
    try {
      await navigator.clipboard.writeText(
        String(value || "")
      );
    } catch {
      // Clipboard availability varies by browser policy.
    }
  }

  return (
    <section className="rf-credentials-panel">
      <div>
        <span className="eyebrow">
          One-time credentials
        </span>
        <h2>Caller login created</h2>
        <p>
          Copy these credentials now. The password is not stored in readable
          form and will not be shown again after this message is closed.
        </p>
      </div>

      <label>
        <span>Email</span>
        <code>{credentials.email}</code>
        <button
          type="button"
          onClick={() =>
            void copy(credentials.email)
          }
        >
          Copy
        </button>
      </label>

      <label>
        <span>Temporary password</span>
        <code>
          {credentials.temporaryPassword}
        </code>
        <button
          type="button"
          onClick={() =>
            void copy(
              credentials.temporaryPassword
            )
          }
        >
          Copy
        </button>
      </label>

      <button
        type="button"
        className="rf-credentials-close"
        onClick={onClose}
      >
        I saved the credentials
      </button>
    </section>
  );
}

function ActivityPanel({ activity }) {
  return (
    <section className="rf-activity-panel">
      <header>
        <span className="eyebrow">
          Workspace audit trail
        </span>
        <h2>Recent board activity</h2>
      </header>

      <div className="rf-activity-list">
        {activity.map((item) => (
          <article key={item.id}>
            <span className="rf-activity-icon">
              {activityIcon(item.type)}
            </span>
            <div>
              <strong>{item.title}</strong>
              <small>
                {item.actorName
                  ? `${item.actorName} · `
                  : ""}
                {formatDateTime(item.createdAt)}
              </small>
            </div>
          </article>
        ))}

        {!activity.length ? (
          <LaneEmpty text="No board activity recorded yet" />
        ) : null}
      </div>
    </section>
  );
}

function ResourceAvatar({ resource }) {
  if (resource.avatarUrl) {
    return (
      <img
        className="rf-resource-avatar"
        src={resource.avatarUrl}
        alt=""
      />
    );
  }

  return (
    <span className="rf-resource-avatar">
      {initials(resource.name)}
    </span>
  );
}

function PresenceBadge({ presence = {} }) {
  const status = normalizeStatus(
    presence.status || "offline"
  );

  return (
    <span
      className={`rf-presence-badge ${status}`}
      title={
        presence.lastSeenAt
          ? `Last seen ${formatDateTime(
              presence.lastSeenAt
            )}`
          : status
      }
    >
      <i />
      {status === "online" ||
      status === "available"
        ? "Online"
        : formatLabel(status)}
    </span>
  );
}

function StatusBadge({ status }) {
  const normalized = normalizeStatus(
    status || "assigned"
  );

  return (
    <span
      className={`rf-board-status ${normalized}`}
    >
      {formatLabel(normalized)}
    </span>
  );
}

function LaneEmpty({ text }) {
  return (
    <div className="rf-lane-empty">
      <span>+</span>
      <p>{text}</p>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <section className="rf-whiteboard rf-board-skeleton">
      {[0, 1, 2, 3].map((item) => (
        <article
          key={item}
          className="rf-board-lane"
        >
          <header />
          <div />
          <div />
          <div />
        </article>
      ))}
    </section>
  );
}

function replaceBoardAssignment(board, assignment) {
  if (!board || !assignment) {
    return board;
  }

  return {
    ...board,
    assignments: upsertById(
      board.assignments || [],
      assignment
    ),
  };
}

function replaceBoardTask(board, task) {
  if (!board || !task) {
    return board;
  }

  return {
    ...board,
    tasks: upsertById(
      board.tasks || [],
      task
    ),
  };
}

function upsertById(items, item) {
  if (!item?.id) {
    return items;
  }

  const exists = items.some(
    (current) => current.id === item.id
  );

  return exists
    ? items.map((current) =>
        current.id === item.id
          ? {
              ...current,
              ...item,
            }
          : current
      )
    : [item, ...items];
}

function readBoardCache(userId) {
  if (!userId || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(
      `${BOARD_CACHE_KEY}:${userId}`
    );
    const parsed = raw ? JSON.parse(raw) : null;

    if (
      !parsed?.board ||
      Date.now() - Number(parsed.savedAt || 0) >
        BOARD_CACHE_TTL_MS
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeBoardCache(userId, board) {
  if (!userId || typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${BOARD_CACHE_KEY}:${userId}`,
      JSON.stringify({
        board,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Cache errors must not block the manager board.
  }
}

function getAssigneeId(assignment) {
  return String(
    assignment.assigneeId ||
      assignment.assignedTo ||
      assignment.assignedToUserId ||
      ""
  );
}

function getTaskAssigneeId(task) {
  return String(
    task.assigneeId ||
      task.assignedToUserId ||
      ""
  );
}

function getLeadName(assignment) {
  const lead = assignment?.lead || {};
  return (
    lead.business ||
    lead.name ||
    lead.phone ||
    lead.email ||
    "Unnamed lead"
  );
}

function normalizeRole(value) {
  const role = normalizeStatus(value);
  if (role.includes("owner")) return "owner";
  if (role.includes("admin")) return "admin";
  if (role.includes("manager")) return "manager";
  if (
    role === "caller" ||
    role.includes("cold_caller") ||
    role.includes("sales_rep") ||
    role.includes("telemarketer")
  ) {
    return "caller";
  }
  return role || "caller";
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function formatLabel(value) {
  return String(value || "Unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function initials(value) {
  return String(value || "RF")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function activityIcon(type) {
  if (String(type).includes("lead")) return "LD";
  if (String(type).includes("task")) return "TK";
  if (String(type).includes("channel")) return "CH";
  if (String(type).includes("limit")) return "LM";
  if (String(type).includes("resource")) return "RS";
  return "UP";
}
