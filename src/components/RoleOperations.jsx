import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import {
  getRoleDashboard,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";
import TeamCommunication from "./TeamCommunication";
import "../styles.css";

const DEFAULT_CONFIG = {
  enabled: true,
  leadsPerCaller: 100,
  assignmentTime: "00:00",
  timezone: "Asia/Karachi",
  selectedCallerIds: [],
  niches: [
    "clinics",
    "dentists",
    "restaurants",
    "law firms",
    "real estate agencies",
  ],
  locations: [
    "California",
    "Texas",
    "Florida",
    "New York",
  ],
  regionCode: "US",
  radiusKm: 50,
  qualityLevel: "balanced",
  autoMiniAudit: true,
  uniquePerDay: true,
  keepUnfinishedWork: true,
};

const EMPTY_DIALER = {
  name: "",
  provider: "telnyx",
  applicationId: "",
  apiKey: "",
  connectionId: "",
  fromNumber: "",
  webhookBaseUrl: "",
  privateKeyEnvName: "TELNYX_API_KEY",
  assignedUserIds: [],
};

const EMPTY_SENDER = {
  name: "",
  provider: "smtp",
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  fromName: "",
  fromEmail: "",
  replyTo: "",
  assignedUserIds: [],
};

export default function RoleOperations() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const refreshTimerRef = useRef(null);

  const role = normalizeRole(
    user?.workspaceRole ||
      user?.role ||
      "caller"
  );

  const isOwner = role === "owner";
  const canManage =
    ["owner", "admin", "manager"].includes(role);

  const defaultTab = isOwner
    ? "owner"
    : canManage
      ? "daily-work"
      : "my-work";

  const [tab, setTab] = useState(defaultTab);

  const [dashboard, setDashboard] =
    useState(null);
  const [team, setTeam] = useState([]);
  const [dialers, setDialers] = useState([]);
  const [senders, setSenders] = useState([]);
  const [dailyStatus, setDailyStatus] =
    useState(null);
  const [dailyConfig, setDailyConfig] =
    useState(DEFAULT_CONFIG);
  const [dialer, setDialer] =
    useState(EMPTY_DIALER);
  const [sender, setSender] =
    useState(EMPTY_SENDER);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] =
    useState(true);

  const callers = useMemo(
    () =>
      team.filter(
        (member) =>
          (
            member.workspaceRole ||
            member.role
          ) === "caller"
      ),
    [team]
  );

  const load = useCallback(
    async ({
      silent = false,
    } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      setError("");

      try {
        /*
         * getRoleDashboard() is the supported role-aware dashboard contract.
         * Keep Team Operations on this shared client contract so older frontend
         * API bundles cannot crash the page when an optional helper is missing.
         */
        const roleDashboard =
          await getRoleDashboard();

        const optionalRequests = [
          loadOptionalApi("dialers"),
          loadOptionalApi("senders"),
          canManage
            ? loadOptionalApi("team")
            : Promise.resolve(
                optionalSuccess(null)
              ),
          canManage
            ? loadOptionalApi(
                "dailyLeadStatus"
              )
            : Promise.resolve(
                optionalSuccess(null)
              ),
          isOwner
            ? loadOptionalApi(
                "ownerOverview"
              )
            : Promise.resolve(
                optionalSuccess(null)
              ),
        ];

        const [
          dialerResult,
          senderResult,
          teamResult,
          automationResult,
          ownerResult,
        ] = await Promise.all(
          optionalRequests
        );

        const normalizedDashboard =
          normalizeOperationsDashboard(
            roleDashboard
          );

        const resolvedTeam =
          normalizeTeamMembers(
            teamResult.data?.members ||
              normalizedDashboard.members ||
              normalizedDashboard.team ||
              []
          );

        setDashboard({
          ...normalizedDashboard,
          ...(ownerResult.data
            ? {
                owner:
                  ownerResult.data,
              }
            : {}),
        });

        setDialers(
          Array.isArray(
            dialerResult.data?.dialers
          )
            ? dialerResult.data.dialers
            : []
        );

        setSenders(
          Array.isArray(
            senderResult.data?.senders
          )
            ? senderResult.data.senders
            : []
        );

        setTeam(resolvedTeam);

        if (canManage) {
          setDailyStatus(
            automationResult.data ||
              null
          );

          setDailyConfig({
            ...DEFAULT_CONFIG,
            ...(automationResult.data
              ?.config || {}),
          });
        }

        const optionalErrors = [
          dialerResult,
          senderResult,
          teamResult,
          automationResult,
          ownerResult,
        ]
          .filter(
            (result) =>
              !result.ok &&
              result.message
          )
          .map(
            (result) =>
              result.message
          );

        setWarning(
          optionalErrors.length
            ? `Some optional workspace resources could not be refreshed: ${optionalErrors.join(
                " · "
              )}`
            : ""
        );
      } catch (loadError) {
        setError(
          loadError?.message ||
            "Could not load workspace operations."
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [canManage, isOwner]
  );

  useEffect(() => {
    void load();

    // Slow fallback refresh avoids the previous 429 request storm.
    const timer = window.setInterval(
      () => {
        void load({
          silent: true,
        });
      },
      60_000
    );

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(
        refreshTimerRef.current
      );
    };
  }, [load]);

  useEffect(() => {
    const refreshSoon = () => {
      window.clearTimeout(
        refreshTimerRef.current
      );

      refreshTimerRef.current =
        window.setTimeout(() => {
          void load({
            silent: true,
          });
        }, 400);
    };

    const events = [
      "lead:updated",
      "lead:assigned",
      "task:created",
      "task:updated",
      "task:completed",
      "attendance:checked-in",
      "attendance:checked-out",
      "attendance:reviewed",
      "profile:updated",
      "profile:availability-updated",
      "presence:update",
      "message:new",
      "webrtc:call:ended",
      "telnyx-ai-agent:call-updated",
      "telnyx-ai-agent:meeting-booked",
    ];

    const unsubscribers =
      events.map((eventName) =>
        onWorkspaceSocket(
          eventName,
          refreshSoon
        )
      );

    return () => {
      window.clearTimeout(
        refreshTimerRef.current
      );

      unsubscribers.forEach(
        (unsubscribe) =>
          unsubscribe?.()
      );
    };
  }, [load]);

  const tabs = useMemo(() => {
    if (!canManage) {
      return [
        ["my-work", "My work"],
        ["tasks", "My tasks"],
        ["callbacks", "Callbacks"],
        [
          "communication",
          "Team communication",
        ],
        ["calls", "My calls"],
      ];
    }

    const rows = [
      [
        "daily-work",
        "Daily lead schedule",
      ],
      ["team", "Caller setup"],
      ["assignments", "Assignments"],
      ["tasks", "Tasks"],
      ["callbacks", "Callbacks"],
      ["dialers", "Calling resources"],
      ["senders", "Sender IDs"],
      [
        "communication",
        "Team communication",
      ],
      ["calls", "Calls"],
    ];

    if (isOwner) {
      rows.unshift([
        "owner",
        "Owner overview",
      ]);
    }

    return rows;
  }, [canManage, isOwner]);

  useEffect(() => {
    const requested =
      String(
        searchParams.get("tab") ||
          ""
      ).trim();

    const allowed = new Set(
      tabs.map(([id]) => id)
    );

    if (
      requested &&
      allowed.has(requested) &&
      requested !== tab
    ) {
      setTab(requested);
      return;
    }

    if (!allowed.has(tab)) {
      setTab(defaultTab);
    }
  }, [
    defaultTab,
    searchParams,
    tab,
    tabs,
  ]);

  function selectTab(id) {
    setTab(id);

    const next =
      new URLSearchParams(
        searchParams
      );

    next.set("tab", id);
    setSearchParams(next, {
      replace: true,
    });
  }

  async function saveDailySchedule() {
    try {
      setBusy(true);
      setError("");
      setMessage("");

      const response =
        await invokeRequiredApi(
          "saveDailyLeadConfig",
          dailyConfig
        );

      setDailyConfig(
        response?.config ||
          dailyConfig
      );

      const successMessage =
        `Daily work schedule saved. Next run: ${formatDateTime(
          response?.nextRunAt
        )}.`;

      setMessage(
        successMessage
      );

      notifyRoleOperations(
        "success",
        "Daily schedule saved",
        successMessage
      );

      await load({
        silent: true,
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    try {
      setBusy(true);
      setError("");
      setMessage(
        "Daily allocation started. Existing real leads will be used first."
      );

      const response =
        await invokeRequiredApi(
          "runDailyLeadAutomation",
          { force: true }
        );

      const successMessage =
        `Allocation completed: ${
          response?.run?.assignedCount ||
          0
        } new assignments.`;

      setMessage(
        successMessage
      );

      notifyRoleOperations(
        "success",
        "Daily allocation completed",
        successMessage
      );

      await load({
        silent: true,
      });
    } catch (runError) {
      setError(runError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMember(
    member,
    patch
  ) {
    try {
      setBusy(true);
      setError("");

      await invokeRequiredApi(
        "updateTeamMember",
        member.id,
        patch
      );

      notifyRoleOperations(
        "success",
        "Caller setup updated",
        `${member.name || member.email || "Caller"} was updated.`
      );

      await load({
        silent: true,
      });
    } catch (memberError) {
      setError(
        memberError.message
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveDialer() {
    try {
      setBusy(true);
      setError("");
      setMessage("");

      await invokeRequiredApi(
        "saveDialer",
        dialer
      );

      setDialer(EMPTY_DIALER);
      const successMessage =
        "Calling connection saved and ready to assign to callers.";

      setMessage(
        successMessage
      );

      notifyRoleOperations(
        "success",
        "Calling connection saved",
        successMessage
      );

      await load({
        silent: true,
      });
    } catch (dialerError) {
      setError(
        dialerError.message
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSender() {
    try {
      setBusy(true);
      setError("");
      setMessage("");

      await invokeRequiredApi(
        "saveSender",
        sender
      );

      setSender(EMPTY_SENDER);
      const successMessage =
        "Sender identity saved and ready to assign.";

      setMessage(
        successMessage
      );

      notifyRoleOperations(
        "success",
        "Sender identity saved",
        successMessage
      );

      await load({
        silent: true,
      });
    } catch (senderError) {
      setError(
        senderError.message
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleCaller(
    callerId
  ) {
    setDailyConfig(
      (current) => {
        const selected =
          current
            .selectedCallerIds ||
          [];

        return {
          ...current,
          selectedCallerIds:
            selected.includes(
              callerId
            )
              ? selected.filter(
                  (id) =>
                    id !==
                    callerId
                )
              : [
                  ...selected,
                  callerId,
                ],
        };
      }
    );
  }

  const assignments =
    normalizeAssignments(
      dashboard?.assignments ||
        dashboard?.assignedLeads ||
        []
    );

  const tasks = sortTasks(
    dashboard?.tasks || []
  );

  const callbacks =
    normalizeCallbacks(
      dashboard?.upcomingCallbacks ||
        dashboard?.callbacks ||
        []
    );

  const calls =
    normalizeCalls(
      dashboard?.calls ||
        dashboard?.recentCalls ||
        []
    );

  return (
    <div className="role-ops-page rf-role-operations-v7">
      <RoleOperationsV7Styles />
      <header className="role-ops-hero">
        <div>
          <span>
            Workspace operations
          </span>

          <h1>
            {isOwner
              ? "Owner operations"
              : canManage
                ? "Team operations"
                : "My daily workspace"}
          </h1>

          <p>
            Coordinate daily lead delivery, assignments, tasks, callbacks, calling resources, team communication, and sales performance from one workspace.
          </p>
        </div>

        <div className="role-ops-hero__actions">
          {canManage ? (
            <>
              <Link
                className="btn light"
                to="/app/sales-operations"
              >
                Sales operations
              </Link>

              <Link
                className="btn light"
                to="/app/team-performance"
              >
                Team performance
              </Link>
            </>
          ) : null}

          <button
            className="btn primary"
            type="button"
            onClick={() => load()}
            disabled={loading}
          >
            {loading
              ? "Refreshing…"
              : "Refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="role-error">
          {safeOperationsMessage(error)}
        </div>
      ) : null}

      {warning ? (
        <div className="role-warning">
          {safeOperationsMessage(warning)}
        </div>
      ) : null}

      {message ? (
        <div className="role-success">
          {message}
        </div>
      ) : null}

      <nav className="role-tabs">
        {tabs.map(
          ([id, label]) => (
            <button
              key={id}
              type="button"
              className={
                tab === id
                  ? "active"
                  : ""
              }
              onClick={() =>
                selectTab(id)
              }
            >
              {label}
            </button>
          )
        )}
      </nav>

      {tab === "daily-work" ? (
        <DailySchedulePanel
          config={dailyConfig}
          setConfig={
            setDailyConfig
          }
          callers={callers}
          toggleCaller={
            toggleCaller
          }
          status={
            dailyStatus
          }
          busy={busy}
          onSave={
            saveDailySchedule
          }
          onRunNow={runNow}
        />
      ) : null}

      {tab === "owner" ? (
        <section className="role-stack">
          <div className="metric-grid">
            <Metric
              label="Team members"
              value={
                dashboard?.owner
                  ?.totals
                  ?.members ??
                dashboard?.summary
                  ?.teamMembers ??
                dashboard?.members
                  ?.length ??
                0
              }
            />

            <Metric
              label="Callers"
              value={
                dashboard?.owner
                  ?.totals
                  ?.callers ??
                dashboard?.summary
                  ?.callers ??
                team.filter(
                  (member) =>
                    normalizeRole(
                      member.workspaceRole ||
                        member.role
                    ) === "caller"
                ).length
              }
            />

            <Metric
              label="Total calls"
              value={
                dashboard?.owner
                  ?.totals
                  ?.totalCalls ??
                dashboard?.summary
                  ?.callsToday ??
                calls.length
              }
            />

            <Metric
              label="Audits generated"
              value={
                dashboard?.owner
                  ?.totals
                  ?.generatedAudits ??
                dashboard?.summary
                  ?.auditsGenerated ??
                0
              }
            />
          </div>

          <PerformanceTable
            members={
              dashboard?.owner
                ?.team || team
            }
          />
        </section>
      ) : null}

      {tab === "team" ? (
        <CallerSetupPanel
          callers={callers}
          dialers={dialers}
          senders={senders}
          busy={busy}
          onSaveMember={
            saveMember
          }
        />
      ) : null}

      {tab === "assignments" ||
      tab === "my-work" ? (
        <section className="role-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                Work queue
              </span>
              <h2>
                {canManage
                  ? "Lead assignments"
                  : "My assigned leads"}
              </h2>
            </div>
          </div>

          <SimpleRows
            items={assignments}
            empty="No assignments found."
            render={(item) => (
              <>
                <span>
                  <b>
                    {item.lead
                      ?.business ||
                      item.lead
                        ?.name ||
                      "Lead"}
                  </b>

                  <small>
                    {item.lead?.phone ||
                      "No phone"}
                    {" · "}
                    {item.assigneeName ||
                      item.lead?.address ||
                      "Unassigned"}
                    {getAssignmentNextAt(
                      item
                    )
                      ? ` · Next ${formatDateTime(
                          getAssignmentNextAt(
                            item
                          )
                        )}`
                      : ""}
                  </small>
                </span>

                <em>
                  {item.status}
                </em>
              </>
            )}
          />
        </section>
      ) : null}

      {tab === "tasks" ? (
        <TasksPanel
          tasks={tasks}
          canManage={canManage}
        />
      ) : null}

      {tab === "callbacks" ? (
        <CallbacksPanel
          callbacks={callbacks}
        />
      ) : null}

      {tab === "dialers" ? (
        <DialerPanel
          dialers={dialers}
          callers={callers}
          value={dialer}
          setValue={setDialer}
          busy={busy}
          onSave={saveDialer}
        />
      ) : null}

      {tab === "senders" ? (
        <SenderPanel
          senders={senders}
          callers={callers}
          value={sender}
          setValue={setSender}
          busy={busy}
          onSave={saveSender}
        />
      ) : null}

      {tab === "communication" ? (
        <TeamCommunication
          user={user}
          members={
            team.length
              ? team
              : dashboard?.members ||
                []
          }
          assignments={
            assignments
          }
        />
      ) : null}

      {tab === "calls" ? (
        <section className="role-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                Calling
              </span>
              <h2>
                Call performance
              </h2>
            </div>
          </div>

          <SimpleRows
            items={calls}
            empty="No call records found."
            render={(call) => (
              <>
                <span>
                  <b>
                    {call.leadName ||
                      call.lead?.business ||
                      call.lead?.name ||
                      call.companyName ||
                      "Lead"}
                  </b>

                  <small>
                    {call.destinationNumber ||
                      call.toNumber ||
                      "No number"}
                    {" · "}
                    {formatDateTime(
                      call.startedAt ||
                        call.createdAt
                    )}
                    {Number(
                      call.durationSeconds ||
                        0
                    ) > 0
                      ? ` · ${formatDuration(
                          call.durationSeconds
                        )}`
                      : ""}
                  </small>
                </span>

                <em>
                  {call.status}
                  {call.outcome
                    ? ` · ${call.outcome}`
                    : ""}
                </em>
              </>
            )}
          />
        </section>
      ) : null}
    </div>
  );
}

function TasksPanel({
  tasks,
  canManage,
}) {
  return (
    <section className="role-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            Work management
          </span>

          <h2>
            {canManage
              ? "Team tasks"
              : "My tasks"}
          </h2>

          <p>
            Deadlines are resolved from the
            canonical due time first, with
            compatible legacy scheduling
            fields used only as fallbacks.
          </p>
        </div>
      </div>

      <SimpleRows
        items={tasks}
        empty="No tasks found."
        render={(task) => {
          const dueAt =
            getTaskDueAt(task);
          const overdue =
            isOverdueTask(task);

          return (
            <>
              <span>
                <b>
                  {task.title ||
                    "Task"}
                </b>

                <small>
                  {dueAt
                    ? `${overdue ? "Overdue" : "Due"} ${formatDateTime(
                        dueAt
                      )}`
                    : "No due date"}
                  {getTaskLeadName(
                    task
                  )
                    ? ` · ${getTaskLeadName(
                        task
                      )}`
                    : ""}
                </small>
              </span>

              <em>
                {overdue
                  ? "overdue"
                  : task.priority ||
                    task.status ||
                    "pending"}
              </em>
            </>
          );
        }}
      />
    </section>
  );
}

function CallbacksPanel({
  callbacks,
}) {
  return (
    <section className="role-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            Follow-up queue
          </span>

          <h2>Callbacks</h2>

          <p>
            Scheduled follow-ups are ordered
            by their next action time.
          </p>
        </div>
      </div>

      <SimpleRows
        items={callbacks}
        empty="No callbacks scheduled."
        render={(callback) => (
          <>
            <span>
              <b>
                {callback.leadName ||
                  callback.companyName ||
                  callback.lead?.business ||
                  callback.lead?.name ||
                  "Follow-up"}
              </b>

              <small>
                {formatDateTime(
                  getCallbackAt(
                    callback
                  )
                )}
                {callback.phone ||
                callback.lead?.phone
                  ? ` · ${
                      callback.phone ||
                      callback.lead?.phone
                    }`
                  : ""}
              </small>
            </span>

            <em>
              {callback.priority ||
                callback.status ||
                "scheduled"}
            </em>
          </>
        )}
      />
    </section>
  );
}

function DailySchedulePanel({
  config,
  setConfig,
  callers,
  toggleCaller,
  status,
  busy,
  onSave,
  onRunNow,
}) {
  const selected =
    config.selectedCallerIds || [];

  const allSelected =
    !selected.length;

  return (
    <section className="role-panel daily-schedule-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            Automatic work distribution
          </span>

          <h2>
            Daily lead schedule
          </h2>

          <p>
            At the selected local time,
            each selected caller receives
            a unique daily queue. Existing eligible leads are reused first, and ReachFly discovery fills only the remaining shortage.
          </p>
        </div>

        <div className="schedule-status">
          <b>
            {config.enabled
              ? "Automation on"
              : "Automation off"}
          </b>

          <small>
            Next run:{" "}
            {formatDateTime(
              status?.nextRunAt
            )}
          </small>
        </div>
      </div>

      <div className="schedule-grid">
        <label className="field">
          <span>
            Daily assignment time
          </span>

          <input
            type="time"
            value={
              config.assignmentTime ||
              "00:00"
            }
            onChange={(event) =>
              setConfig(
                (current) => ({
                  ...current,
                  assignmentTime:
                    event.target
                      .value,
                })
              )
            }
          />

          <small>
            Uses the timezone below.
          </small>
        </label>

        <label className="field">
          <span>Timezone</span>

          <select
            value={
              config.timezone
            }
            onChange={(event) =>
              setConfig(
                (current) => ({
                  ...current,
                  timezone:
                    event.target
                      .value,
                })
              )
            }
          >
            <option value="Asia/Karachi">
              Pakistan · Asia/Karachi
            </option>

            <option value="America/New_York">
              US Eastern
            </option>

            <option value="America/Chicago">
              US Central
            </option>

            <option value="America/Denver">
              US Mountain
            </option>

            <option value="America/Los_Angeles">
              US Pacific
            </option>

            <option value="UTC">
              UTC
            </option>
          </select>
        </label>

        <label className="field">
          <span>
            Leads per caller
          </span>

          <input
            type="number"
            min="1"
            max="1000"
            value={
              config.leadsPerCaller
            }
            onChange={(event) =>
              setConfig(
                (current) => ({
                  ...current,
                  leadsPerCaller:
                    Number(
                      event.target
                        .value
                    ),
                })
              )
            }
          />
        </label>

        <label className="field">
          <span>
            Search radius
          </span>

          <input
            type="number"
            min="1"
            max="500"
            value={config.radiusKm}
            onChange={(event) =>
              setConfig(
                (current) => ({
                  ...current,
                  radiusKm:
                    Number(
                      event.target
                        .value
                    ),
                })
              )
            }
          />
        </label>
      </div>

      <div className="schedule-grid wide">
        <ListEditor
          label="Niches"
          value={config.niches}
          placeholder="clinics, dentists, law firms"
          onChange={(niches) =>
            setConfig(
              (current) => ({
                ...current,
                niches,
              })
            )
          }
        />

        <ListEditor
          label="Locations"
          value={config.locations}
          placeholder="California, Texas, Florida"
          onChange={(locations) =>
            setConfig(
              (current) => ({
                ...current,
                locations,
              })
            )
          }
        />
      </div>

      <div className="caller-selection">
        <div className="caller-selection-head">
          <div>
            <h3>
              Callers receiving daily
              work
            </h3>

            <p>
              Leave every caller
              unselected to include all
              active callers.
            </p>
          </div>

          <button
            className="btn light small"
            type="button"
            onClick={() =>
              setConfig(
                (current) => ({
                  ...current,
                  selectedCallerIds:
                    [],
                })
              )
            }
          >
            Use all callers
          </button>
        </div>

        <div className="caller-check-grid">
          {callers.map(
            (caller) => {
              const checked =
                allSelected ||
                selected.includes(
                  caller.id
                );

              return (
                <label
                  key={caller.id}
                  className={
                    checked
                      ? "caller-check selected"
                      : "caller-check"
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      toggleCaller(
                        caller.id
                      )
                    }
                  />

                  <Avatar
                    member={caller}
                  />

                  <span>
                    <b>
                      {caller.name}
                    </b>

                    <small>
                      {caller.email}
                    </small>
                  </span>
                </label>
              );
            }
          )}
        </div>
      </div>

      <div className="option-grid">
        <Toggle
          label="Enable daily automation"
          text="Run automatically every day at the selected time."
          checked={config.enabled}
          onChange={(enabled) =>
            setConfig(
              (current) => ({
                ...current,
                enabled,
              })
            )
          }
        />

        <Toggle
          label="Unique data for every caller"
          text="The same business cannot be assigned to two callers on the same day."
          checked={
            config.uniquePerDay !==
            false
          }
          onChange={(uniquePerDay) =>
            setConfig(
              (current) => ({
                ...current,
                uniquePerDay,
              })
            )
          }
        />

        <Toggle
          label="Keep unfinished work"
          text="Carry valid unfinished leads forward and only fill the shortage."
          checked={
            config.keepUnfinishedWork !==
            false
          }
          onChange={(
            keepUnfinishedWork
          ) =>
            setConfig(
              (current) => ({
                ...current,
                keepUnfinishedWork,
              })
            )
          }
        />

        <Toggle
          label="Generate mini audits"
          text="Queue a mini audit automatically when a lead has a website."
          checked={
            config.autoMiniAudit !==
            false
          }
          onChange={(
            autoMiniAudit
          ) =>
            setConfig(
              (current) => ({
                ...current,
                autoMiniAudit,
              })
            )
          }
        />
      </div>

      <div className="schedule-summary">
        <div>
          <span>
            Selected callers
          </span>

          <strong>
            {allSelected
              ? callers.length
              : selected.length}
          </strong>
        </div>

        <div>
          <span>Daily target</span>

          <strong>
            {(allSelected
              ? callers.length
              : selected.length) *
              Number(
                config.leadsPerCaller ||
                  0
              )}
          </strong>
        </div>

        <div>
          <span>Latest status</span>

          <strong>
            {status?.latestRun
              ?.status ||
              "Not run"}
          </strong>
        </div>

        <div>
          <span>
            Latest assigned
          </span>

          <strong>
            {status?.latestRun
              ?.assignedCount || 0}
          </strong>
        </div>
      </div>

      <div className="panel-actions">
        <button
          className="btn primary"
          type="button"
          disabled={busy}
          onClick={onSave}
        >
          {busy
            ? "Saving…"
            : "Save daily schedule"}
        </button>

        <button
          className="btn light"
          type="button"
          disabled={busy}
          onClick={onRunNow}
        >
          Run allocation now
        </button>
      </div>
    </section>
  );
}

function CallerSetupPanel({
  callers,
  dialers,
  senders,
  busy,
  onSaveMember,
}) {
  return (
    <section className="role-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            Resource onboarding
          </span>

          <h2>
            Caller setup
          </h2>

          <p>
            Assign one dialer and one
            sender identity to each
            caller from a single screen.
          </p>
        </div>
      </div>

      <div className="caller-resource-grid">
        {callers.map(
          (caller) => (
            <article
              key={caller.id}
              className="caller-resource-card"
            >
              <div className="caller-resource-person">
                <Avatar
                  member={caller}
                />

                <span>
                  <b>
                    {caller.name}
                  </b>

                  <small>
                    {caller.email}
                  </small>
                </span>
              </div>

              <label className="field">
                <span>Dialer</span>

                <select
                  value={
                    caller.dialerId ||
                    ""
                  }
                  disabled={busy}
                  onChange={(event) =>
                    onSaveMember(
                      caller,
                      {
                        dialerId:
                          event
                            .target
                            .value,
                      }
                    )
                  }
                >
                  <option value="">
                    No dialer assigned
                  </option>

                  {dialers.map(
                    (item) => (
                      <option
                        value={
                          item.id
                        }
                        key={
                          item.id
                        }
                      >
                        {item.name}
                        {item.fromNumber
                          ? ` · ${item.fromNumber}`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="field">
                <span>
                  Sender identity
                </span>

                <select
                  value={
                    caller.senderId ||
                    ""
                  }
                  disabled={busy}
                  onChange={(event) =>
                    onSaveMember(
                      caller,
                      {
                        senderId:
                          event
                            .target
                            .value,
                      }
                    )
                  }
                >
                  <option value="">
                    No sender assigned
                  </option>

                  {senders.map(
                    (item) => (
                      <option
                        value={
                          item.id
                        }
                        key={
                          item.id
                        }
                      >
                        {item.name}
                        {item.fromEmail
                          ? ` · ${item.fromEmail}`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </label>

              <div className="resource-badges">
                <span>
                  {caller.dialerId
                    ? "Dialer ready"
                    : "Dialer needed"}
                </span>

                <span>
                  {caller.senderId
                    ? "Sender ready"
                    : "Sender needed"}
                </span>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}

function DialerPanel({
  dialers,
  callers,
  value,
  setValue,
  busy,
  onSave,
}) {
  return (
    <section className="role-panel integration-layout">
      <div>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              Calling resources
            </span>

            <h2>Calling connections</h2>

            <p>
              Add an approved calling
              connection once, then assign
              it to the callers who need it.
            </p>
          </div>
        </div>

        <div className="saved-integration-list">
          {dialers.length ? (
            dialers.map(
              (item) => (
                <article
                  className="saved-integration-card"
                  key={item.id}
                >
                  <div>
                    <b>
                      {item.name}
                    </b>

                    <small>
                      {item.provider ||
                        "dialer"}
                      {" · "}
                      {item.fromNumber ||
                        "No number"}
                    </small>
                  </div>

                  <span>
                    {(item.assignedUserIds ||
                      []).length}
                    {" callers"}
                  </span>
                </article>
              )
            )
          ) : (
            <p className="empty-copy">
              No dialers configured.
            </p>
          )}
        </div>
      </div>

      <div className="integration-wizard">
        <span className="step-label">
          Quick setup
        </span>

        <h3>
          Connect a dialer
        </h3>

        <label className="field">
          <span>Provider</span>

          <select
            value={value.provider}
            onChange={(event) =>
              setValue({
                ...value,
                provider:
                  event.target.value,
              })
            }
          >
            <option value="telnyx">
              Telnyx
            </option>

            <option value="vonage">
              Vonage
            </option>
          </select>
        </label>

        <Field
          label="Connection name"
          value={value.name}
          onChange={(name) =>
            setValue({
              ...value,
              name,
            })
          }
          placeholder="US Sales Dialer 1"
        />

        {value.provider ===
        "telnyx" ? (
          <>
            <Field
              label="Telnyx connection ID"
              value={
                value.connectionId
              }
              onChange={(
                connectionId
              ) =>
                setValue({
                  ...value,
                  connectionId,
                })
              }
            />

            <Field
              label="Telnyx API key"
              type="password"
              value={value.apiKey}
              onChange={(apiKey) =>
                setValue({
                  ...value,
                  apiKey,
                })
              }
            />
          </>
        ) : (
          <Field
            label="Vonage application ID"
            value={
              value.applicationId
            }
            onChange={(
              applicationId
            ) =>
              setValue({
                ...value,
                applicationId,
              })
            }
          />
        )}

        <Field
          label="Calling number (E.164)"
          value={value.fromNumber}
          onChange={(fromNumber) =>
            setValue({
              ...value,
              fromNumber,
            })
          }
          placeholder="+12025550123"
        />

        <Field
          label="Public webhook base URL"
          value={
            value.webhookBaseUrl
          }
          onChange={(
            webhookBaseUrl
          ) =>
            setValue({
              ...value,
              webhookBaseUrl,
            })
          }
          placeholder="https://api.reachfly.ai"
        />

        <CallerMultiSelect
          callers={callers}
          selected={
            value.assignedUserIds
          }
          onChange={(
            assignedUserIds
          ) =>
            setValue({
              ...value,
              assignedUserIds,
            })
          }
        />

        <button
          className="btn primary full"
          type="button"
          disabled={
            busy ||
            !value.name ||
            !value.fromNumber
          }
          onClick={onSave}
        >
          Save and assign dialer
        </button>
      </div>
    </section>
  );
}

function SenderPanel({
  senders,
  callers,
  value,
  setValue,
  busy,
  onSave,
}) {
  return (
    <section className="role-panel integration-layout">
      <div>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              Email integration
            </span>

            <h2>Sender IDs</h2>

            <p>
              Save the email connection once and assign the sender identity to one or more callers.
            </p>
          </div>
        </div>

        <div className="saved-integration-list">
          {senders.length ? (
            senders.map(
              (item) => (
                <article
                  className="saved-integration-card"
                  key={item.id}
                >
                  <div>
                    <b>
                      {item.name}
                    </b>

                    <small>
                      {item.fromEmail ||
                        item.username}
                      {" · "}
                      {item.host}
                    </small>
                  </div>

                  <span>
                    {(item.assignedUserIds ||
                      []).length}
                    {" callers"}
                  </span>
                </article>
              )
            )
          ) : (
            <p className="empty-copy">
              No sender IDs configured.
            </p>
          )}
        </div>
      </div>

      <div className="integration-wizard">
        <span className="step-label">
          Quick setup
        </span>

        <h3>
          Connect a sender
        </h3>

        <Field
          label="Sender name"
          value={value.name}
          onChange={(name) =>
            setValue({
              ...value,
              name,
            })
          }
          placeholder="Caller 1 Gmail"
        />

        <div className="two-fields">
          <Field
            label="SMTP host"
            value={value.host}
            onChange={(host) =>
              setValue({
                ...value,
                host,
              })
            }
            placeholder="smtp.gmail.com"
          />

          <Field
            label="Port"
            type="number"
            value={value.port}
            onChange={(port) =>
              setValue({
                ...value,
                port: Number(port),
              })
            }
          />
        </div>

        <Field
          label="Username"
          value={value.username}
          onChange={(username) =>
            setValue({
              ...value,
              username,
            })
          }
        />

        <Field
          label="App password"
          type="password"
          value={value.password}
          onChange={(password) =>
            setValue({
              ...value,
              password,
            })
          }
        />

        <Field
          label="From name"
          value={value.fromName}
          onChange={(fromName) =>
            setValue({
              ...value,
              fromName,
            })
          }
        />

        <Field
          label="From email"
          type="email"
          value={value.fromEmail}
          onChange={(fromEmail) =>
            setValue({
              ...value,
              fromEmail,
            })
          }
        />

        <CallerMultiSelect
          callers={callers}
          selected={
            value.assignedUserIds
          }
          onChange={(
            assignedUserIds
          ) =>
            setValue({
              ...value,
              assignedUserIds,
            })
          }
        />

        <button
          className="btn primary full"
          type="button"
          disabled={
            busy ||
            !value.name ||
            !value.host ||
            !value.username
          }
          onClick={onSave}
        >
          Save and assign sender
        </button>
      </div>
    </section>
  );
}

function CallerMultiSelect({
  callers,
  selected = [],
  onChange,
}) {
  function toggle(id) {
    onChange(
      selected.includes(id)
        ? selected.filter(
            (item) =>
              item !== id
          )
        : [...selected, id]
    );
  }

  return (
    <div className="integration-callers">
      <span>
        Assign to callers
      </span>

      <div>
        {callers.map(
          (caller) => (
            <label
              key={caller.id}
            >
              <input
                type="checkbox"
                checked={selected.includes(
                  caller.id
                )}
                onChange={() =>
                  toggle(caller.id)
                }
              />

              {caller.name}
            </label>
          )
        )}
      </div>
    </div>
  );
}

function ListEditor({
  label,
  value = [],
  placeholder,
  onChange,
}) {
  return (
    <label className="field">
      <span>{label}</span>

      <textarea
        rows="4"
        value={value.join(", ")}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(/[,\n]/)
              .map((item) =>
                item.trim()
              )
              .filter(Boolean)
          )
        }
      />

      <small>
        Separate values with commas.
      </small>
    </label>
  );
}

function Toggle({
  label,
  text,
  checked,
  onChange,
}) {
  return (
    <label className="option-card">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
      />

      <span>
        <b>{label}</b>
        <small>{text}</small>
      </span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}) {
  return (
    <label className="field">
      <span>{label}</span>

      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />
    </label>
  );
}

function Avatar({ member }) {
  const image =
    member?.avatarUrl ||
    member?.photoUrl ||
    member?.profileImage ||
    "";

  if (image) {
    return (
      <img
        className="resource-avatar"
        src={image}
        alt=""
      />
    );
  }

  return (
    <span className="resource-avatar fallback">
      {String(
        member?.name ||
          member?.email ||
          "U"
      )
        .trim()
        .slice(0, 1)
        .toUpperCase()}
    </span>
  );
}

function SimpleRows({
  items,
  render,
  empty,
}) {
  if (!items.length) {
    return (
      <p className="empty-copy">
        {empty}
      </p>
    );
  }

  return (
    <div className="simple-table">
      {items.map((item) => (
        <div key={item.id}>
          {render(item)}
        </div>
      ))}
    </div>
  );
}

function PerformanceTable({
  members = [],
}) {
  return (
    <section className="role-panel">
      <h2>
        Caller performance
      </h2>

      <div className="performance-table">
        <div className="head">
          <span>Member</span>
          <span>Calls</span>
          <span>Answer rate</span>
          <span>Average duration</span>
          <span>Assigned</span>
        </div>

        {members.map(
          (member) => (
            <div key={member.id}>
              <span>
                <b>
                  {member.name}
                </b>

                <small>
                  {member.role}
                </small>
              </span>

              <span>
                {member.performance
                  ?.totalCalls || 0}
              </span>

              <span>
                {member.performance
                  ?.answerRate || 0}
                %
              </span>

              <span>
                {member.performance
                  ?.averageDurationSeconds ||
                  0}
                s
              </span>

              <span>
                {member.assignedLeadCount ||
                  0}
              </span>
            </div>
          )
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}) {
  return (
    <article className="role-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function normalizeRole(value) {
  const normalized = String(
    value || "caller"
  )
    .trim()
    .toLowerCase();

  return [
    "owner",
    "admin",
    "manager",
    "caller",
  ].includes(normalized)
    ? normalized
    : "caller";
}

async function loadOptionalApi(
  methodName,
  ...args
) {
  const method =
    api?.[methodName];

  if (
    typeof method !==
    "function"
  ) {
    return {
      ok: false,
      data: null,
      message: `${formatLabel(
        methodName
      )} is not available in this frontend build.`,
    };
  }

  try {
    return {
      ok: true,
      data: await method.apply(
        api,
        args
      ),
      message: "",
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      message:
        error?.message ||
        `${formatLabel(
          methodName
        )} could not be loaded.`,
    };
  }
}

function optionalSuccess(data) {
  return {
    ok: true,
    data,
    message: "",
  };
}

async function invokeRequiredApi(
  methodName,
  ...args
) {
  const method =
    api?.[methodName];

  if (
    typeof method !==
    "function"
  ) {
    throw new Error(
      `${formatLabel(
        methodName
      )} is not available in this frontend build. Refresh after deploying the matching API client.`
    );
  }

  return method.apply(
    api,
    args
  );
}

function normalizeOperationsDashboard(
  value
) {
  const dashboard =
    value &&
    typeof value ===
      "object"
      ? value
      : {};

  return {
    ...dashboard,
    assignments:
      dashboard.assignments ||
      dashboard.assignedLeads ||
      [],
    calls:
      dashboard.calls ||
      dashboard.recentCalls ||
      [],
    tasks:
      dashboard.tasks || [],
    callbacks:
      dashboard.callbacks ||
      dashboard.upcomingCallbacks ||
      [],
    members:
      dashboard.members || [],
  };
}

function normalizeTeamMembers(
  records
) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .map((record) => {
      if (
        record?.member &&
        typeof record.member ===
          "object"
      ) {
        return {
          ...record.member,
          performance:
            record.metrics ||
            record.performance ||
            record.member
              ?.performance,
          attendance:
            record.attendance,
          online:
            record.online,
        };
      }

      return record;
    })
    .filter(
      (record) =>
        record &&
        (record.id ||
          record.email)
    );
}

function normalizeAssignments(
  records
) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records.map(
    (assignment) => ({
      ...assignment,
      assigneeName:
        assignment.assigneeName ||
        assignment.assignedToName ||
        assignment.userName ||
        assignment.assignee?.name ||
        assignment.member?.name ||
        "",
    })
  );
}

function normalizeCalls(
  records
) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .map((call) => ({
      ...call,
      destinationNumber:
        call.destinationNumber ||
        call.toNumber ||
        call.phone ||
        "",
      startedAt:
        call.startedAt ||
        call.answeredAt ||
        call.createdAt ||
        "",
      durationSeconds:
        Number(
          call.durationSeconds ??
            call.duration ??
            0
        ) || 0,
      leadName:
        call.leadName ||
        call.contactName ||
        call.lead?.business ||
        call.lead?.name ||
        "",
    }))
    .sort(
      (left, right) =>
        dateNumber(
          right.startedAt
        ) -
        dateNumber(
          left.startedAt
        )
    );
}

function normalizeCallbacks(
  records
) {
  if (!Array.isArray(records)) {
    return [];
  }

  return [...records].sort(
    (left, right) =>
      dateNumber(
        getCallbackAt(left)
      ) -
      dateNumber(
        getCallbackAt(right)
      )
  );
}

function sortTasks(records) {
  if (!Array.isArray(records)) {
    return [];
  }

  return [...records].sort(
    (left, right) => {
      const leftClosed =
        isClosedTask(left);
      const rightClosed =
        isClosedTask(right);

      if (
        leftClosed !==
        rightClosed
      ) {
        return leftClosed
          ? 1
          : -1;
      }

      const leftDue =
        dateNumber(
          getTaskDueAt(left)
        );
      const rightDue =
        dateNumber(
          getTaskDueAt(right)
        );

      if (
        leftDue &&
        rightDue
      ) {
        return (
          leftDue - rightDue
        );
      }

      if (leftDue) return -1;
      if (rightDue) return 1;

      return (
        dateNumber(
          right.createdAt
        ) -
        dateNumber(
          left.createdAt
        )
      );
    }
  );
}

function getTaskDueAt(task) {
  return (
    task?.dueAt ||
    task?.dueDate ||
    task?.scheduledAt ||
    task?.nextActionAt ||
    task?.callbackAt ||
    ""
  );
}

function getTaskLeadName(task) {
  return (
    task?.leadName ||
    task?.companyName ||
    task?.lead?.business ||
    task?.lead?.name ||
    ""
  );
}

function getAssignmentNextAt(
  assignment
) {
  return (
    assignment?.nextActionAt ||
    assignment?.dueAt ||
    assignment?.callbackAt ||
    ""
  );
}

function getCallbackAt(
  callback
) {
  return (
    callback?.nextActionAt ||
    callback?.scheduledAt ||
    callback?.dueAt ||
    callback?.callbackAt ||
    ""
  );
}

function isClosedTask(task) {
  const status =
    String(
      task?.status || ""
    )
      .trim()
      .toLowerCase();

  return [
    "completed",
    "complete",
    "closed",
    "cancelled",
    "canceled",
  ].includes(status);
}

function isOverdueTask(task) {
  const dueAt =
    dateNumber(
      getTaskDueAt(task)
    );

  return Boolean(
    dueAt &&
    !isClosedTask(task) &&
    dueAt < Date.now()
  );
}

function dateNumber(value) {
  if (!value) return 0;

  const valueOf =
    new Date(value).getTime();

  return Number.isFinite(
    valueOf
  )
    ? valueOf
    : 0;
}

function formatDuration(seconds) {
  const total = Math.max(
    0,
    Number(seconds || 0)
  );

  if (total < 60) {
    return `${Math.round(
      total
    )} sec`;
  }

  const hours = Math.floor(
    total / 3600
  );
  const minutes =
    Math.floor(
      (total % 3600) / 60
    );

  return hours
    ? `${hours}h ${minutes}m`
    : `${minutes} min`;
}

function formatLabel(value) {
  return String(value || "")
    .replace(
      /([a-z])([A-Z])/g,
      "$1 $2"
    )
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatDateTime(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function safeOperationsMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function notifyRoleOperations(
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

function RoleOperationsV7Styles() {
  return (
    <style>{`
      .rf-role-operations-v7{
        --rfro-card:#fff;
        --rfro-soft:#f6f7f8;
        --rfro-text:#191c1d;
        --rfro-text2:#4d4c59;
        --rfro-muted:#777784;
        --rfro-line:#e2e4e7;
        --rfro-primary:#4648d4;
        --rfro-primary-dark:#393bbb;
        --rfro-primary-soft:#e8e9ff;
        --rfro-violet:#6b38d4;
        --rfro-violet-soft:#f1ebff;
        --rfro-green:#087a51;
        --rfro-green-soft:#e4f7ee;
        --rfro-red:#ba1a1a;
        --rfro-red-soft:#ffedeb;
        --rfro-amber:#965900;
        --rfro-amber-soft:#fff3d8;
        --rfro-dark:#2e3132;
        --rfro-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfro-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfroPageIn .24s var(--rfro-ease);
      }

      .rf-role-operations-v7 *,
      .rf-role-operations-v7 *::before,
      .rf-role-operations-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfroPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfroAlertIn{
        from{opacity:0;transform:translateY(-4px)}
        to{opacity:1;transform:none}
      }

      .rf-role-operations-v7 .role-ops-hero{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:17px;
      }

      .rf-role-operations-v7 .role-ops-hero > div{
        min-width:0;
      }

      .rf-role-operations-v7 .role-ops-hero > div > span{
        display:block;
        margin-bottom:4px;
        color:var(--rfro-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rf-role-operations-v7 .role-ops-hero h1{
        margin:0;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-role-operations-v7 .role-ops-hero p{
        max-width:780px;
        margin:5px 0 0;
        color:var(--rfro-text2);
        font-size:12px;
        line-height:18px;
      }

      .rf-role-operations-v7 .role-ops-hero__actions{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:flex-end;
        gap:7px;
      }

      .rf-role-operations-v7 .role-ops-hero__actions .btn{
        text-decoration:none;
        white-space:nowrap;
      }

      .rf-role-operations-v7 .btn{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 11px;
        color:var(--rfro-text);
        background:#fff;
        border:1px solid var(--rfro-line);
        border-radius:8px;
        cursor:pointer;
        font:700 7px/1 Inter,sans-serif;
        transition:.14s var(--rfro-ease);
      }

      .rf-role-operations-v7 .btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-role-operations-v7 .btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-role-operations-v7 .btn.primary{
        color:#fff;
        background:var(--rfro-primary);
        border-color:var(--rfro-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rf-role-operations-v7 .btn.primary:hover:not(:disabled){
        background:var(--rfro-primary-dark);
      }

      .rf-role-operations-v7 .btn.light{
        background:#fff;
        border-color:var(--rfro-line);
      }

      .rf-role-operations-v7 .btn.small{
        min-height:33px;
        padding:6px 8px;
        font-size:6px;
      }

      .rf-role-operations-v7 .btn.full{
        width:100%;
      }

      .rf-role-operations-v7 .role-error,
      .rf-role-operations-v7 .role-warning,
      .rf-role-operations-v7 .role-success{
        padding:10px 12px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        font-size:7px;
        line-height:12px;
        animation:rfroAlertIn .16s var(--rfro-ease);
      }

      .rf-role-operations-v7 .role-error{
        color:#7c1d1d;
        background:var(--rfro-red-soft);
        border-color:#ffd0cc;
      }

      .rf-role-operations-v7 .role-warning{
        color:#7d5200;
        background:var(--rfro-amber-soft);
        border-color:#f0ddb4;
      }

      .rf-role-operations-v7 .role-success{
        color:#086846;
        background:var(--rfro-green-soft);
        border-color:#caeadb;
      }

      .rf-role-operations-v7 .role-tabs{
        position:sticky;
        z-index:25;
        top:64px;
        display:flex;
        gap:5px;
        overflow-x:auto;
        padding:5px;
        margin-bottom:11px;
        background:rgba(255,255,255,.94);
        border:1px solid var(--rfro-line);
        border-radius:10px;
        backdrop-filter:blur(12px);
        scrollbar-width:none;
      }

      .rf-role-operations-v7 .role-tabs::-webkit-scrollbar{
        display:none;
      }

      .rf-role-operations-v7 .role-tabs button{
        min-height:36px;
        flex:0 0 auto;
        padding:6px 9px;
        color:var(--rfro-text2);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:6.5px;
        font-weight:700;
        transition:.13s var(--rfro-ease);
      }

      .rf-role-operations-v7 .role-tabs button:hover{
        background:#f3f4f5;
      }

      .rf-role-operations-v7 .role-tabs button.active{
        color:var(--rfro-primary);
        background:var(--rfro-primary-soft);
      }

      .rf-role-operations-v7 .role-stack{
        display:grid;
        gap:11px;
      }

      .rf-role-operations-v7 .metric-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:9px;
      }

      .rf-role-operations-v7 .role-metric{
        min-height:126px;
        display:grid;
        align-content:end;
        padding:14px;
        background:
          radial-gradient(circle at 90% 10%,rgba(70,72,212,.045),transparent 31%),
          #fff;
        border:1px solid var(--rfro-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-role-operations-v7 .role-metric span{
        color:var(--rfro-muted);
        font-size:6px;
        font-weight:750;
      }

      .rf-role-operations-v7 .role-metric strong{
        margin-top:4px;
        font:600 27px/33px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-role-operations-v7 .role-panel{
        min-width:0;
        padding:14px;
        background:#fff;
        border:1px solid var(--rfro-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-role-operations-v7 .panel-heading{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding-bottom:10px;
        margin-bottom:10px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-role-operations-v7 .panel-heading > div{
        min-width:0;
      }

      .rf-role-operations-v7 .eyebrow{
        display:block;
        margin-bottom:3px;
        color:var(--rfro-primary);
        font-size:5.8px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-role-operations-v7 .panel-heading h2,
      .rf-role-operations-v7 .role-panel > h2{
        margin:0;
        font:600 15px/21px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-role-operations-v7 .panel-heading p{
        max-width:720px;
        margin:4px 0 0;
        color:var(--rfro-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rf-role-operations-v7 .simple-table{
        display:grid;
        gap:5px;
      }

      .rf-role-operations-v7 .simple-table > div{
        min-height:58px;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        gap:9px;
        padding:8px 10px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        transition:.13s var(--rfro-ease);
      }

      .rf-role-operations-v7 .simple-table > div:hover{
        background:#f3f3fb;
        border-color:#e3e3f4;
      }

      .rf-role-operations-v7 .simple-table > div > span{
        min-width:0;
        display:grid;
      }

      .rf-role-operations-v7 .simple-table b{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.8px;
      }

      .rf-role-operations-v7 .simple-table small{
        margin-top:2px;
        color:var(--rfro-muted);
        font-size:5.7px;
        line-height:9px;
      }

      .rf-role-operations-v7 .simple-table em{
        max-width:170px;
        padding:4px 7px;
        overflow:hidden;
        color:var(--rfro-primary);
        background:var(--rfro-primary-soft);
        border-radius:999px;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.5px;
        font-style:normal;
        font-weight:750;
      }

      .rf-role-operations-v7 .empty-copy{
        min-height:150px;
        display:grid;
        place-items:center;
        margin:0;
        padding:22px;
        color:var(--rfro-muted);
        background:#f8f9fa;
        border:1px dashed #d7d9dd;
        border-radius:9px;
        text-align:center;
        font-size:6.5px;
      }

      .rf-role-operations-v7 .daily-schedule-panel{
        background:
          radial-gradient(circle at 96% 4%,rgba(70,72,212,.05),transparent 24%),
          #fff;
      }

      .rf-role-operations-v7 .schedule-status{
        min-width:160px;
        display:grid;
        gap:2px;
        padding:8px 10px;
        color:var(--rfro-primary);
        background:var(--rfro-primary-soft);
        border-radius:8px;
      }

      .rf-role-operations-v7 .schedule-status b{
        font-size:6.5px;
      }

      .rf-role-operations-v7 .schedule-status small{
        color:#6566a1;
        font-size:5.5px;
      }

      .rf-role-operations-v7 .schedule-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }

      .rf-role-operations-v7 .schedule-grid.wide{
        grid-template-columns:1fr 1fr;
        margin-top:8px;
      }

      .rf-role-operations-v7 .field{
        min-width:0;
        display:grid;
        gap:4px;
      }

      .rf-role-operations-v7 .field > span,
      .rf-role-operations-v7 .integration-callers > span{
        color:var(--rfro-muted);
        font-size:5.7px;
        font-weight:750;
        letter-spacing:.03em;
        text-transform:uppercase;
      }

      .rf-role-operations-v7 .field > small{
        color:var(--rfro-muted);
        font-size:5.3px;
        line-height:8px;
      }

      .rf-role-operations-v7 input,
      .rf-role-operations-v7 select,
      .rf-role-operations-v7 textarea{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfro-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 7px/12px Inter,sans-serif;
        transition:.13s var(--rfro-ease);
      }

      .rf-role-operations-v7 textarea{
        min-height:88px;
        resize:vertical;
      }

      .rf-role-operations-v7 input:focus,
      .rf-role-operations-v7 select:focus,
      .rf-role-operations-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-role-operations-v7 .caller-selection{
        margin-top:9px;
        padding:11px;
        background:#f7f8f9;
        border-radius:9px;
      }

      .rf-role-operations-v7 .caller-selection-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:10px;
        margin-bottom:8px;
      }

      .rf-role-operations-v7 .caller-selection-head h3{
        margin:0;
        font:600 9px/13px Geist,Inter,sans-serif;
      }

      .rf-role-operations-v7 .caller-selection-head p{
        margin:2px 0 0;
        color:var(--rfro-muted);
        font-size:5.7px;
      }

      .rf-role-operations-v7 .caller-check-grid,
      .rf-role-operations-v7 .caller-resource-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf-role-operations-v7 .caller-check,
      .rf-role-operations-v7 .caller-resource-card{
        min-width:0;
        display:grid;
        align-items:center;
        gap:7px;
        padding:9px;
        background:#fff;
        border:1px solid var(--rfro-line);
        border-radius:9px;
      }

      .rf-role-operations-v7 .caller-check{
        grid-template-columns:16px 34px minmax(0,1fr);
        cursor:pointer;
      }

      .rf-role-operations-v7 .caller-check.selected{
        background:#f4f4ff;
        border-color:#d9daff;
      }

      .rf-role-operations-v7 .caller-check input{
        width:15px;
        height:15px;
        min-height:0;
        padding:0;
        accent-color:var(--rfro-primary);
      }

      .rf-role-operations-v7 .resource-avatar{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        object-fit:cover;
        color:#fff;
        background:var(--rfro-primary);
        border-radius:8px;
        font-size:7px;
        font-weight:800;
      }

      .rf-role-operations-v7 .caller-check > span:last-child,
      .rf-role-operations-v7 .caller-resource-person > span{
        min-width:0;
        display:grid;
      }

      .rf-role-operations-v7 .caller-check b,
      .rf-role-operations-v7 .caller-resource-person b{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.5px;
      }

      .rf-role-operations-v7 .caller-check small,
      .rf-role-operations-v7 .caller-resource-person small{
        overflow:hidden;
        color:var(--rfro-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.3px;
      }

      .rf-role-operations-v7 .option-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:7px;
        margin-top:9px;
      }

      .rf-role-operations-v7 .option-card{
        min-height:90px;
        display:grid;
        grid-template-columns:17px minmax(0,1fr);
        align-items:start;
        gap:7px;
        padding:9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
        cursor:pointer;
      }

      .rf-role-operations-v7 .option-card input{
        width:15px;
        height:15px;
        min-height:0;
        padding:0;
        accent-color:var(--rfro-primary);
      }

      .rf-role-operations-v7 .option-card > span{
        display:grid;
      }

      .rf-role-operations-v7 .option-card b{
        font-size:6.4px;
      }

      .rf-role-operations-v7 .option-card small{
        margin-top:3px;
        color:var(--rfro-muted);
        font-size:5.4px;
        line-height:9px;
      }

      .rf-role-operations-v7 .schedule-summary{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:7px;
        margin-top:9px;
      }

      .rf-role-operations-v7 .schedule-summary > div{
        min-height:72px;
        display:grid;
        align-content:center;
        padding:9px;
        background:#fff;
        border:1px solid var(--rfro-line);
        border-radius:8px;
      }

      .rf-role-operations-v7 .schedule-summary span{
        color:var(--rfro-muted);
        font-size:5.4px;
      }

      .rf-role-operations-v7 .schedule-summary strong{
        margin-top:3px;
        font-size:11px;
      }

      .rf-role-operations-v7 .panel-actions{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-top:10px;
      }

      .rf-role-operations-v7 .caller-resource-card{
        align-content:start;
      }

      .rf-role-operations-v7 .caller-resource-person{
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        align-items:center;
        gap:7px;
      }

      .rf-role-operations-v7 .resource-badges{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
      }

      .rf-role-operations-v7 .resource-badges span{
        padding:4px 6px;
        color:var(--rfro-primary);
        background:var(--rfro-primary-soft);
        border-radius:999px;
        font-size:5px;
        font-weight:700;
      }

      .rf-role-operations-v7 .integration-layout{
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(300px,.72fr);
        align-items:start;
        gap:11px;
      }

      .rf-role-operations-v7 .saved-integration-list{
        display:grid;
        gap:6px;
      }

      .rf-role-operations-v7 .saved-integration-card{
        min-height:61px;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:9px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-role-operations-v7 .saved-integration-card > div{
        min-width:0;
        display:grid;
      }

      .rf-role-operations-v7 .saved-integration-card b{
        font-size:6.7px;
      }

      .rf-role-operations-v7 .saved-integration-card small{
        margin-top:2px;
        overflow:hidden;
        color:var(--rfro-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.5px;
      }

      .rf-role-operations-v7 .saved-integration-card > span{
        padding:4px 6px;
        color:var(--rfro-primary);
        background:#fff;
        border:1px solid #e2e3fa;
        border-radius:999px;
        font-size:5.4px;
      }

      .rf-role-operations-v7 .integration-wizard{
        display:grid;
        gap:8px;
        padding:12px;
        background:
          linear-gradient(135deg,#f6f6ff,#fff);
        border:1px solid #dedffa;
        border-radius:10px;
      }

      .rf-role-operations-v7 .step-label{
        color:var(--rfro-primary);
        font-size:5.3px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-role-operations-v7 .integration-wizard h3{
        margin:-3px 0 1px;
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rf-role-operations-v7 .two-fields{
        display:grid;
        grid-template-columns:1fr 110px;
        gap:7px;
      }

      .rf-role-operations-v7 .integration-callers{
        display:grid;
        gap:5px;
      }

      .rf-role-operations-v7 .integration-callers > div{
        display:flex;
        flex-wrap:wrap;
        gap:5px;
      }

      .rf-role-operations-v7 .integration-callers label{
        display:flex;
        align-items:center;
        gap:5px;
        padding:5px 6px;
        background:#fff;
        border:1px solid var(--rfro-line);
        border-radius:999px;
        font-size:5.5px;
      }

      .rf-role-operations-v7 .integration-callers input{
        width:13px;
        height:13px;
        min-height:0;
        padding:0;
        accent-color:var(--rfro-primary);
      }

      .rf-role-operations-v7 .performance-table{
        display:grid;
        overflow-x:auto;
        margin-top:9px;
        border:1px solid var(--rfro-line);
        border-radius:9px;
      }

      .rf-role-operations-v7 .performance-table > div{
        min-width:680px;
        min-height:49px;
        display:grid;
        grid-template-columns:1.4fr repeat(4,.7fr);
        align-items:center;
        gap:8px;
        padding:8px 10px;
        background:#fff;
      }

      .rf-role-operations-v7 .performance-table > div + div{
        border-top:1px solid #eff0f1;
      }

      .rf-role-operations-v7 .performance-table .head{
        min-height:40px;
        color:var(--rfro-muted);
        background:#f7f8f9;
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rf-role-operations-v7 .performance-table b{
        font-size:6.5px;
      }

      .rf-role-operations-v7 .performance-table small{
        display:block;
        color:var(--rfro-muted);
        font-size:5.3px;
      }

      .rf-role-operations-v7 .performance-table span{
        font-size:6px;
      }

      @media(max-width:1080px){
        .rf-role-operations-v7{
          padding:22px;
        }

        .rf-role-operations-v7 .schedule-grid{
          grid-template-columns:1fr 1fr;
        }

        .rf-role-operations-v7 .caller-check-grid,
        .rf-role-operations-v7 .caller-resource-grid{
          grid-template-columns:1fr 1fr;
        }

        .rf-role-operations-v7 .option-grid{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:820px){
        .rf-role-operations-v7 .role-ops-hero{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-role-operations-v7 .role-ops-hero__actions{
          display:grid;
          grid-template-columns:1fr;
          width:100%;
        }

        .rf-role-operations-v7 .role-ops-hero__actions .btn{
          width:100%;
        }

        .rf-role-operations-v7 .metric-grid{
          grid-template-columns:1fr 1fr;
        }

        .rf-role-operations-v7 .integration-layout{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:620px){
        .rf-role-operations-v7{
          padding:18px 12px 80px;
        }

        .rf-role-operations-v7 .role-ops-hero h1{
          font-size:25px;
          line-height:32px;
        }

        .rf-role-operations-v7 .role-ops-hero p{
          font-size:10px;
          line-height:16px;
        }

        .rf-role-operations-v7 .role-tabs{
          top:61px;
          margin-left:-12px;
          margin-right:-12px;
          border-left:0;
          border-right:0;
          border-radius:0;
        }

        .rf-role-operations-v7 .metric-grid,
        .rf-role-operations-v7 .schedule-grid,
        .rf-role-operations-v7 .schedule-grid.wide,
        .rf-role-operations-v7 .caller-check-grid,
        .rf-role-operations-v7 .caller-resource-grid,
        .rf-role-operations-v7 .option-grid,
        .rf-role-operations-v7 .schedule-summary{
          grid-template-columns:1fr;
        }

        .rf-role-operations-v7 .caller-selection-head{
          flex-direction:column;
        }

        .rf-role-operations-v7 .panel-actions{
          display:grid;
          grid-template-columns:1fr;
        }

        .rf-role-operations-v7 .panel-actions .btn{
          width:100%;
        }

        .rf-role-operations-v7 .two-fields{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-role-operations-v7,
        .rf-role-operations-v7 *,
        .rf-role-operations-v7 *::before,
        .rf-role-operations-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
