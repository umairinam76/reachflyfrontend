import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Phone,
  RefreshCw,
  Shield,
  Sparkles,
} from "../components/icons";

import { Link } from "react-router-dom";
import { apiRequest } from "../lib/workspace-platform-client.js";

const PAYMENT_REFRESH_DELAYS_MS = [1500, 3500, 7000];
const QUICK_AMOUNTS = [100, 500, 1000, 2500, 5000, 10000];

const BUNDLES = [
  {
    id: "launch",
    name: "Launch",
    credits: 1000,
    numberSlots: 1,
    eyebrow: "Start simple",
    description:
      "A clean starting balance for a new workspace.",
    valueLabel: "Standard rate",
  },
  {
    id: "growth",
    name: "Growth",
    credits: 2500,
    numberSlots: 1,
    eyebrow: "Most popular",
    description:
      "More room for an active team with a better per-credit rate.",
    valueLabel: "25% lower / credit",
    recommended: true,
  },
  {
    id: "scale",
    name: "Scale",
    credits: 5000,
    numberSlots: 3,
    eyebrow: "Best value",
    description:
      "Maximum value for teams running ReachFly every day.",
    valueLabel: "50% lower / credit",
    scaleValue: true,
  },
];

export default function CreditsBillingPage() {
  const mountedRef = useRef(true);

  const [data, setData] = useState(null);
  const [commerce, setCommerce] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buying, setBuying] = useState("");
  const [customCredits, setCustomCredits] = useState(100);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async ({ background = false, successToast = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const [billingResult, commerceResult] = await Promise.allSettled([
        apiRequest("/billing/credits", { timeoutMs: 20_000 }),
        apiRequest("/voice-commerce", { timeoutMs: 20_000 }),
      ]);

      if (!mountedRef.current) return null;

      if (billingResult.status === "fulfilled") {
        setData(billingResult.value || {});
        setError("");
        if (successToast) {
          notify("success", "Credits refreshed", "Your latest ReachFly balance and usage are visible.");
        }
      } else {
        const text = safeMessage(
          billingResult.reason?.message || "Credits and usage could not be loaded."
        );
        setError(text);
        if (successToast) notify("error", "Refresh failed", text);
      }

      setCommerce(
        commerceResult.status === "fulfilled"
          ? commerceResult.value || {}
          : null
      );

      return billingResult.status === "fulfilled" ? billingResult.value : null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const timers = [];

    async function initialize() {
      await load();
      if (disposed) return;

      const params = new URLSearchParams(window.location.search);
      const paymentState = params.get("payment");

      if (paymentState === "success") {
        setMessage(
          "Payment returned successfully. ReachFly is verifying it before adding credits to your shared workspace balance."
        );
        notify(
          "info",
          "Verifying payment",
          "Your shared balance will refresh automatically after settlement."
        );

        PAYMENT_REFRESH_DELAYS_MS.forEach((delay) => {
          timers.push(
            window.setTimeout(() => {
              if (!disposed) void load({ background: true });
            }, delay)
          );
        });

        clearPaymentQuery();
      } else if (paymentState === "cancelled") {
        setMessage("Credit purchase was cancelled. No credits were added.");
        notify("warning", "Purchase cancelled", "No ReachFly credits were added.");
        clearPaymentQuery();
      }
    }

    void initialize();

    return () => {
      disposed = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [load]);

  const wallet =
    data?.wallet && typeof data.wallet === "object"
      ? data.wallet
      : {};

  const pricing =
    data?.creditPricing && typeof data.creditPricing === "object"
      ? data.creditPricing
      : {};

  const generalUsage = useMemo(
    () => normalizeCollection(data?.usage),
    [data?.usage]
  );

  const legacyAiUsage = useMemo(
    () => normalizeCollection(data?.aiCalling?.usage),
    [data?.aiCalling?.usage]
  );

  const usage = useMemo(
    () =>
      [
        ...generalUsage,
        ...legacyAiUsage.map((item) => ({
          ...item,
          feature: item.feature || "ai_connected_call",
          unit: item.unit || "connected_call",
        })),
      ].sort(byNewest),
    [generalUsage, legacyAiUsage]
  );

  const purchases = useMemo(
    () => normalizeCollection(data?.purchases).sort(byNewest),
    [data?.purchases]
  );

  const rateMap = useMemo(() => {
    const map = new Map();
    normalizeCollection(data?.rateCard).forEach((rate) => {
      map.set(normalizeStatus(rate.feature), rate);
    });
    return map;
  }, [data?.rateCard]);

  const activeNumbers = useMemo(
    () =>
      normalizeCollection(commerce?.numbers).filter(
        (number) => normalizeStatus(number.status) === "active"
      ),
    [commerce?.numbers]
  );

  const balance = Number(wallet.balance || 0);
  const used =
    Number(wallet.totalConsumed || 0) +
    Number(data?.legacyAiConsumed || 0);
  const reserved = Number(wallet.reserved || 0);

  const currency = String(pricing.currency || "USD").trim().toUpperCase();
  const minPurchase = positiveInteger(pricing.minPurchase, 100);
  const maxPurchase = positiveInteger(pricing.maxPurchase, 100000);
  const safeCustomCredits = Math.max(
    minPurchase,
    Math.min(maxPurchase, Math.round(Number(customCredits) || minPurchase))
  );

  const pricingTiers = normalizePricingTiers(pricing);
  const standardUnitPriceMinor = positiveInteger(
    pricing.standardUnitPriceMinor ||
      pricing.regularUnitPriceMinor ||
      pricingTiers[0]?.unitPriceMinor,
    4
  );
  const customQuote = quoteCreditPurchase(
    safeCustomCredits,
    pricing,
    pricingTiers
  );
  const maximumSavingsPercent = Math.max(
    0,
    ...pricingTiers.map((tier) => Number(tier.discountPercent || 0))
  );

  const callingRate =
    rateMap.get("ai_connected_call") ||
    {
      creditsPerUnit: 10,
      unit: "connected_minute",
    };

  const canPurchase = Boolean(data?.canPurchase);
  const secureCheckoutReady = Boolean(data?.safepay?.configured);

  const purposes = [
    {
      icon: "◎",
      title: "Find prospects",
      value: rateLabel(rateMap.get("lead_generated"), "1 credit / lead"),
      text: "Build fresh prospect lists from the same balance.",
    },
    {
      icon: "☎",
      title: "AI calling",
      value: rateLabel(callingRate, "10 credits / connected minute"),
      text: "Inbound and outbound connected time uses the same credits.",
    },
    {
      icon: "✉",
      title: "Email outreach",
      value: "Included in the same workspace",
      text: "Keep outreach connected without buying another wallet.",
    },
    {
      icon: "◇",
      title: "Audits & research",
      value: "Credits used by workload",
      text: "Run workspace research and audit actions from one balance.",
    },
    {
      icon: "✦",
      title: "ReachFly AI",
      value: rateLabel(rateMap.get("reachfly_ai_message"), "2 credits / response"),
      text: "Use the same credits for assisted workflows.",
    },
  ];

  async function buyCredits(credits, source = "custom") {
    if (buying || !canPurchase || !secureCheckoutReady) return;

    const quantity = Math.max(
      minPurchase,
      Math.min(maxPurchase, Math.round(Number(credits) || minPurchase))
    );
    const busyKey = `${source}:${quantity}`;

    setBuying(busyKey);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/billing/credits/checkout", {
        method: "POST",
        body: {
          credits: quantity,
          source,
        },
        timeoutMs: 30_000,
      });

      if (!result?.checkoutUrl || !/^https?:\/\//i.test(result.checkoutUrl)) {
        throw new Error("Secure checkout could not be opened.");
      }

      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      const text = safeMessage(
        requestError?.message || "Could not start credit checkout."
      );
      setError(text);
      setBuying("");
      notify("error", "Checkout unavailable", text);
    }
  }

  if (loading) {
    return (
      <>
        <BillingStyles />
        <BillingSkeleton />
      </>
    );
  }

  return (
    <>
      <BillingStyles />

      <main className="rf-unified-billing">
        <header className="rfub-header">
          <div>
            <div className="rfub-title-row">
              <span className="rfub-kicker">Workspace billing</span>
              <span className="rfub-one-wallet">
                <CheckCircle2 size={12} />
                One shared balance
              </span>
            </div>

            <h1>Simple pricing. One ReachFly balance.</h1>
            <p>
              Buy credits once and use them anywhere your workspace needs them.
              No separate balances, no confusing add-ons, and no hidden pricing layers.
            </p>
          </div>

          <button
            type="button"
            className="rfub-btn secondary"
            disabled={refreshing}
            onClick={() => void load({ background: true, successToast: true })}
          >
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            Refresh
          </button>
        </header>

        {error ? (
          <Notice tone="error" title="Billing needs attention">
            {error}
          </Notice>
        ) : null}

        {message ? (
          <Notice tone="info" title="Payment update">
            {message}
          </Notice>
        ) : null}

        <section className="rfub-hero">
          <div className="rfub-balance-panel">
            <div className="rfub-balance-icon">
              <Sparkles size={25} />
            </div>

            <div className="rfub-balance-copy">
              <span>Available ReachFly credits</span>
              <strong>{formatCredits(balance)}</strong>
              <small>
                {reserved > 0
                  ? `${formatCredits(reserved)} currently reserved`
                  : "Ready to use across your workspace"}
              </small>
            </div>

            <div className="rfub-balance-stats">
              <div>
                <span>Used</span>
                <b>{formatCredits(used)}</b>
              </div>
              <div>
                <span>Active numbers</span>
                <b>{activeNumbers.length}</b>
              </div>
            </div>
          </div>

          <div className="rfub-sale-panel">
            <span className="rfub-sale-badge">
              Save up to {maximumSavingsPercent}%
            </span>
            <small>Volume value</small>
            <strong>
              {formatMoneyMinor(
                pricingTiers[pricingTiers.length - 1]?.unitPriceMinor || 2,
                currency
              )}
              <em>/ credit</em>
            </strong>
            <p>
              Best rate at {formatCredits(
                pricingTiers[pricingTiers.length - 1]?.minCredits || 5000
              )}+ credits. Standard rate{" "}
              {formatMoneyMinor(standardUnitPriceMinor, currency)} / credit.
            </p>
            <a className="rfub-btn light" href="#buy-credits">
              Buy credits
              <ChevronRight size={13} />
            </a>
          </div>
        </section>

        <section className="rfub-purpose-section">
          <SectionHeading
            eyebrow="One balance"
            title="Use your credits across ReachFly"
            text="Your workspace keeps one credit balance. Use it where you need it without purchasing separate credit types."
          />

          <div className="rfub-purpose-grid">
            {purposes.map((item) => (
              <article className="rfub-purpose-card" key={item.title}>
                <span className="rfub-purpose-icon">{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <b>{item.value}</b>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rfub-bundle-section">
          <SectionHeading
            eyebrow="Recommended bundles"
            title="Choose the balance that fits your workspace"
            text="Start at the standard rate, save more as you buy more, and get 50% lower cost per credit on the Scale tier."
            action={
              <Link className="rfub-inline-link" to="/app/phone-numbers">
                Business numbers
                <ChevronRight size={13} />
              </Link>
            }
          />

          <div className="rfub-bundle-grid">
            {BUNDLES.map((bundle) => {
              const quote = quoteCreditPurchase(
                bundle.credits,
                pricing,
                pricingTiers
              );
              const standardAmount =
                bundle.credits *
                standardUnitPriceMinor;
              const busyKey = `bundle-${bundle.id}:${bundle.credits}`;

              return (
                <article
                  key={bundle.id}
                  className={`rfub-bundle-card ${
                    bundle.recommended ? "recommended" : ""
                  } ${bundle.scaleValue ? "scale-value" : ""}`}
                >
                  {bundle.scaleValue ? (
                    <div className="rfub-discount-ribbon">
                      50% OFF / CREDIT
                    </div>
                  ) : null}

                  {bundle.recommended ? (
                    <span className="rfub-popular">Most popular</span>
                  ) : null}

                  <div className="rfub-bundle-top">
                    <span>{bundle.eyebrow}</span>
                    <h3>{bundle.name}</h3>
                    <p>{bundle.description}</p>
                  </div>

                  <div className="rfub-bundle-price">
                    {quote.discountPercent > 0 ? (
                      <s>{formatMoneyMinor(standardAmount, currency)}</s>
                    ) : (
                      <small className="rfub-standard-label">
                        Standard price
                      </small>
                    )}
                    <strong>{formatMoneyMinor(quote.amountMinor, currency)}</strong>
                    <small>
                      {formatMoneyMinor(quote.unitPriceMinor, currency)} / credit ·{" "}
                      {bundle.valueLabel}
                    </small>
                  </div>

                  <ul className="rfub-bundle-features">
                    <li>
                      <CheckCircle2 size={14} />
                      <span>
                        <b>{formatCredits(bundle.credits)}</b> ReachFly credits
                      </span>
                    </li>
                    <li>
                      <Phone size={14} />
                      <span>
                        {bundle.numberSlots === 1
                          ? "Ready for 1 business number"
                          : `Ready for up to ${bundle.numberSlots} business numbers`}
                      </span>
                    </li>
                    <li>
                      <CheckCircle2 size={14} />
                      <span>
                        AI calling at{" "}
                        <b>{formatCredits(callingRate.creditsPerUnit || 10)}</b>{" "}
                        credits / connected minute
                      </span>
                    </li>
                    <li>
                      <CheckCircle2 size={14} />
                      <span>One balance across the workspace</span>
                    </li>
                  </ul>

                  <button
                    type="button"
                    className="rfub-btn primary full"
                    disabled={Boolean(buying) || !canPurchase || !secureCheckoutReady}
                    onClick={() =>
                      void buyCredits(bundle.credits, `bundle-${bundle.id}`)
                    }
                  >
                    {buying === busyKey ? "Opening checkout…" : `Buy ${bundle.name}`}
                  </button>

                  <Link className="rfub-number-link" to="/app/phone-numbers">
                    <Phone size={13} />
                    Choose business number
                    <ChevronRight size={12} />
                  </Link>

                  <small className="rfub-carrier-note">
                    Number activation pricing is shown before checkout.
                  </small>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rfub-buy-section" id="buy-credits">
          <div className="rfub-custom-card">
            <div className="rfub-custom-copy">
              <span className="rfub-kicker">Flexible top-up</span>
              <h2>Buy 100 credits — or choose any amount you need.</h2>
              <p>
                Your price updates automatically by volume. The standard rate
                stays unchanged, with better value at larger credit amounts.
              </p>

              <div className="rfub-quick-amounts">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    type="button"
                    className={safeCustomCredits === amount ? "active" : ""}
                    onClick={() => setCustomCredits(amount)}
                    key={amount}
                  >
                    {formatCredits(amount)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rfub-custom-checkout">
              <label>
                <span>Credits</span>
                <div className="rfub-credit-input">
                  <Sparkles size={17} />
                  <input
                    type="number"
                    min={minPurchase}
                    max={maxPurchase}
                    step="1"
                    value={customCredits}
                    onChange={(event) => setCustomCredits(event.target.value)}
                  />
                </div>
                <small>
                  Minimum {formatCredits(minPurchase)} · Maximum{" "}
                  {formatCredits(maxPurchase)}
                </small>
              </label>

              <div className="rfub-custom-price">
                <div>
                  <span>Your rate</span>
                  <strong>
                    {formatMoneyMinor(customQuote.unitPriceMinor, currency)}
                    <small>/ credit</small>
                  </strong>
                </div>

                <div className="sale">
                  <span>Total</span>
                  <strong>
                    {formatMoneyMinor(customQuote.amountMinor, currency)}
                  </strong>
                </div>

                <div className="rfub-savings-cell">
                  <span>Value</span>
                  <strong>
                    {customQuote.discountPercent > 0
                      ? `${customQuote.discountPercent}% lower / credit`
                      : "Standard rate"}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="rfub-btn primary full large"
                disabled={Boolean(buying) || !canPurchase || !secureCheckoutReady}
                onClick={() => void buyCredits(safeCustomCredits, "custom")}
              >
                {buying === `custom:${safeCustomCredits}`
                  ? "Opening secure checkout…"
                  : `Buy ${formatCredits(safeCustomCredits)} credits`}
              </button>

              <p className="rfub-secure-line">
                <Shield size={13} />
                Secure checkout opens separately. Card details are not entered on this page.
              </p>
            </div>
          </div>
        </section>

        <section className="rfub-lower-grid">
          <Panel
            eyebrow="Usage"
            title="Recent credit activity"
            icon={<Clock3 size={17} />}
          >
            <UsageList items={usage} />
          </Panel>

          <Panel
            eyebrow="Workspace"
            title="Business numbers"
            icon={<Phone size={17} />}
          >
            {activeNumbers.length ? (
              <div className="rfub-number-list">
                {activeNumbers.slice(0, 4).map((number, index) => (
                  <div key={number.id || number.phoneNumber || index}>
                    <span>
                      <Phone size={13} />
                    </span>
                    <div>
                      <strong>{formatPhone(number.phoneNumber)}</strong>
                      <small>{formatCallingMode(number.callingMode)}</small>
                    </div>
                    <em>Active</em>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Building2 size={20} />}
                title="No business number yet"
                text="Choose a real ReachFly-managed number when you are ready to activate AI calling."
              />
            )}

            <Link className="rfub-btn secondary full" to="/app/phone-numbers">
              <Phone size={14} />
              {activeNumbers.length ? "Manage numbers" : "Choose a number"}
              <ChevronRight size={13} />
            </Link>
          </Panel>

          <Panel
            eyebrow="Purchases"
            title="Recent top-ups"
            icon={<ExternalLink size={17} />}
          >
            <PurchaseList items={purchases} />
          </Panel>
        </section>

        <section className="rfub-clarity">
          <div className="rfub-clarity-icon">
            <Shield size={19} />
          </div>
          <div>
            <strong>One balance. Clear usage.</strong>
            <p>
              Every metered workspace action draws from the same ReachFly credit balance.
              Business-number activation remains separate and is always shown before checkout.
            </p>
          </div>
          <Link to="/app/calls" className="rfub-inline-link">
            Open call logs
            <ChevronRight size={12} />
          </Link>
        </section>
      </main>
    </>
  );
}

function SectionHeading({ eyebrow, title, text, action = null }) {
  return (
    <header className="rfub-section-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {action}
    </header>
  );
}

function Panel({ eyebrow, title, icon, children }) {
  return (
    <article className="rfub-panel">
      <header className="rfub-panel-head">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {icon}
      </header>
      {children}
    </article>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="rfub-empty compact">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function UsageList({ items = [] }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={<Bot size={18} />}
        title="No usage yet"
        text="Your recent ReachFly credit usage will appear here."
      />
    );
  }

  return (
    <div className="rfub-activity-list">
      {items.slice(0, 7).map((item, index) => {
        const feature = normalizeStatus(item.feature || item.type);

        return (
          <div key={item.id || `${feature}-${index}`}>
            <span className="rfub-activity-icon">{featureIcon(feature)}</span>
            <div>
              <strong>{featureLabel(feature)}</strong>
              <small>{formatShortDate(item.createdAt)}</small>
            </div>
            <b>
              -{formatCredits(Number(item.credits || item.creditsConsumed || 1))}
            </b>
          </div>
        );
      })}
    </div>
  );
}

function PurchaseList({ items = [] }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={<Sparkles size={18} />}
        title="No paid top-ups yet"
        text="Verified ReachFly credit purchases will appear here."
      />
    );
  }

  return (
    <div className="rfub-activity-list">
      {items.slice(0, 7).map((item, index) => (
        <div key={item.id || index}>
          <span className="rfub-activity-icon purchase">+</span>
          <div>
            <strong>{formatCredits(item.credits)} credits</strong>
            <small>
              {formatShortDate(item.paidAt || item.createdAt)} ·{" "}
              {humanize(item.status)}
            </small>
          </div>
          <b className="positive">
            {Number(item.amountMinor || 0) > 0
              ? formatMoneyMinor(item.amountMinor, item.currency)
              : ""}
          </b>
        </div>
      ))}
    </div>
  );
}

function Notice({ tone = "info", title, children }) {
  return (
    <section className={`rfub-notice ${tone}`}>
      <span>{tone === "error" ? "!" : "i"}</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </section>
  );
}

function BillingSkeleton() {
  return (
    <main className="rf-unified-billing">
      <div className="rfub-skeleton head" />
      <div className="rfub-skeleton hero" />
      <div className="rfub-skeleton cards" />
      <div className="rfub-skeleton wide" />
    </main>
  );
}

function BillingStyles() {
  return (
    <style>{`
      .rf-unified-billing,.rf-unified-billing *,.rf-unified-billing *::before,.rf-unified-billing *::after{box-sizing:border-box}
      .rf-unified-billing{width:100%;max-width:1560px;margin:0 auto;padding:6px 4px 40px;color:#1f2230;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .rfub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:18px}
      .rfub-title-row{display:flex;align-items:center;gap:9px;margin-bottom:7px}
      .rfub-kicker,.rfub-section-heading>div>span,.rfub-panel-head>div>span{color:#6d6f7c;font-size:10px;line-height:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .rfub-one-wallet{min-height:24px;display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border:1px solid rgba(72,75,211,.14);border-radius:999px;color:#4d50d6;background:#f3f3ff;font-size:9px;font-weight:750}
      .rfub-header h1{max-width:820px;margin:0;color:#171a24;font-family:Geist,Inter,sans-serif;font-size:clamp(28px,3vw,42px);line-height:1.08;letter-spacing:-.035em;font-weight:700}
      .rfub-header p{max-width:820px;margin:9px 0 0;color:#6d6d79;font-size:13px;line-height:20px}
      .rfub-btn{min-height:38px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 13px;border:0;border-radius:9px;outline:0;text-decoration:none;font:inherit;font-size:10px;line-height:14px;font-weight:750;cursor:pointer;transition:transform 150ms ease,box-shadow 150ms ease,background 150ms ease,border-color 150ms ease}
      .rfub-btn:hover:not(:disabled){transform:translateY(-1px)}
      .rfub-btn:disabled{opacity:.55;cursor:not-allowed}
      .rfub-btn.primary{color:#fff;background:linear-gradient(135deg,#5558e9 0%,#7f55e7 55%,#b552d8 100%);box-shadow:0 8px 20px rgba(84,86,224,.18)}
      .rfub-btn.primary:hover:not(:disabled){box-shadow:0 12px 26px rgba(84,86,224,.24)}
      .rfub-btn.secondary{color:#444752;border:1px solid #e0e1e6;background:#fff}
      .rfub-btn.light{color:#494cd2;border:1px solid rgba(73,76,210,.14);background:#f7f7ff}
      .rfub-btn.full{width:100%}.rfub-btn.large{min-height:46px;font-size:12px}
      .rfub-notice{display:flex;align-items:flex-start;gap:10px;margin:0 0 16px;padding:11px 13px;border:1px solid #dfe1e6;border-radius:10px;background:#fff}
      .rfub-notice>span{width:26px;height:26px;flex:0 0 26px;display:grid;place-items:center;border-radius:8px;color:#5557d9;background:#eeeeff;font-size:11px;font-weight:800}
      .rfub-notice.error{border-color:#f1d2d0;background:#fffafa}.rfub-notice.error>span{color:#b63737;background:#ffeded}
      .rfub-notice strong,.rfub-notice p{display:block}.rfub-notice strong{font-size:11px}.rfub-notice p{margin:2px 0 0;color:#72727e;font-size:10px;line-height:15px}
      .rfub-hero{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;margin-bottom:16px}
      .rfub-balance-panel,.rfub-sale-panel{position:relative;overflow:hidden;border-radius:16px}
      .rfub-balance-panel{min-height:180px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:18px;padding:25px;color:#fff;background:radial-gradient(circle at 90% 10%,rgba(255,255,255,.18),transparent 35%),radial-gradient(circle at 25% 110%,rgba(200,111,255,.42),transparent 42%),linear-gradient(135deg,#373ac8 0%,#5752df 48%,#8154df 100%);box-shadow:0 16px 36px rgba(66,67,184,.19)}
      .rfub-balance-panel::after{content:"";position:absolute;inset:auto -45px -75px auto;width:190px;height:190px;border:1px solid rgba(255,255,255,.15);border-radius:50%}
      .rfub-balance-icon{width:56px;height:56px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.2);border-radius:15px;background:rgba(255,255,255,.13);backdrop-filter:blur(12px)}
      .rfub-balance-copy>span,.rfub-balance-copy>strong,.rfub-balance-copy>small{display:block}
      .rfub-balance-copy>span{color:rgba(255,255,255,.78);font-size:10px;font-weight:720;letter-spacing:.04em;text-transform:uppercase}
      .rfub-balance-copy>strong{margin-top:3px;font-family:Geist,Inter,sans-serif;font-size:clamp(38px,5vw,62px);line-height:1;letter-spacing:-.04em}
      .rfub-balance-copy>small{margin-top:7px;color:rgba(255,255,255,.78);font-size:10px}
      .rfub-balance-stats{position:relative;z-index:2;display:grid;grid-template-columns:repeat(2,minmax(92px,1fr));overflow:hidden;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.1);backdrop-filter:blur(12px)}
      .rfub-balance-stats>div{min-width:96px;padding:11px 13px}.rfub-balance-stats>div+div{border-left:1px solid rgba(255,255,255,.15)}
      .rfub-balance-stats span,.rfub-balance-stats b{display:block}.rfub-balance-stats span{color:rgba(255,255,255,.66);font-size:8px;font-weight:700;text-transform:uppercase}.rfub-balance-stats b{margin-top:2px;color:#fff;font-size:14px}
      .rfub-sale-panel{min-height:180px;padding:22px;border:1px solid #e5e2f5;background:radial-gradient(circle at 100% 0,rgba(147,96,255,.15),transparent 44%),linear-gradient(180deg,#fff 0%,#faf9ff 100%);box-shadow:0 12px 28px rgba(45,47,83,.06)}
      .rfub-sale-badge,.rfub-discount-ribbon{display:inline-flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#ff675f,#f13f78);font-weight:820;letter-spacing:.03em}
      .rfub-sale-badge{min-height:25px;padding:4px 9px;border-radius:999px;font-size:9px}
      .rfub-sale-panel>small{display:block;margin-top:13px;color:#777381;font-size:9px;font-weight:750;text-transform:uppercase}
      .rfub-sale-panel>strong{display:flex;align-items:baseline;gap:4px;margin-top:2px;color:#252735;font-family:Geist,Inter,sans-serif;font-size:27px;letter-spacing:-.03em}
      .rfub-sale-panel>strong em{color:#807e8b;font-size:10px;font-style:normal;font-weight:650}.rfub-sale-panel>p{margin:3px 0 14px;color:#777684;font-size:9px}
      .rfub-purpose-section,.rfub-bundle-section,.rfub-buy-section{margin-top:21px}
      .rfub-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:12px}
      .rfub-section-heading h2{margin:3px 0 0;color:#242631;font-family:Geist,Inter,sans-serif;font-size:19px;line-height:25px;letter-spacing:-.02em}
      .rfub-section-heading p{max-width:760px;margin:4px 0 0;color:#747480;font-size:10px;line-height:16px}
      .rfub-inline-link,.rfub-number-link{display:inline-flex;align-items:center;gap:5px;color:#5053d7;text-decoration:none;font-size:9px;font-weight:750}
      .rfub-purpose-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}
      .rfub-purpose-card{min-width:0;display:flex;align-items:flex-start;gap:10px;padding:13px;border:1px solid #e7e8ec;border-radius:12px;background:#fff;box-shadow:0 5px 15px rgba(25,28,45,.035)}
      .rfub-purpose-icon{width:31px;height:31px;flex:0 0 31px;display:grid;place-items:center;border-radius:9px;color:#5456d7;background:#f0f0ff;font-size:13px;font-weight:800}
      .rfub-purpose-card strong,.rfub-purpose-card b{display:block}.rfub-purpose-card strong{color:#30323d;font-size:10px}.rfub-purpose-card b{margin-top:2px;color:#5355d7;font-size:9px}.rfub-purpose-card p{margin:4px 0 0;color:#85838f;font-size:8px;line-height:13px}
      .rfub-bundle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .rfub-bundle-card{position:relative;overflow:hidden;padding:19px;border:1px solid #e4e5ea;border-radius:16px;background:radial-gradient(circle at 100% 0,rgba(99,101,238,.07),transparent 38%),#fff;box-shadow:0 10px 28px rgba(25,27,52,.055);transition:transform 160ms ease,box-shadow 160ms ease,border-color 160ms ease}
      .rfub-bundle-card:hover{transform:translateY(-2px);border-color:#d7d6ef;box-shadow:0 16px 34px rgba(25,27,52,.08)}.rfub-bundle-card.recommended{border-color:rgba(85,88,232,.42);box-shadow:0 15px 36px rgba(81,83,211,.12)}
      .rfub-discount-ribbon{position:absolute;top:13px;right:-29px;width:110px;min-height:22px;transform:rotate(38deg);font-size:8px}
      .rfub-popular{position:absolute;top:15px;left:19px;min-height:22px;display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;color:#5254d4;background:#eeeeff;font-size:8px;font-weight:780}
      .rfub-bundle-top{padding-top:24px}.rfub-bundle-card:not(.recommended) .rfub-bundle-top{padding-top:8px}
      .rfub-bundle-top>span{color:#7c7b87;font-size:8px;font-weight:750;letter-spacing:.06em;text-transform:uppercase}.rfub-bundle-top h3{margin:4px 0 0;color:#252733;font-family:Geist,Inter,sans-serif;font-size:20px;letter-spacing:-.025em}.rfub-bundle-top p{min-height:44px;margin:5px 0 0;color:#777682;font-size:9px;line-height:14px}
      .rfub-bundle-price{margin-top:13px;padding:12px 0;border-top:1px solid #eeeef2;border-bottom:1px solid #eeeef2}.rfub-bundle-price s,.rfub-bundle-price strong,.rfub-bundle-price small{display:block}.rfub-bundle-price s{color:#9a99a3;font-size:9px}.rfub-bundle-price strong{margin-top:1px;color:#292b36;font-family:Geist,Inter,sans-serif;font-size:27px;line-height:31px;letter-spacing:-.03em}.rfub-bundle-price small{color:#8b8995;font-size:8px}
      .rfub-bundle-features{display:grid;gap:8px;margin:13px 0;padding:0;list-style:none}.rfub-bundle-features li{display:flex;align-items:center;gap:7px;color:#62616d;font-size:9px;line-height:13px}.rfub-bundle-features li svg{flex:0 0 auto;color:#5558da}.rfub-bundle-features li b{color:#2e303a}
      .rfub-number-link{width:100%;justify-content:center;margin-top:9px}.rfub-carrier-note{display:block;margin-top:8px;color:#9896a0;font-size:7px;line-height:11px;text-align:center}
      .rfub-custom-card{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:24px;padding:24px;border:1px solid #e2e2e9;border-radius:17px;background:radial-gradient(circle at 2% 100%,rgba(98,101,238,.08),transparent 38%),#fff;box-shadow:0 12px 30px rgba(28,30,55,.055)}
      .rfub-custom-copy h2{max-width:650px;margin:5px 0 0;color:#242631;font-family:Geist,Inter,sans-serif;font-size:22px;line-height:28px;letter-spacing:-.025em}.rfub-custom-copy p{max-width:620px;margin:5px 0 0;color:#777682;font-size:10px;line-height:16px}
      .rfub-quick-amounts{display:flex;flex-wrap:wrap;gap:7px;margin-top:17px}.rfub-quick-amounts button{min-height:33px;padding:0 11px;border:1px solid #e2e3e8;border-radius:8px;color:#565863;background:#fafafd;font:inherit;font-size:9px;font-weight:750;cursor:pointer}.rfub-quick-amounts button.active{color:#5154d6;border-color:rgba(81,84,214,.33);background:#f0f0ff}
      .rfub-custom-checkout{padding:16px;border:1px solid #e4e4eb;border-radius:13px;background:#fafafd}.rfub-custom-checkout label>span{display:block;margin-bottom:6px;color:#62616e;font-size:9px;font-weight:750}
      .rfub-credit-input{min-height:43px;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #dcdde4;border-radius:9px;background:#fff}.rfub-credit-input svg{color:#5759d9}.rfub-credit-input input{width:100%;border:0;outline:0;color:#282a35;background:transparent;font:inherit;font-size:13px;font-weight:750}.rfub-custom-checkout label>small{display:block;margin-top:4px;color:#92909b;font-size:8px}
      .rfub-custom-price{display:grid;grid-template-columns:1fr 1.25fr;gap:8px;margin:13px 0}.rfub-custom-price>div{padding:9px 10px;border:1px solid #e6e7eb;border-radius:9px;background:#fff}.rfub-custom-price span,.rfub-custom-price s,.rfub-custom-price strong{display:block}.rfub-custom-price span{color:#8c8a95;font-size:8px;font-weight:720;text-transform:uppercase}.rfub-custom-price s{margin-top:2px;color:#91909b;font-size:12px}.rfub-custom-price strong{margin-top:1px;color:#4f52d4;font-size:16px}.rfub-custom-price .sale{border-color:rgba(82,85,215,.18);background:#f5f5ff}
      .rfub-secure-line{display:flex;align-items:center;justify-content:center;gap:5px;margin:8px 0 0;color:#8a8894;font-size:7px;line-height:11px;text-align:center}
      .rfub-lower-grid{display:grid;grid-template-columns:1.15fr .85fr .85fr;gap:12px;margin-top:20px}.rfub-panel{min-width:0;padding:16px;border:1px solid #e5e6eb;border-radius:14px;background:#fff;box-shadow:0 8px 22px rgba(27,29,50,.04)}
      .rfub-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid #efeff2}.rfub-panel-head h2{margin:3px 0 0;color:#30323c;font-size:13px;line-height:18px}.rfub-panel-head>svg{color:#6264db}
      .rfub-activity-list,.rfub-number-list{display:grid;gap:0;margin-top:3px}.rfub-activity-list>div,.rfub-number-list>div{min-width:0;display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #f0f0f3}.rfub-activity-list>div:last-child,.rfub-number-list>div:last-child{border-bottom:0}
      .rfub-activity-icon,.rfub-number-list>div>span{width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;border-radius:8px;color:#5558d8;background:#f0f0ff;font-size:10px;font-weight:800}.rfub-activity-icon.purchase{color:#177054;background:#eef9f4}
      .rfub-activity-list>div>div,.rfub-number-list>div>div{min-width:0;flex:1}.rfub-activity-list strong,.rfub-activity-list small,.rfub-number-list strong,.rfub-number-list small{display:block}.rfub-activity-list strong,.rfub-number-list strong{overflow:hidden;color:#43454f;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.rfub-activity-list small,.rfub-number-list small{margin-top:1px;color:#94929d;font-size:7px}
      .rfub-activity-list b{color:#b44a58;font-size:9px}.rfub-activity-list b.positive{color:#24745a}.rfub-number-list em{padding:3px 6px;border-radius:999px;color:#27745a;background:#edf8f3;font-size:7px;font-style:normal;font-weight:750}
      .rfub-empty{display:grid;justify-items:center;padding:25px 12px;text-align:center}.rfub-empty.compact{padding:23px 10px}.rfub-empty>div{width:38px;height:38px;display:grid;place-items:center;margin-bottom:8px;border-radius:11px;color:#5b5dda;background:#f0f0ff}.rfub-empty strong{color:#474954;font-size:10px}.rfub-empty p{max-width:250px;margin:3px 0 0;color:#92909b;font-size:8px;line-height:13px}.rfub-panel>.rfub-btn{margin-top:9px}
      .rfub-clarity{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;margin-top:14px;padding:13px 15px;border:1px solid #e4e5ea;border-radius:12px;background:#fbfbfd}.rfub-clarity-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;color:#5557d7;background:#eeeeff}.rfub-clarity strong{color:#41434e;font-size:10px}.rfub-clarity p{margin:2px 0 0;color:#888691;font-size:8px;line-height:13px}
      .rfub-skeleton{position:relative;overflow:hidden;border-radius:14px;background:#ececf1}.rfub-skeleton::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.58),transparent);animation:rfub-shimmer 1.4s infinite}.rfub-skeleton.head{width:58%;height:72px;margin-bottom:16px}.rfub-skeleton.hero{height:180px;margin-bottom:16px}.rfub-skeleton.cards{height:245px;margin-bottom:16px}.rfub-skeleton.wide{height:180px}
      .spin{animation:rfub-spin .8s linear infinite}@keyframes rfub-spin{to{transform:rotate(360deg)}}@keyframes rfub-shimmer{100%{transform:translateX(100%)}}
      @media(max-width:1180px){.rfub-purpose-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.rfub-lower-grid{grid-template-columns:1fr 1fr}.rfub-lower-grid>:first-child{grid-column:1/-1}}
      @media(max-width:960px){.rfub-hero{grid-template-columns:1fr}.rfub-bundle-grid{grid-template-columns:1fr}.rfub-bundle-top p{min-height:0}.rfub-custom-card{grid-template-columns:1fr}}
      @media(max-width:720px){.rf-unified-billing{padding-inline:0}.rfub-header{flex-direction:column}.rfub-header>.rfub-btn{width:100%}.rfub-balance-panel{grid-template-columns:auto minmax(0,1fr);padding:18px}.rfub-balance-stats{grid-column:1/-1}.rfub-purpose-grid,.rfub-lower-grid{grid-template-columns:1fr}.rfub-lower-grid>:first-child{grid-column:auto}.rfub-section-heading{align-items:flex-start;flex-direction:column}.rfub-clarity{grid-template-columns:auto minmax(0,1fr)}.rfub-clarity>.rfub-inline-link{grid-column:1/-1}}

      /* ReachFly Pricing V2 */
      .rfub-bundle-card.scale-value{
        border-color:rgba(82,85,215,.38);
        background:
          radial-gradient(circle at 100% 0,rgba(106,88,240,.12),transparent 42%),
          linear-gradient(180deg,#fff 0%,#fbfbff 100%);
      }
      .rfub-standard-label{
        min-height:14px;
        display:block;
        color:#9997a2;
        font-size:8px;
      }
      .rfub-bundle-price small:last-child{
        margin-top:3px;
        color:#716f7b;
        font-weight:650;
      }
      .rfub-custom-price{
        grid-template-columns:1fr 1.15fr 1.15fr!important;
      }
      .rfub-custom-price strong small{
        display:inline;
        margin-left:3px;
        color:#8b8994;
        font-size:8px;
        font-weight:650;
      }
      .rfub-savings-cell{
        border-color:rgba(82,85,215,.14)!important;
        background:#f7f7ff!important;
      }
      .rfub-savings-cell strong{
        color:#5154d6!important;
        font-size:11px!important;
      }
      @media(max-width:560px){
        .rfub-custom-price{grid-template-columns:1fr!important}
      }
      @media(prefers-reduced-motion:reduce){.rf-unified-billing *,.rf-unified-billing *::before,.rf-unified-billing *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
    `}</style>
  );
}

function normalizePricingTiers(pricing = {}) {
  const configured = Array.isArray(pricing?.tiers)
    ? pricing.tiers
    : [];

  const tiers = configured
    .map((tier) => ({
      minCredits: positiveInteger(tier?.minCredits, 0),
      maxCredits: positiveInteger(tier?.maxCredits, 0),
      unitPriceMinor: positiveInteger(tier?.unitPriceMinor, 0),
      discountPercent: Math.max(
        0,
        Math.min(90, Number(tier?.discountPercent || 0))
      ),
      label: String(tier?.label || "").trim(),
    }))
    .filter(
      (tier) =>
        tier.minCredits > 0 &&
        tier.unitPriceMinor > 0
    )
    .sort((a, b) => a.minCredits - b.minCredits);

  if (tiers.length) {
    return tiers;
  }

  return [
    {
      minCredits: 100,
      maxCredits: 2499,
      unitPriceMinor: 4,
      discountPercent: 0,
      label: "Standard",
    },
    {
      minCredits: 2500,
      maxCredits: 4999,
      unitPriceMinor: 3,
      discountPercent: 25,
      label: "Growth",
    },
    {
      minCredits: 5000,
      maxCredits: 100000,
      unitPriceMinor: 2,
      discountPercent: 50,
      label: "Scale",
    },
  ];
}

function quoteCreditPurchase(
  credits,
  pricing = {},
  tiers = normalizePricingTiers(pricing)
) {
  const quantity = Math.max(
    positiveInteger(pricing?.minPurchase, 100),
    Math.min(
      positiveInteger(pricing?.maxPurchase, 100000),
      Math.round(Number(credits) || 0)
    )
  );

  let selected =
    tiers[0] ||
    {
      minCredits: 100,
      unitPriceMinor: 4,
      discountPercent: 0,
      label: "Standard",
    };

  for (const tier of tiers) {
    if (quantity >= tier.minCredits) {
      selected = tier;
    }
  }

  const unitPriceMinor =
    positiveInteger(selected.unitPriceMinor, 4);

  return {
    credits: quantity,
    amountMinor: quantity * unitPriceMinor,
    unitPriceMinor,
    discountPercent: Number(selected.discountPercent || 0),
    label: selected.label || "",
  };
}

function rateLabel(rate, fallback) {
  if (!rate || rate.billable === false) return fallback;
  const credits = Number(rate.creditsPerUnit || 0);
  if (!credits) return fallback;
  const unit = String(rate.unit || "action").replace(/_/g, " ");
  return `${formatCredits(credits)} credit${credits === 1 ? "" : "s"} / ${unit}`;
}

function featureLabel(feature) {
  const labels = {
    lead_generated: "Lead discovery",
    website_mini_audit: "Website mini audit",
    gmb_mini_audit: "GMB mini audit",
    competitor_analysis: "Competitor analysis",
    full_audit: "Full audit",
    reachfly_ai_message: "ReachFly AI",
    ai_connected_call: "AI Voice call",
    connected_call: "AI Voice call",
    email_send: "Email outreach",
  };
  return labels[feature] || humanize(feature) || "ReachFly usage";
}

function featureIcon(feature) {
  if (feature.includes("call")) return "☎";
  if (feature.includes("lead")) return "◎";
  if (feature.includes("audit")) return "◇";
  if (feature.includes("email")) return "✉";
  return "✦";
}

function normalizeCollection(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function formatCredits(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Number.isInteger(number) ? 0 : 3,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatMoneyMinor(minor, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(Number(minor || 0) / 100);
  } catch {
    return `${currency} ${(Number(minor || 0) / 100).toFixed(2)}`;
  }
}

function formatPhone(value) {
  return String(value || "").trim() || "Business number";
}

function formatCallingMode(value) {
  return humanize(value) || "Voice enabled";
}

function formatShortDate(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function humanize(value) {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeMessage(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 800);
}

function byNewest(left, right) {
  return String(right?.createdAt || right?.paidAt || "").localeCompare(
    String(left?.createdAt || left?.paidAt || "")
  );
}

function clearPaymentQuery() {
  try {
    const url = new URL(window.location.href);
    ["payment", "voicePayment", "purchase"].forEach((key) =>
      url.searchParams.delete(key)
    );
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    // No-op.
  }
}

function notify(tone, title, text) {
  const method = window.reachflyToast?.[tone];
  if (typeof method === "function") method(title, text);
}
