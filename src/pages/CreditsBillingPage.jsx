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
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Phone,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  X,
} from "../components/icons";

import { Link } from "react-router-dom";
import { apiRequest } from "../lib/workspace-platform-client.js";

const PAYMENT_REFRESH_DELAYS_MS = [
  1500,
  3500,
  7000,
];

const HISTORY_TABS = [
  ["transactions", "Transactions"],
  ["usage", "Usage"],
  ["rates", "Rates"],
];

export default function CreditsBillingPage() {
  const mountedRef = useRef(true);

  const [data, setData] = useState(null);
  const [commerce, setCommerce] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingGeneral, setBuyingGeneral] = useState("");
  const [buyingAi, setBuyingAi] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [historyTab, setHistoryTab] = useState("transactions");

  const load = useCallback(
    async ({
      background = false,
      successToast = false,
    } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [
          billingResult,
          commerceResult,
        ] = await Promise.allSettled([
          apiRequest(
            "/billing/credits",
            {
              timeoutMs: 20_000,
            }
          ),
          apiRequest(
            "/voice-commerce",
            {
              timeoutMs: 20_000,
            }
          ),
        ]);

        if (!mountedRef.current) {
          return null;
        }

        if (
          billingResult.status ===
          "fulfilled"
        ) {
          setData(
            billingResult.value ||
            {}
          );
          setError("");

          if (
            successToast
          ) {
            notify(
              "success",
              "Billing refreshed",
              "Latest credit balances, purchases, and usage are now visible."
            );
          }
        } else {
          const text =
            safeMessage(
              billingResult.reason
                ?.message ||
                "Credits and usage could not be loaded."
            );

          setError(text);

          if (
            successToast
          ) {
            notify(
              "error",
              "Billing refresh failed",
              text
            );
          }
        }

        if (
          commerceResult.status ===
          "fulfilled"
        ) {
          setCommerce(
            commerceResult.value ||
            {}
          );
        } else {
          /*
           * Business-number context is supplemental on Billing.
           * A number-commerce outage must not hide the credit wallets.
           */
          setCommerce(null);
        }

        return billingResult.status ===
          "fulfilled"
          ? billingResult.value
          : null;
      } finally {
        if (
          mountedRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  useEffect(() => {
    let disposed =
      false;

    const timers = [];

    async function initialize() {
      await load();

      if (disposed) {
        return;
      }

      const params =
        new URLSearchParams(
          window.location.search
        );

      const paymentState =
        params.get(
          "payment"
        );

      const voicePaymentState =
        params.get(
          "voicePayment"
        );

      if (
        voicePaymentState ===
        "success"
      ) {
        const text =
          "AI call-credit payment returned successfully. ReachFly is verifying the payment before funding the dedicated calling wallet.";

        setMessage(text);

        notify(
          "info",
          "Verifying AI call-credit payment",
          "Your balance will refresh automatically after the verified payment is settled."
        );

        schedulePaymentRefreshes(
          timers,
          () =>
            !disposed &&
            void load({
              background:
                true,
            })
        );

        clearPaymentQuery();
      } else if (
        voicePaymentState ===
        "cancelled"
      ) {
        const text =
          "AI call-credit purchase was cancelled. No call credits were added.";

        setMessage(text);

        notify(
          "warning",
          "AI call-credit purchase cancelled",
          "No AI call credits were added."
        );

        clearPaymentQuery();
      } else if (
        paymentState ===
        "success"
      ) {
        const text =
          "Payment returned successfully. ReachFly is verifying the payment before adding workspace credits.";

        setMessage(text);

        notify(
          "info",
          "Verifying credit purchase",
          "Your workspace balance will refresh automatically after the payment is verified."
        );

        schedulePaymentRefreshes(
          timers,
          () =>
            !disposed &&
            void load({
              background:
                true,
            })
        );

        clearPaymentQuery();
      } else if (
        paymentState ===
        "cancelled"
      ) {
        const text =
          "Credit purchase was cancelled. No workspace credits were added.";

        setMessage(text);

        notify(
          "warning",
          "Credit purchase cancelled",
          "No workspace credits were added."
        );

        clearPaymentQuery();
      }
    }

    void initialize();

    return () => {
      disposed =
        true;

      timers.forEach(
        (timer) =>
          window.clearTimeout(
            timer
          )
      );
    };
  }, [
    load,
  ]);

  const wallet =
    data?.wallet &&
    typeof data.wallet ===
      "object"
      ? data.wallet
      : {};

  const aiCalling =
    data?.aiCalling &&
    typeof data.aiCalling ===
      "object"
      ? data.aiCalling
      : null;

  const aiWallet =
    aiCalling?.wallet &&
    typeof aiCalling.wallet ===
      "object"
      ? aiCalling.wallet
      : {};

  const aiPolicy =
    aiCalling?.policy &&
    typeof aiCalling.policy ===
      "object"
      ? aiCalling.policy
      : {};

  const generalPacks =
    useMemo(
      () =>
        normalizePacks(
          data?.packs
        ),
      [
        data?.packs,
      ]
    );

  const aiPacks =
    useMemo(
      () =>
        normalizePacks(
          aiCalling?.packs
        ),
      [
        aiCalling?.packs,
      ]
    );

  const generalRates =
    useMemo(
      () =>
        normalizeCollection(
          data?.rateCard
        ).filter(
          (rate) =>
            !isCallingRate(
              rate
            )
        ),
      [
        data?.rateCard,
      ]
    );

  const generalUsage =
    useMemo(
      () =>
        normalizeCollection(
          data?.usage
        ),
      [
        data?.usage,
      ]
    );

  const aiUsage =
    useMemo(
      () =>
        normalizeCollection(
          aiCalling?.usage
        ),
      [
        aiCalling?.usage,
      ]
    );

  const generalLedger =
    useMemo(
      () =>
        normalizeCollection(
          data?.ledger
        ),
      [
        data?.ledger,
      ]
    );

  const aiLedger =
    useMemo(
      () =>
        normalizeCollection(
          aiCalling?.ledger
        ),
      [
        aiCalling?.ledger,
      ]
    );

  const transactions =
    useMemo(
      () =>
        buildTransactions(
          data,
          aiCalling
        ),
      [
        aiCalling,
        data,
      ]
    );

  const activeNumbers =
    useMemo(
      () =>
        normalizeNumbers(
          commerce?.numbers
        ).filter(
          (number) =>
            normalizeStatus(
              number.status
            ) ===
            "active"
        ),
      [
        commerce?.numbers,
      ]
    );

  const primaryNumber =
    commerce?.activeNumber
      ?.phoneNumber
      ? commerce.activeNumber
      : activeNumbers[0] ||
        null;

  const secureCheckoutReady =
    Boolean(
      data?.safepay
        ?.configured
    );

  const canPurchaseGeneral =
    Boolean(
      data?.canPurchase
    );

  const canPurchaseAi =
    Boolean(
      aiCalling?.canPurchase
    );

  const requiresPurchasedNumber =
    Boolean(
      aiCalling
        ?.requiresPurchasedNumber
    );

  const hasActivePurchasedNumber =
    Boolean(
      aiCalling
        ?.hasActivePurchasedNumber
    );

  const generalUsed =
    Number(
      wallet.totalConsumed ||
      0
    );

  const aiUsed =
    Number(
      aiWallet.totalConsumed ||
      0
    );

  const aiBalance =
    Number(
      aiWallet.balance ||
      0
    );

  const generalBalance =
    Number(
      wallet.balance ||
      0
    );

  const aiCreditCapacity =
    Math.max(
      0,
      aiBalance +
        aiUsed
    );

  const aiUsedPercent =
    aiCreditCapacity >
    0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              aiUsed /
              aiCreditCapacity
            ) *
              100
          )
        )
      : 0;

  const debt =
    Number(
      wallet.debt ||
      0
    );

  async function buyGeneralCredits(
    packId
  ) {
    if (
      !packId ||
      buyingGeneral
    ) {
      return;
    }

    setBuyingGeneral(
      packId
    );
    setError("");
    setMessage("");

    try {
      /*
       * Commercial values remain server-owned.
       * React intentionally sends only the selected pack id.
       */
      const result =
        await apiRequest(
          "/billing/credits/checkout",
          {
            method:
              "POST",
            body: {
              packId,
            },
            timeoutMs:
              30_000,
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
    } catch (
      requestError
    ) {
      const text =
        safeMessage(
          requestError?.message ||
            "Could not start workspace-credit checkout."
        );

      setError(text);
      setBuyingGeneral(
        ""
      );

      notify(
        "error",
        "Checkout unavailable",
        text
      );
    }
  }

  async function buyAiCallCredits(
    packId
  ) {
    if (
      !packId ||
      buyingAi
    ) {
      return;
    }

    setBuyingAi(
      packId
    );
    setError("");
    setMessage("");

    try {
      const result =
        await apiRequest(
          "/billing/ai-calling/checkout",
          {
            method:
              "POST",
            body: {
              packId,
            },
            timeoutMs:
              30_000,
          }
        );

      if (
        !result?.checkoutUrl ||
        !/^https?:\/\//i.test(
          result.checkoutUrl
        )
      ) {
        throw new Error(
          "Secure AI call-credit checkout could not be opened."
        );
      }

      window.location.assign(
        result.checkoutUrl
      );
    } catch (
      requestError
    ) {
      const text =
        safeMessage(
          requestError?.message ||
            "Could not start AI call-credit checkout."
        );

      setError(text);
      setBuyingAi(
        ""
      );

      notify(
        "error",
        "AI calling checkout unavailable",
        text
      );
    }
  }

  function exportTransactions() {
    if (
      !transactions.length
    ) {
      notify(
        "info",
        "Nothing to export",
        "No credit transactions are available yet."
      );

      return;
    }

    const rows = [
      [
        "Date",
        "Wallet",
        "Description",
        "Credits",
        "Amount",
        "Status",
      ],
      ...transactions.map(
        (
          item
        ) => [
          formatCsvDate(
            item.date
          ),
          item.walletLabel,
          item.description,
          item.credits,
          item.amountMinor !==
            null
            ? formatMoneyMinor(
                item.amountMinor,
                item.currency
              )
            : "",
          item.statusLabel,
        ]
      ),
    ];

    downloadCsv(
      "reachfly-billing-transactions.csv",
      rows
    );

    notify(
      "success",
      "CSV exported",
      "Billing transaction history has been exported."
    );
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

      <main className="rf-billing-v7">
        <header className="rfb-page-header">
          <div>
            <span className="rfb-eyebrow">
              Workspace
            </span>

            <h1>
              Billing &amp; Credits
            </h1>

            <p>
              Manage prepaid ReachFly workspace credits and dedicated AI
              calling credits without mixing the two wallets.
            </p>
          </div>

          <div className="rfb-header-actions">
            <Link
              className="rfb-btn rfb-btn-secondary"
              to="/app/phone-numbers"
            >
              <Phone size={15} />

              Business Numbers
            </Link>

            <button
              type="button"
              className="rfb-btn rfb-btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void load({
                  background:
                    true,
                  successToast:
                    true,
                })
              }
            >
              <RefreshCw
                size={15}
                className={
                  refreshing
                    ? "spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <Notice
            type="error"
            title="Billing needs attention"
          >
            {error}
          </Notice>
        ) : null}

        {message ? (
          <Notice
            type="info"
            title="Payment update"
          >
            {message}
          </Notice>
        ) : null}

        <section className="rfb-summary-grid">
          <SummaryCard
            label="Workspace Credits"
            value={
              formatCredits(
                generalBalance
              )
            }
            note="Available for general ReachFly usage"
            icon={
              <Sparkles size={17} />
            }
          />

          <SummaryCard
            label="AI Call Credits"
            value={
              formatCredits(
                aiBalance
              )
            }
            note="Dedicated connected-call wallet"
            icon={
              <Phone size={17} />
            }
            accent
            progress={
              aiCreditCapacity >
              0
                ? aiUsedPercent
                : null
            }
          />

          <SummaryCard
            label="General Credits Used"
            value={
              formatCredits(
                generalUsed
              )
            }
            note={`${formatCredits(
              wallet.reserved ||
              0
            )} currently reserved`}
            icon={
              <Clock3 size={17} />
            }
          />

          <SummaryCard
            label="AI Calls Settled"
            value={
              formatCredits(
                aiUsed
              )
            }
            note={
              getConnectedCallPricingLabel(
                aiPolicy
              )
            }
            icon={
              <CheckCircle2 size={17} />
            }
          />
        </section>

        {debt >
        0 ? (
          <section className="rfb-debt-warning">
            <Shield size={15} />

            <div>
              <strong>
                Workspace credit debt:{" "}
                {formatCredits(
                  debt
                )}
              </strong>

              <p>
                Future workspace-credit purchases may first reduce this balance
                before increasing available credits.
              </p>
            </div>
          </section>
        ) : null}

        <section className="rfb-main-grid">
          <div className="rfb-main-column">
            <section className="rfb-section-card">
              <SectionHeading
                eyebrow="AI Voice"
                title="Purchase AI Call Credits"
                text="These packs fund only AI Voice connected calls. General workspace credits do not increase this balance."
                badge={
                  aiBalance >
                  0
                    ? "Calling funded"
                    : "Funding required"
                }
                badgeTone={
                  aiBalance >
                  0
                    ? "success"
                    : "warning"
                }
              />

              {requiresPurchasedNumber &&
              !hasActivePurchasedNumber ? (
                <ActionEmpty
                  icon={
                    <Phone size={20} />
                  }
                  title="Activate a business number first"
                  text="ReachFly requires an active purchased business number before standalone AI call credits can be purchased."
                >
                  <Link
                    className="rfb-btn rfb-btn-primary"
                    to="/app/phone-numbers"
                  >
                    Choose Business Number

                    <ChevronRight size={13} />
                  </Link>
                </ActionEmpty>
              ) : !canPurchaseAi ? (
                <ActionEmpty
                  icon={
                    <Shield size={20} />
                  }
                  title="Purchase permission required"
                  text="Only a workspace owner or administrator can purchase AI call credits."
                />
              ) : !secureCheckoutReady ? (
                <ActionEmpty
                  icon={
                    <Shield size={20} />
                  }
                  title="Secure checkout unavailable"
                  text="Existing AI call credits remain usable, but new purchases cannot be started right now."
                />
              ) : !aiPacks.length ? (
                <ActionEmpty
                  icon={
                    <Phone size={20} />
                  }
                  title="No AI calling packs available"
                  text="No dedicated AI call-credit packs are currently published."
                />
              ) : (
                <PackGrid
                  packs={
                    aiPacks
                  }
                  type="ai"
                  buyingId={
                    buyingAi
                  }
                  onBuy={(
                    pack
                  ) =>
                    void buyAiCallCredits(
                      pack.id
                    )
                  }
                />
              )}

              <CallingPolicyStrip
                policy={
                  aiPolicy
                }
              />
            </section>

            <section className="rfb-section-card">
              <SectionHeading
                eyebrow="Workspace"
                title="Add Workspace Credits"
                text="General credits fund published ReachFly features such as lead discovery, audits, and other metered workspace actions."
                badge={
                  secureCheckoutReady
                    ? "Secure checkout"
                    : "Checkout unavailable"
                }
                badgeTone={
                  secureCheckoutReady
                    ? "neutral"
                    : "warning"
                }
              />

              {!canPurchaseGeneral ? (
                <ActionEmpty
                  icon={
                    <Shield size={20} />
                  }
                  title="Purchase permission required"
                  text="Only a workspace owner or administrator can purchase workspace credits."
                />
              ) : !secureCheckoutReady ? (
                <ActionEmpty
                  icon={
                    <Shield size={20} />
                  }
                  title="Secure checkout unavailable"
                  text="Existing workspace credits and usage history remain available."
                />
              ) : !generalPacks.length ? (
                <ActionEmpty
                  icon={
                    <Sparkles size={20} />
                  }
                  title="No workspace packs available"
                  text="No paid workspace-credit packs are currently published."
                />
              ) : (
                <PackGrid
                  packs={
                    generalPacks
                  }
                  type="general"
                  buyingId={
                    buyingGeneral
                  }
                  onBuy={(
                    pack
                  ) =>
                    void buyGeneralCredits(
                      pack.id
                    )
                  }
                />
              )}

              <GrantNote
                data={
                  data
                }
              />
            </section>

            <section className="rfb-history-card">
              <header className="rfb-history-head">
                <div>
                  <span className="rfb-eyebrow">
                    Billing Activity
                  </span>

                  <h2>
                    History &amp; Usage
                  </h2>
                </div>

                <div>
                  <div className="rfb-history-tabs">
                    {HISTORY_TABS.map(
                      ([
                        key,
                        label,
                      ]) => (
                        <button
                          type="button"
                          key={
                            key
                          }
                          className={
                            historyTab ===
                            key
                              ? "active"
                              : ""
                          }
                          onClick={() =>
                            setHistoryTab(
                              key
                            )
                          }
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>

                  {historyTab ===
                  "transactions" ? (
                    <button
                      type="button"
                      className="rfb-export-btn"
                      onClick={
                        exportTransactions
                      }
                    >
                      <ExternalLink size={12} />

                      Export CSV
                    </button>
                  ) : null}
                </div>
              </header>

              {historyTab ===
              "transactions" ? (
                <TransactionsTable
                  items={
                    transactions
                  }
                />
              ) : historyTab ===
                "usage" ? (
                <UsageView
                  generalUsage={
                    generalUsage
                  }
                  aiUsage={
                    aiUsage
                  }
                  generalLedger={
                    generalLedger
                  }
                  aiLedger={
                    aiLedger
                  }
                  aiPolicy={
                    aiPolicy
                  }
                />
              ) : (
                <RatesView
                  rates={
                    generalRates
                  }
                  aiPolicy={
                    aiPolicy
                  }
                />
              )}
            </section>
          </div>

          <aside className="rfb-side-column">
            <section className="rfb-side-card">
              <header>
                <span>
                  <Shield size={15} />
                </span>

                <div>
                  <small>
                    Billing model
                  </small>

                  <strong>
                    Prepaid Credits
                  </strong>
                </div>
              </header>

              <div className="rfb-prepaid-copy">
                <p>
                  ReachFly maintains two separate prepaid wallets so CRM usage
                  and AI calling stay transparent.
                </p>

                <div>
                  <span>
                    <CheckCircle2 size={12} />
                  </span>

                  <p>
                    Workspace credits fund general metered features.
                  </p>
                </div>

                <div>
                  <span>
                    <CheckCircle2 size={12} />
                  </span>

                  <p>
                    AI call credits settle connected AI Voice conversations.
                  </p>
                </div>
              </div>
            </section>

            <section className="rfb-side-card">
              <header>
                <span className="violet">
                  <Phone size={15} />
                </span>

                <div>
                  <small>
                    AI Voice
                  </small>

                  <strong>
                    Active Numbers
                  </strong>
                </div>
              </header>

              {activeNumbers.length ? (
                <div className="rfb-number-stack">
                  {activeNumbers
                    .slice(
                      0,
                      4
                    )
                    .map(
                      (
                        number,
                        index
                      ) => (
                        <article
                          key={
                            number.id ||
                            number.phoneNumber ||
                            index
                          }
                        >
                          <span>
                            <Phone size={12} />
                          </span>

                          <div>
                            <strong>
                              {formatPhone(
                                number.phoneNumber
                              )}
                            </strong>

                            <small>
                              {formatCallingMode(
                                number.callingMode
                              )}
                            </small>
                          </div>

                          {primaryNumber &&
                          normalizePhoneKey(
                            primaryNumber.phoneNumber
                          ) ===
                            normalizePhoneKey(
                              number.phoneNumber
                            ) ? (
                            <em>
                              Primary
                            </em>
                          ) : (
                            <em className="active">
                              Active
                            </em>
                          )}
                        </article>
                      )
                    )}

                  <Link
                    className="rfb-side-link"
                    to="/app/phone-numbers"
                  >
                    Manage Business Numbers

                    <ChevronRight size={12} />
                  </Link>
                </div>
              ) : (
                <div className="rfb-side-empty">
                  <p>
                    No active business number is currently visible to Billing.
                  </p>

                  <Link
                    className="rfb-btn rfb-btn-secondary"
                    to="/app/phone-numbers"
                  >
                    <Plus size={12} />

                    Add Number
                  </Link>
                </div>
              )}
            </section>

            <section className="rfb-side-card">
              <header>
                <span className="green">
                  <Bot size={15} />
                </span>

                <div>
                  <small>
                    AI Calling Policy
                  </small>

                  <strong>
                    Connected Calls
                  </strong>
                </div>
              </header>

              <dl className="rfb-policy-list">
                <PolicyRow
                  label="Per connected call"
                  value={
                    Number(
                      aiPolicy
                        ?.creditsPerConnectedCall ||
                        0
                    ) >
                    0
                      ? `${formatCredits(
                          aiPolicy
                            .creditsPerConnectedCall
                        )} credit${
                          Number(
                            aiPolicy
                              .creditsPerConnectedCall
                          ) ===
                          1
                            ? ""
                            : "s"
                        }`
                      : "Not published"
                  }
                />

                <PolicyRow
                  label="Retail price"
                  value={
                    Number(
                      aiPolicy
                        ?.connectedCallPriceMinor ||
                        0
                    ) >
                    0
                      ? formatMoneyMinor(
                          aiPolicy
                            .connectedCallPriceMinor,
                          aiPolicy
                            .currency
                        )
                      : "Not published"
                  }
                />

                <PolicyRow
                  label="Max duration"
                  value={
                    aiPolicy
                      ?.durationPolicyConfigured &&
                    Number(
                      aiPolicy
                        ?.maxConnectedSeconds ||
                        0
                    ) >
                      0
                      ? formatCallDuration(
                          aiPolicy
                            .maxConnectedSeconds
                        )
                      : "Not configured"
                  }
                />

                <PolicyRow
                  label="Wallet status"
                  value={
                    aiBalance >
                    0
                      ? "Funded"
                      : "No call credits"
                  }
                />
              </dl>

              <Link
                className="rfb-side-link"
                to="/app/calls"
              >
                Open Call Logs

                <ChevronRight size={12} />
              </Link>
            </section>

            <section className="rfb-side-card">
              <header>
                <span>
                  <Building2 size={15} />
                </span>

                <div>
                  <small>
                    Checkout
                  </small>

                  <strong>
                    Payment Security
                  </strong>
                </div>
              </header>

              <div className="rfb-checkout-state">
                <span
                  className={
                    secureCheckoutReady
                      ? "ready"
                      : "pending"
                  }
                >
                  {secureCheckoutReady ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <Clock3 size={12} />
                  )}

                  {secureCheckoutReady
                    ? "Hosted checkout ready"
                    : "Checkout unavailable"}
                </span>

                <p>
                  Payment details are collected on the secure hosted checkout.
                  ReachFly does not ask you to enter card details on this page.
                </p>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon,
  accent = false,
  progress = null,
}) {
  return (
    <article
      className={`rfb-summary-card ${
        accent
          ? "accent"
          : ""
      }`}
    >
      <header>
        <span>
          {label}
        </span>

        <i>
          {icon}
        </i>
      </header>

      <strong>
        {value}
      </strong>

      <small>
        {note}
      </small>

      {progress !==
      null ? (
        <div className="rfb-progress">
          <span>
            <i
              style={{
                "--rfb-progress":
                  `${progress}%`,
              }}
            />
          </span>

          <small>
            {progress.toFixed(
              0
            )}
            % used
          </small>
        </div>
      ) : null}
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
  badge,
  badgeTone = "neutral",
}) {
  return (
    <header className="rfb-section-head">
      <div>
        <span className="rfb-eyebrow">
          {eyebrow}
        </span>

        <h2>
          {title}
        </h2>

        <p>
          {text}
        </p>
      </div>

      {badge ? (
        <span
          className={`rfb-section-badge ${badgeTone}`}
        >
          {badge}
        </span>
      ) : null}
    </header>
  );
}

