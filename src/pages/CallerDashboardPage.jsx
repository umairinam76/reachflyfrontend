import {
  useEffect,
  useMemo,
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
  api,
} from "../api";

import "../styles.css";
// import "./attendance.css";

export default function CallerDashboard() {
  const {
    user,
    isCaller,
  } = useAuth();

  const navigate =
    useNavigate();

  const [
    dashboard,
    setDashboard,
  ] = useState(null);

  const [
    attendance,
    setAttendance,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const token =
          api.getToken();

        const requestJson =
          async (
            path
          ) => {
            const response =
              await fetch(
                `${getApiBaseUrl()}${path}`,
                {
                  headers: {
                    Accept:
                      "application/json",

                    ...(token
                      ? {
                          Authorization:
                            `Bearer ${token}`,
                        }
                      : {}),
                  },
                }
              );

            const data =
              await response
                .json()
                .catch(
                  () => null
                );

            if (!response.ok) {
              throw new Error(
                data?.error ||
                data?.message ||
                `Request failed with status ${response.status}.`
              );
            }

            return data;
          };

        const attendanceRequest =
          fetch(
            `${getApiBaseUrl()}/attendance/today`,
            {
              headers: {
                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),
              },
            }
          )
            .then(
              (response) =>
                response.json()
            )
            .catch(
              () => null
            );

        const [
          dashboardResponse,
          assignmentsResponse,
          queueResponse,
          attendanceResponse,
        ] = await Promise.all([
          api.salesDashboard().catch(() => ({})),
          requestJson("/sales/assignments").catch(() => ({ assignments: [] })),
          api.callerQueue
            ? api.callerQueue({ bucket: "all", limit: 1000 }).catch(() => ({}))
            : Promise.resolve({}),
          attendanceRequest,
        ]);

        if (!active) {
          return;
        }

        const normalizedDashboard =
          normalizeCallerDashboard(
            dashboardResponse,
            assignmentsResponse
          );

        setDashboard(
          normalizedDashboard
        );

        setAttendance(
          attendanceResponse
            ?.attendance ||
            null
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    const timer =
      window.setInterval(
        load,
        15_000
      );

    return () => {
      active = false;

      window.clearInterval(
        timer
      );
    };
  }, []);

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
        </div>

        <div className="flex flex-gap">
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
                {loading
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

      <section className="grid2">
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

          <Link
            to="/app/attendance"
            className="btn light full mt16"
          >
            Open attendance
          </Link>
        </article>
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

  const queueRecords = Array.isArray(queueResponse?.records)
    ? queueResponse.records
    : [];

  const merged = new Map();
  for (const assignment of [...assignments, ...queueRecords]) {
    const key = assignment.id || assignment.assignmentId || assignment.leadId;
    if (!key) continue;
    merged.set(key, {
      ...(merged.get(key) || {}),
      ...assignment,
    });
  }

  return {
    ...dashboard,
    assignments: [...merged.values()],
    queueCounts: queueResponse?.counts || {},
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

function getApiBaseUrl() {
  const configured =
    String(
      import.meta.env
        .VITE_API_URL ||
        ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  if (configured) {
    return /\/api$/i.test(
      configured
    )
      ? configured
      : `${configured}/api`;
  }

  return `${window.location.protocol}//${window.location.hostname}:8787/api`;
}
