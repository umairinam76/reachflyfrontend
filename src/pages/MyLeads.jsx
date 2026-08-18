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
      notifyMyLeads(
        "success",
        "Lead assignment updated",
        assignedTo
          ? "The lead is now assigned to the selected team member."
          : "The lead assignment was cleared."
      );
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page rf-my-leads-page rf-my-leads-v7">
      <MyLeadsV7Styles />
      <div className="page-heading">
        <div>
          <span className="eyebrow">Calling workspace</span>
          <h1>{canAssign ? "Team leads and assignments." : "Your assigned leads."}</h1>
          <p>Call, update the outcome, set a dated next action, and send the relevant follow-up without leaving ReachFly.</p>
        </div>
      </div>

      {error ? <p className="error-banner">{safeMyLeadsMessage(error)}</p> : null}

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
      notifyMyLeads(
        "success",
        "Call outcome saved",
        "The lead status, notes, and next action were updated."
      );
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
        {error ? <p className="error-banner">{safeMyLeadsMessage(error)}</p> : null}
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
      notifyMyLeads(
        "success",
        "Email sent",
        "The follow-up was sent from the approved workspace account."
      );
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
        {error ? <p className="error-banner">{safeMyLeadsMessage(error)}</p> : null}
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


function safeMyLeadsMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function notifyMyLeads(type, title, message) {
  if (typeof window === "undefined") {
    return;
  }

  const bridge = window.reachflyToast;
  if (bridge && typeof bridge[type] === "function") {
    bridge[type](title, message);
    return;
  }

  window.dispatchEvent(
    new CustomEvent("reachfly:toast", {
      detail: { type, title, message },
    })
  );
}

