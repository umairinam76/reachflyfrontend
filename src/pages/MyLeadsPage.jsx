import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  apiRequest,
  getAccessToken,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import "../styles.css";
// import "../styles/assigned-lead-filters.css";

const BUCKETS = [
  {
    value:
      "current",
    label:
      "Current tasks",
  },
  {
    value:
      "due",
    label:
      "Due now",
  },
  {
    value:
      "follow_ups",
    label:
      "Follow-ups",
  },
  {
    value:
      "missed",
    label:
      "Missed leads",
  },
  {
    value:
      "completed",
    label:
      "Completed",
  },
  {
    value:
      "all",
    label:
      "All leads",
  },
];

const QUEUE_CACHE_VERSION = 2;
const QUEUE_CACHE_TTL_MS =
  5 * 60 * 1000;
const QUEUE_PAGE_LIMIT = 200;

function getQueueCacheKey(bucket) {
  const token =
    getAccessToken() || "anonymous";

  const sessionKey =
    token.slice(-18);

  return [
    "reachfly",
    "caller-queue",
    QUEUE_CACHE_VERSION,
    sessionKey,
    bucket,
  ].join(":");
}

function readQueueCache(bucket) {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        getQueueCacheKey(bucket)
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      !Array.isArray(parsed.records) ||
      Date.now() -
        Number(parsed.updatedAt || 0) >
        QUEUE_CACHE_TTL_MS
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeQueueCache(
  bucket,
  {
    records = [],
    counts = {},
  } = {}
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getQueueCacheKey(bucket),
      JSON.stringify({
        updatedAt: Date.now(),
        records:
          Array.isArray(records)
            ? records.slice(
                0,
                QUEUE_PAGE_LIMIT
              )
            : [],
        counts:
          counts &&
          typeof counts === "object"
            ? counts
            : {},
      })
    );
  } catch {
    // Cache failures must never block the queue.
  }
}

const OUTCOMES = [
  [
    "qualified",
    "Qualified",
  ],
  [
    "meeting_booked",
    "Meeting booked",
  ],
  [
    "callback",
    "Callback",
  ],
  [
    "follow_up",
    "Follow-up",
  ],
  [
    "no_answer",
    "No answer",
  ],
  [
    "busy",
    "Busy",
  ],
  [
    "voicemail",
    "Voicemail",
  ],
  [
    "not_interested",
    "Not interested",
  ],
  [
    "invalid_number",
    "Invalid number",
  ],
  [
    "do_not_call",
    "Do not call",
  ],
];

