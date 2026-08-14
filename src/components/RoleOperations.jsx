import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
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

      setMessage(
        `Daily work schedule saved. Next run: ${formatDateTime(
          response?.nextRunAt
        )}.`
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

      setMessage(
        `Allocation completed: ${
          response?.run?.assignedCount ||
          0
        } new assignments.`
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
      setMessage(
        "Dialer saved and ready to assign to callers."
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
      setMessage(
        "Sender ID saved and ready to assign."
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
    <div className="role-ops-page">
      <header className="role-ops-hero">
        <div>
          <span>
            Workspace control
          </span>

          <h1>
            {isOwner
              ? "Owner command center"
              : canManage
                ? "Manager operations"
                : "Caller workspace"}
          </h1>

          <p>
            Coordinate daily lead allocation,
            assignments, tasks, callbacks,
            calling resources, team communication
            and sales performance from one
            workspace.
          </p>
        </div>

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
      </header>

      {error ? (
        <div className="role-error">
          {error}
        </div>
      ) : null}

      {warning ? (
        <div className="role-error">
          {warning}
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
            a unique daily queue. Existing
            real leads are reused before
            Google Places generates the
            shortage.
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
              Save SMTP credentials once
              and assign the sender to
              one or more callers.
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