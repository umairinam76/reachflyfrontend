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
  BarChart3,
  CheckCircle2,
  Mail,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from "../components/icons";

const METRIC_ICONS = [
  Users,
  Target,
  Mail,
  MessageCircle,
  TrendingUp,
];

export default function Analytics() {
  const [
    data,
    setData,
  ] = useState({
    metrics: [],
    funnel: [],
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

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
  ] = useState(null);

  const load =
    useCallback(
      async ({
        silent = false,
        announce = false,
      } = {}) => {
        if (
          silent
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        setError("");

        try {
          const response =
            await api.analytics();

          const next = {
            metrics:
              Array.isArray(
                response?.metrics
              )
                ? response.metrics
                : [],
            funnel:
              Array.isArray(
                response?.funnel
              )
                ? response.funnel
                : [],
          };

          setData(
            next
          );
          setLastUpdatedAt(
            new Date()
          );

          if (
            announce
          ) {
            notify(
              "success",
              "Analytics refreshed",
              "Your latest campaign and outreach metrics are now visible."
            );
          }
        } catch (
          requestError
        ) {
          const message =
            safeMessage(
              requestError?.message ||
                "Analytics could not be loaded."
            );

          setError(
            message
          );

          if (
            announce
          ) {
            notify(
              "error",
              "Analytics refresh failed",
              message
            );
          }
        } finally {
          setLoading(
            false
          );
          setRefreshing(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  const metrics =
    data.metrics;

  const funnel =
    data.funnel;

  const model =
    useMemo(
      () =>
        buildAnalyticsModel(
          metrics,
          funnel
        ),
      [
        funnel,
        metrics,
      ]
    );

  if (
    loading
  ) {
    return (
      <>
        <AnalyticsStyles />
        <AnalyticsSkeleton />
      </>
    );
  }

  return (
    <>
      <AnalyticsStyles />

      <main className="rf-analytics-v7">
        <header className="rfa-page-header">
          <div>
            <span className="rfa-eyebrow">
              Analytics
            </span>

            <h1>
              Campaign performance analytics.
            </h1>

            <p>
              Understand lead volume, outbound activity, inbound replies, and
              how the current campaign funnel is moving through ReachFly.
            </p>

            {lastUpdatedAt ? (
              <small>
                Updated{" "}
                {formatTime(
                  lastUpdatedAt
                )}
              </small>
            ) : null}
          </div>

          <div className="rfa-header-actions">
            <Link
              className="rfa-button secondary"
              to="/app/campaigns"
            >
              View campaigns
            </Link>

            <button
              type="button"
              className="rfa-button primary"
              disabled={
                refreshing
              }
              onClick={() =>
                void load({
                  silent:
                    true,
                  announce:
                    true,
                })
              }
            >
              <RefreshCw
                size={14}
                className={
                  refreshing
                    ? "rfa-spin"
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
          <section
            className="rfa-alert"
            role="alert"
          >
            <span>
              <X size={13} />
            </span>

            <div>
              <strong>
                Analytics need attention
              </strong>

              <p>
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError(
                  ""
                )
              }
              aria-label="Dismiss analytics error"
            >
              <X size={10} />
            </button>
          </section>
        ) : null}

        <section className="rfa-metric-grid">
          {metrics.length ? (
            metrics.map(
              (
                metric,
                index
              ) => (
                <MetricCard
                  key={
                    metric.label ||
                    index
                  }
                  metric={
                    metric
                  }
                  index={
                    index
                  }
                />
              )
            )
          ) : (
            <MetricPlaceholder />
          )}
        </section>

        <section className="rfa-layout">
          <div className="rfa-main">
            <section className="rfa-card rfa-funnel-card">
              <CardHeader
                icon={
                  <BarChart3 size={17} />
                }
                eyebrow="Conversion path"
                title="Campaign funnel"
                text="Each stage is returned by the real ReachFly analytics endpoint."
              />

              {funnel.length ? (
                <div className="rfa-funnel">
                  {funnel.map(
                    (
                      item,
                      index
                    ) => (
                      <FunnelRow
                        key={
                          item.label ||
                          index
                        }
                        item={
                          item
                        }
                        index={
                          index
                        }
                        maxValue={
                          model.maxFunnelValue
                        }
                      />
                    )
                  )}
                </div>
              ) : (
                <EmptyAnalytics
                  title="No funnel activity yet"
                  text="Campaign funnel stages will appear after ReachFly has lead and outreach activity to report."
                />
              )}
            </section>

            <section className="rfa-card">
              <CardHeader
                icon={
                  <TrendingUp size={17} />
                }
                eyebrow="Performance"
                title="Current conversion signals"
                text="Derived from the values already returned by your analytics response."
              />

              <div className="rfa-signal-grid">
                <SignalCard
                  label="Lead → message"
                  value={
                    formatPercent(
                      model.messageRate
                    )
                  }
                  text="Share of discovered leads represented by outbound activity."
                />

                <SignalCard
                  label="Message → reply"
                  value={
                    formatPercent(
                      model.replyRate
                    )
                  }
                  text="Inbound replies relative to outbound messages."
                />

                <SignalCard
                  label="Pipeline completion"
                  value={
                    formatPercent(
                      model.pipelineRate
                    )
                  }
                  text="Completed campaign pipelines relative to campaigns created."
                />
              </div>
            </section>
          </div>

          <aside className="rfa-aside">
            <section className="rfa-card rfa-insight-card">
              <span>
                <Sparkles size={17} />
              </span>

              <div>
                <small>
                  ReachFly insight
                </small>

                <h2>
                  {model.insight.title}
                </h2>

                <p>
                  {model.insight.text}
                </p>
              </div>
            </section>

            <section className="rfa-card">
              <CardHeader
                icon={
                  <Target size={17} />
                }
                eyebrow="Next steps"
                title="Where to look next"
                text="Use the related ReachFly screens to inspect the records behind these totals."
              />

              <div className="rfa-links">
                <ActionLink
                  to="/app/campaigns"
                  icon={
                    Target
                  }
                  title="Campaigns"
                  text="Inspect campaign status and pipeline progress."
                />

                <ActionLink
                  to="/app/inbox"
                  icon={
                    Mail
                  }
                  title="Inbox"
                  text="Review outbound activity and inbound replies."
                />

                <ActionLink
                  to="/app/contacts"
                  icon={
                    Users
                  }
                  title="Contacts"
                  text="Review the leads and people behind campaign activity."
                />
              </div>
            </section>
          </aside>
        </section>
      </main>
    </>
  );
}

function MetricCard({
  metric,
  index,
}) {
  const Icon =
    METRIC_ICONS[
      index %
        METRIC_ICONS.length
    ];

  return (
    <article className="rfa-metric-card">
      <header>
        <span>
          <Icon size={16} />
        </span>

        <small>
          {metric.note ||
            "Current"}
        </small>
      </header>

      <strong>
        {formatValue(
          metric.value
        )}
      </strong>

      <p>
        {metric.label ||
          "Metric"}
      </p>
    </article>
  );
}

function MetricPlaceholder() {
  return (
    <article className="rfa-metric-card empty">
      <header>
        <span>
          <BarChart3 size={16} />
        </span>
      </header>

      <strong>
        —
      </strong>

      <p>
        No analytics metrics returned
      </p>
    </article>
  );
}

function CardHeader({
  icon,
  eyebrow,
  title,
  text,
}) {
  return (
    <header className="rfa-card-header">
      <span>
        {icon}
      </span>

      <div>
        <small>
          {eyebrow}
        </small>

        <h2>
          {title}
        </h2>

        <p>
          {text}
        </p>
      </div>
    </header>
  );
}

function FunnelRow({
  item,
  index,
  maxValue,
}) {
  const percent =
    clamp(
      Number(
        item.percent
      ) ||
        0,
      0,
      100
    );

  const relative =
    maxValue >
      0
      ? clamp(
          (
            Number(
              item.value
            ) /
            maxValue
          ) *
            100,
          0,
          100
        )
      : 0;

  const width =
    Math.max(
      4,
      percent ||
        relative
    );

  return (
    <article className="rfa-funnel-row">
      <span className="rfa-funnel-step">
        0{index + 1}
      </span>

      <div>
        <header>
          <strong>
            {item.label ||
              `Stage ${index + 1}`}
          </strong>

          <span>
            {formatValue(
              item.value
            )}{" "}
            ·{" "}
            {formatPercent(
              percent
            )}
          </span>
        </header>

        <div className="rfa-funnel-track">
          <i
            style={{
              width:
                `${width}%`,
            }}
          />
        </div>
      </div>
    </article>
  );
}

function SignalCard({
  label,
  value,
  text,
}) {
  return (
    <article>
      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>

      <p>
        {text}
      </p>
    </article>
  );
}

function ActionLink({
  to,
  icon: Icon,
  title,
  text,
}) {
  return (
    <Link
      className="rfa-action-link"
      to={
        to
      }
    >
      <span>
        <Icon size={14} />
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <small>
          {text}
        </small>
      </div>

      <CheckCircle2 size={12} />
    </Link>
  );
}

function EmptyAnalytics({
  title,
  text,
}) {
  return (
    <div className="rfa-empty">
      <span>
        <BarChart3 size={20} />
      </span>

      <strong>
        {title}
      </strong>

      <p>
        {text}
      </p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <main className="rf-analytics-v7">
      <header className="rfa-page-header">
        <div>
          <span className="rfa-eyebrow">
            Analytics
          </span>

          <h1>
            Campaign performance analytics.
          </h1>

          <p>
            Loading workspace analytics…
          </p>
        </div>
      </header>

      <section className="rfa-skeleton-grid">
        <i />
        <i />
        <i />
        <i />
      </section>

      <section className="rfa-skeleton-panel">
        <i />
      </section>
    </main>
  );
}

function buildAnalyticsModel(
  metrics,
  funnel
) {
  const metricMap =
    new Map(
      metrics.map(
        (
          metric
        ) => [
          normalizeKey(
            metric.label
          ),
          Number(
            metric.value
          ) ||
            0,
        ]
      )
    );

  const funnelMap =
    new Map(
      funnel.map(
        (
          item
        ) => [
          normalizeKey(
            item.label
          ),
          item,
        ]
      )
    );

  const campaigns =
    metricMap.get(
      "campaigns"
    ) ||
    0;

  const leads =
    metricMap.get(
      "leads"
    ) ||
    Number(
      funnelMap.get(
        "leadsdiscovered"
      )?.value
    ) ||
    0;

  const messages =
    metricMap.get(
      "messages"
    ) ||
    Number(
      funnelMap.get(
        "messagessent"
      )?.value
    ) ||
    0;

  const replies =
    metricMap.get(
      "replies"
    ) ||
    Number(
      funnelMap.get(
        "replies"
      )?.value
    ) ||
    0;

  const pipelineComplete =
    Number(
      funnelMap.get(
        "pipelinecomplete"
      )?.value
    ) ||
    0;

  const messageRate =
    leads
      ? (
          messages /
          leads
        ) *
        100
      : 0;

  const replyRate =
    messages
      ? (
          replies /
          messages
        ) *
        100
      : 0;

  const pipelineRate =
    campaigns
      ? (
          pipelineComplete /
          campaigns
        ) *
        100
      : 0;

  const maxFunnelValue =
    Math.max(
      0,
      ...funnel.map(
        (
          item
        ) =>
          Number(
            item.value
          ) ||
          0
      )
    );

  let insight = {
    title:
      "Build enough activity to expose the funnel.",
    text:
      "ReachFly will show clearer conversion signals after campaigns generate leads, outbound activity, replies, and completed pipeline stages.",
  };

  if (
    messages >
      0 &&
    replies ===
      0
  ) {
    insight = {
      title:
        "Outbound activity has not produced replies yet.",
      text:
        "Review campaign targeting and the conversation context behind your outbound messages before simply increasing volume.",
    };
  } else if (
    replyRate >
      0
  ) {
    insight = {
      title:
        `Current reply rate is ${formatPercent(
          replyRate
        )}.`,
      text:
        "Use the Inbox and campaign detail screens to inspect which campaigns and conversations are producing those inbound responses.",
    };
  } else if (
    leads >
      0 &&
    messages ===
      0
  ) {
    insight = {
      title:
        "You have leads without outbound activity.",
      text:
        "Open your campaigns to review pipeline readiness, channel setup, and the next supported outreach action.",
    };
  }

  return {
    campaigns,
    leads,
    messages,
    replies,
    pipelineComplete,
    messageRate,
    replyRate,
    pipelineRate,
    maxFunnelValue,
    insight,
  };
}

function normalizeKey(
  value
) {
  return String(
    value ||
      ""
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ""
    );
}

function formatValue(
  value
) {
  const number =
    Number(
      value
    );

  if (
    Number.isFinite(
      number
    )
  ) {
    return new Intl.NumberFormat().format(
      number
    );
  }

  return value ??
    "—";
}

function formatPercent(
  value
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0%";
  }

  return `${Math.round(
    number *
      10
  ) /
    10}%`;
}

function formatTime(
  value
) {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "recently";
  }

  return date.toLocaleTimeString(
    undefined,
    {
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  );
}

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

function safeMessage(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /ElevenLabs/gi,
      "voice service"
    )
    .replace(
      /Telnyx/gi,
      "calling service"
    )
    .replace(
      /\bSIP\b/gi,
      "voice connection"
    );
}

function notify(
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
    typeof bridge[
      type
    ] ===
      "function"
  ) {
    bridge[
      type
    ](
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

function AnalyticsStyles() {
  return (
    <style>{`
      .rf-analytics-v7{
        --rfa-card:#fff;
        --rfa-soft:#f3f4f5;
        --rfa-text:#191c1d;
        --rfa-text2:#4d4c59;
        --rfa-muted:#777784;
        --rfa-line:#e2e4e7;
        --rfa-primary:#4648d4;
        --rfa-primary-dark:#3739bd;
        --rfa-primary-soft:#e8e9ff;
        --rfa-violet:#6b38d4;
        --rfa-violet-soft:#f0eaff;
        --rfa-red:#ba1a1a;
        --rfa-red-soft:#ffedeb;
        --rfa-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 44px;
        color:var(--rfa-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfaPageIn .24s var(--rfa-ease);
      }

      .rf-analytics-v7 *,
      .rf-analytics-v7 *::before,
      .rf-analytics-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfaPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfaSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfaShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfa-spin{
        animation:rfaSpin .75s linear infinite;
      }

      .rfa-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:18px;
      }

      .rfa-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfa-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfa-page-header h1{
        margin:0;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rfa-page-header p{
        max-width:760px;
        margin:4px 0 0;
        color:var(--rfa-text2);
        font-size:12px;
        line-height:18px;
      }

      .rfa-page-header > div:first-child > small{
        display:block;
        margin-top:7px;
        color:var(--rfa-muted);
        font-size:6px;
      }

      .rfa-header-actions{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rfa-button{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        text-decoration:none;
        font-size:7px;
        font-weight:700;
        transition:.14s var(--rfa-ease);
      }

      .rfa-button:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfa-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfa-button.primary{
        color:#fff;
        background:var(--rfa-primary);
        border-color:var(--rfa-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rfa-button.primary:hover:not(:disabled){
        background:var(--rfa-primary-dark);
      }

      .rfa-button.secondary{
        color:var(--rfa-text);
        background:#fff;
        border-color:var(--rfa-line);
      }

      .rfa-alert{
        display:grid;
        grid-template-columns:27px minmax(0,1fr) 24px;
        align-items:start;
        gap:8px;
        padding:10px 11px;
        margin-bottom:11px;
        color:#7f1b1b;
        background:var(--rfa-red-soft);
        border:1px solid #ffd0cc;
        border-radius:9px;
      }

      .rfa-alert > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:7px;
      }

      .rfa-alert strong{
        display:block;
        font-size:7px;
      }

      .rfa-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rfa-alert > button{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        padding:0;
        color:currentColor;
        background:transparent;
        border:0;
        cursor:pointer;
      }

      .rfa-metric-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:9px;
        margin-bottom:13px;
      }

      .rfa-metric-card{
        min-height:144px;
        display:grid;
        align-content:space-between;
        padding:14px;
        background:#fff;
        border:1px solid var(--rfa-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rfa-metric-card > header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .rfa-metric-card > header > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfa-primary);
        background:var(--rfa-primary-soft);
        border-radius:8px;
      }

      .rfa-metric-card > header small{
        color:var(--rfa-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rfa-metric-card > strong{
        margin-top:17px;
        font:600 26px/31px Geist,Inter,sans-serif;
      }

      .rfa-metric-card > p{
        margin:3px 0 0;
        color:var(--rfa-text2);
        font-size:7px;
        font-weight:700;
      }

      .rfa-metric-card.empty{
        grid-column:span 1;
      }

      .rfa-layout{
        display:grid;
        grid-template-columns:minmax(0,1fr) 310px;
        align-items:start;
        gap:13px;
      }

      .rfa-main,
      .rfa-aside{
        display:grid;
        gap:13px;
      }

      .rfa-aside{
        position:sticky;
        top:78px;
      }

      .rfa-card{
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfa-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rfa-card-header{
        min-height:78px;
        display:grid;
        grid-template-columns:37px minmax(0,1fr);
        align-items:center;
        gap:9px;
        padding:13px 15px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfa-line);
      }

      .rfa-card-header > span{
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
        color:var(--rfa-primary);
        background:var(--rfa-primary-soft);
        border-radius:9px;
      }

      .rfa-card-header > div{
        display:grid;
      }

      .rfa-card-header small{
        color:var(--rfa-primary);
        font-size:5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfa-card-header h2{
        margin:1px 0 0;
        font:600 11px/15px Geist,Inter,sans-serif;
      }

      .rfa-card-header p{
        margin:2px 0 0;
        color:var(--rfa-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfa-funnel{
        display:grid;
        padding:10px 14px 14px;
      }

      .rfa-funnel-row{
        min-height:78px;
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        align-items:center;
        gap:9px;
        padding:10px 0;
      }

      .rfa-funnel-row + .rfa-funnel-row{
        border-top:1px solid #eff0f1;
      }

      .rfa-funnel-step{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfa-primary);
        background:var(--rfa-primary-soft);
        border-radius:8px;
        font-size:5.5px;
        font-weight:800;
      }

      .rfa-funnel-row > div{
        min-width:0;
      }

      .rfa-funnel-row header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:9px;
      }

      .rfa-funnel-row header strong{
        font-size:7px;
      }

      .rfa-funnel-row header span{
        color:var(--rfa-muted);
        font-size:6px;
      }

      .rfa-funnel-track{
        height:8px;
        overflow:hidden;
        margin-top:7px;
        background:#eff0f2;
        border-radius:999px;
      }

      .rfa-funnel-track i{
        display:block;
        height:100%;
        background:linear-gradient(90deg,#595be0,#4648d4);
        border-radius:999px;
        transition:width .35s var(--rfa-ease);
      }

      .rfa-signal-grid{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:8px;
        padding:13px;
      }

      .rfa-signal-grid article{
        min-height:130px;
        display:grid;
        align-content:start;
        padding:12px;
        background:#f6f7f8;
        border-radius:9px;
      }

      .rfa-signal-grid strong{
        color:var(--rfa-primary);
        font:600 22px/27px Geist,Inter,sans-serif;
      }

      .rfa-signal-grid span{
        margin-top:5px;
        font-size:6.5px;
        font-weight:700;
      }

      .rfa-signal-grid p{
        margin:4px 0 0;
        color:var(--rfa-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfa-insight-card{
        display:grid;
        grid-template-columns:37px minmax(0,1fr);
        gap:9px;
        padding:14px;
        color:var(--rfa-violet);
        background:
          linear-gradient(135deg,#f1ecff,#faf8ff);
        border-color:#e2d7f7;
      }

      .rfa-insight-card > span{
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:9px;
      }

      .rfa-insight-card > div{
        min-width:0;
      }

      .rfa-insight-card small{
        color:var(--rfa-violet);
        font-size:5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfa-insight-card h2{
        margin:3px 0 0;
        color:var(--rfa-text);
        font:600 11px/16px Geist,Inter,sans-serif;
      }

      .rfa-insight-card p{
        margin:5px 0 0;
        color:var(--rfa-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rfa-links{
        display:grid;
        gap:6px;
        padding:10px;
      }

      .rfa-action-link{
        min-height:65px;
        display:grid;
        grid-template-columns:33px minmax(0,1fr) 16px;
        align-items:center;
        gap:8px;
        padding:8px;
        color:inherit;
        background:#f6f7f8;
        border:1px solid transparent;
        border-radius:8px;
        text-decoration:none;
        transition:.13s var(--rfa-ease);
      }

      .rfa-action-link:hover{
        background:#f0f0fb;
        border-color:#ddddff;
      }

      .rfa-action-link > span{
        width:33px;
        height:33px;
        display:grid;
        place-items:center;
        color:var(--rfa-primary);
        background:#fff;
        border-radius:8px;
      }

      .rfa-action-link > div{
        min-width:0;
        display:grid;
      }

      .rfa-action-link strong{
        font-size:6.5px;
      }

      .rfa-action-link small{
        margin-top:1px;
        color:var(--rfa-muted);
        font-size:5.5px;
        line-height:9px;
      }

      .rfa-action-link > svg{
        color:#a0a1a9;
      }

      .rfa-empty{
        min-height:220px;
        display:grid;
        place-items:center;
        align-content:center;
        padding:24px;
        text-align:center;
      }

      .rfa-empty > span{
        width:47px;
        height:47px;
        display:grid;
        place-items:center;
        color:var(--rfa-primary);
        background:var(--rfa-primary-soft);
        border-radius:12px;
      }

      .rfa-empty strong{
        margin-top:10px;
        font-size:8px;
      }

      .rfa-empty p{
        max-width:390px;
        margin:4px 0 0;
        color:var(--rfa-muted);
        font-size:6.5px;
        line-height:11px;
      }

      .rfa-skeleton-grid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:9px;
      }

      .rfa-skeleton-grid i,
      .rfa-skeleton-panel i{
        display:block;
        background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);
        background-size:220% 100%;
        border-radius:10px;
        animation:rfaShimmer 1.2s linear infinite;
      }

      .rfa-skeleton-grid i{
        height:144px;
      }

      .rfa-skeleton-panel{
        margin-top:13px;
      }

      .rfa-skeleton-panel i{
        height:390px;
      }

      @media(max-width:1060px){
        .rf-analytics-v7{
          padding:22px;
        }

        .rfa-layout{
          grid-template-columns:minmax(0,1fr) 270px;
        }
      }

      @media(max-width:880px){
        .rfa-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfa-metric-grid{
          grid-template-columns:1fr 1fr;
        }

        .rfa-layout{
          grid-template-columns:1fr;
        }

        .rfa-aside{
          position:static;
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:620px){
        .rf-analytics-v7{
          padding:18px 12px 80px;
        }

        .rfa-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfa-page-header p{
          font-size:10px;
          line-height:16px;
        }

        .rfa-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
          width:100%;
        }

        .rfa-metric-grid,
        .rfa-skeleton-grid{
          grid-template-columns:1fr 1fr;
        }

        .rfa-signal-grid{
          grid-template-columns:1fr;
        }

        .rfa-aside{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:410px){
        .rfa-metric-grid,
        .rfa-skeleton-grid{
          grid-template-columns:1fr;
        }

        .rfa-header-actions{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-analytics-v7,
        .rfa-spin,
        .rfa-skeleton-grid i,
        .rfa-skeleton-panel i{
          animation:none!important;
        }

        .rf-analytics-v7 *,
        .rf-analytics-v7 *::before,
        .rf-analytics-v7 *::after{
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
