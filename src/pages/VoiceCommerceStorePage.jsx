import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  api,
} from "../api";

import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  Phone,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Target,
  X,
  Zap,
} from "../components/icons";

export default function VoiceCommerceStorePage() {
  const [
    commerce,
    setCommerce,
  ] = useState(null);

  const [
    billing,
    setBilling,
  ] = useState(null);

  const [
    search,
    setSearch,
  ] = useState({
    countryCode:
      "US",
    areaCode:
      "",
    locality:
      "",
    callingMode:
      "both",
    limit:
      8,
  });

  const [
    inventory,
    setInventory,
  ] = useState(null);

  const [
    busy,
    setBusy,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] = useState(null);

  const load =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!silent) {
          setLoading(
            true
          );
        }

        setError("");

        try {
          const [
            commerceData,
            billingData,
          ] =
            await Promise.all([
              api.voiceCommerce(),
              api.billingCredits(),
            ]);

          setCommerce(
            commerceData
          );
          setBilling(
            billingData
          );
          setLastUpdatedAt(
            new Date()
          );
        } catch (
          requestError
        ) {
          setError(
            safeCommerceMessage(
              requestError?.message ||
                "Voice commerce could not be loaded."
            )
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  const callPacks =
    billing?.aiCalling
      ?.packs ||
    [];

  const bundleCatalog =
    commerce?.bundleCatalog ||
    [];

  const wallet =
    billing?.aiCalling
      ?.wallet ||
    {};

  const activeNumber =
    commerce?.activeNumber ||
    null;

  const availableCredits =
    Number(
      wallet.balance ||
        0
    );

  const canPurchase =
    billing?.aiCalling
      ?.canPurchase !==
    false;

  const selectedInventory =
    useMemo(
      () =>
        Array.isArray(
          inventory?.items
        )
          ? inventory.items
          : [],
      [
        inventory,
      ]
    );

  async function buyCredits(
    pack
  ) {
    try {
      setBusy(
        `pack:${pack.id}`
      );
      setError("");

      const response =
        await api.checkoutAiCallCredits({
          packId:
            pack.id,
        });

      if (
        !response?.checkoutUrl
      ) {
        throw new Error(
          "Secure checkout URL was not returned."
        );
      }

      window.location.assign(
        response.checkoutUrl
      );
    } catch (
      requestError
    ) {
      const message =
        safeCommerceMessage(
          requestError?.message ||
            "Credit checkout could not be opened."
        );

      setError(
        message
      );
      setBusy("");

      notifyCommerce(
        "error",
        "Checkout unavailable",
        message
      );
    }
  }

  async function findNumbers(
    event
  ) {
    event?.preventDefault?.();

    try {
      setBusy(
        "search"
      );
      setError("");

      const response =
        await api.searchVoiceNumbers(
          search
        );

      setInventory(
        response
      );

      notifyCommerce(
        "success",
        "Number search complete",
        Array.isArray(
          response?.items
        ) &&
          response.items
            .length
          ? `${response.items.length} available business number${
              response.items.length ===
              1
                ? ""
                : "s"
            } found.`
          : "No matching business numbers were returned for this search."
      );
    } catch (
      requestError
    ) {
      const message =
        safeCommerceMessage(
          requestError?.message ||
            "Business numbers could not be searched."
        );

      setError(
        message
      );

      notifyCommerce(
        "error",
        "Number search failed",
        message
      );
    } finally {
      setBusy("");
    }
  }

  async function buyNumber(
    item,
    bundle = null
  ) {
    if (
      !inventory?.quoteId
    ) {
      setError(
        "Search for available business numbers again before starting checkout."
      );
      return;
    }

    const key =
      bundle
        ? `bundle:${item.phoneNumber}:${bundle.id}`
        : `number:${item.phoneNumber}`;

    try {
      setBusy(
        key
      );
      setError("");

      const payload = {
        quoteId:
          inventory.quoteId,
        phoneNumber:
          item.phoneNumber,
      };

      const response =
        bundle
          ? await api.checkoutVoiceBundle({
              ...payload,
              bundleId:
                bundle.id,
            })
          : await api.checkoutVoiceNumber(
              payload
            );

      if (
        !response?.checkoutUrl
      ) {
        throw new Error(
          "Secure checkout URL was not returned."
        );
      }

      window.location.assign(
        response.checkoutUrl
      );
    } catch (
      requestError
    ) {
      const message =
        safeCommerceMessage(
          requestError?.message ||
            "Checkout could not be opened."
        );

      setError(
        message
      );
      setBusy("");

      notifyCommerce(
        "error",
        "Checkout unavailable",
        message
      );
    }
  }

  if (
    loading
  ) {
    return (
      <>
        <VoiceCommerceStyles />

        <main className="rf-commerce-v7">
          <header className="rfc-page-header">
            <div>
              <span className="rfc-eyebrow">
                Business calling
              </span>

              <h1>
                Numbers and AI call credits.
              </h1>

              <p>
                Loading your workspace voice commerce…
              </p>
            </div>
          </header>

          <section className="rfc-skeleton-grid">
            <i />
            <i />
            <i />
          </section>

          <section className="rfc-skeleton-panel">
            <i />
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <VoiceCommerceStyles />

      <main className="rf-commerce-v7">
        <header className="rfc-page-header">
          <div>
            <span className="rfc-eyebrow">
              Business calling
            </span>

            <h1>
              Numbers, bundles and AI call credits.
            </h1>

            <p>
              Add a ReachFly business number, top up AI call credits, or connect
              an existing number without exposing provider setup details to the
              day-to-day sales workflow.
            </p>

            {lastUpdatedAt ? (
              <small>
                Updated{" "}
                {formatTime(
                  lastUpdatedAt
                )}
              </small>
            ) : null}
          </div>

          <div className="rfc-header-actions">
            <Link
              className="rfc-button secondary"
              to="/app/voice-agent?tab=setup&view=connect-number"
            >
              Connect existing number
            </Link>

            <button
              type="button"
              className="rfc-button primary"
              disabled={
                busy ===
                "refresh"
              }
              onClick={async () => {
                setBusy(
                  "refresh"
                );

                await load({
                  silent:
                    true,
                });

                setBusy("");

                notifyCommerce(
                  "success",
                  "Voice commerce refreshed",
                  "Your latest calling credits and business-number status are visible."
                );
              }}
            >
              <RefreshCw
                size={14}
                className={
                  busy ===
                  "refresh"
                    ? "rfc-spin"
                    : ""
                }
              />

              {busy ===
              "refresh"
                ? "Refreshing…"
                : "Refresh"}
            </button>
          </div>
        </header>

        {error ? (
          <section
            className="rfc-alert"
            role="alert"
          >
            <span>
              <X size={13} />
            </span>

            <div>
              <strong>
                Calling commerce needs attention
              </strong>

              <p>
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              aria-label="Dismiss voice commerce error"
            >
              <X size={10} />
            </button>
          </section>
        ) : null}

        <section className="rfc-summary">
          <article className="rfc-wallet-card">
            <span>
              <Sparkles size={17} />
            </span>

            <div>
              <small>
                AI call credits
              </small>

              <strong>
                {Math.floor(
                  availableCredits
                )}
              </strong>

              <p>
                Available connected-conversation credits.
              </p>
            </div>
          </article>

          <article>
            <span>
              <Phone size={17} />
            </span>

            <div>
              <small>
                Business number
              </small>

              <strong className="number">
                {activeNumber
                  ?.phoneNumber ||
                  "Not active"}
              </strong>

              <p>
                {activeNumber
                  ? "Currently attached to this workspace."
                  : "Purchase or connect a number when you are ready."}
              </p>
            </div>
          </article>

          <article>
            <span>
              <Shield size={17} />
            </span>

            <div>
              <small>
                Purchase readiness
              </small>

              <strong className="status">
                {canPurchase
                  ? "Ready"
                  : "Unavailable"}
              </strong>

              <p>
                Checkout availability is controlled by the current billing
                configuration.
              </p>
            </div>
          </article>
        </section>

        <section className="rfc-panel">
          <PanelHeading
            icon={
              Zap
            }
            eyebrow="Top up"
            title="AI call credits"
            text="Standalone packs can be purchased whenever your workspace needs more connected AI conversations."
          />

          {callPacks.length ? (
            <div className="rfc-product-grid">
              {callPacks.map(
                (
                  pack,
                  index
                ) => (
                  <article
                    className={`rfc-product-card ${
                      index ===
                      1
                        ? "recommended"
                        : ""
                    }`}
                    key={
                      pack.id
                    }
                  >
                    {index ===
                    1 ? (
                      <span className="rfc-ribbon">
                        Popular
                      </span>
                    ) : null}

                    <small>
                      {pack.label}
                    </small>

                    <strong>
                      {pack.credits}
                    </strong>

                    <span>
                      AI call credits
                    </span>

                    <b>
                      {money(
                        pack.amountMinor,
                        pack.currency
                      )}
                    </b>

                    <button
                      className="rfc-button primary full"
                      disabled={
                        Boolean(
                          busy
                        ) ||
                        !canPurchase
                      }
                      onClick={() =>
                        void buyCredits(
                          pack
                        )
                      }
                    >
                      {busy ===
                      `pack:${pack.id}`
                        ? "Opening checkout…"
                        : "Buy credits"}
                    </button>
                  </article>
                )
              )}
            </div>
          ) : (
            <CommerceEmpty
              title="No AI call-credit packs are active"
              text="Purchase options will appear here when the workspace billing catalog exposes active packs."
            />
          )}
        </section>

        <section className="rfc-panel">
          <PanelHeading
            icon={
              Phone
            }
            eyebrow="Phone identity"
            title="Choose a ReachFly business number"
            text="Search available inventory, then buy the number only or combine it with an available AI-call bundle."
          />

          <form
            className="rfc-number-search"
            onSubmit={
              findNumbers
            }
          >
            <label>
              <span>
                Country
              </span>

              <input
                value={
                  search.countryCode
                }
                maxLength={
                  2
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    (
                      current
                    ) => ({
                      ...current,
                      countryCode:
                        event.target.value.toUpperCase(),
                    })
                  )
                }
              />
            </label>

            <label>
              <span>
                Area code
              </span>

              <input
                value={
                  search.areaCode
                }
                placeholder="213"
                onChange={(
                  event
                ) =>
                  setSearch(
                    (
                      current
                    ) => ({
                      ...current,
                      areaCode:
                        event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              <span>
                City / locality
              </span>

              <input
                value={
                  search.locality
                }
                placeholder="Los Angeles"
                onChange={(
                  event
                ) =>
                  setSearch(
                    (
                      current
                    ) => ({
                      ...current,
                      locality:
                        event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              <span>
                Calling
              </span>

              <select
                value={
                  search.callingMode
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    (
                      current
                    ) => ({
                      ...current,
                      callingMode:
                        event.target.value,
                    })
                  )
                }
              >
                <option value="both">
                  Inbound + outbound
                </option>

                <option value="outbound">
                  Outbound
                </option>

                <option value="inbound">
                  Inbound
                </option>
              </select>
            </label>

            <button
              className="rfc-button primary"
              disabled={
                busy ===
                "search"
              }
              type="submit"
            >
              <Search size={14} />

              {busy ===
              "search"
                ? "Searching…"
                : "Find numbers"}
            </button>
          </form>

          {selectedInventory.length ? (
            <>
              <div className="rfc-results-head">
                <div>
                  <span>
                    Search results
                  </span>

                  <strong>
                    {selectedInventory.length} available number
                    {selectedInventory.length ===
                    1
                      ? ""
                      : "s"}
                  </strong>
                </div>

                <small>
                  Quote is used only for the current search result.
                </small>
              </div>

              <div className="rfc-number-grid">
                {selectedInventory.map(
                  (
                    item
                  ) => (
                    <NumberCard
                      key={
                        item.phoneNumber
                      }
                      item={
                        item
                      }
                      bundleCatalog={
                        bundleCatalog
                      }
                      busy={
                        busy
                      }
                      onBuyNumber={
                        buyNumber
                      }
                    />
                  )
                )}
              </div>
            </>
          ) : (
            <CommerceEmpty
              icon={
                Globe2
              }
              title="Search to see available business numbers"
              text="You can also keep your current number using the Connect existing number flow."
            />
          )}

          <aside className="rfc-commerce-note">
            <Shield size={15} />

            <div>
              <strong>
                Billing clarity
              </strong>

              <p>
                Initial number activation is a one-time checkout in the current
                build. Automatic recurring customer renewal billing for future
                number fees is not represented as enabled until a recurring
                billing integration is configured and verified.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}

function PanelHeading({
  icon: Icon,
  eyebrow,
  title,
  text,
}) {
  return (
    <header className="rfc-panel-heading">
      <span>
        <Icon size={17} />
      </span>

      <div>
        <small>
          {eyebrow}
        </small>

        <h2>
          {title}
        </h2>

        <p>
          {text}
        </p>
      </div>
    </header>
  );
}

function NumberCard({
  item,
  bundleCatalog,
  busy,
  onBuyNumber,
}) {
  const region =
    (
      item.regionInformation ||
      []
    )
      .map(
        (
          entry
        ) =>
          entry.name
      )
      .filter(
        Boolean
      )
      .slice(
        0,
        2
      )
      .join(
        " · "
      ) ||
    "Voice-capable local number";

  return (
    <article className="rfc-number-card">
      <header>
        <span>
          <Phone size={15} />
        </span>

        <div>
          <small>
            Business number
          </small>

          <h3>
            {item.phoneNumber}
          </h3>

          <p>
            {region}
          </p>
        </div>
      </header>

      <div className="rfc-number-price">
        <span>
          Initial number activation
        </span>

        <strong>
          {money(
            item.initialChargeMinor,
            item.currency
          )}
        </strong>
      </div>

      <button
        className="rfc-button secondary full"
        disabled={
          Boolean(
            busy
          )
        }
        onClick={() =>
          void onBuyNumber(
            item
          )
        }
      >
        {busy ===
        `number:${item.phoneNumber}`
          ? "Opening checkout…"
          : "Buy number only"}
      </button>

      {bundleCatalog.length ? (
        <div className="rfc-bundle-stack">
          <span className="rfc-bundle-title">
            Number + AI calling
          </span>

          {bundleCatalog.map(
            (
              bundle
            ) => {
              const amount =
                Number(
                  item.initialChargeMinor ||
                    0
                ) +
                Number(
                  bundle.callCreditAmountMinor ||
                    0
                );

              const key =
                `bundle:${item.phoneNumber}:${bundle.id}`;

              return (
                <button
                  className={`rfc-bundle-option ${
                    bundle.recommended
                      ? "recommended"
                      : ""
                  }`}
                  type="button"
                  disabled={
                    Boolean(
                      busy
                    )
                  }
                  key={
                    bundle.id
                  }
                  onClick={() =>
                    void onBuyNumber(
                      item,
                      bundle
                    )
                  }
                >
                  <span>
                    {bundle.recommended ? (
                      <CheckCircle2 size={11} />
                    ) : (
                      <Target size={11} />
                    )}

                    {bundle.label}
                  </span>

                  <b>
                    {money(
                      amount,
                      bundle.currency ||
                        item.currency
                    )}
                  </b>

                  <small>
                    {busy ===
                    key
                      ? "Opening checkout…"
                      : `Number + ${bundle.credits} calls`}
                  </small>
                </button>
              );
            }
          )}
        </div>
      ) : null}
    </article>
  );
}

function CommerceEmpty({
  icon: Icon = Search,
  title,
  text,
}) {
  return (
    <div className="rfc-empty">
      <span>
        <Icon size={20} />
      </span>

      <strong>
        {title}
      </strong>

      <p>
        {text}
      </p>
    </div>
  );
}

function money(
  minor = 0,
  currency = "USD"
) {
  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style:
          "currency",
        currency:
          String(
            currency ||
              "USD"
          ).toUpperCase(),
      }
    ).format(
      Number(
        minor ||
          0
      ) /
        100
    );
  } catch {
    return `${currency} ${(
      Number(
        minor ||
          0
      ) /
      100
    ).toFixed(2)}`;
  }
}

function formatTime(
  value
) {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "recently";
  }

  return date.toLocaleTimeString(
    undefined,
    {
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  );
}

function safeCommerceMessage(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /ElevenLabs/gi,
      "voice service"
    )
    .replace(
      /Telnyx/gi,
      "calling service"
    )
    .replace(
      /\bSIP\b/gi,
      "voice connection"
    );
}

function notifyCommerce(
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

function VoiceCommerceStyles() {
  return (
    <style>{`
      .rf-commerce-v7{
        --rfc-card:#fff;
        --rfc-soft:#f6f7f8;
        --rfc-text:#191c1d;
        --rfc-text2:#4d4c59;
        --rfc-muted:#777784;
        --rfc-line:#e2e4e7;
        --rfc-primary:#4648d4;
        --rfc-primary-dark:#393bbb;
        --rfc-primary-soft:#e8e9ff;
        --rfc-violet:#6b38d4;
        --rfc-violet-soft:#f1ebff;
        --rfc-green:#087a51;
        --rfc-green-soft:#e4f7ee;
        --rfc-red:#ba1a1a;
        --rfc-red-soft:#ffedeb;
        --rfc-dark:#2e3132;
        --rfc-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfc-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfcPageIn .24s var(--rfc-ease);
      }

      .rf-commerce-v7 *,
      .rf-commerce-v7 *::before,
      .rf-commerce-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfcPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfcSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfcShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfc-spin{
        animation:rfcSpin .75s linear infinite;
      }

      .rfc-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:17px;
      }

      .rfc-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfc-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfc-page-header h1{
        margin:0;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rfc-page-header p{
        max-width:780px;
        margin:5px 0 0;
        color:var(--rfc-text2);
        font-size:12px;
        line-height:18px;
      }

      .rfc-page-header > div:first-child > small{
        display:block;
        margin-top:7px;
        color:var(--rfc-muted);
        font-size:6px;
      }

      .rfc-header-actions{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rfc-button{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        text-decoration:none;
        font-size:7px;
        font-weight:700;
        transition:.14s var(--rfc-ease);
      }

      .rfc-button:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfc-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfc-button.primary{
        color:#fff;
        background:var(--rfc-primary);
        border-color:var(--rfc-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rfc-button.primary:hover:not(:disabled){
        background:var(--rfc-primary-dark);
      }

      .rfc-button.secondary{
        color:var(--rfc-text);
        background:#fff;
        border-color:var(--rfc-line);
      }

      .rfc-button.full{
        width:100%;
      }

      .rfc-alert{
        display:grid;
        grid-template-columns:27px minmax(0,1fr) 24px;
        align-items:start;
        gap:8px;
        padding:10px 11px;
        margin-bottom:11px;
        color:#7f1b1b;
        background:var(--rfc-red-soft);
        border:1px solid #ffd0cc;
        border-radius:9px;
      }

      .rfc-alert > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:7px;
      }

      .rfc-alert strong{
        display:block;
        font-size:7px;
      }

      .rfc-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rfc-alert > button{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        padding:0;
        color:currentColor;
        background:transparent;
        border:0;
        cursor:pointer;
      }

      .rfc-summary{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
        margin-bottom:11px;
      }

      .rfc-summary > article{
        min-height:120px;
        display:grid;
        grid-template-columns:39px minmax(0,1fr);
        align-items:center;
        gap:10px;
        padding:13px;
        background:#fff;
        border:1px solid var(--rfc-line);
        border-radius:10px;
      }

      .rfc-summary > article > span{
        width:39px;
        height:39px;
        display:grid;
        place-items:center;
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
        border-radius:9px;
      }

      .rfc-summary > article > div{
        min-width:0;
        display:grid;
      }

      .rfc-summary small{
        color:var(--rfc-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rfc-summary strong{
        margin-top:2px;
        font:600 21px/27px Geist,Inter,sans-serif;
      }

      .rfc-summary strong.number{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:15px;
      }

      .rfc-summary strong.status{
        color:var(--rfc-green);
        font-size:17px;
      }

      .rfc-summary p{
        margin:2px 0 0;
        color:var(--rfc-muted);
        font-size:5.7px;
        line-height:9px;
      }

      .rfc-panel{
        overflow:hidden;
        padding:13px;
        margin-bottom:11px;
        background:#fff;
        border:1px solid var(--rfc-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rfc-panel-heading{
        min-height:67px;
        display:grid;
        grid-template-columns:38px minmax(0,1fr);
        align-items:center;
        gap:9px;
        padding-bottom:10px;
        margin-bottom:10px;
        border-bottom:1px solid #eff0f1;
      }

      .rfc-panel-heading > span{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
        border-radius:9px;
      }

      .rfc-panel-heading > div{
        min-width:0;
        display:grid;
      }

      .rfc-panel-heading small{
        color:var(--rfc-primary);
        font-size:5.3px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfc-panel-heading h2{
        margin:1px 0 0;
        font:600 14px/19px Geist,Inter,sans-serif;
      }

      .rfc-panel-heading p{
        max-width:750px;
        margin:2px 0 0;
        color:var(--rfc-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfc-product-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .rfc-product-card{
        position:relative;
        min-height:220px;
        display:grid;
        align-content:end;
        padding:14px;
        overflow:hidden;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:10px;
      }

      .rfc-product-card.recommended{
        background:
          radial-gradient(circle at 90% 10%,rgba(70,72,212,.08),transparent 31%),
          #f6f6ff;
        border-color:#d8d9ff;
      }

      .rfc-ribbon{
        position:absolute;
        top:10px;
        right:10px;
        padding:4px 6px;
        color:#fff;
        background:var(--rfc-primary);
        border-radius:999px;
        font-size:5px;
        font-weight:800;
      }

      .rfc-product-card > small{
        color:var(--rfc-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rfc-product-card > strong{
        margin-top:3px;
        font:600 31px/36px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rfc-product-card > span:not(.rfc-ribbon){
        color:var(--rfc-muted);
        font-size:5.8px;
      }

      .rfc-product-card > b{
        margin:11px 0 8px;
        font-size:8px;
      }

      .rfc-number-search{
        display:grid;
        grid-template-columns:110px 130px minmax(170px,1fr) 170px auto;
        align-items:end;
        gap:7px;
        padding:9px;
        background:#f7f8f9;
        border-radius:9px;
      }

      .rfc-number-search label{
        min-width:0;
        display:grid;
        gap:4px;
      }

      .rfc-number-search label > span{
        color:var(--rfc-muted);
        font-size:5.5px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rfc-number-search input,
      .rfc-number-search select{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfc-text);
        background:#fff;
        border:1px solid var(--rfc-line);
        border-radius:8px;
        outline:0;
        font-size:7px;
      }

      .rfc-number-search input:focus,
      .rfc-number-search select:focus{
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rfc-results-head{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:12px;
        margin:13px 1px 8px;
      }

      .rfc-results-head > div{
        display:grid;
      }

      .rfc-results-head span{
        color:var(--rfc-primary);
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfc-results-head strong{
        margin-top:2px;
        font-size:8px;
      }

      .rfc-results-head > small{
        color:var(--rfc-muted);
        font-size:5.5px;
      }

      .rfc-number-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      }

      .rfc-number-card{
        min-width:0;
        display:grid;
        gap:8px;
        padding:12px;
        background:#fff;
        border:1px solid var(--rfc-line);
        border-radius:10px;
      }

      .rfc-number-card > header{
        min-height:61px;
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        align-items:center;
        gap:8px;
      }

      .rfc-number-card > header > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
        border-radius:8px;
      }

      .rfc-number-card > header > div{
        min-width:0;
        display:grid;
      }

      .rfc-number-card small{
        color:var(--rfc-muted);
        font-size:5.3px;
      }

      .rfc-number-card h3{
        margin:2px 0 0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 12px/16px Geist,Inter,sans-serif;
      }

      .rfc-number-card p{
        margin:2px 0 0;
        color:var(--rfc-muted);
        font-size:5.5px;
      }

      .rfc-number-price{
        min-height:55px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:9px;
        padding:8px 9px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rfc-number-price span{
        color:var(--rfc-muted);
        font-size:5.5px;
      }

      .rfc-number-price strong{
        font-size:8px;
      }

      .rfc-bundle-stack{
        display:grid;
        gap:5px;
        padding-top:3px;
      }

      .rfc-bundle-title{
        color:var(--rfc-muted);
        font-size:5.3px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rfc-bundle-option{
        min-height:58px;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        gap:5px 9px;
        width:100%;
        padding:8px 9px;
        color:var(--rfc-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        text-align:left;
        cursor:pointer;
      }

      .rfc-bundle-option.recommended{
        background:#f3f3ff;
        border-color:#dbdcff;
      }

      .rfc-bundle-option > span{
        display:flex;
        align-items:center;
        gap:5px;
        font-size:6.2px;
        font-weight:750;
      }

      .rfc-bundle-option > span svg{
        color:var(--rfc-primary);
      }

      .rfc-bundle-option b{
        justify-self:end;
        font-size:6.8px;
      }

      .rfc-bundle-option small{
        grid-column:1/-1;
        color:var(--rfc-muted);
        font-size:5.3px;
      }

      .rfc-empty{
        min-height:190px;
        display:grid;
        place-items:center;
        align-content:center;
        padding:24px;
        margin-top:9px;
        background:#f8f9fa;
        border:1px dashed #d8dade;
        border-radius:9px;
        text-align:center;
      }

      .rfc-empty > span{
        width:45px;
        height:45px;
        display:grid;
        place-items:center;
        color:var(--rfc-primary);
        background:var(--rfc-primary-soft);
        border-radius:11px;
      }

      .rfc-empty strong{
        margin-top:9px;
        font-size:7.5px;
      }

      .rfc-empty p{
        max-width:460px;
        margin:3px 0 0;
        color:var(--rfc-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfc-commerce-note{
        display:grid;
        grid-template-columns:32px minmax(0,1fr);
        align-items:start;
        gap:8px;
        padding:10px;
        margin-top:10px;
        color:var(--rfc-violet);
        background:var(--rfc-violet-soft);
        border:1px solid #e3daf8;
        border-radius:9px;
      }

      .rfc-commerce-note > svg{
        margin-top:1px;
      }

      .rfc-commerce-note strong{
        display:block;
        color:var(--rfc-text);
        font-size:6.5px;
      }

      .rfc-commerce-note p{
        margin:2px 0 0;
        color:var(--rfc-text2);
        font-size:6px;
        line-height:10px;
      }

      .rfc-skeleton-grid{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:9px;
      }

      .rfc-skeleton-grid i,
      .rfc-skeleton-panel i{
        display:block;
        background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);
        background-size:220% 100%;
        border-radius:10px;
        animation:rfcShimmer 1.2s linear infinite;
      }

      .rfc-skeleton-grid i{
        height:120px;
      }

      .rfc-skeleton-panel{
        margin-top:11px;
      }

      .rfc-skeleton-panel i{
        height:390px;
      }

      @media(max-width:1080px){
        .rf-commerce-v7{
          padding:22px;
        }

        .rfc-number-search{
          grid-template-columns:1fr 1fr;
        }

        .rfc-number-search .rfc-button{
          grid-column:1/-1;
        }
      }

      @media(max-width:820px){
        .rfc-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfc-product-grid{
          grid-template-columns:1fr 1fr;
        }

        .rfc-number-grid{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:620px){
        .rf-commerce-v7{
          padding:18px 12px 80px;
        }

        .rfc-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfc-page-header p{
          font-size:10px;
          line-height:16px;
        }

        .rfc-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
          width:100%;
        }

        .rfc-summary{
          grid-template-columns:1fr;
        }

        .rfc-product-grid{
          grid-template-columns:1fr;
        }

        .rfc-number-search{
          grid-template-columns:1fr;
        }

        .rfc-number-search .rfc-button{
          grid-column:auto;
        }

        .rfc-results-head{
          align-items:flex-start;
          flex-direction:column;
        }
      }

      @media(max-width:420px){
        .rfc-header-actions{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-commerce-v7,
        .rfc-spin,
        .rfc-skeleton-grid i,
        .rfc-skeleton-panel i{
          animation:none!important;
        }

        .rf-commerce-v7 *,
        .rf-commerce-v7 *::before,
        .rf-commerce-v7 *::after{
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
