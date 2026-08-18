import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  Navigate,
  useSearchParams,
} from "react-router-dom";

import {
  Activity,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  MessageCircle,
  Phone,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "../components/icons";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  apiRequest,
} from "../lib/workspace-platform-client.js";

const PAGE_SIZE = 12;

const LIVE_STATES = new Set([
  "creating",
  "queued",
  "initiated",
  "ringing",
  "answered",
  "assistant_active",
  "assistant_failed",
  "active",
]);

const FAILURE_STATES = new Set([
  "failed",
  "error",
  "cancelled",
  "canceled",
]);

const FILTERS = {
  direction: [
    ["all", "Direction"],
    ["outbound", "Outbound"],
    ["inbound", "Inbound"],
  ],
  status: [
    ["all", "Status"],
    ["live", "Live"],
    ["connected", "Connected"],
    ["completed", "Completed"],
    ["voicemail", "Voicemail"],
    ["no_answer", "No answer"],
    ["failed", "Failed"],
  ],
  outcome: [
    ["all", "Outcome"],
    ["meeting_booked", "Meeting booked"],
    ["qualified", "Qualified"],
    ["interested", "Interested"],
    ["follow_up", "Follow-up"],
    ["voicemail", "Voicemail"],
    ["no_answer", "No answer"],
    ["not_interested", "Not interested"],
  ],
};

