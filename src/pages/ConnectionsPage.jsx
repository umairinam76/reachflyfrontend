import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";

export default function ConnectionsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await api.connections();
      setData(response);
    } catch (requestError) {
      setError(requestError?.message || "Connections could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google_connection");
    if (status === "success") {
      setMessage("Google Workspace connected successfully.");
      void load();
    } else if (status === "error") {
      setError("Google Workspace connection could not be completed. Try again.");
    }
  }, [load]);

  const connections = data?.connections || [];
  const healthyEmail = useMemo(
    () => connections.filter((item) => item.status === "connected" && item.capabilities?.emailSend).length,
    [connections]
  );
  const healthyCalendar = useMemo(
    () => connections.filter((item) => item.status === "connected" && item.capabilities?.calendar).length,
    [connections]
  );

  async function connectGoogle() {
    try {
      setBusy("google");
      setError("");
      const response = await api.startGoogleConnection({ returnTo: "/app/connections" });
      if (!response?.authorizationUrl) throw new Error("Google authorization URL was not returned.");
      window.location.assign(response.authorizationUrl);
    } catch (requestError) {
      setError(requestError?.message || "Google Workspace connection could not start.");
      setBusy("");
    }
  }

  async function runAction(connection, action) {
    const key = `${connection.id}:${action}`;
    try {
      setBusy(key);
      setError("");
      setMessage("");
      if (action === "email") {
        await api.testConnectionEmail(connection.id, {});
        setMessage(`Email sending is healthy for ${connection.accountEmail}.`);
      } else if (action === "calendar") {
        await api.testConnectionCalendar(connection.id, {});
        setMessage(`Calendar access is healthy for ${connection.accountEmail}.`);
      } else if (action === "disconnect") {
        if (!window.confirm(`Disconnect ${connection.accountEmail} from ReachFly?`)) return;
        await api.disconnectConnection(connection.id);
        setMessage(`${connection.accountEmail} was disconnected.`);
        await load();
      }
    } catch (requestError) {
      setError(requestError?.message || "Connection action failed.");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <div className="rf-v6-loading">Loading workspace connections…</div>;

  return (
    <main className="rf-v6-page rf-v6-connections-page">
      <header className="rf-v6-hero compact">
        <div>
          <span className="rf-v6-kicker">Connections</span>
          <h1>Connect the channels your AI agents can use.</h1>
          <p>Link email and calendar once, then assign the right account to each agent. ReachFly keeps provider credentials server-side and gives agents only controlled actions.</p>
        </div>
        <div className="rf-v6-health-orbit">
          <MetricMini label="Email" value={healthyEmail ? `${healthyEmail} connected` : "Not connected"} good={healthyEmail > 0} />
          <MetricMini label="Calendar" value={healthyCalendar ? `${healthyCalendar} connected` : "Not connected"} good={healthyCalendar > 0} />
        </div>
      </header>

      {error ? <div className="rf-v6-alert error">{error}</div> : null}
      {message ? <div className="rf-v6-alert success">{message}</div> : null}

      <section className="rf-v6-grid two">
        <article className="rf-v6-panel featured">
          <div className="rf-v6-panel-head">
            <div><span>Recommended</span><h2>Google Workspace</h2><p>Connect Gmail sending and Google Calendar availability/booking in one authorization flow.</p></div>
            <div className="rf-v6-provider-logo google">G</div>
          </div>
          <div className="rf-v6-check-list">
            <span>✓ Send requested information and follow-ups</span>
            <span>✓ Check live calendar availability</span>
            <span>✓ Create confirmed meeting events</span>
            <span>✓ Assign the connection to one or more AI agents</span>
          </div>
          <button className="rf-v6-btn primary" type="button" disabled={busy === "google" || !data?.googleConfigured} onClick={connectGoogle}>
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>
          {!data?.googleConfigured ? <small className="rf-v6-muted">Google Workspace OAuth must be configured by the ReachFly operator before this connection can be used.</small> : null}
        </article>

        <article className="rf-v6-panel">
          <div className="rf-v6-panel-head"><div><span>Advanced</span><h2>Other email providers</h2><p>Keep the existing SMTP/IMAP path for providers that do not support the one-click Google connection.</p></div></div>
          <div className="rf-v6-check-list subdued">
            <span>Linked Emailbox accounts appear below automatically</span>
            <span>Custom SMTP sending</span>
            <span>IMAP inbox sync</span>
            <span>Provider-specific app passwords where required</span>
          </div>
          <a className="rf-v6-btn secondary" href="/app/email">Open advanced email setup</a>
        </article>
      </section>

      <section className="rf-v6-panel">
        <div className="rf-v6-section-head"><div><span>Connected accounts</span><h2>Your workspace connections</h2><p>Test a connection before assigning it to an agent.</p></div><b>{connections.length}</b></div>
        {!connections.length ? (
          <div className="rf-v6-empty"><strong>No email or calendar connected yet.</strong><span>Connect Google Workspace above. Your first agent can then use it for follow-up and meeting booking.</span></div>
        ) : (
          <div className="rf-v6-connection-list">
            {connections.map((connection) => (
              <article className="rf-v6-connection-row" key={connection.id}>
                <div className={`rf-v6-provider-logo ${connection.type === "emailbox_smtp" ? "emailbox" : "google"} small`}>{connection.type === "emailbox_smtp" ? "M" : "G"}</div>
                <div className="rf-v6-grow"><strong>{connection.accountEmail}</strong><span>{connection.displayName || "Google Workspace"}</span></div>
                <div className="rf-v6-capabilities">
                  <StatusChip ok={connection.capabilities?.emailSend} label="Email" />
                  <StatusChip ok={connection.capabilities?.calendar} label="Calendar" />
                </div>
                <div className="rf-v6-row-actions">
                  {connection.capabilities?.emailSend ? <button onClick={() => runAction(connection, "email")} disabled={Boolean(busy)}>Test email</button> : null}
                  {connection.capabilities?.calendar ? <button onClick={() => runAction(connection, "calendar")} disabled={Boolean(busy)}>Test calendar</button> : null}
                  {connection.type === "emailbox_smtp" ? (
                    <a href="/app/email">Manage Emailbox</a>
                  ) : (
                    <button className="danger" onClick={() => runAction(connection, "disconnect")} disabled={Boolean(busy)}>Disconnect</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function MetricMini({ label, value, good }) { return <div className={good ? "good" : ""}><span>{label}</span><strong>{value}</strong></div>; }
function StatusChip({ ok, label }) { return <span className={`rf-v6-status ${ok ? "good" : "muted"}`}>{ok ? "●" : "○"} {label}</span>; }
