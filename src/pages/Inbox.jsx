import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Globe2,
  Inbox as InboxIcon,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
} from "../components/icons";

import {
  api,
} from "../api";

/**
 * ReachFly.AI V7 Inbox
 *
 * Existing production behavior preserved:
 * - api.syncInbox(limit)
 * - api.inbox()
 * - api.inboxMessage(id)
 * - api.markInboxMessageRead(id)
 * - 8 second silent sync interval
 * - campaign email-only reply semantics remain authoritative for reply stats
 * - /app/inbox/:messageId legacy detail route remains available
 *
 * The page is rebuilt against the Stitch Inbox target:
 * - compact thread rail
 * - selected conversation workspace
 * - contact/context sidebar
 * - All / Unread / Replies / Sent filters
 * - campaign + search filtering
 * - explicit Mark Read action
 * - real sync / retry states
 *
 * Important:
 * ReachFly currently exposes inbox read/sync APIs but no direct reply/compose
 * endpoint from this screen. Reply buttons therefore use the recipient's
 * normal mailto: action instead of pretending a ReachFly reply was persisted.
 */

const FILTERS = [
  {
    key: "all",
    label: "All",
  },
  {
    key: "unread",
    label: "Unread",
  },
  {
    key: "replies",
    label: "Replies",
  },
  {
    key: "sent",
    label: "Sent",
  },
];

const SYNC_INTERVAL_MS =
  8_000;

