import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

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

/*
 * Authentication pages
 */
import Login from "./pages/Login";
import Signup from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

/*
 * Main application pages
 */
import Dashboard from "./pages/Dashboard";
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
              element={
                <Navigate
                  to="/app/role-operations?tab=calls"
                  replace
                />
              }
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
              path="resource-board"
              element={
                <WorkspaceManagementRoute>
                  <ManagerResourceBoard />
                </WorkspaceManagementRoute>
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
    return (
      <div className="route-loading-state">
        Loading dashboard…
      </div>
    );
  }

  const role = normalizeRole(
    user?.workspaceRole ||
      user?.role ||
      "caller"
  );

  return role === "caller"
    ? <CallerDashboard />
    : <Dashboard />;
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
    return (
      <div className="route-loading-state">
        Loading workspace…
      </div>
    );
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
      <Navigate
        to={redirectPath}
        replace
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
    </AuthProvider>
  );
}