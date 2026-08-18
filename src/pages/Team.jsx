import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Target,
  Users,
  X,
} from "../components/icons";
import { useAuth } from "../auth/AuthContext";
import { apiRequest, onWorkspaceSocket } from "../lib/workspace-platform-client.js";

const PAGE_SIZE = 10;

const ROLE_OPTIONS = [
  {
    value: "manager",
    label: "Manager",
    description: "Manage team members, campaigns, assignments, reporting, and audits.",
  },
  {
    value: "caller",
    label: "Caller",
    description: "Work assigned leads, update outcomes, send lead email, and use AI tools.",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read assigned lead information and use permitted AI workspace tools.",
  },
];

const ROLE_FILTERS = [
  ["all", "All roles"],
  ["owner", "Owner"],
  ["admin", "Admin"],
  ["manager", "Manager"],
  ["caller", "Caller"],
  ["viewer", "Viewer"],
];

const STATUS_FILTERS = [
  ["all", "All statuses"],
  ["active", "Active"],
  ["inactive", "Inactive"],
];

const PERMISSIONS = [
  ["Leads & CRM", "View assigned leads", ["owner", "manager", "caller", "viewer"]],
  ["Leads & CRM", "Update assigned leads", ["owner", "manager", "caller"]],
  ["Leads & CRM", "Assign leads", ["owner", "manager"]],
  ["Campaigns & Growth", "Manage campaigns", ["owner", "manager"]],
  ["Campaigns & Growth", "Create and view audits", ["owner", "manager"]],
  ["Workspace", "Manage team", ["owner", "manager"]],
  ["Workspace", "View team performance", ["owner", "manager"]],
  ["Workspace", "Send lead email", ["owner", "manager", "caller"]],
  ["Workspace", "Use AI workspace tools", ["owner", "manager", "caller", "viewer"]],
];

