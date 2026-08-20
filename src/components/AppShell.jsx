import {
  useCallback,
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
import { apiRequest } from "../lib/workspace-platform-client.js";

import BrandLogo from "./BrandLogo";
import "../styles.css";

import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  Rocket,
  Search,
  Settings,
  Sparkles,
  Target,
  UserRound,
  Users,
  Workflow,
  X,
  Zap,
} from "./icons";

const DEFAULT_COUNTERS = Object.freeze({
  activeCampaigns: 0,
  queuedCampaigns: 0,
  historyCampaigns: 0,
  contacts: 0,
  unreadInbox: 0,
});

const OWNER_ROLES = new Set(["owner"]);
const ADMIN_ROLES = new Set(["admin"]);
const MANAGER_ROLES = new Set(["manager"]);
const CALLER_ROLES = new Set([
  "caller",
  "cold_caller",
  "sales_representative",
  "sales_rep",
  "telemarketer",
]);

const PLATFORM_OWNER_EMAIL = "owner@codesynclabs.com";
const CODESYNC_WORKSPACE_ID = "codesync-labs-workspace";
const TOAST_EVENT = "reachfly:toast";

/**
 * ReachFly V7 application shell.
 *
 * Goals:
 * - Match the Stitch ReachFly.AI shell/navigation system.
 * - Preserve existing route and role behavior while pages are migrated one by one.
 * - Keep all current backend/API behavior untouched.
 * - Provide global quick-create, command palette, notifications, responsive mobile nav,
 *   and a reusable animated success/error/warning/info toast channel.
 */
