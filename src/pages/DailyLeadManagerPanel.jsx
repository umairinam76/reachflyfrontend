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

import AuditStudioPanel from "./AuditStudioPanel.jsx";

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
  defaultWebsiteCalls: 80,
  defaultGmbCalls: 20,
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
  const [runningCallerId, setRunningCallerId] =
    useState("");
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

  function setCallerTime(
    callerId,
    value
  ) {
    const [hour, minute] =
      String(value || "")
        .split(":")
        .map(Number);

    if (
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      !Number.isInteger(minute) ||
      minute < 0 ||
      minute > 59
    ) {
      return;
    }

    setForm((current) => ({
      ...current,
      callerPlans: {
        ...(current.callerPlans || {}),
        [callerId]: {
          ...(current.callerPlans?.[
            callerId
          ] || {}),
          assignmentHour: hour,
          assignmentMinute: minute,
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

  function setCallerCallMix(
    callerId,
    kind,
    value
  ) {
    const total = Math.max(
      1,
      Number(form.leadsPerCaller || 100)
    );
    const nextValue = Math.max(
      0,
      Math.min(total, Number(value || 0))
    );

    setForm((current) => {
      const existing =
        current.callerPlans?.[callerId] || {};
      const currentWebsite =
        Number.isFinite(Number(existing.websiteCalls))
          ? Number(existing.websiteCalls)
          : Math.round(total * 0.8);
      const currentGmb =
        Number.isFinite(Number(existing.gmbCalls))
          ? Number(existing.gmbCalls)
          : Math.max(0, total - currentWebsite);

      const websiteCalls =
        kind === "website"
          ? nextValue
          : Math.max(0, total - nextValue);
      const gmbCalls =
        kind === "gmb"
          ? nextValue
          : Math.max(0, total - nextValue);

      return {
        ...current,
        callerPlans: {
          ...(current.callerPlans || {}),
          [callerId]: {
            ...existing,
            websiteCalls,
            gmbCalls,
          },
        },
      };
    });
  }

  function buildConfigPayload() {
    const callerPlans =
      normalizeCallerPlans(
        form.callerPlans || {}
      );

    return {
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
    };
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
            body:
              buildConfigPayload(),
          }
        );

      setMessage(
        "Caller times, Website/GMB call mix, resource types, markets, and niches were saved. If today already has a queue, use Override + assign now to replace only that caller's unworked tasks with the new mix."
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

  async function runCallerNow(caller) {
    if (!caller?.id) return;

    const hasTodayQueue =
      Number(
        caller.assignedToday ||
          0
      ) > 0;

    if (
      hasTodayQueue &&
      typeof window !==
        "undefined" &&
      !window.confirm(
        `Replace ${caller.name || "this caller"}'s unworked tasks for today and assign a fresh queue now? Already-worked/completed leads will stay in history.`
      )
    ) {
      return;
    }

    setRunningCallerId(
      caller.id
    );
    setError("");
    setMessage("");

    try {
      // Save the row first so Assign Now always uses the manager's current
      // time/resource/niche/market selections, even if Save daily plan was
      // not clicked separately.
      await apiRequest(
        "/daily-leads/config",
        {
          method: "PUT",
          body:
            buildConfigPayload(),
        }
      );

      const result =
        await apiRequest(
          "/daily-leads/run",
          {
            method: "POST",
            body: {
              force: true,
              callerId:
                caller.id,
              overrideToday:
                hasTodayQueue,
              source:
                hasTodayQueue
                  ? "manager-override-now"
                  : "manager-assign-now",
            },
            timeoutMs: 120_000,
          }
        );

      const overridden =
        Number(
          result?.run
            ?.overriddenCount ||
            0
        );

      setMessage(
        hasTodayQueue
          ? `${caller.name || "Caller"}: ${overridden} unworked task${overridden === 1 ? " was" : "s were"} replaced and today's queue was assigned now. Worked/completed history was preserved.`
          : `${caller.name || "Caller"}: today's lead queue was assigned now using the current manager settings.`
      );

      await load({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "This caller's queue could not be assigned now."
      );
    } finally {
      setRunningCallerId("");
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
    <>
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
            Set a separate daily lead-delivery time, Website/GMB call mix, resource type, niche, and market for every caller. For example, a 100-lead caller can be set to 50 Website calls + 50 GMB calls. You can assign one caller now or override only that caller's unworked tasks to apply a changed mix today.
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

        <Field label="Default refresh time">
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
              <th align="left">Lead time</th>
              <th align="left">Website / GMB calls</th>
              <th align="left">Today</th>
              <th align="left">Next niche</th>
              <th align="left">Next market</th>
              <th align="left">Progress</th>
              <th align="left">Submission</th>
              <th align="left">Action</th>
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
                const callerHour =
                  plan.assignmentHour ??
                  caller.assignmentHour ??
                  form.assignmentHour ??
                  4;
                const callerMinute =
                  plan.assignmentMinute ??
                  caller.assignmentMinute ??
                  form.assignmentMinute ??
                  0;
                const callerTimeValue =
                  `${String(callerHour).padStart(2, "0")}:${String(callerMinute).padStart(2, "0")}`;
                const dailyTotal = Math.max(
                  1,
                  Number(form.leadsPerCaller || 100)
                );
                const websiteCalls =
                  Number.isFinite(Number(plan.websiteCalls))
                    ? Number(plan.websiteCalls)
                    : Number.isFinite(Number(caller.websiteCalls))
                      ? Number(caller.websiteCalls)
                      : Math.round(dailyTotal * 0.8);
                const gmbCalls =
                  Number.isFinite(Number(plan.gmbCalls))
                    ? Number(plan.gmbCalls)
                    : Number.isFinite(Number(caller.gmbCalls))
                      ? Number(caller.gmbCalls)
                      : Math.max(0, dailyTotal - websiteCalls);

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
                      <input
                        type="time"
                        value={callerTimeValue}
                        onChange={(event) =>
                          setCallerTime(
                            caller.id,
                            event.target.value
                          )
                        }
                        style={{ minWidth: 118 }}
                      />
                      <div style={mutedStyle}>
                        Next: {formatDateTime(
                          caller.nextRefreshAt
                        ) || "—"}
                      </div>
                    </td>

                    <td style={cellStyle}>
                      <div style={{ display: "grid", gap: 6, minWidth: 190 }}>
                        <label style={mixLabelStyle}>
                          <span>Website</span>
                          <input
                            type="number"
                            min="0"
                            max={dailyTotal}
                            value={websiteCalls}
                            onChange={(event) =>
                              setCallerCallMix(
                                caller.id,
                                "website",
                                event.target.value
                              )
                            }
                            style={{ width: 76 }}
                          />
                        </label>
                        <label style={mixLabelStyle}>
                          <span>GMB</span>
                          <input
                            type="number"
                            min="0"
                            max={dailyTotal}
                            value={gmbCalls}
                            onChange={(event) =>
                              setCallerCallMix(
                                caller.id,
                                "gmb",
                                event.target.value
                              )
                            }
                            style={{ width: 76 }}
                          />
                        </label>
                        <div style={mutedStyle}>
                          Today: {caller.websiteAssignedToday || 0} Website · {caller.gmbAssignedToday || 0} GMB
                        </div>
                      </div>
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

                    <td style={cellStyle}>
                      <button
                        type="button"
                        className="rf-button rf-button--secondary"
                        onClick={() =>
                          void runCallerNow(
                            caller
                          )
                        }
                        disabled={
                          Boolean(
                            runningCallerId
                          )
                        }
                        style={{
                          whiteSpace:
                            "nowrap",
                        }}
                        title={
                          Number(
                            caller.assignedToday ||
                              0
                          ) > 0
                            ? "Replace this caller's unworked tasks for today, preserve worked/completed history, and assign a fresh queue now."
                            : "Assign today's queue immediately without waiting for the saved lead time."
                        }
                      >
                        {runningCallerId ===
                        caller.id
                          ? "Assigning…"
                          : Number(
                                caller.assignedToday ||
                                  0
                              ) > 0
                            ? "Override + assign now"
                            : "Assign now"}
                      </button>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>

      <div style={noteStyle}>
        <strong>Per-caller schedule:</strong>{" "}
        each caller can have a different lead time. For example, if Caller 1 is Local · Pakistan at 19:00, that caller receives today's queue at 19:00 Asia/Karachi while other callers keep their own saved times. Saving a past time catches up a caller whose queue is still short. Use <strong>Assign now</strong> to deliver immediately, or <strong>Override + assign now</strong> to replace only that caller's unworked tasks for today while preserving worked/completed history. {" "}
        <strong>Call mix:</strong>{" "}
        Website + GMB calls are saved separately for every caller and are normalized to that caller's daily target. To change an already-assigned queue today, use <strong>Override + assign now</strong>. {" "}
        <strong>Audit formats:</strong>{" "}
        upload the Website / Technology and GMB / Local Visibility PDF examples in Audit Studio below before callers work those campaigns. {" "}
        <strong>Local resource rule:</strong>{" "}
        Local always uses Pakistan / PK; leaving the city blank keeps automatic Pakistan city rotation.
      </div>
    </section>

      <AuditStudioPanel />
    </>
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
            assignmentHour:
              isValidScheduleNumber(
                plan?.assignmentHour,
                0,
                23
              )
                ? Number(plan.assignmentHour)
                : undefined,
            assignmentMinute:
              isValidScheduleNumber(
                plan?.assignmentMinute,
                0,
                59
              )
                ? Number(plan.assignmentMinute)
                : undefined,
            websiteCalls:
              isValidScheduleNumber(
                plan?.websiteCalls,
                0,
                5000
              )
                ? Number(plan.websiteCalls)
                : undefined,
            gmbCalls:
              isValidScheduleNumber(
                plan?.gmbCalls,
                0,
                5000
              )
                ? Number(plan.gmbCalls)
                : undefined,
          },
        ];
      }
    )
  );
}

function isValidScheduleNumber(
  value,
  min,
  max
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return false;
  }

  const number = Number(value);
  return (
    Number.isInteger(number) &&
    number >= min &&
    number <= max
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

const mixLabelStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 12,
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
  minWidth: 1510,
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
