import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
} from "../components/icons";
import { useAuth } from "../auth/AuthContext";
import {
  apiRequest,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

const STATUS_OPTIONS = [
  "all",
  "upcoming",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

const NICHE_PROFILES = [
  {
    key: "restaurant",
    matches: ["restaurant", "cafe", "café", "bar", "diner", "food", "hospitality"],
    singular: "Reservation",
    plural: "Reservations & Orders",
    bookingPlural: "Reservations",
    orderPlural: "Orders",
    customer: "Guest",
    customers: "Guests",
    service: "Table / order",
    todayLabel: "Guest outcomes today",
    upcomingLabel: "Upcoming reservations",
    completedLabel: "Completed / served",
    cancelledLabel: "Cancelled / no-show",
    supportsOrders: true,
  },
  {
    key: "clinic",
    matches: ["clinic", "medical", "doctor", "dentist", "dental", "health", "therapy", "chiropractic"],
    singular: "Appointment",
    plural: "Appointments",
    bookingPlural: "Appointments",
    customer: "Patient",
    customers: "Patients",
    service: "Service / provider",
    todayLabel: "Appointments today",
    upcomingLabel: "Upcoming appointments",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    key: "salon",
    matches: ["salon", "spa", "beauty", "barber", "hair", "nail", "wellness"],
    singular: "Booking",
    plural: "Bookings",
    bookingPlural: "Bookings",
    customer: "Client",
    customers: "Clients",
    service: "Treatment / stylist",
    todayLabel: "Bookings today",
    upcomingLabel: "Upcoming bookings",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    key: "real-estate",
    matches: ["real estate", "realtor", "property", "broker", "estate agent"],
    singular: "Viewing",
    plural: "Viewings",
    bookingPlural: "Viewings",
    customer: "Prospect",
    customers: "Prospects",
    service: "Property / agent",
    todayLabel: "Viewings today",
    upcomingLabel: "Upcoming viewings",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    key: "automotive",
    matches: ["auto", "automotive", "mechanic", "garage", "car repair", "dealership"],
    singular: "Service appointment",
    plural: "Service appointments",
    bookingPlural: "Appointments",
    customer: "Customer",
    customers: "Customers",
    service: "Vehicle / service",
    todayLabel: "Appointments today",
    upcomingLabel: "Upcoming appointments",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    key: "home-services",
    matches: ["home service", "plumber", "plumbing", "hvac", "electrician", "roofing", "cleaning", "contractor", "landscaping"],
    singular: "Service visit",
    plural: "Service visits",
    bookingPlural: "Service visits",
    customer: "Customer",
    customers: "Customers",
    service: "Service / technician",
    todayLabel: "Visits today",
    upcomingLabel: "Upcoming visits",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    key: "hotel",
    matches: ["hotel", "lodging", "accommodation"],
    singular: "Guest reservation",
    plural: "Guest reservations",
    bookingPlural: "Reservations",
    customer: "Guest",
    customers: "Guests",
    service: "Room / request",
    todayLabel: "Arrivals today",
    upcomingLabel: "Upcoming reservations",
    completedLabel: "Completed stays",
    cancelledLabel: "Cancelled / no-show",
  },
];

const DEFAULT_PROFILE = {
  key: "business",
  singular: "Booking",
  plural: "Operations",
  bookingPlural: "Bookings",
  customer: "Customer",
  customers: "Customers",
  service: "Service / owner",
  todayLabel: "Today",
  upcomingLabel: "Upcoming",
  completedLabel: "Completed",
  cancelledLabel: "Cancelled / no-show",
  supportsOrders: false,
};

export default function NicheOperations() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedDirection = normalizeDirection(searchParams.get("direction"));

  const [payload, setPayload] = useState(null);
  const [voiceDashboard, setVoiceDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [liveRevision, setLiveRevision] = useState(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const directionQuery = requestedDirection
        ? `&direction=${encodeURIComponent(requestedDirection)}`
        : "";

      const [operationsResult, dashboardResult] = await Promise.allSettled([
        apiRequest(`/operations?limit=500${directionQuery}`, { timeoutMs: 20_000 }),
        apiRequest("/telnyx/ai-agent/dashboard", { timeoutMs: 30_000 }),
      ]);

      let operations = operationsResult.status === "fulfilled"
        ? operationsResult.value
        : null;
      const dashboard = dashboardResult.status === "fulfilled"
        ? dashboardResult.value
        : null;

      if (!operations && dashboard) {
        operations = {
          source: "voice-dashboard-fallback",
          workspace: dashboard?.workspace || {},
          agent: dashboard?.agent || null,
          records: dashboard?.meetings || dashboard?.bookings || [],
        };
      }

      if (!operations) {
        throw operationsResult.reason || new Error("Your operations workspace could not be loaded.");
      }

      setPayload(operations || {});
      setVoiceDashboard(dashboard || {});
      setError("");
    } catch (requestError) {
      setError(requestError?.message || "Your operations workspace could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestedDirection]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refreshFromSocket = () => {
      setLiveRevision((value) => value + 1);
      void load({ silent: true });
    };

    const offCreated = onWorkspaceSocket("operations:created", refreshFromSocket);
    const offUpdated = onWorkspaceSocket("operations:updated", refreshFromSocket);

    return () => {
      offCreated?.();
      offUpdated?.();
    };
  }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const niche = useMemo(
    () =>
      resolveNiche([
        payload?.workspace?.niche,
        payload?.workspace?.industry,
        payload?.workspace?.businessType,
        payload?.niche,
        payload?.industry,
        voiceDashboard?.workspace?.niche,
        voiceDashboard?.workspace?.industry,
        voiceDashboard?.agent?.industry,
        voiceDashboard?.agent?.idealCustomer,
        user?.industry,
        user?.niche,
        user?.businessType,
        user?.companyIndustry,
        user?.companyName,
      ]),
    [payload, user, voiceDashboard]
  );

  const profile = useMemo(() => getNicheProfile(niche), [niche]);
  const agent = useMemo(() => resolveAgent(voiceDashboard, payload), [payload, voiceDashboard]);
  const brain = useMemo(() => buildBrainSummary(agent), [agent]);

  const records = useMemo(() => {
    const all = normalizeRecords(payload);
    if (!requestedDirection) return all;
    return all.filter((record) => normalizeDirection(record.direction) === requestedDirection);
  }, [payload, requestedDirection]);

  const visibleRecords = useMemo(() => {
    const q = query.trim().toLowerCase();

    return records
      .filter((record) => status === "all" || normalizeStatus(record.status) === status)
      .filter((record) => typeFilter === "all" || operationBucket(record) === typeFilter)
      .filter((record) => {
        if (!q) return true;
        return [
          record.customerName,
          record.phone,
          record.email,
          record.service,
          record.location,
          record.notes,
          record.source,
          record.status,
          record.operationType,
          record.agentName,
          record.items.map((item) => item.name).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort(sortOperations);
  }, [query, records, status, typeFilter]);

  const metrics = useMemo(() => buildMetrics(records), [records]);
  const selected = records.find((record) => record.id === selectedId) || null;
  const hasOrders = profile.supportsOrders || records.some((record) => operationBucket(record) === "orders");
  const activeAgentReady = Boolean(agent?.id || agent?.agentId || agent?.name);
  const numberReady = Boolean(agent?.fromNumber || agent?.phoneNumber || agent?.number);

  async function updateOperation(record, patch, successMessage) {
    if (!record?.id || updatingId) return;
    setUpdatingId(record.id);

    try {
      const response = await apiRequest(`/operations/${encodeURIComponent(record.id)}`, {
        method: "PATCH",
        body: patch,
        timeoutMs: 20_000,
      });

      const updated = normalizeRecords({ records: [response?.record || response] })[0];
      if (updated) {
        setPayload((current) => replaceOperation(current, updated));
      }
      setNotice(successMessage || "Operation updated.");
    } catch (requestError) {
      setError(requestError?.message || "The operation could not be updated.");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <>
      <OperationsStyles />
      <main className="rfops-page">
        <header className="rfops-header">
          <div>
            <span className="rfops-eyebrow">
              <Building2 size={14} />
              {niche || "Business operations"}
            </span>
            <h1>{profile.plural}</h1>
            <p>
              Every customer outcome stays connected to the AI agent, business context,
              call direction and operational record that created it.
            </p>
          </div>

          <div className="rfops-header-actions">
            <Link className="rfops-btn secondary" to="/app/agents">
              <Bot size={15} /> Manage agent
            </Link>
            <Link className="rfops-btn secondary" to="/app/dialer">
              <Phone size={15} /> Open Dialer
            </Link>
            <button
              type="button"
              className="rfops-btn primary"
              onClick={() => void load({ silent: true })}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        {notice ? (
          <section className="rfops-message success" role="status">
            <CheckCircle2 size={17} />
            <div><strong>Saved</strong><span>{notice}</span></div>
            <button type="button" onClick={() => setNotice("")}><X size={14} /></button>
          </section>
        ) : null}

        {error ? (
          <section className="rfops-message error" role="alert">
            <AlertTriangle size={17} />
            <div>
              <strong>Operations data needs attention</strong>
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => void load()}>Retry</button>
          </section>
        ) : null}

        <section className="rfops-journey" aria-label="Connected AI operations journey">
          <JourneyNode
            icon={<Brain size={16} />}
            label="Business Brain"
            value={brain.ready ? "Connected" : "Needs context"}
            state={brain.ready ? "ready" : "pending"}
          />
          <JourneyArrow />
          <JourneyNode
            icon={<Bot size={16} />}
            label="AI Agent"
            value={activeAgentReady ? agentName(agent) : "Create agent"}
            state={activeAgentReady ? "ready" : "pending"}
          />
          <JourneyArrow />
          <JourneyNode
            icon={<Phone size={16} />}
            label="Calling"
            value={numberReady ? formatDirection(agent?.direction || agent?.mode) : "Connect number"}
            state={numberReady ? "ready" : "pending"}
          />
          <JourneyArrow />
          <JourneyNode
            icon={<Database size={16} />}
            label="Live outcome"
            value={`${records.length.toLocaleString()} records`}
            state={records.length ? "live" : "ready"}
          />
          <JourneyArrow />
          <JourneyNode
            icon={<CheckCircle2 size={16} />}
            label="Team action"
            value="Review & fulfill"
            state="ready"
          />
        </section>

        <section className="rfops-brain-card">
          <div className="rfops-brain-main">
            <span className={`rfops-brain-icon ${brain.ready ? "ready" : ""}`}><Brain size={18} /></span>
            <div>
              <span className="rfops-eyebrow">Agent operating context</span>
              <h2>{brain.ready ? "Business Brain is available to the agent" : "Complete the Business Brain"}</h2>
              <p>
                {brain.ready
                  ? "The agent can combine your approved instructions and business knowledge with live workspace records. Live reservation, order and availability facts still have to come from connected tools or stored records."
                  : "Add approved business knowledge, real hours and agent instructions so calls stay accurate and useful."}
              </p>
            </div>
          </div>
          <div className="rfops-brain-facts">
            <BrainFact label="System prompt" ready={brain.promptReady} />
            <BrainFact label="Business knowledge" ready={brain.knowledgeReady} />
            <BrainFact label="Business hours" ready={brain.hoursReady} />
            <BrainFact label="Phone number" ready={numberReady} />
          </div>
          <Link className="rfops-inline-link" to="/app/agents">
            Edit agent context <ArrowRight size={13} />
          </Link>
        </section>

        <section className="rfops-metrics" aria-label={`${profile.plural} summary`}>
          <Metric icon={<Calendar size={17} />} label={profile.todayLabel} value={metrics.today} />
          <Metric icon={<Clock3 size={17} />} label={profile.upcomingLabel} value={metrics.upcoming} />
          <Metric icon={<CheckCircle2 size={17} />} label={profile.completedLabel} value={metrics.completed} />
          <Metric
            icon={hasOrders ? <Activity size={17} /> : <Users size={17} />}
            label={hasOrders ? "Orders captured" : profile.cancelledLabel}
            value={hasOrders ? metrics.orders : metrics.cancelled}
          />
        </section>

        <section className="rfops-card">
          <div className="rfops-card-head">
            <div>
              <span className="rfops-eyebrow">
                <span className="rfops-live-dot" /> Live operational queue
              </span>
              <h2>{profile.plural}</h2>
            </div>
            <strong>{visibleRecords.length.toLocaleString()} visible · live rev {liveRevision}</strong>
          </div>

          <div className="rfops-type-tabs">
            <button type="button" className={typeFilter === "all" ? "active" : ""} onClick={() => setTypeFilter("all")}>
              All outcomes <span>{records.length}</span>
            </button>
            <button type="button" className={typeFilter === "bookings" ? "active" : ""} onClick={() => setTypeFilter("bookings")}>
              {profile.bookingPlural} <span>{records.filter((record) => operationBucket(record) === "bookings").length}</span>
            </button>
            {hasOrders ? (
              <button type="button" className={typeFilter === "orders" ? "active" : ""} onClick={() => setTypeFilter("orders")}>
                {profile.orderPlural || "Orders"} <span>{records.filter((record) => operationBucket(record) === "orders").length}</span>
              </button>
            ) : null}
          </div>

          <div className="rfops-toolbar">
            <label className="rfops-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${profile.plural.toLowerCase()}...`}
              />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={13} />
                </button>
              ) : null}
            </label>

            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All statuses" : formatStatus(value)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <OperationsSkeleton />
          ) : visibleRecords.length ? (
            <div className="rfops-table-wrap">
              <table className="rfops-table">
                <thead>
                  <tr>
                    <th>{profile.customer}</th>
                    <th>Outcome</th>
                    <th>Date & time</th>
                    <th>{profile.service}</th>
                    <th>AI connection</th>
                    <th>Status</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div className="rfops-customer">
                          <span>{initials(record.customerName)}</span>
                          <div>
                            <strong>{record.customerName || `Unknown ${profile.customer.toLowerCase()}`}</strong>
                            <small>{record.phone || record.email || record.company || "Contact captured by ReachFly"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`rfops-kind ${operationBucket(record)}`}>
                          {operationBucket(record) === "orders" ? "Order" : profile.singular}
                        </span>
                        <small>{formatDirection(record.direction) || "Workspace"}</small>
                      </td>
                      <td>
                        <strong>{formatDate(record.startAt || record.createdAt)}</strong>
                        <small>{formatTime(record.startAt || record.createdAt)}</small>
                      </td>
                      <td>
                        <strong>{record.service || orderSummary(record) || profile.singular}</strong>
                        <small>{record.partySize ? `Party of ${record.partySize}` : record.items.length ? `${record.items.length} order line${record.items.length === 1 ? "" : "s"}` : record.notes || record.provider || ""}</small>
                      </td>
                      <td>
                        <strong className="rfops-agent-cell"><Bot size={12} /> {record.agentName || agentName(agent) || "ReachFly AI"}</strong>
                        <small>{record.callId ? `Call ${shortId(record.callId)}` : record.channel || record.source || "Connected workspace"}</small>
                      </td>
                      <td>
                        <span className={`rfops-status ${normalizeStatus(record.status)}`}>
                          {formatStatus(record.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="rfops-open"
                          onClick={() => setSelectedId(record.id)}
                          aria-label={`Open ${profile.singular.toLowerCase()}`}
                        >
                          <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rfops-empty">
              <Sparkles size={25} />
              <h3>No {profile.plural.toLowerCase()} match this view</h3>
              <p>
                When the connected AI agent creates a reservation, appointment, order or other supported outcome,
                it will appear here and stay attached to its call context.
              </p>
              <Link className="rfops-btn secondary" to="/app/agents">Review agent setup</Link>
            </div>
          )}
        </section>

        {selected ? (
          <div
            className="rfops-drawer-backdrop"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setSelectedId("");
            }}
          >
            <aside className="rfops-drawer" aria-label={`${profile.singular} details`}>
              <div className="rfops-drawer-head">
                <div>
                  <span className="rfops-eyebrow">
                    {operationBucket(selected) === "orders" ? "Order" : profile.singular}
                  </span>
                  <h2>{selected.customerName || profile.customer}</h2>
                  <p>{selected.id}</p>
                </div>
                <button type="button" onClick={() => setSelectedId("")} aria-label="Close details">
                  <X size={17} />
                </button>
              </div>

              <div className="rfops-drawer-connection">
                <span><Bot size={14} /></span>
                <div>
                  <small>Created through</small>
                  <strong>{selected.agentName || agentName(agent) || "ReachFly AI"}</strong>
                  <p>{[formatDirection(selected.direction), selected.channel, selected.source].filter(Boolean).join(" · ") || "Connected workspace"}</p>
                </div>
              </div>

              <Detail label="Date" value={formatDate(selected.startAt || selected.createdAt)} />
              <Detail label="Time" value={formatTime(selected.startAt || selected.createdAt)} />
              <Detail label={profile.service} value={selected.service || selected.provider || orderSummary(selected) || "Not specified"} />
              {selected.partySize ? <Detail label="Party size" value={String(selected.partySize)} /> : null}
              <Detail label="Phone" value={selected.phone || "Not provided"} />
              <Detail label="Email" value={selected.email || "Not provided"} />
              <Detail label="Location" value={selected.location || "Not specified"} icon={<MapPin size={14} />} />
              <Detail label="Status" value={formatStatus(selected.status)} />
              {selected.callId ? <Detail label="Originating call" value={selected.callId} /> : null}
              {selected.campaignId ? <Detail label="Campaign" value={selected.campaignId} /> : null}
              {selected.items.length ? <OrderItems items={selected.items} total={selected.total} /> : null}
              <Detail label="Notes / context" value={selected.notes || "No additional notes recorded."} multiline />

              <section className="rfops-status-actions">
                <span>Update operational status</span>
                <div>
                  {["confirmed", "in_progress", "completed", "cancelled"].map((nextStatus) => (
                    <button
                      type="button"
                      key={nextStatus}
                      className={normalizeStatus(selected.status) === nextStatus ? "active" : ""}
                      disabled={updatingId === selected.id}
                      onClick={() => void updateOperation(
                        selected,
                        { status: nextStatus },
                        `${operationBucket(selected) === "orders" ? "Order" : profile.singular} marked ${formatStatus(nextStatus).toLowerCase()}.`
                      )}
                    >
                      {normalizeStatus(selected.status) === nextStatus ? <Check size={12} /> : null}
                      {formatStatus(nextStatus)}
                    </button>
                  ))}
                </div>
              </section>

              <div className="rfops-drawer-actions">
                {selected.phone ? (
                  <Link className="rfops-btn primary" to={`/app/dialer?phone=${encodeURIComponent(selected.phone)}`}>
                    <Phone size={15} /> Call {profile.customer}
                  </Link>
                ) : null}
                <Link className="rfops-btn secondary" to="/app/inbox">
                  Open conversations
                </Link>
              </div>
            </aside>
          </div>
        ) : null}
      </main>
    </>
  );
}

function JourneyNode({ icon, label, value, state = "ready" }) {
  return (
    <article className={`rfops-journey-node ${state}`}>
      <span>{icon}</span>
      <div><small>{label}</small><strong>{value}</strong></div>
    </article>
  );
}

function JourneyArrow() {
  return <ArrowRight className="rfops-journey-arrow" size={14} />;
}

function BrainFact({ label, ready }) {
  return (
    <span className={ready ? "ready" : "pending"}>
      {ready ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
      {label}
    </span>
  );
}

function Metric({ icon, label, value }) {
  return (
    <article className="rfops-metric">
      <span>{icon}</span>
      <div>
        <strong>{Number(value || 0).toLocaleString()}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function Detail({ label, value, icon = null, multiline = false }) {
  return (
    <div className={`rfops-detail ${multiline ? "multiline" : ""}`}>
      <span>{label}</span>
      <strong>{icon}{value}</strong>
    </div>
  );
}

function OrderItems({ items, total }) {
  return (
    <section className="rfops-order-items">
      <span>Order items</span>
      <div>
        {items.map((item, index) => (
          <article key={`${item.name}-${index}`}>
            <b>{item.quantity || 1}×</b>
            <div><strong>{item.name || "Item"}</strong>{item.instructions ? <small>{item.instructions}</small> : null}</div>
            {Number.isFinite(item.price) && item.price > 0 ? <em>{formatMoney(item.price)}</em> : null}
          </article>
        ))}
      </div>
      {Number.isFinite(total) && total > 0 ? <footer><span>Total</span><strong>{formatMoney(total)}</strong></footer> : null}
    </section>
  );
}

function OperationsSkeleton() {
  return (
    <div className="rfops-skeleton">
      {Array.from({ length: 6 }).map((_, index) => <span key={index} />)}
    </div>
  );
}

function resolveAgent(dashboard, payload) {
  const agents = Array.isArray(dashboard?.agents) ? dashboard.agents : [];
  return dashboard?.agent || agents.find((item) => item?.active !== false) || agents[0] || payload?.agent || null;
}

function buildBrainSummary(agent) {
  const promptReady = Boolean(String(agent?.systemPrompt || agent?.agentContext || agent?.instructions || "").trim());
  const knowledgeReady = Boolean(String(agent?.businessKnowledge || agent?.businessMemory || agent?.knowledge || "").trim());
  const hours = agent?.businessHours;
  const hoursReady = Boolean(hours && typeof hours === "object" && Object.values(hours).some((day) => {
    if (!day || typeof day !== "object") return false;
    return day.closed === true || Boolean(day.open && day.close);
  }));

  return {
    promptReady,
    knowledgeReady,
    hoursReady,
    ready: promptReady && knowledgeReady && hoursReady,
  };
}

function normalizeRecords(payload) {
  const raw =
    payload?.records ||
    payload?.operations ||
    payload?.bookings ||
    payload?.reservations ||
    payload?.appointments ||
    payload?.meetings ||
    payload?.data?.records ||
    [];

  return (Array.isArray(raw) ? raw : [])
    .map((item, index) => {
      const items = normalizeOrderItems(item?.items || item?.orderItems || item?.lineItems || item?.order?.items);
      const explicitTotal = Number(item?.total ?? item?.orderTotal ?? item?.amount ?? item?.order?.total);
      const calculatedTotal = items.reduce((sum, row) => sum + ((row.price || 0) * (row.quantity || 1)), 0);

      return {
        id: String(item?.id || item?.bookingId || item?.meetingId || item?.orderId || `operation-${index}`),
        operationType: String(item?.operationType || item?.type || item?.kind || (items.length ? "order" : "booking")).trim(),
        customerName:
          item?.customerName || item?.guestName || item?.patientName || item?.clientName ||
          item?.leadName || item?.contactName || item?.name || "",
        company: item?.company || item?.business || item?.companyName || "",
        phone: item?.phone || item?.customerPhone || item?.leadPhone || "",
        email: item?.email || item?.customerEmail || item?.leadEmail || "",
        startAt:
          item?.startAt || item?.scheduledAt || item?.meetingAt || item?.reservationAt ||
          item?.appointmentAt || item?.dateTime || item?.date || item?.createdAt || "",
        createdAt: item?.createdAt || "",
        updatedAt: item?.updatedAt || "",
        service:
          item?.service || item?.serviceName || item?.reservationType || item?.appointmentType ||
          item?.property || item?.room || item?.title || "",
        provider: item?.provider || item?.agentName || item?.staffName || item?.assigneeName || "",
        agentName: item?.agentName || item?.createdByAgentName || "",
        location: item?.location || item?.address || item?.venue || "",
        partySize: Number(item?.partySize || item?.guests || item?.covers || 0) || 0,
        notes: item?.notes || item?.specialRequests || item?.instructions || item?.context || item?.summary || "",
        source: item?.source || item?.sourceName || "ReachFly AI",
        channel: item?.channel || item?.sourceChannel || item?.createdByChannel || "",
        direction: normalizeDirection(item?.direction || item?.callDirection),
        status: normalizeStatus(item?.status || item?.bookingStatus || item?.orderStatus || "upcoming"),
        items,
        total: Number.isFinite(explicitTotal) ? explicitTotal : calculatedTotal,
        callId: String(item?.callId || item?.call_id || ""),
        campaignId: String(item?.campaignId || item?.campaign_id || ""),
        leadId: String(item?.leadId || item?.lead_id || ""),
      };
    })
    .filter((item) => item.startAt || item.customerName || item.phone || item.email || item.items.length);
}

function normalizeOrderItems(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    name: String(item?.name || item?.item || item?.product || item?.title || "").trim(),
    quantity: Math.max(1, Number(item?.quantity || item?.qty || 1) || 1),
    price: Number(item?.price || item?.unitPrice || item?.amount || 0) || 0,
    instructions: String(item?.instructions || item?.notes || item?.modifiers || "").trim(),
  })).filter((item) => item.name);
}

function replaceOperation(payload, updated) {
  if (!payload || !updated?.id) return payload;
  const current = normalizeRecords(payload);
  const next = current.map((item) => item.id === updated.id ? { ...item, ...updated } : item);
  if (!next.some((item) => item.id === updated.id)) next.unshift(updated);
  return { ...payload, records: next, operations: next };
}

function operationBucket(record) {
  const value = String(record?.operationType || "").toLowerCase();
  return /order|takeout|delivery|pickup|food/.test(value) || record?.items?.length ? "orders" : "bookings";
}

function orderSummary(record) {
  if (!record?.items?.length) return "";
  return record.items.slice(0, 2).map((item) => `${item.quantity || 1}× ${item.name}`).join(", ") + (record.items.length > 2 ? ` +${record.items.length - 2}` : "");
}

function buildMetrics(records) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endToday = startToday + 86_400_000;

  return records.reduce((acc, record) => {
    const time = getTimestamp(record.startAt || record.createdAt);
    const status = normalizeStatus(record.status);
    const isOrder = operationBucket(record) === "orders";

    if (time >= startToday && time < endToday && !["cancelled", "no_show"].includes(status)) acc.today += 1;
    if (!isOrder && time >= now.getTime() && !["cancelled", "no_show", "completed"].includes(status)) acc.upcoming += 1;
    if (["completed", "fulfilled", "served"].includes(status)) acc.completed += 1;
    if (["cancelled", "no_show"].includes(status)) acc.cancelled += 1;
    if (isOrder) acc.orders += 1;
    return acc;
  }, { today: 0, upcoming: 0, completed: 0, cancelled: 0, orders: 0 });
}

