import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../lib/workspace-platform-client.js";
import "../styles/codesync-admin.css";

const TABS = [
  ["overview", "Overview"],
  ["companies", "Companies"],
  ["individuals", "Individuals"],
  ["users", "Users"],
  ["marketing", "Marketing leads"],
  ["credits", "Credits & revenue"],
  ["activity", "Activity"],
];

export default function CodesyncAdminPage() {
  const [dashboard, setDashboard] = useState(null);
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiRequest("/platform-admin/dashboard", { timeoutMs: 20_000 });
      setDashboard(result);
    } catch (requestError) {
      setError(requestError?.message || "Platform admin data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <main className="cs-admin-page"><div className="cs-admin-loading">Loading CodeSync platform admin…</div></main>;
  if (error && !dashboard) return <Navigate to="/app/dashboard" replace />;

  const summary = dashboard?.summary || {};
  const companies = filterRows(dashboard?.companies || [], query);
  const individuals = filterRows(dashboard?.individuals || [], query);
  const users = filterUserRows(dashboard?.users || [], query);
  const marketing = filterRows(dashboard?.marketingLeads || [], query);
  const credits = dashboard?.credits || {};

  async function updateMarketing(accountId, status) {
    await apiRequest(`/platform-admin/marketing-leads/${encodeURIComponent(accountId)}`, {
      method: "PATCH",
      body: { status },
      timeoutMs: 15_000,
    });
    await load();
  }

  async function updateRate(feature, input) {
    await apiRequest(`/platform-admin/credit-rates/${encodeURIComponent(feature)}`, {
      method: "PUT",
      body: input,
      timeoutMs: 15_000,
    });
    await load();
  }

  async function updatePack(packId, input) {
    await apiRequest(`/platform-admin/credit-packs/${encodeURIComponent(packId)}`, {
      method: "PUT",
      body: input,
      timeoutMs: 15_000,
    });
    await load();
  }

  async function adjustCredits(workspaceId, input) {
    await apiRequest(`/platform-admin/credits/${encodeURIComponent(workspaceId)}/adjust`, {
      method: "POST",
      body: input,
      timeoutMs: 15_000,
    });
    await load();
  }

  return (
    <main className="cs-admin-page">
      <header className="cs-admin-hero">
        <div>
          <span>CodeSync Labs · restricted platform operations</span>
          <h1>Platform Admin</h1>
          <p>Cross-account visibility, acquisition intelligence, credit economics, AI operations and platform activity. This area is backend-restricted to CodeSync Labs owner/admin accounts.</p>
        </div>
        <button type="button" onClick={() => void load()}>Refresh</button>
      </header>

      <nav className="cs-admin-tabs">
        {TABS.map(([value, label]) => (
          <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>
        ))}
      </nav>

      {tab !== "overview" && tab !== "credits" && tab !== "activity" ? (
        <input className="cs-admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, company…" />
      ) : null}

      {tab === "overview" ? (
        <>
          <section className="cs-metric-grid">
            <Metric label="Companies" value={summary.companies} />
            <Metric label="Individuals" value={summary.individualAccounts} />
            <Metric label="Users" value={summary.users} />
            <Metric label="Leads" value={summary.leads} />
            <Metric label="Audits" value={summary.audits} note={`${summary.auditErrors || 0} errors`} />
            <Metric label="AI calls" value={summary.aiCalls} note={`${summary.aiMeetings || 0} meetings`} />
            <Metric label="Available credits" value={formatCredits(summary.totalAvailableCredits)} />
            <Metric label="Credits consumed" value={formatCredits(summary.totalConsumedCredits)} note={`${summary.successfulCreditPurchases || 0} paid top-ups`} />
          </section>
          <RevenueByCurrency values={summary.revenueByCurrency || {}} />
          <section className="cs-admin-panel">
            <h2>Credit billing health</h2>
            <p>{dashboard?.dataHealth?.note}</p>
          </section>
          <section className="cs-admin-panel">
            <h2>Recent platform activity</h2>
            <ActivityList rows={(dashboard?.activity || []).slice(0, 12)} />
          </section>
        </>
      ) : null}

      {tab === "companies" ? <AccountsTable rows={companies} /> : null}
      {tab === "individuals" ? <AccountsTable rows={individuals} /> : null}
      {tab === "users" ? <UsersTable rows={users} /> : null}
      {tab === "marketing" ? <MarketingTable rows={marketing} onStatus={updateMarketing} /> : null}
      {tab === "credits" ? (
        <CreditsPanel
          credits={credits}
          onRate={updateRate}
          onPack={updatePack}
          onAdjust={adjustCredits}
        />
      ) : null}
      {tab === "activity" ? <section className="cs-admin-panel"><ActivityList rows={dashboard?.activity || []} /></section> : null}
    </main>
  );
}

function Metric({ label, value, note }) {
  return <article className="cs-metric"><span>{label}</span><strong>{value ?? 0}</strong>{note ? <small>{note}</small> : null}</article>;
}

function RevenueByCurrency({ values }) {
  const entries = Object.entries(values || {});
  if (!entries.length) return <section className="cs-admin-panel"><h2>Paid credit revenue</h2><p>No successful paid credit purchases yet.</p></section>;
  return <section className="cs-metric-grid">{entries.map(([currency, amountMinor]) => <Metric key={currency} label={`Collected ${currency}`} value={moneyMinor(amountMinor, currency)} note="Successful Safepay credit top-ups" />)}</section>;
}

function AccountsTable({ rows }) {
  return <section className="cs-admin-panel cs-table-wrap"><table><thead><tr><th>Account</th><th>Owner</th><th>Users</th><th>Campaigns</th><th>Leads</th><th>Audits</th><th>AI calls</th><th>Last activity</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.displayName}</strong><small>{row.accountType}</small></td><td>{row.ownerName || "—"}<small>{row.ownerEmail || ""}</small></td><td>{row.users}</td><td>{row.campaigns}</td><td>{row.leads}</td><td>{row.audits}<small>{row.auditErrors ? `${row.auditErrors} errors` : ""}</small></td><td>{row.aiCalls}</td><td>{formatDate(row.lastActivityAt)}</td></tr>)}</tbody></table></section>;
}

