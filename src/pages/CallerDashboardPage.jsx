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
// import "../styles/assigned-lead-filters.css";

const DASHBOARD_CACHE_VERSION = 3;
const DASHBOARD_CACHE_TTL_MS =
  10 * 60 * 1000;

const TEAM_CACHE_VERSION = 3;
const TEAM_CACHE_TTL_MS =
  10 * 60 * 1000;
const TEAM_MESSAGE_LIMIT = 150;

function getDashboardCacheKey(
  userId
) {
  return [
    "reachfly",
    "caller-dashboard",
    DASHBOARD_CACHE_VERSION,
    userId || "anonymous",
  ].join(":");
}

function readDashboardCache(
  userId
) {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        getDashboardCacheKey(
          userId
        )
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      Date.now() -
        Number(
          parsed.updatedAt || 0
        ) >
        DASHBOARD_CACHE_TTL_MS
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeDashboardCache(
  userId,
  {
    dashboard,
    attendance,
  }
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getDashboardCacheKey(
        userId
      ),
      JSON.stringify({
        updatedAt: Date.now(),
        dashboard:
          dashboard || null,
        attendance:
          attendance || null,
      })
    );
  } catch {
    // Cache failures must not block the dashboard.
  }
}

function getTeamCacheKey(userId) {
  return [
    "reachfly",
    "team-communication",
    TEAM_CACHE_VERSION,
    userId || "anonymous",
  ].join(":");
}

function readTeamCache(userId) {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        getTeamCacheKey(
          userId
        )
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      Date.now() -
        Number(
          parsed.updatedAt || 0
        ) >
        TEAM_CACHE_TTL_MS
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeTeamCache(
  userId,
  value
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getTeamCacheKey(
        userId
      ),
      JSON.stringify({
        updatedAt: Date.now(),
        channels:
          Array.isArray(
            value?.channels
          )
            ? value.channels
            : [],
        tasks:
          Array.isArray(
            value?.tasks
          )
            ? value.tasks
            : [],
        presence:
          value?.presence &&
          typeof value.presence ===
            "object"
            ? value.presence
            : {},
        profiles:
          value?.profiles &&
          typeof value.profiles ===
            "object"
            ? value.profiles
            : {},
        activeId:
          value?.activeId || "",
        messagesByChannel:
          value?.messagesByChannel &&
          typeof value
            .messagesByChannel ===
            "object"
            ? value.messagesByChannel
            : {},
      })
    );
  } catch {
    // Cache failures must not block login.
  }
}

async function warmTeamCommunicationCache(
  userId
) {
  if (!userId) {
    return;
  }

  const existing =
    readTeamCache(userId);

  if (
    existing &&
    Date.now() -
      Number(
        existing.updatedAt || 0
      ) <
      30_000
  ) {
    return;
  }

  const [
    channelsResult,
    tasksResult,
    presenceResult,
  ] = await Promise.allSettled([
    apiRequest(
      "/team-communication/channels",
      {
        timeoutMs: 10_000,
      }
    ),
    apiRequest(
      "/team-communication/tasks",
      {
        timeoutMs: 10_000,
      }
    ),
    apiRequest(
      "/team-communication/presence",
      {
        timeoutMs: 10_000,
      }
    ),
  ]);

  const channels =
    channelsResult.status ===
      "fulfilled" &&
    Array.isArray(
      channelsResult.value
        ?.channels
    )
      ? channelsResult.value
          .channels
      : existing?.channels ||
        [];

  const tasks =
    tasksResult.status ===
      "fulfilled" &&
    Array.isArray(
      tasksResult.value?.tasks
    )
      ? tasksResult.value.tasks
      : existing?.tasks || [];

  const presence = {
    ...(existing?.presence ||
      {}),
  };

  const profiles = {
    ...(existing?.profiles ||
      {}),
  };

  if (
    presenceResult.status ===
    "fulfilled"
  ) {
    for (
      const item of
      presenceResult.value
        ?.members || []
    ) {
      const memberId =
        item?.userId ||
        item?.id;

      if (!memberId) {
        continue;
      }

      const normalized = {
        ...item,
        id:
          item.id ||
          memberId,
        userId:
          item.userId ||
          memberId,
        status:
          item.status ||
          item.availabilityStatus ||
          "offline",
      };

      presence[memberId] =
        normalized;

      profiles[memberId] =
        normalized;
    }
  }

  const activeId =
    existing?.activeId &&
    channels.some(
      (channel) =>
        channel.id ===
        existing.activeId
    )
      ? existing.activeId
      : channels[0]?.id ||
        "";

  const messagesByChannel = {
    ...(existing
      ?.messagesByChannel ||
      {}),
  };

  writeTeamCache(
    userId,
    {
      channels,
      tasks,
      presence,
      profiles,
      activeId,
      messagesByChannel,
    }
  );

  if (!activeId) {
    return;
  }

  try {
    const messageResponse =
      await apiRequest(
        `/team-communication/channels/${encodeURIComponent(
          activeId
        )}/messages`,
        {
          query: {
            limit:
              TEAM_MESSAGE_LIMIT,
          },
          timeoutMs: 10_000,
        }
      );

    messagesByChannel[
      activeId
    ] =
      Array.isArray(
        messageResponse
          ?.messages
      )
        ? messageResponse.messages
            .slice(
              -TEAM_MESSAGE_LIMIT
            )
        : [];

    writeTeamCache(
      userId,
      {
        channels,
        tasks,
        presence,
        profiles,
        activeId,
        messagesByChannel,
      }
    );
  } catch {
    // The cached channel list is still useful if messages time out.
  }
}

