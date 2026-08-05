import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Mail, Phone, Search, Send, Users } from "../components/icons";
import { upgradeApi } from "../api/upgradeApi";

const STATUS_OPTIONS = [
  "new",
  "call_due",
  "attempted",
  "no_answer",
  "gatekeeper",
  "connected",
  "send_information",
  "callback",
  "qualified",
  "meeting_booked",
  "not_interested",
  "wrong_number",
  "do_not_call",
];

export default function MyLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("");
  const [error, setError] = useState("");

  const permissions = user?.permissions || [];
  const canAssign = permissions.includes("*") || permissions.includes("assign_leads");

  const load = async () => {
    try {
      setError("");
      const [leadItems, team] = await Promise.all([
        upgradeApi.myLeads({ status }),
        canAssign ? upgradeApi.team() : Promise.resolve({ members: [] }),
      ]);
      setLeads(leadItems || []);
      setMembers(team.members || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.business, lead.email, lead.phone, lead.campaignName, lead.status, ...(lead.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [leads, query]);

  const assign = async (lead, assignedTo) => {
    try {
      setError("");
      await upgradeApi.assignLead(lead.campaignId, lead.id, assignedTo);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page rf-my-leads-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Calling workspace</span>
          <h1>{canAssign ? "Team leads and assignments." : "Your assigned leads."}</h1>
          <p>Call, update the outcome, set a dated next action, and send the relevant follow-up without leaving ReachFly.</p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="toolbar rf-lead-toolbar">
        <div className="search">
          <Search />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads, campaigns, tags" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        <span>{filtered.length} leads</span>
      </div>

      {loading ? (
        <div className="skeleton-list"><i /><i /><i /></div>
      ) : (
        <div className="rf-lead-grid">
          {filtered.map((lead) => (
            <article key={`${lead.campaignId}-${lead.id}`} className="cardish rf-lead-card">
              <div className="rf-lead-card-head">
                <div>
                  <small>{lead.campaignName}</small>
                  <h3>{lead.name || lead.business || "Unnamed business"}</h3>
                </div>
                <span className={`badge ${statusBadge(lead.status)}`}>{label(lead.status)}</span>
              </div>

              <div className="rf-lead-contact">
                <span><Phone size={14} /> {lead.phone || "No phone"}</span>
                <span><Mail size={14} /> {lead.email || "No email"}</span>
              </div>

              <div className="rf-lead-tags">
                {(lead.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
                {lead.qualityScore ? <span>quality {lead.qualityScore}</span> : null}
                {lead.auditScore !== undefined ? <span>audit {lead.auditScore}/100</span> : null}
              </div>

              {lead.auditSummary ? (
                <div className="rf-lead-audit-summary">
                  <b>Audit summary</b>
                  <p>{lead.auditSummary}</p>
                  {(lead.auditFindings || []).slice(0, 2).map((finding) => (
                    <small key={finding.title}>• {finding.title}: {finding.evidence}</small>
                  ))}
                </div>
              ) : lead.auditStatus ? (
                <p className="text-xs text-muted">Audit: {lead.auditStatus}</p>
              ) : null}

              {canAssign ? (
                <label className="rf-inline-field">
                  <Users size={14} />
                  <select value={lead.assignedTo || ""} onChange={(event) => assign(lead, event.target.value)}>
                    <option value="">Assign caller</option>
                    {members.filter((member) => ["caller", "manager"].includes(member.workspaceRole)).map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="rf-lead-meta">
                <div><small>Next action</small><b>{formatDate(lead.nextActionAt) || "Not scheduled"}</b></div>
                <div><small>Attempts</small><b>{lead.callAttempts || 0}</b></div>
              </div>

              {lead.beforeCallNotes ? <p className="rf-lead-note"><b>Before call:</b> {lead.beforeCallNotes}</p> : null}
              {lead.afterCallNotes ? <p className="rf-lead-note"><b>Latest note:</b> {lead.afterCallNotes}</p> : null}

              <div className="rf-lead-actions">
                {lead.phone ? <a className="btn light small" href={`tel:${lead.phone}`}><Phone size={13} /> Call</a> : null}
                <button className="btn small" type="button" onClick={() => { setSelected(lead); setMode("call"); }}>Update call</button>
                <button className="btn primary small" type="button" disabled={!lead.email || lead.status === "do_not_call"} onClick={() => { setSelected(lead); setMode("email"); }}><Send size={13} /> Email</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && mode === "call" ? <CallModal lead={selected} onClose={() => { setSelected(null); setMode(""); }} onSaved={load} /> : null}
      {selected && mode === "email" ? <EmailModal lead={selected} onClose={() => { setSelected(null); setMode(""); }} onSent={load} /> : null}
    </div>
  );
}

function CallModal({ lead, onClose, onSaved }) {
  const [form, setForm] = useState({
    outcome: lead.status || "attempted",
    notes: lead.afterCallNotes || "",
    nextActionAt: toLocalInput(lead.nextActionAt),
    tags: (lead.tags || []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      await upgradeApi.logCall(lead.campaignId, lead.id, {
        outcome: form.outcome,
        notes: form.notes,
        nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : "",
        tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Update call — ${lead.name || lead.business}`} onClose={onClose}>
      <form className="rf-lead-modal-form" onSubmit={save}>
        {error ? <p className="error-banner">{error}</p> : null}
        <label className="field"><span>Outcome</span><select value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })}>{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
        <label className="field"><span>Call notes</span><textarea rows="5" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="What happened, what matters, and what was agreed?" /></label>
        <label className="field"><span>Next action</span><input type="datetime-local" value={form.nextActionAt} onChange={(event) => setForm({ ...form, nextActionAt: event.target.value })} /></label>
        <label className="field"><span>Tags</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="tier-a, audit-sent, decision-maker" /></label>
        <button className="btn primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save call outcome"}</button>
      </form>
    </Modal>
  );
}

function EmailModal({ lead, onClose, onSent }) {
  const [form, setForm] = useState({
    subject:
      lead.auditEmailSubject ||
      `A few practical observations for ${lead.name || lead.business}`,
    body: lead.auditEmailBody || buildEmail(lead),
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async (event) => {
    event.preventDefault();
    try {
      setSending(true);
      setError("");
      await upgradeApi.sendLeadEmail(lead.campaignId, lead.id, form);
      await onSent();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title={`Email ${lead.name || lead.business}`} onClose={onClose}>
      <form className="rf-lead-modal-form" onSubmit={send}>
        {error ? <p className="error-banner">{error}</p> : null}
        <p className="text-muted">To: {lead.email}</p>
        <label className="field"><span>Subject</span><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required /></label>
        <label className="field"><span>Email body</span><textarea rows="12" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></label>
        <button className="btn primary" type="submit" disabled={sending}><Send size={14} /> {sending ? "Sending…" : "Send from approved account"}</button>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="rf-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rf-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header>
        {children}
      </section>
    </div>
  );
}

function buildEmail(lead) {
  const business = lead.name || lead.business || "your business";
  const observation = lead.auditSummary || lead.notes || lead.beforeCallNotes || "a few practical opportunities in the enquiry and follow-up flow";
  return `Hi,\n\nThank you for speaking with me.\n\nAs discussed, I reviewed ${business} and noted ${observation}. These are initial public-site observations, so the next step is to validate the current workflow before recommending any work.\n\nUmair, our CTO, can review the process with you and identify whether a practical automation, integration, or product improvement is justified.\n\nCalendar: [ADD CALENDLY LINK]\nAudit: ${lead.auditUrl || "[ADD AUDIT LINK]"}\n\nBest,\n[Caller name]\nCodeSync Labs`;
}

function label(value) {
  return String(value || "new").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadge(status) {
  if (["qualified", "meeting_booked", "connected"].includes(status)) return "badge-green";
  if (["not_interested", "wrong_number", "do_not_call"].includes(status)) return "badge-red";
  if (["callback", "send_information", "call_due"].includes(status)) return "badge-amber";
  return "badge-gray";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
