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
  useSearchParams,
} from "react-router-dom";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  apiRequest,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import "../styles.css";

const BOARD_CACHE_KEY =
  "reachfly:manager-resource-board:v2";
const BOARD_CACHE_TTL_MS = 5 * 60 * 1000;
const VISIBILITY_REFRESH_MIN_MS = 60_000;
const SOCKET_REFRESH_DEBOUNCE_MS = 250;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCacheRef = useRef(
    readBoardCache(user)
  );
  const refreshTimerRef = useRef(null);
  const loadPromiseRef = useRef(null);
  const mountedRef = useRef(false);
  const initialLoadStartedRef = useRef(false);
  const lastLoadedAtRef = useRef(
    Number(initialCacheRef.current?.savedAt || 0)
  );

  const [board, setBoard] = useState(
    () => initialCacheRef.current?.board || null
  );
  const [activeTab, setActiveTab] = useState(
    () => normalizeBoardTab(searchParams.get("tab")) || "leads"
  );
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

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      window.clearTimeout(
        refreshTimerRef.current
      );
    };
  }, []);

  useEffect(() => {
    const requestedTab = normalizeBoardTab(
      searchParams.get("tab")
    );

    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [activeTab, searchParams]);

  const selectTab = useCallback(
    (value) => {
      const nextTab = normalizeBoardTab(value) || "leads";
      setActiveTab(nextTab);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", nextTab);
      setSearchParams(nextParams, {
        replace: true,
      });
    },
    [searchParams, setSearchParams]
  );

  const loadBoard = useCallback(
    async ({
      silent = false,
      showIndicator = !silent,
      force = false,
      reportError = !silent,
    } = {}) => {
      if (!user?.id) {
        return null;
      }

      /*
       * Reuse the active request. This prevents socket events,
       * visibility changes and button clicks from starting multiple
       * overlapping board requests.
       */
      if (
        loadPromiseRef.current &&
        !force
      ) {
        return loadPromiseRef.current;
      }

      if (!silent) {
        setLoading(true);
      }

      if (showIndicator) {
        setRefreshing(true);
      }

      if (reportError) {
        setError("");
      }

      const requestPromise =
        (async () => {
          try {
            const response =
              await apiRequest(
                "/resource-board",
                {
                  timeoutMs: 15_000,
                }
              );

            if (!mountedRef.current) {
              return response;
            }

            setBoard(response);
            lastLoadedAtRef.current =
              Date.now();
            writeBoardCache(
              user,
              response
            );

            return response;
          } catch (requestError) {
            if (
              mountedRef.current &&
              reportError
            ) {
              setError(
                requestError?.message ||
                  "The manager resource board could not be loaded."
              );
            }

            return null;
          } finally {
            if (mountedRef.current) {
              if (!silent) {
                setLoading(false);
              }

              if (showIndicator) {
                setRefreshing(false);
              }
            }
          }
        })();

      loadPromiseRef.current =
        requestPromise;

      try {
        return await requestPromise;
      } finally {
        if (
          loadPromiseRef.current ===
          requestPromise
        ) {
          loadPromiseRef.current = null;
        }
      }
    },
    [
      user?.id,
      user?.workspaceId,
      user?.workspace?.id,
      user?.workspaceSlug,
      user?.companyId,
    ]
  );

  /*
   * Load once when the manager opens the page. The previous version
   * depended on `board`; every successful request changed `board`,
   * which ran this effect again and created a continuous refresh loop.
   */
  useEffect(() => {
    if (!canManage) {
      navigate("/app/dashboard", {
        replace: true,
      });
      return undefined;
    }

    if (!initialLoadStartedRef.current) {
      initialLoadStartedRef.current =
        true;

      void loadBoard({
        silent: Boolean(
          initialCacheRef.current?.board
        ),
        showIndicator: false,
        reportError: true,
      });
    }

    /*
     * Refresh stale data when the user returns to the browser tab.
     * This updates React state only; it never reloads the page.
     */
    const onVisibilityChange = () => {
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      const age =
        Date.now() -
        lastLoadedAtRef.current;

      if (
        age <
        VISIBILITY_REFRESH_MIN_MS
      ) {
        return;
      }

      void loadBoard({
        silent: true,
        showIndicator: false,
        reportError: false,
      });
    };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
    };
  }, [
    canManage,
    loadBoard,
    navigate,
  ]);

  /*
   * Socket events keep the board current without polling or refreshing
   * the browser page. Closely spaced events are combined into one fetch.
   */
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
          void loadBoard({
            silent: true,
            showIndicator: false,
            reportError: false,
          });
        }, SOCKET_REFRESH_DEBOUNCE_MS);
    };

    const events = [
      "resource-board:updated",
      "resource-board:lead-updated",
      "resource-board:resource-updated",
      "lead:updated",
      "lead:assignment-updated",
      "lead:call-updated",
      "team:task-created",
      "team:task-updated",
      "team:task-deleted",
      "team:callback-updated",
      "telnyx-ai-agent:call-updated",
      "telnyx-ai-agent:meeting-booked",
      "presence:update",
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
      (Array.isArray(board?.tasks)
        ? board.tasks
        : []
      ).map(normalizeBoardTask),
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

    const visible = !query
      ? tasks
      : tasks.filter((task) =>
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

    return [...visible].sort(compareTasks);
  }, [search, tasks]);

  const followUps = useMemo(
    () =>
      buildFollowUpTimeline({
        assignments,
        tasks,
        search,
      }),
    [assignments, search, tasks]
  );

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

      const successMessage =
        resourceId
          ? `Lead assigned to ${
              resource?.name || "the selected caller"
            }.`
          : "Lead moved to the unassigned pool.";

      setSuccess(
        successMessage
      );

      notifyResourceBoard(
        "success",
        "Lead assignment updated",
        successMessage
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

      const successMessage =
        resourceId
          ? "Task reassigned successfully."
          : "Task moved to the unassigned pool.";

      setSuccess(
        successMessage
      );

      notifyResourceBoard(
        "success",
        "Task assignment updated",
        successMessage
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
          normalizeBoardTask(
            response.task || response
          )
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
            dueAt: toIsoOrNull(
              taskForm.dueAt
            ),
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
          normalizeBoardTask(
            response.task || response
          )
        ),
      }));

      setTaskForm(EMPTY_TASK);
      setSuccess("Task created and assigned.");
      notifyResourceBoard(
        "success",
        "Task created",
        "Task created and assigned."
      );
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

      const successMessage =
        `Settings saved for ${resource.name}.`;

      setSuccess(
        successMessage
      );

      notifyResourceBoard(
        "success",
        "Resource settings saved",
        successMessage
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
      const successMessage =
        `${response.resource?.name || "Caller resource"} was created successfully.`;

      setSuccess(
        successMessage
      );

      notifyResourceBoard(
        "success",
        "Caller resource created",
        successMessage
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
      const assignment = assignments.find(
        (item) => item.id === payload.id
      );

      const target = resources.find(
        (item) => item.id === resourceId
      );

      const movingToNewResource =
        Boolean(resourceId) &&
        getAssigneeId(assignment) !== resourceId;

      if (
        target &&
        movingToNewResource &&
        Number(target.activeLeadCount || 0) >=
          Number(target.dailyLeadLimit || 0)
      ) {
        setError(
          `${target.name || "This caller"} is at lead capacity. Increase the capacity or choose another caller.`
        );
        setDragPayload(null);
        return;
      }

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
    <main className="rf-resource-board-page rf-resource-board-v7">
      <ManagerResourceBoardV7Styles />
      <header className="rf-resource-board-header">
        <div>
          <span className="eyebrow">
            Resource operations
          </span>
          <h1>
            Team resource board
          </h1>
          <p>
            Assign leads and tasks, manage caller capacity, connect approved channels, and monitor team progress from one operational board. Use the performance and sales views for deeper reporting.
          </p>
        </div>

        <div className="rf-resource-board-header__actions">
          <Link
            to="/app/team-performance"
            className="btn light"
          >
            Team performance
          </Link>

          <Link
            to="/app/sales-operations"
            className="btn light"
          >
            Sales operations
          </Link>

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
              void loadBoard({
                silent: true,
                showIndicator: true,
                force: true,
                reportError: true,
              })
            }
            disabled={
              loading || refreshing
            }
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
          {safeResourceBoardMessage(error)}
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
        followUps={followUps}
      />

      <nav className="rf-resource-board-tabs">
        {[
          ["leads", "Lead board"],
          ["tasks", "Task board"],
          ["follow-ups", "Follow-ups"],
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
              selectTab(value)
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

          {activeTab === "follow-ups" ? (
            <FollowUpPanel
              items={followUps}
              onOpenTasks={() =>
                selectTab("tasks")
              }
              onOpenLeads={() =>
                selectTab("leads")
              }
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

function BoardSummary({
  summary = {},
  loading,
  followUps = [],
}) {
  const dueFollowUps = followUps.filter(
    (item) =>
      item.overdue ||
      isWithinHours(item.dueAt, 24)
  ).length;

  const cards = [
    ["Caller resources", summary.resources || 0],
    ["Active leads", summary.activeLeads || 0],
    ["Unassigned", summary.unassignedLeads || 0],
    ["Open tasks", summary.openTasks || 0],
    ["Follow-ups due", dueFollowUps],
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
  const dueAt = getTaskDueAt(task);
  const overdue = isTaskOverdue(task);

  return (
    <article
      className={`rf-board-card rf-board-card--task priority-${
        task.priority || "normal"
      } ${overdue ? "is-overdue" : ""} ${
        busy ? "is-busy" : ""
      }`}
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
          {dueAt
            ? overdue
              ? `Overdue · ${formatDateTime(dueAt)}`
              : `Due ${formatDateTime(dueAt)}`
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
            Each business calling number can be assigned to only one caller.
            Email accounts shown here are connected through the Email setup page.
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
          <p>
            {resource.jobTitle ||
              formatLabel(
                resource.workspaceRole ||
                  resource.role ||
                  "caller"
              )}
            {resource.email
              ? ` · ${resource.email}`
              : ""}
          </p>
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
        <span>Business calling number</span>
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
      normalizeBoardTask(task)
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

function readBoardCache(user) {
  const cacheKey = getBoardCacheKey(user);

  if (!cacheKey || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
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

function writeBoardCache(user, board) {
  const cacheKey = getBoardCacheKey(user);

  if (!cacheKey || typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        board,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Cache errors must not block the manager board.
  }
}

function getBoardCacheKey(user) {
  const userId = String(user?.id || "").trim();
  const workspaceId = String(
    user?.workspaceId ||
      user?.workspace?.id ||
      user?.companyId ||
      user?.workspaceSlug ||
      "default"
  ).trim();

  return userId
    ? `${BOARD_CACHE_KEY}:${workspaceId}:${userId}`
    : "";
}

function getAssigneeId(assignment) {
  return String(
    assignment?.assigneeId ||
      assignment?.assignedTo ||
      assignment?.assignedToUserId ||
      assignment?.assignedResourceId ||
      assignment?.resourceId ||
      ""
  );
}

function getTaskAssigneeId(task) {
  return String(
    task?.assigneeId ||
      task?.assignedToUserId ||
      task?.assignedTo ||
      task?.assignedToId ||
      task?.resourceId ||
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

function normalizeBoardTab(value) {
  const tab = normalizeStatus(value);

  return [
    "leads",
    "tasks",
    "follow_ups",
    "resources",
    "activity",
  ].includes(tab)
    ? tab === "follow_ups"
      ? "follow-ups"
      : tab
    : value === "follow-ups"
      ? "follow-ups"
      : "";
}

function normalizeBoardTask(task = {}) {
  return {
    ...task,
    assigneeId: getTaskAssigneeId(task),
    dueAt: getTaskDueAt(task),
  };
}

function getTaskDueAt(task = {}) {
  return (
    task.dueAt ||
    task.dueDate ||
    task.scheduledAt ||
    task.nextActionAt ||
    task.callbackAt ||
    ""
  );
}

function getAssignmentNextActionAt(assignment = {}) {
  const lead = assignment.lead || {};

  return (
    assignment.nextActionAt ||
    assignment.callbackAt ||
    assignment.followUpAt ||
    assignment.scheduledAt ||
    assignment.nextAction?.at ||
    lead.nextActionAt ||
    lead.callbackAt ||
    lead.followUpAt ||
    ""
  );
}

function isTaskTerminal(task = {}) {
  return [
    "completed",
    "cancelled",
    "canceled",
    "closed",
  ].includes(normalizeStatus(task.status));
}

function isTaskOverdue(task = {}) {
  if (isTaskTerminal(task)) {
    return false;
  }

  const dueAt = getTaskDueAt(task);
  if (!dueAt) {
    return false;
  }

  const timestamp = new Date(dueAt).getTime();

  return (
    Number.isFinite(timestamp) &&
    timestamp < Date.now()
  );
}

function compareTasks(left, right) {
  const leftTerminal = isTaskTerminal(left);
  const rightTerminal = isTaskTerminal(right);

  if (leftTerminal !== rightTerminal) {
    return leftTerminal ? 1 : -1;
  }

  const leftOverdue = isTaskOverdue(left);
  const rightOverdue = isTaskOverdue(right);

  if (leftOverdue !== rightOverdue) {
    return leftOverdue ? -1 : 1;
  }

  const leftTime = toTimestamp(getTaskDueAt(left));
  const rightTime = toTimestamp(getTaskDueAt(right));

  if (leftTime !== rightTime) {
    if (!leftTime) return 1;
    if (!rightTime) return -1;
    return leftTime - rightTime;
  }

  return priorityRank(right.priority) - priorityRank(left.priority);
}

function buildFollowUpTimeline({
  assignments = [],
  tasks = [],
  search = "",
}) {
  const query = String(search || "")
    .trim()
    .toLowerCase();

  const assignmentItems = assignments
    .map((assignment) => {
      const dueAt = getAssignmentNextActionAt(assignment);

      if (!dueAt) {
        return null;
      }

      const status = normalizeStatus(
        assignment.status ||
          assignment.lead?.status
      );

      if (
        [
          "completed",
          "cancelled",
          "canceled",
          "closed",
        ].includes(status)
      ) {
        return null;
      }

      return {
        id: `lead:${assignment.id}`,
        type: "lead",
        sourceId: assignment.id,
        title: getLeadName(assignment),
        detail:
          assignment.nextActionLabel ||
          assignment.nextAction?.label ||
          assignment.nextActionType ||
          "Lead follow-up",
        assignee:
          assignment.assignedToName ||
          assignment.assigneeName ||
          "",
        dueAt,
        status:
          assignment.status ||
          assignment.lead?.status ||
          "follow_up",
      };
    })
    .filter(Boolean);

  const taskItems = tasks
    .filter((task) => {
      if (isTaskTerminal(task)) {
        return false;
      }

      return Boolean(getTaskDueAt(task));
    })
    .map((task) => ({
      id: `task:${task.id}`,
      type: "task",
      sourceId: task.id,
      title: task.title || "Task",
      detail:
        task.lead?.business ||
        task.lead?.name ||
        task.description ||
        "Task deadline",
      assignee:
        task.assigneeName ||
        task.assignedToName ||
        "",
      dueAt: getTaskDueAt(task),
      status: task.status || "assigned",
    }));

  return [...assignmentItems, ...taskItems]
    .filter((item) => {
      if (!query) {
        return true;
      }

      return [
        item.title,
        item.detail,
        item.assignee,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .map((item) => ({
      ...item,
      overdue:
        toTimestamp(item.dueAt) > 0 &&
        toTimestamp(item.dueAt) < Date.now(),
    }))
    .sort((left, right) => {
      if (left.overdue !== right.overdue) {
        return left.overdue ? -1 : 1;
      }

      return (
        toTimestamp(left.dueAt) -
        toTimestamp(right.dueAt)
      );
    });
}

function FollowUpPanel({
  items,
  onOpenTasks,
  onOpenLeads,
}) {
  return (
    <section className="rf-activity-panel">
      <header>
        <div>
          <span className="eyebrow">
            Follow-up timeline
          </span>
          <h2>Callbacks, next actions and deadlines</h2>
          <p>
            Upcoming lead actions and open task deadlines are shown together so
            managers can spot overdue work without losing the original lead or
            task context.
          </p>
        </div>
        <div className="rf-resource-board-header__actions">
          <button
            type="button"
            className="btn light"
            onClick={onOpenLeads}
          >
            Open lead board
          </button>
          <button
            type="button"
            className="btn light"
            onClick={onOpenTasks}
          >
            Open task board
          </button>
        </div>
      </header>

      <div className="rf-activity-list">
        {items.slice(0, 100).map((item) => (
          <article key={item.id}>
            <span className="rf-activity-icon">
              {item.type === "lead" ? "CB" : "TK"}
            </span>

            <div>
              <strong>{item.title}</strong>
              <small>
                {item.detail}
                {item.assignee
                  ? ` · ${item.assignee}`
                  : ""}
                {" · "}
                {item.overdue ? "Overdue " : ""}
                {formatDateTime(item.dueAt)}
              </small>
            </div>

            <StatusBadge
              status={
                item.overdue
                  ? "overdue"
                  : item.status
              }
            />
          </article>
        ))}

        {!items.length ? (
          <LaneEmpty text="No scheduled follow-ups or task deadlines" />
        ) : null}
      </div>
    </section>
  );
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : 0;
}

function isWithinHours(value, hours) {
  const timestamp = toTimestamp(value);

  if (!timestamp) {
    return false;
  }

  const delta = timestamp - Date.now();

  return (
    delta >= 0 &&
    delta <= Number(hours || 0) * 60 * 60 * 1000
  );
}

function priorityRank(value) {
  return {
    urgent: 4,
    high: 3,
    normal: 2,
    medium: 2,
    low: 1,
  }[normalizeStatus(value)] || 0;
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

function safeResourceBoardMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection");
}

function notifyResourceBoard(
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

function ManagerResourceBoardV7Styles() {
  return (
    <style>{`
      .rf-resource-board-v7{
        --rfrb-card:#fff;
        --rfrb-soft:#f6f7f8;
        --rfrb-text:#191c1d;
        --rfrb-text2:#4d4c59;
        --rfrb-muted:#777784;
        --rfrb-line:#e2e4e7;
        --rfrb-primary:#4648d4;
        --rfrb-primary-dark:#393bbb;
        --rfrb-primary-soft:#e8e9ff;
        --rfrb-violet:#6b38d4;
        --rfrb-violet-soft:#f1ebff;
        --rfrb-green:#087a51;
        --rfrb-green-soft:#e4f7ee;
        --rfrb-red:#ba1a1a;
        --rfrb-red-soft:#ffedeb;
        --rfrb-amber:#9a5b00;
        --rfrb-amber-soft:#fff3d8;
        --rfrb-dark:#2e3132;
        --rfrb-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfrb-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfrbPageIn .24s var(--rfrb-ease);
      }

      .rf-resource-board-v7 *,
      .rf-resource-board-v7 *::before,
      .rf-resource-board-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfrbPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfrbLive{
        0%,100%{opacity:.35}
        50%{opacity:1}
      }

      .rf-resource-board-v7 .rf-resource-board-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:17px;
      }

      .rf-resource-board-v7 .rf-resource-board-header > div:first-child{
        min-width:0;
      }

      .rf-resource-board-v7 .eyebrow{
        display:block;
        margin:0 0 4px;
        color:var(--rfrb-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rf-resource-board-v7 .rf-resource-board-header h1{
        margin:0;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-resource-board-v7 .rf-resource-board-header p{
        max-width:780px;
        margin:5px 0 0;
        color:var(--rfrb-text2);
        font-size:12px;
        line-height:18px;
      }

      .rf-resource-board-v7 .rf-resource-board-header__actions{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:flex-end;
        gap:7px;
      }

      .rf-resource-board-v7 .btn{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 11px;
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        text-decoration:none;
        font:700 7px/1 Inter,sans-serif;
        transition:.14s var(--rfrb-ease);
      }

      .rf-resource-board-v7 .btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-resource-board-v7 .btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-resource-board-v7 .btn.primary{
        color:#fff;
        background:var(--rfrb-primary);
        border-color:var(--rfrb-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rf-resource-board-v7 .btn.primary:hover:not(:disabled){
        background:var(--rfrb-primary-dark);
      }

      .rf-resource-board-v7 .btn.light{
        color:var(--rfrb-text);
        background:#fff;
        border-color:var(--rfrb-line);
      }

      .rf-resource-board-v7 .btn.full{
        width:100%;
      }

      .rf-resource-board-v7 .error-banner,
      .rf-resource-board-v7 .success-banner{
        padding:10px 12px;
        margin-bottom:11px;
        border:1px solid;
        border-radius:9px;
        font-size:7px;
        line-height:12px;
      }

      .rf-resource-board-v7 .error-banner{
        color:#7c1d1d;
        background:var(--rfrb-red-soft);
        border-color:#ffd0cc;
      }

      .rf-resource-board-v7 .success-banner{
        color:#086846;
        background:var(--rfrb-green-soft);
        border-color:#caeadb;
      }

      .rf-resource-board-v7 .rf-credentials-panel{
        position:relative;
        display:grid;
        grid-template-columns:42px minmax(0,1fr) auto;
        align-items:start;
        gap:10px;
        padding:13px;
        margin-bottom:11px;
        color:#fff;
        background:
          radial-gradient(circle at 90% 10%,rgba(99,102,241,.22),transparent 32%),
          #2e3132;
        border:1px solid rgba(255,255,255,.08);
        border-radius:11px;
      }

      .rf-resource-board-v7 .rf-credentials-close{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        padding:0;
        color:#fff;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.08);
        border-radius:7px;
        cursor:pointer;
      }

      .rf-resource-board-v7 .rf-resource-board-summary{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:9px;
        margin-bottom:11px;
      }

      .rf-resource-board-v7 .rf-resource-board-summary > article,
      .rf-resource-board-v7 .rf-resource-board-summary > div{
        min-height:110px;
        display:grid;
        align-content:end;
        padding:13px;
        background:#fff;
        border:1px solid var(--rfrb-line);
        border-radius:10px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-resource-board-v7 .rf-resource-board-summary strong{
        font:600 23px/28px Geist,Inter,sans-serif;
      }

      .rf-resource-board-v7 .rf-resource-board-summary span,
      .rf-resource-board-v7 .rf-resource-board-summary small{
        color:var(--rfrb-muted);
        font-size:5.8px;
      }

      .rf-resource-board-v7 .rf-resource-board-tabs{
        display:flex;
        gap:5px;
        overflow-x:auto;
        padding:5px;
        margin-bottom:10px;
        background:#fff;
        border:1px solid var(--rfrb-line);
        border-radius:10px;
        scrollbar-width:none;
      }

      .rf-resource-board-v7 .rf-resource-board-tabs::-webkit-scrollbar{
        display:none;
      }

      .rf-resource-board-v7 .rf-resource-board-tabs button{
        min-height:36px;
        flex:0 0 auto;
        padding:6px 9px;
        color:var(--rfrb-text2);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:6.5px;
        font-weight:700;
        transition:.13s var(--rfrb-ease);
      }

      .rf-resource-board-v7 .rf-resource-board-tabs button:hover{
        background:#f4f5f6;
      }

      .rf-resource-board-v7 .rf-resource-board-tabs button.active{
        color:var(--rfrb-primary);
        background:var(--rfrb-primary-soft);
      }

      .rf-resource-board-v7 .rf-resource-board-toolbar{
        min-height:61px;
        display:flex;
        align-items:flex-end;
        gap:8px;
        padding:10px;
        margin-bottom:11px;
        background:#fff;
        border:1px solid var(--rfrb-line);
        border-radius:10px;
      }

      .rf-resource-board-v7 .rf-resource-board-toolbar label{
        min-width:0;
        display:grid;
        gap:4px;
      }

      .rf-resource-board-v7 .rf-resource-board-toolbar label > span{
        color:var(--rfrb-muted);
        font-size:5.5px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rf-resource-board-v7 .rf-resource-board-search{
        flex:1;
      }

      .rf-resource-board-v7 .rf-resource-board-toolbar input,
      .rf-resource-board-v7 .rf-resource-board-toolbar select,
      .rf-resource-board-v7 .rf-resource-settings-card input,
      .rf-resource-board-v7 .rf-resource-settings-card select,
      .rf-resource-board-v7 .rf-quick-task-form input,
      .rf-resource-board-v7 .rf-quick-task-form select,
      .rf-resource-board-v7 .rf-quick-task-form textarea,
      .rf-resource-board-v7 .rf-resource-dialog input,
      .rf-resource-board-v7 .rf-resource-dialog select,
      .rf-resource-board-v7 .rf-resource-dialog textarea{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfrb-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 7px/12px Inter,sans-serif;
        transition:.13s var(--rfrb-ease);
      }

      .rf-resource-board-v7 textarea{
        min-height:88px!important;
        resize:vertical;
      }

      .rf-resource-board-v7 input:focus,
      .rf-resource-board-v7 select:focus,
      .rf-resource-board-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-resource-board-v7 .rf-whiteboard{
        display:grid;
        grid-template-columns:repeat(4,minmax(245px,1fr));
        gap:9px;
        overflow-x:auto;
        padding:1px 0 5px;
      }

      .rf-resource-board-v7 .rf-whiteboard--tasks{
        grid-template-columns:repeat(5,minmax(235px,1fr));
      }

      .rf-resource-board-v7 .rf-board-lane{
        min-width:245px;
        overflow:hidden;
        background:#f7f8f9;
        border:1px solid var(--rfrb-line);
        border-radius:11px;
      }

      .rf-resource-board-v7 .rf-board-lane__header{
        min-height:62px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:10px;
        background:#fff;
        border-bottom:1px solid var(--rfrb-line);
      }

      .rf-resource-board-v7 .rf-board-lane__identity{
        min-width:0;
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rf-resource-board-v7 .rf-resource-avatar,
      .rf-resource-board-v7 .rf-board-pool-icon{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        flex:0 0 34px;
        color:var(--rfrb-primary);
        background:var(--rfrb-primary-soft);
        border-radius:8px;
        font-size:7px;
        font-weight:800;
      }

      .rf-resource-board-v7 .rf-board-lane__identity > div{
        min-width:0;
        display:grid;
      }

      .rf-resource-board-v7 .rf-board-lane__identity strong{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.7px;
      }

      .rf-resource-board-v7 .rf-board-lane__identity small,
      .rf-resource-board-v7 .rf-resource-capacity{
        color:var(--rfrb-muted);
        font-size:5.5px;
      }

      .rf-resource-board-v7 .rf-board-lane__body{
        min-height:250px;
        display:grid;
        align-content:start;
        gap:6px;
        padding:7px;
      }

      .rf-resource-board-v7 .rf-board-card__top{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:7px;
      }

      .rf-resource-board-v7 .rf-board-card__meta{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
        color:var(--rfrb-muted);
        font-size:5.3px;
      }

      .rf-resource-board-v7 .rf-drag-handle{
        cursor:grab;
      }

      .rf-resource-board-v7 .rf-board-card__controls{
        display:flex;
        flex-wrap:wrap;
        gap:5px;
      }

      .rf-resource-board-v7 .rf-board-card__controls button,
      .rf-resource-board-v7 .rf-board-card__mobile-assign{
        min-height:31px;
        padding:5px 7px;
        color:var(--rfrb-text2);
        background:#fff;
        border:1px solid var(--rfrb-line);
        border-radius:7px;
        cursor:pointer;
        font-size:5.6px;
        font-weight:700;
      }

      .rf-resource-board-v7 .rf-lane-empty{
        min-height:110px;
        display:grid;
        place-items:center;
        padding:15px;
        color:var(--rfrb-muted);
        text-align:center;
        border:1px dashed #d7d9dd;
        border-radius:8px;
        font-size:6px;
      }

      .rf-resource-board-v7 .rf-task-board-layout{
        display:grid;
        grid-template-columns:minmax(0,1fr) 310px;
        align-items:start;
        gap:11px;
      }

      .rf-resource-board-v7 .rf-quick-task-form,
      .rf-resource-board-v7 .rf-resource-settings-card,
      .rf-resource-board-v7 .rf-resources-panel,
      .rf-resource-board-v7 .rf-activity-panel{
        padding:13px;
        background:#fff;
        border:1px solid var(--rfrb-line);
        border-radius:11px;
      }

      .rf-resource-board-v7 .rf-quick-task-form{
        position:sticky;
        top:78px;
      }

      .rf-resource-board-v7 .rf-quick-task-grid,
      .rf-resource-board-v7 .rf-resource-settings-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
      }

      .rf-resource-board-v7 .rf-quick-task-form label,
      .rf-resource-board-v7 .rf-resource-settings-card label,
      .rf-resource-board-v7 .rf-resource-dialog label{
        display:grid;
        gap:4px;
      }

      .rf-resource-board-v7 .rf-quick-task-form label > span,
      .rf-resource-board-v7 .rf-resource-settings-card label > span,
      .rf-resource-board-v7 .rf-resource-dialog label > span{
        color:var(--rfrb-muted);
        font-size:5.5px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rf-resource-board-v7 .rf-resources-panel{
        display:grid;
        gap:8px;
      }

      .rf-resource-board-v7 .rf-resource-settings-card{
        display:grid;
        gap:8px;
      }

      .rf-resource-board-v7 .rf-resource-performance{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:6px;
      }

      .rf-resource-board-v7 .rf-resource-performance > div{
        min-height:62px;
        display:grid;
        align-content:center;
        padding:8px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-resource-board-v7 .rf-resource-performance strong{
        font-size:8px;
      }

      .rf-resource-board-v7 .rf-resource-performance span{
        color:var(--rfrb-muted);
        font-size:5.3px;
      }

      .rf-resource-board-v7 .rf-activity-list{
        display:grid;
        gap:5px;
      }

      .rf-resource-board-v7 .rf-activity-list > article,
      .rf-resource-board-v7 .rf-activity-list > div{
        min-height:58px;
        display:grid;
        grid-template-columns:34px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:8px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-resource-board-v7 .rf-activity-icon{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfrb-primary);
        background:#fff;
        border-radius:8px;
      }

      .rf-resource-board-v7 .rf-resource-board-live{
        display:inline-flex;
        align-items:center;
        gap:5px;
        color:var(--rfrb-green);
        font-size:5.5px;
        font-weight:750;
      }

      .rf-resource-board-v7 .rf-resource-board-live::before{
        content:"";
        width:6px;
        height:6px;
        background:currentColor;
        border-radius:50%;
        animation:rfrbLive 1.1s infinite ease-in-out;
      }

      .rf-resource-board-v7 .rf-resource-dialog-backdrop{
        position:fixed;
        z-index:1100;
        inset:0;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(25,28,29,.56);
        backdrop-filter:blur(8px);
      }

      .rf-resource-board-v7 .rf-resource-dialog{
        width:min(720px,100%);
        max-height:calc(100vh - 36px);
        overflow:auto;
        padding:16px;
        background:#fff;
        border:1px solid rgba(255,255,255,.3);
        border-radius:14px;
        box-shadow:0 24px 70px rgba(0,0,0,.18);
      }

      .rf-resource-board-v7 .rf-dialog-close{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfrb-text2);
        background:#f1f2f3;
        border:1px solid var(--rfrb-line);
        border-radius:8px;
        cursor:pointer;
      }

      .rf-resource-board-v7 .rf-resource-dialog-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
      }

      .rf-resource-board-v7 .rf-board-skeleton{
        min-height:430px;
        opacity:.55;
      }

      @media(max-width:1120px){
        .rf-resource-board-v7{
          padding:22px;
        }

        .rf-resource-board-v7 .rf-resource-board-summary{
          grid-template-columns:1fr 1fr;
        }

        .rf-resource-board-v7 .rf-task-board-layout{
          grid-template-columns:1fr;
        }

        .rf-resource-board-v7 .rf-quick-task-form{
          position:static;
        }
      }

      @media(max-width:820px){
        .rf-resource-board-v7 .rf-resource-board-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-resource-board-v7 .rf-resource-board-header__actions{
          width:100%;
          justify-content:flex-start;
        }

        .rf-resource-board-v7 .rf-resource-board-toolbar{
          align-items:stretch;
          flex-direction:column;
        }
      }

      @media(max-width:620px){
        .rf-resource-board-v7{
          padding:18px 12px 80px;
        }

        .rf-resource-board-v7 .rf-resource-board-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rf-resource-board-v7 .rf-resource-board-header p{
          font-size:10px;
          line-height:16px;
        }

        .rf-resource-board-v7 .rf-resource-board-header__actions{
          display:grid;
          grid-template-columns:1fr;
        }

        .rf-resource-board-v7 .rf-resource-board-summary{
          grid-template-columns:1fr 1fr;
        }

        .rf-resource-board-v7 .rf-resource-board-tabs{
          margin-left:-12px;
          margin-right:-12px;
          border-radius:0;
        }

        .rf-resource-board-v7 .rf-resource-settings-grid,
        .rf-resource-board-v7 .rf-quick-task-grid,
        .rf-resource-board-v7 .rf-resource-dialog-grid{
          grid-template-columns:1fr;
        }

        .rf-resource-board-v7 .rf-resource-performance{
          grid-template-columns:1fr;
        }

        .rf-resource-board-v7 .rf-resource-dialog-backdrop{
          padding:0;
        }

        .rf-resource-board-v7 .rf-resource-dialog{
          max-height:100vh;
          min-height:100vh;
          border-radius:0;
        }
      }

      @media(max-width:420px){
        .rf-resource-board-v7 .rf-resource-board-summary{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-resource-board-v7,
        .rf-resource-board-v7 *,
        .rf-resource-board-v7 *::before,
        .rf-resource-board-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
