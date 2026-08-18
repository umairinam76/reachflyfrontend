import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Inbox,
  Mail,
  Megaphone,
  Phone,
  PhoneCall,
  Play,
  RefreshCw,
  Sparkles,
  UserRoundPlus,
  UsersRound,
  WalletCards,
  XCircle,
} from "lucide-react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 Days" },
  { value: 30, label: "Last 30 Days" },
  { value: 90, label: "Last 90 Days" },
];

const PERFORMANCE_RANGES = [7, 30, 90];

const EMPTY_DATA = Object.freeze({
  base: {},
  voice: {},
  commerce: {},
  billing: {},
  connections: {},
  analytics: {},
  campaigns: {},
  inbox: {},
  contacts: {},
});

const PAGE_TRANSITION = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.055,
    },
  },
};

const ITEM_TRANSITION = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.38,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function DashboardV6() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState(7);
  const [performanceRange, setPerformanceRange] = useState(30);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const load = useCallback(
    async ({ silent = false, announce = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const requests = [
        ["base", api.dashboard],
        ["voice", api.voiceAgentDashboard],
        ["commerce", api.voiceCommerce],
        ["billing", api.billingCredits],
        ["connections", api.connections],
        ["analytics", api.analytics],
        ["campaigns", api.campaigns],
        ["inbox", api.inbox],
        ["contacts", api.contacts],
      ];

      try {
        const results = await Promise.allSettled(
          requests.map(([, request]) => request())
        );

        const next = {};
        const failures = [];

        results.forEach((result, index) => {
          const key = requests[index][0];

          if (result.status === "fulfilled") {
            next[key] = result.value || {};
          } else {
            failures.push(key);
          }
        });

        setData((current) => ({
          ...current,
          ...next,
        }));

        const criticalFailure =
          !next.base &&
          !next.analytics &&
          !next.voice;

        if (criticalFailure) {
          const message =
            "We couldn't refresh your sales dashboard. Your existing data is still shown where available.";
          setError(message);

          if (announce) {
            toast("error", "Dashboard refresh failed", message);
          }
        } else {
          setLastUpdatedAt(new Date());

          if (announce) {
            if (failures.length) {
              toast(
                "warning",
                "Dashboard partially refreshed",
                "Core sales data is up to date. One or more optional workspace services did not respond."
              );
            } else {
              toast(
                "success",
                "Dashboard refreshed",
                "Your latest ReachFly activity is now visible."
              );
            }
          }
        }
      } catch (requestError) {
        const message =
          requestError?.message ||
          "We couldn't refresh your sales dashboard.";

        setError(message);

        if (announce) {
          toast("error", "Dashboard refresh failed", message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [load]);

  const model = useMemo(
    () => buildDashboardModel(data, dateRange, performanceRange),
    [data, dateRange, performanceRange]
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  const pageMotion = reduceMotion
    ? { initial: false, animate: "show" }
    : { initial: "hidden", animate: "show" };

  return (
    <>
      <style>{DASHBOARD_STYLES}</style>

      <motion.main
        className="rf7-dashboard-page"
        variants={PAGE_TRANSITION}
        {...pageMotion}
      >
        <motion.section
          className="rf7-dashboard-heading"
          variants={ITEM_TRANSITION}
        >
          <div className="rf7-dashboard-heading-copy">
            <h1>
              {greeting()}, {firstName(user?.name)}.
            </h1>
            <p>Here’s what’s happening across your sales engine.</p>
          </div>

          <div className="rf7-dashboard-heading-actions">
            <div className="rf7-dashboard-range-wrap">
              <button
                type="button"
                className="rf7-dashboard-range"
                aria-haspopup="menu"
                aria-expanded={rangeOpen}
                onClick={() => setRangeOpen((current) => !current)}
              >
                <CalendarDays aria-hidden="true" />
                <span>{rangeLabel(dateRange)}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={rangeOpen ? "is-open" : ""}
                />
              </button>

              <AnimatePresence>
                {rangeOpen ? (
                  <motion.div
                    className="rf7-dashboard-range-menu"
                    role="menu"
                    initial={
                      reduceMotion
                        ? false
                        : { opacity: 0, y: -6, scale: 0.98 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      reduceMotion
                        ? undefined
                        : { opacity: 0, y: -4, scale: 0.985 }
                    }
                    transition={{ duration: 0.16 }}
                  >
                    {RANGE_OPTIONS.map((option) => (
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={dateRange === option.value}
                        key={option.value}
                        className={
                          dateRange === option.value ? "active" : ""
                        }
                        onClick={() => {
                          setDateRange(option.value);
                          setRangeOpen(false);
                        }}
                      >
                        <span>{option.label}</span>
                        {dateRange === option.value ? (
                          <CheckCircle2 aria-hidden="true" />
                        ) : null}
                      </button>
                    ))}

                    <div className="rf7-dashboard-range-divider" />

                    <button
                      type="button"
                      className="rf7-dashboard-refresh-row"
                      onClick={() => {
                        setRangeOpen(false);
                        void load({ silent: true, announce: true });
                      }}
                    >
                      <RefreshCw
                        aria-hidden="true"
                        className={refreshing ? "is-spinning" : ""}
                      />
                      <span>
                        {refreshing ? "Refreshing…" : "Refresh dashboard"}
                      </span>
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <Link
              className="rf7-dashboard-primary-action"
              to="/app/launch-campaign"
            >
              <Play aria-hidden="true" />
              <span>Start Campaign</span>
            </Link>
          </div>
        </motion.section>

        <AnimatePresence initial={false}>
          {error ? (
            <motion.div
              className="rf7-dashboard-inline-error"
              role="alert"
              initial={
                reduceMotion ? false : { opacity: 0, y: -8, height: 0 }
              }
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={
                reduceMotion
                  ? undefined
                  : { opacity: 0, y: -6, height: 0 }
              }
            >
              <XCircle aria-hidden="true" />
              <div>
                <strong>Some dashboard data couldn’t be refreshed.</strong>
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => void load({ silent: true, announce: true })}
              >
                Retry
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.section
          className="rf7-dashboard-kpis"
          variants={ITEM_TRANSITION}
          aria-label="Sales summary"
        >
          <MetricCard
            icon={UserRoundPlus}
            label="New Leads"
            value={model.newLeads.value}
            trend={model.newLeads.trend}
            spark={model.newLeads.spark}
            delay={0}
            reduceMotion={reduceMotion}
          />

          <MetricCard
            icon={BadgeCheck}
            label="Qualified"
            value={model.qualified.value}
            trend={model.qualified.trend}
            spark={model.qualified.spark}
            delay={0.04}
            reduceMotion={reduceMotion}
          />

          <MetricCard
            icon={Mail}
            label="Replies"
            value={model.replies.value}
            trend={model.replies.trend}
            spark={model.replies.spark}
            tone="neutral"
            delay={0.08}
            reduceMotion={reduceMotion}
          />

          <MetricCard
            icon={CalendarDays}
            label="Meetings Booked"
            value={model.meetings.value}
            trend={model.meetings.trend}
            spark={model.meetings.spark}
            featured
            delay={0.12}
            reduceMotion={reduceMotion}
          />
        </motion.section>

        <motion.section
          className="rf7-dashboard-main-grid"
          variants={ITEM_TRANSITION}
        >
          <article className="rf7-dashboard-card rf7-dashboard-performance">
            <div className="rf7-dashboard-card-heading rf7-dashboard-performance-heading">
              <div>
                <h2>Sales Performance</h2>
                {lastUpdatedAt ? (
                  <span className="rf7-dashboard-updated">
                    Updated {relativeTime(lastUpdatedAt)}
                  </span>
                ) : null}
              </div>

              <div
                className="rf7-dashboard-segmented"
                aria-label="Performance period"
              >
                {PERFORMANCE_RANGES.map((range) => (
                  <button
                    type="button"
                    key={range}
                    className={
                      performanceRange === range ? "active" : ""
                    }
                    onClick={() => setPerformanceRange(range)}
                  >
                    {range}D
                  </button>
                ))}
              </div>
            </div>

            <PerformanceChart
              values={model.performance.values}
              reduceMotion={reduceMotion}
              empty={model.performance.empty}
            />

            <div className="rf7-dashboard-performance-footer">
              <div>
                <span className="rf7-dashboard-chart-dot" />
                <span>{model.performance.label}</span>
              </div>
              <strong>{model.performance.formattedTotal}</strong>
            </div>
          </article>

          <AgentCard
            agent={model.primaryAgent}
            calls={model.agentCalls}
            emails={model.emailsSent}
            meetings={model.agentMeetings}
            reduceMotion={reduceMotion}
          />
        </motion.section>

        <motion.section
          className="rf7-dashboard-lower-grid"
          variants={ITEM_TRANSITION}
        >
          <FunnelCard funnel={model.funnel} reduceMotion={reduceMotion} />
          <AttentionCard items={model.attention} reduceMotion={reduceMotion} />
        </motion.section>

        <motion.section
          className="rf7-dashboard-preserve-grid"
          variants={ITEM_TRANSITION}
        >
          <WorkspaceReadinessCard
            phoneConnected={model.phoneConnected}
            phoneDetail={model.phoneDetail}
            emailConnected={model.emailConnected}
            emailCount={model.emailCount}
            calendarConnected={model.calendarConnected}
            calendarCount={model.calendarCount}
            whatsappConnected={model.whatsappConnected}
            credits={model.credits}
          />

          <WorkforceCard
            agents={model.agents}
            calls={model.calls}
            queue={model.queue}
          />
        </motion.section>
      </motion.main>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  spark,
  featured = false,
  tone = "primary",
  delay = 0,
  reduceMotion = false,
}) {
  const trendDirection = Number(trend?.value || 0);
  const isPositive = trendDirection >= 0;
  const cardClass = [
    "rf7-dashboard-kpi",
    featured ? "featured" : "",
    tone === "neutral" ? "neutral" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.article
      className={cardClass}
      initial={
        reduceMotion
          ? false
          : { opacity: 0, y: 14, scale: 0.985 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.36,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -3, transition: { duration: 0.16 } }
      }
    >
      <div className="rf7-dashboard-kpi-label">
        <span className="rf7-dashboard-kpi-icon">
          <Icon aria-hidden="true" />
        </span>
        <span>{label}</span>
      </div>

      <div className="rf7-dashboard-kpi-value-row">
        <motion.strong
          key={`${label}-${value}`}
          initial={reduceMotion ? false : { opacity: 0.4, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {formatNumber(value)}
        </motion.strong>

        {trend?.display ? (
          <span
            className={`rf7-dashboard-trend ${
              isPositive ? "positive" : "negative"
            }`}
          >
            <span>{isPositive ? "↗" : "↘"}</span>
            {trend.display}
          </span>
        ) : null}
      </div>

      <MiniSparkline
        values={spark}
        featured={featured}
        neutral={tone === "neutral"}
        reduceMotion={reduceMotion}
      />
    </motion.article>
  );
}

function MiniSparkline({
  values,
  featured,
  neutral,
  reduceMotion,
}) {
  const normalized = Array.isArray(values) && values.length
    ? values
    : [0, 0, 0, 0, 0, 0, 0];

  const path = buildPath(normalized, 160, 36, 3);

  return (
    <svg
      className={`rf7-dashboard-spark ${featured ? "featured" : ""} ${
        neutral ? "neutral" : ""
      }`}
      viewBox="0 0 160 36"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <motion.path
        d={path}
        fill="none"
        vectorEffect="non-scaling-stroke"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
      />
    </svg>
  );
}

function PerformanceChart({ values, reduceMotion, empty }) {
  const normalized = Array.isArray(values) && values.length
    ? values
    : [0, 0, 0, 0, 0, 0, 0];

  const linePath = buildPath(normalized, 1000, 280, 20);
  const areaPath = `${linePath} L 980 280 L 20 280 Z`;
  const lastPoint = getPointForIndex(
    normalized,
    normalized.length - 1,
    1000,
    280,
    20
  );

  return (
    <div className="rf7-dashboard-chart-wrap">
      <div className="rf7-dashboard-chart-grid" aria-hidden="true" />

      <svg
        className="rf7-dashboard-chart"
        viewBox="0 0 1000 280"
        preserveAspectRatio="none"
        role="img"
        aria-label="Sales performance trend"
      >
        <defs>
          <linearGradient id="rf7DashboardChartGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4648d4" stopOpacity="0.19" />
            <stop offset="100%" stopColor="#4648d4" stopOpacity="0" />
          </linearGradient>
        </defs>

        <motion.path
          d={areaPath}
          fill="url(#rf7DashboardChartGradient)"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: empty ? 0.18 : 1 }}
          transition={{ duration: 0.45 }}
        />

        <motion.path
          d={linePath}
          fill="none"
          stroke="#4648d4"
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: empty ? 0.35 : 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />

        {!empty ? (
          <motion.circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="7"
            fill="#4648d4"
            initial={reduceMotion ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.65, type: "spring", stiffness: 320 }}
          />
        ) : null}
      </svg>

      {empty ? (
        <div className="rf7-dashboard-chart-empty">
          <Sparkles aria-hidden="true" />
          <span>Performance history will appear as activity builds.</span>
        </div>
      ) : null}
    </div>
  );
}

function AgentCard({
  agent,
  calls,
  emails,
  meetings,
  reduceMotion,
}) {
  if (!agent) {
    return (
      <article className="rf7-dashboard-agent-card empty">
        <div className="rf7-dashboard-agent-heading">
          <div>
            <Bot aria-hidden="true" />
            <h2>AI Voice Agent</h2>
          </div>
        </div>

        <div className="rf7-dashboard-agent-empty-icon">
          <Bot aria-hidden="true" />
        </div>

        <h3>Create your first AI Voice Agent</h3>
        <p>
          Give ReachFly a focused sales role, business context and a business
          number, then run a controlled test call.
        </p>

        <Link className="rf7-dashboard-agent-button" to="/app/voice-agents">
          Create Voice Agent
        </Link>
      </article>
    );
  }

  return (
    <article className="rf7-dashboard-agent-card">
      <div>
        <div className="rf7-dashboard-agent-heading">
          <div>
            <Bot aria-hidden="true" />
            <h2>AI Agent: {agent.name || "Voice Agent"}</h2>
          </div>

          <span>{purposeLabel(agent.purpose)}</span>
        </div>

        <p className="rf7-dashboard-agent-description">
          {agent.enabled === false
            ? `${agent.name || "This agent"} is currently paused. Resume it when you’re ready for new conversations.`
            : `${agent.name || "This agent"} is active across your configured ReachFly calling and follow-up workflows.`}
        </p>

        <div className="rf7-dashboard-agent-stats">
          <AgentStat
            icon={PhoneCall}
            label="Calls Completed"
            value={calls}
            reduceMotion={reduceMotion}
          />
          <AgentStat
            icon={Mail}
            label="Emails Sent"
            value={emails}
            reduceMotion={reduceMotion}
          />
          <AgentStat
            icon={Clock3}
            label="Meetings Booked"
            value={meetings}
            highlighted
            reduceMotion={reduceMotion}
          />
        </div>
      </div>

      <Link className="rf7-dashboard-agent-button" to="/app/calls">
        View Agent Logs
      </Link>
    </article>
  );
}

function AgentStat({
  icon: Icon,
  label,
  value,
  highlighted,
  reduceMotion,
}) {
  return (
    <motion.div
      className={`rf7-dashboard-agent-stat ${highlighted ? "highlighted" : ""}`}
      whileHover={reduceMotion ? undefined : { x: 2 }}
    >
      <div>
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </div>
      <strong>{formatNumber(value)}</strong>
    </motion.div>
  );
}

function FunnelCard({ funnel, reduceMotion }) {
  const max = Math.max(
    1,
    ...funnel.map((item) => Number(item.value || 0))
  );

  return (
    <article className="rf7-dashboard-card rf7-dashboard-funnel-card">
      <div className="rf7-dashboard-card-heading">
        <h2>Acquisition Funnel</h2>
      </div>

      <div className="rf7-dashboard-funnel">
        {funnel.map((item, index) => {
          const ratio = Math.max(0.08, Number(item.value || 0) / max);
          const inset = Math.min(index * 18, 72);

          return (
            <div
              className="rf7-dashboard-funnel-row"
              key={`${item.label}-${index}`}
              style={{ marginLeft: inset }}
            >
              <motion.div
                className={index === funnel.length - 1 ? "final" : ""}
                initial={
                  reduceMotion ? false : { scaleX: 0, transformOrigin: "left" }
                }
                animate={{ scaleX: ratio }}
                transition={{
                  duration: 0.62,
                  delay: index * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
              <span>{item.label}</span>
              <strong>{formatNumber(item.value)}</strong>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function AttentionCard({ items, reduceMotion }) {
  return (
    <article className="rf7-dashboard-card rf7-dashboard-attention-card">
      <div className="rf7-dashboard-card-heading">
        <h2>Attention Needed</h2>
      </div>

      <div className="rf7-dashboard-attention-list">
        {items.slice(0, 3).map((item, index) => {
          const Icon =
            item.type === "error"
              ? AlertTriangle
              : item.type === "success"
                ? CheckCircle2
                : item.type === "billing"
                  ? WalletCards
                  : Megaphone;

          return (
            <motion.div
              className={`rf7-dashboard-attention-item ${item.type}`}
              key={`${item.title}-${index}`}
              initial={
                reduceMotion ? false : { opacity: 0, x: 10 }
              }
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Icon aria-hidden="true" />

              <div>
                <div className="rf7-dashboard-attention-title-row">
                  <h3>{item.title}</h3>
                  {item.badge ? <span>{item.badge}</span> : null}
                </div>
                <p>{item.description}</p>
                <Link to={item.href}>
                  {item.action}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>
    </article>
  );
}

function WorkspaceReadinessCard({
  phoneConnected,
  phoneDetail,
  emailConnected,
  emailCount,
  calendarConnected,
  calendarCount,
  whatsappConnected,
  credits,
}) {
  const items = [
    {
      icon: Phone,
      label: "Business Number",
      connected: phoneConnected,
      detail: phoneConnected ? phoneDetail : "Add or connect a number",
      href: phoneConnected ? "/app/phone-numbers" : "/app/commerce",
    },
    {
      icon: Mail,
      label: "Email",
      connected: emailConnected,
      detail: emailConnected
        ? `${emailCount} account${emailCount === 1 ? "" : "s"} connected`
        : "Connect email for follow-ups",
      href: "/app/connections",
    },
    {
      icon: CalendarDays,
      label: "Calendar",
      connected: calendarConnected,
      detail: calendarConnected
        ? `${calendarCount} calendar${calendarCount === 1 ? "" : "s"} connected`
        : "Connect calendar for booking",
      href: "/app/connections",
    },
    {
      icon: Inbox,
      label: "WhatsApp",
      connected: whatsappConnected,
      detail: whatsappConnected
        ? "Workspace messaging ready"
        : "Connect when your workflow needs it",
      href: "/app/whatsapp",
    },
  ];

  return (
    <article className="rf7-dashboard-card rf7-dashboard-readiness-card">
      <div className="rf7-dashboard-card-heading rf7-dashboard-card-heading-split">
        <div>
          <h2>Workspace Readiness</h2>
          <p>Channels your sales workflows can use.</p>
        </div>

        <Link to="/app/billing" className="rf7-dashboard-credit-chip">
          <CircleDollarSign aria-hidden="true" />
          <span>{formatNumber(credits)} call credits</span>
        </Link>
      </div>

      <div className="rf7-dashboard-readiness-grid">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              to={item.href}
              className="rf7-dashboard-readiness-item"
              key={item.label}
            >
              <span className="rf7-dashboard-readiness-icon">
                <Icon aria-hidden="true" />
              </span>

              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>

              <span
                className={`rf7-dashboard-status-dot ${
                  item.connected ? "connected" : ""
                }`}
              >
                {item.connected ? "Ready" : "Setup"}
              </span>
            </Link>
          );
        })}
      </div>
    </article>
  );
}

function WorkforceCard({ agents, calls, queue }) {
  return (
    <article className="rf7-dashboard-card rf7-dashboard-workforce-card">
      <div className="rf7-dashboard-card-heading rf7-dashboard-card-heading-split">
        <div>
          <h2>AI Workforce</h2>
          <p>Agent-level calling capacity and queue health.</p>
        </div>
        <Link to="/app/voice-agents">Manage Agents</Link>
      </div>

      {!agents.length ? (
        <div className="rf7-dashboard-workforce-empty">
          <UsersRound aria-hidden="true" />
          <div>
            <strong>No AI agents yet</strong>
            <span>Create a focused agent and run a controlled test.</span>
          </div>
          <Link to="/app/voice-agents">Create Agent</Link>
        </div>
      ) : (
        <div className="rf7-dashboard-workforce-list">
          {agents.slice(0, 4).map((agent) => {
            const active = calls.filter(
              (call) =>
                sameId(call.agentId, agent.id) &&
                [
                  "initiated",
                  "dialing",
                  "ringing",
                  "connected",
                  "in_progress",
                ].includes(normalizeStatus(call.status))
            ).length;

            const queued = queue.filter(
              (item) =>
                sameId(item.agentId, agent.id) &&
                normalizeStatus(item.status) === "queued"
            ).length;

            return (
              <Link
                className="rf7-dashboard-workforce-agent"
                to="/app/voice-agents"
                key={agent.id || agent.name}
              >
                <span className="rf7-dashboard-workforce-avatar">
                  {initials(agent.name)}
                </span>
                <div>
                  <strong>{agent.name || "AI Voice Agent"}</strong>
                  <span>
                    {agent.fromNumber ||
                      agent.phoneNumber ||
                      "Number not assigned"}
                  </span>
                </div>
                <div className="rf7-dashboard-workforce-counts">
                  <span>
                    <b>{active}</b> live
                  </span>
                  <span>
                    <b>{queued}</b> queued
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <style>{DASHBOARD_STYLES}</style>
      <main className="rf7-dashboard-page rf7-dashboard-skeleton" aria-busy="true">
        <section className="rf7-dashboard-heading">
          <div>
            <div className="rf7-skeleton-line title" />
            <div className="rf7-skeleton-line subtitle" />
          </div>
          <div className="rf7-skeleton-actions">
            <div className="rf7-skeleton-pill" />
            <div className="rf7-skeleton-pill primary" />
          </div>
        </section>

        <section className="rf7-dashboard-kpis">
          {[0, 1, 2, 3].map((item) => (
            <div className="rf7-dashboard-kpi" key={item}>
              <div className="rf7-skeleton-line label" />
              <div className="rf7-skeleton-line metric" />
              <div className="rf7-skeleton-line chart" />
            </div>
          ))}
        </section>

        <section className="rf7-dashboard-main-grid">
          <div className="rf7-dashboard-card rf7-skeleton-block tall" />
          <div className="rf7-dashboard-agent-card rf7-skeleton-block tall" />
        </section>

        <section className="rf7-dashboard-lower-grid">
          <div className="rf7-dashboard-card rf7-skeleton-block medium" />
          <div className="rf7-dashboard-card rf7-skeleton-block medium" />
        </section>
      </main>
    </>
  );
}

function buildDashboardModel(data, dateRange, performanceRange) {
  const base = data.base || {};
  const voice = data.voice || {};
  const commerce = data.commerce || {};
  const billing = data.billing || {};
  const connections = data.connections || {};
  const analytics = data.analytics || {};

  const contacts = normalizeCollection(data.contacts, [
    "contacts",
    "items",
    "records",
    "data",
  ]);
  const campaigns = normalizeCollection(data.campaigns, [
    "campaigns",
    "items",
    "records",
    "data",
  ]);
  const inbox = normalizeCollection(data.inbox, [
    "messages",
    "items",
    "records",
    "data",
  ]);
  const agents = normalizeCollection(voice, ["agents"]);
  const calls = normalizeCollection(voice, ["calls"]);
  const queue = normalizeCollection(voice, ["queue", "assignments"]);
  const meetingsCollection = normalizeCollection(voice, [
    "meetings",
    "appointments",
  ]);

  if (!agents.length && voice.agent) {
    agents.push(voice.agent);
  }

  const summary = voice.summary || {};
  const analyticsMetrics = Array.isArray(analytics.metrics)
    ? analytics.metrics
    : [];
  const analyticsFunnel = Array.isArray(analytics.funnel)
    ? analytics.funnel
    : [];

  const rangeContacts = filterByDays(contacts, dateRange);
  const rangeInbox = filterByDays(inbox, dateRange);
  const rangeCalls = filterByDays(calls, dateRange);
  const rangeMeetings = filterByDays(meetingsCollection, dateRange);

  const newLeadsMetric = metricByLabels(analyticsMetrics, [
    "new leads",
    "leads",
    "prospects found",
    "prospects",
  ]);

  const qualifiedMetric = metricByLabels(analyticsMetrics, [
    "qualified",
    "qualified leads",
  ]);

  const repliesMetric = metricByLabels(analyticsMetrics, [
    "replies",
    "reply",
    "responses",
    "engaged",
  ]);

  const meetingsMetric = metricByLabels(analyticsMetrics, [
    "meetings booked",
    "meetings",
    "booked meetings",
  ]);

  const contactsHaveDates = contacts.some((item) => Boolean(itemDate(item)));
  const inboxHaveDates = inbox.some((item) => Boolean(itemDate(item)));
  const callsHaveDates = calls.some((item) => Boolean(itemDate(item)));
  const meetingsHaveDates = meetingsCollection.some((item) => Boolean(itemDate(item)));

  const newLeads = contactsHaveDates
    ? rangeContacts.length
    : numberValue(
        newLeadsMetric?.value,
        pick(base, [
          "newLeads",
          "readyLeads",
          "leadsReady",
          "leads",
          "contacts",
        ]),
        contacts.length,
        summary.assignableLeads
      );

  const qualifiedFromContacts = rangeContacts.filter((item) =>
    ["qualified", "hot", "interested", "converted"].includes(
      normalizeStatus(
        item.status || item.stage || item.leadStatus || item.qualificationStatus
      )
    )
  ).length;

  const qualified = contactsHaveDates && qualifiedFromContacts
    ? qualifiedFromContacts
    : numberValue(
        qualifiedMetric?.value,
        pick(base, ["qualifiedLeads", "qualified", "leadsQualified"]),
        summary.qualifiedLeads,
        qualifiedFromContacts
      );

  const replyCount = rangeInbox.filter(isInboundOrReply).length;
  const replies = inboxHaveDates
    ? replyCount
    : numberValue(
        repliesMetric?.value,
        pick(base, ["replies", "replyCount", "responses", "engaged"]),
        replyCount
      );

  const meetingCount = rangeMeetings.length || countMeetingsFromCalls(rangeCalls);
  const meetings = meetingsHaveDates || callsHaveDates
    ? meetingCount
    : numberValue(
        meetingsMetric?.value,
        pick(base, ["meetingsBooked", "meetings", "bookings"]),
        summary.meetingsBooked,
        summary.meetingsUpcoming,
        meetingCount
      );

  const newLeadsSpark = buildDailyCounts(
    contacts,
    Math.min(dateRange, 14),
    () => true
  );
  const qualifiedSpark = buildDailyCounts(
    contacts,
    Math.min(dateRange, 14),
    (item) =>
      ["qualified", "hot", "interested", "converted"].includes(
        normalizeStatus(
          item.status || item.stage || item.leadStatus || item.qualificationStatus
        )
      )
  );
  const repliesSpark = buildDailyCounts(
    inbox,
    Math.min(dateRange, 14),
    isInboundOrReply
  );
  const meetingsSpark = meetingsCollection.length
    ? buildDailyCounts(
        meetingsCollection,
        Math.min(dateRange, 14),
        () => true
      )
    : buildDailyCounts(
        calls,
        Math.min(dateRange, 14),
        callBookedMeeting
      );

  const performanceValues = buildPerformanceSeries({
    contacts,
    inbox,
    calls,
    meetings: meetingsCollection,
    days: performanceRange,
    analytics,
  });

  const performanceTotal = numberValue(
    pick(base, [
      "pipelineRevenue",
      "pipelineValue",
      "revenue",
      "salesRevenue",
    ]),
    metricByLabels(analyticsMetrics, [
      "pipeline revenue",
      "pipeline value",
      "revenue",
    ])?.value
  );

  const performanceUsesMoney = performanceTotal > 0;
  const performanceActivityTotal = performanceValues.reduce(
    (sum, value) => sum + Number(value || 0),
    0
  );

  const primaryAgent =
    agents.find((agent) => agent.enabled !== false) || agents[0] || null;

  const selectedAgentCalls = primaryAgent
    ? rangeCalls.filter((call) => sameId(call.agentId, primaryAgent.id))
    : [];

  const agentCalls = primaryAgent
    ? selectedAgentCalls.filter((call) =>
        ["completed", "ended", "finished", "connected"].includes(
          normalizeStatus(call.status)
        )
      ).length ||
      numberValue(
        primaryAgent.callsCompleted,
        primaryAgent.metrics?.callsCompleted,
        summary.callsToday
      )
    : 0;

  const emailsSent = numberValue(
    metricByLabels(analyticsMetrics, ["emails sent", "email sent"])?.value,
    pick(base, ["emailsSent", "sentEmails", "outboundEmails"]),
    inbox.filter((item) => !isInboundOrReply(item)).length
  );

  const agentMeetings = primaryAgent
    ? rangeMeetings.filter((meeting) =>
        !meeting.agentId || sameId(meeting.agentId, primaryAgent.id)
      ).length || meetings
    : meetings;

  const funnel = normalizeFunnel(
    analyticsFunnel,
    newLeads,
    qualified,
    numberValue(
      pick(base, ["contacted", "leadsContacted", "contactsReached"]),
      rangeCalls.length + emailsSent
    ),
    replies,
    meetings
  );

  const activeNumber =
    commerce.activeNumber ||
    commerce.number ||
    normalizeCollection(commerce, ["numbers", "activeNumbers"])[0] ||
    null;

  const phoneConnected = Boolean(activeNumber);
  const emailConnections = normalizeCollection(connections, [
    "emailConnections",
    "emails",
  ]);
  const calendarConnections = normalizeCollection(connections, [
    "calendarConnections",
    "calendars",
  ]);

  const emailConnected = emailConnections.length > 0;
  const calendarConnected = calendarConnections.length > 0;
  const whatsappConnected = Boolean(
    pick(base, ["whatsappConnected", "whatsappReady"]) ||
      normalizeCollection(connections, ["whatsappConnections", "whatsapp"])
        .length
  );

  const credits = Math.max(
    0,
    Math.floor(
      numberValue(
        billing.aiCalling?.wallet?.balance,
        billing.wallet?.balance,
        billing.aiCallCredits,
        billing.balance
      )
    )
  );

  const attention = buildAttention({
    agents,
    phoneConnected,
    emailConnected,
    calendarConnected,
    credits,
    campaigns,
    calls,
  });

  return {
    newLeads: {
      value: newLeads,
      trend: metricTrend(newLeadsMetric, contacts, dateRange),
      spark: newLeadsSpark,
    },
    qualified: {
      value: qualified,
      trend: metricTrend(qualifiedMetric, contacts, dateRange, (item) =>
        ["qualified", "hot", "interested", "converted"].includes(
          normalizeStatus(
            item.status || item.stage || item.leadStatus || item.qualificationStatus
          )
        )
      ),
      spark: qualifiedSpark,
    },
    replies: {
      value: replies,
      trend: metricTrend(repliesMetric, inbox, dateRange, isInboundOrReply),
      spark: repliesSpark,
    },
    meetings: {
      value: meetings,
      trend: metricTrend(
        meetingsMetric,
        meetingsCollection.length ? meetingsCollection : calls,
        dateRange,
        meetingsCollection.length ? () => true : callBookedMeeting
      ),
      spark: meetingsSpark,
    },
    performance: {
      values: performanceValues,
      label: performanceUsesMoney ? "Pipeline Revenue" : "Sales Activity",
      formattedTotal: performanceUsesMoney
        ? formatCurrency(performanceTotal)
        : `${formatNumber(performanceActivityTotal)} activities`,
      empty: !performanceValues.some((value) => Number(value || 0) > 0),
    },
    primaryAgent,
    agentCalls,
    emailsSent,
    agentMeetings,
    funnel,
    attention,
    phoneConnected,
    phoneDetail:
      activeNumber?.phoneNumber ||
      activeNumber?.number ||
      activeNumber?.e164 ||
      "Business number connected",
    emailConnected,
    emailCount: emailConnections.length,
    calendarConnected,
    calendarCount: calendarConnections.length,
    whatsappConnected,
    credits,
    agents,
    calls,
    queue,
  };
}

function buildAttention({
  agents,
  phoneConnected,
  emailConnected,
  calendarConnected,
  credits,
  campaigns,
  calls,
}) {
  const items = [];

  if (!agents.length) {
    items.push({
      type: "error",
      title: "AI Voice Agent Needed",
      description:
        "Create an agent before launching an AI calling workflow.",
      action: "Create Voice Agent",
      href: "/app/voice-agents",
    });
  }

  if (!phoneConnected) {
    items.push({
      type: "error",
      title: "Business Number Not Connected",
      description:
        "Your AI Voice Agent needs a business number before it can make or receive calls.",
      action: "Add Business Number",
      href: "/app/phone-numbers",
    });
  }

  if (!emailConnected) {
    items.push({
      type: "info",
      title: "Email Integration Not Connected",
      description:
        "Connect email so campaigns and agent follow-ups can stay tied to the same prospect record.",
      action: "Connect Email",
      href: "/app/connections",
    });
  }

  if (!calendarConnected) {
    items.push({
      type: "info",
      title: "Calendar Not Connected",
      description:
        "Connect a calendar if you want qualified conversations to move directly into available meeting slots.",
      action: "Connect Calendar",
      href: "/app/connections",
    });
  }

  if (credits <= 5) {
    items.push({
      type: "billing",
      title: "AI Call Credits Running Low",
      description: `${formatNumber(credits)} AI call credit${credits === 1 ? "" : "s"} remaining in this workspace.`,
      action: "Buy Credits",
      href: "/app/billing",
    });
  }

  const pendingCampaigns = campaigns.filter((campaign) =>
    ["draft", "queued", "pending", "pending_approval"].includes(
      normalizeStatus(campaign.status)
    )
  );

  if (pendingCampaigns.length) {
    items.push({
      type: "info",
      title: "Campaigns Pending Review",
      description: `${pendingCampaigns.length} campaign${pendingCampaigns.length === 1 ? " is" : "s are"} waiting for review or launch.`,
      action: "Review Campaigns",
      href: "/app/campaigns",
      badge: String(pendingCampaigns.length),
    });
  }

  const failedCalls = calls.filter((call) =>
    ["failed", "error", "technical_failure"].includes(
      normalizeStatus(call.status || call.outcome)
    )
  ).length;

  if (failedCalls) {
    items.push({
      type: "error",
      title: "Calls Need Review",
      description: `${failedCalls} recent call${failedCalls === 1 ? "" : "s"} ended with a technical or provider failure.`,
      action: "Review Calls",
      href: "/app/calls",
    });
  }

  if (!items.length) {
    items.push({
      type: "success",
      title: "Workspace Ready",
      description:
        "Your core sales channels are connected and no immediate blockers need attention.",
      action: "Open Voice Agents",
      href: "/app/voice-agents",
    });
  }

  return items;
}

function normalizeFunnel(
  analyticsFunnel,
  prospects,
  qualified,
  contacted,
  replies,
  meetings
) {
  if (Array.isArray(analyticsFunnel) && analyticsFunnel.length) {
    const labels = [
      ["prospects found", "prospects", "leads"],
      ["qualified", "qualified leads"],
      ["contacted", "reached"],
      ["replied / engaged", "replied", "engaged", "replies"],
      ["meetings booked", "meetings"],
    ];

    const names = [
      "Prospects Found",
      "Qualified",
      "Contacted",
      "Replied / Engaged",
      "Meetings Booked",
    ];

    return labels.map((aliases, index) => {
      const item = analyticsFunnel.find((candidate) =>
        aliases.includes(
          String(candidate?.label || candidate?.name || "")
            .trim()
            .toLowerCase()
        )
      );

      const fallback = [prospects, qualified, contacted, replies, meetings][index];

      return {
        label: names[index],
        value: numberValue(item?.value, item?.count, fallback),
      };
    });
  }

  return [
    { label: "Prospects Found", value: prospects },
    { label: "Qualified", value: qualified },
    { label: "Contacted", value: contacted },
    { label: "Replied / Engaged", value: replies },
    { label: "Meetings Booked", value: meetings },
  ];
}

function buildPerformanceSeries({
  contacts,
  inbox,
  calls,
  meetings,
  days,
  analytics,
}) {
  const directSeries =
    analytics?.performanceSeries ||
    analytics?.salesPerformance ||
    analytics?.series ||
    analytics?.history;

  if (Array.isArray(directSeries) && directSeries.length) {
    const values = directSeries
      .slice(-days)
      .map((item) =>
        Number(
          typeof item === "number"
            ? item
            : item?.value ??
                item?.count ??
                item?.revenue ??
                item?.pipelineRevenue ??
                0
        )
      )
      .filter(Number.isFinite);

    if (values.length) return values;
  }

  const buckets = createDayBuckets(days);
  const sources = [
    [contacts, 1],
    [inbox, 1],
    [calls, 2],
    [meetings, 4],
  ];

  for (const [items, weight] of sources) {
    for (const item of items) {
      const date = itemDate(item);
      if (!date) continue;
      const key = dayKey(date);
      if (Object.prototype.hasOwnProperty.call(buckets.map, key)) {
        buckets.map[key] += weight;
      }
    }
  }

  return buckets.keys.map((key) => buckets.map[key]);
}

function buildDailyCounts(items, days, predicate) {
  const buckets = createDayBuckets(Math.max(7, days));

  for (const item of items) {
    if (!predicate(item)) continue;
    const date = itemDate(item);
    if (!date) continue;
    const key = dayKey(date);

    if (Object.prototype.hasOwnProperty.call(buckets.map, key)) {
      buckets.map[key] += 1;
    }
  }

  return buckets.keys.map((key) => buckets.map[key]);
}

function createDayBuckets(days) {
  const count = Math.max(1, Math.min(90, Number(days || 7)));
  const map = {};
  const keys = [];
  const now = new Date();

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const key = dayKey(date);
    keys.push(key);
    map[key] = 0;
  }

  return { map, keys };
}

function metricTrend(metric, items, days, predicate = () => true) {
  if (metric?.note != null || metric?.trend != null || metric?.change != null) {
    const raw = metric.note ?? metric.trend ?? metric.change;
    const parsed = parseTrend(raw);
    if (parsed) return parsed;
  }

  if (!Array.isArray(items) || !items.some((item) => Boolean(itemDate(item)))) {
    return { value: 0, display: "" };
  }

  const now = Date.now();
  const windowMs = Math.max(1, Number(days || 7)) * 86_400_000;
  let current = 0;
  let previous = 0;

  for (const item of items) {
    if (!predicate(item)) continue;
    const date = itemDate(item);
    if (!date) continue;
    const age = now - date.getTime();

    if (age >= 0 && age < windowMs) {
      current += 1;
    } else if (age >= windowMs && age < windowMs * 2) {
      previous += 1;
    }
  }

  if (!previous && !current) {
    return { value: 0, display: "" };
  }

  if (!previous && current) {
    return { value: 100, display: "+100%" };
  }

  const value = Math.round(((current - previous) / previous) * 100);

  return {
    value,
    display: `${value >= 0 ? "+" : ""}${value}%`,
  };
}

function parseTrend(value) {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      value,
      display: `${value >= 0 ? "+" : ""}${value}%`,
    };
  }

  const text = String(value).trim();
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;

  return {
    value: numeric,
    display: `${numeric >= 0 && !text.startsWith("+") ? "+" : ""}${numeric}%`,
  };
}

function metricByLabels(metrics, aliases) {
  const normalizedAliases = aliases.map((label) => label.toLowerCase());

  return metrics.find((metric) => {
    const label = String(metric?.label || metric?.name || metric?.title || "")
      .trim()
      .toLowerCase();

    return normalizedAliases.some(
      (alias) => label === alias || label.includes(alias)
    );
  });
}

function normalizeCollection(value, keys = []) {
  if (Array.isArray(value)) return [...value];

  for (const key of keys) {
    const candidate = value?.[key];
    if (Array.isArray(candidate)) return [...candidate];
  }

  return [];
}

function filterByDays(items, days) {
  if (!Array.isArray(items) || !items.length) return [];
  const hasDates = items.some((item) => Boolean(itemDate(item)));
  if (!hasDates) return [...items];

  const since = Date.now() - Math.max(1, Number(days || 7)) * 86_400_000;

  return items.filter((item) => {
    const date = itemDate(item);
    return date ? date.getTime() >= since : false;
  });
}

function itemDate(item) {
  const value =
    item?.createdAt ||
    item?.created_at ||
    item?.updatedAt ||
    item?.updated_at ||
    item?.occurredAt ||
    item?.occurred_at ||
    item?.startedAt ||
    item?.started_at ||
    item?.completedAt ||
    item?.completed_at ||
    item?.scheduledAt ||
    item?.scheduled_at ||
    item?.meetingStart ||
    item?.startTime ||
    item?.date;

  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isInboundOrReply(item) {
  const direction = normalizeStatus(
    item?.direction || item?.type || item?.messageType
  );

  if (["inbound", "incoming", "reply", "received"].includes(direction)) {
    return true;
  }

  return Boolean(
    item?.isReply ||
      item?.replyToSentId ||
      item?.inReplyTo ||
      item?.receivedAt
  );
}

function countMeetingsFromCalls(calls) {
  return calls.filter(callBookedMeeting).length;
}

function callBookedMeeting(call) {
  return Boolean(
    call?.meetingId ||
      call?.bookedMeetingId ||
      call?.meetingBooked ||
      call?.postCall?.meetingBooked ||
      normalizeStatus(call?.outcome) === "meeting_booked" ||
      normalizeStatus(call?.disposition) === "meeting_booked"
  );
}

function buildPath(values, width, height, padding) {
  const safe = values.length ? values.map((value) => Number(value || 0)) : [0];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const span = Math.max(1, max - min);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = safe.map((value, index) => ({
    x:
      padding +
      (safe.length === 1 ? innerWidth / 2 : (index / (safe.length - 1)) * innerWidth),
    y: padding + innerHeight - ((value - min) / span) * innerHeight,
  }));

  if (points.length === 1) {
    return `M ${padding} ${points[0].y} L ${width - padding} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpointX = (previous.x + current.x) / 2;
    path += ` C ${midpointX} ${previous.y}, ${midpointX} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

function getPointForIndex(values, index, width, height, padding) {
  const safe = values.length ? values.map((value) => Number(value || 0)) : [0];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const span = Math.max(1, max - min);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const bounded = Math.max(0, Math.min(index, safe.length - 1));

  return {
    x:
      padding +
      (safe.length === 1
        ? innerWidth / 2
        : (bounded / (safe.length - 1)) * innerWidth),
    y:
      padding +
      innerHeight -
        ((safe[bounded] - min) / span) * innerHeight,
  };
}

function pick(value, keys) {
  for (const key of keys) {
    const candidate =
      value?.[key] ?? value?.summary?.[key] ?? value?.stats?.[key];

    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }

  return 0;
}

function numberValue(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function formatNumber(value) {
  return Math.max(0, Number(value || 0)).toLocaleString();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function rangeLabel(value) {
  return RANGE_OPTIONS.find((option) => option.value === value)?.label || "Last 7 Days";
}

function firstName(value) {
  return String(value || "there").trim().split(/\s+/)[0] || "there";
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initials(value) {
  return String(value || "AI")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function purposeLabel(value) {
  const normalized = String(value || "Sales Dev")
    .trim()
    .replace(/[_-]+/g, " ");

  return normalized.length > 18
    ? normalized.slice(0, 18)
    : normalized || "Sales Dev";
}

function relativeTime(date) {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toast(type, title, message) {
  if (typeof window === "undefined") return;

  if (window.reachflyToast?.[type]) {
    window.reachflyToast[type](title, message);
    return;
  }

  window.dispatchEvent(
    new CustomEvent("reachfly:toast", {
      detail: { type, title, message },
    })
  );
}

const DASHBOARD_STYLES = String.raw`
.rf7-dashboard-page {
  --rf7-db-primary: #4648d4;
  --rf7-db-primary-deep: #3d3fc8;
  --rf7-db-primary-soft: #efefff;
  --rf7-db-violet: #6b38d4;
  --rf7-db-violet-soft: #f4f0ff;
  --rf7-db-surface: #f8f9fa;
  --rf7-db-card: #ffffff;
  --rf7-db-card-low: #f3f4f5;
  --rf7-db-border: #e5e7eb;
  --rf7-db-border-strong: #d9dce3;
  --rf7-db-text: #191c1d;
  --rf7-db-muted: #646775;
  --rf7-db-faint: #9093a0;
  --rf7-db-error: #ba1a1a;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 26px 32px 42px;
  color: var(--rf7-db-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.rf7-dashboard-page *,
.rf7-dashboard-page *::before,
.rf7-dashboard-page *::after {
  box-sizing: border-box;
}

.rf7-dashboard-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 32px;
}

.rf7-dashboard-heading-copy h1 {
  margin: 0;
  color: var(--rf7-db-text);
  font-family: Geist, Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.02em;
}

.rf7-dashboard-heading-copy p {
  margin: 8px 0 0;
  color: #545766;
  font-size: 16px;
  line-height: 24px;
}

.rf7-dashboard-heading-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.rf7-dashboard-range-wrap {
  position: relative;
}

.rf7-dashboard-range,
.rf7-dashboard-primary-action {
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
}

.rf7-dashboard-range {
  border: 1px solid #eceef1;
  background: #f1f2f4;
  color: #313440;
  cursor: pointer;
}

.rf7-dashboard-range:hover {
  background: #ebecef;
  border-color: #e2e4e8;
}

.rf7-dashboard-range > svg:first-child,
.rf7-dashboard-primary-action svg {
  width: 17px;
  height: 17px;
  stroke-width: 1.9;
}

.rf7-dashboard-range > svg:last-child {
  width: 15px;
  height: 15px;
  transition: transform 160ms ease;
}

.rf7-dashboard-range > svg:last-child.is-open {
  transform: rotate(180deg);
}

.rf7-dashboard-primary-action {
  min-width: 168px;
  border: 1px solid var(--rf7-db-primary-deep);
  background: linear-gradient(180deg, #5053df 0%, #4446d2 100%);
  color: #ffffff;
  box-shadow: 0 2px 5px rgba(70, 72, 212, 0.22);
}

.rf7-dashboard-primary-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(70, 72, 212, 0.24);
}

.rf7-dashboard-range-menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  padding: 8px;
  border: 1px solid var(--rf7-db-border);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 16px 36px rgba(20, 24, 31, 0.13), 0 2px 7px rgba(20, 24, 31, 0.06);
}

.rf7-dashboard-range-menu button {
  width: 100%;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #3f4250;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.rf7-dashboard-range-menu button:hover,
.rf7-dashboard-range-menu button.active {
  background: #f4f4ff;
  color: var(--rf7-db-primary);
}

.rf7-dashboard-range-menu button svg {
  width: 16px;
  height: 16px;
}

.rf7-dashboard-range-divider {
  height: 1px;
  margin: 6px 4px;
  background: #eceef1;
}

.rf7-dashboard-refresh-row svg.is-spinning {
  animation: rf7-dashboard-spin 850ms linear infinite;
}

.rf7-dashboard-inline-error {
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: -14px 0 24px;
  padding: 13px 14px;
  overflow: hidden;
  border: 1px solid #ffd5d1;
  border-radius: 12px;
  background: #fff8f7;
  color: #8f1717;
}

.rf7-dashboard-inline-error > svg {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}

.rf7-dashboard-inline-error > div {
  min-width: 0;
  flex: 1;
}

.rf7-dashboard-inline-error strong,
.rf7-dashboard-inline-error span {
  display: block;
}

.rf7-dashboard-inline-error strong {
  font-size: 13px;
}

.rf7-dashboard-inline-error span {
  margin-top: 2px;
  color: #8c5c59;
  font-size: 12px;
}

.rf7-dashboard-inline-error button {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid #efb7b2;
  border-radius: 8px;
  background: #ffffff;
  color: #9a1d1d;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.rf7-dashboard-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  margin-bottom: 36px;
}

.rf7-dashboard-kpi {
  min-width: 0;
  min-height: 178px;
  padding: 25px 24px 18px;
  overflow: hidden;
  border: 1px solid #eceef1;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 2px rgba(18, 22, 29, 0.04);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.rf7-dashboard-kpi:hover {
  border-color: #dedff5;
  box-shadow: 0 9px 24px rgba(37, 39, 84, 0.07);
}

.rf7-dashboard-kpi.featured {
  border-color: #5658dd;
  background: linear-gradient(140deg, #6567df 0%, #494bd6 76%);
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(70, 72, 212, 0.21);
}

.rf7-dashboard-kpi-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #5e6170;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.045em;
  text-transform: uppercase;
}

.rf7-dashboard-kpi.featured .rf7-dashboard-kpi-label {
  color: rgba(255, 255, 255, 0.88);
}

.rf7-dashboard-kpi-icon {
  width: 30px;
  height: 30px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #f0efff;
  color: var(--rf7-db-primary);
}

.rf7-dashboard-kpi.neutral .rf7-dashboard-kpi-icon {
  background: #eef0f3;
  color: #6c7280;
}

.rf7-dashboard-kpi.featured .rf7-dashboard-kpi-icon {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

.rf7-dashboard-kpi-icon svg {
  width: 16px;
  height: 16px;
  stroke-width: 1.8;
}

.rf7-dashboard-kpi-value-row {
  min-height: 42px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}

.rf7-dashboard-kpi-value-row strong {
  color: var(--rf7-db-text);
  font-family: Geist, Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 30px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.035em;
}

.rf7-dashboard-kpi.featured .rf7-dashboard-kpi-value-row strong {
  color: #ffffff;
}

.rf7-dashboard-trend {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px 8px;
  border-radius: 5px;
  background: #e9dfff;
  color: #5d37d0;
  font-size: 12px;
  font-weight: 600;
}

.rf7-dashboard-trend.negative {
  background: #ffe7e3;
  color: #b3261e;
}

.rf7-dashboard-kpi.neutral .rf7-dashboard-trend.positive {
  background: #e5ebfb;
  color: #59627a;
}

.rf7-dashboard-kpi.featured .rf7-dashboard-trend {
  background: rgba(255, 255, 255, 0.93);
  color: #4b4dd4;
}

.rf7-dashboard-spark {
  width: 100%;
  height: 36px;
  display: block;
  margin-top: 14px;
}

.rf7-dashboard-spark path {
  stroke: #9b93f0;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rf7-dashboard-spark.neutral path {
  stroke: #a7abb6;
}

.rf7-dashboard-spark.featured path {
  stroke: rgba(255, 255, 255, 0.7);
}

.rf7-dashboard-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(290px, 0.95fr);
  gap: 28px;
  margin-bottom: 30px;
}

.rf7-dashboard-card,
.rf7-dashboard-agent-card {
  min-width: 0;
  border: 1px solid #eceef1;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(18, 22, 29, 0.04);
}

.rf7-dashboard-performance {
  min-height: 430px;
  padding: 27px 28px 22px;
  display: flex;
  flex-direction: column;
}

.rf7-dashboard-card-heading,
.rf7-dashboard-performance-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.rf7-dashboard-card-heading h2,
.rf7-dashboard-performance-heading h2 {
  margin: 0;
  color: var(--rf7-db-text);
  font-family: Geist, Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: -0.018em;
}

.rf7-dashboard-card-heading p {
  margin: 5px 0 0;
  color: var(--rf7-db-muted);
  font-size: 12px;
  line-height: 18px;
}

.rf7-dashboard-updated {
  display: inline-block;
  margin-top: 4px;
  color: #9a9daa;
  font-size: 11px;
}

.rf7-dashboard-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: #f1f2f4;
}

.rf7-dashboard-segmented button {
  min-width: 48px;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #5f6370;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease;
}

.rf7-dashboard-segmented button:hover {
  color: #343742;
}

.rf7-dashboard-segmented button.active {
  background: var(--rf7-db-primary);
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(70, 72, 212, 0.22);
}

.rf7-dashboard-chart-wrap {
  position: relative;
  min-height: 284px;
  flex: 1;
  margin-top: 22px;
  overflow: hidden;
}

.rf7-dashboard-chart-grid {
  position: absolute;
  inset: 7px 0 0;
  background-image:
    linear-gradient(to right, rgba(220, 222, 228, 0.34) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(220, 222, 228, 0.34) 1px, transparent 1px);
  background-size: 25% 100%, 100% 25%;
  pointer-events: none;
}

.rf7-dashboard-chart {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.rf7-dashboard-chart-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: #8b8e9a;
  text-align: center;
  pointer-events: none;
}

.rf7-dashboard-chart-empty svg {
  width: 20px;
  height: 20px;
  color: #8b8de6;
}

.rf7-dashboard-chart-empty span {
  max-width: 260px;
  font-size: 12px;
}

.rf7-dashboard-performance-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 44px;
  padding-top: 13px;
  border-top: 1px solid #eceef1;
}

.rf7-dashboard-performance-footer > div {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #5f6370;
  font-size: 12px;
}

.rf7-dashboard-chart-dot {
  width: 9px;
  height: 9px;
  display: inline-block;
  border-radius: 999px;
  background: var(--rf7-db-primary);
}

.rf7-dashboard-performance-footer strong {
  color: var(--rf7-db-text);
  font-family: Geist, Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 17px;
  font-weight: 600;
}

.rf7-dashboard-agent-card {
  min-height: 430px;
  padding: 27px 24px 23px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-left: 4px solid var(--rf7-db-violet);
  background: #f5f2ff;
}

.rf7-dashboard-agent-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rf7-dashboard-agent-heading > div {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.rf7-dashboard-agent-heading svg {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  color: var(--rf7-db-violet);
}

.rf7-dashboard-agent-heading h2 {
  margin: 0;
  overflow: hidden;
  color: #25272f;
  font-family: Geist, Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-dashboard-agent-heading > span {
  flex: 0 0 auto;
  padding: 4px 7px;
  border-radius: 4px;
  background: #e8dcff;
  color: #6735d7;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rf7-dashboard-agent-description {
  margin: 24px 0 22px;
  color: #595c69;
  font-size: 13px;
  line-height: 19px;
}

.rf7-dashboard-agent-stats {
  display: grid;
  gap: 12px;
}

.rf7-dashboard-agent-stat {
  min-height: 53px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 15px;
  border: 1px solid rgba(226, 225, 238, 0.9);
  border-radius: 9px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(18, 22, 29, 0.03);
}

.rf7-dashboard-agent-stat.highlighted {
  position: relative;
  overflow: hidden;
}

.rf7-dashboard-agent-stat.highlighted::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--rf7-db-violet);
  content: "";
}

.rf7-dashboard-agent-stat > div {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #4d505d;
  font-size: 12px;
}

.rf7-dashboard-agent-stat svg {
  width: 18px;
  height: 18px;
  color: #b2afcb;
  stroke-width: 1.7;
}

.rf7-dashboard-agent-stat.highlighted svg,
.rf7-dashboard-agent-stat.highlighted strong {
  color: var(--rf7-db-violet);
}

.rf7-dashboard-agent-stat strong {
  color: #292b33;
  font-family: Geist, Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
}

.rf7-dashboard-agent-button {
  min-height: 42px;
  display: grid;
  place-items: center;
  margin-top: 22px;
  border: 1px solid #ddd6f2;
  border-radius: 8px;
  background: #ffffff;
  color: var(--rf7-db-violet);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: background 150ms ease, transform 150ms ease, box-shadow 150ms ease;
}

.rf7-dashboard-agent-button:hover {
  transform: translateY(-1px);
  background: #fbfaff;
  box-shadow: 0 5px 15px rgba(71, 51, 125, 0.08);
}

.rf7-dashboard-agent-card.empty {
  align-items: stretch;
}

.rf7-dashboard-agent-empty-icon {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  margin: 36px auto 16px;
  border-radius: 18px;
  background: #e9e1ff;
  color: var(--rf7-db-violet);
}

.rf7-dashboard-agent-empty-icon svg {
  width: 30px;
  height: 30px;
}

.rf7-dashboard-agent-card.empty h3,
.rf7-dashboard-agent-card.empty p {
  text-align: center;
}

.rf7-dashboard-agent-card.empty h3 {
  margin: 0;
  font-size: 16px;
}

.rf7-dashboard-agent-card.empty p {
  margin: 8px auto 0;
  max-width: 300px;
  color: #656877;
  font-size: 12px;
  line-height: 18px;
}

.rf7-dashboard-lower-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 28px;
  margin-bottom: 30px;
}

.rf7-dashboard-funnel-card,
.rf7-dashboard-attention-card,
.rf7-dashboard-readiness-card,
.rf7-dashboard-workforce-card {
  padding: 27px 28px;
}

.rf7-dashboard-funnel {
  display: grid;
  gap: 8px;
  margin-top: 25px;
}

.rf7-dashboard-funnel-row {
  position: relative;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 15px;
  overflow: hidden;
  border-radius: 8px;
  background: #f0f1f3;
}

.rf7-dashboard-funnel-row > div {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  background: #c6c6ec;
  opacity: 0.95;
}

.rf7-dashboard-funnel-row:nth-child(2) > div { background: #b6b6e9; }
.rf7-dashboard-funnel-row:nth-child(3) > div { background: #a7a7e4; }
.rf7-dashboard-funnel-row:nth-child(4) > div { background: #9898df; }
.rf7-dashboard-funnel-row > div.final { background: #8f6fdc; }

.rf7-dashboard-funnel-row span,
.rf7-dashboard-funnel-row strong {
  position: relative;
  z-index: 1;
}

.rf7-dashboard-funnel-row span {
  color: #262831;
  font-size: 11px;
  font-weight: 500;
}

.rf7-dashboard-funnel-row strong {
  color: #22242c;
  font-family: Geist, Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
}

.rf7-dashboard-funnel-row:last-child strong {
  color: var(--rf7-db-violet);
}

.rf7-dashboard-attention-list {
  display: grid;
  gap: 14px;
  margin-top: 25px;
}

.rf7-dashboard-attention-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 13px;
  padding: 16px;
  border: 1px solid #eceef1;
  border-radius: 10px;
  background: #f5f6f7;
}

.rf7-dashboard-attention-item.error {
  border-color: #ffd4cf;
  background: #fff9f8;
}

.rf7-dashboard-attention-item.success {
  border-color: #ccebd8;
  background: #f7fcf9;
}

.rf7-dashboard-attention-item.billing {
  border-color: #ffe0a8;
  background: #fffaf0;
}

.rf7-dashboard-attention-item > svg {
  width: 19px;
  height: 19px;
  margin-top: 2px;
  color: var(--rf7-db-primary);
  stroke-width: 1.8;
}

.rf7-dashboard-attention-item.error > svg { color: #c6261f; }
.rf7-dashboard-attention-item.success > svg { color: #16884a; }
.rf7-dashboard-attention-item.billing > svg { color: #b66a00; }

.rf7-dashboard-attention-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.rf7-dashboard-attention-title-row h3 {
  margin: 0;
  color: #282a33;
  font-family: Geist, Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.rf7-dashboard-attention-title-row > span {
  min-width: 20px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--rf7-db-primary);
  color: #ffffff;
  font-size: 9px;
  font-weight: 700;
}

.rf7-dashboard-attention-item p {
  margin: 5px 0 11px;
  color: #5f6270;
  font-size: 12px;
  line-height: 17px;
}

.rf7-dashboard-attention-item a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--rf7-db-primary);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.rf7-dashboard-attention-item.error a { color: #c2231c; }
.rf7-dashboard-attention-item.billing a { color: #a95f00; }
.rf7-dashboard-attention-item.success a { color: #157741; }

.rf7-dashboard-attention-item a:hover {
  text-decoration: underline;
}

.rf7-dashboard-attention-item a svg {
  width: 13px;
  height: 13px;
}

.rf7-dashboard-preserve-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  gap: 28px;
}

.rf7-dashboard-card-heading-split {
  align-items: center;
}

.rf7-dashboard-card-heading-split > a:not(.rf7-dashboard-credit-chip) {
  color: var(--rf7-db-primary);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.rf7-dashboard-credit-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid #e1e1f7;
  border-radius: 999px;
  background: #f7f7ff;
  color: #4a4ccd;
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
}

.rf7-dashboard-credit-chip svg {
  width: 14px;
  height: 14px;
}

.rf7-dashboard-readiness-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 22px;
}

.rf7-dashboard-readiness-item {
  min-width: 0;
  min-height: 70px;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid #eceef1;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
}

.rf7-dashboard-readiness-item:hover {
  transform: translateY(-1px);
  border-color: #dedff5;
  background: #fbfbff;
}

.rf7-dashboard-readiness-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #f0f0ff;
  color: var(--rf7-db-primary);
}

.rf7-dashboard-readiness-icon svg {
  width: 17px;
  height: 17px;
}

.rf7-dashboard-readiness-item > div {
  min-width: 0;
}

.rf7-dashboard-readiness-item strong,
.rf7-dashboard-readiness-item > div > span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-dashboard-readiness-item strong {
  color: #2b2d35;
  font-size: 12px;
  font-weight: 600;
}

.rf7-dashboard-readiness-item > div > span {
  margin-top: 2px;
  color: #777a87;
  font-size: 10px;
}

.rf7-dashboard-status-dot {
  padding: 4px 7px;
  border-radius: 999px;
  background: #fff2de;
  color: #9a6208;
  font-size: 9px;
  font-weight: 700;
}

.rf7-dashboard-status-dot.connected {
  background: #e8f7ee;
  color: #187544;
}

.rf7-dashboard-workforce-list {
  display: grid;
  gap: 8px;
  margin-top: 20px;
}

.rf7-dashboard-workforce-agent {
  min-width: 0;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  min-height: 58px;
  padding: 8px 10px;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  transition: background 150ms ease;
}

.rf7-dashboard-workforce-agent:hover {
  background: #f7f7fb;
}

.rf7-dashboard-workforce-avatar {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: linear-gradient(145deg, #5759dc, #7450db);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}

.rf7-dashboard-workforce-agent > div:first-of-type {
  min-width: 0;
}

.rf7-dashboard-workforce-agent strong,
.rf7-dashboard-workforce-agent > div:first-of-type > span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rf7-dashboard-workforce-agent strong {
  color: #2b2d35;
  font-size: 12px;
  font-weight: 600;
}

.rf7-dashboard-workforce-agent > div:first-of-type > span {
  margin-top: 2px;
  color: #858894;
  font-size: 10px;
}

.rf7-dashboard-workforce-counts {
  display: flex;
  gap: 10px;
}

.rf7-dashboard-workforce-counts span {
  color: #898c98;
  font-size: 9px;
  white-space: nowrap;
}

.rf7-dashboard-workforce-counts b {
  color: #454852;
  font-size: 11px;
}

.rf7-dashboard-workforce-empty {
  min-height: 150px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
}

.rf7-dashboard-workforce-empty > svg {
  width: 42px;
  height: 42px;
  padding: 10px;
  border-radius: 12px;
  background: #f0f0ff;
  color: var(--rf7-db-primary);
}

.rf7-dashboard-workforce-empty strong,
.rf7-dashboard-workforce-empty span {
  display: block;
}

.rf7-dashboard-workforce-empty strong {
  font-size: 13px;
}

.rf7-dashboard-workforce-empty span {
  margin-top: 3px;
  color: #777a86;
  font-size: 11px;
}

.rf7-dashboard-workforce-empty a {
  color: var(--rf7-db-primary);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
}

.rf7-dashboard-skeleton .rf7-dashboard-kpi,
.rf7-skeleton-block {
  position: relative;
  overflow: hidden;
}

.rf7-dashboard-skeleton .rf7-dashboard-kpi::after,
.rf7-skeleton-block::after,
.rf7-skeleton-line::after,
.rf7-skeleton-pill::after {
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.8), transparent);
  animation: rf7-dashboard-shimmer 1.35s infinite;
  content: "";
}

.rf7-skeleton-line,
.rf7-skeleton-pill {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: #e8eaed;
}

.rf7-skeleton-line.title { width: 210px; height: 22px; }
.rf7-skeleton-line.subtitle { width: 310px; height: 14px; margin-top: 10px; }
.rf7-skeleton-line.label { width: 100px; height: 14px; }
.rf7-skeleton-line.metric { width: 80px; height: 32px; margin-top: 20px; }
.rf7-skeleton-line.chart { width: 100%; height: 30px; margin-top: 18px; }
.rf7-skeleton-actions { display: flex; gap: 12px; }
.rf7-skeleton-pill { width: 130px; height: 42px; }
.rf7-skeleton-pill.primary { width: 164px; background: #dbdcf5; }
.rf7-skeleton-block { min-height: 300px; background: #f0f1f3; }
.rf7-skeleton-block.tall { min-height: 430px; }
.rf7-skeleton-block.medium { min-height: 320px; }

@keyframes rf7-dashboard-spin {
  to { transform: rotate(360deg); }
}

@keyframes rf7-dashboard-shimmer {
  100% { transform: translateX(100%); }
}

@media (max-width: 1180px) {
  .rf7-dashboard-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .rf7-dashboard-main-grid,
  .rf7-dashboard-preserve-grid {
    grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.9fr);
  }
}

@media (max-width: 980px) {
  .rf7-dashboard-page {
    padding: 24px 20px 38px;
  }

  .rf7-dashboard-main-grid,
  .rf7-dashboard-lower-grid,
  .rf7-dashboard-preserve-grid {
    grid-template-columns: 1fr;
  }

  .rf7-dashboard-agent-card {
    min-height: 0;
  }

  .rf7-dashboard-readiness-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .rf7-dashboard-page {
    padding: 18px 16px 92px;
  }

  .rf7-dashboard-heading {
    align-items: flex-start;
    flex-direction: column;
    margin-bottom: 24px;
  }

  .rf7-dashboard-heading-copy h1 {
    font-size: 19px;
  }

  .rf7-dashboard-heading-copy p {
    font-size: 14px;
  }

  .rf7-dashboard-heading-actions {
    width: 100%;
  }

  .rf7-dashboard-range-wrap,
  .rf7-dashboard-range,
  .rf7-dashboard-primary-action {
    flex: 1;
  }

  .rf7-dashboard-range,
  .rf7-dashboard-primary-action {
    width: 100%;
    min-width: 0;
  }

  .rf7-dashboard-range-menu {
    left: 0;
    right: auto;
    width: min(240px, calc(100vw - 32px));
  }

  .rf7-dashboard-kpis {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 22px;
  }

  .rf7-dashboard-kpi {
    min-height: 150px;
    padding: 18px 16px 14px;
  }

  .rf7-dashboard-kpi-label {
    gap: 7px;
    font-size: 10px;
  }

  .rf7-dashboard-kpi-icon {
    width: 26px;
    height: 26px;
  }

  .rf7-dashboard-kpi-value-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
    margin-top: 14px;
  }

  .rf7-dashboard-kpi-value-row strong {
    font-size: 25px;
  }

  .rf7-dashboard-trend {
    padding: 3px 6px;
    font-size: 10px;
  }

  .rf7-dashboard-performance,
  .rf7-dashboard-funnel-card,
  .rf7-dashboard-attention-card,
  .rf7-dashboard-readiness-card,
  .rf7-dashboard-workforce-card,
  .rf7-dashboard-agent-card {
    padding: 20px 17px;
  }

  .rf7-dashboard-performance {
    min-height: 380px;
  }

  .rf7-dashboard-chart-wrap {
    min-height: 235px;
  }

  .rf7-dashboard-segmented button {
    min-width: 40px;
    padding: 0 7px;
  }

  .rf7-dashboard-funnel-row {
    margin-left: 0 !important;
  }

  .rf7-dashboard-readiness-grid {
    grid-template-columns: 1fr;
  }

  .rf7-dashboard-card-heading-split {
    align-items: flex-start;
  }

  .rf7-dashboard-credit-chip {
    flex: 0 0 auto;
  }

  .rf7-dashboard-workforce-counts {
    flex-direction: column;
    gap: 1px;
    align-items: flex-end;
  }
}

@media (max-width: 430px) {
  .rf7-dashboard-heading-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .rf7-dashboard-range-wrap {
    width: 100%;
  }

  .rf7-dashboard-kpis {
    grid-template-columns: 1fr;
  }

  .rf7-dashboard-kpi {
    min-height: 142px;
  }

  .rf7-dashboard-performance-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .rf7-dashboard-segmented {
    align-self: stretch;
  }

  .rf7-dashboard-segmented button {
    flex: 1;
  }

  .rf7-dashboard-performance-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
  }

  .rf7-dashboard-card-heading-split {
    flex-direction: column;
  }

  .rf7-dashboard-workforce-agent {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .rf7-dashboard-workforce-counts {
    grid-column: 2;
    flex-direction: row;
    justify-content: flex-start;
  }

  .rf7-dashboard-workforce-empty {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .rf7-dashboard-workforce-empty a {
    grid-column: 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rf7-dashboard-page *,
  .rf7-dashboard-page *::before,
  .rf7-dashboard-page *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
`;
