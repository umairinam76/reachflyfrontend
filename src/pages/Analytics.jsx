import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  Phone,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from "../components/icons";
import { api } from "../api";
import { apiRequest, onWorkspaceSocket } from "../lib/workspace-platform-client.js";

const EMPTY_GOALS = Object.freeze({
  calls: "",
  conversations: "",
  meetings: "",
  outcomes: "",
});

const GOAL_DEFINITIONS = [
  {
    key: "calls",
    label: "Calls handled",
    description: "Inbound + outbound calls handled by your AI workforce this month.",
    icon: Phone,
  },
  {
    key: "conversations",
    label: "Connected conversations",
    description: "Calls that reached a real connected conversation or useful outcome.",
    icon: Activity,
  },
  {
    key: "meetings",
    label: "Meetings / bookings",
    description: "Confirmed meetings, appointments, reservations, or bookings created from AI activity.",
    icon: Calendar,
  },
  {
    key: "outcomes",
    label: "Business outcomes",
    description: "Confirmed or completed operational records such as orders, reservations, and service outcomes.",
    icon: Database,
  },
];

export default function Analytics() {
  const [data, setData] = useState({
    analytics: {},
    dashboard: {},
    campaigns: [],
    operations: [],
    settings: {},
  });
  const [goals, setGoals] = useState(EMPTY_GOALS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const results = await Promise.allSettled([
        api.analytics(),
        api.voiceAgentDashboard(),
        api.campaigns(),
        apiRequest("/operations?limit=1000", { timeoutMs: 20_000 }),
        api.appSettings(),
      ]);

      const analytics = fulfilledValue(results[0], {});
      const dashboard = fulfilledValue(results[1], {});
      const campaigns = normalizeCampaigns(fulfilledValue(results[2], []));
      const operationsPayload = fulfilledValue(results[3], {});
      const settings = fulfilledValue(results[4], {});
      const operations = normalizeOperations(operationsPayload);

      setData({ analytics, dashboard, campaigns, operations, settings });
      setGoals(buildGoalForm(settings?.aiWorkforceGoals));
      setLastUpdatedAt(new Date());
      setError("");
    } catch (requestError) {
      setError(requestError?.message || "ReachFly could not load AI workforce progress.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load({ silent: true });
    const offOperationCreated = onWorkspaceSocket("operations:created", refresh);
    const offOperationUpdated = onWorkspaceSocket("operations:updated", refresh);
    const offCall = onWorkspaceSocket("voice:call", refresh);
    const offMeeting = onWorkspaceSocket("meeting:created", refresh);

    return () => {
      offOperationCreated?.();
      offOperationUpdated?.();
      offCall?.();
      offMeeting?.();
    };
  }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const model = useMemo(() => buildProgressModel(data), [data]);

  async function saveGoals() {
    if (saving) return;
    setSaving(true);

    try {
      const nextGoals = sanitizeGoals(goals);
      const nextSettings = await api.saveAppSettings({
        ...(data.settings || {}),
        aiWorkforceGoals: nextGoals,
      });

      setData((current) => ({
        ...current,
        settings: nextSettings || {
          ...(current.settings || {}),
          aiWorkforceGoals: nextGoals,
        },
      }));
      setGoals(buildGoalForm(nextSettings?.aiWorkforceGoals || nextGoals));
      setNotice({
        type: "success",
        title: "Goals saved",
        message: "Progress now uses these workspace targets against real AI workforce outcomes.",
      });
    } catch (requestError) {
      setNotice({
        type: "error",
        title: "Goals could not be saved",
        message: requestError?.message || "ReachFly could not save your workspace goals.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <GoalsStyles />
        <GoalsSkeleton />
      </>
    );
  }

  return (
    <>
      <GoalsStyles />
      <main className="rf-goals-v7">
        <header className="rfg-hero">
          <div className="rfg-hero-copy">
            <span className="rfg-eyebrow"><Target size={13} /> Goals & Progress</span>
            <h1>See what your AI workforce is actually producing.</h1>
            <p>
              ReachFly connects calls, conversations, bookings, campaigns, and business operations so progress is based on real workspace activity—not decorative percentages.
            </p>
            <div className="rfg-updated">
              <span className={refreshing ? "live spinning" : "live"}><i /></span>
              {refreshing ? "Refreshing live activity…" : lastUpdatedAt ? `Updated ${formatTime(lastUpdatedAt)}` : "Live workspace data"}
            </div>
          </div>

          <div className="rfg-hero-actions">
            <button type="button" className="rfg-btn secondary" onClick={() => void load({ silent: true })} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
            <Link className="rfg-btn primary" to="/app/agents">
              <Bot size={15} /> Manage agents
            </Link>
          </div>
        </header>

        {notice ? (
          <div className={`rfg-notice ${notice.type || "info"}`}>
            <span>{notice.type === "success" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span>
            <div><b>{notice.title}</b><p>{notice.message}</p></div>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button>
          </div>
        ) : null}

        {error ? (
          <div className="rfg-notice error">
            <span><AlertTriangle size={17} /></span>
            <div><b>Some progress data is unavailable</b><p>{error}</p></div>
          </div>
        ) : null}

        <section className="rfg-journey" aria-label="AI workforce outcome journey">
          <JourneyNode icon={<Bot size={17} />} label="AI Agents" value={formatNumber(model.agentCount)} ready={model.agentCount > 0} to="/app/agents" />
          <ArrowRight className="rfg-journey-arrow" size={15} />
          <JourneyNode icon={<Phone size={17} />} label="Calls" value={formatNumber(model.period.calls)} ready={model.period.calls > 0} to="/app/calls" />
          <ArrowRight className="rfg-journey-arrow" size={15} />
          <JourneyNode icon={<Activity size={17} />} label="Conversations" value={formatNumber(model.period.conversations)} ready={model.period.conversations > 0} to="/app/calls" />
          <ArrowRight className="rfg-journey-arrow" size={15} />
          <JourneyNode icon={<Calendar size={17} />} label="Bookings" value={formatNumber(model.period.meetings)} ready={model.period.meetings > 0} to="/app/operations" />
          <ArrowRight className="rfg-journey-arrow" size={15} />
          <JourneyNode icon={<Database size={17} />} label="Outcomes" value={formatNumber(model.period.outcomes)} ready={model.period.outcomes > 0} to="/app/operations" />
        </section>

        <section className="rfg-kpis">
          <Kpi icon={<Phone size={17} />} label="Calls this month" value={model.period.calls} note={`${formatNumber(model.liveCalls)} live now`} />
          <Kpi icon={<Activity size={17} />} label="Connected conversations" value={model.period.conversations} note={model.period.calls ? `${formatPercent((model.period.conversations / model.period.calls) * 100)}% of calls` : "No calls yet"} />
          <Kpi icon={<Calendar size={17} />} label="Meetings / bookings" value={model.period.meetings} note="Created in the current month" highlight />
          <Kpi icon={<Database size={17} />} label="Business outcomes" value={model.period.outcomes} note="Confirmed or completed operations" />
          <Kpi icon={<Rocket size={17} />} label="Active campaigns" value={model.activeCampaigns} note={`${formatNumber(model.totalCampaigns)} campaigns loaded`} />
        </section>

        <section className="rfg-grid-main">
          <article className="rfg-card rfg-goal-card">
            <div className="rfg-card-head">
              <div>
                <span className="rfg-eyebrow"><TrendingUp size={12} /> Monthly targets</span>
                <h2>Set goals. ReachFly measures the real progress.</h2>
                <p>Targets are workspace settings. Leaving a target blank keeps the metric visible without inventing a goal.</p>
              </div>
              <button type="button" className="rfg-btn primary compact" onClick={() => void saveGoals()} disabled={saving}>
                {saving ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                {saving ? "Saving…" : "Save targets"}
              </button>
            </div>

            <div className="rfg-goal-list">
              {GOAL_DEFINITIONS.map((definition) => {
                const Icon = definition.icon;
                const actual = Number(model.period[definition.key] || 0);
                const target = positiveNumber(goals[definition.key]);
                const percent = target ? Math.min(100, Math.round((actual / target) * 100)) : null;
                return (
                  <div className="rfg-goal-row" key={definition.key}>
                    <span className="rfg-goal-icon"><Icon size={16} /></span>
                    <div className="rfg-goal-copy">
                      <div className="rfg-goal-title"><b>{definition.label}</b><span>{formatNumber(actual)} actual</span></div>
                      <small>{definition.description}</small>
                      <div className={`rfg-progress ${target ? "configured" : "empty"}`}>
                        <i style={{ width: `${percent || 0}%` }} />
                      </div>
                    </div>
                    <label className="rfg-goal-input">
                      <span>Monthly target</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={goals[definition.key] ?? ""}
                        onChange={(event) => setGoals((current) => ({ ...current, [definition.key]: event.target.value }))}
                        placeholder="Not set"
                      />
                    </label>
                    <div className="rfg-goal-percent">
                      {target ? <><b>{percent}%</b><small>{actual >= target ? "Goal reached" : `${formatNumber(Math.max(0, target - actual))} to go`}</small></> : <><b>—</b><small>Set target</small></>}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rfg-card rfg-health-card">
            <div className="rfg-card-head compact-head">
              <div>
                <span className="rfg-eyebrow"><Brain size={12} /> Workforce health</span>
                <h2>Is the journey connected?</h2>
              </div>
            </div>
            <div className="rfg-health-list">
              <HealthRow label="AI agents" value={model.agentCount ? `${model.agentCount} configured` : "No agent yet"} ready={model.agentCount > 0} to="/app/agents" />
              <HealthRow label="Business numbers" value={model.numberCount ? `${model.numberCount} assigned` : "No number assigned"} ready={model.numberCount > 0} to="/app/phone-numbers" />
              <HealthRow label="Business Brain" value={model.brainReadyCount ? `${model.brainReadyCount} agent${model.brainReadyCount === 1 ? "" : "s"} ready` : "Needs business context"} ready={model.brainReadyCount > 0} to="/app/agents" />
              <HealthRow label="Campaigns" value={model.totalCampaigns ? `${model.activeCampaigns} active / ${model.totalCampaigns} total` : "No campaign yet"} ready={model.totalCampaigns > 0} to="/app/campaigns" />
              <HealthRow label="Operations" value={model.operations.length ? `${model.operations.length} records loaded` : "No operation yet"} ready={model.operations.length > 0} to="/app/operations" />
            </div>
            <div className="rfg-health-callout">
              <Zap size={17} />
              <div>
                <b>{model.readinessPercent}% connected</b>
                <p>Readiness is calculated from real agent, number, Business Brain, campaign, and operations state.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="rfg-card rfg-agent-section">
          <div className="rfg-card-head">
            <div>
              <span className="rfg-eyebrow"><Users size={12} /> Agent progress</span>
              <h2>Which agent is producing the outcomes?</h2>
              <p>Each row connects agent identity, number, direction, calls, bookings, and business outcomes.</p>
            </div>
            <Link className="rfg-text-link" to="/app/agents">Manage AI Workforce <ArrowRight size={13} /></Link>
          </div>

          {model.agents.length ? (
            <div className="rfg-agent-table-wrap">
              <table className="rfg-agent-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Direction</th>
                    <th>Business number</th>
                    <th>Calls</th>
                    <th>Connected</th>
                    <th>Bookings</th>
                    <th>Outcomes</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {model.agents.map((agent) => (
                    <tr key={agent.id}>
                      <td>
                        <Link className="rfg-agent-name" to={`/app/voice-agent?agentId=${encodeURIComponent(agent.id)}`}>
                          <span>{initials(agent.name)}</span>
                          <div><b>{agent.name}</b><small>{agent.primaryLanguage || "Default language"}</small></div>
                        </Link>
                      </td>
                      <td><DirectionPill value={agent.callingMode} /></td>
                      <td>{agent.fromNumber ? <span className="rfg-number"><Phone size={12} /> {agent.fromNumber}</span> : <Link className="rfg-missing-link" to="/app/phone-numbers">Assign number</Link>}</td>
                      <td>{formatNumber(agent.calls)}</td>
                      <td>{formatNumber(agent.conversations)}</td>
                      <td>{formatNumber(agent.meetings)}</td>
                      <td>{formatNumber(agent.outcomes)}</td>
                      <td><span className={`rfg-state ${agent.live ? "live" : agent.ready ? "ready" : "needs"}`}>{agent.live ? "Live" : agent.ready ? "Ready" : "Needs setup"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Bot size={24} />} title="Create your first AI agent" text="Once an agent starts handling calls, its real progress will appear here." to="/app/agents" action="Create agent" />
          )}
        </section>

        <section className="rfg-grid-bottom">
          <article className="rfg-card">
            <div className="rfg-card-head compact-head">
              <div>
                <span className="rfg-eyebrow"><Sparkles size={12} /> Recent outcomes</span>
                <h2>What happened because of the calls?</h2>
              </div>
              <Link className="rfg-text-link" to="/app/operations">Open Operations <ArrowRight size={13} /></Link>
            </div>

            {model.recentActivity.length ? (
              <div className="rfg-activity-list">
                {model.recentActivity.slice(0, 8).map((item) => (
                  <div className="rfg-activity" key={item.id}>
                    <span className={`rfg-activity-icon ${item.tone}`}>{item.icon}</span>
                    <div><b>{item.title}</b><p>{item.description}</p></div>
                    <time>{formatRelativeDate(item.at)}</time>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rfg-empty-inline"><Clock3 size={18} /><span>Recent call, booking, and operations outcomes will appear here automatically.</span></div>
            )}
          </article>

          <article className="rfg-card">
            <div className="rfg-card-head compact-head">
              <div>
                <span className="rfg-eyebrow"><BarChart3 size={12} /> Campaign pulse</span>
                <h2>Outbound activity feeding the workforce</h2>
              </div>
              <Link className="rfg-text-link" to="/app/campaigns">Campaigns <ArrowRight size={13} /></Link>
            </div>

            {model.campaigns.length ? (
              <div className="rfg-campaign-list">
                {model.campaigns.slice(0, 6).map((campaign) => (
                  <Link to={`/app/campaigns/${encodeURIComponent(campaign.id)}`} className="rfg-campaign-row" key={campaign.id}>
                    <span className="rfg-campaign-icon"><Rocket size={14} /></span>
                    <div><b>{campaign.name}</b><small>{campaign.modeLabel}</small></div>
                    <span className={`rfg-state ${campaign.active ? "live" : "ready"}`}>{campaign.statusLabel}</span>
                    <ArrowRight size={13} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Rocket size={22} />} title="No campaigns yet" text="Create an outbound campaign and bind it to the AI agent and number you want to measure." to="/app/campaigns/new" action="Create campaign" compact />
            )}
          </article>
        </section>
      </main>
    </>
  );
}

function JourneyNode({ icon, label, value, ready, to }) {
  return (
    <Link to={to} className={`rfg-journey-node ${ready ? "ready" : ""}`}>
      <span>{icon}</span>
      <div><small>{label}</small><b>{value}</b></div>
    </Link>
  );
}

function Kpi({ icon, label, value, note, highlight = false }) {
  return (
    <article className={`rfg-kpi ${highlight ? "highlight" : ""}`}>
      <span>{icon}</span>
      <div><small>{label}</small><b>{formatNumber(value)}</b><p>{note}</p></div>
    </article>
  );
}

function HealthRow({ label, value, ready, to }) {
  return (
    <Link to={to} className="rfg-health-row">
      <span className={ready ? "ready" : "needs"}>{ready ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}</span>
      <div><b>{label}</b><small>{value}</small></div>
      <ArrowRight size={13} />
    </Link>
  );
}

function DirectionPill({ value }) {
  const mode = normalizeToken(value || "outbound");
  const label = mode === "both" ? "Inbound + outbound" : mode === "inbound" ? "Inbound" : "Outbound";
  return <span className={`rfg-direction ${mode}`}>{label}</span>;
}

function EmptyState({ icon, title, text, to, action, compact = false }) {
  return (
    <div className={`rfg-empty ${compact ? "compact" : ""}`}>
      <span>{icon}</span>
      <div><b>{title}</b><p>{text}</p></div>
      <Link className="rfg-btn secondary compact" to={to}>{action} <ArrowRight size={13} /></Link>
    </div>
  );
}

function GoalsSkeleton() {
  return (
    <main className="rf-goals-v7 rfg-skeleton">
      <div className="rfg-sk-hero" />
      <div className="rfg-sk-row"><i /><i /><i /><i /><i /></div>
      <div className="rfg-sk-main"><i /><i /></div>
      <div className="rfg-sk-table" />
    </main>
  );
}

function buildProgressModel(data) {
  const dashboard = data?.dashboard || {};
  const agents = normalizeAgents(dashboard);
  const calls = Array.isArray(dashboard?.calls) ? dashboard.calls : [];
  const meetings = Array.isArray(dashboard?.meetings)
    ? dashboard.meetings
    : Array.isArray(dashboard?.bookings)
      ? dashboard.bookings
      : [];
  const operations = Array.isArray(data?.operations) ? data.operations : [];
  const campaigns = normalizeCampaigns(data?.campaigns || []);

  const periodCalls = calls.filter((item) => isCurrentMonth(recordDate(item)));
  const periodMeetings = meetings.filter((item) => isCurrentMonth(recordDate(item)));
  const periodOperations = operations.filter((item) => isCurrentMonth(recordDate(item)));
  const connectedCalls = periodCalls.filter(isConnectedCall);
  const outcomeOperations = periodOperations.filter(isBusinessOutcome);

  const agentViews = agents.map((agent, index) => {
    const id = String(agent?.id || agent?.agentId || `agent-${index}`);
    const name = String(agent?.name || agent?.agentName || `AI Agent ${index + 1}`);
    const agentCalls = periodCalls.filter((item) => recordAgentId(item) === id);
    const agentMeetings = periodMeetings.filter((item) => recordAgentId(item) === id);
    const agentOperations = outcomeOperations.filter((item) => recordAgentId(item) === id);
    const fromNumber = String(agent?.fromNumber || agent?.phoneNumber || agent?.number || "").trim();
    const systemPrompt = String(agent?.systemPrompt || agent?.prompt || "").trim();
    const businessKnowledge = String(agent?.businessKnowledge || agent?.agentContext || agent?.businessContext || "").trim();
    const callingMode = normalizeCallingMode(agent?.callingMode || agent?.mode || agent?.direction);
    const live = agentCalls.some((item) => isLiveCallStatus(item?.status));
    const ready = Boolean(fromNumber && (systemPrompt || businessKnowledge));

    return {
      id,
      name,
      fromNumber,
      callingMode,
      primaryLanguage: String(agent?.primaryLanguage || agent?.defaultLanguage || agent?.language || "").trim(),
      calls: agentCalls.length,
      conversations: agentCalls.filter(isConnectedCall).length,
      meetings: agentMeetings.length,
      outcomes: agentOperations.length,
      live,
      ready,
    };
  });

  const numberCount = new Set(agentViews.map((item) => item.fromNumber).filter(Boolean)).size;
  const brainReadyCount = agentViews.filter((item) => item.ready).length;
  const activeCampaigns = campaigns.filter((item) => isActiveCampaign(item)).length;
  const readinessChecks = [agents.length > 0, numberCount > 0, brainReadyCount > 0, campaigns.length > 0, operations.length > 0];
  const readinessPercent = Math.round((readinessChecks.filter(Boolean).length / readinessChecks.length) * 100);

  return {
    agentCount: agents.length,
    numberCount,
    brainReadyCount,
    liveCalls: calls.filter((item) => isLiveCallStatus(item?.status)).length,
    activeCampaigns,
    totalCampaigns: campaigns.length,
    campaigns: campaigns.map((campaign, index) => ({
      id: String(campaign?.id || campaign?.campaignId || `campaign-${index}`),
      name: String(campaign?.name || campaign?.title || `Campaign ${index + 1}`),
      modeLabel: campaignModeLabel(campaign),
      statusLabel: humanizeStatus(campaign?.status || campaign?.state || "ready"),
      active: isActiveCampaign(campaign),
      raw: campaign,
    })),
    operations,
    period: {
      calls: periodCalls.length,
      conversations: connectedCalls.length,
      meetings: periodMeetings.length,
      outcomes: outcomeOperations.length,
    },
    agents: agentViews.sort((a, b) => (b.calls + b.meetings + b.outcomes) - (a.calls + a.meetings + a.outcomes)),
    recentActivity: buildRecentActivity({ calls, meetings, operations }),
    readinessPercent,
  };
}

function buildRecentActivity({ calls, meetings, operations }) {
  const items = [];

  calls.forEach((call, index) => {
    const at = recordDate(call);
    if (!at || !isConnectedCall(call)) return;
    const person = call?.lead?.business || call?.lead?.name || call?.contactName || call?.to || call?.from || "Caller";
    items.push({
      id: `call-${call?.id || index}-${at.getTime()}`,
      at,
      tone: "primary",
      icon: <Phone size={14} />,
      title: `Conversation with ${person}`,
      description: callSummary(call),
    });
  });

  meetings.forEach((meeting, index) => {
    const at = recordDate(meeting);
    if (!at) return;
    const person = meeting?.customerName || meeting?.contactName || meeting?.lead?.business || meeting?.lead?.name || "Customer";
    items.push({
      id: `meeting-${meeting?.id || index}-${at.getTime()}`,
      at,
      tone: "success",
      icon: <Calendar size={14} />,
      title: `Booking created for ${person}`,
      description: String(meeting?.title || meeting?.service || meeting?.meetingType || "Confirmed through the connected AI workflow."),
    });
  });

  operations.forEach((operation, index) => {
    const at = recordDate(operation);
    if (!at || !isBusinessOutcome(operation)) return;
    const person = operation?.customerName || operation?.guestName || operation?.contactName || operation?.lead?.name || "Customer";
    items.push({
      id: `operation-${operation?.id || index}-${at.getTime()}`,
      at,
      tone: "violet",
      icon: <Database size={14} />,
      title: `${humanizeStatus(operation?.status || "confirmed")} ${operationLabel(operation)} · ${person}`,
      description: String(operation?.service || operation?.summary || operation?.notes || "Business outcome recorded by ReachFly."),
    });
  });

  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

function normalizeAgents(dashboard) {
  if (Array.isArray(dashboard?.agents)) return dashboard.agents.filter(Boolean);
  if (dashboard?.agent) return [dashboard.agent];
  return [];
}

function normalizeCampaigns(payload) {
  if (Array.isArray(payload)) return payload.filter(Boolean);
  const source = payload?.campaigns || payload?.items || payload?.records || payload?.data || [];
  return Array.isArray(source) ? source.filter(Boolean) : [];
}

function normalizeOperations(payload) {
  if (Array.isArray(payload)) return payload.filter(Boolean);
  const source = payload?.records || payload?.operations || payload?.items || payload?.data || [];
  return Array.isArray(source) ? source.filter(Boolean) : [];
}

function fulfilledValue(result, fallback) {
  return result?.status === "fulfilled" ? result.value ?? fallback : fallback;
}

function buildGoalForm(saved) {
  const source = saved && typeof saved === "object" ? saved : {};
  return {
    calls: goalInputValue(source.calls),
    conversations: goalInputValue(source.conversations),
    meetings: goalInputValue(source.meetings),
    outcomes: goalInputValue(source.outcomes),
  };
}

function sanitizeGoals(value) {
  return {
    calls: positiveNumber(value?.calls),
    conversations: positiveNumber(value?.conversations),
    meetings: positiveNumber(value?.meetings),
    outcomes: positiveNumber(value?.outcomes),
    period: "monthly",
    updatedAt: new Date().toISOString(),
  };
}

function goalInputValue(value) {
  const number = positiveNumber(value);
  return number ? String(number) : "";
}

function positiveNumber(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function recordAgentId(item) {
  return String(item?.agentId || item?.aiAgentId || item?.voiceAgentId || item?.agent?.id || "");
}

function recordDate(item) {
  const values = [
    item?.completedAt,
    item?.confirmedAt,
    item?.bookedAt,
    item?.meetingBookedAt,
    item?.endedAt,
    item?.startedAt,
    item?.scheduledAt,
    item?.startTime,
    item?.createdAt,
    item?.updatedAt,
    item?.timestamp,
    item?.at,
  ];

  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function isCurrentMonth(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isConnectedCall(call) {
  const status = normalizeToken(call?.status || call?.callStatus || call?.state);
  const outcome = normalizeToken(call?.outcome || call?.result || call?.disposition || call?.lead?.outcome);
  const duration = Number(call?.durationSeconds ?? call?.duration ?? call?.talkTimeSeconds ?? 0);

  if (["connected", "completed", "answered", "qualified", "interested", "meeting_booked", "booked"].includes(status)) return true;
  if (["connected", "completed", "qualified", "interested", "meeting_booked", "booked", "won", "order_confirmed", "reservation_confirmed"].includes(outcome)) return true;
  return Number.isFinite(duration) && duration >= 15;
}

function isLiveCallStatus(value) {
  return ["initiated", "dialing", "ringing", "connected", "in_progress", "active"].includes(normalizeToken(value));
}

function isBusinessOutcome(operation) {
  const status = normalizeToken(operation?.status || operation?.state || operation?.outcome);
  return ["confirmed", "completed", "booked", "reserved", "accepted", "fulfilled", "paid", "won", "order_confirmed"].includes(status);
}

function isActiveCampaign(campaign) {
  return ["active", "running", "sending", "calling", "processing", "in_progress", "queued"].includes(normalizeToken(campaign?.status || campaign?.state));
}

function campaignModeLabel(campaign) {
  const mode = normalizeToken(campaign?.channel || campaign?.mode || campaign?.type || campaign?.outreachMode);
  if (mode.includes("voice") || mode.includes("call")) return "AI Voice campaign";
  if (mode.includes("email")) return "Email campaign";
  return campaign?.agentId || campaign?.aiAgentId ? "AI agent campaign" : "Outbound campaign";
}

function operationLabel(operation) {
  const value = operation?.type || operation?.kind || operation?.operationType || operation?.category || "business outcome";
  return humanizeStatus(value).toLowerCase();
}

function callSummary(call) {
  const summary = call?.summary || call?.aiSummary || call?.outcomeSummary || call?.notes;
  if (summary) return String(summary);
  const outcome = call?.outcome || call?.result || call?.disposition;
  if (outcome) return humanizeStatus(outcome);
  return "Connected AI voice conversation recorded in ReachFly.";
}

function normalizeCallingMode(value) {
  const mode = normalizeToken(value);
  if (["both", "inbound_outbound", "inbound_and_outbound"].includes(mode)) return "both";
  if (mode.includes("inbound")) return "inbound";
  return "outbound";
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function humanizeStatus(value) {
  const token = normalizeToken(value);
  if (!token) return "Ready";
  return token.split("_").map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : "").join(" ");
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))).toLocaleString() : "0";
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "now";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatRelativeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function initials(value) {
  const words = String(value || "AI").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("") || "AI";
}

function GoalsStyles() {
  return <style>{GOALS_CSS}</style>;
}

const GOALS_CSS = `
.rf-goals-v7{--p:#4648d4;--ps:#ededff;--t:#191c1d;--ts:#484752;--m:#777684;--line:#e4e5e8;--soft:#f6f6f8;--green:#087a51;--greens:#e5f8ef;--red:#b3261e;--reds:#fff0ee;--violet:#6f43cb;--violets:#f3edff;width:100%;min-height:100%;padding:32px;color:var(--t);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:rfgIn .22s ease-out}.rf-goals-v7 *{box-sizing:border-box}.rf-goals-v7 a{color:inherit;text-decoration:none}.rf-goals-v7 button,.rf-goals-v7 input{font:inherit}.rf-goals-v7 .spin{animation:rfgSpin .8s linear infinite}@keyframes rfgSpin{to{transform:rotate(360deg)}}@keyframes rfgIn{from{opacity:.65;transform:translateY(4px)}to{opacity:1;transform:none}}
.rfg-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:26px 28px;margin-bottom:16px;border:1px solid #e1e2ef;border-radius:18px;background:linear-gradient(135deg,#f8f8ff 0%,#fff 60%,#f7f3ff 100%);box-shadow:0 12px 32px rgba(25,28,29,.04)}.rfg-hero-copy{max-width:820px}.rfg-eyebrow{display:inline-flex;align-items:center;gap:6px;color:var(--p);font-size:8px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.rfg-hero h1{max-width:760px;margin:7px 0 8px;font:650 31px/38px Geist,Inter,sans-serif;letter-spacing:-.035em}.rfg-hero p{max-width:760px;margin:0;color:var(--m);font-size:10px;line-height:17px}.rfg-updated{display:flex;align-items:center;gap:7px;margin-top:12px;color:var(--m);font-size:8px}.rfg-updated .live{width:9px;height:9px;display:grid;place-items:center}.rfg-updated .live i{width:6px;height:6px;border-radius:50%;background:#18a96b;box-shadow:0 0 0 4px rgba(24,169,107,.1)}.rfg-updated .live.spinning i{background:var(--p);box-shadow:0 0 0 4px rgba(70,72,212,.1)}.rfg-hero-actions{display:flex;gap:8px;flex-wrap:wrap}.rfg-btn{min-height:38px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 13px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ts);font-size:8px;font-weight:760;cursor:pointer;transition:.15s ease}.rfg-btn:hover:not(:disabled){transform:translateY(-1px);border-color:#c9caff}.rfg-btn.primary{color:#fff;background:var(--p);border-color:var(--p);box-shadow:0 8px 18px rgba(70,72,212,.15)}.rfg-btn.secondary{background:#fff}.rfg-btn.compact{min-height:32px;padding:0 10px}.rfg-btn:disabled{opacity:.48;cursor:not-allowed;transform:none}
.rfg-notice{display:grid;grid-template-columns:30px minmax(0,1fr) 28px;gap:9px;align-items:flex-start;padding:10px 12px;margin-bottom:12px;border:1px solid #dadbf9;border-radius:11px;background:#f8f8ff}.rfg-notice>span{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:#ececff;color:var(--p)}.rfg-notice b{font-size:9px}.rfg-notice p{margin:2px 0 0;color:var(--m);font-size:8px;line-height:13px}.rfg-notice>button{border:0;background:transparent;color:#9695a0;cursor:pointer}.rfg-notice.success{background:#f4fbf7;border-color:#d3edde}.rfg-notice.success>span{background:#e3f7ec;color:var(--green)}.rfg-notice.error{background:#fff7f6;border-color:#f0d3cf}.rfg-notice.error>span{background:#ffebe8;color:var(--red)}
.rfg-journey{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr) 18px minmax(0,1fr) 18px minmax(0,1fr) 18px minmax(0,1fr);align-items:center;gap:6px;padding:10px;margin-bottom:12px;border:1px solid var(--line);border-radius:13px;background:#fff}.rfg-journey-arrow{color:#bbbcc5}.rfg-journey-node{min-width:0;display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:center;padding:9px;border:1px solid #ececf0;border-radius:9px;background:#fbfbfc;transition:.15s ease}.rfg-journey-node:hover{border-color:#d5d6ff;transform:translateY(-1px)}.rfg-journey-node>span{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:#efeff2;color:#888a95}.rfg-journey-node.ready>span{background:var(--ps);color:var(--p)}.rfg-journey-node small,.rfg-journey-node b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rfg-journey-node small{color:var(--m);font-size:6.5px;text-transform:uppercase;letter-spacing:.05em}.rfg-journey-node b{margin-top:2px;font-size:11px}
.rfg-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:12px}.rfg-kpi{min-height:92px;display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;align-items:flex-start;padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:0 7px 20px rgba(25,28,29,.025)}.rfg-kpi>span{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:var(--soft);color:var(--p)}.rfg-kpi.highlight{border-color:#d7d8ff;background:linear-gradient(135deg,#f8f8ff,#fff)}.rfg-kpi small,.rfg-kpi b,.rfg-kpi p{display:block}.rfg-kpi small{color:var(--m);font-size:7px}.rfg-kpi b{margin-top:4px;font-size:22px;line-height:24px;letter-spacing:-.03em}.rfg-kpi p{margin:3px 0 0;color:#92919b;font-size:7px;line-height:11px}
.rfg-grid-main{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.7fr);gap:12px;margin-bottom:12px}.rfg-card{border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:0 8px 24px rgba(25,28,29,.025)}.rfg-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:15px 16px;border-bottom:1px solid #efeff2}.rfg-card-head h2{margin:3px 0 0;font:620 15px/20px Geist,Inter,sans-serif;letter-spacing:-.02em}.rfg-card-head p{max-width:680px;margin:3px 0 0;color:var(--m);font-size:7.5px;line-height:12px}.rfg-card-head.compact-head{align-items:center}.rfg-text-link{display:inline-flex;align-items:center;gap:5px;color:var(--p)!important;font-size:7px;font-weight:760;white-space:nowrap}
.rfg-goal-list{display:grid}.rfg-goal-row{display:grid;grid-template-columns:34px minmax(0,1fr) 115px 64px;gap:10px;align-items:center;padding:12px 16px;border-top:1px solid #f0f0f2}.rfg-goal-row:first-child{border-top:0}.rfg-goal-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:var(--ps);color:var(--p)}.rfg-goal-copy{min-width:0}.rfg-goal-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.rfg-goal-title b{font-size:8px}.rfg-goal-title span{color:var(--m);font-size:7px}.rfg-goal-copy small{display:block;margin-top:2px;color:#94939d;font-size:6.5px;line-height:10px}.rfg-progress{height:5px;overflow:hidden;margin-top:7px;border-radius:999px;background:#eeeeF2}.rfg-progress i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--p),#7779ef);transition:width .35s ease}.rfg-progress.empty i{width:0!important}.rfg-goal-input{display:grid;gap:4px}.rfg-goal-input span{color:var(--m);font-size:6px;text-transform:uppercase}.rfg-goal-input input{width:100%;height:32px;padding:0 8px;border:1px solid var(--line);border-radius:7px;outline:0;font-size:8px}.rfg-goal-input input:focus{border-color:#bfc0ff;box-shadow:0 0 0 3px rgba(70,72,212,.06)}.rfg-goal-percent{text-align:right}.rfg-goal-percent b,.rfg-goal-percent small{display:block}.rfg-goal-percent b{font-size:12px;color:var(--p)}.rfg-goal-percent small{margin-top:1px;color:var(--m);font-size:6px}
.rfg-health-list{display:grid;padding:7px}.rfg-health-row{display:grid;grid-template-columns:28px minmax(0,1fr) 14px;gap:8px;align-items:center;padding:8px;border-radius:8px;transition:.15s ease}.rfg-health-row:hover{background:#f8f8fb}.rfg-health-row>span{width:26px;height:26px;display:grid;place-items:center;border-radius:7px}.rfg-health-row>span.ready{background:var(--greens);color:var(--green)}.rfg-health-row>span.needs{background:#fff4dd;color:#8b6400}.rfg-health-row b,.rfg-health-row small{display:block}.rfg-health-row b{font-size:7.5px}.rfg-health-row small{margin-top:1px;color:var(--m);font-size:6.5px}.rfg-health-row>svg{color:#b1b1ba}.rfg-health-callout{display:flex;gap:9px;align-items:flex-start;padding:11px;margin:0 10px 10px;border-radius:9px;background:linear-gradient(135deg,#f1f1ff,#f8f5ff);color:var(--p)}.rfg-health-callout>svg{flex:0 0 auto}.rfg-health-callout b{display:block;font-size:8px}.rfg-health-callout p{margin:2px 0 0;color:#6f6e7a;font-size:6.5px;line-height:10px}
.rfg-agent-section{margin-bottom:12px}.rfg-agent-table-wrap{overflow:auto}.rfg-agent-table{width:100%;border-collapse:collapse;min-width:880px}.rfg-agent-table th{text-align:left;padding:8px 12px;color:#898894;background:#fafafb;border-bottom:1px solid #eeeef1;font-size:6px;text-transform:uppercase;letter-spacing:.05em}.rfg-agent-table td{padding:10px 12px;border-bottom:1px solid #f0f0f2;color:var(--ts);font-size:7.5px}.rfg-agent-table tbody tr:last-child td{border-bottom:0}.rfg-agent-name{display:flex;align-items:center;gap:8px}.rfg-agent-name>span{width:31px;height:31px;display:grid;place-items:center;border-radius:9px;background:linear-gradient(135deg,var(--p),#8061dc);color:#fff;font-size:7px;font-weight:800}.rfg-agent-name b,.rfg-agent-name small{display:block}.rfg-agent-name b{font-size:8px}.rfg-agent-name small{margin-top:1px;color:var(--m);font-size:6px}.rfg-direction,.rfg-state{display:inline-flex;align-items:center;padding:4px 6px;border-radius:999px;font-size:6px;font-weight:760;white-space:nowrap}.rfg-direction{background:#f0f0f3;color:#6d6c77}.rfg-direction.inbound{background:#eaf7f2;color:#08734d}.rfg-direction.both{background:var(--violets);color:var(--violet)}.rfg-state.ready{background:var(--greens);color:var(--green)}.rfg-state.live{background:#e9f8f0;color:#087a51;box-shadow:inset 0 0 0 1px #cbead9}.rfg-state.needs{background:#fff1e8;color:#a14c14}.rfg-number{display:inline-flex;align-items:center;gap:4px}.rfg-missing-link{color:var(--p)!important;font-weight:700}
.rfg-grid-bottom{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rfg-activity-list,.rfg-campaign-list{display:grid}.rfg-activity{display:grid;grid-template-columns:31px minmax(0,1fr) auto;gap:9px;align-items:flex-start;padding:10px 12px;border-top:1px solid #f0f0f2}.rfg-activity:first-child{border-top:0}.rfg-activity-icon{width:29px;height:29px;display:grid;place-items:center;border-radius:8px;background:var(--ps);color:var(--p)}.rfg-activity-icon.success{background:var(--greens);color:var(--green)}.rfg-activity-icon.violet{background:var(--violets);color:var(--violet)}.rfg-activity b,.rfg-activity p{display:block}.rfg-activity b{font-size:7.5px}.rfg-activity p{margin:2px 0 0;color:var(--m);font-size:6.5px;line-height:10px}.rfg-activity time{color:#9998a1;font-size:6px;white-space:nowrap}.rfg-campaign-row{display:grid;grid-template-columns:31px minmax(0,1fr) auto 14px;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid #f0f0f2}.rfg-campaign-row:first-child{border-top:0}.rfg-campaign-row:hover{background:#fafaff}.rfg-campaign-icon{width:29px;height:29px;display:grid;place-items:center;border-radius:8px;background:#f0f0ff;color:var(--p)}.rfg-campaign-row b,.rfg-campaign-row small{display:block}.rfg-campaign-row b{font-size:7.5px}.rfg-campaign-row small{margin-top:1px;color:var(--m);font-size:6px}.rfg-campaign-row>svg{color:#aaaab3}.rfg-empty{min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--m)}.rfg-empty>span{width:45px;height:45px;display:grid;place-items:center;margin-bottom:9px;border-radius:12px;background:var(--ps);color:var(--p)}.rfg-empty b{color:var(--t);font-size:9px}.rfg-empty p{max-width:430px;margin:4px auto 10px;font-size:7px;line-height:11px}.rfg-empty.compact{min-height:210px}.rfg-empty-inline{min-height:170px;display:flex;align-items:center;justify-content:center;gap:8px;padding:20px;color:var(--m);font-size:7px}
.rfg-skeleton{display:grid;gap:12px}.rfg-sk-hero,.rfg-sk-row i,.rfg-sk-main i,.rfg-sk-table{overflow:hidden;position:relative;background:#eeeef2;border-radius:14px}.rfg-sk-hero:after,.rfg-sk-row i:after,.rfg-sk-main i:after,.rfg-sk-table:after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.8),transparent);animation:rfgShimmer 1.1s infinite}@keyframes rfgShimmer{to{transform:translateX(100%)}}.rfg-sk-hero{height:180px}.rfg-sk-row{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.rfg-sk-row i{height:92px}.rfg-sk-main{display:grid;grid-template-columns:1.7fr .7fr;gap:12px}.rfg-sk-main i{height:340px}.rfg-sk-table{height:280px}
@media(max-width:1180px){.rf-goals-v7{padding:26px 22px}.rfg-kpis{grid-template-columns:repeat(3,1fr)}.rfg-journey{grid-template-columns:repeat(5,minmax(0,1fr))}.rfg-journey-arrow{display:none}.rfg-grid-main{grid-template-columns:1fr}.rfg-sk-row{grid-template-columns:repeat(3,1fr)}.rfg-sk-main{grid-template-columns:1fr}}
@media(max-width:820px){.rf-goals-v7{padding:18px 14px 84px}.rfg-hero{align-items:flex-start;flex-direction:column;padding:22px}.rfg-hero h1{font-size:26px;line-height:32px}.rfg-hero-actions{width:100%}.rfg-hero-actions .rfg-btn{flex:1}.rfg-journey{grid-template-columns:1fr 1fr}.rfg-journey-node:last-of-type{grid-column:1/-1}.rfg-kpis{grid-template-columns:1fr 1fr}.rfg-goal-row{grid-template-columns:32px minmax(0,1fr) 105px}.rfg-goal-percent{grid-column:2/4;display:flex;align-items:center;justify-content:space-between;padding-left:0}.rfg-grid-bottom{grid-template-columns:1fr}.rfg-sk-row{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.rf-goals-v7{padding:14px 10px 82px}.rfg-kpis,.rfg-journey{grid-template-columns:1fr}.rfg-journey-node:last-of-type{grid-column:auto}.rfg-card-head{align-items:flex-start;flex-direction:column}.rfg-card-head .rfg-btn,.rfg-text-link{width:100%;justify-content:center}.rfg-goal-row{grid-template-columns:30px minmax(0,1fr)}.rfg-goal-input{grid-column:2}.rfg-goal-percent{grid-column:2}.rfg-sk-row{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.rf-goals-v7,.rf-goals-v7 *, .rf-goals-v7 .spin{animation:none!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
`;
