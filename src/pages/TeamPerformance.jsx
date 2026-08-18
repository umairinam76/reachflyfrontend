import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  api,
} from "../api";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Phone,
  RefreshCw,
  TrendingUp,
  Users,
} from "../components/icons";

const RANGE_OPTIONS = [
  {
    id: "7d",
    label: "7 days",
    days: 7,
  },
  {
    id: "30d",
    label: "30 days",
    days: 30,
  },
  {
    id: "90d",
    label: "90 days",
    days: 90,
  },
];

export default function TeamPerformance() {
  const {
    user,
    role,
  } = useAuth();

  const [range, setRange] =
    useState("7d");

  const [data, setData] =
    useState({
      rows: [],
      totals: {},
    });

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const canView =
    canViewPerformance(
      user,
      role
    );

  const selectedRange =
    RANGE_OPTIONS.find(
      (item) =>
        item.id === range
    ) || RANGE_OPTIONS[0];

  const load =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!canView) {
          setLoading(false);
          return;
        }

        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const to =
          new Date();

        const from =
          new Date(
            to.getTime() -
              selectedRange.days *
                86_400_000
          );

        try {
          const response =
            await api.teamPerformance({
              from:
                from.toISOString(),
              to:
                to.toISOString(),
            });

          setData({
            rows:
              normalizeRows(
                response
              ),
            totals:
              normalizeTotals(
                response
              ),
          });
        } catch (
          requestError
        ) {
          setError(
            safeTeamPerformanceMessage(
              requestError?.message ||
                "Team performance could not be loaded."
            )
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        canView,
        selectedRange.days,
      ]
    );

  useEffect(
    () => {
      void load();
    },
    [load]
  );

  useEffect(
    () => {
      if (!canView) {
        return undefined;
      }

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
          180_000
        );

      window.addEventListener(
        "focus",
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
      };
    },
    [
      canView,
      load,
    ]
  );

  const rankedRows =
    useMemo(
      () =>
        [...data.rows].sort(
          (a, b) =>
            performanceScore(b) -
            performanceScore(a)
        ),
      [data.rows]
    );

  const strongest =
    rankedRows[0] ||
    null;

  if (loading) {
    return (
      <TeamPerformanceSkeleton />
    );
  }

  if (!canView) {
    return (
      <main className="rf-team-performance-page-v7">
        <TeamPerformanceStyles />

        <div className="rf-team-performance-access">
          <Users size={21} />
          <h1>
            Team performance is restricted.
          </h1>
          <p>
            Ask a workspace owner or manager for permission to view team-level performance reporting.
          </p>
        </div>
      </main>
    );
  }

  const totals =
    data.totals;

  return (
    <main className="rf-team-performance-page-v7">
      <TeamPerformanceStyles />

      <header className="rf-team-performance-header">
        <div className="rf-team-performance-heading">
          <span>
            <TrendingUp
              size={18}
            />
          </span>

          <div>
            <p className="eyebrow">
              Team analytics
            </p>

            <h1>
              Team performance
            </h1>

            <p>
              Calls, connected conversations, qualified leads, meetings and overdue work from the selected reporting window.
            </p>
          </div>
        </div>

        <div className="rf-team-performance-actions">
          <div className="rf-range-switcher">
            {RANGE_OPTIONS.map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    range === item.id
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setRange(item.id)
                  }
                >
                  {item.label}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            className="rf-team-performance-refresh"
            onClick={() =>
              void load({
                silent: true,
              })
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={13}
              className={
                refreshing
                  ? "spin"
                  : ""
              }
            />
            {refreshing
              ? "Refreshing…"
              : "Refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <div
          className="rf-team-performance-alert"
          role="alert"
        >
          <AlertTriangle
            size={13}
          />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              void load()
            }
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="rf-team-performance-metrics">
        <PerformanceMetric
          icon={Phone}
          label="Calls"
          value={
            metricValue(
              totals,
              "callAttempts",
              "totalCalls",
              "calls"
            )
          }
          note="Recorded attempts"
        />

        <PerformanceMetric
          icon={CheckCircle2}
          label="Connected"
          value={
            metricValue(
              totals,
              "connected",
              "answeredCalls"
            )
          }
          note="Answered conversations"
        />

        <PerformanceMetric
          icon={BarChart3}
          label="Qualified"
          value={
            metricValue(
              totals,
              "qualified",
              "qualifiedLeads"
            )
          }
          note="Qualified opportunities"
        />

        <PerformanceMetric
          icon={CalendarCheck}
          label="Meetings"
          value={
            metricValue(
              totals,
              "meetings",
              "meetingsBooked"
            )
          }
          note="Meetings booked"
        />
      </section>

      <section className="rf-team-performance-layout">
        <div className="rf-team-performance-main">
          <section className="rf-team-performance-panel">
            <PanelTitle
              icon={Users}
              eyebrow="Leaderboard"
              title="Member performance"
              text={`${selectedRange.label} · ranked by meetings, qualified opportunities and connected calls.`}
            />

            {rankedRows.length ? (
              <div className="rf-team-performance-table-wrap">
                <div className="rf-team-performance-table">
                  <div className="row head">
                    <span>Member</span>
                    <span>Calls</span>
                    <span>Connected</span>
                    <span>Qualified</span>
                    <span>Meetings</span>
                    <span>Overdue</span>
                  </div>

                  {rankedRows.map(
                    (row, index) => (
                      <div
                        className="row"
                        key={
                          row.memberId ||
                          row.userId ||
                          row.id ||
                          `${row.name || "member"}-${index}`
                        }
                      >
                        <span className="member">
                          <i>
                            {index + 1}
                          </i>

                          <span>
                            <b>
                              {row.name ||
                                row.member?.name ||
                                row.email ||
                                "Team member"}
                            </b>

                            <small>
                              {formatLabel(
                                row.workspaceRole ||
                                  row.role ||
                                  row.member?.workspaceRole ||
                                  "caller"
                              )}
                            </small>
                          </span>
                        </span>

                        <NumberCell
                          value={
                            metricValue(
                              row,
                              "callAttempts",
                              "totalCalls",
                              "calls"
                            )
                          }
                        />

                        <NumberCell
                          value={
                            metricValue(
                              row,
                              "connected",
                              "answeredCalls"
                            )
                          }
                        />

                        <NumberCell
                          value={
                            metricValue(
                              row,
                              "qualified",
                              "qualifiedLeads"
                            )
                          }
                        />

                        <NumberCell
                          value={
                            metricValue(
                              row,
                              "meetings",
                              "meetingsBooked"
                            )
                          }
                        />

                        <NumberCell
                          value={
                            metricValue(
                              row,
                              "overdue",
                              "overdueTasks"
                            )
                          }
                          attention={
                            metricValue(
                              row,
                              "overdue",
                              "overdueTasks"
                            ) > 0
                          }
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <EmptyPerformance />
            )}
          </section>
        </div>

        <aside className="rf-team-performance-aside">
          <section className="rf-team-performance-panel spotlight">
            <PanelTitle
              icon={TrendingUp}
              eyebrow="Top performer"
              title="Current leader"
              text="Based on activity in the selected range."
            />

            {strongest ? (
              <div className="rf-top-performer">
                <span className="avatar">
                  {initials(
                    strongest.name ||
                      strongest.member?.name ||
                      strongest.email
                  )}
                </span>

                <h3>
                  {strongest.name ||
                    strongest.member?.name ||
                    strongest.email ||
                    "Team member"}
                </h3>

                <p>
                  {metricValue(
                    strongest,
                    "meetings",
                    "meetingsBooked"
                  )} meetings · {metricValue(
                    strongest,
                    "qualified",
                    "qualifiedLeads"
                  )} qualified · {metricValue(
                    strongest,
                    "connected",
                    "answeredCalls"
                  )} connected
                </p>

                <div className="rf-top-performer-score">
                  <span>Performance score</span>
                  <strong>
                    {performanceScore(
                      strongest
                    )}
                  </strong>
                </div>
              </div>
            ) : (
              <EmptyPerformance
                compact
              />
            )}
          </section>

          <section className="rf-team-performance-panel">
            <PanelTitle
              icon={AlertTriangle}
              eyebrow="Workload"
              title="Attention needed"
              text="Open overdue work across the team."
            />

            <div className="rf-workload-summary">
              <span>
                <b>
                  {metricValue(
                    totals,
                    "overdue",
                    "overdueTasks"
                  )}
                </b>
                <small>Overdue items</small>
              </span>

              <span>
                <b>
                  {rankedRows.filter(
                    (row) =>
                      metricValue(
                        row,
                        "overdue",
                        "overdueTasks"
                      ) > 0
                  ).length}
                </b>
                <small>Members affected</small>
              </span>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function PerformanceMetric({
  icon: Icon,
  label,
  value,
  note,
}) {
  return (
    <article>
      <span>
        <Icon size={15} />
      </span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </article>
  );
}

function PanelTitle({
  icon: Icon,
  eyebrow,
  title,
  text,
}) {
  return (
    <header className="rf-team-performance-panel-title">
      <span>
        <Icon size={14} />
      </span>

      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </header>
  );
}

function NumberCell({
  value,
  attention = false,
}) {
  return (
    <span
      className={
        attention
          ? "number attention"
          : "number"
      }
    >
      {value}
    </span>
  );
}

function EmptyPerformance({
  compact = false,
}) {
  return (
    <div
      className={
        compact
          ? "rf-team-performance-empty compact"
          : "rf-team-performance-empty"
      }
    >
      <Users size={18} />
      <strong>
        No team activity yet
      </strong>
      <p>
        Performance data appears after team members begin working assigned leads.
      </p>
    </div>
  );
}

function TeamPerformanceSkeleton() {
  return (
    <main className="rf-team-performance-page-v7 skeleton">
      <TeamPerformanceStyles />
      <div className="rf-tp-skeleton-header" />
      <div className="rf-tp-skeleton-metrics">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="rf-tp-skeleton-panel" />
    </main>
  );
}

function normalizeRows(response) {
  if (
    Array.isArray(
      response?.rows
    )
  ) {
    return response.rows;
  }

  if (
    Array.isArray(
      response?.performance
    )
  ) {
    return response.performance;
  }

  if (
    Array.isArray(
      response?.members
    )
  ) {
    return response.members;
  }

  if (
    Array.isArray(response)
  ) {
    return response;
  }

  return [];
}

function normalizeTotals(response) {
  if (
    response?.totals &&
    typeof response.totals ===
      "object"
  ) {
    return response.totals;
  }

  const rows =
    normalizeRows(response);

  return rows.reduce(
    (totals, row) => {
      totals.callAttempts +=
        metricValue(
          row,
          "callAttempts",
          "totalCalls",
          "calls"
        );

      totals.connected +=
        metricValue(
          row,
          "connected",
          "answeredCalls"
        );

      totals.qualified +=
        metricValue(
          row,
          "qualified",
          "qualifiedLeads"
        );

      totals.meetings +=
        metricValue(
          row,
          "meetings",
          "meetingsBooked"
        );

      totals.overdue +=
        metricValue(
          row,
          "overdue",
          "overdueTasks"
        );

      return totals;
    },
    {
      callAttempts: 0,
      connected: 0,
      qualified: 0,
      meetings: 0,
      overdue: 0,
    }
  );
}

function metricValue(
  source,
  ...keys
) {
  for (const key of keys) {
    const value =
      Number(
        source?.[key]
      );

    if (
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return 0;
}

function performanceScore(row) {
  return (
    metricValue(
      row,
      "meetings",
      "meetingsBooked"
    ) * 6 +
    metricValue(
      row,
      "qualified",
      "qualifiedLeads"
    ) * 4 +
    metricValue(
      row,
      "connected",
      "answeredCalls"
    )
  );
}

function canViewPerformance(
  user,
  role
) {
  const normalizedRole =
    String(
      role ||
        user?.workspaceRole ||
        user?.role ||
        ""
    )
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

  if (
    [
      "owner",
      "admin",
      "manager",
    ].some(
      (item) =>
        normalizedRole.includes(
          item
        )
    )
  ) {
    return true;
  }

  const permissions =
    Array.isArray(
      user?.permissions
    )
      ? user.permissions
      : [];

  return (
    permissions.includes("*") ||
    permissions.includes(
      "view_team_performance"
    )
  );
}

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function initials(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0)
    )
    .join("")
    .toUpperCase() || "RF";
}

function safeTeamPerformanceMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function TeamPerformanceStyles() {
  return (
    <style>{`
      .rf-team-performance-page-v7{
        --rftp-text:#191c1d;
        --rftp-text2:#4d4c59;
        --rftp-muted:#777784;
        --rftp-line:#e2e4e7;
        --rftp-primary:#4648d4;
        --rftp-primary-soft:#e8e9ff;
        --rftp-green:#087a51;
        --rftp-green-soft:#e4f7ee;
        --rftp-red:#ba1a1a;
        --rftp-red-soft:#ffedeb;
        --rftp-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rftp-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-team-performance-page-v7 *,
      .rf-team-performance-page-v7 *::before,
      .rf-team-performance-page-v7 *::after{box-sizing:border-box}

      @keyframes rftpSpin{to{transform:rotate(360deg)}}
      @keyframes rftpShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
      .rf-team-performance-page-v7 .spin{animation:rftpSpin .75s linear infinite}

      .rf-team-performance-header{
        min-height:140px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        padding:18px;
        margin-bottom:10px;
        color:#fff;
        background:
          radial-gradient(circle at 88% 14%,rgba(86,89,223,.26),transparent 32%),
          radial-gradient(circle at 14% 92%,rgba(107,56,212,.15),transparent 30%),
          #2e3132;
        border-radius:14px;
      }

      .rf-team-performance-heading{min-width:0;display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;gap:10px}
      .rf-team-performance-heading > span{width:44px;height:44px;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.11);border-radius:11px}
      .rf-team-performance-heading .eyebrow{margin:0 0 3px;color:#c9caff;font-size:5.8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .rf-team-performance-heading h1{margin:0;color:#fff;font:600 28px/35px Geist,Inter,sans-serif;letter-spacing:-.03em}
      .rf-team-performance-heading p:last-child{max-width:760px;margin:4px 0 0;color:rgba(244,246,247,.62);font-size:7px;line-height:12px}

      .rf-team-performance-actions{display:flex;align-items:center;gap:7px}
      .rf-range-switcher{display:flex;gap:3px;padding:4px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:8px}
      .rf-range-switcher button{min-height:30px;padding:5px 7px;color:rgba(255,255,255,.67);background:transparent;border:0;border-radius:6px;cursor:pointer;font-size:5.4px;font-weight:750}
      .rf-range-switcher button.active{color:#fff;background:rgba(255,255,255,.14)}
      .rf-team-performance-refresh{min-height:38px;display:inline-flex;align-items:center;gap:6px;padding:7px 10px;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:8px;cursor:pointer;font-size:5.8px;font-weight:750}
      .rf-team-performance-refresh:disabled{opacity:.43}

      .rf-team-performance-alert{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:7px;padding:9px 10px;margin-bottom:9px;color:#7c1d1d;background:var(--rftp-red-soft);border:1px solid #ffd0cc;border-radius:8px;font-size:6px}
      .rf-team-performance-alert button{min-height:27px;padding:4px 7px;color:#7c1d1d;background:#fff;border:1px solid #ffd0cc;border-radius:6px;cursor:pointer;font-size:5px;font-weight:750}

      .rf-team-performance-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}
      .rf-team-performance-metrics article{min-height:112px;display:grid;grid-template-columns:34px minmax(0,1fr);align-content:end;gap:8px;padding:11px;background:#fff;border:1px solid var(--rftp-line);border-radius:10px}
      .rf-team-performance-metrics article > span{width:34px;height:34px;display:grid;place-items:center;align-self:end;color:var(--rftp-primary);background:var(--rftp-primary-soft);border-radius:8px}
      .rf-team-performance-metrics article > div{display:grid;align-content:end}
      .rf-team-performance-metrics small{color:var(--rftp-muted);font-size:5px}
      .rf-team-performance-metrics strong{margin-top:2px;font:600 17px/22px Geist,Inter,sans-serif}
      .rf-team-performance-metrics p{margin:1px 0 0;color:var(--rftp-muted);font-size:4.9px}

      .rf-team-performance-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(270px,.55fr);align-items:start;gap:10px}
      .rf-team-performance-main,.rf-team-performance-aside{min-width:0;display:grid;gap:10px}
      .rf-team-performance-panel{min-width:0;padding:13px;background:#fff;border:1px solid var(--rftp-line);border-radius:11px;box-shadow:0 1px 3px rgba(25,28,29,.025)}
      .rf-team-performance-panel.spotlight{background:radial-gradient(circle at 90% 8%,rgba(70,72,212,.06),transparent 31%),#fff}
      .rf-team-performance-panel-title{min-height:52px;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:8px;padding-bottom:9px;margin-bottom:9px;border-bottom:1px solid #eff0f1}
      .rf-team-performance-panel-title > span{width:34px;height:34px;display:grid;place-items:center;color:var(--rftp-primary);background:var(--rftp-primary-soft);border-radius:8px}
      .rf-team-performance-panel-title small{color:var(--rftp-primary);font-size:5px;font-weight:800;text-transform:uppercase}
      .rf-team-performance-panel-title h2{margin:1px 0 0;font:600 13px/18px Geist,Inter,sans-serif}
      .rf-team-performance-panel-title p{margin:2px 0 0;color:var(--rftp-muted);font-size:5.5px;line-height:9px}

      .rf-team-performance-table-wrap{overflow-x:auto;border:1px solid var(--rftp-line);border-radius:8px}
      .rf-team-performance-table{min-width:760px}
      .rf-team-performance-table .row{min-height:55px;display:grid;grid-template-columns:minmax(220px,1fr) repeat(5,85px);align-items:center;gap:7px;padding:8px;border-bottom:1px solid #eff0f1;font-size:5.5px}
      .rf-team-performance-table .row.head{min-height:38px;color:#676873;background:#f7f8f9;font-size:5px;font-weight:800;text-transform:uppercase}
      .rf-team-performance-table .member{min-width:0;display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:7px}
      .rf-team-performance-table .member > i{width:28px;height:28px;display:grid;place-items:center;color:var(--rftp-primary);background:var(--rftp-primary-soft);border-radius:7px;font-size:5px;font-style:normal;font-weight:800}
      .rf-team-performance-table .member > span{min-width:0;display:grid}
      .rf-team-performance-table .member b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:5.8px}
      .rf-team-performance-table .member small{margin-top:2px;color:var(--rftp-muted);font-size:4.8px}
      .rf-team-performance-table .number{width:max-content;min-width:31px;padding:5px 6px;color:#555664;background:#f1f2f3;border-radius:6px;text-align:center;font-size:5.4px;font-weight:750}
      .rf-team-performance-table .number.attention{color:var(--rftp-red);background:var(--rftp-red-soft)}

      .rf-top-performer{display:grid;justify-items:center;text-align:center;padding:6px 2px 2px}
      .rf-top-performer .avatar{width:58px;height:58px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#5658df,#4648d4 58%,#6b38d4);border-radius:15px;box-shadow:0 10px 24px rgba(70,72,212,.15);font-size:10px;font-weight:800}
      .rf-top-performer h3{margin:8px 0 0;font:600 11px/15px Geist,Inter,sans-serif}
      .rf-top-performer p{margin:4px 0 0;color:var(--rftp-muted);font-size:5.4px;line-height:9px}
      .rf-top-performer-score{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding:9px;color:#55567a;background:var(--rftp-primary-soft);border-radius:8px}
      .rf-top-performer-score span{font-size:5px;font-weight:750}
      .rf-top-performer-score strong{font:600 15px/19px Geist,Inter,sans-serif}

      .rf-workload-summary{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .rf-workload-summary > span{min-height:78px;display:grid;align-content:center;padding:9px;background:#f7f8f9;border-radius:8px}
      .rf-workload-summary b{font:600 16px/20px Geist,Inter,sans-serif}
      .rf-workload-summary small{margin-top:2px;color:var(--rftp-muted);font-size:5px}

      .rf-team-performance-empty,.rf-team-performance-access{min-height:180px;display:grid;place-items:center;align-content:center;gap:5px;padding:22px;color:var(--rftp-muted);background:#f8f9fa;border:1px dashed #d8dade;border-radius:9px;text-align:center}
      .rf-team-performance-empty.compact{min-height:130px}
      .rf-team-performance-empty svg,.rf-team-performance-access svg{color:var(--rftp-primary)}
      .rf-team-performance-empty strong{color:var(--rftp-text);font-size:6.2px}
      .rf-team-performance-empty p,.rf-team-performance-access p{max-width:420px;margin:0;font-size:5.4px;line-height:9px}
      .rf-team-performance-access{min-height:380px;background:#fff;border-style:solid}
      .rf-team-performance-access h1{margin:4px 0 0;color:var(--rftp-text);font:600 19px/25px Geist,Inter,sans-serif}

      .rf-tp-skeleton-header,.rf-tp-skeleton-metrics i,.rf-tp-skeleton-panel{background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);background-size:220% 100%;animation:rftpShimmer 1.15s linear infinite}
      .rf-tp-skeleton-header{height:140px;margin-bottom:10px;border-radius:14px}
      .rf-tp-skeleton-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
      .rf-tp-skeleton-metrics i{height:112px;border-radius:10px}
      .rf-tp-skeleton-panel{height:340px;border-radius:11px}

      @media(max-width:1000px){
        .rf-team-performance-page-v7{padding:22px}
        .rf-team-performance-layout{grid-template-columns:1fr}
      }

      @media(max-width:760px){
        .rf-team-performance-header{align-items:flex-start;flex-direction:column}
        .rf-team-performance-actions{width:100%;justify-content:space-between}
        .rf-team-performance-metrics{grid-template-columns:1fr 1fr}
      }

      @media(max-width:620px){
        .rf-team-performance-page-v7{padding:18px 12px 80px}
        .rf-team-performance-header{padding:15px}
        .rf-team-performance-heading{grid-template-columns:1fr}
        .rf-team-performance-heading h1{font-size:23px;line-height:30px}
        .rf-team-performance-actions{align-items:stretch;flex-direction:column}
        .rf-range-switcher{width:100%}
        .rf-range-switcher button{flex:1}
        .rf-team-performance-refresh{width:100%;justify-content:center}
        .rf-tp-skeleton-metrics{grid-template-columns:1fr 1fr}
      }

      @media(max-width:420px){.rf-team-performance-metrics,.rf-workload-summary,.rf-tp-skeleton-metrics{grid-template-columns:1fr}}

      @media(prefers-reduced-motion:reduce){.rf-team-performance-page-v7,.rf-team-performance-page-v7 *, .rf-team-performance-page-v7 *::before,.rf-team-performance-page-v7 *::after{animation:none!important;transition-duration:.01ms!important}}
    `}</style>
  );
}