export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const counterRequestRef = useRef({
    key: "",
    promise: null,
    lastLoadedAt: 0,
  });

  const quickCreateRef = useRef(null);
  const notificationsRef = useRef(null);
  const commandInputRef = useRef(null);
  const toastIdRef = useRef(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [counters, setCounters] = useState(DEFAULT_COUNTERS);
  const [creditData, setCreditData] = useState(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const role = useMemo(
    () => normalizeRole(user?.workspaceRole || user?.role || "caller"),
    [user?.workspaceRole, user?.role]
  );

  const isOwner = OWNER_ROLES.has(role);
  const isAdmin = ADMIN_ROLES.has(role);
  const isManager = MANAGER_ROLES.has(role);
  const isCaller = CALLER_ROLES.has(role);

  const canManageWorkspace = isOwner || isAdmin || isManager;
  const canManageCompanySettings = isOwner || isAdmin;
  const canManageCampaigns = canManageWorkspace;
  const canViewAllAnalytics = canManageWorkspace;
  const canViewInbox = canManageWorkspace;
  const canViewContacts = canManageWorkspace;

  const isIndividualAccount =
    String(user?.accountType || user?.workspaceType || "")
      .trim()
      .toLowerCase() === "individual";

  const canUseVoiceAgent = canManageWorkspace || isIndividualAccount;

  const isPlatformOwner =
    String(user?.email || "")
      .trim()
      .toLowerCase() === PLATFORM_OWNER_EMAIL;

  const isCodesyncLabsWorkspace = useMemo(() => {
    const values = [
      user?.workspaceId,
      user?.companyId,
      user?.workspaceSlug,
      user?.companySlug,
      user?.workspaceName,
      user?.companyName,
    ]
      .filter(Boolean)
      .map((value) =>
        String(value)
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      );

    const codesyncIds = new Set([
      CODESYNC_WORKSPACE_ID.replace(/[\s-]+/g, "_"),
      "codesync_labs",
      "codesynclabs",
      "codesync_labs_workspace",
    ]);

    return values.some(
      (value) => codesyncIds.has(value) || value.startsWith("codesync_labs_")
    );
  }, [
    user?.workspaceId,
    user?.companyId,
    user?.workspaceSlug,
    user?.companySlug,
    user?.workspaceName,
    user?.companyName,
  ]);

  const useCodesyncPlatformDashboard =
    isCodesyncLabsWorkspace && isPlatformOwner;

  const dashboardHomePath = useCodesyncPlatformDashboard
    ? "/app/platform-admin"
    : "/app/dashboard";

  const workspace = useMemo(() => {
    const isCompany =
      user?.accountType === "company" ||
      user?.workspaceType === "company" ||
      user?.companyAccount === true ||
      Boolean(user?.workspaceId || user?.companyId);

    return {
      isCompany,
      title: isCompany
        ? user?.companyName || user?.workspaceName || "Company workspace"
        : user?.name || "Individual workspace",
      type: isCompany ? "Company workspace" : "Individual workspace",
      role: formatRoleLabel(role),
      email: user?.email || "Signed in",
      initials: getInitials(user?.name || user?.companyName || "RF"),
      avatarUrl:
        user?.avatarUrl || user?.profileImage || user?.photoUrl || "",
    };
  }, [user, role]);

  const creditWallet = creditData?.wallet || null;
  const creditBalance = Number(creditWallet?.balance ?? 0);
  const creditReserved = Number(creditWallet?.reserved ?? 0);
  const creditConsumed = Number(creditWallet?.totalConsumed ?? 0);

  const creditsExhausted =
    Boolean(creditWallet) &&
    !creditLoading &&
    creditBalance <= 0;

  const creditGate =
    creditsExhausted
      ? getCreditGate(location)
      : null;

  const showToast = useCallback((input = {}) => {
    const normalized = normalizeToast(input);
    const id = `${Date.now()}-${toastIdRef.current++}`;
    const toast = { ...normalized, id };

    setToasts((current) => [...current.slice(-3), toast]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, normalized.duration);

    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  /*
   * Global toast bridge.
   *
   * Any migrated page can use either:
   *   window.reachflyToast.success("Saved", "Your changes are live.")
   *   window.reachflyToast.error("Couldn't save", "Please try again.")
   *
   * Or dispatch a CustomEvent("reachfly:toast", { detail: {...} }).
   */
  useEffect(() => {
    function handleToastEvent(event) {
      showToast(event?.detail || {});
    }

    const previousBridge = window.reachflyToast;

    window.reachflyToast = {
      show: (detail) => showToast(detail),
      success: (title, message, options = {}) =>
        showToast({ type: "success", title, message, ...options }),
      error: (title, message, options = {}) =>
        showToast({ type: "error", title, message, ...options }),
      warning: (title, message, options = {}) =>
        showToast({ type: "warning", title, message, ...options }),
      info: (title, message, options = {}) =>
        showToast({ type: "info", title, message, ...options }),
    };

    window.addEventListener(TOAST_EVENT, handleToastEvent);

    return () => {
      window.removeEventListener(TOAST_EVENT, handleToastEvent);

      if (previousBridge) {
        window.reachflyToast = previousBridge;
      } else {
        delete window.reachflyToast;
      }
    };
  }, [showToast]);

  useEffect(() => {
    if (!user?.id) {
      setCounters(DEFAULT_COUNTERS);
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

    async function loadCounters({ force = false } = {}) {
      const now = Date.now();
      const cached = counterRequestRef.current;

      if (
        !force &&
        cached.key === requestKey &&
        now - cached.lastLoadedAt < 30_000
      ) {
        return cached.promise;
      }

      const requestPromise = (async () => {
        const requests = [];

        if (canManageCampaigns) {
          requests.push({ key: "campaigns", promise: api.campaigns() });
        }

        if (canViewInbox) {
          requests.push({ key: "inbox", promise: api.inbox() });
        }

        if (canViewContacts) {
          requests.push({ key: "contacts", promise: api.contacts() });
        }

        const results = await Promise.allSettled(
          requests.map((request) => request.promise)
        );

        if (!alive) return;

        const responseMap = {};
        results.forEach((result, index) => {
          responseMap[requests[index].key] = result;
        });

        const campaigns = normalizeCollection(
          responseMap.campaigns?.status === "fulfilled"
            ? responseMap.campaigns.value
            : [],
          ["campaigns", "items"]
        );

        const inboxItems = normalizeCollection(
          responseMap.inbox?.status === "fulfilled"
            ? responseMap.inbox.value
            : [],
          ["items", "messages", "inbox"]
        );

        const contacts = normalizeCollection(
          responseMap.contacts?.status === "fulfilled"
            ? responseMap.contacts.value
            : [],
          ["contacts", "items", "leads"]
        );

        setCounters({
          activeCampaigns: campaigns.filter(
            (campaign) => normalizeStatus(campaign.status) === "active"
          ).length,
          queuedCampaigns: campaigns.filter(
            (campaign) => normalizeStatus(campaign.status) === "queued"
          ).length,
          historyCampaigns: campaigns.filter((campaign) =>
            ["history", "completed"].includes(
              normalizeStatus(campaign.status)
            )
          ).length,
          contacts: contacts.length,
          unreadInbox: inboxItems.filter(
            (item) => item.unread === true || item.read === false
          ).length,
        });
      })();

      counterRequestRef.current = {
        key: requestKey,
        promise: requestPromise,
        lastLoadedAt: now,
      };

      try {
        await requestPromise;
      } catch {
        if (alive) setCounters(DEFAULT_COUNTERS);
      }

      return requestPromise;
    }

    void loadCounters();

    const timer = window.setInterval(() => {
      void loadCounters({ force: true });
    }, 60_000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [
    canManageCampaigns,
    canViewContacts,
    canViewInbox,
    role,
    user?.id,
  ]);

  useEffect(() => {
    if (!user?.id) {
      setCreditData(null);
      setCreditLoading(false);
      return undefined;
    }

    let alive = true;
    let requestInFlight = false;

    async function loadCredits() {
      if (requestInFlight) return;
      requestInFlight = true;
      if (alive) setCreditLoading(true);

      try {
        const response = await apiRequest("/billing/credits", {
          timeoutMs: 15_000,
        });

        if (alive) {
          setCreditData(response || null);
        }
      } catch {
        // Keep the last known balance visible during a temporary billing/API failure.
      } finally {
        requestInFlight = false;
        if (alive) setCreditLoading(false);
      }
    }

    function handleFocus() {
      void loadCredits();
    }

    function handleCreditsChanged() {
      void loadCredits();
    }

    void loadCredits();

    const timer = window.setInterval(loadCredits, 10_000);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("reachfly:credits-changed", handleCreditsChanged);

    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("reachfly:credits-changed", handleCreditsChanged);
    };
  }, [user?.id, user?.workspaceId]);

  useEffect(() => {
    setSidebarOpen(false);
    setQuickCreateOpen(false);
    setNotificationsOpen(false);
    setCommandOpen(false);
    setCommandQuery("");
  }, [location.pathname, location.search]);

  useEffect(() => {
    function handleKeyDown(event) {
      const isCommandShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isCommandShortcut) {
        event.preventDefault();
        setCommandOpen(true);
        window.setTimeout(() => commandInputRef.current?.focus(), 0);
        return;
      }

      if (event.key === "Escape") {
        setCommandOpen(false);
        setQuickCreateOpen(false);
        setNotificationsOpen(false);
        setSidebarOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (
        quickCreateOpen &&
        quickCreateRef.current &&
        !quickCreateRef.current.contains(event.target)
      ) {
        setQuickCreateOpen(false);
      }

      if (
        notificationsOpen &&
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [quickCreateOpen, notificationsOpen]);

  const navGroups = useMemo(() => {
    const groups = [
      {
        label: "Home",
        items: [
          {
            label: "Dashboard",
            to: dashboardHomePath,
            icon: LayoutDashboard,
            matchPrefixes: useCodesyncPlatformDashboard
              ? ["/app/dashboard", "/app/platform-admin"]
              : ["/app/dashboard"],
            visible: true,
          },
        ],
      },
      {
        label: "Growth",
        items: [
          {
            label: isCaller ? "My Leads" : "Leads",
            to: isCaller
              ? "/app/my-leads"
              : "/app/leads?view=discover",
            icon: Target,
            ...(isCaller
              ? { matchPrefixes: ["/app/my-leads"] }
              : {
                  matchQuery: { view: ["discover", "results", null] },
                  queryPathPrefix: "/app/leads",
                }),
            visible: isCaller || canManageCampaigns,
            creditGated: !isCaller,
          },
          {
            label: "All Leads",
            to: "/app/leads?view=all",
            icon: Users,
            matchQuery: { view: "all" },
            queryPathPrefix: "/app/leads",
            visible: !isCaller && canManageCampaigns,
          },
          {
            label: "External Leads",
            to: "/app/leads?view=external",
            icon: Building2,
            matchQuery: { view: "external" },
            queryPathPrefix: "/app/leads",
            visible: !isCaller && canManageCampaigns,
          },
          {
            label: "AI Audits",
            to: "/app/ai",
            icon: Sparkles,
            matchPrefix: "/app/ai",
            visible: canManageWorkspace,
            creditGated: true,
          },
          {
            label: "Campaigns",
            to: "/app/campaigns/active",
            icon: Rocket,
            count: counters.activeCampaigns,
            matchPrefix: "/app/campaigns",
            visible: canManageCampaigns,
          },
        ],
      },
      {
        label: "Communication",
        items: [
          {
            label: "Inbox",
            to: "/app/inbox",
            icon: Inbox,
            count: counters.unreadInbox,
            highlightCount: true,
            matchPrefix: "/app/inbox",
            visible: canViewInbox,
          },
          {
            label: "Email",
            to: "/app/email",
            icon: Mail,
            matchPrefix: "/app/email",
            visible: canManageWorkspace,
          },
          {
            label: "WhatsApp",
            to: "/app/whatsapp",
            icon: MessageCircle,
            matchPrefix: "/app/whatsapp",
            visible: canManageWorkspace,
          },
          {
            label: "Dialer",
            to: isCaller
              ? "/app/call-workspace"
              : "/app/voice-agent?tab=leads&view=dialer",
            icon: Phone,
            matchPrefixes: isCaller
              ? ["/app/call-workspace"]
              : ["/app/voice-agent"],
            matchQuery: isCaller
              ? null
              : { tab: "leads", view: ["dialer", "quick-lead", null] },
            queryPathPrefix: "/app/voice-agent",
            visible: isCaller || canUseVoiceAgent,
            creditGated: true,
          },
        ],
      },
      {
        label: "AI Voice",
        items: [
          {
            label: "Voice Agents",
            to: "/app/agents",
            icon: Bot,
            matchPrefix: "/app/agents",
            visible: canUseVoiceAgent,
          },
          {
            label: "Calls",
            to: "/app/voice-agent?tab=calls&view=call-history",
            icon: Phone,
            matchQuery: { tab: "calls", view: ["call-history", "active-calls", null] },
            queryPathPrefix: "/app/voice-agent",
            visible: canUseVoiceAgent,
          },
          {
            label: "Phone Numbers",
            to: "/app/voice-agent?tab=setup&view=my-numbers",
            icon: Building2,
            matchQuery: {
              tab: ["setup", null],
              view: ["my-numbers", "buy-numbers", "connect-number"],
            },
            queryPathPrefix: "/app/voice-agent",
            visible: canUseVoiceAgent,
          },
        ],
      },
      {
        label: "CRM",
        items: [
          {
            label: "Contacts",
            to: "/app/contacts",
            icon: Users,
            count: counters.contacts,
            matchPrefix: "/app/contacts",
            visible: canViewContacts,
          },
          {
            label: "Pipeline",
            to: "/app/pipeline",
            icon: GitBranch,
            matchPrefix: "/app/pipeline",
            visible: canManageCampaigns,
          },
          {
            label: "Meetings",
            to: "/app/voice-agent?tab=meetings&view=upcoming",
            icon: Calendar,
            matchQuery: { tab: "meetings", view: ["upcoming", "meeting-history", null] },
            queryPathPrefix: "/app/voice-agent",
            visible: canUseVoiceAgent,
          },
        ],
      },
      {
        label: "Workspace",
        items: [
          {
            label: canManageWorkspace ? "Team" : "My Work",
            to: "/app/role-operations?tab=team",
            icon: Users,
            matchPrefixes: ["/app/role-operations", "/app/team"],
            matchQuery: canManageWorkspace ? { tab: ["team", null] } : null,
            queryPathPrefix: "/app/role-operations",
            visible: true,
          },
          {
            label: "Billing",
            to: "/app/billing",
            icon: BarChart3,
            matchPrefix: "/app/billing",
            visible: canManageCompanySettings || isIndividualAccount,
          },
          {
            label: "Integrations",
            to: "/app/connections",
            icon: Zap,
            matchPrefix: "/app/connections",
            visible: canManageWorkspace,
          },
          {
            label: "Settings",
            to: canManageCompanySettings
              ? "/app/settings"
              : "/app/profile-settings",
            icon: Settings,
            matchPrefixes: canManageCompanySettings
              ? ["/app/settings"]
              : ["/app/profile-settings", "/app/profile"],
            visible: true,
          },
        ],
      },
      {
        label: "More",
        items: [
          {
            label: "Analytics",
            to: "/app/analytics",
            icon: BarChart3,
            matchPrefix: "/app/analytics",
            visible: canViewAllAnalytics,
          },
          {
            label: "Territories",
            to: "/app/territories",
            icon: MapPin,
            matchPrefix: "/app/territories",
            visible: canManageWorkspace,
          },
          {
            label: "Resource Board",
            to: "/app/resource-board",
            icon: Workflow,
            matchPrefixes: ["/app/resource-board", "/app/team-management"],
            visible: canManageWorkspace,
          },
          {
            label: "Attendance",
            to: "/app/attendance",
            icon: Clock3,
            matchPrefix: "/app/attendance",
            visible: isCaller,
          },
          {
            label: "Platform Admin",
            to: "/app/platform-admin",
            icon: Lightbulb,
            matchPrefix: "/app/platform-admin",
            visible: useCodesyncPlatformDashboard,
          },
        ],
      },
    ];

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.visible !== false),
      }))
      .filter((group) => group.items.length > 0);
  }, [
    canManageCampaigns,
    canManageCompanySettings,
    canManageWorkspace,
    canUseVoiceAgent,
    canViewAllAnalytics,
    canViewContacts,
    canViewInbox,
    counters.activeCampaigns,
    counters.contacts,
    counters.unreadInbox,
    dashboardHomePath,
    isCaller,
    isIndividualAccount,
    useCodesyncPlatformDashboard,
  ]);

  const quickCreateItems = useMemo(
    () =>
      [
        {
          label: "Find Leads",
          description: "Discover prospects and build a list",
          icon: Target,
          to: isCaller
            ? "/app/my-leads"
            : "/app/leads?view=discover",
          visible: isCaller || canManageCampaigns,
          creditGated: !isCaller,
        },
        {
          label: "Create Campaign",
          description: "Launch a new outreach workflow",
          icon: Rocket,
          to: "/app/leads?view=discover",
          visible: canManageCampaigns,
          creditGated: true,
        },
        {
          label: "Create Voice Agent",
          description: "Configure an AI calling agent",
          icon: Bot,
          to: "/app/voice-agent?tab=setup&view=calling",
          visible: canUseVoiceAgent,
        },
        {
          label: "Buy Phone Number",
          description: "Search and purchase a business line",
          icon: Phone,
          to: "/app/voice-agent?tab=setup&view=buy-numbers",
          visible: canUseVoiceAgent,
        },
        {
          label: "Send Email",
          description: "Open your connected email workspace",
          icon: Mail,
          to: "/app/email",
          visible: canManageWorkspace,
        },
        {
          label: "Schedule Meeting",
          description: "Open meeting operations",
          icon: Calendar,
          to: "/app/voice-agent?tab=meetings&view=upcoming",
          visible: canUseVoiceAgent,
        },
      ].filter((item) => item.visible !== false),
    [
      canManageCampaigns,
      canManageWorkspace,
      canUseVoiceAgent,
      isCaller,
    ]
  );

  const commandItems = useMemo(() => {
    const navItems = navGroups.flatMap((group) =>
      group.items.map((item) => ({
        label: item.label,
        description: group.label,
        icon: item.icon,
        to: item.to,
        keywords: `${group.label} ${item.label}`,
      }))
    );

    const createItems = quickCreateItems.map((item) => ({
      ...item,
      description: item.description || "Create",
      keywords: `create new ${item.label}`,
    }));

    return dedupeCommandItems([...createItems, ...navItems]);
  }, [navGroups, quickCreateItems]);

  const filteredCommandItems = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return commandItems.slice(0, 12);

    return commandItems
      .map((item) => ({
        ...item,
        score: scoreCommandItem(item, query),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 16);
  }, [commandItems, commandQuery]);

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const notificationItems = useMemo(() => {
    const items = [];

    if (canViewInbox && counters.unreadInbox > 0) {
      items.push({
        id: "inbox",
        icon: Inbox,
        tone: "primary",
        title: `${counters.unreadInbox} unread message${
          counters.unreadInbox === 1 ? "" : "s"
        }`,
        copy: "Review your latest customer conversations.",
        to: "/app/inbox",
      });
    }

    if (canManageCampaigns && counters.queuedCampaigns > 0) {
      items.push({
        id: "queued-campaigns",
        icon: Rocket,
        tone: "warning",
        title: `${counters.queuedCampaigns} queued campaign${
          counters.queuedCampaigns === 1 ? "" : "s"
        }`,
        copy: "Campaigns are waiting in the launch queue.",
        to: "/app/campaigns/queued",
      });
    }

    if (canManageCampaigns && counters.activeCampaigns > 0) {
      items.push({
        id: "active-campaigns",
        icon: Zap,
        tone: "success",
        title: `${counters.activeCampaigns} campaign${
          counters.activeCampaigns === 1 ? "" : "s"
        } active`,
        copy: "Outreach is running in your workspace.",
        to: "/app/campaigns/active",
      });
    }

    return items;
  }, [
    canManageCampaigns,
    canViewInbox,
    counters.activeCampaigns,
    counters.queuedCampaigns,
    counters.unreadInbox,
  ]);

  const mobileItems = useMemo(
    () =>
      [
        {
          label: "Home",
          to: dashboardHomePath,
          icon: LayoutDashboard,
          matchPrefixes: [dashboardHomePath, "/app/dashboard"],
          visible: true,
        },
        {
          label: "Leads",
          to: isCaller
            ? "/app/my-leads"
            : "/app/leads?view=discover",
          icon: Target,
          matchPrefixes: isCaller
            ? ["/app/my-leads"]
            : ["/app/leads", "/app/builder"],
          visible: isCaller || canManageCampaigns,
          creditGated: !isCaller,
        },
        {
          label: "Inbox",
          to: canViewInbox ? "/app/inbox" : "/app/role-operations?tab=communication",
          icon: Inbox,
          count: canViewInbox ? counters.unreadInbox : 0,
          matchPrefixes: canViewInbox ? ["/app/inbox"] : ["/app/role-operations"],
          visible: true,
        },
        {
          label: "Voice",
          to: canUseVoiceAgent ? "/app/agents" : "/app/call-workspace",
          icon: Bot,
          matchPrefixes: canUseVoiceAgent
            ? ["/app/agents", "/app/voice-agent"]
            : ["/app/call-workspace"],
          visible: canUseVoiceAgent || isCaller,
        },
        {
          label: "More",
          to: canManageCompanySettings ? "/app/settings" : "/app/profile-settings",
          icon: Menu,
          matchPrefixes: ["/app/settings", "/app/profile-settings", "/app/profile"],
          visible: true,
        },
      ].filter((item) => item.visible !== false),
    [
      canManageCampaigns,
      canManageCompanySettings,
      canUseVoiceAgent,
      canViewInbox,
      counters.unreadInbox,
      dashboardHomePath,
      isCaller,
    ]
  );

  function handleSearchSubmit(event) {
    event.preventDefault();
    const value = searchValue.trim();

    if (!value) {
      setCommandOpen(true);
      window.setTimeout(() => commandInputRef.current?.focus(), 0);
      return;
    }

    if (isCaller && !canManageWorkspace) {
      navigate(`/app/my-leads?search=${encodeURIComponent(value)}`);
      return;
    }

    if (canViewContacts) {
      navigate(`/app/contacts?search=${encodeURIComponent(value)}`);
      return;
    }

    navigate(`/app/role-operations?search=${encodeURIComponent(value)}`);
  }

  function openCommandPalette() {
    setCommandOpen(true);
    setQuickCreateOpen(false);
    setNotificationsOpen(false);
    window.setTimeout(() => commandInputRef.current?.focus(), 0);
  }

  function navigateFromOverlay(to) {
    setCommandOpen(false);
    setQuickCreateOpen(false);
    setNotificationsOpen(false);
    setSidebarOpen(false);
    setCommandQuery("");
    navigate(to);
  }

  async function handleLogout() {
    setSidebarOpen(false);
    setQuickCreateOpen(false);
    setNotificationsOpen(false);

    try {
      await Promise.resolve(logout());
    } catch (error) {
      showToast({
        type: "error",
        title: "Couldn't sign out",
        message:
          error?.message || "Your session could not be closed. Please try again.",
      });
    }
  }

  return (
    <div className="rf-app-v7">
      <ShellMotionStyles />

      <div className="rf7-shell">
        {sidebarOpen ? (
          <button
            className="rf7-sidebar-overlay"
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`rf7-sidebar ${sidebarOpen ? "open" : ""}`}
          aria-label="ReachFly workspace navigation"
        >
          <div className="rf7-sidebar-head">
            <Link
              className="rf7-brand"
              to={dashboardHomePath}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="rf7-brand-mark" aria-hidden="true">
                <BrandLogo size={30} />
              </span>

              <span className="rf7-brand-copy">
                <strong>ReachFlyAI</strong>
                <small>Sales operating system</small>
              </span>
            </Link>

            <button
              className="rf7-sidebar-toggle rf7-sidebar-close-v7"
              type="button"
              aria-label="Close navigation"
              title="Close navigation"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={17} />
            </button>
          </div>

          <Link
            className="rf7-workspace-switcher"
            to={canManageCompanySettings ? "/app/settings" : "/app/profile-settings"}
            onClick={() => setSidebarOpen(false)}
            title="Workspace settings"
          >
            <span className="rf7-workspace-icon" aria-hidden="true">
              {workspace.isCompany ? (
                <Building2 size={15} />
              ) : (
                <UserRound size={15} />
              )}
            </span>

            <span className="rf7-workspace-copy">
              <strong>{workspace.title}</strong>
              <span>
                {workspace.role} · {workspace.type}
              </span>
            </span>

            <ChevronDown size={15} aria-hidden="true" />
          </Link>

          <nav className="rf7-nav-scroll">
            {navGroups.map((group) => (
              <section className="rf7-nav-group" key={group.label}>
                <span className="rf7-nav-label">{group.label}</span>

                <div className="rf7-nav-list">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive({
                      item,
                      pathname: location.pathname,
                      search: location.search,
                    });

                    return (
                      <NavLink
                        key={`${group.label}-${item.label}-${item.to}`}
                        to={item.to}
                        className={`rf7-nav-link ${active ? "active" : ""} ${
                          creditsExhausted && item.creditGated
                            ? "credit-locked"
                            : ""
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <Icon size={18} aria-hidden="true" />
                        <span className="rf7-nav-link-text">{item.label}</span>

                        {creditsExhausted &&
                        item.creditGated ? (
                          <Lock
                            className="rf7-credit-lock-icon-v9"
                            size={13}
                            aria-label="Credits required"
                          />
                        ) : null}

                        {Number(item.count || 0) > 0 ? (
                          <em className="rf7-nav-badge">
                            {formatCount(item.count)}
                          </em>
                        ) : null}
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="rf7-sidebar-foot">
            <Link
              className="rf7-nav-link rf7-sidebar-help"
              to="/contact"
              onClick={() => setSidebarOpen(false)}
            >
              <Lightbulb size={18} />
              <span className="rf7-nav-link-text">Help & Support</span>
            </Link>

            <div className="rf7-profile-row">
              <Link
                className="rf7-profile-avatar"
                to="/app/profile-settings"
                title="Open profile settings"
                onClick={() => setSidebarOpen(false)}
              >
                {workspace.avatarUrl ? (
                  <img
                    src={workspace.avatarUrl}
                    alt={user?.name || "User"}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  workspace.initials
                )}
              </Link>

              <Link
                className="rf7-profile-copy rf7-profile-link-v7"
                to="/app/profile-settings"
                onClick={() => setSidebarOpen(false)}
              >
                <strong>{user?.name || "ReachFly user"}</strong>
                <span>{workspace.role}</span>
              </Link>

              <Link
                className="rf7-icon-btn rf7-profile-settings-v7"
                to="/app/profile-settings"
                aria-label="Profile settings"
                title="Profile settings"
                onClick={() => setSidebarOpen(false)}
              >
                <Settings size={16} />
              </Link>

              <button
                className="rf7-icon-btn rf7-profile-logout-v7"
                type="button"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => void handleLogout()}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        <main className="rf7-shell-main">
          <header className="rf7-topbar">
            <div className="rf7-topbar-start">
              <button
                className="rf7-icon-btn rf7-mobile-menu-btn"
                type="button"
                aria-label="Open navigation"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={18} />
              </button>

              <Breadcrumbs items={breadcrumbs} />

              <form className="rf7-global-search" onSubmit={handleSearchSubmit}>
                <Search size={17} aria-hidden="true" />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  onFocus={() => {
                    if (!searchValue) return;
                    setCommandQuery(searchValue);
                  }}
                  placeholder="Search ReachFly..."
                  aria-label="Search ReachFly"
                />
                <button
                  className="rf7-search-command-v7"
                  type="button"
                  aria-label="Open command palette"
                  title="Open command palette"
                  onClick={openCommandPalette}
                >
                  <span className="rf7-key-hint">⌘K</span>
                </button>
              </form>
            </div>

            <div className="rf7-topbar-end">
              <Link
                className="rf7-credit-pill-v7"
                to="/app/billing"
                title={`ReachFly credits · ${creditBalance.toLocaleString()} available${
                  creditReserved ? ` · ${creditReserved.toLocaleString()} reserved` : ""
                }`}
                aria-label={`${creditBalance.toLocaleString()} ReachFly credits available`}
              >
                <span className="rf7-credit-icon-v7" aria-hidden="true">
                  <Zap size={15} />
                </span>
                <span className="rf7-credit-copy-v7">
                  <strong>{creditLoading && !creditWallet ? "…" : creditBalance.toLocaleString()}</strong>
                  <small>Credits</small>
                </span>
                <span className="rf7-credit-usage-v7" aria-hidden="true">
                  {creditConsumed > 0 ? `${creditConsumed.toLocaleString()} used` : "Live"}
                </span>
              </Link>

              <div className="rf7-topbar-popover-anchor-v7" ref={quickCreateRef}>
                <button
                  className="rf7-create-btn"
                  type="button"
                  aria-expanded={quickCreateOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setQuickCreateOpen((value) => !value);
                    setNotificationsOpen(false);
                  }}
                >
                  <Plus size={17} />
                  <span className="rf7-create-label">Create</span>
                </button>

                {quickCreateOpen ? (
                  <div
                    className="rf7-popover rf7-quick-create rf7-popover-enter-v7"
                    role="menu"
                    aria-label="Quick create"
                  >
                    <div className="rf7-popover-title-v7">
                      <strong>Quick create</strong>
                      <span>Start a workflow</span>
                    </div>

                    {quickCreateItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          className="rf7-menu-item rf7-menu-item-rich-v7"
                          type="button"
                          role="menuitem"
                          onClick={() => navigateFromOverlay(item.to)}
                        >
                          <span className="rf7-menu-icon-v7">
                            <Icon size={17} />
                          </span>
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <Link
                className="rf7-icon-btn rf7-topbar-icon"
                to="/app/role-operations?tab=communication"
                aria-label="Team communication"
                title="Team communication"
              >
                <MessageCircle size={18} />
              </Link>

              <div
                className="rf7-topbar-popover-anchor-v7"
                ref={notificationsRef}
              >
                <button
                  className="rf7-icon-btn rf7-topbar-icon"
                  type="button"
                  aria-label="Notifications"
                  aria-haspopup="menu"
                  aria-expanded={notificationsOpen}
                  onClick={() => {
                    setNotificationsOpen((value) => !value);
                    setQuickCreateOpen(false);
                  }}
                >
                  <Bell size={18} />
                  {notificationItems.length > 0 ? (
                    <span className="rf7-notification-dot" />
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div
                    className="rf7-popover rf7-notifications-popover-v7 rf7-popover-enter-v7"
                    role="menu"
                    aria-label="Notifications"
                  >
                    <div className="rf7-notifications-head-v7">
                      <div>
                        <strong>Notifications</strong>
                        <span>Workspace activity</span>
                      </div>
                      {notificationItems.length > 0 ? (
                        <span className="rf7-notifications-count-v7">
                          {notificationItems.length}
                        </span>
                      ) : null}
                    </div>

                    {notificationItems.length ? (
                      <div className="rf7-notifications-list-v7">
                        {notificationItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              className="rf7-notification-item-v7"
                              type="button"
                              role="menuitem"
                              onClick={() => navigateFromOverlay(item.to)}
                            >
                              <span
                                className={`rf7-notification-icon-v7 ${item.tone}`}
                              >
                                <Icon size={16} />
                              </span>
                              <span className="rf7-notification-copy-v7">
                                <strong>{item.title}</strong>
                                <small>{item.copy}</small>
                              </span>
                              <ChevronRight size={15} />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rf7-notifications-empty-v7">
                        <CheckCircle2 size={24} />
                        <strong>You're all caught up</strong>
                        <span>No new workspace alerts right now.</span>
                      </div>
                    )}

                    <Link
                      className="rf7-notifications-footer-v7"
                      to={canViewInbox ? "/app/inbox" : "/app/role-operations"}
                      onClick={() => setNotificationsOpen(false)}
                    >
                      View activity
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                ) : null}
              </div>

              <Link
                className="rf7-topbar-profile-v7"
                to="/app/profile-settings"
                title="Profile settings"
              >
                <span className="rf7-topbar-avatar-v7">
                  {workspace.avatarUrl ? (
                    <img src={workspace.avatarUrl} alt="" />
                  ) : (
                    workspace.initials
                  )}
                </span>
                <span className="rf7-topbar-profile-copy-v7">
                  <strong>{user?.name || "Account"}</strong>
                  <small>{workspace.role}</small>
                </span>
                <ChevronDown size={14} />
              </Link>
            </div>
          </header>

          <div className="rf7-page-stage">
            {creditGate ? (
              <CreditLockedState gate={creditGate} />
            ) : (
              <Outlet />
            )}
          </div>
        </main>

        <nav className="rf7-mobile-bottom-nav" aria-label="Mobile navigation">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive({
              item,
              pathname: location.pathname,
              search: location.search,
            });

            return (
              <NavLink
                key={item.label}
                className={`rf7-mobile-nav-link-v7 ${active ? "active" : ""}`}
                to={item.to}
              >
                <span className="rf7-mobile-nav-icon-v7">
                  <Icon size={19} />
                  {creditsExhausted &&
                  item.creditGated ? (
                    <Lock
                      className="rf7-mobile-credit-lock-v9"
                      size={10}
                    />
                  ) : null}
                  {Number(item.count || 0) > 0 ? (
                    <em>{formatCount(item.count)}</em>
                  ) : null}
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {commandOpen ? (
          <div
            className="rf7-command-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) {
                setCommandOpen(false);
              }
            }}
          >
            <div
              className="rf7-command"
              role="dialog"
              aria-modal="true"
              aria-label="ReachFly command palette"
            >
              <div className="rf7-command-input">
                <Search size={19} />
                <input
                  ref={commandInputRef}
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  placeholder="Search pages or start an action..."
                  autoComplete="off"
                />
                <span className="rf7-key-hint">ESC</span>
              </div>

              <div className="rf7-command-results">
                {filteredCommandItems.length ? (
                  filteredCommandItems.map((item, index) => {
                    const Icon = item.icon || Search;
                    return (
                      <button
                        className="rf7-command-item-v7"
                        type="button"
                        key={`${item.to}-${item.label}`}
                        autoFocus={index === 0 && !commandQuery}
                        onClick={() => navigateFromOverlay(item.to)}
                      >
                        <span className="rf7-command-item-icon-v7">
                          <Icon size={17} />
                        </span>
                        <span className="rf7-command-item-copy-v7">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    );
                  })
                ) : (
                  <div className="rf7-command-empty">
                    No matching ReachFly actions found.
                  </div>
                )}
              </div>

              <div className="rf7-command-footer-v7">
                <span>
                  <kbd>↑</kbd><kbd>↓</kbd> navigate
                </span>
                <span>
                  <kbd>↵</kbd> open
                </span>
                <span>
                  <kbd>esc</kbd> close
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
}

function Breadcrumbs({ items }) {
  if (!items?.length) return null;

  return (
    <nav className="rf7-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span className="rf7-breadcrumb-v7" key={`${item.label}-${index}`}>
          {index > 0 ? <ChevronRight size={13} aria-hidden="true" /> : null}
          {item.to && index < items.length - 1 ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <strong>{item.label}</strong>
          )}
        </span>
      ))}
    </nav>
  );
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div
      className="rf7-toast-stack-v7"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = toast.type === "success" ? CheckCircle2 : toast.type === "error" ? X : toast.type === "warning" ? Clock3 : Bell;

        return (
          <article
            className={`rf7-toast-v7 ${toast.type}`}
            key={toast.id}
            style={{ "--rf7-toast-duration": `${toast.duration}ms` }}
          >
            <span className="rf7-toast-icon-v7" aria-hidden="true">
              <Icon size={19} />
            </span>

            <span className="rf7-toast-copy-v7">
              <strong>{toast.title}</strong>
              {toast.message ? <small>{toast.message}</small> : null}
            </span>

            {toast.action?.label && toast.action?.onClick ? (
              <button
                className="rf7-toast-action-v7"
                type="button"
                onClick={() => toast.action.onClick()}
              >
                {toast.action.label}
              </button>
            ) : null}

            <button
              className="rf7-toast-close-v7"
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(toast.id)}
            >
              <X size={15} />
            </button>

            <span className="rf7-toast-progress-v7" />
          </article>
        );
      })}
    </div>
  );
}

/*
 * Small shell-only motion/detail layer.
 * The primary Stitch design tokens/layout stay in styles.css. These styles make
 * shell popovers, command results and toast messages functional immediately.
 */
function ShellMotionStyles() {
  return (
    <style>{`
      .rf7-sidebar-close-v7{display:none}
      .rf7-profile-link-v7{text-decoration:none}
      .rf7-profile-settings-v7,.rf7-profile-logout-v7{width:30px;height:30px;flex:0 0 30px;color:rgba(240,241,242,.52)}
      .rf7-profile-settings-v7:hover{color:#fff}
      .rf7-profile-logout-v7:hover{color:#ffb4ab;background:rgba(255,180,171,.08)}
      .rf7-topbar-popover-anchor-v7{position:relative;display:flex;align-items:center}
      .rf7-topbar-popover-anchor-v7 .rf7-quick-create{top:47px;right:0}
      .rf7-credit-pill-v7{min-height:38px;display:flex;align-items:center;gap:8px;padding:4px 9px 4px 5px;color:var(--rf7-text);background:linear-gradient(135deg,#f7f6ff,#fff);border:1px solid #dfdefd;border-radius:11px;text-decoration:none;box-shadow:0 3px 12px rgba(70,72,212,.08);transition:transform 150ms var(--rf7-ease),box-shadow 150ms var(--rf7-ease),border-color 150ms var(--rf7-ease)}
      .rf7-credit-pill-v7:hover{transform:translateY(-1px);border-color:#c7c7ff;box-shadow:0 7px 18px rgba(70,72,212,.13)}
      .rf7-credit-icon-v7{width:29px;height:29px;display:grid;place-items:center;flex:0 0 29px;color:#fff;background:linear-gradient(145deg,#6063ee,#7b46de);border-radius:9px;box-shadow:0 5px 11px rgba(96,99,238,.22)}
      .rf7-credit-copy-v7{display:grid;gap:0;min-width:45px}
      .rf7-credit-copy-v7 strong{font-family:Geist,Inter,sans-serif;color:var(--rf7-text);font-size:11px;line-height:14px;font-variant-numeric:tabular-nums}
      .rf7-credit-copy-v7 small{color:var(--rf7-text-muted);font-size:8px;line-height:10px}
      .rf7-credit-usage-v7{padding:3px 6px;color:#4f4fc9;background:#ececff;border-radius:999px;font-size:7px;font-weight:700;white-space:nowrap}
      .rf7-search-command-v7{appearance:none;display:inline-flex;padding:0;background:transparent;border:0;cursor:pointer}
      .rf7-popover-enter-v7{animation:rf7PopoverIn 180ms var(--rf7-ease)}
      @keyframes rf7PopoverIn{from{opacity:0;transform:translateY(-5px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
      .rf7-popover-title-v7{display:grid;gap:1px;padding:7px 9px 9px;margin-bottom:3px;border-bottom:1px solid var(--rf7-outline)}
      .rf7-popover-title-v7 strong{font-family:Geist,Inter,sans-serif;font-size:12px;color:var(--rf7-text)}
      .rf7-popover-title-v7 span{font-size:10px;color:var(--rf7-text-muted)}
      .rf7-menu-item-rich-v7{align-items:flex-start;min-height:50px}
      .rf7-menu-icon-v7{width:30px;height:30px;display:grid;place-items:center;flex:0 0 30px;color:var(--rf7-primary);background:var(--rf7-primary-soft);border-radius:8px}
      .rf7-menu-item-rich-v7>span:last-child{min-width:0;display:grid;gap:1px}
      .rf7-menu-item-rich-v7 strong{color:var(--rf7-text);font-size:11px;font-weight:650;line-height:15px}
      .rf7-menu-item-rich-v7 small{color:var(--rf7-text-muted);font-size:9px;line-height:13px}
      .rf7-menu-item-rich-v7:hover strong{color:var(--rf7-primary)}
      .rf7-notifications-popover-v7{top:47px;right:-48px;width:min(360px,calc(100vw - 24px));padding:0;overflow:hidden}
      .rf7-notifications-head-v7{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 15px;border-bottom:1px solid var(--rf7-outline)}
      .rf7-notifications-head-v7>div{display:grid;gap:1px}
      .rf7-notifications-head-v7 strong{font-family:Geist,Inter,sans-serif;font-size:13px;color:var(--rf7-text)}
      .rf7-notifications-head-v7 span{font-size:9px;color:var(--rf7-text-muted)}
      .rf7-notifications-count-v7{min-width:20px;height:20px;display:grid;place-items:center;color:#fff!important;background:var(--rf7-primary);border-radius:999px;font-weight:700}
      .rf7-notifications-list-v7{max-height:360px;overflow:auto;padding:6px}
      .rf7-notification-item-v7{width:100%;display:flex;align-items:center;gap:10px;padding:10px;color:var(--rf7-text-soft);background:transparent;border:0;border-radius:8px;text-align:left;cursor:pointer;transition:background 160ms var(--rf7-ease),transform 160ms var(--rf7-ease)}
      .rf7-notification-item-v7:hover{background:var(--rf7-surface-low);transform:translateX(1px)}
      .rf7-notification-icon-v7{width:32px;height:32px;display:grid;place-items:center;flex:0 0 32px;border-radius:9px}
      .rf7-notification-icon-v7.primary{color:var(--rf7-primary);background:var(--rf7-primary-soft)}
      .rf7-notification-icon-v7.success{color:var(--rf7-success);background:var(--rf7-success-bg)}
      .rf7-notification-icon-v7.warning{color:var(--rf7-warning);background:var(--rf7-warning-bg)}
      .rf7-notification-copy-v7{min-width:0;flex:1;display:grid;gap:2px}
      .rf7-notification-copy-v7 strong{color:var(--rf7-text);font-size:10px;line-height:14px}
      .rf7-notification-copy-v7 small{color:var(--rf7-text-muted);font-size:9px;line-height:13px}
      .rf7-notifications-empty-v7{display:grid;justify-items:center;gap:5px;padding:28px 20px;color:var(--rf7-success);text-align:center}
      .rf7-notifications-empty-v7 strong{color:var(--rf7-text);font-size:11px}
      .rf7-notifications-empty-v7 span{color:var(--rf7-text-muted);font-size:9px}
      .rf7-notifications-footer-v7{display:flex;align-items:center;justify-content:center;gap:4px;padding:10px;color:var(--rf7-primary);border-top:1px solid var(--rf7-outline);text-decoration:none;font-size:10px;font-weight:650}
      .rf7-topbar-profile-v7{display:flex;align-items:center;gap:8px;min-height:38px;padding:3px 7px 3px 4px;color:var(--rf7-text-soft);text-decoration:none;border-radius:9px;transition:background 160ms var(--rf7-ease)}
      .rf7-topbar-profile-v7:hover{background:var(--rf7-surface-low)}
      .rf7-topbar-avatar-v7{width:30px;height:30px;display:grid;place-items:center;overflow:hidden;color:#fff;background:linear-gradient(145deg,#6e70e4,#8c58e3);border-radius:50%;font-size:10px;font-weight:700}
      .rf7-topbar-avatar-v7 img{width:100%;height:100%;object-fit:cover}
      .rf7-topbar-profile-copy-v7{display:grid;gap:0;max-width:120px}
      .rf7-topbar-profile-copy-v7 strong,.rf7-topbar-profile-copy-v7 small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .rf7-topbar-profile-copy-v7 strong{color:var(--rf7-text);font-size:10px;line-height:14px}
      .rf7-topbar-profile-copy-v7 small{color:var(--rf7-text-muted);font-size:8px;line-height:11px}
      .rf7-breadcrumb-v7{display:inline-flex;align-items:center;gap:7px}
      .rf7-breadcrumb-v7 a{color:var(--rf7-text-soft);text-decoration:none;transition:color 150ms var(--rf7-ease)}
      .rf7-breadcrumb-v7 a:hover{color:var(--rf7-primary)}
      .rf7-command-item-v7{width:100%;min-height:52px;display:flex;align-items:center;gap:11px;padding:9px 10px;color:var(--rf7-text-soft);background:transparent;border:0;border-radius:9px;text-align:left;cursor:pointer;transition:background 140ms var(--rf7-ease),transform 140ms var(--rf7-ease)}
      .rf7-command-item-v7:hover,.rf7-command-item-v7:focus-visible{outline:none;background:var(--rf7-primary-soft);transform:translateX(1px)}
      .rf7-command-item-icon-v7{width:32px;height:32px;display:grid;place-items:center;flex:0 0 32px;color:var(--rf7-primary);background:#fff;border:1px solid var(--rf7-outline);border-radius:8px}
      .rf7-command-item-copy-v7{min-width:0;flex:1;display:grid;gap:1px}
      .rf7-command-item-copy-v7 strong{color:var(--rf7-text);font-size:11px;line-height:15px}
      .rf7-command-item-copy-v7 small{color:var(--rf7-text-muted);font-size:9px;line-height:13px}
      .rf7-command-footer-v7{display:flex;align-items:center;gap:15px;padding:9px 14px;color:var(--rf7-text-muted);background:var(--rf7-surface-low);border-top:1px solid var(--rf7-outline);font-size:9px}
      .rf7-command-footer-v7 span{display:flex;align-items:center;gap:3px}
      .rf7-command-footer-v7 kbd{min-width:18px;height:18px;display:inline-grid;place-items:center;padding:0 4px;color:var(--rf7-text-soft);background:#fff;border:1px solid var(--rf7-outline-strong);border-radius:4px;font:600 8px Inter,sans-serif}
      .rf7-toast-stack-v7{position:fixed;z-index:200;top:78px;right:18px;width:min(390px,calc(100vw - 28px));display:grid;gap:9px;pointer-events:none}
      .rf7-toast-v7{--toast-accent:var(--rf7-info);position:relative;display:flex;align-items:flex-start;gap:10px;overflow:hidden;padding:13px 39px 14px 13px;color:var(--rf7-text);background:rgba(255,255,255,.97);border:1px solid var(--rf7-outline);border-left:3px solid var(--toast-accent);border-radius:12px;box-shadow:var(--rf7-shadow-2);pointer-events:auto;animation:rf7ToastIn 260ms var(--rf7-ease)}
      .rf7-toast-v7.success{--toast-accent:var(--rf7-success)}
      .rf7-toast-v7.error{--toast-accent:var(--rf7-danger)}
      .rf7-toast-v7.warning{--toast-accent:var(--rf7-warning)}
      .rf7-toast-v7.info{--toast-accent:var(--rf7-info)}
      .rf7-toast-icon-v7{width:30px;height:30px;display:grid;place-items:center;flex:0 0 30px;color:var(--toast-accent);background:color-mix(in srgb,var(--toast-accent) 10%,white);border-radius:9px}
      .rf7-toast-copy-v7{min-width:0;flex:1;display:grid;gap:2px;padding-top:1px}
      .rf7-toast-copy-v7 strong{font-family:Geist,Inter,sans-serif;font-size:11px;line-height:15px}
      .rf7-toast-copy-v7 small{color:var(--rf7-text-soft);font-size:9px;line-height:14px}
      .rf7-toast-action-v7{align-self:center;padding:5px 8px;color:var(--toast-accent);background:transparent;border:0;border-radius:6px;cursor:pointer;font-size:9px;font-weight:700}
      .rf7-toast-action-v7:hover{background:var(--rf7-surface-low)}
      .rf7-toast-close-v7{position:absolute;top:9px;right:8px;width:27px;height:27px;display:grid;place-items:center;color:var(--rf7-text-muted);background:transparent;border:0;border-radius:7px;cursor:pointer}
      .rf7-toast-close-v7:hover{color:var(--rf7-text);background:var(--rf7-surface-low)}
      .rf7-toast-progress-v7{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--toast-accent);transform-origin:left;animation:rf7ToastProgress var(--rf7-toast-duration) linear forwards}
      @keyframes rf7ToastIn{from{opacity:0;transform:translate3d(18px,-4px,0) scale(.98)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}
      @keyframes rf7ToastProgress{from{transform:scaleX(1)}to{transform:scaleX(0)}}
      .rf7-mobile-nav-link-v7{position:relative;min-width:0;display:grid;justify-items:center;gap:2px;padding:7px 5px;color:var(--rf7-text-muted);text-decoration:none;font-size:8px;font-weight:600;transition:color 150ms var(--rf7-ease),transform 150ms var(--rf7-ease)}
      .rf7-mobile-nav-link-v7.active{color:var(--rf7-primary)}
      .rf7-mobile-nav-link-v7:active{transform:scale(.96)}
      .rf7-mobile-nav-icon-v7{position:relative;width:31px;height:25px;display:grid;place-items:center;border-radius:10px;transition:background 150ms var(--rf7-ease)}
      .rf7-mobile-nav-link-v7.active .rf7-mobile-nav-icon-v7{background:var(--rf7-primary-soft)}
      .rf7-mobile-nav-icon-v7 em{position:absolute;top:-4px;right:-7px;min-width:15px;height:15px;display:grid;place-items:center;padding:0 3px;color:#fff;background:#e43e46;border:2px solid #fff;border-radius:999px;font-size:7px;font-style:normal}
      @media(max-width:900px){.rf7-sidebar-close-v7{display:inline-grid}.rf7-topbar-profile-copy-v7{display:none}.rf7-topbar-profile-v7>svg{display:none}}
      @media(max-width:640px){.rf7-topbar-profile-v7{display:none}.rf7-credit-usage-v7,.rf7-credit-copy-v7 small{display:none}.rf7-credit-pill-v7{padding-right:6px;gap:5px}.rf7-topbar-end{gap:4px}.rf7-topbar .rf7-topbar-icon{width:34px;height:34px;flex-basis:34px}.rf7-notifications-popover-v7{position:fixed;top:62px;right:8px}.rf7-toast-stack-v7{top:67px;right:10px;width:calc(100vw - 20px)}.rf7-mobile-bottom-nav{position:fixed;z-index:75;right:0;bottom:0;left:0;height:62px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;padding:4px 7px calc(4px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid var(--rf7-outline);box-shadow:0 -8px 24px rgba(20,24,31,.06);backdrop-filter:blur(14px)}}
      /* ReachFly V9 shared-credit lock states */
      .rf7-nav-link.credit-locked{color:#94939d}
      .rf7-nav-link.credit-locked .rf7-credit-lock-icon-v9{
        margin-left:auto;color:#8d8b96
      }
      .rf7-mobile-nav-icon-v7{position:relative}
      .rf7-mobile-credit-lock-v9{
        position:absolute;top:-4px;right:-7px;padding:1px;border-radius:50%;
        color:#fff;background:#6b6874;
      }
      .rf7-credit-lock-state-v9{
        width:min(650px,calc(100% - 28px));min-height:390px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        margin:34px auto;padding:34px;border:1px solid #e1e2e7;border-radius:18px;
        background:radial-gradient(circle at 50% 0,rgba(90,82,230,.09),transparent 38%),#fff;
        box-shadow:0 15px 40px rgba(30,33,52,.055);text-align:center;
      }
      .rf7-credit-lock-visual-v9{
        width:54px;height:54px;display:grid;place-items:center;margin-bottom:12px;
        border-radius:15px;color:#5658d9;background:#eeeeff;
      }
      .rf7-credit-lock-state-v9>span{
        color:#6966df;font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;
      }
      .rf7-credit-lock-state-v9 h1{
        margin:7px 0 0;color:#252732;font-family:Geist,Inter,sans-serif;
        font-size:27px;letter-spacing:-.03em;
      }
      .rf7-credit-lock-state-v9 p{
        max-width:490px;margin:8px 0 0;color:#777884;font-size:11px;line-height:17px;
      }
      .rf7-credit-lock-state-v9>div:last-child{
        display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;
      }
      .rf7-credit-lock-buy-v9,.rf7-credit-lock-secondary-v9{
        min-height:40px;display:inline-flex;align-items:center;justify-content:center;
        gap:6px;padding:0 14px;border-radius:10px;text-decoration:none;
        font-size:10px;font-weight:800;
      }
      .rf7-credit-lock-buy-v9{
        color:#fff;background:linear-gradient(135deg,#5558e8,#8054df);
        box-shadow:0 8px 18px rgba(82,84,219,.17);
      }
      .rf7-credit-lock-secondary-v9{
        color:#5658d7;border:1px solid #dedff0;background:#f8f8ff;
      }
      @media(max-width:560px){
        .rf7-credit-lock-state-v9{width:calc(100% - 16px);min-height:340px;padding:25px 18px}
        .rf7-credit-lock-state-v9>div:last-child{width:100%;flex-direction:column}
        .rf7-credit-lock-buy-v9,.rf7-credit-lock-secondary-v9{width:100%}
      }

      @media(prefers-reduced-motion:reduce){.rf7-popover-enter-v7,.rf7-toast-v7,.rf7-toast-progress-v7{animation:none!important}.rf7-command-item-v7,.rf7-notification-item-v7{transition:none!important}}
    `}</style>
  );
}

function isNavActive({ item, pathname, search }) {
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

    return pathname.startsWith(queryPathPrefix) && matchesQuery;
  }

  if (
    Array.isArray(item.matchPrefixes) &&
    item.matchPrefixes.some((prefix) => pathname.startsWith(prefix))
  ) {
    if (
      item.to === "/app/role-operations?tab=team" &&
      new URLSearchParams(search).get("tab") &&
      !["team"].includes(new URLSearchParams(search).get("tab"))
    ) {
      return false;
    }

    return true;
  }

  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) {
    return true;
  }

  const itemPath = item.to?.split("?")[0];
  return itemPath ? pathname === itemPath : false;
}

function buildBreadcrumbs(pathname, search) {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  const view = params.get("view");

  if (pathname.startsWith("/app/voice-agent")) {
    if (tab === "calls") {
      return [
        { label: "AI Voice", to: "/app/agents" },
        { label: view === "active-calls" ? "Live Calls" : "Calls" },
      ];
    }

    if (tab === "meetings") {
      return [
        { label: "CRM", to: "/app/contacts" },
        { label: "Meetings" },
      ];
    }

    if (tab === "leads") {
      return [
        { label: "Communication", to: "/app/inbox" },
        { label: "Dialer" },
      ];
    }

    if (["my-numbers", "buy-numbers", "connect-number"].includes(view)) {
      return [
        { label: "AI Voice", to: "/app/agents" },
        { label: "Phone Numbers" },
      ];
    }

    return [
      { label: "AI Voice", to: "/app/agents" },
      { label: "Voice Agent" },
    ];
  }

  if (pathname.startsWith("/app/leads")) {
    if (view === "all") {
      return [
        { label: "Growth", to: "/app/leads?view=discover" },
        { label: "All Leads" },
      ];
    }
    if (view === "external") {
      return [
        { label: "Growth", to: "/app/leads?view=discover" },
        { label: "External Leads" },
      ];
    }
  }

  const routeMap = [
    ["/app/platform-admin", ["Home", "Platform Admin"]],
    ["/app/dashboard", ["Home", "Dashboard"]],
    ["/app/leads", ["Growth", "Leads"]],
    ["/app/builder", ["Growth", "Leads"]],
    ["/app/my-leads", ["Growth", "My Leads"]],
    ["/app/campaigns", ["Growth", "Campaigns"]],
    ["/app/ai", ["Growth", "AI Audits"]],
    ["/app/inbox", ["Communication", "Inbox"]],
    ["/app/email", ["Communication", "Email"]],
    ["/app/whatsapp", ["Communication", "WhatsApp"]],
    ["/app/call-workspace", ["Communication", "Dialer"]],
    ["/app/agents", ["AI Voice", "Voice Agents"]],
    ["/app/contacts", ["CRM", "Contacts"]],
    ["/app/pipeline", ["CRM", "Pipeline"]],
    ["/app/role-operations", ["Workspace", "Team"]],
    ["/app/billing", ["Workspace", "Billing"]],
    ["/app/connections", ["Workspace", "Integrations"]],
    ["/app/settings", ["Workspace", "Settings"]],
    ["/app/analytics", ["More", "Analytics"]],
    ["/app/territories", ["More", "Territories"]],
    ["/app/resource-board", ["More", "Resource Board"]],
    ["/app/attendance", ["More", "Attendance"]],
    ["/app/profile-settings", ["Account", "Profile"]],
  ];

  const match = routeMap.find(([prefix]) => pathname.startsWith(prefix));
  const labels = match?.[1] || ["ReachFly"];

  return labels.map((label, index) => ({
    label,
    to:
      index === 0 && labels.length > 1
        ? resolveBreadcrumbRoot(label)
        : undefined,
  }));
}

function resolveBreadcrumbRoot(label) {
  const map = {
    Home: "/app/dashboard",
    Growth: "/app/leads?view=discover",
    Communication: "/app/inbox",
    "AI Voice": "/app/agents",
    CRM: "/app/contacts",
    Workspace: "/app/role-operations?tab=team",
    Account: "/app/profile-settings",
    More: "/app/analytics",
  };

  return map[label];
}

function getCreditGate(location) {
  const pathname =
    String(location?.pathname || "");

  const params =
    new URLSearchParams(
      location?.search || ""
    );

  if (pathname.startsWith("/app/leads")) {
    if (["external", "all", "results"].includes(params.get("view"))) {
      return null;
    }

    return {
      title: "Lead discovery is locked",
      feature: "lead discovery",
      description:
        "Your ReachFly credit balance is empty. Add credits to find new leads again. Imported/external leads remain available from the Leads section.",
    };
  }

  if (
    pathname.startsWith("/app/builder") ||
    pathname.startsWith("/app/lead-discovery")
  ) {
    return {
      title: "Lead discovery is locked",
      feature: "lead discovery",
      description:
        "Your ReachFly credit balance is empty. Add credits to find new prospects.",
    };
  }

  if (
    pathname.startsWith("/app/ai") ||
    pathname.startsWith("/app/audits") ||
    pathname.startsWith("/app/website-audits") ||
    pathname.startsWith("/app/ai-audits")
  ) {
    return {
      title: "AI Audits are locked",
      feature: "AI Audits",
      description:
        "Your ReachFly credit balance is empty. Add credits to run another metered audit or research action.",
    };
  }

  if (
    pathname === "/app/dialer" ||
    pathname.startsWith("/app/call-workspace")
  ) {
    return {
      title: "AI calling is locked",
      feature: "AI calling",
      description:
        "Your ReachFly credit balance is empty. Add credits before starting new connected calling activity.",
    };
  }

  if (pathname.startsWith("/app/voice-agent")) {
    const tab = params.get("tab");
    const view = params.get("view");

    if (
      tab === "leads" ||
      ["dialer", "quick-lead"].includes(view)
    ) {
      return {
        title: "AI calling is locked",
        feature: "AI calling",
        description:
          "Your ReachFly credit balance is empty. Add credits to launch new AI calling activity.",
      };
    }
  }

  return null;
}

function CreditLockedState({ gate }) {
  return (
    <section className="rf7-credit-lock-state-v9">
      <div className="rf7-credit-lock-visual-v9">
        <Lock size={25} />
      </div>

      <span>Credits required</span>
      <h1>{gate?.title || "This feature is locked"}</h1>
      <p>
        {gate?.description ||
          "Add ReachFly credits to continue using this metered feature."}
      </p>

      <div>
        <Link
          className="rf7-credit-lock-buy-v9"
          to="/app/billing"
        >
          Buy credits
          <ChevronRight size={14} />
        </Link>

        {gate?.feature === "lead discovery" ? (
          <Link
            className="rf7-credit-lock-secondary-v9"
            to="/app/leads?view=external"
          >
            Open imported leads
          </Link>
        ) : (
          <Link
            className="rf7-credit-lock-secondary-v9"
            to="/app/voice-start"
          >
            Back to workspace
          </Link>
        )}
      </div>
    </section>
  );
}

function normalizeToast(input = {}) {
  const type = ["success", "error", "warning", "info"].includes(input.type)
    ? input.type
    : "info";

  const fallbackTitles = {
    success: "Success",
    error: "Something went wrong",
    warning: "Attention needed",
    info: "Update",
  };

  const durationNumber = Number(input.duration || 4200);

  return {
    type,
    title: String(input.title || fallbackTitles[type]),
    message: input.message ? String(input.message) : "",
    duration:
      Number.isFinite(durationNumber) && durationNumber >= 1800
        ? Math.min(durationNumber, 12_000)
        : 4200,
    action: input.action || null,
  };
}

function normalizeCollection(value, keys = []) {
  if (Array.isArray(value)) return value;

  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }

  return [];
}

function dedupeCommandItems(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = `${item.label}|${item.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreCommandItem(item, query) {
  const label = String(item.label || "").toLowerCase();
  const description = String(item.description || "").toLowerCase();
  const keywords = String(item.keywords || "").toLowerCase();

  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (label.includes(query)) return 60;
  if (keywords.includes(query)) return 40;
  if (description.includes(query)) return 20;
  return 0;
}

function normalizeRole(value) {
  const role = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (role.includes("owner")) return "owner";
  if (role.includes("admin")) return "admin";
  if (role.includes("manager")) return "manager";

  if (
    role === "caller" ||
    role.includes("cold_caller") ||
    role.includes("sales_representative") ||
    role.includes("sales_rep") ||
    role.includes("telemarketer")
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
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatCount(value) {
  const number = Number(value || 0);
  if (number > 99) return "99+";
  return String(number);
}

function getInitials(value) {
  return String(value || "RF")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}
