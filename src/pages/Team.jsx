import { useEffect, useMemo, useState } from "react";
import { Mail, Users } from "../components/icons";
import { upgradeApi } from "../api/upgradeApi";
import "../styles.css"
export default function Team() {
  const [data, setData] = useState({ workspace: null, members: [] });
  const [form, setForm] = useState({ email: "", role: "caller" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    upgradeApi
      .team()
      .then(setData)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const owner = useMemo(
    () => data.members.find((member) => member.workspaceRole === "owner"),
    [data.members]
  );

  const invite = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const result = await upgradeApi.inviteTeamMember(form);
      setMessage(result.message || "Invitation created.");
      setForm({ email: "", role: "caller" });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (memberId, role) => {
    try {
      setError("");
      await upgradeApi.updateTeamMember(memberId, { role, active: true });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page rf-team-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Workspace team</span>
          <h1>Assign the right access to every person.</h1>
          <p>
            Owners control campaigns, sender accounts, assignments, and reporting.
            Callers see only their assigned leads and the actions they need.
          </p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <p className="success-banner">{message}</p> : null}

      <div className="grid2 rf-team-layout">
        <section className="cardish">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">Invite</span>
              <h2>Add a team member</h2>
            </div>
            <Mail />
          </div>

          <form className="rf-invite-form" onSubmit={invite}>
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="caller@company.com"
                required
              />
            </label>

            <label className="field">
              <span>Workspace role</span>
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="caller">Caller — assigned leads only</option>
                <option value="manager">Manager — assign and report</option>
                <option value="viewer">Viewer — read only</option>
              </select>
            </label>

            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Sending invite…" : "Send invitation"}
            </button>
          </form>

          <div className="safe-note-v54 mt16">
            Invitations use the workspace owner’s connected sender account. SMTP
            credentials are never shown to invited members.
          </div>
        </section>

        <section className="cardish">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">Workspace</span>
              <h2>{data.workspace?.name || "ReachFly workspace"}</h2>
              <p>{data.members.length} members · owner {owner?.name || "—"}</p>
            </div>
            <Users />
          </div>

          {loading ? (
            <div className="skeleton-list"><i /><i /><i /></div>
          ) : (
            <div className="rf-member-list">
              {data.members.map((member) => (
                <article key={member.id} className="rf-member-row">
                  <div className="rf-member-avatar">{initials(member.name)}</div>
                  <div className="rf-member-copy">
                    <b>{member.name}</b>
                    <small>{member.email}</small>
                  </div>

                  {member.workspaceRole === "owner" ? (
                    <span className="badge badge-green">owner</span>
                  ) : (
                    <select
                      value={member.workspaceRole}
                      onChange={(event) => updateRole(member.id, event.target.value)}
                    >
                      <option value="caller">Caller</option>
                      <option value="manager">Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function initials(value) {
  return String(value || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}
