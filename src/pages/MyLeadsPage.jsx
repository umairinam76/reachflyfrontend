import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  useAuth,
} from "../auth/AuthContext";

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

const QUEUE_CACHE_VERSION = 4;
const QUEUE_CACHE_TTL_MS =
  5 * 60 * 1000;
const QUEUE_PAGE_LIMIT = 200;

function getQueueCacheScope(user) {
  return [
    user?.workspaceId ||
      user?.workspace?.id ||
      user?.workspace?.workspaceId ||
      "",
    user?.id || user?.userId || "",
  ]
    .filter(Boolean)
    .map((value) =>
      String(value)
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
    )
    .join(":") || "workspace";
}

function getQueueCacheKey(
  bucket,
  scope = "workspace"
) {
  const token =
    getAccessToken() || "anonymous";

  const sessionKey =
    token.slice(-18);

  return [
    "reachfly",
    "caller-queue",
    QUEUE_CACHE_VERSION,
    String(scope || "workspace"),
    sessionKey,
    bucket,
  ].join(":");
}

function readQueueCache(
  bucket,
  scope = "workspace"
) {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        getQueueCacheKey(
          bucket,
          scope
        )
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
  scope,
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
      getQueueCacheKey(
        bucket,
        scope
      ),
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

  const {
    user,
  } = useAuth();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const cacheScope =
    useMemo(
      () =>
        getQueueCacheScope(
          user
        ),
      [
        user?.id,
        user?.userId,
        user?.workspaceId,
        user?.workspace?.id,
        user?.workspace?.workspaceId,
      ]
    );

  const requestedAssignmentId =
    String(
      searchParams.get(
        "assignment"
      ) || ""
    ).trim();

  const initialCacheRef =
    useRef(
      readQueueCache(
        "current",
        cacheScope
      )
    );

  const loadSequenceRef =
    useRef(0);

  const openedRouteAssignmentRef =
    useRef("");

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
            cacheScope,
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
              bucket,
              cacheScope
            );

          /*
           * A caller must not lose the task list because one refresh is slow.
           * Keep the last successful daily queue on screen and retry on the
           * normal focus/socket refresh cycle.
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
        cacheScope,
        request,
      ]
    );

  useEffect(() => {
    const cached =
      readQueueCache(
        bucket,
        cacheScope
      );

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
    cacheScope,
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
        60_000
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

    const queueEvents = [
      "lead:updated",
      "lead:call-updated",
      "lead:audit-updated",
      "resource-board:lead-updated",
      "resource-board:updated",
      "team:task-created",
      "team:task-updated",
      "team:task-deleted",
      "telnyx-ai-agent:call-updated",
      "telnyx-ai-agent:meeting-booked",
    ];

    const subscriptions =
      queueEvents.map(
        (eventName) =>
          onWorkspaceSocket(
            eventName,
            scheduleRefresh
          )
      );

    subscriptions.push(
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
      )
    );

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

  /*
   * WebSocket delivery is the fast path. While the open lead still has a
   * queued/generating Mini Audit, poll the queue briefly as a fallback so a
   * missed socket event cannot leave the drawer looking stuck for 30 seconds.
   */
  useEffect(() => {
    if (
      !selected ||
      !isAuditPendingStatus(
        getCallerMiniAuditStatus(selected)
      )
    ) {
      return undefined;
    }

    const refreshAudit = () => {
      void load({ silent: true });
    };

    const timer = window.setInterval(
      refreshAudit,
      3_000
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [
    selected?.id,
    selected?.miniAuditStatus,
    selected?.lead?.miniAuditStatus,
    selected?.miniAudit?.status,
    selected?.lead?.miniAudit?.status,
    load,
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
              getNextActionAt(
                assignment
              ),
              getLastCallSnapshot(
                assignment
              ).outcome,
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
              parseDateMs(
                getNextActionAt(
                  left
                ) ||
                  left.assignedAt
              );

            const rightTime =
              parseDateMs(
                getNextActionAt(
                  right
                ) ||
                  right.assignedAt
              );

            return (
              (leftTime ??
                Number.MAX_SAFE_INTEGER) -
              (rightTime ??
                Number.MAX_SAFE_INTEGER)
            );
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

  function updateAssignmentRoute(
    assignmentId
  ) {
    const nextParams =
      new URLSearchParams(
        searchParams
      );

    if (assignmentId) {
      nextParams.set(
        "assignment",
        assignmentId
      );
    } else {
      nextParams.delete(
        "assignment"
      );
    }

    setSearchParams(
      nextParams,
      {
        replace: true,
      }
    );
  }

  function closeLead() {
    setSelected(null);
    openedRouteAssignmentRef.current =
      "";
    updateAssignmentRoute("");
  }

  useEffect(() => {
    if (!requestedAssignmentId) {
      openedRouteAssignmentRef.current =
        "";
      return;
    }

    if (bucket !== "all") {
      setBucket("all");
      return;
    }

    if (
      openedRouteAssignmentRef.current ===
        requestedAssignmentId &&
      selected?.id ===
        requestedAssignmentId
    ) {
      return;
    }

    const assignment =
      records.find(
        (item) =>
          String(item.id) ===
          requestedAssignmentId
      );

    if (!assignment) {
      return;
    }

    openedRouteAssignmentRef.current =
      requestedAssignmentId;

    void openLead(
      assignment,
      {
        syncRoute: false,
      }
    );
  }, [
    bucket,
    records,
    requestedAssignmentId,
    selected?.id,
  ]);

  async function openLead(
    assignment,
    {
      ensureAudit = true,
      syncRoute = true,
    } = {}
  ) {
    let openedAssignment =
      assignment;

    setSelected(
      assignment
    );

    if (
      syncRoute &&
      assignment?.id
    ) {
      updateAssignmentRoute(
        String(
          assignment.id
        )
      );
    }

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

    const nextActionIso =
      requiresDate
        ? toIsoDateTime(
            callbackAt
          )
        : null;

    if (
      requiresDate &&
      !nextActionIso
    ) {
      setError(
        "Select a valid callback or follow-up date and time."
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
                nextActionIso,
            }
          : {}),
        ...(outcome ===
          "follow_up"
          ? {
              followUpAt:
                nextActionIso,
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
        response?.assignment ||
        selected;

      const completedId =
        completed?.id ||
        selected.id;

      setRecords(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              completedId
          )
      );

      closeLead();

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

      closeLead();

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
    <main className="caller-queue-page rf-my-leads-v7">
      <MyLeadsV7Styles />
      <header className="caller-queue-heading">
        <div>
          <span className="eyebrow">
            Daily calling workspace
          </span>

          <h1>
            My assigned leads
          </h1>

          <p>
            Work your assigned leads in priority order, review the pre-call context, record the outcome, and let ReachFly schedule the next action automatically.
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
                closeLead();
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
            closeLead()
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
                  closeLead()
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
            Call mix: {dailyDay.websiteCalls ?? 0} Website
            {" · "}
            {dailyDay.gmbCalls ?? 0} GMB
            {" · "}
            Today: {dailyDay.websiteAssigned ?? 0} Website
            {" · "}
            {dailyDay.gmbAssigned ?? 0} GMB
          </p>
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
            Lead delivery time: {formatDailyClock(
              dailyDay.assignmentHour,
              dailyDay.assignmentMinute
            )}
            {" "}
            ({dailyDay.timezone || ""})
            {" · "}
            Next scheduled delivery: {formatDailyDateTime(
              dailyDay.nextRefreshAt
            )}
          </p>
          <p>
            Worked: {dailyDay.worked || 0}
            {" · "}
            Remaining: {dailyDay.remaining || 0}
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

        <span
          className={`status status-${normalizeLeadStatus(
            assignment.status ||
              assignment.lead?.status
          )}`}
        >
          {formatLabel(
            normalizeLeadStatus(
              assignment.status ||
                assignment.lead?.status
            )
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
            Last outcome
          </dt>
          <dd>
            {formatLabel(
              getLastCallSnapshot(
                assignment
              ).outcome ||
                "No call yet"
            )}
          </dd>
        </div>

        <div>
          <dt>
            Next action
          </dt>
          <dd>
            {formatNextAction(
              getNextActionAt(
                assignment
              )
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

      <div>
        <small>
          Next action
        </small>
        <strong>
          {formatNextAction(
            getNextActionAt(
              assignment
            )
          )}
        </strong>
      </div>

      {getTaskDueAt(
        assignment
      ) ? (
        <div>
          <small>
            Task due
          </small>
          <strong>
            {formatDeadline(
              getTaskDueAt(
                assignment
              )
            )}
          </strong>
        </div>
      ) : null}

      <div>
        <small>
          Last call
        </small>
        <strong>
          {formatCallSnapshot(
            assignment
          )}
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
    report.currentStanding ||
    audit?.summary ||
    audit?.executiveSummary ||
    "";

  const hook = report.hook || "";
  const opener = report.suggestedOpener || "";
  const workingWell = report.workingWell || "";
  const verificationRequired = report.verificationRequired === true;

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

      {verificationRequired ? (
        <p><b>Verification:</b> Live evidence was limited in this run. Use only confirmed details below and verify unknowns on the call.</p>
      ) : null}

      {hook ? (
        <p><b>Hook:</b> {hook}</p>
      ) : null}

      {workingWell && !findings.length ? (
        <p><b>Verified / status note:</b> {workingWell}</p>
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

            {(finding.businessImpact || finding.pain) &&
            (finding.businessImpact || finding.pain) !== finding.impact ? (
              <p>
                <b>Business impact:</b>{" "}
                {finding.businessImpact || finding.pain}
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

      {opener ? (
        <p><b>Suggested opener:</b> {opener}</p>
      ) : null}

      {!findings.length && !summary && !workingWell ? (
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

  if (
    Array.isArray(findings) &&
    findings.length > 0
  ) {
    return true;
  }

  // A healthy audit is intentionally allowed to return no issues. Treat the
  // verified positive finding as ready content instead of blocking the caller.
  return Boolean(
    String(payload.workingWell || "").trim() &&
      (payload.noMajorIssues === true || payload.verificationRequired === true)
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

function normalizeLeadStatus(
  value
) {
  return String(
    value || "assigned"
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseDateMs(value) {
  if (!value) {
    return null;
  }

  const time =
    Date.parse(value);

  return Number.isFinite(time)
    ? time
    : null;
}

function firstValidDate(
  ...values
) {
  for (const value of values) {
    if (
      parseDateMs(value) !==
      null
    ) {
      return value;
    }
  }

  return "";
}

function getNextActionAt(
  assignment
) {
  const lead =
    assignment?.lead || {};

  return firstValidDate(
    assignment?.nextActionAt,
    assignment?.followUpAt,
    assignment?.callbackAt,
    assignment?.scheduledAt,
    assignment?.task?.nextActionAt,
    assignment?.task?.dueAt,
    lead?.nextActionAt,
    lead?.followUpAt,
    lead?.callbackAt,
    lead?.scheduledAt
  );
}

function getTaskDueAt(
  assignment
) {
  const task =
    assignment?.task ||
    assignment?.nextTask ||
    null;

  return firstValidDate(
    assignment?.taskDueAt,
    task?.dueAt,
    task?.dueDate,
    task?.scheduledAt,
    task?.nextActionAt,
    task?.callbackAt
  );
}

function formatNextAction(
  value
) {
  if (!value) {
    return "Not scheduled";
  }

  const time =
    parseDateMs(value);

  if (time === null) {
    return "Not scheduled";
  }

  const prefix =
    time < Date.now()
      ? "Due now · "
      : "";

  return `${prefix}${formatDateTime(
    value
  )}`;
}

function formatDeadline(
  value
) {
  const time =
    parseDateMs(value);

  if (time === null) {
    return "Not scheduled";
  }

  return `${
    time < Date.now()
      ? "Overdue · "
      : ""
  }${formatDateTime(value)}`;
}

function toIsoDateTime(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date.toISOString();
}

function getLastCallSnapshot(
  assignment
) {
  const lead =
    assignment?.lead || {};

  const call =
    assignment?.lastCall ||
    assignment?.latestCall ||
    assignment?.aiCall ||
    assignment?.voiceCall ||
    lead?.lastCall ||
    lead?.latestCall ||
    {};

  return {
    outcome:
      call?.outcome ||
      call?.disposition ||
      assignment?.lastCallOutcome ||
      assignment?.callOutcome ||
      lead?.lastCallOutcome ||
      "",
    status:
      call?.status ||
      assignment?.lastCallStatus ||
      lead?.lastCallStatus ||
      "",
    at:
      firstValidDate(
        call?.endedAt,
        call?.startedAt,
        call?.createdAt,
        assignment?.lastCallAt,
        lead?.lastCallAt
      ),
    durationSeconds:
      Number(
        call?.durationSeconds ||
        call?.duration ||
        0
      ) || 0,
    isAi:
      Boolean(
        assignment?.aiCall ||
        assignment?.voiceAgentCall ||
        call?.ai === true ||
        [
          "ai",
          "ai_voice",
          "voice_agent",
          "voice-agent",
        ].includes(
          String(
            call?.mode ||
              call?.channel ||
              call?.type ||
              ""
          )
            .trim()
            .toLowerCase()
        )
      ),
  };
}

function formatCallSnapshot(
  assignment
) {
  const call =
    getLastCallSnapshot(
      assignment
    );

  if (
    !call.outcome &&
    !call.status &&
    !call.at
  ) {
    return "No call recorded";
  }

  const label =
    formatLabel(
      call.outcome ||
        call.status ||
        "Call"
    );

  const parts = [
    call.isAi
      ? `AI voice · ${label}`
      : label,
  ];

  if (call.at) {
    parts.push(
      formatDateTime(
        call.at
      )
    );
  }

  return parts.join(" · ");
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


function MyLeadsV7Styles() {
  return (
    <style>{`
      .rf-my-leads-v7{
        --rfml-card:#ffffff;
        --rfml-soft:#f6f7f8;
        --rfml-text:#191c1d;
        --rfml-text2:#4d4c59;
        --rfml-muted:#777784;
        --rfml-line:#e2e4e7;
        --rfml-primary:#4648d4;
        --rfml-primary-dark:#383aba;
        --rfml-primary-soft:#e8e9ff;
        --rfml-violet:#6b38d4;
        --rfml-violet-soft:#f2edff;
        --rfml-green:#087a51;
        --rfml-green-soft:#e4f7ee;
        --rfml-red:#ba1a1a;
        --rfml-red-soft:#ffedeb;
        --rfml-amber:#9a5b00;
        --rfml-amber-soft:#fff3d8;
        --rfml-dark:#2e3132;
        --rfml-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfml-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfmlPageIn .24s var(--rfml-ease);
      }

      .rf-my-leads-v7 *,
      .rf-my-leads-v7 *::before,
      .rf-my-leads-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfmlPageIn{
        from{opacity:0;transform:translateY(6px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfmlBannerIn{
        from{opacity:0;transform:translateY(-5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfmlPulse{
        0%,100%{opacity:.45}
        50%{opacity:1}
      }

      .rf-my-leads-v7 .caller-queue-heading{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:17px;
      }

      .rf-my-leads-v7 .caller-queue-heading > div:first-child{
        min-width:0;
      }

      .rf-my-leads-v7 .eyebrow{
        display:block;
        margin:0 0 4px;
        color:var(--rfml-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rf-my-leads-v7 .caller-queue-heading h1{
        margin:0;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-my-leads-v7 .caller-queue-heading p{
        max-width:760px;
        margin:5px 0 0;
        color:var(--rfml-text2);
        font-size:12px;
        line-height:18px;
      }

      .rf-my-leads-v7 .caller-queue-heading__actions{
        display:flex;
        align-items:center;
        gap:7px;
        flex:0 0 auto;
      }

      .rf-my-leads-v7 .btn{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 11px;
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        font:700 7px/1 Inter,sans-serif;
        transition:.14s var(--rfml-ease);
      }

      .rf-my-leads-v7 .btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-my-leads-v7 .btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-my-leads-v7 .btn.primary{
        color:#fff;
        background:var(--rfml-primary);
        border-color:var(--rfml-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rf-my-leads-v7 .btn.primary:hover:not(:disabled){
        background:var(--rfml-primary-dark);
      }

      .rf-my-leads-v7 .btn.light{
        color:var(--rfml-text);
        background:#fff;
        border-color:var(--rfml-line);
      }

      .rf-my-leads-v7 .btn.full{
        width:100%;
      }

      .rf-my-leads-v7 .error-banner,
      .rf-my-leads-v7 .success-banner{
        padding:10px 12px;
        margin:0 0 11px;
        border:1px solid;
        border-radius:9px;
        font-size:7px;
        line-height:12px;
        animation:rfmlBannerIn .18s var(--rfml-ease);
      }

      .rf-my-leads-v7 .error-banner{
        color:#7c1d1d;
        background:var(--rfml-red-soft);
        border-color:#ffd0cc;
      }

      .rf-my-leads-v7 .success-banner{
        color:#086846;
        background:var(--rfml-green-soft);
        border-color:#caeadb;
      }

      .rf-my-leads-v7 .cardish{
        color:var(--rfml-text);
        background:#fff;
        border:1px solid var(--rfml-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-my-leads-v7 > .cardish{
        padding:13px 14px!important;
        margin-bottom:11px!important;
        background:
          linear-gradient(135deg,#fafaff,#fff);
        border-color:#dedfff;
      }

      .rf-my-leads-v7 .section-title-row{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
      }

      .rf-my-leads-v7 .section-title-row h3{
        margin:2px 0 0;
        font:600 17px/23px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-my-leads-v7 .section-title-row p{
        margin:4px 0 0;
        color:var(--rfml-text2);
        font-size:7px;
        line-height:12px;
      }

      .rf-my-leads-v7 .badge,
      .rf-my-leads-v7 .badge-neutral{
        display:inline-flex;
        align-items:center;
        min-height:25px;
        padding:4px 7px;
        color:var(--rfml-text2);
        background:#f1f2f3;
        border:1px solid #e2e4e6;
        border-radius:999px;
        font-size:5.8px;
        font-weight:750;
      }

      .rf-my-leads-v7 .caller-queue-tabs{
        display:flex;
        gap:5px;
        overflow:auto;
        padding:5px;
        margin:0 0 10px;
        background:#fff;
        border:1px solid var(--rfml-line);
        border-radius:10px;
        scrollbar-width:none;
      }

      .rf-my-leads-v7 .caller-queue-tabs::-webkit-scrollbar{
        display:none;
      }

      .rf-my-leads-v7 .caller-queue-tabs button{
        min-height:36px;
        display:flex;
        align-items:center;
        gap:7px;
        flex:0 0 auto;
        padding:6px 9px;
        color:var(--rfml-text2);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font:650 6.5px/1 Inter,sans-serif;
        transition:.13s var(--rfml-ease);
      }

      .rf-my-leads-v7 .caller-queue-tabs button:hover{
        background:#f4f5f6;
      }

      .rf-my-leads-v7 .caller-queue-tabs button.active{
        color:var(--rfml-primary);
        background:var(--rfml-primary-soft);
      }

      .rf-my-leads-v7 .caller-queue-tabs button b{
        min-width:21px;
        padding:3px 5px;
        color:inherit;
        background:#fff;
        border:1px solid rgba(70,72,212,.12);
        border-radius:999px;
        text-align:center;
        font-size:5.5px;
      }

      .rf-my-leads-v7 .caller-queue-toolbar{
        display:grid;
        grid-template-columns:minmax(220px,1.45fr) repeat(3,minmax(130px,.65fr)) auto;
        align-items:end;
        gap:8px;
        padding:10px;
        margin-bottom:11px;
        background:#fff;
        border:1px solid var(--rfml-line);
        border-radius:10px;
      }

      .rf-my-leads-v7 .caller-queue-toolbar label{
        min-width:0;
        display:grid;
        gap:4px;
      }

      .rf-my-leads-v7 .caller-queue-toolbar label > span{
        color:var(--rfml-muted);
        font-size:5.5px;
        font-weight:700;
        text-transform:uppercase;
      }

      .rf-my-leads-v7 .caller-queue-toolbar input,
      .rf-my-leads-v7 .caller-queue-toolbar select,
      .rf-my-leads-v7 .caller-workspace input,
      .rf-my-leads-v7 .caller-workspace select,
      .rf-my-leads-v7 .caller-workspace textarea{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfml-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 7px/12px Inter,sans-serif;
        transition:.13s var(--rfml-ease);
      }

      .rf-my-leads-v7 .caller-workspace textarea{
        min-height:96px;
        resize:vertical;
      }

      .rf-my-leads-v7 .caller-queue-toolbar input:focus,
      .rf-my-leads-v7 .caller-queue-toolbar select:focus,
      .rf-my-leads-v7 .caller-workspace input:focus,
      .rf-my-leads-v7 .caller-workspace select:focus,
      .rf-my-leads-v7 .caller-workspace textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-my-leads-v7 .caller-filter-count{
        align-self:center;
        justify-self:end;
        color:var(--rfml-muted);
        white-space:nowrap;
        font-size:5.8px;
      }

      .rf-my-leads-v7 .caller-queue-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
      }

      .rf-my-leads-v7 .caller-lead-card{
        min-width:0;
        display:grid;
        align-content:start;
        gap:9px;
        padding:13px;
        background:#fff;
        border:1px solid var(--rfml-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
        transition:.16s var(--rfml-ease);
      }

      .rf-my-leads-v7 .caller-lead-card:hover{
        transform:translateY(-2px);
        border-color:#d4d5f8;
        box-shadow:0 9px 23px rgba(41,43,79,.07);
      }

      .rf-my-leads-v7 .caller-lead-card > header{
        display:grid;
        grid-template-columns:36px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
      }

      .rf-my-leads-v7 .caller-lead-card__avatar{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        color:var(--rfml-primary);
        background:var(--rfml-primary-soft);
        border-radius:9px;
        font:800 8px/1 Inter,sans-serif;
      }

      .rf-my-leads-v7 .caller-lead-card h3{
        margin:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rf-my-leads-v7 .caller-lead-card p,
      .rf-my-leads-v7 .caller-lead-card span,
      .rf-my-leads-v7 .caller-lead-card small{
        color:var(--rfml-muted);
        font-size:6px;
        line-height:10px;
      }

      .rf-my-leads-v7 .caller-lead-card > div:not(.caller-lead-card__avatar){
        min-width:0;
      }

      .rf-my-leads-v7 .caller-lead-card .btn{
        min-height:35px;
      }

      .rf-my-leads-v7 .caller-queue-empty,
      .rf-my-leads-v7 .caller-queue-loading{
        min-height:250px;
        display:grid;
        place-items:center;
        align-content:center;
        padding:28px;
        text-align:center;
        background:#fff;
        border:1px solid var(--rfml-line);
        border-radius:12px;
      }

      .rf-my-leads-v7 .caller-queue-empty strong{
        font:600 12px/16px Geist,Inter,sans-serif;
      }

      .rf-my-leads-v7 .caller-queue-empty p{
        max-width:430px;
        margin:5px 0 0;
        color:var(--rfml-muted);
        font-size:7px;
        line-height:12px;
      }

      .rf-my-leads-v7 .caller-queue-loading{
        color:var(--rfml-muted);
        font-size:7px;
        animation:rfmlPulse 1.1s infinite ease-in-out;
      }

      .rf-my-leads-v7 .caller-workspace-backdrop{
        position:fixed;
        z-index:1000;
        inset:0;
        display:flex;
        justify-content:flex-end;
        padding:12px;
        background:rgba(24,27,28,.54);
        backdrop-filter:blur(8px);
        animation:rfmlBannerIn .16s var(--rfml-ease);
      }

      .rf-my-leads-v7 .caller-workspace{
        width:min(900px,100%);
        height:100%;
        overflow:auto;
        background:#f8f9fa;
        border:1px solid rgba(255,255,255,.18);
        border-radius:14px;
        box-shadow:0 24px 70px rgba(0,0,0,.2);
      }

      .rf-my-leads-v7 .caller-workspace > header{
        position:sticky;
        z-index:10;
        top:0;
        min-height:82px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:14px 16px;
        background:rgba(255,255,255,.94);
        border-bottom:1px solid var(--rfml-line);
        backdrop-filter:blur(14px);
      }

      .rf-my-leads-v7 .caller-workspace > header h2{
        margin:1px 0 0;
        font:600 20px/26px Geist,Inter,sans-serif;
      }

      .rf-my-leads-v7 .caller-workspace > header p{
        margin:2px 0 0;
        color:var(--rfml-muted);
        font-size:7px;
      }

      .rf-my-leads-v7 .caller-workspace__close{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfml-text2);
        background:#f1f2f3;
        border:1px solid #e5e6e8;
        border-radius:8px;
        cursor:pointer;
        font-size:16px;
      }

      .rf-my-leads-v7 .caller-workspace__layout{
        display:grid;
        grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);
        align-items:start;
        gap:11px;
        padding:11px;
      }

      .rf-my-leads-v7 .caller-workspace__main,
      .rf-my-leads-v7 .caller-workspace__audit{
        min-width:0;
        padding:13px;
        background:#fff;
        border:1px solid var(--rfml-line);
        border-radius:11px;
      }

      .rf-my-leads-v7 .caller-workspace__main{
        display:grid;
        gap:10px;
      }

      .rf-my-leads-v7 .caller-workspace__audit{
        position:sticky;
        top:93px;
        background:
          linear-gradient(135deg,#fbfaff,#fff);
        border-color:#e4dcf8;
      }

      .rf-my-leads-v7 .caller-workspace__main label{
        display:grid;
        gap:4px;
      }

      .rf-my-leads-v7 .caller-workspace__main label > span{
        color:var(--rfml-muted);
        font-size:5.8px;
        font-weight:700;
        text-transform:uppercase;
      }

      .rf-my-leads-v7 .caller-workspace__buttons{
        display:flex;
        gap:7px;
        margin-top:2px;
      }

      .rf-my-leads-v7 .caller-workspace__buttons .btn{
        flex:1;
      }

      .rf-my-leads-v7 .caller-lead-summary{
        display:grid;
        gap:0;
        padding:3px 0 7px;
      }

      .rf-my-leads-v7 .caller-lead-summary > div{
        min-height:35px;
        display:grid;
        grid-template-columns:95px minmax(0,1fr);
        align-items:center;
        gap:8px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-my-leads-v7 .caller-lead-summary span{
        color:var(--rfml-muted);
        font-size:5.8px;
      }

      .rf-my-leads-v7 .caller-lead-summary strong,
      .rf-my-leads-v7 .caller-lead-summary a{
        min-width:0;
        overflow:hidden;
        color:var(--rfml-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.5px;
      }

      .rf-my-leads-v7 .caller-mini-audit{
        display:grid;
        gap:9px;
      }

      .rf-my-leads-v7 .caller-mini-audit h3,
      .rf-my-leads-v7 .caller-mini-audit h4{
        margin:0;
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rf-my-leads-v7 .caller-mini-audit p,
      .rf-my-leads-v7 .caller-mini-audit li{
        color:var(--rfml-text2);
        font-size:6.3px;
        line-height:11px;
      }

      .rf-my-leads-v7 .caller-audit-pending{
        min-height:180px;
        display:grid;
        place-items:center;
        align-content:center;
        padding:18px;
        text-align:center;
        color:var(--rfml-violet);
        background:var(--rfml-violet-soft);
        border:1px solid #e2d8fa;
        border-radius:9px;
      }

      .rf-my-leads-v7 .caller-audit-pending strong{
        font-size:8px;
      }

      .rf-my-leads-v7 .caller-audit-pending p{
        margin:4px 0 0;
        color:var(--rfml-text2);
        font-size:6px;
        line-height:10px;
      }

      @media(max-width:1120px){
        .rf-my-leads-v7{
          padding:22px;
        }

        .rf-my-leads-v7 .caller-queue-toolbar{
          grid-template-columns:1fr 1fr 1fr;
        }

        .rf-my-leads-v7 .caller-filter-search{
          grid-column:span 2;
        }

        .rf-my-leads-v7 .caller-filter-count{
          justify-self:start;
        }

        .rf-my-leads-v7 .caller-queue-grid{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:820px){
        .rf-my-leads-v7 .caller-queue-heading{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-my-leads-v7 .caller-queue-heading__actions{
          width:100%;
        }

        .rf-my-leads-v7 .caller-queue-heading__actions .btn{
          flex:1;
        }

        .rf-my-leads-v7 .caller-workspace__layout{
          grid-template-columns:1fr;
        }

        .rf-my-leads-v7 .caller-workspace__audit{
          position:static;
        }
      }

      @media(max-width:620px){
        .rf-my-leads-v7{
          padding:18px 12px 80px;
        }

        .rf-my-leads-v7 .caller-queue-heading h1{
          font-size:25px;
          line-height:32px;
        }

        .rf-my-leads-v7 .caller-queue-heading p{
          font-size:10px;
          line-height:16px;
        }

        .rf-my-leads-v7 .caller-queue-toolbar{
          grid-template-columns:1fr;
        }

        .rf-my-leads-v7 .caller-filter-search{
          grid-column:auto;
        }

        .rf-my-leads-v7 .caller-queue-grid{
          grid-template-columns:1fr;
        }

        .rf-my-leads-v7 .caller-workspace-backdrop{
          padding:0;
        }

        .rf-my-leads-v7 .caller-workspace{
          border-radius:0;
        }

        .rf-my-leads-v7 .caller-workspace__buttons{
          flex-direction:column;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-my-leads-v7,
        .rf-my-leads-v7 *,
        .rf-my-leads-v7 *::before,
        .rf-my-leads-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
