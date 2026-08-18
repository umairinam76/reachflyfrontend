import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Style } from "@dicebear/core";
import loreleiDefinition from "@dicebear/styles/lorelei.json" with { type: "json" };
import { api } from "../api";
import {
  Activity,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Target,
  X,
  Zap,
} from "../components/icons";

const VOICE_ART_STYLE = new Style(loreleiDefinition);

const PURPOSES = [
  ["sales", "Outbound sales", "Qualify prospects, handle objections and book meetings."],
  ["reception", "Inbound receptionist", "Answer inbound calls, capture intent and route the next step."],
  ["appointment", "Appointment setter", "Focus on qualification, calendar availability and confirmed bookings."],
  ["custom", "Custom agent", "Create a specialized playbook for a specific campaign or workflow."],
];

const LANGUAGES = [
  ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"],
  ["pt", "Portuguese"], ["it", "Italian"], ["nl", "Dutch"], ["ar", "Arabic"],
  ["hi", "Hindi"], ["ur", "Urdu"], ["zh", "Chinese"], ["ja", "Japanese"], ["ko", "Korean"],
  ["ru", "Russian"], ["tr", "Turkish"], ["pl", "Polish"], ["id", "Indonesian"],
  ["vi", "Vietnamese"], ["uk", "Ukrainian"],
];

const EMPTY = {
  name: "",
  purpose: "sales",
  voice: "",
  callingMode: "outbound",
  fromNumber: "",
  emailConnectionId: "",
  calendarConnectionId: "",
  agentContext: "",
  primaryLanguage: "en",
  supportedLanguages: ["en"],
  autoDetectLanguage: true,
  languageVoices: {},
  languageGreetings: {},
  concurrency: 1,
  sendEmail: false,
  bookMeeting: false,
  complianceConfirmed: false,
};