function PackGrid({
  packs,
  type,
  buyingId,
  onBuy,
}) {
  return (
    <div className="rfb-pack-grid">
      {packs.map(
        (
          pack,
          index
        ) => (
          <article
            key={
              pack.id
            }
            className={`rfb-pack ${
              type ===
              "ai"
                ? "ai"
                : ""
            }`}
            style={{
              "--rfb-index":
                index,
            }}
          >
            <header>
              <span>
                {type ===
                "ai"
                  ? "AI Calling"
                  : formatMarket(
                      pack.market
                    )}
              </span>

              <i>
                {type ===
                "ai" ? (
                  <Phone size={14} />
                ) : (
                  <Sparkles size={14} />
                )}
              </i>
            </header>

            <div>
              <strong>
                {formatCredits(
                  pack.credits
                )}
              </strong>

              <span>
                {type ===
                "ai"
                  ? `Call credit${
                      Number(
                        pack.credits
                      ) ===
                      1
                        ? ""
                        : "s"
                    }`
                  : "Workspace credits"}
              </span>
            </div>

            <footer>
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
                    buyingId
                  )
                }
                onClick={() =>
                  onBuy(
                    pack
                  )
                }
              >
                {buyingId ===
                pack.id ? (
                  <RefreshCw
                    size={12}
                    className="spin"
                  />
                ) : null}

                {buyingId ===
                pack.id
                  ? "Opening…"
                  : "Buy"}
              </button>
            </footer>
          </article>
        )
      )}
    </div>
  );
}

