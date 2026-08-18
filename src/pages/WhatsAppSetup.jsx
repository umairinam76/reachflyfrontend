import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe2,
  Inbox,
  Lock,
  MessageCircle,
  Phone,
  QrCode,
  RefreshCw,
  Rocket,
  Shield,
  Sparkles,
  X,
  Zap,
} from "../components/icons";

import {
  api,
} from "../api";

const POLL_INTERVAL_MS =
  5_000;

export default function WhatsAppSetup() {
  const [
    status,
    setStatus,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    connecting,
    setConnecting,
  ] = useState(false);

  const [
    disconnecting,
    setDisconnecting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastCheckedAt,
    setLastCheckedAt,
  ] = useState(null);

  const actionInFlight =
    useRef(false);

  const loadStatus =
    useCallback(
      async ({
        silent = false,
        successToast = false,
      } = {}) => {
        if (
          actionInFlight.current
        ) {
          return;
        }

        try {
          if (silent) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          const result =
            await api.whatsappStatus();

          const next =
            normalizeWhatsAppStatus(
              result
            );

          setStatus(
            next
          );
          setLastCheckedAt(
            new Date()
          );
          setError("");

          if (
            successToast
          ) {
            notify(
              "success",
              "WhatsApp status refreshed",
              next.ready
                ? "Your linked WhatsApp session is ready."
                : next.qr
                  ? "A device-linking QR code is available."
                  : "ReachFly checked the current WhatsApp connection."
            );
          }
        } catch (requestError) {
          const text =
            requestError?.message ||
            "Could not load WhatsApp connection status.";

          setError(
            text
          );

          if (
            successToast
          ) {
            notify(
              "error",
              "WhatsApp refresh failed",
              text
            );
          }
        } finally {
          setLoading(
            false
          );
          setRefreshing(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    let alive =
      true;

    let running =
      false;

    const run =
      async (
        silent = false
      ) => {
        if (
          !alive ||
          running ||
          document.visibilityState ===
            "hidden"
        ) {
          return;
        }

        running =
          true;

        try {
          await loadStatus({
            silent,
          });
        } finally {
          running =
            false;
        }
      };

    void run(false);

    const timer =
      window.setInterval(
        () => {
          void run(true);
        },
        POLL_INTERVAL_MS
      );

    const onVisibility =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void run(true);
        }
      };

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () => {
      alive =
        false;

      window.clearInterval(
        timer
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, [
    loadStatus,
  ]);

  const view =
    useMemo(
      () =>
        buildWhatsAppView(
          status,
          lastCheckedAt
        ),
      [
        lastCheckedAt,
        status,
      ]
    );

  async function connect() {
    if (
      connecting ||
      disconnecting
    ) {
      return;
    }

    try {
      actionInFlight.current =
        true;

      setConnecting(
        true
      );
      setMessage("");
      setError("");

      const result =
        await api.whatsappConnect();

      const next =
        normalizeWhatsAppStatus(
          result
        );

      setStatus(
        next
      );
      setLastCheckedAt(
        new Date()
      );

      const text =
        getConnectMessage(
          next
        );

      setMessage(
        text
      );

      notify(
        next.ready
          ? "success"
          : "info",
        next.ready
          ? "WhatsApp connected"
          : next.qr
            ? "QR code ready"
            : "Connection started",
        text
      );
    } catch (requestError) {
      const text =
        requestError?.message ||
        "Could not start WhatsApp linking.";

      setError(
        text
      );

      notify(
        "error",
        "WhatsApp connection failed",
        text
      );
    } finally {
      actionInFlight.current =
        false;

      setConnecting(
        false
      );
    }
  }

  async function logout() {
    if (
      connecting ||
      disconnecting
    ) {
      return;
    }

    try {
      actionInFlight.current =
        true;

      setDisconnecting(
        true
      );
      setMessage("");
      setError("");

      const result =
        await api.whatsappLogout();

      const next =
        normalizeWhatsAppStatus(
          result
        );

      setStatus(
        next
      );
      setLastCheckedAt(
        new Date()
      );

      const text =
        "WhatsApp session disconnected.";

      setMessage(
        text
      );

      notify(
        "success",
        "WhatsApp disconnected",
        "The linked device session has been removed from ReachFly."
      );
    } catch (requestError) {
      const text =
        requestError?.message ||
        "Could not disconnect the WhatsApp session.";

      setError(
        text
      );

      notify(
        "error",
        "Couldn't disconnect WhatsApp",
        text
      );
    } finally {
      actionInFlight.current =
        false;

      setDisconnecting(
        false
      );
    }
  }

  return (
    <>
      <WhatsAppSetupStyles />

      <div className="rf-whatsapp-v7">
        <header className="rfw-page-header">
          <div>
            <span className="rfw-eyebrow">
              Communication
            </span>

            <h1>
              WhatsApp
            </h1>

            <p>
              Link a business WhatsApp session for follow-ups while keeping
              WhatsApp outreach separate from your email campaigns.
            </p>
          </div>

          <div className="rfw-header-actions">
            <Link
              className="rfw-btn rfw-btn-secondary"
              to="/app/campaigns"
            >
              <Rocket size={15} />
              Campaigns
            </Link>

            <button
              type="button"
              className="rfw-btn rfw-btn-secondary"
              disabled={
                refreshing ||
                connecting ||
                disconnecting
              }
              onClick={() =>
                void loadStatus({
                  silent:
                    true,
                  successToast:
                    true,
                })
              }
            >
              <RefreshCw
                size={15}
                className={
                  refreshing
                    ? "spin"
                    : ""
                }
              />
              Refresh
            </button>

            {!view.ready ? (
              <button
                type="button"
                className="rfw-btn rfw-btn-primary"
                disabled={
                  connecting ||
                  disconnecting
                }
                onClick={() =>
                  void connect()
                }
              >
                {connecting ? (
                  <RefreshCw
                    size={15}
                    className="spin"
                  />
                ) : (
                  <QrCode size={15} />
                )}

                {connecting
                  ? "Starting…"
                  : view.qr
                    ? "Refresh QR"
                    : "Connect WhatsApp"}
              </button>
            ) : (
              <span className="rfw-ready-pill">
                <CheckCircle2 size={14} />
                Connected
              </span>
            )}
          </div>
        </header>

        {error ? (
          <section
            className="rfw-message error"
            role="alert"
          >
            <span>
              <X size={15} />
            </span>

            <div>
              <strong>
                WhatsApp setup needs attention
              </strong>

              <small>
                {error}
              </small>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadStatus({
                  successToast:
                    true,
                })
              }
            >
              Try again
            </button>
          </section>
        ) : null}

        {message ? (
          <section
            className="rfw-message success"
            role="status"
          >
            <span>
              <CheckCircle2 size={15} />
            </span>

            <div>
              <strong>
                WhatsApp updated
              </strong>

              <small>
                {message}
              </small>
            </div>
          </section>
        ) : null}

        {view.demo ? (
          <section className="rfw-demo-note">
            <Sparkles size={15} />

            <div>
              <strong>
                Demo connection
              </strong>

              <span>
                This environment is returning a demonstration linking session.
                A live device connection is not currently active here.
              </span>
            </div>
          </section>
        ) : null}

        <section className="rfw-metrics">
          <StatusMetric
            icon={
              <MessageCircle size={16} />
            }
            label="Connection"
            value={
              view.ready
                ? "Ready"
                : view.qr
                  ? "Link device"
                  : "Not linked"
            }
            note={
              view.ready
                ? "WhatsApp session connected"
                : view.qr
                  ? "QR code waiting to be scanned"
                  : "Start device linking"
            }
            tone={
              view.ready
                ? "success"
                : "primary"
            }
          />

          <StatusMetric
            icon={
              <QrCode size={16} />
            }
            label="Device Link"
            value={
              view.ready
                ? "Complete"
                : view.qr
                  ? "QR ready"
                  : "Pending"
            }
            note={
              view.ready
                ? "Linked device available"
                : view.qr
                  ? "Scan from WhatsApp on your phone"
                  : "Generate a QR code to continue"
            }
            tone={
              view.qr
                ? "violet"
                : "neutral"
            }
          />

          <StatusMetric
            icon={
              <Clock3 size={16} />
            }
            label="Last Checked"
            value={
              view.lastCheckedShort ||
              "—"
            }
            note={
              view.lastCheckedLong ||
              "Waiting for first status check"
            }
            tone="neutral"
          />
        </section>

        <section className="rfw-workspace">
          <main className="rfw-main">
            <section
              className={`rfw-link-card ${
                view.ready
                  ? "ready"
                  : view.qr
                    ? "qr-ready"
                    : ""
              }`}
            >
              <div className="rfw-link-head">
                <div>
                  <span className="rfw-eyebrow">
                    Device connection
                  </span>

                  <h2>
                    {view.ready
                      ? "WhatsApp is linked"
                      : view.qr
                        ? "Scan the QR code"
                        : "Link your WhatsApp device"}
                  </h2>

                  <p>
                    {view.statusMessage}
                  </p>
                </div>

                <ConnectionBadge
                  view={
                    view
                  }
                />
              </div>

              <div className="rfw-link-body">
                <div className="rfw-qr-zone">
                  {loading ? (
                    <QrSkeleton />
                  ) : view.ready ? (
                    <ConnectedDevice
                      view={
                        view
                      }
                    />
                  ) : view.qr ? (
                    <QrPanel
                      qr={
                        view.qr
                      }
                    />
                  ) : (
                    <QrPlaceholder />
                  )}
                </div>

                <div className="rfw-link-flow">
                  <div className="rfw-flow-heading">
                    <span>
                      <Sparkles size={15} />
                    </span>

                    <div>
                      <strong>
                        Connect in a few steps
                      </strong>

                      <small>
                        Use the WhatsApp app on the phone you want to link.
                      </small>
                    </div>
                  </div>

                  <Step
                    number="1"
                    title="Generate a QR code"
                    text="Start the linking flow in ReachFly. A fresh QR code will appear on this page."
                    complete={
                      Boolean(
                        view.qr ||
                        view.ready
                      )
                    }
                    active={
                      !view.qr &&
                      !view.ready
                    }
                  />

                  <Step
                    number="2"
                    title="Open Linked devices"
                    text="On your phone, open WhatsApp settings and choose Linked devices."
                    complete={
                      view.ready
                    }
                    active={
                      Boolean(
                        view.qr &&
                        !view.ready
                      )
                    }
                  />

                  <Step
                    number="3"
                    title="Scan and confirm"
                    text="Scan the QR code with your phone and wait for ReachFly to confirm the session."
                    complete={
                      view.ready
                    }
                    active={
                      Boolean(
                        view.qr &&
                        !view.ready
                      )
                    }
                  />

                  <Step
                    number="4"
                    title="Keep the session active"
                    text="Leave the linked session available so ReachFly can use it for WhatsApp follow-ups."
                    complete={
                      view.ready
                    }
                    active={
                      view.ready
                    }
                  />
                </div>
              </div>

              <footer className="rfw-link-actions">
                <div>
                  <span
                    className={`rfw-live-dot ${
                      view.ready
                        ? "ready"
                        : view.qr
                          ? "waiting"
                          : "idle"
                    }`}
                  />

                  <span>
                    {view.ready
                      ? "Linked and ready"
                      : view.qr
                        ? "Waiting for device scan"
                        : "No linked session"}
                  </span>

                  {view.lastCheckedShort ? (
                    <small>
                      Status checked{" "}
                      {view.lastCheckedShort}
                    </small>
                  ) : null}
                </div>

                <div>
                  {!view.ready ? (
                    <button
                      type="button"
                      className="rfw-btn rfw-btn-primary"
                      disabled={
                        connecting ||
                        disconnecting
                      }
                      onClick={() =>
                        void connect()
                      }
                    >
                      {connecting ? (
                        <RefreshCw
                          size={15}
                          className="spin"
                        />
                      ) : (
                        <QrCode size={15} />
                      )}

                      {connecting
                        ? "Starting…"
                        : view.qr
                          ? "Generate New QR"
                          : "Generate QR"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="rfw-btn rfw-btn-danger"
                    disabled={
                      connecting ||
                      disconnecting ||
                      loading
                    }
                    onClick={() =>
                      void logout()
                    }
                  >
                    {disconnecting ? (
                      <RefreshCw
                        size={14}
                        className="spin"
                      />
                    ) : (
                      <X size={14} />
                    )}

                    {disconnecting
                      ? "Disconnecting…"
                      : "Disconnect Session"}
                  </button>
                </div>
              </footer>
            </section>

            <section className="rfw-status-card">
              <div className="rfw-section-head">
                <div>
                  <span className="rfw-eyebrow">
                    Session status
                  </span>

                  <h2>
                    Connection details
                  </h2>

                  <p>
                    Live values reported by the ReachFly WhatsApp connection.
                  </p>
                </div>

                <button
                  type="button"
                  className="rfw-icon-btn"
                  title="Refresh status"
                  aria-label="Refresh WhatsApp status"
                  disabled={
                    refreshing ||
                    connecting ||
                    disconnecting
                  }
                  onClick={() =>
                    void loadStatus({
                      silent:
                        true,
                      successToast:
                        true,
                    })
                  }
                >
                  <RefreshCw
                    size={15}
                    className={
                      refreshing
                        ? "spin"
                        : ""
                    }
                  />
                </button>
              </div>

              <div className="rfw-detail-grid">
                <DetailItem
                  icon={
                    <MessageCircle size={14} />
                  }
                  label="Status"
                  value={
                    view.ready
                      ? "Connected"
                      : view.qr
                        ? "Waiting for scan"
                        : "Not connected"
                  }
                  tone={
                    view.ready
                      ? "success"
                      : "primary"
                  }
                />

                <DetailItem
                  icon={
                    <Phone size={14} />
                  }
                  label="Linked number"
                  value={
                    view.phone ||
                    "Not reported"
                  }
                />

                <DetailItem
                  icon={
                    <Globe2 size={14} />
                  }
                  label="Connection mode"
                  value={
                    view.modeLabel
                  }
                />

                <DetailItem
                  icon={
                    <Clock3 size={14} />
                  }
                  label="Last checked"
                  value={
                    view.lastCheckedLong ||
                    "Not checked yet"
                  }
                />
              </div>

              {view.rawMessage ? (
                <div className="rfw-provider-message">
                  <span>
                    <MessageCircle size={14} />
                  </span>

                  <div>
                    <small>
                      Connection message
                    </small>

                    <strong>
                      {view.rawMessage}
                    </strong>
                  </div>
                </div>
              ) : null}
            </section>
          </main>

          <aside className="rfw-sidebar">
            <section className="rfw-guide-card">
              <div className="rfw-guide-title">
                <span className="whatsapp">
                  <MessageCircle size={18} />
                </span>

                <div>
                  <span className="rfw-eyebrow">
                    WhatsApp linking
                  </span>

                  <h2>
                    How it works
                  </h2>
                </div>
              </div>

              <p>
                ReachFly uses a linked WhatsApp session for follow-up
                messaging. The QR code must be scanned from the phone that owns
                the WhatsApp account.
              </p>

              <div className="rfw-guide-list">
                <GuideLine
                  icon={
                    <QrCode size={13} />
                  }
                  title="QR-based linking"
                  text="No WhatsApp password is entered into ReachFly."
                />

                <GuideLine
                  icon={
                    <Lock size={13} />
                  }
                  title="Session access"
                  text="Disconnect the session from this page whenever you want to stop ReachFly access."
                />

                <GuideLine
                  icon={
                    <RefreshCw size={13} />
                  }
                  title="Automatic status checks"
                  text="ReachFly refreshes connection state every few seconds while this page is open."
                />
              </div>
            </section>

            <section className="rfw-guide-card compliance">
              <div className="rfw-guide-title compact">
                <span>
                  <Shield size={17} />
                </span>

                <div>
                  <span className="rfw-eyebrow">
                    Responsible outreach
                  </span>

                  <h2>
                    Messaging safeguards
                  </h2>
                </div>
              </div>

              <p>
                Use WhatsApp only for appropriate business communication.
                Respect consent, recipient preferences, platform policies, and
                applicable messaging laws.
              </p>

              <div className="rfw-safeguards">
                <span>
                  <Check size={12} />
                  Message relevant contacts
                </span>

                <span>
                  <Check size={12} />
                  Honor opt-out requests
                </span>

                <span>
                  <Check size={12} />
                  Avoid excessive message frequency
                </span>

                <span>
                  <Check size={12} />
                  Keep outreach context clear
                </span>
              </div>
            </section>

            <section className="rfw-guide-card related">
              <div className="rfw-guide-title compact">
                <span>
                  <Zap size={17} />
                </span>

                <div>
                  <span className="rfw-eyebrow">
                    Next steps
                  </span>

                  <h2>
                    Related workflows
                  </h2>
                </div>
              </div>

              <div className="rfw-related-links">
                <Link to="/app/campaigns">
                  <Rocket size={13} />

                  <span>
                    <strong>
                      Campaigns
                    </strong>

                    <small>
                      Manage outreach workflows
                    </small>
                  </span>

                  <ChevronRight size={12} />
                </Link>

                <Link to="/app/inbox">
                  <Inbox size={13} />

                  <span>
                    <strong>
                      Inbox
                    </strong>

                    <small>
                      Review synced campaign email replies
                    </small>
                  </span>

                  <ChevronRight size={12} />
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </>
  );
}

function StatusMetric({
  icon,
  label,
  value,
  note,
  tone = "primary",
}) {
  return (
    <article
      className={`rfw-metric ${tone}`}
    >
      <span>
        {icon}
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>

        <em>
          {note}
        </em>
      </div>
    </article>
  );
}

function ConnectionBadge({
  view,
}) {
  if (
    view.ready
  ) {
    return (
      <span className="rfw-connection-badge ready">
        <CheckCircle2 size={13} />
        Connected
      </span>
    );
  }

  if (
    view.qr
  ) {
    return (
      <span className="rfw-connection-badge waiting">
        <QrCode size={13} />
        Waiting for scan
      </span>
    );
  }

  return (
    <span className="rfw-connection-badge idle">
      <Clock3 size={13} />
      Not linked
    </span>
  );
}

function QrPanel({
  qr,
}) {
  return (
    <div className="rfw-qr-panel">
      <div className="rfw-qr-code">
        <span className="rfw-corner top-left" />
        <span className="rfw-corner top-right" />
        <span className="rfw-corner bottom-left" />
        <span className="rfw-corner bottom-right" />

        <img
          src={
            qr
          }
          alt="WhatsApp device linking QR code"
        />
      </div>

      <div className="rfw-qr-copy">
        <span className="rfw-qr-step">
          1
        </span>

        <span>
          Open WhatsApp on your phone
        </span>

        <i />

        <span className="rfw-qr-step">
          2
        </span>

        <span>
          Choose Linked devices
        </span>

        <i />

        <span className="rfw-qr-step">
          3
        </span>

        <span>
          Scan this QR code
        </span>
      </div>

      <p>
        QR codes can expire. If scanning fails, generate a new code.
      </p>
    </div>
  );
}

function QrPlaceholder() {
  return (
    <div className="rfw-qr-placeholder">
      <span>
        <QrCode size={64} />
      </span>

      <strong>
        QR code appears here
      </strong>

      <p>
        Start the WhatsApp connection to generate a device-linking QR code.
      </p>
    </div>
  );
}

function ConnectedDevice({
  view,
}) {
  return (
    <div className="rfw-connected-device">
      <div className="rfw-connected-art">
        <span className="rfw-phone-shell">
          <i className="speaker" />

          <span>
            <MessageCircle size={35} />
          </span>

          <i className="home" />
        </span>

        <span className="rfw-connected-check">
          <Check size={20} />
        </span>
      </div>

      <span className="rfw-eyebrow">
        Device linked
      </span>

      <strong>
        WhatsApp is ready
      </strong>

      <p>
        {view.phone
          ? `${view.phone} is linked to this ReachFly workspace.`
          : "A WhatsApp device is linked to this ReachFly workspace."}
      </p>
    </div>
  );
}

function QrSkeleton() {
  return (
    <div
      className="rfw-qr-skeleton"
      aria-busy="true"
      aria-label="Loading WhatsApp status"
    >
      <i className="qr" />
      <i />
      <i />
      <i />
    </div>
  );
}

function Step({
  number,
  title,
  text,
  complete,
  active,
}) {
  return (
    <div
      className={`rfw-step ${
        complete
          ? "complete"
          : ""
      } ${
        active
          ? "active"
          : ""
      }`}
    >
      <div className="rfw-step-rail">
        <span>
          {complete ? (
            <Check size={12} />
          ) : (
            number
          )}
        </span>

        {number !==
        "4" ? (
          <i />
        ) : null}
      </div>

      <div>
        <strong>
          {title}
        </strong>

        <p>
          {text}
        </p>
      </div>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
  tone = "neutral",
}) {
  return (
    <div
      className={`rfw-detail-item ${tone}`}
    >
      <span>
        {icon}
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>
      </div>
    </div>
  );
}

function GuideLine({
  icon,
  title,
  text,
}) {
  return (
    <div className="rfw-guide-line">
      <span>
        {icon}
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <p>
          {text}
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
 * Real status adapters
 * ======================================================================= */

function normalizeWhatsAppStatus(
  response
) {
  if (
    !response
  ) {
    return {
      ready:
        false,
      qr:
        "",
      message:
        "",
      mode:
        "",
    };
  }

  if (
    response.status &&
    typeof response.status ===
    "object" &&
    !Array.isArray(
      response.status
    )
  ) {
    return {
      ...response,
      ...response.status,
    };
  }

  if (
    response.data &&
    typeof response.data ===
    "object" &&
    !Array.isArray(
      response.data
    )
  ) {
    return {
      ...response,
      ...response.data,
    };
  }

  return response;
}

function buildWhatsAppView(
  status,
  lastCheckedAt
) {
  const source =
    status ||
    {};

  const ready =
    Boolean(
      source.ready ||
      source.connected ||
      source.authenticated
    );

  const qr =
    firstString(
      source.qr,
      source.qrCode,
      source.qrcode,
      source.qrDataUrl
    );

  const rawMessage =
    firstString(
      source.message,
      source.statusMessage,
      source.detail
    );

  const mode =
    firstString(
      source.mode,
      source.environment
    );

  const phone =
    normalizePhoneDisplay(
      firstString(
        source.phone,
        source.phoneNumber,
        source.number,
        source.wid?.user,
        source.clientInfo?.wid?.user,
        source.clientInfo?.phone,
        source.info?.wid?.user
      )
    );

  let statusMessage =
    rawMessage;

  if (
    !statusMessage
  ) {
    if (ready) {
      statusMessage =
        "Your WhatsApp session is connected and ready for follow-up workflows.";
    } else if (qr) {
      statusMessage =
        "Scan the QR code from WhatsApp on your phone to finish linking this device.";
    } else {
      statusMessage =
        "Start a linking session to generate a QR code for your WhatsApp device.";
    }
  }

  return {
    ready,
    qr,
    rawMessage,
    statusMessage,
    phone,
    mode,
    modeLabel:
      mode
        ? titleCase(
            mode
          )
        : "Not reported",
    demo:
      normalizeToken(
        mode
      ) ===
      "demo",
    lastCheckedShort:
      lastCheckedAt
        ? formatRelativeTime(
            lastCheckedAt
          )
        : "",
    lastCheckedLong:
      lastCheckedAt
        ? lastCheckedAt.toLocaleString(
            undefined,
            {
              month:
                "short",
              day:
                "numeric",
              hour:
                "numeric",
              minute:
                "2-digit",
            }
          )
        : "",
  };
}

function getConnectMessage(
  status
) {
  if (
    status.ready ||
    status.connected ||
    status.authenticated
  ) {
    return "WhatsApp is linked and ready.";
  }

  if (
    firstString(
      status.qr,
      status.qrCode,
      status.qrcode,
      status.qrDataUrl
    )
  ) {
    return "QR code generated. Scan it from WhatsApp on your phone to finish linking.";
  }

  if (
    normalizeToken(
      status.mode
    ) ===
    "demo"
  ) {
    return "A demonstration connection session was generated for this environment.";
  }

  return (
    firstString(
      status.message,
      status.statusMessage
    ) ||
    "WhatsApp linking started. ReachFly will keep checking for the linked device."
  );
}

function normalizePhoneDisplay(
  value
) {
  const text =
    String(
      value ||
      ""
    ).trim();

  if (!text) {
    return "";
  }

  if (
    text.startsWith(
      "+"
    )
  ) {
    return text;
  }

  if (
    /^\d{7,15}$/.test(
      text
    )
  ) {
    return `+${text}`;
  }

  return text;
}

function firstString(
  ...values
) {
  for (const value of values) {
    if (
      value ===
        null ||
      value ===
        undefined
    ) {
      continue;
    }

    const text =
      String(
        value
      ).trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function normalizeToken(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function titleCase(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}

function formatRelativeTime(
  date
) {
  const timestamp =
    date instanceof Date
      ? date.getTime()
      : new Date(
          date
        ).getTime();

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return "";
  }

  const delta =
    Math.max(
      0,
      Date.now() -
        timestamp
    );

  if (
    delta <
    10_000
  ) {
    return "just now";
  }

  if (
    delta <
    60_000
  ) {
    return `${Math.max(
      1,
      Math.floor(
        delta /
        1000
      )
    )}s ago`;
  }

  return `${Math.max(
    1,
    Math.floor(
      delta /
      60_000
    )
  )}m ago`;
}

function notify(
  type,
  title,
  message
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const bridge =
    window.reachflyToast;

  if (
    bridge &&
    typeof bridge[
      type
    ] ===
      "function"
  ) {
    bridge[
      type
    ](
      title,
      message
    );

    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      "reachfly:toast",
      {
        detail: {
          type,
          title,
          message,
        },
      }
    )
  );
}

/* ==========================================================================
 * Scoped Stitch V7 styling
 * ======================================================================= */

function WhatsAppSetupStyles() {
  return (
    <style>{`
      .rf-whatsapp-v7{
        --rfw-bg:#f8f9fa;
        --rfw-card:#fff;
        --rfw-soft:#f3f4f5;
        --rfw-high:#e7e8e9;
        --rfw-text:#191c1d;
        --rfw-text-soft:#464554;
        --rfw-muted:#767586;
        --rfw-outline:#e3e5e7;
        --rfw-outline-strong:#c7c4d7;
        --rfw-primary:#4648d4;
        --rfw-primary-dark:#3537bb;
        --rfw-primary-soft:#e8e9ff;
        --rfw-violet:#6b38d4;
        --rfw-violet-soft:#f0eaff;
        --rfw-whatsapp:#188a62;
        --rfw-whatsapp-soft:#def7ec;
        --rfw-success:#087a51;
        --rfw-success-soft:#dcfce7;
        --rfw-warning:#8a6100;
        --rfw-warning-soft:#fff4d6;
        --rfw-danger:#ba1a1a;
        --rfw-danger-soft:#ffedeb;
        --rfw-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 42px;
        color:var(--rfw-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfwPageIn 260ms var(--rfw-ease);
      }

      .rf-whatsapp-v7 *,
      .rf-whatsapp-v7 *::before,
      .rf-whatsapp-v7 *::after{
        box-sizing:border-box;
      }

      .rf-whatsapp-v7 a{
        color:inherit;
      }

      .rf-whatsapp-v7 .spin{
        animation:rfwSpin 800ms linear infinite;
      }

      @keyframes rfwPageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfwFadeUp{
        from{opacity:0;transform:translate3d(0,7px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfwScaleIn{
        from{opacity:0;transform:scale(.986)}
        to{opacity:1;transform:scale(1)}
      }

      @keyframes rfwSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfwPulse{
        0%,100%{box-shadow:0 0 0 3px rgba(70,72,212,.10)}
        50%{box-shadow:0 0 0 7px rgba(70,72,212,.04)}
      }

      @keyframes rfwShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfw-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:20px;
      }

      .rfw-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfw-primary);
        font-size:9px;
        font-weight:750;
        line-height:13px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfw-page-header h1{
        margin:0;
        color:var(--rfw-text);
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfw-page-header p{
        max-width:680px;
        margin:3px 0 0;
        color:var(--rfw-text-soft);
        font-size:13px;
        line-height:19px;
      }

      .rfw-header-actions{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rfw-btn{
        appearance:none;
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:7px 12px;
        border:1px solid transparent;
        border-radius:8px;
        text-decoration:none;
        white-space:nowrap;
        cursor:pointer;
        font:600 10px/15px Inter,sans-serif;
        transition:
          color 140ms var(--rfw-ease),
          background 140ms var(--rfw-ease),
          border-color 140ms var(--rfw-ease),
          transform 140ms var(--rfw-ease),
          box-shadow 140ms var(--rfw-ease);
      }

      .rfw-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfw-btn:active:not(:disabled){
        transform:translateY(0) scale(.985);
      }

      .rfw-btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfw-btn-primary{
        color:#fff!important;
        background:var(--rfw-primary);
        border-color:var(--rfw-primary);
        box-shadow:0 5px 14px rgba(70,72,212,.17);
      }

      .rfw-btn-primary:hover:not(:disabled){
        background:var(--rfw-primary-dark);
        border-color:var(--rfw-primary-dark);
      }

      .rfw-btn-secondary{
        color:var(--rfw-text)!important;
        background:#fff;
        border-color:var(--rfw-outline);
      }

      .rfw-btn-secondary:hover:not(:disabled){
        color:var(--rfw-primary)!important;
        background:var(--rfw-primary-soft);
        border-color:rgba(70,72,212,.18);
      }

      .rfw-btn-danger{
        color:var(--rfw-danger)!important;
        background:#fff;
        border-color:#ffd6d2;
      }

      .rfw-btn-danger:hover:not(:disabled){
        background:var(--rfw-danger-soft);
      }

      .rfw-ready-pill{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:7px 11px;
        color:var(--rfw-success);
        background:var(--rfw-success-soft);
        border:1px solid #bae8d2;
        border-radius:8px;
        font-size:9px;
        font-weight:700;
      }

      .rfw-message{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        animation:rfwFadeUp 180ms var(--rfw-ease);
      }

      .rfw-message > span{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        flex:0 0 26px;
        background:rgba(255,255,255,.75);
        border-radius:7px;
      }

      .rfw-message > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:1px;
      }

      .rfw-message strong{
        font-size:9px;
        line-height:13px;
      }

      .rfw-message small{
        font-size:8px;
        line-height:13px;
      }

      .rfw-message > button{
        align-self:center;
        padding:5px 8px;
        color:inherit;
        background:rgba(255,255,255,.72);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
      }

      .rfw-message.error{
        color:#7d1717;
        background:var(--rfw-danger-soft);
        border-color:#ffd0cc;
      }

      .rfw-message.success{
        color:#075b3d;
        background:var(--rfw-success-soft);
        border-color:#b8efd6;
      }

      .rfw-demo-note{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        margin-bottom:10px;
        color:#5b339b;
        background:var(--rfw-violet-soft);
        border:1px solid #ddcdfa;
        border-radius:9px;
        animation:rfwFadeUp 180ms var(--rfw-ease);
      }

      .rfw-demo-note > svg{
        flex:0 0 auto;
        margin-top:1px;
      }

      .rfw-demo-note > div{
        display:grid;
        gap:1px;
      }

      .rfw-demo-note strong{
        font-size:9px;
        line-height:13px;
      }

      .rfw-demo-note span{
        font-size:8px;
        line-height:13px;
      }

      .rfw-metrics{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
        margin-bottom:14px;
      }

      .rfw-metric{
        min-height:78px;
        display:flex;
        align-items:center;
        gap:11px;
        padding:14px 15px;
        background:#fff;
        border:1px solid var(--rfw-outline);
        border-radius:11px;
        animation:rfwScaleIn 240ms var(--rfw-ease) both;
      }

      .rfw-metric:nth-child(2){
        animation-delay:40ms;
      }

      .rfw-metric:nth-child(3){
        animation-delay:80ms;
      }

      .rfw-metric > span{
        width:35px;
        height:35px;
        display:grid;
        place-items:center;
        flex:0 0 35px;
        color:var(--rfw-primary);
        background:var(--rfw-primary-soft);
        border-radius:9px;
      }

      .rfw-metric.violet > span{
        color:var(--rfw-violet);
        background:var(--rfw-violet-soft);
      }

      .rfw-metric.success > span{
        color:var(--rfw-success);
        background:var(--rfw-success-soft);
      }

      .rfw-metric.neutral > span{
        color:#5f6673;
        background:#eef1f5;
      }

      .rfw-metric > div{
        min-width:0;
        display:grid;
        gap:0;
      }

      .rfw-metric small{
        color:var(--rfw-muted);
        font-size:7px;
        font-weight:750;
        line-height:11px;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfw-metric strong{
        overflow:hidden;
        color:var(--rfw-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 17px/22px Geist,Inter,sans-serif;
      }

      .rfw-metric em{
        overflow:hidden;
        color:var(--rfw-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
        font-style:normal;
        line-height:11px;
      }

      .rfw-workspace{
        display:grid;
        grid-template-columns:minmax(0,1fr) 300px;
        gap:16px;
        align-items:start;
      }

      .rfw-main{
        min-width:0;
        display:grid;
        gap:12px;
      }

      .rfw-link-card,
      .rfw-status-card,
      .rfw-guide-card{
        background:#fff;
        border:1px solid var(--rfw-outline);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.028);
      }

      .rfw-link-card{
        overflow:hidden;
      }

      .rfw-link-card.ready{
        border-color:#caeadb;
      }

      .rfw-link-card.qr-ready{
        border-color:#d9daff;
      }

      .rfw-link-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding:18px 19px;
        background:
          radial-gradient(circle at 92% 0,rgba(70,72,212,.07),transparent 28%),
          #fff;
        border-bottom:1px solid var(--rfw-outline);
      }

      .rfw-link-card.ready .rfw-link-head{
        background:
          radial-gradient(circle at 92% 0,rgba(8,122,81,.08),transparent 28%),
          #fff;
      }

      .rfw-link-head h2,
      .rfw-section-head h2,
      .rfw-guide-title h2{
        margin:0;
        color:var(--rfw-text);
        font:600 16px/22px Geist,Inter,sans-serif;
      }

      .rfw-link-head p,
      .rfw-section-head p{
        max-width:670px;
        margin:3px 0 0;
        color:var(--rfw-text-soft);
        font-size:9px;
        line-height:14px;
      }

      .rfw-connection-badge{
        min-height:28px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        flex:0 0 auto;
        padding:5px 8px;
        border-radius:999px;
        font-size:7px;
        font-weight:700;
      }

      .rfw-connection-badge.ready{
        color:var(--rfw-success);
        background:var(--rfw-success-soft);
      }

      .rfw-connection-badge.waiting{
        color:var(--rfw-violet);
        background:var(--rfw-violet-soft);
      }

      .rfw-connection-badge.idle{
        color:#5d6472;
        background:#eef1f5;
      }

      .rfw-link-body{
        display:grid;
        grid-template-columns:minmax(320px,.9fr) minmax(300px,1.1fr);
        min-height:420px;
      }

      .rfw-qr-zone{
        min-width:0;
        display:grid;
        place-items:center;
        padding:26px 22px;
        background:
          radial-gradient(circle at 50% 38%,rgba(70,72,212,.05),transparent 40%),
          #fbfbfc;
        border-right:1px solid var(--rfw-outline);
      }

      .rfw-link-flow{
        min-width:0;
        padding:28px 28px 24px;
      }

      .rfw-flow-heading{
        display:flex;
        align-items:flex-start;
        gap:9px;
        margin-bottom:20px;
      }

      .rfw-flow-heading > span{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        flex:0 0 31px;
        color:var(--rfw-violet);
        background:var(--rfw-violet-soft);
        border-radius:8px;
      }

      .rfw-flow-heading > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfw-flow-heading strong{
        color:var(--rfw-text);
        font:600 11px/16px Geist,Inter,sans-serif;
      }

      .rfw-flow-heading small{
        color:var(--rfw-muted);
        font-size:8px;
        line-height:12px;
      }

      .rfw-step{
        display:grid;
        grid-template-columns:30px minmax(0,1fr);
        gap:9px;
        min-height:79px;
      }

      .rfw-step-rail{
        position:relative;
        display:flex;
        flex-direction:column;
        align-items:center;
      }

      .rfw-step-rail > span{
        position:relative;
        z-index:1;
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        color:var(--rfw-text-soft);
        background:var(--rfw-high);
        border:2px solid #fff;
        border-radius:50%;
        box-shadow:0 0 0 1px var(--rfw-outline);
        font-size:7px;
        font-weight:800;
      }

      .rfw-step.complete .rfw-step-rail > span{
        color:#fff;
        background:var(--rfw-success);
        box-shadow:0 0 0 1px var(--rfw-success);
      }

      .rfw-step.active:not(.complete) .rfw-step-rail > span{
        color:#fff;
        background:var(--rfw-primary);
        box-shadow:0 0 0 1px var(--rfw-primary);
        animation:rfwPulse 1.8s ease-in-out infinite;
      }

      .rfw-step-rail > i{
        position:absolute;
        top:29px;
        bottom:-2px;
        width:1px;
        background:var(--rfw-outline);
      }

      .rfw-step.complete .rfw-step-rail > i{
        background:#bfe7d6;
      }

      .rfw-step > div:last-child{
        padding:2px 0 18px;
      }

      .rfw-step strong{
        display:block;
        color:var(--rfw-text);
        font-size:9px;
        line-height:13px;
      }

      .rfw-step p{
        margin:3px 0 0;
        color:var(--rfw-muted);
        font-size:8px;
        line-height:13px;
      }

      .rfw-qr-panel{
        width:min(100%,360px);
        display:grid;
        justify-items:center;
        gap:16px;
        text-align:center;
        animation:rfwScaleIn 220ms var(--rfw-ease);
      }

      .rfw-qr-code{
        position:relative;
        width:244px;
        max-width:70vw;
        aspect-ratio:1;
        display:grid;
        place-items:center;
        padding:16px;
        background:#fff;
        border:1px solid var(--rfw-outline);
        border-radius:15px;
        box-shadow:
          0 10px 28px rgba(25,28,29,.08),
          0 1px 4px rgba(25,28,29,.04);
      }

      .rfw-qr-code img{
        width:100%;
        height:100%;
        display:block;
        object-fit:contain;
      }

      .rfw-corner{
        position:absolute;
        width:25px;
        height:25px;
        border-color:var(--rfw-primary);
        border-style:solid;
      }

      .rfw-corner.top-left{
        top:-4px;
        left:-4px;
        border-width:2px 0 0 2px;
        border-radius:8px 0 0 0;
      }

      .rfw-corner.top-right{
        top:-4px;
        right:-4px;
        border-width:2px 2px 0 0;
        border-radius:0 8px 0 0;
      }

      .rfw-corner.bottom-left{
        bottom:-4px;
        left:-4px;
        border-width:0 0 2px 2px;
        border-radius:0 0 0 8px;
      }

      .rfw-corner.bottom-right{
        right:-4px;
        bottom:-4px;
        border-width:0 2px 2px 0;
        border-radius:0 0 8px 0;
      }

      .rfw-qr-copy{
        display:grid;
        grid-template-columns:21px minmax(0,1fr);
        align-items:center;
        gap:4px 7px;
        width:100%;
        max-width:290px;
        text-align:left;
      }

      .rfw-qr-copy > i{
        grid-column:1;
        width:1px;
        height:8px;
        justify-self:center;
        background:var(--rfw-outline);
      }

      .rfw-qr-step{
        width:21px;
        height:21px;
        display:grid;
        place-items:center;
        color:var(--rfw-primary);
        background:var(--rfw-primary-soft);
        border-radius:50%;
        font-size:7px;
        font-weight:800;
      }

      .rfw-qr-copy > span:not(.rfw-qr-step){
        color:var(--rfw-text-soft);
        font-size:8px;
        line-height:12px;
      }

      .rfw-qr-panel > p{
        max-width:290px;
        margin:0;
        color:var(--rfw-muted);
        font-size:7px;
        line-height:12px;
      }

      .rfw-qr-placeholder{
        max-width:340px;
        display:grid;
        place-items:center;
        gap:6px;
        text-align:center;
      }

      .rfw-qr-placeholder > span{
        width:118px;
        height:118px;
        display:grid;
        place-items:center;
        margin-bottom:8px;
        color:#a2a2ae;
        background:#fff;
        border:1px dashed var(--rfw-outline-strong);
        border-radius:18px;
      }

      .rfw-qr-placeholder strong{
        color:var(--rfw-text);
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfw-qr-placeholder p{
        max-width:280px;
        margin:0;
        color:var(--rfw-muted);
        font-size:8px;
        line-height:13px;
      }

      .rfw-connected-device{
        max-width:350px;
        display:grid;
        justify-items:center;
        gap:5px;
        text-align:center;
        animation:rfwScaleIn 220ms var(--rfw-ease);
      }

      .rfw-connected-art{
        position:relative;
        width:170px;
        height:190px;
        display:grid;
        place-items:center;
        margin-bottom:6px;
      }

      .rfw-phone-shell{
        position:relative;
        width:104px;
        height:176px;
        display:grid;
        place-items:center;
        color:var(--rfw-whatsapp);
        background:#fff;
        border:5px solid #2e3132;
        border-radius:24px;
        box-shadow:0 13px 30px rgba(25,28,29,.13);
      }

      .rfw-phone-shell > span{
        width:65px;
        height:65px;
        display:grid;
        place-items:center;
        background:var(--rfw-whatsapp-soft);
        border-radius:50%;
      }

      .rfw-phone-shell .speaker{
        position:absolute;
        top:8px;
        width:30px;
        height:4px;
        background:#2e3132;
        border-radius:999px;
      }

      .rfw-phone-shell .home{
        position:absolute;
        bottom:8px;
        width:5px;
        height:5px;
        background:#2e3132;
        border-radius:50%;
      }

      .rfw-connected-check{
        position:absolute;
        right:18px;
        bottom:13px;
        width:43px;
        height:43px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfw-success);
        border:5px solid #fbfbfc;
        border-radius:50%;
        box-shadow:0 5px 14px rgba(8,122,81,.22);
      }

      .rfw-connected-device > strong{
        color:var(--rfw-text);
        font:600 14px/19px Geist,Inter,sans-serif;
      }

      .rfw-connected-device > p{
        max-width:300px;
        margin:0;
        color:var(--rfw-muted);
        font-size:8px;
        line-height:13px;
      }

      .rfw-qr-skeleton{
        width:min(100%,320px);
        display:grid;
        justify-items:center;
        gap:10px;
      }

      .rfw-qr-skeleton i{
        display:block;
        background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);
        background-size:220% 100%;
        border-radius:999px;
        animation:rfwShimmer 1.25s linear infinite;
      }

      .rfw-qr-skeleton i.qr{
        width:220px;
        height:220px;
        border-radius:15px;
      }

      .rfw-qr-skeleton i:not(.qr){
        width:76%;
        height:9px;
      }

      .rfw-qr-skeleton i:last-child{
        width:48%;
      }

      .rfw-link-actions{
        min-height:66px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:12px 16px;
        background:#fbfbfc;
        border-top:1px solid var(--rfw-outline);
      }

      .rfw-link-actions > div:first-child{
        min-width:0;
        display:grid;
        grid-template-columns:10px auto;
        align-items:center;
        gap:1px 6px;
      }

      .rfw-link-actions > div:first-child > span:nth-child(2){
        color:var(--rfw-text-soft);
        font-size:8px;
        font-weight:650;
        line-height:12px;
      }

      .rfw-link-actions > div:first-child > small{
        grid-column:2;
        color:var(--rfw-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfw-live-dot{
        width:8px;
        height:8px;
        display:block;
        border-radius:50%;
      }

      .rfw-live-dot.ready{
        background:var(--rfw-success);
        box-shadow:0 0 0 3px rgba(8,122,81,.1);
      }

      .rfw-live-dot.waiting{
        background:var(--rfw-primary);
        box-shadow:0 0 0 3px rgba(70,72,212,.1);
        animation:rfwPulse 1.8s ease-in-out infinite;
      }

      .rfw-live-dot.idle{
        background:#a6a8ac;
      }

      .rfw-link-actions > div:last-child{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rfw-status-card{
        overflow:hidden;
      }

      .rfw-section-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding:16px 18px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfw-outline);
      }

      .rfw-icon-btn{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        flex:0 0 34px;
        padding:0;
        color:var(--rfw-text-soft);
        background:#fff;
        border:1px solid var(--rfw-outline);
        border-radius:8px;
        cursor:pointer;
      }

      .rfw-icon-btn:hover:not(:disabled){
        color:var(--rfw-primary);
        background:var(--rfw-primary-soft);
      }

      .rfw-icon-btn:disabled{
        opacity:.45;
      }

      .rfw-detail-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        padding:14px 15px;
      }

      .rfw-detail-item{
        min-width:0;
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:10px;
        background:var(--rfw-soft);
        border-radius:8px;
      }

      .rfw-detail-item > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        flex:0 0 27px;
        color:#606673;
        background:#fff;
        border-radius:7px;
      }

      .rfw-detail-item.primary > span{
        color:var(--rfw-primary);
        background:var(--rfw-primary-soft);
      }

      .rfw-detail-item.success > span{
        color:var(--rfw-success);
        background:var(--rfw-success-soft);
      }

      .rfw-detail-item > div{
        min-width:0;
        display:grid;
        gap:0;
      }

      .rfw-detail-item small{
        color:var(--rfw-muted);
        font-size:6px;
        line-height:9px;
      }

      .rfw-detail-item strong{
        overflow:hidden;
        color:var(--rfw-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
        line-height:12px;
      }

      .rfw-provider-message{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:10px 15px 14px;
      }

      .rfw-provider-message > span{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        flex:0 0 28px;
        color:var(--rfw-primary);
        background:var(--rfw-primary-soft);
        border-radius:7px;
      }

      .rfw-provider-message > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfw-provider-message small{
        color:var(--rfw-muted);
        font-size:6px;
        line-height:9px;
      }

      .rfw-provider-message strong{
        color:var(--rfw-text-soft);
        font-size:8px;
        font-weight:550;
        line-height:13px;
      }

      .rfw-sidebar{
        position:sticky;
        top:80px;
        display:grid;
        gap:10px;
      }

      .rfw-guide-card{
        padding:16px;
      }

      .rfw-guide-title{
        display:flex;
        align-items:center;
        gap:9px;
        margin-bottom:9px;
      }

      .rfw-guide-title > span{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        flex:0 0 38px;
        color:var(--rfw-primary);
        background:var(--rfw-primary-soft);
        border-radius:10px;
      }

      .rfw-guide-title > span.whatsapp{
        color:var(--rfw-whatsapp);
        background:var(--rfw-whatsapp-soft);
      }

      .rfw-guide-title.compact > span{
        width:32px;
        height:32px;
        flex-basis:32px;
      }

      .rfw-guide-title > div{
        min-width:0;
      }

      .rfw-guide-title h2{
        font-size:12px;
        line-height:17px;
      }

      .rfw-guide-card > p{
        margin:0 0 12px;
        color:var(--rfw-text-soft);
        font-size:8px;
        line-height:13px;
      }

      .rfw-guide-list{
        display:grid;
        gap:6px;
      }

      .rfw-guide-line{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:8px;
        background:var(--rfw-soft);
        border-radius:8px;
      }

      .rfw-guide-line > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        flex:0 0 27px;
        color:var(--rfw-primary);
        background:#fff;
        border-radius:7px;
      }

      .rfw-guide-line > div{
        min-width:0;
      }

      .rfw-guide-line strong{
        display:block;
        color:var(--rfw-text);
        font-size:7px;
        line-height:11px;
      }

      .rfw-guide-line p{
        margin:1px 0 0;
        color:var(--rfw-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfw-guide-card.compliance{
        background:
          radial-gradient(circle at 94% 0,rgba(8,122,81,.08),transparent 35%),
          #fff;
      }

      .rfw-safeguards{
        display:grid;
        gap:6px;
      }

      .rfw-safeguards > span{
        display:flex;
        align-items:center;
        gap:6px;
        color:var(--rfw-text-soft);
        font-size:7px;
        line-height:11px;
      }

      .rfw-safeguards svg{
        color:var(--rfw-success);
      }

      .rfw-related-links{
        display:grid;
        gap:5px;
      }

      .rfw-related-links a{
        min-height:48px;
        display:grid;
        grid-template-columns:27px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:7px;
        color:inherit!important;
        background:var(--rfw-soft);
        border-radius:8px;
        text-decoration:none;
      }

      .rfw-related-links a:hover{
        background:var(--rfw-primary-soft);
      }

      .rfw-related-links > a > svg:first-child{
        color:var(--rfw-primary);
      }

      .rfw-related-links > a > span{
        min-width:0;
        display:grid;
        gap:0;
      }

      .rfw-related-links strong,
      .rfw-related-links small{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfw-related-links strong{
        color:var(--rfw-text);
        font-size:7px;
        line-height:11px;
      }

      .rfw-related-links small{
        color:var(--rfw-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfw-related-links > a > svg:last-child{
        color:var(--rfw-muted);
      }

      @media(max-width:1120px){
        .rf-whatsapp-v7{
          padding:22px 22px 40px;
        }

        .rfw-workspace{
          grid-template-columns:1fr;
        }

        .rfw-sidebar{
          position:static;
          grid-template-columns:repeat(3,minmax(0,1fr));
        }
      }

      @media(max-width:900px){
        .rfw-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfw-header-actions{
          width:100%;
          justify-content:flex-end;
        }

        .rfw-link-body{
          grid-template-columns:1fr;
        }

        .rfw-qr-zone{
          min-height:390px;
          border-right:0;
          border-bottom:1px solid var(--rfw-outline);
        }

        .rfw-detail-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rfw-sidebar{
          grid-template-columns:1fr 1fr;
        }

        .rfw-guide-card.related{
          grid-column:1/-1;
        }
      }

      @media(max-width:700px){
        .rf-whatsapp-v7{
          padding:18px 14px 84px;
        }

        .rfw-metrics{
          grid-template-columns:1fr;
          gap:7px;
        }

        .rfw-metric{
          min-height:64px;
          padding:10px 12px;
        }

        .rfw-link-head{
          flex-direction:column;
        }

        .rfw-link-actions{
          align-items:stretch;
          flex-direction:column;
        }

        .rfw-link-actions > div:last-child{
          width:100%;
        }

        .rfw-link-actions > div:last-child .rfw-btn{
          flex:1;
        }

        .rfw-sidebar{
          grid-template-columns:1fr;
        }

        .rfw-guide-card.related{
          grid-column:auto;
        }
      }

      @media(max-width:540px){
        .rf-whatsapp-v7{
          padding:16px 11px 84px;
        }

        .rfw-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfw-page-header p{
          font-size:11px;
          line-height:17px;
        }

        .rfw-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .rfw-header-actions > .rfw-btn-primary,
        .rfw-header-actions > .rfw-ready-pill{
          grid-column:1/-1;
        }

        .rfw-ready-pill{
          justify-content:center;
        }

        .rfw-qr-zone{
          min-height:330px;
          padding:20px 12px;
        }

        .rfw-link-flow{
          padding:22px 18px 18px;
        }

        .rfw-qr-code{
          width:210px;
        }

        .rfw-detail-grid{
          grid-template-columns:1fr;
        }

        .rfw-link-actions > div:last-child{
          flex-direction:column;
        }

        .rfw-link-actions > div:last-child .rfw-btn{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-whatsapp-v7,
        .rfw-metric,
        .rfw-message,
        .rfw-demo-note,
        .rfw-qr-panel,
        .rfw-connected-device,
        .rfw-qr-skeleton i,
        .rfw-step.active .rfw-step-rail > span,
        .rfw-live-dot.waiting,
        .rf-whatsapp-v7 .spin{
          animation:none!important;
        }

        .rf-whatsapp-v7 *,
        .rf-whatsapp-v7 *::before,
        .rf-whatsapp-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