function sortOperations(a, b) {
  const left = getTimestamp(a.startAt || a.createdAt);
  const right = getTimestamp(b.startAt || b.createdAt);
  const now = Date.now();
  const leftFuture = left >= now;
  const rightFuture = right >= now;
  if (leftFuture !== rightFuture) return leftFuture ? -1 : 1;
  return leftFuture ? left - right : right - left;
}

function resolveNiche(values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function getNicheProfile(niche) {
  const value = String(niche || "").toLowerCase();
  return NICHE_PROFILES.find((profile) => profile.matches.some((term) => value.includes(term))) || DEFAULT_PROFILE;
}

function agentName(agent) {
  return String(agent?.name || agent?.agentName || agent?.displayName || "").trim();
}

function normalizeDirection(value) {
  const direction = String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (["both", "inbound_outbound", "inbound_and_outbound"].includes(direction)) return "both";
  return ["inbound", "outbound"].includes(direction) ? direction : "";
}

function formatDirection(value) {
  const direction = normalizeDirection(value);
  if (direction === "both") return "Inbound + outbound";
  if (direction === "inbound") return "Inbound";
  if (direction === "outbound") return "Outbound";
  return "";
}

function normalizeStatus(value) {
  const status = String(value || "upcoming").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["booked", "scheduled", "pending", "draft"].includes(status)) return status === "draft" ? "in_progress" : "upcoming";
  if (["accepted", "ready"].includes(status)) return "confirmed";
  if (["processing", "preparing", "active"].includes(status)) return "in_progress";
  if (["complete", "done", "finished", "attended", "fulfilled", "served"].includes(status)) return "completed";
  if (["canceled", "cancelled"].includes(status)) return "cancelled";
  if (["noshow", "no_show", "missed"].includes(status)) return "no_show";
  return status || "upcoming";
}

