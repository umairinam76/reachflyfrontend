import { useEffect, useState } from "react";
import { api } from "../api";
import { BarChart3, Mail, MessageCircle, TrendingUp, Users } from "../components/icons";

export default function Analytics() {
  const [data, setData] = useState(null);
  useEffect(() => { api.analytics().then(setData); }, []);
  const metrics = data?.metrics || [];
  const funnel = data?.funnel || [];
  return <div className="analytics-page"><div className="page-heading"><div><span className="eyebrow">Analytics</span><h1>Campaign performance analytics.</h1><p>Understand lead discovery, channel usage, reply rates, and conversion flow.</p></div></div><div className="grid4 mt24">{metrics.map((m, i) => { const icons = [Users, Mail, MessageCircle, TrendingUp]; const Icon = icons[i % icons.length]; return <div className="metric-card" key={m.label}><div className="metric-icon purple"><Icon /></div><div className="metric-num">{m.value}</div><div className="metric-label">{m.label}</div><div className="metric-trend up">{m.note}</div></div>; })}</div><div className="grid2 mt24"><div className="card"><h3><BarChart3 /> Funnel</h3><div className="funnel-list">{funnel.map((f) => <div key={f.label}><span>{f.label}</span><b>{f.value}</b><i style={{ width: `${Math.max(4, f.percent)}%` }} /></div>)}</div></div><div className="card"><h3>Best next actions</h3><ul className="action-list"><li>Connect Gmail or custom SMTP before running high-volume email outreach.</li><li>Link WhatsApp only after you have a responsible follow-up policy.</li><li>Create one SEO article per target customer problem, not keyword-stuffed pages.</li><li>Replace demo lead generator with your real compliant source adapters.</li></ul></div></div></div>;
}