function CallingPolicyStrip({
  policy,
}) {
  const credits =
    Number(
      policy
        ?.creditsPerConnectedCall ||
        0
    );

  const price =
    Number(
      policy
        ?.connectedCallPriceMinor ||
        0
    );

  const durationConfigured =
    Boolean(
      policy
        ?.durationPolicyConfigured
    ) &&
    Number(
      policy
        ?.maxConnectedSeconds ||
        0
    ) >
      0;

  if (
    !credits &&
    !price &&
    !durationConfigured
  ) {
    return null;
  }

  return (
    <div className="rfb-policy-strip">
      <div>
        <span>
          Connected-call charge
        </span>

        <strong>
          {credits >
          0
            ? `${formatCredits(
                credits
              )} call credit${
                credits ===
                1
                  ? ""
                  : "s"
              }`
            : "Not published"}
        </strong>
      </div>

      <i />

      <div>
        <span>
          Retail price
        </span>

        <strong>
          {price >
          0
            ? formatMoneyMinor(
                price,
                policy.currency
              )
            : "Not published"}
        </strong>
      </div>

      <i />

      <div>
        <span>
          Duration policy
        </span>

        <strong>
          {durationConfigured
            ? formatCallDuration(
                policy
                  .maxConnectedSeconds
              )
            : "Not configured"}
        </strong>
      </div>
    </div>
  );
}

function GrantNote({
  data,
}) {
  const text =
    getGrantMessage(
      data
    );

  return (
    <div className="rfb-grant-note">
      <Shield size={13} />

      <p>
        {text} General workspace packs do not add AI call credits.
      </p>
    </div>
  );
}

