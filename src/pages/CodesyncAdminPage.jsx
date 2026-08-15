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
        requestError?.message || "Platform admin data could not be loaded."
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
      if (successMessage) setSuccess(successMessage);
      await load({ silent: true });
    } catch (requestError) {
      setError(requestError?.message || "The admin action failed.");
      setErrorStatus(Number(requestError?.status || 0));
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
      <main className="cs-admin-page">
        <div className="cs-admin-loading">Loading platform owner dashboard…</div>
      </main>
    );
  }

  if (error && !dashboard) {
    return (
      <main className="cs-admin-page">
        <section className="cs-admin-panel cs-admin-danger-panel">
          <span>Restricted platform operations</span>
          <h1>Platform Admin</h1>
          <p>
            {errorStatus ? `HTTP ${errorStatus}: ${error}` : error}
          </p>
          <p>
            Only <strong>{PLATFORM_OWNER_EMAIL}</strong> is permitted to use this
            control plane.
          </p>
          <button type="button" onClick={() => void load()}>
            Retry platform admin
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="cs-admin-page">
      <header className="cs-admin-hero">
        <div>
          <span>CodeSync Labs · platform owner only</span>
          <h1>Platform Admin</h1>
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
          <strong>Admin action warning</strong>
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

      <nav className="cs-admin-tabs" aria-label="Platform admin sections">
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