export default function Team() {
  const { user, initializing } = useAuth();
  const mounted = useRef(true);

  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [performance, setPerformance] = useState({ from: "", to: "", rows: [], totals: {} });
  const [presence, setPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [tab, setTab] = useState("members");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  const currentRole = normalizeRole(user?.workspaceRole || user?.role);
  const accountType = String(user?.accountType || "").toLowerCase();
  const canManage =
    ["owner", "admin", "manager"].includes(currentRole) || accountType === "individual";

  const load = useCallback(async ({ background = false, successToast = false } = {}) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    setWarning("");

    try {
      const [teamResult, performanceResult, presenceResult] = await Promise.allSettled([
        requestFirst(["/team", "/team-management/members"]),
        requestFirst(["/team/performance", "/team-management/performance"]),
        apiRequest("/team-communication/presence", { timeoutMs: 12000 }),
      ]);

      if (!mounted.current) return;

      if (teamResult.status !== "fulfilled") throw teamResult.reason;

      const team = normalizeTeam(teamResult.value);
      setWorkspace(team.workspace);
      setMembers(team.members);

      if (performanceResult.status === "fulfilled") {
        setPerformance(normalizePerformance(performanceResult.value));
      } else {
        setPerformance({ from: "", to: "", rows: [], totals: {} });
        setWarning("Team members loaded, but performance metrics are temporarily unavailable.");
      }

      setPresence(
        presenceResult.status === "fulfilled"
          ? normalizePresence(presenceResult.value)
          : []
      );

      if (successToast) {
        notify("success", "Team refreshed", "Latest member and performance data is now visible.");
      }
    } catch (requestError) {
      if (!mounted.current) return;
      const text = safeMessage(requestError?.message || "Team members could not be loaded.");
      setError(text);
      if (successToast) notify("error", "Team refresh failed", text);
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (initializing || !canManage) return undefined;

    void load();

    const socketEvents = [
      "team:member-created",
      "team:member-updated",
      "team:member-deleted",
      "team:invite-accepted",
      "presence:updated",
      "lead:updated",
    ];

    const unsubscribers =
      typeof onWorkspaceSocket === "function"
        ? socketEvents.map((eventName) =>
            onWorkspaceSocket(
              eventName,
              () => void load({ background: true })
            )
          )
        : [];

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({ background: true });
      }
    }, 60000);

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      });
      window.clearInterval(timer);
    };
  }, [canManage, initializing, load]);

  const performanceMap = useMemo(
    () =>
      new Map(
        performance.rows.map((row) => [
          String(row.memberId || row.userId || row.id || ""),
          row,
        ])
      ),
    [performance.rows]
  );

  const presenceMap = useMemo(
    () =>
      new Map(
        presence.map((item) => [
          String(item.memberId || item.userId || item.id || ""),
          item,
        ])
      ),
    [presence]
  );

  const enriched = useMemo(
    () =>
      members.map((member) => ({
        ...member,
        performance: performanceMap.get(String(member.id)) || null,
        presence: presenceMap.get(String(member.id)) || null,
      })),
    [members, performanceMap, presenceMap]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((member) => {
      const role = normalizeRole(member.workspaceRole || member.role);
      const status = getMemberStatus(member).key;

      if (roleFilter !== "all" && role !== roleFilter) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;

      return [member.name, member.email, member.jobTitle, role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [enriched, roleFilter, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleMembers = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = enriched.find((member) => String(member.id) === String(selectedId)) || null;
  const metrics = useMemo(() => buildMetrics(enriched, performance), [enriched, performance]);
  const insight = useMemo(() => buildInsight(performance.rows), [performance.rows]);

  async function updateMember(member, patch) {
    const role = normalizeRole(patch.role || member.workspaceRole || member.role);
    if (role === "owner") {
      notify("warning", "Owner role is protected", "The workspace owner cannot be reassigned here.");
      return;
    }

    try {
      const response = await patchTeamMember(member.id, {
        role,
        active: patch.active !== false,
      });
      const updated = normalizeMember(response?.member || response?.profile || response);

      setMembers((current) =>
        current.map((item) =>
          String(item.id) === String(member.id)
            ? {
                ...item,
                ...updated,
                workspaceRole: normalizeRole(updated.workspaceRole || updated.role || role),
                active: patch.active !== false,
              }
            : item
        )
      );

      notify(
        "success",
        "Member updated",
        `${member.name || "Team member"}'s workspace access has been updated.`
      );
    } catch (requestError) {
      const text = safeMessage(requestError?.message || "The team member could not be updated.");
      notify("error", "Update failed", text);
      throw requestError;
    }
  }

  if (initializing) {
    return (
      <>
        <TeamStyles />
        <TeamSkeleton />
      </>
    );
  }

  if (!canManage) {
    return (
      <>
        <TeamStyles />
        <main className="rf-team-v7">
          <div className="rft-access-denied">
            <span><Shield size={25} /></span>
            <h1>Team management is restricted</h1>
            <p>Workspace owners, administrators, and managers can open this screen.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TeamStyles />

      <main className="rf-team-v7">
        <header className="rft-page-header">
          <div>
            <span className="rft-eyebrow">Workspace</span>
            <h1>Team Members</h1>
            <p>
              Manage workspace access, review individual performance, and keep every person
              aligned with the right role.
            </p>
          </div>

          <div className="rft-header-actions">
            <button
              type="button"
              className="rft-btn secondary"
              disabled={refreshing}
              onClick={() => void load({ background: true, successToast: true })}
            >
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              className="rft-btn primary"
              onClick={() => setShowInvite(true)}
            >
              <Plus size={15} />
              Invite Member
            </button>
          </div>
        </header>

        {error ? (
          <Notice
            tone="error"
            title="Team data needs attention"
            text={error}
            action={
              <button type="button" onClick={() => void load({ successToast: true })}>
                Try again
              </button>
            }
          />
        ) : null}

        {warning ? (
          <Notice tone="warning" title="Partial team data" text={warning} />
        ) : null}

        <section className="rft-metric-grid">
          <Metric
            label="Active Members"
            value={formatNumber(metrics.activeMembers)}
            note={`${formatNumber(metrics.totalMembers)} total workspace members`}
            icon={<Users size={16} />}
          />
          <Metric
            label="Assigned Leads"
            value={formatNumber(metrics.assigned)}
            note="Current team workload"
            icon={<Target size={16} />}
          />
          <Metric
            label="Calls"
            value={formatNumber(metrics.callAttempts)}
            note={formatPerformanceRange(performance)}
            icon={<Phone size={16} />}
          />
          <Metric
            label="Meetings Booked"
            value={formatNumber(metrics.meetings)}
            note={`${formatPercent(metrics.meetingRate)} of connected conversations`}
            icon={<Calendar size={16} />}
          />

          <article className="rft-insight-card">
            <header>
              <Sparkles size={15} />
              <span>Performance Insight</span>
            </header>
            <p>{insight}</p>
          </article>
        </section>

        <section className="rft-tabs-toolbar">
          <div className="rft-tabs">
            {[
              ["members", "Team Members"],
              ["performance", "Performance"],
              ["permissions", "Permissions"],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => {
                  setTab(key);
                  setPage(1);
                }}
              >
                {label}
                {key === "members" ? <span>{members.length}</span> : null}
              </button>
            ))}
          </div>

          {tab === "members" ? (
            <div className="rft-member-tools">
              <label className="rft-search">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search members..."
                  aria-label="Search team members"
                />
                {search ? (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                    <X size={11} />
                  </button>
                ) : null}
              </label>

              <Filter
                value={roleFilter}
                options={ROLE_FILTERS}
                label="Role"
                onChange={(value) => {
                  setRoleFilter(value);
                  setPage(1);
                }}
              />
              <Filter
                value={statusFilter}
                options={STATUS_FILTERS}
                label="Status"
                onChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              />
            </div>
          ) : null}
        </section>

        {loading ? (
          <TableSkeleton />
        ) : tab === "members" ? (
          <MembersPanel
            members={visibleMembers}
            total={filtered.length}
            page={safePage}
            pageCount={pageCount}
            filtered={Boolean(search || roleFilter !== "all" || statusFilter !== "all")}
            onOpen={(member) => setSelectedId(member.id)}
            onRoleChange={(member, role) =>
              void updateMember(member, { role, active: member.active !== false })
            }
            onPageChange={setPage}
            onClear={() => {
              setSearch("");
              setRoleFilter("all");
              setStatusFilter("all");
              setPage(1);
            }}
          />
        ) : tab === "performance" ? (
          <PerformancePanel
            rows={performance.rows}
            from={performance.from}
            to={performance.to}
            members={members}
            onOpen={(id) => setSelectedId(id)}
          />
        ) : (
          <PermissionsPanel />
        )}

        {selected ? (
          <MemberDrawer
            member={selected}
            onClose={() => setSelectedId("")}
            onUpdate={updateMember}
          />
        ) : null}

        {showInvite ? (
          <InviteModal
            workspaceName={workspace?.name || "ReachFly Workspace"}
            onClose={() => setShowInvite(false)}
            onRefresh={() => load({ background: true })}
          />
        ) : null}
      </main>
    </>
  );
}

function MembersPanel({
  members,
  total,
  page,
  pageCount,
  filtered,
  onOpen,
  onRoleChange,
  onPageChange,
  onClear,
}) {
  if (!members.length) {
    return (
      <section className="rft-panel">
        <div className="rft-empty">
          <span><Users size={22} /></span>
          <h2>{filtered ? "No matching members" : "No team members yet"}</h2>
          <p>
            {filtered
              ? "Try another search or clear the current role and status filters."
              : "Invite your first team member to start managing workspace access."}
          </p>
          {filtered ? (
            <button type="button" className="rft-btn secondary" onClick={onClear}>
              Clear filters
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="rft-panel">
      <div className="rft-table-wrap">
        <table className="rft-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Status</th>
              <th className="right">Assigned Leads</th>
              <th className="right">Calls</th>
              <th className="right">Meetings</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <MemberRow
                key={member.id || index}
                member={member}
                index={index}
                onOpen={() => onOpen(member)}
                onRoleChange={(role) => onRoleChange(member, role)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="rft-mobile-list">
        {members.map((member, index) => (
          <MemberMobile
            key={member.id || index}
            member={member}
            index={index}
            onOpen={() => onOpen(member)}
          />
        ))}
      </div>

      <footer className="rft-panel-footer">
        <span>
          Showing <strong>{(page - 1) * PAGE_SIZE + 1}</strong> to{" "}
          <strong>{Math.min(page * PAGE_SIZE, total)}</strong> of{" "}
          <strong>{total}</strong> members
        </span>
        <Pagination page={page} count={pageCount} onChange={onPageChange} />
      </footer>
    </section>
  );
}

function MemberRow({ member, index, onOpen, onRoleChange }) {
  const role = normalizeRole(member.workspaceRole || member.role);
  const perf = member.performance || {};
  return (
    <tr style={{ "--rft-index": index }} onClick={onOpen}>
      <td><MemberIdentity member={member} /></td>
      <td onClick={(event) => event.stopPropagation()}>
        {role === "owner" ? (
          <RoleBadge role={role} />
        ) : (
          <RoleSelect value={role} onChange={onRoleChange} />
        )}
      </td>
      <td><StatusBadge status={getMemberStatus(member)} /></td>
      <td className="right number">{formatNumber(perf.assigned || 0)}</td>
      <td className="right number">{formatNumber(perf.callAttempts || perf.totalCalls || 0)}</td>
      <td className="right number">{formatNumber(perf.meetings || perf.meetingsBooked || 0)}</td>
      <td><span className="rft-last-active">{formatRelativeTime(perf.lastActivityAt || member.updatedAt)}</span></td>
    </tr>
  );
}

function MemberMobile({ member, index, onOpen }) {
  const perf = member.performance || {};
  return (
    <button
      type="button"
      className="rft-mobile-card"
      style={{ "--rft-index": index }}
      onClick={onOpen}
    >
      <header>
        <MemberIdentity member={member} />
        <ChevronRight size={14} />
      </header>
      <div className="rft-mobile-badges">
        <RoleBadge role={member.workspaceRole || member.role} />
        <StatusBadge status={getMemberStatus(member)} />
      </div>
      <div className="rft-mobile-stats">
        <span><small>Assigned</small><strong>{formatNumber(perf.assigned || 0)}</strong></span>
        <span><small>Calls</small><strong>{formatNumber(perf.callAttempts || 0)}</strong></span>
        <span><small>Meetings</small><strong>{formatNumber(perf.meetings || 0)}</strong></span>
      </div>
    </button>
  );
}

function MemberIdentity({ member }) {
  return (
    <div className="rft-member-id">
      <span className={avatarTone(member.name || member.email)}>
        {initials(member.name || member.email)}
        {isOnline(member) ? <i /> : null}
      </span>
      <div>
        <strong>{member.name || "Team member"}</strong>
        <small>{member.email || "No email"}</small>
      </div>
    </div>
  );
}

function RoleSelect({ value, onChange }) {
  const safe = ["manager", "caller", "viewer"].includes(value) ? value : "caller";
  return (
    <label className="rft-role-select">
      <select value={safe} onChange={(event) => onChange(event.target.value)}>
        {ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown size={11} />
    </label>
  );
}

function RoleBadge({ role }) {
  const normalized = normalizeRole(role);
  return <span className={`rft-role ${normalized}`}>{formatRole(normalized)}</span>;
}

function StatusBadge({ status }) {
  return (
    <span className={`rft-status ${status.key}`}>
      <i />
      {status.label}
    </span>
  );
}

function PerformancePanel({ rows, from, to, members, onOpen }) {
  const memberMap = new Map(members.map((member) => [String(member.id), member]));
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.meetings || 0) - Number(a.meetings || 0) ||
      Number(b.connected || 0) - Number(a.connected || 0)
  );

  if (!sorted.length) {
    return (
      <section className="rft-panel">
        <div className="rft-empty">
          <span><Activity size={22} /></span>
          <h2>No performance activity yet</h2>
          <p>Calls, lead activity, email actions, and meetings will appear here as your team works.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rft-panel">
      <header className="rft-performance-head">
        <div>
          <span className="rft-eyebrow">Performance</span>
          <h2>Team performance</h2>
          <p>{formatDateRange(from, to)}</p>
        </div>
        <small>Metrics are calculated from assigned lead activity in the reporting range.</small>
      </header>

      <div className="rft-table-wrap">
        <table className="rft-table performance">
          <thead>
            <tr>
              <th>Member</th>
              <th className="right">Assigned</th>
              <th className="right">Calls</th>
              <th className="right">Connected</th>
              <th className="right">Connect Rate</th>
              <th className="right">Qualified</th>
              <th className="right">Meetings</th>
              <th className="right">Emails</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => {
              const member =
                memberMap.get(String(row.memberId || row.userId || row.id || "")) || {
                  id: row.memberId || row.userId || row.id,
                  name: row.name,
                  email: row.email,
                  workspaceRole: row.role,
                };
              return (
                <tr
                  key={row.memberId || row.userId || index}
                  style={{ "--rft-index": index }}
                  onClick={() => onOpen(member.id)}
                >
                  <td><MemberIdentity member={member} /></td>
                  <td className="right number">{formatNumber(row.assigned)}</td>
                  <td className="right number">{formatNumber(row.callAttempts)}</td>
                  <td className="right number">{formatNumber(row.connected)}</td>
                  <td className="right"><RateMeter value={row.connectRate} /></td>
                  <td className="right number">{formatNumber(row.qualified)}</td>
                  <td className="right number">{formatNumber(row.meetings)}</td>
                  <td className="right number">{formatNumber(row.emails)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RateMeter({ value }) {
  const safe = Math.min(100, Math.max(0, Number(value || 0)));
  return (
    <span className="rft-rate">
      <i><b style={{ "--rft-rate": `${safe}%` }} /></i>
      <strong>{formatPercent(safe)}</strong>
    </span>
  );
}

function PermissionsPanel() {
  const roles = ["owner", "manager", "caller", "viewer"];
  let previousGroup = "";

  return (
    <section className="rft-permissions">
      <aside className="rft-role-summary">
        <header>
          <span><Shield size={18} /></span>
          <div>
            <h2>Default Roles</h2>
            <p>Workspace access is role-based.</p>
          </div>
        </header>

        {[
          ["owner", "Full workspace control"],
          ["manager", "Team, campaigns & reporting"],
          ["caller", "Assigned lead execution"],
          ["viewer", "Read-only assigned leads"],
        ].map(([role, text]) => (
          <article key={role}>
            <i className={`dot ${role}`} />
            <div><strong>{formatRole(role)}</strong><small>{text}</small></div>
          </article>
        ))}

        <div className="rft-policy-note">
          <Settings size={13} />
          <p>
            The current workspace API exposes fixed default role policies. Custom permission
            persistence is not shown because that backend capability is not available here.
          </p>
        </div>
      </aside>

      <section className="rft-permission-matrix">
        <header>
          <div>
            <span className="rft-eyebrow">Access Control</span>
            <h2>Permission Matrix</h2>
          </div>
        </header>

        <div className="rft-permission-scroll">
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                {roles.map((role) => <th key={role}>{formatRole(role)}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(([group, capability, allowed]) => {
                const showGroup = group !== previousGroup;
                previousGroup = group;
                return (
                  <>
                    {showGroup ? (
                      <tr className="group" key={`${group}-group`}>
                        <td colSpan="5">{group}</td>
                      </tr>
                    ) : null}
                    <tr key={`${group}-${capability}`}>
                      <td>{capability}</td>
                      {roles.map((role) => (
                        <td key={role}>
                          {allowed.includes(role) ? (
                            <span className="rft-perm yes"><CheckCircle2 size={15} /></span>
                          ) : (
                            <span className="rft-perm no"><X size={12} /></span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function MemberDrawer({ member, onClose, onUpdate }) {
  const role = normalizeRole(member.workspaceRole || member.role);
  const [draftRole, setDraftRole] = useState(
    role === "owner" ? "owner" : ["manager", "caller", "viewer"].includes(role) ? role : "caller"
  );
  const [active, setActive] = useState(member.active !== false);
  const [saving, setSaving] = useState(false);
  const perf = member.performance || {};
  const changed = draftRole !== role || active !== (member.active !== false);

  async function save() {
    if (role === "owner" || !changed) return;
    setSaving(true);
    try {
      await onUpdate(member, { role: draftRole, active });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rft-drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="rft-drawer">
        <header>
          <div>
            <span className="rft-eyebrow">Member Details</span>
            <h2>{member.name || "Team member"}</h2>
            <p>{member.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close member details">
            <X size={15} />
          </button>
        </header>

        <section className="rft-drawer-profile">
          <span className={avatarTone(member.name || member.email)}>
            {initials(member.name || member.email)}
          </span>
          <div>
            <strong>{member.name || "Team member"}</strong>
            <small>{member.jobTitle || formatRole(role)}</small>
          </div>
          <StatusBadge status={getMemberStatus(member)} />
        </section>

        <section className="rft-drawer-stats">
          {[
            ["Assigned", perf.assigned],
            ["Calls", perf.callAttempts],
            ["Connected", perf.connected],
            ["Meetings", perf.meetings],
          ].map(([label, value]) => (
            <article key={label}>
              <small>{label}</small>
              <strong>{formatNumber(value)}</strong>
            </article>
          ))}
        </section>

        <DrawerSection
          title="Account"
          rows={[
            ["Email", member.email || "—"],
            ["Role", formatRole(role)],
            ["Joined", formatDate(member.createdAt)],
            ["Last active", formatRelativeTime(perf.lastActivityAt || member.updatedAt)],
          ]}
        />

        <DrawerSection
          title="Performance"
          rows={[
            ["Connect rate", formatPercent(perf.connectRate)],
            ["Qualified leads", formatNumber(perf.qualified)],
            ["Emails sent", formatNumber(perf.emails)],
            ["Overdue actions", formatNumber(perf.overdue)],
          ]}
        />

        <section className="rft-drawer-section">
          <h3>Workspace Access</h3>

          {role === "owner" ? (
            <div className="rft-owner-lock">
              <Shield size={14} />
              <p>The workspace owner has full access and cannot be reassigned from this screen.</p>
            </div>
          ) : (
            <div className="rft-access-form">
              <label>
                <span>Role</span>
                <select value={draftRole} onChange={(event) => setDraftRole(event.target.value)}>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="rft-toggle-row">
                <span>
                  <strong>Active workspace access</strong>
                  <small>Inactive members remain in historical records.</small>
                </span>
                <button
                  type="button"
                  className={active ? "on" : ""}
                  aria-pressed={active}
                  onClick={() => setActive((value) => !value)}
                >
                  <i />
                </button>
              </label>
            </div>
          )}
        </section>

        {role !== "owner" ? (
          <footer>
            <button type="button" className="rft-btn secondary" onClick={onClose}>Close</button>
            <button
              type="button"
              className="rft-btn primary"
              disabled={!changed || saving}
              onClick={() => void save()}
            >
              {saving ? <RefreshCw size={12} className="spin" /> : null}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

function DrawerSection({ title, rows }) {
  return (
    <section className="rft-drawer-section">
      <h3>{title}</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}

function InviteModal({ workspaceName, onClose, onRefresh }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("caller");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [localError, setLocalError] = useState("");

  const selectedRole = ROLE_OPTIONS.find((option) => option.value === role) || ROLE_OPTIONS[1];

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setLocalError("");

    try {
      const response = await apiRequest("/team/invites", {
        method: "POST",
        body: { email: email.trim(), role },
        timeoutMs: 30000,
      });

      setResult(response || {});
      notify(
        response?.emailSent ? "success" : "warning",
        response?.emailSent ? "Invitation sent" : "Invitation created",
        safeMessage(response?.message || "The team invitation was created.")
      );
      await onRefresh?.();
    } catch (requestError) {
      const text = safeMessage(requestError?.message || "The invitation could not be created.");
      setLocalError(text);
      notify("error", "Invitation failed", text);
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!result?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      notify("success", "Invitation link copied", "The secure invitation link is ready to share.");
    } catch {
      notify("error", "Copy failed", "The invitation link could not be copied automatically.");
    }
  }

  return (
    <div
      className="rft-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="rft-invite-modal">
        <form onSubmit={submit}>
          <header>
            <div>
              <span className="rft-eyebrow">Workspace Access</span>
              <h2>Invite Team Member</h2>
              <p>Add a person to your workspace and assign their default role.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close invitation">
              <X size={15} />
            </button>
          </header>

          <div className="rft-invite-body">
            {localError ? <div className="rft-form-error"><X size={12} />{localError}</div> : null}

            {result ? (
              <div className="rft-invite-success">
                <span><CheckCircle2 size={20} /></span>
                <h3>{result.emailSent ? "Invitation sent" : "Invitation created"}</h3>
                <p>{safeMessage(result.message || "The invitation is ready.")}</p>
                {result.inviteUrl ? (
                  <button type="button" onClick={() => void copyLink()}>
                    Copy secure invite link
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <label className="rft-field">
                  <span>Email Address</span>
                  <div>
                    <Mail size={14} />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="colleague@company.com"
                      required
                      autoFocus
                    />
                  </div>
                </label>

                <fieldset className="rft-role-cards">
                  <legend>Select Role</legend>
                  {ROLE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={role === option.value ? "selected" : ""}
                      onClick={() => setRole(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </fieldset>

                <div className="rft-invite-note">
                  <Shield size={13} />
                  <p>
                    The invitee creates their own password after opening the secure invitation.
                    ReachFly does not expose workspace passwords to team managers.
                  </p>
                </div>
              </>
            )}
          </div>

          <footer>
            <button type="button" className="rft-btn secondary" onClick={onClose}>
              {result ? "Done" : "Cancel"}
            </button>
            {!result ? (
              <button
                type="submit"
                className="rft-btn primary"
                disabled={saving || !email.trim()}
              >
                {saving ? <RefreshCw size={12} className="spin" /> : <Mail size={12} />}
                {saving ? "Sending…" : "Send Invitation"}
              </button>
            ) : null}
          </footer>
        </form>

        <aside className="rft-invite-preview">
          <span>Invitation Preview</span>
          <article>
            <header><span><Mail size={18} /></span></header>
            <h3>{email.trim() || "colleague@company.com"}</h3>
            <p>Has been invited to join</p>
            <strong>{workspaceName}</strong>
            <div>
              <small>Assigned Role</small>
              <span><Shield size={12} />{selectedRole.label}</span>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}

function Filter({ value, options, label, onChange }) {
  return (
    <label className={`rft-filter ${value !== "all" ? "active" : ""}`}>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
      <ChevronDown size={11} />
    </label>
  );
}

function Pagination({ page, count, onChange }) {
  if (count <= 1) return null;
  return (
    <nav className="rft-pagination" aria-label="Team member pages">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
      <span>{page} / {count}</span>
      <button type="button" disabled={page >= count} onClick={() => onChange(page + 1)}>›</button>
    </nav>
  );
}

function Metric({ label, value, note, icon }) {
  return (
    <article className="rft-metric">
      <header><span>{label}</span><i>{icon}</i></header>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Notice({ tone, title, text, action }) {
  return (
    <section className={`rft-notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span>{tone === "error" ? <X size={14} /> : <Shield size={14} />}</span>
      <div><strong>{title}</strong><small>{text}</small></div>
      {action}
    </section>
  );
}

function TableSkeleton() {
  return (
    <section className="rft-panel" aria-busy="true">
      <div className="rft-skeleton-list">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}><i className="person" /><i /><i /><i /><i /></div>
        ))}
      </div>
    </section>
  );
}

function TeamSkeleton() {
  return (
    <main className="rf-team-v7" aria-busy="true">
      <header className="rft-page-header">
        <div>
          <span className="rft-eyebrow">Workspace</span>
          <h1>Team Members</h1>
          <p>Loading workspace members…</p>
        </div>
      </header>
      <section className="rft-metric-grid loading">
        {Array.from({ length: 5 }).map((_, index) => <article key={index}><i /><i /><i /></article>)}
      </section>
      <TableSkeleton />
    </main>
  );
}

/* API compatibility */

async function requestFirst(paths) {
  let lastError = null;
  for (let index = 0; index < paths.length; index += 1) {
    try {
      return await apiRequest(paths[index], { timeoutMs: 20000 });
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || error?.statusCode || 0);
      if (!(index < paths.length - 1 && [404, 405].includes(status))) throw error;
    }
  }
  throw lastError || new Error("The request could not be completed.");
}

async function patchTeamMember(memberId, body) {
  const encoded = encodeURIComponent(memberId);
  try {
    return await apiRequest(`/team/${encoded}`, {
      method: "PATCH",
      body,
      timeoutMs: 20000,
    });
  } catch (error) {
    const status = Number(error?.status || error?.statusCode || 0);
    if (![404, 405].includes(status)) throw error;

    return apiRequest(`/team-management/members/${encoded}`, {
      method: "PATCH",
      body: {
        role: body.role,
        active: body.active,
        status: body.active ? "active" : "disabled",
      },
      timeoutMs: 20000,
    });
  }
}

function normalizeTeam(value) {
  const source = value && typeof value === "object" ? value : {};
  const list = Array.isArray(value)
    ? value
    : source.members || source.profiles || source.users || [];

  return {
    workspace: source.workspace || null,
    members: (Array.isArray(list) ? list : []).map(normalizeMember),
  };
}

function normalizeMember(member = {}) {
  return {
    ...member,
    id: member.id || member.userId || member.memberId || "",
    name: member.name || member.fullName || member.displayName || member.email || "Team member",
    email: member.email || "",
    workspaceRole: normalizeRole(member.workspaceRole || member.role),
    active:
      member.active !== false &&
      member.isActive !== false &&
      !["inactive", "disabled", "suspended"].includes(normalizeStatus(member.status)),
  };
}

function normalizePerformance(value) {
  if (Array.isArray(value)) {
    return { from: "", to: "", rows: value, totals: aggregate(value) };
  }

  const source = value && typeof value === "object" ? value : {};
  const rows = source.rows || source.performance || source.members || [];
  const safeRows = Array.isArray(rows) ? rows : [];

  return {
    from: source.from || source.start || "",
    to: source.to || source.end || "",
    rows: safeRows,
    totals: source.totals && typeof source.totals === "object" ? source.totals : aggregate(safeRows),
  };
}

function normalizePresence(value) {
  if (Array.isArray(value)) return value;
  const list = value?.members || value?.presence || value?.items || [];
  return Array.isArray(list) ? list : [];
}

function aggregate(rows) {
  return rows.reduce(
    (total, row) => {
      ["assigned", "callAttempts", "connected", "qualified", "meetings", "emails", "overdue"].forEach(
        (key) => {
          total[key] += Number(row?.[key] || 0);
        }
      );
      return total;
    },
    { assigned: 0, callAttempts: 0, connected: 0, qualified: 0, meetings: 0, emails: 0, overdue: 0 }
  );
}

function buildMetrics(members, performance) {
  const totals = performance.totals || aggregate(performance.rows);
  const connected = Number(totals.connected || 0);
  const meetings = Number(totals.meetings || 0);

  return {
    totalMembers: members.length,
    activeMembers: members.filter((member) => member.active !== false).length,
    assigned: Number(totals.assigned || 0),
    callAttempts: Number(totals.callAttempts || 0),
    meetings,
    meetingRate: connected > 0 ? (meetings / connected) * 100 : 0,
  };
}

function buildInsight(rows) {
  const active = rows.filter(
    (row) => Number(row.callAttempts || row.assigned || row.emails || row.meetings || 0) > 0
  );

  if (!active.length) {
    return "Performance insight will appear after your team records lead activity.";
  }

  const top = [...active].sort(
    (a, b) =>
      Number(b.meetings || 0) - Number(a.meetings || 0) ||
      Number(b.connectRate || 0) - Number(a.connectRate || 0) ||
      Number(b.qualified || 0) - Number(a.qualified || 0)
  )[0];

  const details = [];
  if (Number(top.meetings || 0) > 0) details.push(`${formatNumber(top.meetings)} meetings`);
  if (Number(top.connectRate || 0) > 0) details.push(`${formatPercent(top.connectRate)} connect rate`);
  if (Number(top.qualified || 0) > 0) details.push(`${formatNumber(top.qualified)} qualified leads`);

  return details.length
    ? `${top.name || "A team member"} is leading this reporting window with ${details.join(" and ")}.`
    : `${top.name || "A team member"} has the strongest recorded activity in this reporting window.`;
}

function getMemberStatus(member) {
  if (
    member.active === false ||
    member.isActive === false ||
    ["inactive", "disabled", "suspended"].includes(normalizeStatus(member.status))
  ) {
    return { key: "inactive", label: normalizeStatus(member.status) === "suspended" ? "Suspended" : "Inactive" };
  }
  return { key: "active", label: "Active" };
}

function isOnline(member) {
  return ["online", "available", "active"].includes(
    normalizeStatus(member.presence?.status || member.presence?.availabilityStatus || member.availabilityStatus)
  );
}

function normalizeRole(value) {
  const role = normalizeStatus(value);
  if (role.includes("owner")) return "owner";
  if (role.includes("admin")) return "admin";
  if (role.includes("manager")) return "manager";
  if (role.includes("viewer") || role.includes("member")) return "viewer";
  if (role.includes("caller") || role.includes("sales_rep") || role.includes("telemarketer")) return "caller";
  return role || "caller";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function formatRole(role) {
  return {
    owner: "Owner",
    admin: "Admin",
    manager: "Manager",
    caller: "Caller",
    viewer: "Viewer",
  }[normalizeRole(role)] || "Member";
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateRange(from, to) {
  return from && to ? `${formatDate(from)} – ${formatDate(to)}` : "Current reporting window";
}

function formatPerformanceRange(performance) {
  if (performance.from && performance.to) {
    const from = new Date(performance.from);
    const to = new Date(performance.to);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      const days = Math.max(1, Math.round((to - from) / 86400000));
      return `${days}-day reporting window`;
    }
  }
  return "Current reporting window";
}

function formatRelativeTime(value) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  if (diff < 0) return formatDate(value);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 14 ? `${days}d ago` : formatDate(value);
}

function initials(value) {
  const parts = String(value || "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function avatarTone(value) {
  const tones = ["primary", "violet", "blue", "green", "amber"];
  const sum = String(value || "").split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return tones[sum % tones.length];
}

function safeMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice runtime")
    .replace(/Telnyx/gi, "calling provider")
    .replace(/\bSIP\b/gi, "voice connection");
}

function notify(type, title, message) {
  if (typeof window === "undefined") return;
  if (window.reachflyToast && typeof window.reachflyToast[type] === "function") {
    window.reachflyToast[type](title, message);
    return;
  }
  window.dispatchEvent(new CustomEvent("reachfly:toast", { detail: { type, title, message } }));
}

function TeamStyles() {
  return (
    <style>{`
      .rf-team-v7{
        --c:#fff;--soft:#f3f4f5;--soft2:#eceeef;--text:#191c1d;--text2:#464554;
        --muted:#767586;--line:#e3e5e7;--primary:#4648d4;--pd:#3537bb;--ps:#e8e9ff;
        --violet:#6b38d4;--vs:#f0eaff;--green:#087a51;--gs:#dff8eb;--yellow:#8a6100;
        --ys:#fff4d6;--red:#ba1a1a;--rs:#ffedeb;--ease:cubic-bezier(.2,.8,.2,1);
        width:100%;min-height:100%;padding:24px 30px 46px;color:var(--text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rftIn .26s var(--ease)
      }
      .rf-team-v7 *,.rf-team-v7 *:before,.rf-team-v7 *:after{box-sizing:border-box}
      .rf-team-v7 .spin{animation:rftSpin .8s linear infinite}
      @keyframes rftIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      @keyframes rftSpin{to{transform:rotate(360deg)}}
      @keyframes rftShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
      .rft-eyebrow{display:block;margin-bottom:4px;color:var(--primary);font-size:9px;font-weight:750;
        line-height:13px;letter-spacing:.09em;text-transform:uppercase}
      .rft-page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:18px}
      .rft-page-header h1{margin:0;font:600 32px/40px Geist,Inter,sans-serif;letter-spacing:-.02em}
      .rft-page-header p{max-width:760px;margin:3px 0 0;color:var(--text2);font-size:13px;line-height:19px}
      .rft-header-actions{display:flex;gap:8px}
      .rft-btn{min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:7px 12px;
        border:1px solid transparent;border-radius:8px;cursor:pointer;font:600 10px/15px Inter,sans-serif;transition:.14s var(--ease)}
      .rft-btn:hover:not(:disabled){transform:translateY(-1px)}.rft-btn:disabled{opacity:.45;cursor:not-allowed}
      .rft-btn.primary{color:#fff;background:var(--primary);border-color:var(--primary);box-shadow:0 5px 14px rgba(70,72,212,.17)}
      .rft-btn.primary:hover:not(:disabled){background:var(--pd)}.rft-btn.secondary{background:#fff;border-color:var(--line);color:var(--text)}
      .rft-notice{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;margin-bottom:10px;border:1px solid;border-radius:9px}
      .rft-notice>span{width:26px;height:26px;display:grid;place-items:center;flex:0 0 26px;background:#fff;border-radius:7px}
      .rft-notice>div{min-width:0;flex:1;display:grid}.rft-notice strong{font-size:9px}.rft-notice small{font-size:8px;line-height:13px}
      .rft-notice>button{align-self:center;padding:5px 8px;color:inherit;background:#fff;border:0;border-radius:6px;cursor:pointer;font-size:7px;font-weight:700}
      .rft-notice.error{color:#7d1717;background:var(--rs);border-color:#ffd0cc}.rft-notice.warning{color:#765600;background:var(--ys);border-color:#f4dda0}
      .rft-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) minmax(240px,1.15fr);gap:12px;margin-bottom:14px}
      .rft-metric,.rft-insight-card{min-height:145px;display:grid;align-content:space-between;padding:18px;border-radius:13px}
      .rft-metric{background:#fff;border:1px solid var(--line);box-shadow:0 1px 3px rgba(25,28,29,.03)}
      .rft-metric header{display:flex;align-items:center;justify-content:space-between}.rft-metric header>span{color:var(--text2);font-size:7px;font-weight:750;letter-spacing:.07em;text-transform:uppercase}
      .rft-metric header>i{width:31px;height:31px;display:grid;place-items:center;color:var(--primary);background:var(--ps);border-radius:50%;font-style:normal}
      .rft-metric>strong{margin-top:13px;font:600 26px/32px Geist,Inter,sans-serif}.rft-metric>small{color:var(--muted);font-size:7px}
      .rft-insight-card{color:#4a24ba;background:linear-gradient(135deg,#eee6ff,#e9ddff);border:1px solid #e1d2ff}
      .rft-insight-card header{display:flex;gap:6px;font-size:7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .rft-insight-card p{margin:10px 0 0;font-size:9px;line-height:15px}
      .rft-tabs-toolbar{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:13px;padding:10px 12px;margin-bottom:12px;background:var(--soft);border-radius:11px}
      .rft-tabs{display:flex;gap:5px}.rft-tabs button{min-height:36px;display:flex;align-items:center;gap:6px;padding:7px 10px;color:var(--text2);background:transparent;border:0;border-radius:999px;cursor:pointer;font-size:8px;font-weight:650}
      .rft-tabs button.active{color:#3f42bd;background:#dfe0ff}.rft-tabs button span{min-width:19px;height:19px;display:grid;place-items:center;padding:0 5px;background:#fff9;border-radius:999px;font-size:6px;font-weight:800}
      .rft-member-tools{display:flex;gap:7px}.rft-search{width:235px;height:40px;display:flex;align-items:center;gap:7px;padding:0 10px;color:var(--muted);background:#fff;border:1px solid transparent;border-radius:8px}
      .rft-search:focus-within{border-color:#4648d466;box-shadow:0 0 0 3px #4648d412}.rft-search input{min-width:0;flex:1;height:38px;padding:0;border:0;outline:0;background:transparent;font-size:9px}
      .rft-search button{width:22px;height:22px;display:grid;place-items:center;padding:0;color:var(--muted);background:transparent;border:0;cursor:pointer}
      .rft-filter{position:relative;min-width:104px;height:40px;display:flex;align-items:center;background:#fff;border-radius:8px}.rft-filter.active{color:var(--primary);background:var(--ps)}
      .rft-filter select{width:100%;height:38px;padding:0 27px 0 9px;color:inherit;background:transparent;border:0;outline:0;appearance:none;font-size:8px;font-weight:650}.rft-filter svg{position:absolute;right:8px}
      .rft-panel{min-width:0;overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:0 1px 3px rgba(25,28,29,.03)}
      .rft-table-wrap{width:100%;overflow:auto}.rft-table{width:100%;min-width:960px;border-collapse:separate;border-spacing:0;text-align:left}
      .rft-table th{padding:13px 15px;color:var(--text2);background:var(--soft2);border-bottom:1px solid var(--line);font-size:7px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
      .rft-table td{height:74px;padding:11px 15px;color:var(--text2);vertical-align:middle;font-size:8px}.rft-table tbody tr{cursor:pointer;transition:.14s var(--ease)}
      .rft-table tbody tr+tr td{border-top:1px solid #f0f1f2}.rft-table tbody tr:hover{background:#f9f9fc;box-shadow:inset 3px 0 0 #4648d459}
      .rft-table .right{text-align:right}.rft-table .number{color:var(--text);font-variant-numeric:tabular-nums;font-weight:650}
      .rft-member-id{min-width:190px;display:flex;align-items:center;gap:9px}.rft-member-id>span{position:relative;width:36px;height:36px;display:grid;place-items:center;flex:0 0 36px;color:#fff;border-radius:50%;font-size:8px;font-weight:800}
      .rft-member-id>span.primary{background:#5b5ddd}.rft-member-id>span.violet{background:#7546d9}.rft-member-id>span.blue{background:#3772b9}.rft-member-id>span.green{background:#23845f}.rft-member-id>span.amber{background:#a06e25}
      .rft-member-id>span>i{position:absolute;right:-1px;bottom:0;width:9px;height:9px;background:#14a673;border:2px solid #fff;border-radius:50%}.rft-member-id>div{min-width:0;display:grid}
      .rft-member-id strong,.rft-member-id small{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rft-member-id strong{color:var(--text);font:600 10px/14px Geist,Inter,sans-serif}.rft-member-id small{font-size:7px}
      .rft-role-select{position:relative;width:102px;height:30px;display:flex;align-items:center;color:#4c32b8;background:#f0ebff;border-radius:7px}.rft-role-select select{width:100%;height:30px;padding:0 25px 0 9px;color:inherit;background:transparent;border:0;outline:0;appearance:none;font-size:7px;font-weight:700}.rft-role-select svg{position:absolute;right:8px}
      .rft-role,.rft-status{min-height:25px;display:inline-flex;align-items:center;width:max-content;padding:5px 8px;border-radius:6px;font-size:7px;font-weight:700}
      .rft-role{color:#4d5360;background:#eceeef}.rft-role.owner{color:#383ab1;background:#e7e8ff}.rft-role.admin,.rft-role.manager{color:#5b2cc2;background:#efe8ff}
      .rft-status{gap:5px}.rft-status i{width:6px;height:6px;background:currentColor;border-radius:50%}.rft-status.active{color:var(--green);background:var(--gs)}.rft-status.inactive{color:#69717b;background:#e9edef}
      .rft-last-active{font-size:7px}.rft-panel-footer{min-height:57px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 15px;color:var(--text2);background:#fafafb;border-top:1px solid var(--line);font-size:8px}
      .rft-pagination{display:flex;align-items:center;gap:5px}.rft-pagination button{width:29px;height:29px;display:grid;place-items:center;color:var(--text2);background:#fff;border:1px solid var(--line);border-radius:6px;cursor:pointer}.rft-pagination button:disabled{opacity:.35}.rft-pagination span{font-size:7px;color:var(--muted)}
      .rft-mobile-list{display:none}.rft-performance-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 15px;background:#fbfbfc;border-bottom:1px solid var(--line)}
      .rft-performance-head h2{margin:0;font:600 14px/19px Geist,Inter,sans-serif}.rft-performance-head p,.rft-performance-head>small{margin:2px 0 0;color:var(--muted);font-size:7px}.rft-performance-head>small{max-width:330px;text-align:right}
      .rft-rate{display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;min-width:92px}.rft-rate>i{width:48px;height:6px;display:block;overflow:hidden;background:#eceeef;border-radius:999px}.rft-rate>i b{width:var(--rft-rate);height:100%;display:block;background:var(--primary);border-radius:999px}.rft-rate>strong{min-width:27px;text-align:right;font-size:7px}
      .rft-permissions{display:grid;grid-template-columns:245px minmax(0,1fr);gap:14px}.rft-role-summary,.rft-permission-matrix{background:#fff;border:1px solid var(--line);border-radius:13px;overflow:hidden}
      .rft-role-summary>header{display:flex;align-items:center;gap:8px;padding:14px;background:#fbfbfc;border-bottom:1px solid var(--line)}.rft-role-summary>header>span{width:35px;height:35px;display:grid;place-items:center;color:var(--primary);background:var(--ps);border-radius:9px}
      .rft-role-summary h2,.rft-permission-matrix h2{margin:0;font:600 12px/17px Geist,Inter,sans-serif}.rft-role-summary header p{margin:1px 0 0;color:var(--muted);font-size:6.5px}
      .rft-role-summary>article{min-height:51px;display:grid;grid-template-columns:8px minmax(0,1fr);align-items:center;gap:8px;padding:8px 14px}.rft-role-summary>article+article{border-top:1px solid #f0f1f2}
      .rft-role-summary .dot{width:7px;height:7px;border-radius:50%;background:#737987}.rft-role-summary .dot.owner{background:#4648d4}.rft-role-summary .dot.manager{background:#6b38d4}
      .rft-role-summary article>div{display:grid}.rft-role-summary article strong{font-size:8px}.rft-role-summary article small{color:var(--muted);font-size:6px}
      .rft-policy-note{display:flex;gap:7px;padding:12px;color:var(--primary);background:var(--ps);border-top:1px solid #dfe0ff}.rft-policy-note p{margin:0;color:var(--text2);font-size:6.5px;line-height:11px}
      .rft-permission-matrix>header{padding:14px 15px;background:#fbfbfc;border-bottom:1px solid var(--line)}.rft-permission-scroll{overflow:auto}.rft-permission-matrix table{width:100%;min-width:650px;border-collapse:collapse}
      .rft-permission-matrix th{padding:12px 14px;background:#f7f8f9;border-bottom:1px solid var(--line);font-size:7px;text-align:center}.rft-permission-matrix th:first-child{text-align:left}
      .rft-permission-matrix td{height:55px;padding:10px 14px;border-bottom:1px solid #f0f1f2;text-align:center;font-size:8px}.rft-permission-matrix td:first-child{text-align:left}
      .rft-permission-matrix tr.group td{height:auto;padding:8px 14px;background:#eceeef;font-weight:750}.rft-perm{width:24px;height:24px;display:grid;place-items:center;margin:auto;border-radius:50%}.rft-perm.yes{color:var(--primary)}.rft-perm.no{color:#bbbcc5;background:#f3f4f5}
      .rft-empty,.rft-access-denied{min-height:370px;display:grid;place-items:center;align-content:center;gap:6px;padding:28px;text-align:center}.rft-empty>span,.rft-access-denied>span{width:49px;height:49px;display:grid;place-items:center;color:var(--primary);background:var(--ps);border-radius:13px}
      .rft-empty h2,.rft-access-denied h1{margin:0;font:600 13px/18px Geist,Inter,sans-serif}.rft-empty p,.rft-access-denied p{max-width:470px;margin:0 0 5px;color:var(--muted);font-size:8px;line-height:13px}
      .rft-drawer-backdrop,.rft-modal-backdrop{position:fixed;z-index:260;inset:0;background:#1b1d1f47;backdrop-filter:blur(3px)}
      .rft-drawer{position:absolute;top:0;right:0;bottom:0;width:min(390px,100vw);overflow:auto;background:#fff;box-shadow:-18px 0 50px #191c1d24}
      .rft-drawer>header{position:sticky;z-index:2;top:0;display:flex;justify-content:space-between;gap:10px;padding:16px;background:#fbfbfcf5;border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
      .rft-drawer>header h2{margin:0;font:600 16px/21px Geist,Inter,sans-serif}.rft-drawer>header p{margin:2px 0 0;color:var(--muted);font-size:7px}.rft-drawer>header>button{width:31px;height:31px;display:grid;place-items:center;background:#fff;border:1px solid var(--line);border-radius:7px}
      .rft-drawer-profile{display:grid;grid-template-columns:47px minmax(0,1fr) auto;align-items:center;gap:9px;padding:15px;border-bottom:1px solid var(--line)}.rft-drawer-profile>span:first-child{width:47px;height:47px;display:grid;place-items:center;color:#fff;border-radius:50%;font-size:10px;font-weight:800}
      .rft-drawer-profile>span.primary{background:#5b5ddd}.rft-drawer-profile>span.violet{background:#7546d9}.rft-drawer-profile>span.blue{background:#3772b9}.rft-drawer-profile>span.green{background:#23845f}.rft-drawer-profile>span.amber{background:#a06e25}
      .rft-drawer-profile>div{display:grid;min-width:0}.rft-drawer-profile strong{font-size:10px}.rft-drawer-profile small{color:var(--muted);font-size:7px}
      .rft-drawer-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:12px}.rft-drawer-stats article{display:grid;gap:2px;padding:9px 7px;background:var(--soft);border-radius:8px;text-align:center}.rft-drawer-stats small{color:var(--muted);font-size:5.5px}.rft-drawer-stats strong{font-size:11px}
      .rft-drawer-section{padding:14px 15px;border-top:1px solid var(--line)}.rft-drawer-section h3{margin:0 0 9px;color:var(--text2);font-size:8px;letter-spacing:.07em;text-transform:uppercase}.rft-drawer-section dl{margin:0}
      .rft-drawer-section dl>div{display:grid;grid-template-columns:105px minmax(0,1fr);gap:9px;padding:7px 0}.rft-drawer-section dl>div+div{border-top:1px solid #f1f2f3}.rft-drawer-section dt{color:var(--muted);font-size:7px}.rft-drawer-section dd{margin:0;text-align:right;font-size:7px;font-weight:600}
      .rft-owner-lock{display:flex;gap:7px;padding:10px;color:var(--primary);background:var(--ps);border-radius:8px}.rft-owner-lock p{margin:0;color:var(--text2);font-size:7px;line-height:12px}
      .rft-access-form{display:grid;gap:11px}.rft-access-form>label:first-child{display:grid;gap:5px}.rft-access-form>label:first-child>span{font-size:7px;font-weight:650}.rft-access-form select{height:39px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:8px}
      .rft-toggle-row{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;background:var(--soft);border-radius:8px}.rft-toggle-row>span{display:grid}.rft-toggle-row strong{font-size:8px}.rft-toggle-row small{color:var(--muted);font-size:6px}
      .rft-toggle-row>button{position:relative;width:38px;height:22px;flex:0 0 38px;padding:0;background:#c8cbd0;border:0;border-radius:999px}.rft-toggle-row>button i{position:absolute;top:3px;left:3px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.15s}.rft-toggle-row>button.on{background:var(--primary)}.rft-toggle-row>button.on i{transform:translateX(16px)}
      .rft-drawer>footer{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:7px;padding:12px 15px;background:#fbfbfcf7;border-top:1px solid var(--line);backdrop-filter:blur(8px)}
      .rft-modal-backdrop{display:grid;place-items:center;padding:24px}.rft-invite-modal{width:min(940px,100%);max-height:min(720px,calc(100vh - 48px));display:grid;grid-template-columns:minmax(0,1.65fr) minmax(270px,.85fr);overflow:auto;background:#fff;border-radius:14px;box-shadow:0 24px 70px #191c1d2e}
      .rft-invite-modal>form{display:flex;flex-direction:column}.rft-invite-modal>form>header{display:flex;justify-content:space-between;gap:10px;padding:20px 22px 14px}.rft-invite-modal>form>header h2{margin:0;font:600 22px/29px Geist,Inter,sans-serif}.rft-invite-modal>form>header p{margin:3px 0 0;color:var(--text2);font-size:9px}.rft-invite-modal>form>header>button{width:31px;height:31px;display:grid;place-items:center;background:#fff;border:1px solid var(--line);border-radius:7px}
      .rft-invite-body{flex:1;display:grid;align-content:start;gap:14px;padding:12px 22px 20px}.rft-field{display:grid;gap:5px}.rft-field>span,.rft-role-cards legend{font-size:8px;font-weight:650}.rft-field>div{height:42px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid var(--line);border-radius:8px}.rft-field input{min-width:0;flex:1;height:40px;border:0;outline:0;font-size:9px}
      .rft-role-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0;margin:0;border:0}.rft-role-cards legend{grid-column:1/-1}.rft-role-cards button{min-height:108px;display:grid;align-content:start;gap:4px;padding:12px;background:#fff;border:1px solid var(--line);border-radius:8px;text-align:left}.rft-role-cards button.selected{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary);background:#fafaff}.rft-role-cards button strong{font-size:9px}.rft-role-cards button span{color:var(--text2);font-size:7px;line-height:11px}
      .rft-invite-note{display:flex;gap:7px;padding:10px;color:var(--primary);background:var(--ps);border-radius:8px}.rft-invite-note p{margin:0;color:var(--text2);font-size:7px;line-height:11px}.rft-form-error{display:flex;align-items:center;gap:6px;padding:9px 10px;color:var(--red);background:var(--rs);border-radius:7px;font-size:7px}
      .rft-invite-success{min-height:260px;display:grid;place-items:center;align-content:center;gap:6px;text-align:center}.rft-invite-success>span{width:50px;height:50px;display:grid;place-items:center;color:var(--green);background:var(--gs);border-radius:14px}.rft-invite-success h3{margin:0;font-size:14px}.rft-invite-success p{margin:0;color:var(--muted);font-size:8px}.rft-invite-success button{margin-top:6px;padding:7px 10px;color:var(--primary);background:var(--ps);border:0;border-radius:7px;font-size:7px;font-weight:700}
      .rft-invite-modal>form>footer{display:flex;justify-content:flex-end;gap:7px;padding:12px 22px 20px;border-top:1px solid var(--line)}
      .rft-invite-preview{display:grid;place-items:center;align-content:center;gap:12px;padding:24px;background:linear-gradient(145deg,#f1f2f4,#eceef0);border-left:1px solid var(--line)}.rft-invite-preview>span{font-size:7px;font-weight:750;letter-spacing:.12em;text-transform:uppercase}
      .rft-invite-preview article{width:100%;max-width:250px;padding:20px;background:#fff;border-top:3px solid var(--primary);border-radius:5px;box-shadow:0 6px 18px #191c1d17;text-align:center}.rft-invite-preview article>header span{width:48px;height:48px;display:grid;place-items:center;margin:0 auto 10px;color:#fff;background:#5a5dde;border-radius:50%}.rft-invite-preview h3{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.rft-invite-preview p{margin:8px 0 2px;color:var(--text2);font-size:7px}.rft-invite-preview article>strong{display:block;margin-bottom:13px;font-size:8px}.rft-invite-preview article>div{display:grid;gap:4px;padding:9px;background:var(--soft);border-radius:6px;text-align:left}.rft-invite-preview article>div small{color:var(--muted);font-size:6px;text-transform:uppercase}.rft-invite-preview article>div span{display:flex;gap:5px;color:var(--primary);font-size:8px;font-weight:700}
      .rft-skeleton-list>div{display:grid;grid-template-columns:2fr 1fr 1fr .8fr .8fr;align-items:center;gap:12px;min-height:74px;padding:11px 15px;border-bottom:1px solid #f0f1f2}.rft-skeleton-list i,.rft-metric-grid.loading article{display:block;background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);background-size:220% 100%;animation:rftShimmer 1.25s linear infinite}.rft-skeleton-list i{height:10px;border-radius:999px}.rft-skeleton-list i.person{height:36px;border-radius:8px}.rft-metric-grid.loading article{min-height:145px;border-radius:13px}
      @media(max-width:1260px){.rft-metric-grid{grid-template-columns:repeat(4,1fr)}.rft-insight-card{grid-column:1/-1;min-height:100px}}
      @media(max-width:1020px){.rft-metric-grid{grid-template-columns:repeat(2,1fr)}.rft-insight-card{grid-column:1/-1}.rft-tabs-toolbar{align-items:stretch;flex-direction:column}.rft-member-tools{width:100%}.rft-search{flex:1;width:auto}.rft-permissions{grid-template-columns:1fr}}
      @media(max-width:820px){.rft-page-header{align-items:flex-start;flex-direction:column}.rft-header-actions{width:100%;justify-content:flex-end}.rft-table-wrap{display:none}.rft-mobile-list{display:grid}.rft-mobile-card{width:100%;display:grid;gap:9px;padding:13px 14px;background:#fff;border:0;border-top:1px solid #f0f1f2;text-align:left}.rft-mobile-card>header{display:flex;align-items:center}.rft-mobile-card>header .rft-member-id{min-width:0;flex:1}.rft-mobile-badges{display:flex;gap:6px;padding-left:45px}.rft-mobile-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px 0 0 45px;border-top:1px solid #f0f1f2}.rft-mobile-stats span{display:grid}.rft-mobile-stats small{color:var(--muted);font-size:6px}.rft-mobile-stats strong{font-size:8px}.rft-invite-modal{grid-template-columns:1fr}.rft-invite-preview{display:none}}
      @media(max-width:650px){.rf-team-v7{padding:18px 12px 84px}.rft-page-header h1{font-size:25px;line-height:32px}.rft-page-header p{font-size:11px}.rft-metric-grid{grid-template-columns:1fr}.rft-insight-card{grid-column:auto}.rft-member-tools{display:grid;grid-template-columns:1fr 1fr}.rft-search{grid-column:1/-1;width:100%}.rft-panel-footer{align-items:flex-start;flex-direction:column}.rft-modal-backdrop{padding:0}.rft-invite-modal{width:100vw;height:100vh;max-height:none;border-radius:0}.rft-role-cards{grid-template-columns:1fr}.rft-role-cards button{min-height:82px}.rft-drawer{width:100vw}}
      @media(max-width:430px){.rft-header-actions{display:grid;grid-template-columns:1fr 1fr}.rft-drawer-stats{grid-template-columns:repeat(2,1fr)}.rft-drawer>footer{flex-direction:column-reverse}.rft-drawer>footer .rft-btn{width:100%}}
      @media(prefers-reduced-motion:reduce){.rf-team-v7,.rf-team-v7 *{animation:none!important;transition-duration:.01ms!important}}
    `}</style>
  );
}