export default function CallsPage() {
  const {
    user,
    initializing,
  } = useAuth();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const mountedRef = useRef(true);
  const recordingUrlRef = useRef("");

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState(
    searchParams.get("search") || ""
  );
  const [direction, setDirection] = useState(
    searchParams.get("direction") || "all"
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all"
  );
  const [outcomeFilter, setOutcomeFilter] = useState(
    searchParams.get("outcome") || "all"
  );
  const [selectedCallId, setSelectedCallId] = useState(
    searchParams.get("call") || ""
  );
  const [page, setPage] = useState(
    Math.max(1, Number(searchParams.get("page")) || 1)
  );

  const [busyCallId, setBusyCallId] = useState("");
  const [syncingCallId, setSyncingCallId] = useState("");
  const [capabilities, setCapabilities] = useState(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [detailError, setDetailError] = useState("");
  const [transcriptQuery, setTranscriptQuery] = useState("");

  const role = normalizeRole(
    user?.workspaceRole || user?.role || "caller"
  );

  const accountType = String(
    user?.accountType || user?.workspaceType || ""
  )
    .trim()
    .toLowerCase();

  const hasAccess =
    ["owner", "admin", "manager"].includes(role) ||
    accountType === "individual";

  const requestedAgentId = searchParams.get("agentId") || "";

  const loadDashboard = useCallback(
    async ({
      silent = false,
      successToast = false,
    } = {}) => {
      if (!hasAccess) return;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await apiRequest(
          "/telnyx/ai-agent/dashboard",
          {
            timeoutMs: 45_000,
          }
        );

        if (!mountedRef.current) return;

        setDashboard(response || {});
        setError("");

        if (successToast) {
          notify(
            "success",
            "Calls refreshed",
            "Latest AI Voice call activity is now visible."
          );
        }
      } catch (requestError) {
        if (!mountedRef.current) return;

        const text = safeRuntimeMessage(
          requestError?.message ||
            "The call workspace could not be loaded."
        );

        setError(text);

        if (successToast) {
          notify("error", "Calls refresh failed", text);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [hasAccess]
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      releaseRecording(recordingUrlRef, setRecordingUrl);
    };
  }, []);

  useEffect(() => {
    if (initializing || !hasAccess) {
      return undefined;
    }

    let running = false;

    const run = async (silent = false) => {
      if (
        running ||
        document.visibilityState === "hidden"
      ) {
        return;
      }

      running = true;

      try {
        await loadDashboard({
          silent,
        });
      } finally {
        running = false;
      }
    };

    void run(false);

    const timer = window.setInterval(() => {
      void run(true);
    }, 10_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void run(true);
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () => {
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, [
    hasAccess,
    initializing,
    loadDashboard,
  ]);

  const allCalls = useMemo(
    () => normalizeCalls(dashboard?.calls),
    [dashboard?.calls]
  );

  const agents = useMemo(
    () => normalizeAgents(dashboard),
    [dashboard]
  );

  const meetings = useMemo(
    () => normalizeCollection(dashboard?.meetings),
    [dashboard?.meetings]
  );

  const calls = useMemo(() => {
    if (!requestedAgentId) return allCalls;

    return allCalls.filter((call) =>
      callMatchesAgent(call, requestedAgentId)
    );
  }, [
    allCalls,
    requestedAgentId,
  ]);

  const activeAgent = useMemo(() => {
    if (requestedAgentId) {
      return (
        agents.find(
          (agent) =>
            String(agent.id) === String(requestedAgentId) ||
            String(agent.agentId) === String(requestedAgentId)
        ) || null
      );
    }

    if (agents.length === 1) {
      return agents[0];
    }

    return dashboard?.agent || null;
  }, [
    agents,
    dashboard?.agent,
    requestedAgentId,
  ]);

  const filteredCalls = useMemo(() => {
    const search = query.trim().toLowerCase();

    return calls.filter((call) => {
      if (
        direction !== "all" &&
        getCallDirection(call) !== direction
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        !matchesStatus(call, statusFilter)
      ) {
        return false;
      }

      if (
        outcomeFilter !== "all" &&
        !matchesOutcome(call, outcomeFilter)
      ) {
        return false;
      }

      if (!search) return true;

      return [
        call.leadName,
        call.contactName,
        call.companyName,
        call.business,
        call.toNumber,
        call.fromNumber,
        call.status,
        call.outcome,
        call.notes,
        call.summary,
        call.campaignName,
        call.agentName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [
    calls,
    direction,
    outcomeFilter,
    query,
    statusFilter,
  ]);

  const metrics = useMemo(
    () => buildMetrics(calls, meetings),
    [calls, meetings]
  );

  const pageCount = Math.max(
    1,
    Math.ceil(filteredCalls.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, pageCount);

  const pageCalls = useMemo(
    () =>
      filteredCalls.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE
      ),
    [filteredCalls, safePage]
  );

  const selectedCall = useMemo(
    () =>
      allCalls.find(
        (call) =>
          String(call.id) === String(selectedCallId)
      ) || null,
    [allCalls, selectedCallId]
  );

  const selectedTranscript = useMemo(
    () => normalizeTranscript(selectedCall),
    [selectedCall]
  );

  const visibleTranscript = useMemo(() => {
    const search = transcriptQuery.trim().toLowerCase();

    if (!search) return selectedTranscript;

    return selectedTranscript.filter((message) =>
      `${message.role} ${message.text}`
        .toLowerCase()
        .includes(search)
    );
  }, [
    selectedTranscript,
    transcriptQuery,
  ]);

  const analysis = useMemo(
    () => buildAnalysis(selectedCall, meetings),
    [meetings, selectedCall]
  );

  useEffect(() => {
    if (!selectedCall?.id) {
      setCapabilities(null);
      setDetailError("");
      setTranscriptQuery("");
      releaseRecording(recordingUrlRef, setRecordingUrl);
      return undefined;
    }

    let alive = true;

    setCapabilities(null);
    setDetailError("");
    setTranscriptQuery("");
    releaseRecording(recordingUrlRef, setRecordingUrl);

    const run = async () => {
      try {
        setCapabilitiesLoading(true);

        const result = await apiRequest(
          `/telnyx/ai-agent/calls/${encodeURIComponent(
            selectedCall.id
          )}/monitoring`,
          {
            timeoutMs: 20_000,
          }
        );

        if (alive) {
          setCapabilities(result || null);
        }
      } catch (requestError) {
        if (
          alive &&
          requestError?.message
        ) {
          setDetailError(
            safeRuntimeMessage(
              requestError.message
            )
          );
        }
      } finally {
        if (alive) {
          setCapabilitiesLoading(false);
        }
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [selectedCall?.id]);

  function updateUrl(updates) {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        value === "all" ||
        (key === "page" && Number(value) <= 1)
      ) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, {
      replace: true,
    });
  }

  function updateFilter(key, value) {
    if (key === "direction") setDirection(value);
    if (key === "status") setStatusFilter(value);
    if (key === "outcome") setOutcomeFilter(value);

    setPage(1);

    updateUrl({
      [key]: value,
      page: null,
    });
  }

  function clearFilters() {
    setQuery("");
    setDirection("all");
    setStatusFilter("all");
    setOutcomeFilter("all");
    setPage(1);

    updateUrl({
      search: null,
      direction: null,
      status: null,
      outcome: null,
      page: null,
    });
  }

  function openCall(call) {
    if (!call?.id) return;

    setSelectedCallId(call.id);

    updateUrl({
      call: call.id,
    });
  }

  function closeCall() {
    setSelectedCallId("");

    updateUrl({
      call: null,
    });

    setDetailError("");
    setTranscriptQuery("");
    releaseRecording(recordingUrlRef, setRecordingUrl);
  }

  async function cancelCall(call) {
    if (!call?.id || busyCallId) return;

    const confirmed = window.confirm(
      `End the active call with ${getLeadName(call)}?`
    );

    if (!confirmed) return;

    try {
      setBusyCallId(call.id);

      await apiRequest(
        `/telnyx/ai-agent/calls/${encodeURIComponent(
          call.id
        )}/cancel`,
        {
          method: "POST",
          timeoutMs: 20_000,
        }
      );

      notify(
        "success",
        "Call ended",
        "ReachFly requested the active AI Voice call to end."
      );

      await loadDashboard({
        silent: true,
      });
    } catch (requestError) {
      notify(
        "error",
        "Couldn't end call",
        safeRuntimeMessage(
          requestError?.message || "Please try again."
        )
      );
    } finally {
      setBusyCallId("");
    }
  }

  async function syncConversation(call) {
    if (!call?.id || syncingCallId) return;

    try {
      setSyncingCallId(call.id);
      setDetailError("");

      await apiRequest(
        `/telnyx/ai-agent/calls/${encodeURIComponent(
          call.id
        )}/sync`,
        {
          method: "POST",
          timeoutMs: 45_000,
        }
      );

      await loadDashboard({
        silent: true,
      });

      notify(
        "success",
        "Conversation refreshed",
        "Transcript and call intelligence were refreshed."
      );
    } catch (requestError) {
      const text = safeRuntimeMessage(
        requestError?.message ||
          "ReachFly could not refresh this conversation."
      );

      setDetailError(text);

      notify(
        "error",
        "Conversation refresh failed",
        text
      );
    } finally {
      setSyncingCallId("");
    }
  }

  async function loadRecording(call) {
    if (!call?.id || recordingLoading) return;

    const available =
      capabilities?.postCallRecording?.available === true ||
      call.hasAudio === true;

    if (!available) {
      notify(
        "info",
        "Recording unavailable",
        "A post-call recording is not available for this conversation yet."
      );
      return;
    }

    try {
      setRecordingLoading(true);
      setDetailError("");

      const blob = await apiRequest(
        `/telnyx/ai-agent/calls/${encodeURIComponent(
          call.id
        )}/audio`,
        {
          responseType: "blob",
          timeoutMs: 60_000,
        }
      );

      if (
        !blob ||
        typeof blob.size !== "number" ||
        blob.size <= 0
      ) {
        throw new Error(
          "The recording response was empty."
        );
      }

      releaseRecording(recordingUrlRef, setRecordingUrl);

      const url = URL.createObjectURL(blob);

      recordingUrlRef.current = url;
      setRecordingUrl(url);

      notify(
        "success",
        "Recording ready",
        "Authorized call playback is ready."
      );
    } catch (requestError) {
      const text = safeRuntimeMessage(
        requestError?.message ||
          "ReachFly could not load the call recording."
      );

      setDetailError(text);

      notify(
        "error",
        "Recording unavailable",
        text
      );
    } finally {
      setRecordingLoading(false);
    }
  }

  async function shareCall(call) {
    if (!call?.id) return;

    const url = new URL(window.location.href);
    url.searchParams.set("call", call.id);

    try {
      if (navigator.share) {
        await navigator.share({
          title: `ReachFly call · ${getLeadName(call)}`,
          url: url.toString(),
        });
        return;
      }

      await navigator.clipboard.writeText(url.toString());

      notify(
        "success",
        "Call link copied",
        "The call intelligence link is ready to share with an authorized teammate."
      );
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        notify(
          "error",
          "Couldn't share call",
          "Copy the current page URL and share it with an authorized teammate."
        );
      }
    }
  }

  if (initializing) {
    return (
      <>
        <CallsStyles />
        <LoadingPage />
      </>
    );
  }

  if (role === "caller") {
    return (
      <Navigate
        to="/app/role-operations?tab=calls"
        replace
      />
    );
  }

  if (!hasAccess) {
    return (
      <Navigate
        to="/app/dashboard"
        replace
      />
    );
  }

  return (
    <>
      <CallsStyles />

      <div className="rf-calls-v7">
        <header className="rfc-page-header">
          <div>
            <span className="rfc-eyebrow">
              AI Voice
            </span>

            <h1>
              Call Logs
            </h1>

            <p>
              Review agent interactions, outcomes, transcripts, and authorized
              recordings.
            </p>
          </div>

          <div className="rfc-header-actions">
            <Link
              className="rfc-btn secondary"
              to="/app/voice-agents"
            >
              <Bot size={15} />
              Voice Agents
            </Link>

            <button
              type="button"
              className="rfc-btn secondary"
              disabled={refreshing}
              onClick={() =>
                void loadDashboard({
                  silent: true,
                  successToast: true,
                })
              }
            >
              <RefreshCw
                size={15}
                className={refreshing ? "spin" : ""}
              />
              Refresh
            </button>

            <Link
              className="rfc-btn primary"
              to={
                activeAgent?.id
                  ? `/app/dialer?agentId=${encodeURIComponent(
                      activeAgent.id
                    )}`
                  : "/app/dialer"
              }
            >
              <Phone size={15} />
              Start Call
            </Link>
          </div>
        </header>

        {activeAgent ? (
          <section className="rfc-agent-strip">
            <span className={getAvatarTone(activeAgent.name)}>
              {getInitials(activeAgent.name || "AI")}
            </span>

            <div>
              <small>
                Viewing calls for
              </small>

              <strong>
                {activeAgent.name || "AI Voice Agent"}
              </strong>

              <em>
                {formatAgentMode(activeAgent)}
              </em>
            </div>

            {requestedAgentId ? (
              <Link to="/app/calls">
                View all agents
              </Link>
            ) : null}
          </section>
        ) : null}

        {error ? (
          <section
            className="rfc-message"
            role="alert"
          >
            <X size={15} />

            <div>
              <strong>
                Call activity needs attention
              </strong>

              <span>
                {error}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadDashboard({
                  successToast: true,
                })
              }
            >
              Try again
            </button>
          </section>
        ) : null}

        <section className="rfc-metrics">
          <Metric
            label="Total Calls"
            value={metrics.total}
            note={`${metrics.active} active now`}
            icon={<Phone size={16} />}
          />

          <Metric
            label="Connect Rate"
            value={`${formatPercent(metrics.connectRate)}%`}
            note={`${metrics.connected} connected`}
            icon={<Activity size={16} />}
            tone="violet"
          />

          <Metric
            label="Meetings Booked"
            value={metrics.meetings}
            note="Linked call outcomes"
            icon={<Calendar size={16} />}
            tone="success"
          />

          <Metric
            label="Avg Duration"
            value={
              metrics.averageDuration
                ? formatDuration(metrics.averageDuration)
                : "—"
            }
            note="Completed calls"
            icon={<Clock3 size={16} />}
            tone="neutral"
          />
        </section>

        <section
          className={`rfc-workspace ${
            selectedCall ? "detail-open" : ""
          }`}
        >
          <main className="rfc-list-card">
            <div className="rfc-toolbar">
              <label className="rfc-search">
                <Search size={15} />

                <input
                  value={query}
                  onChange={(event) => {
                    const value = event.target.value;

                    setQuery(value);
                    setPage(1);

                    updateUrl({
                      search: value.trim() ? value : null,
                      page: null,
                    });
                  }}
                  placeholder="Search leads, numbers, or outcomes..."
                  aria-label="Search calls"
                />

                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setPage(1);
                      updateUrl({
                        search: null,
                        page: null,
                      });
                    }}
                    aria-label="Clear call search"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </label>

              <Filter
                value={direction}
                options={FILTERS.direction}
                onChange={(value) =>
                  updateFilter("direction", value)
                }
              />

              <Filter
                value={statusFilter}
                options={FILTERS.status}
                onChange={(value) =>
                  updateFilter("status", value)
                }
              />

              <Filter
                value={outcomeFilter}
                options={FILTERS.outcome}
                onChange={(value) =>
                  updateFilter("outcome", value)
                }
              />

              {hasFilters(
                query,
                direction,
                statusFilter,
                outcomeFilter
              ) ? (
                <button
                  type="button"
                  className="rfc-clear"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              ) : null}
            </div>

            {loading ? (
              <TableSkeleton />
            ) : filteredCalls.length === 0 ? (
              <EmptyState
                hasCalls={calls.length > 0}
                onClear={clearFilters}
              />
            ) : (
              <>
                <div className="rfc-table-wrap">
                  <table className="rfc-table">
                    <thead>
                      <tr>
                        <th>Lead</th>
                        <th>Number</th>
                        <th>Direction</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Outcome</th>
                        <th>Meeting</th>
                        <th>Recording</th>
                        <th>Time</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pageCalls.map((call, index) => (
                        <CallRow
                          key={call.id || index}
                          call={call}
                          selected={
                            String(selectedCall?.id) ===
                            String(call.id)
                          }
                          meeting={findMeeting(call, meetings)}
                          index={index}
                          onOpen={() => openCall(call)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rfc-mobile-list">
                  {pageCalls.map((call, index) => (
                    <MobileCall
                      key={call.id || index}
                      call={call}
                      selected={
                        String(selectedCall?.id) ===
                        String(call.id)
                      }
                      meeting={findMeeting(call, meetings)}
                      index={index}
                      onOpen={() => openCall(call)}
                    />
                  ))}
                </div>

                <footer className="rfc-footer">
                  <span>
                    Showing{" "}
                    <strong>
                      {(safePage - 1) * PAGE_SIZE + 1}
                    </strong>{" "}
                    to{" "}
                    <strong>
                      {Math.min(
                        safePage * PAGE_SIZE,
                        filteredCalls.length
                      )}
                    </strong>{" "}
                    of{" "}
                    <strong>
                      {formatNumber(filteredCalls.length)}
                    </strong>{" "}
                    calls
                  </span>

                  <Pagination
                    page={safePage}
                    count={pageCount}
                    onChange={(nextPage) => {
                      setPage(nextPage);
                      updateUrl({
                        page: nextPage,
                      });
                    }}
                  />
                </footer>
              </>
            )}
          </main>

          {selectedCall ? (
            <IntelligencePanel
              call={selectedCall}
              analysis={analysis}
              transcript={visibleTranscript}
              transcriptCount={selectedTranscript.length}
              transcriptQuery={transcriptQuery}
              setTranscriptQuery={setTranscriptQuery}
              capabilities={capabilities}
              capabilitiesLoading={capabilitiesLoading}
              recordingUrl={recordingUrl}
              recordingLoading={recordingLoading}
              detailError={detailError}
              syncing={syncingCallId === selectedCall.id}
              ending={busyCallId === selectedCall.id}
              onClose={closeCall}
              onShare={() => void shareCall(selectedCall)}
              onRecording={() => void loadRecording(selectedCall)}
              onSync={() => void syncConversation(selectedCall)}
              onEnd={() => void cancelCall(selectedCall)}
            />
          ) : null}
        </section>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  note,
  icon,
  tone = "primary",
}) {
  return (
    <article className={`rfc-metric ${tone}`}>
      <span>{icon}</span>

      <div>
        <small>{label}</small>
        <strong>
          {typeof value === "number"
            ? formatNumber(value)
            : value}
        </strong>
        <em>{note}</em>
      </div>
    </article>
  );
}

function Filter({
  value,
  options,
  onChange,
}) {
  return (
    <label
      className={`rfc-filter ${
        value !== "all" ? "active" : ""
      }`}
    >
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        {options.map(([key, label]) => (
          <option
            key={key}
            value={key}
          >
            {label}
          </option>
        ))}
      </select>

      <ChevronDown size={12} />
    </label>
  );
}

function CallRow({
  call,
  selected,
  meeting,
  onOpen,
  index,
}) {
  const live = isLive(call);

  return (
    <tr
      className={`${selected ? "selected" : ""} ${
        live ? "live" : ""
      }`}
      style={{
        "--rfc-row-index": index,
      }}
      onClick={onOpen}
    >
      <td>
        <Lead call={call} />
      </td>

      <td className="number">
        {formatPhone(call.toNumber || call.phone)}
      </td>

      <td>
        <Direction
          value={getCallDirection(call)}
        />
      </td>

      <td>
        <Status call={call} />
      </td>

      <td>
        {live ? (
          <span className="rfc-live">
            <i />
            Live
          </span>
        ) : (
          formatDuration(getDuration(call))
        )}
      </td>

      <td>
        <Outcome value={getOutcome(call)} />
      </td>

      <td>
        {meeting ? (
          <span className="rfc-meeting">
            <Calendar size={10} />
            Booked
          </span>
        ) : (
          <span className="dash">—</span>
        )}
      </td>

      <td>
        <Recording call={call} />
      </td>

      <td>
        <span className="rfc-time">
          <strong>{formatCompactDate(call.createdAt)}</strong>
          <small>{formatTime(call.createdAt)}</small>
        </span>
      </td>
    </tr>
  );
}

function MobileCall({
  call,
  selected,
  meeting,
  onOpen,
  index,
}) {
  return (
    <button
      type="button"
      className={`rfc-mobile-card ${
        selected ? "selected" : ""
      }`}
      style={{
        "--rfc-row-index": index,
      }}
      onClick={onOpen}
    >
      <div className="rfc-mobile-head">
        <Lead call={call} />
        <ChevronRight size={15} />
      </div>

      <div className="rfc-mobile-tags">
        <Direction value={getCallDirection(call)} />
        <Status call={call} />
        <Outcome value={getOutcome(call)} />
      </div>

      <div className="rfc-mobile-meta">
        <span>
          <Phone size={11} />
          {formatPhone(call.toNumber || call.phone)}
        </span>

        <span>
          <Clock3 size={11} />
          {isLive(call)
            ? "Live"
            : formatDuration(getDuration(call))}
        </span>

        <span>
          <Calendar size={11} />
          {meeting
            ? "Meeting booked"
            : formatCompactDate(call.createdAt)}
        </span>
      </div>
    </button>
  );
}

function Lead({
  call,
}) {
  const name = getLeadName(call);
  const company = firstString(
    call.companyName,
    call.business,
    call.company,
    call.campaignName
  );

  return (
    <span className="rfc-lead">
      <i className={getAvatarTone(name)}>
        {getInitials(name)}
      </i>

      <span>
        <strong>{name}</strong>
        <small>{company || "Campaign lead"}</small>
      </span>
    </span>
  );
}

function Direction({
  value,
}) {
  return (
    <span className={`rfc-direction ${value}`}>
      <Phone size={12} />
      <i>{value === "inbound" ? "↙" : "↗"}</i>
    </span>
  );
}

function Status({
  call,
}) {
  const status = friendlyStatus(call);

  return (
    <span className={`rfc-status ${status.tone}`}>
      {status.live ? <i /> : null}
      {status.label}
    </span>
  );
}

function Outcome({
  value,
}) {
  const normalized = normalizeToken(value);

  if (!normalized || normalized === "pending") {
    return <span className="dash">—</span>;
  }

  return (
    <span
      className={`rfc-outcome ${outcomeTone(
        normalized
      )}`}
    >
      {isMeetingOutcome(normalized) ? (
        <Calendar size={10} />
      ) : normalized === "qualified" ? (
        <CheckCircle2 size={10} />
      ) : null}

      {titleCase(normalized)}
    </span>
  );
}

function Recording({
  call,
}) {
  if (call.hasAudio === true) {
    return (
      <span className="rfc-recording available">
        <Play size={10} />
        Available
      </span>
    );
  }

  if (
    call.hasAudio === undefined &&
    call.conversationId
  ) {
    return (
      <span className="rfc-recording processing">
        <RefreshCw size={10} />
        Processing
      </span>
    );
  }

  return <span className="dash">—</span>;
}

function IntelligencePanel({
  call,
  analysis,
  transcript,
  transcriptCount,
  transcriptQuery,
  setTranscriptQuery,
  capabilities,
  capabilitiesLoading,
  recordingUrl,
  recordingLoading,
  detailError,
  syncing,
  ending,
  onClose,
  onShare,
  onRecording,
  onSync,
  onEnd,
}) {
  const live = isLive(call);

  const recordingAvailable =
    capabilities?.postCallRecording?.available === true ||
    call.hasAudio === true;

  const name = getLeadName(call);

  return (
    <aside className="rfc-intelligence">
      <header className="rfc-detail-head">
        <div>
          <span className="rfc-eyebrow">
            Call intelligence
          </span>

          <h2>
            {firstString(
              call.companyName,
              call.business,
              name
            )}
          </h2>

          <p>
            {formatDateTime(call.createdAt)}
            {" · "}
            {live
              ? "Live call"
              : formatDuration(getDuration(call))}
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={onShare}
            title="Share call"
          >
            <ExternalLink size={14} />
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {detailError ? (
        <div className="rfc-detail-error">
          <X size={12} />
          {detailError}
        </div>
      ) : null}

      <section className="rfc-playback">
        <div>
          <button
            type="button"
            className={recordingUrl ? "ready" : ""}
            disabled={
              recordingLoading ||
              capabilitiesLoading ||
              !recordingAvailable
            }
            onClick={onRecording}
          >
            {recordingLoading ? (
              <RefreshCw
                size={17}
                className="spin"
              />
            ) : (
              <Play size={17} />
            )}
          </button>

          <span>
            <strong>
              {recordingUrl
                ? "Recording ready"
                : capabilitiesLoading
                  ? "Checking recording"
                  : recordingAvailable
                    ? "Call recording"
                    : "Recording unavailable"}
            </strong>

            <small>
              {recordingAvailable
                ? "Authorized post-call playback"
                : "No saved audio is available yet."}
            </small>
          </span>

          <em>
            {formatDuration(getDuration(call))}
          </em>
        </div>

        {recordingUrl ? (
          <audio
            controls
            preload="metadata"
            src={recordingUrl}
          >
            Your browser does not support audio playback.
          </audio>
        ) : (
          <div className="rfc-waveform">
            {Array.from({
              length: 40,
            }).map((_, index) => (
              <i
                key={index}
                style={{
                  "--wave":
                    20 + ((index * 19) % 72),
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rfc-analysis">
        <div className="rfc-analysis-title">
          <Sparkles size={14} />
          AI Analysis
        </div>

        <div className="rfc-analysis-grid">
          <AnalysisStat
            label="Qualification"
            value={
              analysis.qualification ||
              "Not available"
            }
            tone={analysis.qualificationTone}
          />

          <AnalysisStat
            label="Sentiment"
            value={
              analysis.sentiment ||
              "Not available"
            }
            tone={analysis.sentimentTone}
          />
        </div>

        {analysis.actionItem ? (
          <article className="rfc-action-item">
            <span>Action Item</span>
            <p>{analysis.actionItem}</p>
          </article>
        ) : null}

        <article
          className={`rfc-summary ${
            analysis.summary ? "" : "empty"
          }`}
        >
          <span>Summary</span>

          <p>
            {analysis.summary ||
              "No call summary is available yet. Refresh the completed conversation to check for newly processed intelligence."}
          </p>
        </article>
      </section>

      <section className="rfc-metadata">
        <h3>Call Metadata</h3>

        <dl>
          <Meta label="Agent" value={firstString(
            call.agentName,
            call.voiceAgentName,
            call.agent?.name,
            "AI Voice Agent"
          )} />
          <Meta label="Lead" value={name} />
          <Meta label="Company" value={firstString(
            call.companyName,
            call.business,
            call.company,
            "—"
          )} />
          <Meta label="Phone" value={formatPhone(
            call.toNumber || call.phone
          )} />
          <Meta label="Campaign" value={call.campaignName || "—"} />
          <Meta label="Direction" value={titleCase(
            getCallDirection(call)
          )} />
          <Meta label="Outcome" value={titleCase(
            getOutcome(call) || "pending"
          )} />
        </dl>
      </section>

      <section className="rfc-transcript">
        <header>
          <div>
            <h3>Transcript</h3>
            <span>
              {formatNumber(transcriptCount)} messages
            </span>
          </div>

          <label>
            <Search size={11} />
            <input
              value={transcriptQuery}
              onChange={(event) =>
                setTranscriptQuery(event.target.value)
              }
              placeholder="Search..."
            />

            {transcriptQuery ? (
              <button
                type="button"
                onClick={() =>
                  setTranscriptQuery("")
                }
              >
                <X size={10} />
              </button>
            ) : null}
          </label>
        </header>

        <div className="rfc-transcript-body">
          {transcript.length ? (
            transcript.map((message, index) => (
              <Transcript
                key={`${message.role}-${message.occurredAt}-${index}`}
                message={message}
              />
            ))
          ) : (
            <div className="rfc-transcript-empty">
              <MessageCircle size={18} />
              <strong>
                {transcriptQuery
                  ? "No transcript matches"
                  : "Transcript unavailable"}
              </strong>
              <p>
                {transcriptQuery
                  ? "Try another search."
                  : live
                    ? "Live transcript content will appear when it is available on the call record."
                    : "Refresh the conversation to check for post-call transcript processing."}
              </p>
            </div>
          )}
        </div>
      </section>

      <footer className="rfc-detail-actions">
        <button
          type="button"
          className="rfc-btn secondary"
          disabled={syncing}
          onClick={onSync}
        >
          <RefreshCw
            size={13}
            className={syncing ? "spin" : ""}
          />
          {syncing
            ? "Refreshing…"
            : "Refresh conversation"}
        </button>

        {live ? (
          <button
            type="button"
            className="rfc-btn danger"
            disabled={ending}
            onClick={onEnd}
          >
            <X size={13} />
            {ending ? "Ending…" : "End call"}
          </button>
        ) : null}
      </footer>
    </aside>
  );
}

function AnalysisStat({
  label,
  value,
  tone = "neutral",
}) {
  return (
    <div className={`rfc-analysis-stat ${tone}`}>
      <small>{label}</small>
      <strong>
        <i />
        {value}
      </strong>
    </div>
  );
}

function Meta({
  label,
  value,
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Transcript({
  message,
}) {
  const assistant =
    message.role === "assistant";

  return (
    <div
      className={`rfc-transcript-message ${
        assistant ? "assistant" : "lead"
      }`}
    >
      <span>{assistant ? "AI" : "L"}</span>

      <div>
        <header>
          <strong>
            {assistant ? "AI Voice Agent" : "Lead"}
          </strong>

          {message.occurredAt ? (
            <time>
              {formatTranscriptTime(
                message.occurredAt
              )}
            </time>
          ) : null}
        </header>

        <p>{message.text}</p>
      </div>
    </div>
  );
}

function Pagination({
  page,
  count,
  onChange,
}) {
  if (count <= 1) return null;

  return (
    <nav className="rfc-pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() =>
          onChange(page - 1)
        }
      >
        ‹
      </button>

      <span>
        {page} / {count}
      </span>

      <button
        type="button"
        disabled={page >= count}
        onClick={() =>
          onChange(page + 1)
        }
      >
        ›
      </button>
    </nav>
  );
}

function EmptyState({
  hasCalls,
  onClear,
}) {
  return (
    <div className="rfc-empty">
      <span>
        <Phone size={24} />
      </span>

      <h2>
        {hasCalls
          ? "No matching calls"
          : "No AI Voice calls yet"}
      </h2>

      <p>
        {hasCalls
          ? "Try another search or clear the call filters."
          : "Calls appear here after your AI Voice Agent begins conversations."}
      </p>

      {hasCalls ? (
        <button
          type="button"
          className="rfc-btn secondary"
          onClick={onClear}
        >
          Clear filters
        </button>
      ) : (
        <Link
          className="rfc-btn primary"
          to="/app/dialer"
        >
          <Phone size={14} />
          Start Call
        </Link>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rfc-skeleton">
      {Array.from({
        length: 7,
      }).map((_, row) => (
        <div key={row}>
          <i className="lead" />

          {Array.from({
            length: 7,
          }).map((__, index) => (
            <i key={index} />
          ))}
        </div>
      ))}
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="rf-calls-v7">
      <header className="rfc-page-header">
        <div>
          <span className="rfc-eyebrow">
            AI Voice
          </span>
          <h1>Call Logs</h1>
          <p>Loading AI Voice call activity…</p>
        </div>
      </header>

      <section className="rfc-metrics">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <article
            className="rfc-metric rfc-loading-metric"
            key={index}
          >
            <i />
            <span>
              <i />
              <i />
            </span>
          </article>
        ))}
      </section>

      <section className="rfc-list-card">
        <TableSkeleton />
      </section>
    </div>
  );
}

/* ==========================================================================
 * Data adapters
 * ======================================================================= */

function normalizeCollection(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function normalizeCalls(value) {
  return normalizeCollection(value)
    .map((call, index) => ({
      ...call,
      id:
        call.id ||
        call.callId ||
        call.callControlId ||
        `call-${index}`,
    }))
    .sort(
      (left, right) =>
        timestamp(right.createdAt || right.startedAt) -
        timestamp(left.createdAt || left.startedAt)
    );
}

function normalizeAgents(dashboard) {
  const agents = normalizeCollection(dashboard?.agents);

  if (agents.length) return agents;

  return dashboard?.agent ? [dashboard.agent] : [];
}

function buildMetrics(calls, meetings) {
  const completed = calls.filter((call) => !isLive(call));
  const connected = calls.filter(isConnected);

  const durations = completed
    .map(getDuration)
    .filter((value) => value > 0);

  const meetingCount = calls.filter((call) =>
    Boolean(findMeeting(call, meetings)) ||
    isMeetingOutcome(getOutcome(call))
  ).length;

  return {
    total: calls.length,
    active: calls.filter(isLive).length,
    connected: connected.length,
    connectRate:
      calls.length > 0
        ? (connected.length / calls.length) * 100
        : 0,
    meetings: meetingCount,
    averageDuration:
      durations.length > 0
        ? durations.reduce((sum, value) => sum + value, 0) /
          durations.length
        : 0,
  };
}

function buildAnalysis(call, meetings) {
  if (!call) {
    return {
      qualification: "",
      qualificationTone: "neutral",
      sentiment: "",
      sentimentTone: "neutral",
      actionItem: "",
      summary: "",
    };
  }

  const qualification = firstString(
    call.qualification,
    call.qualificationStatus,
    call.analysis?.qualification,
    call.analysis?.qualificationStatus,
    call.intelligence?.qualification,
    call.intelligence?.qualificationStatus,
    inferQualification(getOutcome(call))
  );

  const sentiment = firstString(
    call.sentiment,
    call.analysis?.sentiment,
    call.intelligence?.sentiment,
    call.customerSentiment
  );

  const meeting = findMeeting(call, meetings);

  return {
    qualification: qualification
      ? titleCase(qualification)
      : "",
    qualificationTone: qualificationTone(qualification),
    sentiment: sentiment
      ? titleCase(sentiment)
      : "",
    sentimentTone: sentimentTone(sentiment),
    actionItem: safeRuntimeMessage(
      firstString(
        call.actionItem,
        call.nextAction,
        call.followUpAction,
        call.analysis?.actionItem,
        call.analysis?.nextAction,
        call.intelligence?.actionItem,
        call.intelligence?.nextAction,
        meeting
          ? `Meeting booked${
              meeting.startAt || meeting.scheduledAt
                ? ` for ${formatDateTime(
                    meeting.startAt || meeting.scheduledAt
                  )}`
                : ""
            }.`
          : ""
      )
    ),
    summary: safeRuntimeMessage(
      firstString(
        call.summary,
        call.callSummary,
        call.analysis?.summary,
        call.intelligence?.summary,
        call.conversationSummary,
        call.notes
      )
    ),
  };
}

function normalizeTranscript(call) {
  const messages = findMessages(
    call?.liveTranscript?.length
      ? call.liveTranscript
      : call?.messageHistory ||
          call?.conversation ||
          call?.transcript ||
          call?.conversationHistory ||
          []
  );

  return messages
    .map((message) => {
      const role = normalizeToken(
        message?.role ||
          message?.speaker ||
          message?.source
      );

      const text = messageText(
        message?.content ??
          message?.text ??
          message?.message ??
          message?.transcript
      );

      if (!text) return null;

      return {
        role: ["assistant", "agent", "ai"].includes(role)
          ? "assistant"
          : ["user", "lead", "customer", "human"].includes(role)
            ? "user"
            : "unknown",
        text,
        occurredAt:
          message?.occurredAt ||
          message?.createdAt ||
          message?.timestamp ||
          message?.time ||
          "",
      };
    })
    .filter(Boolean)
    .slice(-150);
}

function findMessages(value, depth = 0) {
  if (depth > 6) return [];

  if (Array.isArray(value)) {
    if (
      value.some(
        (item) =>
          item &&
          typeof item === "object" &&
          (
            "role" in item ||
            "content" in item ||
            "text" in item
          )
      )
    ) {
      return value;
    }

    for (const item of value) {
      const nested = findMessages(item, depth + 1);
      if (nested.length) return nested;
    }

    return [];
  }

  if (!value || typeof value !== "object") return [];

  for (const key of [
    "message_history",
    "messageHistory",
    "messages",
    "conversation",
    "history",
    "transcript",
    "payload",
    "data",
  ]) {
    if (value[key] !== undefined) {
      const nested = findMessages(
        value[key],
        depth + 1
      );
      if (nested.length) return nested;
    }
  }

  return [];
}

function messageText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        messageText(
          item?.text ??
            item?.content ??
            item
        )
      )
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  if (value && typeof value === "object") {
    return firstString(
      value.text,
      value.content,
      value.message
    );
  }

  return value == null ? "" : String(value).trim();
}

function getLeadName(call) {
  return firstString(
    call?.leadName,
    call?.contactName,
    call?.name,
    call?.lead?.name,
    call?.customerName,
    "Unknown lead"
  );
}

function getCallDirection(call) {
  return normalizeToken(
    call?.direction ||
      call?.callDirection
  ) === "inbound"
    ? "inbound"
    : "outbound";
}

function getOutcome(call) {
  return normalizeToken(
    firstString(
      call?.outcome,
      call?.callOutcome,
      call?.disposition,
      call?.result,
      call?.leadOutcome,
      call?.lastCallOutcome
    )
  );
}

function getDuration(call) {
  const direct = Number(
    call?.durationSeconds ??
      call?.duration ??
      call?.callDurationSeconds ??
      call?.conversationDurationSeconds
  );

  if (Number.isFinite(direct)) {
    return Math.max(0, direct);
  }

  const start = timestamp(
    call?.answeredAt ||
      call?.startedAt ||
      call?.createdAt
  );

  const end = timestamp(
    call?.endedAt ||
      call?.completedAt ||
      call?.finishedAt
  );

  return start && end && end >= start
    ? (end - start) / 1000
    : 0;
}

function isLive(call) {
  return LIVE_STATES.has(
    normalizeToken(call?.status)
  );
}

function isConnected(call) {
  if (
    call?.answeredAt ||
    call?.assistantStartedAt ||
    call?.conversationId
  ) {
    return true;
  }

  const status = normalizeToken(call?.status);
  const outcome = getOutcome(call);

  return (
    [
      "answered",
      "assistant_active",
      "active",
      "connected",
      "completed",
      "complete",
    ].includes(status) ||
    [
      "meeting_booked",
      "qualified",
      "interested",
      "not_interested",
      "follow_up",
      "followup",
      "callback",
    ].includes(outcome)
  );
}

function friendlyStatus(call) {
  const raw = normalizeToken(call?.status);
  const outcome = getOutcome(call);

  if (isLive(call)) {
    if (["creating", "queued", "initiated", "ringing"].includes(raw)) {
      return {
        label:
          raw === "queued"
            ? "Queued"
            : raw === "ringing"
              ? "Ringing"
              : "Starting",
        tone: "live",
        live: true,
      };
    }

    return {
      label: "Connected",
      tone: "connected",
      live: true,
    };
  }

  if (outcome === "voicemail" || raw === "voicemail") {
    return {
      label: "Voicemail",
      tone: "voicemail",
      live: false,
    };
  }

  if (
    ["no_answer", "unanswered", "not_answered"].includes(outcome) ||
    ["no_answer", "unanswered"].includes(raw)
  ) {
    return {
      label: "No Answer",
      tone: "neutral",
      live: false,
    };
  }

  if (FAILURE_STATES.has(raw)) {
    return {
      label:
        raw === "cancelled" || raw === "canceled"
          ? "Cancelled"
          : "Failed",
      tone: "failed",
      live: false,
    };
  }

  if (isConnected(call)) {
    return {
      label: "Connected",
      tone: "connected",
      live: false,
    };
  }

  return {
    label: titleCase(raw || "Completed"),
    tone: "neutral",
    live: false,
  };
}

function matchesStatus(call, filter) {
  if (filter === "live") return isLive(call);
  if (filter === "connected") return isConnected(call);

  if (filter === "completed") {
    return (
      !isLive(call) &&
      !FAILURE_STATES.has(normalizeToken(call.status))
    );
  }

  if (filter === "voicemail") {
    return (
      getOutcome(call) === "voicemail" ||
      normalizeToken(call.status) === "voicemail"
    );
  }

  if (filter === "no_answer") {
    return [
      "no_answer",
      "unanswered",
      "not_answered",
    ].includes(getOutcome(call));
  }

  if (filter === "failed") {
    return FAILURE_STATES.has(
      normalizeToken(call.status)
    );
  }

  return true;
}

function matchesOutcome(call, filter) {
  const outcome = getOutcome(call);

  if (filter === "meeting_booked") {
    return isMeetingOutcome(outcome);
  }

  if (filter === "follow_up") {
    return [
      "follow_up",
      "followup",
      "callback",
      "call_back",
    ].includes(outcome);
  }

  if (filter === "no_answer") {
    return [
      "no_answer",
      "unanswered",
      "not_answered",
    ].includes(outcome);
  }

  return outcome === filter;
}

function callMatchesAgent(call, agentId) {
  const ids = [
    call.agentId,
    call.voiceAgentId,
    call.workspaceAgentId,
    call.elevenLabsAgentId,
    call.agent?.id,
  ]
    .filter(Boolean)
    .map(String);

  return !ids.length || ids.includes(String(agentId));
}

function findMeeting(call, meetings) {
  if (!call) return null;

  const callId = String(call.id || "");
  const phone = phoneKey(call.toNumber || call.phone);
  const name = searchToken(getLeadName(call));

  return (
    meetings.find((meeting) => {
      const meetingCallId = firstString(
        meeting.callId,
        meeting.voiceCallId,
        meeting.sourceCallId
      );

      if (
        meetingCallId &&
        String(meetingCallId) === callId
      ) {
        return true;
      }

      const meetingPhone = phoneKey(
        meeting.phone ||
          meeting.leadPhone ||
          meeting.contactPhone
      );

      if (
        phone &&
        meetingPhone &&
        phone === meetingPhone
      ) {
        return true;
      }

      return (
        name &&
        searchToken(
          firstString(
            meeting.leadName,
            meeting.contactName,
            meeting.name
          )
        ) === name
      );
    }) || null
  );
}

function isMeetingOutcome(value) {
  return [
    "meeting_booked",
    "booked",
    "appointment_booked",
    "scheduled",
    "demo_scheduled",
  ].includes(normalizeToken(value));
}

function inferQualification(outcome) {
  const value = normalizeToken(outcome);

  if (value === "qualified") return "qualified";

  if (
    ["meeting_booked", "interested"].includes(value)
  ) {
    return "positive";
  }

  if (
    ["not_interested", "disqualified"].includes(value)
  ) {
    return "not qualified";
  }

  return "";
}

function qualificationTone(value) {
  const token = normalizeToken(value);

  if (
    token.includes("qualif") &&
    !token.includes("not")
  ) {
    return "success";
  }

  if (
    token.includes("positive") ||
    token.includes("interested")
  ) {
    return "primary";
  }

  if (
    token.includes("not") ||
    token.includes("disqual")
  ) {
    return "danger";
  }

  return "neutral";
}

function sentimentTone(value) {
  const token = normalizeToken(value);

  if (token.includes("positive")) return "success";
  if (token.includes("negative")) return "danger";
  if (token.includes("mixed")) return "primary";

  return "neutral";
}

function outcomeTone(value) {
  if (isMeetingOutcome(value)) return "meeting";

  if (
    ["qualified", "interested"].includes(value)
  ) {
    return "qualified";
  }

  if (
    ["not_interested", "disqualified", "failed"].includes(value)
  ) {
    return "negative";
  }

  return "neutral";
}

/* ==========================================================================
 * Utilities
 * ======================================================================= */

function firstString(...values) {
  for (const value of values) {
    if (value == null) continue;

    const text = String(value).trim();

    if (text) return text;
  }

  return "";
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function searchToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function phoneKey(value) {
  return String(value || "").replace(/\D+/g, "");
}

function timestamp(value) {
  if (!value) return 0;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 0
    : date.getTime();
}

function normalizeRole(value) {
  const role = normalizeToken(value);

  if (role.includes("owner")) return "owner";
  if (role.includes("admin")) return "admin";
  if (role.includes("manager")) return "manager";

  if (
    role === "caller" ||
    role.includes("cold_caller") ||
    role.includes("sales_rep") ||
    role.includes("telemarketer")
  ) {
    return "caller";
  }

  return role || "caller";
}

function formatAgentMode(agent) {
  const mode = normalizeToken(
    firstString(
      agent?.callDirection,
      agent?.callingMode,
      agent?.mode
    )
  );

  if (mode === "inbound") {
    return "Inbound AI Voice Agent";
  }

  if (
    mode === "both" ||
    mode === "inbound_outbound"
  ) {
    return "Inbound + Outbound AI Voice Agent";
  }

  return "Outbound AI Voice Agent";
}

function formatPhone(value) {
  const text = String(value || "").trim();

  if (!text) return "—";

  const digits = text.replace(/\D+/g, "");

  if (
    digits.length === 11 &&
    digits.startsWith("1")
  ) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(
      4,
      7
    )}-${digits.slice(7)}`;
  }

  return text;
}

function formatDuration(seconds) {
  const total = Math.max(
    0,
    Math.round(Number(seconds) || 0)
  );

  const minutes = Math.floor(total / 60);
  const remainder = total % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${hours}:${String(mins).padStart(
      2,
      "0"
    )}:${String(remainder).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(remainder).padStart(2, "0")}`;
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCompactDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTranscriptTime(value) {
  const number = Number(value);

  if (
    Number.isFinite(number) &&
    String(value).trim() !== ""
  ) {
    return formatDuration(number);
  }

  return formatTime(value);
}

function formatNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? new Intl.NumberFormat().format(
        Math.round(number)
      )
    : "0";
}

function formatPercent(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(1)
    : "0.0";
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getInitials(value) {
  const parts = String(value || "AI")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getAvatarTone(value) {
  const tones = [
    "primary",
    "violet",
    "blue",
    "green",
    "amber",
  ];

  const sum = String(value || "")
    .split("")
    .reduce(
      (total, character) =>
        total + character.charCodeAt(0),
      0
    );

  return tones[sum % tones.length];
}

function hasFilters(
  query,
  direction,
  status,
  outcome
) {
  return Boolean(
    query.trim() ||
      direction !== "all" ||
      status !== "all" ||
      outcome !== "all"
  );
}

function releaseRecording(ref, setter) {
  if (ref.current) {
    URL.revokeObjectURL(ref.current);
    ref.current = "";
  }

  setter("");
}

function safeRuntimeMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice runtime")
    .replace(/ElevenAgent/gi, "voice agent")
    .replace(/Telnyx/gi, "calling provider")
    .replace(/Call Control ID/gi, "live-media control")
    .replace(/\bSIP\b/gi, "voice connection");
}

function notify(type, title, message) {
  if (typeof window === "undefined") return;

  const bridge = window.reachflyToast;

  if (
    bridge &&
    typeof bridge[type] === "function"
  ) {
    bridge[type](title, message);
    return;
  }

  window.dispatchEvent(
    new CustomEvent("reachfly:toast", {
      detail: {
        type,
        title,
        message,
      },
    })
  );
}

/* ==========================================================================
 * Scoped Stitch styling
 * ======================================================================= */

function CallsStyles() {
  return (
    <style>{`
      .rf-calls-v7{
        --bg:#f8f9fa;--card:#fff;--soft:#f3f4f5;--high:#e7e8e9;
        --text:#191c1d;--text2:#464554;--muted:#767586;--line:#e3e5e7;
        --primary:#4648d4;--primary2:#3537bb;--psoft:#e8e9ff;
        --violet:#6b38d4;--vsoft:#f0eaff;--success:#087a51;
        --ssoft:#dcfce7;--danger:#ba1a1a;--dsoft:#ffedeb;
        --ease:cubic-bezier(.2,.8,.2,1);
        width:100%;min-height:100%;padding:24px 30px 42px;color:var(--text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfcIn .25s var(--ease)
      }
      .rf-calls-v7 *{box-sizing:border-box}.rf-calls-v7 a{color:inherit}
      .rf-calls-v7 .spin{animation:rfcSpin .8s linear infinite}
      @keyframes rfcIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      @keyframes rfcRow{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      @keyframes rfcSlide{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
      @keyframes rfcSpin{to{transform:rotate(360deg)}}
      @keyframes rfcPulse{50%{box-shadow:0 0 0 7px rgba(70,72,212,.04)}}
      @keyframes rfcShimmer{from{background-position:200% 0}to{background-position:-200% 0}}

      .rfc-page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:18px}
      .rfc-eyebrow{display:block;margin-bottom:4px;color:var(--primary);font-size:9px;font-weight:750;line-height:13px;letter-spacing:.09em;text-transform:uppercase}
      .rfc-page-header h1{margin:0;font:600 32px/40px Geist,Inter,sans-serif;letter-spacing:-.02em}
      .rfc-page-header p{margin:3px 0 0;color:var(--text2);font-size:13px;line-height:19px}
      .rfc-header-actions{display:flex;gap:8px}
      .rfc-btn{min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:7px 12px;border:1px solid transparent;border-radius:8px;text-decoration:none;white-space:nowrap;cursor:pointer;font:600 10px/15px Inter,sans-serif;transition:.14s var(--ease)}
      .rfc-btn:hover:not(:disabled){transform:translateY(-1px)}
      .rfc-btn:disabled{opacity:.45;cursor:not-allowed}
      .rfc-btn.primary{color:#fff!important;background:var(--primary);border-color:var(--primary);box-shadow:0 5px 14px rgba(70,72,212,.17)}
      .rfc-btn.primary:hover{background:var(--primary2)}
      .rfc-btn.secondary{background:#fff;border-color:var(--line)}
      .rfc-btn.secondary:hover{color:var(--primary)!important;background:var(--psoft)}
      .rfc-btn.danger{color:var(--danger)!important;background:#fff;border-color:#ffd6d2}
      .rfc-btn.danger:hover{background:var(--dsoft)}

      .rfc-agent-strip{min-height:55px;display:flex;align-items:center;gap:9px;padding:8px 11px;margin-bottom:10px;background:#fff;border:1px solid var(--line);border-radius:10px}
      .rfc-agent-strip>span{width:34px;height:34px;display:grid;place-items:center;color:#fff;border-radius:50%;font-size:8px;font-weight:800}
      .rfc-agent-strip>span.primary,.rfc-lead>i.primary{background:#5b5ddd}.rfc-agent-strip>span.violet,.rfc-lead>i.violet{background:#7546d9}
      .rfc-agent-strip>span.blue,.rfc-lead>i.blue{background:#3772b9}.rfc-agent-strip>span.green,.rfc-lead>i.green{background:#23845f}.rfc-agent-strip>span.amber,.rfc-lead>i.amber{background:#a06e25}
      .rfc-agent-strip>div{min-width:0;flex:1;display:flex;align-items:baseline;gap:6px}.rfc-agent-strip small,.rfc-agent-strip em{color:var(--muted);font-size:7px;font-style:normal}.rfc-agent-strip strong{font-size:9px}.rfc-agent-strip>a{color:var(--primary)!important;text-decoration:none;font-size:7px;font-weight:700}

      .rfc-message{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;margin-bottom:10px;color:#7d1717;background:var(--dsoft);border:1px solid #ffd0cc;border-radius:9px}
      .rfc-message>svg{flex:0 0 auto}.rfc-message>div{min-width:0;flex:1;display:grid;gap:1px}.rfc-message strong{font-size:9px}.rfc-message span{font-size:8px}.rfc-message button{padding:5px 8px;color:inherit;background:#fff;border:0;border-radius:6px;cursor:pointer;font-size:7px;font-weight:700}

      .rfc-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
      .rfc-metric{min-height:74px;display:flex;align-items:center;gap:10px;padding:13px 14px;background:#fff;border:1px solid var(--line);border-radius:11px}
      .rfc-metric>span{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;color:var(--primary);background:var(--psoft);border-radius:9px}
      .rfc-metric.violet>span{color:var(--violet);background:var(--vsoft)}.rfc-metric.success>span{color:var(--success);background:var(--ssoft)}.rfc-metric.neutral>span{color:#606673;background:#eef1f5}
      .rfc-metric>div{min-width:0;display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:0 6px}.rfc-metric small{grid-column:1/-1;color:var(--muted);font-size:7px;font-weight:750;letter-spacing:.07em;text-transform:uppercase}
      .rfc-metric strong{font:600 18px/23px Geist,Inter,sans-serif}.rfc-metric em{overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap;font-size:7px;font-style:normal}

      .rfc-workspace{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}.rfc-workspace.detail-open{grid-template-columns:minmax(0,1fr) 410px}
      .rfc-list-card{min-width:0;overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:0 1px 3px rgba(25,28,29,.03)}
      .rfc-toolbar{min-height:64px;display:flex;align-items:center;gap:7px;padding:11px;background:var(--soft);border-bottom:1px solid var(--line)}
      .rfc-search{min-width:230px;height:40px;display:flex;align-items:center;gap:7px;flex:1;padding:0 10px;color:var(--muted);background:#fff;border:1px solid transparent;border-radius:8px}
      .rfc-search:focus-within{border-color:rgba(70,72,212,.42);box-shadow:0 0 0 3px rgba(70,72,212,.07)}
      .rfc-search input{min-width:0;flex:1;height:38px;padding:0;background:transparent;border:0;outline:0;font-size:9px}.rfc-search button{width:24px;height:24px;display:grid;place-items:center;padding:0;color:var(--muted);background:transparent;border:0;border-radius:6px;cursor:pointer}
      .rfc-filter{position:relative;min-width:120px;height:40px;display:flex;align-items:center;padding:0 8px 0 10px;background:#fff;border-radius:8px}.rfc-filter.active{color:var(--primary);background:var(--psoft)}
      .rfc-filter select{min-width:0;flex:1;height:38px;padding:0 18px 0 0;color:inherit;background:transparent;border:0;outline:0;appearance:none;cursor:pointer;font:600 8px/12px Inter,sans-serif}.rfc-filter svg{position:absolute;right:7px;pointer-events:none}
      .rfc-clear{height:40px;padding:0 9px;color:var(--primary);background:transparent;border:0;border-radius:7px;cursor:pointer;font-size:7px;font-weight:700}.rfc-clear:hover{background:var(--psoft)}

      .rfc-table-wrap{width:100%;overflow:auto}.rfc-table{width:100%;min-width:1010px;border-collapse:separate;border-spacing:0;text-align:left;white-space:nowrap}
      .rfc-table th{padding:12px 11px;color:var(--text2);background:#eceeef;border-bottom:1px solid var(--line);font-size:7px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
      .rfc-table td{height:71px;padding:11px;color:var(--text2);vertical-align:middle;font-size:9px}.rfc-table th:first-child,.rfc-table td:first-child{padding-left:16px}.rfc-table th:last-child,.rfc-table td:last-child{padding-right:16px}
      .rfc-table tbody tr{cursor:pointer;animation:rfcRow .22s var(--ease) both;animation-delay:calc(var(--rfc-row-index) * 22ms);transition:.14s var(--ease)}.rfc-table tbody tr:nth-child(even){background:#fcfcfd}.rfc-table tbody tr+tr td{border-top:1px solid #f1f2f3}.rfc-table tbody tr:hover{background:#f7f7fb;box-shadow:inset 3px 0 0 rgba(70,72,212,.38)}.rfc-table tbody tr.selected{background:#f1f1ff;box-shadow:inset 3px 0 0 var(--primary)}
      .rfc-lead{min-width:185px;display:flex;align-items:center;gap:9px}.rfc-lead>i{width:35px;height:35px;display:grid;place-items:center;flex:0 0 35px;color:#fff;border-radius:50%;font-size:8px;font-style:normal;font-weight:800}.rfc-lead>span{min-width:0;display:grid}.rfc-lead strong,.rfc-lead small{max-width:165px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rfc-lead strong{color:var(--text);font:600 10px/14px Geist,Inter,sans-serif}.rfc-lead small{color:var(--text2);font-size:7px}.rfc-table td.number{font-size:8px}
      .rfc-direction{position:relative;width:31px;height:31px;display:grid;place-items:center;color:var(--primary);background:var(--psoft);border-radius:50%}.rfc-direction.inbound{color:var(--violet);background:var(--vsoft)}.rfc-direction i{position:absolute;right:2px;top:1px;font-size:7px;font-style:normal;font-weight:800}
      .rfc-status{min-height:23px;display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:999px;font-size:7px;font-weight:700}.rfc-status>i,.rfc-live>i{width:6px;height:6px;display:block;background:currentColor;border-radius:50%;animation:rfcPulse 1.8s ease-in-out infinite}
      .rfc-status.connected,.rfc-status.live{color:#5131c7;background:#eee7ff}.rfc-status.voicemail{color:#4e5972;background:#e7ebf8}.rfc-status.failed{color:var(--danger);background:var(--dsoft)}.rfc-status.neutral{color:#555b65;background:#e8eaec}
      .rfc-live{display:inline-flex;align-items:center;gap:5px;color:var(--primary);font-size:8px;font-weight:700}
      .rfc-outcome{min-height:24px;display:inline-flex;align-items:center;gap:4px;max-width:125px;overflow:hidden;padding:4px 7px;border-radius:5px;text-overflow:ellipsis;white-space:nowrap;font-size:7px;font-weight:700}.rfc-outcome.meeting{color:var(--primary);background:#dfe0ff}.rfc-outcome.qualified{color:#365f80;background:#e1ecf6}.rfc-outcome.negative{color:var(--danger);background:var(--dsoft)}.rfc-outcome.neutral{color:#5b6069;background:#e9eaec}
      .rfc-meeting{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;color:var(--success);background:var(--ssoft);border-radius:5px;font-size:7px;font-weight:700}.rfc-recording{display:inline-flex;align-items:center;gap:4px;font-size:7px}.rfc-recording.available{color:var(--primary)}.rfc-recording.processing{color:#8a6100}.dash{color:#a0a1a8}
      .rfc-time{display:grid;justify-items:end}.rfc-time strong{color:var(--text);font-size:8px}.rfc-time small{color:var(--muted);font-size:6px}
      .rfc-footer{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 15px;color:var(--text2);background:#fafafb;border-top:1px solid var(--line);font-size:8px}.rfc-pagination{display:flex;align-items:center;gap:5px}.rfc-pagination button{width:29px;height:29px;display:grid;place-items:center;color:var(--text2);background:#fff;border:1px solid var(--line);border-radius:6px;cursor:pointer}.rfc-pagination button:disabled{opacity:.35}.rfc-pagination span{color:var(--muted);font-size:7px}

      .rfc-mobile-list{display:none}
      .rfc-intelligence{min-width:0;max-height:calc(100vh - 96px);position:sticky;top:78px;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:0 12px 32px rgba(25,28,29,.08);animation:rfcSlide .21s var(--ease)}
      .rfc-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:15px 16px;background:#fbfbfc;border-bottom:1px solid var(--line)}.rfc-detail-head h2{margin:0;font:600 15px/20px Geist,Inter,sans-serif}.rfc-detail-head p{margin:2px 0 0;color:var(--text2);font-size:7px}.rfc-detail-head>div:last-child{display:flex;gap:4px}.rfc-detail-head button{width:31px;height:31px;display:grid;place-items:center;padding:0;color:var(--text2);background:#fff;border:1px solid var(--line);border-radius:7px;cursor:pointer}
      .rfc-detail-error{display:flex;gap:6px;padding:8px 10px;margin:10px 11px 0;color:#7d1717;background:var(--dsoft);border-radius:7px;font-size:7px}
      .rfc-playback{padding:13px 14px;margin:11px;background:var(--soft);border-radius:10px}.rfc-playback>div:first-child{display:grid;grid-template-columns:37px 1fr auto;align-items:center;gap:8px}.rfc-playback button{width:37px;height:37px;display:grid;place-items:center;padding:0;color:#fff;background:var(--primary);border:0;border-radius:50%;cursor:pointer}.rfc-playback button:disabled{color:#999;background:#dfe1e4;cursor:not-allowed}.rfc-playback button.ready{background:var(--success)}.rfc-playback span{min-width:0;display:grid}.rfc-playback strong{font-size:8px}.rfc-playback small{overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap;font-size:6px}.rfc-playback em{color:var(--text2);font-size:7px;font-style:normal}.rfc-playback audio{width:100%;height:34px;margin-top:10px}
      .rfc-waveform{height:38px;display:flex;align-items:center;gap:2px;margin-top:9px;overflow:hidden;opacity:.7}.rfc-waveform i{width:2px;height:calc(var(--wave) * 1%);min-height:5px;flex:1;background:#b7b9eb;border-radius:999px}
      .rfc-analysis{padding:6px 14px 14px;border-bottom:1px solid var(--line)}.rfc-analysis-title{display:flex;align-items:center;gap:5px;margin-bottom:9px;color:var(--primary);font-size:7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.rfc-analysis-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:8px}.rfc-analysis-stat{min-height:64px;display:grid;align-content:center;gap:3px;padding:9px;border:1px solid var(--line);border-radius:9px}.rfc-analysis-stat small{color:var(--muted);font-size:6px;text-transform:uppercase}.rfc-analysis-stat strong{display:flex;align-items:center;gap:5px;font-size:9px}.rfc-analysis-stat i{width:7px;height:7px;background:#9ea0a6;border-radius:50%}.rfc-analysis-stat.success i{background:var(--success)}.rfc-analysis-stat.primary i{background:var(--primary)}.rfc-analysis-stat.danger i{background:var(--danger)}
      .rfc-action-item,.rfc-summary{padding:10px 11px;border-radius:8px}.rfc-action-item{margin-bottom:7px;background:#eeeefe;border-left:2px solid var(--primary)}.rfc-summary{background:#fbfbfc;border:1px solid var(--line)}.rfc-action-item span,.rfc-summary span{display:block;margin-bottom:3px;color:var(--primary);font-size:6px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.rfc-summary span{color:var(--text2)}.rfc-action-item p,.rfc-summary p{margin:0;font-size:8px;line-height:13px}.rfc-summary.empty p{color:var(--muted)}
      .rfc-metadata{padding:13px 14px;border-bottom:1px solid var(--line)}.rfc-metadata h3,.rfc-transcript h3{margin:0;font:600 10px/14px Geist,Inter,sans-serif}.rfc-metadata dl{display:grid;gap:6px;margin:9px 0 0}.rfc-metadata dl>div{display:grid;grid-template-columns:84px 1fr;gap:8px}.rfc-metadata dt{color:var(--muted);font-size:7px}.rfc-metadata dd{margin:0;overflow:hidden;text-align:right;text-overflow:ellipsis;white-space:nowrap;font-size:7px;font-weight:600}
      .rfc-transcript{border-bottom:1px solid var(--line)}.rfc-transcript>header{min-height:53px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#fbfbfc;border-bottom:1px solid var(--line)}.rfc-transcript>header>div{display:flex;align-items:baseline;gap:5px}.rfc-transcript>header span{color:var(--muted);font-size:6px}.rfc-transcript label{width:140px;height:30px;display:flex;align-items:center;gap:5px;padding:0 7px;color:var(--muted);background:#fff;border:1px solid var(--line);border-radius:7px}.rfc-transcript input{min-width:0;flex:1;height:28px;padding:0;border:0;outline:0;font-size:7px}.rfc-transcript label button{width:20px;height:20px;display:grid;place-items:center;padding:0;background:transparent;border:0;cursor:pointer}
      .rfc-transcript-body{max-height:370px;overflow:auto;padding:12px;background:#f6f7f8}.rfc-transcript-message{display:grid;grid-template-columns:27px 1fr;gap:7px;margin-bottom:10px}.rfc-transcript-message>span{width:27px;height:27px;display:grid;place-items:center;color:var(--primary);background:#dfe0ff;border-radius:50%;font-size:7px;font-weight:800}.rfc-transcript-message.lead>span{color:#5d6472;background:#e4e6ea}.rfc-transcript-message>div{min-width:0;padding:9px 10px;background:#fff;border:1px solid var(--line);border-radius:9px}.rfc-transcript-message.assistant>div{border-left:2px solid var(--primary)}.rfc-transcript-message header{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}.rfc-transcript-message strong{font-size:7px}.rfc-transcript-message time{color:var(--muted);font-size:6px}.rfc-transcript-message p{margin:0;color:var(--text2);font-size:8px;line-height:13px}.rfc-transcript-empty{min-height:140px;display:grid;place-items:center;align-content:center;gap:4px;padding:18px;color:var(--muted);text-align:center}.rfc-transcript-empty strong{color:var(--text);font-size:8px}.rfc-transcript-empty p{max-width:270px;margin:0;font-size:7px;line-height:12px}
      .rfc-detail-actions{display:flex;justify-content:flex-end;gap:7px;padding:11px 12px;background:#fbfbfc}.rfc-detail-actions .rfc-btn{min-height:34px;padding:6px 9px;font-size:7px}

      .rfc-skeleton{display:grid}.rfc-skeleton>div{display:grid;grid-template-columns:2.2fr repeat(7,1fr);align-items:center;gap:12px;padding:15px;border-bottom:1px solid #f1f2f3}.rfc-skeleton i,.rfc-loading-metric i{display:block;background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);background-size:220% 100%;border-radius:999px;animation:rfcShimmer 1.25s linear infinite}.rfc-skeleton i{height:10px}.rfc-skeleton i.lead{height:34px;border-radius:8px}.rfc-loading-metric>i{width:34px;height:34px;border-radius:9px}.rfc-loading-metric>span{min-width:0;flex:1;display:grid;gap:6px;background:transparent}.rfc-loading-metric>span i:first-child{width:55%;height:8px}.rfc-loading-metric>span i:last-child{width:78%;height:19px}
      .rfc-empty{min-height:350px;display:grid;place-items:center;align-content:center;gap:6px;padding:28px;text-align:center}.rfc-empty>span{width:50px;height:50px;display:grid;place-items:center;color:var(--primary);background:var(--psoft);border-radius:14px}.rfc-empty h2{margin:0;font:600 13px/18px Geist,Inter,sans-serif}.rfc-empty p{max-width:460px;margin:0;color:var(--muted);font-size:8px;line-height:13px}.rfc-empty .rfc-btn{margin-top:5px}

      @media(max-width:1320px){.rfc-workspace.detail-open{grid-template-columns:minmax(0,1fr) 370px}.rfc-toolbar{flex-wrap:wrap}.rfc-search{flex-basis:100%}}
      @media(max-width:1120px){.rf-calls-v7{padding:22px}.rfc-workspace.detail-open{grid-template-columns:1fr}.rfc-intelligence{position:fixed;z-index:180;top:76px;right:12px;bottom:12px;width:min(430px,calc(100vw - 24px));max-height:none}}
      @media(max-width:900px){.rfc-page-header{align-items:flex-start;flex-direction:column}.rfc-header-actions{width:100%;justify-content:flex-end}.rfc-metrics{grid-template-columns:1fr 1fr}.rfc-table-wrap{display:none}.rfc-mobile-list{display:grid}.rfc-mobile-card{width:100%;display:grid;gap:9px;padding:13px 14px;color:inherit;background:#fff;border:0;border-top:1px solid #f0f1f2;text-align:left;cursor:pointer;animation:rfcRow .22s var(--ease) both;animation-delay:calc(var(--rfc-row-index) * 22ms)}.rfc-mobile-card.selected{background:#f1f1ff;box-shadow:inset 3px 0 0 var(--primary)}.rfc-mobile-head{display:flex;align-items:center;gap:8px}.rfc-mobile-head .rfc-lead{min-width:0;flex:1}.rfc-mobile-tags{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding-left:44px}.rfc-mobile-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:9px 0 0 44px;border-top:1px solid #f0f1f2}.rfc-mobile-meta span{min-width:0;display:flex;align-items:center;gap:4px;overflow:hidden;color:var(--text2);text-overflow:ellipsis;white-space:nowrap;font-size:7px}}
      @media(max-width:680px){.rf-calls-v7{padding:18px 12px 84px}.rfc-page-header h1{font-size:25px;line-height:32px}.rfc-header-actions{display:grid;grid-template-columns:1fr 1fr}.rfc-header-actions .primary{grid-column:1/-1}.rfc-agent-strip>div{display:grid}.rfc-metrics{grid-template-columns:1fr}.rfc-toolbar{display:grid;grid-template-columns:1fr 1fr}.rfc-search{grid-column:1/-1;min-width:0}.rfc-filter{min-width:0}.rfc-footer{align-items:flex-start;flex-direction:column}.rfc-intelligence{inset:64px 0 0;width:100vw;max-width:none;border-radius:0}.rfc-mobile-meta{grid-template-columns:1fr}}
      @media(max-width:430px){.rfc-toolbar{grid-template-columns:1fr}.rfc-search{grid-column:auto}.rfc-analysis-grid{grid-template-columns:1fr}.rfc-detail-actions{flex-direction:column}.rfc-detail-actions .rfc-btn{width:100%}}
      @media(prefers-reduced-motion:reduce){.rf-calls-v7,.rfc-table tbody tr,.rfc-mobile-card,.rfc-intelligence,.rfc-status>i,.rfc-live>i,.rfc-skeleton i,.rfc-loading-metric i,.rf-calls-v7 .spin{animation:none!important}.rf-calls-v7 *{transition-duration:.01ms!important}}
    `}</style>
  );
}