export default function MyLeadsPage() {
  const navigate =
    useNavigate();

  const initialCacheRef =
    useRef(
      readQueueCache("current")
    );

  const loadSequenceRef =
    useRef(0);

  const socketRefreshTimerRef =
    useRef(null);

  const [
    bucket,
    setBucket,
  ] = useState(
    "current"
  );

  const [
    records,
    setRecords,
  ] = useState(
    () =>
      initialCacheRef.current
        ?.records || []
  );

  const [
    counts,
    setCounts,
  ] = useState(
    () =>
      initialCacheRef.current
        ?.counts || {}
  );

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    campaignFilter,
    setCampaignFilter,
  ] = useState("all");

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState("all");

  const [
    sortBy,
    setSortBy,
  ] = useState("next_action");

  const [
    loading,
    setLoading,
  ] = useState(
    () =>
      !initialCacheRef.current
  );

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    dailyDay,
    setDailyDay,
  ] = useState(null);

  const [
    submittingDay,
    setSubmittingDay,
  ] = useState(false);

  const [
    outcome,
    setOutcome,
  ] = useState(
    "qualified"
  );

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    callbackAt,
    setCallbackAt,
  ] = useState("");

  const request =
    useCallback(
      (
        path,
        options = {}
      ) =>
        apiRequest(
          path,
          {
            ...options,
            timeoutMs:
              options.timeoutMs ||
              45_000,
          }
        ),
      []
    );

  const loadDailyDay =
    useCallback(
      async () => {
        try {
          const response =
            await request(
              "/daily-leads/my-day"
            );

          setDailyDay(response);
        } catch (
          requestError
        ) {
          console.warn(
            "[MyLeadsPage] Daily status could not be loaded:",
            requestError
          );
        }
      },
      [request]
    );

  async function submitDailyWork() {
    setSubmittingDay(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await request(
          "/daily-leads/my-day/submit",
          {
            method: "POST",
            body: {},
          }
        );

      setDailyDay((current) => ({
        ...(current || {}),
        submission:
          response.submission ||
          current?.submission ||
          null,
      }));

      setSuccess(
        "Today's caller work was submitted successfully."
      );
    } catch (
      requestError
    ) {
      setError(
        requestError?.message ||
          "Today's caller work could not be submitted."
      );
    } finally {
      setSubmittingDay(false);
    }
  }

  const load =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        const sequence =
          ++loadSequenceRef.current;

        if (!silent) {
          setLoading(true);
        }

        if (silent) {
          setRefreshing(true);
        }

        setError("");

        try {
          const response =
            await request(
              "/caller-queue",
              {
                query: {
                  bucket,
                  limit:
                    QUEUE_PAGE_LIMIT,
                },
                timeoutMs:
                  45_000,
              }
            );

          if (
            sequence !==
            loadSequenceRef.current
          ) {
            return;
          }

          const nextRecords =
            Array.isArray(
              response?.records
            )
              ? response.records
              : [];

          const nextCounts =
            response?.counts &&
            typeof response.counts ===
              "object"
              ? response.counts
              : {};

          setRecords(nextRecords);
          setCounts(nextCounts);

          writeQueueCache(
            bucket,
            {
              records:
                nextRecords,
              counts:
                nextCounts,
            }
          );

          setSelected(
            (current) => {
              if (!current) {
                return null;
              }

              return (
                nextRecords.find(
                  (item) =>
                    item.id ===
                    current.id
                ) ||
                current
              );
            }
          );
        } catch (
          requestError
        ) {
          if (
            sequence !==
            loadSequenceRef.current
          ) {
            return;
          }

          const cached =
            readQueueCache(
              bucket
            );

          /*
           * A caller must not lose the task list because one refresh is slow.
           * Keep the last successful daily queue on screen and retry on the
           * normal focus/socket/30-second refresh cycle.
           */
          if (
            cached?.records?.length
          ) {
            setRecords(
              cached.records
            );
            setCounts(
              cached.counts || {}
            );

            console.warn(
              "[MyLeadsPage] Queue refresh failed; keeping cached queue:",
              requestError
            );

            setError("");
          } else {
            setError(
              requestError?.message ||
                "The caller queue could not be loaded."
            );
          }
        } finally {
          if (
            sequence ===
            loadSequenceRef.current
          ) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      },
      [
        bucket,
        request,
      ]
    );

  useEffect(() => {
    const cached =
      readQueueCache(bucket);

    if (cached) {
      setRecords(
        cached.records
      );
      setCounts(
        cached.counts || {}
      );
      setLoading(false);
    } else {
      setRecords([]);
      setLoading(true);
    }

    setSelected(null);

    void load({
      silent:
        Boolean(cached),
    });

    void loadDailyDay();
  }, [
    bucket,
    load,
    loadDailyDay,
  ]);

  useEffect(() => {
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
        30_000
      );

    window.addEventListener(
      "focus",
      refreshWhenVisible
    );

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible
    );

    return () => {
      window.clearInterval(timer);

      window.removeEventListener(
        "focus",
        refreshWhenVisible
      );

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible
      );
    };
  }, [
    load,
  ]);

  useEffect(() => {
    const scheduleRefresh =
      () => {
        window.clearTimeout(
          socketRefreshTimerRef.current
        );

        socketRefreshTimerRef.current =
          window.setTimeout(() => {
            void load({
              silent: true,
            });
          }, 250);
      };

    const subscriptions = [
      onWorkspaceSocket(
        "lead:updated",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "lead:call-updated",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "daily-leads:completed",
        () => {
          scheduleRefresh();
          void loadDailyDay();
        }
      ),
      onWorkspaceSocket(
        "daily-leads:config-updated",
        () => void loadDailyDay()
      ),
      onWorkspaceSocket(
        "daily-leads:submitted",
        () => void loadDailyDay()
      ),
    ];

    return () => {
      window.clearTimeout(
        socketRefreshTimerRef.current
      );

      subscriptions.forEach(
        (unsubscribe) =>
          unsubscribe()
      );
    };
  }, [
    load,
    loadDailyDay,
  ]);

  const campaignOptions =
    useMemo(() => {
      const map = new Map();

      for (const assignment of records) {
        if (assignment.campaignId) {
          map.set(
            assignment.campaignId,
            assignment.campaignName ||
              "Untitled campaign"
          );
        }
      }

      return [...map.entries()].sort(
        (left, right) =>
          left[1].localeCompare(
            right[1]
          )
      );
    }, [records]);

  const filtered =
    useMemo(
      () => {
        const value =
          search
            .trim()
            .toLowerCase();

        const next = records.filter(
          (assignment) => {
            const lead =
              assignment.lead ||
              {};

            if (
              campaignFilter !==
                "all" &&
              assignment.campaignId !==
                campaignFilter
            ) {
              return false;
            }

            const priority = String(
              assignment.priority ||
                lead.priority ||
                "normal"
            )
              .trim()
              .toLowerCase();

            if (
              priorityFilter !==
                "all" &&
              priority !==
                priorityFilter
            ) {
              return false;
            }

            if (!value) {
              return true;
            }

            return [
              lead.business,
              lead.name,
              lead.phone,
              lead.email,
              lead.website,
              lead.address,
              assignment.campaignName,
              assignment.assignedByName,
              assignment.status,
              assignment.priority,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(
                value
              );
          }
        );

        return [...next].sort(
          (left, right) => {
            if (sortBy === "newest") {
              return (
                Date.parse(
                  right.assignedAt ||
                    right.createdAt ||
                    0
                ) || 0
              ) - (
                Date.parse(
                  left.assignedAt ||
                    left.createdAt ||
                    0
                ) || 0
              );
            }

            if (sortBy === "priority") {
              const weights = {
                urgent: 4,
                high: 3,
                normal: 2,
                low: 1,
              };

              return (
                weights[
                  right.priority ||
                    "normal"
                ] || 0
              ) - (
                weights[
                  left.priority ||
                    "normal"
                ] || 0
              );
            }

            const leftTime =
              Date.parse(
                left.nextActionAt ||
                  left.followUpAt ||
                  left.callbackAt ||
                  left.assignedAt ||
                  0
              ) || Number.MAX_SAFE_INTEGER;

            const rightTime =
              Date.parse(
                right.nextActionAt ||
                  right.followUpAt ||
                  right.callbackAt ||
                  right.assignedAt ||
                  0
              ) || Number.MAX_SAFE_INTEGER;

            return leftTime - rightTime;
          }
        );
      },
      [
        campaignFilter,
        priorityFilter,
        records,
        search,
        sortBy,
      ]
    );

  async function openLead(
    assignment
  ) {
    setSelected(
      assignment
    );

    setNotes(
      assignment.notes ||
      ""
    );

    setOutcome(
      "qualified"
    );

    setCallbackAt(
      ""
    );

    try {
      const response =
        await request(
          `/caller-queue/${encodeURIComponent(
            assignment.id
          )}/open`,
          {
            method:
              "POST",
          }
        );

      replaceAssignment(
        response.assignment
      );
    } catch {
      // Opening the drawer should remain usable even if telemetry fails.
    }
  }

  async function callLead(
    assignment
  ) {
    const lead = assignment.lead || {};

    if (!lead.phone) {
      setError(
        "This lead does not have a phone number."
      );
      return;
    }

    setError("");

    navigate(
      `/app/call-workspace?assignmentId=${encodeURIComponent(
        assignment.id
      )}&leadId=${encodeURIComponent(
        assignment.leadId || lead.id || ""
      )}`
    );
  }

  async function saveOutcome() {
    if (!selected) {
      return;
    }

    const requiresDate =
      [
        "callback",
        "follow_up",
      ].includes(
        outcome
      );

    if (
      requiresDate &&
      !callbackAt
    ) {
      setError(
        "Select the callback or follow-up date and time."
      );

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const body = {
        outcome,
        notes,
        ...(outcome ===
          "callback"
          ? {
              callbackAt:
                new Date(
                  callbackAt
                ).toISOString(),
            }
          : {}),
        ...(outcome ===
          "follow_up"
          ? {
              followUpAt:
                new Date(
                  callbackAt
                ).toISOString(),
            }
          : {}),
      };

      const response =
        await request(
          `/caller-queue/${encodeURIComponent(
            selected.id
          )}/call/complete`,
          {
            method:
              "POST",
            body,
          }
        );

      setSuccess(
        `Outcome saved: ${formatLabel(
          outcome
        )}.`
      );

      const completed =
        response.assignment;

      setRecords(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              completed.id
          )
      );

      setSelected(
        null
      );

      /*
       * The outcome is already durably saved at this point. Release the caller
       * immediately; refresh the queue and open the next lead in parallel
       * instead of making the user wait for two more network round trips.
       */
      setSaving(false);

      void load({
        silent:
          true,
      });

      void openNextLead();
    } catch (
      requestError
    ) {
      setError(
        requestError?.message ||
        "The call outcome could not be saved."
      );

      setSaving(false);
    }
  }

  async function skipSelected() {
    if (!selected) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await request(
        `/caller-queue/${encodeURIComponent(
          selected.id
        )}/skip`,
        {
          method:
            "POST",
          body: {
            delayMinutes:
              60,
            reason:
              "Skipped by caller",
          },
        }
      );

      setRecords(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              selected.id
          )
      );

      setSelected(
        null
      );

      setSaving(false);

      void load({
        silent:
          true,
      });

      void openNextLead();
    } catch (
      requestError
    ) {
      setError(
        requestError?.message ||
        "The lead could not be skipped."
      );

      setSaving(false);
    }
  }

  async function openNextLead() {
    try {
      const response =
        await request(
          `/caller-queue/next?bucket=${encodeURIComponent(
            bucket
          )}`
        );

      if (
        response.assignment
      ) {
        await openLead(
          response.assignment
        );
      }
    } catch {
      // No eligible lead is a normal queue state.
    }
  }

  function replaceAssignment(
    updated
  ) {
    if (!updated) {
      return;
    }

    setRecords(
      (current) =>
        current.map(
          (item) =>
            item.id ===
              updated.id
              ? updated
              : item
        )
    );

    setSelected(
      (current) =>
        current?.id ===
          updated.id
          ? updated
          : current
    );
  }

  return (
    <main className="caller-queue-page">
      <header className="caller-queue-heading">
        <div>
          <span className="eyebrow">
            Caller workspace
          </span>

          <h1>
            My lead queue
          </h1>

          <p>
            Work the next eligible lead, record the outcome, and let ReachFly schedule every retry automatically.
          </p>
        </div>

        <div className="caller-queue-heading__actions">
          <button
            type="button"
            className="btn light"
            onClick={() =>
              void load()
            }
          >
            Refresh
          </button>

          <button
            type="button"
            className="btn primary"
            onClick={() =>
              void openNextLead()
            }
          >
            Call next lead
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="success-banner">
          {success}
        </div>
      ) : null}

      <DailyWorkPanel
        dailyDay={dailyDay}
        submitting={submittingDay}
        onSubmit={() =>
          void submitDailyWork()
        }
      />

      <nav className="caller-queue-tabs">
        {BUCKETS.map(
          (item) => (
            <button
              key={
                item.value
              }
              type="button"
              className={
                bucket ===
                item.value
                  ? "active"
                  : ""
              }
              onClick={() => {
                setBucket(
                  item.value
                );
                setSelected(
                  null
                );
              }}
            >
              <span>
                {item.label}
              </span>

              <b>
                {counts[
                  item.value
                ] || 0}
              </b>
            </button>
          )
        )}
      </nav>

      <div className="caller-queue-toolbar caller-queue-toolbar--filters">
        <label className="caller-filter-search">
          <span>Search assigned leads</span>
          <input
            value={
              search
            }
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
            placeholder="Business, phone, email, website or campaign"
          />
        </label>

        <label>
          <span>Campaign</span>
          <select
            value={campaignFilter}
            onChange={(event) =>
              setCampaignFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All campaigns
            </option>
            {campaignOptions.map(
              ([id, name]) => (
                <option
                  key={id}
                  value={id}
                >
                  {name}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          <span>Priority</span>
          <select
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All priorities
            </option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label>
          <span>Sort</span>
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(
                event.target.value
              )
            }
          >
            <option value="next_action">
              Next action first
            </option>
            <option value="newest">
              Newly assigned
            </option>
            <option value="priority">
              Highest priority
            </option>
          </select>
        </label>

        <span className="caller-filter-count">
          {filtered.length} displayed
          {refreshing
            ? " · Updating…"
            : ""}
        </span>
      </div>

      {loading &&
      !filtered.length ? (
        <div className="caller-queue-loading">
          Loading caller queue…
        </div>
      ) : filtered.length ? (
        <section className="caller-queue-grid">
          {filtered.map(
            (assignment) => (
              <LeadCard
                key={
                  assignment.id
                }
                assignment={
                  assignment
                }
                onOpen={() =>
                  void openLead(
                    assignment
                  )
                }
                onCall={() =>
                  void callLead(
                    assignment
                  )
                }
              />
            )
          )}
        </section>
      ) : (
        <section className="caller-queue-empty">
          <strong>
            No leads in this queue
          </strong>

          <p>
            Due missed leads and follow-ups will return automatically at their scheduled time.
          </p>
        </section>
      )}

      {selected ? (
        <div
          className="caller-workspace-backdrop"
          onClick={() =>
            setSelected(
              null
            )
          }
        >
          <section
            className="caller-workspace"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <header>
              <div>
                <span className="eyebrow">
                  Active lead
                </span>

                <h2>
                  {getLeadName(
                    selected
                  )}
                </h2>

                <p>
                  {selected.lead
                    ?.phone ||
                    "No phone number"}
                </p>
              </div>

              <button
                type="button"
                className="caller-workspace__close"
                onClick={() =>
                  setSelected(
                    null
                  )
                }
              >
                ×
              </button>
            </header>

            <div className="caller-workspace__layout">
              <div className="caller-workspace__main">
                <LeadSummary
                  assignment={
                    selected
                  }
                />

                <button
                  type="button"
                  className="btn primary full"
                  disabled={
                    saving ||
                    !selected.lead
                      ?.phone
                  }
                  onClick={() =>
                    void callLead(
                      selected
                    )
                  }
                >
                  Call lead
                </button>

                <label>
                  <span>
                    Call outcome
                  </span>

                  <select
                    value={
                      outcome
                    }
                    onChange={(
                      event
                    ) =>
                      setOutcome(
                        event.target
                          .value
                      )
                    }
                  >
                    {OUTCOMES.map(
                      ([
                        value,
                        label,
                      ]) => (
                        <option
                          key={
                            value
                          }
                          value={
                            value
                          }
                        >
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                {[
                  "callback",
                  "follow_up",
                ].includes(
                  outcome
                ) ? (
                  <label>
                    <span>
                      Next call date and time
                    </span>

                    <input
                      type="datetime-local"
                      value={
                        callbackAt
                      }
                      onChange={(
                        event
                      ) =>
                        setCallbackAt(
                          event.target
                            .value
                        )
                      }
                    />
                  </label>
                ) : null}

                <label>
                  <span>
                    Notes
                  </span>

                  <textarea
                    value={
                      notes
                    }
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Decision maker, objections, agreed next action and useful context"
                  />
                </label>

                <div className="caller-workspace__buttons">
                  <button
                    type="button"
                    className="btn light"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      void skipSelected()
                    }
                  >
                    Skip for one hour
                  </button>

                  <button
                    type="button"
                    className="btn primary"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      void saveOutcome()
                    }
                  >
                    {saving
                      ? "Saving…"
                      : "Save and open next"}
                  </button>
                </div>
              </div>

              <aside className="caller-workspace__audit">
                <span className="eyebrow">
                  Mini audit
                </span>

                {selected.miniAudit ||
                selected.lead
                  ?.miniAudit ? (
                  <MiniAudit
                    audit={
                      selected.miniAudit ||
                      selected.lead
                        .miniAudit
                    }
                  />
                ) : (
                  <div className="caller-audit-pending">
                    <strong>
                      Audit is being prepared
                    </strong>

                    <p>
                      Daily automation queues mini audits for website leads before outreach.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function DailyWorkPanel({
  dailyDay,
  submitting,
  onSubmit,
}) {
  if (!dailyDay) {
    return null;
  }

  const submitted =
    dailyDay.submission?.status ===
    "submitted";

  return (
    <section
      className="cardish"
      style={{ marginBottom: 16 }}
    >
      <div className="section-title-row">
        <div>
          <span className="eyebrow">
            Daily assignment
          </span>
          <h3>
            {dailyDay.assigned || 0}/
            {dailyDay.leadsPerCaller || 100}
            {" "}leads assigned
          </h3>
          <p>
            Current niche: {dailyDay.currentNiche || "Not assigned"}
            {dailyDay.currentResourceType
              ? ` · ${formatResourceType(dailyDay.currentResourceType)}`
              : ""}
            {dailyDay.currentLocation
              ? ` · ${dailyDay.currentLocation}`
              : ""}
            {dailyDay.currentCountry &&
            !String(dailyDay.currentLocation || "")
              .toLowerCase()
              .includes(
                String(dailyDay.currentCountry).toLowerCase()
              )
              ? ` · ${dailyDay.currentCountry}`
              : ""}
          </p>
          <p>
            Next assignment: {dailyDay.nextNiche || "Use manager default niche"}
            {dailyDay.nextResourceType
              ? ` · ${formatResourceType(dailyDay.nextResourceType)}`
              : ""}
            {dailyDay.nextLocation
              ? ` · ${dailyDay.nextLocation}`
              : dailyDay.nextResourceType === "local"
                ? " · Pakistan (auto city)"
                : ""}
          </p>
          <p>
            Worked: {dailyDay.worked || 0}
            {" · "}
            Remaining: {dailyDay.remaining || 0}
            {" · "}
            Refresh/deadline: {formatDailyDateTime(
              dailyDay.nextRefreshAt
            )}
            {" "}
            ({dailyDay.timezone || ""})
          </p>
        </div>

        <span className="badge badge-neutral">
          {submitted
            ? "Submitted"
            : dailyDay.submission?.status ===
                "missed_deadline"
              ? "Missed deadline"
              : "Open day"}
        </span>
      </div>

      <div className="flex flex-gap flex-wrap mt16">
        <button
          type="button"
          className="btn primary"
          onClick={onSubmit}
          disabled={
            submitting ||
            submitted
          }
        >
          {submitting
            ? "Submitting…"
            : submitted
              ? "Day submitted"
              : "Submit today's work"}
        </button>
      </div>
    </section>
  );
}

function formatResourceType(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "local"
    ? "Local · Pakistan"
    : "International";
}

function formatDailyDateTime(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not scheduled"
    : date.toLocaleString();
}

function LeadCard({
  assignment,
  onOpen,
  onCall,
}) {
  const lead =
    assignment.lead ||
    {};

  return (
    <article className="caller-lead-card">
      <header>
        <div className="caller-lead-card__avatar">
          {initials(
            getLeadName(
              assignment
            )
          )}
        </div>

        <span className={`status status-${assignment.status}`}>
          {formatLabel(
            assignment.status
          )}
        </span>
      </header>

      <h3>
        {getLeadName(
          assignment
        )}
      </h3>

      <p>
        {lead.category ||
          assignment.campaignName ||
          "Assigned lead"}
      </p>

      <dl>
        <div>
          <dt>
            Phone
          </dt>
          <dd>
            {lead.phone ||
              "Unavailable"}
          </dd>
        </div>

        <div>
          <dt>
            Website
          </dt>
          <dd>
            {lead.website ||
              "Unavailable"}
          </dd>
        </div>

        <div>
          <dt>
            Attempts
          </dt>
          <dd>
            {assignment.callAttempts ||
              0}
          </dd>
        </div>

        <div>
          <dt>
            Next action
          </dt>
          <dd>
            {formatDateTime(
              assignment.nextActionAt
            )}
          </dd>
        </div>
      </dl>

      <footer>
        <button
          type="button"
          className="btn light"
          onClick={
            onOpen
          }
        >
          Open
        </button>

        <button
          type="button"
          className="btn primary"
          disabled={
            !lead.phone
          }
          onClick={
            onCall
          }
        >
          Call
        </button>
      </footer>
    </article>
  );
}

function LeadSummary({
  assignment,
}) {
  const lead =
    assignment.lead ||
    {};

  return (
    <section className="caller-lead-summary">
      <div>
        <small>
          Phone
        </small>
        <strong>
          {lead.phone ||
            "Unavailable"}
        </strong>
      </div>

      <div>
        <small>
          Email
        </small>
        <strong>
          {lead.email ||
            "Unavailable"}
        </strong>
      </div>

      <div>
        <small>
          Website
        </small>
        <strong>
          {lead.website ||
            "Unavailable"}
        </strong>
      </div>

      <div>
        <small>
          Location
        </small>
        <strong>
          {lead.address ||
            lead.location ||
            "Unavailable"}
        </strong>
      </div>
    </section>
  );
}

function MiniAudit({
  audit,
}) {
  const findings =
    Array.isArray(
      audit.findings
    )
      ? audit.findings
      : Array.isArray(
            audit.issues
          )
        ? audit.issues
        : [];

  return (
    <div className="caller-mini-audit">
      {audit.summary ? (
        <p>
          {audit.summary}
        </p>
      ) : null}

      {findings
        .slice(
          0,
          5
        )
        .map(
          (
            finding,
            index
          ) => (
            <article
              key={
                finding.id ||
                index
              }
            >
              <strong>
                {finding.title ||
                  finding.issue ||
                  `Finding ${
                    index + 1
                  }`}
              </strong>

              <p>
                {finding.description ||
                  finding.evidence ||
                  finding.impact ||
                  ""}
              </p>
            </article>
          )
        )}
    </div>
  );
}

function getLeadName(
  assignment
) {
  return (
    assignment.lead
      ?.business ||
    assignment.lead
      ?.name ||
    "Unnamed lead"
  );
}

function initials(
  value
) {
  return String(
    value ||
      "RF"
  )
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]
    )
    .join("")
    .toUpperCase();
}

function formatLabel(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatDateTime(
  value
) {
  if (!value) {
    return "Ready now";
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : date.toLocaleString(
        undefined,
        {
          month:
            "short",
          day:
            "numeric",
          hour:
            "numeric",
          minute:
            "2-digit",
        }
      );
}

