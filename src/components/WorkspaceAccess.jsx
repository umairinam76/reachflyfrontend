import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  useAuth,
} from "../auth/AuthContext";

/**
 * Permission-aware route guard for legacy workspace surfaces.
 *
 * Existing `permission` + `children` contract is preserved. The optional
 * `redirectTo` prop lets newer callers choose a different safe fallback.
 */
export function PermissionRoute({
  permission,
  children,
  redirectTo = "/app/my-leads",
}) {
  const {
    user,
    initializing,
  } = useAuth();

  const location =
    useLocation();

  if (initializing) {
    return (
      <WorkspaceAccessLoading />
    );
  }

  if (
    hasWorkspacePermission(
      user,
      permission
    )
  ) {
    return (
      children ||
      <Outlet />
    );
  }

  return (
    <Navigate
      to={
        safeWorkspacePath(
          redirectTo
        )
      }
      replace
      state={{
        accessDeniedFrom:
          `${location.pathname}${location.search}`,
      }}
    />
  );
}

/**
 * Sends users to the most useful default workspace page supported by their
 * permissions. This preserves the original manager/owner-vs-caller behavior.
 */
export function WorkspaceHomeRedirect() {
  const {
    user,
    initializing,
  } = useAuth();

  if (initializing) {
    return (
      <WorkspaceAccessLoading />
    );
  }

  const canViewTeam =
    hasWorkspacePermission(
      user,
      "view_team_performance"
    );

  return (
    <Navigate
      to={
        canViewTeam
          ? "/app/dashboard"
          : "/app/my-leads"
      }
      replace
    />
  );
}

/**
 * Filters navigation items without mutating the supplied array.
 * Items without a permission remain visible exactly as before.
 */
export function visibleNavigation(
  user,
  items = []
) {
  if (
    !Array.isArray(items)
  ) {
    return [];
  }

  return items.filter(
    (item) => {
      if (
        !item?.permission
      ) {
        return true;
      }

      if (
        Array.isArray(
          item.permission
        )
      ) {
        return item.permission.some(
          (permission) =>
            hasWorkspacePermission(
              user,
              permission
            )
        );
      }

      return hasWorkspacePermission(
        user,
        item.permission
      );
    }
  );
}

export function hasWorkspacePermission(
  user,
  permission
) {
  if (!permission) {
    return true;
  }

  const permissions =
    normalizePermissions(
      user?.permissions
    );

  return (
    permissions.has("*") ||
    permissions.has(
      normalizePermission(
        permission
      )
    )
  );
}

function normalizePermissions(
  value
) {
  const rows =
    Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : [];

  return new Set(
    rows
      .map(
        normalizePermission
      )
      .filter(Boolean)
  );
}

function normalizePermission(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function safeWorkspacePath(
  value
) {
  const path =
    String(value || "")
      .trim();

  if (
    path === "/app" ||
    path.startsWith(
      "/app/"
    )
  ) {
    return path;
  }

  return "/app/my-leads";
}

function WorkspaceAccessLoading() {
  return (
    <div
      className="rf-workspace-access-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <WorkspaceAccessStyles />

      <span aria-hidden="true">
        <i />
        <i />
        <i />
      </span>

      <strong>
        Opening your workspace…
      </strong>
    </div>
  );
}

function WorkspaceAccessStyles() {
  return (
    <style>{`
      .rf-workspace-access-loading{
        width:100%;
        min-height:220px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:8px;
        padding:24px;
        color:#191c1d;
        background:#fff;
        border:1px solid #e2e4e7;
        border-radius:12px;
        box-sizing:border-box;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-workspace-access-loading > span{
        width:48px;
        height:48px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:4px;
        background:#e8e9ff;
        border-radius:12px;
      }

      .rf-workspace-access-loading i{
        width:6px;
        height:6px;
        background:#4648d4;
        border-radius:50%;
        animation:rfwaPulse 1s infinite ease-in-out;
      }

      .rf-workspace-access-loading i:nth-child(2){
        animation-delay:.12s;
      }

      .rf-workspace-access-loading i:nth-child(3){
        animation-delay:.24s;
      }

      .rf-workspace-access-loading strong{
        font:600 8px/12px Geist,Inter,sans-serif;
      }

      @keyframes rfwaPulse{
        0%,100%{opacity:.4;transform:translateY(0)}
        50%{opacity:1;transform:translateY(-3px)}
      }

      @media(prefers-reduced-motion:reduce){
        .rf-workspace-access-loading i{
          animation:none!important;
        }
      }
    `}</style>
  );
}
