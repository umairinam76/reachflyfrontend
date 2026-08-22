import { lazy, Suspense, useEffect } from "react";

import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute, PublicOnlyRoute } from "./auth/protectedRoute";

/*
 * Route-level code splitting
 * --------------------------
 * ReachFly previously imported almost every public and authenticated page into
 * the initial bundle. That made the browser download, parse and evaluate code
 * for pages the visitor had not opened, contributing to the high FCP/LCP seen
 * in Vercel Speed Insights. Keep only auth/router primitives eager and load each
 * feature when its route is actually visited.
 */
const AppShell = lazy(() => import("./components/AppShell"));
const ReachFlyAIFloating = lazy(() => import("./components/ReachFlyAIFloating"));
const RoleOperations = lazy(() => import("./components/RoleOperations"));

/* Public pages */
const Marketing = lazy(() => import("./pages/Marketing"));
const SeoLanding = lazy(() => import("./pages/SeoLanding"));
const BlogIndexPage = lazy(() => import("./pages/BlogIndexPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));

/* Authentication pages */
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));

/* Main application pages */
const DashboardV6 = lazy(() => import("./pages/DashboardV6"));
const Builder = lazy(() => import("./pages/Builder"));
const CampaignList = lazy(() => import("./pages/CampaignList"));
const CampaignCreate = lazy(() => import("./pages/CampaignCreate"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const PipelineBuilder = lazy(() => import("./pages/PipelineBuilder"));
const WebsiteAudits = lazy(() => import("./pages/WebsiteAudits"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Companies = lazy(() => import("./pages/Companies"));
const Inbox = lazy(() => import("./pages/Inbox"));
const InboxDetail = lazy(() => import("./pages/InboxDetails"));
const Territories = lazy(() => import("./pages/Territories"));
const Settings = lazy(() => import("./pages/Settings"));
const ExternalLeadCampaign = lazy(() => import("./pages/ExternalLeadCampaign"));

/* Role-based work pages */
const MyLeadsPage = lazy(() => import("./pages/MyLeadsPage"));
const CallWorkspacePage = lazy(() => import("./pages/CallWorkspacePage"));
const ProfileSettingsPage = lazy(() => import("./pages/ProfileSettingsPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const CallerDashboard = lazy(() => import("./pages/CallerDashboardPage"));
const ManagerResourceBoard = lazy(() => import("./pages/ManagerResourceBoard"));
const TelnyxAIAgentPage = lazy(() => import("./pages/TelnyxAIAgentPage"));
const TelnyxDialer = lazy(() => import("./pages/TelnyxDialer"));
const CodesyncAdminPage = lazy(() => import("./pages/CodesyncAdminPage"));
const CreditsBillingPage = lazy(() => import("./pages/CreditsBillingPage"));
const VoiceStartPage = lazy(() => import("./pages/VoiceStartPage"));
const AIWorkforcePage = lazy(() => import("./pages/AIWorkforcePage"));
const VoiceCommerceStorePage = lazy(() => import("./pages/VoiceCommerceStorePage"));
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage"));
const PhoneNumbersPage = lazy(() => import("./pages/PhoneNumbersPage"));
const NicheOperations = lazy(() => import("./pages/NicheOperations"));

import "./styles.css";

/**
 * Routes rendered inside AuthProvider.
 */
function AppRoutes() {
  const {
    isAuthenticated,
    initializing,
    user,
  } = useAuth();

  const role = normalizeRole(
    user?.workspaceRole ||
      user?.role ||
      "caller"
  );

  const defaultDashboardPath =
    getDefaultDashboardPath(
      role,
      user
    );

  return (
    <Suspense fallback={<RouteLoadingState label="Loading ReachFly" />}>
      <>
        <Routes>
        {/*
         * Public marketing pages
         */}
        <Route
          path="/"
          element={<Marketing />}
        />

        <Route
          path="/ai-marketing-software"
          element={
            <SeoLanding variant="ai-marketing" />
          }
        />

        <Route
          path="/ai-lead-generation-crm"
          element={
            <SeoLanding variant="lead-generation" />
          }
        />

        <Route
          path="/website-audit-outreach-tool"
          element={
            <SeoLanding variant="website-audit" />
          }
        />

        <Route
          path="/auto-reach-crm"
          element={
            <SeoLanding variant="autoreach" />
          }
        />

        <Route
          path="/local-lead-generation-tool"
          element={
            <SeoLanding variant="local-leads" />
          }
        />

        <Route
          path="/lead-scraping-software"
          element={
            <SeoLanding variant="lead-scraping" />
          }
        />

        <Route
          path="/blog"
          element={<BlogIndexPage />}
        />

        <Route
          path="/blog/:slug"
          element={<BlogPostPage />}
        />

        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/contact" element={<LegalPage kind="contact" />} />

        {/*
         * Workspace invitation acceptance must stay public even when the normal
         * login/signup pages are guarded by PublicOnlyRoute. Invitation links
         * arrive by email before the invited user has a ReachFly session.
         */}
        <Route
          path="/accept-invite"
          element={<AcceptInvite />}
        />

        <Route
          path="/invite/accept"
          element={<PreserveSearchRedirect to="/accept-invite" />}
        />

        {/*
         * Authentication pages
         */}
        <Route element={<PublicOnlyRoute />}>
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/signup"
            element={<Signup />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />
        </Route>

        {/*
         * Authenticated application
         */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/app"
            element={<AppShell />}
          >
            <Route
              index
              element={
                <Navigate
                  to={defaultDashboardPath}
                  replace
                />
              }
            />

            {/*
             * Dashboard
             *
             * Available to every authenticated role.
             */}
            <Route
              path="dashboard"
              element={<DashboardRoute />}
            />

            <Route
              path="voice-start"
              element={
                <VoiceAgentRoute>
                  <VoiceStartPage />
                </VoiceAgentRoute>
              }
            />

            {/*
             * Canonical V7 product routes.
             *
             * These aliases let the new Stitch navigation use clean product
             * language while the underlying production pages are migrated one
             * by one. Existing URLs remain active below, so bookmarks, emails,
             * backend redirects and deep links continue to work.
             */}
            <Route
              path="leads"
              element={<LeadsRoute />}
            />

            <Route
              path="lead-discovery"
              element={<LeadsRoute />}
            />

            <Route
              path="audits"
              element={
                <ManagerOnlyRoute>
                  <WebsiteAudits />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="website-audits"
              element={
                <ManagerOnlyRoute>
                  <PreserveSearchRedirect to="/app/audits" />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="ai-audits"
              element={
                <ManagerOnlyRoute>
                  <PreserveSearchRedirect to="/app/audits" />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="campaigns"
              element={
                <ManagerOnlyRoute>
                  <CampaignList />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="voice-agents"
              element={<VoiceAgentsRoute />}
            />

            <Route
              path="phone-numbers"
              element={
                <VoiceAgentRoute>
                  <PhoneNumbersPage />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="meetings"
              element={
                <VoiceAgentRoute>
                  <Navigate
                    to="/app/voice-agent?tab=meetings&view=upcoming"
                    replace
                  />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="inbound"
              element={
                <VoiceAgentRoute>
                  <Navigate
                    to="/app/voice-agent?tab=calls&view=active-calls&direction=inbound"
                    replace
                  />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="outbound"
              element={
                <VoiceAgentRoute>
                  <Navigate
                    to="/app/voice-agent?tab=calls&view=active-calls&direction=outbound"
                    replace
                  />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="call-history"
              element={
                <VoiceAgentRoute>
                  <Navigate
                    to="/app/voice-agent?tab=calls&view=call-history"
                    replace
                  />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="dialer"
              element={<DialerRoute />}
            />

            <Route
              path="integrations"
              element={
                <VoiceAgentRoute>
                  <ConnectionsPage />
                </VoiceAgentRoute>
              }
            />

            {/*
             * Manager-only lead generation
             */}
            <Route
              path="builder"
              element={
                <ManagerOnlyRoute>
                  <Navigate
                    to="/app/leads?view=discover"
                    replace
                  />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="launch-campaign"
              element={
                <ManagerOnlyRoute>
                  <Navigate
                    to="/app/campaigns/new"
                    replace
                  />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="create-campaign"
              element={
                <ManagerOnlyRoute>
                  <Navigate
                    to="/app/campaigns/new"
                    replace
                  />
                </ManagerOnlyRoute>
              }
            />

            {/*
             * Manager-only campaign pages
             */}
            <Route
              path="campaigns/active"
              element={
                <ManagerOnlyRoute>
                  <CampaignList status="active" />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="campaigns/queued"
              element={
                <ManagerOnlyRoute>
                  <CampaignList status="queued" />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="campaigns/history"
              element={
                <ManagerOnlyRoute>
                  <CampaignList status="history" />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="campaigns/external-leads"
              element={
                <ManagerOnlyRoute>
                  <Navigate
                    to="/app/leads?view=external"
                    replace
                  />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="campaigns/new"
              element={
                <ManagerOnlyRoute>
                  <CampaignCreate />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="campaigns/:id"
              element={
                <ManagerOnlyRoute>
                  <CampaignDetail />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="campaigns/:id/pipeline"
              element={
                <ManagerOnlyRoute>
                  <PipelineBuilder />
                </ManagerOnlyRoute>
              }
            />

            {/*
             * Manager-only pipeline and territory pages
             */}
            <Route
              path="pipeline"
              element={
                <ManagerOnlyRoute>
                  <PipelineBuilder />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="territories"
              element={
                <ManagerOnlyRoute>
                  <Territories />
                </ManagerOnlyRoute>
              }
            />

            {/*
             * Caller-only assigned lead pages
             */}
            <Route
              path="my-leads"
              element={
                <CallerOnlyRoute>
                  <MyLeadsPage />
                </CallerOnlyRoute>
              }
            />

            <Route
              path="attendance"
              element={
                <CallerOnlyRoute>
                  <AttendancePage />
                </CallerOnlyRoute>
              }
            />

            <Route
              path="assigned-leads"
              element={
                <CallerOnlyRoute>
                  <Navigate
                    to="/app/my-leads"
                    replace
                  />
                </CallerOnlyRoute>
              }
            />

            {/*
             * Caller call workspace
             */}
            <Route
              path="call-workspace"
              element={
                <CallerOnlyRoute>
                  <CallWorkspacePage />
                </CallerOnlyRoute>
              }
            />

            <Route
              path="calls"
              element={<CallsRoute />}
            />

            {/*
             * Role operations
             *
             * The RoleOperations component is responsible for
             * displaying the correct tabs and actions for each role.
             */}
            <Route
              path="role-operations"
              element={<RoleOperations />}
            />

            <Route
              path="operations"
              element={
                <VoiceAgentRoute>
                  <NicheOperations />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="resource-board"
              element={
                <WorkspaceManagementRoute>
                  <ManagerResourceBoard />
                </WorkspaceManagementRoute>
              }
            />

            {/*
             * Legacy AI Workforce URL.
             * Keep old links/bookmarks working, but always resolve to the
             * canonical Agents workspace instead of falling into the nested
             * wildcard redirect.
             */}
            <Route
              path="ai-workforce/*"
              element={
                <Navigate
                  to="/app/agents"
                  replace
                />
              }
            />

            <Route
              path="agents"
              element={<VoiceAgentsRoute />}
            />

            <Route
              path="commerce"
              element={
                <WorkspaceManagementRoute>
                  <VoiceCommerceStorePage />
                </WorkspaceManagementRoute>
              }
            />

            <Route
              path="connections"
              element={
                <VoiceAgentRoute>
                  <PreserveSearchRedirect to="/app/integrations" />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="platform-admin"
              element={
                <CodesyncAdminRoute>
                  <CodesyncAdminPage />
                </CodesyncAdminRoute>
              }
            />

            <Route
              path="billing"
              element={<CreditsBillingPage />}
            />

            <Route
              path="voice-agent"
              element={
                <VoiceAgentRoute>
                  <TelnyxAIAgentPage />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="team-management"
              element={
                <WorkspaceManagementRoute>
                  <ManagerResourceBoard />
                </WorkspaceManagementRoute>
              }
            />

            <Route
              path="team"
              element={
                <Navigate
                  to="/app/role-operations?tab=team"
                  replace
                />
              }
            />


            <Route
              path="team/performance"
              element={
                <WorkspaceManagementRoute>
                  <Navigate
                    to="/app/analytics"
                    replace
                  />
                </WorkspaceManagementRoute>
              }
            />

            {/*
             * Team communication
             */}
            <Route
              path="team-communication"
              element={
                <Navigate
                  to="/app/role-operations?tab=communication"
                  replace
                />
              }
            />

            <Route
              path="chat"
              element={
                <Navigate
                  to="/app/role-operations?tab=communication"
                  replace
                />
              }
            />

            <Route
              path="tasks"
              element={
                <Navigate
                  to="/app/role-operations?tab=assignments"
                  replace
                />
              }
            />

            <Route
              path="assignments"
              element={
                <Navigate
                  to="/app/role-operations?tab=assignments"
                  replace
                />
              }
            />

            {/*
             * Owner, administrator and manager configuration
             */}
            <Route
              path="email"
              element={
                <VoiceAgentRoute>
                  <PreserveSearchRedirect to="/app/integrations" />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="email-setup"
              element={
                <VoiceAgentRoute>
                  <PreserveSearchRedirect to="/app/integrations" />
                </VoiceAgentRoute>
              }
            />

            <Route
              path="whatsapp"
              element={
                <VoiceAgentRoute>
                  <PreserveSearchRedirect to="/app/integrations" />
                </VoiceAgentRoute>
              }
            />

            {/*
             * Intelligence
             */}
            <Route
              path="ai"
              element={
                <ManagerOnlyRoute>
                  <PreserveSearchRedirect to="/app/audits" />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="analytics"
              element={
                <WorkspaceManagementRoute>
                  <Analytics />
                </WorkspaceManagementRoute>
              }
            />

            {/*
             * Manager contacts
             *
             * The campaign/lead workflow is manager-controlled.
             */}
            <Route
              path="contacts"
              element={
                <ManagerOnlyRoute>
                  <Contacts />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="companies"
              element={
                <ManagerOnlyRoute>
                  <Companies />
                </ManagerOnlyRoute>
              }
            />

            {/*
             * Compatibility aliases for older account/company links. These do
             * not create a second source of truth; they preserve any existing
             * deep links while the CRM navigation moves to /app/companies.
             */}
            <Route
              path="accounts"
              element={
                <ManagerOnlyRoute>
                  <PreserveSearchRedirect to="/app/companies" />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="company"
              element={
                <ManagerOnlyRoute>
                  <PreserveSearchRedirect to="/app/companies" />
                </ManagerOnlyRoute>
              }
            />

            {/*
             * Inbox
             *
             * Keep available to authenticated roles for now.
             * Backend permissions remain authoritative.
             */}
            <Route
              path="inbox"
              element={<Inbox />}
            />

            <Route
              path="inbox/:messageId"
              element={<InboxDetail />}
            />

            {/*
             * Profile
             */}
            <Route
              path="profile-settings"
              element={<ProfileSettingsPage />}
            />

            <Route
              path="profile"
              element={
                <Navigate
                  to="/app/profile-settings"
                  replace
                />
              }
            />

            {/*
             * Owner and administrator workspace settings
             */}
            <Route
              path="settings"
              element={
                <OwnerAdminRoute>
                  <Settings />
                </OwnerAdminRoute>
              }
            />

            {/*
             * Application fallback
             */}
            <Route
              path="*"
              element={
                <Navigate
                  to={`/app/${defaultDashboardPath}`}
                  replace
                />
              }
            />
          </Route>
        </Route>

        {/*
         * Global fallback
         */}
        <Route
          path="*"
          element={
            <Navigate
              to={
                isAuthenticated
                  ? `/app/${defaultDashboardPath}`
                  : "/"
              }
              replace
            />
          }
        />
      </Routes>

        {isAuthenticated && !initializing ? (
          <ReachFlyAIFloating />
        ) : null}
      </>
    </Suspense>
  );
}

/**
 * Renders the caller-specific dashboard for caller accounts
 * and the standard workspace dashboard for other roles.
 */
function DashboardRoute() {
  const {
    user,
    initializing,
  } = useAuth();

  if (initializing) {
    return <RouteLoadingState label="Loading dashboard" />;
  }

  const role = normalizeRole(
    user?.workspaceRole ||
      user?.role ||
      "caller"
  );

  if (isCodesyncDashboardUser(user)) {
    return <CodesyncAdminPage />;
  }

  return role === "caller"
    ? <CallerDashboard />
    : <DashboardV6 />;
}

/**
 * Canonical Leads destination. Managers/owners/admins use the prospect builder;
 * callers stay inside their assigned-lead workspace.
 */
function LeadsRoute() {
  const {
    user,
    initializing,
  } = useAuth();

  const location =
    useLocation();

  if (initializing) {
    return (
      <RouteLoadingState label="Loading leads" />
    );
  }

  const role =
    normalizeRole(
      user?.workspaceRole ||
        user?.role ||
        "caller"
    );

  if (role === "caller") {
    return <MyLeadsPage />;
  }

  if (
    ["owner", "admin", "manager"].includes(
      role
    )
  ) {
    const params =
      new URLSearchParams(
        location.search
      );

    const requestedView =
      params.get("view") ||
      "discover";

    const view =
      requestedView === "external"
        ? "external"
        : requestedView === "all"
          ? "all"
          : requestedView === "results"
            ? "results"
            : "discover";

    return (
      <section className="rf-leads-workspace-v9">
        <style>{`
          .rf-leads-workspace-v9{
            min-width:0;
          }

          .rf-leads-workspace-tabs-v9{
            width:max-content;
            max-width:100%;
            display:flex;
            align-items:center;
            gap:6px;
            margin:0 0 14px;
            padding:5px;
            border:1px solid #e4e5ea;
            border-radius:12px;
            background:#fff;
            box-shadow:0 5px 18px rgba(28,31,50,.035);
          }

          .rf-leads-workspace-tabs-v9 a{
            min-height:34px;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            padding:0 12px;
            border-radius:8px;
            color:#666874;
            text-decoration:none;
            font-size:10px;
            font-weight:750;
          }

          .rf-leads-workspace-tabs-v9 a.active{
            color:#fff;
            background:linear-gradient(135deg,#5658e7,#7855df);
            box-shadow:0 6px 16px rgba(84,86,224,.17);
          }

          @media(max-width:620px){
            .rf-leads-workspace-tabs-v9{
              width:100%;
            }

            .rf-leads-workspace-tabs-v9 a{
              flex:1;
            }
          }
        `}</style>

        <nav
          className="rf-leads-workspace-tabs-v9"
          aria-label="Lead workspace"
        >
          <Link
            className={
              ["discover", "results"].includes(view)
                ? "active"
                : ""
            }
            to="/app/leads?view=discover"
          >
            Find leads
          </Link>

          <Link
            className={
              view === "all"
                ? "active"
                : ""
            }
            to="/app/leads?view=all"
          >
            All leads
          </Link>

          <Link
            className={
              view === "external"
                ? "active"
                : ""
            }
            to="/app/leads?view=external"
          >
            Import / external leads
          </Link>
        </nav>

        {view === "external"
          ? <ExternalLeadCampaign />
          : <Builder />}
      </section>
    );
  }

  return (
    <AccessRedirect
      to="/app/dashboard"
      title="Lead access restricted"
      message="Your workspace role does not have access to lead discovery."
    />
  );
}

/**
 * Canonical Voice Agents destination. Individual accounts go directly into
 * their Voice Agent workspace; company managers retain the existing workforce
 * page while that page is visually migrated to the Stitch design.
 */
function VoiceAgentsRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <RouteLoadingState label="Loading Voice Agents" />;
  }

  const role = normalizeRole(user?.workspaceRole || user?.role || "caller");
  const accountType = String(user?.accountType || user?.workspaceType || "")
    .trim()
    .toLowerCase();

  if (accountType === "individual") {
    return <Navigate to="/app/voice-agent" replace />;
  }

  if (["owner", "admin", "manager"].includes(role)) {
    return <AIWorkforcePage />;
  }

  return (
    <AccessRedirect
      to="/app/dashboard"
      title="Voice Agent access unavailable"
      message="Your current workspace role does not have access to Voice Agents."
    />
  );
}

/**
 * Calls keeps the existing human-caller workflow for caller accounts and sends
 * Voice Agent-enabled workspaces to the AI call history.
 */
function CallsRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <RouteLoadingState label="Loading calls" />;
  }

  const role = normalizeRole(user?.workspaceRole || user?.role || "caller");
  const accountType = String(user?.accountType || user?.workspaceType || "")
    .trim()
    .toLowerCase();

  if (role === "caller") {
    return (
      <Navigate
        to="/app/role-operations?tab=calls"
        replace
      />
    );
  }

  if (["owner", "admin", "manager"].includes(role) || accountType === "individual") {
    return (
      <Navigate
        to="/app/voice-agent?tab=calls&view=call-history"
        replace
      />
    );
  }

  return (
    <AccessRedirect
      to="/app/dashboard"
      title="Call access restricted"
      message="Your workspace role does not have access to call history."
    />
  );
}

/**
 * Canonical dialer route. Human callers keep their assigned calling workspace;
 * managers and individual Voice Agent accounts get the dedicated ReachFly
 * dialer instead of being pushed back into the Voice Agent configuration page.
 */
function DialerRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <RouteLoadingState label="Loading dialer" />;
  }

  const role = normalizeRole(user?.workspaceRole || user?.role || "caller");
  const accountType = String(user?.accountType || user?.workspaceType || "")
    .trim()
    .toLowerCase();

  if (role === "caller") {
    return <CallWorkspacePage />;
  }

  if (["owner", "admin", "manager"].includes(role) || accountType === "individual") {
    return <TelnyxDialer />;
  }

  return (
    <AccessRedirect
      to="/app/dashboard"
      title="Dialer access restricted"
      message="Your workspace role does not have access to the dialer."
    />
  );
}

function isCodesyncDashboardUser(user) {
  const email = String(user?.email || "")
    .trim()
    .toLowerCase();

  if (email !== "owner@codesynclabs.com") {
    return false;
  }

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
    "codesync_labs_workspace",
    "codesync_labs",
    "codesynclabs",
  ]);

  return values.some(
    (value) =>
      codesyncIds.has(value) ||
      value.startsWith("codesync_labs_")
  );
}

/**
 * Manager-only route.
 *
 * Used for:
 * - lead generation
 * - campaigns
 * - lead assignment pages
 * - pipelines
 * - territories
 * - campaign contacts and companies
 */
function ManagerOnlyRoute({
  children,
}) {
  return (
    <RoleAccess
      allowedRoles={[
        "owner",
        "admin",
        "manager",
      ]}
      fallbackPath="/app/dashboard"
    >
      {children}
    </RoleAccess>
  );
}

/**
 * Caller-only route.
 *
 * Used for:
 * - assigned leads
 * - caller workspace
 */
function CallerOnlyRoute({
  children,
}) {
  return (
    <RoleAccess
      allowedRoles={[
        "caller",
      ]}
      fallbackPath="/app/dashboard"
    >
      {children}
    </RoleAccess>
  );
}

/**
 * Owner, administrator and manager workspace tools.
 *
 * This does not include lead generation or campaign management.
 */
function WorkspaceManagementRoute({
  children,
}) {
  return (
    <RoleAccess
      allowedRoles={[
        "owner",
        "admin",
        "manager",
      ]}
      fallbackPath="/app/dashboard"
    >
      {children}
    </RoleAccess>
  );
}

/**
 * Paid AI voice-agent route.
 *
 * Customer workspaces are allowed here. Commercial access is enforced by the
 * backend: owners/admins can purchase numbers and call credits, managers may
 * operate configured Voice Agents, and individual accounts may manage their
 * own paid Voice Agent.
 */
function VoiceAgentRoute({
  children,
}) {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <RouteLoadingState label="Loading Voice Agent" />;
  }

  const role = normalizeRole(
    user?.workspaceRole ||
      user?.role ||
      "caller"
  );
  const accountType = String(
    user?.accountType ||
      user?.workspaceType ||
      ""
  )
    .trim()
    .toLowerCase();

  const allowedRole = [
    "owner",
    "admin",
    "manager",
  ].includes(role);
  const individual = accountType === "individual";

  if (!allowedRole && !individual) {
    return (
      <AccessRedirect
        to="/app/dashboard"
        title="Voice Agent access unavailable"
        message="Your current workspace role does not have access to this area."
      />
    );
  }

  return children;
}

function CodesyncAdminRoute({ children }) {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <RouteLoadingState label="Loading platform admin" />;
  }

  const email = String(user?.email || "")
    .trim()
    .toLowerCase();

  if (email !== "owner@codesynclabs.com") {
    return (
      <AccessRedirect
        to="/app/dashboard"
        title="Platform admin access restricted"
        message="This area is available only to the ReachFly platform owner."
      />
    );
  }

  return children;
}


/**
 * Owner and administrator route.
 */
function OwnerAdminRoute({
  children,
}) {
  return (
    <RoleAccess
      allowedRoles={[
        "owner",
        "admin",
      ]}
      fallbackPath="/app/dashboard"
    >
      {children}
    </RoleAccess>
  );
}

/**
 * Restricts individual pages while preserving the
 * authenticated application shell.
 */
function RoleAccess({
  allowedRoles = [],
  fallbackPath = "",
  children,
}) {
  const {
    user,
    initializing,
  } = useAuth();

  if (initializing) {
    return <RouteLoadingState label="Loading workspace" />;
  }

  const role = normalizeRole(
    user?.workspaceRole ||
      user?.role ||
      "caller"
  );

  if (
    !allowedRoles.includes(role)
  ) {
    const redirectPath =
      fallbackPath ||
      getUnauthorizedRedirectPath(
        role
      );

    return (
      <AccessRedirect
        to={redirectPath}
        title="Access restricted"
        message="Your workspace role does not have permission to open that page."
      />
    );
  }

  return children;
}

/**
 * Unauthorized role redirects.
 *
 * Callers are redirected to their assigned-lead page.
 * Owners, administrators and managers go to the dashboard.
 */
function getUnauthorizedRedirectPath(
  role
) {
  if (role === "caller") {
    return "/app/my-leads";
  }

  return "/app/dashboard";
}

/**
 * Default route after entering /app.
 *
 * Owner and manager accounts open the dashboard.
 * Caller accounts open their assigned-lead workspace.
 */
function getDefaultDashboardPath(
  role,
  user
) {
  if (
    isCodesyncDashboardUser(
      user
    )
  ) {
    return "platform-admin";
  }

  if (role === "caller") {
    return "dashboard";
  }

  return "voice-start";
}

/**
 * Keeps invitation tokens and any other query parameters intact when routing
 * legacy public links into their canonical destination.
 */
function PreserveSearchRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search || ""}`} replace />;
}

/**
 * Animated shell-friendly loading state. It uses the V7 design primitives
 * already appended to styles.css, so old pages stay untouched.
 */
function RouteLoadingState({ label = "Loading workspace" }) {
  return (
    <div
      className="rf7-page-content"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className="rf7-card pad"
        style={{
          display: "grid",
          gap: 14,
          maxWidth: 760,
          marginTop: 24,
          animation: "rf7-modal-in 180ms var(--rf7-ease, ease)",
        }}
      >
        <div className="rf7-skeleton" style={{ width: 120, height: 12 }} />
        <div className="rf7-skeleton" style={{ width: "58%", height: 28 }} />
        <div className="rf7-skeleton" style={{ width: "82%", height: 13 }} />
        <div className="rf7-skeleton" style={{ width: "70%", height: 13 }} />
        <span className="rf7-muted" style={{ fontSize: 13 }}>
          {label}…
        </span>
      </div>
    </div>
  );
}

/**
 * Redirects an unauthorized route and uses the AppShell toast bridge to give
 * the user a clear animated explanation instead of silently jumping pages.
 */
function AccessRedirect({
  to,
  title = "Access restricted",
  message = "You do not have permission to open that page.",
}) {
  const navigate = useNavigate();

  useEffect(() => {
    window.reachflyToast?.warning?.(title, message, { duration: 4200 });
    navigate(to, { replace: true });
  }, [navigate, to, title, message]);

  return <RouteLoadingState label="Redirecting" />;
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

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <VercelAnalytics />
      <SpeedInsights />
    </AuthProvider>
  );
}