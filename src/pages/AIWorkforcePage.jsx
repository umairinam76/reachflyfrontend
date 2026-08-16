import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";

const PURPOSES = [
  ["sales", "Outbound sales", "Qualify prospects, handle objections and book meetings."],
  ["reception", "Inbound receptionist", "Answer inbound calls, capture intent and route the next step."],
  ["appointment", "Appointment setter", "Focus on qualification, calendar availability and confirmed bookings."],
  ["custom", "Custom agent", "Create a specialized playbook for a specific campaign or workflow."],
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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
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
    } catch (requestError) {
      setError(requestError?.message || "AI workforce could not be loaded.");
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
      setMessage(editingId ? "AI agent updated." : "AI agent created and synchronized.");
      setShowEditor(false);
      await load();
    } catch (requestError) {
      setError(requestError?.message || "AI agent could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="rf-v6-page rf-v6-workforce-page">
      <header className="rf-v6-hero">
        <div>
          <span className="rf-v6-kicker">AI workforce</span>
          <h1>Build a team of AI agents that works in parallel.</h1>
          <p>Each agent can have its own role, voice, context, phone identity, email connection, calendar and concurrency while remaining isolated to this workspace.</p>
          <div className="rf-v6-hero-actions"><button className="rf-v6-btn primary" type="button" onClick={openCreate}>+ Create AI agent</button><a className="rf-v6-btn ghost" href="/app/builder">Create campaign</a></div>
        </div>
        <div className="rf-v6-workforce-orbit">
          <div><span>Agents</span><strong>{agents.length}</strong></div>
          <div><span>Live calls</span><strong>{dashboard?.summary?.activeCalls || 0}</strong></div>
          <div><span>Queued</span><strong>{dashboard?.summary?.queuedLeads || 0}</strong></div>
        </div>
      </header>

      {error ? <div className="rf-v6-alert error">{error}</div> : null}
      {message ? <div className="rf-v6-alert success">{message}</div> : null}

      <section className="rf-v6-panel">
        <div className="rf-v6-section-head"><div><span>Agents</span><h2>Your AI workforce</h2><p>Create focused agents instead of putting every workflow into one giant prompt.</p></div><button className="rf-v6-btn secondary" onClick={openCreate}>New agent</button></div>
        {!agents.length ? (
          <div className="rf-v6-empty"><strong>No managed AI agent yet.</strong><span>Create your first agent, assign a number and test it before launching a campaign.</span><button className="rf-v6-btn primary" onClick={openCreate}>Create first agent</button></div>
        ) : (
          <div className="rf-v6-agent-grid">
            {agents.map((agent) => {
              const agentCalls = calls.filter((item) => item.agentId === agent.id);
              const live = agentCalls.filter((item) => ["initiated", "dialing", "ringing", "connected", "in_progress"].includes(String(item.status || "").toLowerCase())).length;
              const queued = queue.filter((item) => item.agentId === agent.id && item.status === "queued").length;
              const booked = meetings.filter((item) => item.agentId === agent.id).length;
              return (
                <article className="rf-v6-agent-card" key={agent.id}>
                  <div className="rf-v6-agent-top"><span className={`rf-v6-agent-avatar purpose-${agent.purpose || "sales"}`}>{initials(agent.name)}</span><div><strong>{agent.name}</strong><small>{label(agent.purpose || "sales")} · {label(agent.callingMode || "outbound")}</small></div><span className={`rf-v6-status ${agent.enabled !== false ? "good" : "muted"}`}>● {agent.enabled !== false ? "Active" : "Paused"}</span></div>
                  <div className="rf-v6-agent-resources"><Resource label="Phone" value={agent.fromNumber || "Not assigned"} /><Resource label="Email" value={emailConnections.find((item) => item.id === agent.emailConnectionId)?.accountEmail || "Not linked"} /><Resource label="Calendar" value={calendarConnections.find((item) => item.id === agent.calendarConnectionId)?.accountEmail || "Not linked"} /></div>
                  <div className="rf-v6-agent-stats"><div><strong>{live}</strong><span>live</span></div><div><strong>{queued}</strong><span>queued</span></div><div><strong>{booked}</strong><span>meetings</span></div><div><strong>{agent.concurrency || 1}</strong><span>parallel</span></div></div>
                  <div className="rf-v6-row-actions"><button onClick={() => editAgent(agent)}>Quick manage</button><a href={`/app/voice-agent?tab=setup&agentId=${encodeURIComponent(agent.id)}`}>Full setup</a></div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showEditor ? (
        <div className="rf-v6-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowEditor(false); }}>
          <form className="rf-v6-agent-editor" onSubmit={save}>
            <div className="rf-v6-editor-head"><div><span>{editingId ? "Manage agent" : "Create agent"}</span><h2>{editingId ? "Update AI agent" : "Create a focused AI agent"}</h2></div><button type="button" onClick={() => setShowEditor(false)} disabled={saving}>×</button></div>

            <div className="rf-v6-purpose-grid">
              {PURPOSES.map(([value, title, text]) => <button type="button" className={form.purpose === value ? "active" : ""} key={value} onClick={() => setForm((current) => ({ ...current, purpose: value }))}><b>{title}</b><small>{text}</small></button>)}
            </div>

            <div className="rf-v6-form-grid two">
              <Field label="Agent name"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Sara — US Sales" /></Field>
              <Field label="Voice"><select value={form.voice} onChange={(event) => setForm((current) => ({ ...current, voice: event.target.value }))}><option value="">Managed voice</option>{voices.map((voice) => <option value={voice.id || voice.voiceId} key={voice.id || voice.voiceId}>{voice.name || voice.voiceName || voice.id}</option>)}</select></Field>
              <Field label="Calling mode"><select value={form.callingMode} onChange={(event) => setForm((current) => ({ ...current, callingMode: event.target.value }))}><option value="outbound">Outbound</option><option value="inbound">Inbound</option><option value="both">Inbound + outbound</option></select></Field>
              <Field label="Business number"><select value={form.fromNumber} onChange={(event) => setForm((current) => ({ ...current, fromNumber: event.target.value }))}><option value="">Choose number</option>{phoneNumbers.map((item) => <option key={item.phoneNumber} value={item.phoneNumber}>{item.phoneNumber}</option>)}</select></Field>
              <Field label="Email account"><select value={form.emailConnectionId} onChange={(event) => setForm((current) => ({ ...current, emailConnectionId: event.target.value }))}><option value="">No email</option>{emailConnections.map((item) => <option key={item.id} value={item.id}>{item.accountEmail}</option>)}</select></Field>
              <Field label="Booking calendar"><select value={form.calendarConnectionId} onChange={(event) => setForm((current) => ({ ...current, calendarConnectionId: event.target.value }))}><option value="">No calendar</option>{calendarConnections.map((item) => <option key={item.id} value={item.id}>{item.accountEmail}</option>)}</select></Field>
              <Field label="Parallel calls"><input type="number" min="1" max="20" value={form.concurrency} onChange={(event) => setForm((current) => ({ ...current, concurrency: event.target.value }))} /></Field>
            </div>

            <Field label="Agent context"><textarea rows="7" value={form.agentContext} onChange={(event) => setForm((current) => ({ ...current, agentContext: event.target.value }))} placeholder="Persistent context for this agent: offer, positioning, guardrails, what it should know across campaigns…" /></Field>

            <div className="rf-v6-permission-grid">
              <Toggle checked={form.sendEmail} onChange={(checked) => setForm((current) => ({ ...current, sendEmail: checked }))} title="Send email" text="Allow the agent to send requested details and approved follow-ups using its assigned mailbox." />
              <Toggle checked={form.bookMeeting} onChange={(checked) => setForm((current) => ({ ...current, bookMeeting: checked }))} title="Book meetings" text="Allow the agent to check availability and create confirmed events on its assigned calendar." />
            </div>

            <label className="rf-v6-compliance"><input type="checkbox" checked={form.complianceConfirmed} onChange={(event) => setForm((current) => ({ ...current, complianceConfirmed: event.target.checked }))} /><span><b>Approve calling, suppression and disclosure policy</b><small>I confirm this agent will use permitted calling, respect suppression requests and use required automated-caller/recording disclosures.</small></span></label>

            <div className="rf-v6-editor-actions"><button className="rf-v6-btn secondary" type="button" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</button><button className="rf-v6-btn primary" disabled={saving} type="submit">{saving ? "Synchronizing…" : editingId ? "Save agent" : "Create agent"}</button></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function Field({ label, children }) { return <label className="rf-v6-field"><span>{label}</span>{children}</label>; }
function Toggle({ checked, onChange, title, text }) { return <label className="rf-v6-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><b>{title}</b><small>{text}</small></span></label>; }
function Resource({ label: title, value }) { return <div><span>{title}</span><b>{value}</b></div>; }
function label(value) { return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function initials(value) { return String(value || "AI").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
