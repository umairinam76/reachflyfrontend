import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiRequest,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

const DEFAULT_CONFIG = {
  enabled: true,
  leadsPerCaller: 100,
  timezone: "Asia/Karachi",
  assignmentHour: 4,
  assignmentMinute: 0,
  niches: [],
  locations: [],
  callerPlans: {},
};

export default function DailyLeadManagerPanel() {
  const [status, setStatus] =
    useState(null);
  const [form, setForm] =
    useState(DEFAULT_CONFIG);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [running, setRunning] =
    useState(false);
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError("");

      try {
        const result =
          await apiRequest(
            "/daily-leads/status"
          );

        setStatus(result);

        const config = {
          ...DEFAULT_CONFIG,
          ...(result?.config || {}),
          callerPlans: {
            ...(result?.config
              ?.callerPlans || {}),
          },
        };

        setForm(config);
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Daily lead settings could not be loaded."
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () =>
      void load({ silent: true });

    const subscriptions = [
      onWorkspaceSocket(
        "daily-leads:completed",
        refresh
      ),
      onWorkspaceSocket(
        "daily-leads:config-updated",
        refresh
      ),
      onWorkspaceSocket(
        "daily-leads:submitted",
        refresh
      ),
    ];

    return () =>
      subscriptions.forEach(
        (unsubscribe) =>
          unsubscribe?.()
      );
  }, [load]);

  const timeValue =
    `${String(
      form.assignmentHour ?? 4
    ).padStart(2, "0")}:${String(
      form.assignmentMinute ?? 0
    ).padStart(2, "0")}`;

  const nicheSuggestions =
    useMemo(
      () =>
        uniqueStrings([
          ...(form.niches || []),
          ...(status?.callers || [])
            .map(
              (caller) =>
                caller.currentNiche
            )
            .filter(Boolean),
        ]),
      [form.niches, status?.callers]
    );

  function setField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setCallerPlan(
    callerId,
    key,
    value
  ) {
    setForm((current) => ({
      ...current,
      callerPlans: {
        ...(current.callerPlans || {}),
        [callerId]: {
          ...(current.callerPlans?.[
            callerId
          ] || {}),
          [key]: value,
        },
      },
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result =
        await apiRequest(
          "/daily-leads/config",
          {
            method: "PUT",
            body: {
              ...form,
              leadsPerCaller:
                Math.max(
                  1,
                  Number(
                    form.leadsPerCaller ||
                    100
                  )
                ),
              niches:
                normalizeList(
                  form.niches
                ),
              locations:
                normalizeList(
                  form.locations
                ),
              callerPlans:
                form.callerPlans || {},
            },
          }
        );

      setMessage(
        "Daily lead schedule and next-day caller niches were saved. The scheduler has been updated immediately."
      );

      setStatus((current) => ({
        ...(current || {}),
        config:
          result.config ||
          form,
        nextRunAt:
          result.nextRunAt ||
          current?.nextRunAt,
      }));

      await load({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Daily lead settings could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        "/daily-leads/run",
        {
          method: "POST",
          body: {
            force: true,
          },
          timeoutMs: 120_000,
        }
      );

      setMessage(
        "Daily lead refresh started. Reused leads are used first; only shortages are generated."
      );

      await load({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Daily lead refresh could not be started."
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <section className="rf-panel">
        <p>Loading daily lead controls…</p>
      </section>
    );
  }

  return (
    <section className="rf-panel">
      <div className="rf-panel-header">
        <div>
          <p className="rf-dashboard-eyebrow">
            Daily caller automation
          </p>
          <h2>
            100-lead daily refresh
          </h2>
          <p>
            Set the refresh time and tomorrow's niche for each caller. Existing useful leads are reused first and new lead API calls only fill the shortage.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rf-inline-alert">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="success-banner">
          {message}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <label>
          <span>Automation</span>
          <select
            value={
              form.enabled
                ? "enabled"
                : "disabled"
            }
            onChange={(event) =>
              setField(
                "enabled",
                event.target.value ===
                  "enabled"
              )
            }
          >
            <option value="enabled">
              Enabled
            </option>
            <option value="disabled">
              Disabled
            </option>
          </select>
        </label>

        <label>
          <span>Daily refresh time</span>
          <input
            type="time"
            value={timeValue}
            onChange={(event) => {
              const [hour, minute] =
                event.target.value
                  .split(":")
                  .map(Number);

              setForm((current) => ({
                ...current,
                assignmentHour:
                  Number.isFinite(hour)
                    ? hour
                    : 4,
                assignmentMinute:
                  Number.isFinite(minute)
                    ? minute
                    : 0,
              }));
            }}
          />
        </label>

        <label>
          <span>Timezone</span>
          <input
            value={form.timezone || ""}
            onChange={(event) =>
              setField(
                "timezone",
                event.target.value
              )
            }
            placeholder="Asia/Karachi"
          />
        </label>

        <label>
          <span>Leads per caller</span>
          <input
            type="number"
            min="1"
            max="5000"
            value={
              form.leadsPerCaller || 100
            }
            onChange={(event) =>
              setField(
                "leadsPerCaller",
                Number(
                  event.target.value
                )
              )
            }
          />
        </label>

        <label>
          <span>Default niches</span>
          <input
            value={
              (form.niches || []).join(
                ", "
              )
            }
            onChange={(event) =>
              setField(
                "niches",
                normalizeList(
                  event.target.value
                )
              )
            }
            placeholder="clinics, dentists, law firms"
          />
        </label>

        <label>
          <span>Default locations</span>
          <input
            value={
              (form.locations || []).join(
                ", "
              )
            }
            onChange={(event) =>
              setField(
                "locations",
                normalizeList(
                  event.target.value
                )
              )
            }
            placeholder="California, Texas, Florida"
          />
        </label>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <button
          type="button"
          className="rf-button rf-button--primary"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving
            ? "Saving…"
            : "Save schedule & next-day niches"}
        </button>

        <button
          type="button"
          className="rf-button rf-button--secondary"
          onClick={() => void runNow()}
          disabled={running}
        >
          {running
            ? "Refreshing…"
            : "Refresh queues now"}
        </button>

        <div style={{ alignSelf: "center" }}>
          <strong>Next refresh:</strong>{" "}
          {formatDateTime(
            status?.nextRunAt
          ) || "Not scheduled"}
        </div>
      </div>

      <datalist id="daily-lead-niche-options">
        {nicheSuggestions.map(
          (niche) => (
            <option
              key={niche}
              value={niche}
            />
          )
        )}
      </datalist>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th align="left">Caller</th>
              <th align="left">Today</th>
              <th align="left">Tomorrow / next refresh niche</th>
              <th align="left">Location</th>
              <th align="left">Progress</th>
              <th align="left">Submission</th>
            </tr>
          </thead>
          <tbody>
            {(status?.callers || []).map(
              (caller) => {
                const plan =
                  form.callerPlans?.[
                    caller.id
                  ] || {};

                return (
                  <tr key={caller.id}>
                    <td>
                      <strong>
                        {caller.name}
                      </strong>
                      <br />
                      <small>
                        {caller.email}
                      </small>
                    </td>
                    <td>
                      {caller.currentNiche ||
                        "—"}
                    </td>
                    <td>
                      <input
                        list="daily-lead-niche-options"
                        value={
                          plan.niche ??
                          caller.nextNiche ??
                          ""
                        }
                        onChange={(event) =>
                          setCallerPlan(
                            caller.id,
                            "niche",
                            event.target.value
                          )
                        }
                        placeholder="Next niche"
                      />
                    </td>
                    <td>
                      <input
                        value={
                          plan.location ??
                          caller.nextLocation ??
                          ""
                        }
                        onChange={(event) =>
                          setCallerPlan(
                            caller.id,
                            "location",
                            event.target.value
                          )
                        }
                        placeholder="Use default location"
                      />
                    </td>
                    <td>
                      {caller.workedToday || 0}
                      /{caller.assignedToday || 0}
                      {caller.remainingToday
                        ? ` · ${caller.remainingToday} remaining`
                        : ""}
                    </td>
                    <td>
                      {formatSubmission(
                        caller.submission
                      )}
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function normalizeList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(",");

  return uniqueStrings(
    source
      .map((item) =>
        String(item || "").trim()
      )
      .filter(Boolean)
  );
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString();
}

function formatSubmission(submission) {
  if (!submission) {
    return "Not submitted";
  }

  if (
    submission.status ===
    "missed_deadline"
  ) {
    return "Missed deadline";
  }

  return submission.submittedAt
    ? `Submitted ${formatDateTime(
        submission.submittedAt
      )}`
    : "Submitted";
}
