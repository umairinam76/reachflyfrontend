import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wand2,
  X,
  Zap,
} from "lucide-react";

import { api, request } from "../api";
import { useAuth } from "../auth/AuthContext";

const AUDIT_SELECTION_STORAGE_KEY = "reachfly:selected-audit-leads";

const DEFAULT_PROFILE = Object.freeze({
  businessNiche: "",
  idealCustomer: "",
  offer: "",
  targetMarket: "",
  pitchGoal: "Start a relevant sales conversation and qualify genuine need.",
  painPoints: "",
  miniAuditDirection:
    "Prioritize verified customer-acquisition, conversion, booking, trust, local visibility and follow-up gaps that connect naturally to our offer. Keep the mini audit caller-ready and evidence-grounded.",
  customInstructions: "",
  criteria: {
    nicheFit: true,
    offerRelevance: true,
    websiteConversion: true,
    bookingFriction: true,
    localVisibility: true,
    reviewsTrust: true,
    performance: true,
    followUpOpportunity: true,
    competitorGaps: true,
  },
});

const CRITERIA = [
  ["nicheFit", "ICP / niche fit", "How closely this prospect matches your own target customer profile."],
  ["offerRelevance", "Offer relevance", "Where your configured offer is relevant to a verified business gap."],
  ["websiteConversion", "Website conversion", "Contact, CTA, booking and conversion friction visible on public pages."],
  ["bookingFriction", "Booking friction", "Whether a customer can complete the next step quickly."],
  ["localVisibility", "Local visibility", "Local SEO, category and search-discovery opportunities."],
  ["reviewsTrust", "Reviews & trust", "Public trust and proof signals that influence conversion."],
  ["performance", "Performance signals", "Publicly observable technical and page-experience weaknesses."],
  ["followUpOpportunity", "Follow-up opportunity", "Where a relevant follow-up can help without inventing buyer intent."],
  ["competitorGaps", "Competitive gaps", "Verified differences that can support a stronger sales conversation."],
];