function formatStatus(value) {
  return normalizeStatus(value).split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function getTimestamp(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function formatDate(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return "Date pending";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(time));
}

function formatTime(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return "Time pending";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(time));
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(number);
}

function initials(value) {
  const parts = String(value || "RF").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "RF";
}

function shortId(value) {
  const text = String(value || "");
  return text.length > 14 ? `${text.slice(0, 7)}…${text.slice(-5)}` : text;
}

function OperationsStyles() {
  return (
    <style>{`
      .rfops-page{width:min(1480px,100%);margin:0 auto;padding:24px;color:#191c1d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.rfops-page *{box-sizing:border-box}.rfops-page button,.rfops-page input,.rfops-page select{font:inherit}
      .rfops-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:16px}.rfops-header>div:first-child{max-width:790px}.rfops-eyebrow{display:inline-flex;align-items:center;gap:7px;color:#5658d6;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.rfops-header h1{margin:7px 0 5px;font-size:31px;line-height:36px;letter-spacing:-.04em}.rfops-header p{margin:0;color:#686873;font-size:12px;line-height:19px}.rfops-header-actions{display:flex;gap:8px;flex-wrap:wrap}
      .rfops-btn{min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 13px;border-radius:9px;border:1px solid #dedfe5;font-size:10px;font-weight:750;text-decoration:none;cursor:pointer}.rfops-btn.primary{color:#fff;background:#5658d6;border-color:#5658d6}.rfops-btn.secondary{color:#292b33;background:#fff}.rfops-btn:disabled{opacity:.55;cursor:not-allowed}.rfops-btn .spin{animation:rfopsSpin 900ms linear infinite}@keyframes rfopsSpin{to{transform:rotate(360deg)}}
      .rfops-message{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:11px 13px;border-radius:10px}.rfops-message.error{color:#852d2d;background:#fff6f6;border:1px solid #f0d5d5}.rfops-message.success{color:#246341;background:#f3fbf6;border:1px solid #d5efdf}.rfops-message>div{display:grid;gap:2px;flex:1}.rfops-message strong{font-size:11px}.rfops-message span{font-size:10px}.rfops-message button{display:grid;place-items:center;border:0;background:transparent;color:inherit;font-size:10px;font-weight:800;cursor:pointer}
      .rfops-journey{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr) 18px minmax(0,1fr) 18px minmax(0,1fr) 18px minmax(0,1fr);align-items:center;gap:5px;margin-bottom:12px;padding:10px;border:1px solid #e2e3e8;border-radius:13px;background:linear-gradient(180deg,#fff,#fbfbfe);box-shadow:0 6px 20px rgba(31,33,42,.035)}.rfops-journey-node{min-width:0;display:flex;align-items:center;gap:8px;padding:9px;border-radius:10px;background:#fff}.rfops-journey-node>span{width:29px;height:29px;display:grid;place-items:center;flex:0 0 29px;border-radius:8px;background:#f0f0f4;color:#777783}.rfops-journey-node.ready>span{background:#eeeeff;color:#5658d6}.rfops-journey-node.live>span{background:#e9f8ef;color:#237341;box-shadow:0 0 0 0 rgba(35,115,65,.18);animation:rfopsPulse 1.7s infinite}.rfops-journey-node.pending>span{background:#fff5e5;color:#a06808}.rfops-journey-node div{min-width:0}.rfops-journey-node small,.rfops-journey-node strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rfops-journey-node small{color:#92929d;font-size:8px}.rfops-journey-node strong{margin-top:2px;color:#292b33;font-size:9px}.rfops-journey-arrow{color:#babac3}@keyframes rfopsPulse{70%{box-shadow:0 0 0 7px rgba(35,115,65,0)}100%{box-shadow:0 0 0 0 rgba(35,115,65,0)}}
      .rfops-brain-card{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(340px,.8fr) auto;align-items:center;gap:16px;margin-bottom:12px;padding:14px 15px;border:1px solid #dedffa;border-radius:13px;background:linear-gradient(135deg,#f8f8ff,#fff 72%)}.rfops-brain-main{display:flex;align-items:flex-start;gap:10px}.rfops-brain-icon{width:36px;height:36px;display:grid;place-items:center;flex:0 0 36px;border-radius:10px;background:#fff1df;color:#99610a}.rfops-brain-icon.ready{background:#ececff;color:#5658d6}.rfops-brain-main h2{margin:3px 0 3px;font-size:13px}.rfops-brain-main p{max-width:680px;margin:0;color:#757580;font-size:9px;line-height:14px}.rfops-brain-facts{display:grid;grid-template-columns:1fr 1fr;gap:6px}.rfops-brain-facts span{display:flex;align-items:center;gap:5px;padding:7px 8px;border-radius:8px;background:#fff;color:#7c7d87;font-size:8px;font-weight:700}.rfops-brain-facts span.ready{color:#257344;background:#f3fbf6}.rfops-brain-facts span.pending{color:#95620d;background:#fff9ef}.rfops-inline-link{display:inline-flex;align-items:center;gap:5px;color:#5658d6;text-decoration:none;font-size:9px;font-weight:800;white-space:nowrap}
      .rfops-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.rfops-metric{display:flex;align-items:center;gap:11px;padding:15px;background:#fff;border:1px solid #e4e5e8;border-radius:12px;box-shadow:0 5px 18px rgba(29,32,38,.04)}.rfops-metric>span{width:34px;height:34px;display:grid;place-items:center;color:#5658d6;background:#f0f0ff;border-radius:9px}.rfops-metric div{display:grid;gap:1px}.rfops-metric strong{font-size:19px;line-height:22px}.rfops-metric small{color:#777783;font-size:9px}
      .rfops-card{background:#fff;border:1px solid #e2e3e8;border-radius:14px;box-shadow:0 8px 26px rgba(28,30,38,.05);overflow:hidden}.rfops-card-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:17px 18px 13px;border-bottom:1px solid #ececf0}.rfops-card-head h2{margin:3px 0 0;font-size:17px}.rfops-card-head>strong{color:#888893;font-size:8px;font-weight:700}.rfops-live-dot{width:6px;height:6px;border-radius:999px;background:#33a264;box-shadow:0 0 0 0 rgba(51,162,100,.3);animation:rfopsPulse 1.7s infinite}.rfops-type-tabs{display:flex;gap:6px;padding:9px 12px 0;background:#fafafd}.rfops-type-tabs button{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid transparent;border-radius:8px;background:transparent;color:#73747f;font-size:9px;font-weight:750;cursor:pointer}.rfops-type-tabs button span{min-width:18px;padding:2px 5px;border-radius:999px;background:#eeeef2;color:#777883;font-size:7px;text-align:center}.rfops-type-tabs button.active{border-color:#dadafa;background:#f0f0ff;color:#5052c9}.rfops-type-tabs button.active span{background:#5658d6;color:#fff}.rfops-toolbar{display:flex;gap:9px;padding:9px 12px 10px;background:#fafafd;border-bottom:1px solid #ececf0}.rfops-search{min-height:36px;display:flex;align-items:center;gap:7px;flex:1;padding:0 10px;background:#fff;border:1px solid #dedfe5;border-radius:8px;color:#858590}.rfops-search input{width:100%;border:0;outline:0;background:transparent;font-size:10px}.rfops-search button{display:grid;place-items:center;border:0;background:transparent;color:#858590;cursor:pointer}.rfops-toolbar select{min-width:160px;padding:0 9px;background:#fff;border:1px solid #dedfe5;border-radius:8px;font-size:10px}
      .rfops-table-wrap{overflow:auto}.rfops-table{width:100%;border-collapse:collapse;min-width:1040px}.rfops-table th{padding:10px 12px;color:#777783;background:#fbfbfd;border-bottom:1px solid #ececf0;text-align:left;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.rfops-table td{padding:11px 12px;border-bottom:1px solid #f0f0f3;vertical-align:middle}.rfops-table tr:last-child td{border-bottom:0}.rfops-table td>strong,.rfops-customer strong{display:block;color:#272930;font-size:10px}.rfops-table td>small,.rfops-customer small{display:block;margin-top:2px;color:#858590;font-size:8px;line-height:12px}.rfops-customer{display:flex;align-items:center;gap:9px}.rfops-customer>span{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;color:#5658d6;background:#eeeeff;border-radius:8px;font-size:9px;font-weight:800}.rfops-kind{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eff0ff;color:#5557c7;font-size:8px;font-weight:800}.rfops-kind.orders{background:#fff3e8;color:#a25a17}.rfops-agent-cell{display:flex!important;align-items:center;gap:4px}.rfops-status{display:inline-flex;padding:4px 7px;border-radius:999px;background:#f0f0f4;color:#62626e;font-size:8px;font-weight:800;text-transform:capitalize}.rfops-status.confirmed,.rfops-status.completed{background:#ecf8f0;color:#237341}.rfops-status.upcoming{background:#efefff;color:#4d4fc4}.rfops-status.in_progress{background:#fff5df;color:#94600b}.rfops-status.cancelled,.rfops-status.no_show{background:#fff0f0;color:#9d3939}.rfops-open{width:30px;height:30px;display:grid;place-items:center;border:1px solid #e0e1e6;border-radius:8px;background:#fff;color:#5658d6;cursor:pointer}.rfops-open:hover{background:#f5f5ff}
      .rfops-empty{min-height:280px;display:grid;place-items:center;align-content:center;gap:7px;padding:30px;text-align:center;color:#858590}.rfops-empty h3{margin:3px 0 0;color:#292b33;font-size:15px}.rfops-empty p{max-width:560px;margin:0;font-size:10px;line-height:16px}.rfops-skeleton{display:grid;gap:8px;padding:14px}.rfops-skeleton span{height:48px;border-radius:8px;background:linear-gradient(90deg,#f1f1f4,#f8f8fa,#f1f1f4);background-size:200% 100%;animation:rfopsShimmer 1.2s linear infinite}@keyframes rfopsShimmer{to{background-position:-200% 0}}
      .rfops-drawer-backdrop{position:fixed;inset:0;z-index:80;display:flex;justify-content:flex-end;background:rgba(20,22,28,.24);backdrop-filter:blur(2px)}.rfops-drawer{width:min(470px,94vw);height:100%;overflow:auto;padding:20px;background:#fff;box-shadow:-18px 0 50px rgba(25,27,35,.16)}.rfops-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:14px;border-bottom:1px solid #e9e9ed}.rfops-drawer-head h2{margin:4px 0 0;font-size:20px}.rfops-drawer-head p{margin:3px 0 0;color:#9a9aa3;font-size:7px}.rfops-drawer-head button{width:32px;height:32px;display:grid;place-items:center;border:1px solid #e2e3e8;background:#fff;border-radius:8px;cursor:pointer}.rfops-drawer-connection{display:flex;align-items:center;gap:9px;margin:12px 0 2px;padding:10px;border:1px solid #e6e6f8;border-radius:10px;background:#f9f9ff}.rfops-drawer-connection>span{width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:#ececff;color:#5658d6}.rfops-drawer-connection small,.rfops-drawer-connection strong,.rfops-drawer-connection p{display:block;margin:0}.rfops-drawer-connection small{color:#92929d;font-size:7px}.rfops-drawer-connection strong{margin-top:2px;font-size:10px}.rfops-drawer-connection p{margin-top:2px;color:#7c7d87;font-size:8px}.rfops-detail{display:grid;grid-template-columns:125px minmax(0,1fr);gap:12px;padding:11px 0;border-bottom:1px solid #f0f0f3}.rfops-detail>span{color:#858590;font-size:9px}.rfops-detail>strong{display:flex;align-items:flex-start;gap:5px;font-size:10px;line-height:16px;word-break:break-word}.rfops-detail.multiline{grid-template-columns:1fr}.rfops-detail.multiline strong{font-weight:500;color:#555661}.rfops-order-items{padding:12px 0;border-bottom:1px solid #f0f0f3}.rfops-order-items>span{color:#858590;font-size:9px}.rfops-order-items>div{display:grid;gap:5px;margin-top:7px}.rfops-order-items article{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:7px;align-items:start;padding:8px;border-radius:8px;background:#f8f8fa}.rfops-order-items article>b{color:#5658d6;font-size:9px}.rfops-order-items article strong,.rfops-order-items article small{display:block}.rfops-order-items article strong{font-size:9px}.rfops-order-items article small{margin-top:2px;color:#858590;font-size:8px}.rfops-order-items article em{font-style:normal;font-size:8px}.rfops-order-items footer{display:flex;justify-content:space-between;margin-top:7px;padding-top:7px;border-top:1px dashed #dddde3;font-size:9px}.rfops-status-actions{padding:13px 0;border-bottom:1px solid #f0f0f3}.rfops-status-actions>span{color:#858590;font-size:9px}.rfops-status-actions>div{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.rfops-status-actions button{display:inline-flex;align-items:center;gap:4px;padding:6px 8px;border:1px solid #dedfe5;border-radius:7px;background:#fff;color:#676873;font-size:8px;font-weight:750;cursor:pointer}.rfops-status-actions button.active{border-color:#cbccef;background:#f0f0ff;color:#5052c9}.rfops-status-actions button:disabled{opacity:.55}.rfops-drawer-actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:16px}
      @media(max-width:1080px){.rfops-brain-card{grid-template-columns:1fr}.rfops-inline-link{justify-self:start}.rfops-journey{grid-template-columns:repeat(5,minmax(130px,1fr));overflow:auto}.rfops-journey-arrow{display:none}}
      @media(max-width:900px){.rfops-page{padding:16px}.rfops-header{display:grid}.rfops-header-actions{justify-content:flex-start}.rfops-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.rfops-journey{display:flex}.rfops-journey-node{min-width:160px}}
      @media(max-width:560px){.rfops-page{padding:12px}.rfops-header h1{font-size:25px;line-height:30px}.rfops-header-actions{display:grid;grid-template-columns:1fr 1fr}.rfops-header-actions .rfops-btn:last-child{grid-column:1/-1}.rfops-toolbar{display:grid}.rfops-toolbar select{min-height:36px;width:100%}.rfops-metrics{grid-template-columns:1fr 1fr;gap:7px}.rfops-metric{padding:11px}.rfops-metric strong{font-size:16px}.rfops-brain-facts{grid-template-columns:1fr}.rfops-detail{grid-template-columns:90px minmax(0,1fr)}}
      @media(prefers-reduced-motion:reduce){.rfops-page *{animation:none!important;transition:none!important}}
    `}</style>
  );
}
