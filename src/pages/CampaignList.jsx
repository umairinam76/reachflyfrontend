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
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Trash2,
  TrendingUp,
  Users,
  Workflow,
  X,
  Zap,
} from "../components/icons";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  api,
} from "../api";

/**
 * ReachFly.AI V7 Campaigns
 *
 * Design target:
 * - Matches the Stitch "Campaigns" screen while staying inside AppShell.
 * - Uses real ReachFly campaign data only; demo metrics are never fabricated.
 * - Preserves current campaign permissions, import flow, detail flow, pipeline flow,
 *   AI Voice access, deletion, polling, search, and legacy status routes.
 * - Adds polished filtering, pagination, animated feedback, confirmation, responsive
 *   table/card views, and global ReachFly toast integration.
 */

const PAGE_SIZE = 10;

const STATUS_TABS = [
  {
    key: "all",
    label: "All",
    to: "/app/campaigns",
  },
  {
    key: "active",
    label: "Active",
    to: "/app/campaigns/active",
  },
  {
    key: "queued",
    label: "Queued",
    to: "/app/campaigns/queued",
  },
  {
    key: "history",
    label: "History",
    to: "/app/campaigns/history",
  },
];

const CHANNEL_FILTERS = [
  {
    key: "all",
    label: "All channels",
  },
  {
    key: "voice",
    label: "AI Voice",
  },
  {
    key: "email",
    label: "Email",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
  },
  {
    key: "multi",
    label: "Multi-channel",
  },
  {
    key: "imported",
    label: "Imported",
  },
];

const SORT_OPTIONS = [
  {
    key: "newest",
    label: "Newest first",
  },
  {
    key: "oldest",
    label: "Oldest first",
  },
  {
    key: "name",
    label: "Campaign name",
  },
  {
    key: "audience",
    label: "Largest audience",
  },
  {
    key: "meetings",
    label: "Most meetings",
  },
];

