import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Users,
  X,
} from "../components/icons";
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../lib/workspace-platform-client.js";

const STATUS_OPTIONS = ["all", "upcoming", "confirmed", "completed", "cancelled", "no_show"];

const NICHE_PROFILES = [
  {
    matches: ["restaurant", "cafe", "café", "bar", "diner", "food", "hospitality"],
    singular: "Reservation",
    plural: "Reservations",
    customer: "Guest",
    customers: "Guests",
    service: "Table / request",
    todayLabel: "Reservations today",
    upcomingLabel: "Upcoming reservations",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    matches: ["clinic", "medical", "doctor", "dentist", "dental", "health", "therapy", "chiropractic"],
    singular: "Appointment",
    plural: "Appointments",
    customer: "Patient",
    customers: "Patients",
    service: "Service / provider",
    todayLabel: "Appointments today",
    upcomingLabel: "Upcoming appointments",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    matches: ["salon", "spa", "beauty", "barber", "hair", "nail", "wellness"],
    singular: "Booking",
    plural: "Bookings",
    customer: "Client",
    customers: "Clients",
    service: "Treatment / stylist",
    todayLabel: "Bookings today",
    upcomingLabel: "Upcoming bookings",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    matches: ["real estate", "realtor", "property", "broker", "estate agent"],
    singular: "Viewing",
    plural: "Viewings",
    customer: "Prospect",
    customers: "Prospects",
    service: "Property / agent",
    todayLabel: "Viewings today",
    upcomingLabel: "Upcoming viewings",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    matches: ["auto", "automotive", "mechanic", "garage", "car repair", "dealership"],
    singular: "Service appointment",
    plural: "Service appointments",
    customer: "Customer",
    customers: "Customers",
    service: "Vehicle / service",
    todayLabel: "Appointments today",
    upcomingLabel: "Upcoming appointments",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    matches: ["home service", "plumber", "plumbing", "hvac", "electrician", "roofing", "cleaning", "contractor", "landscaping"],
    singular: "Service visit",
    plural: "Service visits",
    customer: "Customer",
    customers: "Customers",
    service: "Service / technician",
    todayLabel: "Visits today",
    upcomingLabel: "Upcoming visits",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled / no-show",
  },
  {
    matches: ["hotel", "lodging", "accommodation"],
    singular: "Guest reservation",
    plural: "Guest reservations",
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
  singular: "Booking",
  plural: "Operations",
  customer: "Customer",
  customers: "Customers",
  service: "Service / owner",
  todayLabel: "Today",
  upcomingLabel: "Upcoming",
  completedLabel: "Completed",
  cancelledLabel: "Cancelled / no-show",
};

export default function NicheOperations() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedDirection = normalizeDirection(searchParams.get("direction"));
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      let operations = null;

      try {
        const directionQuery = requestedDirection
          ? `&direction=${encodeURIComponent(requestedDirection)}`
          : "";
        operations = await apiRequest(`/operations?limit=500${directionQuery}`, {
          timeoutMs: 20_000,
        });
      } catch (operationsError) {
        if (![403, 404, 405].includes(Number(operationsError?.status))) {
          throw operationsError;
        }
      }

      if (!operations) {
        const voiceDashboard = await apiRequest("/telnyx/ai-agent/dashboard", {
          timeoutMs: 30_000,
        });

        operations = {
          source: "voice-dashboard-fallback",
          workspace: voiceDashboard?.workspace || {},
          agent: voiceDashboard?.agent || null,
          records:
            voiceDashboard?.meetings ||
            voiceDashboard?.bookings ||
            [],
        };
      }

      setPayload(operations || {});
      setError("");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your operations workspace could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestedDirection]);

  useEffect(() => {
    void load();
  }, [load]);

  const niche = useMemo(
    () =>
      resolveNiche([
        payload?.workspace?.niche,
        payload?.workspace?.industry,
        payload?.workspace?.businessType,
        payload?.niche,
        payload?.industry,
        payload?.agent?.industry,
        payload?.agent?.idealCustomer,
        user?.industry,
        user?.niche,
        user?.businessType,
        user?.companyIndustry,
        user?.companyName,
      ]),
    [payload, user]
  );

  const profile = useMemo(() => getNicheProfile(niche), [niche]);
  const records = useMemo(() => {
    const all = normalizeRecords(payload);
    if (!requestedDirection) return all;
    return all.filter((record) =>
      normalizeDirection(record.direction) === requestedDirection
    );
  }, [payload, requestedDirection]);

  const visibleRecords = useMemo(() => {
    const q = query.trim().toLowerCase();

    return records
      .filter((record) => status === "all" || normalizeStatus(record.status) === status)
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
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => getTimestamp(a.startAt) - getTimestamp(b.startAt));
  }, [query, records, status]);

  const metrics = useMemo(() => buildMetrics(records), [records]);
  const selected = records.find((record) => record.id === selectedId) || null;

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
              AI-created {profile.plural.toLowerCase()}, inbound requests, and
              scheduled customer outcomes stay visible in one operational view.
            </p>
          </div>

          <div className="rfops-header-actions">
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

        {error ? (
          <section className="rfops-message error" role="alert">
            <X size={17} />
            <div>
              <strong>Operations data needs attention</strong>
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => void load()}>
              Retry
            </button>
          </section>
        ) : null}

        <section className="rfops-metrics" aria-label={`${profile.plural} summary`}>
          <Metric icon={<Calendar size={17} />} label={profile.todayLabel} value={metrics.today} />
          <Metric icon={<Clock3 size={17} />} label={profile.upcomingLabel} value={metrics.upcoming} />
          <Metric icon={<CheckCircle2 size={17} />} label={profile.completedLabel} value={metrics.completed} />
          <Metric icon={<Users size={17} />} label={profile.cancelledLabel} value={metrics.cancelled} />
        </section>

        <section className="rfops-card">
          <div className="rfops-card-head">
            <div>
              <span className="rfops-eyebrow">Live operational queue</span>
              <h2>{profile.plural}</h2>
            </div>
            <strong>{visibleRecords.length.toLocaleString()} records</strong>
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
                    <th>Date & time</th>
                    <th>{profile.service}</th>
                    <th>Contact</th>
                    <th>Source</th>
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
                            <small>{record.partySize ? `Party of ${record.partySize}` : record.company || record.location || ""}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{formatDate(record.startAt)}</strong>
                        <small>{formatTime(record.startAt)}</small>
                      </td>
                      <td>
                        <strong>{record.service || profile.singular}</strong>
                        <small>{record.notes || record.provider || ""}</small>
                      </td>
                      <td>
                        <ContactValue icon={<Phone size={13} />} value={record.phone} />
                        <ContactValue icon={<Mail size={13} />} value={record.email} />
                      </td>
                      <td>
                        <strong>{record.source || "ReachFly AI"}</strong>
                        <small>{record.channel || "Connected workspace"}</small>
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
              <Calendar size={25} />
              <h3>No {profile.plural.toLowerCase()} match this view</h3>
              <p>
                AI-created customer bookings will appear here when your connected
                voice, email, or campaign workflows create them.
              </p>
            </div>
          )}
        </section>

        {selected ? (
          <div className="rfops-drawer-backdrop" onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSelectedId("");
          }}>
            <aside className="rfops-drawer" aria-label={`${profile.singular} details`}>
              <div className="rfops-drawer-head">
                <div>
                  <span className="rfops-eyebrow">{profile.singular}</span>
                  <h2>{selected.customerName || profile.customer}</h2>
                </div>
                <button type="button" onClick={() => setSelectedId("")} aria-label="Close details">
                  <X size={17} />
                </button>
              </div>

              <Detail label="Date" value={formatDate(selected.startAt)} />
              <Detail label="Time" value={formatTime(selected.startAt)} />
              <Detail label={profile.service} value={selected.service || selected.provider || "Not specified"} />
              <Detail label="Phone" value={selected.phone || "Not provided"} />
              <Detail label="Email" value={selected.email || "Not provided"} />
              <Detail label="Location" value={selected.location || "Not specified"} icon={<MapPin size={14} />} />
              <Detail label="Source" value={[selected.source, selected.channel].filter(Boolean).join(" · ") || "ReachFly AI"} />
              <Detail label="Status" value={formatStatus(selected.status)} />
              <Detail label="Notes / context" value={selected.notes || "No additional notes recorded."} multiline />

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

