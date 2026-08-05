import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Globe2, Mail, Phone, Search, Users } from "../components/icons";
import EmptyState from "../components/EmptyState";

export default function Contacts() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.contacts().then(setItems).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => items.filter((lead) => `${lead.name} ${lead.email} ${lead.phone} ${lead.campaignName}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return <div className="contacts-page"><div className="page-heading"><div><span className="eyebrow">Contacts</span><h1>All campaign leads.</h1><p>One searchable contact table created from every launched campaign.</p></div></div><div className="toolbar"><div className="search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" /></div><span>{filtered.length} contacts</span></div>{loading ? <div className="skeleton-list"><i /><i /><i /></div> : filtered.length === 0 ? <EmptyState title="No contacts yet" text="Launch a campaign and discovered leads will appear here." /> : <div className="table-wrap"><div className="table-title"><div><h2><Users /> Contact database</h2><p>Export-ready lead records for CRM and outreach workflows.</p></div><span>{filtered.length} contacts</span></div><table><thead><tr><th>Business</th><th>Campaign</th><th>Email</th><th>Phone</th><th>Website</th><th>Status</th></tr></thead><tbody>{filtered.map((lead) => <tr key={lead.id}><td><b>{lead.name}</b><small>{lead.address}</small></td><td>{lead.campaignName}</td><td>{lead.email ? <a href={`mailto:${lead.email}`}><Mail /> {lead.email}</a> : "—"}</td><td>{lead.phone ? <span><Phone size={14} /> {lead.phone}</span> : "—"}</td><td>{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer"><Globe2 /> Visit</a> : "—"}</td><td><span className="badge badge-gray">{lead.pipelineStatus || "new"}</span></td></tr>)}</tbody></table></div>}</div>;
}
