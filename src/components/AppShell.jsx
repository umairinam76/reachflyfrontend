import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

import BrandLogo from "./BrandLogo";
import "../voice-agent-sidebar-tree.css";

import {
  BarChart3,
  Bell,
  Building2,
  Clock3,
  GitBranch,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Rocket,
  Search,
  Settings,
  Target,
  UserRound,
  Users,
  X,
  Zap,
} from "./icons";

const defaultCounters = {
  activeCampaigns: 0,
  queuedCampaigns: 0,
  historyCampaigns: 0,
  contacts: 0,
  unreadInbox: 0,
};

const OWNER_ROLES = new Set([
  "owner",
]);

const ADMIN_ROLES = new Set([
  "admin",
]);

const MANAGER_ROLES = new Set([
  "manager",
]);

const CALLER_ROLES = new Set([
  "caller",
  "cold_caller",
  "sales_representative",
  "sales_rep",
  "telemarketer",
]);

const PLATFORM_OWNER_EMAIL = "owner@codesynclabs.com";

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();

  const counterRequestRef =
    useRef({
      key: "",
      promise: null,
      lastLoadedAt: 0,
    });

  const {
    user,
    logout,
  } = useAuth();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [counters, setCounters] =
    useState(defaultCounters);

  const [searchValue, setSearchValue] =
    useState("");

  const role = useMemo(
    () =>
      normalizeRole(
        user?.workspaceRole ||
          user?.role ||
          "caller"
      ),
    [
      user?.workspaceRole,
      user?.role,
    ]
  );

  const isOwner =
    OWNER_ROLES.has(role);

  const isAdmin =
    ADMIN_ROLES.has(role);

  const isManager =
    MANAGER_ROLES.has(role);

  const isCaller =
    CALLER_ROLES.has(role);

  const isPlatformOwner =
    String(user?.email || "")
      .trim()
      .toLowerCase() ===
    PLATFORM_OWNER_EMAIL;

  const canManageWorkspace =
    isOwner ||
    isAdmin ||
    isManager;

  const canManageCompanySettings =
    isOwner ||
    isAdmin;

  const canManageCampaigns =
    isManager;

  const canViewAllAnalytics =
    isOwner ||
    isAdmin ||
    isManager;

  const canViewInbox =
    isOwner ||
    isAdmin ||
    isManager;

  const canViewContacts =
    isManager ||
    isCaller;

  const isIndividualAccount =
    String(
      user?.accountType ||
        user?.workspaceType ||
        ""
    )
      .trim()
      .toLowerCase() ===
    "individual";

  const canUseVoiceAgent =
    canManageWorkspace ||
    isIndividualAccount;

  useEffect(() => {
    if (!user?.id) {
      setCounters(
        defaultCounters
      );

      return undefined;
    }

    let alive = true;

    const requestKey = [
      user.id,
      role,
      canManageCampaigns,
      canViewContacts,
      canViewInbox,
    ].join(":");

    async function loadCounters({
      force = false,
    } = {}) {
      const now =
        Date.now();

      const cached =
        counterRequestRef.current;

      if (
        !force &&
        cached.key ===
          requestKey &&
        now -
          cached.lastLoadedAt <
          30_000
      ) {
        return cached.promise;
      }

      const requestPromise =
        (async () => {
          const requests = [];

          if (
            canManageCampaigns
          ) {
            requests.push({
              key:
                "campaigns",
              promise:
                api.campaigns(),
            });
          }

          if (
            canViewInbox
          ) {
            requests.push({
              key:
                "inbox",
              promise:
                api.inbox(),
            });
          }

          if (
            canViewContacts
          ) {
            requests.push({
              key:
                "contacts",
              promise:
                api.contacts(),
            });
          }

          const results =
            await Promise.allSettled(
              requests.map(
                (request) =>
                  request.promise
              )
            );

          if (!alive) {
            return;
          }

          const responseMap =
            {};

          results.forEach(
            (
              result,
              index
            ) => {
              responseMap[
                requests[
                  index
                ].key
              ] = result;
            }
          );

          const campaignsValue =
            responseMap
              .campaigns
              ?.status ===
            "fulfilled"
              ? responseMap
                  .campaigns
                  .value
              : [];

          const campaigns =
            Array.isArray(
              campaignsValue
            )
              ? campaignsValue
              : Array.isArray(
                    campaignsValue
                      ?.campaigns
                  )
                ? campaignsValue
                    .campaigns
                : [];

          const inboxValue =
            responseMap.inbox
              ?.status ===
            "fulfilled"
              ? responseMap
                  .inbox
                  .value
              : [];

          const inboxItems =
            Array.isArray(
              inboxValue
            )
              ? inboxValue
              : Array.isArray(
                    inboxValue
                      ?.items
                  )
                ? inboxValue
                    .items
                : Array.isArray(
                      inboxValue
                        ?.messages
                    )
                  ? inboxValue
                      .messages
                  : [];

          const contactsValue =
            responseMap
              .contacts
              ?.status ===
            "fulfilled"
              ? responseMap
                  .contacts
                  .value
              : [];

          const contacts =
            Array.isArray(
              contactsValue
            )
              ? contactsValue
              : Array.isArray(
                    contactsValue
                      ?.contacts
                  )
                ? contactsValue
                    .contacts
                : [];

          setCounters({
            activeCampaigns:
              campaigns.filter(
                (campaign) =>
                  campaign.status ===
                  "active"
              ).length,

            queuedCampaigns:
              campaigns.filter(
                (campaign) =>
                  campaign.status ===
                  "queued"
              ).length,

            historyCampaigns:
              campaigns.filter(
                (campaign) =>
                  campaign.status ===
                    "history" ||
                  campaign.status ===
                    "completed"
              ).length,

            contacts:
              contacts.length,

            unreadInbox:
              inboxItems.filter(
                (item) =>
                  item.unread ===
                    true ||
                  item.read ===
                    false
              ).length,
          });
        })();

      counterRequestRef.current =
        {
          key:
            requestKey,

          promise:
            requestPromise,

          lastLoadedAt:
            now,
        };

      try {
        await requestPromise;
      } catch {
        if (alive) {
          setCounters(
            defaultCounters
          );
        }
      }

      return requestPromise;
    }

    void loadCounters();

    /*
     * Socket events provide immediate updates elsewhere.
     * This is only a low-frequency fallback.
     */
    const timer =
      window.setInterval(
        () => {
          void loadCounters({
            force: true,
          });
        },
        60_000
      );

    return () => {
      alive = false;

      window.clearInterval(
        timer
      );
    };
  }, [
    canManageCampaigns,
    canViewContacts,
    canViewInbox,
    role,
    user?.id,
  ]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [
    location.pathname,
    location.search,
  ]);

  const workspace = useMemo(() => {
    const isCompany =
      user?.accountType ===
        "company" ||
      user?.workspaceType ===
        "company" ||
      user?.companyAccount ===
        true ||
      Boolean(
        user?.workspaceId ||
        user?.companyId
      );

    return {
      isCompany,

      title: isCompany
        ? user?.companyName ||
          "Company workspace"
        : user?.name ||
          "Individual workspace",

      type: isCompany
        ? "Company account"
        : "Individual account",

      role: formatRoleLabel(role),

      email:
        user?.email ||
        "Signed in",

      initials: getInitials(
        user?.name ||
          user?.companyName ||
          "RF"
      ),

      avatarUrl:
        user?.avatarUrl ||
        user?.profileImage ||
        user?.photoUrl ||
        "",
    };
  }, [
    user,
    role,
  ]);

  const navGroups =
    useMemo(() => {
      const groups = [];

      groups.push({
        label: "Overview",

        items: [
          {
            label: "Dashboard",
            to: "/app/dashboard",
            icon: LayoutDashboard,
            matchPrefix:
              "/app/dashboard",
            visible: true,
          },

          {
            label: "My assigned leads",
            to: "/app/my-leads",
            icon: Target,
            matchPrefix:
              "/app/my-leads",
            visible:
              isCaller,
          },

          {
            label: "Attendance",
            to: "/app/attendance",
            icon: Clock3,
            matchPrefix:
              "/app/attendance",
            visible:
              isCaller,
          },

          {
            label: "Launch campaign",
            to: "/app/builder",
            icon: Rocket,
            matchPrefix:
              "/app/builder",
            visible:
              canManageCampaigns,
          },
        ],
      });

      groups.push({
        label: "Voice operations",
        className: "sb-section-voice-operations",

        items: [
          {
            label: "Voice agent",
            to: "/app/voice-agent?tab=setup&view=calling",
            icon: Zap,
            priorityRoot: true,
            navTone: "voice-primary",
            matchPrefix:
              "/app/voice-agent",
            visible:
              canUseVoiceAgent,
            children: [
              {
                label: "Voice setup",
                to: "/app/voice-agent?tab=setup&view=calling",
                matchQueryTab: "setup",
                matchQueryDefault: true,
                queryPathPrefix: "/app/voice-agent",
                children: [
                  {
                    label: "Calling",
                    to: "/app/voice-agent?tab=setup&view=calling",
                    matchQuery: { tab: ["setup", null], view: ["calling", null] },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "My numbers",
                    to: "/app/voice-agent?tab=setup&view=my-numbers",
                    matchQuery: { tab: "setup", view: "my-numbers" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Buy numbers",
                    to: "/app/voice-agent?tab=setup&view=buy-numbers",
                    matchQuery: { tab: "setup", view: "buy-numbers" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Connect number",
                    to: "/app/voice-agent?tab=setup&view=connect-number",
                    matchQuery: { tab: "setup", view: "connect-number" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Agent & voice",
                    to: "/app/voice-agent?tab=setup&view=agent",
                    matchQuery: { tab: "setup", view: "agent" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Business",
                    to: "/app/voice-agent?tab=setup&view=business",
                    matchQuery: { tab: "setup", view: "business" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Workflow",
                    to: "/app/voice-agent?tab=setup&view=workflow",
                    matchQuery: { tab: "setup", view: "workflow" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Activate",
                    to: "/app/voice-agent?tab=setup&view=activate",
                    matchQuery: { tab: "setup", view: "activate" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                ],
              },
              {
                label: "Lead queue",
                to: "/app/voice-agent?tab=leads&view=quick-lead",
                matchQueryTab: "leads",
                queryPathPrefix: "/app/voice-agent",
                children: [
                  {
                    label: "Quick lead",
                    to: "/app/voice-agent?tab=leads&view=quick-lead",
                    matchQuery: { tab: "leads", view: ["quick-lead", null] },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Google leads",
                    to: "/app/voice-agent?tab=leads&view=google-leads",
                    matchQuery: { tab: "leads", view: "google-leads" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Lead pool",
                    to: "/app/voice-agent?tab=leads&view=lead-pool",
                    matchQuery: { tab: "leads", view: "lead-pool" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Queue activity",
                    to: "/app/voice-agent?tab=leads&view=queue-activity",
                    matchQuery: { tab: "leads", view: "queue-activity" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Launch calls",
                    to: "/app/voice-agent?tab=leads&view=launch-calls",
                    matchQuery: { tab: "leads", view: "launch-calls" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                ],
              },
              {
                label: "Live calls",
                to: "/app/voice-agent?tab=calls&view=active-calls",
                matchQueryTab: "calls",
                queryPathPrefix: "/app/voice-agent",
                children: [
                  {
                    label: "Active calls",
                    to: "/app/voice-agent?tab=calls&view=active-calls",
                    matchQuery: { tab: "calls", view: ["active-calls", null] },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Call history",
                    to: "/app/voice-agent?tab=calls&view=call-history",
                    matchQuery: { tab: "calls", view: "call-history" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                ],
              },
              {
                label: "Meetings",
                to: "/app/voice-agent?tab=meetings&view=upcoming",
                matchQueryTab: "meetings",
                queryPathPrefix: "/app/voice-agent",
                children: [
                  {
                    label: "Upcoming",
                    to: "/app/voice-agent?tab=meetings&view=upcoming",
                    matchQuery: { tab: "meetings", view: ["upcoming", null] },
                    queryPathPrefix: "/app/voice-agent",
                  },
                  {
                    label: "Meeting history",
                    to: "/app/voice-agent?tab=meetings&view=meeting-history",
                    matchQuery: { tab: "meetings", view: "meeting-history" },
                    queryPathPrefix: "/app/voice-agent",
                  },
                ],
              },
            ],
          },

          {
            label: "My Numbers",
            to: "/app/voice-agent?tab=setup&view=my-numbers",
            icon: Building2,
            priorityRoot: true,
            navTone: "voice-number",
            matchQuery: { tab: "setup", view: "my-numbers" },
            queryPathPrefix: "/app/voice-agent",
            visible: canUseVoiceAgent,
          },

          {
            label: "Buy Numbers",
            to: "/app/voice-agent?tab=setup&view=buy-numbers",
            icon: Rocket,
            priorityRoot: true,
            navTone: "voice-buy",
            matchQuery: { tab: "setup", view: "buy-numbers" },
            queryPathPrefix: "/app/voice-agent",
            visible: canUseVoiceAgent,
          },
        ],
      });

      if (canManageCampaigns) {
        groups.push({
          label: "Campaigns",

          items: [
            {
              label:
                "External leads",
              to:
                "/app/campaigns/external-leads",
              icon: Users,
              matchPrefix:
                "/app/campaigns/external-leads",
              visible: true,
            },

            {
              label:
                "Active campaigns",
              to:
                "/app/campaigns/active",
              icon: Zap,
              count:
                counters.activeCampaigns,
              matchPrefix:
                "/app/campaigns/active",
              visible: true,
            },

            {
              label:
                "Queued campaigns",
              to:
                "/app/campaigns/queued",
              icon: Clock3,
              count:
                counters.queuedCampaigns,
              matchPrefix:
                "/app/campaigns/queued",
              visible: true,
            },

            {
              label:
                "Campaign history",
              to:
                "/app/campaigns/history",
              icon: History,
              count:
                counters.historyCampaigns,
              matchPrefix:
                "/app/campaigns/history",
              visible: true,
            },

            {
              label:
                "Pipeline builder",
              to:
                "/app/pipeline",
              icon: GitBranch,
              matchPrefix:
                "/app/pipeline",
              visible: true,
            },

            {
              label: "Territories",
              to:
                "/app/territories",
              icon: MapPin,
              matchPrefix:
                "/app/territories",
              visible: true,
            },
          ],
        });
      }

      groups.push({
        label: "Team",

        items: [
          {
            label: "Resource board",
            to: "/app/resource-board",
            icon: LayoutDashboard,
            matchPrefixes: [
              "/app/resource-board",
              "/app/team-management",
            ],
            visible:
              canManageWorkspace,
          },

          {
            label:
              canManageWorkspace
                ? "Team operations"
                : "My work",
            to:
              "/app/role-operations",
            icon: Users,
            matchPrefixes: [
              "/app/role-operations",
              "/app/operations",
              "/app/team",
            ],
            visible: true,
          },

          {
            label:
              "Team communication",
            to:
              "/app/role-operations?tab=communication",
            icon:
              MessageCircle,
            matchQueryTab:
              "communication",
            visible: true,
          },
        ],
      });

      groups.push({
        label: "Channels",

        items: [
          {
            label: "Email setup",
            to: "/app/email",
            icon: Mail,
            matchPrefix:
              "/app/email",
            visible:
              canManageWorkspace,
          },

          {
            label: "WhatsApp",
            to: "/app/whatsapp",
            icon:
              MessageCircle,
            matchPrefix:
              "/app/whatsapp",
            visible:
              canManageWorkspace,
          },

          {
            label: "Contacts",
            to: "/app/contacts",
            icon: Users,
            count:
              counters.contacts,
            matchPrefix:
              "/app/contacts",
            visible:
              canViewContacts,
          },

          {
            label: "Inbox",
            to: "/app/inbox",
            icon: Inbox,
            count:
              counters.unreadInbox,
            highlightCount: true,
            matchPrefix:
              "/app/inbox",
            visible:
              canViewInbox,
          },
        ],
      });

      groups.push({
        label: "Intelligence",

        items: [
          {
            label: "ReachFly AI",
            to: "/app/ai",
            icon: Target,
            matchPrefix:
              "/app/ai",
            visible:
              canManageWorkspace,
          },

          {
            label: "Analytics",
            to:
              "/app/analytics",
            icon: BarChart3,
            matchPrefix:
              "/app/analytics",
            visible:
              canViewAllAnalytics,
          },
        ],
      });

      groups.push({
        label: "Account",

        items: [
          {
            label:
              "Profile settings",
            to:
              "/app/profile-settings",
            icon: UserRound,
            matchPrefixes: [
              "/app/profile-settings",
              "/app/profile",
            ],
            visible: true,
          },

          {
            label:
              "Workspace settings",
            to: "/app/settings",
            icon: Settings,
            matchPrefix:
              "/app/settings",
            visible:
              canManageCompanySettings,
          },

          {
            label: "Credits & usage",
            to: "/app/billing",
            icon: BarChart3,
            matchPrefix: "/app/billing",
            visible: canManageCompanySettings,
          },

          {
            label: "Platform admin",
            to: "/app/platform-admin",
            icon: Building2,
            matchPrefix: "/app/platform-admin",
            visible: isPlatformOwner,
          },
        ],
      });

      return groups
        .map((group) => ({
          ...group,

          items:
            group.items.filter(
              (item) =>
                item.visible !==
                false
            ),
        }))
        .filter(
          (group) =>
            group.items.length > 0
        );
    }, [
      canManageCampaigns,
      canManageWorkspace,
      canManageCompanySettings,
      canViewAllAnalytics,
      canViewContacts,
      canViewInbox,
      canUseVoiceAgent,
      counters,
      isCaller,
      isManager,
      isPlatformOwner,
    ]);

  function handleSearchSubmit(
    event
  ) {
    event.preventDefault();

    const value =
      searchValue.trim();

    if (!value) {
      return;
    }

    if (
      isCaller &&
      !canManageWorkspace
    ) {
      navigate(
        `/app/my-leads?search=${encodeURIComponent(
          value
        )}`
      );

      return;
    }

    if (isManager) {
      navigate(
        `/app/contacts?search=${encodeURIComponent(
          value
        )}`
      );

      return;
    }

    navigate(
      `/app/role-operations?search=${encodeURIComponent(
        value
      )}`
    );
  }

  async function handleLogout() {
    setSidebarOpen(false);

    await Promise.resolve(
      logout()
    );
  }

  return (
    <div className="app-shell">
      {sidebarOpen ? (
        <button
          className="sidebar-overlay"
          type="button"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      ) : null}

      <aside
        className={`sidebar ${
          sidebarOpen
            ? "open"
            : ""
        }`}
      >
        <div className="sb-brand">
          <Link
            className="sb-logo"
            to="/app/dashboard"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <BrandLogo size={42} />
          </Link>

          <Link
            to="/app/dashboard"
            className="sb-brand-copy"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <div className="sb-name">
              ReachFly.Ai
            </div>

            <div className="sb-sub">
              Growth CRM
            </div>
          </Link>

          <button
            className="sb-close-btn"
            type="button"
            aria-label="Close sidebar"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <X size={18} />
          </button>
        </div>

        <div className="sb-workspace-card">
          <span>
            {workspace.isCompany ? (
              <Building2 size={17} />
            ) : (
              <UserRound size={17} />
            )}
          </span>

          <div>
            <b>{workspace.title}</b>

            <small>
              {workspace.type}
            </small>

            <em className="sb-workspace-role">
              {workspace.role}
            </em>
          </div>
        </div>

        <div className="sb-mini-stats">
          {canManageCampaigns ? (
            <>
              <div>
                <b>
                  {
                    counters.activeCampaigns
                  }
                </b>

                <span>Active</span>
              </div>

              <div>
                <b>
                  {
                    counters.queuedCampaigns
                  }
                </b>

                <span>Queued</span>
              </div>
            </>
          ) : (
            <>
              <div>
                <b>
                  {workspace.role}
                </b>

                <span>Role</span>
              </div>

              <div>
                <b>
                  {
                    counters.contacts
                  }
                </b>

                <span>Contacts</span>
              </div>
            </>
          )}

          <div>
            <b>
              {
                counters.unreadInbox
              }
            </b>

            <span>Unread</span>
          </div>
        </div>

        <nav
          className="sb-scroll"
          aria-label="ReachFly workspace navigation"
        >
          {navGroups.map(
            (group) => (
              <div
                className={`sb-section ${group.className || ""}`}
                key={group.label}
              >
                <p className="sb-label">
                  {group.label}
                </p>

                <div className="sb-nav-list">
                  {group.items.map(
                    (item) => {
                      const Icon = item.icon;
                      const hasChildren =
                        Array.isArray(item.children) &&
                        item.children.length > 0;
                      const treeOpen =
                        hasChildren &&
                        location.pathname.startsWith(
                          item.matchPrefix || item.to.split("?")[0]
                        );

                      return (
                        <div
                          className={`sb-nav-tree ${
                            treeOpen ? "open" : ""
                          } ${
                            item.priorityRoot ? "priority-root" : ""
                          } ${item.navTone || ""}`}
                          key={`${item.to}-${item.label}`}
                        >
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              `sb-item ${
                                isNavActive({
                                  item,
                                  isActive,
                                  pathname: location.pathname,
                                  search: location.search,
                                })
                                  ? "active"
                                  : ""
                              }`
                            }
                            onClick={() =>
                              !hasChildren
                                ? setSidebarOpen(false)
                                : undefined
                            }
                          >
                            <span className="sb-item-icon-wrap">
                              <Icon size={18} />

                              {item.highlightCount &&
                              item.count > 0 ? (
                                <em className="sb-counter">
                                  {formatCount(item.count)}
                                </em>
                              ) : null}
                            </span>

                            <span className="sb-item-label">
                              {item.label}
                            </span>

                            {!item.highlightCount &&
                            item.count > 0 ? (
                              <em className="sb-nav-badge">
                                {formatCount(item.count)}
                              </em>
                            ) : null}

                            {hasChildren ? (
                              <span
                                className="sb-tree-chevron"
                                aria-hidden="true"
                              >
                                ›
                              </span>
                            ) : null}
                          </NavLink>

                          {hasChildren && treeOpen ? (
                            <div
                              className="sb-subnav"
                              aria-label={`${item.label} sections`}
                            >
                              {item.children.map((child) => {
                                const childHasChildren =
                                  Array.isArray(child.children) &&
                                  child.children.length > 0;
                                const childActive = isNavActive({
                                  item: child,
                                  isActive: false,
                                  pathname: location.pathname,
                                  search: location.search,
                                });
                                const childOpen =
                                  childHasChildren && childActive;

                                return (
                                  <div
                                    className={`sb-subtree ${
                                      childOpen ? "open" : ""
                                    }`}
                                    key={`${child.to}-${child.label}`}
                                  >
                                    <NavLink
                                      to={child.to}
                                      className={({ isActive }) =>
                                        `sb-subitem ${
                                          isNavActive({
                                            item: child,
                                            isActive,
                                            pathname:
                                              location.pathname,
                                            search:
                                              location.search,
                                          })
                                            ? "active"
                                            : ""
                                        } ${
                                          childHasChildren
                                            ? "has-children"
                                            : ""
                                        }`
                                      }
                                      onClick={() =>
                                        !childHasChildren
                                          ? setSidebarOpen(false)
                                          : undefined
                                      }
                                    >
                                      <span className="sb-subitem-dot" />
                                      <span>{child.label}</span>
                                      {childHasChildren ? (
                                        <span
                                          className="sb-subtree-chevron"
                                          aria-hidden="true"
                                        >
                                          ›
                                        </span>
                                      ) : null}
                                    </NavLink>

                                    {childOpen ? (
                                      <div
                                        className="sb-subsubnav"
                                        aria-label={`${child.label} sections`}
                                      >
                                        {child.children.map(
                                          (grandchild) => (
                                            <NavLink
                                              key={`${grandchild.to}-${grandchild.label}`}
                                              to={grandchild.to}
                                              className={({ isActive }) =>
                                                `sb-subsubitem ${
                                                  isNavActive({
                                                    item: grandchild,
                                                    isActive,
                                                    pathname:
                                                      location.pathname,
                                                    search:
                                                      location.search,
                                                  })
                                                    ? "active"
                                                    : ""
                                                }`
                                              }
                                              onClick={() =>
                                                setSidebarOpen(false)
                                              }
                                            >
                                              <span className="sb-subsubitem-line" />
                                              <span>{grandchild.label}</span>
                                            </NavLink>
                                          )
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )
          )}
        </nav>

        <div className="sb-system-card">
          <span>
            {canViewInbox ? (
              <Bell size={15} />
            ) : (
              <UserRound size={15} />
            )}
          </span>

          <div>
            <b>
              {canViewInbox
                ? counters.unreadInbox
                  ? `${counters.unreadInbox} unread message${
                      counters.unreadInbox === 1
                        ? ""
                        : "s"
                    }`
                  : "Inbox synced"
                : `${workspace.role} workspace`}
            </b>

            <small>
              {canViewInbox
                ? counters.unreadInbox
                  ? "Open inbox to review activity"
                  : "No unread mailbox items"
                : "Your role-specific tools are ready"}
            </small>
          </div>
        </div>

        <div className="sb-foot">
          <Link
            to="/app/profile-settings"
            className="sb-avatar"
            title="Open profile settings"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            {workspace.avatarUrl ? (
              <img
                src={
                  workspace.avatarUrl
                }
                alt={
                  user?.name ||
                  "User"
                }
                onError={(
                  event
                ) => {
                  event.currentTarget.style.display =
                    "none";
                }}
              />
            ) : (
              workspace.initials
            )}
          </Link>

          <Link
            to="/app/profile-settings"
            className="sb-user-copy"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <b>
              {user?.name ||
                "User"}
            </b>

            <small>
              {workspace.email}
            </small>
          </Link>

          <button
            className="btn-icon sb-logout-btn"
            type="button"
            title="Logout"
            aria-label="Logout"
            onClick={() => {
              void handleLogout();
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="topbar">
          <button
            className="mobile-menu"
            type="button"
            aria-label="Open sidebar"
            onClick={() =>
              setSidebarOpen(true)
            }
          >
            <Menu size={20} />
          </button>

          <form
            className="topbar-search"
            onSubmit={
              handleSearchSubmit
            }
          >
            <Search size={17} />

            <input
              value={searchValue}
              onChange={(event) =>
                setSearchValue(
                  event.target.value
                )
              }
              placeholder={
                isCaller &&
                !canManageWorkspace
                  ? "Search assigned leads and tasks…"
                  : isManager
                    ? "Search campaigns, leads, inbox…"
                    : "Search team operations and reports…"
              }
              aria-label="Search ReachFly"
            />
          </form>

          <div className="topbar-spacer" />

          <Link
            to="/app/role-operations?tab=communication"
            className="notif-btn"
            aria-label="Open team communication"
            title="Team communication"
          >
            <MessageCircle
              size={18}
            />
          </Link>

          {canViewInbox ? (
            <Link
              to="/app/inbox"
              className={`notif-btn ${
                counters.unreadInbox > 0
                  ? "has-unread"
                  : ""
              }`}
              aria-label="Open inbox notifications"
            >
              <Bell size={18} />

              {counters.unreadInbox > 0 ? (
                <span>
                  {formatCount(
                    counters.unreadInbox
                  )}
                </span>
              ) : null}
            </Link>
          ) : null}

          {isManager ? (
            <Link
              to="/app/builder"
              className="btn primary"
            >
              <Rocket size={15} />

              New campaign
            </Link>
          ) : isCaller ? (
            <Link
              to="/app/my-leads"
              className="btn primary"
            >
              <Target size={15} />

              My leads
            </Link>
          ) : null}
        </div>

        <Outlet />
      </main>
    </div>
  );
}

function isNavActive({
  item,
  isActive,
  pathname,
  search,
}) {
  if (item.matchQuery && typeof item.matchQuery === "object") {
    const params = new URLSearchParams(search);
    const queryPathPrefix =
      item.queryPathPrefix || item.to?.split("?")[0] || "/app";

    const matchesQuery = Object.entries(item.matchQuery).every(
      ([key, expected]) => {
        const actual = params.get(key);

        if (Array.isArray(expected)) {
          return expected.includes(actual);
        }

        if (expected === null) {
          return !actual;
        }

        return actual === String(expected);
      }
    );

    return (
      pathname.startsWith(queryPathPrefix) &&
      matchesQuery
    );
  }

  if (item.matchQueryTab) {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    const queryPathPrefix =
      item.queryPathPrefix || "/app/role-operations";

    return (
      pathname.startsWith(queryPathPrefix) &&
      (
        tab === item.matchQueryTab ||
        (
          item.matchQueryDefault === true &&
          !tab
        )
      )
    );
  }

  if (isActive) {
    return true;
  }

  if (
    item.matchPrefix &&
    pathname.startsWith(
      item.matchPrefix
    )
  ) {
    return true;
  }

  if (
    Array.isArray(
      item.matchPrefixes
    ) &&
    item.matchPrefixes.some(
      (prefix) =>
        pathname.startsWith(
          prefix
        )
    )
  ) {
    if (
      item.to ===
        "/app/role-operations" &&
      new URLSearchParams(
        search
      ).get("tab") ===
        "communication"
    ) {
      return false;
    }

    return true;
  }

  const campaignListRoutes =
    new Set([
      "/app/campaigns/active",
      "/app/campaigns/queued",
      "/app/campaigns/history",
      "/app/campaigns/external-leads",
    ]);

  if (
    item.to ===
      "/app/campaigns/active" &&
    /^\/app\/campaigns\/[^/]+$/.test(
      pathname
    ) &&
    !campaignListRoutes.has(
      pathname
    )
  ) {
    return true;
  }

  if (
    item.to ===
      "/app/pipeline" &&
    pathname.includes(
      "/pipeline"
    )
  ) {
    return true;
  }

  return false;
}

function normalizeRole(value) {
  const role = String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (
    role.includes("owner")
  ) {
    return "owner";
  }

  if (
    role.includes("admin")
  ) {
    return "admin";
  }

  if (
    role.includes("manager")
  ) {
    return "manager";
  }

  if (
    role === "caller" ||
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

  return role || "caller";
}

function formatRoleLabel(role) {
  const labels = {
    owner: "Owner",
    admin: "Administrator",
    manager: "Manager",
    caller: "Caller",
  };

  return (
    labels[role] ||
    String(role || "Member")
      .replace(/_/g, " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      )
  );
}

function formatCount(value) {
  const number = Number(
    value || 0
  );

  if (number > 99) {
    return "99+";
  }

  return String(number);
}

function getInitials(value) {
  return String(
    value || "RF"
  )
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase()
    )
    .join("");
}