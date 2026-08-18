import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  useAuth,
} from "./AuthContext";

export function ProtectedRoute({
  children,
}) {
  const {
    isAuthenticated,
    initializing,
  } = useAuth();

  const location =
    useLocation();

  if (
    initializing
  ) {
    return (
      <RouteLoadingState
        label="Opening your workspace…"
      />
    );
  }

  if (
    !isAuthenticated
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from:
            getCurrentPath(
              location
            ),
        }}
      />
    );
  }

  return (
    children ||
    <Outlet />
  );
}

export function PublicOnlyRoute({
  children,
}) {
  const {
    isAuthenticated,
    initializing,
  } = useAuth();

  const location =
    useLocation();

  if (
    initializing
  ) {
    return (
      <RouteLoadingState
        label="Checking your session…"
      />
    );
  }

  if (
    isAuthenticated
  ) {
    return (
      <Navigate
        to={
          getSafeDestination(
            location.state
              ?.from
          )
        }
        replace
      />
    );
  }

  return (
    children ||
    <Outlet />
  );
}

function getCurrentPath(
  location
) {
  const pathname =
    String(
      location?.pathname ||
        ""
    );

  const search =
    String(
      location?.search ||
        ""
    );

  const hash =
    String(
      location?.hash ||
        ""
    );

  return (
    `${pathname}${search}${hash}` ||
    "/app/dashboard"
  );
}

function getSafeDestination(
  value
) {
  const destination =
    String(
      value ||
        ""
    ).trim();

  if (
    destination.startsWith(
      "/app/"
    ) ||
    destination ===
      "/app"
  ) {
    return destination;
  }

  return "/app/dashboard";
}

function RouteLoadingState({
  label,
}) {
  return (
    <main
      className="rf-route-loading-v7"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <RouteLoadingStyles />

      <div className="rf-route-loading-v7__card">
        <span
          className="rf-route-loading-v7__mark"
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
        </span>

        <strong>
          {label}
        </strong>

        <p>
          ReachFly is restoring your secure workspace session.
        </p>
      </div>
    </main>
  );
}

function RouteLoadingStyles() {
  return (
    <style>{`
      .rf-route-loading-v7{
        --rfrl-text:#191c1d;
        --rfrl-muted:#777784;
        --rfrl-line:#e2e4e7;
        --rfrl-primary:#4648d4;
        width:100%;
        min-height:100vh;
        display:grid;
        place-items:center;
        padding:24px;
        color:var(--rfrl-text);
        background:#f8f9fa;
        box-sizing:border-box;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-route-loading-v7 *,
      .rf-route-loading-v7 *::before,
      .rf-route-loading-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfrlPulse{
        0%,100%{opacity:.38;transform:translateY(0)}
        50%{opacity:1;transform:translateY(-3px)}
      }

      .rf-route-loading-v7__card{
        width:min(390px,100%);
        min-height:190px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:7px;
        padding:24px;
        text-align:center;
        background:#fff;
        border:1px solid var(--rfrl-line);
        border-radius:14px;
        box-shadow:0 14px 40px rgba(25,28,29,.06);
      }

      .rf-route-loading-v7__mark{
        width:52px;
        height:52px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:4px;
        margin-bottom:4px;
        background:#e8e9ff;
        border-radius:13px;
      }

      .rf-route-loading-v7__mark i{
        width:6px;
        height:6px;
        background:var(--rfrl-primary);
        border-radius:50%;
        animation:rfrlPulse 1s infinite ease-in-out;
      }

      .rf-route-loading-v7__mark i:nth-child(2){
        animation-delay:.12s;
      }

      .rf-route-loading-v7__mark i:nth-child(3){
        animation-delay:.24s;
      }

      .rf-route-loading-v7__card strong{
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rf-route-loading-v7__card p{
        max-width:310px;
        margin:0;
        color:var(--rfrl-muted);
        font-size:7px;
        line-height:12px;
      }

      @media(prefers-reduced-motion:reduce){
        .rf-route-loading-v7__mark i{
          animation:none!important;
        }
      }
    `}</style>
  );
}

export default ProtectedRoute;