export default function CampaignList({
  status = "",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
  } = useAuth();

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    query,
    setQuery,
  ] = useState("");

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
    deletingId,
    setDeletingId,
  ] = useState("");

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const [
    channelFilter,
    setChannelFilter,
  ] = useState("all");

  const [
    sortBy,
    setSortBy,
  ] = useState("newest");

  const [
    page,
    setPage,
  ] = useState(1);

  const role =
    normalizeWorkspaceRole(
      user?.workspaceRole ||
        user?.role ||
        ""
    );

  const canManageCampaignsRole =
    [
      "owner",
      "admin",
      "manager",
    ].includes(role);

  const isPrivilegedAdmin =
    [
      "owner",
      "admin",
    ].includes(role);

  const permissions =
    Array.isArray(
      user?.permissions
    )
      ? user.permissions
      : [];

  const canManageCampaigns =
    canManageCampaignsRole &&
    (
      isPrivilegedAdmin ||
      permissions.includes(
        "manage_campaigns"
      )
    );

  const canDeleteCampaigns =
    canManageCampaignsRole &&
    (
      isPrivilegedAdmin ||
      permissions.includes(
        "manage_campaigns"
      ) ||
      permissions.includes(
        "delete_campaigns"
      )
    );

  const isOverviewRoute =
    normalizePathname(
      location.pathname
    ) === "/app/campaigns";

  /*
   * /app/campaigns is the new Stitch overview and requests every campaign.
   * Legacy status routes keep their existing filtered API behavior.
   */
  const requestedStatus =
    isOverviewRoute
      ? ""
      : String(status || "").trim();

  const activeTab =
    isOverviewRoute
      ? "all"
      : requestedStatus || "all";

  const load =
    useCallback(
      async ({
        silent = false,
        successToast = false,
      } = {}) => {
        if (
          !canManageCampaignsRole
        ) {
          setItems([]);
          setLoading(false);
          return;
        }

        if (!silent) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        try {
          const response =
            await api.campaigns(
              requestedStatus
            );

          const campaigns =
            normalizeCampaignCollection(
              response
            );

          setItems(campaigns);
          setError("");

          if (successToast) {
            notify(
              "success",
              "Campaigns refreshed",
              "Your latest campaign activity is now visible."
            );
          }
        } catch (requestError) {
          const message =
            requestError?.message ||
            "Campaigns could not be loaded.";

          setError(message);

          if (!silent) {
            setItems([]);
          }

          if (successToast) {
            notify(
              "error",
              "Campaign refresh failed",
              message
            );
          }
        } finally {
          if (!silent) {
            setLoading(false);
          }

          setRefreshing(false);
        }
      },
      [
        canManageCampaignsRole,
        requestedStatus,
      ]
    );

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    if (
      !canManageCampaignsRole
    ) {
      navigate(
        "/app/dashboard",
        {
          replace: true,
        }
      );

      return undefined;
    }

    void load();

    const timer =
      window.setInterval(
        () => {
          void load({
            silent: true,
          });
        },
        30_000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    canManageCampaignsRole,
    load,
    navigate,
    user,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    activeTab,
    channelFilter,
    query,
    sortBy,
  ]);

  const filtered =
    useMemo(() => {
      const searchValue =
        query
          .trim()
          .toLowerCase();

      const output =
        items.filter(
          (campaign) => {
            if (
              channelFilter !== "all" &&
              getCampaignChannelKey(
                campaign
              ) !== channelFilter
            ) {
              return false;
            }

            if (!searchValue) {
              return true;
            }

            const searchable = [
              campaign?.name,
              campaign?.niche,
              campaign?.location,
              campaign?.source,
              campaign?.senderEmail,
              campaign?.fromEmail,
              campaign?.selectedSegment,
              campaign?.status,
              campaign?.pipelineStatus,
              campaign?.aiVoiceStatus,
              campaign?.voiceStatus,
              campaign?.ownerName,
              campaign?.owner?.name,
              campaign?.createdByName,
              campaign?.createdBy?.name,
              getCampaignChannelLabel(
                campaign
              ),
              JSON.stringify(
                campaign?.outreachPlan ||
                  {}
              ),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return searchable.includes(
              searchValue
            );
          }
        );

      return output.sort(
        (left, right) => {
          if (sortBy === "name") {
            return String(
              left?.name ||
                ""
            ).localeCompare(
              String(
                right?.name ||
                  ""
              )
            );
          }

          if (
            sortBy ===
            "audience"
          ) {
            return (
              getAudienceCount(
                right
              ) -
              getAudienceCount(
                left
              )
            );
          }

          if (
            sortBy ===
            "meetings"
          ) {
            return (
              getMeetingCount(
                right
              ) -
              getMeetingCount(
                left
              )
            );
          }

          const leftDate =
            getTimestamp(
              left?.createdAt
            );

          const rightDate =
            getTimestamp(
              right?.createdAt
            );

          if (
            sortBy ===
            "oldest"
          ) {
            return (
              leftDate -
              rightDate
            );
          }

          return (
            rightDate -
            leftDate
          );
        }
      );
    }, [
      channelFilter,
      items,
      query,
      sortBy,
    ]);

  const metrics =
    useMemo(
      () =>
        buildCampaignMetrics(
          items
        ),
      [
        items,
      ]
    );

  const pageCount =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
          PAGE_SIZE
      )
    );

  const safePage =
    Math.min(
      page,
      pageCount
    );

  const paginated =
    useMemo(
      () =>
        filtered.slice(
          (
            safePage -
            1
          ) *
            PAGE_SIZE,
          safePage *
            PAGE_SIZE
        ),
      [
        filtered,
        safePage,
      ]
    );

  const rangeStart =
    filtered.length
      ? (
          safePage -
          1
        ) *
          PAGE_SIZE +
        1
      : 0;

  const rangeEnd =
    filtered.length
      ? Math.min(
          safePage *
            PAGE_SIZE,
          filtered.length
        )
      : 0;

  async function removeCampaign() {
    const campaign =
      deleteTarget;

    if (
      !campaign?.id ||
      !canDeleteCampaigns
    ) {
      setDeleteTarget(null);
      return;
    }

    setDeletingId(
      campaign.id
    );

    setError("");

    try {
      await api.deleteCampaign(
        campaign.id
      );

      setItems(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              campaign.id
          )
      );

      setDeleteTarget(
        null
      );

      notify(
        "success",
        "Campaign deleted",
        `${
          campaign.name ||
          "The campaign"
        } and its workspace lead data were removed.`
      );
    } catch (requestError) {
      const message =
        requestError?.message ||
        "The campaign could not be deleted.";

      setError(message);

      notify(
        "error",
        "Campaign deletion failed",
        message
      );
    } finally {
      setDeletingId("");
    }
  }

  function resetFilters() {
    setQuery("");
    setChannelFilter(
      "all"
    );
    setSortBy(
      "newest"
    );
    setFiltersOpen(
      false
    );
  }

  if (
    !canManageCampaignsRole
  ) {
    return (
      <>
        <CampaignListStyles />

        <div className="rf-campaigns-v7">
          <section className="rfc-access-card">
            <span className="rfc-access-icon">
              <Rocket size={24} />
            </span>

            <span className="rfc-eyebrow">
              Restricted workspace feature
            </span>

            <h1>
              Campaign access required
            </h1>

            <p>
              Campaign lists, lead generation, pipeline management, and lead
              assignment are available to workspace owners, administrators,
              and managers.
            </p>

            <button
              type="button"
              className="rfc-btn rfc-btn-primary"
              onClick={() =>
                navigate(
                  "/app/dashboard",
                  {
                    replace: true,
                  }
                )
              }
            >
              Return to dashboard
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <CampaignListStyles />

      <div className="rf-campaigns-v7">
        <header className="rfc-page-header">
          <div className="rfc-title-block">
            <span className="rfc-eyebrow">
              Growth workspace
            </span>

            <h1>
              Campaigns
            </h1>

            <p>
              Manage and track outbound communication across AI Voice, email,
              WhatsApp, and imported lead workflows.
            </p>
          </div>

          <div className="rfc-header-actions">
            <Link
              className="rfc-btn rfc-btn-secondary"
              to="/app/campaigns/external-leads"
            >
              <Users size={16} />
              Import leads
            </Link>

            <Link
              className="rfc-btn rfc-btn-primary"
              to="/app/launch-campaign"
            >
              <Plus size={16} />
              Create Campaign
            </Link>
          </div>
        </header>

        <section
          className="rfc-control-row"
          aria-label="Campaign controls"
        >
          <nav
            className="rfc-tabs"
            aria-label="Campaign status"
          >
            {STATUS_TABS.map(
              (tab) => (
                <Link
                  key={
                    tab.key
                  }
                  className={`rfc-tab ${
                    activeTab ===
                    tab.key
                      ? "active"
                      : ""
                  }`}
                  to={tab.to}
                >
                  {tab.label}

                  {tab.key !==
                  "all" ? (
                    <span>
                      {getTabCount(
                        items,
                        tab.key,
                        activeTab
                      )}
                    </span>
                  ) : null}
                </Link>
              )
            )}
          </nav>

          <div className="rfc-control-actions">
            <label className="rfc-search">
              <Search
                size={17}
                aria-hidden="true"
              />

              <input
                placeholder="Search campaigns..."
                value={query}
                onChange={(
                  event
                ) =>
                  setQuery(
                    event.target
                      .value
                  )
                }
                aria-label="Search campaigns"
              />

              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() =>
                    setQuery("")
                  }
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>

            <div className="rfc-filter-anchor">
              <button
                className={`rfc-btn rfc-btn-secondary ${
                  channelFilter !==
                    "all" ||
                  sortBy !==
                    "newest"
                    ? "active"
                    : ""
                }`}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={
                  filtersOpen
                }
                onClick={() =>
                  setFiltersOpen(
                    (value) =>
                      !value
                  )
                }
              >
                <BarChart3 size={16} />
                Filters
                <ChevronDown size={14} />
              </button>

              {filtersOpen ? (
                <div
                  className="rfc-filter-popover"
                  role="dialog"
                  aria-label="Campaign filters"
                >
                  <div className="rfc-popover-head">
                    <div>
                      <strong>
                        Filter campaigns
                      </strong>
                      <span>
                        Refine the current view
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-label="Close filters"
                      onClick={() =>
                        setFiltersOpen(
                          false
                        )
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="rfc-filter-section">
                    <span className="rfc-filter-label">
                      Channel
                    </span>

                    <div className="rfc-channel-grid">
                      {CHANNEL_FILTERS.map(
                        (filter) => (
                          <button
                            key={
                              filter.key
                            }
                            type="button"
                            className={
                              channelFilter ===
                              filter.key
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setChannelFilter(
                                filter.key
                              )
                            }
                          >
                            {
                              filter.label
                            }
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <label className="rfc-filter-field">
                    <span className="rfc-filter-label">
                      Sort
                    </span>

                    <select
                      value={
                        sortBy
                      }
                      onChange={(
                        event
                      ) =>
                        setSortBy(
                          event
                            .target
                            .value
                        )
                      }
                    >
                      {SORT_OPTIONS.map(
                        (option) => (
                          <option
                            key={
                              option.key
                            }
                            value={
                              option.key
                            }
                          >
                            {
                              option.label
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <div className="rfc-popover-actions">
                    <button
                      className="rfc-btn rfc-btn-ghost"
                      type="button"
                      onClick={
                        resetFilters
                      }
                    >
                      Reset
                    </button>

                    <button
                      className="rfc-btn rfc-btn-primary"
                      type="button"
                      onClick={() =>
                        setFiltersOpen(
                          false
                        )
                      }
                    >
                      Apply filters
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="rfc-icon-btn"
              aria-label="Refresh campaigns"
              title="Refresh campaigns"
              disabled={
                refreshing
              }
              onClick={() =>
                void load({
                  silent: true,
                  successToast: true,
                })
              }
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "spin"
                    : ""
                }
              />
            </button>
          </div>
        </section>

        {error ? (
          <div
            className="rfc-message rfc-message-error"
            role="alert"
          >
            <span className="rfc-message-icon">
              <X size={16} />
            </span>

            <div>
              <strong>
                Campaign data needs attention
              </strong>
              <span>
                {error}
              </span>
            </div>

            <button
              type="button"
              className="rfc-message-action"
              onClick={() =>
                void load({
                  successToast: true,
                })
              }
            >
              Try again
            </button>
          </div>
        ) : null}

        {role ===
          "manager" &&
        !canManageCampaigns ? (
          <div
            className="rfc-message rfc-message-warning"
            role="status"
          >
            <span className="rfc-message-icon">
              <Zap size={16} />
            </span>

            <div>
              <strong>
                View-only campaign access
              </strong>
              <span>
                Your manager account does not currently have the
                manage_campaigns permission. Campaign data remains visible,
                but management actions are limited.
              </span>
            </div>
          </div>
        ) : null}

        <section className="rfc-metrics">
          <MetricCard
            icon={
              <Rocket size={16} />
            }
            label="Active Campaigns"
            value={
              formatCompactNumber(
                metrics.activeCampaigns
              )
            }
            detail={
              metrics.runningCampaigns >
              0
                ? `${metrics.runningCampaigns} running now`
                : "Current workspace"
            }
            tone="primary"
          />

          <MetricCard
            icon={
              <Users size={16} />
            }
            label="Total Audience"
            value={
              formatCompactNumber(
                metrics.audience
              )
            }
            detail={`${formatCompactNumber(
              items.length
            )} campaign${
              items.length === 1
                ? ""
                : "s"
            } loaded`}
            tone="violet"
          />

          <MetricCard
            icon={
              <Calendar size={16} />
            }
            label="Meetings Booked"
            value={
              formatCompactNumber(
                metrics.meetings
              )
            }
            detail={
              metrics.meetings >
              0
                ? "Across campaign leads"
                : "No meetings recorded yet"
            }
            tone="success"
          />

          <MetricCard
            icon={
              <TrendingUp size={16} />
            }
            label="Avg Conversion"
            value={
              metrics.conversion !==
              null
                ? `${formatPercent(
                    metrics.conversion
                  )}%`
                : "—"
            }
            detail="Meetings ÷ audience"
            tone="neutral"
          />
        </section>

        <section className="rfc-table-card">
          <div className="rfc-table-accent" />

          {loading ? (
            <CampaignTableSkeleton />
          ) : filtered.length ===
            0 ? (
            <CampaignEmptyState
              hasQuery={
                Boolean(
                  query.trim()
                )
              }
              hasFilters={
                channelFilter !==
                  "all" ||
                sortBy !==
                  "newest"
              }
              onReset={
                resetFilters
              }
            />
          ) : (
            <>
              <div className="rfc-table-wrap">
                <table className="rfc-table">
                  <thead>
                    <tr>
                      <th className="campaign-name">
                        Campaign Name
                      </th>
                      <th className="center">
                        Channel
                      </th>
                      <th>
                        Status
                      </th>
                      <th className="right">
                        Audience
                      </th>
                      <th className="right">
                        Sent/Dialed
                      </th>
                      <th className="right">
                        Conn/Open
                      </th>
                      <th className="right">
                        Replies
                      </th>
                      <th className="right rfc-highlight-head">
                        Meetings
                      </th>
                      <th className="right">
                        Conv %
                      </th>
                      <th>
                        Owner
                      </th>
                      <th className="right">
                        Created
                      </th>
                      <th
                        className="rfc-action-head"
                        aria-label="Actions"
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {paginated.map(
                      (
                        campaign,
                        index
                      ) => (
                        <CampaignRow
                          key={
                            campaign.id ||
                            `${campaign.name}-${index}`
                          }
                          campaign={
                            campaign
                          }
                          currentUser={
                            user
                          }
                          canManage={
                            canManageCampaigns
                          }
                          canDelete={
                            canDeleteCampaigns
                          }
                          deleting={
                            deletingId ===
                            campaign.id
                          }
                          index={
                            index
                          }
                          onOpen={() =>
                            navigate(
                              `/app/campaigns/${campaign.id}`
                            )
                          }
                          onDelete={() =>
                            setDeleteTarget(
                              campaign
                            )
                          }
                        />
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rfc-mobile-list">
                {paginated.map(
                  (
                    campaign,
                    index
                  ) => (
                    <CampaignMobileCard
                      key={
                        campaign.id ||
                        `${campaign.name}-${index}`
                      }
                      campaign={
                        campaign
                      }
                      currentUser={
                        user
                      }
                      canManage={
                        canManageCampaigns
                      }
                      canDelete={
                        canDeleteCampaigns
                      }
                      deleting={
                        deletingId ===
                        campaign.id
                      }
                      index={
                        index
                      }
                      onOpen={() =>
                        navigate(
                          `/app/campaigns/${campaign.id}`
                        )
                      }
                      onDelete={() =>
                        setDeleteTarget(
                          campaign
                        )
                      }
                    />
                  )
                )}
              </div>

              <footer className="rfc-table-footer">
                <span>
                  Showing{" "}
                  <strong>
                    {rangeStart}
                  </strong>{" "}
                  to{" "}
                  <strong>
                    {rangeEnd}
                  </strong>{" "}
                  of{" "}
                  <strong>
                    {
                      filtered.length
                    }
                  </strong>{" "}
                  campaign
                  {filtered.length ===
                  1
                    ? ""
                    : "s"}
                </span>

                <Pagination
                  page={
                    safePage
                  }
                  pageCount={
                    pageCount
                  }
                  onChange={
                    setPage
                  }
                />
              </footer>
            </>
          )}
        </section>

        {deleteTarget ? (
          <DeleteCampaignDialog
            campaign={
              deleteTarget
            }
            deleting={
              deletingId ===
              deleteTarget.id
            }
            onCancel={() => {
              if (!deletingId) {
                setDeleteTarget(
                  null
                );
              }
            }}
            onConfirm={() =>
              void removeCampaign()
            }
          />
        ) : null}
      </div>
    </>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}) {
  return (
    <article
      className={`rfc-metric rfc-metric-${tone}`}
    >
      <span className="rfc-metric-glow" />

      <div className="rfc-metric-label">
        <span className="rfc-metric-icon">
          {icon}
        </span>

        <span>
          {label}
        </span>
      </div>

      <div className="rfc-metric-value">
        <strong>
          {value}
        </strong>

        <span>
          {detail}
        </span>
      </div>
    </article>
  );
}

function CampaignRow({
  campaign,
  currentUser,
  canManage,
  canDelete,
  deleting,
  index,
  onOpen,
  onDelete,
}) {
  const channel =
    getCampaignChannel(
      campaign
    );

  const status =
    getCampaignStatus(
      campaign
    );

  const audience =
    getAudienceCount(
      campaign
    );

  const sent =
    getSentDialedCount(
      campaign
    );

  const connected =
    getConnectedOpenCount(
      campaign
    );

  const replies =
    getReplyCount(
      campaign
    );

  const meetings =
    getMeetingCount(
      campaign
    );

  const conversion =
    getConversionRate(
      campaign
    );

  const owner =
    getCampaignOwner(
      campaign,
      currentUser
    );

  const subtitle =
    getCampaignSubtitle(
      campaign
    );

  const isReady =
    isPipelineReady(
      campaign
    );

  return (
    <tr
      className={`rfc-row ${
        status.key
      }`}
      style={{
        "--rfc-row-index":
          index,
      }}
      onClick={
        onOpen
      }
    >
      <td className="campaign-name">
        <div className="rfc-campaign-name-cell">
          <span
            className={`rfc-campaign-monogram ${channel.key}`}
            aria-hidden="true"
          >
            {getInitial(
              campaign?.name
            )}
          </span>

          <span className="rfc-campaign-copy">
            <strong>
              {campaign?.name ||
                "Untitled campaign"}
            </strong>

            <small>
              {subtitle}
            </small>
          </span>
        </div>
      </td>

      <td className="center">
        <ChannelIcon
          channel={
            channel
          }
        />
      </td>

      <td>
        <StatusChip
          status={
            status
          }
        />
      </td>

      <td className="right rfc-emphasis">
        {formatNumber(
          audience
        )}
      </td>

      <td className="right">
        {formatMetricCell(
          sent
        )}
      </td>

      <td className="right">
        <MetricWithRate
          value={
            connected
          }
          rate={
            audience >
            0
              ? (
                  connected /
                  audience
                ) *
                100
              : null
          }
          suffix={
            channel.key ===
            "email"
              ? "open"
              : "connected"
          }
        />
      </td>

      <td className="right">
        <MetricWithRate
          value={
            replies
          }
          rate={
            sent > 0
              ? (
                  replies /
                  sent
                ) *
                100
              : null
          }
          suffix="reply"
        />
      </td>

      <td className="right rfc-meetings-cell">
        {formatMetricCell(
          meetings
        )}
      </td>

      <td className="right">
        {conversion !==
        null ? (
          <span
            className={`rfc-conversion ${
              conversion >
              0
                ? "positive"
                : ""
            }`}
          >
            {conversion >
            0 ? (
              <TrendingUp size={13} />
            ) : null}

            {formatPercent(
              conversion
            )}
            %
          </span>
        ) : (
          "—"
        )}
      </td>

      <td>
        <OwnerCell
          owner={
            owner
          }
        />
      </td>

      <td className="right rfc-created-cell">
        {formatDate(
          campaign
            ?.createdAt
        )}
      </td>

      <td
        className="rfc-row-actions"
        onClick={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        <CampaignActions
          campaign={
            campaign
          }
          canManage={
            canManage
          }
          canDelete={
            canDelete
          }
          deleting={
            deleting
          }
          isReady={
            isReady
          }
          onDelete={
            onDelete
          }
        />
      </td>
    </tr>
  );
}

function CampaignMobileCard({
  campaign,
  currentUser,
  canManage,
  canDelete,
  deleting,
  index,
  onOpen,
  onDelete,
}) {
  const channel =
    getCampaignChannel(
      campaign
    );

  const status =
    getCampaignStatus(
      campaign
    );

  const owner =
    getCampaignOwner(
      campaign,
      currentUser
    );

  const audience =
    getAudienceCount(
      campaign
    );

  const meetings =
    getMeetingCount(
      campaign
    );

  const conversion =
    getConversionRate(
      campaign
    );

  const isReady =
    isPipelineReady(
      campaign
    );

  return (
    <article
      className="rfc-mobile-card"
      style={{
        "--rfc-row-index":
          index,
      }}
    >
      <button
        type="button"
        className="rfc-mobile-card-main"
        onClick={
          onOpen
        }
      >
        <span
          className={`rfc-campaign-monogram ${channel.key}`}
        >
          {getInitial(
            campaign?.name
          )}
        </span>

        <span className="rfc-mobile-card-copy">
          <strong>
            {campaign?.name ||
              "Untitled campaign"}
          </strong>

          <small>
            {getCampaignSubtitle(
              campaign
            )}
          </small>
        </span>

        <ChevronRight size={17} />
      </button>

      <div className="rfc-mobile-card-meta">
        <StatusChip
          status={
            status
          }
        />

        <ChannelIcon
          channel={
            channel
          }
          compact
        />

        <OwnerCell
          owner={
            owner
          }
          compact
        />
      </div>

      <div className="rfc-mobile-stats">
        <span>
          <small>
            Audience
          </small>
          <strong>
            {formatNumber(
              audience
            )}
          </strong>
        </span>

        <span>
          <small>
            Meetings
          </small>
          <strong>
            {formatNumber(
              meetings
            )}
          </strong>
        </span>

        <span>
          <small>
            Conversion
          </small>
          <strong>
            {conversion !==
            null
              ? `${formatPercent(
                  conversion
                )}%`
              : "—"}
          </strong>
        </span>
      </div>

      <div className="rfc-mobile-actions">
        <Link
          className="rfc-mobile-link"
          to={`/app/campaigns/${campaign.id}`}
        >
          Open
          <ArrowRight size={14} />
        </Link>

        {isReady &&
        canManage ? (
          <Link
            className="rfc-mobile-link"
            to={`/app/campaigns/${campaign.id}/pipeline`}
          >
            <Workflow size={14} />
            Pipeline
          </Link>
        ) : null}

        {isAiVoiceEnabled(
          campaign
        ) ? (
          <Link
            className="rfc-mobile-link"
            to="/app/voice-agents"
          >
            <Phone size={14} />
            Voice
          </Link>
        ) : null}

        {canDelete ? (
          <button
            className="rfc-mobile-delete"
            type="button"
            disabled={
              deleting
            }
            onClick={
              onDelete
            }
          >
            <Trash2 size={14} />
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}

function CampaignActions({
  campaign,
  canManage,
  canDelete,
  deleting,
  isReady,
  onDelete,
}) {
  return (
    <details className="rfc-actions-menu">
      <summary
        aria-label={`Actions for ${
          campaign?.name ||
          "campaign"
        }`}
      >
        <span aria-hidden="true">
          •••
        </span>
      </summary>

      <div className="rfc-actions-popover">
        <Link
          to={`/app/campaigns/${campaign.id}`}
        >
          <ArrowRight size={14} />
          Open campaign
        </Link>

        {isReady &&
        canManage ? (
          <Link
            to={`/app/campaigns/${campaign.id}/pipeline`}
          >
            <Workflow size={14} />
            Pipeline
          </Link>
        ) : null}

        {isAiVoiceEnabled(
          campaign
        ) ? (
          <Link to="/app/voice-agents">
            <Phone size={14} />
            Voice Agent
          </Link>
        ) : null}

        {canDelete ? (
          <>
            <span className="rfc-menu-divider" />

            <button
              type="button"
              className="danger"
              disabled={
                deleting
              }
              onClick={
                onDelete
              }
            >
              <Trash2 size={14} />
              {deleting
                ? "Deleting..."
                : "Delete campaign"}
            </button>
          </>
        ) : null}
      </div>
    </details>
  );
}

function StatusChip({
  status,
}) {
  return (
    <span
      className={`rfc-status rfc-status-${status.tone}`}
    >
      {status.pulse ? (
        <i />
      ) : null}

      {status.label}
    </span>
  );
}

function ChannelIcon({
  channel,
  compact = false,
}) {
  const Icon =
    channel.icon;

  return (
    <span
      className={`rfc-channel-icon ${channel.key} ${
        compact
          ? "compact"
          : ""
      }`}
      title={
        channel.label
      }
      aria-label={
        channel.label
      }
    >
      <Icon size={compact ? 14 : 17} />
    </span>
  );
}

function OwnerCell({
  owner,
  compact = false,
}) {
  return (
    <span
      className={`rfc-owner ${
        compact
          ? "compact"
          : ""
      }`}
    >
      <i>
        {getInitials(
          owner.name
        )}
      </i>

      {!compact ? (
        <span>
          {owner.name}
        </span>
      ) : null}
    </span>
  );
}

function MetricWithRate({
  value,
  rate,
  suffix,
}) {
  if (
    !Number.isFinite(
      Number(value)
    ) ||
    Number(value) <=
      0
  ) {
    return "—";
  }

  return (
    <span className="rfc-stacked-metric">
      <strong>
        {formatNumber(
          value
        )}
      </strong>

      {rate !==
      null ? (
        <small>
          {formatPercent(
            rate
          )}
          % {suffix}
        </small>
      ) : null}
    </span>
  );
}

function Pagination({
  page,
  pageCount,
  onChange,
}) {
  if (
    pageCount <= 1
  ) {
    return null;
  }

  const pages =
    buildPagination(
      page,
      pageCount
    );

  return (
    <nav
      className="rfc-pagination"
      aria-label="Campaign pages"
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={
          page <= 1
        }
        onClick={() =>
          onChange(
            Math.max(
              1,
              page - 1
            )
          )
        }
      >
        ‹
      </button>

      {pages.map(
        (
          item,
          index
        ) =>
          item ===
          "…" ? (
            <span
              className="rfc-pagination-ellipsis"
              key={`ellipsis-${index}`}
            >
              …
            </span>
          ) : (
            <button
              key={
                item
              }
              type="button"
              className={
                item ===
                page
                  ? "active"
                  : ""
              }
              aria-current={
                item ===
                page
                  ? "page"
                  : undefined
              }
              onClick={() =>
                onChange(
                  item
                )
              }
            >
              {item}
            </button>
          )
      )}

      <button
        type="button"
        aria-label="Next page"
        disabled={
          page >=
          pageCount
        }
        onClick={() =>
          onChange(
            Math.min(
              pageCount,
              page + 1
            )
          )
        }
      >
        ›
      </button>
    </nav>
  );
}

function CampaignTableSkeleton() {
  return (
    <div
      className="rfc-skeleton"
      aria-label="Loading campaigns"
      aria-busy="true"
    >
      <div className="rfc-skeleton-head">
        {Array.from({
          length: 8,
        }).map(
          (
            _,
            index
          ) => (
            <i
              key={
                index
              }
            />
          )
        )}
      </div>

      {Array.from({
        length: 6,
      }).map(
        (
          _,
          row
        ) => (
          <div
            className="rfc-skeleton-row"
            key={
              row
            }
          >
            <i className="wide" />
            <i />
            <i />
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

function CampaignEmptyState({
  hasQuery,
  hasFilters,
  onReset,
}) {
  return (
    <div className="rfc-empty">
      <span className="rfc-empty-icon">
        <Rocket size={27} />
      </span>

      <h2>
        {hasQuery ||
        hasFilters
          ? "No matching campaigns"
          : "Create your first outreach campaign"}
      </h2>

      <p>
        {hasQuery ||
        hasFilters
          ? "Try another search, channel, or sorting option."
          : "Build a campaign from your ReachFly lead workflow, import a list, or start a new prospect search."}
      </p>

      <div className="rfc-empty-actions">
        {hasQuery ||
        hasFilters ? (
          <button
            type="button"
            className="rfc-btn rfc-btn-secondary"
            onClick={
              onReset
            }
          >
            Reset filters
          </button>
        ) : (
          <>
            <Link
              className="rfc-btn rfc-btn-secondary"
              to="/app/campaigns/external-leads"
            >
              Import leads
            </Link>

            <Link
              className="rfc-btn rfc-btn-primary"
              to="/app/launch-campaign"
            >
              <Plus size={16} />
              Create Campaign
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function DeleteCampaignDialog({
  campaign,
  deleting,
  onCancel,
  onConfirm,
}) {
  return (
    <div
      className="rfc-modal-backdrop"
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !deleting
        ) {
          onCancel();
        }
      }}
    >
      <section
        className="rfc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rfc-delete-title"
      >
        <div className="rfc-modal-icon danger">
          <Trash2 size={21} />
        </div>

        <div className="rfc-modal-copy">
          <span className="rfc-eyebrow">
            Destructive action
          </span>

          <h2 id="rfc-delete-title">
            Delete campaign?
          </h2>

          <p>
            <strong>
              {campaign?.name ||
                "This campaign"}
            </strong>{" "}
            and its campaign lead data will be deleted. This action cannot be
            undone.
          </p>
        </div>

        <div className="rfc-modal-actions">
          <button
            type="button"
            className="rfc-btn rfc-btn-secondary"
            disabled={
              deleting
            }
            onClick={
              onCancel
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="rfc-btn rfc-btn-danger"
            disabled={
              deleting
            }
            onClick={
              onConfirm
            }
          >
            {deleting ? (
              <RefreshCw
                size={15}
                className="spin"
              />
            ) : (
              <Trash2 size={15} />
            )}

            {deleting
              ? "Deleting..."
              : "Delete campaign"}
          </button>
        </div>
      </section>
    </div>
  );
}

/* ==========================================================================
 * Data adapters
 * ======================================================================= */

function normalizeCampaignCollection(
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
      response?.campaigns
    )
  ) {
    return response.campaigns;
  }

  if (
    Array.isArray(
      response?.items
    )
  ) {
    return response.items;
  }

  return [];
}

function buildCampaignMetrics(
  campaigns
) {
  let activeCampaigns =
    0;

  let runningCampaigns =
    0;

  let audience =
    0;

  let meetings =
    0;

  for (const campaign of campaigns) {
    const status =
      getCampaignStatus(
        campaign
      );

    if (
      [
        "active",
        "running",
        "ready",
      ].includes(
        status.key
      )
    ) {
      activeCampaigns += 1;
    }

    if (
      status.key ===
      "running"
    ) {
      runningCampaigns += 1;
    }

    audience +=
      getAudienceCount(
        campaign
      );

    meetings +=
      getMeetingCount(
        campaign
      );
  }

  const conversion =
    audience > 0
      ? (
          meetings /
          audience
        ) *
        100
      : null;

  return {
    activeCampaigns,
    runningCampaigns,
    audience,
    meetings,
    conversion,
  };
}

function getCampaignChannel(
  campaign
) {
  const channelKey =
    getCampaignChannelKey(
      campaign
    );

  if (
    channelKey ===
    "voice"
  ) {
    return {
      key: "voice",
      label: "AI Voice",
      icon: Phone,
    };
  }

  if (
    channelKey ===
    "email"
  ) {
    return {
      key: "email",
      label: "Email",
      icon: Mail,
    };
  }

  if (
    channelKey ===
    "whatsapp"
  ) {
    return {
      key: "whatsapp",
      label: "WhatsApp",
      icon: Zap,
    };
  }

  if (
    channelKey ===
    "multi"
  ) {
    return {
      key: "multi",
      label: "Multi-channel",
      icon: Workflow,
    };
  }

  if (
    channelKey ===
    "imported"
  ) {
    return {
      key: "imported",
      label: "Imported list",
      icon: Users,
    };
  }

  return {
    key: "none",
    label: "Not configured",
    icon: Workflow,
  };
}

function getCampaignChannelKey(
  campaign
) {
  const isImported =
    campaign?.source ===
      "external-import" ||
    campaign?.externalImport ===
      true;

  const voice =
    isAiVoiceEnabled(
      campaign
    );

  const email =
    Boolean(
      getSenderEmail(
        campaign
      ) ||
        campaign?.outreachPlan
          ?.email ||
        campaign?.emailEnabled ||
        campaign?.channels?.includes?.(
          "email"
        )
    );

  const whatsapp =
    Boolean(
      campaign?.outreachPlan
        ?.whatsapp ||
        campaign?.whatsappEnabled ||
        campaign?.channels?.includes?.(
          "whatsapp"
        )
    );

  const enabled =
    [
      voice,
      email,
      whatsapp,
    ].filter(Boolean)
      .length;

  if (
    enabled > 1
  ) {
    return "multi";
  }

  if (voice) {
    return "voice";
  }

  if (email) {
    return "email";
  }

  if (whatsapp) {
    return "whatsapp";
  }

  if (isImported) {
    return "imported";
  }

  return "none";
}

function getCampaignChannelLabel(
  campaign
) {
  return getCampaignChannel(
    campaign
  ).label;
}

function getCampaignStatus(
  campaign
) {
  const pipeline =
    normalizeStatus(
      campaign?.pipelineStatus
    );

  const status =
    normalizeStatus(
      campaign?.status
    );

  if (
    [
      "running",
      "discovering",
      "processing",
    ].includes(pipeline)
  ) {
    return {
      key: "running",
      label:
        pipeline ===
        "discovering"
          ? "Discovering"
          : "Active",
      tone: "success",
      pulse: true,
    };
  }

  if (
    pipeline ===
    "failed" ||
    status ===
    "failed"
  ) {
    return {
      key: "failed",
      label: "Failed",
      tone: "danger",
      pulse: false,
    };
  }

  if (
    [
      "paused",
      "stopped",
    ].includes(
      status
    ) ||
    pipeline ===
      "stopped"
  ) {
    return {
      key: "paused",
      label: "Paused",
      tone: "paused",
      pulse: false,
    };
  }

  if (
    [
      "draft",
      "created",
    ].includes(status)
  ) {
    return {
      key: "draft",
      label: "Draft",
      tone: "neutral",
      pulse: false,
    };
  }

  if (
    [
      "complete",
      "completed",
    ].includes(
      pipeline
    ) ||
    [
      "history",
      "complete",
      "completed",
    ].includes(status)
  ) {
    return {
      key: "complete",
      label: "Complete",
      tone: "complete",
      pulse: false,
    };
  }

  if (
    status ===
      "queued" ||
    pipeline ===
      "queued"
  ) {
    return {
      key: "queued",
      label: "Queued",
      tone: "queued",
      pulse: false,
    };
  }

  if (
    status ===
      "active"
  ) {
    return {
      key: "active",
      label: "Active",
      tone: "success",
      pulse: true,
    };
  }

  if (
    isPipelineReady(
      campaign
    )
  ) {
    return {
      key: "ready",
      label: "Ready",
      tone: "success",
      pulse: false,
    };
  }

  return {
    key:
      status ||
      pipeline ||
      "active",
    label: titleCase(
      status ||
        pipeline ||
        "Active"
    ),
    tone: "neutral",
    pulse: false,
  };
}

function getCampaignSubtitle(
  campaign
) {
  const pieces = [];

  if (
    campaign?.niche
  ) {
    pieces.push(
      campaign.niche
    );
  }

  if (
    campaign?.location
  ) {
    pieces.push(
      campaign.location
    );
  }

  if (
    campaign?.radiusKm &&
    !campaign?.externalImport
  ) {
    pieces.push(
      `${campaign.radiusKm} km`
    );
  }

  if (
    campaign?.selectedSegment
  ) {
    pieces.push(
      campaign.selectedSegment
    );
  }

  if (
    pieces.length
  ) {
    return pieces.join(
      " · "
    );
  }

  if (
    campaign?.source ===
      "external-import" ||
    campaign?.externalImport ===
      true
  ) {
    return "Imported lead workflow";
  }

  const sender =
    getSenderEmail(
      campaign
    );

  if (sender) {
    return `Outreach from ${sender}`;
  }

  return "ReachFly outbound campaign";
}

function getAudienceCount(
  campaign
) {
  const leads =
    Array.isArray(
      campaign?.leads
    )
      ? campaign.leads
      : [];

  return firstFiniteNumber(
    campaign?.audienceCount,
    campaign?.audience,
    campaign?.leadCount,
    campaign?.totalLeads,
    campaign?.leadMeta
      ?.totalRows,
    campaign?.leadMeta
      ?.requested,
    campaign?.progress
      ?.total,
    leads.length
  );
}

function getSentDialedCount(
  campaign
) {
  const leads =
    Array.isArray(
      campaign?.leads
    )
      ? campaign.leads
      : [];

  const derived =
    leads.filter(
      (lead) =>
        Boolean(
          lead?.emailSentAt ||
            lead?.sentAt ||
            lead?.callStartedAt ||
            lead?.lastCallAt ||
            lead?.aiCall ||
            lead?.lastCall ||
            lead?.latestCall ||
            lead?.callStatus
        )
    ).length;

  return firstFiniteNumber(
    campaign?.sent,
    campaign?.sentCount,
    campaign?.dialed,
    campaign?.dialedCount,
    campaign
      ?.outreachProgress
      ?.sent,
    campaign
      ?.outreachProgress
      ?.processed,
    campaign?.progress
      ?.processed,
    derived
  );
}

function getConnectedOpenCount(
  campaign
) {
  const leads =
    Array.isArray(
      campaign?.leads
    )
      ? campaign.leads
      : [];

  const voiceDerived =
    leads.filter(
      (lead) =>
        [
          "connected",
          "qualified",
          "interested",
          "meeting_booked",
        ].includes(
          getLeadOutcome(
            lead
          )
        )
    ).length;

  const emailDerived =
    leads.filter(
      (lead) =>
        Boolean(
          lead?.openedAt ||
            lead?.emailOpenedAt ||
            lead?.lastOpenedAt
        )
    ).length;

  const useEmail =
    getCampaignChannelKey(
      campaign
    ) === "email";

  return firstFiniteNumber(
    campaign?.connected,
    campaign
      ?.connectedCount,
    campaign?.openCount,
    campaign?.opened,
    campaign?.openedCount,
    campaign
      ?.outreachProgress
      ?.connected,
    campaign
      ?.outreachProgress
      ?.opened,
    useEmail
      ? emailDerived
      : voiceDerived
  );
}

function getReplyCount(
  campaign
) {
  const leads =
    Array.isArray(
      campaign?.leads
    )
      ? campaign.leads
      : [];

  const derived =
    leads.filter(
      (lead) =>
        Boolean(
          lead?.repliedAt ||
            lead?.replyAt ||
            lead?.reply ||
            lead?.hasReplied ||
            [
              "replied",
              "interested",
              "qualified",
              "meeting_booked",
            ].includes(
              getLeadOutcome(
                lead
              )
            )
        )
    ).length;

  return firstFiniteNumber(
    campaign?.replies,
    campaign?.replyCount,
    campaign
      ?.outreachProgress
      ?.replies,
    derived
  );
}

function getMeetingCount(
  campaign
) {
  const leads =
    Array.isArray(
      campaign?.leads
    )
      ? campaign.leads
      : [];

  const derived =
    leads.filter(
      (lead) =>
        getLeadOutcome(
          lead
        ) ===
          "meeting_booked" ||
        Boolean(
          lead?.meetingId ||
            lead?.meeting
              ?.id ||
            lead
              ?.meetingBookedAt
        )
    ).length;

  return firstFiniteNumber(
    campaign?.meetings,
    campaign?.meetingCount,
    campaign
      ?.meetingsBooked,
    campaign
      ?.outreachProgress
      ?.meetings,
    derived
  );
}

function getConversionRate(
  campaign
) {
  const direct =
    firstFiniteNumberOrNull(
      campaign?.conversionRate,
      campaign
        ?.conversionPercent,
      campaign?.conversion,
      campaign
        ?.outreachProgress
        ?.conversionRate
    );

  if (
    direct !== null
  ) {
    return direct;
  }

  const audience =
    getAudienceCount(
      campaign
    );

  const meetings =
    getMeetingCount(
      campaign
    );

  if (
    audience <= 0
  ) {
    return null;
  }

  return (
    meetings /
    audience
  ) * 100;
}

function getCampaignOwner(
  campaign,
  currentUser
) {
  const name =
    campaign?.ownerName ||
    campaign?.owner?.name ||
    campaign?.createdByName ||
    campaign?.createdBy?.name ||
    campaign?.managerName ||
    currentUser?.name ||
    currentUser?.email ||
    "Workspace";

  return {
    name: String(name),
  };
}

function isPipelineReady(
  campaign
) {
  const leadCount =
    getAudienceCount(
      campaign
    );

  const pipelineStatus =
    normalizeStatus(
      campaign?.pipelineStatus
    );

  return (
    leadCount > 0 &&
    ![
      "discovering",
      "running",
      "failed",
    ].includes(
      pipelineStatus
    )
  );
}

function isAiVoiceEnabled(
  campaign
) {
  return Boolean(
    campaign
      ?.outreachPlan
      ?.aiVoice ||
      campaign
        ?.aiVoiceEnabled ||
      campaign
        ?.voiceEnabled ||
      campaign
        ?.voiceCampaignEnabled ||
      campaign?.channels?.includes?.(
        "ai_voice"
      )
  );
}

function getSenderEmail(
  campaign
) {
  return (
    campaign?.senderEmail ||
    campaign?.fromEmail ||
    campaign
      ?.replyToEmail ||
    campaign?.email ||
    ""
  );
}

function getLeadOutcome(
  lead = {}
) {
  const value =
    lead.lastCallOutcome ||
    lead.callOutcome ||
    lead.outcome ||
    lead.disposition ||
    lead.lastDisposition ||
    lead.voiceOutcome ||
    lead.aiCall?.outcome ||
    lead.lastCall?.outcome ||
    lead.latestCall
      ?.outcome ||
    lead.status ||
    "new";

  return normalizeStatus(
    value
  );
}

function getTabCount(
  campaigns,
  key,
  activeTab
) {
  /*
   * Exact filtered endpoints do not necessarily return counts for other tabs.
   * Show the current count only when it is truthful; otherwise use no badge.
   */
  if (
    activeTab !==
      "all" &&
    activeTab !==
      key
  ) {
    return "";
  }

  if (
    activeTab ===
    key
  ) {
    return campaigns.length;
  }

  if (
    activeTab ===
    "all"
  ) {
    if (
      key ===
      "active"
    ) {
      return campaigns.filter(
        (campaign) =>
          [
            "active",
            "running",
            "ready",
          ].includes(
            getCampaignStatus(
              campaign
            ).key
          )
      ).length;
    }

    if (
      key ===
      "queued"
    ) {
      return campaigns.filter(
        (campaign) =>
          getCampaignStatus(
            campaign
          ).key ===
          "queued"
      ).length;
    }

    if (
      key ===
      "history"
    ) {
      return campaigns.filter(
        (campaign) =>
          [
            "complete",
            "failed",
          ].includes(
            getCampaignStatus(
              campaign
            ).key
          )
      ).length;
    }
  }

  return "";
}

function buildPagination(
  page,
  count
) {
  if (
    count <= 7
  ) {
    return Array.from(
      {
        length: count,
      },
      (
        _,
        index
      ) => index + 1
    );
  }

  const result = [
    1,
  ];

  const start =
    Math.max(
      2,
      page - 1
    );

  const end =
    Math.min(
      count - 1,
      page + 1
    );

  if (
    start > 2
  ) {
    result.push(
      "…"
    );
  }

  for (
    let value =
      start;
    value <=
    end;
    value += 1
  ) {
    result.push(
      value
    );
  }

  if (
    end <
    count - 1
  ) {
    result.push(
      "…"
    );
  }

  result.push(
    count
  );

  return result;
}

function firstFiniteNumber(
  ...values
) {
  for (const value of values) {
    const number =
      Number(value);

    if (
      Number.isFinite(
        number
      ) &&
      number >= 0
    ) {
      return number;
    }
  }

  return 0;
}

function firstFiniteNumberOrNull(
  ...values
) {
  for (const value of values) {
    if (
      value ===
        "" ||
      value ===
        null ||
      value ===
        undefined
    ) {
      continue;
    }

    const number =
      Number(value);

    if (
      Number.isFinite(
        number
      )
    ) {
      return number;
    }
  }

  return null;
}

function formatMetricCell(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    return "—";
  }

  return formatNumber(
    number
  );
}

function formatNumber(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "—";
  }

  return new Intl.NumberFormat().format(
    Math.round(
      number
    )
  );
}

function formatCompactNumber(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0";
  }

  if (
    Math.abs(
      number
    ) <
    1000
  ) {
    return formatNumber(
      number
    );
  }

  return new Intl.NumberFormat(
    undefined,
    {
      notation:
        "compact",
      maximumFractionDigits:
        1,
    }
  ).format(
    number
  );
}

function formatPercent(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0";
  }

  if (
    number >= 10
  ) {
    return number.toFixed(
      1
    );
  }

  return number.toFixed(
    1
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  const sameYear =
    date.getFullYear() ===
    new Date().getFullYear();

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year:
        sameYear
          ? undefined
          : "numeric",
    }
  );
}

function getTimestamp(
  value
) {
  if (!value) {
    return 0;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();
}

function getInitial(
  value
) {
  const string =
    String(
      value ||
      "C"
    ).trim();

  return (
    string[0] ||
    "C"
  ).toUpperCase();
}

function getInitials(
  value
) {
  return String(
    value ||
      "RF"
  )
    .trim()
    .split(/\s+/)
    .slice(
      0,
      2
    )
    .map(
      (part) =>
        part[0]?.toUpperCase()
    )
    .join("");
}

function normalizeStatus(
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

function normalizeWorkspaceRole(
  value
) {
  const role =
    normalizeStatus(
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
      "sales_representative"
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

  return (
    role ||
    "caller"
  );
}

function normalizePathname(
  value
) {
  const path =
    String(
      value ||
      "/"
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  return path ||
    "/";
}

function titleCase(
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
      (
        character
      ) =>
        character.toUpperCase()
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
    bridge[type](
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
 * Scoped Stitch design / animation layer
 * ======================================================================= */

function CampaignListStyles() {
  return (
    <style>{`
      .rf-campaigns-v7{
        --rfc-bg:#f8f9fa;
        --rfc-card:#fff;
        --rfc-card-soft:#f3f4f5;
        --rfc-card-high:#e7e8e9;
        --rfc-text:#191c1d;
        --rfc-text-soft:#464554;
        --rfc-muted:#767586;
        --rfc-outline:#e5e7eb;
        --rfc-outline-strong:#c7c4d7;
        --rfc-primary:#4648d4;
        --rfc-primary-dark:#3537bb;
        --rfc-primary-soft:#eeeeff;
        --rfc-violet:#6b38d4;
        --rfc-violet-soft:#f2edff;
        --rfc-success:#059669;
        --rfc-success-soft:#e9f8f2;
        --rfc-danger:#ba1a1a;
        --rfc-danger-soft:#ffedeb;
        --rfc-warning:#9a6700;
        --rfc-warning-soft:#fff6d8;
        --rfc-info:#4263d6;
        --rfc-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:28px 32px 40px;
        color:var(--rfc-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfcPageIn 300ms var(--rfc-ease);
      }

      .rf-campaigns-v7 *,
      .rf-campaigns-v7 *::before,
      .rf-campaigns-v7 *::after{
        box-sizing:border-box;
      }

      .rf-campaigns-v7 a{
        color:inherit;
      }

      @keyframes rfcPageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfcMetricIn{
        from{opacity:0;transform:translate3d(0,8px,0) scale(.985)}
        to{opacity:1;transform:translate3d(0,0,0) scale(1)}
      }

      @keyframes rfcRowIn{
        from{opacity:0;transform:translate3d(0,5px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfcPopoverIn{
        from{opacity:0;transform:translate3d(0,-5px,0) scale(.985)}
        to{opacity:1;transform:translate3d(0,0,0) scale(1)}
      }

      @keyframes rfcModalIn{
        from{opacity:0;transform:translate3d(0,12px,0) scale(.975)}
        to{opacity:1;transform:translate3d(0,0,0) scale(1)}
      }

      @keyframes rfcBackdropIn{
        from{opacity:0}
        to{opacity:1}
      }

      @keyframes rfcPulse{
        0%,100%{opacity:1;transform:scale(1)}
        50%{opacity:.48;transform:scale(.78)}
      }

      @keyframes rfcShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      @keyframes rfcSpin{
        to{transform:rotate(360deg)}
      }

      .rf-campaigns-v7 .spin{
        animation:rfcSpin 800ms linear infinite;
      }

      .rfc-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:24px;
        margin-bottom:22px;
      }

      .rfc-title-block{
        min-width:0;
        max-width:720px;
      }

      .rfc-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfc-primary);
        font-size:11px;
        font-weight:700;
        line-height:16px;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfc-title-block h1,
      .rfc-access-card h1{
        margin:0;
        color:var(--rfc-text);
        font-family:Geist,Inter,sans-serif;
        font-size:32px;
        font-weight:600;
        line-height:40px;
        letter-spacing:-.02em;
      }

      .rfc-title-block p,
      .rfc-access-card p{
        margin:7px 0 0;
        color:var(--rfc-text-soft);
        font-size:14px;
        line-height:20px;
      }

      .rfc-header-actions,
      .rfc-control-actions,
      .rfc-empty-actions,
      .rfc-modal-actions{
        display:flex;
        align-items:center;
        gap:10px;
      }

      .rfc-btn{
        appearance:none;
        min-height:40px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:8px 14px;
        border:1px solid transparent;
        border-radius:8px;
        text-decoration:none;
        white-space:nowrap;
        cursor:pointer;
        font:600 13px/18px Inter,sans-serif;
        transition:
          transform 150ms var(--rfc-ease),
          box-shadow 150ms var(--rfc-ease),
          background 150ms var(--rfc-ease),
          border-color 150ms var(--rfc-ease),
          color 150ms var(--rfc-ease);
      }

      .rfc-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfc-btn:active:not(:disabled){
        transform:translateY(0) scale(.985);
      }

      .rfc-btn:focus-visible,
      .rfc-icon-btn:focus-visible,
      .rfc-tab:focus-visible,
      .rfc-search input:focus-visible,
      .rfc-filter-popover button:focus-visible,
      .rfc-filter-popover select:focus-visible,
      .rfc-pagination button:focus-visible,
      .rfc-actions-menu summary:focus-visible{
        outline:3px solid rgba(70,72,212,.18);
        outline-offset:2px;
      }

      .rfc-btn:disabled,
      .rfc-icon-btn:disabled{
        opacity:.55;
        cursor:not-allowed;
      }

      .rfc-btn-primary{
        color:#fff!important;
        background:var(--rfc-primary);
        border-color:var(--rfc-primary);
        box-shadow:0 5px 14px rgba(70,72,212,.18);
      }

      .rfc-btn-primary:hover:not(:disabled){
        background:var(--rfc-primary-dark);
        border-color:var(--rfc-primary-dark);
        box-shadow:0 8px 18px rgba(70,72,212,.22);
      }

      .rfc-btn-secondary{
        color:var(--rfc-text)!important;
        background:#fff;
        border-color:var(--rfc-outline);
        box-shadow:0 1px 2px rgba(0,0,0,.025);
      }

      .rfc-btn-secondary:hover:not(:disabled),
      .rfc-btn-secondary.active{
        color:var(--rfc-primary)!important;
        background:var(--rfc-primary-soft);
        border-color:rgba(70,72,212,.22);
      }

      .rfc-btn-ghost{
        color:var(--rfc-text-soft);
        background:transparent;
      }

      .rfc-btn-danger{
        color:#fff;
        background:var(--rfc-danger);
        border-color:var(--rfc-danger);
      }

      .rfc-header-actions .rfc-btn-primary{
        min-width:136px;
      }

      .rfc-control-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        margin-bottom:20px;
      }

      .rfc-tabs{
        min-width:0;
        display:flex;
        align-items:center;
        gap:4px;
        padding:4px;
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:10px;
        box-shadow:0 1px 2px rgba(0,0,0,.025);
      }

      .rfc-tab{
        min-height:32px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:6px 10px;
        color:var(--rfc-text-soft)!important;
        border-radius:7px;
        text-decoration:none;
        font-size:12px;
        font-weight:600;
        line-height:18px;
        transition:
          color 150ms var(--rfc-ease),
          background 150ms var(--rfc-ease),
          transform 150ms var(--rfc-ease);
      }

      .rfc-tab:hover{
        color:var(--rfc-primary)!important;
        background:var(--rfc-primary-soft);
      }

      .rfc-tab.active{
        color:#fff!important;
        background:var(--rfc-primary);
        box-shadow:0 3px 9px rgba(70,72,212,.18);
      }

      .rfc-tab:active{
        transform:scale(.98);
      }

      .rfc-tab span{
        min-width:18px;
        height:18px;
        display:grid;
        place-items:center;
        padding:0 5px;
        color:inherit;
        background:rgba(255,255,255,.14);
        border-radius:999px;
        font-size:9px;
        font-weight:700;
      }

      .rfc-control-actions{
        min-width:0;
        justify-content:flex-end;
      }

      .rfc-search{
        width:min(340px,34vw);
        min-height:40px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 11px;
        color:var(--rfc-muted);
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:10px;
        transition:
          border-color 150ms var(--rfc-ease),
          box-shadow 150ms var(--rfc-ease);
      }

      .rfc-search:focus-within{
        border-color:rgba(70,72,212,.48);
        box-shadow:0 0 0 3px rgba(70,72,212,.10);
      }

      .rfc-search input{
        min-width:0;
        flex:1;
        height:38px;
        padding:0;
        color:var(--rfc-text);
        background:transparent;
        border:0;
        outline:0;
        font:400 13px/20px Inter,sans-serif;
      }

      .rfc-search input::placeholder{
        color:#92909f;
      }

      .rfc-search button,
      .rfc-popover-head button{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        flex:0 0 27px;
        padding:0;
        color:var(--rfc-muted);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
      }

      .rfc-search button:hover,
      .rfc-popover-head button:hover{
        color:var(--rfc-text);
        background:var(--rfc-card-soft);
      }

      .rfc-icon-btn{
        width:40px;
        height:40px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfc-text-soft);
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:9px;
        cursor:pointer;
        transition:
          color 150ms var(--rfc-ease),
          background 150ms var(--rfc-ease),
          transform 150ms var(--rfc-ease);
      }

      .rfc-icon-btn:hover:not(:disabled){
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
        transform:translateY(-1px);
      }

      .rfc-filter-anchor{
        position:relative;
      }

      .rfc-filter-popover{
        position:absolute;
        z-index:45;
        top:48px;
        right:0;
        width:min(350px,calc(100vw - 32px));
        padding:16px;
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:14px;
        box-shadow:
          0 18px 45px rgba(25,28,29,.12),
          0 4px 10px rgba(25,28,29,.06);
        animation:rfcPopoverIn 180ms var(--rfc-ease);
      }

      .rfc-popover-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding-bottom:13px;
        margin-bottom:14px;
        border-bottom:1px solid var(--rfc-outline);
      }

      .rfc-popover-head > div{
        display:grid;
        gap:2px;
      }

      .rfc-popover-head strong{
        color:var(--rfc-text);
        font:600 13px/18px Geist,Inter,sans-serif;
      }

      .rfc-popover-head span{
        color:var(--rfc-muted);
        font-size:11px;
        line-height:16px;
      }

      .rfc-filter-section{
        display:grid;
        gap:8px;
        margin-bottom:15px;
      }

      .rfc-filter-label{
        color:var(--rfc-text-soft);
        font-size:10px;
        font-weight:700;
        line-height:14px;
        letter-spacing:.05em;
        text-transform:uppercase;
      }

      .rfc-channel-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:7px;
      }

      .rfc-channel-grid button{
        min-height:34px;
        padding:6px 9px;
        color:var(--rfc-text-soft);
        background:var(--rfc-card-soft);
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        text-align:left;
        font:600 11px/16px Inter,sans-serif;
        transition:
          color 140ms var(--rfc-ease),
          background 140ms var(--rfc-ease),
          border-color 140ms var(--rfc-ease);
      }

      .rfc-channel-grid button:hover,
      .rfc-channel-grid button.active{
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
        border-color:rgba(70,72,212,.18);
      }

      .rfc-filter-field{
        display:grid;
        gap:7px;
      }

      .rfc-filter-field select{
        width:100%;
        height:40px;
        padding:0 11px;
        color:var(--rfc-text);
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:8px;
        outline:0;
        font:400 12px/18px Inter,sans-serif;
      }

      .rfc-popover-actions{
        display:flex;
        justify-content:flex-end;
        gap:8px;
        padding-top:15px;
        margin-top:15px;
        border-top:1px solid var(--rfc-outline);
      }

      .rfc-popover-actions .rfc-btn{
        min-height:36px;
        padding:7px 11px;
        font-size:11px;
      }

      .rfc-message{
        display:flex;
        align-items:flex-start;
        gap:10px;
        padding:12px 13px;
        margin-bottom:16px;
        border:1px solid;
        border-radius:10px;
        animation:rfcRowIn 220ms var(--rfc-ease);
      }

      .rfc-message-error{
        color:#7d1515;
        background:var(--rfc-danger-soft);
        border-color:#ffd0cc;
      }

      .rfc-message-warning{
        color:#6d4a00;
        background:var(--rfc-warning-soft);
        border-color:#f4df9f;
      }

      .rfc-message-icon{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        flex:0 0 28px;
        background:rgba(255,255,255,.72);
        border-radius:8px;
      }

      .rfc-message > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:2px;
      }

      .rfc-message strong{
        font-size:12px;
        line-height:16px;
      }

      .rfc-message span{
        font-size:11px;
        line-height:16px;
      }

      .rfc-message-action{
        flex:0 0 auto;
        padding:5px 8px;
        color:inherit;
        background:rgba(255,255,255,.65);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:10px;
        font-weight:700;
      }

      .rfc-metrics{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:16px;
        margin-bottom:26px;
      }

      .rfc-metric{
        position:relative;
        min-height:132px;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        gap:18px;
        overflow:hidden;
        padding:22px 24px;
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:16px;
        box-shadow:0 1px 2px rgba(0,0,0,.035);
        animation:rfcMetricIn 320ms var(--rfc-ease) both;
        transition:
          transform 180ms var(--rfc-ease),
          box-shadow 180ms var(--rfc-ease),
          border-color 180ms var(--rfc-ease);
      }

      .rfc-metric:nth-child(2){animation-delay:40ms}
      .rfc-metric:nth-child(3){animation-delay:80ms}
      .rfc-metric:nth-child(4){animation-delay:120ms}

      .rfc-metric:hover{
        transform:translateY(-2px);
        border-color:#dadbea;
        box-shadow:
          0 8px 24px rgba(25,28,29,.06),
          0 2px 4px rgba(25,28,29,.035);
      }

      .rfc-metric-glow{
        position:absolute;
        top:-28px;
        right:-24px;
        width:105px;
        height:105px;
        border-radius:50%;
        background:var(--rfc-primary-soft);
        filter:blur(24px);
        opacity:.65;
        pointer-events:none;
        transition:opacity 180ms var(--rfc-ease);
      }

      .rfc-metric-violet .rfc-metric-glow{
        background:var(--rfc-violet-soft);
      }

      .rfc-metric-success .rfc-metric-glow{
        background:var(--rfc-success-soft);
      }

      .rfc-metric-neutral .rfc-metric-glow{
        background:#eff0f4;
      }

      .rfc-metric:hover .rfc-metric-glow{
        opacity:1;
      }

      .rfc-metric-label{
        position:relative;
        display:flex;
        align-items:center;
        gap:8px;
        color:var(--rfc-text-soft);
        font-size:11px;
        font-weight:650;
        line-height:16px;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfc-metric-icon{
        color:var(--rfc-primary);
      }

      .rfc-metric-violet .rfc-metric-icon{
        color:var(--rfc-violet);
      }

      .rfc-metric-success .rfc-metric-icon{
        color:var(--rfc-success);
      }

      .rfc-metric-neutral .rfc-metric-icon{
        color:var(--rfc-text-soft);
      }

      .rfc-metric-value{
        position:relative;
        display:flex;
        align-items:flex-end;
        gap:7px;
      }

      .rfc-metric-value strong{
        color:var(--rfc-text);
        font:600 32px/36px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rfc-metric-value span{
        padding-bottom:3px;
        color:var(--rfc-text-soft);
        font-size:11px;
        line-height:15px;
      }

      .rfc-table-card{
        position:relative;
        min-height:340px;
        overflow:visible;
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:16px;
        box-shadow:0 1px 2px rgba(0,0,0,.04);
      }

      .rfc-table-accent{
        position:absolute;
        z-index:2;
        top:-1px;
        left:18px;
        right:18px;
        height:2px;
        background:linear-gradient(90deg,var(--rfc-primary),var(--rfc-violet),var(--rfc-primary));
        border-radius:999px;
        opacity:.25;
        pointer-events:none;
      }

      .rfc-table-wrap{
        width:100%;
        overflow-x:auto;
        border-radius:16px 16px 0 0;
      }

      .rfc-table{
        width:100%;
        min-width:1280px;
        border-collapse:separate;
        border-spacing:0;
        white-space:nowrap;
        text-align:left;
      }

      .rfc-table thead th{
        position:sticky;
        top:0;
        z-index:2;
        padding:15px 14px;
        color:var(--rfc-text-soft);
        background:#fff;
        border-bottom:1px solid var(--rfc-outline);
        font-size:11px;
        font-weight:600;
        line-height:16px;
        letter-spacing:.01em;
      }

      .rfc-table thead th:first-child,
      .rfc-table tbody td:first-child{
        padding-left:24px;
      }

      .rfc-table thead th:last-child,
      .rfc-table tbody td:last-child{
        padding-right:18px;
      }

      .rfc-table th.campaign-name{
        width:29%;
        min-width:310px;
      }

      .rfc-table .center{
        text-align:center;
      }

      .rfc-table .right{
        text-align:right;
      }

      .rfc-highlight-head{
        color:var(--rfc-primary)!important;
      }

      .rfc-action-head{
        width:42px;
      }

      .rfc-row{
        position:relative;
        cursor:pointer;
        animation:rfcRowIn 260ms var(--rfc-ease) both;
        animation-delay:calc(var(--rfc-row-index) * 28ms);
        transition:
          background 150ms var(--rfc-ease),
          box-shadow 150ms var(--rfc-ease);
      }

      .rfc-row + .rfc-row td{
        border-top:1px solid #f0f1f2;
      }

      .rfc-row:hover{
        background:#fafafd;
        box-shadow:inset 3px 0 0 rgba(70,72,212,.7);
      }

      .rfc-row.paused{
        background:#fafafa;
      }

      .rfc-row td{
        height:76px;
        padding:13px 14px;
        color:var(--rfc-text-soft);
        font-size:13px;
        line-height:18px;
        vertical-align:middle;
      }

      .rfc-row td.rfc-emphasis,
      .rfc-row td.rfc-meetings-cell{
        color:var(--rfc-text);
        font-weight:650;
      }

      .rfc-campaign-name-cell{
        min-width:0;
        display:flex;
        align-items:center;
        gap:13px;
      }

      .rfc-campaign-monogram{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        flex:0 0 34px;
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
        border:1px solid transparent;
        border-radius:7px;
        font:600 15px/20px Geist,Inter,sans-serif;
      }

      .rfc-campaign-monogram.email{
        color:var(--rfc-violet);
        background:var(--rfc-violet-soft);
      }

      .rfc-campaign-monogram.multi,
      .rfc-campaign-monogram.imported,
      .rfc-campaign-monogram.none{
        color:var(--rfc-text-soft);
        background:var(--rfc-card-high);
      }

      .rfc-campaign-monogram.none{
        background:#fff;
        border-color:var(--rfc-outline-strong);
        border-style:dashed;
      }

      .rfc-campaign-copy{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfc-campaign-copy strong{
        max-width:285px;
        overflow:hidden;
        color:var(--rfc-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 14px/20px Geist,Inter,sans-serif;
        transition:color 150ms var(--rfc-ease);
      }

      .rfc-row:hover .rfc-campaign-copy strong{
        color:var(--rfc-primary);
      }

      .rfc-campaign-copy small{
        max-width:285px;
        overflow:hidden;
        color:var(--rfc-text-soft);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:11px;
        line-height:16px;
      }

      .rfc-channel-icon{
        width:32px;
        height:32px;
        display:inline-grid;
        place-items:center;
        color:var(--rfc-text-soft);
        background:var(--rfc-card-soft);
        border-radius:50%;
      }

      .rfc-channel-icon.compact{
        width:26px;
        height:26px;
      }

      .rfc-channel-icon.voice{
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
      }

      .rfc-channel-icon.email{
        color:var(--rfc-violet);
        background:var(--rfc-violet-soft);
      }

      .rfc-channel-icon.whatsapp{
        color:var(--rfc-success);
        background:var(--rfc-success-soft);
      }

      .rfc-channel-icon.multi{
        color:#526073;
        background:#eef1f5;
      }

      .rfc-status{
        min-height:24px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:4px 8px;
        border-radius:999px;
        font-size:10px;
        font-weight:650;
        line-height:14px;
      }

      .rfc-status i{
        width:6px;
        height:6px;
        border-radius:50%;
        background:currentColor;
        animation:rfcPulse 1.7s ease-in-out infinite;
      }

      .rfc-status-success{
        color:var(--rfc-success);
        background:var(--rfc-success-soft);
      }

      .rfc-status-danger{
        color:var(--rfc-danger);
        background:var(--rfc-danger-soft);
      }

      .rfc-status-paused{
        color:#53607a;
        background:#eef1f8;
      }

      .rfc-status-queued{
        color:#7e5d00;
        background:#fff5d6;
      }

      .rfc-status-complete{
        color:#3c587c;
        background:#edf3fa;
      }

      .rfc-status-neutral{
        color:#5d5c67;
        background:#eff0f1;
      }

      .rfc-stacked-metric{
        display:inline-grid;
        justify-items:end;
        gap:0;
      }

      .rfc-stacked-metric strong{
        color:var(--rfc-text);
        font-size:12px;
        font-weight:500;
      }

      .rfc-stacked-metric small{
        color:var(--rfc-muted);
        font-size:9px;
        line-height:12px;
      }

      .rfc-conversion{
        display:inline-flex;
        align-items:center;
        justify-content:flex-end;
        gap:3px;
        color:var(--rfc-text-soft);
        font-weight:600;
      }

      .rfc-conversion.positive{
        color:var(--rfc-success);
      }

      .rfc-owner{
        display:inline-flex;
        align-items:center;
        gap:7px;
      }

      .rfc-owner i{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        flex:0 0 25px;
        color:#fff;
        background:var(--rfc-violet);
        border-radius:50%;
        font-size:8px;
        font-style:normal;
        font-weight:800;
      }

      .rfc-owner span{
        max-width:100px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfc-owner.compact i{
        width:24px;
        height:24px;
        flex-basis:24px;
      }

      .rfc-created-cell{
        color:var(--rfc-muted)!important;
        font-size:11px!important;
      }

      .rfc-row-actions{
        position:relative;
        width:44px;
      }

      .rfc-actions-menu{
        position:relative;
      }

      .rfc-actions-menu summary{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        color:var(--rfc-muted);
        background:transparent;
        border-radius:7px;
        cursor:pointer;
        list-style:none;
        font-size:13px;
        font-weight:800;
        letter-spacing:1px;
        transition:
          color 140ms var(--rfc-ease),
          background 140ms var(--rfc-ease);
      }

      .rfc-actions-menu summary::-webkit-details-marker{
        display:none;
      }

      .rfc-actions-menu summary:hover,
      .rfc-actions-menu[open] summary{
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
      }

      .rfc-actions-popover{
        position:absolute;
        z-index:30;
        top:34px;
        right:0;
        width:178px;
        display:grid;
        gap:2px;
        padding:5px;
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:10px;
        box-shadow:
          0 14px 35px rgba(25,28,29,.13),
          0 3px 8px rgba(25,28,29,.06);
        animation:rfcPopoverIn 160ms var(--rfc-ease);
      }

      .rfc-actions-popover a,
      .rfc-actions-popover button{
        min-height:34px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:7px 9px;
        color:var(--rfc-text-soft);
        background:transparent;
        border:0;
        border-radius:7px;
        text-decoration:none;
        cursor:pointer;
        font:500 10px/14px Inter,sans-serif;
      }

      .rfc-actions-popover a:hover,
      .rfc-actions-popover button:hover{
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
      }

      .rfc-actions-popover button.danger{
        color:var(--rfc-danger);
      }

      .rfc-actions-popover button.danger:hover{
        background:var(--rfc-danger-soft);
      }

      .rfc-menu-divider{
        height:1px;
        margin:3px 4px;
        background:var(--rfc-outline);
      }

      .rfc-table-footer{
        min-height:64px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        padding:14px 24px;
        color:var(--rfc-text-soft);
        border-top:1px solid var(--rfc-outline);
        font-size:11px;
        line-height:16px;
      }

      .rfc-table-footer strong{
        color:var(--rfc-text);
        font-weight:650;
      }

      .rfc-pagination{
        display:flex;
        align-items:center;
        gap:5px;
      }

      .rfc-pagination button{
        min-width:32px;
        height:32px;
        display:grid;
        place-items:center;
        padding:0 7px;
        color:var(--rfc-text-soft);
        background:var(--rfc-card-soft);
        border:1px solid transparent;
        border-radius:6px;
        cursor:pointer;
        font-size:10px;
        font-weight:650;
        transition:
          color 140ms var(--rfc-ease),
          background 140ms var(--rfc-ease),
          transform 140ms var(--rfc-ease);
      }

      .rfc-pagination button:hover:not(:disabled){
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
      }

      .rfc-pagination button.active{
        color:#fff;
        background:var(--rfc-primary);
        box-shadow:0 3px 8px rgba(70,72,212,.16);
      }

      .rfc-pagination button:disabled{
        opacity:.35;
        cursor:not-allowed;
      }

      .rfc-pagination button:active:not(:disabled){
        transform:scale(.96);
      }

      .rfc-pagination-ellipsis{
        min-width:20px;
        color:var(--rfc-muted);
        text-align:center;
        font-size:10px;
      }

      .rfc-skeleton{
        padding:0;
      }

      .rfc-skeleton-head,
      .rfc-skeleton-row{
        display:grid;
        grid-template-columns:2.5fr .7fr .9fr .8fr .8fr .8fr .8fr;
        gap:18px;
        align-items:center;
        padding:16px 24px;
      }

      .rfc-skeleton-head{
        border-bottom:1px solid var(--rfc-outline);
      }

      .rfc-skeleton-row + .rfc-skeleton-row{
        border-top:1px solid #f0f1f2;
      }

      .rfc-skeleton i{
        height:11px;
        border-radius:999px;
        background:linear-gradient(90deg,#eef0f2 25%,#f8f9fa 45%,#eef0f2 65%);
        background-size:220% 100%;
        animation:rfcShimmer 1.3s linear infinite;
      }

      .rfc-skeleton-row i{
        height:13px;
      }

      .rfc-skeleton-row i.wide{
        height:35px;
        border-radius:8px;
      }

      .rfc-empty{
        min-height:385px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:8px;
        padding:44px 24px;
        text-align:center;
        animation:rfcRowIn 240ms var(--rfc-ease);
      }

      .rfc-empty-icon{
        width:58px;
        height:58px;
        display:grid;
        place-items:center;
        margin-bottom:4px;
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
        border-radius:17px;
      }

      .rfc-empty h2{
        margin:0;
        color:var(--rfc-text);
        font:600 18px/25px Geist,Inter,sans-serif;
      }

      .rfc-empty p{
        max-width:510px;
        margin:0;
        color:var(--rfc-text-soft);
        font-size:12px;
        line-height:18px;
      }

      .rfc-empty-actions{
        margin-top:10px;
      }

      .rfc-mobile-list{
        display:none;
      }

      .rfc-modal-backdrop{
        position:fixed;
        z-index:210;
        inset:0;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(20,22,28,.34);
        backdrop-filter:blur(4px);
        animation:rfcBackdropIn 160ms ease-out;
      }

      .rfc-modal{
        width:min(460px,100%);
        padding:24px;
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:16px;
        box-shadow:
          0 26px 70px rgba(19,21,27,.22),
          0 5px 16px rgba(19,21,27,.09);
        animation:rfcModalIn 220ms var(--rfc-ease);
      }

      .rfc-modal-icon{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        margin-bottom:16px;
        border-radius:12px;
      }

      .rfc-modal-icon.danger{
        color:var(--rfc-danger);
        background:var(--rfc-danger-soft);
      }

      .rfc-modal-copy h2{
        margin:0;
        color:var(--rfc-text);
        font:600 20px/28px Geist,Inter,sans-serif;
        letter-spacing:-.01em;
      }

      .rfc-modal-copy p{
        margin:8px 0 0;
        color:var(--rfc-text-soft);
        font-size:12px;
        line-height:18px;
      }

      .rfc-modal-copy p strong{
        color:var(--rfc-text);
      }

      .rfc-modal-actions{
        justify-content:flex-end;
        padding-top:20px;
        margin-top:20px;
        border-top:1px solid var(--rfc-outline);
      }

      .rfc-access-card{
        max-width:640px;
        padding:28px;
        background:#fff;
        border:1px solid var(--rfc-outline);
        border-radius:16px;
        box-shadow:0 1px 2px rgba(0,0,0,.04);
      }

      .rfc-access-icon{
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        margin-bottom:16px;
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
        border-radius:14px;
      }

      .rfc-access-card .rfc-btn{
        margin-top:20px;
      }

      @media(max-width:1180px){
        .rf-campaigns-v7{
          padding:24px;
        }

        .rfc-metrics{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rfc-control-row{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfc-control-actions{
          width:100%;
        }

        .rfc-search{
          width:100%;
          max-width:none;
          flex:1;
        }
      }

      @media(max-width:900px){
        .rfc-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfc-header-actions{
          width:100%;
        }

        .rfc-header-actions .rfc-btn{
          flex:1;
        }

        .rfc-table-wrap{
          display:none;
        }

        .rfc-mobile-list{
          display:grid;
          gap:0;
        }

        .rfc-mobile-card{
          padding:15px 16px;
          animation:rfcRowIn 260ms var(--rfc-ease) both;
          animation-delay:calc(var(--rfc-row-index) * 28ms);
        }

        .rfc-mobile-card + .rfc-mobile-card{
          border-top:1px solid var(--rfc-outline);
        }

        .rfc-mobile-card-main{
          width:100%;
          display:flex;
          align-items:center;
          gap:11px;
          padding:0;
          color:inherit;
          background:transparent;
          border:0;
          text-align:left;
          cursor:pointer;
        }

        .rfc-mobile-card-copy{
          min-width:0;
          flex:1;
          display:grid;
          gap:1px;
        }

        .rfc-mobile-card-copy strong,
        .rfc-mobile-card-copy small{
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .rfc-mobile-card-copy strong{
          color:var(--rfc-text);
          font:600 13px/18px Geist,Inter,sans-serif;
        }

        .rfc-mobile-card-copy small{
          color:var(--rfc-text-soft);
          font-size:10px;
          line-height:15px;
        }

        .rfc-mobile-card-main > svg{
          flex:0 0 auto;
          color:var(--rfc-muted);
        }

        .rfc-mobile-card-meta{
          display:flex;
          align-items:center;
          gap:8px;
          margin:12px 0;
        }

        .rfc-mobile-stats{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          overflow:hidden;
          background:var(--rfc-card-soft);
          border-radius:9px;
        }

        .rfc-mobile-stats span{
          display:grid;
          gap:2px;
          padding:9px 10px;
        }

        .rfc-mobile-stats span + span{
          border-left:1px solid var(--rfc-outline);
        }

        .rfc-mobile-stats small{
          color:var(--rfc-muted);
          font-size:8px;
          font-weight:650;
          line-height:12px;
          letter-spacing:.05em;
          text-transform:uppercase;
        }

        .rfc-mobile-stats strong{
          color:var(--rfc-text);
          font-size:12px;
          line-height:17px;
        }

        .rfc-mobile-actions{
          display:flex;
          align-items:center;
          gap:12px;
          padding-top:11px;
        }

        .rfc-mobile-link,
        .rfc-mobile-delete{
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:0;
          color:var(--rfc-primary)!important;
          background:transparent;
          border:0;
          text-decoration:none;
          cursor:pointer;
          font-size:9px;
          font-weight:700;
          line-height:14px;
        }

        .rfc-mobile-delete{
          color:var(--rfc-danger)!important;
          margin-left:auto;
        }
      }

      @media(max-width:680px){
        .rf-campaigns-v7{
          padding:18px 14px 84px;
        }

        .rfc-title-block h1,
        .rfc-access-card h1{
          font-size:24px;
          line-height:32px;
        }

        .rfc-title-block p{
          font-size:12px;
          line-height:18px;
        }

        .rfc-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:8px;
        }

        .rfc-btn{
          min-height:38px;
          padding:7px 10px;
          font-size:11px;
        }

        .rfc-control-row{
          gap:10px;
        }

        .rfc-tabs{
          width:100%;
          overflow:auto;
        }

        .rfc-tab{
          flex:1;
          justify-content:center;
          min-width:max-content;
        }

        .rfc-control-actions{
          display:grid;
          grid-template-columns:minmax(0,1fr) auto auto;
          gap:7px;
        }

        .rfc-search{
          min-width:0;
          height:38px;
        }

        .rfc-control-actions .rfc-btn{
          min-width:40px;
          padding:7px 9px;
          font-size:0;
          gap:0;
        }

        .rfc-control-actions .rfc-btn svg{
          display:block;
        }

        .rfc-control-actions .rfc-btn svg:last-child{
          display:none;
        }

        .rfc-icon-btn{
          width:38px;
          height:38px;
        }

        .rfc-filter-popover{
          position:fixed;
          z-index:180;
          right:12px;
          bottom:76px;
          top:auto;
          left:12px;
          width:auto;
          max-height:70vh;
          overflow:auto;
          border-radius:16px;
          box-shadow:0 22px 70px rgba(20,22,28,.22);
        }

        .rfc-metrics{
          grid-template-columns:1fr 1fr;
          gap:9px;
          margin-bottom:16px;
        }

        .rfc-metric{
          min-height:112px;
          padding:15px;
          border-radius:13px;
        }

        .rfc-metric-label{
          gap:6px;
          font-size:9px;
          line-height:13px;
        }

        .rfc-metric-value{
          display:grid;
          gap:2px;
        }

        .rfc-metric-value strong{
          font-size:25px;
          line-height:29px;
        }

        .rfc-metric-value span{
          padding:0;
          font-size:9px;
          line-height:13px;
        }

        .rfc-table-card{
          border-radius:14px;
        }

        .rfc-table-footer{
          align-items:flex-start;
          flex-direction:column;
          padding:13px 15px;
        }

        .rfc-pagination{
          width:100%;
          justify-content:flex-end;
        }

        .rfc-empty{
          min-height:320px;
          padding:30px 18px;
        }

        .rfc-empty-actions{
          width:100%;
          display:grid;
          grid-template-columns:1fr;
        }

        .rfc-modal{
          padding:20px;
          border-radius:15px;
        }

        .rfc-modal-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .rfc-message{
          align-items:flex-start;
        }

        .rfc-message-action{
          align-self:center;
        }
      }

      @media(max-width:430px){
        .rfc-header-actions{
          grid-template-columns:1fr;
        }

        .rfc-metrics{
          grid-template-columns:1fr;
        }

        .rfc-metric{
          min-height:104px;
        }

        .rfc-mobile-card{
          padding:14px;
        }

        .rfc-mobile-actions{
          flex-wrap:wrap;
        }

        .rfc-mobile-delete{
          margin-left:0;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-campaigns-v7,
        .rfc-metric,
        .rfc-row,
        .rfc-mobile-card,
        .rfc-filter-popover,
        .rfc-modal-backdrop,
        .rfc-modal,
        .rfc-message,
        .rfc-status i,
        .rfc-skeleton i,
        .rf-campaigns-v7 .spin{
          animation:none!important;
        }

        .rf-campaigns-v7 *,
        .rf-campaigns-v7 *::before,
        .rf-campaigns-v7 *::after{
          scroll-behavior:auto!important;
          transition-duration:0.01ms!important;
        }
      }
    `}</style>
  );
}
