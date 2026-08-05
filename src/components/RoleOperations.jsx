import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import TeamCommunication from "./TeamCommunication";
import "./RoleOperations.css";

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
  const role =
    user?.workspaceRole ||
    user?.role ||
    "caller";

  const isOwner = role === "owner";
  const canManage =
    ["owner", "admin", "manager"].includes(role);

  const [tab, setTab] = useState(
    isOwner
      ? "owner"
      : canManage
        ? "daily-work"
        : "my-work"
  );

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
        const requests = [
          api.salesDashboard(),
          api.dialers(),
          api.senders(),
        ];

        if (canManage) {
          requests.push(
            api.team(),
            api.dailyLeadStatus()
          );
        }

        const [
          sales,
          dialerData,
          senderData,
          teamData,
          automationData,
        ] = await Promise.all(requests);

        setDashboard(sales || null);
        setDialers(
          dialerData?.dialers || []
        );
        setSenders(
          senderData?.senders || []
        );

        if (canManage) {
          setTeam(
            teamData?.members || []
          );

          setDailyStatus(
            automationData || null
          );

          setDailyConfig({
            ...DEFAULT_CONFIG,
            ...(automationData?.config ||
              {}),
          });
        }

        if (isOwner) {
          const owner =
            await api.ownerOverview();

          setDashboard((current) => ({
            ...(current || {}),
            owner,
          }));
        }
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
    load();

    // Slow refresh avoids the previous 429 request storm.
    const timer = setInterval(
      () =>
        load({
          silent: true,
        }),
      60_000
    );

    return () =>
      clearInterval(timer);
  }, [load]);

  const tabs = useMemo(() => {
    if (!canManage) {
      return [
        ["my-work", "My work"],
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
      ["dialers", "Dialers"],
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

  async function saveDailySchedule() {
    try {
      setBusy(true);
      setError("");
      setMessage("");

      const response =
        await api.saveDailyLeadConfig(
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
        await api.runDailyLeadAutomation({
          force: true,
        });

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

      await api.updateTeamMember(
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

      await api.saveDialer(
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

      await api.saveSender(
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
    dashboard?.assignments || [];
  const calls =
    dashboard?.calls || [];

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
            Schedule daily real-lead
            allocation, connect caller
            dialers, assign sender IDs and
            review performance.
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
                setTab(id)
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
                  ?.members || 0
              }
            />

            <Metric
              label="Callers"
              value={
                dashboard?.owner
                  ?.totals
                  ?.callers || 0
              }
            />

            <Metric
              label="Total calls"
              value={
                dashboard?.owner
                  ?.totals
                  ?.totalCalls || 0
              }
            />

            <Metric
              label="Audits generated"
              value={
                dashboard?.owner
                  ?.totals
                  ?.generatedAudits ||
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
                    {item.lead
                      ?.phone ||
                      "No phone"}
                    {" · "}
                    {item.lead
                      ?.address ||
                      "No address"}
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
                    {call.lead
                      ?.business ||
                      call.lead
                        ?.name ||
                      "Lead"}
                  </b>

                  <small>
                    {call.destinationNumber ||
                      "No number"}
                    {" · "}
                    {formatDateTime(
                      call.createdAt
                    )}
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
              Calling integration
            </span>

            <h2>Dialers</h2>

            <p>
              Add a Telnyx or Vonage
              connection once, then
              assign it to callers.
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
