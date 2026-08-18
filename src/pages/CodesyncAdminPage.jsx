import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/workspace-platform-client.js";
import "../styles.css";

const PLATFORM_OWNER_EMAIL = "owner@codesynclabs.com";

const TABS = [
  ["overview", "Overview"],
  ["companies", "Companies & subscriptions"],
  ["individuals", "Individuals"],
  ["users", "Users & access"],
  ["payments", "Live payments"],
  ["credits", "Credits & usage"],
  ["marketing", "Marketing leads"],
  ["activity", "Activity"],
];

export default function CodesyncAdminPage() {
  const [dashboard, setDashboard] = useState(null);
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [success, setSuccess] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    setError("");
    setErrorStatus(0);
    try {
      const result = await apiRequest("/platform-admin/dashboard", {
        timeoutMs: 20_000,
      });
      setDashboard(result);
    } catch (requestError) {
      setErrorStatus(Number(requestError?.status || 0));
      setError(
        requestError?.message || "Codesync dashboard data could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const summary = dashboard?.summary || {};
  const companies = useMemo(
    () => filterRows(dashboard?.companies || [], query),
    [dashboard?.companies, query]
  );
  const individuals = useMemo(
    () => filterRows(dashboard?.individuals || [], query),
    [dashboard?.individuals, query]
  );
  const users = useMemo(
    () => filterUserRows(dashboard?.users || [], query),
    [dashboard?.users, query]
  );
  const payments = useMemo(
    () => filterPaymentRows(dashboard?.payments || [], query),
    [dashboard?.payments, query]
  );
  const marketing = useMemo(
    () => filterRows(dashboard?.marketingLeads || [], query),
    [dashboard?.marketingLeads, query]
  );
  const credits = dashboard?.credits || {};
  const allAccounts = useMemo(
    () => [...(dashboard?.companies || []), ...(dashboard?.individuals || [])],
    [dashboard?.companies, dashboard?.individuals]
  );
  const accountNameByWorkspace = useMemo(
    () =>
      new Map(
        allAccounts.map((account) => [account.workspaceId, account.displayName])
      ),
    [allAccounts]
  );

  async function perform(key, action, successMessage) {
    if (busyKey) return;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      await action();

      if (successMessage) {
        setSuccess(successMessage);
        notifyCodesyncAdmin(
          "success",
          "Platform action completed",
          successMessage
        );
      }

      await load({ silent: true });
    } catch (requestError) {
      const message =
        requestError?.message ||
        "The admin action failed.";

      setError(message);
      setErrorStatus(Number(requestError?.status || 0));

      notifyCodesyncAdmin(
        "error",
        "Platform action failed",
        message
      );
    } finally {
      setBusyKey("");
    }
  }

  async function updateMarketing(accountId, status) {
    await perform(
      `marketing:${accountId}`,
      () =>
        apiRequest(
          `/platform-admin/marketing-leads/${encodeURIComponent(accountId)}`,
          {
            method: "PATCH",
            body: { status },
            timeoutMs: 15_000,
          }
        ),
      "Marketing status updated."
    );
  }

  async function updateRate(feature, input) {
    await perform(
      `rate:${feature}`,
      () =>
        apiRequest(`/platform-admin/credit-rates/${encodeURIComponent(feature)}`, {
          method: "PUT",
          body: input,
          timeoutMs: 15_000,
        }),
      "Credit rate updated."
    );
  }

  async function updatePack(packId, input) {
    await perform(
      `pack:${packId}`,
      () =>
        apiRequest(`/platform-admin/credit-packs/${encodeURIComponent(packId)}`, {
          method: "PUT",
          body: input,
          timeoutMs: 15_000,
        }),
      "Credit pack updated."
    );
  }

  async function adjustCredits(workspaceId, input) {
    await perform(
      `credits:${workspaceId}`,
      () =>
        apiRequest(
          `/platform-admin/credits/${encodeURIComponent(workspaceId)}/adjust`,
          {
            method: "POST",
            body: input,
            timeoutMs: 15_000,
          }
        ),
      "Workspace credits adjusted."
    );
  }

  async function updateSubscription(workspaceId, input) {
    await perform(
      `subscription:${workspaceId}`,
      () =>
        apiRequest(
          `/platform-admin/subscriptions/${encodeURIComponent(workspaceId)}`,
          {
            method: "PUT",
            body: input,
            timeoutMs: 15_000,
          }
        ),
      "Subscription record updated."
    );
  }

  async function setUserAccess(row, action) {
    if (row.platformOwner) return;
    let reason = "";
    if (action === "block") {
      reason = window.prompt(
        `Why are you blocking ${row.email || row.name || "this user"}?`
      ) || "";
      if (!reason.trim()) return;
      if (!window.confirm(`Block ${row.email}? Existing sessions will stop working on the next API request.`)) {
        return;
      }
    } else if (!window.confirm(`Restore ReachFly access for ${row.email}?`)) {
      return;
    }

    await perform(
      `user:${row.id}:${action}`,
      () =>
        apiRequest(`/platform-admin/users/${encodeURIComponent(row.id)}/access`, {
          method: "PATCH",
          body: { action, reason },
          timeoutMs: 15_000,
        }),
      action === "block" ? "User blocked." : "User unblocked."
    );
  }

  async function deleteUser(row) {
    if (!row.deletable || row.platformOwner) return;
    const confirmation = window.prompt(
      `Permanent action. Type ${row.email} to delete this user. Historical campaign/payment records are retained.`
    );
    if (!confirmation || confirmation.trim().toLowerCase() !== String(row.email || "").trim().toLowerCase()) {
      return;
    }
    if (!window.confirm(`Permanently delete ${row.email} from ReachFly?`)) return;

    await perform(
      `user:${row.id}:delete`,
      () =>
        apiRequest(`/platform-admin/users/${encodeURIComponent(row.id)}`, {
          method: "DELETE",
          body: { confirmEmail: confirmation },
          timeoutMs: 15_000,
        }),
      "User deleted."
    );
  }

  if (loading) {
    return (
      <main className="cs-admin-page cs-admin-v7">
        <CodesyncAdminV7Styles />
        <div className="cs-admin-loading">Loading Codesync dashboard…</div>
      </main>
    );
  }

  if (error && !dashboard) {
    return (
      <main className="cs-admin-page cs-admin-v7">
        <CodesyncAdminV7Styles />
        <section className="cs-admin-panel cs-admin-danger-panel">
          <span>CodeSync Labs · restricted dashboard</span>
          <h1>Dashboard</h1>
          <p>
            {errorStatus ? `HTTP ${errorStatus}: ${error}` : error}
          </p>
          <p>
            Only <strong>{PLATFORM_OWNER_EMAIL}</strong> is permitted to use this
            control plane.
          </p>
          <button type="button" onClick={() => void load()}>
            Retry dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="cs-admin-page cs-admin-v7">
        <CodesyncAdminV7Styles />
      <header className="cs-admin-hero">
        <div>
          <span>CodeSync Labs · owner dashboard</span>
          <h1>Dashboard</h1>
          <p>
            Company subscriptions, live payments, general and AI-call credit
            usage, user access control, and platform activity. Backend access is
            restricted to {PLATFORM_OWNER_EMAIL}.
          </p>
        </div>
        <button type="button" disabled={refreshing} onClick={() => void load()}>
          {refreshing ? "Refreshing…" : "Refresh live data"}
        </button>
      </header>

      {error ? (
        <section className="cs-admin-alert error">
          <strong>Dashboard action warning</strong>
          <span>{errorStatus ? `HTTP ${errorStatus}: ${error}` : error}</span>
          <button type="button" onClick={() => setError("")}>×</button>
        </section>
      ) : null}

      {success ? (
        <section className="cs-admin-alert success">
          <strong>{success}</strong>
          <button type="button" onClick={() => setSuccess("")}>×</button>
        </section>
      ) : null}

      <nav className="cs-admin-tabs" aria-label="Codesync dashboard sections">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {["companies", "individuals", "users", "payments", "marketing"].includes(tab) ? (
        <input
          className="cs-admin-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search company, user, payment, email, product…"
        />
      ) : null}

      {tab === "overview" ? (
        <Overview dashboard={dashboard} summary={summary} />
      ) : null}

      {tab === "companies" ? (
        <CompaniesTable
          rows={companies}
          onSubscription={updateSubscription}
          busyKey={busyKey}
        />
      ) : null}

      {tab === "individuals" ? (
        <AccountsTable rows={individuals} />
      ) : null}

      {tab === "users" ? (
        <UsersTable
          rows={users}
          busyKey={busyKey}
          onAccess={setUserAccess}
          onDelete={deleteUser}
        />
      ) : null}

      {tab === "payments" ? (
        <PaymentsTable rows={payments} />
      ) : null}

      {tab === "marketing" ? (
        <MarketingTable rows={marketing} onStatus={updateMarketing} />
      ) : null}

      {tab === "credits" ? (
        <CreditsPanel
          credits={credits}
          accountNameByWorkspace={accountNameByWorkspace}
          onRate={updateRate}
          onPack={updatePack}
          onAdjust={adjustCredits}
        />
      ) : null}

      {tab === "activity" ? (
        <section className="cs-admin-panel">
          <h2>Platform activity</h2>
          <ActivityList rows={dashboard?.activity || []} />
        </section>
      ) : null}
    </main>
  );
}

function Overview({ dashboard, summary }) {
  return (
    <>
      <section className="cs-metric-grid">
        <Metric label="Companies" value={summary.companies} note={`${summary.activeSubscriptions || 0} active/trial subscriptions`} />
        <Metric label="Users" value={summary.users} note={`${summary.blockedUsers || 0} blocked`} />
        <Metric label="Live payments" value={summary.successfulPayments} note={`${summary.pendingPayments || 0} pending`} />
        <Metric label="General credits available" value={formatCredits(summary.totalAvailableCredits)} />
        <Metric label="General credits consumed" value={formatCredits(summary.totalConsumedCredits)} />
        <Metric label="AI call credits available" value={formatCredits(summary.totalAiCallCreditsAvailable)} />
        <Metric label="AI call credits consumed" value={formatCredits(summary.totalAiCallCreditsConsumed)} />
        <Metric label="AI calls" value={summary.aiCalls} note={`${summary.aiMeetings || 0} meetings`} />
      </section>

      <RevenueByCurrency values={summary.revenueByCurrency || {}} />

      <section className="cs-admin-grid-two">
        <article className="cs-admin-panel">
          <h2>Billing & subscription health</h2>
          <p>{dashboard?.dataHealth?.note}</p>
          <div className="cs-status-stack">
            <StatusLine label="Active/trial subscriptions" value={summary.activeSubscriptions || 0} state="good" />
            <StatusLine label="Past-due subscriptions" value={summary.pastDueSubscriptions || 0} state={summary.pastDueSubscriptions ? "warn" : "good"} />
            <StatusLine label="Blocked users" value={summary.blockedUsers || 0} state={summary.blockedUsers ? "warn" : "good"} />
          </div>
        </article>

        <article className="cs-admin-panel">
          <h2>Recent successful payments</h2>
          <PaymentsCompact rows={(dashboard?.payments || []).filter((row) => row.paymentStatus === "succeeded").slice(0, 8)} />
        </article>
      </section>

      <section className="cs-admin-panel">
        <h2>Recent platform activity</h2>
        <ActivityList rows={(dashboard?.activity || []).slice(0, 14)} />
      </section>
    </>
  );
}

function Metric({ label, value, note }) {
  return (
    <article className="cs-metric">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function StatusLine({ label, value, state = "good" }) {
  return (
    <div className={`cs-status-line ${state}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RevenueByCurrency({ values }) {
  const entries = Object.entries(values || {});
  if (!entries.length) {
    return (
      <section className="cs-admin-panel">
        <h2>Collected revenue</h2>
        <p>No successful ReachFly payment records yet.</p>
      </section>
    );
  }
  return (
    <section className="cs-metric-grid">
      {entries.map(([currency, amountMinor]) => (
        <Metric
          key={currency}
          label={`Collected ${currency}`}
          value={moneyMinor(amountMinor, currency)}
          note="Successful credit, AI-call, number and bundle payments"
        />
      ))}
    </section>
  );
}

function CompaniesTable({ rows, onSubscription, busyKey }) {
  return (
    <section className="cs-admin-panel cs-table-wrap">
      <div className="cs-admin-note">
        Subscription fields are platform commercial records. They do not claim
        recurring collection unless your recurring billing integration updates
        the subscription/payment state.
      </div>
      <table className="cs-company-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Subscription</th>
            <th>General credits</th>
            <th>AI call credits</th>
            <th>Payments</th>
            <th>Voice numbers</th>
            <th>Usage</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.displayName}</strong>
                <small>{row.ownerName || "No owner name"}</small>
                <small>{row.ownerEmail || ""}</small>
                <StatusPill value={row.status} />
              </td>
              <td>
                <SubscriptionEditor
                  workspaceId={row.workspaceId}
                  subscription={row.subscription || {}}
                  onSave={onSubscription}
                  busy={busyKey === `subscription:${row.workspaceId}`}
                />
              </td>
              <td>
                <strong>{formatCredits(row.credits?.available)}</strong>
                <small>{formatCredits(row.credits?.consumed)} consumed</small>
                <small>{formatCredits(row.credits?.purchased)} purchased</small>
              </td>
              <td>
                <strong>{formatCredits(row.aiCallCredits?.available)}</strong>
                <small>{formatCredits(row.aiCallCredits?.consumed)} consumed</small>
                <small>{formatCredits(row.aiCallCredits?.purchased)} purchased</small>
              </td>
              <td>
                <strong>{row.payments?.successful || 0} successful</strong>
                <small>{row.payments?.pending || 0} pending</small>
                <small>{formatRevenueMap(row.payments?.revenueByCurrency)}</small>
                <small>{row.payments?.lastPaymentAt ? `Last: ${formatDate(row.payments.lastPaymentAt)}` : "No successful payment"}</small>
              </td>
              <td>
                <strong>{row.activeNumbers?.length || 0} active</strong>
                {(row.activeNumbers || []).slice(0, 2).map((number) => (
                  <small key={number.phoneNumber}>{number.phoneNumber}</small>
                ))}
              </td>
              <td>
                <strong>{row.leads || 0} leads</strong>
                <small>{row.campaigns || 0} campaigns</small>
                <small>{row.aiCalls || 0} AI calls · {row.meetings || 0} meetings</small>
                <small>{row.users || 0} users · {row.blockedUsers || 0} blocked</small>
              </td>
            </tr>
          )) : <EmptyRow colSpan={7} text="No companies found." />}
        </tbody>
      </table>
    </section>
  );
}

function SubscriptionEditor({ workspaceId, subscription, onSave, busy }) {
  const [planName, setPlanName] = useState(subscription.planName || "");
  const [status, setStatus] = useState(subscription.status || "none");
  const [amountMajor, setAmountMajor] = useState(
    subscription.amountMinor ? String(Number(subscription.amountMinor) / 100) : ""
  );
  const [currency, setCurrency] = useState(subscription.currency || "USD");
  const [interval, setInterval] = useState(subscription.interval || "monthly");
  const [periodEnd, setPeriodEnd] = useState(toDateInput(subscription.currentPeriodEnd));

  useEffect(() => {
    setPlanName(subscription.planName || "");
    setStatus(subscription.status || "none");
    setAmountMajor(subscription.amountMinor ? String(Number(subscription.amountMinor) / 100) : "");
    setCurrency(subscription.currency || "USD");
    setInterval(subscription.interval || "monthly");
    setPeriodEnd(toDateInput(subscription.currentPeriodEnd));
  }, [subscription]);

  return (
    <div className="cs-subscription-editor">
      <div className="cs-inline-fields">
        <input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Plan name" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="none">None</option>
          <option value="trialing">Trialing</option>
          <option value="active">Active</option>
          <option value="past_due">Past due</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="cs-inline-fields">
        <input type="number" min="0" step="0.01" value={amountMajor} onChange={(event) => setAmountMajor(event.target.value)} placeholder="Amount" />
        <input value={currency} maxLength={8} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="USD" />
        <select value={interval} onChange={(event) => setInterval(event.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      <div className="cs-inline-fields">
        <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onSave(workspaceId, {
              planName,
              status,
              amountMinor: amountMajor ? Math.round(Number(amountMajor) * 100) : 0,
              currency,
              interval,
              currentPeriodEnd: periodEnd ? new Date(`${periodEnd}T23:59:59.000Z`).toISOString() : "",
              source: "platform_admin",
            })
          }
        >
          {busy ? "Saving…" : "Save subscription"}
        </button>
      </div>
      <small>
        {subscription.currentPeriodEnd ? `Period end: ${formatDate(subscription.currentPeriodEnd)}` : "No renewal date recorded"}
      </small>
    </div>
  );
}

function AccountsTable({ rows }) {
  return (
    <section className="cs-admin-panel cs-table-wrap">
      <table>
        <thead><tr><th>Account</th><th>Owner</th><th>General credits</th><th>AI credits</th><th>Payments</th><th>Usage</th><th>Last activity</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id}>
              <td><strong>{row.displayName}</strong><small>{row.accountType}</small></td>
              <td>{row.ownerName || "—"}<small>{row.ownerEmail || ""}</small></td>
              <td>{formatCredits(row.credits?.available)}<small>{formatCredits(row.credits?.consumed)} consumed</small></td>
              <td>{formatCredits(row.aiCallCredits?.available)}<small>{formatCredits(row.aiCallCredits?.consumed)} consumed</small></td>
              <td>{row.payments?.successful || 0}<small>{formatRevenueMap(row.payments?.revenueByCurrency)}</small></td>
              <td>{row.leads || 0} leads<small>{row.aiCalls || 0} AI calls</small></td>
              <td>{formatDate(row.lastActivityAt)}</td>
            </tr>
          )) : <EmptyRow colSpan={7} text="No accounts found." />}
        </tbody>
      </table>
    </section>
  );
}

function UsersTable({ rows, busyKey, onAccess, onDelete }) {
  return (
    <section className="cs-admin-panel cs-table-wrap">
      <div className="cs-admin-note">
        Blocking is enforced by backend authentication on every protected API
        request. Deletion immediately invalidates that user ID. Workspace owners
        cannot be deleted from this table to avoid orphaning a company.
      </div>
      <table>
        <thead><tr><th>User</th><th>Workspace</th><th>Role</th><th>Status</th><th>Blocked reason</th><th>Updated</th><th>Admin action</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => {
            const blockBusy = busyKey === `user:${row.id}:block`;
            const unblockBusy = busyKey === `user:${row.id}:unblock`;
            const deleteBusy = busyKey === `user:${row.id}:delete`;
            return (
              <tr key={row.id}>
                <td>
                  <strong>{row.name || "Unnamed user"}</strong>
                  <small>{row.email || ""}</small>
                  {row.platformOwner ? <span className="cs-owner-badge">Platform owner</span> : null}
                </td>
                <td>{row.workspaceName || row.workspaceId || "—"}<small>{row.accountType}</small></td>
                <td>{formatFeature(row.role)}</td>
                <td><StatusPill value={row.accessBlocked ? "blocked" : row.status} /></td>
                <td>{row.blockedReason || "—"}<small>{row.blockedAt ? formatDate(row.blockedAt) : ""}</small></td>
                <td>{formatDate(row.updatedAt)}</td>
                <td>
                  <div className="cs-user-actions">
                    {row.platformOwner ? (
                      <span className="cs-protected-label">Protected</span>
                    ) : row.accessBlocked ? (
                      <button type="button" disabled={unblockBusy} onClick={() => void onAccess(row, "unblock")}>{unblockBusy ? "Working…" : "Unblock"}</button>
                    ) : (
                      <button type="button" className="warning" disabled={blockBusy} onClick={() => void onAccess(row, "block")}>{blockBusy ? "Working…" : "Block"}</button>
                    )}
                    {!row.platformOwner ? (
                      <button type="button" className="danger" disabled={!row.deletable || deleteBusy} title={!row.deletable ? "Workspace owners cannot be deleted here." : "Permanently delete user"} onClick={() => void onDelete(row)}>{deleteBusy ? "Deleting…" : "Delete"}</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          }) : <EmptyRow colSpan={7} text="No users found." />}
        </tbody>
      </table>
    </section>
  );
}

function PaymentsTable({ rows }) {
  return (
    <section className="cs-admin-panel cs-table-wrap">
      <div className="cs-admin-note">
        This combines general credit purchases, standalone AI-call-credit
        purchases, business-number activation payments, and Voice Agent bundles.
        Voice bundle credit sub-records are deduplicated so one checkout appears
        once.
      </div>
      <table>
        <thead><tr><th>Account</th><th>Product</th><th>Details</th><th>Amount</th><th>Payment</th><th>Operational state</th><th>Provider</th><th>Date</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id}>
              <td><strong>{row.accountName || row.workspaceId}</strong><small>{row.workspaceId}</small></td>
              <td><strong>{row.productLabel}</strong><small>{formatFeature(row.productType)}</small></td>
              <td>{row.credits ? `${formatCredits(row.credits)} credits` : "—"}<small>{row.phoneNumber || ""}</small></td>
              <td>{moneyMinor(row.amountMinor, row.currency)}</td>
              <td><StatusPill value={row.paymentStatus} /></td>
              <td>{formatFeature(row.operationalStatus || "—")}</td>
              <td>{formatFeature(row.provider || "—")}<small>{row.providerTracker || ""}</small></td>
              <td>{formatDate(row.paidAt || row.updatedAt || row.createdAt)}</td>
            </tr>
          )) : <EmptyRow colSpan={8} text="No payment records found." />}
        </tbody>
      </table>
    </section>
  );
}

function PaymentsCompact({ rows }) {
  if (!rows.length) return <p>No successful payment records yet.</p>;
  return (
    <div className="cs-payment-compact">
      {rows.map((row) => (
        <article key={row.id}>
          <div><strong>{row.accountName || row.workspaceId}</strong><small>{row.productLabel}</small></div>
          <div><strong>{moneyMinor(row.amountMinor, row.currency)}</strong><small>{formatDate(row.paidAt || row.updatedAt)}</small></div>
        </article>
      ))}
    </div>
  );
}

function MarketingTable({ rows, onStatus }) {
  return (
    <section className="cs-admin-panel cs-table-wrap">
      <div className="cs-admin-note">Marketing review does not itself establish consent. Suppression and do-not-contact states always win.</div>
      <table>
        <thead><tr><th>Prospect</th><th>Type</th><th>Usage</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id}>
              <td><strong>{row.displayName}</strong><small>{row.ownerEmail}</small></td>
              <td>{row.accountType}</td>
              <td>{row.leads} leads · {row.campaigns} campaigns</td>
              <td>{formatFeature(row.marketingStatus)}</td>
              <td>
                <select value={row.marketingStatus} onChange={(event) => void onStatus(row.id, event.target.value)}>
                  <option value="review_required">Review required</option>
                  <option value="qualified">Qualified</option>
                  <option value="contacted">Contacted</option>
                  <option value="nurture">Nurture</option>
                  <option value="converted">Converted</option>
                  <option value="not_a_fit">Not a fit</option>
                  <option value="do_not_contact">Do not contact</option>
                </select>
              </td>
            </tr>
          )) : <EmptyRow colSpan={5} text="No marketing leads found." />}
        </tbody>
      </table>
    </section>
  );
}

function CreditsPanel({ credits, accountNameByWorkspace, onRate, onPack, onAdjust }) {
  const aiCallPolicy = credits.aiCallPolicy || {};
  return (
    <>
      <section className="cs-metric-grid">
        <Metric label="General available" value={formatCredits(credits.totalAvailableCredits)} />
        <Metric label="General reserved" value={formatCredits(credits.totalReservedCredits)} />
        <Metric label="General purchased" value={formatCredits(credits.totalPurchasedCredits)} />
        <Metric label="General consumed" value={formatCredits(credits.totalConsumedCredits)} note={`${credits.walletsWithDebt || 0} wallets with debt`} />
        <Metric label="AI call credits available" value={formatCredits(credits.totalAiCallCreditsAvailable)} />
        <Metric label="AI call credits consumed" value={formatCredits(credits.totalAiCallCreditsConsumed)} />
      </section>

      <RevenueByCurrency values={credits.revenueByCurrency || {}} />

      <section className="cs-admin-panel">
        <h2>AI calling commercial policy</h2>
        <div className="cs-status-stack">
          <StatusLine label="Credits / connected call" value={formatCredits(aiCallPolicy.creditsPerConnectedCall ?? 1)} />
          <StatusLine label="Connected-call retail price" value={moneyMinor(aiCallPolicy.connectedCallPriceMinor || 0, aiCallPolicy.currency || "USD")} />
          <StatusLine label="Max connected seconds" value={aiCallPolicy.maxConnectedSeconds || "Not configured"} state={aiCallPolicy.maxConnectedSeconds ? "good" : "warn"} />
        </div>
      </section>

      <section className="cs-admin-panel">
        <h2>General usage rate card</h2>
        <p>These values centrally control general ReachFly credit consumption.</p>
        <div className="cs-table-wrap">
          <table>
            <thead><tr><th>Feature</th><th>Unit</th><th>Credits / unit</th><th>Billable</th><th>Save</th></tr></thead>
            <tbody>{(credits.rateCard || []).map((rate) => <RateRow key={rate.feature} rate={rate} onSave={onRate} />)}</tbody>
          </table>
        </div>
      </section>

      <section className="cs-admin-panel">
        <h2>General credit packs</h2>
        <p>{credits.testGrantEnabled ? `${formatCredits(credits.freeTestCredits)} test credits are enabled in this environment.` : "General test-credit grants are disabled."}</p>
        <div className="cs-table-wrap">
          <table>
            <thead><tr><th>Pack</th><th>Market</th><th>Credits</th><th>Price</th><th>Active</th><th>Save</th></tr></thead>
            <tbody>{(credits.packs || []).map((pack) => <PackRow key={pack.id} pack={pack} onSave={onPack} />)}</tbody>
          </table>
        </div>
      </section>

      <section className="cs-admin-panel">
        <h2>General workspace credit wallets</h2>
        <div className="cs-table-wrap">
          <table>
            <thead><tr><th>Account</th><th>Available</th><th>Reserved</th><th>Consumed</th><th>Purchased</th><th>Manual adjustment</th></tr></thead>
            <tbody>{(credits.wallets || []).map((wallet) => <WalletRow key={wallet.workspaceId} wallet={wallet} onAdjust={onAdjust} />)}</tbody>
          </table>
        </div>
      </section>

      <section className="cs-admin-panel">
        <h2>AI call-credit wallets</h2>
        <div className="cs-table-wrap">
          <table>
            <thead><tr><th>Account</th><th>Available</th><th>Consumed</th><th>Purchased</th><th>Granted</th><th>Debt</th></tr></thead>
            <tbody>
              {(credits.aiCallWallets || []).length ? (credits.aiCallWallets || []).map((wallet) => (
                <tr key={wallet.workspaceId}>
                  <td><strong>{accountNameByWorkspace.get(wallet.workspaceId) || wallet.workspaceId}</strong><small>{wallet.workspaceId}</small></td>
                  <td>{formatCredits(wallet.balance)}</td>
                  <td>{formatCredits(wallet.totalConsumed)}</td>
                  <td>{formatCredits(wallet.totalPurchased)}</td>
                  <td>{formatCredits(wallet.totalGranted)}</td>
                  <td>{formatCredits(wallet.debt)}</td>
                </tr>
              )) : <EmptyRow colSpan={6} text="No AI call-credit wallets yet." />}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cs-admin-panel">
        <h2>General usage by feature</h2>
        <div className="cs-table-wrap">
          <table>
            <thead><tr><th>Feature</th><th>Quantity</th><th>Credits consumed</th></tr></thead>
            <tbody>{(credits.usageByFeature || []).length ? (credits.usageByFeature || []).map((row) => <tr key={row.feature}><td>{formatFeature(row.feature)}</td><td>{formatCredits(row.quantity)}</td><td>{formatCredits(row.credits)}</td></tr>) : <EmptyRow colSpan={3} text="No billable general usage yet." />}</tbody>
          </table>
        </div>
      </section>

      <section className="cs-admin-panel">
        <h2>Recent AI connected-call usage</h2>
        <div className="cs-table-wrap">
          <table>
            <thead><tr><th>Account</th><th>Call</th><th>Duration</th><th>Credits</th><th>Date</th></tr></thead>
            <tbody>
              {(credits.aiCallUsage || []).length ? (credits.aiCallUsage || []).slice(0, 200).map((row) => (
                <tr key={row.id || `${row.workspaceId}:${row.callId}`}>
                  <td>{accountNameByWorkspace.get(row.workspaceId) || row.workspaceId}</td>
                  <td>{row.callId || "—"}</td>
                  <td>{Number(row.durationSeconds || 0)}s</td>
                  <td>{formatCredits(row.credits || row.creditsConsumed || 0)}</td>
                  <td>{formatDate(row.createdAt)}</td>
                </tr>
              )) : <EmptyRow colSpan={5} text="No connected-call usage yet." />}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function RateRow({ rate, onSave }) {
  const [creditValue, setCreditValue] = useState(String(rate.creditsPerUnit ?? 0));
  const [billable, setBillable] = useState(rate.billable !== false);
  return (
    <tr>
      <td><strong>{rate.label}</strong><small>{rate.feature}</small></td>
      <td>{rate.unit}</td>
      <td><input type="number" min="0" step="0.001" value={creditValue} onChange={(event) => setCreditValue(event.target.value)} /></td>
      <td><input type="checkbox" checked={billable} onChange={(event) => setBillable(event.target.checked)} /></td>
      <td><button type="button" onClick={() => void onSave(rate.feature, { creditsPerUnit: Number(creditValue), billable })}>Save</button></td>
    </tr>
  );
}

function PackRow({ pack, onSave }) {
  const [creditValue, setCreditValue] = useState(String(pack.credits || 0));
  const [amountMajor, setAmountMajor] = useState(pack.amountMinor ? String(Number(pack.amountMinor) / 100) : "");
  const [active, setActive] = useState(Boolean(pack.active));
  return (
    <tr>
      <td><strong>{pack.label || pack.id}</strong><small>{pack.id}</small></td>
      <td>{pack.market}<small>{pack.currency}</small></td>
      <td><input type="number" min="1" step="1" value={creditValue} onChange={(event) => setCreditValue(event.target.value)} /></td>
      <td><input type="number" min="0" step="0.01" placeholder={`Price in ${pack.currency}`} value={amountMajor} onChange={(event) => setAmountMajor(event.target.value)} /><small>{pack.amountMinor ? moneyMinor(pack.amountMinor, pack.currency) : "Not priced"}</small></td>
      <td><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /></td>
      <td><button type="button" onClick={() => void onSave(pack.id, { credits: Number(creditValue), amountMinor: amountMajor ? Math.round(Number(amountMajor) * 100) : null, active, currency: pack.currency, market: pack.market })}>Save</button></td>
    </tr>
  );
}

function WalletRow({ wallet, onAdjust }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  return (
    <tr>
      <td><strong>{wallet.accountName || wallet.workspaceId}</strong><small>{wallet.workspaceId}</small></td>
      <td>{formatCredits(wallet.balance)}</td>
      <td>{formatCredits(wallet.reserved)}</td>
      <td>{formatCredits(wallet.totalConsumed)}</td>
      <td>{formatCredits(wallet.totalPurchased)}</td>
      <td>
        <div className="cs-credit-adjust">
          <input type="number" step="1" placeholder="+/- credits" value={delta} onChange={(event) => setDelta(event.target.value)} />
          <input placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <button type="button" disabled={!Number(delta) || !reason.trim()} onClick={() => { void onAdjust(wallet.workspaceId, { delta: Number(delta), reason }); setDelta(""); setReason(""); }}>Apply</button>
        </div>
      </td>
    </tr>
  );
}

function StatusPill({ value }) {
  const normalized = String(value || "unknown").toLowerCase().replace(/[\s-]+/g, "_");
  return <span className={`cs-status-pill ${normalized}`}>{formatFeature(normalized)}</span>;
}

function ActivityList({ rows }) {
  if (!rows.length) return <p>No activity yet.</p>;
  return (
    <div className="cs-activity-list">
      {rows.map((row) => (
        <article key={row.id}>
          <div><strong>{row.title}</strong><small>{row.accountName || row.source}{row.detail ? ` · ${row.detail}` : ""}</small></div>
          <time>{formatDate(row.createdAt)}</time>
        </article>
      ))}
    </div>
  );
}

function EmptyRow({ colSpan, text }) {
  return <tr><td colSpan={colSpan} className="cs-empty-cell">{text}</td></tr>;
}

function filterRows(rows, query) {
  const value = query.trim().toLowerCase();
  if (!value) return rows;
  return rows.filter((row) =>
    [row.displayName, row.ownerName, row.ownerEmail, row.companyName, row.subscription?.planName, row.subscription?.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(value)
  );
}

function filterUserRows(rows, query) {
  const value = query.trim().toLowerCase();
  if (!value) return rows;
  return rows.filter((row) =>
    [row.name, row.email, row.workspaceName, row.role, row.status, row.blockedReason]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(value)
  );
}

function filterPaymentRows(rows, query) {
  const value = query.trim().toLowerCase();
  if (!value) return rows;
  return rows.filter((row) =>
    [row.accountName, row.workspaceId, row.productType, row.productLabel, row.phoneNumber, row.paymentStatus, row.operationalStatus, row.providerTracker]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(value)
  );
}

function formatCredits(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function moneyMinor(amountMinor, currency = "USD") {
  const value = Number(amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(value);
  } catch {
    return `${currency || "USD"} ${value.toFixed(2)}`;
  }
}

function formatRevenueMap(values = {}) {
  const entries = Object.entries(values || {});
  if (!entries.length) return "No collected revenue";
  return entries.map(([currency, amountMinor]) => moneyMinor(amountMinor, currency)).join(" · ");
}

function formatFeature(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}


function notifyCodesyncAdmin(
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
    typeof bridge[type] ===
      "function"
  ) {
    bridge[type](
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

function CodesyncAdminV7Styles() {
  return (
    <style>{`
      .cs-admin-v7{
        --csa-card:#fff;
        --csa-soft:#f6f7f8;
        --csa-text:#191c1d;
        --csa-text2:#4d4c59;
        --csa-muted:#777784;
        --csa-line:#e2e4e7;
        --csa-primary:#4648d4;
        --csa-primary-dark:#393bbb;
        --csa-primary-soft:#e8e9ff;
        --csa-violet:#6b38d4;
        --csa-violet-soft:#f1ebff;
        --csa-green:#087a51;
        --csa-green-soft:#e4f7ee;
        --csa-red:#ba1a1a;
        --csa-red-soft:#ffedeb;
        --csa-amber:#965900;
        --csa-amber-soft:#fff3d8;
        --csa-dark:#2e3132;
        --csa-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        max-width:none;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--csa-text);
        background:transparent;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:csaPageIn .24s var(--csa-ease);
      }

      .cs-admin-v7 *,
      .cs-admin-v7 *::before,
      .cs-admin-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes csaPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes csaPulse{
        0%,100%{opacity:.45}
        50%{opacity:1}
      }

      .cs-admin-v7 .cs-admin-loading{
        min-height:440px;
        display:grid;
        place-items:center;
        color:var(--csa-muted);
        background:#fff;
        border:1px solid var(--csa-line);
        border-radius:12px;
        font-size:8px;
        animation:csaPulse 1s infinite ease-in-out;
      }

      .cs-admin-v7 .cs-admin-hero{
        min-height:150px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        padding:22px;
        margin-bottom:12px;
        overflow:hidden;
        color:#fff;
        background:
          radial-gradient(circle at 88% 16%,rgba(94,97,232,.27),transparent 31%),
          radial-gradient(circle at 10% 82%,rgba(107,56,212,.17),transparent 28%),
          #2e3132;
        border:1px solid rgba(255,255,255,.06);
        border-radius:14px;
      }

      .cs-admin-v7 .cs-admin-hero > div{
        min-width:0;
      }

      .cs-admin-v7 .cs-admin-hero span{
        display:block;
        margin-bottom:5px;
        color:#c9caff;
        font-size:6.5px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .cs-admin-v7 .cs-admin-hero h1{
        margin:0;
        color:#fff;
        font:600 33px/41px Geist,Inter,sans-serif;
        letter-spacing:-.035em;
      }

      .cs-admin-v7 .cs-admin-hero p{
        max-width:820px;
        margin:5px 0 0;
        color:rgba(242,244,245,.64);
        font-size:9px;
        line-height:15px;
      }

      .cs-admin-v7 button{
        transition:.14s var(--csa-ease);
      }

      .cs-admin-v7 button:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .cs-admin-v7 button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .cs-admin-v7 .cs-admin-hero > button,
      .cs-admin-v7 .cs-admin-panel > button,
      .cs-admin-v7 .cs-user-actions button,
      .cs-admin-v7 .cs-credit-adjust button,
      .cs-admin-v7 .cs-subscription-editor button,
      .cs-admin-v7 .cs-table-wrap button{
        min-height:36px;
        padding:7px 9px;
        color:var(--csa-text);
        background:#fff;
        border:1px solid var(--csa-line);
        border-radius:7px;
        cursor:pointer;
        font:700 6px/1 Inter,sans-serif;
      }

      .cs-admin-v7 .cs-admin-hero > button{
        color:#fff;
        background:var(--csa-primary);
        border-color:var(--csa-primary);
        box-shadow:0 8px 18px rgba(0,0,0,.13);
      }

      .cs-admin-v7 .cs-admin-alert{
        padding:10px 12px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        font-size:7px;
        line-height:12px;
      }

      .cs-admin-v7 .cs-admin-alert.error{
        color:#7c1d1d;
        background:var(--csa-red-soft);
        border-color:#ffd0cc;
      }

      .cs-admin-v7 .cs-admin-alert.success{
        color:#086846;
        background:var(--csa-green-soft);
        border-color:#caeadb;
      }

      .cs-admin-v7 .cs-admin-danger-panel{
        min-height:300px;
        display:grid;
        place-items:center;
        align-content:center;
        max-width:none;
        margin:0;
        padding:28px;
        color:#7c1d1d;
        background:linear-gradient(135deg,#fff7f6,#fff);
        border:1px solid #ffd3cf;
        border-radius:12px;
        text-align:center;
      }

      .cs-admin-v7 .cs-admin-danger-panel > span{
        color:var(--csa-red);
        font-size:6px;
        font-weight:800;
        text-transform:uppercase;
      }

      .cs-admin-v7 .cs-admin-danger-panel h1{
        margin:5px 0 0;
        color:var(--csa-text);
        font:600 24px/31px Geist,Inter,sans-serif;
      }

      .cs-admin-v7 .cs-admin-danger-panel p{
        max-width:700px;
        color:var(--csa-text2);
        font-size:7px;
        line-height:12px;
      }

      .cs-admin-v7 .cs-admin-tabs{
        position:sticky;
        z-index:25;
        top:64px;
        display:flex;
        gap:5px;
        overflow-x:auto;
        padding:5px;
        margin-bottom:10px;
        background:rgba(255,255,255,.95);
        border:1px solid var(--csa-line);
        border-radius:10px;
        backdrop-filter:blur(12px);
        scrollbar-width:none;
      }

      .cs-admin-v7 .cs-admin-tabs::-webkit-scrollbar{
        display:none;
      }

      .cs-admin-v7 .cs-admin-tabs button{
        min-height:36px;
        flex:0 0 auto;
        padding:6px 9px;
        color:var(--csa-text2);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:6.3px;
        font-weight:700;
      }

      .cs-admin-v7 .cs-admin-tabs button:hover{
        background:#f3f4f5;
      }

      .cs-admin-v7 .cs-admin-tabs button.active{
        color:var(--csa-primary);
        background:var(--csa-primary-soft);
      }

      .cs-admin-v7 .cs-admin-search{
        width:100%;
        min-height:42px;
        margin-bottom:10px;
        padding:9px 11px;
        color:var(--csa-text);
        background:#fff;
        border:1px solid var(--csa-line);
        border-radius:9px;
        outline:0;
        font-size:7px;
      }

      .cs-admin-v7 .cs-admin-search:focus{
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .cs-admin-v7 .cs-metric-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin-bottom:10px;
      }

      .cs-admin-v7 .cs-metric{
        min-height:125px;
        display:grid;
        align-content:end;
        padding:13px;
        background:#fff;
        border:1px solid var(--csa-line);
        border-radius:10px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .cs-admin-v7 .cs-metric span{
        color:var(--csa-muted);
        font-size:5.7px;
        font-weight:750;
      }

      .cs-admin-v7 .cs-metric strong{
        margin-top:4px;
        font:600 23px/28px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .cs-admin-v7 .cs-metric small{
        margin-top:3px;
        color:var(--csa-muted);
        font-size:5.3px;
        line-height:9px;
      }

      .cs-admin-v7 .cs-admin-grid-two{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-bottom:10px;
      }

      .cs-admin-v7 .cs-admin-panel{
        min-width:0;
        padding:13px;
        margin-bottom:10px;
        background:#fff;
        border:1px solid var(--csa-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .cs-admin-v7 .cs-admin-panel h2{
        margin:0;
        font:600 14px/19px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .cs-admin-v7 .cs-admin-panel > p{
        color:var(--csa-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .cs-admin-v7 .cs-status-stack{
        display:grid;
        gap:5px;
        margin-top:9px;
      }

      .cs-admin-v7 .cs-status-line{
        min-height:43px;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:8px 9px;
        background:#f7f8f9;
        border-radius:8px;
        font-size:6px;
      }

      .cs-admin-v7 .cs-status-line.ok{
        color:var(--csa-green);
        background:var(--csa-green-soft);
      }

      .cs-admin-v7 .cs-status-line.warning{
        color:var(--csa-amber);
        background:var(--csa-amber-soft);
      }

      .cs-admin-v7 .cs-table-wrap{
        overflow-x:auto;
        padding:0;
      }

      .cs-admin-v7 table{
        width:100%;
        min-width:900px;
        border-collapse:collapse;
      }

      .cs-admin-v7 th{
        height:42px;
        padding:8px 10px;
        color:#686973;
        background:#f7f8f9;
        border-bottom:1px solid var(--csa-line);
        text-align:left;
        white-space:nowrap;
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.04em;
        text-transform:uppercase;
      }

      .cs-admin-v7 td{
        padding:9px 10px;
        color:var(--csa-text2);
        border-bottom:1px solid #eff0f1;
        vertical-align:top;
        font-size:6px;
        line-height:10px;
      }

      .cs-admin-v7 tbody tr:hover td{
        background:#fafaff;
      }

      .cs-admin-v7 td strong,
      .cs-admin-v7 td b{
        color:var(--csa-text);
        font-size:6.4px;
      }

      .cs-admin-v7 .cs-admin-note{
        padding:9px 10px;
        margin:0 0 8px;
        color:var(--csa-text2);
        background:#f7f7fc;
        border:1px solid #e5e5f3;
        border-radius:8px;
        font-size:6px;
        line-height:10px;
      }

      .cs-admin-v7 input,
      .cs-admin-v7 select,
      .cs-admin-v7 textarea{
        min-height:35px;
        padding:7px 8px;
        color:var(--csa-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:7px;
        outline:0;
        font:400 6.3px/10px Inter,sans-serif;
      }

      .cs-admin-v7 textarea{
        min-height:72px;
        resize:vertical;
      }

      .cs-admin-v7 input:focus,
      .cs-admin-v7 select:focus,
      .cs-admin-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .cs-admin-v7 .cs-subscription-editor,
      .cs-admin-v7 .cs-credit-adjust{
        display:grid;
        gap:6px;
        min-width:230px;
      }

      .cs-admin-v7 .cs-inline-fields{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:5px;
      }

      .cs-admin-v7 .cs-owner-badge,
      .cs-admin-v7 .cs-protected-label,
      .cs-admin-v7 .cs-status-pill{
        display:inline-flex;
        align-items:center;
        min-height:23px;
        padding:4px 6px;
        border-radius:999px;
        font-size:5.2px;
        font-weight:750;
      }

      .cs-admin-v7 .cs-owner-badge,
      .cs-admin-v7 .cs-status-pill.active,
      .cs-admin-v7 .cs-status-pill.succeeded,
      .cs-admin-v7 .cs-status-pill.paid{
        color:var(--csa-green);
        background:var(--csa-green-soft);
      }

      .cs-admin-v7 .cs-protected-label{
        color:var(--csa-primary);
        background:var(--csa-primary-soft);
      }

      .cs-admin-v7 .cs-status-pill.blocked,
      .cs-admin-v7 .cs-status-pill.failed,
      .cs-admin-v7 .cs-status-pill.deleted{
        color:#8a1c1c;
        background:var(--csa-red-soft);
      }

      .cs-admin-v7 .cs-status-pill.pending,
      .cs-admin-v7 .cs-status-pill.warning{
        color:var(--csa-amber);
        background:var(--csa-amber-soft);
      }

      .cs-admin-v7 .cs-user-actions{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
      }

      .cs-admin-v7 .cs-user-actions button.warning{
        color:#7c5100;
        background:var(--csa-amber-soft);
        border-color:#ecd6a8;
      }

      .cs-admin-v7 .cs-user-actions button.danger{
        color:#fff;
        background:#b42318;
        border-color:#b42318;
      }

      .cs-admin-v7 .cs-payment-compact{
        display:grid;
        gap:2px;
      }

      .cs-admin-v7 .cs-activity-list{
        display:grid;
        gap:5px;
      }

      .cs-admin-v7 .cs-activity-list > article,
      .cs-admin-v7 .cs-activity-list > div{
        min-height:58px;
        display:grid;
        grid-template-columns:minmax(130px,.8fr) minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:8px 9px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .cs-admin-v7 .cs-empty-cell{
        min-height:120px;
        display:grid;
        place-items:center;
        color:var(--csa-muted);
        text-align:center;
      }

      @media(max-width:1100px){
        .cs-admin-v7{
          padding:22px;
        }

        .cs-admin-v7 .cs-metric-grid{
          grid-template-columns:1fr 1fr;
        }

        .cs-admin-v7 .cs-admin-grid-two{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:720px){
        .cs-admin-v7{
          padding:18px 12px 80px;
        }

        .cs-admin-v7 .cs-admin-hero{
          align-items:flex-start;
          flex-direction:column;
        }

        .cs-admin-v7 .cs-admin-hero h1{
          font-size:27px;
          line-height:34px;
        }

        .cs-admin-v7 .cs-admin-hero > button{
          width:100%;
        }

        .cs-admin-v7 .cs-admin-tabs{
          top:61px;
          margin-left:-12px;
          margin-right:-12px;
          border-left:0;
          border-right:0;
          border-radius:0;
        }

        .cs-admin-v7 .cs-inline-fields{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:430px){
        .cs-admin-v7 .cs-metric-grid{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .cs-admin-v7,
        .cs-admin-v7 *,
        .cs-admin-v7 *::before,
        .cs-admin-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
