import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  apiRequest,
} from "../lib/workspace-platform-client.js";

import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Phone,
  RefreshCw,
  Save,
  Search,
  Settings,
  TrendingUp,
  Users,
} from "../components/icons";

const TABS = [
  {
    id: "overview",
    label: "Overview",
  },
  {
    id: "assignments",
    label: "Assignments",
  },
  {
    id: "calls",
    label: "Calls",
  },
  {
    id: "report-format",
    label: "Audit format",
  },
];

const DEFAULT_TEMPLATE = {
  name: "",
  miniInstructions: "",
  fullInstructions: "",
};

export default function SalesOperations() {
  const {
    user,
    role,
  } = useAuth();

  const [data, setData] =
    useState(null);

  const [tab, setTab] =
    useState("overview");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [template, setTemplate] =
    useState(DEFAULT_TEMPLATE);

  const [selectedAssignee, setSelectedAssignee] =
    useState("");

  const [selectedIds, setSelectedIds] =
    useState([]);

  const [query, setQuery] =
    useState("");

  const [callStatus, setCallStatus] =
    useState("");

  const currentRole =
    normalizeRole(
      role ||
        user?.workspaceRole ||
        user?.role
    );

  const canManage =
    [
      "owner",
      "admin",
      "manager",
    ].includes(
      currentRole
    );

  const load =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const value =
            await apiRequest(
              "/sales/dashboard"
            );

          setData(
            value &&
              typeof value ===
                "object"
              ? value
              : {}
          );

          setTemplate(
            normalizeTemplate(
              value?.reportTemplate
            )
          );
        } catch (
          requestError
        ) {
          setError(
            safeSalesOperationsMessage(
              requestError?.message ||
                "Sales operations could not be loaded."
            )
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  useEffect(
    () => {
      void load();

      const refreshWhenVisible =
        () => {
          if (
            document.visibilityState ===
              "visible"
          ) {
            void load({
              silent: true,
            });
          }
        };

      const timer =
        window.setInterval(
          refreshWhenVisible,
          120_000
        );

      window.addEventListener(
        "focus",
        refreshWhenVisible
      );

      return () => {
        window.clearInterval(
          timer
        );

        window.removeEventListener(
          "focus",
          refreshWhenVisible
        );
      };
    },
    [load]
  );

  useEffect(
    () => {
      if (!success) {
        return;
      }

      notifySalesOperations(
        "success",
        "Sales operations updated",
        success
      );
    },
    [success]
  );

  const calls =
    Array.isArray(
      data?.calls
    )
      ? data.calls
      : [];

  const assignments =
    Array.isArray(
      data?.assignments
    )
      ? data.assignments
      : [];

  const members =
    Array.isArray(
      data?.members
    )
      ? data.members
      : [];

  const assignedLeads =
    useMemo(
      () =>
        assignments
          .map(
            (item) =>
              item?.lead ||
              item?.leadSnapshot ||
              null
          )
          .filter(Boolean),
      [assignments]
    );

  const filteredLeads =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLowerCase();

        if (!needle) {
          return assignedLeads;
        }

        return assignedLeads.filter(
          (lead) =>
            [
              lead.business,
              lead.name,
              lead.phone,
              lead.email,
              lead.address,
              lead.category,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(
                needle
              )
        );
      },
      [
        assignedLeads,
        query,
      ]
    );

  const filteredCalls =
    useMemo(
      () =>
        calls.filter(
          (call) =>
            !callStatus ||
            normalizeStatus(
              call?.outcome ||
                call?.status
            ) ===
              callStatus
        ),
      [
        calls,
        callStatus,
      ]
    );

  const metrics =
    data?.metrics &&
    typeof data.metrics ===
      "object"
      ? data.metrics
      : {};

  async function assignSelected() {
    const leads =
      assignedLeads.filter(
        (lead) =>
          selectedIds.includes(
            leadId(lead)
          )
      );

    if (
      !selectedAssignee ||
      !leads.length ||
      !canManage
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(
        "/sales/assignments",
        {
          method: "POST",
          body: {
            assigneeId:
              selectedAssignee,
            leads,
          },
        }
      );

      setSelectedIds([]);

      setSuccess(
        `${leads.length} lead${
          leads.length === 1
            ? ""
            : "s"
        } assigned successfully.`
      );

      await load({
        silent: true,
      });
    } catch (
      requestError
    ) {
      setError(
        safeSalesOperationsMessage(
          requestError?.message ||
            "The selected leads could not be assigned."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    if (!canManage) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(
        "/sales/report-template",
        {
          method: "PUT",
          body: template,
        }
      );

      setSuccess(
        "Audit report guidance was saved for future reports."
      );

      await load({
        silent: true,
      });
    } catch (
      requestError
    ) {
      setError(
        safeSalesOperationsMessage(
          requestError?.message ||
            "The audit format could not be saved."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SalesOperationsSkeleton />
    );
  }

  return (
    <main className="rf-sales-operations-v7">
      <SalesOperationsStyles />

      <header className="rf-sales-ops-header">
        <div className="rf-sales-ops-heading">
          <span className="rf-sales-ops-icon">
            <TrendingUp
              size={18}
              aria-hidden="true"
            />
          </span>

          <div>
            <p className="rf-sales-ops-eyebrow">
              Sales operations
            </p>

            <h1>
              Calls, assignments and audit control.
            </h1>

            <p>
              One operational workspace for team activity, lead distribution and approved audit guidance.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="rf-sales-button secondary"
          onClick={() =>
            void load({
              silent: true,
            })
          }
          disabled={refreshing}
        >
          <RefreshCw
            size={13}
            className={
              refreshing
                ? "spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing…"
            : "Refresh"}
        </button>
      </header>

      {error ? (
        <div
          className="rf-sales-alert error"
          role="alert"
        >
          <AlertTriangle
            size={13}
          />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {success ? (
        <div
          className="rf-sales-alert success"
          role="status"
        >
          <CheckCircle2
            size={13}
          />

          <span>{success}</span>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <nav
        className="rf-sales-tabs"
        aria-label="Sales operations sections"
      >
        {TABS.map(
          (item) => (
            <button
              key={item.id}
              type="button"
              className={
                tab === item.id
                  ? "active"
                  : ""
              }
              onClick={() =>
                setTab(item.id)
              }
            >
              {item.label}
            </button>
          )
        )}
      </nav>

      {tab === "overview" ? (
        <>
          <section className="rf-sales-metrics">
            <Metric
              icon={Phone}
              label="Calls today"
              value={
                metrics.callsToday ||
                0
              }
              note="Outbound activity"
            />

            <Metric
              icon={CheckCircle2}
              label="Connected today"
              value={
                metrics.answeredToday ||
                0
              }
              note="Answered conversations"
            />

            <Metric
              icon={Users}
              label="Unique leads"
              value={
                metrics.uniqueLeadsContacted ||
                0
              }
              note="Leads contacted"
            />

            <Metric
              icon={CalendarCheck}
              label="Average duration"
              value={`${
                metrics.averageDurationSeconds ||
                0
              }s`}
              note="Across recorded calls"
            />
          </section>

          <section className="rf-sales-panel">
            <PanelHeading
              icon={BarChart3}
              eyebrow="Team pulse"
              title="Team performance"
              text="Current call activity from the sales dashboard."
            />

            {members.length ? (
              <div className="rf-team-grid">
                {members.map(
                  (member) => {
                    const memberCalls =
                      calls.filter(
                        (call) =>
                          String(
                            call?.callerUserId ||
                              call?.userId ||
                              ""
                          ) ===
                          String(
                            member?.id ||
                              ""
                          )
                      );

                    const connected =
                      memberCalls.filter(
                        (call) =>
                          [
                            "answered",
                            "connected",
                            "completed",
                            "qualified",
                            "meeting_booked",
                          ].includes(
                            normalizeStatus(
                              call?.outcome ||
                                call?.status
                            )
                          )
                      ).length;

                    return (
                      <article
                        key={member.id}
                      >
                        <span className="rf-team-avatar">
                          {initials(
                            member.name ||
                              member.email
                          )}
                        </span>

                        <div>
                          <b>
                            {member.name ||
                              member.email ||
                              "Team member"}
                          </b>

                          <small>
                            {formatLabel(
                              member.workspaceRole ||
                                member.role ||
                                "caller"
                            )}
                          </small>
                        </div>

                        <strong>
                          {memberCalls.length}
                          <small> calls</small>
                        </strong>

                        <em>
                          {connected} connected
                        </em>
                      </article>
                    );
                  }
                )}
              </div>
            ) : (
              <EmptyPanel
                title="No team activity yet"
                text="Team performance appears after members begin working assigned leads."
              />
            )}
          </section>
        </>
      ) : null}

      {tab === "assignments" ? (
        <section className="rf-sales-panel">
          <PanelHeading
            icon={Users}
            eyebrow="Lead distribution"
            title="Assign leads"
            text="Distribute existing leads without creating duplicate ownership."
            action={
              <span className="rf-sales-count">
                {selectedIds.length} selected
              </span>
            }
          />

          <div className="rf-assignment-controls">
            <label>
              <span>Caller</span>

              <select
                value={
                  selectedAssignee
                }
                onChange={(event) =>
                  setSelectedAssignee(
                    event.target.value
                  )
                }
                disabled={!canManage}
              >
                <option value="">
                  Choose caller
                </option>

                {members.map(
                  (member) => (
                    <option
                      key={member.id}
                      value={member.id}
                    >
                      {member.name ||
                        member.email}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>Find lead</span>

              <div className="rf-search-field">
                <Search
                  size={13}
                />

                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value
                    )
                  }
                  placeholder="Search business, phone, email or market"
                />
              </div>
            </label>

            <button
              type="button"
              className="rf-sales-button"
              onClick={() =>
                void assignSelected()
              }
              disabled={
                !canManage ||
                saving ||
                !selectedAssignee ||
                !selectedIds.length
              }
            >
              <Users size={13} />
              {saving
                ? "Assigning…"
                : "Assign selected"}
            </button>
          </div>

          {!canManage ? (
            <p className="rf-sales-permission-note">
              Assignment controls are available to workspace owners, admins and managers.
            </p>
          ) : null}

          {filteredLeads.length ? (
            <div className="rf-assignment-list">
              {filteredLeads.map(
                (lead) => {
                  const id =
                    leadId(lead);

                  return (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.includes(
                            id
                          )
                        }
                        onChange={() =>
                          setSelectedIds(
                            (current) =>
                              current.includes(
                                id
                              )
                                ? current.filter(
                                    (value) =>
                                      value !== id
                                  )
                                : [
                                    ...current,
                                    id,
                                  ]
                          )
                        }
                        disabled={!canManage}
                      />

                      <span>
                        <b>
                          {lead.business ||
                            lead.name ||
                            "Unnamed business"}
                        </b>

                        <small>
                          {[
                            lead.phone,
                            lead.address,
                            lead.category,
                          ]
                            .filter(Boolean)
                            .join(" · ") ||
                            "No additional lead details"}
                        </small>
                      </span>
                    </label>
                  );
                }
              )}
            </div>
          ) : (
            <EmptyPanel
              title="No matching leads"
              text="Adjust the search or refresh the sales dashboard."
            />
          )}
        </section>
      ) : null}

      {tab === "calls" ? (
        <section className="rf-sales-panel">
          <PanelHeading
            icon={Phone}
            eyebrow="Calling"
            title="Call activity"
            text="Recent workspace call records and outcomes."
            action={
              <select
                className="rf-call-filter"
                value={callStatus}
                onChange={(event) =>
                  setCallStatus(
                    event.target.value
                  )
                }
              >
                <option value="">
                  All outcomes
                </option>
                <option value="connected">
                  Connected
                </option>
                <option value="meeting_booked">
                  Meeting booked
                </option>
                <option value="qualified">
                  Qualified
                </option>
                <option value="no_answer">
                  No answer
                </option>
                <option value="not_interested">
                  Not interested
                </option>
              </select>
            }
          />

          {filteredCalls.length ? (
            <div className="rf-call-table-wrap">
              <div className="rf-call-table">
                <div className="rf-call-row head">
                  <span>Lead</span>
                  <span>Caller</span>
                  <span>Status</span>
                  <span>Outcome</span>
                  <span>Started</span>
                </div>

                {filteredCalls.map(
                  (call, index) => (
                    <div
                      className="rf-call-row"
                      key={
                        call.id ||
                        call.callId ||
                        index
                      }
                    >
                      <span>
                        <b>
                          {call.lead?.business ||
                            call.lead?.name ||
                            call.businessName ||
                            "Business lead"}
                        </b>

                        <small>
                          {call.destinationNumber ||
                            call.toNumber ||
                            "No number"}
                        </small>
                      </span>

                      <span>
                        {memberName(
                          members,
                          call.callerUserId ||
                            call.userId
                        )}
                      </span>

                      <StatusPill
                        value={
                          call.status ||
                          "completed"
                        }
                      />

                      <span>
                        {formatLabel(
                          call.outcome ||
                            "not_recorded"
                        )}
                      </span>

                      <span>
                        {formatDateTime(
                          call.startedAt ||
                            call.createdAt
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <EmptyPanel
              title="No matching calls"
              text="Call records appear here after workspace calls are made."
            />
          )}
        </section>
      ) : null}

      {tab === "report-format" ? (
        <section className="rf-sales-panel">
          <PanelHeading
            icon={Settings}
            eyebrow="Audit guidance"
            title="Audit report format"
            text="The Mini Audit structure remains fixed. Workspace instructions refine wording and full-report presentation for future generations."
          />

          <div className="rf-template-editor">
            <label>
              <span>Template name</span>

              <input
                value={
                  template.name ||
                  ""
                }
                onChange={(event) =>
                  setTemplate(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    })
                  )
                }
                disabled={!canManage}
              />
            </label>

            <label>
              <span>Mini Audit instructions</span>

              <textarea
                value={
                  template.miniInstructions ||
                  ""
                }
                onChange={(event) =>
                  setTemplate(
                    (current) => ({
                      ...current,
                      miniInstructions:
                        event.target.value,
                    })
                  )
                }
                disabled={!canManage}
              />
            </label>

            <label>
              <span>Full audit instructions</span>

              <textarea
                value={
                  template.fullInstructions ||
                  ""
                }
                onChange={(event) =>
                  setTemplate(
                    (current) => ({
                      ...current,
                      fullInstructions:
                        event.target.value,
                    })
                  )
                }
                disabled={!canManage}
              />
            </label>

            <div className="rf-template-footer">
              {!canManage ? (
                <span>
                  Owners, admins and managers can change audit guidance.
                </span>
              ) : (
                <span>
                  Changes apply to future generated reports; completed reports remain unchanged.
                </span>
              )}

              <button
                type="button"
                className="rf-sales-button"
                onClick={() =>
                  void saveTemplate()
                }
                disabled={
                  !canManage ||
                  saving
                }
              >
                <Save size={13} />
                {saving
                  ? "Saving…"
                  : "Save audit format"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
}) {
  return (
    <article className="rf-sales-metric">
      <span>
        <Icon
          size={15}
          aria-hidden="true"
        />
      </span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </article>
  );
}

function PanelHeading({
  icon: Icon,
  eyebrow,
  title,
  text,
  action = null,
}) {
  return (
    <header className="rf-sales-panel-heading">
      <div className="rf-sales-panel-title">
        <span>
          <Icon
            size={14}
            aria-hidden="true"
          />
        </span>

        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
      </div>

      {action}
    </header>
  );
}

function StatusPill({ value }) {
  const status =
    normalizeStatus(value);

  const tone =
    [
      "connected",
      "answered",
      "completed",
      "qualified",
      "meeting_booked",
    ].includes(status)
      ? "green"
      : [
          "failed",
          "not_interested",
          "wrong_number",
        ].includes(status)
        ? "red"
        : [
            "ringing",
            "queued",
            "callback",
          ].includes(status)
          ? "amber"
          : "gray";

  return (
    <span
      className={`rf-status-pill ${tone}`}
    >
      {formatLabel(value)}
    </span>
  );
}

function EmptyPanel({
  title,
  text,
}) {
  return (
    <div className="rf-sales-empty">
      <BarChart3 size={18} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function SalesOperationsSkeleton() {
  return (
    <main className="rf-sales-operations-v7 skeleton">
      <SalesOperationsStyles />
      <div className="rf-sales-skeleton-header" />
      <div className="rf-sales-skeleton-tabs" />
      <div className="rf-sales-skeleton-grid">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="rf-sales-skeleton-panel" />
    </main>
  );
}

function normalizeTemplate(value) {
  const source =
    value &&
    typeof value === "object"
      ? value
      : {};

  return {
    ...DEFAULT_TEMPLATE,
    ...source,
  };
}

function leadId(lead) {
  return String(
    lead?.id ||
      lead?.placeId ||
      lead?.phone ||
      lead?.email ||
      `${lead?.business || lead?.name || "lead"}-${lead?.address || ""}`
  );
}

function memberName(
  members,
  memberId
) {
  const member =
    members.find(
      (item) =>
        String(item?.id || "") ===
        String(memberId || "")
    );

  return (
    member?.name ||
    member?.email ||
    memberId ||
    "Unknown caller"
  );
}

function normalizeRole(value) {
  const role =
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

  if (role.includes("owner")) {
    return "owner";
  }

  if (role.includes("admin")) {
    return "admin";
  }

  if (role.includes("manager")) {
    return "manager";
  }

  return role || "caller";
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function initials(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0)
    )
    .join("")
    .toUpperCase() || "RF";
}

function safeSalesOperationsMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function notifySalesOperations(
  type,
  title,
  message
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const bridge =
    window.reachflyToast;

  if (
    bridge &&
    typeof bridge[type] ===
      "function"
  ) {
    bridge[type](
      title,
      message
    );
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      "reachfly:toast",
      {
        detail: {
          type,
          title,
          message,
        },
      }
    )
  );
}

function SalesOperationsStyles() {
  return (
    <style>{`
      .rf-sales-operations-v7{
        --rfso-text:#191c1d;
        --rfso-text2:#4d4c59;
        --rfso-muted:#777784;
        --rfso-line:#e2e4e7;
        --rfso-primary:#4648d4;
        --rfso-primary-dark:#393bbb;
        --rfso-primary-soft:#e8e9ff;
        --rfso-green:#087a51;
        --rfso-green-soft:#e4f7ee;
        --rfso-red:#ba1a1a;
        --rfso-red-soft:#ffedeb;
        --rfso-amber:#965900;
        --rfso-amber-soft:#fff3d8;
        --rfso-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfso-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-sales-operations-v7 *,
      .rf-sales-operations-v7 *::before,
      .rf-sales-operations-v7 *::after{box-sizing:border-box}

      @keyframes rfsoSpin{to{transform:rotate(360deg)}}
      @keyframes rfsoShimmer{from{background-position:200% 0}to{background-position:-200% 0}}

      .rf-sales-operations-v7 .spin{animation:rfsoSpin .75s linear infinite}

      .rf-sales-ops-header{
        min-height:140px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        padding:18px;
        margin-bottom:10px;
        color:#fff;
        background:
          radial-gradient(circle at 88% 14%,rgba(86,89,223,.26),transparent 32%),
          radial-gradient(circle at 14% 92%,rgba(107,56,212,.15),transparent 30%),
          #2e3132;
        border-radius:14px;
      }

      .rf-sales-ops-heading{
        min-width:0;
        display:grid;
        grid-template-columns:44px minmax(0,1fr);
        align-items:center;
        gap:10px;
      }

      .rf-sales-ops-icon{
        width:44px;
        height:44px;
        display:grid;
        place-items:center;
        color:#fff;
        background:rgba(255,255,255,.1);
        border:1px solid rgba(255,255,255,.11);
        border-radius:11px;
      }

      .rf-sales-ops-eyebrow{
        margin:0 0 3px;
        color:#c9caff;
        font-size:5.8px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-sales-ops-heading h1{
        margin:0;
        color:#fff;
        font:600 28px/35px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rf-sales-ops-heading p:last-child{
        max-width:760px;
        margin:4px 0 0;
        color:rgba(244,246,247,.62);
        font-size:7px;
        line-height:12px;
      }

      .rf-sales-button{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        color:#fff;
        background:var(--rfso-primary);
        border:1px solid var(--rfso-primary);
        border-radius:8px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
      }

      .rf-sales-button.secondary{
        color:#fff;
        background:rgba(255,255,255,.08);
        border-color:rgba(255,255,255,.12);
      }

      .rf-sales-button:disabled{opacity:.43;cursor:not-allowed}

      .rf-sales-alert{
        display:grid;
        grid-template-columns:18px minmax(0,1fr) auto;
        align-items:center;
        gap:7px;
        padding:9px 10px;
        margin-bottom:9px;
        border:1px solid;
        border-radius:8px;
        font-size:6px;
        line-height:10px;
      }

      .rf-sales-alert.error{color:#7c1d1d;background:var(--rfso-red-soft);border-color:#ffd0cc}
      .rf-sales-alert.success{color:#086846;background:var(--rfso-green-soft);border-color:#caeadb}
      .rf-sales-alert button{min-height:26px;padding:4px 6px;color:inherit;background:#fff;border:1px solid currentColor;border-radius:6px;cursor:pointer;font-size:5px}

      .rf-sales-tabs{
        position:sticky;
        z-index:20;
        top:64px;
        display:flex;
        gap:4px;
        overflow-x:auto;
        padding:5px;
        margin-bottom:10px;
        background:rgba(255,255,255,.95);
        border:1px solid var(--rfso-line);
        border-radius:10px;
        backdrop-filter:blur(12px);
        scrollbar-width:none;
      }

      .rf-sales-tabs::-webkit-scrollbar{display:none}
      .rf-sales-tabs button{min-height:34px;flex:0 0 auto;padding:6px 8px;color:var(--rfso-text2);background:transparent;border:0;border-radius:7px;cursor:pointer;font-size:5.8px;font-weight:750}
      .rf-sales-tabs button.active{color:var(--rfso-primary);background:var(--rfso-primary-soft)}

      .rf-sales-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}
      .rf-sales-metric{min-height:112px;display:grid;grid-template-columns:34px minmax(0,1fr);align-content:end;gap:8px;padding:11px;background:#fff;border:1px solid var(--rfso-line);border-radius:10px}
      .rf-sales-metric > span{width:34px;height:34px;display:grid;place-items:center;align-self:end;color:var(--rfso-primary);background:var(--rfso-primary-soft);border-radius:8px}
      .rf-sales-metric > div{display:grid;align-content:end;min-width:0}
      .rf-sales-metric small{color:var(--rfso-muted);font-size:5px}
      .rf-sales-metric strong{margin-top:2px;font:600 17px/22px Geist,Inter,sans-serif}
      .rf-sales-metric p{margin:1px 0 0;color:var(--rfso-muted);font-size:4.9px}

      .rf-sales-panel{padding:13px;margin-bottom:10px;background:#fff;border:1px solid var(--rfso-line);border-radius:11px;box-shadow:0 1px 3px rgba(25,28,29,.025)}
      .rf-sales-panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-height:55px;padding-bottom:9px;margin-bottom:9px;border-bottom:1px solid #eff0f1}
      .rf-sales-panel-title{min-width:0;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:8px}
      .rf-sales-panel-title > span{width:34px;height:34px;display:grid;place-items:center;color:var(--rfso-primary);background:var(--rfso-primary-soft);border-radius:8px}
      .rf-sales-panel-title small{color:var(--rfso-primary);font-size:5px;font-weight:800;text-transform:uppercase}
      .rf-sales-panel-title h2{margin:1px 0 0;font:600 13px/18px Geist,Inter,sans-serif}
      .rf-sales-panel-title p{margin:2px 0 0;color:var(--rfso-muted);font-size:5.6px;line-height:9px}
      .rf-sales-count{padding:5px 7px;color:#57587a;background:var(--rfso-primary-soft);border-radius:999px;font-size:5px;font-weight:750}

      .rf-team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .rf-team-grid article{min-width:0;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:7px;padding:9px;background:#f7f8f9;border-radius:8px}
      .rf-team-avatar{width:34px;height:34px;display:grid;place-items:center;color:#fff;background:var(--rfso-primary);border-radius:8px;font-size:5.8px;font-weight:800}
      .rf-team-grid article > div{min-width:0;display:grid}
      .rf-team-grid b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:5.8px}
      .rf-team-grid small{margin-top:2px;color:var(--rfso-muted);font-size:4.8px}
      .rf-team-grid strong{font-size:6.5px;white-space:nowrap}
      .rf-team-grid em{grid-column:2/-1;color:var(--rfso-green);font-size:4.9px;font-style:normal}

      .rf-assignment-controls{display:grid;grid-template-columns:200px minmax(220px,1fr) auto;align-items:end;gap:7px;margin-bottom:8px}
      .rf-assignment-controls label,.rf-template-editor label{display:grid;gap:4px}
      .rf-assignment-controls label > span,.rf-template-editor label > span{color:var(--rfso-muted);font-size:5.2px;font-weight:750;text-transform:uppercase}
      .rf-sales-operations-v7 input,.rf-sales-operations-v7 select,.rf-sales-operations-v7 textarea{width:100%;min-height:38px;padding:8px 9px;color:var(--rfso-text);background:#f7f8f9;border:1px solid transparent;border-radius:8px;outline:0;font:400 6px/10px Inter,sans-serif}
      .rf-sales-operations-v7 textarea{min-height:100px;resize:vertical}
      .rf-sales-operations-v7 input:focus,.rf-sales-operations-v7 select:focus,.rf-sales-operations-v7 textarea:focus{background:#fff;border-color:rgba(70,72,212,.5);box-shadow:0 0 0 3px rgba(70,72,212,.06)}
      .rf-search-field{display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:5px;padding:0 8px;background:#f7f8f9;border:1px solid transparent;border-radius:8px}
      .rf-search-field input{padding-left:0;background:transparent}
      .rf-search-field svg{color:var(--rfso-primary)}
      .rf-sales-permission-note{margin:0 0 8px;padding:8px 9px;color:#626370;background:#f7f8f9;border-radius:7px;font-size:5.4px}

      .rf-assignment-list{display:grid;grid-template-columns:1fr 1fr;gap:5px}
      .rf-assignment-list > label{min-width:0;min-height:56px;display:grid;grid-template-columns:15px minmax(0,1fr);align-items:center;gap:7px;padding:8px;background:#f7f8f9;border-radius:8px;cursor:pointer}
      .rf-assignment-list input{width:15px;height:15px;min-height:0;padding:0;accent-color:var(--rfso-primary)}
      .rf-assignment-list label > span{min-width:0;display:grid}
      .rf-assignment-list b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:5.8px}
      .rf-assignment-list small{margin-top:2px;overflow:hidden;color:var(--rfso-muted);text-overflow:ellipsis;white-space:nowrap;font-size:4.9px}

      .rf-call-filter{width:150px!important;min-height:32px!important;padding:5px 7px!important}
      .rf-call-table-wrap{overflow-x:auto;border:1px solid var(--rfso-line);border-radius:8px}
      .rf-call-table{min-width:800px}
      .rf-call-row{min-height:52px;display:grid;grid-template-columns:minmax(200px,1fr) 150px 110px 130px 150px;align-items:center;gap:7px;padding:8px;border-bottom:1px solid #eff0f1;font-size:5.6px}
      .rf-call-row.head{min-height:38px;color:#676873;background:#f7f8f9;font-size:5px;font-weight:800;text-transform:uppercase}
      .rf-call-row > span:first-child{min-width:0;display:grid}
      .rf-call-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:5.8px}
      .rf-call-row small{margin-top:2px;color:var(--rfso-muted);font-size:4.8px}
      .rf-status-pill{width:max-content;padding:4px 6px;border-radius:999px;font-size:4.7px;font-weight:750}
      .rf-status-pill.green{color:var(--rfso-green);background:var(--rfso-green-soft)}
      .rf-status-pill.red{color:var(--rfso-red);background:var(--rfso-red-soft)}
      .rf-status-pill.amber{color:#825400;background:var(--rfso-amber-soft)}
      .rf-status-pill.gray{color:#666873;background:#f0f1f2}

      .rf-template-editor{display:grid;gap:8px}
      .rf-template-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:9px;border-top:1px solid #eff0f1}
      .rf-template-footer > span{max-width:580px;color:var(--rfso-muted);font-size:5.4px;line-height:9px}

      .rf-sales-empty{min-height:160px;display:grid;place-items:center;align-content:center;gap:5px;padding:20px;color:var(--rfso-muted);background:#f8f9fa;border:1px dashed #d8dade;border-radius:8px;text-align:center}
      .rf-sales-empty svg{color:var(--rfso-primary)}
      .rf-sales-empty strong{color:var(--rfso-text);font-size:6.3px}
      .rf-sales-empty p{max-width:390px;margin:0;font-size:5.3px;line-height:9px}

      .rf-sales-skeleton-header,.rf-sales-skeleton-tabs,.rf-sales-skeleton-grid i,.rf-sales-skeleton-panel{background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);background-size:220% 100%;animation:rfsoShimmer 1.15s linear infinite}
      .rf-sales-skeleton-header{height:140px;margin-bottom:10px;border-radius:14px}
      .rf-sales-skeleton-tabs{height:46px;margin-bottom:10px;border-radius:10px}
      .rf-sales-skeleton-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
      .rf-sales-skeleton-grid i{height:112px;border-radius:10px}
      .rf-sales-skeleton-panel{height:280px;border-radius:11px}

      @media(max-width:1050px){
        .rf-sales-operations-v7{padding:22px}
        .rf-sales-metrics{grid-template-columns:1fr 1fr}
        .rf-team-grid{grid-template-columns:1fr 1fr}
        .rf-assignment-controls{grid-template-columns:1fr 1fr}
        .rf-assignment-controls .rf-sales-button{grid-column:1/-1}
      }

      @media(max-width:700px){
        .rf-sales-ops-header{align-items:flex-start;flex-direction:column}
        .rf-assignment-list{grid-template-columns:1fr}
        .rf-template-footer{align-items:stretch;flex-direction:column}
      }

      @media(max-width:620px){
        .rf-sales-operations-v7{padding:18px 12px 80px}
        .rf-sales-ops-header{padding:15px}
        .rf-sales-ops-heading{grid-template-columns:1fr}
        .rf-sales-ops-heading h1{font-size:23px;line-height:30px}
        .rf-sales-ops-header .rf-sales-button{width:100%}
        .rf-sales-tabs{top:61px;margin-left:-12px;margin-right:-12px;border-left:0;border-right:0;border-radius:0}
        .rf-sales-metrics,.rf-team-grid,.rf-assignment-controls{grid-template-columns:1fr}
        .rf-sales-skeleton-grid{grid-template-columns:1fr 1fr}
      }

      @media(max-width:420px){.rf-sales-metrics,.rf-sales-skeleton-grid{grid-template-columns:1fr}}

      @media(prefers-reduced-motion:reduce){
        .rf-sales-operations-v7,.rf-sales-operations-v7 *, .rf-sales-operations-v7 *::before,.rf-sales-operations-v7 *::after{animation:none!important;transition-duration:.01ms!important}
      }
    `}</style>
  );
}
