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
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Star,
  Target,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "../components/icons";

import {
  api,
} from "../api";

import {
  useAuth,
} from "../auth/AuthContext";

/**
 * ReachFly.AI V7 Contacts
 *
 * Production behavior preserved:
 * - Contacts are still loaded from api.contacts().
 * - No synthetic CRM records are created.
 * - Existing campaign-derived lead/contact fields stay authoritative.
 *
 * V7 additions:
 * - Stitch-style Contacts table and segmented views.
 * - Query-string search support used by AppShell global search.
 * - Stage/campaign/contactability filters.
 * - Real CSV export (all filtered or selected).
 * - Row selection and non-destructive bulk tools.
 * - Animated contact detail drawer using only existing contact data.
 * - Real links into Campaigns, Inbox, Email, Dialer, Meetings and AI Audits.
 * - Loading, retry, refresh and animated success/error feedback.
 *
 * Important:
 * The current ReachFly frontend exposes a read-only contacts API. The "Add
 * contacts" action therefore routes to the existing import workflow instead
 * of pretending a contact was persisted.
 */

const PAGE_SIZE = 20;

const VIEW_TABS = [
  {
    key: "all",
    label: "All Contacts",
  },
  {
    key: "mine",
    label: "My Contacts",
  },
  {
    key: "new",
    label: "New This Week",
  },
];