function UsersTable({ rows }) {
  return <section className="cs-admin-panel cs-table-wrap"><table><thead><tr><th>User</th><th>Workspace</th><th>Account</th><th>Role</th><th>Status</th><th>Created</th><th>Last update</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name || "Unnamed user"}</strong><small>{row.email || ""}</small></td><td>{row.workspaceName || row.workspaceId || "—"}</td><td>{row.accountType}</td><td>{row.role}</td><td>{row.status}</td><td>{formatDate(row.createdAt)}</td><td>{formatDate(row.updatedAt)}</td></tr>)}</tbody></table></section>;
}

function MarketingTable({ rows, onStatus }) {
  return <section className="cs-admin-panel cs-table-wrap"><div className="cs-admin-note">Accounts appear here for internal review only. “Review required” does not itself mean the contact has consented to marketing. Suppression and do-not-contact states always win.</div><table><thead><tr><th>Prospect</th><th>Type</th><th>Usage</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.displayName}</strong><small>{row.ownerEmail}</small></td><td>{row.accountType}</td><td>{row.leads} leads · {row.campaigns} campaigns</td><td>{row.marketingStatus}</td><td><select value={row.marketingStatus} onChange={(e) => void onStatus(row.id, e.target.value)}><option value="review_required">Review required</option><option value="qualified">Qualified</option><option value="contacted">Contacted</option><option value="nurture">Nurture</option><option value="converted">Converted</option><option value="not_a_fit">Not a fit</option><option value="do_not_contact">Do not contact</option></select></td></tr>)}</tbody></table></section>;
}

function CreditsPanel({ credits, onRate, onPack, onAdjust }) {
  return <>
    <section className="cs-metric-grid">
      <Metric label="Available" value={formatCredits(credits.totalAvailableCredits)} />
      <Metric label="Reserved" value={formatCredits(credits.totalReservedCredits)} />
      <Metric label="Purchased" value={formatCredits(credits.totalPurchasedCredits)} />
      <Metric label="Consumed" value={formatCredits(credits.totalConsumedCredits)} note={`${credits.walletsWithDebt || 0} wallets with credit debt`} />
    </section>
    <RevenueByCurrency values={credits.revenueByCurrency || {}} />
    <section className="cs-admin-panel">
      <h2>Usage rate card</h2>
      <p>These values control how many workspace credits each billable feature consumes. Changes apply centrally; do not scatter pricing constants through feature code.</p>
      <div className="cs-table-wrap"><table><thead><tr><th>Feature</th><th>Unit</th><th>Credits / unit</th><th>Billable</th><th>Save</th></tr></thead><tbody>{(credits.rateCard || []).map((rate) => <RateRow key={rate.feature} rate={rate} onSave={onRate} />)}</tbody></table></div>
    </section>
    <section className="cs-admin-panel">
      <h2>Safepay credit packs</h2>
      <p>{credits.testGrantEnabled ? `${formatCredits(credits.freeTestCredits ?? 1000)} test credits are granted once per workspace in this environment.` : "Test-credit grants are disabled in this environment."} Paid packs stay disabled until you set a real sandbox/live price and explicitly activate them.</p>
      <div className="cs-table-wrap"><table><thead><tr><th>Pack</th><th>Market</th><th>Credits</th><th>Price</th><th>Active</th><th>Save</th></tr></thead><tbody>{(credits.packs || []).map((pack) => <PackRow key={pack.id} pack={pack} onSave={onPack} />)}</tbody></table></div>
    </section>
    <section className="cs-admin-panel">
      <h2>Workspace credit wallets</h2>
      <div className="cs-table-wrap"><table><thead><tr><th>Account</th><th>Available</th><th>Reserved</th><th>Consumed</th><th>Purchased</th><th>Manual adjustment</th></tr></thead><tbody>{(credits.wallets || []).map((wallet) => <WalletRow key={wallet.workspaceId} wallet={wallet} onAdjust={onAdjust} />)}</tbody></table></div>
    </section>
    <section className="cs-admin-panel">
      <h2>Usage by feature</h2>
      <div className="cs-table-wrap"><table><thead><tr><th>Feature</th><th>Quantity</th><th>Credits consumed</th></tr></thead><tbody>{(credits.usageByFeature || []).length ? (credits.usageByFeature || []).map((row) => <tr key={row.feature}><td>{formatFeature(row.feature)}</td><td>{formatCredits(row.quantity)}</td><td>{formatCredits(row.credits)}</td></tr>) : <tr><td colSpan="3">No billable usage yet.</td></tr>}</tbody></table></div>
    </section>
    <section className="cs-admin-panel">
      <h2>Recent paid top-ups</h2>
      <div className="cs-table-wrap"><table><thead><tr><th>Account</th><th>Credits</th><th>Amount</th><th>Status</th><th>Tracker</th><th>Date</th></tr></thead><tbody>{(credits.purchases || []).length ? (credits.purchases || []).map((row) => <tr key={row.id}><td>{row.accountName || row.workspaceId}</td><td>{formatCredits(row.credits)}</td><td>{moneyMinor(row.amountMinor, row.currency)}</td><td>{row.status}</td><td>{row.providerTracker || "—"}</td><td>{formatDate(row.paidAt || row.createdAt)}</td></tr>) : <tr><td colSpan="6">No paid top-ups yet.</td></tr>}</tbody></table></div>
    </section>
  </>;
}