function MyLeadsV7Styles() {
  return (
    <style>{`
      .rf-my-leads-v7{
        --rfml-text:#191c1d;
        --rfml-text2:#4d4c59;
        --rfml-muted:#777784;
        --rfml-line:#e2e4e7;
        --rfml-primary:#4648d4;
        --rfml-primary-dark:#393bbb;
        --rfml-primary-soft:#e8e9ff;
        --rfml-green:#087a51;
        --rfml-green-soft:#e4f7ee;
        --rfml-red:#ba1a1a;
        --rfml-red-soft:#ffedeb;
        --rfml-amber:#965900;
        --rfml-amber-soft:#fff3d8;
        --rfml-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfml-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-my-leads-v7 *,
      .rf-my-leads-v7 *::before,
      .rf-my-leads-v7 *::after{box-sizing:border-box}

      .rf-my-leads-v7 .page-heading{
        min-height:132px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        padding:18px;
        margin-bottom:11px;
        color:#fff;
        background:
          radial-gradient(circle at 90% 12%,rgba(86,89,223,.25),transparent 32%),
          #2e3132;
        border-radius:14px;
      }

      .rf-my-leads-v7 .page-heading .eyebrow{
        color:#c9caff;
        font-size:6px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-my-leads-v7 .page-heading h1{
        margin:4px 0 0;
        color:#fff;
        font:600 28px/35px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rf-my-leads-v7 .page-heading p{
        max-width:760px;
        margin:5px 0 0;
        color:rgba(244,246,247,.62);
        font-size:8px;
        line-height:13px;
      }

      .rf-my-leads-v7 .error-banner{
        padding:9px 10px;
        margin:0 0 10px;
        color:#7c1d1d;
        background:var(--rfml-red-soft);
        border:1px solid #ffd0cc;
        border-radius:8px;
        font-size:6.3px;
        line-height:10px;
      }

      .rf-my-leads-v7 .rf-lead-toolbar{
        display:grid;
        grid-template-columns:minmax(220px,1fr) 180px auto;
        align-items:center;
        gap:7px;
        padding:8px;
        margin-bottom:10px;
        background:#fff;
        border:1px solid var(--rfml-line);
        border-radius:10px;
      }

      .rf-my-leads-v7 .search{
        min-height:38px;
        display:grid;
        grid-template-columns:18px minmax(0,1fr);
        align-items:center;
        gap:6px;
        padding:0 9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
      }

      .rf-my-leads-v7 input,
      .rf-my-leads-v7 select,
      .rf-my-leads-v7 textarea{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfml-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 6.5px/11px Inter,sans-serif;
      }

      .rf-my-leads-v7 .search input{
        min-height:36px;
        padding:0;
        background:transparent;
        border:0;
      }

      .rf-my-leads-v7 input:focus,
      .rf-my-leads-v7 select:focus,
      .rf-my-leads-v7 textarea:focus,
      .rf-my-leads-v7 .search:focus-within{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-my-leads-v7 .rf-lead-toolbar > span{
        color:var(--rfml-muted);
        font-size:5.8px;
        font-weight:750;
        white-space:nowrap;
      }

      .rf-my-leads-v7 .rf-lead-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .rf-my-leads-v7 .rf-lead-card{
        min-width:0;
        display:grid;
        align-content:start;
        gap:8px;
        padding:12px!important;
        background:#fff!important;
        border:1px solid var(--rfml-line)!important;
        border-radius:11px!important;
        box-shadow:0 1px 3px rgba(25,28,29,.025)!important;
        transition:.14s var(--rfml-ease);
      }

      .rf-my-leads-v7 .rf-lead-card:hover{
        transform:translateY(-1px);
        border-color:#d8d9ef!important;
        box-shadow:0 9px 22px rgba(25,28,29,.045)!important;
      }

      .rf-my-leads-v7 .rf-lead-card-head{
        min-width:0;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:8px;
        padding-bottom:8px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-my-leads-v7 .rf-lead-card-head > div{min-width:0}
      .rf-my-leads-v7 .rf-lead-card-head small{
        display:block;
        overflow:hidden;
        color:var(--rfml-primary);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.2px;
        font-weight:750;
      }

      .rf-my-leads-v7 .rf-lead-card-head h3{
        margin:3px 0 0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rf-my-leads-v7 .badge{
        flex:0 0 auto;
        padding:4px 6px;
        border-radius:999px;
        font-size:4.8px;
        font-weight:800;
      }

      .rf-my-leads-v7 .badge-green{color:var(--rfml-green);background:var(--rfml-green-soft)}
      .rf-my-leads-v7 .badge-red{color:var(--rfml-red);background:var(--rfml-red-soft)}
      .rf-my-leads-v7 .badge-amber{color:#825400;background:var(--rfml-amber-soft)}
      .rf-my-leads-v7 .badge-gray{color:#666873;background:#f0f1f2}

      .rf-my-leads-v7 .rf-lead-contact{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:5px;
      }

      .rf-my-leads-v7 .rf-lead-contact > span{
        min-width:0;
        display:flex;
        align-items:center;
        gap:5px;
        padding:7px;
        overflow:hidden;
        color:var(--rfml-text2);
        background:#f7f8f9;
        border-radius:7px;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.5px;
      }

      .rf-my-leads-v7 .rf-lead-contact svg{color:var(--rfml-primary);flex:0 0 auto}

      .rf-my-leads-v7 .rf-lead-tags{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
      }

      .rf-my-leads-v7 .rf-lead-tags > span{
        padding:4px 6px;
        color:#57587a;
        background:var(--rfml-primary-soft);
        border-radius:999px;
        font-size:4.8px;
        font-weight:700;
      }

      .rf-my-leads-v7 .rf-lead-audit-summary{
        display:grid;
        gap:3px;
        padding:8px;
        color:#565770;
        background:linear-gradient(135deg,#f4f1ff,#fff);
        border:1px solid #e2dcf6;
        border-radius:8px;
      }

      .rf-my-leads-v7 .rf-lead-audit-summary b{color:var(--rfml-primary);font-size:5.6px}
      .rf-my-leads-v7 .rf-lead-audit-summary p{margin:0;font-size:5.5px;line-height:9px}
      .rf-my-leads-v7 .rf-lead-audit-summary small{font-size:5px;line-height:8px}

      .rf-my-leads-v7 .rf-inline-field{
        display:grid;
        grid-template-columns:18px minmax(0,1fr);
        align-items:center;
        gap:6px;
        padding:6px 7px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-my-leads-v7 .rf-inline-field svg{color:var(--rfml-primary)}
      .rf-my-leads-v7 .rf-inline-field select{min-height:32px;padding:5px 6px;background:#fff}

      .rf-my-leads-v7 .rf-lead-meta{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:5px;
      }

      .rf-my-leads-v7 .rf-lead-meta > div{
        min-height:50px;
        display:grid;
        align-content:center;
        padding:7px;
        background:#f7f8f9;
        border-radius:7px;
      }

      .rf-my-leads-v7 .rf-lead-meta small{color:var(--rfml-muted);font-size:4.9px}
      .rf-my-leads-v7 .rf-lead-meta b{margin-top:2px;font-size:5.8px}

      .rf-my-leads-v7 .rf-lead-note{
        margin:0;
        padding:7px 8px;
        color:var(--rfml-text2);
        background:#fafbfb;
        border-left:3px solid #d7d8ff;
        border-radius:0 7px 7px 0;
        font-size:5.4px;
        line-height:9px;
      }

      .rf-my-leads-v7 .rf-lead-actions{
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        margin-top:auto;
        padding-top:2px;
      }

      .rf-my-leads-v7 .btn{
        min-height:33px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        padding:6px 8px;
        color:var(--rfml-text);
        background:#fff;
        border:1px solid var(--rfml-line);
        border-radius:7px;
        cursor:pointer;
        text-decoration:none;
        font-size:5.5px;
        font-weight:750;
      }

      .rf-my-leads-v7 .btn.primary{color:#fff;background:var(--rfml-primary);border-color:var(--rfml-primary)}
      .rf-my-leads-v7 .btn.primary:hover:not(:disabled){background:var(--rfml-primary-dark)}
      .rf-my-leads-v7 .btn:disabled{opacity:.42;cursor:not-allowed}

      .rf-my-leads-v7 .skeleton-list{display:grid;gap:7px}
      .rf-my-leads-v7 .skeleton-list i{
        height:150px;
        display:block;
        background:linear-gradient(90deg,#eceef0,#f8f9fa,#eceef0);
        background-size:220% 100%;
        border-radius:10px;
      }

      .rf-modal-backdrop{
        position:fixed;
        z-index:2147481000;
        inset:0;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(25,28,29,.58);
        backdrop-filter:blur(8px);
      }

      .rf-modal{
        width:min(620px,100%);
        max-height:calc(100vh - 36px);
        overflow:auto;
        padding:15px;
        color:var(--rfml-text,#191c1d);
        background:#fff;
        border:1px solid rgba(255,255,255,.3);
        border-radius:13px;
        box-shadow:0 24px 70px rgba(0,0,0,.18);
      }

      .rf-modal > header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:10px;
        padding-bottom:9px;
        margin-bottom:9px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-modal h2{margin:0;font:600 14px/19px Geist,Inter,sans-serif}
      .rf-modal > header button{width:32px;height:32px;border:1px solid #e2e4e7;border-radius:7px;background:#fff;cursor:pointer}
      .rf-lead-modal-form{display:grid;gap:8px}
      .rf-lead-modal-form .field{display:grid;gap:4px}
      .rf-lead-modal-form .field > span{color:#777784;font-size:5.5px;font-weight:750;text-transform:uppercase}
      .rf-lead-modal-form textarea{min-height:100px;resize:vertical}

      @media(max-width:1080px){
        .rf-my-leads-v7{padding:22px}
        .rf-my-leads-v7 .rf-lead-grid{grid-template-columns:1fr 1fr}
      }

      @media(max-width:700px){
        .rf-my-leads-v7 .rf-lead-toolbar{grid-template-columns:1fr}
      }

      @media(max-width:620px){
        .rf-my-leads-v7{padding:18px 12px 80px}
        .rf-my-leads-v7 .page-heading{padding:15px}
        .rf-my-leads-v7 .page-heading h1{font-size:23px;line-height:30px}
        .rf-my-leads-v7 .rf-lead-grid{grid-template-columns:1fr}
        .rf-my-leads-v7 .rf-lead-contact{grid-template-columns:1fr}
        .rf-modal-backdrop{padding:0}
        .rf-modal{width:100%;min-height:100vh;max-height:100vh;border-radius:0}
      }

      @media(prefers-reduced-motion:reduce){
        .rf-my-leads-v7,
        .rf-my-leads-v7 *,
        .rf-my-leads-v7 *::before,
        .rf-my-leads-v7 *::after{animation:none!important;transition-duration:.01ms!important}
      }
    `}</style>
  );
}
