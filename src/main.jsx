import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
} from "react-router-dom";

import "leaflet/dist/leaflet.css";
import "./styles.css";

import App from "./App.jsx";

const rootElement =
  document.getElementById(
    "root"
  );

if (!rootElement) {
  throw new Error(
    'Application root element "#root" was not found.'
  );
}

class ReachFlyRootBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      error:
        null,
    };
  }

  static getDerivedStateFromError(
    error
  ) {
    return {
      error,
    };
  }

  componentDidCatch(
    error,
    info
  ) {
    if (
      import.meta.env.DEV
    ) {
      console.error(
        "ReachFly root render error",
        error,
        info
      );
    }
  }

  render() {
    if (
      !this.state.error
    ) {
      return this.props.children;
    }

    return (
      <RootRecoveryScreen
        onRetry={() => {
          this.setState({
            error:
              null,
          });
        }}
      />
    );
  }
}

function RootRecoveryScreen({
  onRetry,
}) {
  return (
    <main
      className="rf-root-recovery"
      role="alert"
    >
      <RootRecoveryStyles />

      <section className="rf-root-recovery__card">
        <span
          className="rf-root-recovery__mark"
          aria-hidden="true"
        >
          RF
        </span>

        <small>
          ReachFly workspace
        </small>

        <h1>
          This screen needs to reload.
        </h1>

        <p>
          Your account data is not changed by this display error. Retry the
          workspace first, or reload the browser if the screen still does not
          open.
        </p>

        <div className="rf-root-recovery__actions">
          <button
            type="button"
            onClick={onRetry}
          >
            Retry workspace
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() =>
              window.location.reload()
            }
          >
            Reload page
          </button>
        </div>
      </section>
    </main>
  );
}

function RootRecoveryStyles() {
  return (
    <style>{`
      .rf-root-recovery{
        --rfr-text:#191c1d;
        --rfr-text2:#4d4c59;
        --rfr-muted:#777784;
        --rfr-line:#e2e4e7;
        --rfr-primary:#4648d4;
        --rfr-primary-dark:#393bbb;
        width:100%;
        min-height:100vh;
        display:grid;
        place-items:center;
        padding:24px;
        color:var(--rfr-text);
        background:
          radial-gradient(circle at 85% 10%,rgba(70,72,212,.06),transparent 28%),
          #f8f9fa;
        box-sizing:border-box;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-root-recovery *,
      .rf-root-recovery *::before,
      .rf-root-recovery *::after{
        box-sizing:border-box;
      }

      .rf-root-recovery__card{
        width:min(510px,100%);
        display:grid;
        justify-items:start;
        gap:6px;
        padding:26px;
        background:#fff;
        border:1px solid var(--rfr-line);
        border-radius:15px;
        box-shadow:0 20px 55px rgba(25,28,29,.09);
      }

      .rf-root-recovery__mark{
        width:46px;
        height:46px;
        display:grid;
        place-items:center;
        margin-bottom:5px;
        color:#fff;
        background:linear-gradient(135deg,#5658df,#4648d4 55%,#6b38d4);
        border-radius:11px;
        font-size:11px;
        font-weight:850;
        letter-spacing:-.04em;
      }

      .rf-root-recovery__card small{
        color:var(--rfr-primary);
        font-size:6px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-root-recovery__card h1{
        margin:0;
        font:600 24px/31px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-root-recovery__card p{
        margin:2px 0 0;
        color:var(--rfr-text2);
        font-size:8px;
        line-height:14px;
      }

      .rf-root-recovery__actions{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-top:10px;
      }

      .rf-root-recovery__actions button{
        min-height:39px;
        padding:8px 11px;
        color:#fff;
        background:var(--rfr-primary);
        border:1px solid var(--rfr-primary);
        border-radius:8px;
        cursor:pointer;
        font-size:7px;
        font-weight:750;
      }

      .rf-root-recovery__actions button:hover{
        background:var(--rfr-primary-dark);
      }

      .rf-root-recovery__actions button.secondary{
        color:var(--rfr-text);
        background:#fff;
        border-color:var(--rfr-line);
      }

      @media(max-width:520px){
        .rf-root-recovery{
          padding:14px;
        }

        .rf-root-recovery__card{
          padding:20px;
        }

        .rf-root-recovery__actions{
          display:grid;
          grid-template-columns:1fr;
          width:100%;
        }

        .rf-root-recovery__actions button{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-root-recovery *,
        .rf-root-recovery *::before,
        .rf-root-recovery *::after{
          transition:none!important;
          animation:none!important;
        }
      }
    `}</style>
  );
}

ReactDOM.createRoot(
  rootElement
).render(
  <React.StrictMode>
    <ReachFlyRootBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ReachFlyRootBoundary>
  </React.StrictMode>
);
