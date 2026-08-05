import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ArrowRight, Users } from "../components/icons";
import { upgradeApi } from "../api/upgradeApi";

export default function TeamPerformanceWidget() {
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const visible = permissions.includes("*") || permissions.includes("view_team_performance");
  const [data, setData] = useState({ rows: [], totals: {} });

  useEffect(() => {
    if (!visible) return;
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    const to = new Date().toISOString();
    upgradeApi.teamPerformance({ from, to }).then(setData).catch(() => {});
  }, [visible]);

  const top = useMemo(
    () => [...(data.rows || [])].sort((a, b) => b.meetings - a.meetings || b.connected - a.connected).slice(0, 4),
    [data.rows]
  );

  if (!visible) return null;

  return (
    <section className="card mt24">
      <div className="flex flex-between mb16">
        <div>
          <h3><Users size={17} /> Team performance</h3>
          <p className="text-xs text-muted">Last 7 days · meetings and overdue work</p>
        </div>
        <Link className="btn ghost small" to="/app/team/performance">Full report <ArrowRight size={13} /></Link>
      </div>

      <div className="rf-dashboard-team-summary">
        <span><b>{data.totals?.callAttempts || 0}</b><small>Calls</small></span>
        <span><b>{data.totals?.connected || 0}</b><small>Connects</small></span>
        <span><b>{data.totals?.meetings || 0}</b><small>Meetings</small></span>
        <span><b>{data.totals?.overdue || 0}</b><small>Overdue</small></span>
      </div>

      <div className="rf-dashboard-team-list">
        {top.map((row) => (
          <div key={row.memberId}>
            <span><b>{row.name}</b><small>{row.callAttempts} calls · {row.connected} connects</small></span>
            <span><b>{row.meetings}</b><small>meetings</small></span>
            <span className={`badge ${row.overdue ? "badge-red" : "badge-green"}`}>{row.overdue} overdue</span>
          </div>
        ))}
      </div>
    </section>
  );
}
