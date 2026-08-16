import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

export default function DashboardV6() {
  const { user } = useAuth();
  const [data, setData] = useState({ base: {}, voice: {}, commerce: {}, billing: {}, connections: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [base, voice, commerce, billing, connections] = await Promise.all([
        api.dashboard().catch(() => ({})),
        api.voiceAgentDashboard().catch(() => ({})),
        api.voiceCommerce().catch(() => ({})),
        api.billingCredits().catch(() => ({})),
        api.connections().catch(() => ({})),
      ]);
      setData({ base, voice, commerce, billing, connections });
    } catch (requestError) {
      setError(requestError?.message || "Dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const agents = data.voice?.agents || (data.voice?.agent ? [data.voice.agent] : []);
  const summary = data.voice?.summary || {};
  const credits = Math.floor(Number(data.billing?.aiCalling?.wallet?.balance || 0));
  const emailConnected = (data.connections?.emailConnections || []).length > 0;
  const calendarConnected = (data.connections?.calendarConnections || []).length > 0;
  const phoneConnected = Boolean(data.commerce?.activeNumber);
  const readyLeads = Number(summary.assignableLeads || pick(data.base, ["readyLeads", "leadsReady", "contacts"]) || 0);
  const queued = Number(summary.queuedLeads || 0);
  const liveCalls = Number(summary.activeCalls || 0);
  const upcomingMeetings = Number(summary.meetingsUpcoming || 0);
  const callsToday = Number(summary.callsToday || 0);
  const campaigns = Number(pick(data.base, ["activeCampaigns", "campaignsActive", "campaigns"]) || 0);

  const attention = useMemo(() => {
    const items = [];
    if (!agents.length) items.push(["critical", "Create your first AI agent", "/app/agents"]);
    if (!phoneConnected) items.push(["warning", "Add or connect a business number", "/app/commerce"]);
    if (!emailConnected) items.push(["info", "Connect email for agent follow-ups", "/app/connections"]);
    if (!calendarConnected) items.push(["info", "Connect a calendar for meeting booking", "/app/connections"]);
    if (credits <= 5) items.push(["warning", `${credits} AI call credits remaining`, "/app/commerce"]);
    for (const agent of agents) {
      if (agent.enabled !== false && agent.outboundActions?.bookMeeting !== false && !agent.calendarConnectionId) {
        items.push(["info", `${agent.name} has no calendar assigned`, "/app/agents"]);
      }
    }
    if (!items.length) items.push(["good", "Your AI workforce is ready to operate", "/app/agents"]);
    return items.slice(0, 5);
  }, [agents, phoneConnected, emailConnected, calendarConnected, credits]);

  if (loading) return <div className="rf-v6-loading">Preparing your command center…</div>;

  return (
    <main className="rf-v6-page rf-v6-dashboard">
      <header className="rf-v6-command-hero">
        <div className="rf-v6-command-copy">
          <span className="rf-v6-kicker">AI sales command center</span>
          <h1>{greeting()}, {firstName(user?.name)}.</h1>
          <p>{agents.length ? `${agents.filter((item) => item.enabled !== false).length} AI agent${agents.length === 1 ? " is" : "s are"} ready across your voice, email and meeting workflows.` : "Build your first AI agent and connect the channels it needs to work."}</p>
          <div className="rf-v6-hero-actions"><a className="rf-v6-btn primary" href="/app/builder">+ New campaign</a><a className="rf-v6-btn ghost" href="/app/agents">+ New agent</a></div>
        </div>
        <div className="rf-v6-live-core">
          <div className={liveCalls ? "pulse" : ""}><span>Live conversations</span><strong>{liveCalls}</strong></div>
          <div><span>AI call credits</span><strong>{credits}</strong></div>
          <small>{callsToday} call{callsToday === 1 ? "" : "s"} started today</small>
        </div>
      </header>

      {error ? <div className="rf-v6-alert error">{error}</div> : null}

      <section className="rf-v6-metric-grid">
        <Metric label="Ready leads" value={readyLeads} text="Callable prospects" />
        <Metric label="Queued" value={queued} text="Waiting for approved execution" />
        <Metric label="Live calls" value={liveCalls} text="AI conversations now" live={liveCalls > 0} />
        <Metric label="Upcoming meetings" value={upcomingMeetings} text="Confirmed next steps" />
        <Metric label="Active campaigns" value={campaigns} text="Current sales motions" />
      </section>

      <section className="rf-v6-dashboard-grid">
        <article className="rf-v6-panel rf-v6-workforce-panel">
          <div className="rf-v6-section-head"><div><span>AI workforce</span><h2>Agents at work</h2><p>Agent-level capacity and resource health.</p></div><a href="/app/agents">Manage agents</a></div>
          {!agents.length ? <div className="rf-v6-empty"><strong>Your AI workforce is empty.</strong><span>Create the first focused agent, assign a number, then run a controlled test.</span><a className="rf-v6-btn primary" href="/app/agents">Create agent</a></div> : (
            <div className="rf-v6-dashboard-agents">
              {agents.slice(0, 6).map((agent) => {
                const active = (data.voice?.calls || []).filter((call) => call.agentId === agent.id && ["initiated", "dialing", "ringing", "connected", "in_progress"].includes(String(call.status || "").toLowerCase())).length;
                const agentQueued = (data.voice?.queue || []).filter((item) => item.agentId === agent.id && item.status === "queued").length;
                return <a href="/app/agents" className="rf-v6-dashboard-agent" key={agent.id}><span className={`rf-v6-agent-avatar purpose-${agent.purpose || "sales"}`}>{initials(agent.name)}</span><div><strong>{agent.name}</strong><small>{agent.fromNumber || "Number not assigned"}</small></div><div className="rf-v6-agent-live"><b>{active}</b><span>live</span><b>{agentQueued}</b><span>queued</span></div></a>;
              })}
            </div>
          )}
        </article>

        <article className="rf-v6-panel rf-v6-attention-panel">
          <div className="rf-v6-section-head"><div><span>Attention</span><h2>What needs you</h2><p>ReachFly surfaces blockers before they stop a campaign.</p></div></div>
          <div className="rf-v6-attention-list">{attention.map(([type, text, href], index) => <a className={`rf-v6-attention ${type}`} href={href} key={`${text}-${index}`}><i /><span>{text}</span><b>→</b></a>)}</div>
        </article>
      </section>

      <section className="rf-v6-dashboard-grid lower">
        <article className="rf-v6-panel">
          <div className="rf-v6-section-head"><div><span>Channel health</span><h2>Your connected sales stack</h2><p>Agents can use only the connections you explicitly assign.</p></div></div>
          <div className="rf-v6-channel-grid">
            <Channel name="Phone" ok={phoneConnected} detail={data.commerce?.activeNumber?.phoneNumber || "Add or connect number"} href={phoneConnected ? "/app/voice-agent?tab=setup&view=my-numbers" : "/app/commerce"} />
            <Channel name="Email" ok={emailConnected} detail={emailConnected ? `${data.connections.emailConnections.length} account connected` : "Connect Google Workspace"} href="/app/connections" />
            <Channel name="Calendar" ok={calendarConnected} detail={calendarConnected ? `${data.connections.calendarConnections.length} calendar connected` : "Connect booking calendar"} href="/app/connections" />
            <Channel name="WhatsApp" ok={Boolean(pick(data.base, ["whatsappConnected", "whatsappReady"]))} detail="Workspace messaging channel" href="/app/whatsapp" />
          </div>
        </article>

        <article className="rf-v6-panel">
          <div className="rf-v6-section-head"><div><span>Flow</span><h2>From lead to meeting</h2><p>A simple view of the operating journey.</p></div></div>
          <div className="rf-v6-flow-line">
            <Flow label="Ready" value={readyLeads} />
            <Flow label="Queued" value={queued} />
            <Flow label="Calls today" value={callsToday} />
            <Flow label="Meetings" value={upcomingMeetings} />
          </div>
          <div className="rf-v6-quick-grid"><a href="/app/commerce">Buy credits</a><a href="/app/voice-agent?tab=setup&view=buy-numbers">Buy number</a><a href="/app/connections">Connect email</a><a href="/app/builder">Launch campaign</a></div>
        </article>
      </section>
    </main>
  );
}

function Metric({ label, value, text, live }) { return <article className={`rf-v6-metric ${live ? "live" : ""}`}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong><small>{text}</small></article>; }
function Channel({ name, ok, detail, href }) { return <a className="rf-v6-channel" href={href}><i className={ok ? "good" : ""}>{ok ? "✓" : "!"}</i><div><strong>{name}</strong><span>{detail}</span></div><b>→</b></a>; }
function Flow({ label, value }) { return <div><strong>{Number(value || 0).toLocaleString()}</strong><span>{label}</span></div>; }
function pick(value, keys) { for (const key of keys) { const candidate = value?.[key] ?? value?.summary?.[key] ?? value?.stats?.[key]; if (candidate !== undefined && candidate !== null) return candidate; } return 0; }
function firstName(value) { return String(value || "there").trim().split(/\s+/)[0] || "there"; }
function greeting() { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; }
function initials(value) { return String(value || "AI").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