function ContactValue({ icon, value }) {
  if (!value) return null;
  return <small className="rfops-contact">{icon}{value}</small>;
}

function Detail({ label, value, icon = null, multiline = false }) {
  return (
    <div className={`rfops-detail ${multiline ? "multiline" : ""}`}>
      <span>{label}</span>
      <strong>{icon}{value}</strong>
    </div>
  );
}

function OperationsSkeleton() {
  return (
    <div className="rfops-skeleton">
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
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
    .map((item, index) => ({
      id: String(item?.id || item?.bookingId || item?.meetingId || `operation-${index}`),
      customerName:
        item?.customerName ||
        item?.guestName ||
        item?.patientName ||
        item?.clientName ||
        item?.leadName ||
        item?.contactName ||
        item?.name ||
        "",
      company: item?.company || item?.business || item?.companyName || "",
      phone: item?.phone || item?.customerPhone || item?.leadPhone || "",
      email: item?.email || item?.customerEmail || item?.leadEmail || "",
      startAt:
        item?.startAt ||
        item?.scheduledAt ||
        item?.meetingAt ||
        item?.reservationAt ||
        item?.appointmentAt ||
        item?.dateTime ||
        item?.date ||
        "",
      service:
        item?.service ||
        item?.serviceName ||
        item?.reservationType ||
        item?.appointmentType ||
        item?.property ||
        item?.room ||
        item?.title ||
        "",
      provider: item?.provider || item?.agentName || item?.staffName || item?.assigneeName || "",
      location: item?.location || item?.address || item?.venue || "",
      partySize: Number(item?.partySize || item?.guests || item?.covers || 0) || 0,
      notes: item?.notes || item?.specialRequests || item?.context || item?.summary || "",
      source: item?.source || item?.sourceName || "ReachFly AI",
      channel: item?.channel || item?.sourceChannel || item?.createdByChannel || "",
      status: normalizeStatus(item?.status || item?.bookingStatus || "upcoming"),
    }))
    .filter((item) => item.startAt || item.customerName || item.phone || item.email);
}

function buildMetrics(records) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endToday = startToday + 86_400_000;

  return records.reduce(
    (acc, record) => {
      const time = getTimestamp(record.startAt);
      const status = normalizeStatus(record.status);

      if (time >= startToday && time < endToday && !["cancelled", "no_show"].includes(status)) {
        acc.today += 1;
      }
      if (time >= now.getTime() && !["cancelled", "no_show", "completed"].includes(status)) {
        acc.upcoming += 1;
      }
      if (status === "completed") acc.completed += 1;
      if (["cancelled", "no_show"].includes(status)) acc.cancelled += 1;
      return acc;
    },
    { today: 0, upcoming: 0, completed: 0, cancelled: 0 }
  );
}

