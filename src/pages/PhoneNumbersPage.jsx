import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Globe2,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  X,
} from "../components/icons";
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../lib/workspace-platform-client.js";

const MODES = [
  ["outbound", "Outbound"],
  ["inbound", "Inbound"],
  ["both", "Inbound + outbound"],
];

const METHODS = [
  ["forwarding", "Verified forwarding"],
  ["porting", "Port to ReachFly"],
  ["sip_byoc", "Advanced carrier routing"],
];

const FINAL_ORDER_STATES = new Set([
  "active",
  "payment_failed",
  "provision_failed",
  "failure",
  "refund_review_required",
]);

export default function PhoneNumbersPage() {
  const { user, initializing } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const mountedRef = useRef(true);

  const [commerce, setCommerce] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentPolling, setPaymentPolling] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [paymentIssue, setPaymentIssue] = useState(null);

  const [view, setView] = useState(
    searchParams.get("view") === "existing" ? "existing" : "buy"
  );
  const [callingMode, setCallingMode] = useState(
    normalizeMode(searchParams.get("callingMode") || "both")
  );

  const [searchForm, setSearchForm] = useState({
    countryCode: searchParams.get("country") || "US",
    areaCode: searchParams.get("area") || "",
    locality: searchParams.get("city") || "",
  });

  const [quote, setQuote] = useState(null);
  const [searching, setSearching] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState("");

  const [existingForm, setExistingForm] = useState({
    phoneNumber: "",
    method: "forwarding",
  });
  const [existingPending, setExistingPending] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [connectingExisting, setConnectingExisting] = useState(false);
  const [verifyingExisting, setVerifyingExisting] = useState(false);
  const [retryingOrderId, setRetryingOrderId] = useState("");
  const [selectedNumberId, setSelectedNumberId] = useState(
    searchParams.get("number") || ""
  );

  const role = normalizeRole(user?.workspaceRole || user?.role || "caller");
  const accountType = String(user?.accountType || user?.workspaceType || "")
    .trim()
    .toLowerCase();
  const hasAccess =
    ["owner", "admin", "manager"].includes(role) ||
    accountType === "individual";

  const loadData = useCallback(
    async ({ silent = false, toast = false } = {}) => {
      if (!hasAccess) return;

      silent ? setRefreshing(true) : setLoading(true);

      try {
        const [commerceResult, dashboardResult] = await Promise.allSettled([
          apiRequest("/voice-commerce", { timeoutMs: 20_000 }),
          apiRequest("/telnyx/ai-agent/dashboard", { timeoutMs: 35_000 }),
        ]);

        if (!mountedRef.current) return;

        if (commerceResult.status === "fulfilled") {
          setCommerce(commerceResult.value || {});
          setError("");
          if (toast) {
            notify(
              "success",
              "Business numbers refreshed",
              "Latest number and provisioning status is now visible."
            );
          }
        } else if (![403, 404].includes(Number(commerceResult.reason?.status))) {
          const text = safeMessage(
            commerceResult.reason?.message || "Business numbers could not be loaded."
          );
          setError(text);
          if (toast) notify("error", "Refresh failed", text);
        }

        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value || {});
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [hasAccess]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initializing || !hasAccess) return undefined;

    void loadData();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !paymentPolling) {
        void loadData({ silent: true });
      }
    }, 20_000);

    return () => window.clearInterval(timer);
  }, [hasAccess, initializing, loadData, paymentPolling]);

  useEffect(() => {
    if (initializing || !hasAccess) return undefined;

    const payment = searchParams.get("numberPayment");
    const orderId = searchParams.get("order");
    let cancelled = false;

    const clearReturn = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("numberPayment");
      next.delete("order");
      next.delete("paymentReason");
      next.delete("reason");
      next.delete("message");
      next.delete("error");
      setSearchParams(next, { replace: true });
    };

    if (["failed", "declined", "payment_failed", "error"].includes(normalizeStatus(payment))) {
      const rawReason =
        searchParams.get("paymentReason") ||
        searchParams.get("reason") ||
        searchParams.get("message") ||
        searchParams.get("error") ||
        "";
      const issue = buildPaymentIssue({ error: rawReason, status: "payment_failed" });
      setMessage("");
      setError("");
      setPaymentIssue(issue);
      notify("warning", issue.title, issue.message);
      clearReturn();
      return undefined;
    }

    if (payment === "cancelled") {
      setPaymentIssue(null);
      setMessage("");
      setError("Business-number purchase was cancelled. No number was provisioned.");
      notify("warning", "Number purchase cancelled", "No business number was provisioned.");
      clearReturn();
      return undefined;
    }

    if (payment !== "success" || !orderId) return undefined;

    const run = async () => {
      setPaymentPolling(true);
      setPaymentIssue(null);
      setError("");
      setMessage(
        "Payment returned successfully. ReachFly is verifying the order and activating your business number."
      );

      for (let attempt = 0; attempt < 30 && !cancelled; attempt += 1) {
        try {
          const response = await apiRequest(
            `/voice-commerce/orders/${encodeURIComponent(orderId)}`,
            { timeoutMs: 20_000 }
          );
          const order = response?.order || response;
          const status = normalizeStatus(order?.status);

          if (status === "active") {
            await loadData({ silent: true });
            if (cancelled) return;

            const text = `${formatPhone(order?.phoneNumber)} is active and linked to this workspace.`;
            setMessage(text);
            setError("");
            setPaymentIssue(null);
            notify("success", "Business number activated", text);
            clearReturn();
            setPaymentPolling(false);
            return;
          }

          if (FINAL_ORDER_STATES.has(status)) {
            if (status === "payment_failed") {
              const issue = buildPaymentIssue(order);
              setMessage("");
              setError("");
              setPaymentIssue(issue);
              await loadData({ silent: true });
              notify("warning", issue.title, issue.message);
              clearReturn();
              setPaymentPolling(false);
              return;
            }

            const text = safeMessage(
              order?.error ||
                "Payment was received, but the business number could not be activated automatically. Retry provisioning or contact support."
            );
            setPaymentIssue(null);
            setMessage("");
            setError(text);
            await loadData({ silent: true });
            notify("error", "Number activation needs attention", text);
            clearReturn();
            setPaymentPolling(false);
            return;
          }
        } catch (requestError) {
          if (attempt >= 29 && !cancelled) {
            const text = safeMessage(
              requestError?.message ||
                "Number provisioning status could not be verified. Refresh this page to check the order."
            );
            setError(text);
            notify("error", "Number activation status unavailable", text);
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      if (!cancelled) setPaymentPolling(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    hasAccess,
    initializing,
    loadData,
    searchParams,
    setSearchParams,
  ]);

  const numbers = useMemo(
    () => normalizeNumbers(commerce?.numbers),
    [commerce?.numbers]
  );

  const activeNumber = useMemo(
    () =>
      commerce?.activeNumber?.phoneNumber
        ? commerce.activeNumber
        : numbers.find((number) => normalizeStatus(number.status) === "active") || null,
    [commerce?.activeNumber, numbers]
  );

  const selectedNumber = useMemo(
    () =>
      numbers.find(
        (number) => String(number.id) === String(selectedNumberId)
      ) || null,
    [numbers, selectedNumberId]
  );

  const metrics = useMemo(() => {
    const active = numbers.filter(
      (number) => normalizeStatus(number.status) === "active"
    );
    return {
      total: numbers.length,
      active: active.length,
      inbound: active.filter((number) =>
        ["inbound", "both"].includes(normalizeMode(number.callingMode))
      ).length,
    };
  }, [numbers]);

  const failedOrders = useMemo(
    () =>
      normalizeCollection(commerce?.orders).filter((order) =>
        ["payment_failed", "provision_failed", "failure", "pending_activation", "paid", "refund_review_required"].includes(
          normalizeStatus(order?.status)
        )
      ),
    [commerce?.orders]
  );

  const agents = useMemo(() => {
    const items = normalizeCollection(dashboard?.agents);
    if (items.length) return items;
    return dashboard?.agent ? [dashboard.agent] : [];
  }, [dashboard]);

  const activeAgent = useMemo(() => {
    const activeNumberKey = phoneKey(activeNumber?.phoneNumber);
    const linkedToPrimary = activeNumberKey
      ? agents.find(
          (agent) =>
            agent?.enabled !== false &&
            phoneKey(agent?.fromNumber) === activeNumberKey
        )
      : null;

    return (
      linkedToPrimary ||
      agents.find((agent) => agent?.enabled !== false) ||
      dashboard?.agent ||
      agents[0] ||
      null
    );
  }, [activeNumber?.phoneNumber, agents, dashboard?.agent]);

  const agentsByNumber = useMemo(() => {
    const map = new Map();

    for (const agent of agents) {
      const key = phoneKey(agent?.fromNumber);
      if (!key) continue;
      const current = map.get(key) || [];
      current.push(agent);
      map.set(key, current);
    }

    return map;
  }, [agents]);

  const linkedAgentCount = useMemo(
    () =>
      new Set(
        agents
          .map((agent) => phoneKey(agent?.fromNumber))
          .filter(Boolean)
      ).size,
    [agents]
  );

  const selectedNumberAgents = useMemo(
    () =>
      selectedNumber?.phoneNumber
        ? agentsByNumber.get(phoneKey(selectedNumber.phoneNumber)) || []
        : [],
    [agentsByNumber, selectedNumber]
  );

  function setViewAndUrl(nextView) {
    const normalized = nextView === "existing" ? "existing" : "buy";
    setView(normalized);
    setError("");
    setMessage("");
    const next = new URLSearchParams(searchParams);
    next.set("view", normalized);
    setSearchParams(next, { replace: true });
  }

  async function searchNumbers() {
    if (!commerce?.canPurchase) {
      const text = "Only a workspace owner or administrator can buy a business number.";
      setError(text);
      notify("warning", "Purchase permission required", text);
      return;
    }

    setSearching(true);
    setQuote(null);
    setPaymentIssue(null);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest("/voice-commerce/numbers/search", {
        method: "POST",
        body: {
          countryCode: searchForm.countryCode || "US",
          areaCode: String(searchForm.areaCode || "")
            .replace(/\D/g, "")
            .slice(0, 8),
          locality: searchForm.locality || "",
          phoneNumberType: "local",
          callingMode,
          limit: 8,
        },
        timeoutMs: 30_000,
      });

      setQuote(response || null);

      if (!response?.items?.length) {
        const text =
          "No matching local numbers were returned. Try another area code, nearby city, or country-only search.";
        setMessage(text);
        notify("info", "No matching numbers", text);
      }
    } catch (requestError) {
      const text = safeMessage(
        requestError?.message || "Available business numbers could not be loaded."
      );
      setError(text);
      notify("error", "Number search failed", text);
    } finally {
      setSearching(false);
    }
  }

  async function buyNumber(item) {
    if (!quote?.quoteId || !item?.phoneNumber || buyingNumber) return;

    if (commerce?.purchaseReadiness?.ready === false) {
      const text = safeMessage(
        commerce.purchaseReadiness.message ||
          "Business-number checkout is not fully configured on the server."
      );
      setError(text);
      notify("error", "Checkout configuration required", text);
      return;
    }

    setBuyingNumber(item.phoneNumber);
    setPaymentIssue(null);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest("/voice-commerce/numbers/checkout", {
        method: "POST",
        body: {
          quoteId: quote.quoteId,
          phoneNumber: item.phoneNumber,
          callingMode,
          returnPath: buildCheckoutReturnPath({ searchForm, callingMode }),
        },
        timeoutMs: 30_000,
      });

      if (!response?.checkoutUrl || !/^https?:\/\//i.test(response.checkoutUrl)) {
        throw new Error("Secure business-number checkout could not be opened.");
      }

      window.location.assign(response.checkoutUrl);
    } catch (requestError) {
      const text = safeMessage(
        requestError?.message || "Business-number checkout could not be started."
      );
      setError(text);
      setBuyingNumber("");
      notify("error", "Checkout unavailable", text);
    }
  }

  async function connectExisting() {
    const phoneNumber = String(existingForm.phoneNumber || "").trim();

    if (!phoneNumber) {
      const text = "Enter the business number you own.";
      setError(text);
      notify("warning", "Business number required", text);
      return;
    }

    if (!commerce?.canPurchase) {
      const text =
        "Only a workspace owner or administrator can connect a business number.";
      setError(text);
      notify("warning", "Connection permission required", text);
      return;
    }

    setConnectingExisting(true);
    setExistingPending(null);
    setVerificationCode("");
    setPaymentIssue(null);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest("/voice-commerce/numbers/existing", {
        method: "POST",
        body: {
          phoneNumber,
          method: existingForm.method,
          callingMode,
        },
        timeoutMs: 30_000,
      });

      setExistingPending(response || null);

      const text = response?.testVerificationCode
        ? "Test ownership verification is ready. Confirm the code below."
        : safeMessage(
            response?.verification ||
              "The existing-number connection is pending ownership verification."
          );

      if (response?.testVerificationCode) {
        setVerificationCode(response.testVerificationCode);
      }

      setMessage(text);
      notify("info", "Verification started", text);
    } catch (requestError) {
      const text = safeMessage(
        requestError?.message || "The existing business number could not be added."
      );
      setError(text);
      notify("error", "Connection failed", text);
    } finally {
      setConnectingExisting(false);
    }
  }

  async function verifyExisting() {
    const numberId =
      existingPending?.number?.id || existingPending?.id || "";
    const sandbox = Boolean(existingPending?.testVerificationCode);

    if (!numberId) {
      setError("Start existing-number verification first.");
      return;
    }

    if (sandbox && !verificationCode) {
      setError("Enter the ownership verification code.");
      return;
    }

    setVerifyingExisting(true);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(
        `/voice-commerce/numbers/${encodeURIComponent(numberId)}/verify`,
        {
          method: "POST",
          body: sandbox ? { code: verificationCode } : {},
          timeoutMs: 30_000,
        }
      );

      setExistingPending(response || null);
      await loadData({ silent: true });

      const status = normalizeStatus(response?.number?.status);
      const text =
        status === "routing_required"
          ? "Ownership is verified. Complete the carrier routing step below."
          : status === "carrier_action_required"
            ? safeMessage(
                response?.verification ||
                  "Ownership is verified. Complete the remaining carrier step."
              )
            : response?.pending
              ? safeMessage(
                  response?.verification || "Ownership verification is still pending."
                )
              : `${formatPhone(
                  response?.number?.phoneNumber || existingForm.phoneNumber
                )} is verified and active for this workspace.`;

      setMessage(text);
      notify(
        status === "active" ? "success" : "info",
        status === "active" ? "Business number connected" : "Verification updated",
        text
      );
    } catch (requestError) {
      const text = safeMessage(
        requestError?.message ||
          "The business-number verification could not be completed."
      );
      setError(text);
      notify("error", "Verification failed", text);
    } finally {
      setVerifyingExisting(false);
    }
  }

  async function testRouting() {
    const numberId =
      existingPending?.number?.id || existingPending?.id || "";

    if (!numberId) {
      setError("Verify the existing business number first.");
      return;
    }

    setVerifyingExisting(true);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(
        `/voice-commerce/numbers/${encodeURIComponent(numberId)}/routing-test`,
        {
          method: "POST",
          body: {},
          timeoutMs: 30_000,
        }
      );

      setExistingPending(response || null);
      await loadData({ silent: true });

      const text = safeMessage(
        response?.message ||
          (response?.routingVerified
            ? "Existing-number routing is verified and active."
            : "Inbound routing has not reached ReachFly yet.")
      );

      setMessage(text);
      notify(
        response?.routingVerified ? "success" : "info",
        response?.routingVerified ? "Routing verified" : "Routing check complete",
        text
      );
    } catch (requestError) {
      const text = safeMessage(
        requestError?.message || "The inbound routing test could not be completed."
      );
      setError(text);
      notify("error", "Routing check failed", text);
    } finally {
      setVerifyingExisting(false);
    }
  }

  async function retryProvision(order) {
    const orderId = order?.id || order?.orderId || "";
    if (!orderId || retryingOrderId) return;

    setRetryingOrderId(orderId);
    setPaymentIssue(null);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(
        `/voice-commerce/orders/${encodeURIComponent(orderId)}/retry`,
        {
          method: "POST",
          timeoutMs: 60_000,
        }
      );

      const nextOrder = response?.order || response;
      await loadData({ silent: true });

      const active = normalizeStatus(nextOrder?.status) === "active";
      const text = active
        ? `${formatPhone(nextOrder?.phoneNumber)} is active.`
        : "Provisioning retry was accepted. ReachFly will keep checking the number status.";

      setMessage(text);
      notify(active ? "success" : "info", active ? "Business number active" : "Retry accepted", text);
    } catch (requestError) {
      const text = safeMessage(
        requestError?.message || "Business-number provisioning could not be retried."
      );
      setError(text);
      notify("error", "Provisioning retry failed", text);
    } finally {
      setRetryingOrderId("");
    }
  }

  if (initializing) {
    return (
      <>
        <Styles />
        <LoadingState />
      </>
    );
  }

  if (role === "caller" || !hasAccess) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <>
      <Styles />

      <div className="rfpn">
        <header className="rfpn-header">
          <div>
            <span className="eyebrow">AI Voice</span>
            <h1>Business Numbers</h1>
            <p>
              Buy a fresh local number or connect an existing business line for
              your ReachFly AI Voice Agent.
            </p>
          </div>

          <div className="actions">
            <Link className="btn secondary" to="/app/agents">
              <Bot size={15} />
              Voice Agents
            </Link>

            <button
              type="button"
              className="btn secondary"
              disabled={refreshing || paymentPolling}
              onClick={() => void loadData({ silent: true, toast: true })}
            >
              <RefreshCw
                size={15}
                className={refreshing || paymentPolling ? "spin" : ""}
              />
              Refresh
            </button>
          </div>
        </header>

        {paymentIssue ? (
          <PaymentIssueNotice
            issue={paymentIssue}
            onRetry={() => {
              setPaymentIssue(null);
              setError("");
              setMessage("");
              window.requestAnimationFrame(() => {
                document.getElementById("rfpn-buy-number")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              });
            }}
          />
        ) : null}

        {error ? (
          <Notice type="error" title="Business number setup needs attention">
            {error}
          </Notice>
        ) : null}

        {message ? (
          <Notice
            type="success"
            title={paymentPolling ? "Activating business number" : "Business number updated"}
            spinning={paymentPolling}
          >
            {message}
          </Notice>
        ) : null}

        <section className="metrics">
          <Metric icon={<Phone size={16} />} label="Business Numbers" value={metrics.total} note="Owned or connected" />
          <Metric icon={<CheckCircle2 size={16} />} label="Active" value={metrics.active} note="Ready for calling" tone="success" />
          <Metric
            icon={<Bot size={16} />}
            label="Agent Linked"
            value={linkedAgentCount}
            note={agents.length ? `${agents.length} Voice Agent${agents.length === 1 ? "" : "s"} configured` : "Create a Voice Agent"}
            tone="violet"
          />
          <Metric
            icon={<Globe2 size={16} />}
            label="Inbound Ready"
            value={metrics.inbound}
            note="Inbound or two-way numbers"
            tone="neutral"
          />
        </section>

        <section className="step-strip connected-journey" aria-label="Connected AI Voice journey">
          <div className={`journey-step current ${metrics.active ? "ready" : ""}`}>
            <b>1</b>
            <span><small>Business Number</small><strong>{metrics.active ? `${metrics.active} active` : "Connect number"}</strong></span>
          </div>
          <i className={metrics.active ? "ready" : ""} />
          <Link className={`journey-step ${agents.length ? "ready" : ""}`} to="/app/agents">
            <b>2</b>
            <span><small>AI Agent</small><strong>{agents.length ? `${agents.length} configured` : "Create agent"}</strong></span>
          </Link>
          <i className={agents.length ? "ready" : ""} />
          <Link className={`journey-step ${agents.some((agent) => ["inbound", "outbound", "both"].includes(normalizeMode(agent?.callingMode))) ? "ready" : ""}`} to="/app/agents">
            <b>3</b>
            <span><small>Direction</small><strong>{agents.length ? summarizeAgentDirections(agents) : "Choose inbound / outbound"}</strong></span>
          </Link>
          <i className={agents.some((agent) => ["outbound", "both"].includes(normalizeMode(agent?.callingMode))) ? "ready" : ""} />
          <Link
            className={`journey-step ${agents.some((agent) => ["inbound", "outbound", "both"].includes(normalizeMode(agent?.callingMode))) ? "ready" : ""}`}
            to={agents.some((agent) => ["outbound", "both"].includes(normalizeMode(agent?.callingMode))) ? "/app/campaigns" : "/app/calls"}
          >
            <b>4</b>
            <span><small>Use It</small><strong>{agents.some((agent) => ["outbound", "both"].includes(normalizeMode(agent?.callingMode))) ? "Campaigns + calls" : "Inbound calls"}</strong></span>
          </Link>
        </section>

        <section className="mode-grid">
          <ModeCard
            active={view === "buy"}
            icon={<Building2 size={20} />}
            title="Buy ReachFly Number"
            text="Search local inventory and provision a dedicated business number for AI Voice calling."
            onClick={() => setViewAndUrl("buy")}
          />
          <ModeCard
            active={view === "existing"}
            icon={<Phone size={20} />}
            title="Connect Existing Line"
            text="Keep your current business number through ownership verification, forwarding, porting, or carrier routing."
            onClick={() => setViewAndUrl("existing")}
          />
        </section>

        <section className="config-layout">
          <main className="config-card" id="rfpn-buy-number">
            {view === "buy" ? (
              <BuyPanel
                commerce={commerce}
                form={searchForm}
                setForm={setSearchForm}
                callingMode={callingMode}
                setCallingMode={(value) => {
                  setCallingMode(normalizeMode(value));
                  setQuote(null);
                }}
                quote={quote}
                searching={searching}
                buyingNumber={buyingNumber}
                onSearch={() => void searchNumbers()}
                onBuy={(item) => void buyNumber(item)}
              />
            ) : (
              <ExistingPanel
                commerce={commerce}
                form={existingForm}
                setForm={setExistingForm}
                callingMode={callingMode}
                setCallingMode={setCallingMode}
                pending={existingPending}
                verificationCode={verificationCode}
                setVerificationCode={setVerificationCode}
                connecting={connectingExisting}
                verifying={verifyingExisting}
                onConnect={() => void connectExisting()}
                onVerify={() => void verifyExisting()}
                onRoutingTest={() => void testRouting()}
              />
            )}
          </main>

          <aside className="context-card">
            <div className="map-visual">
              <span className="pin p1"><MapPin size={14} /></span>
              <span className="pin p2"><MapPin size={12} /></span>
              <span className="pin p3"><MapPin size={11} /></span>

              <div>
                <Globe2 size={24} />
                <strong>Local number search</strong>
                <p>
                  Search by country, area code, or city. Availability and pricing
                  come from live number inventory.
                </p>
              </div>
            </div>

            <div className="context-copy connected-copy">
              <ContextLine
                icon={<Shield size={14} />}
                title="1. Number becomes the call identity"
                text={activeNumber?.phoneNumber ? `${formatPhone(activeNumber.phoneNumber)} is available to assign to a Voice Agent.` : "Activate a number first. ReachFly keeps carrier setup behind the scenes."}
              />
              <ContextLine
                icon={<Bot size={14} />}
                title="2. Agent owns the behavior"
                text={activeAgent ? `${activeAgent.name || "Voice Agent"} controls language, opening, closing, business memory, and ${formatCallingMode(activeAgent.callingMode || activeAgent.mode).toLowerCase()}.` : "Create an agent and choose which active number it should use."}
              />
            </div>

            <div className="connection-mini-flow">
              <div className={metrics.active ? "ready" : ""}>
                <Phone size={13} />
                <span><small>Number</small><strong>{activeNumber?.phoneNumber ? formatPhone(activeNumber.phoneNumber) : "Missing"}</strong></span>
              </div>
              <ChevronRight size={13} />
              <div className={activeAgent ? "ready" : ""}>
                <Bot size={13} />
                <span><small>Agent</small><strong>{activeAgent?.name || "Not linked"}</strong></span>
              </div>
              <ChevronRight size={13} />
              <div className={activeAgent ? "ready" : ""}>
                <Globe2 size={13} />
                <span><small>Direction</small><strong>{activeAgent ? formatCallingMode(activeAgent.callingMode || activeAgent.mode) : "Choose mode"}</strong></span>
              </div>
            </div>

            <div className="agent-card">
              {activeAgent ? (
                <>
                  <span className={avatarTone(activeAgent.name)}>
                    {initials(activeAgent.name || "AI")}
                  </span>
                  <div>
                    <small>Primary Voice Agent</small>
                    <strong>{activeAgent.name || "AI Voice Agent"}</strong>
                    <em>{activeAgent.fromNumber ? `Linked to ${formatPhone(activeAgent.fromNumber)}` : "Needs a Business Number"}</em>
                  </div>
                  <Link to="/app/agents"><ChevronRight size={14} /></Link>
                </>
              ) : (
                <>
                  <span className="neutral"><Bot size={14} /></span>
                  <div>
                    <small>Next step</small>
                    <strong>Create your Voice Agent</strong>
                    <em>Assign a number, language, prompt and call direction.</em>
                  </div>
                  <Link to="/app/agents"><ChevronRight size={14} /></Link>
                </>
              )}
            </div>
          </aside>
        </section>

        {failedOrders.length ? (
          <section className="full-card">
            <SectionHead
              eyebrow="Provisioning"
              title="Orders needing attention"
              text="These paid or pending number orders have not reached an active state yet."
            />
            <div className="orders">
              {failedOrders.map((order, index) => {
                const id = order.id || order.orderId || `order-${index}`;
                return (
                  <article key={id}>
                    <span><Phone size={14} /></span>
                    <div>
                      <strong>{formatPhone(order.phoneNumber)}</strong>
                      <small>{titleCase(normalizeStatus(order.status))}</small>
                      {order.error ? <p>{safeMessage(order.error)}</p> : null}
                      {normalizeStatus(order.status) === "payment_failed" && order?.paymentFailure?.code ? (
                        <p className="payment-code">Processor code: {order.paymentFailure.code}</p>
                      ) : null}
                    </div>
                    {normalizeStatus(order.status) === "payment_failed" ? (
                      <button
                        type="button"
                        className="btn secondary compact"
                        onClick={() => {
                          const issue = buildPaymentIssue(order);
                          setPaymentIssue(issue);
                          window.requestAnimationFrame(() => {
                            document.getElementById("rfpn-buy-number")?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          });
                        }}
                      >
                        <RefreshCw size={12} />
                        Try payment again
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn secondary compact"
                        disabled={Boolean(retryingOrderId)}
                        onClick={() => void retryProvision(order)}
                      >
                        <RefreshCw size={12} className={retryingOrderId === id ? "spin" : ""} />
                        Retry provisioning
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="full-card connected">
          <SectionHead
            eyebrow="Workspace"
            title="Currently Connected"
            text="Numbers owned or verified by this workspace."
            side={`${numbers.length} number${numbers.length === 1 ? "" : "s"}`}
          />

          {loading ? (
            <NumberSkeleton />
          ) : numbers.length ? (
            <div className="number-grid">
              {numbers.map((number, index) => (
                <ConnectedNumber
                  key={number.id || number.phoneNumber || index}
                  number={number}
                  linkedAgents={agentsByNumber.get(phoneKey(number.phoneNumber)) || []}
                  primary={
                    activeNumber &&
                    phoneKey(activeNumber.phoneNumber) === phoneKey(number.phoneNumber)
                  }
                  selected={String(selectedNumber?.id || "") === String(number.id || "")}
                  index={index}
                  onClick={() => {
                    const id = number.id || "";
                    setSelectedNumberId(id);
                    const next = new URLSearchParams(searchParams);
                    id ? next.set("number", id) : next.delete("number");
                    setSearchParams(next, { replace: true });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <span><Phone size={22} /></span>
              <h3>No business numbers connected yet</h3>
              <p>Search live inventory or connect a number your business already owns.</p>
              <button type="button" className="btn primary" onClick={() => setViewAndUrl("buy")}>
                <Plus size={14} />
                Find a Number
              </button>
            </div>
          )}
        </section>

        {selectedNumber ? (
          <NumberDrawer
            number={selectedNumber}
            linkedAgents={selectedNumberAgents}
            primary={
              activeNumber &&
              phoneKey(activeNumber.phoneNumber) === phoneKey(selectedNumber.phoneNumber)
            }
            onClose={() => {
              setSelectedNumberId("");
              const next = new URLSearchParams(searchParams);
              next.delete("number");
              setSearchParams(next, { replace: true });
            }}
          />
        ) : null}
      </div>
    </>
  );
}

function BuyPanel({
  commerce,
  form,
  setForm,
  callingMode,
  setCallingMode,
  quote,
  searching,
  buyingNumber,
  onSearch,
  onBuy,
}) {
  const items = Array.isArray(quote?.items) ? quote.items : [];
  const canPurchase = Boolean(commerce?.canPurchase);

  return (
    <>
      <PanelHead
        eyebrow="Search inventory"
        title="Find a local business number"
        text="Search live inventory, choose the calling direction, then open secure checkout."
        badge={<><i className="live-dot" /> Live inventory</>}
      />

      <ModePicker value={callingMode} onChange={setCallingMode} />

      <section className="search-panel">
        <div className="search-grid">
          <Field
            label="Country"
            value={form.countryCode}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                countryCode: value.toUpperCase().slice(0, 2),
              }))
            }
            placeholder="US"
          />
          <Field
            label="Area code"
            value={form.areaCode}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                areaCode: value.replace(/\D/g, "").slice(0, 8),
              }))
            }
            placeholder="415"
            icon={<MapPin size={12} />}
          />
          <Field
            label="City / region"
            value={form.locality}
            onChange={(value) =>
              setForm((current) => ({ ...current, locality: value }))
            }
            placeholder="San Francisco"
            icon={<Search size={12} />}
          />
          <button
            type="button"
            className="btn primary search-button"
            disabled={searching || !canPurchase}
            onClick={onSearch}
          >
            {searching ? <RefreshCw size={13} className="spin" /> : <Search size={13} />}
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {!canPurchase ? (
          <div className="permission">
            <Shield size={12} />
            Only a workspace owner or administrator can purchase a business number.
          </div>
        ) : commerce?.purchaseReadiness?.ready === false ? (
          <div className="permission">
            <Shield size={12} />
            {commerce.purchaseReadiness.message ||
              "Business-number checkout needs server configuration before payment can start."}
          </div>
        ) : null}
      </section>

      {items.length ? (
        <div className="results">
          <div className="results-head">
            <strong>Available Numbers</strong>
            <span>{items.length} result{items.length === 1 ? "" : "s"}</span>
          </div>

          {items.map((item, index) => (
            <article className="result" key={item.phoneNumber || index} style={{ "--i": index }}>
              <span className="country">{String(item.countryCode || "US").slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{formatPhone(item.phoneNumber)}</strong>
                <small>{regionLabel(item) || "Voice-capable local number"}</small>
              </div>
              <div className="price">
                <small>Initial activation</small>
                <strong>{formatMoney(item.initialChargeMinor, item.currency)}</strong>
              </div>
              <button
                type="button"
                className="btn primary compact"
                disabled={
                  Boolean(buyingNumber) ||
                  commerce?.purchaseReadiness?.ready === false
                }
                onClick={() => onBuy(item)}
              >
                {buyingNumber === item.phoneNumber ? (
                  <RefreshCw size={12} className="spin" />
                ) : null}
                {buyingNumber === item.phoneNumber ? "Opening…" : "Buy"}
              </button>
            </article>
          ))}
        </div>
      ) : quote ? (
        <Placeholder
          icon={<Search size={20} />}
          title="No matching numbers"
          text="Try a nearby city, another area code, or a broader country-only search."
        />
      ) : (
        <Placeholder
          icon={<MapPin size={20} />}
          title="Search local inventory"
          text="Enter an area code or city to see real number availability and activation pricing."
        />
      )}

      {commerce?.testMode?.enabled ? (
        <div className="sandbox">
          <Sparkles size={13} />
          <div>
            <strong>Test environment</strong>
            <p>
              Test numbers can validate checkout, activation, and outbound QA.
              They do not represent a live inbound public phone number.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ExistingPanel({
  commerce,
  form,
  setForm,
  callingMode,
  setCallingMode,
  pending,
  verificationCode,
  setVerificationCode,
  connecting,
  verifying,
  onConnect,
  onVerify,
  onRoutingTest,
}) {
  const canManage = Boolean(commerce?.canPurchase);
  const status = normalizeStatus(pending?.number?.status);
  const routingAddress = pending?.sipDestination || pending?.routingDestination || "";

  return (
    <>
      <PanelHead
        eyebrow="Existing line"
        title="Connect your current business number"
        text="Keep your customer-facing number while ReachFly verifies ownership and prepares the calling connection."
        badge={<><Shield size={11} /> Ownership verification</>}
      />

      <ModePicker value={callingMode} onChange={(value) => setCallingMode(normalizeMode(value))} />

      <section className="existing-form">
        <Field
          label="Business number"
          value={form.phoneNumber}
          onChange={(value) => setForm((current) => ({ ...current, phoneNumber: value }))}
          placeholder="+1 415 555 0100"
          icon={<Phone size={12} />}
        />

        <label className="field">
          <span>Connection method</span>
          <div className="select">
            <select
              value={form.method}
              onChange={(event) =>
                setForm((current) => ({ ...current, method: event.target.value }))
              }
            >
              {METHODS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown size={12} />
          </div>
        </label>

        <button
          type="button"
          className="btn primary"
          disabled={connecting || !canManage}
          onClick={onConnect}
        >
          {connecting ? <RefreshCw size={13} className="spin" /> : <Shield size={13} />}
          {connecting ? "Starting…" : "Verify & Connect"}
        </button>
      </section>

      {!canManage ? (
        <div className="permission">
          <Shield size={12} />
          Only a workspace owner or administrator can connect an existing business number.
        </div>
      ) : null}

      {pending ? (
        <section className="verification">
          <header>
            <span><Shield size={14} /></span>
            <div>
              <small>Ownership verification</small>
              <strong>{formatPhone(pending?.number?.phoneNumber || form.phoneNumber)}</strong>
            </div>
            <StatusBadge status={status} />
          </header>

          <p>{safeMessage(pending?.verification || verificationMessage(status))}</p>

          {pending?.testVerificationCode ? (
            <div className="verify-actions">
              <Field
                label="Verification code"
                value={verificationCode}
                onChange={setVerificationCode}
                placeholder="123456"
              />
              <button type="button" className="btn primary" disabled={verifying} onClick={onVerify}>
                {verifying ? <RefreshCw size={12} className="spin" /> : <Check size={12} />}
                Confirm ownership
              </button>
            </div>
          ) : ["pending_verification", "verifying"].includes(status) ? (
            <div className="verify-check">
              <div>
                <strong>Complete the verification request</strong>
                <span>Follow the ownership instructions, then check the current status.</span>
              </div>
              <button type="button" className="btn secondary compact" disabled={verifying} onClick={onVerify}>
                <RefreshCw size={12} className={verifying ? "spin" : ""} />
                Check status
              </button>
            </div>
          ) : null}

          {status === "routing_required" ? (
            <div className="routing">
              <strong>Carrier routing required</strong>
              <p>
                Update your current carrier routing, place one inbound test call,
                then check the route.
              </p>

              {routingAddress ? (
                <details>
                  <summary>Advanced routing address</summary>
                  <code>{routingAddress}</code>
                  <small>Only needed when configuring an advanced carrier connection.</small>
                </details>
              ) : null}

              <button type="button" className="btn primary compact" disabled={verifying} onClick={onRoutingTest}>
                <CheckCircle2 size={12} />
                Check inbound routing
              </button>
            </div>
          ) : null}

          {status === "carrier_action_required" ? (
            <div className="carrier-action">
              <CheckCircle2 size={13} />
              <span>
                {safeMessage(
                  pending?.verification ||
                    "Ownership is verified. Complete the remaining carrier step."
                )}
              </span>
            </div>
          ) : null}
        </section>
      ) : (
        <Placeholder
          icon={<Shield size={20} />}
          title="Ownership verification protects your business number"
          text="ReachFly will not activate an external number until ownership and required routing checks are complete."
        />
      )}
    </>
  );
}

function NumberDrawer({ number, linkedAgents = [], primary, onClose }) {
  const status = normalizeStatus(number.status);
  const enabledAgents = linkedAgents.filter((agent) => agent?.enabled !== false);
  const primaryLinkedAgent = enabledAgents[0] || linkedAgents[0] || null;
  const supportsInbound = linkedAgents.some((agent) =>
    ["inbound", "both"].includes(normalizeMode(agent?.callingMode))
  );
  const supportsOutbound = linkedAgents.some((agent) =>
    ["outbound", "both"].includes(normalizeMode(agent?.callingMode))
  );

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="eyebrow">Business number</span>
            <h2>{formatPhone(number.phoneNumber)}</h2>
            <p>{sourceLabel(number)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </header>

        <div className="drawer-status">
          <span><Phone size={19} /></span>
          <div>
            <small>Calling status</small>
            <strong>{primary ? "Primary business number" : titleCase(status || "saved")}</strong>
            <p>{linkedAgents.length ? `${linkedAgents.length} Voice Agent${linkedAgents.length === 1 ? "" : "s"} linked` : "No Voice Agent linked yet"}</p>
          </div>
          <StatusBadge status={status} primary={primary} />
        </div>

        <section className="drawer-journey-section">
          <h3>Connected Journey</h3>
          <div className="drawer-journey">
            <div className="ready">
              <span><Phone size={12} /></span>
              <div><small>1 · Number</small><strong>{formatPhone(number.phoneNumber)}</strong></div>
            </div>
            <i className={linkedAgents.length ? "ready" : ""} />
            <div className={linkedAgents.length ? "ready" : ""}>
              <span><Bot size={12} /></span>
              <div>
                <small>2 · Agent</small>
                <strong>{primaryLinkedAgent?.name || "Assign agent"}</strong>
              </div>
            </div>
            <i className={linkedAgents.length ? "ready" : ""} />
            <div className={linkedAgents.length ? "ready" : ""}>
              <span><Globe2 size={12} /></span>
              <div>
                <small>3 · Direction</small>
                <strong>
                  {supportsInbound && supportsOutbound
                    ? "Inbound + outbound"
                    : supportsInbound
                      ? "Inbound"
                      : supportsOutbound
                        ? "Outbound"
                        : "Choose mode"}
                </strong>
              </div>
            </div>
            <i className={supportsOutbound || supportsInbound ? "ready" : ""} />
            <div className={supportsOutbound || supportsInbound ? "ready" : ""}>
              <span><Sparkles size={12} /></span>
              <div>
                <small>4 · Use it</small>
                <strong>{supportsOutbound ? "Campaigns + calls" : supportsInbound ? "Inbound calls" : "Finish setup"}</strong>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3>Number Details</h3>
          <dl>
            <Detail label="Number" value={formatPhone(number.phoneNumber)} />
            <Detail label="Status" value={titleCase(status || "saved")} />
            <Detail label="Provisioned for" value={formatCallingMode(number.callingMode)} />
            <Detail label="Linked agents" value={linkedAgents.length ? String(linkedAgents.length) : "None"} />
            <Detail label="Source" value={sourceLabel(number)} />
            <Detail label="Added" value={formatDate(number.createdAt)} />
          </dl>
        </section>

        <section>
          <h3>Voice Agents using this number</h3>
          {linkedAgents.length ? (
            <div className="linked-agent-list">
              {linkedAgents.map((agent, index) => (
                <Link
                  key={agent.id || agent.elevenLabsAgentId || `${agent.name || "agent"}-${index}`}
                  to="/app/agents"
                >
                  <span className={avatarTone(agent.name)}>
                    {initials(agent.name || "AI")}
                  </span>
                  <div>
                    <strong>{agent.name || "Voice Agent"}</strong>
                    <small>{formatCallingMode(agent.callingMode || agent.mode)} · {agent.enabled === false ? "Paused" : "Active"}</small>
                  </div>
                  <ChevronRight size={12} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="drawer-empty-link">
              <Bot size={16} />
              <div>
                <strong>This number is not linked to an agent yet.</strong>
                <small>Assign it while creating or editing a Voice Agent. That agent then controls language, scripts, business context and call direction.</small>
              </div>
            </div>
          )}
        </section>

        <section>
          <h3>Next Actions</h3>
          <div className="drawer-links">
            <Link to="/app/agents">
              <Bot size={13} />
              <span>
                <strong>{linkedAgents.length ? "Manage linked Voice Agent" : "Assign to a Voice Agent"}</strong>
                <small>Set language, opening, closing, system prompt, business memory and call direction.</small>
              </span>
              <ChevronRight size={12} />
            </Link>
            {supportsOutbound ? (
              <Link to="/app/campaigns/new">
                <Sparkles size={13} />
                <span><strong>Create AI Calling Campaign</strong><small>Use the linked outbound agent with campaign leads.</small></span>
                <ChevronRight size={12} />
              </Link>
            ) : (
              <Link to="/app/agents">
                <Globe2 size={13} />
                <span><strong>{supportsInbound ? "Inbound is ready" : "Choose inbound or outbound"}</strong><small>{supportsInbound ? "Incoming calls on this number can use the linked agent." : "The agent's calling mode decides how this number is used."}</small></span>
                <ChevronRight size={12} />
              </Link>
            )}
            <Link to="/app/calls">
              <Phone size={13} />
              <span><strong>Call Logs</strong><small>Review AI Voice calls and outcomes.</small></span>
              <ChevronRight size={12} />
            </Link>
          </div>
        </section>

        <footer>
          <Link className="btn primary" to="/app/agents">
            {linkedAgents.length ? "Manage Voice Agent" : "Assign Voice Agent"}
            <ChevronRight size={13} />
          </Link>
        </footer>
      </aside>
    </div>
  );
}

function ModeCard({ active, icon, title, text, onClick }) {
  return (
    <button type="button" className={`mode-card ${active ? "active" : ""}`} onClick={onClick}>
      <span>{icon}</span>
      <div><strong>{title}</strong><p>{text}</p></div>
      <i>{active ? <Check size={12} /> : <ChevronRight size={13} />}</i>
    </button>
  );
}

function Metric({ icon, label, value, note, tone = "primary" }) {
  return (
    <article className={`metric ${tone}`}>
      <span>{icon}</span>
      <div><small>{label}</small><strong>{typeof value === "number" ? value.toLocaleString() : value}</strong><em>{note}</em></div>
    </article>
  );
}

function PanelHead({ eyebrow, title, text, badge }) {
  return (
    <div className="panel-head">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>
      <span className="panel-badge">{badge}</span>
    </div>
  );
}

function SectionHead({ eyebrow, title, text, side }) {
  return (
    <div className="section-head">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>
      {side ? <span>{side}</span> : null}
    </div>
  );
}

function ModePicker({ value, onChange }) {
  return (
    <div className="mode-picker">
      <span>Use this number for</span>
      <div>
        {MODES.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={value === key ? "active" : ""}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, icon }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input">
        {icon ? <i>{icon}</i> : null}
        <input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </div>
    </label>
  );
}

function StatusBadge({ status, primary = false }) {
  const normalized = normalizeStatus(status);
  const tone =
    normalized === "active"
      ? "active"
      : ["pending", "pending_verification", "verifying", "routing_required", "carrier_action_required", "paid", "pending_activation"].includes(normalized)
        ? "pending"
        : ["failed", "failure", "provision_failed", "payment_failed"].includes(normalized)
          ? "failed"
          : "neutral";

  return (
    <span className={`status ${tone}`}>
      {primary && normalized === "active" ? <CheckCircle2 size={10} /> : null}
      {primary && normalized === "active" ? "Active" : titleCase(normalized || "saved")}
    </span>
  );
}

function ConnectedNumber({ number, linkedAgents = [], primary, selected, index, onClick }) {
  const supportsInbound = linkedAgents.some((agent) =>
    ["inbound", "both"].includes(normalizeMode(agent?.callingMode))
  );
  const supportsOutbound = linkedAgents.some((agent) =>
    ["outbound", "both"].includes(normalizeMode(agent?.callingMode))
  );

  return (
    <button
      type="button"
      className={`number-card ${primary ? "primary" : ""} ${selected ? "selected" : ""} ${linkedAgents.length ? "linked" : "unlinked"}`}
      style={{ "--i": index }}
      onClick={onClick}
    >
      <span className="number-icon"><Phone size={15} /></span>
      <div className="number-card-copy">
        <strong>{formatPhone(number.phoneNumber)}</strong>
        <small>{sourceLabel(number)}</small>
        <div className="number-link-state">
          <span className={linkedAgents.length ? "ready" : "missing"}>
            <Bot size={10} />
            {linkedAgents.length
              ? `${linkedAgents.length} agent${linkedAgents.length === 1 ? "" : "s"}`
              : "Assign agent"}
          </span>
          {linkedAgents.length ? (
            <span className="direction">
              {supportsInbound && supportsOutbound
                ? "In + out"
                : supportsInbound
                  ? "Inbound"
                  : supportsOutbound
                    ? "Outbound"
                    : formatCallingMode(number.callingMode)}
            </span>
          ) : null}
        </div>
      </div>
      <StatusBadge status={number.status} primary={primary} />
      <ChevronRight size={13} />
    </button>
  );
}

function ContextLine({ icon, title, text }) {
  return (
    <div className="context-line">
      <span>{icon}</span>
      <div><strong>{title}</strong><p>{text}</p></div>
    </div>
  );
}

function Placeholder({ icon, title, text }) {
  return (
    <div className="placeholder">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function PaymentIssueNotice({ issue, onRetry }) {
  return (
    <section className="payment-issue" role="alert">
      <span className="payment-issue-icon"><Shield size={16} /></span>
      <div className="payment-issue-copy">
        <small>Payment not completed</small>
        <strong>{issue?.title || "Card authorization was declined"}</strong>
        <p>{issue?.message}</p>
        <div className="payment-issue-facts">
          <span><Check size={10} /> ReachFly did not proceed to number provisioning</span>
          <span><Check size={10} /> You can retry checkout with a different card or payment method</span>
          {issue?.code ? <span><Shield size={10} /> Processor code {issue.code}</span> : null}
        </div>
        <button type="button" className="btn primary compact" onClick={onRetry}>
          <RefreshCw size={12} />
          Try another payment method
        </button>
      </div>
    </section>
  );
}

function Notice({ type, title, spinning = false, children }) {
  return (
    <section className={`notice ${type}`} role={type === "error" ? "alert" : "status"}>
      <span>{spinning ? <RefreshCw size={14} className="spin" /> : type === "error" ? <X size={14} /> : <CheckCircle2 size={14} />}</span>
      <div><strong>{title}</strong><small>{children}</small></div>
    </section>
  );
}

function Detail({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function NumberSkeleton() {
  return (
    <div className="number-grid skeleton">
      {[0, 1, 2].map((index) => (
        <article key={index}><i /><span><i /><i /><i /></span></article>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rfpn">
      <header className="rfpn-header">
        <div><span className="eyebrow">AI Voice</span><h1>Business Numbers</h1><p>Loading number inventory and workspace calling status…</p></div>
      </header>
      <section className="metrics">
        {[0, 1, 2, 3].map((index) => <article className="metric loading" key={index}><i /><span><i /><i /></span></article>)}
      </section>
      <section className="mode-grid loading"><i /><i /></section>
      <section className="config-layout"><main className="config-card loading-panel"><i /><i /><i /></main><aside className="context-card loading-panel"><i /><i /></aside></section>
    </div>
  );
}

/* data helpers */

function normalizeCollection(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function normalizeNumbers(value) {
  return normalizeCollection(value)
    .map((number, index) => ({
      ...number,
      id: number.id || number.numberId || number.phoneNumber || `number-${index}`,
    }))
    .sort((a, b) => {
      const activeA = normalizeStatus(a.status) === "active" ? 1 : 0;
      const activeB = normalizeStatus(b.status) === "active" ? 1 : 0;
      return activeB - activeA || timestamp(b.createdAt) - timestamp(a.createdAt);
    });
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeMode(value) {
  const mode = normalizeStatus(value);
  if (mode === "inbound") return "inbound";
  if (mode === "both" || mode === "inbound_outbound") return "both";
  return "outbound";
}

function summarizeAgentDirections(agents = []) {
  const modes = new Set(
    agents
      .map((agent) => normalizeMode(agent?.callingMode || agent?.mode))
      .filter(Boolean)
  );

  const inbound = modes.has("inbound") || modes.has("both");
  const outbound = modes.has("outbound") || modes.has("both");

  if (inbound && outbound) return "Inbound + outbound";
  if (inbound) return "Inbound";
  if (outbound) return "Outbound";
  return "Choose direction";
}

function formatCallingMode(value) {
  const mode = normalizeMode(value);
  if (mode === "inbound") return "Inbound only";
  if (mode === "both") return "Inbound & outbound";
  return "Outbound only";
}

function sourceLabel(number) {
  const source = normalizeStatus(number?.source);
  if (source === "existing_number") return "Connected existing number";
  if (number?.testMode) return "Test business number";
  if (source === "ported") return "Ported business number";
  if (source === "forwarded") return "Forwarded business line";
  return "ReachFly managed number";
}

function verificationMessage(status) {
  if (["pending_verification", "verifying"].includes(status)) {
    return "Complete the ownership verification request before this number can be activated.";
  }
  if (status === "routing_required") {
    return "Ownership is verified. Complete the carrier routing step.";
  }
  if (status === "carrier_action_required") {
    return "Ownership is verified. Complete the remaining carrier step.";
  }
  if (status === "active") return "This business number is verified and active.";
  return "Complete ownership verification to activate this number.";
}

function regionLabel(item) {
  const regions = Array.isArray(item?.regionInformation) ? item.regionInformation : [];
  return (
    regions
      .map((region) => region?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(", ") ||
    item?.locality ||
    item?.region ||
    item?.state ||
    ""
  );
}

function formatMoney(amountMinor, currency) {
  const amount = Number(amountMinor);
  if (!Number.isFinite(amount)) return "Price at checkout";

  const code = String(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${code}`;
  }
}

function formatPhone(value) {
  const text = String(value || "").trim();
  if (!text) return "—";
  const digits = text.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return text;
}

function phoneKey(value) {
  return String(value || "").replace(/\D+/g, "");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizeRole(value) {
  const role = normalizeStatus(value);
  if (role.includes("owner")) return "owner";
  if (role.includes("admin")) return "admin";
  if (role.includes("manager")) return "manager";
  if (
    role === "caller" ||
    role.includes("cold_caller") ||
    role.includes("sales_rep") ||
    role.includes("telemarketer")
  ) {
    return "caller";
  }
  return role || "caller";
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(value) {
  const parts = String(value || "AI").trim().split(/\s+/).filter(Boolean);
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[1][0]}`).toUpperCase();
}

function avatarTone(value) {
  const tones = ["primary", "violet", "blue", "green", "amber"];
  const sum = String(value || "").split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return tones[sum % tones.length];
}

function buildCheckoutReturnPath({ searchForm = {}, callingMode = "both" } = {}) {
  const params = new URLSearchParams();
  params.set("view", "buy");
  params.set("callingMode", normalizeMode(callingMode));

  const country = String(searchForm.countryCode || "").trim().toUpperCase();
  const area = String(searchForm.areaCode || "").replace(/\D/g, "").slice(0, 8);
  const city = String(searchForm.locality || "").trim();

  if (country) params.set("country", country);
  if (area) params.set("area", area);
  if (city) params.set("city", city);

  return `/app/phone-numbers?${params.toString()}`;
}

function buildPaymentIssue(order = {}) {
  const failure = order?.paymentFailure || {};
  const raw = String(
    failure?.message ||
      order?.error ||
      order?.message ||
      ""
  ).trim();
  const code = String(failure?.code || order?.paymentFailureCode || "").trim();
  const haystack = `${code} ${raw}`.toLowerCase();

  if (code === "203" || haystack.includes("general decline") || haystack.includes("authorization")) {
    return {
      kind: "declined",
      code: code || "203",
      title: "Your bank declined the card authorization",
      message:
        "The payment did not complete, so ReachFly did not continue to phone-number provisioning. Try another card or payment method. If you want to use the same card, ask the issuing bank to approve online/card-not-present payments and then retry.",
    };
  }

  if (code === "208" || haystack.includes("inactive card") || haystack.includes("card-not-present")) {
    return {
      kind: "declined",
      code: code || "208",
      title: "This card is not enabled for this online payment",
      message:
        "Use another card or enable online/card-not-present payments with the issuing bank. ReachFly will only provision the number after payment succeeds.",
    };
  }

  if (code === "476" || haystack.includes("authentication failed") || haystack.includes("payer authentication")) {
    return {
      kind: "authentication",
      code: code || "476",
      title: "Cardholder authentication was not completed",
      message:
        "Retry checkout and complete the bank verification step, or use another payment method. ReachFly has not continued to number provisioning.",
    };
  }

  return {
    kind: "declined",
    code,
    title: "The payment processor declined this payment",
    message:
      safeMessage(raw) ||
      "The payment did not complete. Try checkout again with another card or payment method. ReachFly will provision the number only after a successful payment.",
  };
}

function safeMessage(value) {
  const text = String(value || "")
    .replace(/ElevenLabs/gi, "voice runtime")
    .replace(/ElevenAgent/gi, "voice agent")
    .replace(/Telnyx/gi, "calling provider")
    .replace(/\bSIP\b/gi, "carrier routing");

  if (/general decline/i.test(text) || /action ['"]?authorization/i.test(text)) {
    return "Your bank declined this card authorization. Try another card or payment method, or contact the issuing bank before retrying.";
  }

  return text;
}

function notify(type, title, message) {
  if (typeof window === "undefined") return;
  const bridge = window.reachflyToast;
  if (bridge && typeof bridge[type] === "function") {
    bridge[type](title, message);
    return;
  }
  window.dispatchEvent(
    new CustomEvent("reachfly:toast", {
      detail: { type, title, message },
    })
  );
}

function Styles() {
  return (
    <style>{`
      .rfpn{--card:#fff;--soft:#f3f4f5;--text:#191c1d;--text2:#464554;--muted:#767586;--line:#e3e5e7;--primary:#4648d4;--primary2:#3537bb;--psoft:#e8e9ff;--violet:#6b38d4;--vsoft:#f0eaff;--success:#087a51;--ssoft:#dcfce7;--warning:#8a6100;--wsoft:#fff4d6;--danger:#ba1a1a;--dsoft:#ffedeb;--ease:cubic-bezier(.2,.8,.2,1);width:100%;min-height:100%;padding:24px 30px 46px;color:var(--text);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:pageIn .24s var(--ease)}
      .rfpn *{box-sizing:border-box}.rfpn a{color:inherit}.rfpn .spin{animation:spin .8s linear infinite}
      @keyframes pageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes slideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}@keyframes shimmer{from{background-position:200% 0}to{background-position:-200% 0}}@keyframes pulse{50%{box-shadow:0 0 0 7px rgba(70,72,212,.04)}}

      .rfpn-header{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:18px}.eyebrow{display:block;margin-bottom:4px;color:var(--primary);font-size:9px;font-weight:750;line-height:13px;letter-spacing:.09em;text-transform:uppercase}.rfpn-header h1{margin:0;font:600 32px/40px Geist,Inter,sans-serif;letter-spacing:-.02em}.rfpn-header p{max-width:690px;margin:3px 0 0;color:var(--text2);font-size:13px;line-height:19px}.actions{display:flex;gap:8px}.btn{min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:7px 12px;border:1px solid transparent;border-radius:8px;text-decoration:none;white-space:nowrap;cursor:pointer;font:600 10px/15px Inter,sans-serif;transition:.14s var(--ease)}.btn:hover:not(:disabled){transform:translateY(-1px)}.btn:disabled{opacity:.45;cursor:not-allowed}.btn.primary{color:#fff!important;background:var(--primary);border-color:var(--primary);box-shadow:0 5px 14px rgba(70,72,212,.17)}.btn.primary:hover:not(:disabled){background:var(--primary2)}.btn.secondary{background:#fff;border-color:var(--line)}.btn.secondary:hover:not(:disabled){color:var(--primary)!important;background:var(--psoft)}.btn.compact{min-height:31px;padding:5px 8px;font-size:7px}

      .notice{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;margin-bottom:10px;border:1px solid;border-radius:9px;animation:fadeUp .18s var(--ease)}.notice>span{width:26px;height:26px;display:grid;place-items:center;flex:0 0 26px;background:#fff;border-radius:7px}.notice>div{display:grid;gap:1px}.notice strong{font-size:9px}.notice small{font-size:8px}.notice.error{color:#7d1717;background:var(--dsoft);border-color:#ffd0cc}.notice.success{color:#075b3d;background:var(--ssoft);border-color:#b8efd6}
      .payment-issue{display:grid;grid-template-columns:38px minmax(0,1fr);gap:11px;padding:13px 14px;margin-bottom:12px;color:#674b00;background:linear-gradient(135deg,#fff9e8,#fffdf6);border:1px solid #f0dda0;border-radius:11px;box-shadow:0 6px 20px rgba(112,81,0,.05);animation:fadeUp .18s var(--ease)}.payment-issue-icon{width:38px;height:38px;display:grid;place-items:center;color:#8a6100;background:#fff1c6;border-radius:10px}.payment-issue-copy{min-width:0}.payment-issue-copy>small{display:block;margin-bottom:1px;color:#8a6100;font-size:6px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.payment-issue-copy>strong{display:block;color:#4f3b08;font:600 12px/17px Geist,Inter,sans-serif}.payment-issue-copy>p{max-width:760px;margin:3px 0 8px;color:#725d22;font-size:8px;line-height:13px}.payment-issue-facts{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px}.payment-issue-facts span{display:inline-flex;align-items:center;gap:4px;padding:5px 7px;color:#6e5718;background:rgba(255,255,255,.78);border:1px solid #eedda7;border-radius:999px;font-size:6px;font-weight:650}.payment-code{margin-top:3px!important;color:var(--muted)!important;font-size:6px!important}

      .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.metric{min-height:74px;display:flex;align-items:center;gap:10px;padding:13px 14px;background:#fff;border:1px solid var(--line);border-radius:11px}.metric>span{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;color:var(--primary);background:var(--psoft);border-radius:9px}.metric.success>span{color:var(--success);background:var(--ssoft)}.metric.violet>span{color:var(--violet);background:var(--vsoft)}.metric.neutral>span{color:#5f6672;background:#edf0f4}.metric>div{min-width:0;display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:0 6px}.metric small{grid-column:1/-1;color:var(--muted);font-size:7px;font-weight:750;letter-spacing:.07em;text-transform:uppercase}.metric strong{font:600 18px/23px Geist,Inter,sans-serif}.metric em{overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap;font-size:7px;font-style:normal}

      .step-strip{min-height:58px;display:flex;align-items:center;gap:10px;padding:9px 13px;margin-bottom:12px;background:#fff;border:1px solid var(--line);border-radius:10px}.step-strip>a,.step-strip>div{min-width:0;display:flex;align-items:center;gap:7px;flex:1;text-decoration:none}.step-strip b{width:27px;height:27px;display:grid;place-items:center;flex:0 0 27px;color:var(--text2);background:#eceeef;border-radius:50%;font-size:7px}.step-strip .current b{color:#fff;background:var(--primary);box-shadow:0 0 0 4px rgba(70,72,212,.08)}.step-strip .journey-step.ready:not(.current) b{color:var(--success);background:var(--ssoft)}.step-strip .journey-step.ready strong{color:var(--text)}.step-strip span{min-width:0;display:grid}.step-strip small{color:var(--muted);font-size:6px}.step-strip strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px}.step-strip>i{width:36px;height:2px;background:#dde0e2;border-radius:999px;transition:.2s var(--ease)}.step-strip>i.ready{background:linear-gradient(90deg,var(--primary),#7c61df)}.connected-journey{box-shadow:0 8px 24px rgba(25,28,29,.035)}

      .mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.mode-card{min-height:142px;display:grid;grid-template-columns:46px minmax(0,1fr) 25px;align-items:start;gap:12px;padding:24px 20px;color:inherit;background:#eef0f2;border:1px solid transparent;border-radius:13px;text-align:left;cursor:pointer;transition:.15s var(--ease)}.mode-card:hover{transform:translateY(-1px)}.mode-card.active{background:#f0f0fb;border-color:rgba(70,72,212,.14);box-shadow:inset 4px 0 0 var(--primary)}.mode-card>span{width:46px;height:46px;display:grid;place-items:center;color:#697080;background:#dde3ef;border-radius:50%}.mode-card.active>span{color:#fff;background:#5b5ddd}.mode-card strong{display:block;margin:3px 0 5px;font:600 15px/20px Geist,Inter,sans-serif}.mode-card p{margin:0;color:var(--text2);font-size:9px;line-height:15px}.mode-card>i{width:23px;height:23px;display:grid;place-items:center;color:#777d89;background:#fff;border-radius:50%;font-style:normal}.mode-card.active>i{color:#fff;background:var(--primary)}

      .config-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:14px;align-items:stretch;margin-bottom:14px}.config-card,.context-card,.full-card{background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:0 1px 3px rgba(25,28,29,.03)}.config-card{min-width:0;padding:18px}.panel-head,.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.panel-head{margin-bottom:14px}.panel-head h2,.section-head h2{margin:0;font:600 17px/23px Geist,Inter,sans-serif}.panel-head p,.section-head p{margin:3px 0 0;color:var(--text2);font-size:9px;line-height:14px}.panel-badge{min-height:26px;display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;padding:5px 8px;color:var(--primary);background:var(--psoft);border-radius:999px;font-size:7px;font-weight:700}.live-dot{width:6px;height:6px;background:var(--primary);border-radius:50%;animation:pulse 1.8s ease-in-out infinite}

      .mode-picker{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;margin-bottom:12px;background:var(--soft);border-radius:9px}.mode-picker>span{color:var(--text2);font-size:7px;font-weight:700;text-transform:uppercase}.mode-picker>div{display:flex;gap:4px}.mode-picker button{min-height:29px;padding:5px 8px;color:var(--text2);background:#fff;border:1px solid var(--line);border-radius:7px;cursor:pointer;font-size:7px;font-weight:700}.mode-picker button.active{color:#fff;background:var(--primary);border-color:var(--primary)}

      .search-panel,.existing-form{padding:13px;background:#eef0f2;border-radius:10px}.search-grid{display:grid;grid-template-columns:82px 1fr 1.25fr auto;align-items:end;gap:8px}.existing-form{display:grid;grid-template-columns:1.15fr 1.3fr auto;align-items:end;gap:9px}.field{min-width:0;display:grid;gap:5px}.field>span{color:var(--text2);font-size:7px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}.input,.select{position:relative;height:39px;display:flex;align-items:center;background:#fff;border:1px solid var(--line);border-radius:7px}.input:focus-within,.select:focus-within{border-color:rgba(70,72,212,.45);box-shadow:0 0 0 3px rgba(70,72,212,.07)}.input i{width:30px;display:grid;place-items:center;color:var(--muted);font-style:normal}.input input,.select select{min-width:0;width:100%;height:37px;padding:0 10px;color:var(--text);background:transparent;border:0;outline:0;font-size:9px}.input i+input{padding-left:0}.select select{appearance:none;padding-right:28px}.select svg{position:absolute;right:9px;color:var(--muted);pointer-events:none}.search-button{min-width:100px}.permission{display:flex;align-items:flex-start;gap:6px;padding:8px 9px;margin-top:8px;color:#705100;background:var(--wsoft);border-radius:7px;font-size:7px;line-height:11px}

      .results{display:grid;gap:7px;margin-top:14px}.results-head{display:flex;justify-content:space-between;align-items:baseline;padding:0 2px 2px}.results-head strong{font-size:9px}.results-head span{color:var(--muted);font-size:7px}.result{min-height:70px;display:grid;grid-template-columns:38px minmax(0,1fr) 125px auto;align-items:center;gap:10px;padding:10px 11px;border:1px solid var(--line);border-radius:9px;animation:fadeUp .2s var(--ease) both;animation-delay:calc(var(--i) * 25ms)}.country{width:38px;height:38px;display:grid;place-items:center;color:#59606c;background:#eceeef;border-radius:50%;font-size:7px;font-weight:700}.result>div{min-width:0;display:grid}.result>div>strong{font:600 11px/15px Geist,Inter,sans-serif}.result>div>small{overflow:hidden;color:var(--text2);text-overflow:ellipsis;white-space:nowrap;font-size:7px}.result .price{justify-items:end}.result .price strong{font-size:9px}.result .price small{font-size:6px}

      .placeholder{min-height:220px;display:grid;place-items:center;align-content:center;gap:5px;padding:24px;text-align:center}.placeholder>span{width:46px;height:46px;display:grid;place-items:center;color:var(--primary);background:var(--psoft);border-radius:13px}.placeholder strong{font-size:9px}.placeholder p{max-width:390px;margin:0;color:var(--muted);font-size:7px;line-height:12px}.sandbox{display:flex;align-items:flex-start;gap:8px;padding:10px;margin-top:12px;color:#5b339b;background:var(--vsoft);border:1px solid #ded0f7;border-radius:8px}.sandbox strong{display:block;font-size:8px}.sandbox p{margin:1px 0 0;font-size:7px;line-height:11px}

      .verification{padding:14px;margin-top:14px;border:1px solid var(--line);border-radius:10px}.verification>header{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:8px;margin-bottom:8px}.verification>header>span{width:34px;height:34px;display:grid;place-items:center;color:var(--primary);background:var(--psoft);border-radius:9px}.verification>header>div{display:grid}.verification>header small{color:var(--muted);font-size:6px;text-transform:uppercase}.verification>header strong{font:600 11px/15px Geist,Inter,sans-serif}.verification>p{margin:0 0 11px;color:var(--text2);font-size:8px;line-height:13px}.status{min-height:23px;display:inline-flex;align-items:center;gap:4px;width:max-content;padding:4px 7px;border-radius:999px;font-size:6px;font-weight:750}.status.active{color:var(--success);background:var(--ssoft)}.status.pending{color:var(--warning);background:var(--wsoft)}.status.failed{color:var(--danger);background:var(--dsoft)}.status.neutral{color:#5c626c;background:#e9eaec}.verify-actions{display:grid;grid-template-columns:1fr auto;align-items:end;gap:8px;padding:10px;background:#f7f7fa;border-radius:8px}.verify-check{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;background:#f7f7fa;border-radius:8px}.verify-check strong{display:block;font-size:8px}.verify-check span{display:block;margin-top:2px;color:var(--muted);font-size:7px}.routing,.carrier-action{padding:10px;margin-top:9px;background:#f1f1fb;border-radius:8px}.routing strong{font-size:8px}.routing p{margin:2px 0 8px;color:var(--text2);font-size:7px;line-height:11px}.routing details{padding:8px;margin-bottom:8px;background:#fff;border-radius:7px}.routing summary{color:var(--primary);cursor:pointer;font-size:7px;font-weight:700}.routing code{display:block;overflow:auto;padding:7px;margin-top:7px;background:#f4f5f6;border-radius:6px;font-size:7px;white-space:nowrap}.routing details small{display:block;margin-top:4px;color:var(--muted);font-size:6px}.carrier-action{display:flex;align-items:flex-start;gap:6px;color:var(--text2);font-size:7px}.carrier-action svg{color:var(--success)}

      .context-card{overflow:hidden}.map-visual{position:relative;min-height:275px;display:grid;place-items:center;overflow:hidden;padding:28px;background:linear-gradient(145deg,rgba(70,72,212,.07),rgba(107,56,212,.03)),repeating-linear-gradient(0deg,transparent 0 38px,rgba(70,72,212,.045) 39px 40px),repeating-linear-gradient(90deg,transparent 0 38px,rgba(70,72,212,.045) 39px 40px),#edf0f4;border-bottom:1px solid var(--line)}.map-visual>div{position:relative;z-index:2;width:100%;max-width:230px;padding:16px;background:rgba(255,255,255,.92);border-radius:11px;box-shadow:0 10px 30px rgba(25,28,29,.08)}.map-visual>div>svg{color:var(--primary)}.map-visual strong{display:block;margin-top:6px;font-size:10px}.map-visual p{margin:3px 0 0;color:var(--text2);font-size:7px;line-height:12px}.pin{position:absolute;z-index:1;width:30px;height:30px;display:grid;place-items:center;color:#fff;background:var(--primary);border:4px solid rgba(255,255,255,.9);border-radius:50%}.pin.p1{left:17%;top:20%}.pin.p2{right:13%;top:28%;transform:scale(.82)}.pin.p3{left:23%;bottom:14%;transform:scale(.75)}.context-copy{padding:10px 13px;border-bottom:1px solid var(--line)}.context-line{display:flex;gap:8px;padding:8px}.context-line+.context-line{border-top:1px solid #f0f1f2}.context-line>span{width:29px;height:29px;display:grid;place-items:center;flex:0 0 29px;color:var(--primary);background:var(--psoft);border-radius:7px}.context-line strong{display:block;font-size:8px}.context-line p{margin:2px 0 0;color:var(--muted);font-size:7px;line-height:11px}.agent-card{display:grid;grid-template-columns:36px 1fr 26px;align-items:center;gap:8px;padding:13px}.agent-card>span{width:36px;height:36px;display:grid;place-items:center;color:#fff;border-radius:50%;font-size:8px;font-weight:800}.agent-card>span.primary{background:#5b5ddd}.agent-card>span.violet{background:#7546d9}.agent-card>span.blue{background:#3772b9}.agent-card>span.green{background:#23845f}.agent-card>span.amber{background:#a06e25}.agent-card>span.neutral{color:var(--primary);background:var(--psoft)}.agent-card>div{min-width:0;display:grid}.agent-card small{color:var(--muted);font-size:6px}.agent-card strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px}.agent-card em{color:var(--text2);font-size:7px;font-style:normal}.agent-card>a{width:26px;height:26px;display:grid;place-items:center;color:var(--muted)!important;background:var(--soft);border-radius:7px}.connected-copy{border-bottom:0}.connection-mini-flow{display:grid;grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr) 14px minmax(0,1fr);align-items:center;gap:4px;padding:10px 12px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#fbfbfc}.connection-mini-flow>svg{color:#b0b4bc}.connection-mini-flow>div{min-width:0;display:flex;align-items:center;gap:6px;padding:7px;color:#7e838c;background:#f0f1f2;border:1px solid transparent;border-radius:8px}.connection-mini-flow>div.ready{color:var(--primary);background:var(--psoft);border-color:rgba(70,72,212,.08)}.connection-mini-flow span{min-width:0;display:grid}.connection-mini-flow small{color:var(--muted);font-size:5px;text-transform:uppercase;letter-spacing:.05em}.connection-mini-flow strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:6px}

      .full-card{overflow:hidden;margin-top:12px}.section-head{min-height:70px;padding:15px 17px;background:#fbfbfc;border-bottom:1px solid var(--line)}.section-head h2{font-size:13px;line-height:18px}.section-head p{font-size:7px;line-height:12px}.section-head>span{color:var(--muted);font-size:7px}.orders{padding:8px}.orders article{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:8px;padding:9px;border-radius:8px}.orders article+article{border-top:1px solid #f0f1f2}.orders article>span{width:34px;height:34px;display:grid;place-items:center;color:var(--warning);background:var(--wsoft);border-radius:8px}.orders strong{display:block;font-size:9px}.orders small{color:var(--warning);font-size:6px}.orders p{margin:2px 0 0;color:var(--muted);font-size:7px}

      .number-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:12px}.number-card{min-width:0;min-height:88px;display:grid;grid-template-columns:38px minmax(0,1fr) auto 18px;align-items:center;gap:9px;padding:11px;color:inherit;background:#f2f3f4;border:1px solid transparent;border-radius:9px;text-align:left;cursor:pointer;animation:fadeUp .2s var(--ease) both;animation-delay:calc(var(--i) * 25ms)}.number-card:hover{transform:translateY(-1px)}.number-card.primary{background:#f0f0fb}.number-card.linked{border-color:rgba(70,72,212,.08)}.number-card.unlinked{background:#f7f7f8}.number-card.selected{border-color:rgba(70,72,212,.32);box-shadow:0 0 0 3px rgba(70,72,212,.05)}.number-icon{width:38px;height:38px;display:grid;place-items:center;color:#606672;background:#e4e6e8;border-radius:50%}.number-card.primary .number-icon{color:#fff;background:#8457df}.number-card>div{min-width:0;display:grid}.number-card>div>strong{font:600 11px/15px Geist,Inter,sans-serif}.number-card>div>small{color:var(--text2);font-size:6px}.number-card>div>p{margin:1px 0 0;color:var(--muted);font-size:7px}.number-card>svg{color:var(--muted)}.number-link-state{display:flex!important;align-items:center;gap:5px;margin-top:5px}.number-link-state>span{display:inline-flex;align-items:center;gap:3px;padding:3px 5px;border-radius:999px;font-size:6px;font-weight:700}.number-link-state .ready{color:var(--success);background:var(--ssoft)}.number-link-state .missing{color:var(--warning);background:var(--wsoft)}.number-link-state .direction{color:var(--text2);background:#e7e9eb}.empty{min-height:230px;display:grid;place-items:center;align-content:center;gap:5px;padding:25px;text-align:center}.empty>span{width:46px;height:46px;display:grid;place-items:center;color:var(--primary);background:var(--psoft);border-radius:13px}.empty h3{margin:0;font:600 11px/16px Geist,Inter,sans-serif}.empty p{max-width:430px;margin:0 0 5px;color:var(--muted);font-size:7px}

      .drawer-backdrop{position:fixed;z-index:190;inset:0;display:flex;justify-content:flex-end;background:rgba(20,22,28,.28);backdrop-filter:blur(2px);animation:fadeUp .16s var(--ease)}.drawer{width:min(460px,100vw);height:100%;overflow:auto;background:#fff;border-left:1px solid var(--line);box-shadow:-20px 0 50px rgba(25,28,29,.14);animation:slideIn .19s var(--ease)}.drawer>header{display:flex;justify-content:space-between;gap:12px;padding:20px;background:#fbfbfc;border-bottom:1px solid var(--line)}.drawer h2{margin:0;font:600 19px/25px Geist,Inter,sans-serif}.drawer header p{margin:2px 0 0;color:var(--text2);font-size:8px}.drawer header button{width:33px;height:33px;display:grid;place-items:center;padding:0;background:#fff;border:1px solid var(--line);border-radius:8px;cursor:pointer}.drawer-status{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:9px;padding:15px 18px;border-bottom:1px solid var(--line)}.drawer-status>span:first-child{width:42px;height:42px;display:grid;place-items:center;color:#fff;background:var(--primary);border-radius:12px}.drawer-status>div{display:grid}.drawer-status small{color:var(--muted);font-size:6px}.drawer-status strong{font-size:9px}.drawer-status p{margin:1px 0 0;color:var(--text2);font-size:7px}.drawer>section{padding:17px 18px;border-bottom:1px solid var(--line)}.drawer>section h3{margin:0 0 10px;color:var(--text2);font-size:8px;letter-spacing:.08em;text-transform:uppercase}.drawer dl{display:grid;gap:7px;margin:0}.drawer dl>div{display:grid;grid-template-columns:100px 1fr;gap:8px}.drawer dt{color:var(--muted);font-size:7px}.drawer dd{margin:0;overflow:hidden;text-align:right;text-overflow:ellipsis;white-space:nowrap;font-size:7px;font-weight:600}.drawer-journey{display:grid;grid-template-columns:minmax(0,1fr) 12px minmax(0,1fr) 12px minmax(0,1fr) 12px minmax(0,1fr);gap:4px;align-items:center}.drawer-journey>div{min-width:0;display:flex;align-items:center;gap:6px;padding:8px;color:#7f838c;background:#f2f3f4;border-radius:8px}.drawer-journey>div.ready{color:var(--primary);background:var(--psoft)}.drawer-journey>div>span{width:25px;height:25px;display:grid;place-items:center;flex:0 0 25px;background:#fff;border-radius:7px}.drawer-journey>div>div{min-width:0;display:grid}.drawer-journey small{color:var(--muted);font-size:5px;text-transform:uppercase}.drawer-journey strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:6px}.drawer-journey>i{height:2px;background:#dfe1e3;border-radius:999px}.drawer-journey>i.ready{background:var(--primary)}.drawer-links{display:grid;gap:6px}.drawer-links a{min-height:54px;display:grid;grid-template-columns:28px 1fr 18px;align-items:center;gap:7px;padding:8px;background:var(--soft);border-radius:8px;text-decoration:none}.drawer-links>a>svg:first-child{color:var(--primary)}.drawer-links a>span{display:grid}.drawer-links strong{font-size:7px}.drawer-links small{color:var(--muted);font-size:6px;line-height:10px}.linked-agent-list{display:grid;gap:6px}.linked-agent-list a{display:grid;grid-template-columns:32px minmax(0,1fr) 18px;align-items:center;gap:8px;padding:8px;background:#f6f6fb;border:1px solid rgba(70,72,212,.06);border-radius:8px;text-decoration:none}.linked-agent-list a>span{width:32px;height:32px;display:grid;place-items:center;color:#fff;background:var(--primary);border-radius:50%;font-size:7px;font-weight:800}.linked-agent-list a>span.violet{background:#7546d9}.linked-agent-list a>span.blue{background:#3772b9}.linked-agent-list a>span.green{background:#23845f}.linked-agent-list a>span.amber{background:#a06e25}.linked-agent-list a>div{min-width:0;display:grid}.linked-agent-list strong{font-size:7px}.linked-agent-list small{color:var(--muted);font-size:6px}.linked-agent-list a>svg{color:var(--muted)}.drawer-empty-link{display:flex;align-items:flex-start;gap:8px;padding:10px;color:var(--primary);background:var(--psoft);border-radius:8px}.drawer-empty-link>div{display:grid}.drawer-empty-link strong{color:var(--text);font-size:7px}.drawer-empty-link small{margin-top:2px;color:var(--muted);font-size:6px;line-height:10px}.drawer>footer{padding:14px 18px 22px}.drawer>footer .btn{width:100%}

      .number-grid.skeleton article,.metric.loading i,.mode-grid.loading i,.loading-panel>i{background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);background-size:220% 100%;animation:shimmer 1.25s linear infinite}.number-grid.skeleton article{min-height:82px;display:flex;align-items:center;gap:10px;padding:11px;border-radius:9px}.number-grid.skeleton article>i{width:38px;height:38px;background:#fff;border-radius:50%}.number-grid.skeleton article>span{flex:1;display:grid;gap:6px}.number-grid.skeleton article>span i{height:8px;background:#fff;border-radius:99px}.metric.loading>i{width:34px;height:34px;flex:0 0 34px;border-radius:9px}.metric.loading>span{flex:1;display:grid;gap:6px;background:transparent}.metric.loading>span i{height:8px;border-radius:99px}.metric.loading>span i:last-child{height:19px;width:70%}.mode-grid.loading i{min-height:142px;border-radius:13px}.loading-panel{min-height:420px;display:grid;align-content:start;gap:10px}.loading-panel>i{display:block;height:70px;border-radius:9px}.loading-panel>i:nth-child(2){height:220px}

      @media(max-width:1180px){.rfpn{padding:22px}.config-layout{grid-template-columns:minmax(0,1fr) 270px}.search-grid{grid-template-columns:80px 1fr 1.1fr}.search-button{grid-column:1/-1;width:100%}.result{grid-template-columns:38px 1fr 110px auto}}
      @media(max-width:940px){.rfpn-header{align-items:flex-start;flex-direction:column}.actions{width:100%;justify-content:flex-end}.metrics{grid-template-columns:1fr 1fr}.step-strip{display:none}.config-layout{grid-template-columns:1fr}.context-card{display:grid;grid-template-columns:1fr 1fr}.map-visual{min-height:230px;border-right:1px solid var(--line);border-bottom:0}.context-copy{border-bottom:0}.agent-card{grid-column:1/-1;border-top:1px solid var(--line)}.number-grid{grid-template-columns:1fr}}
      @media(max-width:720px){.rfpn{padding:18px 13px 84px}.connection-mini-flow{grid-template-columns:1fr}.connection-mini-flow>svg{transform:rotate(90deg);justify-self:center}.drawer-journey{grid-template-columns:1fr}.drawer-journey>i{width:2px;height:12px;justify-self:center}.mode-grid{grid-template-columns:1fr}.mode-card{min-height:118px;padding:18px 16px}.mode-picker{align-items:flex-start;flex-direction:column}.mode-picker>div{width:100%;display:grid;grid-template-columns:repeat(3,1fr)}.search-grid,.existing-form{grid-template-columns:1fr 1fr}.search-grid .field:nth-child(3),.search-button,.existing-form>.btn{grid-column:1/-1}.result{grid-template-columns:38px 1fr auto}.result .price{grid-column:2;justify-items:start}.result>.btn{grid-column:3;grid-row:1/3}.context-card{grid-template-columns:1fr}.map-visual{border-right:0;border-bottom:1px solid var(--line)}.verify-actions{grid-template-columns:1fr}.verify-check{align-items:stretch;flex-direction:column}}
      @media(max-width:540px){.rfpn{padding:16px 11px 84px}.rfpn-header h1{font-size:25px;line-height:32px}.rfpn-header p{font-size:11px}.actions{display:grid;grid-template-columns:1fr 1fr}.metrics{grid-template-columns:1fr;gap:7px}.metric{min-height:62px;padding:10px 12px}.config-card{padding:14px}.panel-head{flex-direction:column}.mode-picker>div{grid-template-columns:1fr}.search-grid,.existing-form{grid-template-columns:1fr}.search-grid .field:nth-child(3),.search-button,.existing-form>.btn{grid-column:auto}.result{grid-template-columns:36px 1fr}.result>.btn{grid-column:1/-1;grid-row:auto;width:100%}.result .price{grid-column:2}.number-card{grid-template-columns:38px 1fr auto}.number-card>svg{display:none}}
      @media(prefers-reduced-motion:reduce){.rfpn,.result,.number-card,.drawer,.drawer-backdrop,.notice,.live-dot,.number-grid.skeleton article,.metric.loading i,.mode-grid.loading i,.loading-panel>i,.rfpn .spin{animation:none!important}.rfpn *{transition-duration:.01ms!important}}
    `}</style>
  );
}
