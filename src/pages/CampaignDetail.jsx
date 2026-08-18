import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Workflow,
  X,
  Zap,
} from "../components/icons";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import CampaignTeamAssignment from "../components/CampaignTeamAssignment";
import CampaignAuditBatch from "../components/CampaignAuditBatch";

const CHART_W = 760;
const CHART_H = 250;
const CHART_PAD = { top: 20, right: 16, bottom: 34, left: 42 };

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadOutcome, setLeadOutcome] = useState("all");
  const [expandedLeadId, setExpandedLeadId] = useState("");
  const eventToastRef = useRef({ key: "", at: 0 });

  const role = normalizeWorkspaceRole(user?.workspaceRole || user?.role || "");
  const canManageCampaigns = ["owner", "admin", "manager"].includes(role);
  const isPrivilegedAdmin = ["owner", "admin"].includes(role);
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canAssign = canManageCampaigns && (
    isPrivilegedAdmin || permissions.includes("assign_leads")
  );

  const load = useCallback(async ({ silent = false, successToast = false } = {}) => {
    if (!canManageCampaigns || !id) {
      if (!silent) setLoading(false);
      return null;
    }

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const item = await api.campaign(id);
      setCampaign(item);
      setError("");
      if (successToast) {
        notify("success", "Campaign refreshed", "The latest campaign and lead activity is now visible.");
      }
      return item;
    } catch (requestError) {
      const message = requestError?.message || "The campaign could not be loaded.";
      setError(message);
      if (successToast) notify("error", "Campaign refresh failed", message);
      return null;
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [canManageCampaigns, id]);

  useEffect(() => {
    if (!user || canManageCampaigns) return;
    navigate("/app/dashboard", { replace: true });
  }, [canManageCampaigns, navigate, user]);

  useEffect(() => {
    if (!canManageCampaigns || !id) return undefined;

    let mounted = true;
    void load();

    const source = new EventSource(api.eventsUrl(id));
    source.onopen = () => mounted && setLiveConnected(true);
    source.onmessage = (event) => {
      if (!mounted) return;
      let parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (parsed.campaign) {
        setCampaign((current) => ({ ...(current || {}), ...parsed.campaign }));
      }

      if ([
        "complete",
        "error",
        "pipeline_started",
        "pipeline_progress",
        "pipeline_complete",
        "lead_updated",
        "call_updated",
        "voice_call_updated",
        "meeting_booked",
      ].includes(parsed.type)) {
        void load({ silent: true });
      }

      maybeToastEvent(parsed, eventToastRef);
    };
    source.onerror = () => mounted && setLiveConnected(false);

    return () => {
      mounted = false;
      source.close();
    };
  }, [canManageCampaigns, id, load]);

  const leads = useMemo(
    () => (Array.isArray(campaign?.leads) ? campaign.leads : []),
    [campaign]
  );

  const isImported = campaign?.source === "external-import" || campaign?.externalImport === true;
  const pipelineStatus = normalizeStatus(campaign?.pipelineStatus);
  const campaignStatus = normalizeStatus(campaign?.status);
  const isDiscoveryRunning = !isImported && pipelineStatus === "discovering" && ["queued", "active"].includes(campaignStatus);
  const isSending = pipelineStatus === "running";
  const isComplete = pipelineStatus === "complete";
  const isFailed = pipelineStatus === "failed";
  const isImportedReady = isImported && !isSending && !isComplete && !isFailed;
  const progress = isSending
    ? campaign?.outreachProgress || { percent: 1, message: "Running outreach pipeline" }
    : campaign?.progress || { percent: 0, message: "Opening campaign" };

  const senderEmail = getSenderEmail(campaign);
  const voiceEnabled = isAiVoiceEnabled(campaign);
  const backTarget = getBackTarget(campaign);
  const status = getCampaignStatus(campaign, isImported);
  const metrics = useMemo(() => buildCampaignMetrics(campaign, leads), [campaign, leads]);
  const timeline = useMemo(() => buildTimelineSeries(leads), [leads]);
  const activityItems = useMemo(() => buildActivityItems(campaign, leads), [campaign, leads]);
  const contactPreview = useMemo(() => leads.slice(0, 6), [leads]);

  const outcomeOptions = useMemo(() => {
    const values = new Set(leads.map(getLeadOutcome).filter(Boolean));
    return ["all", ...Array.from(values).sort()];
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      const outcome = getLeadOutcome(lead);
      if (leadOutcome !== "all" && outcome !== leadOutcome) return false;
      if (!q) return true;
      return [
        lead?.business,
        lead?.name,
        lead?.email,
        lead?.phone,
        lead?.address,
        lead?.location,
        lead?.website,
        lead?.source,
        getAssignedUserName(lead),
        outcome,
        ...(Array.isArray(lead?.tags) ? lead.tags : []),
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [leadOutcome, leadQuery, leads]);

  if (!canManageCampaigns) {
    return (
      <>
        <CampaignDetailStyles />
        <div className="rf-campaign-detail-v7">
          <section className="rfcd-access">
            <span className="rfcd-access-icon"><Rocket size={24} /></span>
            <span className="rfcd-eyebrow">Restricted workspace feature</span>
            <h1>Campaign access required</h1>
            <p>Campaign details, lead audits, pipeline controls, and lead assignment are available to workspace owners, administrators, and managers.</p>
            <button type="button" className="rfcd-btn rfcd-btn-primary" onClick={() => navigate("/app/dashboard", { replace: true })}>
              Return to dashboard <ArrowRight size={16} />
            </button>
          </section>
        </div>
      </>
    );
  }

  if (loading && !campaign) {
    return <><CampaignDetailStyles /><CampaignDetailSkeleton /></>;
  }

  if (error && !campaign) {
    return (
      <>
        <CampaignDetailStyles />
        <div className="rf-campaign-detail-v7">
          <section className="rfcd-fatal">
            <span className="rfcd-fatal-icon"><X size={22} /></span>
            <span className="rfcd-eyebrow">Campaign unavailable</span>
            <h1>We couldn't open this campaign</h1>
            <p>{error}</p>
            <div className="rfcd-fatal-actions">
              <button type="button" className="rfcd-btn rfcd-btn-primary" onClick={() => void load({ successToast: true })}>
                <RefreshCw size={15} /> Try again
              </button>
              <Link className="rfcd-btn rfcd-btn-secondary" to="/app/campaigns">Back to campaigns</Link>
            </div>
          </section>
        </div>
      </>
    );
  }

  if (!campaign) return null;

  return (
    <>
      <CampaignDetailStyles />
      <div className="rf-campaign-detail-v7">
        <div className="rfcd-topline">
          <Link className="rfcd-back" to={backTarget}><ArrowLeft size={15} /> Campaigns</Link>
          <div className="rfcd-live-state">
            <span className={`rfcd-live-dot ${liveConnected ? "connected" : ""}`} />
            <span>{liveConnected ? "Live updates connected" : "Live updates reconnecting"}</span>
          </div>
        </div>

        <header className="rfcd-hero">
          <div className="rfcd-hero-main">
            <span className="rfcd-eyebrow">Campaign performance</span>
            <div className="rfcd-title-row">
              <h1>{campaign.name || "Untitled campaign"}</h1>
              <StatusPill status={status} />
            </div>
            <div className="rfcd-hero-meta">
              <span><Calendar size={14} /> {campaign.createdAt ? `Started ${formatDate(campaign.createdAt)}` : "Start date unavailable"}</span>
              {(campaign.location || campaign.niche) ? (
                <span><MapPin size={14} /> {[campaign.location, campaign.niche, campaign.radiusKm && !isImported ? `${campaign.radiusKm} km` : ""].filter(Boolean).join(" · ")}</span>
              ) : null}
              <span><Mail size={14} /> {senderEmail || "No sender email linked"}</span>
              {voiceEnabled ? <span><Phone size={14} /> AI Voice enabled</span> : null}
            </div>
          </div>

          <div className="rfcd-hero-actions">
            <button type="button" className="rfcd-icon-btn" aria-label="Refresh campaign" title="Refresh campaign" disabled={refreshing} onClick={() => void load({ silent: true, successToast: true })}>
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            </button>
            {voiceEnabled ? <Link className="rfcd-btn rfcd-btn-secondary" to="/app/voice-agents"><Phone size={15} /> Voice Agent</Link> : null}
            <Link className="rfcd-btn rfcd-btn-primary" to={`/app/campaigns/${campaign.id}/pipeline`}><Workflow size={15} /> Edit Sequence</Link>
          </div>
        </header>

        {error ? <AnimatedMessage tone="error" icon={<X size={16} />} title="Campaign data needs attention" message={error} actionLabel="Retry" onAction={() => void load({ successToast: true })} /> : null}
        {campaign.error ? <AnimatedMessage tone="error" icon={<X size={16} />} title="Campaign processing failed" message={campaign.error} /> : null}
        {isComplete ? <AnimatedMessage tone="success" icon={<CheckCircle2 size={16} />} title="Campaign outreach completed" message="Review connected calls, follow-ups, meetings, assignments, and lead-level outcomes below." /> : null}
        {isDiscoveryRunning ? <ProgressMessage icon={<Globe2 size={16} />} title="Lead discovery is running live" message="The campaign updates automatically through backend events. You do not need to refresh." percent={Number(progress?.percent || 1)} /> : null}
        {isSending ? <ProgressMessage icon={<Send size={16} />} title="Campaign outreach is running" message={progress.message || (voiceEnabled ? "AI Voice and configured follow-up activity are being processed." : `Digital outreach is being processed from ${senderEmail || "the configured sender"}.`)} percent={Number(progress?.percent || 1)} /> : null}
        {isImportedReady ? <AnimatedMessage tone="info" icon={<Globe2 size={16} />} title="Imported lead list is ready" message="Review assignments and outreach readiness below, then open Edit Sequence when you need to adjust the digital workflow." /> : null}

        <section className="rfcd-kpis" aria-label="Campaign performance">
          <KpiCard label="Audience" value={formatNumber(metrics.audience)} note={isImported ? "Imported contacts" : campaign.niche || "Campaign leads"} />
          <KpiCard label="Attempted" value={formatMetric(metrics.attempted)} note={metrics.audience > 0 ? `${formatPercent((metrics.attempted / metrics.audience) * 100)}% of audience` : "No activity yet"} />
          <KpiCard label={metrics.primaryDeliveryLabel} value={formatMetric(metrics.connected)} note={metrics.attempted > 0 ? `${formatPercent((metrics.connected / metrics.attempted) * 100)}% rate` : "No activity yet"} />
          <KpiCard label="Replies" value={formatMetric(metrics.replies)} note={metrics.attempted > 0 ? `${formatPercent((metrics.replies / metrics.attempted) * 100)}% rate` : "No replies yet"} />
          <KpiCard label="Qualified" value={formatMetric(metrics.qualified)} note={metrics.replies > 0 ? `${formatPercent((metrics.qualified / metrics.replies) * 100)}% of replies` : "No qualified leads yet"} />
          <KpiCard label="Meetings" value={formatMetric(metrics.meetings)} note={metrics.qualified > 0 ? `${formatPercent((metrics.meetings / metrics.qualified) * 100)}% of qualified` : "No meetings yet"} highlight />
          <KpiCard label="Conversion" value={metrics.audience > 0 ? `${formatPercent(metrics.conversion)}%` : "—"} note="Overall" />
        </section>

        <section className="rfcd-overview-grid">
          <article className="rfcd-card rfcd-performance-card">
            <div className="rfcd-card-head">
              <div><span className="rfcd-eyebrow">Performance</span><h2>Performance Timeline</h2></div>
              <div className="rfcd-chart-legend">
                <LegendItem className="attempted" label="Attempted" />
                <LegendItem className="connected" label={metrics.primaryDeliveryLabel} />
                <LegendItem className="replies" label="Replies" />
              </div>
            </div>
            {timeline.hasData ? <PerformanceTimeline timeline={timeline} /> : <TimelineEmptyState campaign={campaign} metrics={metrics} />}
          </article>

          <aside className="rfcd-card rfcd-contacts-preview">
            <div className="rfcd-card-head compact">
              <div><span className="rfcd-eyebrow">Audience</span><h2>Campaign Contacts</h2></div>
              {leads.length ? <a href="#campaign-leads" className="rfcd-text-link">View All</a> : null}
            </div>
            {contactPreview.length ? (
              <div className="rfcd-contact-list">
                {contactPreview.map((lead, index) => (
                  <ContactPreviewRow key={getLeadKey(lead, index)} lead={lead} onClick={() => {
                    setExpandedLeadId(getLeadKey(lead, index));
                    window.setTimeout(() => document.getElementById("campaign-leads")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                  }} />
                ))}
              </div>
            ) : (
              <div className="rfcd-side-empty"><Users size={22} /><strong>No campaign contacts yet</strong><span>Contacts will appear as leads are discovered or imported.</span></div>
            )}
          </aside>
        </section>

        <section className="rfcd-activity-grid">
          {activityItems.length ? activityItems.slice(0, 4).map((item, index) => <ActivityCard key={`${item.type}-${item.at}-${index}`} item={item} index={index} />) : (
            <article className="rfcd-activity-empty"><Clock3 size={18} /><div><strong>Waiting for campaign activity</strong><span>Live call, reply, meeting, and assignment activity will appear here when the campaign records timestamps.</span></div></article>
          )}
        </section>

        <section className="rfcd-operational-grid">
          <OperationalCard icon={<Phone size={17} />} label="Phone ready" value={formatNumber(metrics.phoneReady)} note={`${formatNumber(metrics.phoneReady)} of ${formatNumber(metrics.audience)} leads have a phone number`} tone="primary" />
          <OperationalCard icon={<Users size={17} />} label="Assigned" value={formatNumber(metrics.assigned)} note="Leads distributed to callers" tone="violet" />
          <OperationalCard icon={<Clock3 size={17} />} label="Follow-ups" value={formatNumber(metrics.followUps)} note="Callback or follow-up outcomes" tone="warning" />
          <OperationalCard icon={<Zap size={17} />} label="Unanswered" value={formatNumber(metrics.unanswered)} note="No answer, busy, voicemail, or unanswered" tone="neutral" />
        </section>

        {voiceEnabled ? (
          <section className="rfcd-ai-callout">
            <span className="rfcd-ai-callout-icon"><Sparkles size={19} /></span>
            <div><span className="rfcd-eyebrow">AI Voice</span><strong>AI Voice is enabled for this campaign</strong><p>Voice Agent call state is authoritative. Use the Voice Agent workspace for live calls, transcripts, recordings, meetings, and call-level diagnostics. This page summarizes outcomes already attached to campaign leads.</p></div>
            <Link className="rfcd-btn rfcd-btn-secondary" to="/app/voice-agents">Open Voice Agents <ArrowRight size={14} /></Link>
          </section>
        ) : null}

        {campaign.leadMeta ? (
          <section className="rfcd-meta-grid">
            <CompactMetric label={isImported ? "Imported rows" : "Requested leads"} value={campaign.leadMeta.totalRows ?? campaign.leadMeta.requested ?? leads.length} />
            <CompactMetric label={isImported ? "Valid emails" : "Delivered"} value={campaign.leadMeta.validEmails ?? campaign.leadMeta.delivered ?? leads.length} />
            <CompactMetric label={isImported ? "Missing emails" : "Shortfall"} value={campaign.leadMeta.missingEmails ?? campaign.leadMeta.shortfall ?? 0} />
            <CompactMetric label="Replies" value={campaign.replies ?? metrics.replies} />
          </section>
        ) : null}

        {canAssign && leads.length > 0 && !isDiscoveryRunning ? (
          <section className="rfcd-tools">
            <div className="rfcd-section-heading"><div><span className="rfcd-eyebrow">Campaign operations</span><h2>Prepare and distribute campaign leads</h2><p>Attach website audits for better personalization, then distribute eligible leads to your calling team.</p></div></div>
            <CampaignAuditBatch campaign={campaign} onUpdated={load} />
            <CampaignTeamAssignment campaign={campaign} onAssigned={load} />
          </section>
        ) : null}

        {role === "manager" && !canAssign && leads.length > 0 && !isDiscoveryRunning ? (
          <AnimatedMessage tone="warning" icon={<Users size={16} />} title="Lead assignment permission required" message="Your manager account does not currently have the assign_leads permission. Assignment controls remain hidden until the workspace grants that permission." />
        ) : null}

        <section className="rfcd-leads-section" id="campaign-leads">
          <div className="rfcd-section-heading rfcd-lead-heading">
            <div><span className="rfcd-eyebrow">Campaign contacts</span><h2>{isImported ? "Imported lead list" : "Lead market"}</h2><p>{isImported ? "Campaign-ready records imported from your sheet and prepared for outreach." : "Campaign-ready lead records enriched for outreach and audit-based personalization."}</p></div>
            <div className="rfcd-lead-count"><strong>{formatNumber(visibleLeads.length)}</strong><span>{visibleLeads.length === leads.length ? "records" : `of ${formatNumber(leads.length)}`}</span></div>
          </div>

          {leads.length ? (
            <>
              <div className="rfcd-lead-toolbar">
                <label className="rfcd-search"><Search size={15} /><input value={leadQuery} onChange={(event) => setLeadQuery(event.target.value)} placeholder="Search campaign leads..." aria-label="Search campaign leads" />{leadQuery ? <button type="button" aria-label="Clear lead search" onClick={() => setLeadQuery("")}><X size={13} /></button> : null}</label>
                <label className="rfcd-outcome-filter"><span>Outcome</span><select value={leadOutcome} onChange={(event) => setLeadOutcome(event.target.value)}>{outcomeOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All outcomes" : leadStatusLabel(option)}</option>)}</select></label>
              </div>

              {visibleLeads.length ? (
                <div className="rfcd-lead-table-wrap">
                  <table className="rfcd-lead-table">
                    <thead><tr><th>Business</th><th>Contact</th><th>Outreach</th><th>Rating</th><th>Website</th><th>Outcome / next action</th><th>Assigned to</th><th>Source / Map</th></tr></thead>
                    <tbody>{visibleLeads.map((lead, index) => {
                      const key = getLeadKey(lead, index);
                      return <LeadRow key={key} lead={lead} campaign={campaign} voiceEnabled={voiceEnabled} senderEmail={senderEmail} expanded={expandedLeadId === key} onToggle={() => setExpandedLeadId((current) => current === key ? "" : key)} />;
                    })}</tbody>
                  </table>
                </div>
              ) : (
                <div className="rfcd-lead-empty"><Users size={22} /><strong>No leads match these filters</strong><span>Try another search or outcome filter.</span><button type="button" className="rfcd-btn rfcd-btn-secondary" onClick={() => { setLeadQuery(""); setLeadOutcome("all"); }}>Reset filters</button></div>
              )}
            </>
          ) : (
            <div className="rfcd-no-leads"><span><Globe2 size={24} /></span><h3>No leads found yet</h3><p>Try expanded depth, a broader niche, a nearby city, or import your own lead sheet.</p><div className="rfcd-no-lead-actions"><Link className="rfcd-btn rfcd-btn-secondary" to="/app/leads">Find Leads</Link><Link className="rfcd-btn rfcd-btn-primary" to="/app/campaigns/external-leads">Import leads <ArrowRight size={14} /></Link></div></div>
          )}
        </section>
      </div>
    </>
  );
}

function KpiCard({ label, value, note, highlight = false }) {
  return <article className={`rfcd-kpi ${highlight ? "highlight" : ""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function CompactMetric({ label, value }) {
  return <article className="rfcd-compact-metric"><strong>{formatNumber(value)}</strong><span>{label}</span></article>;
}

function OperationalCard({ icon, label, value, note, tone }) {
  return <article className={`rfcd-operational-card ${tone}`}><span className="rfcd-operational-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function StatusPill({ status }) {
  return <span className={`rfcd-status ${status.tone}`}>{status.pulse ? <i /> : null}{status.label}</span>;
}

function LegendItem({ className, label }) {
  return <span className="rfcd-legend-item"><i className={className} />{label}</span>;
}

function ContactPreviewRow({ lead, onClick }) {
  const name = getLeadBusinessName(lead);
  const outcome = getLeadOutcome(lead);
  return (
    <button type="button" className="rfcd-contact-preview-row" onClick={onClick}>
      <span className="rfcd-contact-avatar">{getInitials(name)}</span>
      <span className="rfcd-contact-preview-copy"><strong>{name}</strong><small>{lead.email || lead.phone || lead.location || lead.address || "Contact details unavailable"}</small></span>
      <span className={`rfcd-contact-status ${leadStatusTone(outcome)}`}>{leadStatusLabel(outcome)}</span>
    </button>
  );
}

function ActivityCard({ item, index }) {
  return <article className={`rfcd-activity-card ${item.tone}`} style={{ "--rfcd-activity-index": index }}><span className="rfcd-activity-icon">{item.icon}</span><div><strong>{item.title}</strong><span>{formatRelativeOrDate(item.at)}{item.location ? ` · ${item.location}` : ""}</span></div></article>;
}

function ProgressMessage({ icon, title, message, percent }) {
  const safe = clampPercent(percent);
  return <section className="rfcd-progress-message" role="status"><span className="rfcd-progress-icon">{icon}</span><div className="rfcd-progress-copy"><strong>{title}</strong><span>{message}</span><div className="rfcd-progress-track"><i style={{ width: `${Math.max(safe, safe > 0 ? 2 : 0)}%` }} /></div></div><strong className="rfcd-progress-percent">{formatPercent(safe)}%</strong></section>;
}

function AnimatedMessage({ tone, icon, title, message, actionLabel = "", onAction }) {
  return <section className={`rfcd-message ${tone}`} role={tone === "error" ? "alert" : "status"}><span className="rfcd-message-icon">{icon}</span><div><strong>{title}</strong><span>{message}</span></div>{actionLabel && onAction ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}</section>;
}

function PerformanceTimeline({ timeline }) {
  const { points, maxValue, labels } = timeline;
  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const x = (index) => CHART_PAD.left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotW);
  const y = (value) => CHART_PAD.top + (1 - Number(value || 0) / Math.max(maxValue, 1)) * plotH;
  const attempted = buildSmoothPath(points.map((point, index) => ({ x: x(index), y: y(point.attempted) })));
  const connected = buildSmoothPath(points.map((point, index) => ({ x: x(index), y: y(point.connected) })));
  const replies = buildSmoothPath(points.map((point, index) => ({ x: x(index), y: y(point.replies) })));
  const area = buildAreaPath(points.map((point, index) => ({ x: x(index), y: y(point.connected) })), CHART_PAD.top + plotH);
  const ticks = buildTicks(maxValue, 4);

  return (
    <div className="rfcd-chart-wrap">
      <svg className="rfcd-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Campaign performance timeline">
        <defs><linearGradient id="rfcd-connected-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7779ef" stopOpacity=".22" /><stop offset="100%" stopColor="#7779ef" stopOpacity=".02" /></linearGradient></defs>
        {ticks.map((tick) => { const yy = y(tick); return <g key={tick}><line x1={CHART_PAD.left} x2={CHART_W - CHART_PAD.right} y1={yy} y2={yy} className="rfcd-grid-line" /><text x={CHART_PAD.left - 10} y={yy + 4} textAnchor="end" className="rfcd-axis-label">{formatCompactNumber(tick)}</text></g>; })}
        {area ? <path d={area} fill="url(#rfcd-connected-area)" className="rfcd-area-path" /> : null}
        {attempted ? <path d={attempted} className="rfcd-line attempted" /> : null}
        {connected ? <path d={connected} className="rfcd-line connected" /> : null}
        {replies ? <path d={replies} className="rfcd-line replies" /> : null}
        {points.map((point, index) => (index === 0 || index === points.length - 1 || index % Math.max(1, Math.floor(points.length / 4)) === 0) ? <circle key={`reply-dot-${index}`} cx={x(index)} cy={y(point.replies)} r="3.4" className="rfcd-reply-dot" /> : null)}
        {labels.map((label, index) => <text key={`${label.text}-${index}`} x={x(label.index)} y={CHART_H - 8} textAnchor={label.anchor} className="rfcd-axis-label x">{label.text}</text>)}
      </svg>
    </div>
  );
}

function TimelineEmptyState({ campaign, metrics }) {
  const percent = clampPercent(campaign?.outreachProgress?.percent ?? campaign?.progress?.percent ?? (metrics.audience > 0 ? (metrics.attempted / metrics.audience) * 100 : 0));
  return <div className="rfcd-chart-empty"><span className="rfcd-chart-empty-icon"><TrendingUp size={21} /></span><div><strong>Timeline will appear as timestamped activity arrives</strong><span>ReachFly has campaign totals, but this campaign does not yet expose enough event timestamps to draw a truthful performance curve.</span></div><div className="rfcd-empty-progress"><span><i style={{ width: `${Math.max(percent, percent > 0 ? 3 : 0)}%` }} /></span><strong>{formatPercent(percent)}%</strong></div></div>;
}

function LeadRow({ lead, campaign, voiceEnabled, senderEmail, expanded, onToggle }) {
  const businessName = getLeadBusinessName(lead);
  const leadLocation = lead.address || lead.location || campaign.location || "";
  const mapsUrl = lead.mapsUrl || `https://www.google.com/search?q=${encodeURIComponent(`${businessName} ${leadLocation || ""}`)}`;
  const outcome = getLeadOutcome(lead);
  const nextAction = getNextActionAt(lead);
  const assigned = getAssignedUserName(lead);
  const tags = Array.isArray(lead?.tags) ? lead.tags : [];

  return (
    <>
      <tr className={`rfcd-lead-row ${expanded ? "expanded" : ""}`} onClick={onToggle}>
        <td><div className="rfcd-business-cell"><span className="rfcd-business-avatar">{getInitials(businessName)}</span><span><strong>{businessName}</strong><small>{leadLocation || "Location not available"}</small><em>{getLeadMatchScore(lead)}% match</em></span></div></td>
        <td><div className="rfcd-stack">{lead.phone ? <a href={`tel:${lead.phone}`} onClick={(event) => event.stopPropagation()}><Phone size={13} />{lead.phone}</a> : <span className="muted">Phone not listed</span>}{lead.email ? <a href={`mailto:${lead.email}`} onClick={(event) => event.stopPropagation()}><Mail size={13} />{lead.email}</a> : <span className="muted">Email not found</span>}</div></td>
        <td><div className="rfcd-stack">{voiceEnabled ? <span><Phone size={13} />AI Voice</span> : null}{senderEmail ? <span><Mail size={13} />Email</span> : null}{!voiceEnabled && !senderEmail ? <span className="muted">No channel</span> : null}</div></td>
        <td>{lead.rating ? <span className="rfcd-rating"><Star size={13} />{Number(lead.rating).toFixed(1)} <small>({lead.reviews || 0})</small></span> : "—"}</td>
        <td>{lead.website ? <a className="rfcd-website-link" href={normalizeWebsiteUrl(lead.website)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Globe2 size={13} />Visit</a> : <span className="rfcd-opportunity">Website opportunity</span>}</td>
        <td><div className="rfcd-stack"><span className={`rfcd-lead-status ${leadStatusTone(outcome)}`}>{leadStatusLabel(outcome)}</span>{nextAction ? <small>Next: {formatDateTime(nextAction)}</small> : null}</div></td>
        <td>{assigned ? <div className="rfcd-assignee-cell"><span>{getInitials(assigned)}</span><div><strong>{assigned}</strong><small>{Number(lead.callAttempts ?? lead.attempts ?? lead.voiceCallAttempts ?? 0)} attempts</small></div></div> : <span className="muted">Unassigned</span>}</td>
        <td><a className="rfcd-map-link" href={mapsUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><ExternalLink size={13} />Open</a><small className="rfcd-source-small">{lead.source || "ReachFly source"}</small></td>
      </tr>
      {expanded ? (
        <tr className="rfcd-lead-expanded-row"><td colSpan={8}><div className="rfcd-lead-expanded">
          <div className="rfcd-expanded-block signals"><span>Lead signals</span><Signal label="Quality" value={`${getLeadMatchScore(lead)}%`} /><Signal label="Outcome" value={leadStatusLabel(outcome)} /><Signal label="Assigned" value={assigned || "Unassigned"} /><Signal label="Next action" value={nextAction ? formatDateTime(nextAction) : "None scheduled"} /></div>
          <div className="rfcd-expanded-block"><span>Tags</span><div className="rfcd-tags">{tags.length ? tags.slice(0, 8).map((tag) => <span key={tag}>{tag}</span>) : <span className="muted">No tags attached</span>}</div></div>
          <div className="rfcd-expanded-block"><span>Quick actions</span><div className="rfcd-expanded-actions">{lead.phone ? <a href={`tel:${lead.phone}`}><Phone size={13} />Call</a> : null}{lead.email ? <a href={`mailto:${lead.email}`}><Mail size={13} />Email</a> : null}{lead.website ? <a href={normalizeWebsiteUrl(lead.website)} target="_blank" rel="noreferrer"><Globe2 size={13} />Website</a> : null}<a href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={13} />Map</a></div></div>
        </div></td></tr>
      ) : null}
    </>
  );
}

function Signal({ label, value }) {
  return <span className="rfcd-signal"><small>{label}</small><strong>{value}</strong></span>;
}

function CampaignDetailSkeleton() {
  return <div className="rf-campaign-detail-v7" aria-busy="true" aria-label="Loading campaign"><div className="rfcd-skeleton-back" /><div className="rfcd-skeleton-hero"><div><i className="wide" /><i /><i /></div><div><i /><i /></div></div><div className="rfcd-skeleton-kpis">{Array.from({ length: 7 }).map((_, index) => <i key={index} />)}</div><div className="rfcd-skeleton-main"><i /><i /></div><div className="rfcd-skeleton-rows">{Array.from({ length: 5 }).map((_, index) => <i key={index} />)}</div></div>;
}

function buildCampaignMetrics(campaign, leads) {
  const audience = firstFiniteNumber(
    campaign?.audienceCount,
    campaign?.audience,
    campaign?.leadCount,
    campaign?.totalLeads,
    campaign?.leadMeta?.totalRows,
    campaign?.leadMeta?.requested,
    campaign?.progress?.total,
    leads.length
  );

  const attemptedDerived = leads.filter((lead) => Boolean(
    lead.emailSentAt ||
    lead.sentAt ||
    lead.callStartedAt ||
    lead.lastCallAt ||
    lead.aiCall ||
    lead.lastCall ||
    lead.latestCall ||
    lead.callStatus
  )).length;

  const attempted = firstFiniteNumber(
    campaign?.attempted,
    campaign?.attemptedCount,
    campaign?.sent,
    campaign?.sentCount,
    campaign?.dialed,
    campaign?.dialedCount,
    campaign?.outreachProgress?.sent,
    campaign?.outreachProgress?.processed,
    campaign?.progress?.processed,
    attemptedDerived
  );

  const emailDominant = getPrimaryChannel(campaign) === "email";
  const connectedDerived = leads.filter((lead) => {
    if (emailDominant) return Boolean(lead.openedAt || lead.emailOpenedAt || lead.lastOpenedAt);
    return ["connected", "qualified", "interested", "meeting_booked"].includes(getLeadOutcome(lead));
  }).length;

  const connected = firstFiniteNumber(
    campaign?.connected,
    campaign?.connectedCount,
    campaign?.openCount,
    campaign?.opened,
    campaign?.openedCount,
    campaign?.outreachProgress?.connected,
    campaign?.outreachProgress?.opened,
    connectedDerived
  );

  const repliesDerived = leads.filter((lead) => Boolean(
    lead.repliedAt ||
    lead.replyAt ||
    lead.responseAt ||
    lead.hasReplied ||
    lead.reply ||
    ["replied", "interested", "qualified", "meeting_booked"].includes(getLeadOutcome(lead))
  )).length;

  const replies = firstFiniteNumber(
    campaign?.replies,
    campaign?.replyCount,
    campaign?.outreachProgress?.replies,
    repliesDerived
  );

  const qualified = leads.filter((lead) => ["qualified", "interested", "meeting_booked"].includes(getLeadOutcome(lead))).length;
  const meetings = leads.filter((lead) => getLeadOutcome(lead) === "meeting_booked" || Boolean(lead.meetingId || lead.meeting?.id || lead.meetingBookedAt)).length;
  const phoneReady = leads.filter((lead) => Boolean(lead?.phone)).length;
  const assigned = getAssignedLeadCount(campaign);
  const followUps = leads.filter((lead) => ["callback", "follow_up", "call_due", "send_information"].includes(getLeadOutcome(lead))).length;
  const unanswered = leads.filter((lead) => ["no_answer", "busy", "voicemail", "unanswered"].includes(getLeadOutcome(lead))).length;
  const conversion = audience > 0 ? (meetings / audience) * 100 : 0;

  return {
    audience,
    attempted,
    connected,
    replies,
    qualified,
    meetings,
    phoneReady,
    assigned,
    followUps,
    unanswered,
    conversion,
    primaryDeliveryLabel: emailDominant ? "Opened" : "Connected",
  };
}

function buildTimelineSeries(leads) {
  const events = [];

  leads.forEach((lead, index) => {
    const outcome = getLeadOutcome(lead);
    const attemptedAt = firstDate(
      lead.emailSentAt,
      lead.sentAt,
      lead.callStartedAt,
      lead.lastCallAt,
      lead.aiCall?.startedAt,
      lead.lastCall?.startedAt,
      lead.latestCall?.startedAt
    );
    if (attemptedAt) events.push({ type: "attempted", at: attemptedAt, index });

    const connectedAt = firstDate(
      lead.connectedAt,
      lead.callConnectedAt,
      lead.answeredAt,
      lead.openedAt,
      lead.emailOpenedAt,
      lead.lastOpenedAt,
      ["connected", "qualified", "interested", "meeting_booked"].includes(outcome)
        ? (lead.lastCallAt || lead.callStartedAt || lead.updatedAt)
        : ""
    );
    if (connectedAt) events.push({ type: "connected", at: connectedAt, index });

    const repliedAt = firstDate(
      lead.repliedAt,
      lead.replyAt,
      lead.responseAt,
      ["replied", "interested", "qualified", "meeting_booked"].includes(outcome)
        ? (lead.updatedAt || lead.lastActivityAt)
        : ""
    );
    if (repliedAt) events.push({ type: "replies", at: repliedAt, index });
  });

  const sorted = events
    .filter((item) => item.at instanceof Date && !Number.isNaN(item.at.getTime()))
    .sort((a, b) => a.at - b.at);

  if (sorted.length < 2 || sorted[0].at.getTime() === sorted[sorted.length - 1].at.getTime()) {
    return { hasData: false, points: [], maxValue: 0, labels: [] };
  }

  const minTime = sorted[0].at.getTime();
  const maxTime = sorted[sorted.length - 1].at.getTime();
  const bucketCount = Math.min(10, Math.max(5, Math.ceil(sorted.length / 5)));
  const bucketSize = (maxTime - minTime) / (bucketCount - 1);
  const points = [];
  let attempted = 0;
  let connected = 0;
  let replies = 0;
  let pointer = 0;

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const time = bucket === bucketCount - 1 ? maxTime : minTime + bucket * bucketSize;
    while (pointer < sorted.length && sorted[pointer].at.getTime() <= time) {
      if (sorted[pointer].type === "attempted") attempted += 1;
      if (sorted[pointer].type === "connected") connected += 1;
      if (sorted[pointer].type === "replies") replies += 1;
      pointer += 1;
    }
    points.push({ at: new Date(time), attempted, connected, replies });
  }

  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.attempted, point.connected, point.replies)));
  const labelIndexes = uniqueNumbers([
    0,
    Math.floor((points.length - 1) / 3),
    Math.floor(((points.length - 1) * 2) / 3),
    points.length - 1,
  ]);
  const labels = labelIndexes.map((index, labelIndex) => ({
    index,
    text: formatChartDate(points[index].at, minTime, maxTime),
    anchor: labelIndex === 0 ? "start" : labelIndex === labelIndexes.length - 1 ? "end" : "middle",
  }));

  return { hasData: true, points, maxValue, labels };
}

function buildActivityItems(campaign, leads) {
  const items = [];

  leads.forEach((lead) => {
    const name = getLeadBusinessName(lead);
    const location = lead.location || lead.address || campaign?.location || "";
    const meetingAt = firstDate(lead.meetingBookedAt, lead.meeting?.createdAt, lead.meeting?.startAt);
    const replyAt = firstDate(lead.repliedAt, lead.replyAt, lead.responseAt);
    const connectedAt = firstDate(lead.connectedAt, lead.callConnectedAt, lead.answeredAt);
    const assignedAt = firstDate(lead.assignedAt, lead.assignment?.createdAt);

    if (meetingAt) items.push({ type: "meeting", tone: "success", at: meetingAt, location, title: `Meeting booked with ${name}`, icon: <Calendar size={17} /> });
    if (replyAt) items.push({ type: "reply", tone: "primary", at: replyAt, location, title: `${name} replied`, icon: <Mail size={17} /> });
    if (connectedAt) items.push({ type: "connected", tone: "violet", at: connectedAt, location, title: `Connected with ${name}`, icon: <Phone size={17} /> });
    if (assignedAt && getAssignedUserName(lead)) items.push({ type: "assignment", tone: "neutral", at: assignedAt, location, title: `${name} assigned to ${getAssignedUserName(lead)}`, icon: <Users size={17} /> });
  });

  return items
    .filter((item) => item.at instanceof Date && !Number.isNaN(item.at.getTime()))
    .sort((a, b) => b.at - a.at);
}

function getCampaignStatus(campaign, isImported) {
  if (!campaign) return { label: "Campaign", tone: "neutral", pulse: false };
  const pipeline = normalizeStatus(campaign.pipelineStatus);
  const status = normalizeStatus(campaign.status);

  if (["running", "discovering"].includes(pipeline)) return { label: pipeline === "discovering" ? "Discovering" : "Active", tone: "success", pulse: true };
  if (pipeline === "complete" || ["history", "complete", "completed"].includes(status)) return { label: "Complete", tone: "complete", pulse: false };
  if (pipeline === "failed" || status === "failed") return { label: "Failed", tone: "danger", pulse: false };
  if (status === "queued") return { label: "Queued", tone: "queued", pulse: false };
  if (["paused", "stopped"].includes(status)) return { label: "Paused", tone: "paused", pulse: false };
  if (isImported) return { label: "Imported", tone: "primary", pulse: false };
  return { label: titleCase(status || "Active"), tone: status === "active" ? "success" : "neutral", pulse: status === "active" };
}

function getPrimaryChannel(campaign) {
  if (isAiVoiceEnabled(campaign) && !getSenderEmail(campaign)) return "voice";
  if (getSenderEmail(campaign) && !isAiVoiceEnabled(campaign)) return "email";
  if (campaign?.outreachPlan?.email) return "email";
  return "voice";
}

function getAssignedUserName(lead = {}) {
  return lead.assignedToName || lead.assigneeName || lead.assignedUserName || lead.assignee?.name || lead.assignedUser?.name || "";
}

function getAssignedLeadCount(campaign) {
  const leads = Array.isArray(campaign?.leads) ? campaign.leads : [];
  return leads.filter((lead) => Boolean(lead?.assignedTo || lead?.assigneeId || lead?.assignedUserId || lead?.assignmentId)).length;
}

function isAiVoiceEnabled(campaign) {
  return Boolean(
    campaign?.outreachPlan?.aiVoice ||
    campaign?.aiVoiceEnabled ||
    campaign?.voiceEnabled ||
    campaign?.voiceCampaignEnabled ||
    campaign?.channels?.includes?.("ai_voice")
  );
}

function getLeadOutcome(lead = {}) {
  return normalizeStatus(
    lead.lastCallOutcome ||
    lead.callOutcome ||
    lead.outcome ||
    lead.disposition ||
    lead.lastDisposition ||
    lead.voiceOutcome ||
    lead.aiCall?.outcome ||
    lead.lastCall?.outcome ||
    lead.latestCall?.outcome ||
    lead.status ||
    "new"
  ) || "new";
}

function getNextActionAt(lead = {}) {
  return lead.nextActionAt || lead.followUpAt || lead.callbackAt || lead.scheduledAt || lead.task?.dueAt || lead.task?.dueDate || lead.lead?.nextActionAt || "";
}

function getSenderEmail(campaign) {
  return campaign?.senderEmail || campaign?.fromEmail || campaign?.replyToEmail || campaign?.ownerEmail || "";
}

function getBackTarget(campaign) {
  if (!campaign) return "/app/campaigns";
  const pipeline = normalizeStatus(campaign.pipelineStatus);
  const status = normalizeStatus(campaign.status);
  if (pipeline === "running" || status === "active") return "/app/campaigns/active";
  if (status === "queued") return "/app/campaigns/queued";
  if (pipeline === "complete" || pipeline === "failed" || ["history", "complete", "completed"].includes(status)) return "/app/campaigns/history";
  return "/app/campaigns";
}

function getLeadBusinessName(lead) {
  return lead?.business || lead?.name || lead?.companyName || "Unknown lead";
}

function getLeadKey(lead, index) {
  return String(lead?.id || lead?.placeId || lead?.externalId || `${getLeadBusinessName(lead)}-${index}`);
}

function getLeadMatchScore(lead) {
  const value = Number(lead?.confidence ?? lead?.qualityScore ?? lead?.matchScore ?? 100);
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeWebsiteUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function leadStatusLabel(value) {
  return titleCase(value || "new");
}

function leadStatusTone(value) {
  const status = normalizeStatus(value);
  if (["qualified", "meeting_booked", "connected", "interested", "replied", "won"].includes(status)) return "success";
  if (["callback", "follow_up", "send_information", "call_due", "queued"].includes(status)) return "warning";
  if (["not_interested", "wrong_number", "invalid_number", "do_not_call", "do_not_contact", "bounced", "failed"].includes(status)) return "danger";
  if (["no_answer", "busy", "voicemail", "unanswered"].includes(status)) return "neutral";
  return "primary";
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return 0;
}

function firstDate(...values) {
  for (const value of values) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function buildSmoothPath(points) {
  if (!Array.isArray(points) || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpointX = (previous.x + current.x) / 2;
    path += ` C ${midpointX} ${previous.y}, ${midpointX} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

function buildAreaPath(points, baseline) {
  const line = buildSmoothPath(points);
  if (!line || !points.length) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

function buildTicks(maxValue, count) {
  const safeMax = Math.max(1, Number(maxValue || 1));
  const rawStep = safeMax / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice = normalized > 5 ? 10 : normalized > 2 ? 5 : normalized > 1 ? 2 : 1;
  const step = nice * magnitude;
  const ceiling = Math.ceil(safeMax / step) * step;
  const ticks = [];
  for (let value = 0; value <= ceiling; value += step) ticks.push(value);
  return ticks.slice(0, 6);
}

function uniqueNumbers(values) {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value >= 0))).sort((a, b) => a - b);
}

function formatChartDate(date, minTime, maxTime) {
  if (maxTime - minTime < 2 * 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function formatDate(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeOrDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const delta = Date.now() - date.getTime();
  if (delta >= 0 && delta < 60 * 1000) return "Just now";
  if (delta >= 0 && delta < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.floor(delta / (60 * 1000)));
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  if (delta >= 0 && delta < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(delta / (60 * 60 * 1000)));
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  return formatDate(date);
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat().format(Math.round(number)) : "0";
}

function formatCompactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  if (Math.abs(number) < 1000) return formatNumber(number);
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

function formatMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? formatNumber(number) : "—";
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "0.0";
}

function clampPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function getInitials(value) {
  return String(value || "RF").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function normalizeWorkspaceRole(value) {
  const role = normalizeStatus(value);
  if (role.includes("owner")) return "owner";
  if (role.includes("admin")) return "admin";
  if (role.includes("manager")) return "manager";
  if (role === "caller" || role.includes("cold_caller") || role.includes("sales_representative") || role.includes("sales_rep") || role.includes("telemarketer")) return "caller";
  return role || "caller";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function maybeToastEvent(parsed, ref) {
  const type = String(parsed?.type || "");
  let payload = null;

  if (type === "pipeline_complete" || type === "complete") {
    payload = { type: "success", title: "Campaign outreach complete", message: "The latest campaign outcomes are now available." };
  } else if (type === "meeting_booked") {
    payload = { type: "success", title: "Meeting booked", message: parsed?.lead?.business || parsed?.campaign?.name || "A campaign lead booked a meeting." };
  } else if (type === "error" || parsed?.campaign?.pipelineStatus === "failed") {
    payload = { type: "error", title: "Campaign processing failed", message: parsed?.message || parsed?.campaign?.error || "The campaign reported a processing failure." };
  }

  if (!payload) return;
  const now = Date.now();
  const key = `${type}|${payload.title}|${payload.message}`;
  if (ref.current.key === key && now - ref.current.at < 5000) return;
  ref.current = { key, at: now };
  notify(payload.type, payload.title, payload.message);
}

function notify(type, title, message) {
  if (typeof window === "undefined") return;
  const bridge = window.reachflyToast;
  if (bridge && typeof bridge[type] === "function") {
    bridge[type](title, message);
    return;
  }
  window.dispatchEvent(new CustomEvent("reachfly:toast", { detail: { type, title, message } }));
}

function CampaignDetailStyles() {
  return (
    <style>{`
      .rf-campaign-detail-v7{
        --c-bg:#f8f9fa;--c-card:#fff;--c-soft:#f3f4f5;--c-high:#eceeef;
        --c-text:#191c1d;--c-text2:#4b4a59;--c-muted:#797887;--c-line:#e5e7eb;
        --c-primary:#4648d4;--c-primary2:#3537bb;--c-primary-soft:#eeeeff;
        --c-violet:#6b38d4;--c-violet-soft:#f3eeff;--c-success:#05875d;
        --c-success-soft:#e9f8f2;--c-warning:#8a6100;--c-warning-soft:#fff5d8;
        --c-danger:#ba1a1a;--c-danger-soft:#ffedeb;--c-info:#4263d6;--c-info-soft:#edf2ff;
        --c-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;min-height:100%;padding:18px 32px 44px;color:var(--c-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfcdPageIn 280ms var(--c-ease)
      }
      .rf-campaign-detail-v7 *,.rf-campaign-detail-v7 *:before,.rf-campaign-detail-v7 *:after{box-sizing:border-box}
      .rf-campaign-detail-v7 a{color:inherit}.rf-campaign-detail-v7 .spin{animation:rfcdSpin .8s linear infinite}
      @keyframes rfcdPageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      @keyframes rfcdFadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
      @keyframes rfcdPulse{50%{opacity:.45;transform:scale(.78)}}
      @keyframes rfcdSpin{to{transform:rotate(360deg)}}
      @keyframes rfcdShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
      @keyframes rfcdDraw{from{stroke-dashoffset:1200}to{stroke-dashoffset:0}}
      @keyframes rfcdAreaIn{from{opacity:0}to{opacity:1}}
      @keyframes rfcdProgress{from{transform:scaleX(0)}to{transform:scaleX(1)}}

      .rfcd-topline{min-height:34px;display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:9px}
      .rfcd-back{display:inline-flex;align-items:center;gap:6px;color:var(--c-text2)!important;text-decoration:none;font-size:11px;font-weight:650;transition:.14s var(--c-ease)}
      .rfcd-back:hover{color:var(--c-primary)!important;transform:translateX(-1px)}
      .rfcd-live-state{display:flex;align-items:center;gap:6px;color:var(--c-muted);font-size:9px}.rfcd-live-dot{width:7px;height:7px;border-radius:50%;background:#aaa}
      .rfcd-live-dot.connected{background:var(--c-success);box-shadow:0 0 0 4px rgba(5,135,93,.09);animation:rfcdPulse 1.8s ease-in-out infinite}

      .rfcd-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:26px;padding:4px 0 22px}.rfcd-hero-main{min-width:0;flex:1}
      .rfcd-eyebrow{display:block;margin-bottom:4px;color:var(--c-primary);font-size:9px;font-weight:750;line-height:14px;letter-spacing:.09em;text-transform:uppercase}
      .rfcd-title-row{display:flex;align-items:center;gap:12px;min-width:0}.rfcd-title-row h1,.rfcd-access h1,.rfcd-fatal h1{margin:0;color:var(--c-text);font:600 26px/34px Geist,Inter,sans-serif;letter-spacing:-.018em}
      .rfcd-hero-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:7px}.rfcd-hero-meta span{display:inline-flex;align-items:center;gap:5px;color:var(--c-text2);font-size:10px;line-height:15px}
      .rfcd-hero-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-top:20px}

      .rfcd-btn{appearance:none;min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:8px 13px;border:1px solid transparent;border-radius:8px;text-decoration:none;white-space:nowrap;cursor:pointer;font:600 11px/17px Inter,sans-serif;transition:.15s var(--c-ease)}
      .rfcd-btn:hover:not(:disabled){transform:translateY(-1px)}.rfcd-btn:active:not(:disabled){transform:scale(.985)}
      .rfcd-btn-primary{color:#fff!important;background:var(--c-primary);border-color:var(--c-primary);box-shadow:0 5px 14px rgba(70,72,212,.18)}.rfcd-btn-primary:hover{background:var(--c-primary2)}
      .rfcd-btn-secondary{color:var(--c-text)!important;background:#fff;border-color:var(--c-line)}.rfcd-btn-secondary:hover{color:var(--c-primary)!important;background:var(--c-primary-soft);border-color:rgba(70,72,212,.22)}
      .rfcd-icon-btn{width:39px;height:39px;display:grid;place-items:center;padding:0;color:var(--c-text2);background:#fff;border:1px solid var(--c-line);border-radius:8px;cursor:pointer;transition:.15s var(--c-ease)}
      .rfcd-icon-btn:hover:not(:disabled){color:var(--c-primary);background:var(--c-primary-soft);transform:translateY(-1px)}.rfcd-icon-btn:disabled{opacity:.55;cursor:not-allowed}

      .rfcd-status{min-height:25px;display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:650}.rfcd-status i{width:6px;height:6px;border-radius:50%;background:currentColor;animation:rfcdPulse 1.8s ease-in-out infinite}
      .rfcd-status.success,.rfcd-status.primary{color:var(--c-primary);background:var(--c-primary-soft)}.rfcd-status.complete{color:var(--c-success);background:var(--c-success-soft)}.rfcd-status.danger{color:var(--c-danger);background:var(--c-danger-soft)}.rfcd-status.queued{color:var(--c-warning);background:var(--c-warning-soft)}.rfcd-status.paused,.rfcd-status.neutral{color:#596173;background:#eef1f5}

      .rfcd-message,.rfcd-progress-message{display:flex;align-items:flex-start;gap:10px;padding:11px 13px;margin-bottom:13px;border:1px solid;border-radius:10px;animation:rfcdFadeUp .22s var(--c-ease)}
      .rfcd-message.error{color:#7c1616;background:var(--c-danger-soft);border-color:#ffd1cd}.rfcd-message.success{color:#075f45;background:var(--c-success-soft);border-color:#c7ecdf}.rfcd-message.warning{color:#705000;background:var(--c-warning-soft);border-color:#f0d995}.rfcd-message.info,.rfcd-progress-message{color:#364f9f;background:var(--c-info-soft);border-color:#ced9ff}
      .rfcd-message-icon,.rfcd-progress-icon{width:29px;height:29px;display:grid;place-items:center;flex:0 0 29px;background:rgba(255,255,255,.72);border-radius:8px}.rfcd-message>div,.rfcd-progress-copy{min-width:0;flex:1;display:grid;gap:2px}.rfcd-message strong,.rfcd-progress-copy strong{font-size:11px;line-height:15px}.rfcd-message span,.rfcd-progress-copy>span{font-size:10px;line-height:15px}
      .rfcd-message>button{align-self:center;padding:5px 8px;color:inherit;background:rgba(255,255,255,.72);border:0;border-radius:6px;cursor:pointer;font-size:9px;font-weight:700}
      .rfcd-progress-track{height:4px;overflow:hidden;margin-top:5px;background:rgba(66,99,214,.12);border-radius:999px}.rfcd-progress-track i{display:block;height:100%;background:linear-gradient(90deg,var(--c-primary),#7779ef);border-radius:999px;transform-origin:left;animation:rfcdProgress .38s var(--c-ease)}.rfcd-progress-percent{align-self:center;color:var(--c-primary);font-size:10px}

      .rfcd-kpis{display:grid;grid-template-columns:repeat(7,minmax(132px,1fr));gap:14px;margin:6px 0 28px;overflow-x:auto;padding-bottom:2px}.rfcd-kpi{position:relative;min-height:118px;display:flex;flex-direction:column;justify-content:space-between;gap:9px;overflow:hidden;padding:17px 16px;background:var(--c-high);border:1px solid transparent;border-radius:11px;animation:rfcdFadeUp .3s var(--c-ease) both}.rfcd-kpi:after{content:"";position:absolute;top:-30px;right:-24px;width:84px;height:84px;background:rgba(255,255,255,.34);border-radius:50%}.rfcd-kpi.highlight{color:var(--c-primary);background:#e6e7ff}.rfcd-kpi>span,.rfcd-kpi>strong,.rfcd-kpi>small{position:relative;z-index:1;color:inherit}.rfcd-kpi>span{font-size:10px;font-weight:650;letter-spacing:.09em;text-transform:uppercase}.rfcd-kpi>strong{font:500 21px/27px Geist,Inter,sans-serif}.rfcd-kpi>small{opacity:.82;font-size:9px;line-height:13px}

      .rfcd-overview-grid{display:grid;grid-template-columns:minmax(0,1fr) 312px;gap:28px;margin-bottom:16px}.rfcd-card{background:#fff;border:1px solid var(--c-line);border-radius:16px;box-shadow:0 1px 2px rgba(25,28,29,.03)}.rfcd-performance-card{min-width:0;padding:24px 24px 16px}.rfcd-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}.rfcd-card-head.compact{padding:20px 22px 13px;margin:0;border-bottom:1px solid var(--c-line)}.rfcd-card-head h2,.rfcd-section-heading h2{margin:0;color:var(--c-text);font:600 15px/21px Geist,Inter,sans-serif}
      .rfcd-chart-legend{display:flex;flex-wrap:wrap;gap:14px}.rfcd-legend-item{display:inline-flex;align-items:center;gap:5px;color:var(--c-text2);font-size:9px}.rfcd-legend-item i{width:9px;height:9px;border-radius:2px}.rfcd-legend-item i.attempted{background:#c8c7d8}.rfcd-legend-item i.connected{background:#9b9cec}.rfcd-legend-item i.replies{background:var(--c-primary)}
      .rfcd-chart-wrap{width:100%;min-height:300px}.rfcd-chart{width:100%;height:auto;display:block;overflow:visible}.rfcd-grid-line{stroke:#e8e9ed;stroke-width:1;stroke-dasharray:3 4}.rfcd-axis-label{fill:#797887;font:9px Inter,sans-serif}.rfcd-axis-label.x{font-size:8px}.rfcd-line{fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1200;stroke-dashoffset:1200;animation:rfcdDraw .9s var(--c-ease) forwards}.rfcd-line.attempted{stroke:#bab9ca}.rfcd-line.connected{stroke:#8d8fe8;animation-delay:.09s}.rfcd-line.replies{stroke:var(--c-primary);stroke-width:2.8;animation-delay:.16s}.rfcd-area-path{opacity:0;animation:rfcdAreaIn .5s .18s var(--c-ease) forwards}.rfcd-reply-dot{fill:#fff;stroke:var(--c-primary);stroke-width:1.8}
      .rfcd-chart-empty{min-height:300px;display:grid;grid-template-columns:auto minmax(0,1fr);align-content:center;align-items:center;gap:12px;padding:30px 36px;background:linear-gradient(180deg,#fff,#fbfbfe);border:1px dashed var(--c-line);border-radius:12px}.rfcd-chart-empty-icon{width:42px;height:42px;display:grid;place-items:center;color:var(--c-primary);background:var(--c-primary-soft);border-radius:12px}.rfcd-chart-empty>div:nth-child(2){display:grid;gap:3px}.rfcd-chart-empty strong{color:var(--c-text);font-size:11px}.rfcd-chart-empty span{color:var(--c-text2);font-size:10px;line-height:15px}.rfcd-empty-progress{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;margin-top:8px}.rfcd-empty-progress>span{height:6px;overflow:hidden;background:#ececf4;border-radius:999px}.rfcd-empty-progress i{display:block;height:100%;background:var(--c-primary);border-radius:999px;transform-origin:left;animation:rfcdProgress .5s var(--c-ease)}.rfcd-empty-progress>strong{color:var(--c-primary);font-size:10px}

      .rfcd-contacts-preview{min-width:0;overflow:hidden}.rfcd-text-link{color:var(--c-primary)!important;text-decoration:none;font-size:10px;font-weight:650}.rfcd-contact-list{display:grid}.rfcd-contact-preview-row{width:100%;min-height:68px;display:flex;align-items:center;gap:9px;padding:10px 18px;color:inherit;background:#fff;border:0;border-top:1px solid #f0f1f3;text-align:left;cursor:pointer;transition:.14s var(--c-ease)}.rfcd-contact-preview-row:first-child{border-top:0}.rfcd-contact-preview-row:hover{background:#fafafd;transform:translateX(1px)}.rfcd-contact-avatar{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;color:#4b4a59;background:#eceeef;border-radius:50%;font-size:9px;font-weight:700}.rfcd-contact-preview-copy{min-width:0;flex:1;display:grid;gap:1px}.rfcd-contact-preview-copy strong,.rfcd-contact-preview-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rfcd-contact-preview-copy strong{color:var(--c-text);font-size:10px}.rfcd-contact-preview-copy small{color:var(--c-text2);font-size:8px}
      .rfcd-contact-status,.rfcd-lead-status{min-height:20px;display:inline-flex;align-items:center;padding:3px 6px;border-radius:4px;font-size:7px;font-weight:700;line-height:10px;letter-spacing:.04em;text-transform:uppercase}.rfcd-contact-status{max-width:82px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rfcd-contact-status.success,.rfcd-lead-status.success{color:var(--c-success);background:var(--c-success-soft)}.rfcd-contact-status.warning,.rfcd-lead-status.warning{color:var(--c-warning);background:var(--c-warning-soft)}.rfcd-contact-status.danger,.rfcd-lead-status.danger{color:var(--c-danger);background:var(--c-danger-soft)}.rfcd-contact-status.neutral,.rfcd-lead-status.neutral{color:#5d6474;background:#eef1f5}.rfcd-contact-status.primary,.rfcd-lead-status.primary{color:var(--c-primary);background:var(--c-primary-soft)}.rfcd-side-empty{min-height:300px;display:grid;place-items:center;align-content:center;gap:5px;padding:24px;color:var(--c-muted);text-align:center}.rfcd-side-empty strong{color:var(--c-text);font-size:10px}.rfcd-side-empty span{max-width:210px;font-size:9px;line-height:14px}

      .rfcd-activity-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:0 0 20px}.rfcd-activity-card,.rfcd-activity-empty{min-height:92px;display:flex;align-items:flex-start;gap:11px;padding:18px 20px;background:#fff;border:1px solid var(--c-line);border-radius:13px;animation:rfcdFadeUp .26s var(--c-ease) both;animation-delay:calc(var(--rfcd-activity-index) * 45ms)}.rfcd-activity-card>div,.rfcd-activity-empty>div{min-width:0;display:grid;gap:3px}.rfcd-activity-card strong,.rfcd-activity-empty strong{color:var(--c-text);font-size:10px}.rfcd-activity-card span,.rfcd-activity-empty span{color:var(--c-text2);font-size:9px;line-height:14px}.rfcd-activity-icon{width:32px;height:32px;display:grid;place-items:center;flex:0 0 32px;color:var(--c-primary);background:var(--c-primary-soft);border-radius:50%}.rfcd-activity-card.success .rfcd-activity-icon{color:var(--c-success);background:var(--c-success-soft)}.rfcd-activity-card.violet .rfcd-activity-icon{color:var(--c-violet);background:var(--c-violet-soft)}.rfcd-activity-card.neutral .rfcd-activity-icon{color:#5a6171;background:#eef1f5}.rfcd-activity-empty{grid-column:1/-1;min-height:80px;align-items:center;color:var(--c-muted);border-style:dashed}

      .rfcd-operational-grid,.rfcd-meta-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}.rfcd-operational-card{display:flex;align-items:flex-start;gap:11px;padding:15px 16px;background:#fff;border:1px solid var(--c-line);border-radius:12px}.rfcd-operational-icon{width:32px;height:32px;display:grid;place-items:center;flex:0 0 32px;color:var(--c-primary);background:var(--c-primary-soft);border-radius:9px}.rfcd-operational-card.violet .rfcd-operational-icon{color:var(--c-violet);background:var(--c-violet-soft)}.rfcd-operational-card.warning .rfcd-operational-icon{color:var(--c-warning);background:var(--c-warning-soft)}.rfcd-operational-card.neutral .rfcd-operational-icon{color:#5d6474;background:#eef1f5}.rfcd-operational-card>div{min-width:0;flex:1;display:grid;gap:1px}.rfcd-operational-card>div>span{color:var(--c-muted);font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.rfcd-operational-card>div>strong{color:var(--c-text);font:600 19px/24px Geist,Inter,sans-serif}.rfcd-operational-card>div>small{color:var(--c-text2);font-size:8px;line-height:12px}
      .rfcd-ai-callout{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;padding:17px 18px;margin-bottom:20px;background:linear-gradient(100deg,#f0efff,#f7f3ff);border:1px solid #e1dcff;border-radius:13px}.rfcd-ai-callout-icon{width:38px;height:38px;display:grid;place-items:center;color:var(--c-violet);background:#fff;border-radius:11px}.rfcd-ai-callout>div{min-width:0}.rfcd-ai-callout>div>strong{display:block;color:var(--c-text);font-size:11px}.rfcd-ai-callout p{max-width:780px;margin:3px 0 0;color:var(--c-text2);font-size:9px;line-height:14px}.rfcd-compact-metric{display:flex;align-items:baseline;gap:8px;padding:13px 15px;background:#fff;border:1px solid var(--c-line);border-radius:10px}.rfcd-compact-metric strong{color:var(--c-text);font:600 18px/22px Geist,Inter,sans-serif}.rfcd-compact-metric span{color:var(--c-text2);font-size:9px}

      .rfcd-tools{margin:28px 0 24px}.rfcd-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:12px}.rfcd-section-heading p{max-width:720px;margin:4px 0 0;color:var(--c-text2);font-size:10px;line-height:15px}
      .rfcd-tools .cardish{margin-top:14px!important;padding:20px!important;background:#fff!important;border:1px solid var(--c-line)!important;border-radius:14px!important;box-shadow:0 1px 2px rgba(25,28,29,.025)!important}.rfcd-tools .section-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:15px}.rfcd-tools .section-title-row .eyebrow{display:block;margin-bottom:3px;color:var(--c-primary);font-size:9px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.rfcd-tools .section-title-row h2{margin:0;color:var(--c-text);font:600 14px/20px Geist,Inter,sans-serif}.rfcd-tools .section-title-row p{margin:4px 0 0;color:var(--c-text2);font-size:9px;line-height:14px}.rfcd-tools .section-title-row>svg{width:34px;height:34px;padding:8px;color:var(--c-primary);background:var(--c-primary-soft);border-radius:10px}
      .rfcd-tools .field{display:grid;gap:5px}.rfcd-tools .field>span{color:var(--c-text2);font-size:9px;font-weight:650}.rfcd-tools input[type="text"],.rfcd-tools input[type="number"],.rfcd-tools input:not([type]),.rfcd-tools select{min-height:38px;padding:8px 10px;color:var(--c-text);background:#fff;border:1px solid var(--c-line);border-radius:8px;outline:0}.rfcd-tools input:focus{border-color:rgba(70,72,212,.48);box-shadow:0 0 0 3px rgba(70,72,212,.09)}.rfcd-tools .btn{min-height:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding:7px 11px!important;border-radius:8px!important;font-size:10px!important;font-weight:650!important}.rfcd-tools .btn.primary{color:#fff!important;background:var(--c-primary)!important;border-color:var(--c-primary)!important}.rfcd-tools .btn.ghost{color:var(--c-text2)!important;background:#fff!important;border:1px solid var(--c-line)!important}
      .rfcd-tools .error-banner{padding:10px 11px!important;color:#7c1616!important;background:var(--c-danger-soft)!important;border:1px solid #ffd1cd!important;border-radius:8px!important;font-size:9px!important;line-height:14px!important;animation:rfcdFadeUp .2s var(--c-ease)!important}.rfcd-tools .success-banner{padding:10px 11px!important;color:#075f45!important;background:var(--c-success-soft)!important;border:1px solid #c7ecdf!important;border-radius:8px!important;font-size:9px!important;line-height:14px!important;animation:rfcdFadeUp .2s var(--c-ease)!important}
      .rfcd-tools .rf-audit-batch-controls{display:grid;grid-template-columns:170px minmax(0,1fr);gap:10px;margin-bottom:11px}.rfcd-tools .rf-assignment-option{display:flex!important;align-items:flex-start!important;gap:7px!important;margin:10px 0!important;color:var(--c-text2)!important;font-size:9px!important;line-height:14px!important}.rfcd-tools .rf-assignee-picker{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin:9px 0 12px}.rfcd-tools .rf-assignee-picker>label{display:flex!important;align-items:center!important;gap:8px!important;padding:9px!important;background:#fff!important;border:1px solid var(--c-line)!important;border-radius:9px!important;cursor:pointer}.rfcd-tools .rf-assignee-picker>label.selected{background:var(--c-primary-soft)!important;border-color:rgba(70,72,212,.24)!important}.rfcd-tools .rf-assignee-avatar{width:28px!important;height:28px!important;display:grid!important;place-items:center!important;overflow:hidden!important;flex:0 0 28px!important;color:#fff!important;background:var(--c-violet)!important;border-radius:50%!important;font-size:8px!important}.rfcd-tools .rf-assignee-avatar img{width:100%!important;height:100%!important;object-fit:cover!important}.rfcd-tools .rf-audit-job-progress{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:11px;background:var(--c-info-soft);border-radius:9px}.rfcd-tools .rf-audit-job-progress>div{grid-column:1/-1;display:grid;gap:1px}.rfcd-tools .rf-audit-job-progress>span{height:5px;overflow:hidden;background:#dfe5ff;border-radius:999px}.rfcd-tools .rf-audit-job-progress>span i{display:block;height:100%;background:var(--c-primary);border-radius:999px;transition:width .26s var(--c-ease)}

      .rfcd-leads-section{scroll-margin-top:86px;margin-top:28px;padding-top:22px;border-top:1px solid var(--c-line)}.rfcd-lead-heading{align-items:flex-end}.rfcd-lead-count{display:flex;align-items:baseline;gap:5px;color:var(--c-muted)}.rfcd-lead-count strong{color:var(--c-text);font:600 17px/21px Geist,Inter,sans-serif}.rfcd-lead-count span{font-size:9px}.rfcd-lead-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0 10px}
      .rfcd-search{width:min(360px,45vw);min-height:39px;display:flex;align-items:center;gap:8px;padding:0 10px;color:var(--c-muted);background:#fff;border:1px solid var(--c-line);border-radius:9px}.rfcd-search:focus-within{border-color:rgba(70,72,212,.45);box-shadow:0 0 0 3px rgba(70,72,212,.08)}.rfcd-search input{min-width:0;flex:1;height:37px;padding:0;color:var(--c-text);background:transparent;border:0;outline:0;font:400 10px/16px Inter,sans-serif}.rfcd-search button{width:25px;height:25px;display:grid;place-items:center;padding:0;color:var(--c-muted);background:transparent;border:0;border-radius:6px;cursor:pointer}.rfcd-outcome-filter{display:flex;align-items:center;gap:7px;color:var(--c-text2);font-size:9px;font-weight:650}.rfcd-outcome-filter select{height:38px;min-width:150px;padding:0 28px 0 10px;color:var(--c-text);background:#fff;border:1px solid var(--c-line);border-radius:8px;outline:0;font-size:9px}
      .rfcd-lead-table-wrap{overflow-x:auto;background:#fff;border:1px solid var(--c-line);border-radius:14px}.rfcd-lead-table{width:100%;min-width:1240px;border-collapse:separate;border-spacing:0}.rfcd-lead-table th{padding:12px 13px;color:var(--c-text2);background:#fbfbfc;border-bottom:1px solid var(--c-line);text-align:left;font-size:9px;font-weight:650}.rfcd-lead-table th:first-child,.rfcd-lead-table td:first-child{padding-left:18px}.rfcd-lead-row{cursor:pointer;transition:.14s var(--c-ease)}.rfcd-lead-row+.rfcd-lead-row td,.rfcd-lead-expanded-row+.rfcd-lead-row td{border-top:1px solid #f0f1f2}.rfcd-lead-row:hover,.rfcd-lead-row.expanded{background:#fafafd;box-shadow:inset 3px 0 0 rgba(70,72,212,.65)}.rfcd-lead-row td{height:74px;padding:11px 13px;color:var(--c-text2);vertical-align:middle;font-size:9px;line-height:14px}
      .rfcd-business-cell{min-width:250px;display:flex;align-items:flex-start;gap:9px}.rfcd-business-avatar{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;color:var(--c-primary);background:var(--c-primary-soft);border-radius:8px;font-size:8px;font-weight:750}.rfcd-business-cell>span:last-child{min-width:0;display:grid;gap:1px}.rfcd-business-cell strong,.rfcd-business-cell small{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rfcd-business-cell strong{color:var(--c-text);font-size:10px}.rfcd-business-cell small{color:var(--c-muted);font-size:8px}.rfcd-business-cell em{width:max-content;margin-top:2px;padding:2px 5px;color:var(--c-primary);background:var(--c-primary-soft);border-radius:4px;font-size:7px;font-style:normal;font-weight:700}.rfcd-stack{display:grid;gap:3px}.rfcd-stack>a,.rfcd-stack>span{display:inline-flex;align-items:center;gap:4px;color:var(--c-text2);text-decoration:none}.rfcd-stack>a:hover{color:var(--c-primary)}.rfcd-stack .muted,.rfcd-lead-row .muted{color:var(--c-muted)}
      .rfcd-rating{display:inline-flex;align-items:center;gap:3px;color:var(--c-text)}.rfcd-rating>svg{color:#e7a72c;fill:#e7a72c}.rfcd-rating small{color:var(--c-muted)}.rfcd-website-link,.rfcd-map-link{display:inline-flex;align-items:center;gap:4px;color:var(--c-primary)!important;text-decoration:none;font-weight:650}.rfcd-opportunity{display:inline-flex;padding:3px 6px;color:var(--c-warning);background:var(--c-warning-soft);border-radius:4px;font-size:7px;font-weight:650}.rfcd-assignee-cell{display:flex;align-items:center;gap:7px}.rfcd-assignee-cell>span{width:27px;height:27px;display:grid;place-items:center;flex:0 0 27px;color:#fff;background:var(--c-violet);border-radius:50%;font-size:7px;font-weight:750}.rfcd-assignee-cell>div{min-width:0;display:grid}.rfcd-assignee-cell strong{max-width:110px;overflow:hidden;color:var(--c-text);text-overflow:ellipsis;white-space:nowrap;font-size:9px}.rfcd-assignee-cell small,.rfcd-source-small{color:var(--c-muted);font-size:7px}.rfcd-source-small{display:block;max-width:115px;overflow:hidden;margin-top:2px;text-overflow:ellipsis;white-space:nowrap}
      .rfcd-lead-expanded-row td{padding:0!important;background:#fbfbff;border-top:1px solid #eeeefd}.rfcd-lead-expanded{display:grid;grid-template-columns:1.2fr .9fr .9fr;gap:14px;padding:14px 18px 16px 58px;animation:rfcdFadeUp .18s var(--c-ease)}.rfcd-expanded-block{display:grid;align-content:start;gap:7px}.rfcd-expanded-block>span:first-child{color:var(--c-muted);font-size:7px;font-weight:750;letter-spacing:.07em;text-transform:uppercase}.rfcd-expanded-block.signals{grid-template-columns:repeat(2,minmax(0,1fr))}.rfcd-expanded-block.signals>span:first-child{grid-column:1/-1}.rfcd-signal{display:grid;gap:1px;padding:6px 8px;background:#fff;border:1px solid var(--c-line);border-radius:6px}.rfcd-signal small{color:var(--c-muted);font-size:7px}.rfcd-signal strong{color:var(--c-text);font-size:8px}.rfcd-tags,.rfcd-expanded-actions{display:flex;flex-wrap:wrap;gap:5px}.rfcd-tags>span{padding:3px 6px;color:var(--c-violet);background:var(--c-violet-soft);border-radius:4px;font-size:7px;font-weight:650}.rfcd-expanded-actions a{min-height:27px;display:inline-flex;align-items:center;gap:4px;padding:4px 7px;color:var(--c-primary)!important;background:#fff;border:1px solid var(--c-line);border-radius:6px;text-decoration:none;font-size:7px;font-weight:700}
      .rfcd-lead-empty,.rfcd-no-leads{min-height:300px;display:grid;place-items:center;align-content:center;gap:6px;padding:34px 20px;color:var(--c-muted);background:#fff;border:1px dashed var(--c-line);border-radius:14px;text-align:center}.rfcd-lead-empty strong,.rfcd-no-leads h3{margin:0;color:var(--c-text);font:600 13px/19px Geist,Inter,sans-serif}.rfcd-lead-empty span,.rfcd-no-leads p{max-width:470px;margin:0;font-size:9px;line-height:14px}.rfcd-no-leads>span{width:48px;height:48px;display:grid;place-items:center;color:var(--c-primary);background:var(--c-primary-soft);border-radius:14px}.rfcd-no-lead-actions{display:flex;gap:8px;margin-top:8px}

      .rfcd-access,.rfcd-fatal{max-width:620px;padding:28px;margin-top:20px;background:#fff;border:1px solid var(--c-line);border-radius:16px}.rfcd-access-icon,.rfcd-fatal-icon{width:46px;height:46px;display:grid;place-items:center;margin-bottom:14px;color:var(--c-primary);background:var(--c-primary-soft);border-radius:13px}.rfcd-fatal-icon{color:var(--c-danger);background:var(--c-danger-soft)}.rfcd-access p,.rfcd-fatal p{margin:7px 0 0;color:var(--c-text2);font-size:11px;line-height:17px}.rfcd-access .rfcd-btn{margin-top:18px}.rfcd-fatal-actions{display:flex;gap:8px;margin-top:18px}

      .rfcd-skeleton-back,.rfcd-skeleton-hero i,.rfcd-skeleton-kpis i,.rfcd-skeleton-main i,.rfcd-skeleton-rows i{display:block;background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);background-size:220% 100%;animation:rfcdShimmer 1.25s linear infinite}.rfcd-skeleton-back{width:90px;height:12px;margin:8px 0 22px;border-radius:999px}.rfcd-skeleton-hero{display:flex;justify-content:space-between;gap:24px;margin-bottom:24px}.rfcd-skeleton-hero>div:first-child{width:min(560px,60%);display:grid;gap:9px}.rfcd-skeleton-hero>div:last-child{display:flex;gap:8px}.rfcd-skeleton-hero i{width:180px;height:14px;border-radius:999px}.rfcd-skeleton-hero i.wide{width:340px;height:30px;border-radius:8px}.rfcd-skeleton-hero>div:last-child i{width:110px;height:39px;border-radius:8px}.rfcd-skeleton-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:14px;margin-bottom:28px}.rfcd-skeleton-kpis i{height:118px;border-radius:11px}.rfcd-skeleton-main{display:grid;grid-template-columns:minmax(0,1fr) 312px;gap:28px;margin-bottom:20px}.rfcd-skeleton-main i{height:370px;border-radius:16px}.rfcd-skeleton-rows{display:grid;gap:1px;overflow:hidden;background:#fff;border:1px solid var(--c-line);border-radius:14px}.rfcd-skeleton-rows i{height:64px}

      @media(max-width:1200px){.rf-campaign-detail-v7{padding:18px 24px 40px}.rfcd-overview-grid,.rfcd-skeleton-main{grid-template-columns:minmax(0,1fr) 286px;gap:18px}.rfcd-activity-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:980px){.rfcd-hero{flex-direction:column}.rfcd-hero-actions{width:100%;padding-top:0;justify-content:flex-start}.rfcd-overview-grid,.rfcd-skeleton-main{grid-template-columns:1fr}.rfcd-contact-list{grid-template-columns:repeat(2,minmax(0,1fr))}.rfcd-operational-grid,.rfcd-meta-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rfcd-ai-callout{grid-template-columns:auto minmax(0,1fr)}.rfcd-ai-callout>.rfcd-btn{grid-column:2;justify-self:start}.rfcd-lead-expanded{grid-template-columns:1fr 1fr;padding-left:18px}.rfcd-lead-expanded>.signals{grid-column:1/-1}}
      @media(max-width:700px){.rf-campaign-detail-v7{padding:14px 14px 86px}.rfcd-live-state span:last-child{display:none}.rfcd-title-row{align-items:flex-start;flex-direction:column;gap:7px}.rfcd-title-row h1,.rfcd-access h1,.rfcd-fatal h1{font-size:22px;line-height:29px}.rfcd-hero-meta{display:grid;gap:5px}.rfcd-hero-actions{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);gap:7px}.rfcd-hero-actions .rfcd-btn{width:100%}.rfcd-kpis{grid-template-columns:repeat(7,minmax(122px,1fr));margin-bottom:18px}.rfcd-kpi{min-height:106px;padding:14px}.rfcd-performance-card{padding:18px 12px 10px}.rfcd-card-head{align-items:flex-start;flex-direction:column;gap:9px}.rfcd-card-head.compact{flex-direction:row}.rfcd-chart-wrap,.rfcd-chart-empty{min-height:240px}.rfcd-contact-list{grid-template-columns:1fr}.rfcd-activity-grid,.rfcd-operational-grid,.rfcd-meta-grid{grid-template-columns:1fr 1fr;gap:9px}.rfcd-ai-callout{grid-template-columns:auto minmax(0,1fr)}.rfcd-ai-callout>.rfcd-btn{grid-column:1/-1;width:100%}.rfcd-tools .rf-audit-batch-controls{grid-template-columns:1fr}.rfcd-lead-heading{align-items:flex-start;flex-direction:column}.rfcd-lead-toolbar{align-items:stretch;flex-direction:column}.rfcd-search{width:100%}.rfcd-outcome-filter{justify-content:space-between}.rfcd-outcome-filter select{flex:1}.rfcd-lead-expanded{grid-template-columns:1fr}.rfcd-lead-expanded>.signals{grid-column:auto}.rfcd-message,.rfcd-progress-message{align-items:flex-start}.rfcd-skeleton-kpis{grid-template-columns:repeat(7,122px);overflow:auto}.rfcd-skeleton-hero{flex-direction:column}.rfcd-skeleton-hero>div:first-child{width:100%}}
      @media(max-width:480px){.rfcd-hero-actions{grid-template-columns:39px 1fr}.rfcd-hero-actions .rfcd-btn-primary{grid-column:1/-1}.rfcd-activity-grid,.rfcd-operational-grid,.rfcd-meta-grid{grid-template-columns:1fr}.rfcd-chart-empty{grid-template-columns:1fr;justify-items:start;padding:22px 18px}.rfcd-empty-progress{grid-column:auto;width:100%}.rfcd-ai-callout{grid-template-columns:1fr}.rfcd-ai-callout>.rfcd-btn{grid-column:auto}.rfcd-no-lead-actions,.rfcd-fatal-actions{width:100%;flex-direction:column}.rfcd-no-lead-actions .rfcd-btn,.rfcd-fatal-actions .rfcd-btn{width:100%}.rfcd-tools .rf-assignee-picker{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){.rf-campaign-detail-v7,.rfcd-message,.rfcd-progress-message,.rfcd-activity-card,.rfcd-line,.rfcd-area-path,.rfcd-live-dot.connected,.rfcd-progress-track i,.rfcd-empty-progress i,.rfcd-lead-expanded,.rfcd-skeleton-back,.rfcd-skeleton-hero i,.rfcd-skeleton-kpis i,.rfcd-skeleton-main i,.rfcd-skeleton-rows i,.rf-campaign-detail-v7 .spin{animation:none!important}.rf-campaign-detail-v7 *{transition-duration:.01ms!important;scroll-behavior:auto!important}}
    `}</style>
  );
}
