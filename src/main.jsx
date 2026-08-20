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
      error: null,
      retryKey: 0,
      errorId: "",
    };

    this.retry =
      this.retry.bind(this);
  }

  static getDerivedStateFromError(
    error
  ) {
    return {
      error,
      errorId:
        createErrorId(),
    };
  }

  componentDidCatch(
    error,
    info
  ) {
    /*
     * Do not hide production render errors completely.
     * This logs only the JavaScript error/React component stack and
     * never intentionally logs auth tokens or API secrets.
     */
    console.error(
      "[ReachFly] root render error",
      {
        errorId:
          this.state.errorId,
        name:
          error?.name ||
          "Error",
        message:
          error?.message ||
          String(error),
        componentStack:
          info?.componentStack ||
          "",
      }
    );

    try {
      window.dispatchEvent(
        new CustomEvent(
          "reachfly:root-error",
          {
            detail: {
              errorId:
                this.state
                  .errorId,
              message:
                String(
                  error?.message ||
                  "Unknown render error"
                ).slice(
                  0,
                  500
                ),
            },
          }
        )
      );
    } catch {
      // Diagnostics must never create a second render failure.
    }
  }

  retry() {
    this.setState(
      (current) => ({
        error: null,
        errorId: "",
        retryKey:
          current.retryKey +
          1,
      })
    );
  }

  render() {
    if (
      this.state.error
    ) {
      return (
        <RootRecoveryScreen
          error={
            this.state.error
          }
          errorId={
            this.state.errorId
          }
          onRetry={
            this.retry
          }
        />
      );
    }

    return (
      <React.Fragment
        key={
          this.state.retryKey
        }
      >
        {this.props.children}
      </React.Fragment>
    );
  }
}

function RootRecoveryScreen({
  error,
  errorId,
  onRetry,
}) {
  const showDetails =
    Boolean(
      import.meta.env.DEV
    );

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
          This screen could not open.
        </h1>

        <p>
          A frontend display error was caught before it could change your
          workspace data. Retry this screen first. If it happens again,
          reload the browser and check the browser console for the error ID.
        </p>

        {errorId ? (
          <div className="rf-root-recovery__error-id">
            Error ID
            <strong>
              {errorId}
            </strong>
          </div>
        ) : null}

        {showDetails &&
        error?.message ? (
          <pre className="rf-root-recovery__details">
            {String(
              error.message
            ).slice(
              0,
              900
            )}
          </pre>
        ) : null}

        <div className="rf-root-recovery__actions">
          <button
            type="button"
            onClick={
              onRetry
            }
          >
            Retry screen
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

function createErrorId() {
  try {
    return (
      "RF-" +
      crypto
        .randomUUID()
        .slice(
          0,
          8
        )
        .toUpperCase()
    );
  } catch {
    return (
      "RF-" +
      Date.now()
        .toString(36)
        .toUpperCase()
    );
  }
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
        width:min(560px,100%);
        display:grid;
        justify-items:start;
        gap:7px;
        padding:28px;
        background:#fff;
        border:1px solid var(--rfr-line);
        border-radius:16px;
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
        font-size:8px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-root-recovery__card h1{
        margin:0;
        font:600 28px/35px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-root-recovery__card p{
        margin:3px 0 0;
        color:var(--rfr-text2);
        font-size:12px;
        line-height:19px;
      }

      .rf-root-recovery__error-id{
        width:100%;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        margin-top:8px;
        padding:9px 11px;
        color:var(--rfr-muted);
        background:#f6f7f9;
        border:1px solid #e6e7ea;
        border-radius:9px;
        font-size:9px;
        font-weight:700;
        text-transform:uppercase;
        letter-spacing:.05em;
      }

      .rf-root-recovery__error-id strong{
        color:var(--rfr-text);
        font-size:10px;
        letter-spacing:.03em;
      }

      .rf-root-recovery__details{
        width:100%;
        max-height:150px;
        overflow:auto;
        margin:4px 0 0;
        padding:10px;
        color:#8b2525;
        background:#fff7f7;
        border:1px solid #f1d6d6;
        border-radius:8px;
        font:11px/17px ui-monospace,SFMono-Regular,Menlo,monospace;
        white-space:pre-wrap;
        word-break:break-word;
      }

      .rf-root-recovery__actions{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:12px;
      }

      .rf-root-recovery__actions button{
        min-height:40px;
        padding:8px 13px;
        color:#fff;
        background:var(--rfr-primary);
        border:1px solid var(--rfr-primary);
        border-radius:8px;
        cursor:pointer;
        font-size:10px;
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
