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
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  X,
} from "../components/icons";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  apiRequest,
} from "../lib/workspace-platform-client.js";

const PAGE_SIZE = 12;

const STATUS_TABS = [
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

const VIEW_OPTIONS = [
  ["list", "List"],
  ["calendar", "Calendar"],
];

const SOURCE_FILTERS = [
  ["all", "All sources"],
  ["ai_voice", "AI Voice"],
  ["manual", "Manual"],
  ["email", "Email"],
  ["calendar", "Calendar"],
];

const CANCELLED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "declined",
]);

const COMPLETED_STATUSES = new Set([
  "completed",
  "complete",
  "done",
  "held",
]);

export default function MeetingsPage() {
  const {
    user,
    initializing,
  } = useAuth();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const mountedRef =
    useRef(true);

  const [
    dashboard,
    setDashboard,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    statusTab,
    setStatusTab,
  ] = useState(
    normalizeStatusTab(
      searchParams.get(
        "status"
      )
    )
  );

  const [
    viewMode,
    setViewMode,
  ] = useState(
    normalizeViewMode(
      searchParams.get(
        "view"
      )
    )
  );

  const [
    query,
    setQuery,
  ] = useState(
    searchParams.get(
      "search"
    ) ||
      ""
  );

  const [
    sourceFilter,
    setSourceFilter,
  ] = useState(
    searchParams.get(
      "source"
    ) ||
      "all"
  );

  const [
    selectedMeetingId,
    setSelectedMeetingId,
  ] = useState(
    searchParams.get(
      "meeting"
    ) ||
      ""
  );

  const [
    page,
    setPage,
  ] = useState(
    Math.max(
      1,
      Number(
        searchParams.get(
          "page"
        )
      ) ||
        1
    )
  );

  const [
    calendarCursor,
    setCalendarCursor,
  ] = useState(() => {
    const raw =
      searchParams.get(
        "month"
      );

    const parsed =
      parseMonthCursor(
        raw
      );

    return (
      parsed ||
      startOfMonth(
        new Date()
      )
    );
  });

  const role =
    normalizeRole(
      user?.workspaceRole ||
      user?.role ||
      "caller"
    );

  const accountType =
    String(
      user?.accountType ||
      user?.workspaceType ||
      ""
    )
      .trim()
      .toLowerCase();

  const hasAccess =
    [
      "owner",
      "admin",
      "manager",
    ].includes(
      role
    ) ||
    accountType ===
      "individual";

  const loadDashboard =
    useCallback(
      async ({
        silent = false,
        successToast = false,
      } = {}) => {
        if (!hasAccess) {
          return;
        }

        if (silent) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        try {
          const response =
            await apiRequest(
              "/telnyx/ai-agent/dashboard",
              {
                timeoutMs:
                  35_000,
              }
            );

          if (
            !mountedRef.current
          ) {
            return;
          }

          setDashboard(
            response ||
            {}
          );
          setError("");

          if (
            successToast
          ) {
            notify(
              "success",
              "Meetings refreshed",
              "Latest AI Voice meeting activity is now visible."
            );
          }
        } catch (
          requestError
        ) {
          if (
            !mountedRef.current
          ) {
            return;
          }

          const text =
            safeMessage(
              requestError?.message ||
                "Meetings could not be loaded."
            );

          setError(
            text
          );

          if (
            successToast
          ) {
            notify(
              "error",
              "Meetings refresh failed",
              text
            );
          }
        } finally {
          if (
            mountedRef.current
          ) {
            setLoading(
              false
            );
            setRefreshing(
              false
            );
          }
        }
      },
      [
        hasAccess,
      ]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  useEffect(() => {
    if (
      initializing ||
      !hasAccess
    ) {
      return undefined;
    }

    let running =
      false;

    const run =
      async (
        silent = false
      ) => {
        if (
          running ||
          document.visibilityState ===
            "hidden"
        ) {
          return;
        }

        running =
          true;

        try {
          await loadDashboard({
            silent,
          });
        } finally {
          running =
            false;
        }
      };

    void run(false);

    const timer =
      window.setInterval(
        () => {
          void run(true);
        },
        20_000
      );

    const onVisibility =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void run(true);
        }
      };

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () => {
      window.clearInterval(
        timer
      );

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

  const meetings =
    useMemo(
      () =>
        normalizeMeetings(
          dashboard?.meetings
        ),
      [
        dashboard?.meetings,
      ]
    );

  const calls =
    useMemo(
      () =>
        normalizeCollection(
          dashboard?.calls
        ),
      [
        dashboard?.calls,
      ]
    );

  const agents =
    useMemo(
      () =>
        normalizeAgents(
          dashboard
        ),
      [
        dashboard,
      ]
    );

  const tabCounts =
    useMemo(
      () =>
        buildTabCounts(
          meetings
        ),
      [
        meetings,
      ]
    );

  const filteredMeetings =
    useMemo(
      () => {
        const search =
          query
            .trim()
            .toLowerCase();

        return meetings.filter(
          (meeting) => {
            if (
              getMeetingBucket(
                meeting
              ) !==
              statusTab
            ) {
              return false;
            }

            if (
              sourceFilter !==
                "all" &&
              getMeetingSource(
                meeting,
                calls
              ).key !==
                sourceFilter
            ) {
              return false;
            }

            if (!search) {
              return true;
            }

            const owner =
              getMeetingOwner(
                meeting,
                agents
              );

            return [
              meeting.leadName,
              meeting.attendeeName,
              meeting.contactName,
              meeting.companyName,
              meeting.business,
              meeting.attendeeEmail,
              meeting.attendeePhone,
              meeting.timezone,
              meeting.notes,
              meeting.summary,
              meeting.status,
              meeting.platform,
              meeting.title,
              owner.name,
              getMeetingSource(
                meeting,
                calls
              ).label,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(
                search
              );
          }
        );
      },
      [
        agents,
        calls,
        meetings,
        query,
        sourceFilter,
        statusTab,
      ]
    );

  const pageCount =
    Math.max(
      1,
      Math.ceil(
        filteredMeetings.length /
          PAGE_SIZE
      )
    );

  const safePage =
    Math.min(
      page,
      pageCount
    );

  const pageMeetings =
    useMemo(
      () =>
        filteredMeetings.slice(
          (
            safePage -
            1
          ) *
            PAGE_SIZE,
          safePage *
            PAGE_SIZE
        ),
      [
        filteredMeetings,
        safePage,
      ]
    );

  const selectedMeeting =
    useMemo(
      () =>
        meetings.find(
          (meeting) =>
            String(
              meeting.id
            ) ===
            String(
              selectedMeetingId
            )
        ) ||
        null,
      [
        meetings,
        selectedMeetingId,
      ]
    );

  const selectedCall =
    useMemo(
      () =>
        selectedMeeting
          ? findLinkedCall(
              selectedMeeting,
              calls
            )
          : null,
      [
        calls,
        selectedMeeting,
      ]
    );

  const selectedAgent =
    useMemo(
      () =>
        selectedMeeting
          ? findMeetingAgent(
              selectedMeeting,
              agents,
              selectedCall
            )
          : null,
      [
        agents,
        selectedCall,
        selectedMeeting,
      ]
    );

  const calendarDays =
    useMemo(
      () =>
        buildCalendarDays(
          calendarCursor,
          filteredMeetings
        ),
      [
        calendarCursor,
        filteredMeetings,
      ]
    );

  const upcomingPreview =
    useMemo(
      () =>
        meetings
          .filter(
            (meeting) =>
              getMeetingBucket(
                meeting
              ) ===
              "upcoming"
          )
          .slice(
            0,
            3
          ),
      [
        meetings,
      ]
    );

  const sourceBreakdown =
    useMemo(
      () =>
        buildSourceBreakdown(
          meetings,
          calls
        ),
      [
        calls,
        meetings,
      ]
    );

  function updateUrl(
    updates
  ) {
    const next =
      new URLSearchParams(
        searchParams
      );

    Object.entries(
      updates
    ).forEach(
      ([
        key,
        value,
      ]) => {
        if (
          value ===
            undefined ||
          value ===
            null ||
          value ===
            "" ||
          value ===
            "all" ||
          (
            key ===
              "page" &&
            Number(
              value
            ) <=
              1
          )
        ) {
          next.delete(
            key
          );
        } else {
          next.set(
            key,
            String(
              value
            )
          );
        }
      }
    );

    setSearchParams(
      next,
      {
        replace:
          true,
      }
    );
  }

  function changeStatus(
    nextStatus
  ) {
    const normalized =
      normalizeStatusTab(
        nextStatus
      );

    setStatusTab(
      normalized
    );
    setPage(
      1
    );

    updateUrl({
      status:
        normalized,
      page:
        null,
    });
  }

  function changeView(
    nextView
  ) {
    const normalized =
      normalizeViewMode(
        nextView
      );

    setViewMode(
      normalized
    );

    updateUrl({
      view:
        normalized,
    });
  }

  function changeMonth(
    offset
  ) {
    const nextDate =
      new Date(
        calendarCursor
      );

    nextDate.setMonth(
      nextDate.getMonth() +
      offset
    );

    const nextMonth =
      startOfMonth(
        nextDate
      );

    setCalendarCursor(
      nextMonth
    );

    updateUrl({
      month:
        formatMonthParam(
          nextMonth
        ),
    });
  }

  function openMeeting(
    meeting
  ) {
    if (
      !meeting?.id
    ) {
      return;
    }

    setSelectedMeetingId(
      meeting.id
    );

    updateUrl({
      meeting:
        meeting.id,
    });
  }

  function closeMeeting() {
    setSelectedMeetingId(
      ""
    );

    updateUrl({
      meeting:
        null,
    });
  }

  function openMeetingLink(
    meeting
  ) {
    const link =
      getMeetingLink(
        meeting
      );

    if (!link) {
      notify(
        "info",
        "Meeting link unavailable",
        "A join link is not saved on this meeting."
      );

      return;
    }

    window.open(
      link,
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (
    initializing
  ) {
    return (
      <>
        <MeetingsStyles />
        <MeetingsSkeleton />
      </>
    );
  }

  if (
    role ===
    "caller"
  ) {
    return (
      <Navigate
        to="/app/dashboard"
        replace
      />
    );
  }

  if (
    !hasAccess
  ) {
    return (
      <Navigate
        to="/app/dashboard"
        replace
      />
    );
  }

  return (
    <>
      <MeetingsStyles />

      <div className="rf-meetings-v7">
        <header className="rfm-page-header">
          <div>
            <span className="rfm-eyebrow">
              CRM
            </span>

            <h1>
              Meetings
            </h1>

            <p>
              Manage and review appointments booked by AI Voice and your
              connected calendar workflows.
            </p>
          </div>

          <div className="rfm-header-actions">
            <ViewToggle
              value={
                viewMode
              }
              onChange={
                changeView
              }
            />

            <button
              type="button"
              className="rfm-btn rfm-btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadDashboard({
                  silent:
                    true,
                  successToast:
                    true,
                })
              }
            >
              <RefreshCw
                size={15}
                className={
                  refreshing
                    ? "spin"
                    : ""
                }
              />
              Refresh
            </button>

            <Link
              className="rfm-btn rfm-btn-primary"
              to="/app/voice-agents"
            >
              <Bot size={15} />
              Booking Setup
            </Link>
          </div>
        </header>

        {error ? (
          <section
            className="rfm-message"
            role="alert"
          >
            <span>
              <X size={15} />
            </span>

            <div>
              <strong>
                Meetings need attention
              </strong>

              <small>
                {error}
              </small>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadDashboard({
                  successToast:
                    true,
                })
              }
            >
              Try again
            </button>
          </section>
        ) : null}

        <section className="rfm-tabs-bar">
          <div className="rfm-tabs">
            {STATUS_TABS.map(
              ([
                key,
                label,
              ]) => (
                <button
                  type="button"
                  key={
                    key
                  }
                  className={
                    statusTab ===
                    key
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    changeStatus(
                      key
                    )
                  }
                >
                  {label}

                  <span>
                    {tabCounts[
                      key
                    ] ||
                    0}
                  </span>
                </button>
              )
            )}
          </div>

          <div className="rfm-toolbar">
            <label className="rfm-search">
              <Search size={15} />

              <input
                value={
                  query
                }
                onChange={(
                  event
                ) => {
                  const value =
                    event.target
                      .value;

                  setQuery(
                    value
                  );
                  setPage(
                    1
                  );

                  updateUrl({
                    search:
                      value.trim()
                        ? value
                        : null,
                    page:
                      null,
                  });
                }}
                placeholder="Search meetings..."
                aria-label="Search meetings"
              />

              {query ? (
                <button
                  type="button"
                  aria-label="Clear meeting search"
                  onClick={() => {
                    setQuery("");
                    setPage(
                      1
                    );

                    updateUrl({
                      search:
                        null,
                      page:
                        null,
                    });
                  }}
                >
                  <X size={11} />
                </button>
              ) : null}
            </label>

            <label
              className={`rfm-filter ${
                sourceFilter !==
                "all"
                  ? "active"
                  : ""
              }`}
            >
              <select
                value={
                  sourceFilter
                }
                onChange={(
                  event
                ) => {
                  const value =
                    event.target
                      .value;

                  setSourceFilter(
                    value
                  );
                  setPage(
                    1
                  );

                  updateUrl({
                    source:
                      value,
                    page:
                      null,
                  });
                }}
                aria-label="Filter meetings by source"
              >
                {SOURCE_FILTERS.map(
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

              <ChevronDown
                size={12}
              />
            </label>
          </div>
        </section>

        <section
          className={`rfm-workspace ${
            selectedMeeting
              ? "detail-open"
              : ""
          }`}
        >
          <main className="rfm-main-card">
            {loading ? (
              <MeetingListSkeleton />
            ) : viewMode ===
              "calendar" ? (
              <CalendarView
                cursor={
                  calendarCursor
                }
                days={
                  calendarDays
                }
                onPrevious={() =>
                  changeMonth(
                    -1
                  )
                }
                onNext={() =>
                  changeMonth(
                    1
                  )
                }
                onToday={() => {
                  const now =
                    startOfMonth(
                      new Date()
                    );

                  setCalendarCursor(
                    now
                  );

                  updateUrl({
                    month:
                      formatMonthParam(
                        now
                      ),
                  });
                }}
                onOpen={
                  openMeeting
                }
              />
            ) : filteredMeetings.length ? (
              <>
                <div className="rfm-table-wrap">
                  <table className="rfm-table">
                    <thead>
                      <tr>
                        <th>
                          Contact & Company
                        </th>

                        <th>
                          Date & Time
                        </th>

                        <th>
                          Source
                        </th>

                        <th>
                          Owner
                        </th>

                        <th>
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {pageMeetings.map(
                        (
                          meeting,
                          index
                        ) => (
                          <MeetingRow
                            key={
                              meeting.id ||
                              index
                            }
                            meeting={
                              meeting
                            }
                            source={
                              getMeetingSource(
                                meeting,
                                calls
                              )
                            }
                            owner={
                              getMeetingOwner(
                                meeting,
                                agents
                              )
                            }
                            selected={
                              String(
                                selectedMeeting?.id
                              ) ===
                              String(
                                meeting.id
                              )
                            }
                            index={
                              index
                            }
                            onOpen={() =>
                              openMeeting(
                                meeting
                              )
                            }
                          />
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="rfm-mobile-list">
                  {pageMeetings.map(
                    (
                      meeting,
                      index
                    ) => (
                      <MeetingMobileCard
                        key={
                          meeting.id ||
                          index
                        }
                        meeting={
                          meeting
                        }
                        source={
                          getMeetingSource(
                            meeting,
                            calls
                          )
                        }
                        owner={
                          getMeetingOwner(
                            meeting,
                            agents
                          )
                        }
                        selected={
                          String(
                            selectedMeeting?.id
                          ) ===
                          String(
                            meeting.id
                          )
                        }
                        index={
                          index
                        }
                        onOpen={() =>
                          openMeeting(
                            meeting
                          )
                        }
                      />
                    )
                  )}
                </div>

                <footer className="rfm-table-footer">
                  <span>
                    Showing{" "}
                    <strong>
                      {(
                        safePage -
                        1
                      ) *
                        PAGE_SIZE +
                        1}
                    </strong>{" "}
                    to{" "}
                    <strong>
                      {Math.min(
                        safePage *
                          PAGE_SIZE,
                        filteredMeetings.length
                      )}
                    </strong>{" "}
                    of{" "}
                    <strong>
                      {filteredMeetings.length}
                    </strong>{" "}
                    meetings
                  </span>

                  <Pagination
                    page={
                      safePage
                    }
                    count={
                      pageCount
                    }
                    onChange={(
                      nextPage
                    ) => {
                      setPage(
                        nextPage
                      );

                      updateUrl({
                        page:
                          nextPage,
                      });
                    }}
                  />
                </footer>
              </>
            ) : (
              <MeetingEmptyState
                status={
                  statusTab
                }
                filtered={
                  Boolean(
                    query ||
                    sourceFilter !==
                      "all"
                  )
                }
                onClear={() => {
                  setQuery("");
                  setSourceFilter(
                    "all"
                  );
                  setPage(
                    1
                  );

                  updateUrl({
                    search:
                      null,
                    source:
                      null,
                    page:
                      null,
                  });
                }}
              />
            )}
          </main>

          {selectedMeeting ? (
            <MeetingDetailPanel
              meeting={
                selectedMeeting
              }
              source={
                getMeetingSource(
                  selectedMeeting,
                  calls
                )
              }
              owner={
                getMeetingOwner(
                  selectedMeeting,
                  agents
                )
              }
              linkedCall={
                selectedCall
              }
              agent={
                selectedAgent
              }
              onClose={
                closeMeeting
              }
              onJoin={() =>
                openMeetingLink(
                  selectedMeeting
                )
              }
            />
          ) : (
            <MeetingsContextPanel
              meetings={
                upcomingPreview
              }
              sourceBreakdown={
                sourceBreakdown
              }
              agents={
                agents
              }
              onOpen={
                openMeeting
              }
            />
          )}
        </section>
      </div>
    </>
  );
}

function ViewToggle({
  value,
  onChange,
}) {
  return (
    <div className="rfm-view-toggle">
      {VIEW_OPTIONS.map(
        ([
          key,
          label,
        ]) => (
          <button
            type="button"
            key={
              key
            }
            className={
              value ===
              key
                ? "active"
                : ""
            }
            onClick={() =>
              onChange(
                key
              )
            }
          >
            {key ===
            "calendar" ? (
              <Calendar size={13} />
            ) : (
              <MessageCircle size={13} />
            )}

            {label}
          </button>
        )
      )}
    </div>
  );
}

function MeetingRow({
  meeting,
  source,
  owner,
  selected,
  index,
  onOpen,
}) {
  const status =
    getMeetingStatus(
      meeting
    );

  return (
    <tr
      className={
        selected
          ? "selected"
          : ""
      }
      style={{
        "--rfm-index":
          index,
      }}
      onClick={
        onOpen
      }
    >
      <td>
        <ContactIdentity
          meeting={
            meeting
          }
        />
      </td>

      <td>
        <span className="rfm-date-cell">
          <strong>
            {formatMeetingDate(
              meeting.startAt
            )}
          </strong>

          <small>
            {formatMeetingTimeRange(
              meeting
            )}
          </small>
        </span>
      </td>

      <td>
        <SourceBadge
          source={
            source
          }
        />
      </td>

      <td>
        <OwnerIdentity
          owner={
            owner
          }
        />
      </td>

      <td>
        <MeetingStatusBadge
          status={
            status
          }
        />
      </td>
    </tr>
  );
}

function MeetingMobileCard({
  meeting,
  source,
  owner,
  selected,
  index,
  onOpen,
}) {
  return (
    <button
      type="button"
      className={`rfm-mobile-card ${
        selected
          ? "selected"
          : ""
      }`}
      style={{
        "--rfm-index":
          index,
      }}
      onClick={
        onOpen
      }
    >
      <div className="rfm-mobile-head">
        <ContactIdentity
          meeting={
            meeting
          }
        />

        <ChevronRight size={14} />
      </div>

      <div className="rfm-mobile-tags">
        <SourceBadge
          source={
            source
          }
        />

        <MeetingStatusBadge
          status={
            getMeetingStatus(
              meeting
            )
          }
        />
      </div>

      <div className="rfm-mobile-meta">
        <span>
          <Calendar size={11} />

          {formatMeetingDate(
            meeting.startAt
          )}
        </span>

        <span>
          <Clock3 size={11} />

          {formatMeetingTimeRange(
            meeting
          )}
        </span>

        <span>
          <UserRound size={11} />

          {owner.name}
        </span>
      </div>
    </button>
  );
}

function ContactIdentity({
  meeting,
}) {
  const name =
    getMeetingLeadName(
      meeting
    );

  const company =
    firstString(
      meeting.companyName,
      meeting.business,
      meeting.company,
      meeting.organization,
      meeting.domain
    );

  return (
    <span className="rfm-contact">
      <i
        className={
          avatarTone(
            name
          )
        }
      >
        {initials(
          name
        )}
      </i>

      <span>
        <strong>
          {name}
        </strong>

        <small>
          {company ||
            "Meeting attendee"}
        </small>
      </span>
    </span>
  );
}

function OwnerIdentity({
  owner,
}) {
  return (
    <span className="rfm-owner">
      <i
        className={
          avatarTone(
            owner.name
          )
        }
      >
        {owner.avatarUrl ? (
          <img
            src={
              owner.avatarUrl
            }
            alt=""
          />
        ) : (
          initials(
            owner.name
          )
        )}
      </i>

      <span>
        {owner.name}
      </span>
    </span>
  );
}

function SourceBadge({
  source,
}) {
  return (
    <span
      className={`rfm-source ${source.key}`}
    >
      {source.key ===
      "ai_voice" ? (
        <Bot size={11} />
      ) : source.key ===
        "email" ? (
        <Mail size={11} />
      ) : source.key ===
        "calendar" ? (
        <Calendar size={11} />
      ) : (
        <UserRound size={11} />
      )}

      {source.label}
    </span>
  );
}

function MeetingStatusBadge({
  status,
}) {
  return (
    <span
      className={`rfm-status ${status.tone}`}
    >
      <i />

      {status.label}
    </span>
  );
}

function MeetingDetailPanel({
  meeting,
  source,
  owner,
  linkedCall,
  agent,
  onClose,
  onJoin,
}) {
  const status =
    getMeetingStatus(
      meeting
    );

  const link =
    getMeetingLink(
      meeting
    );

  const callContext =
    buildCallContext(
      linkedCall
    );

  const notes =
    firstString(
      meeting.notes,
      meeting.preMeetingNotes,
      meeting.agenda,
      meeting.description
    );

  const company =
    firstString(
      meeting.companyName,
      meeting.business,
      meeting.company,
      meeting.organization
    );

  const attendeeEmail =
    firstString(
      meeting.attendeeEmail,
      meeting.email,
      meeting.contactEmail
    );

  const attendeePhone =
    firstString(
      meeting.attendeePhone,
      meeting.phone,
      meeting.contactPhone
    );

  return (
    <aside className="rfm-detail-panel">
      <header className="rfm-detail-head">
        <div>
          <span className="rfm-eyebrow">
            Meeting details
          </span>

          <h2>
            {getMeetingTitle(
              meeting
            )}
          </h2>

          <p>
            {formatFullMeetingDate(
              meeting.startAt
            )}
          </p>
        </div>

        <button
          type="button"
          aria-label="Close meeting details"
          onClick={
            onClose
          }
        >
          <X size={15} />
        </button>
      </header>

      <section className="rfm-detail-person">
        <span
          className={
            avatarTone(
              getMeetingLeadName(
                meeting
              )
            )
          }
        >
          {initials(
            getMeetingLeadName(
              meeting
            )
          )}
        </span>

        <div>
          <strong>
            {getMeetingLeadName(
              meeting
            )}
          </strong>

          <small>
            {company ||
              attendeeEmail ||
              "Meeting attendee"}
          </small>
        </div>

        <MeetingStatusBadge
          status={
            status
          }
        />
      </section>

      <section className="rfm-detail-grid">
        <DetailTile
          label="Date & Time"
          value={
            formatMeetingDateTime(
              meeting
            )
          }
          icon={
            <Calendar size={13} />
          }
        />

        <DetailTile
          label="Platform"
          value={
            getMeetingPlatform(
              meeting
            )
          }
          icon={
            <MessageCircle size={13} />
          }
        />
      </section>

      <section className="rfm-booking-context">
        <header>
          <Sparkles size={14} />

          <span>
            Booking Context
          </span>
        </header>

        <p>
          {firstString(
            meeting.bookingContext,
            meeting.summary,
            meeting.context,
            callContext.summary,
            source.key ===
              "ai_voice"
              ? "This appointment was booked through the AI Voice workflow. Open the linked call for the original conversation context."
              : "No additional booking context is saved for this appointment."
          )}
        </p>

        {linkedCall ? (
          <Link
            to={`/app/calls?call=${encodeURIComponent(
              linkedCall.id
            )}`}
          >
            <Phone size={12} />

            View linked call

            <ChevronRight size={12} />
          </Link>
        ) : null}
      </section>

      <section className="rfm-detail-section">
        <h3>
          Event Details
        </h3>

        <dl>
          <DetailRow
            label="Source"
            value={
              source.label
            }
          />

          <DetailRow
            label="Owner"
            value={
              owner.name
            }
          />

          <DetailRow
            label="Timezone"
            value={
              meeting.timezone ||
              "—"
            }
          />

          <DetailRow
            label="Duration"
            value={`${getMeetingDuration(
              meeting
            )} minutes`}
          />

          <DetailRow
            label="Email"
            value={
              attendeeEmail ||
              "Not supplied"
            }
          />

          <DetailRow
            label="Phone"
            value={
              attendeePhone
                ? formatPhone(
                    attendeePhone
                  )
                : "Not supplied"
            }
          />
        </dl>
      </section>

      {agent ? (
        <section className="rfm-detail-section">
          <h3>
            AI Voice Agent
          </h3>

          <Link
            className="rfm-agent-link"
            to={`/app/voice-agents${
              agent.id
                ? `?agentId=${encodeURIComponent(
                    agent.id
                  )}`
                : ""
            }`}
          >
            <span
              className={
                avatarTone(
                  agent.name
                )
              }
            >
              {initials(
                agent.name ||
                "AI"
              )}
            </span>

            <div>
              <strong>
                {agent.name ||
                  "AI Voice Agent"}
              </strong>

              <small>
                {formatAgentMode(
                  agent
                )}
              </small>
            </div>

            <ChevronRight size={13} />
          </Link>
        </section>
      ) : null}

      <section className="rfm-detail-section">
        <h3>
          Pre-Meeting Notes
        </h3>

        {notes ? (
          <div className="rfm-notes">
            {splitNotes(
              notes
            ).map(
              (
                line,
                index
              ) => (
                <p
                  key={`${line}-${index}`}
                >
                  <i />

                  <span>
                    {line}
                  </span>
                </p>
              )
            )}
          </div>
        ) : (
          <div className="rfm-empty-notes">
            No pre-meeting notes are saved for this appointment.
          </div>
        )}
      </section>

      <footer className="rfm-detail-actions">
        {attendeeEmail ? (
          <a
            className="rfm-btn rfm-btn-secondary"
            href={`mailto:${encodeURIComponent(
              attendeeEmail
            )}`}
          >
            <Mail size={13} />

            Email
          </a>
        ) : null}

        {attendeePhone ? (
          <Link
            className="rfm-btn rfm-btn-secondary"
            to={`/app/dialer?phone=${encodeURIComponent(
              attendeePhone
            )}`}
          >
            <Phone size={13} />

            Call
          </Link>
        ) : null}

        {link ? (
          <button
            type="button"
            className="rfm-btn rfm-btn-primary"
            onClick={
              onJoin
            }
          >
            Join Meeting

            <ExternalLink size={13} />
          </button>
        ) : null}
      </footer>
    </aside>
  );
}

function DetailTile({
  icon,
  label,
  value,
}) {
  return (
    <article>
      <span>
        {icon}
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>
      </div>
    </article>
  );
}

function DetailRow({
  label,
  value,
}) {
  return (
    <div>
      <dt>
        {label}
      </dt>

      <dd>
        {value}
      </dd>
    </div>
  );
}

function MeetingsContextPanel({
  meetings,
  sourceBreakdown,
  agents,
  onOpen,
}) {
  return (
    <aside className="rfm-context-panel">
      <section className="rfm-context-card">
        <header>
          <span>
            <Calendar size={15} />
          </span>

          <div>
            <small>
              Up next
            </small>

            <strong>
              Upcoming meetings
            </strong>
          </div>
        </header>

        {meetings.length ? (
          <div className="rfm-upcoming-stack">
            {meetings.map(
              (
                meeting
              ) => (
                <button
                  type="button"
                  key={
                    meeting.id
                  }
                  onClick={() =>
                    onOpen(
                      meeting
                    )
                  }
                >
                  <span className="rfm-mini-date">
                    <strong>
                      {formatDay(
                        meeting.startAt
                      )}
                    </strong>

                    <small>
                      {formatMonthShort(
                        meeting.startAt
                      )}
                    </small>
                  </span>

                  <span>
                    <strong>
                      {getMeetingLeadName(
                        meeting
                      )}
                    </strong>

                    <small>
                      {formatMeetingTimeRange(
                        meeting
                      )}
                    </small>
                  </span>

                  <ChevronRight size={12} />
                </button>
              )
            )}
          </div>
        ) : (
          <div className="rfm-context-empty">
            No upcoming meetings yet.
          </div>
        )}
      </section>

      <section className="rfm-context-card">
        <header>
          <span className="violet">
            <Sparkles size={15} />
          </span>

          <div>
            <small>
              Attribution
            </small>

            <strong>
              Booking sources
            </strong>
          </div>
        </header>

        <div className="rfm-source-breakdown">
          {sourceBreakdown.map(
            (
              item
            ) => (
              <div
                key={
                  item.key
                }
              >
                <span>
                  <i
                    style={{
                      "--rfm-share":
                        `${Math.max(
                          4,
                          item.share
                        )}%`,
                    }}
                  />
                </span>

                <div>
                  <strong>
                    {item.label}
                  </strong>

                  <small>
                    {item.count} meeting
                    {item.count ===
                    1
                      ? ""
                      : "s"}
                  </small>
                </div>

                <em>
                  {item.share.toFixed(
                    0
                  )}
                  %
                </em>
              </div>
            )
          )}
        </div>
      </section>

      <section className="rfm-context-card">
        <header>
          <span className="green">
            <Bot size={15} />
          </span>

          <div>
            <small>
              Booking automation
            </small>

            <strong>
              Voice Agent calendars
            </strong>
          </div>
        </header>

        <p className="rfm-context-copy">
          AI Voice Agents can book confirmed meetings when a calendar is
          assigned and meeting booking is enabled.
        </p>

        <div className="rfm-agent-count">
          <strong>
            {agents.length}
          </strong>

          <span>
            configured Voice Agent
            {agents.length ===
            1
              ? ""
              : "s"}
          </span>
        </div>

        <Link
          className="rfm-context-link"
          to="/app/voice-agents"
        >
          Configure booking

          <ChevronRight size={12} />
        </Link>
      </section>
    </aside>
  );
}

function CalendarView({
  cursor,
  days,
  onPrevious,
  onNext,
  onToday,
  onOpen,
}) {
  return (
    <section className="rfm-calendar">
      <header>
        <div>
          <button
            type="button"
            onClick={
              onPrevious
            }
            aria-label="Previous month"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={
              onNext
            }
            aria-label="Next month"
          >
            ›
          </button>

          <h2>
            {cursor.toLocaleDateString(
              undefined,
              {
                month:
                  "long",
                year:
                  "numeric",
              }
            )}
          </h2>
        </div>

        <button
          type="button"
          className="rfm-today-btn"
          onClick={
            onToday
          }
        >
          Today
        </button>
      </header>

      <div className="rfm-calendar-weekdays">
        {[
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ].map(
          (day) => (
            <span
              key={
                day
              }
            >
              {day}
            </span>
          )
        )}
      </div>

      <div className="rfm-calendar-grid">
        {days.map(
          (
            day
          ) => (
            <article
              key={
                day.key
              }
              className={`${day.currentMonth
                ? ""
                : "outside"} ${day.today
                ? "today"
                : ""}`}
            >
              <span className="rfm-day-number">
                {day.date.getDate()}
              </span>

              <div>
                {day.meetings
                  .slice(
                    0,
                    3
                  )
                  .map(
                    (
                      meeting
                    ) => (
                      <button
                        type="button"
                        key={
                          meeting.id
                        }
                        onClick={() =>
                          onOpen(
                            meeting
                          )
                        }
                      >
                        <strong>
                          {formatTime(
                            meeting.startAt
                          )}
                        </strong>

                        <span>
                          {getMeetingLeadName(
                            meeting
                          )}
                        </span>
                      </button>
                    )
                  )}

                {day.meetings.length >
                3 ? (
                  <small>
                    +
                    {day.meetings.length -
                      3}{" "}
                    more
                  </small>
                ) : null}
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}

function Pagination({
  page,
  count,
  onChange,
}) {
  if (
    count <=
    1
  ) {
    return null;
  }

  return (
    <nav
      className="rfm-pagination"
      aria-label="Meeting pages"
    >
      <button
        type="button"
        disabled={
          page <=
          1
        }
        onClick={() =>
          onChange(
            page -
            1
          )
        }
      >
        ‹
      </button>

      <span>
        {page} / {count}
      </span>

      <button
        type="button"
        disabled={
          page >=
          count
        }
        onClick={() =>
          onChange(
            page +
            1
          )
        }
      >
        ›
      </button>
    </nav>
  );
}

function MeetingEmptyState({
  status,
  filtered,
  onClear,
}) {
  const copy =
    status ===
    "completed"
      ? {
          title:
            "No completed meetings yet",
          text:
            "Past or completed meetings will appear here automatically.",
        }
      : status ===
          "cancelled"
        ? {
            title:
              "No cancelled meetings",
            text:
              "Cancelled appointments will be retained here for history.",
          }
        : {
            title:
              "No upcoming meetings booked",
            text:
              "Confirmed appointments created by AI Voice or connected calendar workflows will appear here.",
          };

  return (
    <div className="rfm-empty-state">
      <span>
        <Calendar size={24} />
      </span>

      <h2>
        {filtered
          ? "No matching meetings"
          : copy.title}
      </h2>

      <p>
        {filtered
          ? "Try another search or clear the current source filter."
          : copy.text}
      </p>

      {filtered ? (
        <button
          type="button"
          className="rfm-btn rfm-btn-secondary"
          onClick={
            onClear
          }
        >
          Clear filters
        </button>
      ) : (
        <Link
          className="rfm-btn rfm-btn-primary"
          to="/app/voice-agents"
        >
          <Bot size={13} />

          Configure booking
        </Link>
      )}
    </div>
  );
}

function MeetingListSkeleton() {
  return (
    <div
      className="rfm-list-skeleton"
      aria-busy="true"
      aria-label="Loading meetings"
    >
      {Array.from({
        length:
          6,
      }).map(
        (
          _,
          row
        ) => (
          <div
            key={
              row
            }
          >
            <i className="person" />

            <i />

            <i />

            <i />

            <i />
          </div>
        )
      )}
    </div>
  );
}

function MeetingsSkeleton() {
  return (
    <div
      className="rf-meetings-v7"
      aria-busy="true"
      aria-label="Loading meetings"
    >
      <header className="rfm-page-header">
        <div>
          <span className="rfm-eyebrow">
            CRM
          </span>

          <h1>
            Meetings
          </h1>

          <p>
            Loading scheduled appointments…
          </p>
        </div>
      </header>

      <section className="rfm-tabs-bar">
        <div className="rfm-tabs">
          <i />
          <i />
          <i />
        </div>
      </section>

      <section className="rfm-workspace">
        <main className="rfm-main-card">
          <MeetingListSkeleton />
        </main>
      </section>
    </div>
  );
}

/* ==========================================================================
 * Data adapters
 * ======================================================================= */

function normalizeMeetings(
  value
) {
  return normalizeCollection(
    value
  )
    .map(
      (
        meeting,
        index
      ) => ({
        ...meeting,
        id:
          meeting.id ||
          meeting.meetingId ||
          meeting.eventId ||
          `meeting-${index}`,
      })
    )
    .sort(
      (
        left,
        right
      ) =>
        timestamp(
          left.startAt
        ) -
        timestamp(
          right.startAt
        )
    );
}

function normalizeCollection(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }

  if (
    Array.isArray(
      value?.items
    )
  ) {
    return value.items;
  }

  if (
    Array.isArray(
      value?.data
    )
  ) {
    return value.data;
  }

  return [];
}

function normalizeAgents(
  dashboard
) {
  const agents =
    normalizeCollection(
      dashboard?.agents
    );

  if (
    agents.length
  ) {
    return agents;
  }

  return dashboard?.agent
    ? [
        dashboard.agent,
      ]
    : [];
}

function buildTabCounts(
  meetings
) {
  return meetings.reduce(
    (
      output,
      meeting
    ) => {
      const bucket =
        getMeetingBucket(
          meeting
        );

      output[
        bucket
      ] =
        (
          output[
            bucket
          ] ||
          0
        ) +
        1;

      return output;
    },
    {
      upcoming:
        0,
      completed:
        0,
      cancelled:
        0,
    }
  );
}

function getMeetingBucket(
  meeting
) {
  const status =
    normalizeToken(
      meeting?.status
    );

  if (
    CANCELLED_STATUSES.has(
      status
    )
  ) {
    return "cancelled";
  }

  if (
    COMPLETED_STATUSES.has(
      status
    )
  ) {
    return "completed";
  }

  const start =
    timestamp(
      meeting?.startAt
    );

  if (
    start &&
    start <
      Date.now()
  ) {
    return "completed";
  }

  return "upcoming";
}

function getMeetingStatus(
  meeting
) {
  const bucket =
    getMeetingBucket(
      meeting
    );

  const raw =
    normalizeToken(
      meeting?.status
    );

  if (
    bucket ===
    "cancelled"
  ) {
    return {
      label:
        "Cancelled",
      tone:
        "cancelled",
    };
  }

  if (
    bucket ===
    "completed"
  ) {
    return {
      label:
        raw ===
        "completed"
          ? "Completed"
          : "Completed",
      tone:
        "completed",
    };
  }

  if (
    [
      "tentative",
      "pending",
    ].includes(
      raw
    )
  ) {
    return {
      label:
        "Tentative",
      tone:
        "tentative",
    };
  }

  return {
    label:
      raw ===
      "confirmed"
        ? "Confirmed"
        : "Upcoming",
    tone:
      "upcoming",
  };
}

function getMeetingSource(
  meeting,
  calls
) {
  const raw =
    normalizeToken(
      firstString(
        meeting?.source,
        meeting?.bookingSource,
        meeting?.createdByType,
        meeting?.channel
      )
    );

  if (
    [
      "ai_voice",
      "voice_agent",
      "ai_voice_agent",
      "voice",
      "call",
    ].includes(
      raw
    )
  ) {
    return {
      key:
        "ai_voice",
      label:
        "AI Voice Agent",
    };
  }

  if (
    [
      "email",
      "email_sequence",
      "sequence",
    ].includes(
      raw
    )
  ) {
    return {
      key:
        "email",
      label:
        "Email Sequence",
    };
  }

  if (
    [
      "manual",
      "manual_entry",
      "user",
    ].includes(
      raw
    )
  ) {
    return {
      key:
        "manual",
      label:
        "Manual Entry",
    };
  }

  if (
    [
      "calendar",
      "google_calendar",
      "calendar_event",
    ].includes(
      raw
    )
  ) {
    return {
      key:
        "calendar",
      label:
        "Calendar",
    };
  }

  if (
    meeting?.agentId ||
    meeting?.voiceAgentId ||
    findLinkedCall(
      meeting,
      calls
    )
  ) {
    return {
      key:
        "ai_voice",
      label:
        "AI Voice Agent",
    };
  }

  return {
    key:
      "calendar",
    label:
      "Calendar",
  };
}

function getMeetingOwner(
  meeting,
  agents
) {
  const directName =
    firstString(
      meeting?.ownerName,
      meeting?.calendarOwnerName,
      meeting?.createdByName,
      meeting?.agentName
    );

  if (
    directName
  ) {
    return {
      name:
        directName,
      avatarUrl:
        firstString(
          meeting?.ownerAvatarUrl,
          meeting?.avatarUrl
        ),
    };
  }

  const agent =
    findMeetingAgent(
      meeting,
      agents
    );

  if (
    agent
  ) {
    return {
      name:
        agent.name ||
        "AI Voice Agent",
      avatarUrl:
        agent.avatarUrl ||
        "",
    };
  }

  const email =
    firstString(
      meeting?.calendarOwnerEmail,
      meeting?.ownerEmail
    );

  return {
    name:
      email
        ? email.split(
            "@"
          )[0]
        : "Workspace",
    avatarUrl:
      "",
  };
}

function findMeetingAgent(
  meeting,
  agents,
  linkedCall = null
) {
  const ids = [
    meeting?.agentId,
    meeting?.voiceAgentId,
    linkedCall?.agentId,
    linkedCall?.voiceAgentId,
  ]
    .filter(Boolean)
    .map(String);

  if (
    ids.length
  ) {
    const match =
      agents.find(
        (agent) =>
          ids.includes(
            String(
              agent.id ||
              agent.agentId
            )
          )
      );

    if (match) {
      return match;
    }
  }

  const name =
    firstString(
      meeting?.agentName,
      linkedCall?.agentName
    );

  if (
    name
  ) {
    return (
      agents.find(
        (agent) =>
          String(
            agent.name ||
            ""
          ).toLowerCase() ===
          name.toLowerCase()
      ) ||
      null
    );
  }

  return null;
}

function findLinkedCall(
  meeting,
  calls
) {
  const callId =
    firstString(
      meeting?.callId,
      meeting?.voiceCallId,
      meeting?.sourceCallId
    );

  if (
    callId
  ) {
    const direct =
      calls.find(
        (call) =>
          String(
            call.id ||
            call.callId
          ) ===
          String(
            callId
          )
      );

    if (direct) {
      return direct;
    }
  }

  const phone =
    phoneKey(
      firstString(
        meeting?.attendeePhone,
        meeting?.phone,
        meeting?.contactPhone
      )
    );

  if (
    phone
  ) {
    const match =
      calls.find(
        (call) =>
          phoneKey(
            firstString(
              call.toNumber,
              call.phone
            )
          ) ===
          phone
      );

    if (match) {
      return match;
    }
  }

  const name =
    normalizeSearchToken(
      getMeetingLeadName(
        meeting
      )
    );

  if (
    name
  ) {
    return (
      calls.find(
        (call) =>
          normalizeSearchToken(
            firstString(
              call.leadName,
              call.contactName,
              call.name
            )
          ) ===
          name
      ) ||
      null
    );
  }

  return null;
}

function buildCallContext(
  call
) {
  if (!call) {
    return {
      summary:
        "",
    };
  }

  return {
    summary:
      safeMessage(
        firstString(
          call.summary,
          call.callSummary,
          call.analysis?.summary,
          call.intelligence?.summary,
          call.notes
        )
      ),
  };
}

function buildSourceBreakdown(
  meetings,
  calls
) {
  const counts = {
    ai_voice:
      0,
    email:
      0,
    manual:
      0,
    calendar:
      0,
  };

  meetings.forEach(
    (meeting) => {
      const source =
        getMeetingSource(
          meeting,
          calls
        );

      counts[
        source.key
      ] =
        (
          counts[
            source.key
          ] ||
          0
        ) +
        1;
    }
  );

  const total =
    meetings.length ||
    1;

  return [
    {
      key:
        "ai_voice",
      label:
        "AI Voice",
    },
    {
      key:
        "calendar",
      label:
        "Calendar",
    },
    {
      key:
        "email",
      label:
        "Email",
    },
    {
      key:
        "manual",
      label:
        "Manual",
    },
  ]
    .map(
      (item) => ({
        ...item,
        count:
          counts[
            item.key
          ] ||
          0,
        share:
          (
            (
              counts[
                item.key
              ] ||
              0
            ) /
            total
          ) *
          100,
      })
    )
    .filter(
      (item) =>
        item.count >
        0
    );
}

function getMeetingLink(
  meeting
) {
  const candidates = [
    meeting?.meetingUrl,
    meeting?.joinUrl,
    meeting?.joinLink,
    meeting?.videoUrl,
    meeting?.location,
    meeting?.conferenceUrl,
  ];

  return (
    candidates.find(
      (value) =>
        /^https?:\/\//i.test(
          String(
            value ||
            ""
          )
        )
    ) ||
    ""
  );
}

function getMeetingPlatform(
  meeting
) {
  const explicit =
    firstString(
      meeting?.platform,
      meeting?.conferenceProvider,
      meeting?.provider
    );

  if (
    explicit
  ) {
    return titleCase(
      explicit
    );
  }

  const link =
    getMeetingLink(
      meeting
    ).toLowerCase();

  if (
    link.includes(
      "meet.google.com"
    )
  ) {
    return "Google Meet";
  }

  if (
    link.includes(
      "zoom.us"
    )
  ) {
    return "Zoom";
  }

  if (
    link.includes(
      "teams.microsoft.com"
    )
  ) {
    return "Microsoft Teams";
  }

  return link
    ? "Video Meeting"
    : "Calendar Event";
}

function getMeetingLeadName(
  meeting
) {
  return firstString(
    meeting?.leadName,
    meeting?.attendeeName,
    meeting?.contactName,
    meeting?.name,
    "Meeting attendee"
  );
}

function getMeetingTitle(
  meeting
) {
  return firstString(
    meeting?.title,
    meeting?.subject,
    meeting?.eventTitle,
    `Meeting with ${getMeetingLeadName(
      meeting
    )}`
  );
}

function getMeetingDuration(
  meeting
) {
  const direct =
    Number(
      meeting?.durationMinutes
    );

  if (
    Number.isFinite(
      direct
    ) &&
    direct >
      0
  ) {
    return Math.round(
      direct
    );
  }

  const start =
    timestamp(
      meeting?.startAt
    );

  const end =
    timestamp(
      meeting?.endAt
    );

  if (
    start &&
    end &&
    end >
      start
  ) {
    return Math.round(
      (
        end -
        start
      ) /
        60_000
    );
  }

  return 30;
}

function buildCalendarDays(
  cursor,
  meetings
) {
  const first =
    startOfMonth(
      cursor
    );

  const gridStart =
    new Date(
      first
    );

  gridStart.setDate(
    1 -
    first.getDay()
  );

  return Array.from(
    {
      length:
        42,
    },
    (
      _,
      index
    ) => {
      const date =
        new Date(
          gridStart
        );

      date.setDate(
        gridStart.getDate() +
        index
      );

      const key =
        dateKey(
          date
        );

      return {
        key,
        date,
        currentMonth:
          date.getMonth() ===
          cursor.getMonth(),
        today:
          dateKey(
            date
          ) ===
          dateKey(
            new Date()
          ),
        meetings:
          meetings.filter(
            (meeting) =>
              dateKey(
                new Date(
                  meeting.startAt
                )
              ) ===
              key
          ),
      };
    }
  );
}

function normalizeStatusTab(
  value
) {
  return [
    "completed",
    "cancelled",
  ].includes(
    value
  )
    ? value
    : "upcoming";
}

function normalizeViewMode(
  value
) {
  return value ===
    "calendar"
    ? "calendar"
    : "list";
}

function parseMonthCursor(
  value
) {
  if (
    !/^\d{4}-\d{2}$/.test(
      String(
        value ||
        ""
      )
    )
  ) {
    return null;
  }

  const [
    year,
    month,
  ] =
    value
      .split("-")
      .map(Number);

  const date =
    new Date(
      year,
      month -
        1,
      1
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function startOfMonth(
  date
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function formatMonthParam(
  date
) {
  return `${date.getFullYear()}-${String(
    date.getMonth() +
    1
  ).padStart(
    2,
    "0"
  )}`;
}

function dateKey(
  date
) {
  if (
    !(date instanceof Date) ||
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() +
    1
  ).padStart(
    2,
    "0"
  )}-${String(
    date.getDate()
  ).padStart(
    2,
    "0"
  )}`;
}

/* ==========================================================================
 * Formatting / utility
 * ======================================================================= */

function firstString(
  ...values
) {
  for (const value of values) {
    if (
      value ===
        null ||
      value ===
        undefined
    ) {
      continue;
    }

    const text =
      String(
        value
      ).trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function normalizeToken(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function normalizeSearchToken(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

function normalizeRole(
  value
) {
  const role =
    normalizeToken(
      value
    );

  if (
    role.includes(
      "owner"
    )
  ) {
    return "owner";
  }

  if (
    role.includes(
      "admin"
    )
  ) {
    return "admin";
  }

  if (
    role.includes(
      "manager"
    )
  ) {
    return "manager";
  }

  if (
    role ===
      "caller" ||
    role.includes(
      "cold_caller"
    ) ||
    role.includes(
      "sales_rep"
    ) ||
    role.includes(
      "telemarketer"
    )
  ) {
    return "caller";
  }

  return role ||
    "caller";
}

function timestamp(
  value
) {
  if (!value) {
    return 0;
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();
}

function phoneKey(
  value
) {
  return String(
    value ||
      ""
  ).replace(
    /\D+/g,
    ""
  );
}

function formatMeetingDate(
  value
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
    }
  );
}

function formatFullMeetingDate(
  value
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(
    undefined,
    {
      weekday:
        "short",
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
    }
  );
}

function formatMeetingTimeRange(
  meeting
) {
  const start =
    new Date(
      meeting?.startAt
    );

  if (
    Number.isNaN(
      start.getTime()
    )
  ) {
    return "Time unavailable";
  }

  const end =
    meeting?.endAt
      ? new Date(
          meeting.endAt
        )
      : new Date(
          start.getTime() +
          getMeetingDuration(
            meeting
          ) *
            60_000
        );

  const startText =
    start.toLocaleTimeString(
      undefined,
      {
        hour:
          "numeric",
        minute:
          "2-digit",
      }
    );

  const endText =
    Number.isNaN(
      end.getTime()
    )
      ? ""
      : end.toLocaleTimeString(
          undefined,
          {
            hour:
              "numeric",
            minute:
              "2-digit",
            timeZoneName:
              "short",
          }
        );

  return endText
    ? `${startText} – ${endText}`
    : startText;
}

function formatMeetingDateTime(
  meeting
) {
  return `${formatMeetingDate(
    meeting?.startAt
  )}, ${formatMeetingTimeRange(
    meeting
  )}`;
}

function formatTime(
  value
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    undefined,
    {
      hour:
        "numeric",
      minute:
        "2-digit",
    }
  );
}

function formatDay(
  value
) {
  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : String(
        date.getDate()
      ).padStart(
        2,
        "0"
      );
}

function formatMonthShort(
  value
) {
  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? ""
    : date
        .toLocaleDateString(
          undefined,
          {
            month:
              "short",
          }
        )
        .toUpperCase();
}

function formatPhone(
  value
) {
  const text =
    String(
      value ||
      ""
    ).trim();

  if (!text) {
    return "—";
  }

  const digits =
    text.replace(
      /\D+/g,
      ""
    );

  if (
    digits.length ===
      11 &&
    digits.startsWith(
      "1"
    )
  ) {
    return `+1 (${digits.slice(
      1,
      4
    )}) ${digits.slice(
      4,
      7
    )}-${digits.slice(
      7
    )}`;
  }

  return text;
}

function formatAgentMode(
  agent
) {
  const mode =
    normalizeToken(
      firstString(
        agent?.callDirection,
        agent?.callingMode,
        agent?.mode
      )
    );

  if (
    mode ===
    "inbound"
  ) {
    return "Inbound AI Voice Agent";
  }

  if (
    mode ===
      "both" ||
    mode ===
      "inbound_outbound"
  ) {
    return "Inbound + Outbound AI Voice Agent";
  }

  return "Outbound AI Voice Agent";
}

function splitNotes(
  value
) {
  const text =
    String(
      value ||
      ""
    )
      .replace(
        /\r/g,
        ""
      )
      .trim();

  if (!text) {
    return [];
  }

  const lines =
    text
      .split(
        /\n+/
      )
      .map(
        (line) =>
          line
            .replace(
              /^\s*[-•*]\s*/,
              ""
            )
            .trim()
      )
      .filter(Boolean);

  if (
    lines.length >
    1
  ) {
    return lines.slice(
      0,
      10
    );
  }

  return text
    .split(
      /(?<=[.!?])\s+(?=[A-Z0-9])/g
    )
    .map(
      (line) =>
        line.trim()
    )
    .filter(Boolean)
    .slice(
      0,
      10
    );
}

function initials(
  value
) {
  const parts =
    String(
      value ||
      "AI"
    )
      .trim()
      .split(
        /\s+/
      )
      .filter(Boolean);

  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return parts
    .slice(
      0,
      2
    )
    .map(
      (part) =>
        part[0]
    )
    .join("")
    .toUpperCase();
}

function avatarTone(
  value
) {
  const tones = [
    "primary",
    "violet",
    "blue",
    "green",
    "amber",
  ];

  const sum =
    String(
      value ||
      ""
    )
      .split("")
      .reduce(
        (
          total,
          character
        ) =>
          total +
          character.charCodeAt(
            0
          ),
        0
      );

  return tones[
    sum %
    tones.length
  ];
}

function titleCase(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}

function safeMessage(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /ElevenLabs/gi,
      "voice runtime"
    )
    .replace(
      /ElevenAgent/gi,
      "voice agent"
    )
    .replace(
      /Telnyx/gi,
      "calling provider"
    )
    .replace(
      /\bSIP\b/gi,
      "voice connection"
    );
}

function notify(
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
    typeof bridge[
      type
    ] ===
      "function"
  ) {
    bridge[
      type
    ](
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

/* ==========================================================================
 * Scoped ReachFly V7 styling
 * ======================================================================= */

function MeetingsStyles() {
  return (
    <style>{`
      .rf-meetings-v7{
        --rfm-card:#fff;
        --rfm-soft:#f3f4f5;
        --rfm-soft2:#eceeef;
        --rfm-text:#191c1d;
        --rfm-text2:#464554;
        --rfm-muted:#767586;
        --rfm-line:#e3e5e7;
        --rfm-primary:#4648d4;
        --rfm-primary-dark:#3537bb;
        --rfm-psoft:#e8e9ff;
        --rfm-violet:#6b38d4;
        --rfm-vsoft:#f0eaff;
        --rfm-success:#087a51;
        --rfm-ssoft:#dcfce7;
        --rfm-warning:#8a6100;
        --rfm-wsoft:#fff4d6;
        --rfm-danger:#ba1a1a;
        --rfm-dsoft:#ffedeb;
        --rfm-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 46px;
        color:var(--rfm-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfmPageIn 260ms var(--rfm-ease);
      }

      .rf-meetings-v7 *,
      .rf-meetings-v7 *::before,
      .rf-meetings-v7 *::after{
        box-sizing:border-box;
      }

      .rf-meetings-v7 a{
        color:inherit;
      }

      .rf-meetings-v7 .spin{
        animation:rfmSpin 800ms linear infinite;
      }

      @keyframes rfmPageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfmFadeUp{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfmSlideIn{
        from{opacity:0;transform:translate3d(18px,0,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfmSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfmPulse{
        0%,100%{box-shadow:0 0 0 3px rgba(70,72,212,.09)}
        50%{box-shadow:0 0 0 7px rgba(70,72,212,.035)}
      }

      @keyframes rfmShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfm-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:18px;
      }

      .rfm-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfm-primary);
        font-size:9px;
        font-weight:750;
        line-height:13px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfm-page-header h1{
        margin:0;
        color:var(--rfm-text);
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfm-page-header p{
        max-width:700px;
        margin:3px 0 0;
        color:var(--rfm-text2);
        font-size:13px;
        line-height:19px;
      }

      .rfm-header-actions{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rfm-btn{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:7px 12px;
        border:1px solid transparent;
        border-radius:8px;
        text-decoration:none;
        white-space:nowrap;
        cursor:pointer;
        font:600 10px/15px Inter,sans-serif;
        transition:
          color 140ms var(--rfm-ease),
          background 140ms var(--rfm-ease),
          border-color 140ms var(--rfm-ease),
          transform 140ms var(--rfm-ease),
          box-shadow 140ms var(--rfm-ease);
      }

      .rfm-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfm-btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfm-btn-primary{
        color:#fff!important;
        background:var(--rfm-primary);
        border-color:var(--rfm-primary);
        box-shadow:0 5px 14px rgba(70,72,212,.17);
      }

      .rfm-btn-primary:hover:not(:disabled){
        background:var(--rfm-primary-dark);
      }

      .rfm-btn-secondary{
        color:var(--rfm-text)!important;
        background:#fff;
        border-color:var(--rfm-line);
      }

      .rfm-btn-secondary:hover:not(:disabled){
        color:var(--rfm-primary)!important;
        background:var(--rfm-psoft);
      }

      .rfm-view-toggle{
        height:39px;
        display:flex;
        align-items:center;
        gap:3px;
        padding:3px;
        background:#eceeef;
        border-radius:8px;
      }

      .rfm-view-toggle button{
        height:33px;
        display:flex;
        align-items:center;
        gap:5px;
        padding:0 9px;
        color:var(--rfm-text2);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:8px;
        font-weight:650;
      }

      .rfm-view-toggle button.active{
        color:var(--rfm-text);
        background:#fff;
        box-shadow:0 1px 2px rgba(25,28,29,.06);
      }

      .rfm-message{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        margin-bottom:10px;
        color:#7d1717;
        background:var(--rfm-dsoft);
        border:1px solid #ffd0cc;
        border-radius:9px;
        animation:rfmFadeUp 180ms var(--rfm-ease);
      }

      .rfm-message > span{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        flex:0 0 26px;
        background:#fff;
        border-radius:7px;
      }

      .rfm-message > div{
        min-width:0;
        flex:1;
        display:grid;
      }

      .rfm-message strong{
        font-size:9px;
      }

      .rfm-message small{
        font-size:8px;
        line-height:13px;
      }

      .rfm-message > button{
        align-self:center;
        padding:5px 8px;
        color:inherit;
        background:#fff;
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
      }

      .rfm-tabs-bar{
        min-height:72px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:11px 13px;
        margin-bottom:14px;
        background:var(--rfm-soft);
        border-radius:12px;
      }

      .rfm-tabs{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rfm-tabs button{
        min-height:36px;
        display:flex;
        align-items:center;
        gap:6px;
        padding:7px 10px;
        color:var(--rfm-text2);
        background:transparent;
        border:0;
        border-radius:999px;
        cursor:pointer;
        font-size:8px;
        font-weight:650;
      }

      .rfm-tabs button.active{
        color:#3f42bd;
        background:#dfe0ff;
      }

      .rfm-tabs button span{
        min-width:19px;
        height:19px;
        display:grid;
        place-items:center;
        padding:0 5px;
        color:inherit;
        background:rgba(255,255,255,.6);
        border-radius:999px;
        font-size:6px;
        font-weight:800;
      }

      .rfm-toolbar{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rfm-search{
        width:240px;
        height:40px;
        display:flex;
        align-items:center;
        gap:7px;
        padding:0 10px;
        color:var(--rfm-muted);
        background:#fff;
        border:1px solid transparent;
        border-radius:8px;
      }

      .rfm-search:focus-within{
        border-color:rgba(70,72,212,.42);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rfm-search input{
        min-width:0;
        flex:1;
        height:38px;
        padding:0;
        color:var(--rfm-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:9px;
      }

      .rfm-search button{
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfm-muted);
        background:transparent;
        border:0;
        border-radius:5px;
        cursor:pointer;
      }

      .rfm-filter{
        position:relative;
        min-width:118px;
        height:40px;
        display:flex;
        align-items:center;
        background:#fff;
        border-radius:8px;
      }

      .rfm-filter.active{
        color:var(--rfm-primary);
        background:var(--rfm-psoft);
      }

      .rfm-filter select{
        width:100%;
        height:38px;
        padding:0 28px 0 10px;
        color:inherit;
        background:transparent;
        border:0;
        outline:0;
        appearance:none;
        cursor:pointer;
        font-size:8px;
        font-weight:650;
      }

      .rfm-filter svg{
        position:absolute;
        right:8px;
        pointer-events:none;
      }

      .rfm-workspace{
        display:grid;
        grid-template-columns:minmax(0,1fr) 300px;
        gap:14px;
        align-items:start;
      }

      .rfm-workspace.detail-open{
        grid-template-columns:minmax(0,1fr) 360px;
      }

      .rfm-main-card,
      .rfm-detail-panel,
      .rfm-context-card{
        min-width:0;
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rfm-main-card{
        overflow:hidden;
      }

      .rfm-table-wrap{
        width:100%;
        overflow:auto;
      }

      .rfm-table{
        width:100%;
        min-width:820px;
        border-collapse:separate;
        border-spacing:0;
        text-align:left;
      }

      .rfm-table th{
        padding:13px 15px;
        color:var(--rfm-text2);
        background:#eceeef;
        border-bottom:1px solid var(--rfm-line);
        font-size:7px;
        font-weight:700;
        letter-spacing:.05em;
        text-transform:uppercase;
      }

      .rfm-table td{
        height:76px;
        padding:11px 15px;
        color:var(--rfm-text2);
        vertical-align:middle;
        font-size:8px;
      }

      .rfm-table tbody tr{
        cursor:pointer;
        animation:rfmFadeUp 210ms var(--rfm-ease) both;
        animation-delay:calc(var(--rfm-index) * 24ms);
        transition:
          background 140ms var(--rfm-ease),
          box-shadow 140ms var(--rfm-ease);
      }

      .rfm-table tbody tr + tr td{
        border-top:1px solid #f0f1f2;
      }

      .rfm-table tbody tr:hover{
        background:#f8f8fb;
        box-shadow:inset 3px 0 0 rgba(70,72,212,.35);
      }

      .rfm-table tbody tr.selected{
        background:#f1f1ff;
        box-shadow:inset 3px 0 0 var(--rfm-primary);
      }

      .rfm-contact{
        min-width:190px;
        display:flex;
        align-items:center;
        gap:9px;
      }

      .rfm-contact > i,
      .rfm-owner > i{
        display:grid;
        place-items:center;
        color:#fff;
        overflow:hidden;
        border-radius:50%;
        font-style:normal;
        font-weight:800;
      }

      .rfm-contact > i{
        width:36px;
        height:36px;
        flex:0 0 36px;
        font-size:8px;
      }

      .rfm-contact > span{
        min-width:0;
        display:grid;
      }

      .rfm-contact strong,
      .rfm-contact small{
        max-width:175px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfm-contact strong{
        color:var(--rfm-text);
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rfm-contact small{
        color:var(--rfm-text2);
        font-size:7px;
      }

      .rfm-contact > i.primary,
      .rfm-owner > i.primary,
      .rfm-agent-link > span.primary{
        background:#5b5ddd;
      }

      .rfm-contact > i.violet,
      .rfm-owner > i.violet,
      .rfm-agent-link > span.violet{
        background:#7546d9;
      }

      .rfm-contact > i.blue,
      .rfm-owner > i.blue,
      .rfm-agent-link > span.blue{
        background:#3772b9;
      }

      .rfm-contact > i.green,
      .rfm-owner > i.green,
      .rfm-agent-link > span.green{
        background:#23845f;
      }

      .rfm-contact > i.amber,
      .rfm-owner > i.amber,
      .rfm-agent-link > span.amber{
        background:#a06e25;
      }

      .rfm-date-cell{
        display:grid;
        gap:1px;
      }

      .rfm-date-cell strong{
        color:var(--rfm-text);
        font-size:9px;
        font-weight:600;
      }

      .rfm-date-cell small{
        color:var(--rfm-text2);
        font-size:7px;
      }

      .rfm-source{
        min-height:25px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        width:max-content;
        padding:5px 8px;
        border-radius:6px;
        font-size:7px;
        font-weight:700;
      }

      .rfm-source.ai_voice{
        color:var(--rfm-violet);
        background:var(--rfm-vsoft);
      }

      .rfm-source.email{
        color:#4b5260;
        background:#eceeef;
      }

      .rfm-source.manual{
        color:#535a66;
        background:#e4e6e8;
      }

      .rfm-source.calendar{
        color:var(--rfm-primary);
        background:var(--rfm-psoft);
      }

      .rfm-owner{
        display:flex;
        align-items:center;
        gap:6px;
      }

      .rfm-owner > i{
        width:25px;
        height:25px;
        flex:0 0 25px;
        font-size:6px;
      }

      .rfm-owner img{
        width:100%;
        height:100%;
        object-fit:cover;
      }

      .rfm-owner > span{
        max-width:120px;
        overflow:hidden;
        color:var(--rfm-text2);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
      }

      .rfm-status{
        min-height:24px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:4px 8px;
        border-radius:6px;
        font-size:7px;
        font-weight:700;
      }

      .rfm-status > i{
        width:6px;
        height:6px;
        display:block;
        background:currentColor;
        border-radius:50%;
      }

      .rfm-status.upcoming{
        color:#4c55a8;
        background:#e8e9ff;
      }

      .rfm-status.tentative{
        color:#5f636a;
        background:#eceeef;
      }

      .rfm-status.completed{
        color:var(--rfm-success);
        background:var(--rfm-ssoft);
      }

      .rfm-status.cancelled{
        color:var(--rfm-danger);
        background:var(--rfm-dsoft);
      }

      .rfm-table-footer{
        min-height:57px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:12px 15px;
        color:var(--rfm-text2);
        background:#fafafb;
        border-top:1px solid var(--rfm-line);
        font-size:8px;
      }

      .rfm-table-footer strong{
        color:var(--rfm-text);
      }

      .rfm-pagination{
        display:flex;
        align-items:center;
        gap:5px;
      }

      .rfm-pagination button{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        color:var(--rfm-text2);
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:6px;
        cursor:pointer;
      }

      .rfm-pagination button:disabled{
        opacity:.35;
        cursor:not-allowed;
      }

      .rfm-pagination span{
        color:var(--rfm-muted);
        font-size:7px;
      }

      .rfm-mobile-list{
        display:none;
      }

      .rfm-context-panel{
        position:sticky;
        top:78px;
        display:grid;
        gap:10px;
      }

      .rfm-context-card{
        overflow:hidden;
      }

      .rfm-context-card > header{
        display:flex;
        align-items:center;
        gap:8px;
        padding:12px 13px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfm-line);
      }

      .rfm-context-card > header > span{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        flex:0 0 31px;
        color:var(--rfm-primary);
        background:var(--rfm-psoft);
        border-radius:8px;
      }

      .rfm-context-card > header > span.violet{
        color:var(--rfm-violet);
        background:var(--rfm-vsoft);
      }

      .rfm-context-card > header > span.green{
        color:var(--rfm-success);
        background:var(--rfm-ssoft);
      }

      .rfm-context-card > header > div{
        min-width:0;
        display:grid;
      }

      .rfm-context-card > header small{
        color:var(--rfm-muted);
        font-size:6px;
        line-height:9px;
        text-transform:uppercase;
      }

      .rfm-context-card > header strong{
        color:var(--rfm-text);
        font-size:9px;
        line-height:13px;
      }

      .rfm-upcoming-stack{
        display:grid;
        padding:7px;
      }

      .rfm-upcoming-stack button{
        min-height:62px;
        display:grid;
        grid-template-columns:38px minmax(0,1fr) 18px;
        align-items:center;
        gap:8px;
        padding:8px;
        color:inherit;
        background:transparent;
        border:0;
        border-radius:8px;
        text-align:left;
        cursor:pointer;
      }

      .rfm-upcoming-stack button:hover{
        background:var(--rfm-soft);
      }

      .rfm-mini-date{
        width:38px;
        height:42px;
        display:grid;
        place-items:center;
        align-content:center;
        color:var(--rfm-primary);
        background:var(--rfm-psoft);
        border-radius:8px;
      }

      .rfm-mini-date strong{
        font:600 14px/16px Geist,Inter,sans-serif;
      }

      .rfm-mini-date small{
        font-size:6px;
        line-height:9px;
        font-weight:800;
      }

      .rfm-upcoming-stack button > span:nth-child(2){
        min-width:0;
        display:grid;
      }

      .rfm-upcoming-stack button > span:nth-child(2) strong{
        overflow:hidden;
        color:var(--rfm-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
      }

      .rfm-upcoming-stack button > span:nth-child(2) small{
        color:var(--rfm-muted);
        font-size:6px;
      }

      .rfm-upcoming-stack button > svg{
        color:var(--rfm-muted);
      }

      .rfm-context-empty{
        padding:22px 14px;
        color:var(--rfm-muted);
        text-align:center;
        font-size:7px;
      }

      .rfm-source-breakdown{
        display:grid;
        gap:9px;
        padding:13px;
      }

      .rfm-source-breakdown > div{
        display:grid;
        grid-template-columns:62px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
      }

      .rfm-source-breakdown > div > span{
        height:7px;
        overflow:hidden;
        background:#eceeef;
        border-radius:999px;
      }

      .rfm-source-breakdown > div > span i{
        width:var(--rfm-share);
        height:100%;
        display:block;
        background:var(--rfm-primary);
        border-radius:999px;
      }

      .rfm-source-breakdown > div > div{
        min-width:0;
        display:grid;
      }

      .rfm-source-breakdown strong{
        font-size:7px;
      }

      .rfm-source-breakdown small{
        color:var(--rfm-muted);
        font-size:6px;
      }

      .rfm-source-breakdown em{
        color:var(--rfm-text2);
        font-size:7px;
        font-style:normal;
        font-weight:700;
      }

      .rfm-context-copy{
        margin:0;
        padding:13px 13px 5px;
        color:var(--rfm-text2);
        font-size:7px;
        line-height:12px;
      }

      .rfm-agent-count{
        display:flex;
        align-items:baseline;
        gap:5px;
        padding:7px 13px;
      }

      .rfm-agent-count strong{
        color:var(--rfm-primary);
        font:600 17px/22px Geist,Inter,sans-serif;
      }

      .rfm-agent-count span{
        color:var(--rfm-muted);
        font-size:7px;
      }

      .rfm-context-link{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:11px 13px;
        color:var(--rfm-primary)!important;
        border-top:1px solid var(--rfm-line);
        text-decoration:none;
        font-size:7px;
        font-weight:700;
      }

      .rfm-detail-panel{
        position:sticky;
        top:78px;
        max-height:calc(100vh - 94px);
        overflow:auto;
        animation:rfmSlideIn 200ms var(--rfm-ease);
      }

      .rfm-detail-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:10px;
        padding:15px 16px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfm-line);
      }

      .rfm-detail-head h2{
        margin:0;
        color:var(--rfm-text);
        font:600 15px/20px Geist,Inter,sans-serif;
      }

      .rfm-detail-head p{
        margin:2px 0 0;
        color:var(--rfm-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfm-detail-head > button{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        flex:0 0 31px;
        padding:0;
        color:var(--rfm-text2);
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:7px;
        cursor:pointer;
      }

      .rfm-detail-person{
        display:grid;
        grid-template-columns:42px minmax(0,1fr) auto;
        align-items:center;
        gap:9px;
        padding:14px 15px;
        border-bottom:1px solid var(--rfm-line);
      }

      .rfm-detail-person > span:first-child{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        color:#fff;
        border-radius:50%;
        font-size:9px;
        font-weight:800;
      }

      .rfm-detail-person > span:first-child.primary{background:#5b5ddd}
      .rfm-detail-person > span:first-child.violet{background:#7546d9}
      .rfm-detail-person > span:first-child.blue{background:#3772b9}
      .rfm-detail-person > span:first-child.green{background:#23845f}
      .rfm-detail-person > span:first-child.amber{background:#a06e25}

      .rfm-detail-person > div{
        min-width:0;
        display:grid;
      }

      .rfm-detail-person strong{
        overflow:hidden;
        color:var(--rfm-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfm-detail-person small{
        overflow:hidden;
        color:var(--rfm-text2);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
      }

      .rfm-detail-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
        padding:12px;
      }

      .rfm-detail-grid article{
        min-height:68px;
        display:flex;
        align-items:flex-start;
        gap:7px;
        padding:9px;
        background:var(--rfm-soft);
        border-radius:8px;
      }

      .rfm-detail-grid article > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        flex:0 0 27px;
        color:var(--rfm-primary);
        background:#fff;
        border-radius:7px;
      }

      .rfm-detail-grid article > div{
        min-width:0;
        display:grid;
      }

      .rfm-detail-grid small{
        color:var(--rfm-muted);
        font-size:6px;
      }

      .rfm-detail-grid strong{
        color:var(--rfm-text);
        font-size:7px;
        line-height:11px;
      }

      .rfm-booking-context{
        margin:0 12px 12px;
        padding:12px;
        background:linear-gradient(135deg,#f5f1ff,#fbf9ff);
        border-left:3px solid var(--rfm-primary);
        border-radius:8px;
      }

      .rfm-booking-context header{
        display:flex;
        align-items:center;
        gap:5px;
        color:var(--rfm-violet);
      }

      .rfm-booking-context header span{
        font-size:7px;
        font-weight:800;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfm-booking-context p{
        margin:7px 0 0;
        color:var(--rfm-text2);
        font-size:8px;
        line-height:13px;
      }

      .rfm-booking-context a{
        display:flex;
        align-items:center;
        gap:5px;
        width:max-content;
        margin-top:8px;
        color:var(--rfm-primary)!important;
        text-decoration:none;
        font-size:7px;
        font-weight:700;
      }

      .rfm-detail-section{
        padding:14px 15px;
        border-top:1px solid var(--rfm-line);
      }

      .rfm-detail-section h3{
        margin:0 0 9px;
        color:var(--rfm-text2);
        font-size:8px;
        font-weight:750;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfm-detail-section dl{
        display:grid;
        gap:6px;
        margin:0;
      }

      .rfm-detail-section dl > div{
        display:grid;
        grid-template-columns:78px minmax(0,1fr);
        gap:8px;
      }

      .rfm-detail-section dt{
        color:var(--rfm-muted);
        font-size:7px;
      }

      .rfm-detail-section dd{
        margin:0;
        overflow:hidden;
        color:var(--rfm-text);
        text-align:right;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
        font-weight:600;
      }

      .rfm-agent-link{
        min-height:54px;
        display:grid;
        grid-template-columns:34px minmax(0,1fr) 18px;
        align-items:center;
        gap:8px;
        padding:8px;
        color:inherit!important;
        background:var(--rfm-soft);
        border-radius:8px;
        text-decoration:none;
      }

      .rfm-agent-link > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:#fff;
        border-radius:50%;
        font-size:7px;
        font-weight:800;
      }

      .rfm-agent-link > div{
        min-width:0;
        display:grid;
      }

      .rfm-agent-link strong{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
      }

      .rfm-agent-link small{
        color:var(--rfm-muted);
        font-size:6px;
      }

      .rfm-notes{
        display:grid;
        gap:7px;
      }

      .rfm-notes p{
        display:grid;
        grid-template-columns:8px minmax(0,1fr);
        gap:6px;
        margin:0;
        color:var(--rfm-text2);
        font-size:7px;
        line-height:12px;
      }

      .rfm-notes p i{
        width:5px;
        height:5px;
        margin-top:4px;
        background:var(--rfm-primary);
        border-radius:50%;
      }

      .rfm-empty-notes{
        color:var(--rfm-muted);
        font-size:7px;
        line-height:12px;
      }

      .rfm-detail-actions{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        flex-wrap:wrap;
        gap:6px;
        padding:12px 15px 16px;
        background:#fbfbfc;
        border-top:1px solid var(--rfm-line);
      }

      .rfm-detail-actions .rfm-btn{
        min-height:34px;
        padding:6px 9px;
        font-size:7px;
      }

      .rfm-calendar{
        min-height:650px;
      }

      .rfm-calendar > header{
        min-height:64px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:11px 14px;
        border-bottom:1px solid var(--rfm-line);
      }

      .rfm-calendar > header > div{
        display:flex;
        align-items:center;
        gap:5px;
      }

      .rfm-calendar > header button{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfm-text2);
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:7px;
        cursor:pointer;
      }

      .rfm-calendar > header h2{
        margin:0 0 0 8px;
        font:600 14px/19px Geist,Inter,sans-serif;
      }

      .rfm-calendar > header .rfm-today-btn{
        width:auto;
        padding:0 10px;
        font-size:7px;
        font-weight:700;
      }

      .rfm-calendar-weekdays{
        display:grid;
        grid-template-columns:repeat(7,1fr);
        background:#eceeef;
        border-bottom:1px solid var(--rfm-line);
      }

      .rfm-calendar-weekdays span{
        padding:9px 8px;
        color:var(--rfm-text2);
        text-align:center;
        font-size:6px;
        font-weight:750;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfm-calendar-grid{
        display:grid;
        grid-template-columns:repeat(7,1fr);
      }

      .rfm-calendar-grid article{
        min-width:0;
        min-height:110px;
        padding:7px;
        border-right:1px solid #eef0f1;
        border-bottom:1px solid #eef0f1;
      }

      .rfm-calendar-grid article:nth-child(7n){
        border-right:0;
      }

      .rfm-calendar-grid article.outside{
        background:#fbfbfc;
      }

      .rfm-day-number{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        color:var(--rfm-text2);
        border-radius:50%;
        font-size:7px;
        font-weight:700;
      }

      .rfm-calendar-grid article.outside .rfm-day-number{
        color:#b2b3b8;
      }

      .rfm-calendar-grid article.today .rfm-day-number{
        color:#fff;
        background:var(--rfm-primary);
      }

      .rfm-calendar-grid article > div{
        display:grid;
        gap:3px;
        margin-top:4px;
      }

      .rfm-calendar-grid article > div button{
        min-width:0;
        display:grid;
        grid-template-columns:auto minmax(0,1fr);
        gap:4px;
        padding:4px 5px;
        color:var(--rfm-primary);
        background:var(--rfm-psoft);
        border:0;
        border-radius:5px;
        text-align:left;
        cursor:pointer;
      }

      .rfm-calendar-grid article > div button strong{
        font-size:5.5px;
        line-height:9px;
      }

      .rfm-calendar-grid article > div button span{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.5px;
        line-height:9px;
      }

      .rfm-calendar-grid article > div small{
        color:var(--rfm-muted);
        font-size:5.5px;
        line-height:9px;
      }

      .rfm-empty-state{
        min-height:410px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:6px;
        padding:28px;
        text-align:center;
      }

      .rfm-empty-state > span{
        width:50px;
        height:50px;
        display:grid;
        place-items:center;
        color:var(--rfm-primary);
        background:var(--rfm-psoft);
        border-radius:14px;
      }

      .rfm-empty-state h2{
        margin:0;
        font:600 13px/18px Geist,Inter,sans-serif;
      }

      .rfm-empty-state p{
        max-width:470px;
        margin:0 0 4px;
        color:var(--rfm-muted);
        font-size:8px;
        line-height:13px;
      }

      .rfm-list-skeleton{
        display:grid;
      }

      .rfm-list-skeleton > div{
        display:grid;
        grid-template-columns:2fr 1.3fr 1fr 1fr .8fr;
        align-items:center;
        gap:12px;
        min-height:76px;
        padding:11px 15px;
        border-bottom:1px solid #f0f1f2;
      }

      .rfm-list-skeleton i,
      .rfm-tabs > i{
        display:block;
        background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);
        background-size:220% 100%;
        border-radius:999px;
        animation:rfmShimmer 1.25s linear infinite;
      }

      .rfm-list-skeleton i{
        height:10px;
      }

      .rfm-list-skeleton i.person{
        height:35px;
        border-radius:8px;
      }

      .rfm-tabs > i{
        width:92px;
        height:36px;
      }

      @media(max-width:1180px){
        .rf-meetings-v7{
          padding:22px;
        }

        .rfm-workspace{
          grid-template-columns:minmax(0,1fr) 270px;
        }

        .rfm-workspace.detail-open{
          grid-template-columns:minmax(0,1fr) 340px;
        }

        .rfm-tabs-bar{
          align-items:stretch;
          flex-direction:column;
        }

        .rfm-toolbar{
          width:100%;
        }

        .rfm-search{
          flex:1;
          width:auto;
        }
      }

      @media(max-width:980px){
        .rfm-workspace,
        .rfm-workspace.detail-open{
          grid-template-columns:1fr;
        }

        .rfm-context-panel{
          position:static;
          grid-template-columns:repeat(3,minmax(0,1fr));
        }

        .rfm-detail-panel{
          position:fixed;
          z-index:180;
          top:76px;
          right:12px;
          bottom:12px;
          width:min(390px,calc(100vw - 24px));
          max-height:none;
          box-shadow:0 18px 50px rgba(25,28,29,.17);
        }
      }

      @media(max-width:840px){
        .rfm-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfm-header-actions{
          width:100%;
          justify-content:flex-end;
          flex-wrap:wrap;
        }

        .rfm-table-wrap{
          display:none;
        }

        .rfm-mobile-list{
          display:grid;
        }

        .rfm-mobile-card{
          width:100%;
          display:grid;
          gap:9px;
          padding:13px 14px;
          color:inherit;
          background:#fff;
          border:0;
          border-top:1px solid #f0f1f2;
          text-align:left;
          cursor:pointer;
          animation:rfmFadeUp 210ms var(--rfm-ease) both;
          animation-delay:calc(var(--rfm-index) * 24ms);
        }

        .rfm-mobile-card.selected{
          background:#f1f1ff;
          box-shadow:inset 3px 0 0 var(--rfm-primary);
        }

        .rfm-mobile-head{
          display:flex;
          align-items:center;
          gap:8px;
        }

        .rfm-mobile-head .rfm-contact{
          min-width:0;
          flex:1;
        }

        .rfm-mobile-tags{
          display:flex;
          align-items:center;
          flex-wrap:wrap;
          gap:6px;
          padding-left:45px;
        }

        .rfm-mobile-meta{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:6px;
          padding:8px 0 0 45px;
          border-top:1px solid #f0f1f2;
        }

        .rfm-mobile-meta span{
          min-width:0;
          display:flex;
          align-items:center;
          gap:4px;
          overflow:hidden;
          color:var(--rfm-text2);
          text-overflow:ellipsis;
          white-space:nowrap;
          font-size:7px;
        }

        .rfm-context-panel{
          grid-template-columns:1fr 1fr;
        }

        .rfm-context-card:last-child{
          grid-column:1/-1;
        }

        .rfm-calendar-grid article{
          min-height:94px;
        }
      }

      @media(max-width:650px){
        .rf-meetings-v7{
          padding:18px 12px 84px;
        }

        .rfm-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfm-page-header p{
          font-size:11px;
          line-height:17px;
        }

        .rfm-tabs{
          width:100%;
          overflow:auto;
        }

        .rfm-tabs button{
          flex:0 0 auto;
        }

        .rfm-toolbar{
          display:grid;
          grid-template-columns:1fr;
        }

        .rfm-filter{
          width:100%;
        }

        .rfm-context-panel{
          grid-template-columns:1fr;
        }

        .rfm-context-card:last-child{
          grid-column:auto;
        }

        .rfm-detail-panel{
          inset:64px 0 0;
          width:100vw;
          max-width:none;
          border-radius:0;
        }

        .rfm-mobile-meta{
          grid-template-columns:1fr;
        }

        .rfm-calendar{
          overflow:auto;
        }

        .rfm-calendar-weekdays,
        .rfm-calendar-grid{
          min-width:680px;
        }
      }

      @media(max-width:460px){
        .rfm-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .rfm-view-toggle{
          grid-column:1/-1;
          width:100%;
        }

        .rfm-view-toggle button{
          flex:1;
          justify-content:center;
        }

        .rfm-header-actions .rfm-btn-primary{
          grid-column:1/-1;
        }

        .rfm-detail-grid{
          grid-template-columns:1fr;
        }

        .rfm-detail-actions{
          align-items:stretch;
          flex-direction:column;
        }

        .rfm-detail-actions .rfm-btn{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-meetings-v7,
        .rfm-table tbody tr,
        .rfm-mobile-card,
        .rfm-detail-panel,
        .rfm-message,
        .rfm-live-pill,
        .rfm-list-skeleton i,
        .rfm-tabs > i,
        .rf-meetings-v7 .spin{
          animation:none!important;
        }

        .rf-meetings-v7 *,
        .rf-meetings-v7 *::before,
        .rf-meetings-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