export default function CallerDashboard() {
  const {
    user,
    isCaller,
  } = useAuth();

  const navigate =
    useNavigate();

  const initialCacheRef =
    useRef(
      readDashboardCache(
        user?.id
      )
    );

  const loadSequenceRef =
    useRef(0);

  const socketTimerRef =
    useRef(null);

  const attendanceRef =
    useRef(
      initialCacheRef.current
        ?.attendance || null
    );

  const [
    dashboard,
    setDashboard,
  ] = useState(
    () =>
      initialCacheRef.current
        ?.dashboard || null
  );

  const [
    attendance,
    setAttendance,
  ] = useState(
    () =>
      initialCacheRef.current
        ?.attendance || null
  );

  const [
    loading,
    setLoading,
  ] = useState(
    () =>
      !initialCacheRef.current
  );

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] = useState(
    () =>
      initialCacheRef.current
        ?.updatedAt || 0
  );

  const [
    recentLeadFilter,
    setRecentLeadFilter,
  ] = useState("all");

  const [
    recentLeadSearch,
    setRecentLeadSearch,
  ] = useState("");

  useEffect(() => {
    if (
      user &&
      !isCaller
    ) {
      navigate(
        "/app/dashboard",
        {
          replace: true,
        }
      );
    }
  }, [
    isCaller,
    navigate,
    user,
  ]);

  const load =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        const sequence =
          ++loadSequenceRef.current;

        if (!silent) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const [
          dashboardResult,
          assignmentsResult,
          queueResult,
          attendanceResult,
        ] =
          await Promise.allSettled([
            apiRequest(
              "/sales/dashboard",
              {
                timeoutMs:
                  12_000,
              }
            ),
            apiRequest(
              "/sales/assignments",
              {
                timeoutMs:
                  12_000,
              }
            ),
            apiRequest(
              "/caller-queue",
              {
                query: {
                  bucket: "all",
                  limit: 200,
                },
                timeoutMs:
                  12_000,
              }
            ),
            apiRequest(
              "/attendance/today",
              {
                timeoutMs:
                  10_000,
              }
            ),
          ]);

        if (
          sequence !==
          loadSequenceRef.current
        ) {
          return;
        }

        const dashboardResponse =
          dashboardResult.status ===
          "fulfilled"
            ? dashboardResult.value
            : {};

        const assignmentsResponse =
          assignmentsResult.status ===
          "fulfilled"
            ? assignmentsResult.value
            : {
                assignments: [],
              };

        const queueResponse =
          queueResult.status ===
          "fulfilled"
            ? queueResult.value
            : {
                records: [],
                counts: {},
              };

        const nextDashboard =
          normalizeCallerDashboard(
            dashboardResponse,
            assignmentsResponse,
            queueResponse
          );

        const nextAttendance =
          attendanceResult.status ===
          "fulfilled"
            ? attendanceResult
                .value
                ?.attendance ||
              null
            : attendanceRef.current;

        const coreResults = [
          dashboardResult,
          assignmentsResult,
          queueResult,
        ];

        const allCoreFailed =
          coreResults.every(
            (result) =>
              result.status ===
              "rejected"
          );

        if (allCoreFailed) {
          const firstFailure =
            coreResults.find(
              (result) =>
                result.status ===
                "rejected"
            );

          setError(
            firstFailure?.reason
              ?.message ||
              "The caller dashboard could not be loaded."
          );
        }

        setDashboard(
          nextDashboard
        );

        if (
          attendanceResult.status ===
          "fulfilled"
        ) {
          attendanceRef.current =
            nextAttendance;

          setAttendance(
            nextAttendance
          );
        }

        const updatedAt =
          Date.now();

        setLastUpdatedAt(
          updatedAt
        );

        writeDashboardCache(
          user?.id,
          {
            dashboard:
              nextDashboard,
            attendance:
              nextAttendance,
          }
        );

        setLoading(false);
        setRefreshing(false);
      },
      [
        user?.id,
      ]
    );

  useEffect(() => {
    const cached =
      readDashboardCache(
        user?.id
      );

    if (cached) {
      setDashboard(
        cached.dashboard ||
          null
      );
      attendanceRef.current =
        cached.attendance ||
        null;

      setAttendance(
        attendanceRef.current
      );
      setLastUpdatedAt(
        cached.updatedAt || 0
      );
      setLoading(false);
    }

    void load({
      silent:
        Boolean(cached),
    });
  }, [
    load,
    user?.id,
  ]);

  useEffect(() => {
    const refreshWhenVisible =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void load({
            silent: true,
          });
        }
      };

    const timer =
      window.setInterval(
        refreshWhenVisible,
        30_000
      );

    window.addEventListener(
      "focus",
      refreshWhenVisible
    );

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible
    );

    return () => {
      window.clearInterval(
        timer
      );

      window.removeEventListener(
        "focus",
        refreshWhenVisible
      );

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible
      );
    };
  }, [
    load,
  ]);

  useEffect(() => {
    const scheduleRefresh =
      () => {
        window.clearTimeout(
          socketTimerRef.current
        );

        socketTimerRef.current =
          window.setTimeout(() => {
            void load({
              silent: true,
            });
          }, 250);
      };

    const subscriptions = [
      onWorkspaceSocket(
        "lead:updated",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "lead:call-updated",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "team:task-created",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "team:task-updated",
        scheduleRefresh
      ),
    ];

    return () => {
      window.clearTimeout(
        socketTimerRef.current
      );

      subscriptions.forEach(
        (unsubscribe) =>
          unsubscribe()
      );
    };
  }, [
    load,
  ]);

  useEffect(() => {
    void warmTeamCommunicationCache(
      user?.id
    );
  }, [
    user?.id,
  ]);

  const metrics =
    useMemo(
      () =>
        deriveCallerMetrics(
          dashboard
        ),
      [
        dashboard,
      ]
    );

  const cards =
    useMemo(
      () => [
        {
          label:
            "Assigned leads",
          value:
            metrics.assignedLeads ||
            0,
          text:
            "Current caller workload",
        },
        {
          label:
            "Calls today",
          value:
            metrics.callsToday ||
            0,
          text:
            "Outbound activity today",
        },
        {
          label:
            "Contacted today",
          value:
            metrics.contactedToday ||
            0,
          text:
            "Unique assigned leads reached",
        },
        {
          label:
            "Follow-ups due",
          value:
            metrics.followUpsDue ||
            0,
          text:
            "Actions requiring attention",
        },
        {
          label:
            "Conversion rate",
          value:
            `${
              metrics.conversionRate ||
              0
            }%`,
          text:
            "Qualified or completed leads",
        },
        {
          label:
            "Attendance",
          value:
            attendance
              ?.checkOutAt
              ? "Checked out"
              : attendance
                  ?.checkInAt
                ? "Checked in"
                : "Not checked in",
          text:
            attendance
              ?.checkInAt
              ? `Started ${new Date(
                  attendance.checkInAt
                ).toLocaleTimeString(
                  undefined,
                  {
                    hour:
                      "numeric",
                    minute:
                      "2-digit",
                  }
                )}`
              : "Complete attendance before work",
        },
      ],
      [
        attendance,
        metrics,
      ]
    );

  const recentAssignments =
    useMemo(
      () => {
        const query =
          recentLeadSearch
            .trim()
            .toLowerCase();

        return getRecentAssignments(
          dashboard,
          50
        )
          .filter((assignment) => {
            const status =
              normalizeDashboardStatus(
                assignment.status ||
                  assignment.lead
                    ?.status ||
                  "assigned"
              );

            if (
              recentLeadFilter !==
                "all" &&
              status !==
                recentLeadFilter
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            return [
              getAssignmentLeadName(
                assignment
              ),
              assignment.lead
                ?.phone,
              assignment.lead
                ?.email,
              assignment.campaignName,
              status,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(query);
          })
          .slice(0, 8);
      },
      [
        dashboard,
        recentLeadFilter,
        recentLeadSearch,
      ]
    );

  if (!isCaller) {
    return null;
  }

  return (
    <main className="dashboard-page rf-caller-dashboard-v7">
      <CallerDashboardV7Styles />
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            Daily sales workspace
          </span>

          <h1>
            Your calling day at a glance
          </h1>

          <p>
            See assigned leads, follow-ups, calls, attendance, and team communication without leaving your daily workflow.
          </p>

          {lastUpdatedAt ? (
            <small className="text-muted">
              Updated{" "}
              {formatDashboardTime(
                lastUpdatedAt
              )}
              {refreshing
                ? " · Refreshing…"
                : ""}
            </small>
          ) : null}
        </div>

        <div className="flex flex-gap flex-wrap">
          <button
            type="button"
            className="btn light"
            disabled={refreshing}
            onClick={() =>
              void load({
                silent: true,
              })
            }
          >
            {refreshing
              ? "Refreshing…"
              : "Refresh"}
          </button>

          <Link
            to="/app/attendance"
            className="btn light"
          >
            Attendance
          </Link>

          <Link
            to="/app/my-leads"
            className="btn primary"
          >
            View assigned leads
          </Link>
        </div>
      </header>

      {error ? (
        <div className="error-banner mb16">
          {safeCallerMessage(error)}
        </div>
      ) : null}

      <section className="grid4 mb24">
        {cards.map(
          (card) => (
            <article
              key={
                card.label
              }
              className="metric-card"
            >
              <div className="metric-num sm">
                {loading &&
                !dashboard
                  ? "…"
                  : card.value}
              </div>

              <div className="metric-label">
                {card.label}
              </div>

              <div className="metric-trend">
                {card.text}
              </div>
            </article>
          )
        )}
      </section>

      <section className="grid2 mb24">
        <article className="card">
          <span className="eyebrow">
            Next actions
          </span>

          <h2>
            Prioritize today
          </h2>

          <div className="activity-row">
            <div>
              <b>
                Follow-ups due
              </b>

              <small>
                Review scheduled actions and call notes.
              </small>
            </div>

            <strong>
              {metrics.followUpsDue ||
                0}
            </strong>
          </div>

          <div className="activity-row">
            <div>
              <b>
                Pending assigned leads
              </b>

              <small>
                Leads that still need an outcome.
              </small>
            </div>

            <strong>
              {metrics.pendingLeads ||
                0}
            </strong>
          </div>

          <Link
            to="/app/my-leads"
            className="btn primary full mt16"
          >
            Open My Leads
          </Link>
        </article>

        <article className="card">
          <span className="eyebrow">
            Attendance
          </span>

          <h2>
            Today's shift
          </h2>

          <p className="text-muted">
            Attendance requires a live selfie at check-in and check-out.
          </p>

          <div className="activity-row">
            <div>
              <b>
                Current status
              </b>

              <small>
                {attendance
                  ?.checkInAt
                  ? `Check-in: ${formatDashboardTime(
                      attendance.checkInAt
                    )}`
                  : "No check-in recorded today"}
              </small>
            </div>

            <strong>
              {attendance
                ?.checkOutAt
                ? "Complete"
                : attendance
                    ?.checkInAt
                  ? "On shift"
                  : "Pending"}
            </strong>
          </div>

          <Link
            to="/app/attendance"
            className="btn light full mt16"
          >
            Open attendance
          </Link>
        </article>
      </section>

      <section className="card">
        <div className="flex flex-between flex-gap mb16">
          <div>
            <span className="eyebrow">
              Live records
            </span>

            <h2>
              Recently updated leads
            </h2>

            <p className="text-muted">
              This list refreshes from queue updates and call activity.
            </p>
          </div>

          <Link
            to="/app/my-leads"
            className="btn light"
          >
            View all
          </Link>
        </div>

        <div className="caller-dashboard-lead-filters">
          <input
            value={recentLeadSearch}
            onChange={(event) =>
              setRecentLeadSearch(
                event.target.value
              )
            }
            placeholder="Search recent assigned leads…"
          />

          <select
            value={recentLeadFilter}
            onChange={(event) =>
              setRecentLeadFilter(
                event.target.value
              )
            }
          >
            <option value="all">All statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="follow_up">Follow-up</option>
            <option value="qualified">Qualified</option>
            <option value="meeting_booked">Meeting booked</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {recentAssignments.length ? (
          <div>
            {recentAssignments.map(
              (assignment) => (
                <div
                  key={
                    assignment.id ||
                    assignment.assignmentId ||
                    assignment.leadId
                  }
                  className="activity-row"
                >
                  <div>
                    <b>
                      {getAssignmentLeadName(
                        assignment
                      )}
                    </b>

                    <small>
                      {assignment.lead
                        ?.phone ||
                        assignment.phone ||
                        "No phone"}
                      {" · "}
                      {formatDashboardStatus(
                        assignment.status ||
                          assignment.lead
                            ?.status ||
                          "assigned"
                      )}
                      {" · "}
                      {formatDashboardTime(
                        getAssignmentUpdatedAt(
                          assignment
                        )
                      )}
                    </small>
                  </div>

                  <Link
                    to={`/app/call-workspace?assignmentId=${encodeURIComponent(
                      assignment.id ||
                        assignment.assignmentId ||
                        ""
                    )}&leadId=${encodeURIComponent(
                      assignment.leadId ||
                        assignment.lead
                          ?.id ||
                        ""
                    )}`}
                    className="btn light"
                  >
                    Open
                  </Link>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-muted">
            No assigned lead records are available yet.
          </p>
        )}
      </section>
    </main>
  );
}

function normalizeCallerDashboard(
  dashboardResponse,
  assignmentsResponse,
  queueResponse = {}
) {
  const dashboard =
    dashboardResponse &&
    typeof dashboardResponse ===
      "object"
      ? dashboardResponse
      : {};

  const assignmentPayload =
    assignmentsResponse &&
    typeof assignmentsResponse ===
      "object"
      ? assignmentsResponse
      : {};

  const assignments =
    Array.isArray(
      assignmentPayload.assignments
    )
      ? assignmentPayload.assignments
      : Array.isArray(
            assignmentPayload.records
          )
        ? assignmentPayload.records
        : Array.isArray(
              assignmentPayload
            )
          ? assignmentPayload
          : Array.isArray(
                dashboard.assignments
              )
            ? dashboard.assignments
            : [];

  const queueRecords =
    Array.isArray(
      queueResponse?.records
    )
      ? queueResponse.records
      : [];

  const merged =
    new Map();

  for (
    const assignment of
    [
      ...assignments,
      ...queueRecords,
    ]
  ) {
    const key =
      assignment.id ||
      assignment.assignmentId ||
      assignment.leadId;

    if (!key) {
      continue;
    }

    merged.set(
      key,
      {
        ...(merged.get(key) ||
          {}),
        ...assignment,
      }
    );
  }

  return {
    ...dashboard,
    assignments:
      [...merged.values()],
    queueCounts:
      queueResponse?.counts ||
      {},
  };
}

function deriveCallerMetrics(
  dashboard
) {
  const assignments =
    Array.isArray(
      dashboard
        ?.assignments
    )
      ? dashboard
          .assignments
      : [];

  const backendMetrics =
    dashboard?.metrics &&
    typeof dashboard.metrics ===
      "object"
      ? dashboard.metrics
      : {};

  const statuses =
    assignments.map(
      (assignment) =>
        normalizeDashboardStatus(
          assignment.status ||
            assignment.lead
              ?.status ||
            "assigned"
        )
    );

  const completedStatuses =
    new Set([
      "completed",
      "converted",
      "qualified",
      "meeting_booked",
    ]);

  const closedStatuses =
    new Set([
      ...completedStatuses,
      "do_not_contact",
      "do_not_call",
      "not_interested",
    ]);

  const pendingLeads =
    statuses.filter(
      (status) =>
        !closedStatuses.has(
          status
        )
    ).length;

  const followUpsDue =
    assignments.filter(
      (assignment) => {
        const status =
          normalizeDashboardStatus(
            assignment.status
          );

        if (
          status ===
          "follow_up"
        ) {
          return true;
        }

        const value =
          assignment.followUpAt ||
          assignment.nextActionAt;

        if (!value) {
          return false;
        }

        const timestamp =
          Date.parse(
            value
          );

        return (
          Number.isFinite(
            timestamp
          ) &&
          timestamp <=
            Date.now()
        );
      }
    ).length;

  const converted =
    statuses.filter(
      (status) =>
        completedStatuses.has(
          status
        )
    ).length;

  const assignedLeads =
    assignments.length ||
    Number(
      backendMetrics
        .assignedLeads ||
      0
    );

  return {
    ...backendMetrics,

    assignedLeads,

    pendingLeads:
      assignments.length
        ? pendingLeads
        : Number(
            backendMetrics
              .pendingLeads ||
            0
          ),

    callsToday:
      Number(
        backendMetrics
          .callsToday ||
        backendMetrics
          .completedToday ||
        0
      ),

    contactedToday:
      Number(
        backendMetrics
          .contactedToday ||
        backendMetrics
          .uniqueLeadsContacted ||
        0
      ),

    followUpsDue:
      assignments.length
        ? followUpsDue
        : Number(
            backendMetrics
              .followUpsDue ||
            0
          ),

    conversionRate:
      assignments.length
        ? Math.round(
            (
              converted /
              assignments.length
            ) *
              100
          )
        : Number(
            backendMetrics
              .conversionRate ||
            0
          ),
  };
}

function getRecentAssignments(
  dashboard,
  limit = 8
) {
  const assignments =
    Array.isArray(
      dashboard
        ?.assignments
    )
      ? dashboard
          .assignments
      : [];

  return [...assignments]
    .sort(
      (left, right) =>
        Date.parse(
          getAssignmentUpdatedAt(
            right
          ) || 0
        ) -
        Date.parse(
          getAssignmentUpdatedAt(
            left
          ) || 0
        )
    )
    .slice(
      0,
      Math.max(1, Number(limit || 8))
    );
}

function getAssignmentUpdatedAt(
  assignment
) {
  return (
    assignment.updatedAt ||
    assignment.lastCallAt ||
    assignment.completedAt ||
    assignment.openedAt ||
    assignment.assignedAt ||
    assignment.createdAt ||
    assignment.lead
      ?.updatedAt ||
    assignment.lead
      ?.createdAt ||
    ""
  );
}

function getAssignmentLeadName(
  assignment
) {
  return (
    assignment.lead
      ?.business ||
    assignment.lead
      ?.name ||
    assignment.business ||
    assignment.name ||
    "Assigned lead"
  );
}

function normalizeDashboardStatus(
  value
) {
  return String(
    value ||
      ""
  )
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
}

function formatDashboardStatus(
  value
) {
  return normalizeDashboardStatus(
    value
  )
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatDashboardTime(
  value
) {
  if (!value) {
    return "just now";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "just now";
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


function safeCallerMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bWebRTC\b/gi, "browser calling")
    .replace(/\bSIP\b/gi, "voice connection");
}

function CallerDashboardV7Styles() {
  return (
    <style>{`
      .rf-caller-dashboard-v7{
        --rfcd-card:#fff;
        --rfcd-soft:#f6f7f8;
        --rfcd-text:#191c1d;
        --rfcd-text2:#4d4c59;
        --rfcd-muted:#777784;
        --rfcd-line:#e2e4e7;
        --rfcd-primary:#4648d4;
        --rfcd-primary-dark:#393bbb;
        --rfcd-primary-soft:#e8e9ff;
        --rfcd-violet:#6b38d4;
        --rfcd-violet-soft:#f1ebff;
        --rfcd-green:#087a51;
        --rfcd-green-soft:#e4f7ee;
        --rfcd-red:#ba1a1a;
        --rfcd-red-soft:#ffedeb;
        --rfcd-dark:#2e3132;
        --rfcd-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfcd-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfcdPageIn .24s var(--rfcd-ease);
      }

      .rf-caller-dashboard-v7 *,
      .rf-caller-dashboard-v7 *::before,
      .rf-caller-dashboard-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfcdPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      .rf-caller-dashboard-v7 .page-heading{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:18px;
      }

      .rf-caller-dashboard-v7 .eyebrow{
        display:block;
        margin:0 0 4px;
        color:var(--rfcd-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rf-caller-dashboard-v7 .page-heading h1{
        margin:0;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-caller-dashboard-v7 .page-heading p{
        max-width:760px;
        margin:5px 0 0;
        color:var(--rfcd-text2);
        font-size:12px;
        line-height:18px;
      }

      .rf-caller-dashboard-v7 .text-muted{
        color:var(--rfcd-muted)!important;
      }

      .rf-caller-dashboard-v7 .page-heading small{
        display:block;
        margin-top:6px;
        font-size:6px;
      }

      .rf-caller-dashboard-v7 .flex{
        display:flex;
      }

      .rf-caller-dashboard-v7 .flex-between{
        justify-content:space-between;
      }

      .rf-caller-dashboard-v7 .flex-gap{
        gap:7px;
      }

      .rf-caller-dashboard-v7 .flex-wrap{
        flex-wrap:wrap;
      }

      .rf-caller-dashboard-v7 .btn{
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
        transition:.14s var(--rfcd-ease);
      }

      .rf-caller-dashboard-v7 .btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-caller-dashboard-v7 .btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-caller-dashboard-v7 .btn.primary{
        color:#fff;
        background:var(--rfcd-primary);
        border-color:var(--rfcd-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rf-caller-dashboard-v7 .btn.primary:hover:not(:disabled){
        background:var(--rfcd-primary-dark);
      }

      .rf-caller-dashboard-v7 .btn.light{
        color:var(--rfcd-text);
        background:#fff;
        border-color:var(--rfcd-line);
      }

      .rf-caller-dashboard-v7 .btn.full{
        width:100%;
      }

      .rf-caller-dashboard-v7 .error-banner{
        padding:10px 12px;
        margin-bottom:11px!important;
        color:#7c1d1d;
        background:var(--rfcd-red-soft);
        border:1px solid #ffd0cc;
        border-radius:9px;
        font-size:7px;
        line-height:12px;
      }

      .rf-caller-dashboard-v7 .grid4{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:9px;
      }

      .rf-caller-dashboard-v7 .grid2{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:11px;
      }

      .rf-caller-dashboard-v7 .mb24{
        margin-bottom:12px!important;
      }

      .rf-caller-dashboard-v7 .mb16{
        margin-bottom:11px!important;
      }

      .rf-caller-dashboard-v7 .metric-card,
      .rf-caller-dashboard-v7 .card{
        background:#fff;
        border:1px solid var(--rfcd-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-caller-dashboard-v7 .metric-card{
        min-height:140px;
        display:grid;
        align-content:end;
        padding:14px;
        background:
          radial-gradient(circle at 92% 10%,rgba(70,72,212,.04),transparent 30%),
          #fff;
      }

      .rf-caller-dashboard-v7 .metric-num{
        color:var(--rfcd-text);
        font:600 26px/31px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-caller-dashboard-v7 .metric-num.sm{
        font-size:23px;
      }

      .rf-caller-dashboard-v7 .metric-label{
        margin-top:3px;
        color:var(--rfcd-text2);
        font-size:6.5px;
        font-weight:750;
      }

      .rf-caller-dashboard-v7 .metric-trend{
        margin-top:3px;
        color:var(--rfcd-muted);
        font-size:5.7px;
        line-height:9px;
      }

      .rf-caller-dashboard-v7 .card{
        min-width:0;
        padding:14px;
      }

      .rf-caller-dashboard-v7 .card > h2{
        margin:2px 0 9px;
        font:600 15px/20px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-caller-dashboard-v7 .card > p{
        color:var(--rfcd-text2);
        font-size:7px;
        line-height:12px;
      }

      .rf-caller-dashboard-v7 .activity-row{
        min-height:58px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:9px;
        padding:8px 9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
      }

      .rf-caller-dashboard-v7 .activity-row + .activity-row{
        margin-top:5px;
      }

      .rf-caller-dashboard-v7 .activity-row > div{
        min-width:0;
        display:grid;
      }

      .rf-caller-dashboard-v7 .activity-row b{
        font-size:6.8px;
      }

      .rf-caller-dashboard-v7 .activity-row small{
        margin-top:2px;
        color:var(--rfcd-muted);
        font-size:5.7px;
        line-height:9px;
      }

      .rf-caller-dashboard-v7 .activity-row > strong{
        min-width:36px;
        color:var(--rfcd-primary);
        text-align:right;
        font-size:8px;
      }

      .rf-caller-dashboard-v7 .caller-dashboard-lead-filters{
        display:grid;
        grid-template-columns:minmax(180px,1fr) minmax(150px,.55fr);
        gap:7px;
        padding:9px;
        margin:8px 0;
        background:#f7f8f9;
        border-radius:9px;
      }

      .rf-caller-dashboard-v7 .caller-dashboard-lead-filters input,
      .rf-caller-dashboard-v7 .caller-dashboard-lead-filters select{
        width:100%;
        min-height:37px;
        padding:8px 9px;
        color:var(--rfcd-text);
        background:#fff;
        border:1px solid var(--rfcd-line);
        border-radius:8px;
        outline:0;
        font-size:7px;
      }

      .rf-caller-dashboard-v7 .caller-dashboard-lead-filters input:focus,
      .rf-caller-dashboard-v7 .caller-dashboard-lead-filters select:focus{
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-caller-dashboard-v7 a:not(.btn){
        color:var(--rfcd-primary);
        text-decoration:none;
      }

      @media(max-width:1080px){
        .rf-caller-dashboard-v7{
          padding:22px;
        }

        .rf-caller-dashboard-v7 .grid4{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:800px){
        .rf-caller-dashboard-v7 .page-heading{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-caller-dashboard-v7 .page-heading > .flex{
          width:100%;
        }

        .rf-caller-dashboard-v7 .page-heading > .flex .btn{
          flex:1;
        }

        .rf-caller-dashboard-v7 .grid2{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:620px){
        .rf-caller-dashboard-v7{
          padding:18px 12px 80px;
        }

        .rf-caller-dashboard-v7 .page-heading h1{
          font-size:25px;
          line-height:32px;
        }

        .rf-caller-dashboard-v7 .page-heading p{
          font-size:10px;
          line-height:16px;
        }

        .rf-caller-dashboard-v7 .page-heading > .flex{
          display:grid;
          grid-template-columns:1fr;
        }

        .rf-caller-dashboard-v7 .grid4{
          grid-template-columns:1fr 1fr;
        }

        .rf-caller-dashboard-v7 .caller-dashboard-lead-filters{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:420px){
        .rf-caller-dashboard-v7 .grid4{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-caller-dashboard-v7,
        .rf-caller-dashboard-v7 *,
        .rf-caller-dashboard-v7 *::before,
        .rf-caller-dashboard-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