function RateRow({ rate, onSave }) {
  const [credits, setCredits] = useState(String(rate.creditsPerUnit ?? 0));
  const [billable, setBillable] = useState(rate.billable !== false);
  return <tr><td><strong>{rate.label}</strong><small>{rate.feature}</small></td><td>{rate.unit}</td><td><input type="number" min="0" step="0.001" value={credits} onChange={(e) => setCredits(e.target.value)} /></td><td><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /></td><td><button type="button" onClick={() => void onSave(rate.feature, { creditsPerUnit: Number(credits), billable })}>Save</button></td></tr>;
}

function PackRow({ pack, onSave }) {
  const [credits, setCredits] = useState(String(pack.credits || 0));
  const [amountMajor, setAmountMajor] = useState(pack.amountMinor ? String(Number(pack.amountMinor) / 100) : "");
  const [active, setActive] = useState(Boolean(pack.active));
  return <tr><td><strong>{pack.label || pack.id}</strong><small>{pack.id}</small></td><td>{pack.market}<small>{pack.currency}</small></td><td><input type="number" min="1" step="1" value={credits} onChange={(e) => setCredits(e.target.value)} /></td><td><input type="number" min="0" step="0.01" placeholder={`Price in ${pack.currency}`} value={amountMajor} onChange={(e) => setAmountMajor(e.target.value)} /><small>{pack.amountMinor ? moneyMinor(pack.amountMinor, pack.currency) : "Not priced"}</small></td><td><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /></td><td><button type="button" onClick={() => void onSave(pack.id, { credits: Number(credits), amountMinor: amountMajor ? Math.round(Number(amountMajor) * 100) : null, active, currency: pack.currency, market: pack.market })}>Save</button></td></tr>;
}

function WalletRow({ wallet, onAdjust }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  return <tr><td><strong>{wallet.accountName || wallet.workspaceId}</strong><small>{wallet.workspaceId}</small></td><td>{formatCredits(wallet.balance)}</td><td>{formatCredits(wallet.reserved)}</td><td>{formatCredits(wallet.totalConsumed)}</td><td>{formatCredits(wallet.totalPurchased)}</td><td><div className="cs-credit-adjust"><input type="number" step="1" placeholder="+/- credits" value={delta} onChange={(e) => setDelta(e.target.value)} /><input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} /><button type="button" disabled={!Number(delta) || !reason.trim()} onClick={() => { void onAdjust(wallet.workspaceId, { delta: Number(delta), reason }); setDelta(""); setReason(""); }}>Apply</button></div></td></tr>;
}

function ActivityList({ rows }) {
  return <div className="cs-activity-list">{rows.map((row) => <article key={row.id}><div><strong>{row.title}</strong><small>{row.accountName || row.source}</small></div><time>{formatDate(row.createdAt)}</time></article>)}</div>;
}

function filterRows(rows, query) {
  const value = query.trim().toLowerCase();
  if (!value) return rows;
  return rows.filter((row) => [row.displayName, row.ownerName, row.ownerEmail, row.companyName].filter(Boolean).join(" ").toLowerCase().includes(value));
}

function filterUserRows(rows, query) {
  const value = query.trim().toLowerCase();
  if (!value) return rows;
  return rows.filter((row) => [row.name, row.email, row.workspaceName, row.role].filter(Boolean).join(" ").toLowerCase().includes(value));
}

function formatCredits(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function moneyMinor(amountMinor, currency = "USD") {
  const value = Number(amountMinor || 0) / 100;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(value); }
  catch { return `${currency || "USD"} ${value.toFixed(2)}`; }
}

function formatFeature(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}