export default function AIWorkforcePage() {
  const [dashboard, setDashboard] = useState(null);
  const [voices, setVoices] = useState([]);
  const [connections, setConnections] = useState(null);
  const [commerce, setCommerce] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const load = useCallback(async ({ silent = false, successToast = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const [dashboardData, voiceData, connectionData, commerceData] = await Promise.all([
        api.voiceAgentDashboard(),
        api.voiceAgentVoices().catch(() => ({ voices: [] })),
        api.connections().catch(() => ({ connections: [], emailConnections: [], calendarConnections: [] })),
        api.voiceCommerce().catch(() => ({ numbers: [], activeNumber: null })),
      ]);
      setDashboard(dashboardData);
      setVoices(Array.isArray(voiceData?.voices) ? voiceData.voices : []);
      setConnections(connectionData);
      setCommerce(commerceData);
      setLastLoadedAt(new Date());
      if (successToast) notify("success", "Voice Agents refreshed", "Latest Voice Agent activity is now visible.");
    } catch (requestError) {
      const text = requestError?.message || "Voice Agents could not be loaded.";
      setError(text);
      if (successToast) notify("error", "Voice Agents refresh failed", text);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const agents = dashboard?.agents || (dashboard?.agent ? [dashboard.agent] : []);
  const phoneNumbers = useMemo(
    () => (commerce?.numbers || []).filter((item) => item.status === "active"),
    [commerce]
  );
  const emailConnections = connections?.emailConnections || [];
  const calendarConnections = connections?.calendarConnections || [];
  const calls = dashboard?.calls || [];
  const queue = dashboard?.queue || [];
  const meetings = dashboard?.meetings || [];

  const agentViews = useMemo(() => agents.map((agent) => {
    const id = String(agent?.id || "");
    const agentCalls = calls.filter((item) => String(item?.agentId || item?.aiAgentId || "") === id);
    const live = agentCalls.filter((item) => isLiveCallStatus(item?.status)).length;
    const queued = queue.filter((item) => String(item?.agentId || item?.aiAgentId || "") === id && normalizeToken(item?.status) === "queued").length;
    const booked = meetings.filter((item) => String(item?.agentId || item?.aiAgentId || "") === id).length;
    const voice = findVoice(voices, agent.voice) || { id: agent.voice || agent.id, name: agent.name || "ReachFly AI" };
    const readiness = getAgentReadiness(agent);
    const totalCalls = Number(agent?.stats?.totalCalls ?? agent?.totalCalls ?? agentCalls.length) || 0;
    const meetingCount = Number(agent?.stats?.meetingsBooked ?? agent?.meetingsBooked ?? booked) || 0;
    return {
      raw: agent,
      id,
      name: agent?.name || "Voice Agent",
      purposeLabel: purposeLabel(agent?.purpose),
      modeLabel: callingModeLabel(agent?.callingMode),
      active: agent?.enabled !== false,
      fromNumber: agent?.fromNumber || "",
      voice,
      voiceName: getVoiceName(voice),
      languageLabel: languageSummary(agent),
      concurrency: Number(agent?.concurrency || 1),
      totalCalls,
      live,
      queued,
      booked: meetingCount,
      conversion: totalCalls > 0 ? (meetingCount / totalCalls) * 100 : 0,
      readiness,
    };
  }), [agents, calls, queue, meetings, voices]);

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agentViews.filter((agent) => {
      if (statusFilter === "active" && !agent.active) return false;
      if (statusFilter === "paused" && agent.active) return false;
      if (statusFilter === "setup" && agent.readiness.ready) return false;
      if (!q) return true;
      return [agent.name, agent.purposeLabel, agent.modeLabel, agent.fromNumber, agent.voiceName, agent.languageLabel]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [agentViews, query, statusFilter]);

  const workforceMetrics = useMemo(() => {
    const liveFromCalls = calls.filter((item) => isLiveCallStatus(item?.status)).length;
    const queuedFromQueue = queue.filter((item) => normalizeToken(item?.status) === "queued").length;
    return {
      totalAgents: agentViews.length,
      activeAgents: agentViews.filter((item) => item.active).length,
      readyAgents: agentViews.filter((item) => item.readiness.ready).length,
      liveCalls: Number(dashboard?.summary?.activeCalls ?? liveFromCalls) || 0,
      queuedLeads: Number(dashboard?.summary?.queuedLeads ?? queuedFromQueue) || 0,
      meetings: Number(dashboard?.summary?.meetingsBooked ?? meetings.length) || 0,
      totalCalls: calls.length,
    };
  }, [agentViews, calls, queue, meetings, dashboard]);

  function openCreate() {
    setEditingId("");
    setForm({
      ...EMPTY,
      voice: voices[0]?.id || voices[0]?.voiceId || "",
      fromNumber: commerce?.activeNumber?.phoneNumber || phoneNumbers[0]?.phoneNumber || "",
      emailConnectionId: connections?.recommended?.email?.id || "",
      calendarConnectionId: connections?.recommended?.calendar?.id || "",
      sendEmail: Boolean(connections?.recommended?.email?.id),
      bookMeeting: Boolean(connections?.recommended?.calendar?.id),
    });
    setShowEditor(true);
    setMessage("");
    setError("");
  }

  function editAgent(agent) {
    setEditingId(agent.id);
    setForm({
      name: agent.name || "",
      purpose: agent.purpose || "sales",
      voice: agent.voice || "",
      callingMode: agent.callingMode || "outbound",
      fromNumber: agent.fromNumber || "",
      emailConnectionId: agent.emailConnectionId || "",
      calendarConnectionId: agent.calendarConnectionId || "",
      agentContext: agent.agentContext || "",
      primaryLanguage: agent.primaryLanguage || "en",
      supportedLanguages:
        Array.isArray(agent.supportedLanguages) && agent.supportedLanguages.length
          ? agent.supportedLanguages
          : [agent.primaryLanguage || "en"],
      autoDetectLanguage: agent.autoDetectLanguage !== false,
      languageVoices: agent.languageVoices || {},
      languageGreetings: agent.languageGreetings || {},
      concurrency: Number(agent.concurrency || 1),
      sendEmail: agent.outboundActions?.sendEmail === true || agent.inboundActions?.sendEmail === true,
      bookMeeting: agent.outboundActions?.bookMeeting !== false || agent.inboundActions?.bookMeeting !== false,
      complianceConfirmed: agent.complianceConfirmed === true,
    });
    setShowEditor(true);
    setMessage("");
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    if (!form.name.trim()) return setError("Give this AI agent a name.");
    if (!form.fromNumber) return setError("Assign an active business number first.");
    if (voices.length > 0 && !form.voice) return setError("Choose a voice before saving the agent.");
    if (form.sendEmail && !form.emailConnectionId) {
      return setError("Choose a linked email account before enabling email follow-up.");
    }
    if (form.bookMeeting && !form.calendarConnectionId) {
      return setError("Choose a linked calendar before enabling calendar booking.");
    }
    if (!form.complianceConfirmed) return setError("Confirm the calling and disclosure policy before activation.");

    try {
      setSaving(true);
      setError("");
      const payload = {
        ...(editingId ? { agentId: editingId } : { createNew: true }),
        name: form.name.trim(),
        purpose: form.purpose,
        voice: form.voice,
        callingMode: form.callingMode,
        fromNumber: form.fromNumber,
        emailConnectionId: form.emailConnectionId,
        calendarConnectionId: form.calendarConnectionId,
        agentContext: form.agentContext,
        primaryLanguage: form.primaryLanguage || "en",
        supportedLanguages: Array.from(
          new Set([form.primaryLanguage || "en", ...(form.supportedLanguages || [])])
        ),
        autoDetectLanguage: form.autoDetectLanguage === true,
        languageVoices: form.languageVoices || {},
        languageGreetings: form.languageGreetings || {},
        concurrency: Number(form.concurrency || 1),
        complianceConfirmed: true,
        enabled: true,
        inboundActions: {
          captureCaller: true,
          sendEmail: form.sendEmail,
          sendWhatsApp: false,
          bookMeeting: form.bookMeeting,
          updateCrm: true,
          transferHuman: false,
        },
        outboundActions: {
          sendEmail: form.sendEmail,
          sendWhatsApp: false,
          bookMeeting: form.bookMeeting,
          updateCrm: true,
        },
      };
      await api.saveVoiceAgent(payload);
      const text = editingId ? "AI Voice Agent updated." : "AI Voice Agent created and synchronized.";
      setMessage(text);
      setShowEditor(false);
      notify("success", editingId ? "Voice Agent updated" : "Voice Agent created", text);
      await load({ silent: true });
    } catch (requestError) {
      const text = requestError?.message || "AI Voice Agent could not be saved.";
      setError(text);
      notify("error", "Couldn't save Voice Agent", text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AIWorkforceStyles />

      <main className="rf-agents-v7 rf-v6-page rf-v6-workforce-page">
        <header className="rfa-hero">
          <div>
            <span className="rfa-eyebrow">AI Voice</span>
            <h1>AI Voice Agents</h1>
            <p>Deploy, monitor, and optimize focused conversational AI agents for your ReachFly workspace.</p>
          </div>
          <button className="rfa-create-agent" type="button" onClick={openCreate}>
            <Plus size={17} /> Create Voice Agent
          </button>
        </header>

        {error ? (
          <div className="rfa-message error" role="alert">
            <X size={15} />
            <div><strong>Voice Agents need attention</strong><span>{error}</span></div>
            <button type="button" onClick={() => void load({ successToast: true })}>Try again</button>
          </div>
        ) : null}
        {message ? (
          <div className="rfa-message success" role="status">
            <CheckCircle2 size={15} />
            <div><strong>Voice Agent updated</strong><span>{message}</span></div>
          </div>
        ) : null}

        <section className="rfa-metrics">
          <WorkforceMetric icon={<Bot size={18} />} label="Voice Agents" value={workforceMetrics.totalAgents} note={`${formatNumber(workforceMetrics.activeAgents)} active`} />
          <WorkforceMetric icon={<Activity size={18} />} label="Live Calls" value={workforceMetrics.liveCalls} note={`${formatNumber(workforceMetrics.totalCalls)} calls in loaded activity`} tone="violet" />
          <WorkforceMetric icon={<Calendar size={18} />} label="Meetings Booked" value={workforceMetrics.meetings} note="Linked to Voice Agent activity" />
          <WorkforceMetric icon={<Target size={18} />} label="Queued Leads" value={workforceMetrics.queuedLeads} note="Waiting for calling capacity" tone="neutral" />
        </section>

        <section className="rfa-toolbar">
          <div>
            <span className="rfa-eyebrow">Workspace agents</span>
            <h2>Your Voice Agents <i>{filteredAgents.length}</i></h2>
          </div>
          <div className="rfa-toolbar-actions">
            <label className="rfa-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents..." aria-label="Search Voice Agents" />
              {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={12} /></button> : null}
            </label>
            <label className="rfa-filter">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter Voice Agents">
                <option value="all">All agents</option>
                <option value="active">Active</option>
                <option value="setup">Setup needed</option>
                <option value="paused">Paused</option>
              </select>
              <ChevronDown size={13} />
            </label>
            <button className="rfa-refresh" type="button" disabled={refreshing} aria-label="Refresh Voice Agents" onClick={() => void load({ silent: true, successToast: true })}>
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        </section>

        {loading ? (
          <AgentsSkeleton />
        ) : filteredAgents.length ? (
          <section className="rfa-agent-grid">
            {filteredAgents.map((agent, index) => (
              <article className={`rfa-agent-card ${agent.readiness.ready ? "ready" : "needs-setup"}`} style={{ "--rfa-index": index }} key={agent.id}>
                <header className="rfa-agent-head">
                  <div className="rfa-agent-person">
                    <VoiceArtwork voice={agent.voice} className="rfa-agent-art" />
                    <div>
                      <h3>{agent.name}</h3>
                      <p>{agent.purposeLabel}</p>
                      <span>{agent.voiceName}</span>
                    </div>
                  </div>
                  <button type="button" className="rfa-agent-settings" aria-label={`Quick manage ${agent.name}`} onClick={() => editAgent(agent.raw)}><Settings size={16} /></button>
                </header>

                <div className="rfa-status-line">
                  <span className={`rfa-status ${agent.active ? (agent.readiness.ready ? "active" : "setup") : "paused"}`}><i />{agent.active ? (agent.readiness.ready ? "Active" : "Active · incomplete") : "Paused"}</span>
                  {!agent.readiness.ready ? <small>Setup needed</small> : null}
                </div>

                <div className="rfa-resources">
                  <Resource label="Business Number" value={agent.fromNumber || "Not assigned"} mono />
                  <Resource label="Calling Mode" value={agent.modeLabel} badge />
                  <Resource label="Languages" value={agent.languageLabel} />
                </div>

                <div className="rfa-agent-stats">
                  <AgentStat value={agent.totalCalls} label="Calls" />
                  <AgentStat value={agent.booked} label="Meetings" featured />
                  <AgentStat value={`${formatPercent(agent.conversion)}%`} label="Conv." />
                </div>

                <div className="rfa-secondary-stats">
                  <span><Activity size={12} />{agent.live} live</span>
                  <span><Target size={12} />{agent.queued} queued</span>
                  <span><Zap size={12} />{agent.concurrency} parallel</span>
                </div>

                {!agent.readiness.ready ? (
                  <div className="rfa-readiness-warning"><Shield size={14} /><div><strong>Finish setup</strong><span>{agent.readiness.missing.join(" · ")}</span></div></div>
                ) : null}

                <footer className="rfa-card-actions">
                  <Link className="secondary" to={`/app/voice-agent?tab=calls&view=call-history&agentId=${encodeURIComponent(agent.id)}`}><Activity size={14} /> View Logs</Link>
                  {agent.readiness.ready ? (
                    <Link className="primary" to={`/app/voice-agent?tab=leads&view=quick-lead&agentId=${encodeURIComponent(agent.id)}`}><Play size={14} /> Test Agent</Link>
                  ) : (
                    <Link className="primary outline" to={`/app/voice-agent?tab=setup&view=agent&agentId=${encodeURIComponent(agent.id)}`}><Settings size={14} /> Continue Setup</Link>
                  )}
                </footer>
              </article>
            ))}
          </section>
        ) : agentViews.length ? (
          <section className="rfa-empty-filter"><Search size={23} /><h2>No matching Voice Agents</h2><p>Try another search or clear the status filter.</p><button type="button" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Reset view</button></section>
        ) : (
          <section className="rfa-empty-first">
            <span><Bot size={34} /></span><span className="rfa-eyebrow">AI Voice Agents</span><h2>Build your first Voice Agent</h2>
            <p>Give the agent a role, voice, Business Number, languages, and the workspace actions it can use during conversations.</p>
            <button type="button" onClick={openCreate}><Plus size={15} /> Create Voice Agent</button>
          </section>
        )}

        <section className="rfa-readiness-strip">
          <div><span><Sparkles size={16} /></span><div><strong>Voice Agent readiness</strong><p>{workforceMetrics.totalAgents ? `${workforceMetrics.readyAgents} of ${workforceMetrics.totalAgents} loaded Voice Agents have core voice and Business Number setup in place.` : "Create a Voice Agent to begin configuring your AI calling workforce."}</p></div></div>
          <div className="rfa-readiness-links">
            {lastLoadedAt ? <span><Clock3 size={12} /> Updated {formatRelativeTime(lastLoadedAt)}</span> : null}
            <Link to="/app/phone-numbers"><Building2 size={13} /> Business Numbers</Link>
            <Link to="/app/calls"><Phone size={13} /> Calls</Link>
          </div>
        </section>

        {showEditor ? (
          <div className="rf-v6-modal-backdrop rfa-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowEditor(false); }}>
            <form className="rf-v6-agent-editor rfa-editor" onSubmit={save}>
              <div className="rf-v6-editor-head"><div><span>{editingId ? "Manage Voice Agent" : "Create Voice Agent"}</span><h2>{editingId ? "Update AI Voice Agent" : "Create a focused AI Voice Agent"}</h2></div><button type="button" onClick={() => setShowEditor(false)} disabled={saving}>×</button></div>

              <div className="rf-v6-purpose-grid">
                {PURPOSES.map(([value, title, text]) => <button type="button" className={form.purpose === value ? "active" : ""} key={value} onClick={() => setForm((current) => ({ ...current, purpose: value }))}><b>{title}</b><small>{text}</small></button>)}
              </div>

              <div className="rf-v6-form-grid two">
                <Field label="Agent name"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Sara — US Sales" /></Field>
                <div className="rf-v6-voice-field"><span className="rf-v6-voice-field-label">Voice</span><VoicePicker voices={voices} value={form.voice} onChange={(voiceId) => setForm((current) => ({ ...current, voice: voiceId }))} /></div>
                <Field label="Calling mode"><select value={form.callingMode} onChange={(event) => setForm((current) => ({ ...current, callingMode: event.target.value }))}><option value="outbound">Outbound</option><option value="inbound">Inbound</option><option value="both">Inbound + outbound</option></select></Field>
                <Field label="Business Number"><select value={form.fromNumber} onChange={(event) => setForm((current) => ({ ...current, fromNumber: event.target.value }))}><option value="">Choose number</option>{phoneNumbers.map((item) => <option key={item.phoneNumber} value={item.phoneNumber}>{item.phoneNumber}</option>)}</select></Field>
                <Field label="Email account"><select value={form.emailConnectionId} onChange={(event) => setForm((current) => ({ ...current, emailConnectionId: event.target.value }))}><option value="">No email</option>{emailConnections.map((item) => <option key={item.id} value={item.id}>{item.accountEmail || item.email || item.label || "Connected account"}</option>)}</select></Field>
                <Field label="Booking calendar"><select value={form.calendarConnectionId} onChange={(event) => setForm((current) => ({ ...current, calendarConnectionId: event.target.value }))}><option value="">No calendar</option>{calendarConnections.map((item) => <option key={item.id} value={item.id}>{item.accountEmail || item.email || item.label || "Connected calendar"}</option>)}</select></Field>
                <Field label="Parallel calls"><input type="number" min="1" max="20" value={form.concurrency} onChange={(event) => setForm((current) => ({ ...current, concurrency: event.target.value }))} /></Field>
              </div>

              <section className="rf-v6-language-editor">
                <div className="rf-v6-section-head compact"><div><span>Voice & language</span><h3>Choose how this agent speaks</h3><p>Outbound calls start in the resolved lead or campaign language. Inbound calls can detect and switch between enabled languages.</p></div></div>
                <div className="rf-v6-form-grid two">
                  <Field label="Primary language"><select value={form.primaryLanguage} onChange={(event) => { const language = event.target.value; setForm((current) => ({ ...current, primaryLanguage: language, supportedLanguages: Array.from(new Set([language, ...(current.supportedLanguages || [])])) })); }}>{LANGUAGES.map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></Field>
                  <Toggle checked={form.autoDetectLanguage} onChange={(checked) => setForm((current) => ({ ...current, autoDetectLanguage: checked }))} title="Auto-detect caller language" text="Allow ReachFly AI to switch naturally between enabled languages during the conversation." />
                </div>
                <div className="rf-v6-language-chips">{LANGUAGES.map(([code, name]) => { const checked = (form.supportedLanguages || []).includes(code); const locked = code === form.primaryLanguage; return <label key={code} className={checked ? "active" : ""}><input type="checkbox" checked={checked} disabled={locked} onChange={(event) => setForm((current) => ({ ...current, supportedLanguages: event.target.checked ? Array.from(new Set([...(current.supportedLanguages || []), code])) : (current.supportedLanguages || []).filter((item) => item !== code) }))} /><span>{name}</span></label>; })}</div>
                <div className="rf-v6-language-overrides">{(form.supportedLanguages || []).map((code) => { const name = LANGUAGES.find(([item]) => item === code)?.[1] || code.toUpperCase(); return <div className="rf-v6-language-row" key={code}><strong>{name}</strong><Field label="Voice override (optional)"><select value={form.languageVoices?.[code] || ""} onChange={(event) => setForm((current) => ({ ...current, languageVoices: { ...(current.languageVoices || {}), [code]: event.target.value } }))}><option value="">Use agent voice</option>{voices.map((voice) => <option value={voice.id || voice.voiceId} key={`${code}-${voice.id || voice.voiceId}`}>{voice.name || voice.voiceName || voice.id}</option>)}</select></Field><Field label="Opening line (optional)"><textarea rows="2" value={form.languageGreetings?.[code] || ""} onChange={(event) => setForm((current) => ({ ...current, languageGreetings: { ...(current.languageGreetings || {}), [code]: event.target.value } }))} placeholder={`Optional ${name} opening line`} /></Field></div>; })}</div>
              </section>

              <Field label="Agent context"><textarea rows="7" value={form.agentContext} onChange={(event) => setForm((current) => ({ ...current, agentContext: event.target.value }))} placeholder="Persistent context: offer, positioning, guardrails, qualification criteria, and what this agent should know across campaigns…" /></Field>

              <div className="rf-v6-permission-grid">
                <Toggle checked={form.sendEmail} onChange={(checked) => setForm((current) => ({ ...current, sendEmail: checked }))} title="Send email" text="Allow approved follow-ups using the assigned mailbox." />
                <Toggle checked={form.bookMeeting} onChange={(checked) => setForm((current) => ({ ...current, bookMeeting: checked }))} title="Book meetings" text="Allow the agent to check availability and create confirmed events." />
              </div>

              <label className="rf-v6-compliance"><input type="checkbox" checked={form.complianceConfirmed} onChange={(event) => setForm((current) => ({ ...current, complianceConfirmed: event.target.checked }))} /><span><b>Approve calling, suppression, and disclosure policy</b><small>I confirm this agent will use permitted calling, respect suppression requests, and use required automated-caller or recording disclosures.</small></span></label>

              <div className="rf-v6-editor-actions"><button className="rf-v6-btn secondary" type="button" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</button><button className="rf-v6-btn primary" disabled={saving} type="submit">{saving ? "Synchronizing…" : editingId ? "Save Agent" : "Create Agent"}</button></div>
            </form>
          </div>
        ) : null}
      </main>
    </>
  );
}

function WorkforceMetric({ icon, label: metricLabel, value, note, tone = "primary" }) {
  return <article className={`rfa-metric ${tone}`}><span>{icon}</span><div><small>{metricLabel}</small><strong>{formatNumber(value)}</strong><em>{note}</em></div><i /></article>;
}

function Resource({ label: title, value, mono = false, badge = false }) {
  return <div className="rfa-resource"><span>{title}</span><b className={`${mono ? "mono" : ""} ${badge ? "badge" : ""}`}>{value}</b></div>;
}

function AgentStat({ value, label: statLabel, featured = false }) {
  return <div className={`rfa-agent-stat ${featured ? "featured" : ""}`}><strong>{typeof value === "number" ? formatNumber(value) : value}</strong><span>{statLabel}</span></div>;
}

function AgentsSkeleton() {
  return <section className="rfa-agent-grid" aria-busy="true" aria-label="Loading Voice Agents">{Array.from({ length: 3 }).map((_, index) => <article className="rfa-agent-card skeleton" key={index}><div className="rfa-sk-head"><i /><span><i /><i /><i /></span></div><i className="rfa-sk-status" /><div className="rfa-sk-res"><i /><i /><i /></div><div className="rfa-sk-stats"><i /><i /><i /></div><div className="rfa-sk-actions"><i /><i /></div></article>)}</section>;
}

function VoicePicker({ voices = [], value = "", onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(!value);
  const [playingId, setPlayingId] = useState("");
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  useEffect(() => {
    if (!value) setOpen(true);
  }, [value]);

  const selected = findVoice(voices, value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return voices;

    return voices.filter((voice) =>
      [
        getVoiceName(voice),
        voice?.language,
        voice?.accent,
        voice?.age,
        voice?.gender,
        voice?.useCase,
        voice?.niche,
        voice?.category,
        voice?.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [voices, query]);

  function stopPreview() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingId("");
  }

  function togglePreview(event, voice) {
    event.preventDefault();
    event.stopPropagation();

    const id = getVoiceId(voice);
    const previewUrl = getVoicePreviewUrl(voice);
    if (!id || !previewUrl) return;

    if (playingId === id) {
      stopPreview();
      return;
    }

    stopPreview();
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    setPlayingId(id);

    audio.onended = stopPreview;
    audio.onerror = stopPreview;
    audio.play().catch(stopPreview);
  }

  if (!voices.length) {
    return (
      <div className="rf-v6-voice-empty">
        <b>Voice catalog unavailable</b>
        <span>Refresh after the voice API is healthy. ReachFly will not create a fake provider voice ID in the browser.</span>
      </div>
    );
  }

  return (
    <div className="rf-v6-voice-picker">
      {selected ? (
        <div className="rf-v6-selected-voice">
          <VoiceArtwork voice={selected} className="large" />
          <div className="rf-v6-selected-voice-copy">
            <span>Selected voice</span>
            <strong>{getVoiceName(selected)}</strong>
            <small>{getVoiceMeta(selected)}</small>
          </div>
          <div className="rf-v6-selected-voice-actions">
            {getVoicePreviewUrl(selected) ? (
              <button type="button" className="rf-v6-voice-preview" onClick={(event) => togglePreview(event, selected)}>
                {playingId === getVoiceId(selected) ? "■ Stop" : "▶ Preview"}
              </button>
            ) : null}
            <button type="button" className="rf-v6-voice-change" onClick={() => setOpen((current) => !current)}>
              {open ? "Done" : "Change voice"}
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="rf-v6-voice-browser">
          <div className="rf-v6-voice-browser-head">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search voice, language, accent or use case…"
              aria-label="Search voices"
            />
            <span>{filtered.length} {filtered.length === 1 ? "voice" : "voices"}</span>
          </div>

          <div className="rf-v6-voice-grid">
            {filtered.map((voice) => {
              const id = getVoiceId(voice);
              const isSelected = id === value;
              return (
                <article className={`rf-v6-voice-card ${isSelected ? "selected" : ""}`} key={id}>
                  <button
                    type="button"
                    className="rf-v6-voice-select"
                    onClick={() => {
                      onChange?.(id);
                      setOpen(false);
                      setQuery("");
                      stopPreview();
                    }}
                  >
                    <VoiceArtwork voice={voice} />
                    <span className="rf-v6-voice-card-copy">
                      <strong>{getVoiceName(voice)}</strong>
                      <small>{getVoiceMeta(voice)}</small>
                    </span>
                    {isSelected ? <em>Selected</em> : null}
                  </button>

                  {getVoicePreviewUrl(voice) ? (
                    <button
                      type="button"
                      className="rf-v6-voice-card-play"
                      onClick={(event) => togglePreview(event, voice)}
                      aria-label={`Preview ${getVoiceName(voice)}`}
                    >
                      {playingId === id ? "■" : "▶"}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>

          {!filtered.length ? (
            <div className="rf-v6-voice-empty compact">
              <b>No voices found.</b>
              <button type="button" onClick={() => setQuery("")}>Clear search</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function VoiceArtwork({ voice, className = "" }) {
  const seed = getVoiceId(voice) || getVoiceName(voice) || "ReachFly Voice";

  const generatedArt = useMemo(
    () => new Avatar(VOICE_ART_STYLE, { seed, size: 160 }).toDataUri(),
    [seed]
  );

  const providerImage = String(
    voice?.imageUrl || voice?.image || voice?.avatarUrl || ""
  ).trim();

  const [src, setSrc] = useState(providerImage || generatedArt);

  useEffect(() => {
    setSrc(providerImage || generatedArt);
  }, [providerImage, generatedArt]);

  return (
    <span className={`rf-v6-voice-art ${className}`.trim()} aria-hidden="true">
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => {
          if (src !== generatedArt) setSrc(generatedArt);
        }}
      />
      <i />
    </span>
  );
}

function getVoiceId(voice) {
  return String(voice?.id || voice?.voiceId || voice?.voice_id || "").trim();
}

function getVoiceName(voice) {
  return voice?.name || voice?.voiceName || voice?.label || getVoiceId(voice) || "Managed voice";
}

function getVoicePreviewUrl(voice) {
  return String(voice?.previewUrl || voice?.preview_url || voice?.sampleUrl || "").trim();
}

function getVoiceMeta(voice) {
  return [
    voice?.language,
    voice?.accent,
    voice?.age,
    voice?.useCase || voice?.niche || voice?.category,
  ].filter(Boolean).join(" · ") || voice?.description || "ReachFly managed voice";
}

function findVoice(voices, id) {
  const target = String(id || "").trim();
  if (!target) return null;
  return voices.find((voice) => getVoiceId(voice) === target) || null;
}

function Field({ label, children }) { return <label className="rf-v6-field"><span>{label}</span>{children}</label>; }
function Toggle({ checked, onChange, title, text }) { return <label className="rf-v6-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><b>{title}</b><small>{text}</small></span></label>; }
function languageSummary(agent) {
  const primary = agent?.primaryLanguage || "en";
  const supported = Array.isArray(agent?.supportedLanguages) && agent.supportedLanguages.length ? agent.supportedLanguages : [primary];
  const primaryName = LANGUAGES.find(([code]) => code === primary)?.[1] || primary.toUpperCase();
  return `${primaryName}${supported.length > 1 ? ` +${supported.length - 1}` : ""}${agent?.autoDetectLanguage !== false && supported.length > 1 ? " · auto-switch" : ""}`;
}
function label(value) { return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function getAgentReadiness(agent) {
  const missing = [];
  if (!agent?.fromNumber) missing.push("Business Number");
  if (!agent?.voice) missing.push("Voice");
  if (!agent?.primaryLanguage) missing.push("Primary language");
  if (agent?.complianceConfirmed === false) missing.push("Calling policy");
  return { ready: missing.length === 0, missing };
}

function purposeLabel(value) {
  return PURPOSES.find(([key]) => key === value)?.[1] || label(value || "sales");
}

function callingModeLabel(value) {
  const normalized = normalizeToken(value || "outbound");
  return normalized === "both" ? "Inbound + outbound" : label(normalized);
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isLiveCallStatus(value) {
  return ["initiated", "dialing", "ringing", "connected", "in_progress", "active"].includes(normalizeToken(value));
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat().format(Math.round(number)) : "0";
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "0.0";
}

function formatRelativeTime(value) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const delta = Math.max(0, Date.now() - timestamp);
  if (delta < 10000) return "just now";
  if (delta < 60000) return `${Math.max(1, Math.floor(delta / 1000))}s ago`;
  if (delta < 3600000) return `${Math.max(1, Math.floor(delta / 60000))}m ago`;
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function notify(type, title, text) {
  if (typeof window === "undefined") return;
  const bridge = window.reachflyToast;
  if (bridge && typeof bridge[type] === "function") {
    bridge[type](title, text);
    return;
  }
  window.dispatchEvent(new CustomEvent("reachfly:toast", { detail: { type, title, message: text } }));
}

function AIWorkforceStyles() {
  return <style>{`
    .rf-agents-v7{--p:#4648d4;--pd:#3537bb;--ps:#e8e9ff;--v:#6b38d4;--vs:#f0eaff;--t:#191c1d;--ts:#464554;--m:#767586;--line:#e3e5e7;--soft:#f3f4f5;--high:#e7e8e9;--green:#087a51;--greens:#dcfce7;--warn:#8a6100;--warns:#fff4d6;--red:#ba1a1a;--reds:#ffedeb;--ease:cubic-bezier(.2,.8,.2,1);width:100%;min-height:100%;padding:32px;color:var(--t);font-family:Inter,system-ui,sans-serif;animation:rfaIn .25s var(--ease)}
    .rf-agents-v7 *{box-sizing:border-box}.rf-agents-v7 a{color:inherit}.rf-agents-v7 .spin{animation:rfaSpin .8s linear infinite}
    @keyframes rfaIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes rfaCard{from{opacity:0;transform:translateY(9px) scale(.993)}to{opacity:1;transform:none}}@keyframes rfaSpin{to{transform:rotate(360deg)}}@keyframes rfaPulse{50%{box-shadow:0 0 0 7px rgba(8,122,81,.04)}}@keyframes rfaShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
    .rfa-eyebrow{display:block;margin:0 0 4px;color:var(--p);font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
    .rfa-hero{position:relative;min-height:146px;display:flex;align-items:center;justify-content:space-between;gap:24px;overflow:hidden;padding:30px 34px;margin-bottom:28px;color:#fff;background:radial-gradient(circle at 79% 22%,rgba(132,85,239,.44),transparent 27%),linear-gradient(112deg,#4648d4,#5048df);border-radius:16px;box-shadow:0 12px 28px rgba(70,72,212,.16)}
    .rfa-hero:after{content:"";position:absolute;right:-85px;bottom:-155px;width:250px;height:250px;border:1px solid rgba(255,255,255,.07);border-radius:50%}.rfa-hero>div,.rfa-hero>button{position:relative;z-index:1}.rfa-hero .rfa-eyebrow{color:#d8d8ff}.rfa-hero h1{margin:0;font:600 32px/40px Geist,Inter,sans-serif;letter-spacing:-.02em}.rfa-hero p{max-width:680px;margin:5px 0 0;color:#d6d6f7;font-size:14px;line-height:20px}
    .rfa-create-agent{min-height:52px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 22px;color:var(--p);background:#fff;border:0;border-radius:10px;box-shadow:0 9px 24px rgba(26,24,102,.16);cursor:pointer;font-size:12px;font-weight:650;transition:.15s var(--ease)}.rfa-create-agent:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(26,24,102,.2)}
    .rfa-message{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;margin:-14px 0 14px;border:1px solid;border-radius:9px}.rfa-message>svg{margin-top:1px}.rfa-message>div{min-width:0;flex:1;display:grid;gap:1px}.rfa-message strong{font-size:10px}.rfa-message span{font-size:9px}.rfa-message button{align-self:center;padding:5px 8px;color:inherit;background:rgba(255,255,255,.7);border:0;border-radius:6px;cursor:pointer;font-size:8px;font-weight:700}.rfa-message.error{color:#7c1616;background:var(--reds);border-color:#ffd0cc}.rfa-message.success{color:#075b3d;background:var(--greens);border-color:#b8efd6}
    .rfa-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px;margin-bottom:26px}.rfa-metric{position:relative;min-height:132px;display:flex;align-items:center;gap:14px;overflow:hidden;padding:22px 24px;background:#fff;border:1px solid #eff0f2;border-radius:16px;box-shadow:0 1px 3px rgba(25,28,29,.04);animation:rfaCard .28s var(--ease) both}.rfa-metric>span{position:relative;z-index:1;width:48px;height:48px;display:grid;place-items:center;flex:0 0 48px;color:#fff;background:var(--p);border-radius:12px}.rfa-metric.violet>span{background:#8a49ea}.rfa-metric.neutral>span{color:#53607a;background:#dce5ff}.rfa-metric>div{position:relative;z-index:1;min-width:0;display:grid}.rfa-metric small{color:var(--ts);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.rfa-metric strong{font:600 28px/34px Geist,Inter,sans-serif}.rfa-metric em{max-width:165px;overflow:hidden;color:var(--p);text-overflow:ellipsis;white-space:nowrap;font-size:8px;font-style:normal}.rfa-metric.neutral em{color:var(--m)}.rfa-metric>i{position:absolute;right:-46px;bottom:-58px;width:125px;height:125px;background:var(--soft);border-radius:50%;opacity:.72}
    .rfa-toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding-bottom:14px}.rfa-toolbar h2{margin:0;font:600 18px/24px Geist,Inter,sans-serif}.rfa-toolbar h2 i{display:inline-grid;place-items:center;min-width:25px;height:20px;margin-left:5px;padding:0 6px;color:var(--ts);background:var(--high);border-radius:999px;font:700 8px/1 Inter,sans-serif;font-style:normal}.rfa-toolbar-actions{display:flex;gap:7px}.rfa-search{width:min(280px,30vw);height:38px;display:flex;align-items:center;gap:7px;padding:0 10px;color:var(--m);background:#fff;border:1px solid var(--line);border-radius:8px}.rfa-search:focus-within{border-color:rgba(70,72,212,.45);box-shadow:0 0 0 3px rgba(70,72,212,.07)}.rfa-search input{min-width:0;flex:1;height:36px;padding:0;background:transparent;border:0;outline:0;font-size:9px}.rfa-search button{width:23px;height:23px;display:grid;place-items:center;padding:0;color:var(--m);background:transparent;border:0;border-radius:6px;cursor:pointer}.rfa-filter{position:relative;height:38px;display:flex;align-items:center;background:#fff;border:1px solid var(--line);border-radius:8px}.rfa-filter select{height:36px;min-width:125px;padding:0 29px 0 10px;color:var(--ts);background:transparent;border:0;outline:0;appearance:none;font-size:9px}.rfa-filter svg{position:absolute;right:9px;pointer-events:none}.rfa-refresh{width:38px;height:38px;display:grid;place-items:center;padding:0;color:var(--ts);background:#fff;border:1px solid var(--line);border-radius:8px;cursor:pointer}.rfa-refresh:hover{color:var(--p);background:var(--ps)}
    .rfa-agent-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.rfa-agent-card{min-width:0;min-height:410px;display:flex;flex-direction:column;padding:24px;background:#fff;border:1px solid #eceef0;border-radius:16px;box-shadow:0 2px 5px rgba(25,28,29,.045),0 8px 20px rgba(25,28,29,.025);animation:rfaCard .28s var(--ease) both;animation-delay:calc(var(--rfa-index) * 45ms);transition:.18s var(--ease)}.rfa-agent-card:hover:not(.skeleton){transform:translateY(-2px);border-color:#dddff0;box-shadow:0 6px 16px rgba(25,28,29,.06),0 18px 34px rgba(70,72,212,.05)}
    .rfa-agent-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}.rfa-agent-person{min-width:0;display:flex;align-items:center;gap:12px}.rfa-agent-person>div{min-width:0;display:grid}.rfa-agent-person h3{max-width:185px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 17px/22px Geist,Inter,sans-serif}.rfa-agent-person p{max-width:185px;margin:1px 0 0;overflow:hidden;color:var(--ts);text-overflow:ellipsis;white-space:nowrap;font-size:9px}.rfa-agent-person>div>span{max-width:185px;margin-top:2px;overflow:hidden;color:var(--p);text-overflow:ellipsis;white-space:nowrap;font-size:7px}.rfa-agent-settings{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;padding:0;color:var(--m);background:transparent;border:0;border-radius:7px;cursor:pointer}.rfa-agent-settings:hover{color:var(--p);background:var(--ps)}
    .rfa-voice-art{position:relative;width:46px;height:46px;display:block;flex:0 0 46px;overflow:visible;background:var(--ps);border-radius:50%}.rfa-voice-art img{width:100%;height:100%;display:block;object-fit:cover;border-radius:inherit}.rfa-voice-art>i{position:absolute;right:-1px;bottom:0;width:14px;height:14px;background:#10b981;border:2px solid #fff;border-radius:50%;animation:rfaPulse 2s ease-in-out infinite}.rfa-voice-art.rfa-agent-art{width:54px;height:54px;flex-basis:54px}.rfa-voice-art.large{width:54px;height:54px;flex-basis:54px}
    .rfa-status-line{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}.rfa-status{min-height:23px;display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border-radius:999px;font-size:7px;font-weight:700}.rfa-status i{width:6px;height:6px;border-radius:50%}.rfa-status.active{color:var(--green);background:var(--greens)}.rfa-status.active i{background:#10b981}.rfa-status.setup{color:var(--warn);background:var(--warns)}.rfa-status.setup i{background:#d09a24}.rfa-status.paused{color:#606774;background:#eef1f5}.rfa-status.paused i{background:#8d949f}.rfa-status-line small{color:var(--warn);font-size:7px;font-weight:700}
    .rfa-resources{display:grid;gap:6px;margin-bottom:16px}.rfa-resource{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 9px;background:#f8f9fa;border-radius:8px}.rfa-resource span{color:var(--ts);font-size:8px}.rfa-resource b{max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;font-weight:550}.rfa-resource b.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.rfa-resource b.badge{padding:4px 6px;color:var(--p);background:var(--ps);border-radius:5px;font-size:7px;font-weight:750;text-transform:uppercase}
    .rfa-agent-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-bottom:9px}.rfa-agent-stat{min-height:82px;display:grid;place-items:center;align-content:center;gap:3px;padding:10px 5px;background:var(--soft);border-radius:11px;text-align:center;transition:.18s var(--ease)}.rfa-agent-card:hover .rfa-agent-stat.featured{color:#fff;background:var(--p);transform:translateY(-1px)}.rfa-agent-stat strong{font:600 22px/27px Geist,Inter,sans-serif}.rfa-agent-stat span{opacity:.72;font-size:7px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}.rfa-secondary-stats{display:flex;flex-wrap:wrap;gap:5px 10px;margin-bottom:10px;color:var(--m)}.rfa-secondary-stats span{display:flex;align-items:center;gap:4px;font-size:7px}.rfa-readiness-warning{display:flex;gap:7px;padding:8px 9px;margin-bottom:10px;color:#785500;background:var(--warns);border-radius:8px}.rfa-readiness-warning>div{min-width:0;display:grid}.rfa-readiness-warning strong{font-size:7px}.rfa-readiness-warning span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:6px}
    .rfa-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:auto}.rfa-card-actions a{min-height:37px;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 9px;border:1px solid transparent;border-radius:8px;text-decoration:none;font-size:8px;font-weight:700;transition:.14s var(--ease)}.rfa-card-actions a:hover{transform:translateY(-1px)}.rfa-card-actions a.secondary{background:var(--high)}.rfa-card-actions a.primary{color:#fff;background:var(--p)}.rfa-card-actions a.primary.outline{color:var(--p);background:#fff;border-color:rgba(70,72,212,.25)}
    .rfa-empty-first,.rfa-empty-filter{min-height:410px;display:grid;place-items:center;align-content:center;gap:6px;padding:32px 20px;color:var(--m);background:#fff;border:2px dashed #dfe0e7;border-radius:16px;text-align:center}.rfa-empty-first>span:first-child,.rfa-empty-filter>svg{width:64px;height:64px;display:grid;place-items:center;padding:16px;color:var(--p);background:var(--ps);border-radius:50%}.rfa-empty-first h2,.rfa-empty-filter h2{margin:0;color:var(--t);font:600 17px/23px Geist,Inter,sans-serif}.rfa-empty-first p,.rfa-empty-filter p{max-width:480px;margin:0;font-size:9px;line-height:14px}.rfa-empty-first button,.rfa-empty-filter button{min-height:38px;display:flex;align-items:center;gap:6px;padding:7px 11px;margin-top:6px;color:#fff;background:var(--p);border:0;border-radius:8px;cursor:pointer;font-size:8px;font-weight:700}.rfa-empty-filter button{color:var(--p);background:var(--ps)}
    .rfa-readiness-strip{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;margin-top:20px;background:#fff;border:1px solid var(--line);border-radius:12px}.rfa-readiness-strip>div:first-child{min-width:0;display:flex;gap:9px}.rfa-readiness-strip>div:first-child>span{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;color:var(--v);background:var(--vs);border-radius:8px}.rfa-readiness-strip strong{display:block;font-size:9px}.rfa-readiness-strip p{max-width:620px;margin:2px 0 0;color:var(--m);font-size:7px;line-height:12px}.rfa-readiness-links{display:flex;gap:7px;flex:0 0 auto}.rfa-readiness-links>*{min-height:31px;display:flex;align-items:center;gap:5px;padding:6px 8px;border-radius:7px;font-size:7px;font-weight:650}.rfa-readiness-links>span{color:var(--m);background:var(--soft)}.rfa-readiness-links>a{color:var(--p);background:var(--ps);text-decoration:none}
    .rfa-agent-card.skeleton i{display:block;background:linear-gradient(90deg,#e9ebed 25%,#f8f9fa 45%,#e9ebed 65%);background-size:220% 100%;border-radius:999px;animation:rfaShimmer 1.25s linear infinite}.rfa-sk-head{display:grid;grid-template-columns:54px 1fr;gap:10px;align-items:center;margin-bottom:12px}.rfa-sk-head>i{width:54px;height:54px;border-radius:50%!important}.rfa-sk-head>span{display:grid;gap:6px}.rfa-sk-head>span i:nth-child(1){width:55%;height:14px}.rfa-sk-head>span i:nth-child(2){width:72%;height:9px}.rfa-sk-head>span i:nth-child(3){width:48%;height:8px}.rfa-sk-status{width:72px;height:22px;margin-bottom:12px}.rfa-sk-res{display:grid;gap:6px}.rfa-sk-res i{height:38px;border-radius:8px!important}.rfa-sk-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:16px}.rfa-sk-stats i{height:82px;border-radius:11px!important}.rfa-sk-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:auto}.rfa-sk-actions i{height:37px;border-radius:8px!important}
    .rf-agents-v7 .rf-v6-modal-backdrop{position:fixed;z-index:220;inset:0;display:grid;place-items:center;padding:24px;background:rgba(25,28,29,.42);backdrop-filter:blur(4px)}.rf-agents-v7 .rf-v6-agent-editor{width:min(980px,100%);max-height:calc(100vh - 48px);overflow:auto;padding:20px;background:#fff;border-radius:16px;box-shadow:0 28px 80px rgba(25,28,29,.23)}.rf-agents-v7 .rf-v6-editor-head{display:flex;justify-content:space-between;gap:16px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--line)}.rf-agents-v7 .rf-v6-editor-head span,.rf-agents-v7 .rf-v6-section-head span,.rf-agents-v7 .rf-v6-voice-field-label{color:var(--p);font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.rf-agents-v7 .rf-v6-editor-head h2,.rf-agents-v7 .rf-v6-section-head h3{margin:1px 0 0;font:600 18px/24px Geist,Inter,sans-serif}.rf-agents-v7 .rf-v6-editor-head button{width:32px;height:32px;padding:0;color:var(--m);background:var(--soft);border:0;border-radius:8px;cursor:pointer;font-size:18px}.rf-agents-v7 .rf-v6-purpose-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.rf-agents-v7 .rf-v6-purpose-grid button{min-height:88px;padding:10px;text-align:left;background:#fff;border:1px solid var(--line);border-radius:9px;cursor:pointer}.rf-agents-v7 .rf-v6-purpose-grid button.active{background:#f3f3ff;border-color:rgba(70,72,212,.4);box-shadow:0 0 0 3px rgba(70,72,212,.05)}.rf-agents-v7 .rf-v6-purpose-grid b{display:block;font-size:8px}.rf-agents-v7 .rf-v6-purpose-grid small{display:block;margin-top:3px;color:var(--m);font-size:7px;line-height:11px}.rf-agents-v7 .rf-v6-form-grid{display:grid;gap:10px}.rf-agents-v7 .rf-v6-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.rf-agents-v7 .rf-v6-field{display:grid;gap:5px;margin-bottom:10px}.rf-agents-v7 .rf-v6-field>span{color:var(--ts);font-size:7px;font-weight:700;text-transform:uppercase}.rf-agents-v7 .rf-v6-field input,.rf-agents-v7 .rf-v6-field select,.rf-agents-v7 .rf-v6-field textarea{width:100%;min-height:39px;padding:8px 10px;color:var(--t);background:#fff;border:1px solid var(--line);border-radius:8px;outline:0;font-size:9px}.rf-agents-v7 .rf-v6-field input:focus,.rf-agents-v7 .rf-v6-field select:focus,.rf-agents-v7 .rf-v6-field textarea:focus{border-color:rgba(70,72,212,.48);box-shadow:0 0 0 3px rgba(70,72,212,.07)}.rf-agents-v7 .rf-v6-language-editor{padding:14px;margin:4px 0 14px;background:#fbfbfc;border:1px solid var(--line);border-radius:11px}.rf-agents-v7 .rf-v6-section-head p{margin:2px 0 10px;color:var(--m);font-size:8px}.rf-agents-v7 .rf-v6-language-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px}.rf-agents-v7 .rf-v6-language-chips label{padding:5px 8px;color:var(--ts);background:var(--soft);border-radius:999px;font-size:7px}.rf-agents-v7 .rf-v6-language-chips label.active{color:var(--p);background:var(--ps);font-weight:700}.rf-agents-v7 .rf-v6-language-chips input{margin-right:4px}.rf-agents-v7 .rf-v6-language-overrides{display:grid;gap:7px}.rf-agents-v7 .rf-v6-language-row{display:grid;grid-template-columns:100px 1fr 1.4fr;gap:8px;align-items:end;padding:9px;background:#fff;border:1px solid var(--line);border-radius:8px}.rf-agents-v7 .rf-v6-language-row>strong{align-self:center;font-size:8px}.rf-agents-v7 .rf-v6-permission-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 12px}.rf-agents-v7 .rf-v6-toggle{display:flex;gap:8px;padding:10px;background:var(--soft);border-radius:8px}.rf-agents-v7 .rf-v6-toggle b{display:block;font-size:8px}.rf-agents-v7 .rf-v6-toggle small{display:block;margin-top:2px;color:var(--m);font-size:7px;line-height:11px}.rf-agents-v7 .rf-v6-compliance{display:flex;gap:8px;padding:11px;background:var(--warns);border-radius:8px}.rf-agents-v7 .rf-v6-compliance b{display:block;font-size:8px}.rf-agents-v7 .rf-v6-compliance small{display:block;margin-top:2px;color:#705400;font-size:7px;line-height:11px}.rf-agents-v7 .rf-v6-editor-actions{display:flex;justify-content:flex-end;gap:7px;padding-top:12px;border-top:1px solid var(--line)}.rf-agents-v7 .rf-v6-btn{min-height:37px;padding:7px 11px;border:1px solid var(--line);border-radius:8px;cursor:pointer;font-size:8px;font-weight:700}.rf-agents-v7 .rf-v6-btn.primary{color:#fff;background:var(--p);border-color:var(--p)}.rf-agents-v7 .rf-v6-btn.secondary{background:#fff}
    .rf-agents-v7 .rf-v6-voice-picker{display:grid;gap:8px}.rf-agents-v7 .rf-v6-selected-voice{display:flex;align-items:center;gap:10px;padding:9px;background:#fbfbfc;border:1px solid var(--line);border-radius:9px}.rf-agents-v7 .rf-v6-selected-voice-copy{min-width:0;flex:1;display:grid}.rf-agents-v7 .rf-v6-selected-voice-copy span{color:var(--p);font-size:6px;font-weight:800;text-transform:uppercase}.rf-agents-v7 .rf-v6-selected-voice-copy strong{font-size:9px}.rf-agents-v7 .rf-v6-selected-voice-copy small{color:var(--m);font-size:7px}.rf-agents-v7 .rf-v6-selected-voice-actions{display:flex;gap:5px}.rf-agents-v7 .rf-v6-selected-voice-actions button,.rf-agents-v7 .rf-v6-voice-card-play{min-height:29px;padding:5px 7px;color:var(--p);background:var(--ps);border:0;border-radius:7px;cursor:pointer;font-size:7px;font-weight:700}.rf-agents-v7 .rf-v6-voice-browser{overflow:hidden;border:1px solid var(--line);border-radius:9px}.rf-agents-v7 .rf-v6-voice-browser-head{display:flex;gap:8px;padding:8px;background:#fbfbfc;border-bottom:1px solid var(--line)}.rf-agents-v7 .rf-v6-voice-browser-head input{min-width:0;flex:1;height:33px;padding:0 8px;border:1px solid var(--line);border-radius:7px;font-size:8px}.rf-agents-v7 .rf-v6-voice-browser-head span{align-self:center;color:var(--m);font-size:7px}.rf-agents-v7 .rf-v6-voice-grid{max-height:280px;display:grid;grid-template-columns:1fr 1fr;gap:6px;overflow:auto;padding:8px}.rf-agents-v7 .rf-v6-voice-card{position:relative;display:flex;align-items:center;border:1px solid var(--line);border-radius:8px}.rf-agents-v7 .rf-v6-voice-card.selected{background:#f3f3ff;border-color:rgba(70,72,212,.35)}.rf-agents-v7 .rf-v6-voice-select{min-width:0;flex:1;display:flex;align-items:center;gap:7px;padding:7px 34px 7px 7px;background:transparent;border:0;text-align:left}.rf-agents-v7 .rf-v6-voice-card-copy{min-width:0;display:grid}.rf-agents-v7 .rf-v6-voice-card-copy strong{font-size:8px}.rf-agents-v7 .rf-v6-voice-card-copy small{overflow:hidden;color:var(--m);text-overflow:ellipsis;white-space:nowrap;font-size:6px}.rf-agents-v7 .rf-v6-voice-card-play{position:absolute;right:6px;width:25px;height:25px;padding:0;border-radius:50%}.rf-agents-v7 .rf-v6-voice-empty{padding:10px;color:var(--m);background:var(--soft);border-radius:8px;font-size:7px}
    @media(max-width:1220px){.rf-agents-v7{padding:26px 24px}.rfa-metrics{gap:14px}.rfa-agent-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}}
    @media(max-width:900px){.rfa-metrics{grid-template-columns:repeat(2,1fr)}.rfa-toolbar{align-items:flex-start;flex-direction:column}.rfa-toolbar-actions{width:100%}.rfa-search{width:auto;flex:1}.rfa-readiness-strip{align-items:flex-start;flex-direction:column}.rfa-readiness-links{width:100%;flex-wrap:wrap}.rf-agents-v7 .rf-v6-purpose-grid{grid-template-columns:1fr 1fr}.rf-agents-v7 .rf-v6-language-row{grid-template-columns:1fr 1fr}.rf-agents-v7 .rf-v6-language-row .rf-v6-field:last-child{grid-column:1/-1}}
    @media(max-width:700px){.rf-agents-v7{padding:18px 14px 84px}.rfa-hero{align-items:flex-start;flex-direction:column;padding:24px}.rfa-hero h1{font-size:26px;line-height:33px}.rfa-hero p{font-size:11px;line-height:17px}.rfa-create-agent{width:100%}.rfa-metrics{grid-template-columns:1fr;gap:8px}.rfa-metric{min-height:90px;padding:15px}.rfa-agent-grid{grid-template-columns:1fr}.rf-agents-v7 .rf-v6-modal-backdrop{padding:0;place-items:stretch}.rf-agents-v7 .rf-v6-agent-editor{width:100%;height:100%;max-height:none;border-radius:0}.rf-agents-v7 .rf-v6-form-grid.two,.rf-agents-v7 .rf-v6-permission-grid{grid-template-columns:1fr}}
    @media(max-width:520px){.rf-agents-v7{padding:16px 11px 84px}.rfa-toolbar-actions{display:grid;grid-template-columns:1fr 38px}.rfa-search{grid-column:1/-1;width:100%}.rfa-filter select{width:100%}.rfa-card-actions{grid-template-columns:1fr}.rfa-agent-card{padding:18px}.rf-agents-v7 .rf-v6-purpose-grid{grid-template-columns:1fr}.rf-agents-v7 .rf-v6-voice-grid{grid-template-columns:1fr}.rf-agents-v7 .rf-v6-language-row{grid-template-columns:1fr}.rf-agents-v7 .rf-v6-language-row .rf-v6-field:last-child{grid-column:auto}}
    @media(prefers-reduced-motion:reduce){.rf-agents-v7,.rfa-metric,.rfa-agent-card,.rfa-voice-art>i,.rfa-agent-card.skeleton i,.rf-agents-v7 .spin{animation:none!important}.rf-agents-v7 *{transition-duration:.01ms!important}}
  `}</style>;
}

