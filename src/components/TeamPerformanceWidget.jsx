import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  api,
} from "../api";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Phone,
  RefreshCw,
  TrendingUp,
  Users,
} from "./icons";

const LOOKBACK_DAYS = 7;

export default function TeamPerformanceWidget() {
  const {
    user,
  } = useAuth();

  const permissions =
    Array.isArray(
      user?.permissions
    )
      ? user.permissions
      : [];

  const visible =
    permissions.includes("*") ||
    permissions.includes(
      "view_team_performance"
    );

  const [
    data,
    setData,
  ] = useState({
    rows: [],
    totals: {},
  });

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    updatedAt,
    setUpdatedAt,
  ] = useState(null);

  const load =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!visible) {
          return;
        }

        if (!silent) {
          setLoading(true);
        }

        setError("");

        const to =
          new Date();

        const from =
          new Date(
            to.getTime() -
              LOOKBACK_DAYS *
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
              Array.isArray(
                response?.rows
              )
                ? response.rows
                : [],
            totals:
              response?.totals &&
              typeof response.totals ===
                "object"
                ? response.totals
                : {},
          });

          setUpdatedAt(
            new Date()
          );
        } catch (
          requestError
        ) {
          setError(
            safePerformanceMessage(
              requestError?.message ||
                "Team performance could not be loaded."
            )
          );
        } finally {
          setLoading(false);
        }
      },
      [
        visible,
      ]
    );

  useEffect(
    () => {
      if (!visible) {
        return undefined;
      }

      void load();

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
          120_000
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
      visible,
      load,
    ]
  );

  const top =
    useMemo(
      () =>
        [...(
          data.rows ||
          []
        )]
          .sort(
            (a, b) =>
              Number(
                b.meetings ||
                  0
              ) -
                Number(
                  a.meetings ||
                    0
                ) ||
              Number(
                b.connected ||
                  0
              ) -
                Number(
                  a.connected ||
                    0
                )
          )
          .slice(
            0,
            4
          ),
      [
        data.rows,
      ]
    );

  const totals =
    data.totals ||
    {};

  if (!visible) {
    return null;
  }

  return (
    <section className="card mt24 rf-team-performance-widget-v7">
      <TeamPerformanceWidgetStyles />

      <header className="rftpw-header">
        <div className="rftpw-heading">
          <span>
            <Users size={16} />
          </span>

          <div>
            <small>
              Team pulse
            </small>

            <h3>
              Team performance
            </h3>

            <p>
              Last {LOOKBACK_DAYS} days · calls, connected conversations, meetings and overdue work.
            </p>
          </div>
        </div>

        <div className="rftpw-actions">
          <button
            type="button"
            onClick={() =>
              void load()
            }
            disabled={loading}
            aria-label="Refresh team performance"
            title="Refresh team performance"
          >
            <RefreshCw
              size={13}
              className={
                loading
                  ? "rftpw-spin"
                  : ""
              }
            />
          </button>

          <Link
            className="btn ghost small"
            to="/app/analytics"
          >
            Full analytics
            <ArrowRight size={12} />
          </Link>
        </div>
      </header>

      {error ? (
        <div
          className="rftpw-error"
          role="alert"
        >
          <AlertTriangle size={13} />

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

      <div className="rf-dashboard-team-summary rftpw-summary">
        <Metric
          icon={Phone}
          value={
            totals.callAttempts ||
            0
          }
          label="Calls"
        />

        <Metric
          icon={TrendingUp}
          value={
            totals.connected ||
            0
          }
          label="Connects"
        />

        <Metric
          icon={CalendarCheck}
          value={
            totals.meetings ||
            0
          }
          label="Meetings"
        />

        <Metric
          icon={AlertTriangle}
          value={
            totals.overdue ||
            0
          }
          label="Overdue"
          attention={
            Number(
              totals.overdue ||
                0
            ) > 0
          }
        />
      </div>

      {loading &&
      !top.length ? (
        <div className="rftpw-skeleton">
          <i />
          <i />
          <i />
        </div>
      ) : top.length ? (
        <div className="rf-dashboard-team-list rftpw-list">
          {top.map(
            (
              row,
              index
            ) => (
              <div
                key={
                  row.memberId ||
                  row.userId ||
                  `${row.name || "member"}-${index}`
                }
              >
                <span className="rftpw-person">
                  <i aria-hidden="true">
                    {initials(
                      row.name
                    )}
                  </i>

                  <span>
                    <b>
                      {row.name ||
                        "Team member"}
                    </b>

                    <small>
                      {Number(
                        row.callAttempts ||
                          0
                      )} calls · {Number(
                        row.connected ||
                          0
                      )} connects
                    </small>
                  </span>
                </span>

                <span className="rftpw-meetings">
                  <b>
                    {Number(
                      row.meetings ||
                        0
                    )}
                  </b>

                  <small>
                    meetings
                  </small>
                </span>

                <span
                  className={[
                    "badge",
                    Number(
                      row.overdue ||
                        0
                    )
                      ? "badge-red"
                      : "badge-green",
                  ].join(" ")}
                >
                  {Number(
                    row.overdue ||
                      0
                  )} overdue
                </span>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="rftpw-empty">
          <Users size={18} />

          <strong>
            No team activity yet
          </strong>

          <p>
            Team performance will appear after assigned callers begin working leads.
          </p>
        </div>
      )}

      {updatedAt ? (
        <footer className="rftpw-footer">
          Updated {formatTime(updatedAt)}
        </footer>
      ) : null}
    </section>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  attention = false,
}) {
  return (
    <span
      className={
        attention
          ? "attention"
          : ""
      }
    >
      <Icon
        size={14}
        aria-hidden="true"
      />

      <b>
        {Number(value || 0)}
      </b>

      <small>
        {label}
      </small>
    </span>
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

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat(
      undefined,
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(value);
  } catch {
    return "recently";
  }
}

function safePerformanceMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function TeamPerformanceWidgetStyles() {
  return (
    <style>{`
      .rf-team-performance-widget-v7{
        --rftpw-text:#191c1d;
        --rftpw-text2:#4d4c59;
        --rftpw-muted:#777784;
        --rftpw-line:#e2e4e7;
        --rftpw-primary:#4648d4;
        --rftpw-primary-soft:#e8e9ff;
        --rftpw-green:#087a51;
        --rftpw-green-soft:#e4f7ee;
        --rftpw-red:#ba1a1a;
        --rftpw-red-soft:#ffedeb;
        --rftpw-ease:cubic-bezier(.2,.8,.2,1);
        display:grid;
        gap:10px;
        padding:14px!important;
        color:var(--rftpw-text);
        background:
          radial-gradient(circle at 96% 4%,rgba(70,72,212,.05),transparent 29%),
          #fff!important;
        border:1px solid var(--rftpw-line)!important;
        border-radius:12px!important;
        box-shadow:0 1px 3px rgba(25,28,29,.025)!important;
      }

      .rf-team-performance-widget-v7 *,
      .rf-team-performance-widget-v7 *::before,
      .rf-team-performance-widget-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rftpwSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rftpwShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rftpw-spin{
        animation:rftpwSpin .75s linear infinite;
      }

      .rftpw-header{
        min-height:67px;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        padding-bottom:10px;
        border-bottom:1px solid #eff0f1;
      }

      .rftpw-heading{
        min-width:0;
        display:grid;
        grid-template-columns:38px minmax(0,1fr);
        align-items:center;
        gap:9px;
      }

      .rftpw-heading > span{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        color:var(--rftpw-primary);
        background:var(--rftpw-primary-soft);
        border-radius:9px;
      }

      .rftpw-heading > div{
        min-width:0;
        display:grid;
      }

      .rftpw-heading small{
        color:var(--rftpw-primary);
        font-size:5.3px;
        font-weight:800;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .rftpw-heading h3{
        margin:1px 0 0;
        font:600 14px/19px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rftpw-heading p{
        max-width:640px;
        margin:2px 0 0;
        color:var(--rftpw-muted);
        font-size:6px;
        line-height:10px;
      }

      .rftpw-actions{
        display:flex;
        align-items:center;
        gap:6px;
      }

      .rftpw-actions > button{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rftpw-text2);
        background:#fff;
        border:1px solid var(--rftpw-line);
        border-radius:8px;
        cursor:pointer;
      }

      .rftpw-actions > button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rftpw-actions .btn{
        min-height:34px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:6px 8px;
        color:var(--rftpw-text2);
        background:#fff;
        border:1px solid var(--rftpw-line);
        border-radius:8px;
        text-decoration:none;
        font-size:5.8px;
        font-weight:750;
      }

      .rftpw-error{
        display:grid;
        grid-template-columns:20px minmax(0,1fr) auto;
        align-items:center;
        gap:7px;
        padding:9px 10px;
        color:#7c1d1d;
        background:var(--rftpw-red-soft);
        border:1px solid #ffd0cc;
        border-radius:8px;
        font-size:6px;
        line-height:10px;
      }

      .rftpw-error button{
        min-height:28px;
        padding:4px 7px;
        color:#7c1d1d;
        background:#fff;
        border:1px solid #ffd0cc;
        border-radius:6px;
        cursor:pointer;
        font-size:5.3px;
        font-weight:750;
      }

      .rftpw-summary{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:7px!important;
      }

      .rftpw-summary > span{
        min-height:82px;
        display:grid!important;
        grid-template-columns:28px minmax(0,1fr)!important;
        align-content:center!important;
        gap:1px 7px!important;
        padding:9px!important;
        background:#f7f8f9!important;
        border:1px solid transparent!important;
        border-radius:9px!important;
      }

      .rftpw-summary > span > svg{
        grid-row:1 / span 2;
        align-self:center;
        color:var(--rftpw-primary);
      }

      .rftpw-summary > span b{
        font:600 16px/20px Geist,Inter,sans-serif!important;
      }

      .rftpw-summary > span small{
        color:var(--rftpw-muted)!important;
        font-size:5.3px!important;
      }

      .rftpw-summary > span.attention{
        background:var(--rftpw-red-soft)!important;
        border-color:#ffd5d1!important;
      }

      .rftpw-summary > span.attention > svg,
      .rftpw-summary > span.attention b{
        color:var(--rftpw-red)!important;
      }

      .rftpw-list{
        display:grid!important;
        gap:5px!important;
      }

      .rftpw-list > div{
        min-height:61px;
        display:grid!important;
        grid-template-columns:minmax(0,1fr) 70px auto!important;
        align-items:center!important;
        gap:8px!important;
        padding:8px 9px!important;
        background:#f7f8f9!important;
        border:1px solid transparent!important;
        border-radius:8px!important;
      }

      .rftpw-person{
        min-width:0;
        display:grid!important;
        grid-template-columns:34px minmax(0,1fr)!important;
        align-items:center!important;
        gap:7px!important;
      }

      .rftpw-person > i{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rftpw-primary);
        border-radius:8px;
        font-size:6px;
        font-style:normal;
        font-weight:800;
      }

      .rftpw-person > span,
      .rftpw-meetings{
        min-width:0;
        display:grid!important;
      }

      .rftpw-person b{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.3px!important;
      }

      .rftpw-person small,
      .rftpw-meetings small{
        margin-top:2px;
        color:var(--rftpw-muted)!important;
        font-size:5.2px!important;
      }

      .rftpw-meetings b{
        font-size:7px!important;
      }

      .rftpw-list .badge{
        width:max-content;
        padding:4px 6px;
        border-radius:999px;
        font-size:5.1px;
        font-weight:750;
      }

      .rftpw-list .badge-green{
        color:var(--rftpw-green);
        background:var(--rftpw-green-soft);
      }

      .rftpw-list .badge-red{
        color:var(--rftpw-red);
        background:var(--rftpw-red-soft);
      }

      .rftpw-skeleton{
        display:grid;
        gap:5px;
      }

      .rftpw-skeleton i{
        height:61px;
        display:block;
        background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);
        background-size:220% 100%;
        border-radius:8px;
        animation:rftpwShimmer 1.15s linear infinite;
      }

      .rftpw-empty{
        min-height:150px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:20px;
        color:var(--rftpw-muted);
        background:#f8f9fa;
        border:1px dashed #d8dade;
        border-radius:9px;
        text-align:center;
      }

      .rftpw-empty > svg{
        color:var(--rftpw-primary);
      }

      .rftpw-empty strong{
        color:var(--rftpw-text);
        font-size:6.5px;
      }

      .rftpw-empty p{
        max-width:360px;
        margin:0;
        font-size:5.6px;
        line-height:9px;
      }

      .rftpw-footer{
        color:var(--rftpw-muted);
        text-align:right;
        font-size:5px;
      }

      @media(max-width:820px){
        .rftpw-summary{
          grid-template-columns:1fr 1fr!important;
        }
      }

      @media(max-width:620px){
        .rftpw-header{
          align-items:stretch;
          flex-direction:column;
        }

        .rftpw-actions{
          display:grid;
          grid-template-columns:34px 1fr;
        }

        .rftpw-list > div{
          grid-template-columns:minmax(0,1fr) auto!important;
        }

        .rftpw-list .badge{
          grid-column:1 / -1;
          margin-left:41px;
        }
      }

      @media(max-width:420px){
        .rftpw-summary{
          grid-template-columns:1fr!important;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rftpw-spin,
        .rftpw-skeleton i{
          animation:none!important;
        }

        .rf-team-performance-widget-v7 *,
        .rf-team-performance-widget-v7 *::before,
        .rf-team-performance-widget-v7 *::after{
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
