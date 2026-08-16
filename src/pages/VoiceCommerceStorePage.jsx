import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api/test2/frontend/api";

export default function VoiceCommerceStorePage() {
  const [commerce, setCommerce] = useState(null);
  const [billing, setBilling] = useState(null);
  const [search, setSearch] = useState({ countryCode: "US", areaCode: "", locality: "", callingMode: "both", limit: 8 });
  const [inventory, setInventory] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [commerceData, billingData] = await Promise.all([api.voiceCommerce(), api.billingCredits()]);
      setCommerce(commerceData);
      setBilling(billingData);
    } catch (requestError) {
      setError(requestError?.message || "Voice store could not be loaded.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const callPacks = billing?.aiCalling?.packs || [];
  const bundleCatalog = commerce?.bundleCatalog || [];
  const wallet = billing?.aiCalling?.wallet || {};
  const activeNumber = commerce?.activeNumber || null;
  const availableCredits = Number(wallet.balance || 0);

  const selectedInventory = useMemo(() => inventory?.items || [], [inventory]);

  async function buyCredits(pack) {
    try {
      setBusy(`pack:${pack.id}`);
      setError("");
      const response = await api.checkoutAiCallCredits({ packId: pack.id });
      if (!response?.checkoutUrl) throw new Error("Secure checkout URL was not returned.");
      window.location.assign(response.checkoutUrl);
    } catch (requestError) {
      setError(requestError?.message || "Credit checkout could not be opened.");
      setBusy("");
    }
  }

  async function findNumbers(event) {
    event?.preventDefault?.();
    try {
      setBusy("search");
      setError("");
      const response = await api.searchVoiceNumbers(search);
      setInventory(response);
    } catch (requestError) {
      setError(requestError?.message || "Business numbers could not be searched.");
    } finally {
      setBusy("");
    }
  }

  async function buyNumber(item, bundle = null) {
    if (!inventory?.quoteId) return;
    const key = bundle ? `bundle:${item.phoneNumber}:${bundle.id}` : `number:${item.phoneNumber}`;
    try {
      setBusy(key);
      setError("");
      const payload = { quoteId: inventory.quoteId, phoneNumber: item.phoneNumber };
      const response = bundle
        ? await api.checkoutVoiceBundle({ ...payload, bundleId: bundle.id })
        : await api.checkoutVoiceNumber(payload);
      if (!response?.checkoutUrl) throw new Error("Secure checkout URL was not returned.");
      window.location.assign(response.checkoutUrl);
    } catch (requestError) {
      setError(requestError?.message || "Checkout could not be opened.");
      setBusy("");
    }
  }

  return (
    <main className="rf-v6-page rf-v6-store-page">
      <header className="rf-v6-hero">
        <div>
          <span className="rf-v6-kicker">Voice store</span>
          <h1>Numbers, bundles and AI call credits in one place.</h1>
          <p>Buy only what your workspace needs. ReachFly keeps number activation and AI-call billing separate and server-controlled.</p>
          <div className="rf-v6-hero-actions"><a className="rf-v6-btn ghost" href="/app/voice-agent?tab=setup&view=connect-number">Connect existing number</a></div>
        </div>
        <div className="rf-v6-wallet-card">
          <span>AI call credits</span><strong>{Math.floor(availableCredits)}</strong><small>1 credit = 1 completed connected AI conversation</small>
          <div>{activeNumber ? <><b>Business number</b><em>{activeNumber.phoneNumber}</em></> : <><b>Business number</b><em>Not active yet</em></>}</div>
        </div>
      </header>

      {error ? <div className="rf-v6-alert error">{error}</div> : null}

      <section className="rf-v6-panel">
        <div className="rf-v6-section-head"><div><span>Top up</span><h2>AI call credits</h2><p>Standalone packs can be purchased whenever your workspace needs more connected conversations.</p></div></div>
        <div className="rf-v6-product-grid">
          {callPacks.map((pack, index) => (
            <article className={`rf-v6-product-card ${index === 1 ? "recommended" : ""}`} key={pack.id}>
              {index === 1 ? <span className="rf-v6-product-ribbon">Popular</span> : null}
              <small>{pack.label}</small><strong>{pack.credits}</strong><span>AI call credits</span><b>{money(pack.amountMinor, pack.currency)}</b>
              <button className="rf-v6-btn primary" disabled={Boolean(busy) || !billing?.aiCalling?.canPurchase} onClick={() => buyCredits(pack)}>{busy === `pack:${pack.id}` ? "Opening checkout…" : "Buy credits"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="rf-v6-panel">
        <div className="rf-v6-section-head"><div><span>Phone identity</span><h2>Choose a ReachFly business number</h2><p>Search available inventory, then buy the number only or combine it with an AI-call bundle.</p></div></div>
        <form className="rf-v6-number-search" onSubmit={findNumbers}>
          <label><span>Country</span><input value={search.countryCode} maxLength={2} onChange={(event) => setSearch((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} /></label>
          <label><span>Area code</span><input value={search.areaCode} placeholder="213" onChange={(event) => setSearch((current) => ({ ...current, areaCode: event.target.value }))} /></label>
          <label><span>City / locality</span><input value={search.locality} placeholder="Los Angeles" onChange={(event) => setSearch((current) => ({ ...current, locality: event.target.value }))} /></label>
          <label><span>Calling</span><select value={search.callingMode} onChange={(event) => setSearch((current) => ({ ...current, callingMode: event.target.value }))}><option value="both">Inbound + outbound</option><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></label>
          <button className="rf-v6-btn primary" disabled={busy === "search"} type="submit">{busy === "search" ? "Searching…" : "Find numbers"}</button>
        </form>

        {selectedInventory.length ? (
          <div className="rf-v6-number-grid">
            {selectedInventory.map((item) => (
              <article className="rf-v6-number-card" key={item.phoneNumber}>
                <div><span>Business number</span><h3>{item.phoneNumber}</h3><p>{(item.regionInformation || []).map((region) => region.name).filter(Boolean).slice(0, 2).join(" · ") || "Voice-capable local number"}</p></div>
                <div className="rf-v6-number-price"><small>Initial number activation</small><strong>{money(item.initialChargeMinor, item.currency)}</strong></div>
                <button className="rf-v6-btn secondary" disabled={Boolean(busy)} onClick={() => buyNumber(item)}>Buy number only</button>
                <div className="rf-v6-bundle-stack">
                  {bundleCatalog.map((bundle) => (
                    <button className={`rf-v6-bundle-option ${bundle.recommended ? "recommended" : ""}`} type="button" disabled={Boolean(busy)} key={bundle.id} onClick={() => buyNumber(item, bundle)}>
                      <span>{bundle.label}</span><b>{money(Number(item.initialChargeMinor || 0) + Number(bundle.callCreditAmountMinor || 0), bundle.currency || item.currency)}</b><small>Number + {bundle.credits} calls</small>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : <div className="rf-v6-empty"><strong>Search to see available business numbers.</strong><span>You can also keep your current number using the Connect existing number flow.</span></div>}

        <div className="rf-v6-commerce-note">Initial number activation is a one-time checkout in the current build. Automatic recurring customer renewal billing for future number fees is not represented as enabled until a recurring billing integration is configured and verified.</div>
      </section>
    </main>
  );
}

function money(minor = 0, currency = "USD") {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: String(currency || "USD").toUpperCase() }).format(Number(minor || 0) / 100); }
  catch { return `${currency} ${(Number(minor || 0) / 100).toFixed(2)}`; }
}
