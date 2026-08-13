import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/workspace-platform-client.js";
import "../styles.css";

export default function CreditsBillingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await apiRequest("/billing/credits", { timeoutMs: 15_000 });
      setData(response);
    } catch (requestError) {
      setError(requestError?.message || "Credit balance could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setMessage("Payment returned from Safepay. Credits are added only after the verified payment webhook is received.");
    } else if (params.get("payment") === "cancelled") {
      setMessage("Credit purchase was cancelled. No credits were added.");
    }
  }, [load]);

  const activePacks = useMemo(
    () => (data?.packs || []).filter((pack) => pack.active),
    [data?.packs]
  );

  async function buy(packId) {
    setBuying(packId);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest("/billing/credits/checkout", {
        method: "POST",
        body: { packId },
        timeoutMs: 30_000,
      });
      if (!result?.checkoutUrl) throw new Error("Safepay checkout URL was not returned.");
      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      setError(requestError?.message || "Could not start Safepay checkout.");
      setBuying("");
    }
  }

  if (loading) {
    return <main className="rf-credit-page"><div className="rf-credit-loading">Loading credits and usage…</div></main>;
  }

  const wallet = data?.wallet || {};

  return (
    <main className="rf-credit-page">
      <header className="rf-credit-hero">
        <div>
          <span>ReachFly usage billing</span>
          <h1>Credits & usage</h1>
          <p>Use ReachFly as you need it. There is no subscription entitlement in this billing layer: billable features consume credits from the shared workspace wallet.</p>
        </div>
        <button type="button" onClick={() => void load()}>Refresh</button>
      </header>

      {error ? <div className="rf-credit-alert error">{error}</div> : null}
      {message ? <div className="rf-credit-alert">{message}</div> : null}

      <section className="rf-credit-metrics">
        <Metric label="Available credits" value={formatCredits(wallet.balance)} />
        <Metric label="Reserved" value={formatCredits(wallet.reserved)} note="Temporarily held while a billable job is running" />
        <Metric label="Consumed" value={formatCredits(wallet.totalConsumed)} />
        <Metric label="Purchased" value={formatCredits(wallet.totalPurchased)} />
      </section>

      <section className="rf-credit-panel">
        <div className="rf-credit-panel-head">
          <div>
            <h2>Credit top-ups</h2>
            <p>{data?.testGrantEnabled ? `Your first workspace wallet receives one test grant of ${formatCredits(data?.freeTestCredits ?? 1000)} credits. It does not renew.` : "Free test-credit grants are disabled in this environment."}</p>
          </div>
          <span className={`rf-credit-status ${data?.safepay?.configured ? "ready" : "pending"}`}>
            Safepay {data?.safepay?.configured ? data?.safepay?.environment : "not configured"}
          </span>
        </div>

        {!activePacks.length ? (
          <div className="rf-credit-empty">
            Paid credit packs are not active yet. CodeSync Labs can set the PKR/USD pack price from Platform Admin before enabling checkout.
          </div>
        ) : (
          <div className="rf-credit-packs">
            {activePacks.map((pack) => (
              <article key={pack.id} className="rf-credit-pack">
                <span>{pack.market === "PAKISTAN" ? "Pakistan" : "International"}</span>
                <h3>{formatCredits(pack.credits)} credits</h3>
                <strong>{formatMoneyMinor(pack.amountMinor, pack.currency)}</strong>
                <button
                  type="button"
                  disabled={!data?.canPurchase || buying === pack.id}
                  onClick={() => void buy(pack.id)}
                >
                  {buying === pack.id ? "Opening Safepay…" : "Buy credits"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rf-credit-panel">
        <h2>Feature rate card</h2>
        <p className="rf-credit-muted">The workspace is charged only when a billable operation is successfully delivered. Failed/degraded audit fallbacks release their reservation.</p>
        <div className="rf-credit-table-wrap">
          <table>
            <thead><tr><th>Feature</th><th>Unit</th><th>Credits / unit</th><th>How it is charged</th></tr></thead>
            <tbody>
              {(data?.rateCard || []).map((rate) => (
                <tr key={rate.feature}>
                  <td><strong>{rate.label}</strong><small>{rate.feature}</small></td>
                  <td>{rate.unit}</td>
                  <td>{rate.billable ? formatCredits(rate.creditsPerUnit) : "Free"}</td>
                  <td>{rate.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rf-credit-panel">
        <h2>Recent usage</h2>
        <div className="rf-credit-table-wrap">
          <table>
            <thead><tr><th>Feature</th><th>Quantity</th><th>Credits</th><th>Date</th></tr></thead>
            <tbody>
              {(data?.usage || []).length ? (data.usage || []).map((item) => (
                <tr key={item.id}>
                  <td>{formatFeature(item.feature)}</td>
                  <td>{formatCredits(item.quantity)} {item.unit}</td>
                  <td>{formatCredits(item.credits)}</td>
                  <td>{formatDate(item.createdAt)}</td>
                </tr>
              )) : <tr><td colSpan="4">No billable usage yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rf-credit-panel">
        <h2>Credit purchases</h2>
        <div className="rf-credit-table-wrap">
          <table>
            <thead><tr><th>Credits</th><th>Amount</th><th>Status</th><th>Provider</th><th>Date</th></tr></thead>
            <tbody>
              {(data?.purchases || []).length ? (data.purchases || []).map((item) => (
                <tr key={item.id}>
                  <td>{formatCredits(item.credits)}</td>
                  <td>{formatMoneyMinor(item.amountMinor, item.currency)}</td>
                  <td>{item.status}</td>
                  <td>Safepay</td>
                  <td>{formatDate(item.paidAt || item.createdAt)}</td>
                </tr>
              )) : <tr><td colSpan="5">No paid credit purchases yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, note }) {
  return <article className="rf-credit-metric"><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</article>;
}

function formatCredits(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatMoneyMinor(value, currency = "USD") {
  const amount = Number(value || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function formatFeature(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}
