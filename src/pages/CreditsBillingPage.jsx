import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiRequest } from "../lib/workspace-platform-client.js";
import "../styles/credits-billing.css";

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

      if (
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

  const voiceRates =
    useMemo(
      () =>
        rateCard.filter(
          (rate) => {
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
              haystack.includes(
                "voice"
              ) ||
              haystack.includes(
                "call"
              ) ||
              haystack.includes(
                "phone"
              )
            );
          }
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
            See the workspace
            balance, current
            published feature
            rates, recent usage and
            credit purchases. Prices
            and credit quantities for
            checkout are always
            loaded from ReachFly&apos;s
            server-owned catalog.
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

      <section
        className="rf-credit-metrics"
        aria-label="Credit balance"
      >
        <Metric
          label="Available credits"
          value={formatCredits(
            wallet.balance
          )}
          note="Available for new billable work"
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
          note="Successfully settled usage"
        />

        <Metric
          label="Purchased"
          value={formatCredits(
            wallet.totalPurchased
          )}
          note="Credits bought by this workspace"
        />

        {Number(
          wallet.debt || 0
        ) > 0 ? (
          <Metric
            label="Credit debt"
            value={formatCredits(
              wallet.debt
            )}
            note="Future purchased credits may first reduce this balance"
          />
        ) : null}
      </section>

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
          Published feature rates
        </h2>

        <p className="rf-credit-muted">
          This table is loaded from
          the current ReachFly rate
          card. The browser does not
          hard-code commercial
          rates.
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
              {rateCard.length ? (
                rateCard.map(
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
                    No feature
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
          AI calling &amp; credits
        </h2>

        {voiceRates.length ? (
          <>
            <p className="rf-credit-muted">
              ReachFly currently
              publishes the following
              calling-related rate
              entries. These server
              values are the source
              of truth for this
              wallet.
            </p>

            <div className="rf-credit-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      Calling item
                    </th>
                    <th>
                      Unit
                    </th>
                    <th>
                      Credits
                    </th>
                    <th>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {voiceRates.map(
                    (rate) => (
                      <tr
                        key={
                          rate.feature
                        }
                      >
                        <td>
                          {rate.label ||
                            formatFeature(
                              rate.feature
                            )}
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
                            : "—"}
                        </td>

                        <td>
                          {rate.billable
                            ? "Published"
                            : "Not billed from this wallet"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rf-credit-empty">
            No AI-calling rate is
            currently published in
            this workspace credit
            wallet. Do not infer
            voice-call pricing from
            the general ReachFly
            feature rates above.
          </div>
        )}
      </section>

      <section className="rf-credit-panel">
        <h2>
          Recent usage
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
          Credit purchases
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
          Balance activity
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

function getGrantMessage(
  data
) {
  if (
    !data?.testGrantEnabled
  ) {
    return "Automatic test-credit grants are disabled in this environment.";
  }

  const amount =
    Number(
      data?.freeTestCredits ||
        0
    );

  if (amount > 0) {
    return `This environment may apply one non-renewing test grant of ${formatCredits(
      amount
    )} credits per eligible workspace.`;
  }

  return "This environment may apply a one-time, non-renewing test-credit grant to eligible workspaces.";
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
