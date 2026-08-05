import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function PermissionRoute({ permission, children }) {
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const allowed = permissions.includes("*") || permissions.includes(permission);
  return allowed ? children : <Navigate to="/app/my-leads" replace />;
}

export function WorkspaceHomeRedirect() {
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const isOwnerOrManager = permissions.includes("*") || permissions.includes("view_team_performance");
  return <Navigate to={isOwnerOrManager ? "/app/dashboard" : "/app/my-leads"} replace />;
}

export function visibleNavigation(user, items = []) {
  const permissions = user?.permissions || [];
  return items.filter((item) => {
    if (!item.permission) return true;
    return permissions.includes("*") || permissions.includes(item.permission);
  });
}