export default function WebsiteAudits() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState([]);
  const [reports, setReports] = useState([]);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [workspaceSettings, setWorkspaceSettings] = useState({});
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [activeLeadId, setActiveLeadId] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profileOpen, setProfileOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deepAuditBusy, setDeepAuditBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const pollRef = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const [leadPayload, reportPayload, settingsPayload] = await Promise.all([
        request("/api/leads/scraped?limit=5000"),
        request("/api/lead-audits"),
        api.appSettings().catch(() => ({})),
      ]);

      const nextLeads = normalizeLeads(leadPayload);
      const nextReports = normalizeReports(reportPayload);
      const nextSettings = settingsPayload || {};

      setLeads(nextLeads);
      setReports(nextReports);
      setWorkspaceSettings(nextSettings);
      setProfile(buildInitialProfile(nextSettings?.auditProfile, user));

      restoreSelection({
        leads: nextLeads,
        searchParams,
        setSelectedIds,
        setActiveLeadId,
      });

      setError("");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "ReachFly could not load leads and audit intelligence."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [searchParams, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pending = reports.some((item) =>
      ["queued", "generating"].includes(normalizeStatus(item.status))
    );

    if (!pending) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      return undefined;
    }

    if (!pollRef.current) {
      pollRef.current = window.setInterval(async () => {
        try {
          const payload = await request("/api/lead-audits");
          setReports(normalizeReports(payload));
        } catch {
          // Existing audit data stays visible while a background refresh fails.
        }
      }, 2200);
    }

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [reports]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const reportsByWebsite = useMemo(() => {
    const map = new Map();

    for (const report of reports) {
      const key = normalizeWebsite(report.website || report.lead?.website);
      if (!key) continue;

      const current = map.get(key) || [];
      current.push(report);
      map.set(key, current);
    }

    for (const [key, items] of map) {
      items.sort(
        (a, b) =>
          Date.parse(b.updatedAt || b.completedAt || 0) -
          Date.parse(a.updatedAt || a.completedAt || 0)
      );
      map.set(key, items);
    }

    return map;
  }, [reports]);

  const enrichedLeads = useMemo(
    () =>
      leads.map((lead, index) => {
        const websiteKey = normalizeWebsite(lead.website);
        const leadReports = reportsByWebsite.get(websiteKey) || [];
        const mini =
          leadReports.find((item) => item.kind === "mini") || null;
        const full =
          leadReports.find((item) => item.kind === "full") || null;
        const current = mini || full || leadReports[0] || null;
        const status = current
          ? normalizeStatus(current.status)
          : lead.website
            ? "not_run"
            : "no_website";

        return {
          lead,
          id: leadIdentity(lead) || `lead-${index}`,
          report: current,
          mini,
          full,
          status,
          fitScore: getFitScore(current),
        };
      }),
    [leads, reportsByWebsite]
  );

  const visibleLeads = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();

    return enrichedLeads.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;

      if (!query) return true;

      return [
        item.lead.business,
        item.lead.name,
        item.lead.website,
        item.lead.email,
        item.lead.phone,
        item.lead.address,
        item.lead.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [enrichedLeads, leadSearch, statusFilter]);

  const activeLead =
    enrichedLeads.find((item) => item.id === activeLeadId) ||
    enrichedLeads.find((item) => selectedIds.has(item.id)) ||
    enrichedLeads[0] ||
    null;

  const selectedLeadItems = enrichedLeads.filter((item) =>
    selectedIds.has(item.id)
  );

  const selectedAuditable = selectedLeadItems.filter(
    (item) => item.lead?.website
  );

  const stats = useMemo(() => {
    const completed = enrichedLeads.filter(
      (item) => item.status === "complete"
    );
    const pending = enrichedLeads.filter((item) =>
      ["queued", "generating"].includes(item.status)
    );

    const scored = completed
      .map((item) => item.fitScore)
      .filter((value) => Number.isFinite(value));

    return {
      total: enrichedLeads.length,
      completed: completed.length,
      pending: pending.length,
      highFit: completed.filter((item) => (item.fitScore || 0) >= 70).length,
      averageFit: scored.length
        ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length)
        : null,
    };
  }, [enrichedLeads]);

  const liveMiniAudits = useMemo(() => {
    const pending = enrichedLeads
      .filter((item) => item.mini && ["queued", "generating"].includes(normalizeStatus(item.mini.status)))
      .sort(
        (a, b) =>
          Date.parse(b.mini?.updatedAt || b.mini?.createdAt || 0) -
          Date.parse(a.mini?.updatedAt || a.mini?.createdAt || 0)
      );

    const recentCompleted = enrichedLeads
      .filter((item) => item.mini && normalizeStatus(item.mini.status) === "complete")
      .sort(
        (a, b) =>
          Date.parse(b.mini?.completedAt || b.mini?.updatedAt || 0) -
          Date.parse(a.mini?.completedAt || a.mini?.updatedAt || 0)
      );

    return [...pending, ...recentCompleted]
      .filter(
        (item, index, list) =>
          list.findIndex((candidate) => candidate.id === item.id) === index
      )
      .slice(0, 8);
  }, [enrichedLeads]);

  function persistSelection(nextSet) {
    const selected = enrichedLeads
      .filter((item) => nextSet.has(item.id))
      .map((item) => item.lead);

    try {
      sessionStorage.setItem(
        AUDIT_SELECTION_STORAGE_KEY,
        JSON.stringify({
          leads: selected,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Session storage can be disabled.
    }
  }

  function toggleLead(item) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);

      persistSelection(next);

      if (!activeLeadId || !next.has(activeLeadId)) {
        setActiveLeadId(item.id);
      }

      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      const everySelected =
        visibleLeads.length &&
        visibleLeads.every((item) => next.has(item.id));

      for (const item of visibleLeads) {
        if (everySelected) next.delete(item.id);
        else next.add(item.id);
      }

      persistSelection(next);
      return next;
    });
  }

  function updateProfile(key, value) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleCriterion(key) {
    setProfile((current) => ({
      ...current,
      criteria: {
        ...(current.criteria || {}),
        [key]: !current.criteria?.[key],
      },
    }));
  }

  async function saveProfile() {
    if (savingProfile) return;

    setSavingProfile(true);

    try {
      const safeProfile = sanitizeProfile(profile);
      const next = await api.saveAppSettings({
        ...workspaceSettings,
        auditProfile: safeProfile,
      });

      setWorkspaceSettings(next || {});
      setProfile(buildInitialProfile(next?.auditProfile || safeProfile, user));
      setNotice({
        type: "success",
        title: "Audit profile saved",
        message:
          "New audits will use this niche, offer and pitch context. Existing reports are unchanged until regenerated.",
      });
    } catch (requestError) {
      setNotice({
        type: "error",
        title: "Could not save audit profile",
        message:
          requestError?.message ||
          "Your audit profile could not be saved to this workspace.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function runSelectedAudits(overrideItems = null) {
    if (running) return;

    const targetItems = Array.isArray(overrideItems)
      ? overrideItems.filter(Boolean)
      : selectedLeadItems;
    const targetAuditable = targetItems.filter((item) => item.lead?.website);

    if (!targetItems.length) {
      setNotice({
        type: "warning",
        title: "Select leads first",
        message: "Choose one or more leads from the list before running Claude audits.",
      });
      return;
    }

    if (!targetAuditable.length) {
      setNotice({
        type: "warning",
        title: "No websites available",
        message:
          "The selected leads do not contain a public website that ReachFly can audit.",
      });
      return;
    }

    setRunning(true);

    try {
      const payload = {
        leads: targetAuditable.map((item) => item.lead),
        auditProfile: sanitizeProfile(profile),
        niche: profile.businessNiche,
        location: profile.targetMarket,
      };

      const response = await request("/api/lead-audits/mini/batch", {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 60_000,
      });

      const accepted = Number(
        response?.accepted ??
          response?.reports?.length ??
          targetAuditable.length
      );

      setReports((current) =>
        mergeReports(current, normalizeReports(response))
      );

      setNotice({
        type: "success",
        title: "Claude audits started",
        message: `${accepted.toLocaleString()} lead${
          accepted === 1 ? "" : "s"
        } queued. Audit fit and pitch context will update here automatically.`,
      });
    } catch (requestError) {
      setNotice({
        type: "error",
        title: "Audit launch failed",
        message:
          requestError?.message ||
          "ReachFly could not start the selected Claude audits.",
      });
    } finally {
      setRunning(false);
    }
  }

  async function runDeepAudit(item) {
    if (!item?.lead?.website || deepAuditBusy) return;

    setDeepAuditBusy(item.id);

    try {
      const response = await request("/api/lead-audits/generate", {
        method: "POST",
        body: JSON.stringify({
          kind: "full",
          website: item.lead.website,
          lead: item.lead,
          auditProfile: sanitizeProfile(profile),
          niche: profile.businessNiche || item.lead.category,
          location: profile.targetMarket || item.lead.address,
        }),
        timeoutMs: 60_000,
      });

      setReports((current) =>
        mergeReports(current, normalizeReports(response))
      );

      setNotice({
        type: "success",
        title: "Deep audit queued",
        message: `${leadName(item.lead)} is being expanded into a full evidence-grounded report.`,
      });
    } catch (requestError) {
      setNotice({
        type: "error",
        title: "Deep audit failed",
        message:
          requestError?.message ||
          "The full audit could not be started.",
      });
    } finally {
      setDeepAuditBusy("");
    }
  }

  function openLead(item) {
    setActiveLeadId(item.id);

    const next = new URLSearchParams(searchParams);
    const leadId = item.lead?.sourceLeadId || item.lead?.id || item.id;
    next.set("lead", leadId);
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <style>{AUDIT_WORKSPACE_CSS}</style>

      <main className="rf-audit-intel">
        <header className="rf-audit-intel__hero">
          <div>
            <span className="rf-audit-kicker">
              <Brain size={14} />
              Claude lead intelligence
            </span>
            <h1>Audit leads for fit, relevance and a better sales conversation.</h1>
            <p>
              ReachFly compares each prospect against your business niche, ideal
              customer and offer, then turns verified public evidence into private
              pitch context for AI Voice and your sales team.
            </p>
          </div>

          <div className="rf-audit-hero-actions">
            <button
              type="button"
              className="rf-audit-btn secondary"
              onClick={() => void load({ silent: true })}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              className="rf-audit-btn primary"
              disabled={running || !selectedAuditable.length}
              onClick={() => void runSelectedAudits()}
            >
              {running ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              {running
                ? "Starting audits…"
                : `Run audits${selectedAuditable.length ? ` (${selectedAuditable.length})` : ""}`}
            </button>
          </div>
        </header>

        {notice ? (
          <div className={`rf-audit-notice ${notice.type || "info"}`}>
            <span>
              {notice.type === "success" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            </span>
            <div>
              <b>{notice.title}</b>
              <p>{notice.message}</p>
            </div>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="rf-audit-notice error">
            <span><AlertTriangle size={17} /></span>
            <div>
              <b>Audit workspace unavailable</b>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        <section className="rf-audit-stat-grid">
          <AuditStat label="Saved leads" value={stats.total} detail="Workspace lead archive" />
          <AuditStat label="Audit ready" value={stats.completed} detail="Claude reports completed" />
          <AuditStat label="High fit" value={stats.highFit} detail="Commercial alignment ≥ 70" />
          <AuditStat
            label="Average fit"
            value={stats.averageFit == null ? "—" : `${stats.averageFit}/100`}
            detail={`${stats.pending} currently processing`}
          />
        </section>

        <LiveMiniAuditStream
          items={liveMiniAudits}
          onOpen={openLead}
          running={running}
        />

        <section className="rf-audit-profile-card">
          <button
            type="button"
            className="rf-audit-profile-head"
            onClick={() => setProfileOpen((current) => !current)}
          >
            <span className="rf-audit-profile-icon"><Target size={18} /></span>
            <span>
              <b>Your audit definition</b>
              <small>
                These fields tell Claude what your business sells and what “fit” means for this workspace.
              </small>
            </span>
            <ChevronDown size={18} className={profileOpen ? "rotated" : ""} />
          </button>

          {profileOpen ? (
            <div className="rf-audit-profile-body">
              <div className="rf-audit-profile-fields">
                <AuditField
                  label="Your business niche"
                  value={profile.businessNiche}
                  onChange={(value) => updateProfile("businessNiche", value)}
                  placeholder="AI sales automation, dental marketing, roofing..."
                />
                <AuditField
                  label="Ideal customer"
                  value={profile.idealCustomer}
                  onChange={(value) => updateProfile("idealCustomer", value)}
                  placeholder="Multi-location clinics with high inbound lead volume"
                />
                <AuditField
                  label="Your offer"
                  value={profile.offer}
                  onChange={(value) => updateProfile("offer", value)}
                  placeholder="AI voice + email follow-up that books appointments"
                />
                <AuditField
                  label="Target market"
                  value={profile.targetMarket}
                  onChange={(value) => updateProfile("targetMarket", value)}
                  placeholder="United States, Miami, UK dental clinics..."
                />
                <AuditField
                  label="Pain points your offer solves"
                  value={profile.painPoints}
                  onChange={(value) => updateProfile("painPoints", value)}
                  placeholder="Missed calls, slow lead follow-up, weak booking flow, poor conversion..."
                  textarea
                  full
                />
                <AuditField
                  label="Mini audit direction"
                  value={profile.miniAuditDirection}
                  onChange={(value) => updateProfile("miniAuditDirection", value)}
                  placeholder="Tell Claude what to prioritize in the one-page pre-call mini audit."
                  textarea
                  full
                />
                <AuditField
                  label="Pitch goal"
                  value={profile.pitchGoal}
                  onChange={(value) => updateProfile("pitchGoal", value)}
                  placeholder="Qualify need and book a 20-minute discovery call"
                  full
                />
                <AuditField
                  label="Private instructions for Claude"
                  value={profile.customInstructions}
                  onChange={(value) => updateProfile("customInstructions", value)}
                  placeholder="Prioritize missed-call handling and online booking friction. Avoid generic SEO pitches."
                  textarea
                  full
                />
              </div>

              <div className="rf-audit-criteria">
                <div>
                  <b>Predefined audit fields</b>
                  <small>Select what Claude should evaluate for every lead.</small>
                </div>

                <div className="rf-audit-criteria-grid">
                  {CRITERIA.map(([key, label, description]) => (
                    <button
                      type="button"
                      key={key}
                      className={profile.criteria?.[key] ? "selected" : ""}
                      onClick={() => toggleCriterion(key)}
                    >
                      <span>{profile.criteria?.[key] ? <Check size={14} /> : null}</span>
                      <div>
                        <b>{label}</b>
                        <small>{description}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rf-audit-profile-footer">
                <div>
                  <ShieldCheck size={16} />
                  <span>
                    Mini Audits use the same evidence-first mindset as the Website Audit:
                    verified public findings first, then <b>commercial alignment</b> against your niche,
                    pain points and offer. Claude must not invent prospect interest.
                  </span>
                </div>

                <button
                  type="button"
                  className="rf-audit-btn secondary"
                  disabled={savingProfile}
                  onClick={() => void saveProfile()}
                >
                  {savingProfile ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                  Save audit profile
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {loading ? (
          <AuditWorkspaceSkeleton />
        ) : (
          <section className="rf-audit-workspace">
            <aside className="rf-audit-leads">
              <div className="rf-audit-panel-head">
                <div>
                  <span>01</span>
                  <div>
                    <b>Select leads</b>
                    <small>{selectedIds.size} selected</small>
                  </div>
                </div>
                <button type="button" onClick={selectAllVisible}>
                  {visibleLeads.length &&
                  visibleLeads.every((item) => selectedIds.has(item.id))
                    ? "Clear visible"
                    : "Select visible"}
                </button>
              </div>

              <label className="rf-audit-search">
                <Search size={15} />
                <input
                  value={leadSearch}
                  onChange={(event) => setLeadSearch(event.target.value)}
                  placeholder="Search leads..."
                />
              </label>

              <div className="rf-audit-status-tabs">
                {[
                  ["all", "All"],
                  ["complete", "Ready"],
                  ["queued", "Queued"],
                  ["generating", "Running"],
                  ["not_run", "Not run"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={statusFilter === value ? "active" : ""}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="rf-audit-lead-list">
                {visibleLeads.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`rf-audit-lead-row ${
                      activeLead?.id === item.id ? "active" : ""
                    }`}
                    onClick={() => openLead(item)}
                  >
                    <span
                      className={`rf-audit-check ${
                        selectedIds.has(item.id) ? "selected" : ""
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleLead(item);
                      }}
                      role="checkbox"
                      aria-checked={selectedIds.has(item.id)}
                      tabIndex={0}
                    >
                      {selectedIds.has(item.id) ? <Check size={13} /> : null}
                    </span>

                    <span className="rf-audit-lead-copy">
                      <b>{leadName(item.lead)}</b>
                      <small>
                        {item.lead.category || safeHostname(item.lead.website) || "Lead"}
                      </small>
                    </span>

                    <AuditStatus status={item.status} score={item.fitScore} />
                  </button>
                ))}

                {!visibleLeads.length ? (
                  <div className="rf-audit-empty-small">
                    <Users size={20} />
                    <b>No leads match this view</b>
                    <small>Adjust the search or return to All Leads to add prospects.</small>
                  </div>
                ) : null}
              </div>
            </aside>

            <section className="rf-audit-detail">
              <div className="rf-audit-panel-head">
                <div>
                  <span>02</span>
                  <div>
                    <b>Lead audit</b>
                    <small>Verified evidence + sales alignment</small>
                  </div>
                </div>

                {activeLead?.lead?.website ? (
                  <a
                    href={ensureUrl(activeLead.lead.website)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website <ExternalLink size={13} />
                  </a>
                ) : null}
              </div>

              {activeLead ? (
                <LeadAuditDetail
                  item={activeLead}
                  profile={profile}
                  detailOpen={detailOpen}
                  onToggleDetail={() => setDetailOpen((current) => !current)}
                  onRun={() => {
                    if (!selectedIds.has(activeLead.id)) {
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        next.add(activeLead.id);
                        persistSelection(next);
                        return next;
                      });
                    }
                    void runSelectedAudits([activeLead]);
                  }}
                  onDeep={() => void runDeepAudit(activeLead)}
                  deepBusy={deepAuditBusy === activeLead.id}
                />
              ) : (
                <div className="rf-audit-empty">
                  <Brain size={28} />
                  <h2>Select a lead to review its pitch audit.</h2>
                  <p>
                    ReachFly keeps the audit attached to the prospect so AI Voice can
                    use the same verified context during outbound conversations.
                  </p>
                </div>
              )}
            </section>
          </section>
        )}
      </main>
    </>
  );
}

function LiveMiniAuditStream({ items, onOpen, running }) {
  const activeCount = items.filter((item) =>
    ["queued", "generating"].includes(normalizeStatus(item.mini?.status))
  ).length;

  return (
    <section className="rf-audit-live-stream">
      <div className="rf-audit-live-stream-head">
        <div>
          <span className={`rf-audit-live-signal ${activeCount ? "active" : ""}`}>
            <i />
            {activeCount ? `${activeCount} live` : "Live mini audits"}
          </span>
          <div>
            <b>Real-time Mini Audit stream</b>
            <small>
              Queued, generating and newly completed lead audits update automatically.
            </small>
          </div>
        </div>
        {running ? <span className="rf-audit-live-working"><Loader2 size={13} className="spin" /> Starting batch</span> : null}
      </div>

      <div className="rf-audit-live-strip">
        {items.length ? (
          items.map((item) => {
            const status = normalizeStatus(item.mini?.status);
            const score = getFitScore(item.mini);
            return (
              <button
                key={item.id}
                type="button"
                className={`rf-audit-live-item ${status}`}
                onClick={() => onOpen?.(item)}
              >
                <span className="rf-audit-live-avatar">
                  {leadName(item.lead).slice(0, 1).toUpperCase()}
                </span>
                <span className="rf-audit-live-copy">
                  <b>{leadName(item.lead)}</b>
                  <small>
                    {status === "generating"
                      ? "Claude is auditing public evidence…"
                      : status === "queued"
                        ? "Waiting for audit worker…"
                        : Number.isFinite(score)
                          ? `Ready · ${score}/100 fit`
                          : "Mini Audit ready"}
                  </small>
                </span>
                <span className={`rf-audit-live-state ${status}`}>
                  {status === "generating" ? <Loader2 size={12} className="spin" /> : status === "queued" ? <Clock3 size={12} /> : <CheckCircle2 size={12} />}
                </span>
              </button>
            );
          })
        ) : (
          <div className="rf-audit-live-empty">
            <Sparkles size={15} />
            <span>Select leads and run Mini Audits. Their status will appear here without leaving the page.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function AuditStat({ label, value, detail }) {
  return (
    <article className="rf-audit-stat">
      <span>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
    </article>
  );
}

function AuditField({
  label,
  value,
  onChange,
  placeholder,
  textarea = false,
  full = false,
}) {
  return (
    <label className={`rf-audit-field ${full ? "full" : ""}`}>
      <span>{label}</span>
      {textarea ? (
        <textarea
          rows={3}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function AuditStatus({ status, score }) {
  const normalized = normalizeStatus(status);
  const label =
    normalized === "complete"
      ? Number.isFinite(score)
        ? `${score}/100`
        : "Ready"
      : normalized === "queued"
        ? "Queued"
        : normalized === "generating"
          ? "Running"
          : normalized === "no_website"
            ? "No site"
            : "Not run";

  return <span className={`rf-audit-status ${normalized}`}>{label}</span>;
}

function LeadAuditDetail({
  item,
  profile,
  detailOpen,
  onToggleDetail,
  onRun,
  onDeep,
  deepBusy,
}) {
  const report = item.report;
  const result = report?.report || {};
  const salesFit = result?.salesFit || {};
  const issues = Array.isArray(result?.issues)
    ? result.issues
    : Array.isArray(result?.priorityFindings)
      ? result.priorityFindings.map((finding) => ({
          tag: finding.title,
          finding: finding.evidence,
          pain: finding.businessImpact,
          source: finding.source,
        }))
      : [];

  const pitchAngles = arrayOfStrings(salesFit.pitchAngles);
  const likelyNeeds = arrayOfStrings(salesFit.likelyNeeds);
  const fitScore = getFitScore(report);
  const reportStatus = normalizeStatus(report?.status);

  return (
    <div className="rf-audit-lead-detail">
      <section className="rf-audit-lead-identity">
        <div>
          <span className="rf-audit-company-mark">
            {leadName(item.lead).slice(0, 1).toUpperCase()}
          </span>
          <div>
            <span>{item.lead.category || "Prospect"}</span>
            <h2>{leadName(item.lead)}</h2>
            <p>{item.lead.address || safeHostname(item.lead.website) || "No location supplied"}</p>
          </div>
        </div>

        <div className="rf-audit-fit-score">
          <small>Sales fit</small>
          <strong>{Number.isFinite(fitScore) ? fitScore : "—"}</strong>
          <span>/100</span>
        </div>
      </section>

      {!item.lead.website ? (
        <div className="rf-audit-missing">
          <Globe2 size={20} />
          <div>
            <b>A public website is required for this audit path.</b>
            <p>
              This lead can remain in ReachFly, but Claude needs a public site before
              this evidence-grounded pitch audit can run.
            </p>
          </div>
        </div>
      ) : !report ? (
        <div className="rf-audit-empty">
          <Wand2 size={28} />
          <h2>No pitch audit yet.</h2>
          <p>
            Run a mini audit to compare this business with your configured niche,
            offer and pitch goal.
          </p>
          <button type="button" className="rf-audit-btn primary" onClick={onRun}>
            <Sparkles size={15} />
            Run Claude audit
          </button>
        </div>
      ) : ["queued", "generating"].includes(reportStatus) ? (
        <div className="rf-audit-processing">
          <Loader2 size={25} className="spin" />
          <div>
            <b>{reportStatus === "queued" ? "Audit queued" : "Claude is building the audit"}</b>
            <p>
              ReachFly is checking public evidence and converting the verified findings
              into internal pitch context.
            </p>
          </div>
        </div>
      ) : reportStatus === "failed" ? (
        <div className="rf-audit-missing">
          <AlertTriangle size={20} />
          <div>
            <b>Audit generation failed</b>
            <p>{report.error || "Retry the audit for this lead."}</p>
            <button type="button" className="rf-audit-btn secondary" onClick={onRun}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="rf-audit-sales-card">
            <div className="rf-audit-sales-card-head">
              <div>
                <span>Commercial alignment</span>
                <h3>{salesFit.alignment || "Verified sales relevance"}</h3>
              </div>
              <span className="rf-audit-private-pill">
                <ShieldCheck size={13} />
                Private AI context
              </span>
            </div>

            <p>
              {salesFit.summary ||
                result.executiveSummary ||
                "ReachFly found verified public signals that can be used to make the first sales conversation more specific."}
            </p>

            <div className="rf-audit-fit-grid">
              <article>
                <span>Suggested opener</span>
                <b>
                  {salesFit.suggestedOpener ||
                    buildFallbackOpener(item.lead, issues, profile)}
                </b>
              </article>
              <article>
                <span>Pitch goal</span>
                <b>{profile.pitchGoal || "Qualify genuine need and agree the next step."}</b>
              </article>
            </div>

            {salesFit.caution ? (
              <div className="rf-audit-caution">
                <AlertTriangle size={14} />
                <span>{salesFit.caution}</span>
              </div>
            ) : null}
          </section>

          <div className="rf-audit-two-col">
            <section className="rf-audit-subcard">
              <div className="rf-audit-subcard-head">
                <Zap size={16} />
                <div>
                  <span>Why this lead may fit</span>
                  <b>Relevant needs</b>
                </div>
              </div>

              <ul className="rf-audit-list">
                {(likelyNeeds.length
                  ? likelyNeeds
                  : issues.slice(0, 4).map((issue) => issue.pain)
                ).map((value, index) => (
                  <li key={`${value}-${index}`}>
                    <CheckCircle2 size={14} />
                    <span>{value}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rf-audit-subcard">
              <div className="rf-audit-subcard-head">
                <Target size={16} />
                <div>
                  <span>How to position the offer</span>
                  <b>Pitch angles</b>
                </div>
              </div>

              <ul className="rf-audit-list">
                {(pitchAngles.length
                  ? pitchAngles
                  : issues.slice(0, 4).map((issue) => issue.finding)
                ).map((value, index) => (
                  <li key={`${value}-${index}`}>
                    <ArrowRight size={14} />
                    <span>{value}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="rf-audit-evidence-card">
            <button type="button" onClick={onToggleDetail}>
              <span>
                <FileText size={16} />
                <span>
                  <b>Verified findings</b>
                  <small>{issues.length} evidence-backed observations</small>
                </span>
              </span>
              <ChevronDown size={17} className={detailOpen ? "rotated" : ""} />
            </button>

            {detailOpen ? (
              <div className="rf-audit-evidence-list">
                {issues.length ? (
                  issues.map((issue, index) => (
                    <article key={`${issue.tag || "finding"}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <b>{issue.tag || "Finding"}</b>
                        <p>{issue.finding || issue.evidence || "Verified finding."}</p>
                        {issue.pain ? <small>{issue.pain}</small> : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rf-audit-muted">
                    The report completed without separate finding rows.
                  </p>
                )}
              </div>
            ) : null}
          </section>

          <section className="rf-audit-agent-context">
            <Brain size={18} />
            <div>
              <b>Automatically available to the AI sales agent</b>
              <p>
                ReachFly matches the completed audit to this lead by workspace and
                website. The Voice Agent receives the opener, alignment, strongest
                findings and pitch angles as private context. It is instructed not to
                expose the audit mechanics or pretend the prospect already showed interest.
              </p>
            </div>
          </section>

          <div className="rf-audit-detail-actions">
            <button
              type="button"
              className="rf-audit-btn secondary"
              disabled={deepBusy}
              onClick={onDeep}
            >
              {deepBusy ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
              {deepBusy ? "Queuing deep audit…" : "Run deep audit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AuditWorkspaceSkeleton() {
  return (
    <div className="rf-audit-workspace rf-audit-skeleton">
      <aside />
      <section />
    </div>
  );
}

function restoreSelection({ leads, searchParams, setSelectedIds, setActiveLeadId }) {
  const exactLead = String(searchParams.get("lead") || "").trim();
  let stored = [];

  try {
    const payload = JSON.parse(
      sessionStorage.getItem(AUDIT_SELECTION_STORAGE_KEY) || "{}"
    );
    stored = Array.isArray(payload?.leads) ? payload.leads : [];
  } catch {
    stored = [];
  }

  const identities = new Set(stored.map(leadIdentity).filter(Boolean));
  const ids = new Set();

  leads.forEach((lead, index) => {
    const identity = leadIdentity(lead);
    const id = identity || `lead-${index}`;

    if (
      identities.has(identity) ||
      String(lead.sourceLeadId || lead.id || "") === exactLead
    ) {
      ids.add(id);
    }
  });

  setSelectedIds(ids);

  if (exactLead) {
    const item = leads.find(
      (lead) => String(lead.sourceLeadId || lead.id || "") === exactLead
    );
    if (item) setActiveLeadId(leadIdentity(item));
  } else if (ids.size) {
    setActiveLeadId([...ids][0]);
  }
}

function buildInitialProfile(saved, user) {
  const source = saved && typeof saved === "object" ? saved : {};
  return {
    ...DEFAULT_PROFILE,
    ...source,
    businessNiche:
      String(
        source.businessNiche ||
          user?.businessNiche ||
          user?.niche ||
          user?.industry ||
          user?.companyIndustry ||
          ""
      ).trim(),
    idealCustomer:
      String(source.idealCustomer || user?.idealCustomer || "").trim(),
    offer:
      String(source.offer || user?.offer || user?.companyOffer || "").trim(),
    targetMarket:
      String(source.targetMarket || user?.targetMarket || "").trim(),
    painPoints:
      String(source.painPoints || user?.painPoints || "").trim(),
    miniAuditDirection:
      String(
        source.miniAuditDirection ||
          DEFAULT_PROFILE.miniAuditDirection
      ).trim(),
    criteria: {
      ...DEFAULT_PROFILE.criteria,
      ...(source.criteria || {}),
    },
  };
}

function sanitizeProfile(value = {}) {
  const criteria = {};
  for (const [key] of CRITERIA) {
    criteria[key] = value.criteria?.[key] !== false;
  }

  return {
    businessNiche: String(value.businessNiche || "").trim().slice(0, 180),
    idealCustomer: String(value.idealCustomer || "").trim().slice(0, 600),
    offer: String(value.offer || "").trim().slice(0, 800),
    targetMarket: String(value.targetMarket || "").trim().slice(0, 240),
    painPoints: String(value.painPoints || "").trim().slice(0, 1200),
    miniAuditDirection:
      String(value.miniAuditDirection || DEFAULT_PROFILE.miniAuditDirection)
        .trim()
        .slice(0, 1600),
    pitchGoal: String(value.pitchGoal || "").trim().slice(0, 600),
    customInstructions: String(value.customInstructions || "").trim().slice(0, 1600),
    criteria,
  };
}

function normalizeLeads(payload) {
  const source =
    payload?.items ||
    payload?.leads ||
    payload?.records ||
    payload?.data ||
    [];

  return Array.isArray(source) ? source.filter(Boolean) : [];
}

function normalizeReports(payload) {
  const source = Array.isArray(payload)
    ? payload
    : payload?.reports
      ? payload.reports
      : payload?.id
        ? [payload]
        : [];

  return Array.isArray(source) ? source.filter(Boolean) : [];
}

function mergeReports(current, incoming) {
  const map = new Map();

  for (const item of [...incoming, ...current]) {
    if (!item?.id) continue;
    if (!map.has(item.id)) map.set(item.id, item);
  }

  return [...map.values()].sort(
    (a, b) =>
      Date.parse(b.updatedAt || b.createdAt || 0) -
      Date.parse(a.updatedAt || a.createdAt || 0)
  );
}

function getFitScore(report) {
  const value =
    report?.report?.salesFit?.fitScore ??
    report?.report?.salesFit?.score ??
    null;

  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.min(100, Math.round(number)))
    : null;
}

function leadIdentity(lead) {
  const place = String(lead?.placeId || lead?.place_id || "").trim().toLowerCase();
  if (place) return `place:${place}`;

  const website = normalizeWebsite(lead?.website);
  if (website) return `website:${website}`;

  const email = String(lead?.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  const phone = String(lead?.phone || "").replace(/\D/g, "");
  if (phone) return `phone:${phone}`;

  const name = String(lead?.business || lead?.name || "").trim().toLowerCase();
  const address = String(lead?.address || "").trim().toLowerCase();
  return name || address ? `business:${name}|${address}` : "";
}

function leadName(lead) {
  return String(lead?.business || lead?.name || "Business").trim();
}

function normalizeWebsite(value) {
  try {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function safeHostname(value) {
  return normalizeWebsite(value);
}

function ensureUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function arrayOfStrings(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function buildFallbackOpener(lead, issues, profile) {
  const finding = issues.find((item) => item?.finding)?.finding;
  const business = leadName(lead);

  if (finding) {
    return `I was looking at ${business} and noticed ${lowerFirst(
      finding
    )} I wanted to ask how you are handling that today.`;
  }

  if (profile.offer) {
    return `I wanted to ask how ${business} is currently handling the problem that ${profile.offer} is designed to solve.`;
  }

  return `I wanted to ask how ${business} is handling lead follow-up and conversion today.`;
}

function lowerFirst(value) {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : "";
}

const AUDIT_WORKSPACE_CSS = `
.rf-audit-intel{
  width:min(1480px,100%);
  margin:0 auto;
  color:#20222b;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.rf-audit-intel *{box-sizing:border-box}
.rf-audit-intel button,.rf-audit-intel input,.rf-audit-intel textarea{font:inherit}
.rf-audit-intel button{cursor:pointer}
.rf-audit-intel .spin{animation:rfAuditSpin .8s linear infinite}
@keyframes rfAuditSpin{to{transform:rotate(360deg)}}
.rf-audit-intel__hero{
  display:flex;justify-content:space-between;align-items:flex-end;gap:24px;
  margin:0 0 18px;padding:4px 0 0;
}
.rf-audit-intel__hero>div:first-child{max-width:820px}
.rf-audit-kicker{
  display:inline-flex;align-items:center;gap:7px;margin-bottom:9px;
  color:#5557db;font-size:10px;font-weight:850;letter-spacing:.11em;text-transform:uppercase;
}
.rf-audit-intel__hero h1{
  margin:0;color:#20222b;font-size:30px;line-height:1.07;letter-spacing:-.045em;font-weight:780;
}
.rf-audit-intel__hero p{
  max-width:760px;margin:9px 0 0;color:#767986;font-size:12px;line-height:1.65;
}
.rf-audit-hero-actions{display:flex;gap:8px;flex-wrap:wrap}
.rf-audit-btn{
  min-height:38px;display:inline-flex;align-items:center;justify-content:center;gap:7px;
  border-radius:9px;padding:0 13px;border:1px solid #e2e4e9;background:#fff;color:#555862;
  font-size:10px;font-weight:760;transition:.16s ease;
}
.rf-audit-btn:hover:not(:disabled){transform:translateY(-1px);border-color:#cfd1ff}
.rf-audit-btn.primary{background:#5557db;border-color:#5557db;color:#fff;box-shadow:0 8px 18px rgba(85,87,219,.17)}
.rf-audit-btn.secondary{background:#fff;color:#4d4f5a}
.rf-audit-btn:disabled{opacity:.48;cursor:not-allowed;transform:none}
.rf-audit-notice{
  display:grid;grid-template-columns:32px minmax(0,1fr) 30px;align-items:flex-start;gap:10px;
  margin:0 0 12px;padding:10px 12px;border:1px solid #dfe1fa;border-radius:11px;background:#f8f8ff;
}
.rf-audit-notice>span{width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:#ececff;color:#5557db}
.rf-audit-notice b{font-size:11px}
.rf-audit-notice p{margin:2px 0 0;color:#727582;font-size:10px;line-height:1.5}
.rf-audit-notice>button{border:0;background:transparent;color:#92949e}
.rf-audit-notice.success{background:#f5fcf8;border-color:#d9efe1}.rf-audit-notice.success>span{background:#e8f8ef;color:#238b59}
.rf-audit-notice.warning{background:#fffbf3;border-color:#f2e0b9}.rf-audit-notice.warning>span{background:#fff2d5;color:#a16a08}
.rf-audit-notice.error{background:#fff7f7;border-color:#f1d7d7}.rf-audit-notice.error>span{background:#fdeaea;color:#b74848}
.rf-audit-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
.rf-audit-stat{
  min-height:88px;padding:14px 15px;border:1px solid #e8e9ed;border-radius:12px;background:#fff;box-shadow:0 7px 20px rgba(29,31,41,.035)
}
.rf-audit-stat span,.rf-audit-stat small{display:block;color:#8a8c97;font-size:9px}
.rf-audit-stat b{display:block;margin:7px 0 4px;color:#23252d;font-size:22px;line-height:1;font-weight:790;letter-spacing:-.04em}
.rf-audit-live-stream{margin-bottom:10px;border:1px solid #e4e5ed;border-radius:12px;background:#fff;overflow:hidden}
.rf-audit-live-stream-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px;border-bottom:1px solid #eff0f3;background:#fcfcfe}
.rf-audit-live-stream-head>div:first-child{display:flex;align-items:center;gap:9px}.rf-audit-live-stream-head b,.rf-audit-live-stream-head small{display:block}.rf-audit-live-stream-head b{font-size:9px}.rf-audit-live-stream-head small{margin-top:1px;color:#8c8f99;font-size:8px}
.rf-audit-live-signal{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border-radius:999px;background:#f1f2f5;color:#777a84;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.rf-audit-live-signal i{width:6px;height:6px;border-radius:50%;background:#aeb0b8}.rf-audit-live-signal.active{background:#fff0f0;color:#b44343}.rf-audit-live-signal.active i{background:#ef4e4e;box-shadow:0 0 0 0 rgba(239,78,78,.35);animation:rfAuditPulse 1.4s infinite}
@keyframes rfAuditPulse{70%{box-shadow:0 0 0 7px rgba(239,78,78,0)}100%{box-shadow:0 0 0 0 rgba(239,78,78,0)}}
.rf-audit-live-working{display:inline-flex;align-items:center;gap:5px;color:#5557db;font-size:8px;font-weight:750}
.rf-audit-live-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#eff0f3}.rf-audit-live-item{display:grid;grid-template-columns:27px minmax(0,1fr) 20px;align-items:center;gap:7px;min-height:54px;padding:7px 9px;border:0;background:#fff;text-align:left;color:#525560}.rf-audit-live-item:hover{background:#fafaff}.rf-audit-live-avatar{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;background:#efefff;color:#5557db;font-size:8px;font-weight:800}.rf-audit-live-copy{min-width:0}.rf-audit-live-copy b,.rf-audit-live-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rf-audit-live-copy b{font-size:8px}.rf-audit-live-copy small{margin-top:2px;color:#92949d;font-size:7px}.rf-audit-live-state{width:20px;height:20px;display:grid;place-items:center;border-radius:6px;background:#f1f2f4;color:#888b95}.rf-audit-live-state.complete{background:#eaf8f0;color:#24865a}.rf-audit-live-state.generating,.rf-audit-live-state.queued{background:#fff3de;color:#9b650a}.rf-audit-live-empty{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:7px;min-height:50px;padding:8px 12px;background:#fff;color:#8b8d97;font-size:8px}
.rf-audit-profile-card{margin-bottom:12px;border:1px solid #e4e5ed;border-radius:13px;background:#fff;overflow:hidden}
.rf-audit-profile-head{
  width:100%;display:grid;grid-template-columns:36px minmax(0,1fr) 22px;align-items:center;gap:10px;
  padding:12px 14px;border:0;background:#fff;text-align:left;color:#25272f;
}
.rf-audit-profile-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:#f0f0ff;color:#5557db}
.rf-audit-profile-head b,.rf-audit-profile-head small{display:block}
.rf-audit-profile-head b{font-size:11px}.rf-audit-profile-head small{margin-top:2px;color:#81838e;font-size:9px}
.rf-audit-profile-head svg.rotated,.rf-audit-evidence-card>button svg.rotated{transform:rotate(180deg)}
.rf-audit-profile-body{border-top:1px solid #eef0f3;padding:14px}
.rf-audit-profile-fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.rf-audit-field{display:grid;gap:6px}.rf-audit-field.full{grid-column:span 2}
.rf-audit-field>span{font-size:9px;color:#656873;font-weight:760}
.rf-audit-field input,.rf-audit-field textarea{
  width:100%;border:1px solid #e1e3e8;border-radius:9px;background:#fbfbfd;color:#292b33;outline:none;
  font-size:10px;padding:0 11px;
}
.rf-audit-field input{height:38px}.rf-audit-field textarea{min-height:72px;padding-top:10px;resize:vertical;line-height:1.45}
.rf-audit-field input:focus,.rf-audit-field textarea:focus{border-color:#bfc1ff;box-shadow:0 0 0 3px rgba(85,87,219,.08);background:#fff}
.rf-audit-criteria{margin-top:14px;padding-top:12px;border-top:1px solid #f0f1f4}
.rf-audit-criteria>div:first-child b,.rf-audit-criteria>div:first-child small{display:block}
.rf-audit-criteria>div:first-child b{font-size:10px}.rf-audit-criteria>div:first-child small{margin-top:2px;color:#8b8d98;font-size:9px}
.rf-audit-criteria-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}
.rf-audit-criteria-grid button{
  display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:flex-start;padding:9px;border:1px solid #e9eaee;
  border-radius:9px;background:#fff;text-align:left;color:#555862;
}
.rf-audit-criteria-grid button>span{width:20px;height:20px;display:grid;place-items:center;border:1px solid #dfe1e7;border-radius:6px;color:#fff}
.rf-audit-criteria-grid button.selected{border-color:#d3d4ff;background:#f8f8ff}.rf-audit-criteria-grid button.selected>span{background:#5557db;border-color:#5557db}
.rf-audit-criteria-grid button b,.rf-audit-criteria-grid button small{display:block}.rf-audit-criteria-grid button b{font-size:9px}.rf-audit-criteria-grid button small{margin-top:2px;color:#92949d;font-size:8px;line-height:1.4}
.rf-audit-profile-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:12px;padding-top:12px;border-top:1px solid #f0f1f4}
.rf-audit-profile-footer>div{display:flex;align-items:flex-start;gap:8px;color:#777a86;font-size:9px;line-height:1.5}.rf-audit-profile-footer>div svg{flex:0 0 auto;color:#5557db}
.rf-audit-workspace{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);min-height:620px;border:1px solid #e4e5e9;border-radius:13px;background:#fff;overflow:hidden}
.rf-audit-leads{min-width:0;border-right:1px solid #e9eaee;background:#fbfbfc}
.rf-audit-detail{min-width:0;background:#fff}
.rf-audit-panel-head{
  min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid #e9eaee;background:#fff
}
.rf-audit-panel-head>div{display:flex;align-items:center;gap:9px}.rf-audit-panel-head>div>span{width:25px;height:25px;display:grid;place-items:center;border-radius:7px;background:#f0f0ff;color:#5557db;font-size:8px;font-weight:800}
.rf-audit-panel-head b,.rf-audit-panel-head small{display:block}.rf-audit-panel-head b{font-size:10px}.rf-audit-panel-head small{margin-top:1px;color:#92949d;font-size:8px}
.rf-audit-panel-head button,.rf-audit-panel-head a{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:#5557db;font-size:8px;font-weight:750}
.rf-audit-search{height:36px;display:flex;align-items:center;gap:7px;margin:10px;padding:0 10px;border:1px solid #e2e4e8;border-radius:8px;background:#fff;color:#999ba5}
.rf-audit-search input{width:100%;border:0;outline:0;background:transparent;font-size:9px}
.rf-audit-status-tabs{display:flex;gap:4px;padding:0 10px 8px;overflow:auto}.rf-audit-status-tabs button{white-space:nowrap;border:0;border-radius:7px;background:transparent;color:#888a94;padding:6px 8px;font-size:8px;font-weight:720}.rf-audit-status-tabs button.active{background:#ededff;color:#5557db}
.rf-audit-lead-list{max-height:690px;overflow:auto;border-top:1px solid #eceef1}
.rf-audit-lead-row{width:100%;display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:7px;padding:10px;border:0;border-bottom:1px solid #eeeeF2;background:transparent;text-align:left;color:#555862}
.rf-audit-lead-row:hover,.rf-audit-lead-row.active{background:#f6f6ff}.rf-audit-lead-row.active{box-shadow:inset 3px 0 #5557db}
.rf-audit-check{width:19px;height:19px;display:grid;place-items:center;border:1px solid #dadce2;border-radius:5px;background:#fff;color:#fff}.rf-audit-check.selected{background:#5557db;border-color:#5557db}
.rf-audit-lead-copy{min-width:0}.rf-audit-lead-copy b,.rf-audit-lead-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rf-audit-lead-copy b{color:#30323a;font-size:9px}.rf-audit-lead-copy small{margin-top:2px;color:#91939d;font-size:8px}
.rf-audit-status{min-width:44px;text-align:center;padding:5px 6px;border-radius:999px;background:#f0f1f3;color:#7d7f89;font-size:7px;font-weight:800}.rf-audit-status.complete{background:#ebf8f0;color:#278558}.rf-audit-status.queued,.rf-audit-status.generating{background:#fff4df;color:#986408}.rf-audit-status.no_website{background:#f5eded;color:#9b5656}
.rf-audit-lead-detail{padding:14px}
.rf-audit-lead-identity{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.rf-audit-lead-identity>div:first-child{display:flex;align-items:center;gap:10px;min-width:0}.rf-audit-company-mark{width:40px;height:40px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(135deg,#5557db,#8b6de8);color:#fff;font-weight:800}
.rf-audit-lead-identity h2{margin:2px 0;color:#25272f;font-size:18px;letter-spacing:-.03em}.rf-audit-lead-identity p,.rf-audit-lead-identity div>span{margin:0;color:#8b8d97;font-size:8px}
.rf-audit-fit-score{display:grid;grid-template-columns:auto auto;align-items:end;padding:9px 12px;border:1px solid #e4e5ed;border-radius:10px;background:#fbfbff;text-align:right}.rf-audit-fit-score small{grid-column:1/3;color:#8c8e98;font-size:7px}.rf-audit-fit-score strong{font-size:24px;line-height:1;color:#5557db}.rf-audit-fit-score span{font-size:8px;color:#9698a1}
.rf-audit-empty,.rf-audit-processing,.rf-audit-missing{min-height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;border:1px dashed #dedfe8;border-radius:12px;background:#fafafe;color:#777a86}
.rf-audit-empty svg,.rf-audit-processing>svg,.rf-audit-missing>svg{color:#5557db}.rf-audit-empty h2,.rf-audit-missing b,.rf-audit-processing b{margin:10px 0 5px;color:#2c2e36;font-size:14px}.rf-audit-empty p,.rf-audit-missing p,.rf-audit-processing p{max-width:520px;margin:0 0 12px;font-size:9px;line-height:1.6}
.rf-audit-sales-card{padding:14px;border:1px solid #dfe0fb;border-radius:12px;background:linear-gradient(135deg,#f7f7ff,#fff 72%)}
.rf-audit-sales-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.rf-audit-sales-card-head span{color:#777a87;font-size:8px}.rf-audit-sales-card-head h3{margin:3px 0 0;color:#292b33;font-size:14px}
.rf-audit-private-pill{display:inline-flex!important;align-items:center;gap:4px;padding:5px 7px;border-radius:999px;background:#ededff;color:#5557db!important;font-weight:780}
.rf-audit-sales-card>p{margin:10px 0;color:#666975;font-size:9px;line-height:1.6}
.rf-audit-fit-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:8px}.rf-audit-fit-grid article{padding:10px;border:1px solid #ebecef;border-radius:9px;background:#fff}.rf-audit-fit-grid span,.rf-audit-fit-grid b{display:block}.rf-audit-fit-grid span{color:#94969f;font-size:7px}.rf-audit-fit-grid b{margin-top:4px;color:#3a3c45;font-size:9px;line-height:1.5}
.rf-audit-caution{display:flex;align-items:flex-start;gap:6px;margin-top:9px;padding:8px;border-radius:8px;background:#fff8e9;color:#8c6516;font-size:8px;line-height:1.5}
.rf-audit-two-col{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}.rf-audit-subcard{padding:12px;border:1px solid #e8e9ed;border-radius:11px;background:#fff}.rf-audit-subcard-head{display:flex;align-items:center;gap:7px;color:#5557db}.rf-audit-subcard-head span,.rf-audit-subcard-head b{display:block}.rf-audit-subcard-head span{color:#91939d;font-size:7px}.rf-audit-subcard-head b{margin-top:1px;color:#30323a;font-size:10px}
.rf-audit-list{display:grid;gap:7px;margin:10px 0 0;padding:0;list-style:none}.rf-audit-list li{display:flex;align-items:flex-start;gap:6px;color:#666975;font-size:8px;line-height:1.5}.rf-audit-list li svg{flex:0 0 auto;margin-top:1px;color:#5557db}
.rf-audit-evidence-card{margin-top:9px;border:1px solid #e7e8ec;border-radius:11px;overflow:hidden}.rf-audit-evidence-card>button{width:100%;display:flex;align-items:center;justify-content:space-between;padding:11px;border:0;background:#fafafb;color:#4d4f59;text-align:left}.rf-audit-evidence-card>button>span{display:flex;align-items:center;gap:7px}.rf-audit-evidence-card>button b,.rf-audit-evidence-card>button small{display:block}.rf-audit-evidence-card>button b{font-size:9px}.rf-audit-evidence-card>button small{color:#9799a2;font-size:7px}
.rf-audit-evidence-list{display:grid}.rf-audit-evidence-list article{display:grid;grid-template-columns:26px minmax(0,1fr);gap:8px;padding:10px 11px;border-top:1px solid #eeeef1}.rf-audit-evidence-list article>span{width:24px;height:24px;display:grid;place-items:center;border-radius:6px;background:#f1f1ff;color:#5557db;font-size:7px;font-weight:800}.rf-audit-evidence-list b{font-size:9px}.rf-audit-evidence-list p{margin:3px 0;color:#666975;font-size:8px;line-height:1.5}.rf-audit-evidence-list small{display:block;color:#9698a1;font-size:7px;line-height:1.5}
.rf-audit-agent-context{display:flex;align-items:flex-start;gap:9px;margin-top:9px;padding:11px;border:1px solid #dcefe4;border-radius:11px;background:#f6fcf8;color:#2f6f4d}.rf-audit-agent-context svg{flex:0 0 auto}.rf-audit-agent-context b{display:block;font-size:9px}.rf-audit-agent-context p{margin:3px 0 0;font-size:8px;line-height:1.55}
.rf-audit-detail-actions{display:flex;justify-content:flex-end;margin-top:9px}
.rf-audit-empty-small{display:flex;flex-direction:column;align-items:center;text-align:center;padding:28px 16px;color:#91939d}.rf-audit-empty-small b{margin-top:7px;color:#555862;font-size:9px}.rf-audit-empty-small small{margin-top:3px;font-size:8px;line-height:1.5}
.rf-audit-skeleton aside,.rf-audit-skeleton section{min-height:620px;background:linear-gradient(90deg,#f4f4f6,#fff,#f4f4f6);background-size:220%;animation:rfAuditShimmer 1.2s infinite}@keyframes rfAuditShimmer{to{background-position:-220% 0}}
.rf-audit-muted{padding:12px;color:#9698a2;font-size:8px}
@media(max-width:1050px){
  .rf-audit-live-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rf-audit-profile-fields{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rf-audit-criteria-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:820px){
  .rf-audit-intel__hero{align-items:stretch;flex-direction:column}
  .rf-audit-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rf-audit-workspace{grid-template-columns:1fr}
  .rf-audit-leads{border-right:0;border-bottom:1px solid #e9eaee}
  .rf-audit-lead-list{max-height:360px}
  .rf-audit-profile-footer{align-items:stretch;flex-direction:column}
}
@media(max-width:620px){
  .rf-audit-intel__hero h1{font-size:25px}
  .rf-audit-live-strip{grid-template-columns:1fr}
  .rf-audit-live-stream-head{align-items:flex-start;flex-direction:column}
  .rf-audit-profile-fields,.rf-audit-criteria-grid,.rf-audit-two-col,.rf-audit-fit-grid{grid-template-columns:1fr}
  .rf-audit-field.full{grid-column:auto}
}
@media(prefers-reduced-motion:reduce){
  .rf-audit-intel *{scroll-behavior:auto!important}
  .rf-audit-intel .spin{animation:none!important}
}
`;

