import { useEffect } from "react";

import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Analytics as VercelAnalytics,
} from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import {
  AuthProvider,
  useAuth,
} from "./auth/AuthContext";

import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "./auth/protectedRoute";

import AppShell from "./components/AppShell";
import ReachFlyAIFloating from "./components/ReachFlyAIFloating";
import RoleOperations from "./components/RoleOperations";

/*
 * Public pages
 */
import Marketing from "./pages/Marketing";
import SeoLanding from "./pages/SeoLanding";
import BlogIndexPage from "./pages/BlogIndexPage";
import BlogPostPage from "./pages/BlogPostPage";

/*
 * Authentication pages
 */
import Login from "./pages/Login";
import Signup from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite from "./pages/AcceptInvite";
import LegalPage from "./pages/LegalPage";

/*
 * Main application pages
 */
import DashboardV6 from "./pages/DashboardV6";
import Builder from "./pages/Builder";
import CampaignList from "./pages/CampaignList";
import CampaignDetail from "./pages/CampaignDetail";
import PipelineBuilder from "./pages/PipelineBuilder";
import EmailSetup from "./pages/EmailSetup";
import WhatsAppSetup from "./pages/WhatsAppSetup";
import ReachFlyAI from "./pages/ReachFlyAI";
import Analytics from "./pages/Analytics";
import Contacts from "./pages/Contacts";
import Inbox from "./pages/Inbox";
import InboxDetail from "./pages/InboxDetails";
import Territories from "./pages/Territories";
import Settings from "./pages/Settings";
import ExternalLeadCampaign from "./pages/ExternalLeadCampaign";

/*
 * Role-based work pages
 */
import MyLeadsPage from "./pages/MyLeadsPage";
import CallWorkspacePage from "../src/pages/CallWorkspacePage";
import ProfileSettingsPage from "../src/pages/ProfileSettingsPage";
import AttendancePage from "../src/pages/AttendancePage";
import CallerDashboard from "../src/pages/CallerDashboardPage";
import ManagerResourceBoard from "../src/pages/ManagerResourceBoard";
import TelnyxAIAgentPage from "../src/pages/TelnyxAIAgentPage";
import CodesyncAdminPage from "./pages/CodesyncAdminPage";
import CreditsBillingPage from "./pages/CreditsBillingPage";
import AIWorkforcePage from "./pages/AIWorkforcePage";
import VoiceCommerceStorePage from "./pages/VoiceCommerceStorePage";
import ConnectionsPage from "./pages/ConnectionsPage";
import SalesOperations from "./pages/SalesOperations";
import TeamPerformance from "./pages/TeamPerformance";

import "./styles.css";

/* Final V7 operational integration: invitation acceptance remains public;
 * Sales Operations and Team Performance now have canonical authenticated routes. */

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
    getDefaultDashboardPath(role);

  return (
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
                  <ReachFlyAI />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="campaigns"
              element={
                <ManagerOnlyRoute>
                  <Navigate
                    to="/app/campaigns/active"
                    replace
                  />
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
                  <Navigate
                    to="/app/voice-agent?tab=setup&view=my-numbers"
                    replace
                  />
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
              path="dialer"
              element={<DialerRoute />}
            />

            <Route
              path="integrations"
              element={
                <WorkspaceManagementRoute>
                  <ConnectionsPage />
                </WorkspaceManagementRoute>
              }
            />

            {/*
             * Manager-only lead generation
             */}
            <Route
              path="builder"
              element={
                <ManagerOnlyRoute>
                  <Builder />
                </ManagerOnlyRoute>
              }
            />

            <Route
              path="launch-campaign"
              element={
                <ManagerOnlyRoute>
                  <Navigate
                    to="/app/builder"
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
                  <ExternalLeadCampaign />
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
                <Navigate
                  to="/app/role-operations"
                  replace
                />
              }
            />

            <Route
              path="sales-operations"
              element={
                <WorkspaceManagementRoute>
                  <SalesOperations />
                </WorkspaceManagementRoute>
              }
            />

            <Route
              path="sales"
              element={
                <WorkspaceManagementRoute>
                  <Navigate
                    to="/app/sales-operations"
                    replace
                  />
                </WorkspaceManagementRoute>
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

            <Route
              path="agents"
              element={
                <WorkspaceManagementRoute>
                  <AIWorkforcePage />
                </WorkspaceManagementRoute>
              }
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
                <WorkspaceManagementRoute>
                  <ConnectionsPage />
                </WorkspaceManagementRoute>
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
                  <TeamPerformance />
                </WorkspaceManagementRoute>
              }
            />

            <Route
              path="team-performance"
              element={
                <WorkspaceManagementRoute>
                  <TeamPerformance />
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
                <WorkspaceManagementRoute>
                  <EmailSetup />
                </WorkspaceManagementRoute>
              }
            />

            <Route
              path="email-setup"
              element={
                <WorkspaceManagementRoute>
                  <Navigate
                    to="/app/email"
                    replace
                  />
                </WorkspaceManagementRoute>
              }
            />

            <Route
              path="whatsapp"
              element={
                <WorkspaceManagementRoute>
                  <WhatsAppSetup />
                </WorkspaceManagementRoute>
              }
            />

            {/*
             * Intelligence
             */}
            <Route
              path="ai"
              element={
                <WorkspaceManagementRoute>
                  <ReachFlyAI />
                </WorkspaceManagementRoute>
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
                  to={defaultDashboardPath}
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

      {isAuthenticated &&
      !initializing ? (
        <ReachFlyAIFloating />
      ) : null}
    </>
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
  const { user, initializing } = useAuth();

  if (initializing) {
    return <RouteLoadingState label="Loading leads" />;
  }

  const role = normalizeRole(user?.workspaceRole || user?.role || "caller");

  if (role === "caller") {
    return <MyLeadsPage />;
  }

  if (["owner", "admin", "manager"].includes(role)) {
    return <Builder />;
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
 * Canonical dialer route. Human callers keep their dedicated call workspace;
 * managers and individual Voice Agent accounts use the existing Voice Agent
 * manual-dialer view.
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
    return (
      <Navigate
        to="/app/voice-agent?tab=leads&view=dialer"
        replace
      />
    );
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
 * - campaign contacts
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
  role
) {
  if (role === "caller") {
    return "dashboard";
  }

  return "dashboard";
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