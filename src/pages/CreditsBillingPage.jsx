import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiRequest } from "../lib/workspace-platform-client.js";
import "../styles.css";

const PAYMENT_REFRESH_DELAYS_MS = [
  1500,
  3500,
  7000,
];

export default function CreditsBillingPage() {
  const [data, setData] =
    useState(null);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [buying, setBuying] =
    useState("");
  const [buyingAi, setBuyingAi] =
    useState("");
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");

  const load = useCallback(
    async ({
      background = false,
    } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response =
          await apiRequest(
            "/billing/credits",
            {
              timeoutMs: 15_000,
            }
          );

        setData(response);
        return response;
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Credits and usage could not be loaded."
        );
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    let disposed = false;
    const timers = [];

    async function initialize() {
      await load();

      if (disposed) return;

      const params =
        new URLSearchParams(
          window.location.search
        );

      const paymentState =
        params.get("payment");
      const voicePaymentState =
        params.get("voicePayment");

      if (
        voicePaymentState ===
        "success"
      ) {
        setMessage(
          "AI call-credit payment returned successfully. ReachFly is verifying the payment before funding the dedicated call wallet."
        );

        for (const delay of PAYMENT_REFRESH_DELAYS_MS) {
          const timer = window.setTimeout(() => {
            if (!disposed) {
              void load({ background: true });
            }
          }, delay);
          timers.push(timer);
        }

        clearPaymentQuery();
      } else if (
        voicePaymentState ===
        "cancelled"
      ) {
        setMessage(
          "AI call-credit purchase was cancelled. No call credits were added."
        );
        clearPaymentQuery();
      } else if (
        paymentState ===
        "success"
      ) {
        setMessage(
          "Payment returned successfully. ReachFly is verifying the payment before adding credits."
        );

        for (
          const delay of
          PAYMENT_REFRESH_DELAYS_MS
        ) {
          const timer =
            window.setTimeout(
              () => {
                if (!disposed) {
                  void load({
                    background:
                      true,
                  });
                }
              },
              delay
            );

          timers.push(timer);
        }

        clearPaymentQuery();
      } else if (
        paymentState ===
        "cancelled"
      ) {
        setMessage(
          "Credit purchase was cancelled. No credits were added."
        );
        clearPaymentQuery();
      }
    }

    void initialize();

    return () => {
      disposed = true;

      for (
        const timer of
        timers
      ) {
        window.clearTimeout(
          timer
        );
      }
    };
  }, [load]);

  const wallet =
    data?.wallet || {};

  const aiCalling =
    data?.aiCalling &&
    typeof data.aiCalling === "object"
      ? data.aiCalling
      : null;

  const aiCallWallet =
    aiCalling?.wallet &&
    typeof aiCalling.wallet === "object"
      ? aiCalling.wallet
      : null;

  const aiCallPolicy =
    aiCalling?.policy &&
    typeof aiCalling.policy === "object"
      ? aiCalling.policy
      : null;

  const aiCallUsage =
    useMemo(
      () =>
        Array.isArray(
          aiCalling?.usage
        )
          ? aiCalling.usage
          : [],
      [aiCalling?.usage]
    );

  const aiCallLedger =
    useMemo(
      () =>
        Array.isArray(
          aiCalling?.ledger
        )
          ? aiCalling.ledger
          : [],
      [aiCalling?.ledger]
    );

  const aiCallPacks =
    useMemo(
      () =>
        (Array.isArray(aiCalling?.packs) ? aiCalling.packs : [])
          .filter(
            (pack) =>
              pack?.active === true &&
              Number(pack?.amountMinor || 0) > 0 &&
              Number(pack?.credits || 0) > 0
          )
          .sort(
            (left, right) =>
              Number(left?.credits || 0) -
              Number(right?.credits || 0)
          ),
      [aiCalling?.packs]
    );

  const activePacks =
    useMemo(
      () =>
        (data?.packs || [])
          .filter(
            (pack) =>
              pack?.active ===
                true &&
              Number(
                pack?.amountMinor ||
                  0
              ) > 0 &&
              Number(
                pack?.credits ||
                  0
              ) > 0
          )
          .sort(
            (left, right) =>
              Number(
                left?.credits ||
                  0
              ) -
              Number(
                right?.credits ||
                  0
              )
          ),
      [data?.packs]
    );

  const rateCard =
    useMemo(
      () =>
        Array.isArray(
          data?.rateCard
        )
          ? data.rateCard
          : [],
      [data?.rateCard]
    );

  const callingRateEntries =
    useMemo(
      () =>
        rateCard.filter(
          isCallingRate
        ),
      [rateCard]
    );

  const generalRates =
    useMemo(
      () =>
        rateCard.filter(
          (rate) =>
            !isCallingRate(rate)
        ),
      [rateCard]
    );

  const secureCheckoutReady =
    Boolean(
      data?.safepay
        ?.configured
    );

  const canPurchase =
    Boolean(
      data?.canPurchase
    );

  async function buy(
    packId
  ) {
    if (
      !packId ||
      buying
    ) {
      return;
    }

    setBuying(packId);
    setError("");
    setMessage("");

    try {
      /*
       * Commercial values are server-owned.
       * React intentionally sends only packId.
       */
      const result =
        await apiRequest(
          "/billing/credits/checkout",
          {
            method: "POST",
            body: {
              packId,
            },
            timeoutMs: 30_000,
          }
        );

      if (
        !result?.checkoutUrl ||
        !/^https?:\/\//i.test(
          result.checkoutUrl
        )
      ) {
        throw new Error(
          "Secure checkout could not be opened."
        );
      }

      window.location.assign(
        result.checkoutUrl
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Could not start secure checkout."
      );
      setBuying("");
    }
  }

  async function buyAiCallCredits(packId) {
    if (!packId || buyingAi) {
      return;
    }

    setBuyingAi(packId);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        "/billing/ai-calling/checkout",
        {
          method: "POST",
          body: { packId },
          timeoutMs: 30_000,
        }
      );

      if (
        !result?.checkoutUrl ||
        !/^https?:\/\//i.test(result.checkoutUrl)
      ) {
        throw new Error(
          "Secure AI call-credit checkout could not be opened."
        );
      }

      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Could not start AI call-credit checkout."
      );
      setBuyingAi("");
    }
  }

  if (loading) {
    return (
      <main className="rf-credit-page">
        <div className="rf-credit-loading">
          Loading credits and
          usage…
        </div>
      </main>
    );
  }

  return (
    <main className="rf-credit-page">
      <header className="rf-credit-hero">
        <div>
          <span>
            Workspace billing
          </span>

          <h1>
            Credits &amp; usage
          </h1>

          <p>
            Track general ReachFly
            workspace credits and AI
            call credits separately.
            Rates, balances, connected
            call charging rules and
            checkout values are loaded
            from ReachFly&apos;s
            server-owned billing data.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() =>
            void load({
              background: true,
            })
          }
        >
          {refreshing
            ? "Refreshing…"
            : "Refresh"}
        </button>
      </header>

      {error ? (
        <div
          className="rf-credit-alert error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          className="rf-credit-alert"
          role="status"
        >
          {message}
        </div>
      ) : null}

      <section className="rf-credit-panel">
        <div className="rf-credit-panel-head">
          <div>
            <h2>
              ReachFly workspace credits
            </h2>

            <p>
              General credits fund
              published ReachFly
              features. AI calling
              uses the separate call
              wallet shown below.
            </p>
          </div>

          <span className="rf-credit-status ready">
            General wallet
          </span>
        </div>

        <section
          className="rf-credit-metrics"
          aria-label="ReachFly workspace credit balance"
        >
          <Metric
            label="Available"
            value={formatCredits(
              wallet.balance
            )}
            note="Available for general billable ReachFly work"
          />

          <Metric
            label="Reserved"
            value={formatCredits(
              wallet.reserved
            )}
            note="Temporarily held for work in progress"
          />

          <Metric
            label="Consumed"
            value={formatCredits(
              wallet.totalConsumed
            )}
            note="Successfully settled general usage"
          />

          <Metric
            label="Purchased"
            value={formatCredits(
              wallet.totalPurchased
            )}
            note="General workspace credits purchased"
          />

          {Number(
            wallet.debt || 0
          ) > 0 ? (
            <Metric
              label="Credit debt"
              value={formatCredits(
                wallet.debt
              )}
              note="Future purchased workspace credits may first reduce this balance"
            />
          ) : null}
        </section>
      </section>

      <AiCallingPanel
        aiCalling={aiCalling}
        wallet={aiCallWallet}
        policy={aiCallPolicy}
        usage={aiCallUsage}
        ledger={aiCallLedger}
        packs={aiCallPacks}
        canPurchase={Boolean(aiCalling?.canPurchase)}
        checkoutReady={secureCheckoutReady}
        buyingAi={buyingAi}
        onBuyAi={buyAiCallCredits}
        callingRateEntries={
          callingRateEntries
        }
      />

      <section className="rf-credit-panel">
        <div className="rf-credit-panel-head">
          <div>
            <h2>
              Add workspace credits
            </h2>

            <p>
              {getGrantMessage(
                data
              )}
              {" "}Paid packs in
              this section add only
              to the general
              ReachFly workspace
              wallet; they do not
              add AI call credits.
            </p>
          </div>

          <span
            className={`rf-credit-status ${
              secureCheckoutReady
                ? "ready"
                : "pending"
            }`}
          >
            {secureCheckoutReady
              ? "Secure checkout ready"
              : "Checkout unavailable"}
          </span>
        </div>

        {!canPurchase ? (
          <div className="rf-credit-empty">
            Only a workspace
            owner or administrator
            can purchase credits.
          </div>
        ) : !secureCheckoutReady ? (
          <div className="rf-credit-empty">
            Credit checkout is not
            available right now.
            Existing credits and
            usage history remain
            available.
          </div>
        ) : !activePacks.length ? (
          <div className="rf-credit-empty">
            No paid credit packs
            are currently available.
          </div>
        ) : (
          <div className="rf-credit-packs">
            {activePacks.map(
              (pack) => (
                <article
                  key={pack.id}
                  className="rf-credit-pack"
                >
                  <span>
                    {formatMarket(
                      pack.market
                    )}
                  </span>

                  <h3>
                    {formatCredits(
                      pack.credits
                    )}{" "}
                    credits
                  </h3>

                  <strong>
                    {formatMoneyMinor(
                      pack.amountMinor,
                      pack.currency
                    )}
                  </strong>

                  <button
                    type="button"
                    disabled={
                      Boolean(
                        buying
                      )
                    }
                    onClick={() =>
                      void buy(
                        pack.id
                      )
                    }
                  >
                    {buying ===
                    pack.id
                      ? "Opening checkout…"
                      : "Buy credits"}
                  </button>
                </article>
              )
            )}
          </div>
        )}
      </section>

      <section className="rf-credit-panel">
        <h2>
          General ReachFly feature rates
        </h2>

        <p className="rf-credit-muted">
          These rates apply to the
          general workspace wallet.
          AI calling is intentionally
          excluded here because it is
          settled from the separate
          AI call-credit wallet above.
        </p>

        <div className="rf-credit-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  Feature
                </th>
                <th>
                  Unit
                </th>
                <th>
                  Credits / unit
                </th>
                <th>
                  Charging rule
                </th>
              </tr>
            </thead>

            <tbody>
              {generalRates.length ? (
                generalRates.map(
                  (rate) => (
                    <tr
                      key={
                        rate.feature
                      }
                    >
                      <td>
                        <strong>
                          {rate.label ||
                            formatFeature(
                              rate.feature
                            )}
                        </strong>

                        {rate.feature ? (
                          <small>
                            {
                              rate.feature
                            }
                          </small>
                        ) : null}
                      </td>

                      <td>
                        {rate.unit ||
                          "—"}
                      </td>

                      <td>
                        {rate.billable
                          ? formatCredits(
                              rate.creditsPerUnit
                            )
                          : "Not billed"}
                      </td>

                      <td>
                        {rate.description ||
                          (rate.billable
                            ? "Charged according to successful settled usage."
                            : "This feature is not currently billed from the workspace credit wallet.")}
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan="4"
                  >
                    No general
                    ReachFly feature
                    rates are
                    currently
                    published.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rf-credit-panel">
        <h2>
          Recent general-credit usage
        </h2>

        <div className="rf-credit-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  Feature
                </th>
                <th>
                  Quantity
                </th>
                <th>
                  Credits
                </th>
                <th>
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {(data?.usage || [])
                .length ? (
                data.usage.map(
                  (item) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td>
                        {formatFeature(
                          item.feature
                        )}
                      </td>

                      <td>
                        {formatCredits(
                          item.quantity
                        )}{" "}
                        {item.unit ||
                          ""}
                      </td>

                      <td>
                        {formatCredits(
                          item.credits
                        )}
                      </td>

                      <td>
                        {formatDate(
                          item.createdAt
                        )}
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan="4"
                  >
                    No settled
                    billable usage
                    yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rf-credit-panel">
        <h2>
          General credit purchases
        </h2>

        <div className="rf-credit-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  Credits
                </th>
                <th>
                  Amount
                </th>
                <th>
                  Status
                </th>
                <th>
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {(data?.purchases ||
                []).length ? (
                data.purchases.map(
                  (item) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td>
                        {formatCredits(
                          item.credits
                        )}
                      </td>

                      <td>
                        {formatMoneyMinor(
                          item.amountMinor,
                          item.currency
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          item.status
                        )}

                        {item.error ? (
                          <small>
                            {item.error}
                          </small>
                        ) : null}
                      </td>

                      <td>
                        {formatDate(
                          item.paidAt ||
                            item.createdAt
                        )}
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan="4"
                  >
                    No paid credit
                    purchases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rf-credit-panel">
        <h2>
          General wallet activity
        </h2>

        <div className="rf-credit-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  Activity
                </th>
                <th>
                  Change
                </th>
                <th>
                  Available after
                </th>
                <th>
                  Reserved after
                </th>
                <th>
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {(data?.ledger || [])
                .length ? (
                data.ledger
                  .slice(0, 50)
                  .map(
                    (
                      item,
                      index
                    ) => (
                      <tr
                        key={
                          item.id ||
                          `${item.createdAt}-${index}`
                        }
                      >
                        <td>
                          {formatLedgerActivity(
                            item
                          )}
                        </td>

                        <td>
                          {formatSignedCredits(
                            item.delta
                          )}
                        </td>

                        <td>
                          {formatCredits(
                            item.balanceAfter
                          )}
                        </td>

                        <td>
                          {formatCredits(
                            item.reservedAfter
                          )}
                        </td>

                        <td>
                          {formatDate(
                            item.createdAt
                          )}
                        </td>
                      </tr>
                    )
                  )
              ) : (
                <tr>
                  <td
                    colSpan="5"
                  >
                    No credit
                    activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {wallet.updatedAt ? (
          <p className="rf-credit-muted">
            Wallet last updated{" "}
            {formatDate(
              wallet.updatedAt
            )}
            .
          </p>
        ) : null}
      </section>
    </main>
  );
}


function AiCallingPanel({
  aiCalling,
  wallet,
  policy,
  usage,
  ledger,
  packs = [],
  canPurchase = false,
  checkoutReady = false,
  buyingAi = "",
  onBuyAi,
  callingRateEntries,
}) {
  if (!aiCalling || !wallet || !policy) {
    return (
      <section className="rf-credit-panel">
        <div className="rf-credit-panel-head">
          <div>
            <h2>
              AI calling &amp; call credits
            </h2>

            <p>
              AI calling uses a
              dedicated connected-call
              wallet, separate from
              general ReachFly credits.
            </p>
          </div>

          <span className="rf-credit-status pending">
            Wallet unavailable
          </span>
        </div>

        <div className="rf-credit-empty">
          This workspace did not
          return an AI call-credit
          snapshot. ReachFly will not
          infer calling entitlement or
          price from the general
          workspace wallet.
        </div>
      </section>
    );
  }

  const testGrant =
    Number(
      policy.testCreditGrant || 0
    );

  const testGrantApplied =
    Boolean(
      wallet.testGrantAppliedAt
    );

  const testGrantAvailable =
    Boolean(
      aiCalling.testGrantAvailable
    ) &&
    !testGrantApplied;

  const creditsPerConnectedCall =
    Number(
      policy.creditsPerConnectedCall ||
        0
    );

  const pricePublished =
    Number(
      policy.connectedCallPriceMinor ||
        0
    ) > 0;

  const durationConfigured =
    Boolean(
      policy.durationPolicyConfigured &&
      Number(
        policy.maxConnectedSeconds ||
          0
      ) > 0
    );

  return (
    <section className="rf-credit-panel">
      <div className="rf-credit-panel-head">
        <div>
          <h2>
            AI calling &amp; call credits
          </h2>

          <p>
            This is a dedicated
            connected-call wallet.
            General ReachFly credit
            packs do not increase this
            balance.
          </p>
        </div>

        <span
          className={`rf-credit-status ${
            Number(wallet.balance || 0) >
            0
              ? "ready"
              : "pending"
          }`}
        >
          {Number(wallet.balance || 0) >
          0
            ? "Call credits available"
            : "No call credits"}
        </span>
      </div>

      <section
        className="rf-credit-metrics"
        aria-label="AI call credit balance"
      >
        <Metric
          label="AI call credits"
          value={formatCredits(
            wallet.balance
          )}
          note="Available for future connected AI calls"
        />

        <Metric
          label="Consumed"
          value={formatCredits(
            wallet.totalConsumed
          )}
          note="Call credits settled on connected calls"
        />

        <Metric
          label="Granted"
          value={formatCredits(
            wallet.totalGranted
          )}
          note="AI call credits granted to this workspace"
        />

        <Metric
          label="Purchased"
          value={formatCredits(
            wallet.totalPurchased
          )}
          note="Dedicated AI call credits purchased through secure checkout"
        />
      </section>

      <div className="rf-credit-table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                AI calling policy
              </th>
              <th>
                Current value
              </th>
              <th>
                What it means
              </th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                Connected-call charge
              </td>
              <td>
                {creditsPerConnectedCall >
                0
                  ? `${formatCredits(
                      creditsPerConnectedCall
                    )} call credit${
                      creditsPerConnectedCall ===
                      1
                        ? ""
                        : "s"
                    }`
                  : "Not published"}
              </td>
              <td>
                {policy.chargingRule ||
                  "ReachFly has not published a connected-call charging rule."}
              </td>
            </tr>

            <tr>
              <td>
                Connected-call price
              </td>
              <td>
                {pricePublished
                  ? formatMoneyMinor(
                      policy.connectedCallPriceMinor,
                      policy.currency
                    )
                  : "Not published"}
              </td>
              <td>
                Server-published
                commercial metadata
                for one connected-call
                billing unit.
              </td>
            </tr>

            <tr>
              <td>
                Duration policy
              </td>
              <td>
                {durationConfigured
                  ? formatCallDuration(
                      policy.maxConnectedSeconds
                    )
                  : "Not configured"}
              </td>
              <td>
                {durationConfigured
                  ? "The active billing policy publishes a maximum connected-call duration."
                  : "No maximum connected-call duration or overage rule is currently published in billing. Do not assume unlimited duration."}
              </td>
            </tr>

            <tr>
              <td>
                One-time test grant
              </td>
              <td>
                {testGrant > 0
                  ? `${formatCredits(
                      testGrant
                    )} call credits`
                  : "Not published"}
              </td>
              <td>
                {testGrantApplied
                  ? `Applied ${formatDate(
                      wallet.testGrantAppliedAt
                    )}.`
                  : testGrantAvailable
                    ? "This workspace has not used its one-time AI calling test grant yet."
                    : "No unused AI calling test grant is currently reported for this workspace."}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {callingRateEntries.length ? (
        <div className="rf-credit-alert">
          {callingRateEntries.length}{" "}
          calling-related{" "}
          {callingRateEntries.length ===
          1
            ? "entry"
            : "entries"}{" "}
          also exist in the
          general ReachFly rate card.
          They are not used here to
          infer the dedicated AI
          call-wallet charge; the AI
          calling policy above remains
          authoritative.
        </div>
      ) : null}

      <div className="rf-credit-panel-head" style={{ marginTop: 20 }}>
        <div>
          <h3>Buy AI call credits</h3>
          <p>
            These packs fund only the dedicated AI calling wallet.
            Pack size, currency and price are loaded from the server.
          </p>
        </div>
        <span
          className={`rf-credit-status ${checkoutReady ? "ready" : "pending"}`}
        >
          {checkoutReady ? "Secure checkout ready" : "Checkout unavailable"}
        </span>
      </div>

      {aiCalling?.requiresPurchasedNumber && !aiCalling?.hasActivePurchasedNumber ? (
        <div className="rf-credit-empty">
          Buy and activate a ReachFly business number in Voice Agent onboarding before purchasing AI call credits.
        </div>
      ) : !canPurchase ? (
        <div className="rf-credit-empty">
          Only a workspace owner or administrator can purchase AI call credits.
        </div>
      ) : !checkoutReady ? (
        <div className="rf-credit-empty">
          Secure checkout is not configured right now. Existing AI call credits remain usable.
        </div>
      ) : !packs.length ? (
        <div className="rf-credit-empty">
          No AI call-credit packs are currently active.
        </div>
      ) : (
        <div className="rf-credit-packs">
          {packs.map((pack) => (
            <article key={pack.id} className="rf-credit-pack">
              <span>AI calling</span>
              <h3>{formatCredits(pack.credits)} call credits</h3>
              <strong>
                {formatMoneyMinor(pack.amountMinor, pack.currency)}
              </strong>
              <button
                type="button"
                disabled={Boolean(buyingAi)}
                onClick={() => onBuyAi?.(pack.id)}
              >
                {buyingAi === pack.id
                  ? "Opening checkout…"
                  : "Buy call credits"}
              </button>
            </article>
          ))}
        </div>
      )}

      <p className="rf-credit-muted">
        General ReachFly credit packs do not fund AI calls. New paid AI calls are blocked when this dedicated balance is zero.
      </p>

      <h3>
        Recent AI connected-call usage
      </h3>

      <div className="rf-credit-table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                Activity
              </th>
              <th>
                Duration
              </th>
              <th>
                Call credits
              </th>
              <th>
                Policy
              </th>
              <th>
                Date
              </th>
            </tr>
          </thead>

          <tbody>
            {usage.length ? (
              usage
                .slice(0, 50)
                .map(
                  (item, index) => (
                    <tr
                      key={
                        item.id ||
                        `${item.createdAt}-${index}`
                      }
                    >
                      <td>
                        Connected AI call
                      </td>

                      <td>
                        {formatCallDuration(
                          item.durationSeconds
                        )}
                      </td>

                      <td>
                        {formatCredits(
                          item.credits
                        )}
                      </td>

                      <td>
                        {item.overDurationPolicy
                          ? "Exceeded published duration policy"
                          : durationConfigured
                            ? "Within published duration policy"
                            : "No duration policy published"}
                      </td>

                      <td>
                        {formatDate(
                          item.createdAt
                        )}
                      </td>
                    </tr>
                  )
                )
            ) : (
              <tr>
                <td colSpan="5">
                  No connected AI call
                  credits have been
                  settled yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3>
        AI call-credit activity
      </h3>

      <div className="rf-credit-table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                Activity
              </th>
              <th>
                Change
              </th>
              <th>
                Balance after
              </th>
              <th>
                Duration
              </th>
              <th>
                Date
              </th>
            </tr>
          </thead>

          <tbody>
            {ledger.length ? (
              ledger
                .slice(0, 50)
                .map(
                  (item, index) => (
                    <tr
                      key={
                        item.id ||
                        `${item.createdAt}-${index}`
                      }
                    >
                      <td>
                        {formatAiCallLedgerActivity(
                          item
                        )}
                      </td>

                      <td>
                        {formatSignedCredits(
                          item.delta
                        )}
                      </td>

                      <td>
                        {formatCredits(
                          item.balanceAfter
                        )}
                      </td>

                      <td>
                        {Number(
                          item.durationSeconds ||
                            0
                        ) > 0
                          ? formatCallDuration(
                              item.durationSeconds
                            )
                          : "—"}
                      </td>

                      <td>
                        {formatDate(
                          item.createdAt
                        )}
                      </td>
                    </tr>
                  )
                )
            ) : (
              <tr>
                <td colSpan="5">
                  No AI call-credit
                  activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {wallet.updatedAt ? (
        <p className="rf-credit-muted">
          AI call wallet last updated{" "}
          {formatDate(
            wallet.updatedAt
          )}
          .
        </p>
      ) : null}
    </section>
  );
}


function Metric({
  label,
  value,
  note,
}) {
  return (
    <article className="rf-credit-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      {note ? (
        <small>
          {note}
        </small>
      ) : null}
    </article>
  );
}


function isCallingRate(rate) {
  const haystack =
    [
      rate?.feature,
      rate?.label,
      rate?.unit,
      rate?.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  return (
    haystack.includes("voice") ||
    haystack.includes("call") ||
    haystack.includes("phone")
  );
}

function formatCallDuration(
  value
) {
  const seconds = Math.max(
    0,
    Math.round(
      Number(value || 0)
    )
  );

  if (!seconds) {
    return "0 sec";
  }

  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remainder =
    seconds % 60;

  if (minutes < 60) {
    return remainder
      ? `${minutes}m ${remainder}s`
      : `${minutes} min`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const minuteRemainder =
    minutes % 60;

  return minuteRemainder
    ? `${hours}h ${minuteRemainder}m`
    : `${hours}h`;
}

function formatAiCallLedgerActivity(
  item
) {
  const type =
    String(
      item?.type || ""
    )
      .trim()
      .toLowerCase();

  if (
    type === "connected_call"
  ) {
    return "Connected AI call";
  }

  if (
    type === "test_grant"
  ) {
    return "One-time AI calling test grant";
  }

  if (item?.description) {
    return item.description;
  }

  return formatFeature(
    type ||
      "AI call credit activity"
  );
}


function getGrantMessage(
  data
) {
  if (
    !data?.testGrantEnabled
  ) {
    return "Automatic general workspace test-credit grants are disabled in this environment.";
  }

  const amount =
    Number(
      data?.freeTestCredits ||
        0
    );

  if (amount > 0) {
    return `This environment may apply one non-renewing test grant of ${formatCredits(
      amount
    )} general workspace credits per eligible workspace.`;
  }

  return "This environment may apply a one-time, non-renewing general workspace credit grant to eligible workspaces.";
}

function clearPaymentQuery() {
  try {
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.delete(
      "payment"
    );
    url.searchParams.delete(
      "purchase"
    );
    url.searchParams.delete(
      "voicePayment"
    );

    window.history.replaceState(
      {},
      "",
      `${url.pathname}${
        url.search
      }${url.hash}`
    );
  } catch {
    // The billing page remains usable even if browser history cannot be rewritten.
  }
}

function formatCredits(
  value
) {
  return new Intl.NumberFormat(
    undefined,
    {
      maximumFractionDigits:
        3,
    }
  ).format(
    Number(value || 0)
  );
}

function formatSignedCredits(
  value
) {
  const number =
    Number(value || 0);

  if (!number) {
    return "0";
  }

  return `${
    number > 0 ? "+" : ""
  }${formatCredits(
    number
  )}`;
}

function formatMoneyMinor(
  value,
  currency = "USD"
) {
  const amount =
    Number(value || 0) /
    100;

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency:
          currency ||
          "USD",
      }
    ).format(amount);
  } catch {
    return `${
      currency || "USD"
    } ${amount.toFixed(
      2
    )}`;
  }
}

function formatMarket(
  value
) {
  const market =
    String(value || "")
      .trim()
      .toUpperCase();

  if (
    market === "PAKISTAN"
  ) {
    return "Pakistan";
  }

  if (
    market ===
    "INTERNATIONAL"
  ) {
    return "International";
  }

  return market
    ? formatFeature(market)
    : "Workspace";
}

function formatFeature(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatStatus(
  value
) {
  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  const labels = {
    created: "Created",
    pending: "Payment pending",
    succeeded: "Paid",
    complete: "Complete",
    completed: "Complete",
    failed: "Failed",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    refunded: "Refunded",
  };

  return (
    labels[status] ||
    formatFeature(
      status || "unknown"
    )
  );
}

function formatLedgerActivity(
  item
) {
  if (item?.description) {
    return item.description;
  }

  return formatFeature(
    item?.type ||
      item?.feature ||
      "credit activity"
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : date.toLocaleString();
}