function ActionEmpty({
  icon,
  title,
  text,
  children,
}) {
  return (
    <div className="rfb-action-empty">
      <span>
        {icon}
      </span>

      <strong>
        {title}
      </strong>

      <p>
        {text}
      </p>

      {children ? (
        <div>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function TransactionsTable({
  items,
}) {
  if (
    !items.length
  ) {
    return (
      <div className="rfb-history-empty">
        <span>
          <Building2 size={20} />
        </span>

        <strong>
          No paid credit purchases yet
        </strong>

        <p>
          Verified workspace and AI call-credit purchases will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rfb-table-wrap">
        <table className="rfb-table">
          <thead>
            <tr>
              <th>
                Date
              </th>

              <th>
                Description
              </th>

              <th>
                Wallet
              </th>

              <th className="right">
                Credits
              </th>

              <th className="right">
                Amount
              </th>

              <th className="center">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {items
              .slice(
                0,
                50
              )
              .map(
                (
                  item,
                  index
                ) => (
                  <tr
                    key={
                      item.id ||
                      `${item.date}-${index}`
                    }
                  >
                    <td>
                      {formatShortDate(
                        item.date
                      )}
                    </td>

                    <td>
                      <strong>
                        {item.description}
                      </strong>
                    </td>

                    <td>
                      <WalletBadge
                        type={
                          item.wallet
                        }
                      />
                    </td>

                    <td className="right">
                      {formatCredits(
                        item.credits
                      )}
                    </td>

                    <td className="right">
                      {item.amountMinor !==
                      null
                        ? formatMoneyMinor(
                            item.amountMinor,
                            item.currency
                          )
                        : "—"}
                    </td>

                    <td className="center">
                      <PurchaseStatus
                        status={
                          item.status
                        }
                      />
                    </td>
                  </tr>
                )
              )}
          </tbody>
        </table>
      </div>

      <div className="rfb-mobile-history">
        {items
          .slice(
            0,
            50
          )
          .map(
            (
              item,
              index
            ) => (
              <article
                key={
                  item.id ||
                  `${item.date}-${index}`
                }
              >
                <div>
                  <strong>
                    {item.description}
                  </strong>

                  <small>
                    {formatShortDate(
                      item.date
                    )}
                  </small>
                </div>

                <WalletBadge
                  type={
                    item.wallet
                  }
                />

                <div>
                  <strong>
                    {item.amountMinor !==
                    null
                      ? formatMoneyMinor(
                          item.amountMinor,
                          item.currency
                        )
                      : `${formatCredits(
                          item.credits
                        )} credits`}
                  </strong>

                  <PurchaseStatus
                    status={
                      item.status
                    }
                  />
                </div>
              </article>
            )
          )}
      </div>
    </>
  );
}

function UsageView({
  generalUsage,
  aiUsage,
  generalLedger,
  aiLedger,
  aiPolicy,
}) {
  return (
    <div className="rfb-usage-layout">
      <UsageSection
        title="Recent Workspace Usage"
        subtitle="Settled metered activity from the general workspace wallet."
        items={
          generalUsage
        }
        type="general"
      />

      <UsageSection
        title="Recent AI Connected Calls"
        subtitle="Connected-call settlements from the dedicated AI calling wallet."
        items={
          aiUsage
        }
        type="ai"
        policy={
          aiPolicy
        }
      />

      <LedgerSection
        title="Workspace Wallet Activity"
        items={
          generalLedger
        }
        type="general"
      />

      <LedgerSection
        title="AI Call-Credit Activity"
        items={
          aiLedger
        }
        type="ai"
      />
    </div>
  );
}

function UsageSection({
  title,
  subtitle,
  items,
  type,
  policy,
}) {
  const durationConfigured =
    Boolean(
      policy
        ?.durationPolicyConfigured
    ) &&
    Number(
      policy
        ?.maxConnectedSeconds ||
        0
    ) >
      0;

  return (
    <section className="rfb-usage-section">
      <header>
        <div>
          <h3>
            {title}
          </h3>

          <p>
            {subtitle}
          </p>
        </div>

        <WalletBadge
          type={
            type
          }
        />
      </header>

      {items.length ? (
        <div className="rfb-table-wrap compact">
          <table className="rfb-table">
            <thead>
              <tr>
                <th>
                  Activity
                </th>

                {type ===
                "general" ? (
                  <th>
                    Quantity
                  </th>
                ) : (
                  <th>
                    Duration
                  </th>
                )}

                <th>
                  Credits
                </th>

                {type ===
                "ai" ? (
                  <th>
                    Policy
                  </th>
                ) : null}

                <th>
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {items
                .slice(
                  0,
                  30
                )
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
                        {type ===
                        "ai"
                          ? "Connected AI call"
                          : formatFeature(
                              item.feature
                            )}
                      </td>

                      <td>
                        {type ===
                        "ai"
                          ? formatCallDuration(
                              item.durationSeconds
                            )
                          : `${formatCredits(
                              item.quantity
                            )} ${
                              item.unit ||
                              ""
                            }`}
                      </td>

                      <td>
                        {formatCredits(
                          item.credits
                        )}
                      </td>

                      {type ===
                      "ai" ? (
                        <td>
                          {item.overDurationPolicy
                            ? "Exceeded duration policy"
                            : durationConfigured
                              ? "Within duration policy"
                              : "No duration policy published"}
                        </td>
                      ) : null}

                      <td>
                        {formatShortDate(
                          item.createdAt
                        )}
                      </td>
                    </tr>
                  )
                )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rfb-inline-empty">
          No settled usage yet.
        </div>
      )}
    </section>
  );
}

function LedgerSection({
  title,
  items,
  type,
}) {
  return (
    <section className="rfb-usage-section">
      <header>
        <div>
          <h3>
            {title}
          </h3>

          <p>
            Credit grants, purchases, reservations, settlements, and other
            wallet movements.
          </p>
        </div>

        <WalletBadge
          type={
            type
          }
        />
      </header>

      {items.length ? (
        <div className="rfb-table-wrap compact">
          <table className="rfb-table">
            <thead>
              <tr>
                <th>
                  Activity
                </th>

                <th>
                  Change
                </th>

                <th>
                  Balance After
                </th>

                {type ===
                "general" ? (
                  <th>
                    Reserved After
                  </th>
                ) : (
                  <th>
                    Duration
                  </th>
                )}

                <th>
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {items
                .slice(
                  0,
                  30
                )
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
                        {type ===
                        "ai"
                          ? formatAiLedgerActivity(
                              item
                            )
                          : formatLedgerActivity(
                              item
                            )}
                      </td>

                      <td>
                        <span
                          className={`rfb-delta ${
                            Number(
                              item.delta ||
                              0
                            ) >
                            0
                              ? "positive"
                              : Number(
                                    item.delta ||
                                    0
                                  ) <
                                  0
                                ? "negative"
                                : ""
                          }`}
                        >
                          {formatSignedCredits(
                            item.delta
                          )}
                        </span>
                      </td>

                      <td>
                        {formatCredits(
                          item.balanceAfter
                        )}
                      </td>

                      <td>
                        {type ===
                        "general"
                          ? formatCredits(
                              item.reservedAfter
                            )
                          : Number(
                                item.durationSeconds ||
                                0
                              ) >
                              0
                            ? formatCallDuration(
                                item.durationSeconds
                              )
                            : "—"}
                      </td>

                      <td>
                        {formatShortDate(
                          item.createdAt
                        )}
                      </td>
                    </tr>
                  )
                )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rfb-inline-empty">
          No wallet activity yet.
        </div>
      )}
    </section>
  );
}

function RatesView({
  rates,
  aiPolicy,
}) {
  return (
    <div className="rfb-rates-layout">
      <section className="rfb-usage-section">
        <header>
          <div>
            <h3>
              General ReachFly Feature Rates
            </h3>

            <p>
              Published server-owned rates for the general workspace wallet.
            </p>
          </div>

          <WalletBadge type="general" />
        </header>

        {rates.length ? (
          <div className="rfb-table-wrap compact">
            <table className="rfb-table">
              <thead>
                <tr>
                  <th>
                    Feature
                  </th>

                  <th>
                    Unit
                  </th>

                  <th>
                    Credits / Unit
                  </th>

                  <th>
                    Charging Rule
                  </th>
                </tr>
              </thead>

              <tbody>
                {rates.map(
                  (
                    rate,
                    index
                  ) => (
                    <tr
                      key={
                        rate.feature ||
                        index
                      }
                    >
                      <td>
                        <strong>
                          {rate.label ||
                            formatFeature(
                              rate.feature
                            )}
                        </strong>
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
                          (
                            rate.billable
                              ? "Charged after successful settled usage."
                              : "This feature is not currently billed."
                          )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rfb-inline-empty">
            No general feature rates are currently published.
          </div>
        )}
      </section>

      <section className="rfb-usage-section">
        <header>
          <div>
            <h3>
              AI Calling Rate
            </h3>

            <p>
              The dedicated AI calling policy is authoritative for connected
              call charging.
            </p>
          </div>

          <WalletBadge type="ai" />
        </header>

        <div className="rfb-rate-cards">
          <RateCard
            label="Connected-call charge"
            value={
              Number(
                aiPolicy
                  ?.creditsPerConnectedCall ||
                  0
              ) >
              0
                ? `${formatCredits(
                    aiPolicy
                      .creditsPerConnectedCall
                  )} call credit${
                    Number(
                      aiPolicy
                        .creditsPerConnectedCall
                    ) ===
                    1
                      ? ""
                      : "s"
                  }`
                : "Not published"
            }
          />

          <RateCard
            label="Retail price"
            value={
              Number(
                aiPolicy
                  ?.connectedCallPriceMinor ||
                  0
              ) >
              0
                ? formatMoneyMinor(
                    aiPolicy
                      .connectedCallPriceMinor,
                    aiPolicy
                      .currency
                  )
                : "Not published"
            }
          />

          <RateCard
            label="Max connected duration"
            value={
              aiPolicy
                ?.durationPolicyConfigured &&
              Number(
                aiPolicy
                  ?.maxConnectedSeconds ||
                  0
              ) >
                0
                ? formatCallDuration(
                    aiPolicy
                      .maxConnectedSeconds
                  )
                : "Not configured"
            }
          />
        </div>

        {aiPolicy?.chargingRule ? (
          <div className="rfb-policy-description">
            <Sparkles size={13} />

            <p>
              {aiPolicy.chargingRule}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function RateCard({
  label,
  value,
}) {
  return (
    <article>
      <small>
        {label}
      </small>

      <strong>
        {value}
      </strong>
    </article>
  );
}

function WalletBadge({
  type,
}) {
  return (
    <span
      className={`rfb-wallet-badge ${
        type ===
        "ai"
          ? "ai"
          : "general"
      }`}
    >
      {type ===
      "ai" ? (
        <Phone size={10} />
      ) : (
        <Sparkles size={10} />
      )}

      {type ===
      "ai"
        ? "AI Calling"
        : "Workspace"}
    </span>
  );
}

function PurchaseStatus({
  status,
}) {
  const normalized =
    normalizeStatus(
      status
    );

  const tone =
    [
      "succeeded",
      "complete",
      "completed",
      "paid",
    ].includes(
      normalized
    )
      ? "paid"
      : [
            "failed",
            "refunded",
          ].includes(
            normalized
          )
        ? "failed"
        : [
              "cancelled",
              "canceled",
            ].includes(
              normalized
            )
          ? "cancelled"
          : "pending";

  return (
    <span
      className={`rfb-purchase-status ${tone}`}
    >
      {formatStatus(
        normalized
      )}
    </span>
  );
}

function PolicyRow({
  label,
  value,
}) {
  return (
    <div>
      <dt>
        {label}
      </dt>

      <dd>
        {value}
      </dd>
    </div>
  );
}

function Notice({
  type,
  title,
  children,
}) {
  return (
    <section
      className={`rfb-notice ${type}`}
      role={
        type ===
        "error"
          ? "alert"
          : "status"
      }
    >
      <span>
        {type ===
        "error" ? (
          <X size={14} />
        ) : (
          <RefreshCw size={14} />
        )}
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <small>
          {children}
        </small>
      </div>
    </section>
  );
}

function BillingSkeleton() {
  return (
    <main
      className="rf-billing-v7"
      aria-busy="true"
      aria-label="Loading billing"
    >
      <header className="rfb-page-header">
        <div>
          <span className="rfb-eyebrow">
            Workspace
          </span>

          <h1>
            Billing &amp; Credits
          </h1>

          <p>
            Loading prepaid balances and billing activity…
          </p>
        </div>
      </header>

      <section className="rfb-summary-grid loading">
        {Array.from({
          length:
            4,
        }).map(
          (
            _,
            index
          ) => (
            <article
              key={
                index
              }
            >
              <i />

              <i />

              <i />
            </article>
          )
        )}
      </section>

      <section className="rfb-main-grid">
        <div className="rfb-main-column">
          <section className="rfb-section-card loading-panel">
            <i />
            <i />
            <i />
          </section>

          <section className="rfb-history-card loading-panel">
            <i />
            <i />
          </section>
        </div>

        <aside className="rfb-side-column">
          <section className="rfb-side-card loading-panel">
            <i />
            <i />
          </section>

          <section className="rfb-side-card loading-panel">
            <i />
            <i />
          </section>
        </aside>
      </section>
    </main>
  );
}

/* ==========================================================================
 * Data helpers
 * ======================================================================= */

function normalizeCollection(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }

  if (
    Array.isArray(
      value?.items
    )
  ) {
    return value.items;
  }

  if (
    Array.isArray(
      value?.data
    )
  ) {
    return value.data;
  }

  return [];
}

function normalizePacks(
  value
) {
  return normalizeCollection(
    value
  )
    .filter(
      (pack) =>
        pack?.active ===
          true &&
        Number(
          pack?.amountMinor ||
          0
        ) >
          0 &&
        Number(
          pack?.credits ||
          0
        ) >
          0
    )
    .sort(
      (
        left,
        right
      ) =>
        Number(
          left?.credits ||
          0
        ) -
        Number(
          right?.credits ||
          0
        )
    );
}

function normalizeNumbers(
  value
) {
  return normalizeCollection(
    value
  )
    .map(
      (
        number,
        index
      ) => ({
        ...number,
        id:
          number.id ||
          number.numberId ||
          number.phoneNumber ||
          `number-${index}`,
      })
    )
    .sort(
      (
        left,
        right
      ) =>
        timestamp(
          right.createdAt
        ) -
        timestamp(
          left.createdAt
        )
    );
}

function buildTransactions(
  data,
  aiCalling
) {
  const general =
    normalizeCollection(
      data?.purchases
    ).map(
      (
        item,
        index
      ) => ({
        id:
          item.id ||
          `general-${index}`,
        wallet:
          "general",
        walletLabel:
          "Workspace",
        description:
          item.description ||
          `${formatCredits(
            item.credits
          )} Workspace Credit Pack`,
        credits:
          Number(
            item.credits ||
            0
          ),
        amountMinor:
          isFiniteNumber(
            item.amountMinor
          )
            ? Number(
                item.amountMinor
              )
            : null,
        currency:
          item.currency ||
          "USD",
        status:
          item.status ||
          "pending",
        statusLabel:
          formatStatus(
            item.status
          ),
        date:
          item.paidAt ||
          item.createdAt ||
          "",
      })
    );

  const ai =
    normalizeCollection(
      aiCalling?.purchases
    ).map(
      (
        item,
        index
      ) => ({
        id:
          item.id ||
          `ai-${index}`,
        wallet:
          "ai",
        walletLabel:
          "AI Calling",
        description:
          item.description ||
          `${formatCredits(
            item.credits
          )} AI Call-Credit Pack`,
        credits:
          Number(
            item.credits ||
            0
          ),
        amountMinor:
          isFiniteNumber(
            item.amountMinor
          )
            ? Number(
                item.amountMinor
              )
            : null,
        currency:
          item.currency ||
          "USD",
        status:
          item.status ||
          "pending",
        statusLabel:
          formatStatus(
            item.status
          ),
        date:
          item.paidAt ||
          item.createdAt ||
          "",
      })
    );

  return [
    ...general,
    ...ai,
  ].sort(
    (
      left,
      right
    ) =>
      timestamp(
        right.date
      ) -
      timestamp(
        left.date
      )
  );
}

function isCallingRate(
  rate
) {
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

function getConnectedCallPricingLabel(
  policy
) {
  const credits =
    Number(
      policy
        ?.creditsPerConnectedCall ||
        0
    );

  if (
    credits >
    0
  ) {
    return `${formatCredits(
      credits
    )} credit${
      credits ===
      1
        ? ""
        : "s"
    } per connected call`;
  }

  return "Connected-call policy";
}

function getGrantMessage(
  data
) {
  if (
    !data
      ?.testGrantEnabled
  ) {
    return "Automatic workspace test-credit grants are disabled in this environment.";
  }

  const amount =
    Number(
      data
        ?.freeTestCredits ||
        0
    );

  if (
    amount >
    0
  ) {
    return `This environment may apply one non-renewing test grant of ${formatCredits(
      amount
    )} workspace credits per eligible workspace.`;
  }

  return "This environment may apply one one-time, non-renewing workspace credit grant to eligible workspaces.";
}

function schedulePaymentRefreshes(
  timers,
  callback
) {
  PAYMENT_REFRESH_DELAYS_MS.forEach(
    (
      delay
    ) => {
      const timer =
        window.setTimeout(
          callback,
          delay
        );

      timers.push(
        timer
      );
    }
  );
}

function clearPaymentQuery() {
  try {
    const url =
      new URL(
        window.location.href
      );

    [
      "payment",
      "purchase",
      "voicePayment",
      "voicePurchase",
    ].forEach(
      (key) =>
        url.searchParams.delete(
          key
        )
    );

    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    // Billing remains usable even when history replacement is unavailable.
  }
}

function formatAiLedgerActivity(
  item
) {
  const type =
    normalizeStatus(
      item?.type
    );

  if (
    type ===
    "connected_call"
  ) {
    return "Connected AI call";
  }

  if (
    type ===
    "test_grant"
  ) {
    return "One-time AI calling test grant";
  }

  if (
    type ===
    "signup_grant"
  ) {
    return "AI calling signup credits";
  }

  if (
    type ===
      "purchase" ||
    type ===
      "credit_purchase"
  ) {
    return "AI call-credit purchase";
  }

  if (
    item?.description
  ) {
    return safeMessage(
      item.description
    );
  }

  return formatFeature(
    type ||
      "AI call-credit activity"
  );
}

function formatLedgerActivity(
  item
) {
  if (
    item?.description
  ) {
    return safeMessage(
      item.description
    );
  }

  return formatFeature(
    item?.type ||
      item?.feature ||
      "credit activity"
  );
}

function formatCallDuration(
  value
) {
  const seconds =
    Math.max(
      0,
      Math.round(
        Number(
          value ||
          0
        )
      )
    );

  if (
    !seconds
  ) {
    return "0 sec";
  }

  if (
    seconds <
    60
  ) {
    return `${seconds} sec`;
  }

  const minutes =
    Math.floor(
      seconds /
      60
    );

  const remainder =
    seconds %
    60;

  if (
    minutes <
    60
  ) {
    return remainder
      ? `${minutes}m ${remainder}s`
      : `${minutes} min`;
  }

  const hours =
    Math.floor(
      minutes /
      60
    );

  const minuteRemainder =
    minutes %
    60;

  return minuteRemainder
    ? `${hours}h ${minuteRemainder}m`
    : `${hours}h`;
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
    Number(
      value ||
      0
    )
  );
}

function formatSignedCredits(
  value
) {
  const number =
    Number(
      value ||
      0
    );

  if (
    !number
  ) {
    return "0";
  }

  return `${
    number >
    0
      ? "+"
      : ""
  }${formatCredits(
    number
  )}`;
}

function formatMoneyMinor(
  value,
  currency = "USD"
) {
  const amount =
    Number(
      value ||
      0
    ) /
    100;

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
      amount
    );
  } catch {
    return `${
      currency ||
      "USD"
    } ${amount.toFixed(
      2
    )}`;
  }
}

function formatMarket(
  value
) {
  const market =
    String(
      value ||
      ""
    )
      .trim()
      .toUpperCase();

  if (
    market ===
    "PAKISTAN"
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
    ? formatFeature(
        market
      )
    : "Workspace";
}

function formatFeature(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}

function formatStatus(
  value
) {
  const status =
    normalizeStatus(
      value
    );

  const labels = {
    created:
      "Created",
    pending:
      "Payment pending",
    payment_pending:
      "Payment pending",
    succeeded:
      "Paid",
    paid:
      "Paid",
    complete:
      "Complete",
    completed:
      "Complete",
    failed:
      "Failed",
    cancelled:
      "Cancelled",
    canceled:
      "Cancelled",
    refunded:
      "Refunded",
  };

  return (
    labels[
      status
    ] ||
    formatFeature(
      status ||
      "unknown"
    )
  );
}

function formatShortDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
    }
  );
}

function formatCsvDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? String(
        value
      )
    : date.toISOString();
}

function formatPhone(
  value
) {
  const text =
    String(
      value ||
      ""
    ).trim();

  if (!text) {
    return "—";
  }

  const digits =
    text.replace(
      /\D+/g,
      ""
    );

  if (
    digits.length ===
      11 &&
    digits.startsWith(
      "1"
    )
  ) {
    return `+1 (${digits.slice(
      1,
      4
    )}) ${digits.slice(
      4,
      7
    )}-${digits.slice(
      7
    )}`;
  }

  return text;
}

function formatCallingMode(
  value
) {
  const mode =
    normalizeStatus(
      value
    );

  if (
    mode ===
    "inbound"
  ) {
    return "Inbound";
  }

  if (
    mode ===
      "both" ||
    mode ===
      "inbound_outbound"
  ) {
    return "Inbound & outbound";
  }

  return "Outbound";
}

function normalizeStatus(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function normalizePhoneKey(
  value
) {
  return String(
    value ||
      ""
  ).replace(
    /\D+/g,
    ""
  );
}

function timestamp(
  value
) {
  if (!value) {
    return 0;
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();
}

function isFiniteNumber(
  value
) {
  return Number.isFinite(
    Number(
      value
    )
  );
}

function safeMessage(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /ElevenLabs/gi,
      "voice runtime"
    )
    .replace(
      /ElevenAgent/gi,
      "voice agent"
    )
    .replace(
      /Telnyx/gi,
      "calling provider"
    )
    .replace(
      /\bSIP\b/gi,
      "voice connection"
    )
    .replace(
      /Safepay/gi,
      "payment provider"
    );
}

function csvEscape(
  value
) {
  const text =
    String(
      value ??
      ""
    );

  if (
    /[",\n]/.test(
      text
    )
  ) {
    return `"${text.replace(
      /"/g,
      '""'
    )}"`;
  }

  return text;
}

function downloadCsv(
  filename,
  rows
) {
  const csv =
    rows
      .map(
        (row) =>
          row
            .map(
              csvEscape
            )
            .join(
              ","
            )
      )
      .join(
        "\n"
      );

  const blob =
    new Blob(
      [
        "\ufeff",
        csv,
      ],
      {
        type:
          "text/csv;charset=utf-8",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;
  anchor.download =
    filename;

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url
  );
}

function notify(
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

/* ==========================================================================
 * Scoped Stitch / ReachFly V7 styling
 * ======================================================================= */

function BillingStyles() {
  return (
    <style>{`
      .rf-billing-v7{
        --rfb-card:#ffffff;
        --rfb-soft:#f3f4f5;
        --rfb-soft2:#edeeef;
        --rfb-text:#191c1d;
        --rfb-text2:#464554;
        --rfb-muted:#767586;
        --rfb-line:#e3e5e7;
        --rfb-primary:#4648d4;
        --rfb-primary-dark:#3537bb;
        --rfb-psoft:#e8e9ff;
        --rfb-violet:#6b38d4;
        --rfb-vsoft:#f0eaff;
        --rfb-success:#087a51;
        --rfb-ssoft:#dff8eb;
        --rfb-warning:#8a6100;
        --rfb-wsoft:#fff4d6;
        --rfb-danger:#ba1a1a;
        --rfb-dsoft:#ffedeb;
        --rfb-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 46px;
        color:var(--rfb-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfbPageIn 260ms var(--rfb-ease);
      }

      .rf-billing-v7 *,
      .rf-billing-v7 *::before,
      .rf-billing-v7 *::after{
        box-sizing:border-box;
      }

      .rf-billing-v7 a{
        color:inherit;
      }

      .rf-billing-v7 .spin{
        animation:rfbSpin 800ms linear infinite;
      }

      @keyframes rfbPageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfbFadeUp{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:none}
      }

      @keyframes rfbSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfbShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfb-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:18px;
      }

      .rfb-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfb-primary);
        font-size:9px;
        font-weight:750;
        line-height:13px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfb-page-header h1{
        margin:0;
        color:var(--rfb-text);
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfb-page-header p{
        max-width:760px;
        margin:3px 0 0;
        color:var(--rfb-text2);
        font-size:13px;
        line-height:19px;
      }

      .rfb-header-actions{
        display:flex;
        gap:8px;
      }

      .rfb-btn{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:7px 12px;
        border:1px solid transparent;
        border-radius:8px;
        text-decoration:none;
        white-space:nowrap;
        cursor:pointer;
        font:600 10px/15px Inter,sans-serif;
        transition:
          color 140ms var(--rfb-ease),
          background 140ms var(--rfb-ease),
          border-color 140ms var(--rfb-ease),
          transform 140ms var(--rfb-ease),
          box-shadow 140ms var(--rfb-ease);
      }

      .rfb-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfb-btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfb-btn-primary{
        color:#fff!important;
        background:var(--rfb-primary);
        border-color:var(--rfb-primary);
        box-shadow:0 5px 14px rgba(70,72,212,.17);
      }

      .rfb-btn-primary:hover:not(:disabled){
        background:var(--rfb-primary-dark);
      }

      .rfb-btn-secondary{
        color:var(--rfb-text)!important;
        background:#fff;
        border-color:var(--rfb-line);
      }

      .rfb-btn-secondary:hover:not(:disabled){
        color:var(--rfb-primary)!important;
        background:var(--rfb-psoft);
      }

      .rfb-notice{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        animation:rfbFadeUp 180ms var(--rfb-ease);
      }

      .rfb-notice > span{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        flex:0 0 26px;
        background:#fff;
        border-radius:7px;
      }

      .rfb-notice > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfb-notice strong{
        font-size:9px;
      }

      .rfb-notice small{
        font-size:8px;
        line-height:13px;
      }

      .rfb-notice.error{
        color:#7d1717;
        background:var(--rfb-dsoft);
        border-color:#ffd0cc;
      }

      .rfb-notice.info{
        color:#343697;
        background:var(--rfb-psoft);
        border-color:#d2d3ff;
      }

      .rfb-summary-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin-bottom:14px;
      }

      .rfb-summary-card{
        min-height:170px;
        display:grid;
        align-content:space-between;
        padding:22px;
        background:#fff;
        border:1px solid var(--rfb-line);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
        animation:rfbFadeUp 210ms var(--rfb-ease) both;
      }

      .rfb-summary-card:nth-child(2){animation-delay:35ms}
      .rfb-summary-card:nth-child(3){animation-delay:70ms}
      .rfb-summary-card:nth-child(4){animation-delay:105ms}

      .rfb-summary-card.accent{
        color:#fff;
        background:linear-gradient(135deg,#494bd8,#4b4ed9 70%,#5b45d8);
        border-color:transparent;
        box-shadow:0 10px 24px rgba(70,72,212,.18);
      }

      .rfb-summary-card header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .rfb-summary-card header > span{
        color:var(--rfb-text2);
        font-size:8px;
        font-weight:700;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .rfb-summary-card.accent header > span{
        color:rgba(255,255,255,.86);
      }

      .rfb-summary-card header > i{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfb-primary);
        background:var(--rfb-psoft);
        border-radius:8px;
        font-style:normal;
      }

      .rfb-summary-card.accent header > i{
        color:#fff;
        background:rgba(255,255,255,.12);
      }

      .rfb-summary-card > strong{
        margin-top:15px;
        font:600 29px/35px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfb-summary-card > small{
        color:var(--rfb-muted);
        font-size:8px;
        line-height:12px;
      }

      .rfb-summary-card.accent > small{
        color:rgba(255,255,255,.74);
      }

      .rfb-progress{
        display:grid;
        gap:5px;
        margin-top:14px;
      }

      .rfb-progress > span{
        height:6px;
        overflow:hidden;
        background:rgba(255,255,255,.2);
        border-radius:999px;
      }

      .rfb-progress > span i{
        width:var(--rfb-progress);
        height:100%;
        display:block;
        background:#fff;
        border-radius:999px;
      }

      .rfb-progress > small{
        color:rgba(255,255,255,.8);
        text-align:right;
        font-size:7px;
      }

      .rfb-debt-warning{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:10px 12px;
        margin-bottom:14px;
        color:#725300;
        background:var(--rfb-wsoft);
        border:1px solid #f7df9e;
        border-radius:9px;
      }

      .rfb-debt-warning > svg{
        flex:0 0 auto;
        margin-top:1px;
      }

      .rfb-debt-warning > div{
        min-width:0;
      }

      .rfb-debt-warning strong{
        display:block;
        font-size:8px;
        line-height:12px;
      }

      .rfb-debt-warning p{
        margin:2px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rfb-main-grid{
        display:grid;
        grid-template-columns:minmax(0,1fr) 310px;
        gap:14px;
        align-items:start;
      }

      .rfb-main-column,
      .rfb-side-column{
        min-width:0;
        display:grid;
        gap:14px;
      }

      .rfb-side-column{
        position:sticky;
        top:78px;
      }

      .rfb-section-card,
      .rfb-history-card,
      .rfb-side-card{
        min-width:0;
        background:#fff;
        border:1px solid var(--rfb-line);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rfb-section-card{
        padding:18px;
      }

      .rfb-section-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        margin-bottom:14px;
      }

      .rfb-section-head h2{
        margin:0;
        color:var(--rfb-text);
        font:600 17px/23px Geist,Inter,sans-serif;
      }

      .rfb-section-head p{
        max-width:680px;
        margin:3px 0 0;
        color:var(--rfb-text2);
        font-size:9px;
        line-height:14px;
      }

      .rfb-section-badge{
        min-height:25px;
        display:inline-flex;
        align-items:center;
        flex:0 0 auto;
        padding:5px 8px;
        border-radius:999px;
        font-size:6px;
        font-weight:750;
      }

      .rfb-section-badge.success{
        color:var(--rfb-success);
        background:var(--rfb-ssoft);
      }

      .rfb-section-badge.warning{
        color:var(--rfb-warning);
        background:var(--rfb-wsoft);
      }

      .rfb-section-badge.neutral{
        color:var(--rfb-primary);
        background:var(--rfb-psoft);
      }

      .rfb-pack-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
      }

      .rfb-pack{
        min-height:184px;
        display:grid;
        align-content:space-between;
        padding:15px;
        background:#fff;
        border:1px solid var(--rfb-line);
        border-radius:11px;
        animation:rfbFadeUp 200ms var(--rfb-ease) both;
        animation-delay:calc(var(--rfb-index) * 28ms);
        transition:
          transform 150ms var(--rfb-ease),
          border-color 150ms var(--rfb-ease),
          box-shadow 150ms var(--rfb-ease);
      }

      .rfb-pack:hover{
        transform:translateY(-2px);
        border-color:#d1d2ff;
        box-shadow:0 10px 24px rgba(25,28,29,.06);
      }

      .rfb-pack.ai{
        background:linear-gradient(145deg,#fff,#faf9ff);
      }

      .rfb-pack header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .rfb-pack header > span{
        color:var(--rfb-text2);
        font-size:6.5px;
        font-weight:750;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfb-pack.ai header > span{
        color:var(--rfb-primary);
      }

      .rfb-pack header > i{
        color:#b2b2bd;
        font-style:normal;
      }

      .rfb-pack.ai header > i{
        color:var(--rfb-primary);
      }

      .rfb-pack > div{
        display:grid;
        gap:1px;
        margin:14px 0;
      }

      .rfb-pack > div strong{
        font:600 21px/27px Geist,Inter,sans-serif;
      }

      .rfb-pack > div span{
        color:var(--rfb-text2);
        font-size:8px;
      }

      .rfb-pack footer{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:8px;
      }

      .rfb-pack footer > strong{
        font-size:11px;
        line-height:16px;
      }

      .rfb-pack footer button{
        min-width:57px;
        min-height:34px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:4px;
        padding:6px 9px;
        color:var(--rfb-text);
        background:var(--rfb-soft2);
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
        transition:.14s var(--rfb-ease);
      }

      .rfb-pack.ai footer button{
        color:#fff;
        background:var(--rfb-primary);
      }

      .rfb-pack footer button:hover:not(:disabled){
        color:#fff;
        background:var(--rfb-primary);
      }

      .rfb-pack footer button:disabled{
        opacity:.5;
        cursor:not-allowed;
      }

      .rfb-policy-strip{
        display:grid;
        grid-template-columns:1fr 1px 1fr 1px 1fr;
        align-items:stretch;
        gap:12px;
        padding:11px 13px;
        margin-top:13px;
        background:var(--rfb-soft);
        border-radius:9px;
      }

      .rfb-policy-strip > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfb-policy-strip > div span{
        color:var(--rfb-muted);
        font-size:6px;
        line-height:10px;
        text-transform:uppercase;
      }

      .rfb-policy-strip > div strong{
        overflow:hidden;
        color:var(--rfb-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
        line-height:12px;
      }

      .rfb-policy-strip > i{
        width:1px;
        background:#dfe0e2;
      }

      .rfb-grant-note{
        display:flex;
        align-items:flex-start;
        gap:7px;
        padding:9px 10px;
        margin-top:12px;
        color:var(--rfb-text2);
        background:var(--rfb-soft);
        border-radius:8px;
      }

      .rfb-grant-note > svg{
        flex:0 0 auto;
        color:var(--rfb-primary);
        margin-top:1px;
      }

      .rfb-grant-note p{
        margin:0;
        font-size:7px;
        line-height:11px;
      }

      .rfb-action-empty{
        min-height:170px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:20px;
        background:var(--rfb-soft);
        border-radius:10px;
        text-align:center;
      }

      .rfb-action-empty > span{
        width:45px;
        height:45px;
        display:grid;
        place-items:center;
        color:var(--rfb-primary);
        background:#fff;
        border-radius:12px;
      }

      .rfb-action-empty > strong{
        font-size:9px;
        line-height:13px;
      }

      .rfb-action-empty > p{
        max-width:430px;
        margin:0;
        color:var(--rfb-muted);
        font-size:7px;
        line-height:12px;
      }

      .rfb-action-empty > div{
        margin-top:5px;
      }

      .rfb-action-empty .rfb-btn{
        min-height:34px;
        font-size:7px;
      }

      .rfb-history-card{
        overflow:hidden;
      }

      .rfb-history-head{
        min-height:77px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:14px 16px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfb-line);
      }

      .rfb-history-head h2{
        margin:0;
        font:600 14px/19px Geist,Inter,sans-serif;
      }

      .rfb-history-head > div:last-child{
        display:flex;
        align-items:center;
        gap:9px;
      }

      .rfb-history-tabs{
        height:34px;
        display:flex;
        gap:3px;
        padding:3px;
        background:var(--rfb-soft2);
        border-radius:7px;
      }

      .rfb-history-tabs button{
        height:28px;
        padding:0 8px;
        color:var(--rfb-text2);
        background:transparent;
        border:0;
        border-radius:5px;
        cursor:pointer;
        font-size:7px;
        font-weight:650;
      }

      .rfb-history-tabs button.active{
        color:var(--rfb-primary);
        background:#fff;
        box-shadow:0 1px 2px rgba(25,28,29,.05);
      }

      .rfb-export-btn{
        height:32px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:0 8px;
        color:var(--rfb-primary);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
      }

      .rfb-export-btn:hover{
        background:var(--rfb-psoft);
      }

      .rfb-table-wrap{
        width:100%;
        overflow:auto;
      }

      .rfb-table{
        width:100%;
        min-width:700px;
        border-collapse:separate;
        border-spacing:0;
        text-align:left;
      }

      .rfb-table th{
        padding:12px 14px;
        color:var(--rfb-text2);
        background:#f8f9fa;
        border-bottom:1px solid var(--rfb-line);
        font-size:6.5px;
        font-weight:700;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfb-table td{
        min-height:61px;
        padding:12px 14px;
        color:var(--rfb-text2);
        border-bottom:1px solid #f0f1f2;
        vertical-align:middle;
        font-size:8px;
        line-height:12px;
      }

      .rfb-table tbody tr:last-child td{
        border-bottom:0;
      }

      .rfb-table tbody tr:hover{
        background:#fafafd;
      }

      .rfb-table td strong{
        color:var(--rfb-text);
        font-size:8px;
      }

      .rfb-table .right{
        text-align:right;
      }

      .rfb-table .center{
        text-align:center;
      }

      .rfb-wallet-badge{
        min-height:23px;
        display:inline-flex;
        align-items:center;
        gap:4px;
        width:max-content;
        padding:4px 7px;
        border-radius:6px;
        font-size:6px;
        font-weight:750;
      }

      .rfb-wallet-badge.general{
        color:#545a66;
        background:#eceeef;
      }

      .rfb-wallet-badge.ai{
        color:var(--rfb-violet);
        background:var(--rfb-vsoft);
      }

      .rfb-purchase-status{
        min-height:22px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:4px 7px;
        border-radius:999px;
        font-size:6px;
        font-weight:800;
        letter-spacing:.04em;
        text-transform:uppercase;
      }

      .rfb-purchase-status.paid{
        color:var(--rfb-success);
        background:var(--rfb-ssoft);
      }

      .rfb-purchase-status.pending{
        color:var(--rfb-warning);
        background:var(--rfb-wsoft);
      }

      .rfb-purchase-status.failed,
      .rfb-purchase-status.cancelled{
        color:var(--rfb-danger);
        background:var(--rfb-dsoft);
      }

      .rfb-mobile-history{
        display:none;
      }

      .rfb-history-empty{
        min-height:250px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:24px;
        text-align:center;
      }

      .rfb-history-empty > span{
        width:46px;
        height:46px;
        display:grid;
        place-items:center;
        color:var(--rfb-primary);
        background:var(--rfb-psoft);
        border-radius:13px;
      }

      .rfb-history-empty strong{
        font-size:9px;
      }

      .rfb-history-empty p{
        margin:0;
        color:var(--rfb-muted);
        font-size:7px;
      }

      .rfb-usage-layout,
      .rfb-rates-layout{
        display:grid;
        gap:12px;
        padding:12px;
      }

      .rfb-usage-section{
        overflow:hidden;
        border:1px solid var(--rfb-line);
        border-radius:9px;
      }

      .rfb-usage-section > header{
        min-height:61px;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:10px;
        padding:11px 12px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfb-line);
      }

      .rfb-usage-section h3{
        margin:0;
        color:var(--rfb-text);
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rfb-usage-section header p{
        margin:2px 0 0;
        color:var(--rfb-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfb-table-wrap.compact .rfb-table{
        min-width:620px;
      }

      .rfb-inline-empty{
        padding:22px 14px;
        color:var(--rfb-muted);
        text-align:center;
        font-size:7px;
      }

      .rfb-delta{
        font-weight:700;
      }

      .rfb-delta.positive{
        color:var(--rfb-success);
      }

      .rfb-delta.negative{
        color:var(--rfb-danger);
      }

      .rfb-rate-cards{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:8px;
        padding:12px;
      }

      .rfb-rate-cards article{
        min-height:79px;
        display:grid;
        align-content:center;
        gap:3px;
        padding:10px;
        background:var(--rfb-soft);
        border-radius:8px;
      }

      .rfb-rate-cards small{
        color:var(--rfb-muted);
        font-size:6px;
        text-transform:uppercase;
      }

      .rfb-rate-cards strong{
        font-size:9px;
        line-height:13px;
      }

      .rfb-policy-description{
        display:flex;
        align-items:flex-start;
        gap:7px;
        padding:10px 12px;
        margin:0 12px 12px;
        color:var(--rfb-primary);
        background:var(--rfb-psoft);
        border-radius:8px;
      }

      .rfb-policy-description > svg{
        flex:0 0 auto;
      }

      .rfb-policy-description p{
        margin:0;
        color:var(--rfb-text2);
        font-size:7px;
        line-height:11px;
      }

      .rfb-side-card{
        overflow:hidden;
      }

      .rfb-side-card > header{
        display:flex;
        align-items:center;
        gap:8px;
        padding:12px 13px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfb-line);
      }

      .rfb-side-card > header > span{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        flex:0 0 31px;
        color:var(--rfb-primary);
        background:var(--rfb-psoft);
        border-radius:8px;
      }

      .rfb-side-card > header > span.violet{
        color:var(--rfb-violet);
        background:var(--rfb-vsoft);
      }

      .rfb-side-card > header > span.green{
        color:var(--rfb-success);
        background:var(--rfb-ssoft);
      }

      .rfb-side-card > header > div{
        min-width:0;
        display:grid;
      }

      .rfb-side-card > header small{
        color:var(--rfb-muted);
        font-size:6px;
        text-transform:uppercase;
      }

      .rfb-side-card > header strong{
        font-size:9px;
      }

      .rfb-prepaid-copy{
        display:grid;
        gap:8px;
        padding:13px;
      }

      .rfb-prepaid-copy > p{
        margin:0;
        color:var(--rfb-text2);
        font-size:7px;
        line-height:12px;
      }

      .rfb-prepaid-copy > div{
        display:flex;
        align-items:flex-start;
        gap:6px;
        padding:7px;
        background:var(--rfb-soft);
        border-radius:7px;
      }

      .rfb-prepaid-copy > div > span{
        color:var(--rfb-success);
        flex:0 0 auto;
      }

      .rfb-prepaid-copy > div p{
        margin:0;
        color:var(--rfb-text2);
        font-size:7px;
        line-height:11px;
      }

      .rfb-number-stack{
        display:grid;
        padding:8px;
      }

      .rfb-number-stack article{
        min-height:58px;
        display:grid;
        grid-template-columns:30px minmax(0,1fr) auto;
        align-items:center;
        gap:7px;
        padding:8px;
        border-radius:7px;
      }

      .rfb-number-stack article + article{
        border-top:1px solid #f0f1f2;
      }

      .rfb-number-stack article > span{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        color:var(--rfb-primary);
        background:var(--rfb-psoft);
        border-radius:7px;
      }

      .rfb-number-stack article > div{
        min-width:0;
        display:grid;
      }

      .rfb-number-stack article strong{
        overflow:hidden;
        color:var(--rfb-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
      }

      .rfb-number-stack article small{
        color:var(--rfb-muted);
        font-size:6px;
      }

      .rfb-number-stack article em{
        color:var(--rfb-primary);
        font-size:6px;
        font-style:normal;
        font-weight:750;
        text-transform:uppercase;
      }

      .rfb-number-stack article em.active{
        color:var(--rfb-success);
      }

      .rfb-side-link{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:7px;
        padding:10px 12px;
        color:var(--rfb-primary)!important;
        border-top:1px solid var(--rfb-line);
        text-decoration:none;
        font-size:7px;
        font-weight:700;
      }

      .rfb-side-empty{
        display:grid;
        gap:8px;
        padding:13px;
      }

      .rfb-side-empty p{
        margin:0;
        color:var(--rfb-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfb-side-empty .rfb-btn{
        min-height:33px;
        font-size:7px;
      }

      .rfb-policy-list{
        display:grid;
        gap:0;
        margin:0;
        padding:6px 12px;
      }

      .rfb-policy-list > div{
        display:grid;
        grid-template-columns:1fr auto;
        gap:8px;
        padding:8px 0;
      }

      .rfb-policy-list > div + div{
        border-top:1px solid #f0f1f2;
      }

      .rfb-policy-list dt{
        color:var(--rfb-muted);
        font-size:7px;
      }

      .rfb-policy-list dd{
        margin:0;
        color:var(--rfb-text);
        text-align:right;
        font-size:7px;
        font-weight:700;
      }

      .rfb-checkout-state{
        display:grid;
        gap:8px;
        padding:13px;
      }

      .rfb-checkout-state > span{
        min-height:26px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        width:max-content;
        padding:5px 8px;
        border-radius:999px;
        font-size:6px;
        font-weight:750;
      }

      .rfb-checkout-state > span.ready{
        color:var(--rfb-success);
        background:var(--rfb-ssoft);
      }

      .rfb-checkout-state > span.pending{
        color:var(--rfb-warning);
        background:var(--rfb-wsoft);
      }

      .rfb-checkout-state p{
        margin:0;
        color:var(--rfb-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfb-summary-grid.loading article,
      .loading-panel > i{
        background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);
        background-size:220% 100%;
        animation:rfbShimmer 1.25s linear infinite;
      }

      .rfb-summary-grid.loading article{
        min-height:170px;
        display:grid;
        align-content:center;
        gap:10px;
        border-radius:13px;
      }

      .rfb-summary-grid.loading article > i{
        height:11px;
        margin:0 20px;
        background:rgba(255,255,255,.7);
        border-radius:999px;
      }

      .rfb-summary-grid.loading article > i:nth-child(2){
        width:55%;
        height:30px;
      }

      .rfb-summary-grid.loading article > i:nth-child(3){
        width:70%;
      }

      .loading-panel{
        min-height:220px;
        display:grid;
        align-content:start;
        gap:10px;
        padding:15px;
      }

      .loading-panel > i{
        display:block;
        height:55px;
        border-radius:9px;
      }

      .loading-panel > i:nth-child(2){
        height:115px;
      }

      .loading-panel > i:nth-child(3){
        height:80px;
      }

      @media(max-width:1240px){
        .rf-billing-v7{
          padding:22px;
        }

        .rfb-pack-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rfb-main-grid{
          grid-template-columns:minmax(0,1fr) 280px;
        }
      }

      @media(max-width:980px){
        .rfb-summary-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rfb-main-grid{
          grid-template-columns:1fr;
        }

        .rfb-side-column{
          position:static;
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:780px){
        .rfb-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfb-header-actions{
          width:100%;
          justify-content:flex-end;
        }

        .rfb-history-head{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfb-history-head > div:last-child{
          width:100%;
          justify-content:space-between;
        }

        .rfb-table-wrap{
          display:none;
        }

        .rfb-table-wrap.compact{
          display:block;
        }

        .rfb-mobile-history{
          display:grid;
        }

        .rfb-mobile-history article{
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          gap:8px;
          padding:12px 13px;
          border-bottom:1px solid #f0f1f2;
        }

        .rfb-mobile-history article > div{
          min-width:0;
          display:grid;
        }

        .rfb-mobile-history article > div:first-child strong{
          overflow:hidden;
          color:var(--rfb-text);
          text-overflow:ellipsis;
          white-space:nowrap;
          font-size:8px;
        }

        .rfb-mobile-history article > div:first-child small{
          color:var(--rfb-muted);
          font-size:6px;
        }

        .rfb-mobile-history article > .rfb-wallet-badge{
          justify-self:end;
        }

        .rfb-mobile-history article > div:last-child{
          grid-column:1/-1;
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding-top:7px;
          border-top:1px solid #f0f1f2;
        }

        .rfb-mobile-history article > div:last-child > strong{
          font-size:8px;
        }
      }

      @media(max-width:640px){
        .rf-billing-v7{
          padding:18px 12px 84px;
        }

        .rfb-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfb-page-header p{
          font-size:11px;
          line-height:17px;
        }

        .rfb-summary-grid{
          grid-template-columns:1fr;
          gap:8px;
        }

        .rfb-summary-card{
          min-height:135px;
          padding:17px;
        }

        .rfb-pack-grid{
          grid-template-columns:1fr;
        }

        .rfb-policy-strip{
          grid-template-columns:1fr;
          gap:7px;
        }

        .rfb-policy-strip > i{
          width:100%;
          height:1px;
        }

        .rfb-side-column{
          grid-template-columns:1fr;
        }

        .rfb-history-head > div:last-child{
          align-items:stretch;
          flex-direction:column;
        }

        .rfb-history-tabs{
          width:100%;
        }

        .rfb-history-tabs button{
          flex:1;
        }

        .rfb-export-btn{
          justify-content:center;
          width:100%;
        }

        .rfb-rate-cards{
          grid-template-columns:1fr;
        }

        .rfb-table-wrap.compact{
          overflow:auto;
        }
      }

      @media(max-width:430px){
        .rfb-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .rfb-section-head{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfb-section-badge{
          align-self:flex-start;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-billing-v7,
        .rfb-summary-card,
        .rfb-pack,
        .rfb-notice,
        .rfb-summary-grid.loading article,
        .loading-panel > i,
        .rf-billing-v7 .spin{
          animation:none!important;
        }

        .rf-billing-v7 *,
        .rf-billing-v7 *::before,
        .rf-billing-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