function resolveNiche(values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function getNicheProfile(niche) {
  const value = String(niche || "").toLowerCase();
  return NICHE_PROFILES.find((profile) => profile.matches.some((term) => value.includes(term))) || DEFAULT_PROFILE;
}


function normalizeDirection(value) {
  const direction = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  return ["inbound", "outbound"].includes(direction) ? direction : "";
}

function normalizeStatus(value) {
  const status = String(value || "upcoming")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["booked", "scheduled", "pending"].includes(status)) return "upcoming";
  if (["confirmed", "accepted"].includes(status)) return "confirmed";
  if (["complete", "done", "finished", "attended"].includes(status)) return "completed";
  if (["canceled", "cancelled"].includes(status)) return "cancelled";
  if (["noshow", "no_show", "missed"].includes(status)) return "no_show";
  return status || "upcoming";
}

function formatStatus(value) {
  return normalizeStatus(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTimestamp(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function formatDate(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return "Date pending";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(time));
}

function formatTime(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return "Time pending";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(time));
}

function initials(value) {
  const parts = String(value || "RF").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "RF";
}

function OperationsStyles() {
  return (
    <style>{`
      .rfops-page{width:min(1480px,100%);margin:0 auto;padding:24px;color:#191c1d;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .rfops-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:18px}.rfops-header>div:first-child{max-width:760px}.rfops-eyebrow{display:inline-flex;align-items:center;gap:7px;color:#5658d6;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.rfops-header h1{margin:7px 0 5px;font-size:30px;line-height:36px;letter-spacing:-.035em}.rfops-header p{margin:0;color:#686873;font-size:12px;line-height:19px}.rfops-header-actions{display:flex;gap:8px;flex-wrap:wrap}
      .rfops-btn{min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 13px;border-radius:9px;border:1px solid #dedfe5;font-size:10px;font-weight:750;text-decoration:none;cursor:pointer}.rfops-btn.primary{color:#fff;background:#5658d6;border-color:#5658d6}.rfops-btn.secondary{color:#292b33;background:#fff}.rfops-btn:disabled{opacity:.55;cursor:not-allowed}.rfops-btn .spin{animation:rfopsSpin 900ms linear infinite}@keyframes rfopsSpin{to{transform:rotate(360deg)}}
      .rfops-message{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:12px 14px;border-radius:10px}.rfops-message.error{color:#852d2d;background:#fff6f6;border:1px solid #f0d5d5}.rfops-message>div{display:grid;gap:2px;flex:1}.rfops-message strong{font-size:11px}.rfops-message span{font-size:10px}.rfops-message button{border:0;background:transparent;color:inherit;font-size:10px;font-weight:800;cursor:pointer}
      .rfops-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.rfops-metric{display:flex;align-items:center;gap:11px;padding:15px;background:#fff;border:1px solid #e4e5e8;border-radius:12px;box-shadow:0 5px 18px rgba(29,32,38,.04)}.rfops-metric>span{width:34px;height:34px;display:grid;place-items:center;color:#5658d6;background:#f0f0ff;border-radius:9px}.rfops-metric div{display:grid;gap:1px}.rfops-metric strong{font-size:19px;line-height:22px}.rfops-metric small{color:#777783;font-size:9px}
      .rfops-card{background:#fff;border:1px solid #e2e3e8;border-radius:14px;box-shadow:0 8px 26px rgba(28,30,38,.05);overflow:hidden}.rfops-card-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:17px 18px 13px;border-bottom:1px solid #ececf0}.rfops-card-head h2{margin:3px 0 0;font-size:17px}.rfops-card-head>strong{color:#777783;font-size:10px}.rfops-toolbar{display:flex;gap:9px;padding:10px 12px;background:#fafafd;border-bottom:1px solid #ececf0}.rfops-search{min-height:36px;display:flex;align-items:center;gap:7px;flex:1;padding:0 10px;background:#fff;border:1px solid #dedfe5;border-radius:8px;color:#858590}.rfops-search input{width:100%;border:0;outline:0;background:transparent;font-size:10px}.rfops-search button{display:grid;place-items:center;border:0;background:transparent;color:#858590;cursor:pointer}.rfops-toolbar select{min-width:150px;padding:0 9px;background:#fff;border:1px solid #dedfe5;border-radius:8px;font-size:10px}
      .rfops-table-wrap{overflow:auto}.rfops-table{width:100%;border-collapse:collapse;min-width:950px}.rfops-table th{padding:10px 12px;color:#777783;background:#fbfbfd;border-bottom:1px solid #ececf0;text-align:left;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.rfops-table td{padding:11px 12px;border-bottom:1px solid #f0f0f3;vertical-align:middle}.rfops-table tr:last-child td{border-bottom:0}.rfops-table td>strong,.rfops-customer strong{display:block;color:#272930;font-size:10px}.rfops-table td>small,.rfops-customer small{display:block;margin-top:2px;color:#858590;font-size:9px;line-height:13px}.rfops-customer{display:flex;align-items:center;gap:9px}.rfops-customer>span{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;color:#5658d6;background:#eeeeff;border-radius:8px;font-size:9px;font-weight:800}.rfops-contact{display:flex!important;align-items:center;gap:4px;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rfops-status{display:inline-flex;padding:4px 7px;border-radius:999px;background:#f0f0f4;color:#62626e;font-size:8px;font-weight:800;text-transform:capitalize}.rfops-status.confirmed,.rfops-status.completed{background:#ecf8f0;color:#237341}.rfops-status.upcoming{background:#efefff;color:#4d4fc4}.rfops-status.cancelled,.rfops-status.no_show{background:#fff0f0;color:#9d3939}.rfops-open{width:30px;height:30px;display:grid;place-items:center;border:1px solid #e0e1e6;border-radius:8px;background:#fff;color:#5658d6;cursor:pointer}
      .rfops-empty{min-height:280px;display:grid;place-items:center;align-content:center;gap:7px;padding:30px;text-align:center;color:#858590}.rfops-empty h3{margin:3px 0 0;color:#292b33;font-size:15px}.rfops-empty p{max-width:520px;margin:0;font-size:10px;line-height:16px}.rfops-skeleton{display:grid;gap:8px;padding:14px}.rfops-skeleton span{height:48px;border-radius:8px;background:linear-gradient(90deg,#f1f1f4,#f8f8fa,#f1f1f4);background-size:200% 100%;animation:rfopsShimmer 1.2s linear infinite}@keyframes rfopsShimmer{to{background-position:-200% 0}}
      .rfops-drawer-backdrop{position:fixed;inset:0;z-index:80;display:flex;justify-content:flex-end;background:rgba(20,22,28,.24);backdrop-filter:blur(2px)}.rfops-drawer{width:min(440px,94vw);height:100%;overflow:auto;padding:20px;background:#fff;box-shadow:-18px 0 50px rgba(25,27,35,.16)}.rfops-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:14px;border-bottom:1px solid #e9e9ed}.rfops-drawer-head h2{margin:4px 0 0;font-size:20px}.rfops-drawer-head button{width:32px;height:32px;display:grid;place-items:center;border:1px solid #e2e3e8;background:#fff;border-radius:8px;cursor:pointer}.rfops-detail{display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f3}.rfops-detail>span{color:#858590;font-size:9px}.rfops-detail>strong{display:flex;align-items:flex-start;gap:5px;font-size:10px;line-height:16px}.rfops-detail.multiline{grid-template-columns:1fr}.rfops-detail.multiline strong{font-weight:500;color:#555661}.rfops-drawer-actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:16px}
      @media(max-width:900px){.rfops-page{padding:16px}.rfops-header{display:grid}.rfops-header-actions{justify-content:flex-start}.rfops-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){.rfops-page{padding:12px}.rfops-header h1{font-size:25px;line-height:30px}.rfops-header-actions{display:grid;grid-template-columns:1fr 1fr}.rfops-toolbar{display:grid}.rfops-toolbar select{min-height:36px;width:100%}.rfops-metrics{grid-template-columns:1fr 1fr;gap:7px}.rfops-metric{padding:11px}.rfops-metric strong{font-size:16px}.rfops-detail{grid-template-columns:90px minmax(0,1fr)}}
      @media(prefers-reduced-motion:reduce){.rfops-page *{animation:none!important;transition:none!important}}
    `}</style>
  );
}
