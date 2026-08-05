import { useEffect, useMemo, useState } from "react";
import "../styles.css";

export default function SalesOperations() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  const [template, setTemplate] = useState({ name: "", miniInstructions: "", fullInstructions: "" });
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const load = () => opsApi("/sales/dashboard").then((value) => {
    setData(value);
    setTemplate(value.reportTemplate || template);
  }).catch((e) => setError(e.message));

  useEffect(() => { load(); const timer = setInterval(load, 10000); return () => clearInterval(timer); }, []);
  const calls = data?.calls || [];
  const assignments = data?.assignments || [];
  const members = data?.members || [];
  const assignedLeads = useMemo(() => assignments.map((item) => item.lead).filter(Boolean), [assignments]);

  async function assignSelected() {
    const leads = assignedLeads.filter((lead) => selectedIds.includes(lead.id || lead.placeId || lead.phone));
    if (!selectedAssignee || !leads.length) return;
    await opsApi("/sales/assignments", { method: "POST", body: { assigneeId: selectedAssignee, leads } });
    setSelectedIds([]); load();
  }

  async function saveTemplate() {
    await opsApi("/sales/report-template", { method: "PUT", body: template });
    load();
  }

  return <div className="sales-ops-page">
    <header className="sales-ops-header">
      <div><span className="eyebrow">Sales operations</span><h1>Calls, assignments and audit control.</h1><p>One workspace for admins, managers and callers.</p></div>
      <button className="btn primary" onClick={load}>Refresh</button>
    </header>
    {error ? <div className="live-results-error">{error}</div> : null}
    <nav className="sales-tabs">{["overview","assignments","calls","report-format"].map((item)=><button className={tab===item?"active":""} onClick={()=>setTab(item)} key={item}>{item.replace("-"," ")}</button>)}</nav>

    {tab === "overview" ? <>
      <section className="sales-metrics">
        <Metric label="Calls today" value={data?.metrics?.callsToday || 0}/><Metric label="Answered today" value={data?.metrics?.answeredToday || 0}/><Metric label="Unique leads" value={data?.metrics?.uniqueLeadsContacted || 0}/><Metric label="Average duration" value={`${data?.metrics?.averageDurationSeconds || 0}s`}/>
      </section>
      <section className="sales-panel"><h2>Team performance</h2><div className="team-grid">{members.map((member)=><article key={member.id}><b>{member.name || member.email}</b><span>{member.role || "caller"}</span><small>{calls.filter((call)=>call.callerUserId===member.id).length} calls</small></article>)}</div></section>
    </> : null}

    {tab === "assignments" ? <section className="sales-panel">
      <div className="panel-head"><div><h2>Assign leads</h2><p>Managers can distribute leads without creating duplicate ownership.</p></div><div className="assignment-controls"><select value={selectedAssignee} onChange={(e)=>setSelectedAssignee(e.target.value)}><option value="">Choose caller</option>{members.map((member)=><option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select><button className="btn primary" onClick={assignSelected}>Assign selected</button></div></div>
      <div className="assignment-list">{assignedLeads.map((lead)=>{const id=lead.id||lead.placeId||lead.phone;return <label key={id}><input type="checkbox" checked={selectedIds.includes(id)} onChange={()=>setSelectedIds((current)=>current.includes(id)?current.filter((x)=>x!==id):[...current,id])}/><span><b>{lead.business||lead.name}</b><small>{lead.phone} · {lead.address}</small></span></label>})}</div>
    </section> : null}

    {tab === "calls" ? <section className="sales-panel"><h2>Call activity</h2><div className="call-table"><div className="call-row head"><span>Lead</span><span>Caller</span><span>Status</span><span>Outcome</span><span>Started</span></div>{calls.map((call)=><div className="call-row" key={call.id}><span><b>{call.lead?.business||call.lead?.name}</b><small>{call.destinationNumber}</small></span><span>{members.find((m)=>m.id===call.callerUserId)?.name||call.callerUserId}</span><span className={`status ${call.status}`}>{call.status}</span><span>{call.outcome||"—"}</span><span>{new Date(call.createdAt).toLocaleString()}</span></div>)}</div></section> : null}

    {tab === "report-format" ? <section className="sales-panel report-template-editor"><h2>Report format control</h2><p>The Mini Audit structure remains fixed. These workspace instructions refine wording and full-report presentation.</p><label><span>Template name</span><input value={template.name||""} onChange={(e)=>setTemplate({...template,name:e.target.value})}/></label><label><span>Mini audit instructions</span><textarea value={template.miniInstructions||""} onChange={(e)=>setTemplate({...template,miniInstructions:e.target.value})}/></label><label><span>Full audit instructions</span><textarea value={template.fullInstructions||""} onChange={(e)=>setTemplate({...template,fullInstructions:e.target.value})}/></label><button className="btn primary" onClick={saveTemplate}>Save report format</button></section> : null}
  </div>;
}
function Metric({label,value}){return <article className="sales-metric"><span>{label}</span><strong>{value}</strong></article>}


const OPS_API_BASE = `${String(import.meta.env.VITE_API_URL || "http://localhost:8787/api").replace(/\/$/, "")}${/\/api$/i.test(String(import.meta.env.VITE_API_URL || "http://localhost:8787/api").replace(/\/$/, "")) ? "" : "/api"}`;
async function opsApi(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const response = await fetch(`${OPS_API_BASE}${path}`, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || data?.message || `Request failed with status ${response.status}.`);
  return data;
}