export default function Contacts() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    user,
  } = useAuth();

  const [
    items,
    setItems,
  ] = useState([]);

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
    query,
    setQuery,
  ] = useState(
    () =>
      new URLSearchParams(
        window.location.search
      ).get("search") ||
      ""
  );

  const [
    view,
    setView,
  ] = useState("all");

  const [
    stageFilter,
    setStageFilter,
  ] = useState("all");

  const [
    campaignFilter,
    setCampaignFilter,
  ] = useState("all");

  const [
    contactabilityFilter,
    setContactabilityFilter,
  ] = useState("all");

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const [
    sortBy,
    setSortBy,
  ] = useState("recent");

  const [
    selectedIds,
    setSelectedIds,
  ] = useState(
    () => new Set()
  );

  const [
    activeContact,
    setActiveContact,
  ] = useState(null);

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

  const canViewContacts =
    [
      "owner",
      "admin",
      "manager",
    ].includes(role);

  const load =
    useCallback(
      async ({
        silent = false,
        successToast = false,
      } = {}) => {
        if (
          !canViewContacts
        ) {
          setItems([]);
          setLoading(false);
          return;
        }

        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        try {
          const response =
            await api.contacts();

          const contacts =
            normalizeContactsResponse(
              response
            );

          setItems(
            contacts
          );
          setError("");

          if (
            successToast
          ) {
            notify(
              "success",
              "Contacts refreshed",
              "Your latest campaign contacts are now visible."
            );
          }
        } catch (requestError) {
          const message =
            requestError?.message ||
            "Contacts could not be loaded.";

          setError(message);

          if (!silent) {
            setItems([]);
          }

          if (
            successToast
          ) {
            notify(
              "error",
              "Contact refresh failed",
              message
            );
          }
        } finally {
          setLoading(false);
          setRefreshing(
            false
          );
        }
      },
      [
        canViewContacts,
      ]
    );

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    if (
      !canViewContacts
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
        60_000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    canViewContacts,
    load,
    navigate,
    user,
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

    if (
      search !==
        null &&
      search !==
        query
    ) {
      setQuery(
        search
      );
    }
  }, [
    location.search,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1);
  }, [
    query,
    view,
    stageFilter,
    campaignFilter,
    contactabilityFilter,
    sortBy,
  ]);

  const normalizedItems =
    useMemo(
      () =>
        items.map(
          (
            contact,
            index
          ) =>
            normalizeContact(
              contact,
              index
            )
        ),
      [
        items,
      ]
    );

  const stageOptions =
    useMemo(() => {
      const set =
        new Set();

      normalizedItems.forEach(
        (contact) => {
          if (
            contact.stage
          ) {
            set.add(
              contact.stage
            );
          }
        }
      );

      return Array.from(
        set
      ).sort(
        (
          left,
          right
        ) =>
          left.localeCompare(
            right
          )
      );
    }, [
      normalizedItems,
    ]);

  const campaignOptions =
    useMemo(() => {
      const set =
        new Set();

      normalizedItems.forEach(
        (contact) => {
          if (
            contact.campaignName
          ) {
            set.add(
              contact.campaignName
            );
          }
        }
      );

      return Array.from(
        set
      ).sort(
        (
          left,
          right
        ) =>
          left.localeCompare(
            right
          )
      );
    }, [
      normalizedItems,
    ]);

  const filtered =
    useMemo(() => {
      const search =
        query
          .trim()
          .toLowerCase();

      const output =
        normalizedItems.filter(
          (contact) => {
            if (
              view ===
                "mine" &&
              !isMyContact(
                contact,
                user
              )
            ) {
              return false;
            }

            if (
              view ===
                "new" &&
              !isNewThisWeek(
                contact
              )
            ) {
              return false;
            }

            if (
              stageFilter !==
                "all" &&
              normalizeStatus(
                contact.stage
              ) !==
                normalizeStatus(
                  stageFilter
                )
            ) {
              return false;
            }

            if (
              campaignFilter !==
                "all" &&
              contact.campaignName !==
                campaignFilter
            ) {
              return false;
            }

            if (
              contactabilityFilter ===
                "email" &&
              !contact.email
            ) {
              return false;
            }

            if (
              contactabilityFilter ===
                "phone" &&
              !contact.phone
            ) {
              return false;
            }

            if (
              contactabilityFilter ===
                "website" &&
              !contact.website
            ) {
              return false;
            }

            if (
              contactabilityFilter ===
                "complete" &&
              !(
                contact.email &&
                contact.phone
              )
            ) {
              return false;
            }

            if (!search) {
              return true;
            }

            return [
              contact.name,
              contact.company,
              contact.email,
              contact.phone,
              contact.address,
              contact.location,
              contact.website,
              contact.campaignName,
              contact.stage,
              contact.owner,
              contact.nextActivityLabel,
              contact.source,
              ...(contact.tags ||
                []),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(
                search
              );
          }
        );

      return output.sort(
        (
          left,
          right
        ) => {
          if (
            sortBy ===
            "name"
          ) {
            return left.name.localeCompare(
              right.name
            );
          }

          if (
            sortBy ===
            "company"
          ) {
            return left.company.localeCompare(
              right.company
            );
          }

          if (
            sortBy ===
            "stage"
          ) {
            return left.stage.localeCompare(
              right.stage
            );
          }

          if (
            sortBy ===
            "oldest"
          ) {
            return (
              left.lastContactAtMs -
              right.lastContactAtMs
            );
          }

          return (
            right.lastContactAtMs -
            left.lastContactAtMs
          );
        }
      );
    }, [
      campaignFilter,
      contactabilityFilter,
      normalizedItems,
      query,
      sortBy,
      stageFilter,
      user,
      view,
    ]);

  const stats =
    useMemo(
      () =>
        buildContactStats(
          normalizedItems,
          user
        ),
      [
        normalizedItems,
        user,
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

  const pageItems =
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

  const visibleIds =
    useMemo(
      () =>
        pageItems.map(
          (contact) =>
            contact.key
        ),
      [
        pageItems,
      ]
    );

  const allVisibleSelected =
    visibleIds.length >
      0 &&
    visibleIds.every(
      (key) =>
        selectedIds.has(
          key
        )
    );

  const selectedContacts =
    useMemo(
      () =>
        normalizedItems.filter(
          (contact) =>
            selectedIds.has(
              contact.key
            )
        ),
      [
        normalizedItems,
        selectedIds,
      ]
    );

  const hasActiveFilters =
    stageFilter !==
      "all" ||
    campaignFilter !==
      "all" ||
    contactabilityFilter !==
      "all" ||
    sortBy !==
      "recent";

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

  function toggleVisibleSelection() {
    setSelectedIds(
      (current) => {
        const next =
          new Set(
            current
          );

        if (
          allVisibleSelected
        ) {
          visibleIds.forEach(
            (key) =>
              next.delete(
                key
              )
          );
        } else {
          visibleIds.forEach(
            (key) =>
              next.add(
                key
              )
          );
        }

        return next;
      }
    );
  }

  function toggleContactSelection(
    key
  ) {
    setSelectedIds(
      (current) => {
        const next =
          new Set(
            current
          );

        if (
          next.has(
            key
          )
        ) {
          next.delete(
            key
          );
        } else {
          next.add(
            key
          );
        }

        return next;
      }
    );
  }

  function clearFilters() {
    setStageFilter(
      "all"
    );
    setCampaignFilter(
      "all"
    );
    setContactabilityFilter(
      "all"
    );
    setSortBy(
      "recent"
    );
    setFiltersOpen(
      false
    );
  }

  function exportContacts(
    contacts,
    suffix =
      "contacts"
  ) {
    const rows =
      contacts.map(
        (contact) => ({
          Contact:
            contact.name,
          Company:
            contact.company,
          Email:
            contact.email,
          Phone:
            contact.phone,
          Website:
            contact.website,
          Address:
            contact.address,
          Campaign:
            contact.campaignName,
          Stage:
            contact.stage,
          Owner:
            contact.owner,
          "Last Contact":
            contact.lastContactAt
              ? new Date(
                  contact.lastContactAt
                ).toISOString()
              : "",
          "Next Activity":
            contact.nextActivityLabel,
          Source:
            contact.source,
        })
      );

    downloadCsv(
      rows,
      `reachfly-${suffix}-${formatFileDate(
        new Date()
      )}.csv`
    );

    notify(
      "success",
      "Contacts exported",
      `${formatNumber(
        contacts.length
      )} contact${
        contacts.length ===
        1
          ? ""
          : "s"
      } exported as CSV.`
    );
  }

  function openEmail(
    contacts
  ) {
    const emails =
      Array.from(
        new Set(
          contacts
            .map(
              (contact) =>
                contact.email
            )
            .filter(Boolean)
        )
      );

    if (
      emails.length ===
      0
    ) {
      notify(
        "warning",
        "No email addresses selected",
        "Select contacts that have an email address first."
      );
      return;
    }

    if (
      emails.length >
      30
    ) {
      notify(
        "warning",
        "Too many email recipients",
        "Export the selected contacts or narrow the selection before opening an email draft."
      );
      return;
    }

    window.location.href =
      `mailto:${emails.join(
        ","
      )}`;
  }

  if (
    !canViewContacts
  ) {
    return (
      <>
        <ContactsStyles />

        <div className="rf-contacts-v7">
          <section className="rfcx-access">
            <span className="rfcx-access-icon">
              <Users size={24} />
            </span>

            <span className="rfcx-eyebrow">
              Restricted workspace feature
            </span>

            <h1>
              Contact access required
            </h1>

            <p>
              The shared CRM contact database is available to workspace owners,
              administrators, and managers.
            </p>

            <button
              className="rfcx-btn rfcx-btn-primary"
              type="button"
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
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <ContactsStyles />

      <div className="rf-contacts-v7">
        <header className="rfcx-header">
          <div>
            <span className="rfcx-eyebrow">
              CRM
            </span>

            <h1>
              Contacts
            </h1>

            <p>
              Manage and segment relationships created from your ReachFly
              campaigns and lead workflows.
            </p>
          </div>

          <div className="rfcx-header-actions">
            <button
              type="button"
              className="rfcx-btn rfcx-btn-secondary"
              disabled={
                filtered.length ===
                0
              }
              onClick={() =>
                exportContacts(
                  filtered
                )
              }
            >
              <Send size={15} />
              Export
            </button>

            <Link
              className="rfcx-btn rfcx-btn-primary"
              to="/app/campaigns/external-leads"
            >
              <Plus size={15} />
              Add Contacts
            </Link>
          </div>
        </header>

        <section className="rfcx-metrics">
          <ContactMetric
            icon={
              <Users size={16} />
            }
            label="All Contacts"
            value={
              stats.total
            }
            tone="primary"
          />

          <ContactMetric
            icon={
              <UserRound size={16} />
            }
            label="My Contacts"
            value={
              stats.mine
            }
            tone="violet"
          />

          <ContactMetric
            icon={
              <TrendingUp size={16} />
            }
            label="New This Week"
            value={
              stats.newThisWeek
            }
            tone="success"
          />

          <ContactMetric
            icon={
              <CheckCircle2 size={16} />
            }
            label="Reachable"
            value={
              stats.reachable
            }
            tone="neutral"
          />
        </section>

        <section className="rfcx-toolbar">
          <nav
            className="rfcx-tabs"
            aria-label="Contact views"
          >
            {VIEW_TABS.map(
              (tab) => (
                <button
                  key={
                    tab.key
                  }
                  type="button"
                  className={
                    view ===
                    tab.key
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setView(
                      tab.key
                    )
                  }
                >
                  {tab.label}

                  <span>
                    {tab.key ===
                    "all"
                      ? stats.total
                      : tab.key ===
                          "mine"
                        ? stats.mine
                        : stats.newThisWeek}
                  </span>
                </button>
              )
            )}
          </nav>

          <div className="rfcx-toolbar-actions">
            <div className="rfcx-filter-anchor">
              <button
                type="button"
                className={`rfcx-filter-btn ${
                  hasActiveFilters
                    ? "active"
                    : ""
                }`}
                aria-expanded={
                  filtersOpen
                }
                aria-haspopup="dialog"
                onClick={() =>
                  setFiltersOpen(
                    (value) =>
                      !value
                  )
                }
              >
                <Target size={15} />
                Filter

                {hasActiveFilters ? (
                  <span>
                    {
                      [
                        stageFilter !==
                          "all",
                        campaignFilter !==
                          "all",
                        contactabilityFilter !==
                          "all",
                        sortBy !==
                          "recent",
                      ].filter(Boolean)
                        .length
                    }
                  </span>
                ) : null}

                <ChevronDown size={13} />
              </button>

              {filtersOpen ? (
                <ContactFilters
                  stageFilter={
                    stageFilter
                  }
                  onStageFilter={
                    setStageFilter
                  }
                  campaignFilter={
                    campaignFilter
                  }
                  onCampaignFilter={
                    setCampaignFilter
                  }
                  contactabilityFilter={
                    contactabilityFilter
                  }
                  onContactabilityFilter={
                    setContactabilityFilter
                  }
                  sortBy={
                    sortBy
                  }
                  onSortBy={
                    setSortBy
                  }
                  stageOptions={
                    stageOptions
                  }
                  campaignOptions={
                    campaignOptions
                  }
                  onReset={
                    clearFilters
                  }
                  onClose={() =>
                    setFiltersOpen(
                      false
                    )
                  }
                />
              ) : null}
            </div>

            <label className="rfcx-search">
              <Search
                size={16}
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
                placeholder="Search contacts..."
                aria-label="Search contacts"
              />

              {query ? (
                <button
                  type="button"
                  aria-label="Clear contact search"
                  onClick={() =>
                    setQuery(
                      ""
                    )
                  }
                >
                  <X size={13} />
                </button>
              ) : null}
            </label>

            <button
              type="button"
              className="rfcx-icon-btn"
              aria-label="Refresh contacts"
              title="Refresh contacts"
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
                size={16}
                className={
                  refreshing
                    ? "spin"
                    : ""
                }
              />
            </button>
          </div>
        </section>

        {selectedContacts.length >
        0 ? (
          <section className="rfcx-bulk-bar">
            <div>
              <span className="rfcx-bulk-check">
                <CheckCircle2 size={14} />
              </span>

              <strong>
                {formatNumber(
                  selectedContacts.length
                )}{" "}
                selected
              </strong>

              <span>
                Use non-destructive actions on the selected contacts.
              </span>
            </div>

            <div className="rfcx-bulk-actions">
              <button
                type="button"
                onClick={() =>
                  exportContacts(
                    selectedContacts,
                    "selected-contacts"
                  )
                }
              >
                <Send size={14} />
                Export
              </button>

              <button
                type="button"
                onClick={() =>
                  openEmail(
                    selectedContacts
                  )
                }
              >
                <Mail size={14} />
                Email
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedIds(
                    new Set()
                  )
                }
              >
                <X size={14} />
                Clear
              </button>
            </div>
          </section>
        ) : null}

        {error ? (
          <section
            className="rfcx-message error"
            role="alert"
          >
            <span>
              <X size={15} />
            </span>

            <div>
              <strong>
                Contact data needs attention
              </strong>

              <small>
                {error}
              </small>
            </div>

            <button
              type="button"
              onClick={() =>
                void load({
                  successToast: true,
                })
              }
            >
              Try again
            </button>
          </section>
        ) : null}

        <section className="rfcx-table-card">
          {loading ? (
            <ContactsSkeleton />
          ) : filtered.length ===
            0 ? (
            <ContactsEmpty
              hasSearch={
                Boolean(
                  query.trim()
                )
              }
              hasFilters={
                hasActiveFilters ||
                view !==
                  "all"
              }
              onReset={() => {
                setQuery("");
                setView(
                  "all"
                );
                clearFilters();
              }}
            />
          ) : (
            <>
              <div className="rfcx-table-wrap">
                <table className="rfcx-table">
                  <thead>
                    <tr>
                      <th className="select">
                        <ContactCheckbox
                          checked={
                            allVisibleSelected
                          }
                          label="Select visible contacts"
                          onChange={
                            toggleVisibleSelection
                          }
                        />
                      </th>

                      <th>
                        Contact
                      </th>

                      <th>
                        Company
                      </th>

                      <th>
                        Email
                      </th>

                      <th>
                        Phone
                      </th>

                      <th>
                        Stage
                      </th>

                      <th>
                        Owner
                      </th>

                      <th>
                        Last Contact
                      </th>

                      <th>
                        Next Activity
                      </th>

                      <th className="actions" />
                    </tr>
                  </thead>

                  <tbody>
                    {pageItems.map(
                      (
                        contact,
                        index
                      ) => (
                        <ContactRow
                          key={
                            contact.key
                          }
                          contact={
                            contact
                          }
                          selected={
                            selectedIds.has(
                              contact.key
                            )
                          }
                          onSelected={() =>
                            toggleContactSelection(
                              contact.key
                            )
                          }
                          onOpen={() =>
                            setActiveContact(
                              contact
                            )
                          }
                          index={
                            index
                          }
                        />
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rfcx-mobile-list">
                {pageItems.map(
                  (
                    contact,
                    index
                  ) => (
                    <ContactMobileCard
                      key={
                        contact.key
                      }
                      contact={
                        contact
                      }
                      selected={
                        selectedIds.has(
                          contact.key
                        )
                      }
                      onSelected={() =>
                        toggleContactSelection(
                          contact.key
                        )
                      }
                      onOpen={() =>
                        setActiveContact(
                          contact
                        )
                      }
                      index={
                        index
                      }
                    />
                  )
                )}
              </div>

              <footer className="rfcx-footer">
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
                    {formatNumber(
                      filtered.length
                    )}
                  </strong>{" "}
                  contacts
                </span>

                <ContactPagination
                  page={
                    safePage
                  }
                  count={
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

        {activeContact ? (
          <ContactDrawer
            contact={
              activeContact
            }
            onClose={() =>
              setActiveContact(
                null
              )
            }
          />
        ) : null}
      </div>
    </>
  );
}

function ContactMetric({
  icon,
  label,
  value,
  tone,
}) {
  return (
    <article
      className={`rfcx-metric ${tone}`}
    >
      <span className="rfcx-metric-icon">
        {icon}
      </span>

      <div>
        <span>
          {label}
        </span>

        <strong>
          {formatNumber(
            value
          )}
        </strong>
      </div>
    </article>
  );
}

function ContactFilters({
  stageFilter,
  onStageFilter,
  campaignFilter,
  onCampaignFilter,
  contactabilityFilter,
  onContactabilityFilter,
  sortBy,
  onSortBy,
  stageOptions,
  campaignOptions,
  onReset,
  onClose,
}) {
  return (
    <div
      className="rfcx-filter-popover"
      role="dialog"
      aria-label="Contact filters"
    >
      <div className="rfcx-popover-head">
        <div>
          <strong>
            Filter contacts
          </strong>

          <span>
            Refine this CRM view
          </span>
        </div>

        <button
          type="button"
          aria-label="Close filters"
          onClick={
            onClose
          }
        >
          <X size={14} />
        </button>
      </div>

      <label className="rfcx-field">
        <span>
          Stage
        </span>

        <select
          value={
            stageFilter
          }
          onChange={(
            event
          ) =>
            onStageFilter(
              event.target
                .value
            )
          }
        >
          <option value="all">
            All stages
          </option>

          {stageOptions.map(
            (option) => (
              <option
                key={
                  option
                }
                value={
                  option
                }
              >
                {titleCase(
                  option
                )}
              </option>
            )
          )}
        </select>
      </label>

      <label className="rfcx-field">
        <span>
          Campaign
        </span>

        <select
          value={
            campaignFilter
          }
          onChange={(
            event
          ) =>
            onCampaignFilter(
              event.target
                .value
            )
          }
        >
          <option value="all">
            All campaigns
          </option>

          {campaignOptions.map(
            (option) => (
              <option
                key={
                  option
                }
                value={
                  option
                }
              >
                {option}
              </option>
            )
          )}
        </select>
      </label>

      <label className="rfcx-field">
        <span>
          Contactability
        </span>

        <select
          value={
            contactabilityFilter
          }
          onChange={(
            event
          ) =>
            onContactabilityFilter(
              event.target
                .value
            )
          }
        >
          <option value="all">
            Any contactability
          </option>
          <option value="complete">
            Email + phone
          </option>
          <option value="email">
            Has email
          </option>
          <option value="phone">
            Has phone
          </option>
          <option value="website">
            Has website
          </option>
        </select>
      </label>

      <label className="rfcx-field">
        <span>
          Sort
        </span>

        <select
          value={
            sortBy
          }
          onChange={(
            event
          ) =>
            onSortBy(
              event.target
                .value
            )
          }
        >
          <option value="recent">
            Most recently contacted
          </option>
          <option value="oldest">
            Least recently contacted
          </option>
          <option value="name">
            Contact name
          </option>
          <option value="company">
            Company
          </option>
          <option value="stage">
            Stage
          </option>
        </select>
      </label>

      <div className="rfcx-popover-actions">
        <button
          type="button"
          className="ghost"
          onClick={
            onReset
          }
        >
          Reset
        </button>

        <button
          type="button"
          className="primary"
          onClick={
            onClose
          }
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function ContactRow({
  contact,
  selected,
  onSelected,
  onOpen,
  index,
}) {
  return (
    <tr
      className={
        selected
          ? "selected"
          : ""
      }
      style={{
        "--rfcx-row-index":
          index,
      }}
      onClick={
        onOpen
      }
    >
      <td
        className="select"
        onClick={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        <ContactCheckbox
          checked={
            selected
          }
          label={`Select ${contact.name}`}
          onChange={
            onSelected
          }
        />
      </td>

      <td>
        <ContactIdentity
          contact={
            contact
          }
        />
      </td>

      <td>
        <CompanyCell
          contact={
            contact
          }
        />
      </td>

      <td className="muted">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            {contact.email}
          </a>
        ) : (
          "—"
        )}
      </td>

      <td className="muted phone">
        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            {formatPhone(
              contact.phone
            )}
          </a>
        ) : (
          "—"
        )}
      </td>

      <td>
        <StagePill
          stage={
            contact.stage
          }
        />
      </td>

      <td className="muted">
        <OwnerChip
          owner={
            contact.owner
          }
        />
      </td>

      <td className="muted">
        {contact.lastContactAt
          ? formatRelativeOrDate(
              contact.lastContactAt
            )
          : "No activity"}
      </td>

      <td>
        <NextActivity
          contact={
            contact
          }
        />
      </td>

      <td className="actions">
        <button
          type="button"
          aria-label={`Open ${contact.name}`}
          title="Open contact"
          onClick={(
            event
          ) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <ChevronRight size={15} />
        </button>
      </td>
    </tr>
  );
}

function ContactMobileCard({
  contact,
  selected,
  onSelected,
  onOpen,
  index,
}) {
  return (
    <article
      className={`rfcx-mobile-card ${
        selected
          ? "selected"
          : ""
      }`}
      style={{
        "--rfcx-row-index":
          index,
      }}
    >
      <div className="rfcx-mobile-card-head">
        <ContactCheckbox
          checked={
            selected
          }
          label={`Select ${contact.name}`}
          onChange={
            onSelected
          }
        />

        <button
          type="button"
          className="rfcx-mobile-open"
          onClick={
            onOpen
          }
        >
          <ContactIdentity
            contact={
              contact
            }
          />

          <ChevronRight size={16} />
        </button>
      </div>

      <div className="rfcx-mobile-meta">
        <CompanyCell
          contact={
            contact}
          />

        <StagePill
          stage={
            contact.stage
          }
        />
         </div>

      <div className="rfcx-mobile-contact-methods">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
          >
            <Mail size={13} />
            {contact.email}
          </a>
        ) : null}

        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
          >
            <Phone size={13} />
            {formatPhone(
              contact.phone
            )}
          </a>
        ) : null}
      </div>

      <div className="rfcx-mobile-foot">
        <OwnerChip
          owner={
            contact.owner
          }
        />

        <span>
          {contact.lastContactAt
            ? formatRelativeOrDate(
                contact.lastContactAt
              )
            : "No contact yet"}
        </span>
      </div>
    </article>
  );
}

function ContactIdentity({
  contact,
}) {
  return (
    <div className="rfcx-contact-identity">
      <span
        className={`rfcx-avatar ${getAvatarTone(
          contact.name
        )}`}
      >
        {getInitials(
          contact.name
        )}
      </span>

      <span>
        <strong>
          {contact.name}
        </strong>

        <small>
          {contact.location ||
            contact.address ||
            contact.campaignName ||
            "ReachFly contact"}
        </small>
      </span>
    </div>
  );
}

function CompanyCell({
  contact,
}) {
  return (
    <div className="rfcx-company-cell">
      <span>
        {getInitials(
          contact.company
        )}
      </span>

      <strong>
        {contact.company}
      </strong>
    </div>
  );
}

function OwnerChip({
  owner,
}) {
  if (
    !owner ||
    owner ===
      "Unassigned"
  ) {
    return (
      <span className="rfcx-unassigned">
        Unassigned
      </span>
    );
  }

  return (
    <span className="rfcx-owner">
      <i>
        {getInitials(
          owner
        )}
      </i>

      <span>
        {owner}
      </span>
    </span>
  );
}

function StagePill({
  stage,
}) {
  const tone =
    getStageTone(
      stage
    );

  return (
    <span
      className={`rfcx-stage ${tone}`}
    >
      {titleCase(
        stage ||
        "new"
      )}
    </span>
  );
}

function NextActivity({
  contact,
}) {
  if (
    !contact.nextActivityLabel
  ) {
    return (
      <span className="rfcx-no-activity">
        No activity planned
      </span>
    );
  }

  const Icon =
    getNextActivityIcon(
      contact.nextActivityType
    );

  return (
    <span className="rfcx-next-activity">
      <Icon size={13} />

      <span>
        {
          contact.nextActivityLabel
        }
      </span>
    </span>
  );
}

function ContactCheckbox({
  checked,
  label,
  onChange,
}) {
  return (
    <button
      type="button"
      className={`rfcx-checkbox ${
        checked
          ? "checked"
          : ""
      }`}
      role="checkbox"
      aria-checked={
        checked
      }
      aria-label={
        label
      }
      onClick={
        onChange
      }
    >
      {checked ? (
        <CheckCircle2 size={13} />
      ) : null}
    </button>
  );
}

function ContactDrawer({
  contact,
  onClose,
}) {
  const stageTone =
    getStageTone(
      contact.stage
    );

  const health =
    buildLeadHealth(
      contact
    );

  const activities =
    buildContactActivity(
      contact
    );

  const campaignPath =
    contact.campaignId
      ? `/app/campaigns/${contact.campaignId}`
      : "/app/campaigns";

  return (
    <div
      className="rfcx-drawer-backdrop"
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <aside
        className="rfcx-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Contact details for ${contact.name}`}
      >
        <header className="rfcx-drawer-top">
          <span className="rfcx-eyebrow">
            Contact
          </span>

          <button
            type="button"
            aria-label="Close contact details"
            onClick={
              onClose
            }
          >
            <X size={16} />
          </button>
        </header>

        <section className="rfcx-profile">
          <span
            className={`rfcx-profile-avatar ${getAvatarTone(
              contact.name
            )}`}
          >
            {getInitials(
              contact.name
            )}
          </span>

          <h2>
            {contact.name}
          </h2>

          <p>
            {contact.company}
          </p>

          <StagePill
            stage={
              contact.stage
            }
          />

          <div className="rfcx-profile-actions">
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                title="Email contact"
              >
                <Mail size={15} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="No email address"
              >
                <Mail size={15} />
              </button>
            )}

            {contact.phone ? (
              <a
                href={`tel:${contact.phone}`}
                title="Call contact"
              >
                <Phone size={15} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="No phone number"
              >
                <Phone size={15} />
              </button>
            )}

            {contact.website ? (
              <a
                href={normalizeWebsiteUrl(
                  contact.website
                )}
                target="_blank"
                rel="noreferrer"
                title="Open website"
              >
                <Globe2 size={15} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="No website"
              >
                <Globe2 size={15} />
              </button>
            )}
          </div>
        </section>

        <section className="rfcx-drawer-section">
          <div className="rfcx-drawer-section-head">
            <span>
              Lead Health
            </span>

            <span
              className={`rfcx-health-label ${stageTone}`}
            >
              {health.label}
            </span>
          </div>

          <div className="rfcx-health-card">
            <div
              className="rfcx-health-ring"
              style={{
                "--rfcx-score":
                  health.score,
              }}
            >
              <span>
                {health.score}
              </span>
            </div>

            <div>
              <strong>
                Engagement Score
              </strong>

              <p>
                {health.copy}
              </p>
            </div>
          </div>
        </section>

        <section className="rfcx-drawer-section">
          <div className="rfcx-drawer-section-head">
            <span>
              Details
            </span>
          </div>

          <dl className="rfcx-details">
            <DetailRow
              label="Company"
              value={
                contact.company
              }
            />

            <DetailRow
              label="Location"
              value={
                contact.location ||
                contact.address ||
                "—"
              }
            />

            <DetailRow
              label="Stage"
              value={
                titleCase(
                  contact.stage
                )
              }
            />

            <DetailRow
              label="Owner"
              value={
                contact.owner
              }
            />

            <DetailRow
              label="Campaign"
              value={
                contact.campaignName ||
                "—"
              }
            />

            <DetailRow
              label="Source"
              value={
                contact.source ||
                "Campaign lead"
              }
            />
          </dl>
        </section>

        <section className="rfcx-drawer-section">
          <div className="rfcx-drawer-section-head">
            <span>
              Contact
            </span>
          </div>

          <div className="rfcx-contact-lines">
            <ContactLine
              icon={
                <Mail size={14} />
              }
              label="Email"
              value={
                contact.email ||
                "Not available"
              }
              href={
                contact.email
                  ? `mailto:${contact.email}`
                  : ""
              }
            />

            <ContactLine
              icon={
                <Phone size={14} />
              }
              label="Phone"
              value={
                contact.phone
                  ? formatPhone(
                      contact.phone
                    )
                  : "Not available"
              }
              href={
                contact.phone
                  ? `tel:${contact.phone}`
                  : ""
              }
            />

            <ContactLine
              icon={
                <Globe2 size={14} />
              }
              label="Website"
              value={
                contact.website ||
                "Not available"
              }
              href={
                contact.website
                  ? normalizeWebsiteUrl(
                      contact.website
                    )
                  : ""
              }
              external={
                Boolean(
                  contact.website
                )
              }
            />

            <ContactLine
              icon={
                <MapPin size={14} />
              }
              label="Address"
              value={
                contact.address ||
                contact.location ||
                "Not available"
              }
            />
          </div>
        </section>

        <section className="rfcx-drawer-section grow">
          <div className="rfcx-drawer-section-head">
            <span>
              Recent Activity
            </span>
          </div>

          {activities.length ? (
            <div className="rfcx-activity-list">
              {activities.map(
                (
                  activity,
                  index
                ) => (
                  <DrawerActivity
                    key={`${activity.type}-${activity.at || index}`}
                    activity={
                      activity
                    }
                    last={
                      index ===
                      activities.length -
                        1
                    }
                  />
                )
              )}
            </div>
          ) : (
            <div className="rfcx-drawer-empty">
              <Clock3 size={18} />

              <span>
                No timestamped activity is available for this contact yet.
              </span>
            </div>
          )}
        </section>

        <footer className="rfcx-drawer-footer">
          <Link
            to={
              campaignPath
            }
            className="rfcx-btn rfcx-btn-secondary"
            onClick={
              onClose
            }
          >
            <Building2 size={14} />
            Campaign
          </Link>

          <Link
            to="/app/audits"
            className="rfcx-btn rfcx-btn-secondary"
            onClick={
              onClose
            }
          >
            <Star size={14} />
            AI Audit
          </Link>

          <Link
            to={
              contact.phone
                ? `/app/dialer?search=${encodeURIComponent(
                    contact.phone
                  )}`
                : "/app/dialer"
            }
            className="rfcx-btn rfcx-btn-primary"
            onClick={
              onClose
            }
          >
            <Phone size={14} />
            Dialer
          </Link>
        </footer>
      </aside>
    </div>
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

function ContactLine({
  icon,
  label,
  value,
  href = "",
  external = false,
}) {
  const content = (
    <>
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

      {href ? (
        <ChevronRight size={13} />
      ) : null}
    </>
  );

  if (href) {
    return (
      <a
        className="rfcx-contact-line"
        href={
          href
        }
        target={
          external
            ? "_blank"
            : undefined
        }
        rel={
          external
            ? "noreferrer"
            : undefined
        }
      >
        {content}
      </a>
    );
  }

  return (
    <div className="rfcx-contact-line disabled">
      {content}
    </div>
  );
}

function DrawerActivity({
  activity,
  last,
}) {
  const Icon =
    activity.icon;

  return (
    <div className="rfcx-drawer-activity">
      <div className="rfcx-activity-rail">
        <span
          className={
            activity.tone
          }
        >
          <Icon size={12} />
        </span>

        {!last ? (
          <i />
        ) : null}
      </div>

      <div>
        <strong>
          {activity.title}
        </strong>

        <small>
          {activity.at
            ? formatRelativeOrDate(
                activity.at
              )
            : activity.copy}
        </small>

        {activity.copy &&
        activity.at ? (
          <p>
            {activity.copy}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ContactsSkeleton() {
  return (
    <div
      className="rfcx-skeleton"
      aria-busy="true"
      aria-label="Loading contacts"
    >
      <div className="rfcx-skeleton-head">
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
        length: 7,
      }).map(
        (
          _,
          row
        ) => (
          <div
            className="rfcx-skeleton-row"
            key={
              row
            }
          >
            <i />
            <i className="identity" />
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

function ContactsEmpty({
  hasSearch,
  hasFilters,
  onReset,
}) {
  return (
    <div className="rfcx-empty">
      <span>
        <Users size={26} />
      </span>

      <h2>
        {hasSearch ||
        hasFilters
          ? "No matching contacts"
          : "No contacts yet"}
      </h2>

      <p>
        {hasSearch ||
        hasFilters
          ? "Try another search or reset your CRM filters."
          : "Launch a campaign or import a lead list and discovered contacts will appear here."}
      </p>

      <div>
        {hasSearch ||
        hasFilters ? (
          <button
            type="button"
            className="rfcx-btn rfcx-btn-secondary"
            onClick={
              onReset
            }
          >
            Reset view
          </button>
        ) : (
          <>
            <Link
              className="rfcx-btn rfcx-btn-secondary"
              to="/app/leads"
            >
              Find Leads
            </Link>

            <Link
              className="rfcx-btn rfcx-btn-primary"
              to="/app/campaigns/external-leads"
            >
              <Plus size={14} />
              Add Contacts
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function ContactPagination({
  page,
  count,
  onChange,
}) {
  if (
    count <= 1
  ) {
    return null;
  }

  const values =
    buildPagination(
      page,
      count
    );

  return (
    <nav
      className="rfcx-pagination"
      aria-label="Contact pages"
    >
      <button
        type="button"
        aria-label="Previous contacts"
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

      {values.map(
        (
          value,
          index
        ) =>
          value ===
          "…" ? (
            <span
              key={`ellipsis-${index}`}
            >
              …
            </span>
          ) : (
            <button
              type="button"
              key={
                value
              }
              className={
                value ===
                page
                  ? "active"
                  : ""
              }
              aria-current={
                value ===
                page
                  ? "page"
                  : undefined
              }
              onClick={() =>
                onChange(
                  value
                )
              }
            >
              {value}
            </button>
          )
      )}

      <button
        type="button"
        aria-label="Next contacts"
        disabled={
          page >=
          count
        }
        onClick={() =>
          onChange(
            Math.min(
              count,
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

/* ==========================================================================
 * Contact data normalization
 * ======================================================================= */

function normalizeContactsResponse(
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
      response?.contacts
    )
  ) {
    return response.contacts;
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
      response?.leads
    )
  ) {
    return response.leads;
  }

  return [];
}

function normalizeContact(
  raw = {},
  index = 0
) {
  const name =
    firstString(
      raw.contactName,
      raw.fullName,
      raw.personName,
      raw.leadName,
      raw.name,
      raw.business,
      raw.companyName,
      "Unknown contact"
    );

  const company =
    firstString(
      raw.companyName,
      raw.business,
      raw.organization,
      raw.accountName,
      raw.name,
      "Unknown company"
    );

  const email =
    firstString(
      raw.email,
      raw.contactEmail,
      raw.workEmail,
      raw.primaryEmail
    );

  const phone =
    firstString(
      raw.phone,
      raw.phoneNumber,
      raw.mobile,
      raw.contactPhone,
      raw.primaryPhone
    );

  const website =
    firstString(
      raw.website,
      raw.websiteUrl,
      raw.domain,
      raw.companyWebsite
    );

  const stage =
    normalizeStatus(
      firstString(
        raw.pipelineStage,
        raw.pipelineStatus,
        raw.dealStage,
        raw.stage,
        raw.leadStatus,
        raw.status,
        raw.lastCallOutcome,
        "new"
      )
    ) || "new";

  const owner =
    firstString(
      raw.ownerName,
      raw.assignedToName,
      raw.assigneeName,
      raw.assignedUserName,
      raw.owner?.name,
      raw.assignee?.name,
      raw.assignedUser?.name,
      "Unassigned"
    );

  const campaignName =
    firstString(
      raw.campaignName,
      raw.campaign?.name,
      raw.campaignTitle
    );

  const campaignId =
    firstString(
      raw.campaignId,
      raw.campaign?.id
    );

  const createdAt =
    firstDateValue(
      raw.createdAt,
      raw.discoveredAt,
      raw.importedAt,
      raw.addedAt
    );

  const lastContactAt =
    firstDateValue(
      raw.lastContactAt,
      raw.lastActivityAt,
      raw.lastCallAt,
      raw.callCompletedAt,
      raw.repliedAt,
      raw.replyAt,
      raw.emailSentAt,
      raw.sentAt,
      raw.updatedAt,
      createdAt
    );

  const nextActionAt =
    firstDateValue(
      raw.nextActionAt,
      raw.followUpAt,
      raw.callbackAt,
      raw.scheduledAt,
      raw.task?.dueAt,
      raw.task?.dueDate,
      raw.meeting?.startAt
    );

  const nextActivityType =
    inferNextActivityType(
      raw
    );

  const nextActivityLabel =
    firstString(
      raw.nextActivityLabel,
      raw.nextActionLabel,
      raw.task?.title,
      raw.nextAction,
      nextActionAt
        ? buildNextActivityLabel(
            nextActivityType,
            nextActionAt
          )
        : ""
    );

  const address =
    firstString(
      raw.address,
      raw.formattedAddress,
      raw.companyAddress
    );

  const location =
    firstString(
      raw.location,
      raw.city,
      raw.region,
      raw.area
    );

  const source =
    firstString(
      raw.source,
      raw.leadSource,
      raw.provider,
      raw.importSource,
      campaignName
        ? "Campaign"
        : "ReachFly"
    );

  const tags =
    Array.isArray(
      raw.tags
    )
      ? raw.tags
          .map(
            (tag) =>
              String(tag)
          )
          .filter(Boolean)
      : [];

  const key =
    String(
      raw.id ||
        raw.contactId ||
        raw.leadId ||
        raw.placeId ||
        raw.externalId ||
        `${name}-${campaignId || campaignName || index}-${index}`
    );

  return {
    key,
    raw,
    name,
    company,
    email,
    phone,
    website,
    stage,
    owner,
    campaignName,
    campaignId,
    createdAt,
    createdAtMs:
      getTimestamp(
        createdAt
      ),
    lastContactAt,
    lastContactAtMs:
      getTimestamp(
        lastContactAt
      ),
    nextActionAt,
    nextActivityType,
    nextActivityLabel,
    address,
    location,
    source,
    tags,
    rating:
      finiteNumberOrNull(
        raw.rating
      ),
    reviews:
      finiteNumberOrNull(
        raw.reviews ??
          raw.reviewCount
      ),
    matchScore:
      clampScore(
        finiteNumberOrNull(
          raw.qualityScore ??
            raw.matchScore ??
            raw.confidence
        )
      ),
  };
}

function buildContactStats(
  contacts,
  user
) {
  return {
    total:
      contacts.length,
    mine:
      contacts.filter(
        (contact) =>
          isMyContact(
            contact,
            user
          )
      ).length,
    newThisWeek:
      contacts.filter(
        isNewThisWeek
      ).length,
    reachable:
      contacts.filter(
        (contact) =>
          Boolean(
            contact.email ||
              contact.phone
          )
      ).length,
  };
}

function isMyContact(
  contact,
  user
) {
  const identifiers =
    [
      user?.id,
      user?.name,
      user?.email,
    ]
      .filter(Boolean)
      .map(
        (value) =>
          String(value)
            .trim()
            .toLowerCase()
      );

  const rawOwnerValues =
    [
      contact.owner,
      contact.raw?.ownerId,
      contact.raw?.assignedTo,
      contact.raw?.assigneeId,
      contact.raw?.assignedUserId,
      contact.raw?.owner?.id,
      contact.raw?.owner?.email,
      contact.raw?.assignee?.id,
      contact.raw?.assignee?.email,
      contact.raw?.assignedUser?.id,
      contact.raw?.assignedUser?.email,
    ]
      .filter(Boolean)
      .map(
        (value) =>
          String(value)
            .trim()
            .toLowerCase()
      );

  return rawOwnerValues.some(
    (value) =>
      identifiers.includes(
        value
      )
  );
}

function isNewThisWeek(
  contact
) {
  const timestamp =
    contact.createdAtMs;

  if (!timestamp) {
    return false;
  }

  const age =
    Date.now() -
    timestamp;

  return (
    age >=
      0 &&
    age <=
      7 *
        24 *
        60 *
        60 *
        1000
  );
}

function buildLeadHealth(
  contact
) {
  let score = 30;

  if (
    contact.email
  ) {
    score += 15;
  }

  if (
    contact.phone
  ) {
    score += 15;
  }

  if (
    contact.website
  ) {
    score += 8;
  }

  if (
    contact.owner !==
    "Unassigned"
  ) {
    score += 7;
  }

  const stage =
    normalizeStatus(
      contact.stage
    );

  if (
    [
      "interested",
      "qualified",
      "proposal",
      "meeting_booked",
      "customer",
      "won",
    ].includes(
      stage
    )
  ) {
    score += 20;
  }

  if (
    contact.nextActionAt
  ) {
    score += 5;
  }

  if (
    contact.matchScore !==
    null
  ) {
    score =
      Math.round(
        (
          score +
          contact.matchScore
        ) /
          2
      );
  }

  score =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );

  const label =
    score >= 80
      ? "Hot Lead"
      : score >=
          60
        ? "Warm Lead"
        : "Developing";

  const copy =
    score >= 80
      ? "Strong contactability and positive CRM signals."
      : score >=
          60
        ? "Good relationship data with room for additional engagement."
        : "Add contact details, ownership, and a next activity to strengthen this relationship.";

  return {
    score,
    label,
    copy,
  };
}

function buildContactActivity(
  contact
) {
  const raw =
    contact.raw ||
    {};

  const activities = [];

  pushActivity(
    activities,
    {
      type: "meeting",
      at:
        raw.meetingBookedAt ||
        raw.meeting?.createdAt ||
        raw.meeting?.startAt,
      title:
        "Meeting booked",
      copy:
        raw.meeting?.title ||
        raw.meetingTitle ||
        "",
      icon:
        Calendar,
      tone:
        "success",
    }
  );

  pushActivity(
    activities,
    {
      type: "reply",
      at:
        raw.repliedAt ||
        raw.replyAt ||
        raw.responseAt,
      title:
        "Reply received",
      copy:
        raw.replyPreview ||
        raw.lastReply ||
        "",
      icon:
        MessageCircle,
      tone:
        "primary",
    }
  );

  pushActivity(
    activities,
    {
      type: "call",
      at:
        raw.lastCallAt ||
        raw.callCompletedAt ||
        raw.callStartedAt,
      title:
        raw.lastCallOutcome
          ? `Call · ${titleCase(
              raw.lastCallOutcome
            )}`
          : "Call activity",
      copy:
        raw.callSummary ||
        raw.lastCall?.summary ||
        "",
      icon:
        Phone,
      tone:
        "violet",
    }
  );

  pushActivity(
    activities,
    {
      type: "email",
      at:
        raw.emailSentAt ||
        raw.sentAt,
      title:
        "Email sent",
      copy:
        raw.emailSubject ||
        raw.subject ||
        "",
      icon:
        Mail,
      tone:
        "neutral",
    }
  );

  pushActivity(
    activities,
    {
      type: "created",
      at:
        contact.createdAt,
      title:
        "Contact added to ReachFly",
      copy:
        contact.campaignName
          ? `From ${contact.campaignName}`
          : contact.source,
      icon:
        Users,
      tone:
        "neutral",
    }
  );

  return activities
    .filter(
      (activity) =>
        activity.at
    )
    .sort(
      (
        left,
        right
      ) =>
        getTimestamp(
          right.at
        ) -
        getTimestamp(
          left.at
        )
    )
    .slice(
      0,
      6
    );
}

function pushActivity(
  collection,
  activity
) {
  if (
    activity.at
  ) {
    collection.push(
      activity
    );
  }
}

function inferNextActivityType(
  raw
) {
  const source =
    normalizeStatus(
      firstString(
        raw.nextActivityType,
        raw.nextActionType,
        raw.task?.type,
        raw.nextAction
      )
    );

  if (
    source.includes(
      "call"
    ) ||
    source.includes(
      "callback"
    )
  ) {
    return "call";
  }

  if (
    source.includes(
      "meeting"
    )
  ) {
    return "meeting";
  }

  if (
    source.includes(
      "email"
    ) ||
    source.includes(
      "proposal"
    ) ||
    source.includes(
      "send"
    )
  ) {
    return "email";
  }

  return source ||
    "task";
}

function buildNextActivityLabel(
  type,
  value
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const today =
    new Date();

  const tomorrow =
    new Date();

  tomorrow.setDate(
    today.getDate() +
      1
  );

  const sameDay =
    date.toDateString() ===
    today.toDateString();

  const nextDay =
    date.toDateString() ===
    tomorrow.toDateString();

  const verb =
    type ===
      "call"
      ? "Call"
      : type ===
          "meeting"
        ? "Meeting"
        : type ===
            "email"
          ? "Email"
          : "Follow up";

  if (sameDay) {
    return `${verb} today`;
  }

  if (nextDay) {
    return `${verb} tomorrow`;
  }

  return `${verb} ${date.toLocaleDateString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
    }
  )}`;
}

function getNextActivityIcon(
  type
) {
  if (
    type ===
    "call"
  ) {
    return Phone;
  }

  if (
    type ===
    "meeting"
  ) {
    return Calendar;
  }

  if (
    type ===
    "email"
  ) {
    return Mail;
  }

  return Clock3;
}

function getStageTone(
  stage
) {
  const value =
    normalizeStatus(
      stage
    );

  if (
    [
      "customer",
      "won",
      "meeting_booked",
    ].includes(
      value
    )
  ) {
    return "success";
  }

  if (
    [
      "qualified",
      "proposal",
    ].includes(
      value
    )
  ) {
    return "primary";
  }

  if (
    [
      "interested",
      "replied",
      "connected",
    ].includes(
      value
    )
  ) {
    return "info";
  }

  if (
    [
      "callback",
      "follow_up",
      "call_due",
      "send_information",
      "queued",
    ].includes(
      value
    )
  ) {
    return "warning";
  }

  if (
    [
      "not_interested",
      "do_not_call",
      "do_not_contact",
      "wrong_number",
      "invalid_number",
      "failed",
      "bounced",
      "lost",
    ].includes(
      value
    )
  ) {
    return "danger";
  }

  return "neutral";
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

function buildPagination(
  page,
  count
) {
  if (
    count <= 7
  ) {
    return Array.from(
      {
        length:
          count,
      },
      (
        _,
        index
      ) =>
        index + 1
    );
  }

  const output = [
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
    output.push(
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
    output.push(
      value
    );
  }

  if (
    end <
    count - 1
  ) {
    output.push(
      "…"
    );
  }

  output.push(
    count
  );

  return output;
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

    const string =
      String(value)
        .trim();

    if (string) {
      return string;
    }
  }

  return "";
}

function firstDateValue(
  ...values
) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const date =
      new Date(value);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date.toISOString();
    }
  }

  return "";
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

function finiteNumberOrNull(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function clampScore(
  value
) {
  if (
    value ===
    null
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        value
      )
    )
  );
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

  return role ||
    "caller";
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
    return "0";
  }

  return new Intl.NumberFormat().format(
    Math.round(
      number
    )
  );
}

function formatPhone(
  value
) {
  const string =
    String(
      value ||
      ""
    ).trim();

  const digits =
    string.replace(
      /\D/g,
      ""
    );

  if (
    digits.length ===
    10
  ) {
    return `(${digits.slice(
      0,
      3
    )}) ${digits.slice(
      3,
      6
    )}-${digits.slice(
      6
    )}`;
  }

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

  return string;
}

function formatRelativeOrDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

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

    return `${hours} hour${
      hours ===
      1
        ? ""
        : "s"
    } ago`;
  }

  if (
    delta >=
      0 &&
    delta <
      7 *
        24 *
        60 *
        60 *
        1000
  ) {
    const days =
      Math.max(
        1,
        Math.floor(
          delta /
            (
              24 *
              60 *
              60 *
              1000
            )
        )
      );

    return `${days} day${
      days ===
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
      year:
        date.getFullYear() ===
        new Date().getFullYear()
          ? undefined
          : "numeric",
    }
  );
}

function normalizeWebsiteUrl(
  value
) {
  const string =
    String(
      value ||
      ""
    ).trim();

  if (
    /^https?:\/\//i.test(
      string
    )
  ) {
    return string;
  }

  return `https://${string}`;
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

function downloadCsv(
  rows,
  filename
) {
  const safeRows =
    Array.isArray(
      rows
    )
      ? rows
      : [];

  if (
    safeRows.length ===
    0
  ) {
    notify(
      "warning",
      "Nothing to export",
      "No contacts are available in the current view."
    );
    return;
  }

  const headers =
    Object.keys(
      safeRows[0]
    );

  const csv =
    [
      headers.map(
        csvEscape
      ).join(","),
      ...safeRows.map(
        (row) =>
          headers
            .map(
              (header) =>
                csvEscape(
                  row[
                    header
                  ]
                )
            )
            .join(",")
      ),
    ].join("\n");

  const blob =
    new Blob(
      [
        "\uFEFF",
        csv,
      ],
      {
        type:
          "text/csv;charset=utf-8",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;
  anchor.download =
    filename;

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url
  );
}

function csvEscape(
  value
) {
  const string =
    String(
      value ??
        ""
    );

  if (
    /[",\n\r]/.test(
      string
    )
  ) {
    return `"${string.replace(
      /"/g,
      '""'
    )}"`;
  }

  return string;
}

function formatFileDate(
  date
) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      "0"
    ),
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
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
 * Scoped Stitch design / animations
 * ======================================================================= */

function ContactsStyles() {
  return (
    <style>{`
      .rf-contacts-v7{
        --rfcx-bg:#f8f9fa;
        --rfcx-card:#fff;
        --rfcx-soft:#f3f4f5;
        --rfcx-high:#e7e8e9;
        --rfcx-text:#191c1d;
        --rfcx-text-soft:#464554;
        --rfcx-muted:#767586;
        --rfcx-outline:#e5e7eb;
        --rfcx-outline-strong:#c7c4d7;
        --rfcx-primary:#4648d4;
        --rfcx-primary-dark:#3537bb;
        --rfcx-primary-soft:#e8e9ff;
        --rfcx-violet:#6b38d4;
        --rfcx-violet-soft:#f0eaff;
        --rfcx-success:#087a51;
        --rfcx-success-soft:#dcfce7;
        --rfcx-info:#0369a1;
        --rfcx-info-soft:#e0f2fe;
        --rfcx-warning:#8a6100;
        --rfcx-warning-soft:#fff4d6;
        --rfcx-danger:#ba1a1a;
        --rfcx-danger-soft:#ffedeb;
        --rfcx-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:26px 24px 38px;
        color:var(--rfcx-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfcxPageIn 260ms var(--rfcx-ease);
      }

      .rf-contacts-v7 *,
      .rf-contacts-v7 *::before,
      .rf-contacts-v7 *::after{
        box-sizing:border-box;
      }

      .rf-contacts-v7 a{
        color:inherit;
      }

      .rf-contacts-v7 .spin{
        animation:rfcxSpin 800ms linear infinite;
      }

      @keyframes rfcxPageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfcxFadeUp{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfcxScaleIn{
        from{opacity:0;transform:scale(.985)}
        to{opacity:1;transform:scale(1)}
      }

      @keyframes rfcxPopoverIn{
        from{opacity:0;transform:translate3d(0,-5px,0) scale(.985)}
        to{opacity:1;transform:translate3d(0,0,0) scale(1)}
      }

      @keyframes rfcxDrawerIn{
        from{opacity:0;transform:translate3d(28px,0,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfcxBackdropIn{
        from{opacity:0}
        to{opacity:1}
      }

      @keyframes rfcxSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfcxShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfcx-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:24px;
        margin-bottom:18px;
      }

      .rfcx-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfcx-primary);
        font-size:9px;
        font-weight:750;
        line-height:13px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfcx-header h1,
      .rfcx-access h1{
        margin:0;
        color:var(--rfcx-text);
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfcx-header p,
      .rfcx-access p{
        margin:4px 0 0;
        color:var(--rfcx-text-soft);
        font-size:13px;
        line-height:19px;
      }

      .rfcx-header-actions{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rfcx-btn{
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
        font:600 11px/17px Inter,sans-serif;
        transition:
          color 140ms var(--rfcx-ease),
          background 140ms var(--rfcx-ease),
          border-color 140ms var(--rfcx-ease),
          transform 140ms var(--rfcx-ease),
          box-shadow 140ms var(--rfcx-ease);
      }

      .rfcx-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfcx-btn:active:not(:disabled){
        transform:translateY(0) scale(.985);
      }

      .rfcx-btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfcx-btn-primary{
        color:#fff!important;
        background:var(--rfcx-primary);
        border-color:var(--rfcx-primary);
        box-shadow:0 4px 12px rgba(70,72,212,.17);
      }

      .rfcx-btn-primary:hover:not(:disabled){
        background:var(--rfcx-primary-dark);
        border-color:var(--rfcx-primary-dark);
      }

      .rfcx-btn-secondary{
        color:var(--rfcx-text)!important;
        background:var(--rfcx-soft);
        border-color:var(--rfcx-soft);
      }

      .rfcx-btn-secondary:hover:not(:disabled){
        color:var(--rfcx-primary)!important;
        background:var(--rfcx-primary-soft);
      }

      .rfcx-metrics{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin-bottom:16px;
      }

      .rfcx-metric{
        display:flex;
        align-items:center;
        gap:11px;
        min-height:74px;
        padding:14px 16px;
        background:#fff;
        border:1px solid var(--rfcx-outline);
        border-radius:12px;
        animation:rfcxScaleIn 260ms var(--rfcx-ease) both;
      }

      .rfcx-metric:nth-child(2){animation-delay:35ms}
      .rfcx-metric:nth-child(3){animation-delay:70ms}
      .rfcx-metric:nth-child(4){animation-delay:105ms}

      .rfcx-metric-icon{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        flex:0 0 34px;
        color:var(--rfcx-primary);
        background:var(--rfcx-primary-soft);
        border-radius:9px;
      }

      .rfcx-metric.violet .rfcx-metric-icon{
        color:var(--rfcx-violet);
        background:var(--rfcx-violet-soft);
      }

      .rfcx-metric.success .rfcx-metric-icon{
        color:var(--rfcx-success);
        background:var(--rfcx-success-soft);
      }

      .rfcx-metric.neutral .rfcx-metric-icon{
        color:#596171;
        background:#eef1f5;
      }

      .rfcx-metric > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfcx-metric > div > span{
        color:var(--rfcx-muted);
        font-size:8px;
        font-weight:700;
        line-height:12px;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .rfcx-metric strong{
        color:var(--rfcx-text);
        font:600 20px/25px Geist,Inter,sans-serif;
      }

      .rfcx-toolbar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        padding:6px 8px;
        margin-bottom:14px;
        background:var(--rfcx-soft);
        border-radius:12px;
      }

      .rfcx-tabs{
        display:flex;
        align-items:center;
        gap:3px;
        min-width:0;
      }

      .rfcx-tabs button{
        min-height:34px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:6px 12px;
        color:var(--rfcx-text-soft);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font:600 10px/14px Inter,sans-serif;
        transition:
          color 140ms var(--rfcx-ease),
          background 140ms var(--rfcx-ease),
          transform 140ms var(--rfcx-ease);
      }

      .rfcx-tabs button:hover{
        color:var(--rfcx-primary);
        background:rgba(255,255,255,.72);
      }

      .rfcx-tabs button.active{
        color:var(--rfcx-text);
        background:#dce2ff;
        box-shadow:0 1px 2px rgba(25,28,29,.03);
      }

      .rfcx-tabs button span{
        min-width:18px;
        height:18px;
        display:grid;
        place-items:center;
        padding:0 4px;
        color:inherit;
        background:rgba(255,255,255,.65);
        border-radius:999px;
        font-size:7px;
        font-weight:750;
      }

      .rfcx-tabs button:active{
        transform:scale(.98);
      }

      .rfcx-toolbar-actions{
        display:flex;
        align-items:center;
        gap:7px;
        min-width:0;
      }

      .rfcx-filter-anchor{
        position:relative;
      }

      .rfcx-filter-btn,
      .rfcx-icon-btn{
        appearance:none;
        min-height:36px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:6px 9px;
        color:var(--rfcx-text-soft);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font:600 9px/14px Inter,sans-serif;
        transition:
          color 140ms var(--rfcx-ease),
          background 140ms var(--rfcx-ease);
      }

      .rfcx-filter-btn:hover,
      .rfcx-filter-btn.active,
      .rfcx-icon-btn:hover:not(:disabled){
        color:var(--rfcx-primary);
        background:#fff;
      }

      .rfcx-filter-btn > span{
        min-width:17px;
        height:17px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfcx-primary);
        border-radius:999px;
        font-size:7px;
      }

      .rfcx-icon-btn{
        width:36px;
        justify-content:center;
        padding:0;
      }

      .rfcx-icon-btn:disabled{
        opacity:.45;
      }

      .rfcx-search{
        width:min(330px,31vw);
        height:38px;
        display:flex;
        align-items:center;
        gap:7px;
        padding:0 10px;
        color:var(--rfcx-muted);
        background:#fff;
        border:1px solid transparent;
        border-radius:9px;
        transition:
          border-color 140ms var(--rfcx-ease),
          box-shadow 140ms var(--rfcx-ease);
      }

      .rfcx-search:focus-within{
        border-color:rgba(70,72,212,.4);
        box-shadow:0 0 0 3px rgba(70,72,212,.08);
      }

      .rfcx-search input{
        min-width:0;
        flex:1;
        height:36px;
        padding:0;
        color:var(--rfcx-text);
        background:transparent;
        border:0;
        outline:0;
        font:400 10px/15px Inter,sans-serif;
      }

      .rfcx-search button,
      .rfcx-popover-head button{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfcx-muted);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
      }

      .rfcx-search button:hover,
      .rfcx-popover-head button:hover{
        color:var(--rfcx-text);
        background:var(--rfcx-soft);
      }

      .rfcx-filter-popover{
        position:absolute;
        z-index:60;
        top:43px;
        left:0;
        width:min(330px,calc(100vw - 28px));
        padding:15px;
        background:#fff;
        border:1px solid var(--rfcx-outline);
        border-radius:13px;
        box-shadow:
          0 18px 44px rgba(25,28,29,.13),
          0 4px 10px rgba(25,28,29,.05);
        animation:rfcxPopoverIn 170ms var(--rfcx-ease);
      }

      .rfcx-popover-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:10px;
        padding-bottom:11px;
        margin-bottom:11px;
        border-bottom:1px solid var(--rfcx-outline);
      }

      .rfcx-popover-head > div{
        display:grid;
        gap:1px;
      }

      .rfcx-popover-head strong{
        color:var(--rfcx-text);
        font:600 11px/16px Geist,Inter,sans-serif;
      }

      .rfcx-popover-head span{
        color:var(--rfcx-muted);
        font-size:8px;
        line-height:12px;
      }

      .rfcx-field{
        display:grid;
        gap:5px;
        margin-bottom:10px;
      }

      .rfcx-field > span{
        color:var(--rfcx-text-soft);
        font-size:8px;
        font-weight:700;
        line-height:12px;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .rfcx-field select{
        width:100%;
        height:37px;
        padding:0 9px;
        color:var(--rfcx-text);
        background:#fff;
        border:1px solid var(--rfcx-outline);
        border-radius:7px;
        outline:0;
        font-size:9px;
      }

      .rfcx-field select:focus{
        border-color:rgba(70,72,212,.45);
        box-shadow:0 0 0 3px rgba(70,72,212,.08);
      }

      .rfcx-popover-actions{
        display:flex;
        justify-content:flex-end;
        gap:7px;
        padding-top:11px;
        margin-top:2px;
        border-top:1px solid var(--rfcx-outline);
      }

      .rfcx-popover-actions button{
        min-height:33px;
        padding:6px 10px;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:9px;
        font-weight:700;
      }

      .rfcx-popover-actions button.ghost{
        color:var(--rfcx-text-soft);
        background:transparent;
      }

      .rfcx-popover-actions button.primary{
        color:#fff;
        background:var(--rfcx-primary);
      }

      .rfcx-bulk-bar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:9px 12px;
        margin:-2px 0 10px;
        color:#fff;
        background:var(--rfcx-primary);
        border-radius:9px;
        animation:rfcxFadeUp 180ms var(--rfcx-ease);
      }

      .rfcx-bulk-bar > div:first-child{
        display:flex;
        align-items:center;
        gap:7px;
        min-width:0;
      }

      .rfcx-bulk-check{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        flex:0 0 25px;
        background:rgba(255,255,255,.14);
        border-radius:7px;
      }

      .rfcx-bulk-bar strong{
        font-size:10px;
        line-height:14px;
      }

      .rfcx-bulk-bar > div:first-child > span:last-child{
        overflow:hidden;
        opacity:.85;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
      }

      .rfcx-bulk-actions{
        display:flex;
        gap:4px;
      }

      .rfcx-bulk-actions button{
        min-height:29px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:5px 8px;
        color:#fff;
        background:rgba(255,255,255,.10);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:8px;
        font-weight:700;
      }

      .rfcx-bulk-actions button:hover{
        background:rgba(255,255,255,.18);
      }

      .rfcx-message{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        animation:rfcxFadeUp 180ms var(--rfcx-ease);
      }

      .rfcx-message.error{
        color:#7c1616;
        background:var(--rfcx-danger-soft);
        border-color:#ffd0cc;
      }

      .rfcx-message > span{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        flex:0 0 26px;
        background:rgba(255,255,255,.7);
        border-radius:7px;
      }

      .rfcx-message > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:1px;
      }

      .rfcx-message strong{
        font-size:10px;
        line-height:14px;
      }

      .rfcx-message small{
        font-size:9px;
        line-height:14px;
      }

      .rfcx-message > button{
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

      .rfcx-table-card{
        min-height:480px;
        overflow:visible;
        background:#fff;
        border:1px solid var(--rfcx-outline);
        border-radius:14px;
      }

      .rfcx-table-wrap{
        width:100%;
        overflow:auto;
        border-radius:14px 14px 0 0;
      }

      .rfcx-table{
        width:100%;
        min-width:1180px;
        border-collapse:separate;
        border-spacing:0;
        text-align:left;
        white-space:nowrap;
      }

      .rfcx-table thead th{
        padding:11px 13px;
        color:var(--rfcx-text-soft);
        background:var(--rfcx-soft);
        border-bottom:1px solid var(--rfcx-outline);
        font-size:9px;
        font-weight:600;
        line-height:13px;
        letter-spacing:.02em;
      }

      .rfcx-table thead th:first-child,
      .rfcx-table tbody td:first-child{
        padding-left:16px;
      }

      .rfcx-table thead th:last-child,
      .rfcx-table tbody td:last-child{
        padding-right:16px;
      }

      .rfcx-table th.select,
      .rfcx-table td.select{
        width:42px;
        text-align:center;
      }

      .rfcx-table th.actions,
      .rfcx-table td.actions{
        width:42px;
        text-align:right;
      }

      .rfcx-table tbody tr{
        cursor:pointer;
        animation:rfcxFadeUp 230ms var(--rfcx-ease) both;
        animation-delay:calc(var(--rfcx-row-index) * 22ms);
        transition:
          background 140ms var(--rfcx-ease),
          box-shadow 140ms var(--rfcx-ease);
      }

      .rfcx-table tbody tr + tr td{
        border-top:1px solid #f1f2f3;
      }

      .rfcx-table tbody tr:hover{
        background:#fafafd;
        box-shadow:inset 3px 0 0 rgba(70,72,212,.55);
      }

      .rfcx-table tbody tr.selected{
        background:#f4f4ff;
        box-shadow:inset 3px 0 0 var(--rfcx-primary);
      }

      .rfcx-table tbody td{
        height:60px;
        padding:10px 13px;
        color:var(--rfcx-text);
        vertical-align:middle;
        font-size:10px;
        line-height:15px;
      }

      .rfcx-table td.muted{
        color:var(--rfcx-text-soft);
      }

      .rfcx-table td.muted > a{
        color:inherit;
        text-decoration:none;
      }

      .rfcx-table td.muted > a:hover{
        color:var(--rfcx-primary);
      }

      .rfcx-table td.phone{
        font-variant-numeric:tabular-nums;
      }

      .rfcx-checkbox{
        width:18px;
        height:18px;
        display:grid;
        place-items:center;
        margin:auto;
        padding:0;
        color:#fff;
        background:#fff;
        border:1px solid var(--rfcx-outline-strong);
        border-radius:5px;
        cursor:pointer;
        transition:
          background 120ms var(--rfcx-ease),
          border-color 120ms var(--rfcx-ease),
          transform 120ms var(--rfcx-ease);
      }

      .rfcx-checkbox:hover{
        border-color:var(--rfcx-primary);
      }

      .rfcx-checkbox.checked{
        background:var(--rfcx-primary);
        border-color:var(--rfcx-primary);
      }

      .rfcx-checkbox:active{
        transform:scale(.92);
      }

      .rfcx-contact-identity{
        min-width:180px;
        display:flex;
        align-items:center;
        gap:9px;
      }

      .rfcx-avatar,
      .rfcx-profile-avatar{
        display:grid;
        place-items:center;
        flex:0 0 auto;
        color:#fff;
        font-weight:750;
      }

      .rfcx-avatar{
        width:30px;
        height:30px;
        border-radius:50%;
        font-size:8px;
      }

      .rfcx-avatar.primary,
      .rfcx-profile-avatar.primary{
        background:#5b5ddd;
      }

      .rfcx-avatar.violet,
      .rfcx-profile-avatar.violet{
        background:#7546d9;
      }

      .rfcx-avatar.blue,
      .rfcx-profile-avatar.blue{
        background:#3772b9;
      }

      .rfcx-avatar.green,
      .rfcx-profile-avatar.green{
        background:#23845f;
      }

      .rfcx-avatar.amber,
      .rfcx-profile-avatar.amber{
        background:#a06e25;
      }

      .rfcx-contact-identity > span:last-child{
        min-width:0;
        display:grid;
        gap:0;
      }

      .rfcx-contact-identity strong{
        max-width:180px;
        overflow:hidden;
        color:var(--rfcx-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:10px;
        line-height:14px;
      }

      .rfcx-contact-identity small{
        max-width:180px;
        overflow:hidden;
        color:var(--rfcx-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
        line-height:11px;
      }

      .rfcx-company-cell{
        min-width:135px;
        display:flex;
        align-items:center;
        gap:6px;
      }

      .rfcx-company-cell > span{
        width:21px;
        height:21px;
        display:grid;
        place-items:center;
        flex:0 0 21px;
        color:var(--rfcx-violet);
        background:var(--rfcx-violet-soft);
        border-radius:5px;
        font-size:6px;
        font-weight:800;
      }

      .rfcx-company-cell strong{
        max-width:155px;
        overflow:hidden;
        color:var(--rfcx-text-soft);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:9px;
        font-weight:500;
      }

      .rfcx-stage,
      .rfcx-health-label{
        min-height:21px;
        display:inline-flex;
        align-items:center;
        width:max-content;
        padding:3px 7px;
        border-radius:999px;
        font-size:8px;
        font-weight:650;
        line-height:11px;
      }

      .rfcx-stage.primary,
      .rfcx-health-label.primary{
        color:#47519b;
        background:#dae2fd;
      }

      .rfcx-stage.info,
      .rfcx-health-label.info{
        color:var(--rfcx-info);
        background:var(--rfcx-info-soft);
      }

      .rfcx-stage.success,
      .rfcx-health-label.success{
        color:#166534;
        background:var(--rfcx-success-soft);
      }

      .rfcx-stage.warning,
      .rfcx-health-label.warning{
        color:var(--rfcx-warning);
        background:var(--rfcx-warning-soft);
      }

      .rfcx-stage.danger,
      .rfcx-health-label.danger{
        color:var(--rfcx-danger);
        background:var(--rfcx-danger-soft);
      }

      .rfcx-stage.neutral,
      .rfcx-health-label.neutral{
        color:#5e5d69;
        background:#eff0f1;
      }

      .rfcx-owner{
        display:inline-flex;
        align-items:center;
        gap:6px;
        max-width:130px;
      }

      .rfcx-owner i{
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        flex:0 0 22px;
        color:#fff;
        background:var(--rfcx-violet);
        border-radius:50%;
        font-size:6px;
        font-style:normal;
        font-weight:800;
      }

      .rfcx-owner > span{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfcx-unassigned{
        color:var(--rfcx-muted);
        font-size:9px;
      }

      .rfcx-next-activity{
        display:inline-flex;
        align-items:center;
        gap:5px;
        max-width:145px;
        color:var(--rfcx-primary);
      }

      .rfcx-next-activity > span{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfcx-no-activity{
        color:var(--rfcx-muted);
        font-size:9px;
        font-style:italic;
      }

      .rfcx-table td.actions > button{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        margin-left:auto;
        padding:0;
        color:var(--rfcx-muted);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        opacity:.25;
        transition:
          opacity 140ms var(--rfcx-ease),
          color 140ms var(--rfcx-ease),
          background 140ms var(--rfcx-ease);
      }

      .rfcx-table tr:hover td.actions > button{
        opacity:1;
      }

      .rfcx-table td.actions > button:hover{
        color:var(--rfcx-primary);
        background:var(--rfcx-primary-soft);
      }

      .rfcx-footer{
        min-height:57px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        padding:12px 16px;
        color:var(--rfcx-text-soft);
        border-top:1px solid var(--rfcx-outline);
        font-size:9px;
        line-height:13px;
      }

      .rfcx-footer strong{
        color:var(--rfcx-text);
        font-weight:650;
      }

      .rfcx-pagination{
        display:flex;
        align-items:center;
        gap:3px;
      }

      .rfcx-pagination button{
        min-width:28px;
        height:28px;
        display:grid;
        place-items:center;
        padding:0 6px;
        color:var(--rfcx-text-soft);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:8px;
        font-weight:650;
      }

      .rfcx-pagination button:hover:not(:disabled){
        color:var(--rfcx-primary);
        background:var(--rfcx-soft);
      }

      .rfcx-pagination button.active{
        color:#fff;
        background:var(--rfcx-primary);
      }

      .rfcx-pagination button:disabled{
        opacity:.35;
        cursor:not-allowed;
      }

      .rfcx-pagination > span{
        width:22px;
        text-align:center;
        color:var(--rfcx-muted);
        font-size:8px;
      }

      .rfcx-mobile-list{
        display:none;
      }

      .rfcx-skeleton-head,
      .rfcx-skeleton-row{
        display:grid;
        grid-template-columns:34px 1.4fr 1fr 1.2fr .9fr .8fr .9fr 1fr;
        align-items:center;
        gap:14px;
        padding:12px 16px;
      }

      .rfcx-skeleton-head{
        background:var(--rfcx-soft);
      }

      .rfcx-skeleton-row + .rfcx-skeleton-row{
        border-top:1px solid #f1f2f3;
      }

      .rfcx-skeleton i{
        height:10px;
        display:block;
        background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);
        background-size:220% 100%;
        border-radius:999px;
        animation:rfcxShimmer 1.3s linear infinite;
      }

      .rfcx-skeleton-row i.identity{
        height:30px;
        border-radius:8px;
      }

      .rfcx-empty{
        min-height:450px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:6px;
        padding:35px 20px;
        text-align:center;
        animation:rfcxFadeUp 220ms var(--rfcx-ease);
      }

      .rfcx-empty > span{
        width:52px;
        height:52px;
        display:grid;
        place-items:center;
        color:var(--rfcx-primary);
        background:var(--rfcx-primary-soft);
        border-radius:15px;
      }

      .rfcx-empty h2{
        margin:0;
        color:var(--rfcx-text);
        font:600 15px/21px Geist,Inter,sans-serif;
      }

      .rfcx-empty p{
        max-width:480px;
        margin:0;
        color:var(--rfcx-text-soft);
        font-size:10px;
        line-height:15px;
      }

      .rfcx-empty > div{
        display:flex;
        gap:7px;
        margin-top:8px;
      }

      .rfcx-drawer-backdrop{
        position:fixed;
        z-index:190;
        inset:0;
        display:flex;
        justify-content:flex-end;
        background:rgba(25,28,29,.24);
        backdrop-filter:blur(2px);
        animation:rfcxBackdropIn 150ms ease-out;
      }

      .rfcx-drawer{
        width:min(420px,100vw);
        height:100%;
        display:flex;
        flex-direction:column;
        overflow:auto;
        background:#fff;
        border-left:1px solid var(--rfcx-outline);
        box-shadow:-18px 0 50px rgba(25,28,29,.12);
        animation:rfcxDrawerIn 240ms var(--rfcx-ease);
      }

      .rfcx-drawer-top{
        min-height:56px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:12px 18px;
        border-bottom:1px solid var(--rfcx-outline);
      }

      .rfcx-drawer-top .rfcx-eyebrow{
        margin:0;
      }

      .rfcx-drawer-top button{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfcx-muted);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
      }

      .rfcx-drawer-top button:hover{
        color:var(--rfcx-text);
        background:var(--rfcx-soft);
      }

      .rfcx-profile{
        display:grid;
        justify-items:center;
        gap:4px;
        padding:24px 22px 20px;
        text-align:center;
        background:
          radial-gradient(circle at 80% 0,rgba(70,72,212,.09),transparent 34%),
          #fff;
        border-bottom:1px solid var(--rfcx-outline);
      }

      .rfcx-profile-avatar{
        width:72px;
        height:72px;
        margin-bottom:6px;
        border:4px solid #fff;
        border-radius:50%;
        box-shadow:0 5px 18px rgba(25,28,29,.13);
        font-size:18px;
      }

      .rfcx-profile h2{
        margin:0;
        color:var(--rfcx-text);
        font:600 18px/24px Geist,Inter,sans-serif;
      }

      .rfcx-profile p{
        margin:0 0 5px;
        color:var(--rfcx-text-soft);
        font-size:11px;
        line-height:16px;
      }

      .rfcx-profile-actions{
        display:flex;
        align-items:center;
        gap:8px;
        margin-top:8px;
      }

      .rfcx-profile-actions a,
      .rfcx-profile-actions button{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfcx-text-soft);
        background:var(--rfcx-soft);
        border:0;
        border-radius:50%;
        text-decoration:none;
        cursor:pointer;
        transition:
          color 140ms var(--rfcx-ease),
          background 140ms var(--rfcx-ease),
          transform 140ms var(--rfcx-ease);
      }

      .rfcx-profile-actions a:hover{
        color:var(--rfcx-primary);
        background:var(--rfcx-primary-soft);
        transform:translateY(-1px);
      }

      .rfcx-profile-actions button:disabled{
        opacity:.35;
        cursor:not-allowed;
      }

      .rfcx-drawer-section{
        padding:18px 20px;
        border-bottom:1px solid var(--rfcx-outline);
      }

      .rfcx-drawer-section.grow{
        flex:1;
      }

      .rfcx-drawer-section-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:11px;
      }

      .rfcx-drawer-section-head > span:first-child{
        color:var(--rfcx-text-soft);
        font-size:9px;
        font-weight:750;
        line-height:13px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfcx-health-card{
        display:flex;
        align-items:center;
        gap:13px;
        padding:13px;
        background:var(--rfcx-soft);
        border-radius:11px;
      }

      .rfcx-health-ring{
        --rfcx-score:0;
        width:56px;
        height:56px;
        display:grid;
        place-items:center;
        flex:0 0 56px;
        background:
          radial-gradient(circle,#fff 57%,transparent 58%),
          conic-gradient(
            var(--rfcx-primary) calc(var(--rfcx-score) * 1%),
            #dddeea 0
          );
        border-radius:50%;
      }

      .rfcx-health-ring span{
        color:var(--rfcx-primary);
        font:600 13px/18px Geist,Inter,sans-serif;
      }

      .rfcx-health-card > div:last-child{
        min-width:0;
        display:grid;
        gap:2px;
      }

      .rfcx-health-card strong{
        color:var(--rfcx-text);
        font-size:10px;
        line-height:15px;
      }

      .rfcx-health-card p{
        margin:0;
        color:var(--rfcx-text-soft);
        font-size:8px;
        line-height:13px;
      }

      .rfcx-details{
        display:grid;
        gap:8px;
        margin:0;
      }

      .rfcx-details > div{
        display:grid;
        grid-template-columns:105px minmax(0,1fr);
        gap:12px;
        align-items:start;
      }

      .rfcx-details dt{
        color:var(--rfcx-text-soft);
        font-size:9px;
        line-height:14px;
      }

      .rfcx-details dd{
        margin:0;
        color:var(--rfcx-text);
        text-align:right;
        font-size:9px;
        font-weight:550;
        line-height:14px;
      }

      .rfcx-contact-lines{
        display:grid;
        gap:5px;
      }

      .rfcx-contact-line{
        display:flex;
        align-items:center;
        gap:9px;
        min-height:45px;
        padding:7px 8px;
        color:var(--rfcx-text-soft)!important;
        background:transparent;
        border-radius:8px;
        text-decoration:none;
        transition:background 140ms var(--rfcx-ease);
      }

      .rfcx-contact-line[href]:hover{
        background:var(--rfcx-soft);
      }

      .rfcx-contact-line > span:first-child{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        flex:0 0 29px;
        color:var(--rfcx-primary);
        background:var(--rfcx-primary-soft);
        border-radius:8px;
      }

      .rfcx-contact-line > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:1px;
      }

      .rfcx-contact-line small{
        color:var(--rfcx-muted);
        font-size:7px;
        line-height:10px;
      }

      .rfcx-contact-line strong{
        overflow:hidden;
        color:var(--rfcx-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:9px;
        line-height:13px;
      }

      .rfcx-contact-line > svg{
        color:var(--rfcx-muted);
      }

      .rfcx-contact-line.disabled{
        opacity:.55;
      }

      .rfcx-activity-list{
        display:grid;
      }

      .rfcx-drawer-activity{
        display:grid;
        grid-template-columns:28px minmax(0,1fr);
        gap:8px;
        min-height:60px;
      }

      .rfcx-activity-rail{
        position:relative;
        display:flex;
        flex-direction:column;
        align-items:center;
      }

      .rfcx-activity-rail > span{
        position:relative;
        z-index:1;
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        color:var(--rfcx-text-soft);
        background:#eef1f5;
        border-radius:50%;
      }

      .rfcx-activity-rail > span.primary{
        color:var(--rfcx-primary);
        background:var(--rfcx-primary-soft);
      }

      .rfcx-activity-rail > span.success{
        color:var(--rfcx-success);
        background:var(--rfcx-success-soft);
      }

      .rfcx-activity-rail > span.violet{
        color:var(--rfcx-violet);
        background:var(--rfcx-violet-soft);
      }

      .rfcx-activity-rail > i{
        position:absolute;
        top:24px;
        bottom:0;
        width:1px;
        background:var(--rfcx-outline);
      }

      .rfcx-drawer-activity > div:last-child{
        min-width:0;
        display:grid;
        align-content:start;
        gap:1px;
        padding:2px 0 12px;
      }

      .rfcx-drawer-activity strong{
        color:var(--rfcx-text);
        font-size:9px;
        line-height:13px;
      }

      .rfcx-drawer-activity small{
        color:var(--rfcx-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfcx-drawer-activity p{
        margin:3px 0 0;
        padding:6px 7px;
        color:var(--rfcx-text-soft);
        background:var(--rfcx-soft);
        border-radius:6px;
        font-size:7px;
        line-height:12px;
      }

      .rfcx-drawer-empty{
        min-height:90px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        color:var(--rfcx-muted);
        text-align:center;
      }

      .rfcx-drawer-empty span{
        max-width:260px;
        font-size:8px;
        line-height:13px;
      }

      .rfcx-drawer-footer{
        position:sticky;
        bottom:0;
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:7px;
        padding:12px 14px;
        background:rgba(255,255,255,.96);
        border-top:1px solid var(--rfcx-outline);
        backdrop-filter:blur(10px);
      }

      .rfcx-drawer-footer .rfcx-btn{
        min-width:0;
        min-height:35px;
        padding:6px 8px;
        font-size:8px;
      }

      .rfcx-access{
        max-width:620px;
        padding:28px;
        background:#fff;
        border:1px solid var(--rfcx-outline);
        border-radius:15px;
      }

      .rfcx-access-icon{
        width:46px;
        height:46px;
        display:grid;
        place-items:center;
        margin-bottom:14px;
        color:var(--rfcx-primary);
        background:var(--rfcx-primary-soft);
        border-radius:13px;
      }

      .rfcx-access .rfcx-btn{
        margin-top:18px;
      }

      @media(max-width:1100px){
        .rfcx-metrics{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rfcx-toolbar{
          align-items:stretch;
          flex-direction:column;
        }

        .rfcx-toolbar-actions{
          width:100%;
        }

        .rfcx-search{
          width:auto;
          flex:1;
        }
      }

      @media(max-width:850px){
        .rf-contacts-v7{
          padding:22px 18px 84px;
        }

        .rfcx-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfcx-header-actions{
          width:100%;
        }

        .rfcx-header-actions .rfcx-btn{
          flex:1;
        }

        .rfcx-table-wrap{
          display:none;
        }

        .rfcx-mobile-list{
          display:grid;
        }

        .rfcx-mobile-card{
          display:grid;
          gap:10px;
          padding:13px 14px;
          animation:rfcxFadeUp 220ms var(--rfcx-ease) both;
          animation-delay:calc(var(--rfcx-row-index) * 22ms);
        }

        .rfcx-mobile-card + .rfcx-mobile-card{
          border-top:1px solid var(--rfcx-outline);
        }

        .rfcx-mobile-card.selected{
          background:#f4f4ff;
        }

        .rfcx-mobile-card-head{
          display:flex;
          align-items:center;
          gap:9px;
        }

        .rfcx-mobile-card-head .rfcx-checkbox{
          margin:0;
          flex:0 0 18px;
        }

        .rfcx-mobile-open{
          min-width:0;
          flex:1;
          display:flex;
          align-items:center;
          gap:8px;
          padding:0;
          color:inherit;
          background:transparent;
          border:0;
          text-align:left;
          cursor:pointer;
        }

        .rfcx-mobile-open .rfcx-contact-identity{
          min-width:0;
          flex:1;
        }

        .rfcx-mobile-open > svg{
          flex:0 0 auto;
          color:var(--rfcx-muted);
        }

        .rfcx-mobile-meta{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding-left:27px;
        }

        .rfcx-mobile-contact-methods{
          display:grid;
          gap:4px;
          padding-left:27px;
        }

        .rfcx-mobile-contact-methods a{
          width:max-content;
          max-width:100%;
          display:flex;
          align-items:center;
          gap:5px;
          overflow:hidden;
          color:var(--rfcx-text-soft)!important;
          text-decoration:none;
          text-overflow:ellipsis;
          white-space:nowrap;
          font-size:8px;
        }

        .rfcx-mobile-foot{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding-left:27px;
          color:var(--rfcx-muted);
          font-size:8px;
        }
      }

      @media(max-width:620px){
        .rf-contacts-v7{
          padding:18px 12px 84px;
        }

        .rfcx-header h1,
        .rfcx-access h1{
          font-size:25px;
          line-height:32px;
        }

        .rfcx-header p{
          font-size:11px;
          line-height:17px;
        }

        .rfcx-metrics{
          grid-template-columns:1fr 1fr;
          gap:8px;
        }

        .rfcx-metric{
          min-height:67px;
          padding:11px;
        }

        .rfcx-metric-icon{
          width:30px;
          height:30px;
          flex-basis:30px;
        }

        .rfcx-metric strong{
          font-size:17px;
          line-height:21px;
        }

        .rfcx-tabs{
          width:100%;
          overflow:auto;
        }

        .rfcx-tabs button{
          min-width:max-content;
          flex:1;
          justify-content:center;
        }

        .rfcx-toolbar-actions{
          display:grid;
          grid-template-columns:auto minmax(0,1fr) auto;
        }

        .rfcx-filter-btn{
          width:36px;
          justify-content:center;
          padding:0;
          font-size:0;
        }

        .rfcx-filter-btn > span{
          position:absolute;
          top:-4px;
          right:-4px;
          border:2px solid var(--rfcx-soft);
        }

        .rfcx-filter-btn > svg:last-child{
          display:none;
        }

        .rfcx-filter-popover{
          position:fixed;
          z-index:205;
          right:10px;
          bottom:74px;
          left:10px;
          top:auto;
          width:auto;
          max-height:72vh;
          overflow:auto;
          border-radius:15px;
        }

        .rfcx-bulk-bar{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfcx-bulk-actions{
          width:100%;
        }

        .rfcx-bulk-actions button{
          flex:1;
          justify-content:center;
        }

        .rfcx-footer{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfcx-pagination{
          width:100%;
          justify-content:flex-end;
        }

        .rfcx-drawer{
          width:100vw;
        }

        .rfcx-drawer-footer{
          padding-bottom:calc(12px + env(safe-area-inset-bottom));
        }
      }

      @media(max-width:420px){
        .rfcx-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .rfcx-metrics{
          grid-template-columns:1fr;
        }

        .rfcx-drawer-footer{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-contacts-v7,
        .rfcx-metric,
        .rfcx-table tbody tr,
        .rfcx-mobile-card,
        .rfcx-filter-popover,
        .rfcx-bulk-bar,
        .rfcx-message,
        .rfcx-drawer-backdrop,
        .rfcx-drawer,
        .rfcx-skeleton i,
        .rf-contacts-v7 .spin{
          animation:none!important;
        }

        .rf-contacts-v7 *,
        .rf-contacts-v7 *::before,
        .rf-contacts-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
