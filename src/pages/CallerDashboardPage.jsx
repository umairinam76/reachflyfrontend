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
      () =>
        getRecentAssignments(
          dashboard
        ),
      [
        dashboard,
      ]
    );

  if (!isCaller) {
    return null;
  }

  return (
    <main className="dashboard-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            Caller workspace
          </span>

          <h1>
            My work dashboard
          </h1>

          <p>
            Work assigned leads, complete calls,
            manage follow-ups, and track attendance.
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
          {error}
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
    .slice(0, 8);
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