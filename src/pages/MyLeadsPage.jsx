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
// import "../styles/caller-workspace-refresh.css";
// import "../styles/assigned-lead-filters.css";

const BUCKETS = [
  {
    value:
      "current",
    label:
      "Today",
  },
  {
    value:
      "due",
    label:
      "Retry queue",
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
      "History",
  },
  {
    value:
      "all",
    label:
      "All leads",
  },
];

const QUEUE_CACHE_VERSION = 3;
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
        "lead:audit-updated",
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

  const queueRecords =
    useMemo(() => {
      if (
        bucket !== "current" ||
        !dailyDay?.dateKey
      ) {
        return records;
      }

      // "Today" is a true daily queue. Historical/legacy active assignments
      // stay accessible in the other buckets, but they do not flood the
      // caller's 100-lead working list.
      return records.filter(
        (assignment) =>
          String(
            assignment.dailyQueueDate ||
              assignment.assignmentDate ||
              assignment.lead?.dailyQueueDate ||
              assignment.lead?.assignmentDate ||
              ""
          ) ===
          String(
            dailyDay.dateKey
          )
      );
    }, [
      bucket,
      dailyDay?.dateKey,
      records,
    ]);

  const campaignOptions =
    useMemo(() => {
      const map = new Map();

      for (const assignment of queueRecords) {
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
    }, [queueRecords]);

  const filtered =
    useMemo(
      () => {
        const value =
          search
            .trim()
            .toLowerCase();

        const next = queueRecords.filter(
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
        queueRecords,
        search,
        sortBy,
      ]
    );

  async function openLead(
    assignment,
    {
      ensureAudit = true,
    } = {}
  ) {
    let openedAssignment =
      assignment;

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

      if (
        response?.assignment
      ) {
        openedAssignment =
          response.assignment;

        replaceAssignment(
          openedAssignment
        );
      }
    } catch {
      // Opening the drawer should remain usable even if telemetry fails.
    }

    if (
      ensureAudit &&
      !isCallerAuditReady(
        openedAssignment
      )
    ) {
      const currentStatus =
        getCallerMiniAuditStatus(
          openedAssignment
        );

      if (
        !isAuditPendingStatus(
          currentStatus
        ) &&
        !isAuditReviewStatus(
          currentStatus
        )
      ) {
        try {
          openedAssignment =
            await ensureDefaultMiniAudit(
              openedAssignment
            );

          if (
            !isCallerAuditReady(
              openedAssignment
            )
          ) {
            setError("");
            setSuccess(
              "The default Mini Audit is being prepared. Calling unlocks automatically when it is ready."
            );
          }
        } catch (
          requestError
        ) {
          setError(
            requestError?.message ||
              "The default Mini Audit could not be queued."
          );
        }
      }
    }

    return openedAssignment;
  }

  async function ensureDefaultMiniAudit(
    assignment
  ) {
    const lead =
      assignment?.lead ||
      {};

    const campaignType =
      getCampaignType(
        assignment
      ) || "website";

    const currentStatus =
      getCallerMiniAuditStatus(
        assignment
      );

    if (
      isCallerAuditReady(
        assignment
      ) ||
      isAuditPendingStatus(
        currentStatus
      )
    ) {
      return assignment;
    }

    if (
      isAuditReviewStatus(
        currentStatus
      )
    ) {
      return assignment;
    }

    const report =
      await request(
        "/lead-audits/mini",
        {
          method: "POST",
          body: {
            campaignId:
              assignment?.campaignId ||
              lead?.campaignId ||
              "",
            leadId:
              assignment?.leadId ||
              lead?.id ||
              "",
            lead,
            website:
              lead?.website ||
              "",
            campaignType,
            auditKind:
              "mini",
            auditType:
              "Mini Audit",
            niche:
              lead?.dailyNiche ||
              assignment?.niche ||
              lead?.category ||
              lead?.primaryType ||
              "",
            location:
              lead?.dailyLocation ||
              assignment?.location ||
              lead?.address ||
              lead?.formattedAddress ||
              "",
            resourceType:
              lead?.dailyResourceType ||
              lead?.resourceType ||
              assignment?.resourceType ||
              "",
            country:
              lead?.dailyCountry ||
              lead?.country ||
              assignment?.country ||
              "",
            regionCode:
              lead?.dailyRegionCode ||
              lead?.regionCode ||
              assignment?.regionCode ||
              "",
          },
        }
      );

    const nextStatus =
      normalizeAuditStatus(
        report?.status ||
          "queued"
      ) || "queued";

    const updated = {
      ...assignment,
      auditKind:
        "mini",
      auditType:
        "Mini Audit",
      auditStatus:
        nextStatus,
      miniAudit:
        report ||
        assignment?.miniAudit ||
        null,
      miniAuditStatus:
        nextStatus,
      lead: {
        ...lead,
        auditKind:
          "mini",
        auditType:
          "Mini Audit",
        auditStatus:
          nextStatus,
        miniAudit:
          report ||
          lead?.miniAudit ||
          null,
        miniAuditStatus:
          nextStatus,
      },
    };

    replaceAssignment(
      updated
    );

    return updated;
  }

  async function callLead(
    assignment
  ) {
    const lead =
      assignment.lead ||
      {};

    if (!lead.phone) {
      setError(
        "This lead does not have a phone number."
      );
      return;
    }

    let currentAssignment =
      assignment;

    if (
      !isCallerAuditReady(
        currentAssignment
      )
    ) {
      const currentStatus =
        getCallerMiniAuditStatus(
          currentAssignment
        );

      if (
        isAuditReviewStatus(
          currentStatus
        )
      ) {
        setError(
          getAuditBlockedMessage(
            currentAssignment
          )
        );
        await openLead(
          currentAssignment,
          {
            ensureAudit: false,
          }
        );
        return;
      }

      if (
        !isAuditPendingStatus(
          currentStatus
        )
      ) {
        try {
          currentAssignment =
            await ensureDefaultMiniAudit(
              currentAssignment
            );
        } catch (
          requestError
        ) {
          setError(
            requestError?.message ||
              "The default Mini Audit could not be queued."
          );
          await openLead(
            currentAssignment,
            {
              ensureAudit: false,
            }
          );
          return;
        }
      }

      if (
        !isCallerAuditReady(
          currentAssignment
        )
      ) {
        setError("");
        setSuccess(
          "The default Mini Audit is being prepared from this lead's verified public evidence. The call will unlock automatically when it is ready."
        );
        await openLead(
          currentAssignment,
          {
            ensureAudit: false,
          }
        );
        return;
      }
    }

    setError("");
    setSuccess("");

    navigate(
      `/app/call-workspace?assignmentId=${encodeURIComponent(
        currentAssignment.id
      )}&leadId=${encodeURIComponent(
        currentAssignment.leadId ||
          currentAssignment.lead?.id ||
          ""
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
                  {getAuditTypeLabel(selected)}
                </span>

                {getCallerAudit(selected) ? (
                  <CampaignAudit
                    audit={getCallerAudit(selected)}
                    campaignType={getCampaignType(selected)}
                  />
                ) : (
                  <div className="caller-audit-pending">
                    <strong>
                      {getAuditPendingTitle(selected)}
                    </strong>

                    <p>
                      {getAuditBlockedMessage(selected)}
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

  const target =
    Math.max(
      1,
      Number(
        dailyDay.leadsPerCaller ||
        100
      )
    );

  const assigned =
    Math.min(
      target,
      Math.max(
        0,
        Number(
          dailyDay.assigned ||
          0
        )
      )
    );

  const worked =
    Math.min(
      assigned,
      Math.max(
        0,
        Number(
          dailyDay.worked ||
          0
        )
      )
    );

  const remaining =
    Math.max(
      0,
      assigned - worked
    );

  const progress =
    Math.min(
      100,
      Math.round(
        (worked / target) * 100
      )
    );

  return (
    <section className="rf-daily-queue-card">
      <div className="rf-daily-queue-card__top">
        <div>
          <span className="eyebrow">
            Today's calling queue
          </span>

          <h2>
            {assigned} of {target} leads ready
          </h2>

          <p>
            Work today's queue first. ReachFly reuses existing AH Growth
            inventory before requesting new Google Places leads.
          </p>
        </div>

        <span
          className={`rf-daily-queue-status ${
            submitted
              ? "is-complete"
              : assigned >= target
                ? "is-ready"
                : "is-filling"
          }`}
        >
          {submitted
            ? "Day submitted"
            : assigned >= target
              ? "Ready to call"
              : "Filling queue"}
        </span>
      </div>

      <div className="rf-daily-queue-metrics">
        <div>
          <span>Assigned today</span>
          <strong>{assigned}</strong>
          <small>Target {target}</small>
        </div>

        <div>
          <span>Worked</span>
          <strong>{worked}</strong>
          <small>{progress}% complete</small>
        </div>

        <div>
          <span>Remaining</span>
          <strong>{remaining}</strong>
          <small>Today's queue</small>
        </div>

        <div>
          <span>Call mix</span>
          <strong>
            {dailyDay.websiteAssigned ?? 0}
            {" / "}
            {dailyDay.gmbAssigned ?? 0}
          </strong>
          <small>Website / GMB</small>
        </div>
      </div>

      <div
        className="rf-daily-queue-progress"
        aria-label={`${progress}% of today's queue worked`}
      >
        <span
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="rf-daily-queue-meta">
        <span>
          <b>Market:</b>{" "}
          {dailyDay.currentLocation ||
            dailyDay.currentCountry ||
            "Existing inventory"}
        </span>

        <span>
          <b>Resource:</b>{" "}
          {dailyDay.currentResourceType
            ? formatResourceType(
                dailyDay.currentResourceType
              )
            : "Existing leads first"}
        </span>

        <span>
          <b>Next delivery:</b>{" "}
          {formatDailyDateTime(
            dailyDay.nextRefreshAt
          )}
        </span>
      </div>

      <div className="rf-daily-queue-card__actions">
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

function formatDailyClock(hour, minute) {
  const safeHour =
    Number.isFinite(Number(hour))
      ? Math.max(
          0,
          Math.min(
            23,
            Number(hour)
          )
        )
      : 0;
  const safeMinute =
    Number.isFinite(Number(minute))
      ? Math.max(
          0,
          Math.min(
            59,
            Number(minute)
          )
        )
      : 0;

  return `${String(safeHour).padStart(2, "0")}:${String(
    safeMinute
  ).padStart(2, "0")}`;
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

        {getCampaignType(assignment) ? (
          <span className="badge badge-neutral">
            {getCampaignTypeLabel(assignment)}
          </span>
        ) : null}
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
            Call type
          </dt>
          <dd>
            {getCampaignTypeLabel(assignment)}
          </dd>
        </div>

        <div>
          <dt>
            Audit
          </dt>
          <dd>
            {formatAuditStatus(assignment)}
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
          title={
            !lead.phone
              ? "Phone number unavailable"
              : !isCallerAuditReady(assignment)
                ? getAuditBlockedMessage(assignment)
                : `Call ${getCampaignTypeLabel(assignment)} lead`
          }
          onClick={
            onCall
          }
        >
          {isCallerAuditReady(assignment)
            ? "Call"
            : isAuditPendingStatus(
                getCallerMiniAuditStatus(
                  assignment
                )
              )
              ? "Audit generating"
              : "Prepare audit"}
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

      <div>
        <small>
          Call type
        </small>
        <strong>
          {getCampaignTypeLabel(assignment)}
        </strong>
      </div>

      <div>
        <small>
          Audit status
        </small>
        <strong>
          {formatAuditStatus(assignment)}
        </strong>
      </div>
    </section>
  );
}

function CampaignAudit({
  audit,
  campaignType = "",
}) {
  const report =
    audit?.report &&
    typeof audit.report === "object"
      ? audit.report
      : audit || {};

  const findings =
    Array.isArray(report.findings)
      ? report.findings
      : Array.isArray(report.issues)
        ? report.issues
        : Array.isArray(report.opportunities)
          ? report.opportunities
          : [];

  const summary =
    report.summary ||
    report.executiveSummary ||
    audit?.summary ||
    audit?.executiveSummary ||
    "";

  return (
    <div className="caller-mini-audit">
      <p>
        <strong>
          {campaignType === "gmb"
            ? "GMB / Local Visibility lead"
            : "Website / Technology lead"}
        </strong>
      </p>

      {summary ? (
        <p>
          {summary}
        </p>
      ) : null}

      {findings
        .slice(0, 8)
        .map((finding, index) => (
          <article
            key={
              finding.id ||
              `${finding.title || finding.tag || "finding"}-${index}`
            }
          >
            <strong>
              {finding.title ||
                finding.tag ||
                finding.issue ||
                `Finding ${index + 1}`}
            </strong>

            <p>
              {finding.description ||
                finding.finding ||
                finding.evidence ||
                finding.impact ||
                finding.businessImpact ||
                ""}
            </p>

            {finding.businessImpact &&
            finding.businessImpact !== finding.impact ? (
              <p>
                <b>Business impact:</b>{" "}
                {finding.businessImpact}
              </p>
            ) : null}

            {finding.approvedSalesWording ||
            finding.controlledOpeningLine ? (
              <p>
                <b>Approved wording:</b>{" "}
                {finding.approvedSalesWording ||
                  finding.controlledOpeningLine}
              </p>
            ) : null}
          </article>
        ))}

      {!findings.length && !summary ? (
        <p>
          The campaign audit is ready. Open the full report from this lead if more detail is required.
        </p>
      ) : null}
    </div>
  );
}

function getCampaignType(assignment) {
  const raw =
    assignment?.campaignType ||
    assignment?.lead?.dailyCampaignType ||
    assignment?.lead?.campaignType ||
    assignment?.auditKind ||
    assignment?.lead?.auditKind ||
    "";

  const value = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");

  if (
    [
      "gmb",
      "google_business_profile",
      "google_business",
      "local_visibility",
      "local",
    ].includes(value)
  ) {
    return "gmb";
  }

  if (
    [
      "website",
      "website_audit",
      "technology",
      "tech",
      "website_technology",
    ].includes(value)
  ) {
    return "website";
  }

  return "";
}

function getCampaignTypeLabel(assignment) {
  const type = getCampaignType(assignment);
  if (type === "gmb") return "GMB";
  if (type === "website") return "Website";
  return "Standard";
}

function getAuditTypeLabel() {
  return "Mini Audit";
}

function normalizeAuditStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isAuditReadyStatus(value) {
  return [
    "ready",
    "ready_for_caller",
    "crm_audit_ready",
    "complete",
    "completed",
    "success",
  ].includes(
    normalizeAuditStatus(
      value
    )
  );
}

function isAuditPendingStatus(value) {
  return [
    "queued",
    "pending",
    "processing",
    "running",
    "generating",
  ].includes(
    normalizeAuditStatus(
      value
    )
  );
}

function isAuditReviewStatus(value) {
  return [
    "technical_review_required",
    "review_required",
  ].includes(
    normalizeAuditStatus(
      value
    )
  );
}

function getCallerMiniAuditRecord(
  assignment
) {
  return (
    assignment?.miniAudit ||
    assignment?.lead?.miniAudit ||
    null
  );
}

function getCallerMiniAuditStatus(
  assignment
) {
  const audit =
    getCallerMiniAuditRecord(
      assignment
    );

  const miniStatus =
    normalizeAuditStatus(
      audit?.status ||
        assignment?.miniAuditStatus ||
        assignment?.lead?.miniAuditStatus ||
        ""
    );

  if (miniStatus) {
    return miniStatus;
  }

  const legacyStatus =
    normalizeAuditStatus(
      assignment?.auditStatus ||
        assignment?.lead?.auditStatus ||
        ""
    );

  /*
   * "format_required" belongs to the retired manager-PDF gate.
   * It must never block the built-in ReachFly Mini Audit flow.
   * Treat it as "not generated yet" so the caller page can
   * queue the default Mini Audit automatically.
   */
  if (
    legacyStatus ===
    "format_required"
  ) {
    return "";
  }

  /*
   * Only preserve genuine review/failure/pending states from
   * legacy records. A legacy "ready" Website/GMB report does
   * not replace the universal Mini Audit pre-call requirement.
   */
  if (
    isAuditPendingStatus(
      legacyStatus
    ) ||
    isAuditReviewStatus(
      legacyStatus
    ) ||
    [
      "failed",
      "error",
      "audit_error",
    ].includes(
      legacyStatus
    )
  ) {
    return legacyStatus;
  }

  return "";
}

function getCallerAudit(
  assignment
) {
  const audit =
    getCallerMiniAuditRecord(
      assignment
    );

  if (!audit) {
    return null;
  }

  const status =
    getCallerMiniAuditStatus(
      assignment
    );

  if (
    !isAuditReadyStatus(
      status
    ) ||
    !hasCallerReadyMiniAuditContent(
      audit
    )
  ) {
    return null;
  }

  return audit;
}

function hasCallerReadyMiniAuditContent(
  audit
) {
  if (!audit || typeof audit !== "object") {
    return false;
  }

  const payload =
    audit.report &&
    typeof audit.report === "object"
      ? audit.report
      : audit;

  const findings =
    payload.issues ||
    payload.findings ||
    payload.auditFindings ||
    [];

  return (
    Array.isArray(findings) &&
    findings.length > 0
  );
}

function isCallerAuditReady(
  assignment
) {
  const audit =
    getCallerMiniAuditRecord(
      assignment
    );

  return Boolean(
    audit &&
      isAuditReadyStatus(
        getCallerMiniAuditStatus(
          assignment
        )
      ) &&
      hasCallerReadyMiniAuditContent(
        audit
      )
  );
}

function formatAuditStatus(
  assignment
) {
  const status =
    getCallerMiniAuditStatus(
      assignment
    );

  if (
    isAuditReadyStatus(
      status
    )
  ) {
    return "Mini Audit Ready";
  }

  if (
    [
      "failed",
      "error",
      "audit_error",
    ].includes(status)
  ) {
    return "Mini Audit Error";
  }

  if (
    isAuditReviewStatus(
      status
    )
  ) {
    return "Technical Review Required";
  }

  if (
    isAuditPendingStatus(
      status
    )
  ) {
    return "Generating Mini Audit";
  }

  return "Default Mini Audit";
}

function getAuditPendingTitle(
  assignment
) {
  const status =
    getCallerMiniAuditStatus(
      assignment
    );

  if (
    [
      "failed",
      "error",
      "audit_error",
    ].includes(status)
  ) {
    return "Mini Audit generation failed";
  }

  if (
    isAuditReviewStatus(
      status
    )
  ) {
    return "Technical review required";
  }

  if (
    isAuditPendingStatus(
      status
    )
  ) {
    return "Default Mini Audit is being prepared";
  }

  return "Default Mini Audit will be generated automatically";
}

function getAuditBlockedMessage(
  assignment
) {
  const status =
    getCallerMiniAuditStatus(
      assignment
    );

  if (
    [
      "failed",
      "error",
      "audit_error",
    ].includes(status)
  ) {
    return "The default Mini Audit could not be completed. Click Call again to retry generation before dialing.";
  }

  if (
    isAuditReviewStatus(
      status
    )
  ) {
    return "This Mini Audit requires technical review before the caller can start the call.";
  }

  if (
    isAuditPendingStatus(
      status
    )
  ) {
    return "The default Mini Audit is being generated from this lead's verified public evidence. Calling unlocks as soon as it is ready.";
  }

  const campaign =
    getCampaignTypeLabel(
      assignment
    );

  return `ReachFly will generate the built-in Mini Audit for this ${campaign} lead automatically. Manager uploads are optional and only change future audit formatting.`;
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

