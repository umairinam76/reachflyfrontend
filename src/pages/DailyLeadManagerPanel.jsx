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
  localPakistanLocations: [
    "Karachi",
    "Lahore",
    "Islamabad",
    "Rawalpindi",
    "Faisalabad",
    "Multan",
    "Peshawar",
    "Sialkot",
    "Gujranwala",
  ],
  regionCode: "US",
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

        setForm({
          ...DEFAULT_CONFIG,
          ...(result?.config || {}),
          callerPlans: {
            ...(result?.config
              ?.callerPlans || {}),
          },
        });
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
            .flatMap((caller) => [
              caller.currentNiche,
              caller.nextNiche,
            ])
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

  function setResourceType(
    callerId,
    value
  ) {
    setForm((current) => {
      const existing =
        current.callerPlans?.[
          callerId
        ] || {};

      const nextPlan = {
        ...existing,
        resourceType: value,
      };

      // Local means Pakistan automatically. Clearing an old international
      // market prevents a previous value such as Texas from leaking into a
      // Pakistan queue when the manager only changes the resource type.
      if (value === "local") {
        nextPlan.location = "";
        nextPlan.country = "Pakistan";
        nextPlan.regionCode = "PK";
      } else {
        if (
          existing.resourceType ===
          "local"
        ) {
          nextPlan.location = "";
        }
        nextPlan.country = "";
        nextPlan.regionCode =
          current.regionCode || "US";
      }

      return {
        ...current,
        callerPlans: {
          ...(current.callerPlans || {}),
          [callerId]: nextPlan,
        },
      };
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const callerPlans =
        normalizeCallerPlans(
          form.callerPlans || {}
        );

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
              localPakistanLocations:
                normalizeList(
                  form.localPakistanLocations
                ),
              regionCode:
                String(
                  form.regionCode || "US"
                )
                  .trim()
                  .toUpperCase(),
              callerPlans,
            },
          }
        );

      setMessage(
        "Schedule, resource types, markets, and next-day niches were saved. The scheduler was updated immediately."
      );

      setStatus((current) => ({
        ...(current || {}),
        config:
          result.config || form,
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
        "Daily queue refresh completed. ReachFly reused eligible records first and generated only the remaining shortage."
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
        <p>
          Loading daily caller controls…
        </p>
      </section>
    );
  }

  return (
    <section className="rf-panel">
      <div className="rf-panel-header">
        <div>
          <p className="rf-dashboard-eyebrow">
            Daily caller operations
          </p>
          <h2>
            Daily lead allocation
          </h2>
          <p>
            Control the refresh schedule, daily target, resource market, and next niche for every caller. Useful previous leads are reused before Google lead generation.
          </p>
        </div>

        <div
          style={pillStyle}
          title="The next scheduled queue rollover"
        >
          <span
            style={{
              opacity: 0.66,
              fontSize: 12,
            }}
          >
            Next refresh
          </span>
          <strong>
            {formatDateTime(
              status?.nextRunAt
            ) || "Not scheduled"}
          </strong>
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

      <div style={settingsGridStyle}>
        <Field label="Automation">
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
        </Field>

        <Field label="Daily refresh time">
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
        </Field>

        <Field label="Timezone">
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
        </Field>

        <Field label="Leads per caller">
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
        </Field>

        <Field label="Default niches">
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
        </Field>

        <Field label="International markets">
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
            placeholder="California, Texas, Ontario"
          />
        </Field>
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
            : "Save daily plan"}
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
        <table style={tableStyle}>
          <thead>
            <tr>
              <th align="left">Caller</th>
              <th align="left">Resource type</th>
              <th align="left">Today</th>
              <th align="left">Next niche</th>
              <th align="left">Next market</th>
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
                const resourceType =
                  plan.resourceType ??
                  caller.nextResourceType ??
                  "international";
                const isLocal =
                  resourceType === "local";

                return (
                  <tr key={caller.id}>
                    <td style={cellStyle}>
                      <strong>
                        {caller.name}
                      </strong>
                      <br />
                      <small>
                        {caller.email}
                      </small>
                    </td>

                    <td style={cellStyle}>
                      <select
                        value={resourceType}
                        onChange={(event) =>
                          setResourceType(
                            caller.id,
                            event.target.value
                          )
                        }
                        style={{
                          minWidth: 150,
                        }}
                      >
                        <option value="international">
                          International
                        </option>
                        <option value="local">
                          Local · Pakistan
                        </option>
                      </select>
                    </td>

                    <td style={cellStyle}>
                      <strong>
                        {caller.currentNiche ||
                          "—"}
                      </strong>
                      <div style={mutedStyle}>
                        {formatResourceType(
                          caller.currentResourceType
                        )}
                        {caller.currentLocation
                          ? ` · ${caller.currentLocation}`
                          : ""}
                      </div>
                    </td>

                    <td style={cellStyle}>
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
                        style={{
                          minWidth: 180,
                        }}
                      />
                    </td>

                    <td style={cellStyle}>
                      {isLocal ? (
                        <div>
                          <strong>
                            Pakistan
                          </strong>
                          <div style={mutedStyle}>
                            {plan.location
                              ? plan.location
                              : `Auto city rotation · ${caller.nextLocation || "Pakistan"}`}
                          </div>
                          <input
                            value={
                              plan.location || ""
                            }
                            onChange={(event) =>
                              setCallerPlan(
                                caller.id,
                                "location",
                                event.target.value
                              )
                            }
                            placeholder="Optional Pakistan city"
                            style={{
                              minWidth: 190,
                              marginTop: 6,
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gap: 6,
                          }}
                        >
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
                            placeholder="Texas / Ontario / London"
                            style={{
                              minWidth: 190,
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                            }}
                          >
                            <input
                              value={
                                plan.country ??
                                caller.nextCountry ??
                                ""
                              }
                              onChange={(event) =>
                                setCallerPlan(
                                  caller.id,
                                  "country",
                                  event.target.value
                                )
                              }
                              placeholder="Country"
                              style={{
                                minWidth: 120,
                              }}
                            />
                            <input
                              value={
                                plan.regionCode ??
                                caller.nextRegionCode ??
                                form.regionCode ??
                                "US"
                              }
                              maxLength={2}
                              onChange={(event) =>
                                setCallerPlan(
                                  caller.id,
                                  "regionCode",
                                  event.target.value
                                    .toUpperCase()
                                )
                              }
                              placeholder="US"
                              title="Google Places region code"
                              style={{ width: 62 }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    <td style={cellStyle}>
                      <strong>
                        {caller.workedToday || 0}
                        /{caller.assignedToday || 0}
                      </strong>
                      <div style={mutedStyle}>
                        {caller.remainingToday || 0}{" "}
                        remaining
                      </div>
                    </td>

                    <td style={cellStyle}>
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

      <div style={noteStyle}>
        <strong>Local resource rule:</strong>{" "}
        when a manager selects Local, ReachFly forces Google lead generation to Pakistan with region code PK. The manager does not need to enter a country. An optional Pakistan city can be supplied; otherwise the system rotates callers across configured Pakistan cities. International callers continue to use the selected international market.
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label
      style={{
        display: "grid",
        gap: 7,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          opacity: 0.72,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function normalizeCallerPlans(value) {
  return Object.fromEntries(
    Object.entries(value || {}).map(
      ([callerId, plan]) => {
        const resourceType =
          plan?.resourceType === "local"
            ? "local"
            : "international";

        return [
          callerId,
          {
            ...plan,
            resourceType,
            niche: String(
              plan?.niche || ""
            ).trim(),
            location: String(
              plan?.location || ""
            ).trim(),
            country:
              resourceType === "local"
                ? "Pakistan"
                : String(
                    plan?.country || ""
                  ).trim(),
            regionCode:
              resourceType === "local"
                ? "PK"
                : String(
                    plan?.regionCode || ""
                  )
                    .trim()
                    .toUpperCase(),
          },
        ];
      }
    )
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

function formatResourceType(value) {
  if (!value) return "";
  return value === "local"
    ? "Local · Pakistan"
    : "International";
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

const settingsGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const pillStyle = {
  display: "grid",
  gap: 2,
  minWidth: 210,
  padding: "10px 12px",
  border: "1px solid rgba(127,127,127,.24)",
  borderRadius: 12,
};

const tableStyle = {
  width: "100%",
  minWidth: 1120,
  borderCollapse: "separate",
  borderSpacing: 0,
};

const cellStyle = {
  padding: "12px 10px",
  verticalAlign: "top",
  borderTop:
    "1px solid rgba(127,127,127,.14)",
};

const mutedStyle = {
  marginTop: 3,
  fontSize: 12,
  opacity: 0.62,
};

const noteStyle = {
  marginTop: 18,
  padding: "12px 14px",
  borderRadius: 12,
  background:
    "rgba(127,127,127,.08)",
  fontSize: 13,
  lineHeight: 1.55,
};