export default function Inbox() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const initialParams =
    useMemo(
      () =>
        new URLSearchParams(
          location.search
        ),
      [] // eslint-disable-line react-hooks/exhaustive-deps
    );

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    activeFilter,
    setActiveFilter,
  ] = useState(
    initialParams.get(
      "filter"
    ) ||
      "all"
  );

  const [
    campaignId,
    setCampaignId,
  ] = useState(
    initialParams.get(
      "campaign"
    ) ||
      "all"
  );

  const [
    query,
    setQuery,
  ] = useState(
    initialParams.get(
      "search"
    ) ||
      ""
  );

  const [
    selectedMessageId,
    setSelectedMessageId,
  ] = useState(
    initialParams.get(
      "message"
    ) ||
      ""
  );

  const [
    selectedDetail,
    setSelectedDetail,
  ] = useState(null);

  const [
    mobileConversationOpen,
    setMobileConversationOpen,
  ] = useState(
    Boolean(
      initialParams.get(
        "message"
      )
    )
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    markingRead,
    setMarkingRead,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    detailError,
    setDetailError,
  ] = useState("");

  const [
    campaignMenuOpen,
    setCampaignMenuOpen,
  ] = useState(false);

  const refreshActivity =
    useCallback(
      async ({
        silent = false,
        successToast = false,
      } = {}) => {
        try {
          if (silent) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError("");

          const syncResult =
            await api.syncInbox(
              50
            );

          if (
            syncResult?.ok &&
            Array.isArray(
              syncResult.items
            )
          ) {
            setItems(
              syncResult.items
            );

            if (
              successToast
            ) {
              notify(
                "success",
                "Inbox synced",
                "Latest campaign email activity is now visible."
              );
            }

            return;
          }

          const inboxResult =
            await api.inbox();

          setItems(
            normalizeInboxResponse(
              inboxResult
            )
          );

          if (
            syncResult &&
            syncResult.ok ===
              false &&
            !silent
          ) {
            setError(
              syncResult.message ||
                "Automatic inbox sync failed."
            );
          }

          if (
            successToast
          ) {
            notify(
              "success",
              "Inbox refreshed",
              "Latest inbox activity is now visible."
            );
          }
        } catch (requestError) {
          try {
            const inboxResult =
              await api.inbox();

            setItems(
              normalizeInboxResponse(
                inboxResult
              )
            );

            if (
              successToast
            ) {
              notify(
                "warning",
                "Sync unavailable",
                "ReachFly loaded the saved inbox activity instead."
              );
            }
          } catch {
            const message =
              requestError?.message ||
              "Could not load campaign email activity.";

            setError(
              message
            );

            if (
              successToast
            ) {
              notify(
                "error",
                "Inbox refresh failed",
                message
              );
            }
          }
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  useEffect(() => {
    let active =
      true;

    let running =
      false;

    const run =
      async (
        silent = false
      ) => {
        if (
          !active ||
          running
        ) {
          return;
        }

        running = true;

        try {
          await refreshActivity({
            silent,
          });
        } finally {
          running = false;
        }
      };

    void run(false);

    const timer =
      window.setInterval(
        () => {
          void run(true);
        },
        SYNC_INTERVAL_MS
      );

    return () => {
      active = false;

      window.clearInterval(
        timer
      );
    };
  }, [
    refreshActivity,
  ]);

  useEffect(() => {
    const params =
      new URLSearchParams(
        location.search
      );

    const search =
      params.get(
        "search"
      );

    const filter =
      params.get(
        "filter"
      );

    const campaign =
      params.get(
        "campaign"
      );

    const message =
      params.get(
        "message"
      );

    if (
      search !== null &&
      search !==
        query
    ) {
      setQuery(
        search
      );
    }

    if (
      filter &&
      FILTERS.some(
        (item) =>
          item.key ===
          filter
      )
    ) {
      setActiveFilter(
        filter
      );
    }

    if (campaign) {
      setCampaignId(
        campaign
      );
    }

    if (message) {
      setSelectedMessageId(
        message
      );
    }
  }, [
    location.search,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const campaignActivity =
    useMemo(
      () =>
        buildCampaignActivity(
          items
        ),
      [
        items,
      ]
    );

  const threads =
    useMemo(
      () =>
        buildThreads(
          items
        ),
      [
        items,
      ]
    );

  const filteredThreads =
    useMemo(() => {
      const search =
        query
          .trim()
          .toLowerCase();

      return threads.filter(
        (thread) => {
          if (
            activeFilter ===
              "unread" &&
            !thread.unread
          ) {
            return false;
          }

          if (
            activeFilter ===
              "replies" &&
            !thread.hasReply
          ) {
            return false;
          }

          if (
            activeFilter ===
              "sent" &&
            !thread.hasSent
          ) {
            return false;
          }

          if (
            campaignId !==
              "all" &&
            thread.campaignId !==
              campaignId
          ) {
            return false;
          }

          if (!search) {
            return true;
          }

          return thread.searchable.includes(
            search
          );
        }
      );
    }, [
      activeFilter,
      campaignId,
      query,
      threads,
    ]);

  const stats =
    useMemo(
      () =>
        buildInboxStats(
          items
        ),
      [
        items,
      ]
    );

  useEffect(() => {
    if (
      !filteredThreads.length
    ) {
      setSelectedDetail(
        null
      );
      return;
    }

    const selectedStillVisible =
      selectedMessageId &&
      filteredThreads.some(
        (thread) =>
          thread.messages.some(
            (message) =>
              String(
                message.id
              ) ===
              String(
                selectedMessageId
              )
          )
      );

    if (
      selectedStillVisible
    ) {
      return;
    }

    const nextId =
      getThreadFocusMessageId(
        filteredThreads[0]
      );

    if (nextId) {
      setSelectedMessageId(
        nextId
      );
    }
  }, [
    filteredThreads,
    selectedMessageId,
  ]);

  const selectedThread =
    useMemo(
      () => {
        if (
          !selectedMessageId
        ) {
          return (
            filteredThreads[0] ||
            null
          );
        }

        return (
          threads.find(
            (thread) =>
              thread.messages.some(
                (message) =>
                  String(
                    message.id
                  ) ===
                  String(
                    selectedMessageId
                  )
              )
          ) ||
          filteredThreads[0] ||
          null
        );
      },
      [
        filteredThreads,
        selectedMessageId,
        threads,
      ]
    );

  const selectedMessage =
    useMemo(
      () => {
        if (
          !selectedThread
        ) {
          return null;
        }

        return (
          selectedThread.messages.find(
            (message) =>
              String(
                message.id
              ) ===
              String(
                selectedMessageId
              )
          ) ||
          selectedThread.latest ||
          null
        );
      },
      [
        selectedMessageId,
        selectedThread,
      ]
    );

  useEffect(() => {
    if (
      !selectedMessage?.id
    ) {
      setSelectedDetail(
        null
      );
      setDetailError("");
      return undefined;
    }

    let alive =
      true;

    const loadDetail =
      async () => {
        try {
          setDetailLoading(
            true
          );
          setDetailError("");

          const detail =
            await api.inboxMessage(
              selectedMessage.id
            );

          if (alive) {
            setSelectedDetail(
              detail?.message ||
                detail?.item ||
                detail ||
                selectedMessage
            );
          }
        } catch (requestError) {
          if (alive) {
            setSelectedDetail(
              selectedMessage
            );

            setDetailError(
              requestError?.message ||
                "Full message details could not be loaded."
            );
          }
        } finally {
          if (alive) {
            setDetailLoading(
              false
            );
          }
        }
      };

    void loadDetail();

    return () => {
      alive = false;
    };
  }, [
    selectedMessage?.id,
  ]);

  const selectedContext =
    useMemo(
      () =>
        buildConversationContext(
          selectedThread,
          selectedDetail ||
            selectedMessage
        ),
      [
        selectedDetail,
        selectedMessage,
        selectedThread,
      ]
    );

  const selectThread =
    useCallback(
      (
        thread
      ) => {
        const nextId =
          getThreadFocusMessageId(
            thread
          );

        if (!nextId) {
          return;
        }

        setSelectedMessageId(
          nextId
        );
        setMobileConversationOpen(
          true
        );

        const params =
          new URLSearchParams(
            location.search
          );

        params.set(
          "message",
          nextId
        );

        if (
          query.trim()
        ) {
          params.set(
            "search",
            query.trim()
          );
        } else {
          params.delete(
            "search"
          );
        }

        if (
          activeFilter !==
          "all"
        ) {
          params.set(
            "filter",
            activeFilter
          );
        } else {
          params.delete(
            "filter"
          );
        }

        if (
          campaignId !==
          "all"
        ) {
          params.set(
            "campaign",
            campaignId
          );
        } else {
          params.delete(
            "campaign"
          );
        }

        navigate(
          {
            pathname:
              "/app/inbox",
            search:
              params.toString()
                ? `?${params.toString()}`
                : "",
          },
          {
            replace: true,
          }
        );
      },
      [
        activeFilter,
        campaignId,
        location.search,
        navigate,
        query,
      ]
    );

  async function markSelectedRead() {
    if (
      !selectedMessage?.id ||
      !selectedThread?.unread ||
      markingRead
    ) {
      return;
    }

    try {
      setMarkingRead(
        true
      );

      await api.markInboxMessageRead(
        selectedMessage.id
      );

      setItems(
        (current) =>
          current.map(
            (item) =>
              String(
                item.id
              ) ===
              String(
                selectedMessage.id
              )
                ? {
                    ...item,
                    unread:
                      false,
                  }
                : item
          )
      );

      setSelectedDetail(
        (current) =>
          current &&
          String(
            current.id
          ) ===
            String(
              selectedMessage.id
            )
            ? {
                ...current,
                unread:
                  false,
              }
            : current
      );

      notify(
        "success",
        "Marked as read",
        "This campaign reply is no longer unread."
      );
    } catch (requestError) {
      notify(
        "error",
        "Couldn't mark as read",
        requestError?.message ||
          "Please try again."
      );
    } finally {
      setMarkingRead(
        false
      );
    }
  }

  function updateFilter(
    nextFilter
  ) {
    setActiveFilter(
      nextFilter
    );

    const params =
      new URLSearchParams(
        location.search
      );

    if (
      nextFilter ===
      "all"
    ) {
      params.delete(
        "filter"
      );
    } else {
      params.set(
        "filter",
        nextFilter
      );
    }

    params.delete(
      "message"
    );

    navigate(
      {
        pathname:
          "/app/inbox",
        search:
          params.toString()
            ? `?${params.toString()}`
            : "",
      },
      {
        replace: true,
      }
    );
  }

  function selectCampaign(
    nextCampaignId
  ) {
    setCampaignId(
      nextCampaignId
    );
    setCampaignMenuOpen(
      false
    );

    const params =
      new URLSearchParams(
        location.search
      );

    if (
      nextCampaignId ===
      "all"
    ) {
      params.delete(
        "campaign"
      );
    } else {
      params.set(
        "campaign",
        nextCampaignId
      );
    }

    params.delete(
      "message"
    );

    navigate(
      {
        pathname:
          "/app/inbox",
        search:
          params.toString()
            ? `?${params.toString()}`
            : "",
      },
      {
        replace: true,
      }
    );
  }

  return (
    <>
      <InboxStyles />

      <div className="rf-inbox-v7">
        <header className="rfi-page-header">
          <div>
            <span className="rfi-eyebrow">
              Communication
            </span>

            <h1>
              Inbox
            </h1>

            <p>
              Campaign emails and connected replies, synced automatically.
            </p>
          </div>

          <div className="rfi-header-actions">
            <Link
              className="rfi-btn rfi-btn-secondary"
              to="/app/email"
            >
              <Mail size={15} />
              Email settings
            </Link>

            <button
              type="button"
              className="rfi-btn rfi-btn-primary"
              disabled={
                refreshing
              }
              onClick={() =>
                void refreshActivity({
                  silent: true,
                  successToast: true,
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
              Sync Inbox
            </button>
          </div>
        </header>

        {error ? (
          <section
            className="rfi-message error"
            role="alert"
          >
            <span>
              <X size={15} />
            </span>

            <div>
              <strong>
                Inbox sync needs attention
              </strong>

              <small>
                {error}
              </small>
            </div>

            <button
              type="button"
              onClick={() =>
                void refreshActivity({
                  successToast: true,
                })
              }
            >
              Try again
            </button>
          </section>
        ) : null}

        <section className="rfi-metrics">
          <InboxMetric
            label="Campaign Activity"
            value={
              stats.total
            }
            icon={
              <InboxIcon size={16} />
            }
          />

          <InboxMetric
            label="Sent"
            value={
              stats.sent
            }
            icon={
              <Send size={16} />
            }
            tone="neutral"
          />

          <InboxMetric
            label="Replies"
            value={
              stats.replies
            }
            icon={
              <Mail size={16} />
            }
            tone="violet"
          />

          <InboxMetric
            label="Unread"
            value={
              stats.unread
            }
            icon={
              <MessageCircle size={16} />
            }
            tone="success"
            note={`${formatPercent(
              stats.replyRate
            )}% reply rate`}
          />
        </section>

        <section className="rfi-workspace">
          <aside className="rfi-thread-panel">
            <div className="rfi-thread-panel-head">
              <div className="rfi-thread-title-row">
                <strong>
                  Inbox
                </strong>

                <div className="rfi-thread-head-actions">
                  <div className="rfi-campaign-filter">
                    <button
                      type="button"
                      className={
                        campaignId !==
                        "all"
                          ? "active"
                          : ""
                      }
                      aria-label="Filter inbox by campaign"
                      aria-haspopup="dialog"
                      aria-expanded={
                        campaignMenuOpen
                      }
                      onClick={() =>
                        setCampaignMenuOpen(
                          (value) =>
                            !value
                        )
                      }
                    >
                      <InboxIcon size={14} />
                      <ChevronDown size={11} />
                    </button>

                    {campaignMenuOpen ? (
                      <CampaignMenu
                        campaigns={
                          campaignActivity
                        }
                        value={
                          campaignId
                        }
                        onSelect={
                          selectCampaign
                        }
                      />
                    ) : null}
                  </div>

                  <button
                    type="button"
                    title="Refresh inbox"
                    aria-label="Refresh inbox"
                    disabled={
                      refreshing
                    }
                    onClick={() =>
                      void refreshActivity({
                        silent: true,
                        successToast: true,
                      })
                    }
                  >
                    <RefreshCw
                      size={14}
                      className={
                        refreshing
                          ? "spin"
                          : ""
                      }
                    />
                  </button>
                </div>
              </div>

              <div className="rfi-filter-tabs">
                {FILTERS.map(
                  (filter) => (
                    <button
                      key={
                        filter.key
                      }
                      type="button"
                      className={
                        activeFilter ===
                        filter.key
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        updateFilter(
                          filter.key
                        )
                      }
                    >
                      {filter.label}

                      {filter.key ===
                        "unread" &&
                      stats.unread >
                        0 ? (
                        <span>
                          {stats.unread}
                        </span>
                      ) : null}
                    </button>
                  )
                )}
              </div>

              <label className="rfi-thread-search">
                <Search
                  size={14}
                  aria-hidden="true"
                />

                <input
                  value={
                    query
                  }
                  onChange={(
                    event
                  ) =>
                    setQuery(
                      event.target
                        .value
                    )
                  }
                  placeholder="Search inbox..."
                  aria-label="Search inbox"
                />

                {query ? (
                  <button
                    type="button"
                    aria-label="Clear inbox search"
                    onClick={() =>
                      setQuery(
                        ""
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </label>
            </div>

            <div className="rfi-thread-list">
              {loading ? (
                <ThreadSkeleton />
              ) : filteredThreads.length ===
                0 ? (
                <ThreadEmpty
                  hasItems={
                    items.length >
                    0
                  }
                  onReset={() => {
                    setQuery("");
                    setActiveFilter(
                      "all"
                    );
                    setCampaignId(
                      "all"
                    );
                  }}
                />
              ) : (
                filteredThreads.map(
                  (
                    thread,
                    index
                  ) => (
                    <ThreadRow
                      key={
                        thread.key
                      }
                      thread={
                        thread
                      }
                      active={
                        selectedThread
                          ?.key ===
                        thread.key
                      }
                      onClick={() =>
                        selectThread(
                          thread
                        )
                      }
                      index={
                        index
                      }
                    />
                  )
                )
              )}
            </div>
          </aside>

          <main
            className={`rfi-conversation-panel ${
              mobileConversationOpen
                ? "mobile-open"
                : ""
            }`}
          >
            {!selectedThread ? (
              <ConversationEmpty />
            ) : (
              <>
                <ConversationHeader
                  thread={
                    selectedThread
                  }
                  message={
                    selectedDetail ||
                    selectedMessage
                  }
                  markingRead={
                    markingRead
                  }
                  onMarkRead={
                    markSelectedRead
                  }
                  onMobileBack={() =>
                    setMobileConversationOpen(
                      false
                    )
                  }
                />

                <div className="rfi-conversation-scroll">
                  {detailError ? (
                    <div className="rfi-detail-warning">
                      <span>
                        <X size={13} />
                      </span>

                      <p>
                        {detailError}
                      </p>
                    </div>
                  ) : null}

                  <ConversationSummary
                    context={
                      selectedContext
                    }
                  />

                  <ConversationMessages
                    thread={
                      selectedThread
                    }
                    selectedDetail={
                      selectedDetail
                    }
                    detailLoading={
                      detailLoading
                    }
                  />
                </div>

                <ReplyDock
                  context={
                    selectedContext
                  }
                  selectedMessage={
                    selectedDetail ||
                    selectedMessage
                  }
                />
              </>
            )}
          </main>

          <aside className="rfi-context-panel">
            {selectedThread ? (
              <ContactContext
                context={
                  selectedContext
                }
                selectedMessage={
                  selectedDetail ||
                  selectedMessage
                }
              />
            ) : null}
          </aside>
        </section>
      </div>
    </>
  );
}

function InboxMetric({
  label,
  value,
  icon,
  tone = "primary",
  note = "",
}) {
  return (
    <article
      className={`rfi-metric ${tone}`}
    >
      <span>
        {icon}
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {formatNumber(
            value
          )}
        </strong>

        {note ? (
          <em>
            {note}
          </em>
        ) : null}
      </div>
    </article>
  );
}

function CampaignMenu({
  campaigns,
  value,
  onSelect,
}) {
  return (
    <div
      className="rfi-campaign-menu"
      role="dialog"
      aria-label="Filter by campaign"
    >
      <button
        type="button"
        className={
          value ===
          "all"
            ? "active"
            : ""
        }
        onClick={() =>
          onSelect(
            "all"
          )
        }
      >
        <span>
          All campaigns
        </span>

        <strong>
          {campaigns.reduce(
            (
              total,
              item
            ) =>
              total +
              item.total,
            0
          )}
        </strong>
      </button>

      {campaigns.map(
        (campaign) => (
          <button
            key={
              campaign.id
            }
            type="button"
            className={
              value ===
              campaign.id
                ? "active"
                : ""
            }
            onClick={() =>
              onSelect(
                campaign.id
              )
            }
          >
            <span>
              {campaign.name}
            </span>

            <strong>
              {campaign.total}
            </strong>
          </button>
        )
      )}
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onClick,
  index,
}) {
  const latest =
    thread.latest;

  const channel =
    getChannel(
      latest
    );

  const sender =
    getThreadDisplayName(
      thread
    );

  const subject =
    thread.subject ||
    "No subject";

  const preview =
    normalizePreview(
      latest?.snippet ||
        latest?.body ||
        "No preview available."
    );

  const Icon =
    channel ===
      "whatsapp"
      ? MessageCircle
      : Mail;

  return (
    <button
      type="button"
      className={`rfi-thread-row ${
        active
          ? "active"
          : ""
      } ${
        thread.unread
          ? "unread"
          : ""
      }`}
      style={{
        "--rfi-thread-index":
          index,
      }}
      onClick={
        onClick
      }
    >
      <span
        className={`rfi-thread-avatar ${getAvatarTone(
          sender
        )}`}
      >
        {getInitials(
          sender
        )}

        <i
          className={
            channel
          }
        >
          <Icon size={8} />
        </i>
      </span>

      <span className="rfi-thread-copy">
        <span className="rfi-thread-line">
          <strong>
            {sender}
          </strong>

          <time>
            {formatCompactDate(
              thread.latestAt
            )}
          </time>
        </span>

        <span className="rfi-thread-subject">
          <b>
            {subject}
          </b>

          {thread.unread ? (
            <i />
          ) : null}
        </span>

        <span className="rfi-thread-preview">
          {preview}
        </span>
      </span>
    </button>
  );
}

function ConversationHeader({
  thread,
  message,
  markingRead,
  onMarkRead,
  onMobileBack,
}) {
  const context =
    buildConversationContext(
      thread,
      message
    );

  return (
    <header className="rfi-conversation-head">
      <button
        type="button"
        className="rfi-mobile-back"
        aria-label="Back to inbox threads"
        onClick={
          onMobileBack
        }
      >
        <ArrowLeft size={15} />
      </button>

      <div className="rfi-conversation-person">
        <span
          className={`rfi-conversation-avatar ${getAvatarTone(
            context.name
          )}`}
        >
          {getInitials(
            context.name
          )}
        </span>

        <div>
          <h2>
            {context.name}
          </h2>

          <p>
            {[
              context.company,
              context.email,
            ]
              .filter(Boolean)
              .join(" · ") ||
              thread.subject}
          </p>
        </div>
      </div>

      <div className="rfi-conversation-actions">
        {thread.unread ? (
          <button
            type="button"
            className="rfi-mark-read"
            disabled={
              markingRead
            }
            onClick={() =>
              void onMarkRead()
            }
          >
            {markingRead ? (
              <RefreshCw
                size={14}
                className="spin"
              />
            ) : (
              <CheckCircle2 size={14} />
            )}

            Mark Read
          </button>
        ) : (
          <span className="rfi-read-state">
            <CheckCircle2 size={13} />
            Read
          </span>
        )}

        {message?.id ? (
          <Link
            className="rfi-full-view"
            to={`/app/inbox/${encodeURIComponent(
              message.id
            )}`}
            state={{
              message,
            }}
            title="Open full message view"
          >
            <ExternalLink size={14} />
          </Link>
        ) : null}
      </div>
    </header>
  );
}

function ConversationSummary({
  context,
}) {
  if (
    !context.summary
  ) {
    return null;
  }

  return (
    <section
      className={`rfi-context-summary ${
        context.aiSummary
          ? "ai"
          : ""
      }`}
    >
      <span>
        <Sparkles size={15} />
      </span>

      <div>
        <strong>
          {context.aiSummary
            ? "AI Context Summary"
            : "Conversation Context"}
        </strong>

        <p>
          {context.summary}
        </p>

        {context.suggestedAction ? (
          <em>
            Suggested action:{" "}
            {context.suggestedAction}
          </em>
        ) : null}
      </div>
    </section>
  );
}

function ConversationMessages({
  thread,
  selectedDetail,
  detailLoading,
}) {
  const messages =
    thread.messages;

  return (
    <div className="rfi-message-stream">
      <div className="rfi-date-divider">
        <i />

        <span>
          {formatConversationDate(
            thread.latestAt
          )}
        </span>

        <i />
      </div>

      {messages.map(
        (
          message,
          index
        ) => {
          const outbound =
            isOutbound(
              message
            );

          const hydrated =
            selectedDetail &&
            String(
              selectedDetail.id
            ) ===
              String(
                message.id
              )
              ? {
                  ...message,
                  ...selectedDetail,
                }
              : message;

          return (
            <MessageBubble
              key={
                message.id ||
                `${thread.key}-${index}`
              }
              message={
                hydrated
              }
              outbound={
                outbound
              }
              index={
                index
              }
            />
          );
        }
      )}

      {detailLoading ? (
        <div className="rfi-detail-loading">
          <RefreshCw
            size={13}
            className="spin"
          />

          Loading message details…
        </div>
      ) : null}
    </div>
  );
}

function MessageBubble({
  message,
  outbound,
  index,
}) {
  const title =
    message.subject ||
    message.title ||
    "";

  const name =
    outbound
      ? "You"
      : message.fromName ||
        message.leadName ||
        "Reply";

  const body =
    normalizeBody(
      message.body ||
        message.snippet ||
        "No message body available."
    );

  const channel =
    getChannel(
      message
    );

  const Icon =
    channel ===
      "whatsapp"
      ? MessageCircle
      : Mail;

  return (
    <article
      className={`rfi-bubble-row ${
        outbound
          ? "outbound"
          : "inbound"
      }`}
      style={{
        "--rfi-message-index":
          index,
      }}
    >
      {!outbound ? (
        <span
          className={`rfi-message-avatar ${getAvatarTone(
            name
          )}`}
        >
          {getInitials(
            name
          )}
        </span>
      ) : null}

      <div className="rfi-bubble-wrap">
        <div className="rfi-bubble-meta">
          {outbound ? (
            <>
              <time>
                {formatTime(
                  message.createdAt
                )}
              </time>

              <strong>
                You
              </strong>
            </>
          ) : (
            <>
              <strong>
                {name}
              </strong>

              <time>
                {formatTime(
                  message.createdAt
                )}
              </time>
            </>
          )}
        </div>

        <div className="rfi-bubble">
          {title ? (
            <h3>
              {title}
            </h3>
          ) : null}

          <StructuredBody
            value={
              body
            }
          />
        </div>

        <div className="rfi-bubble-foot">
          <span>
            <Icon size={10} />
            {channel ===
            "whatsapp"
              ? "WhatsApp"
              : "Email"}
          </span>

          {outbound ? (
            <span>
              Sent
            </span>
          ) : message.unread ? (
            <span className="unread">
              Unread
            </span>
          ) : (
            <span>
              Read
            </span>
          )}
        </div>
      </div>

      {outbound ? (
        <span className="rfi-message-avatar you">
          RF
        </span>
      ) : null}
    </article>
  );
}

function StructuredBody({
  value,
}) {
  const paragraphs =
    String(
      value ||
      ""
    )
      .replace(
        /\r\n/g,
        "\n"
      )
      .split(
        /\n{2,}/
      )
      .map(
        (part) =>
          part.trim()
      )
      .filter(Boolean);

  if (
    !paragraphs.length
  ) {
    return (
      <p>
        No message content available.
      </p>
    );
  }

  return (
    <div className="rfi-structured-body">
      {paragraphs.map(
        (
          paragraph,
          index
        ) => (
          <p
            key={
              index
            }
          >
            {paragraph}
          </p>
        )
      )}
    </div>
  );
}

function ReplyDock({
  context,
  selectedMessage,
}) {
  const recipient =
    getReplyRecipient(
      selectedMessage,
      context
    );

  const subject =
    selectedMessage?.subject ||
    selectedMessage?.title ||
    "";

  const mailto =
    recipient
      ? buildMailto(
          recipient,
          subject
        )
      : "";

  return (
    <footer className="rfi-reply-dock">
      <div className="rfi-reply-note">
        <span>
          <Mail size={14} />
        </span>

        <div>
          <strong>
            Reply from your mailbox
          </strong>

          <p>
            ReachFly currently syncs and reads campaign replies here. Direct
            reply sending is not exposed by the current inbox API.
          </p>
        </div>
      </div>

      <div className="rfi-reply-actions">
        <Link
          className="rfi-btn rfi-btn-secondary"
          to="/app/email"
        >
          Email settings
        </Link>

        {mailto ? (
          <a
            className="rfi-btn rfi-btn-primary"
            href={
              mailto
            }
          >
            <Send size={14} />
            Reply
          </a>
        ) : (
          <button
            type="button"
            className="rfi-btn rfi-btn-primary"
            disabled
          >
            <Send size={14} />
            Reply
          </button>
        )}
      </div>
    </footer>
  );
}

function ContactContext({
  context,
  selectedMessage,
}) {
  const campaignPath =
    context.campaignId
      ? `/app/campaigns/${context.campaignId}`
      : "/app/campaigns";

  return (
    <div className="rfi-context-scroll">
      <section className="rfi-contact-profile">
        <span
          className={`rfi-profile-avatar ${getAvatarTone(
            context.name
          )}`}
        >
          {getInitials(
            context.name
          )}
        </span>

        <h2>
          {context.name}
        </h2>

        <p>
          {context.company ||
            context.campaignName ||
            "Campaign contact"}
        </p>

        <div className="rfi-profile-actions">
          {context.email ? (
            <a
              href={`mailto:${context.email}`}
              title="Email contact"
            >
              <Mail size={14} />
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="No email available"
            >
              <Mail size={14} />
            </button>
          )}

          {context.phone ? (
            <a
              href={`tel:${context.phone}`}
              title="Call contact"
            >
              <Phone size={14} />
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="No phone available"
            >
              <Phone size={14} />
            </button>
          )}

          {context.website ? (
            <a
              href={normalizeWebsiteUrl(
                context.website
              )}
              target="_blank"
              rel="noreferrer"
              title="Open website"
            >
              <Globe2 size={14} />
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="No website available"
            >
              <Globe2 size={14} />
            </button>
          )}
        </div>
      </section>

      <ContextSection
        title="Contact Details"
      >
        <ContextLine
          icon={
            <Mail size={13} />
          }
          label="Email"
          value={
            context.email ||
            "Not available"
          }
        />

        <ContextLine
          icon={
            <Phone size={13} />
          }
          label="Phone"
          value={
            context.phone ||
            "Not available"
          }
        />

        <ContextLine
          icon={
            <MapPin size={13} />
          }
          label="Location"
          value={
            context.location ||
            "Not available"
          }
        />

        <ContextLine
          icon={
            <Building2 size={13} />
          }
          label="Company"
          value={
            context.company ||
            "Not available"
          }
        />
      </ContextSection>

      <ContextSection
        title="Campaign"
      >
        <Link
          className="rfi-campaign-context"
          to={
            campaignPath
          }
        >
          <span>
            <InboxIcon size={13} />
          </span>

          <div>
            <strong>
              {context.campaignName ||
                "Campaign"}
            </strong>

            <small>
              {context.campaignId
                ? "Open campaign details"
                : "Open campaigns"}
            </small>
          </div>

          <ChevronRight size={13} />
        </Link>
      </ContextSection>

      <ContextSection
        title="Recent Activity"
      >
        <div className="rfi-context-activity">
          <ContextActivity
            icon={
              <Mail size={11} />
            }
            title={
              isInbound(
                selectedMessage
              )
                ? "Reply received"
                : "Email sent"
            }
            time={
              selectedMessage?.createdAt
            }
            tone={
              isInbound(
                selectedMessage
              )
                ? "primary"
                : "neutral"
            }
          />

          {context.lastSentAt ? (
            <ContextActivity
              icon={
                <Send size={11} />
              }
              title="Campaign email sent"
              time={
                context.lastSentAt
              }
              tone="neutral"
            />
          ) : null}

          {context.lastReplyAt ? (
            <ContextActivity
              icon={
                <MessageCircle size={11} />
              }
              title="Campaign reply received"
              time={
                context.lastReplyAt
              }
              tone="violet"
            />
          ) : null}
        </div>
      </ContextSection>
    </div>
  );
}

function ContextSection({
  title,
  children,
}) {
  return (
    <section className="rfi-context-section">
      <h3>
        {title}
      </h3>

      {children}
    </section>
  );
}

function ContextLine({
  icon,
  label,
  value,
}) {
  return (
    <div className="rfi-context-line">
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
    </div>
  );
}

function ContextActivity({
  icon,
  title,
  time,
  tone,
}) {
  if (!time) {
    return null;
  }

  return (
    <div className="rfi-context-activity-row">
      <span
        className={
          tone
        }
      >
        {icon}
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <small>
          {formatRelativeOrDate(
            time
          )}
        </small>
      </div>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div
      className="rfi-thread-skeleton"
      aria-busy="true"
      aria-label="Loading inbox threads"
    >
      {Array.from({
        length: 7,
      }).map(
        (
          _,
          index
        ) => (
          <div
            key={
              index
            }
          >
            <i className="avatar" />

            <span>
              <i />
              <i />
              <i />
            </span>
          </div>
        )
      )}
    </div>
  );
}

function ThreadEmpty({
  hasItems,
  onReset,
}) {
  return (
    <div className="rfi-thread-empty">
      <span>
        <InboxIcon size={21} />
      </span>

      <strong>
        {hasItems
          ? "No matching threads"
          : "No campaign replies yet"}
      </strong>

      <p>
        {hasItems
          ? "Try another search, campaign, or inbox filter."
          : "Campaign email activity will appear here after emails are sent and replies are synced."}
      </p>

      {hasItems ? (
        <button
          type="button"
          onClick={
            onReset
          }
        >
          Reset filters
        </button>
      ) : (
        <Link
          to="/app/campaigns"
        >
          Open campaigns
        </Link>
      )}
    </div>
  );
}

function ConversationEmpty() {
  return (
    <div className="rfi-conversation-empty">
      <span>
        <MessageCircle size={25} />
      </span>

      <h2>
        Select a conversation
      </h2>

      <p>
        Choose an inbox thread to review the campaign email and its connected
        replies.
      </p>
    </div>
  );
}

/* ==========================================================================
 * Data adapters
 * ======================================================================= */

function normalizeInboxResponse(
  response
) {
  if (
    Array.isArray(
      response
    )
  ) {
    return response;
  }

  if (
    Array.isArray(
      response?.items
    )
  ) {
    return response.items;
  }

  if (
    Array.isArray(
      response?.messages
    )
  ) {
    return response.messages;
  }

  return [];
}

function buildCampaignActivity(
  items
) {
  const map =
    new Map();

  for (const item of items) {
    const id =
      String(
        item.campaignId ||
          "uncategorized"
      );

    const name =
      item.campaignName ||
      "Uncategorized campaign";

    const current =
      map.get(id) ||
      {
        id,
        name,
        total: 0,
        sent: 0,
        replies: 0,
        unread: 0,
        latestAt:
          item.createdAt ||
          "",
      };

    current.total += 1;

    if (
      isSent(
        item
      )
    ) {
      current.sent += 1;
    }

    if (
      isReply(
        item
      )
    ) {
      current.replies += 1;
    }

    if (
      isReply(
        item
      ) &&
      item.unread
    ) {
      current.unread += 1;
    }

    if (
      getTimestamp(
        item.createdAt
      ) >
      getTimestamp(
        current.latestAt
      )
    ) {
      current.latestAt =
        item.createdAt;
    }

    map.set(
      id,
      current
    );
  }

  return Array.from(
    map.values()
  ).sort(
    (
      left,
      right
    ) =>
      getTimestamp(
        right.latestAt
      ) -
      getTimestamp(
        left.latestAt
      )
  );
}

function buildThreads(
  items
) {
  const map =
    new Map();

  items.forEach(
    (
      item,
      index
    ) => {
      const key =
        getThreadKey(
          item,
          index
        );

      const current =
        map.get(
          key
        ) || {
          key,
          messages: [],
        };

      current.messages.push(
        item
      );

      map.set(
        key,
        current
      );
    }
  );

  return Array.from(
    map.values()
  )
    .map(
      (thread) => {
        const messages =
          [...thread.messages].sort(
            (
              left,
              right
            ) =>
              getTimestamp(
                left.createdAt
              ) -
              getTimestamp(
                right.createdAt
              )
          );

        const latest =
          messages[
            messages.length -
              1
          ];

        const earliest =
          messages[0];

        const campaignId =
          String(
            latest?.campaignId ||
              earliest?.campaignId ||
              "uncategorized"
          );

        const campaignName =
          latest?.campaignName ||
          earliest?.campaignName ||
          "Uncategorized campaign";

        const subject =
          latest?.subject ||
          earliest?.subject ||
          latest?.title ||
          earliest?.title ||
          "No subject";

        const unread =
          messages.some(
            (message) =>
              isInbound(
                message
              ) &&
              Boolean(
                message.unread
              )
          );

        const hasReply =
          messages.some(
            isReply
          );

        const hasSent =
          messages.some(
            isSent
          );

        return {
          ...thread,
          messages,
          latest,
          earliest,
          campaignId,
          campaignName,
          subject,
          unread,
          hasReply,
          hasSent,
          latestAt:
            latest?.createdAt ||
            "",
          searchable:
            messages
              .flatMap(
                (message) => [
                  message.subject,
                  message.title,
                  message.fromName,
                  message.fromEmail,
                  message.toName,
                  message.toEmail,
                  message.campaignName,
                  message.leadName,
                  message.companyName,
                  message.business,
                  message.snippet,
                  message.body,
                ]
              )
              .filter(Boolean)
              .join(" ")
              .toLowerCase(),
        };
      }
    )
    .sort(
      (
        left,
        right
      ) =>
        getTimestamp(
          right.latestAt
        ) -
        getTimestamp(
          left.latestAt
        )
    );
}

function getThreadKey(
  item,
  index
) {
  return String(
    item.threadId ||
      item.conversationId ||
      item.replyToSentId ||
      item.parentMessageId ||
      item.id ||
      `message-${index}`
  );
}

function getThreadFocusMessageId(
  thread
) {
  if (!thread) {
    return "";
  }

  const unreadReply =
    [...thread.messages]
      .reverse()
      .find(
        (message) =>
          isInbound(
            message
          ) &&
          message.unread
      );

  const latestReply =
    [...thread.messages]
      .reverse()
      .find(
        isInbound
      );

  return String(
    unreadReply?.id ||
      latestReply?.id ||
      thread.latest?.id ||
      ""
  );
}

function buildInboxStats(
  items
) {
  const sent =
    items.filter(
      isSent
    ).length;

  const replies =
    items.filter(
      isReply
    ).length;

  const unread =
    items.filter(
      (message) =>
        isReply(
          message
        ) &&
        message.unread
    ).length;

  return {
    total:
      sent +
      replies,
    sent,
    replies,
    unread,
    replyRate:
      sent >
      0
        ? (
            replies /
            sent
          ) *
          100
        : 0,
  };
}

function buildConversationContext(
  thread,
  message
) {
  if (!thread) {
    return {
      name:
        "Campaign contact",
      email:
        "",
      phone:
        "",
      company:
        "",
      location:
        "",
      website:
        "",
      campaignName:
        "",
      campaignId:
        "",
      summary:
        "",
      suggestedAction:
        "",
      aiSummary:
        false,
      lastSentAt:
        "",
      lastReplyAt:
        "",
    };
  }

  const inbound =
    [...thread.messages]
      .reverse()
      .find(
        isInbound
      );

  const outbound =
    [...thread.messages]
      .reverse()
      .find(
        isOutbound
      );

  const source =
    inbound ||
    message ||
    outbound ||
    thread.latest ||
    {};

  const name =
    firstString(
      source.fromName,
      source.leadName,
      source.contactName,
      source.toName,
      thread.latest?.leadName,
      thread.earliest?.leadName,
      source.fromEmail,
      source.toEmail,
      "Campaign contact"
    );

  const email =
    firstString(
      isInbound(
        source
      )
        ? source.fromEmail
        : "",
      source.leadEmail,
      source.contactEmail,
      inbound?.fromEmail,
      outbound?.toEmail,
      source.toEmail
    );

  const phone =
    firstString(
      source.phone,
      source.phoneNumber,
      source.leadPhone,
      source.contactPhone,
      inbound?.phone,
      outbound?.phone
    );

  const company =
    firstString(
      source.companyName,
      source.business,
      source.organization,
      source.accountName,
      inbound?.companyName,
      outbound?.companyName
    );

  const location =
    firstString(
      source.location,
      source.city,
      source.address,
      source.formattedAddress,
      inbound?.location,
      outbound?.location
    );

  const website =
    firstString(
      source.website,
      source.websiteUrl,
      source.domain,
      inbound?.website,
      outbound?.website
    );

  const explicitSummary =
    firstString(
      source.aiSummary,
      source.summary,
      source.analysis?.summary,
      thread.latest?.aiSummary,
      thread.latest?.summary
    );

  const suggestedAction =
    firstString(
      source.suggestedAction,
      source.analysis?.suggestedAction,
      source.aiSuggestedAction,
      thread.latest?.suggestedAction
    );

  const latestInbound =
    [...thread.messages]
      .reverse()
      .find(
        isInbound
      );

  const deterministicSummary =
    latestInbound
      ? buildDeterministicSummary(
          latestInbound,
          name
        )
      : "";

  const lastSent =
    [...thread.messages]
      .reverse()
      .find(
        isOutbound
      );

  const lastReply =
    [...thread.messages]
      .reverse()
      .find(
        isInbound
      );

  return {
    name,
    email,
    phone,
    company,
    location,
    website,
    campaignName:
      thread.campaignName,
    campaignId:
      thread.campaignId ===
      "uncategorized"
        ? ""
        : thread.campaignId,
    summary:
      explicitSummary ||
      deterministicSummary,
    suggestedAction,
    aiSummary:
      Boolean(
        explicitSummary
      ),
    lastSentAt:
      lastSent?.createdAt ||
      "",
    lastReplyAt:
      lastReply?.createdAt ||
      "",
  };
}

function buildDeterministicSummary(
  message,
  name
) {
  const subject =
    message.subject ||
    message.title ||
    "the campaign email";

  const preview =
    normalizePreview(
      message.snippet ||
        message.body ||
        ""
    );

  if (!preview) {
    return `${name} replied to ${subject}.`;
  }

  const shortened =
    preview.length >
    220
      ? `${preview.slice(
          0,
          217
        )}…`
      : preview;

  return `${name} replied to ${subject}: ${shortened}`;
}

function getThreadDisplayName(
  thread
) {
  const inbound =
    [...thread.messages]
      .reverse()
      .find(
        isInbound
      );

  const outbound =
    [...thread.messages]
      .reverse()
      .find(
        isOutbound
      );

  return firstString(
    inbound?.fromName,
    inbound?.leadName,
    inbound?.fromEmail,
    outbound?.leadName,
    outbound?.toName,
    outbound?.toEmail,
    thread.latest?.leadName,
    "Campaign contact"
  );
}

function getReplyRecipient(
  message,
  context
) {
  if (
    isInbound(
      message
    )
  ) {
    return firstString(
      message.fromEmail,
      context.email
    );
  }

  return firstString(
    context.email,
    message?.toEmail
  );
}

function buildMailto(
  recipient,
  subject
) {
  const cleanSubject =
    String(
      subject ||
      ""
    )
      .replace(
        /^re:\s*/i,
        ""
      )
      .trim();

  const nextSubject =
    cleanSubject
      ? `Re: ${cleanSubject}`
      : "";

  const params =
    new URLSearchParams();

  if (nextSubject) {
    params.set(
      "subject",
      nextSubject
    );
  }

  return `mailto:${recipient}${
    params.toString()
      ? `?${params.toString()}`
      : ""
  }`;
}

function isSent(
  message
) {
  return (
    message?.direction ===
      "outbound" &&
    message?.channel ===
      "email"
  );
}

function isReply(
  message
) {
  return (
    message?.direction ===
      "inbound" &&
    message?.channel ===
      "email" &&
    Boolean(
      message?.replyToSentId
    )
  );
}

function isInbound(
  message
) {
  return (
    message?.direction ===
    "inbound"
  );
}

function isOutbound(
  message
) {
  return (
    message?.direction ===
    "outbound"
  );
}

function getChannel(
  message
) {
  return String(
    message?.channel ||
      "email"
  ).toLowerCase();
}

/* ==========================================================================
 * Utilities
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

function normalizePreview(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .replace(
      /\s+([,.!?])/g,
      "$1"
    )
    .trim();
}

function normalizeBody(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /\r\n/g,
      "\n"
    )
    .trim();
}

function normalizeWebsiteUrl(
  value
) {
  const text =
    String(
      value ||
      ""
    ).trim();

  if (!text) {
    return "#";
  }

  if (
    /^https?:\/\//i.test(
      text
    )
  ) {
    return text;
  }

  return `https://${text}`;
}

function getTimestamp(
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

function formatNumber(
  value
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0";
  }

  return new Intl.NumberFormat().format(
    Math.round(
      number
    )
  );
}

function formatPercent(
  value
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0.0";
  }

  return number.toFixed(
    1
  );
}

function formatCompactDate(
  value
) {
  if (!value) {
    return "";
  }

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

  const now =
    new Date();

  if (
    date.toDateString() ===
    now.toDateString()
  ) {
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

  const yesterday =
    new Date(
      now
    );

  yesterday.setDate(
    now.getDate() -
      1
  );

  if (
    date.toDateString() ===
    yesterday.toDateString()
  ) {
    return "Yesterday";
  }

  const delta =
    now.getTime() -
    date.getTime();

  if (
    delta <
    7 *
      24 *
      60 *
      60 *
      1000
  ) {
    return date.toLocaleDateString(
      undefined,
      {
        weekday:
          "short",
      }
    );
  }

  return date.toLocaleDateString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
    }
  );
}

function formatConversationDate(
  value
) {
  if (!value) {
    return "Conversation";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Conversation";
  }

  const today =
    new Date();

  if (
    date.toDateString() ===
    today.toDateString()
  ) {
    return "Today";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
      year:
        date.getFullYear() ===
        today.getFullYear()
          ? undefined
          : "numeric",
    }
  );
}

function formatTime(
  value
) {
  if (!value) {
    return "";
  }

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

function formatRelativeOrDate(
  value
) {
  if (!value) {
    return "";
  }

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

  const delta =
    Date.now() -
    date.getTime();

  if (
    delta >=
      0 &&
    delta <
      60 *
        1000
  ) {
    return "Just now";
  }

  if (
    delta >=
      0 &&
    delta <
      60 *
        60 *
        1000
  ) {
    const minutes =
      Math.max(
        1,
        Math.floor(
          delta /
            (
              60 *
              1000
            )
        )
      );

    return `${minutes} min${
      minutes ===
      1
        ? ""
        : "s"
    } ago`;
  }

  if (
    delta >=
      0 &&
    delta <
      24 *
        60 *
        60 *
        1000
  ) {
    const hours =
      Math.max(
        1,
        Math.floor(
          delta /
            (
              60 *
              60 *
              1000
            )
        )
      );

    return `${hours} hr${
      hours ===
      1
        ? ""
        : "s"
    } ago`;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
    }
  );
}

function getInitials(
  value
) {
  const parts =
    String(
      value ||
        "RF"
    )
      .trim()
      .split(/\s+/)
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

function getAvatarTone(
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
 * Scoped Stitch styling
 * ======================================================================= */

function InboxStyles() {
  return (
    <style>{`
      .rf-inbox-v7{
        --rfi-surface:#f8f9fa;
        --rfi-card:#ffffff;
        --rfi-low:#f3f4f5;
        --rfi-high:#e7e8e9;
        --rfi-highest:#e1e3e4;
        --rfi-text:#191c1d;
        --rfi-text-soft:#464554;
        --rfi-muted:#767586;
        --rfi-outline:#e3e5e7;
        --rfi-outline-strong:#c7c4d7;
        --rfi-primary:#4648d4;
        --rfi-primary-dark:#3537bb;
        --rfi-primary-soft:#e8e9ff;
        --rfi-violet:#6b38d4;
        --rfi-violet-soft:#f0eaff;
        --rfi-success:#087a51;
        --rfi-success-soft:#dcfce7;
        --rfi-danger:#ba1a1a;
        --rfi-danger-soft:#ffedeb;
        --rfi-ease:cubic-bezier(.2,.8,.2,1);
        min-height:100%;
        padding:22px 24px 36px;
        color:var(--rfi-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfiPageIn 260ms var(--rfi-ease);
      }

      .rf-inbox-v7 *,
      .rf-inbox-v7 *::before,
      .rf-inbox-v7 *::after{
        box-sizing:border-box;
      }

      .rf-inbox-v7 a{
        color:inherit;
      }

      .rf-inbox-v7 .spin{
        animation:rfiSpin 800ms linear infinite;
      }

      @keyframes rfiPageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfiFadeUp{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfiThreadIn{
        from{opacity:0;transform:translate3d(-4px,0,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfiBubbleIn{
        from{opacity:0;transform:translate3d(0,8px,0) scale(.99)}
        to{opacity:1;transform:translate3d(0,0,0) scale(1)}
      }

      @keyframes rfiPopoverIn{
        from{opacity:0;transform:translate3d(0,-5px,0) scale(.985)}
        to{opacity:1;transform:translate3d(0,0,0) scale(1)}
      }

      @keyframes rfiSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfiShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfi-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:16px;
      }

      .rfi-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfi-primary);
        font-size:9px;
        font-weight:750;
        line-height:13px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfi-page-header h1{
        margin:0;
        color:var(--rfi-text);
        font:600 30px/38px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfi-page-header p{
        margin:3px 0 0;
        color:var(--rfi-text-soft);
        font-size:12px;
        line-height:18px;
      }

      .rfi-header-actions{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rfi-btn{
        appearance:none;
        min-height:38px;
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
        font:600 10px/16px Inter,sans-serif;
        transition:
          color 140ms var(--rfi-ease),
          background 140ms var(--rfi-ease),
          border-color 140ms var(--rfi-ease),
          transform 140ms var(--rfi-ease),
          box-shadow 140ms var(--rfi-ease);
      }

      .rfi-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfi-btn:active:not(:disabled){
        transform:translateY(0) scale(.985);
      }

      .rfi-btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfi-btn-primary{
        color:#fff!important;
        background:var(--rfi-primary);
        border-color:var(--rfi-primary);
        box-shadow:0 4px 12px rgba(70,72,212,.16);
      }

      .rfi-btn-primary:hover:not(:disabled){
        background:var(--rfi-primary-dark);
        border-color:var(--rfi-primary-dark);
      }

      .rfi-btn-secondary{
        color:var(--rfi-text)!important;
        background:#fff;
        border-color:var(--rfi-outline);
      }

      .rfi-btn-secondary:hover:not(:disabled){
        color:var(--rfi-primary)!important;
        background:var(--rfi-primary-soft);
        border-color:rgba(70,72,212,.18);
      }

      .rfi-message{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        margin-bottom:12px;
        border:1px solid;
        border-radius:9px;
        animation:rfiFadeUp 180ms var(--rfi-ease);
      }

      .rfi-message.error{
        color:#7c1616;
        background:var(--rfi-danger-soft);
        border-color:#ffd0cc;
      }

      .rfi-message > span{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        flex:0 0 26px;
        background:rgba(255,255,255,.7);
        border-radius:7px;
      }

      .rfi-message > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:1px;
      }

      .rfi-message strong{
        font-size:10px;
        line-height:14px;
      }

      .rfi-message small{
        font-size:9px;
        line-height:14px;
      }

      .rfi-message > button{
        align-self:center;
        padding:5px 8px;
        color:inherit;
        background:rgba(255,255,255,.68);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:8px;
        font-weight:700;
      }

      .rfi-metrics{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
        margin-bottom:14px;
      }

      .rfi-metric{
        min-height:66px;
        display:flex;
        align-items:center;
        gap:10px;
        padding:12px 14px;
        background:#fff;
        border:1px solid var(--rfi-outline);
        border-radius:10px;
      }

      .rfi-metric > span{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        flex:0 0 31px;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border-radius:8px;
      }

      .rfi-metric.neutral > span{
        color:#5b6270;
        background:#eef1f5;
      }

      .rfi-metric.violet > span{
        color:var(--rfi-violet);
        background:var(--rfi-violet-soft);
      }

      .rfi-metric.success > span{
        color:var(--rfi-success);
        background:var(--rfi-success-soft);
      }

      .rfi-metric > div{
        min-width:0;
        display:grid;
        grid-template-columns:auto auto;
        column-gap:6px;
        align-items:baseline;
      }

      .rfi-metric small{
        grid-column:1/-1;
        color:var(--rfi-muted);
        font-size:7px;
        font-weight:700;
        line-height:11px;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .rfi-metric strong{
        color:var(--rfi-text);
        font:600 18px/22px Geist,Inter,sans-serif;
      }

      .rfi-metric em{
        color:var(--rfi-muted);
        font-size:7px;
        font-style:normal;
        line-height:10px;
      }

      .rfi-workspace{
        height:min(760px,calc(100vh - 260px));
        min-height:560px;
        display:grid;
        grid-template-columns:340px minmax(0,1fr) 300px;
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfi-outline);
        border-radius:14px;
        box-shadow:0 2px 12px rgba(25,28,29,.035);
      }

      .rfi-thread-panel{
        min-width:0;
        display:flex;
        flex-direction:column;
        background:#fafafb;
        border-right:1px solid var(--rfi-outline);
      }

      .rfi-thread-panel-head{
        padding:18px 15px 11px;
        background:#fafafb;
        border-bottom:1px solid var(--rfi-outline);
      }

      .rfi-thread-title-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:11px;
      }

      .rfi-thread-title-row > strong{
        color:var(--rfi-text);
        font:600 16px/21px Geist,Inter,sans-serif;
      }

      .rfi-thread-head-actions{
        display:flex;
        align-items:center;
        gap:4px;
      }

      .rfi-thread-head-actions > button,
      .rfi-campaign-filter > button{
        min-width:30px;
        height:30px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:2px;
        padding:0 6px;
        color:var(--rfi-text-soft);
        background:var(--rfi-high);
        border:0;
        border-radius:50%;
        cursor:pointer;
      }

      .rfi-thread-head-actions > button:hover,
      .rfi-campaign-filter > button:hover,
      .rfi-campaign-filter > button.active{
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
      }

      .rfi-campaign-filter{
        position:relative;
      }

      .rfi-campaign-menu{
        position:absolute;
        z-index:60;
        top:36px;
        right:0;
        width:240px;
        max-height:330px;
        overflow:auto;
        padding:5px;
        background:#fff;
        border:1px solid var(--rfi-outline);
        border-radius:10px;
        box-shadow:0 16px 38px rgba(25,28,29,.14);
        animation:rfiPopoverIn 160ms var(--rfi-ease);
      }

      .rfi-campaign-menu button{
        width:100%;
        min-height:34px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:7px 8px;
        color:var(--rfi-text-soft);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        text-align:left;
        font-size:8px;
      }

      .rfi-campaign-menu button:hover,
      .rfi-campaign-menu button.active{
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
      }

      .rfi-campaign-menu button span{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfi-campaign-menu button strong{
        flex:0 0 auto;
        font-size:7px;
      }

      .rfi-filter-tabs{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:3px;
        padding:4px;
        margin-bottom:9px;
        background:var(--rfi-high);
        border-radius:8px;
      }

      .rfi-filter-tabs button{
        min-height:30px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:3px;
        padding:5px 4px;
        color:var(--rfi-text-soft);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
        font:500 8px/12px Inter,sans-serif;
      }

      .rfi-filter-tabs button.active{
        color:var(--rfi-text);
        background:#fff;
        box-shadow:0 1px 3px rgba(25,28,29,.06);
      }

      .rfi-filter-tabs button span{
        min-width:16px;
        height:16px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfi-primary);
        border-radius:999px;
        font-size:6px;
        font-weight:800;
      }

      .rfi-thread-search{
        height:34px;
        display:flex;
        align-items:center;
        gap:6px;
        padding:0 8px;
        color:var(--rfi-muted);
        background:#fff;
        border:1px solid transparent;
        border-radius:7px;
      }

      .rfi-thread-search:focus-within{
        border-color:rgba(70,72,212,.38);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rfi-thread-search input{
        min-width:0;
        flex:1;
        height:32px;
        padding:0;
        color:var(--rfi-text);
        background:transparent;
        border:0;
        outline:0;
        font:400 9px/14px Inter,sans-serif;
      }

      .rfi-thread-search button{
        width:23px;
        height:23px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfi-muted);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
      }

      .rfi-thread-search button:hover{
        color:var(--rfi-text);
        background:var(--rfi-low);
      }

      .rfi-thread-list{
        min-height:0;
        flex:1;
        overflow:auto;
      }

      .rfi-thread-row{
        width:100%;
        min-height:104px;
        display:flex;
        align-items:flex-start;
        gap:10px;
        padding:15px 14px;
        color:inherit;
        background:transparent;
        border:0;
        border-bottom:1px solid #eff0f1;
        border-left:3px solid transparent;
        text-align:left;
        cursor:pointer;
        animation:rfiThreadIn 220ms var(--rfi-ease) both;
        animation-delay:calc(var(--rfi-thread-index) * 20ms);
        transition:
          background 140ms var(--rfi-ease),
          border-color 140ms var(--rfi-ease);
      }

      .rfi-thread-row:hover{
        background:#f4f4fb;
      }

      .rfi-thread-row.active{
        background:#e5e6fb;
        border-left-color:var(--rfi-primary);
      }

      .rfi-thread-avatar{
        position:relative;
        width:39px;
        height:39px;
        display:grid;
        place-items:center;
        flex:0 0 39px;
        color:#fff;
        border-radius:50%;
        font-size:9px;
        font-weight:800;
      }

      .rfi-thread-avatar.primary,
      .rfi-conversation-avatar.primary,
      .rfi-message-avatar.primary,
      .rfi-profile-avatar.primary{
        background:#5b5ddd;
      }

      .rfi-thread-avatar.violet,
      .rfi-conversation-avatar.violet,
      .rfi-message-avatar.violet,
      .rfi-profile-avatar.violet{
        background:#7546d9;
      }

      .rfi-thread-avatar.blue,
      .rfi-conversation-avatar.blue,
      .rfi-message-avatar.blue,
      .rfi-profile-avatar.blue{
        background:#3772b9;
      }

      .rfi-thread-avatar.green,
      .rfi-conversation-avatar.green,
      .rfi-message-avatar.green,
      .rfi-profile-avatar.green{
        background:#23845f;
      }

      .rfi-thread-avatar.amber,
      .rfi-conversation-avatar.amber,
      .rfi-message-avatar.amber,
      .rfi-profile-avatar.amber{
        background:#a06e25;
      }

      .rfi-thread-avatar > i{
        position:absolute;
        right:-1px;
        bottom:-1px;
        width:14px;
        height:14px;
        display:grid;
        place-items:center;
        color:var(--rfi-primary);
        background:#fff;
        border:2px solid #fafafb;
        border-radius:50%;
      }

      .rfi-thread-avatar > i.whatsapp{
        color:var(--rfi-success);
      }

      .rfi-thread-copy{
        min-width:0;
        flex:1;
        display:grid;
        gap:2px;
      }

      .rfi-thread-line,
      .rfi-thread-subject{
        min-width:0;
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rfi-thread-line strong{
        min-width:0;
        flex:1;
        overflow:hidden;
        color:var(--rfi-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rfi-thread-row.unread .rfi-thread-line strong{
        font-weight:700;
      }

      .rfi-thread-line time{
        flex:0 0 auto;
        color:var(--rfi-muted);
        font-size:7px;
        line-height:10px;
      }

      .rfi-thread-row.unread .rfi-thread-line time{
        color:var(--rfi-primary);
        font-weight:700;
      }

      .rfi-thread-subject b{
        min-width:0;
        flex:1;
        overflow:hidden;
        color:var(--rfi-text-soft);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:9px;
        font-weight:500;
        line-height:13px;
      }

      .rfi-thread-subject i{
        width:6px;
        height:6px;
        flex:0 0 6px;
        background:var(--rfi-primary);
        border-radius:50%;
      }

      .rfi-thread-preview{
        max-width:100%;
        display:-webkit-box;
        overflow:hidden;
        color:#868592;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:2;
        font-size:8px;
        line-height:12px;
      }

      .rfi-conversation-panel{
        min-width:0;
        min-height:0;
        display:flex;
        flex-direction:column;
        background:#fff;
      }

      .rfi-conversation-head{
        min-height:74px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:12px 18px;
        border-bottom:1px solid var(--rfi-outline);
      }

      .rfi-mobile-back{
        display:none;
        width:32px;
        height:32px;
        place-items:center;
        flex:0 0 32px;
        padding:0;
        color:var(--rfi-text-soft);
        background:var(--rfi-low);
        border:0;
        border-radius:7px;
        cursor:pointer;
      }

      .rfi-conversation-person{
        min-width:0;
        display:flex;
        align-items:center;
        gap:10px;
      }

      .rfi-conversation-avatar{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        flex:0 0 38px;
        color:#fff;
        border-radius:50%;
        font-size:9px;
        font-weight:800;
      }

      .rfi-conversation-person > div{
        min-width:0;
      }

      .rfi-conversation-person h2{
        margin:0;
        overflow:hidden;
        color:var(--rfi-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 16px/21px Geist,Inter,sans-serif;
      }

      .rfi-conversation-person p{
        margin:1px 0 0;
        overflow:hidden;
        color:var(--rfi-text-soft);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
        line-height:12px;
      }

      .rfi-conversation-actions{
        display:flex;
        align-items:center;
        gap:6px;
      }

      .rfi-mark-read,
      .rfi-read-state{
        min-height:34px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:6px 9px;
        color:var(--rfi-text);
        background:var(--rfi-low);
        border:0;
        border-radius:7px;
        font-size:8px;
        font-weight:650;
      }

      .rfi-mark-read{
        cursor:pointer;
      }

      .rfi-mark-read:hover:not(:disabled){
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
      }

      .rfi-mark-read:disabled{
        opacity:.5;
      }

      .rfi-read-state{
        color:var(--rfi-success);
        background:var(--rfi-success-soft);
      }

      .rfi-full-view{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfi-text-soft)!important;
        background:transparent;
        border-radius:7px;
        text-decoration:none;
      }

      .rfi-full-view:hover{
        color:var(--rfi-primary)!important;
        background:var(--rfi-primary-soft);
      }

      .rfi-conversation-scroll{
        min-height:0;
        flex:1;
        overflow:auto;
        padding:20px 28px 18px;
        background:
          radial-gradient(circle at 97% 0,rgba(107,56,212,.035),transparent 23%),
          #fff;
      }

      .rfi-detail-warning{
        display:flex;
        align-items:flex-start;
        gap:7px;
        padding:8px 9px;
        margin-bottom:12px;
        color:#7c1616;
        background:var(--rfi-danger-soft);
        border-radius:7px;
        font-size:8px;
        line-height:12px;
      }

      .rfi-detail-warning > span{
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        flex:0 0 22px;
        background:#fff;
        border-radius:6px;
      }

      .rfi-detail-warning p{
        margin:4px 0 0;
      }

      .rfi-context-summary{
        display:flex;
        gap:10px;
        max-width:680px;
        padding:14px 15px;
        margin:4px auto 22px;
        background:#f1f1f8;
        border-left:3px solid var(--rfi-outline-strong);
        border-radius:10px;
        animation:rfiFadeUp 220ms var(--rfi-ease);
      }

      .rfi-context-summary.ai{
        background:#f0f0fb;
        border-left-color:var(--rfi-violet);
      }

      .rfi-context-summary > span{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        flex:0 0 28px;
        color:var(--rfi-violet);
        background:#fff;
        border-radius:50%;
      }

      .rfi-context-summary > div{
        min-width:0;
        display:grid;
        gap:3px;
      }

      .rfi-context-summary strong{
        color:var(--rfi-text);
        font-size:8px;
        font-weight:800;
        line-height:12px;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfi-context-summary p{
        margin:0;
        color:var(--rfi-text-soft);
        font-size:9px;
        line-height:15px;
      }

      .rfi-context-summary em{
        color:var(--rfi-violet);
        font-size:8px;
        font-style:normal;
        font-weight:650;
        line-height:13px;
      }

      .rfi-date-divider{
        display:flex;
        align-items:center;
        gap:12px;
        margin-bottom:20px;
      }

      .rfi-date-divider i{
        height:1px;
        flex:1;
        background:var(--rfi-outline);
      }

      .rfi-date-divider span{
        color:var(--rfi-text-soft);
        font-size:8px;
        font-weight:700;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfi-message-stream{
        max-width:760px;
        margin:0 auto;
      }

      .rfi-bubble-row{
        display:flex;
        align-items:flex-start;
        gap:9px;
        margin-bottom:21px;
        animation:rfiBubbleIn 240ms var(--rfi-ease) both;
        animation-delay:calc(var(--rfi-message-index) * 35ms);
      }

      .rfi-bubble-row.outbound{
        justify-content:flex-end;
      }

      .rfi-message-avatar{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        flex:0 0 28px;
        color:#fff;
        border-radius:50%;
        font-size:7px;
        font-weight:800;
      }

      .rfi-message-avatar.you{
        background:#2e3132;
      }

      .rfi-bubble-wrap{
        max-width:82%;
        display:grid;
        gap:4px;
      }

      .rfi-bubble-row.outbound .rfi-bubble-wrap{
        justify-items:end;
      }

      .rfi-bubble-meta{
        display:flex;
        align-items:center;
        gap:7px;
        color:var(--rfi-muted);
        font-size:7px;
        line-height:10px;
      }

      .rfi-bubble-meta strong{
        color:var(--rfi-text);
        font-size:8px;
      }

      .rfi-bubble{
        min-width:220px;
        max-width:100%;
        padding:14px 16px;
        color:var(--rfi-text);
        background:var(--rfi-low);
        border:1px solid var(--rfi-highest);
        border-radius:14px 14px 14px 4px;
        box-shadow:0 1px 2px rgba(25,28,29,.035);
      }

      .rfi-bubble-row.outbound .rfi-bubble{
        color:#fff;
        background:var(--rfi-primary);
        border-color:var(--rfi-primary);
        border-radius:14px 14px 4px 14px;
        box-shadow:0 5px 13px rgba(70,72,212,.14);
      }

      .rfi-bubble h3{
        margin:0 0 10px;
        padding-bottom:8px;
        color:inherit;
        border-bottom:1px solid rgba(118,117,134,.16);
        font:600 11px/16px Geist,Inter,sans-serif;
      }

      .rfi-bubble-row.outbound .rfi-bubble h3{
        border-bottom-color:rgba(255,255,255,.18);
      }

      .rfi-structured-body{
        display:grid;
        gap:8px;
      }

      .rfi-structured-body p{
        margin:0;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
        color:inherit;
        font-size:9px;
        line-height:15px;
      }

      .rfi-bubble-foot{
        display:flex;
        align-items:center;
        gap:8px;
        color:var(--rfi-muted);
        font-size:7px;
        line-height:10px;
      }

      .rfi-bubble-foot span{
        display:inline-flex;
        align-items:center;
        gap:3px;
      }

      .rfi-bubble-foot span.unread{
        color:var(--rfi-primary);
        font-weight:700;
      }

      .rfi-detail-loading{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:8px;
        color:var(--rfi-muted);
        font-size:7px;
      }

      .rfi-reply-dock{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:12px 14px;
        background:var(--rfi-surface);
        border-top:1px solid var(--rfi-outline);
        box-shadow:0 -4px 20px rgba(25,28,29,.025);
      }

      .rfi-reply-note{
        min-width:0;
        display:flex;
        align-items:flex-start;
        gap:8px;
      }

      .rfi-reply-note > span{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        flex:0 0 30px;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border-radius:8px;
      }

      .rfi-reply-note > div{
        min-width:0;
      }

      .rfi-reply-note strong{
        display:block;
        color:var(--rfi-text);
        font-size:8px;
        line-height:12px;
      }

      .rfi-reply-note p{
        max-width:520px;
        margin:2px 0 0;
        color:var(--rfi-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfi-reply-actions{
        flex:0 0 auto;
        display:flex;
        gap:7px;
      }

      .rfi-reply-actions .rfi-btn{
        min-height:34px;
        padding:6px 9px;
        font-size:8px;
      }

      .rfi-context-panel{
        min-width:0;
        overflow:hidden;
        background:#fafafb;
        border-left:1px solid var(--rfi-outline);
      }

      .rfi-context-scroll{
        height:100%;
        overflow:auto;
      }

      .rfi-contact-profile{
        display:grid;
        justify-items:center;
        gap:4px;
        padding:24px 18px 20px;
        text-align:center;
        background:
          radial-gradient(circle at 80% 0,rgba(70,72,212,.08),transparent 34%),
          #fff;
        border-bottom:1px solid var(--rfi-outline);
      }

      .rfi-profile-avatar{
        width:66px;
        height:66px;
        display:grid;
        place-items:center;
        color:#fff;
        border:4px solid #fff;
        border-radius:50%;
        box-shadow:0 5px 16px rgba(25,28,29,.12);
        font-size:16px;
        font-weight:800;
      }

      .rfi-contact-profile h2{
        margin:4px 0 0;
        color:var(--rfi-text);
        font:600 15px/20px Geist,Inter,sans-serif;
      }

      .rfi-contact-profile p{
        margin:0;
        color:var(--rfi-text-soft);
        font-size:9px;
        line-height:13px;
      }

      .rfi-profile-actions{
        display:flex;
        align-items:center;
        gap:7px;
        margin-top:7px;
      }

      .rfi-profile-actions a,
      .rfi-profile-actions button{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfi-text-soft);
        background:var(--rfi-low);
        border:0;
        border-radius:7px;
        text-decoration:none;
        cursor:pointer;
      }

      .rfi-profile-actions a:hover{
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
      }

      .rfi-profile-actions button:disabled{
        opacity:.35;
        cursor:not-allowed;
      }

      .rfi-context-section{
        padding:16px 17px;
        border-bottom:1px solid var(--rfi-outline);
      }

      .rfi-context-section h3{
        margin:0 0 10px;
        color:var(--rfi-text-soft);
        font-size:8px;
        font-weight:750;
        line-height:12px;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfi-context-line{
        min-height:38px;
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rfi-context-line > span{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        flex:0 0 28px;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border-radius:7px;
      }

      .rfi-context-line > div{
        min-width:0;
        display:grid;
        gap:0;
      }

      .rfi-context-line small{
        color:var(--rfi-muted);
        font-size:6px;
        line-height:9px;
      }

      .rfi-context-line strong{
        overflow:hidden;
        color:var(--rfi-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
        line-height:12px;
      }

      .rfi-campaign-context{
        min-height:44px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:7px;
        color:inherit!important;
        background:var(--rfi-low);
        border-radius:8px;
        text-decoration:none;
      }

      .rfi-campaign-context:hover{
        background:var(--rfi-primary-soft);
      }

      .rfi-campaign-context > span{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        flex:0 0 29px;
        color:var(--rfi-primary);
        background:#fff;
        border-radius:7px;
      }

      .rfi-campaign-context > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:0;
      }

      .rfi-campaign-context strong,
      .rfi-campaign-context small{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfi-campaign-context strong{
        color:var(--rfi-text);
        font-size:8px;
        line-height:12px;
      }

      .rfi-campaign-context small{
        color:var(--rfi-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfi-campaign-context > svg{
        color:var(--rfi-muted);
      }

      .rfi-context-activity{
        display:grid;
        gap:3px;
      }

      .rfi-context-activity-row{
        min-height:40px;
        display:flex;
        align-items:flex-start;
        gap:8px;
      }

      .rfi-context-activity-row > span{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        flex:0 0 24px;
        color:var(--rfi-text-soft);
        background:#eef1f5;
        border-radius:50%;
      }

      .rfi-context-activity-row > span.primary{
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
      }

      .rfi-context-activity-row > span.violet{
        color:var(--rfi-violet);
        background:var(--rfi-violet-soft);
      }

      .rfi-context-activity-row > div{
        min-width:0;
        display:grid;
        gap:0;
        padding-top:2px;
      }

      .rfi-context-activity-row strong{
        color:var(--rfi-text);
        font-size:8px;
        line-height:12px;
      }

      .rfi-context-activity-row small{
        color:var(--rfi-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfi-thread-skeleton{
        display:grid;
      }

      .rfi-thread-skeleton > div{
        min-height:104px;
        display:flex;
        gap:10px;
        padding:15px 14px;
        border-bottom:1px solid #eff0f1;
      }

      .rfi-thread-skeleton i{
        display:block;
        background:linear-gradient(90deg,#e9ebed 25%,#f8f9fa 45%,#e9ebed 65%);
        background-size:220% 100%;
        border-radius:999px;
        animation:rfiShimmer 1.25s linear infinite;
      }

      .rfi-thread-skeleton i.avatar{
        width:39px;
        height:39px;
        flex:0 0 39px;
        border-radius:50%;
      }

      .rfi-thread-skeleton > div > span{
        flex:1;
        display:grid;
        align-content:start;
        gap:8px;
      }

      .rfi-thread-skeleton > div > span i:nth-child(1){
        width:62%;
        height:9px;
      }

      .rfi-thread-skeleton > div > span i:nth-child(2){
        width:80%;
        height:8px;
      }

      .rfi-thread-skeleton > div > span i:nth-child(3){
        width:96%;
        height:18px;
        border-radius:5px;
      }

      .rfi-thread-empty,
      .rfi-conversation-empty{
        min-height:100%;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:24px 18px;
        color:var(--rfi-muted);
        text-align:center;
      }

      .rfi-thread-empty > span,
      .rfi-conversation-empty > span{
        width:46px;
        height:46px;
        display:grid;
        place-items:center;
        color:var(--rfi-primary);
        background:var(--rfi-primary-soft);
        border-radius:13px;
      }

      .rfi-thread-empty strong,
      .rfi-conversation-empty h2{
        margin:0;
        color:var(--rfi-text);
        font:600 11px/16px Geist,Inter,sans-serif;
      }

      .rfi-thread-empty p,
      .rfi-conversation-empty p{
        max-width:280px;
        margin:0;
        color:var(--rfi-muted);
        font-size:8px;
        line-height:13px;
      }

      .rfi-thread-empty button,
      .rfi-thread-empty a{
        margin-top:5px;
        padding:5px 8px;
        color:var(--rfi-primary)!important;
        background:transparent;
        border:0;
        text-decoration:none;
        cursor:pointer;
        font-size:8px;
        font-weight:700;
      }

      @media(max-width:1250px){
        .rfi-workspace{
          grid-template-columns:320px minmax(0,1fr);
        }

        .rfi-context-panel{
          display:none;
        }
      }

      @media(max-width:920px){
        .rf-inbox-v7{
          padding:18px 16px 84px;
        }

        .rfi-metrics{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rfi-workspace{
          height:auto;
          min-height:660px;
          grid-template-columns:300px minmax(0,1fr);
        }

        .rfi-bubble-wrap{
          max-width:90%;
        }
      }

      @media(max-width:700px){
        .rf-inbox-v7{
          padding:16px 12px 84px;
        }

        .rfi-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfi-header-actions{
          width:100%;
        }

        .rfi-header-actions .rfi-btn{
          flex:1;
        }

        .rfi-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfi-metrics{
          gap:7px;
        }

        .rfi-metric{
          min-height:61px;
          padding:10px;
        }

        .rfi-workspace{
          height:auto;
          min-height:0;
          display:block;
          overflow:visible;
          background:transparent;
          border:0;
          box-shadow:none;
        }

        .rfi-thread-panel{
          min-height:560px;
          overflow:hidden;
          background:#fff;
          border:1px solid var(--rfi-outline);
          border-radius:13px;
        }

        .rfi-conversation-panel{
          position:fixed;
          z-index:150;
          inset:64px 0 0;
          display:none;
          background:#fff;
        }

        .rfi-conversation-panel.mobile-open{
          display:flex;
        }

        .rfi-mobile-back{
          display:grid;
        }

        .rfi-conversation-head{
          padding:10px 12px;
        }

        .rfi-conversation-scroll{
          padding:16px 12px;
        }

        .rfi-context-summary{
          margin-bottom:16px;
        }

        .rfi-reply-dock{
          align-items:stretch;
          flex-direction:column;
        }

        .rfi-reply-actions{
          width:100%;
        }

        .rfi-reply-actions .rfi-btn{
          flex:1;
        }
      }

      @media(max-width:520px){
        .rfi-metrics{
          grid-template-columns:1fr 1fr;
        }

        .rfi-metric > span{
          width:28px;
          height:28px;
          flex-basis:28px;
        }

        .rfi-filter-tabs{
          grid-template-columns:repeat(4,minmax(62px,1fr));
          overflow:auto;
        }

        .rfi-bubble{
          min-width:0;
        }

        .rfi-bubble-wrap{
          max-width:94%;
        }

        .rfi-mark-read{
          font-size:0;
          width:34px;
          padding:0;
        }

        .rfi-mark-read svg{
          margin:0;
        }

        .rfi-conversation-person p{
          max-width:190px;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-inbox-v7,
        .rfi-thread-row,
        .rfi-bubble-row,
        .rfi-context-summary,
        .rfi-message,
        .rfi-campaign-menu,
        .rfi-thread-skeleton i,
        .rf-inbox-v7 .spin{
          animation:none!important;
        }

        .rf-inbox-v7 *,
        .rf-inbox-v7 *::before,
        .rf-inbox-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
