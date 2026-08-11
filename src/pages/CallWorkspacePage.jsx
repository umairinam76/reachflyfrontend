import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiRequest, onWorkspaceSocket } from "../lib/workspace-platform-client.js";
import MiniAuditPanel from "./MiniAuditPanel.jsx";
import TelnyxDialer from "./TelnyxDialer.jsx";
import "../styles.css";

const OUTCOMES = [
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["meeting_booked", "Meeting booked"],
  ["converted", "Converted"],
  ["callback", "Callback"],
  ["follow_up", "Follow-up required"],
  ["no_answer", "No answer"],
  ["busy", "Busy"],
  ["voicemail", "Voicemail"],
  ["not_interested", "Not interested"],
  ["invalid_number", "Invalid number"],
  ["do_not_call", "Do not call"],
];

const PENDING_AUDIT_STATUSES = new Set([
  "queued",
  "pending",
  "processing",
  "running",
  "generating",
]);

const READY_AUDIT_STATUSES = new Set([
  "complete",
  "completed",
  "ready",
  "crm_audit_ready",
]);

const FAILED_AUDIT_STATUSES = new Set([
  "failed",
  "error",
  "cancelled",
]);

export default function CallWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("assignmentId") || "";
  const requestedLeadId = searchParams.get("leadId") || "";

  const [assignment, setAssignment] = useState(null);
  const [lead, setLead] = useState(null);
  const [miniAudit, setMiniAudit] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [outcome, setOutcome] = useState("contacted");
  const [notes, setNotes] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [generatingAudit, setGeneratingAudit] = useState(false);
  const [generatingFullAudit, setGeneratingFullAudit] = useState(false);
  const [generatingCompetitorAnalysis, setGeneratingCompetitorAnalysis] = useState(false);

  const socketRefreshTimerRef =
    useRef(null);

  const resolvedAssignmentId = assignment?.id || assignmentId;
  const resolvedLeadId = lead?.id || assignment?.leadId || requestedLeadId;

  const loadWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      let assignmentResponse;

      if (assignmentId) {
        assignmentResponse = await apiRequest(
          `/caller-queue/${encodeURIComponent(assignmentId)}`
        );
      } else {
        const queueResponse = await apiRequest("/caller-queue?bucket=all&limit=1000");
        const found = (queueResponse.records || []).find(
          (item) => item.leadId === requestedLeadId || item.lead?.id === requestedLeadId
        );
        assignmentResponse = found ? { assignment: found } : null;
      }

      const nextAssignment = assignmentResponse?.assignment || assignmentResponse || null;
      if (!nextAssignment) {
        throw new Error("The selected lead assignment was not found.");
      }

      const nextLead = nextAssignment.lead || null;
      if (!nextLead?.id) {
        throw new Error("The selected assignment does not contain a lead.");
      }

      setAssignment(nextAssignment);
      setLead(nextLead);
      setNotes(nextAssignment.notes || nextLead.notes || "");
      setFollowUpAt(toLocalDateTimeInput(nextAssignment.nextActionAt || nextAssignment.followUpAt));

      const nextCampaignType = normalizeCampaignType(
        nextAssignment?.campaignType ||
          nextAssignment?.auditTrack ||
          nextLead?.dailyCampaignType ||
          nextLead?.campaignType ||
          "website"
      );

      const [callsResponse, auditsResponse] = await Promise.all([
        apiRequest(`/telnyx/calls?leadId=${encodeURIComponent(nextLead.id)}&limit=30`),
        apiRequest(
          `/lead-audits?leadId=${encodeURIComponent(nextLead.id)}&kind=mini&track=${encodeURIComponent(nextCampaignType)}`
        ),
      ]);

      setCallHistory(callsResponse.calls || []);

      const reports = auditsResponse.reports || [];
      const latestMiniAudit = reports.find(
        (report) =>
          report.kind === "mini" &&
          normalizeCampaignType(report.track || report.campaignType || nextCampaignType) === nextCampaignType
      ) || null;
      const hasRealAuditJob = Boolean(
        latestMiniAudit?.id ||
          nextLead.miniAuditReportId ||
          nextAssignment.miniAuditReportId
      );
      const effectiveMiniStatus = latestMiniAudit?.status ||
        (hasRealAuditJob
          ? nextLead.miniAuditStatus || nextAssignment.miniAuditStatus || ""
          : "not_started");
      setMiniAudit(latestMiniAudit);

      setLead((current) => ({
        ...(current || nextLead),
        miniAudit: latestMiniAudit,
        miniAuditStatus: effectiveMiniStatus,
        auditTrack: nextCampaignType,
      }));
    } catch (requestError) {
      setError(requestError?.message || "The call workspace could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assignmentId, requestedLeadId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!resolvedAssignmentId) return undefined;
    void apiRequest(`/caller-queue/${encodeURIComponent(resolvedAssignmentId)}/open`, {
      method: "POST",
    }).catch(() => {});
    return undefined;
  }, [resolvedAssignmentId]);

  useEffect(() => {
    const scheduleRefresh = () => {
      window.clearTimeout(
        socketRefreshTimerRef.current
      );

      socketRefreshTimerRef.current =
        window.setTimeout(
          () =>
            void loadWorkspace({
              silent: true,
            }),
          350
        );
    };

    const subscriptions = [
      onWorkspaceSocket(
        "call:created",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "call:updated",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "call:completed",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "lead:audit-updated",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "lead:updated",
        scheduleRefresh
      ),
      onWorkspaceSocket(
        "lead:call-updated",
        scheduleRefresh
      ),
    ];

    return () => {
      window.clearTimeout(
        socketRefreshTimerRef.current
      );

      subscriptions.forEach(
        (unsubscribe) =>
          unsubscribe?.()
      );
    };
  }, [loadWorkspace]);

  useEffect(() => {
    const status = normalizeStatus(miniAudit?.status || lead?.miniAuditStatus);
    if (!PENDING_AUDIT_STATUSES.has(status)) return undefined;
    const timer = window.setInterval(
      () => void loadWorkspace({ silent: true }),
      8000
    );
    return () => window.clearInterval(timer);
  }, [miniAudit?.status, lead?.miniAuditStatus, loadWorkspace]);

  const miniAuditStatus = normalizeStatus(
    miniAudit?.status || lead?.miniAuditStatus || ""
  );
  const campaignType = normalizeCampaignType(
    assignment?.campaignType ||
      assignment?.auditKind ||
      lead?.dailyCampaignType ||
      lead?.campaignType ||
      "website"
  );
  const miniAuditReady = Boolean(
    miniAudit &&
      READY_AUDIT_STATUSES.has(miniAuditStatus)
  );
  const miniAuditPending =
    generatingAudit ||
    PENDING_AUDIT_STATUSES.has(miniAuditStatus);
  const miniAuditFailed = FAILED_AUDIT_STATUSES.has(
    miniAuditStatus
  );

  const latestCall = useMemo(() => callHistory[0] || null, [callHistory]);

  async function generateReport(kind) {
    const canResearchWithoutWebsite =
      campaignType === "gmb" &&
      Boolean(
        resolvedLeadId ||
          lead?.business ||
          lead?.name ||
          lead?.placeId ||
          lead?.address
      );

    if (!lead?.website && !canResearchWithoutWebsite) {
      setError(
        "A website is required for Website campaign audits."
      );
      return;
    }

    const setBusy = kind === "mini"
      ? setGeneratingAudit
      : kind === "full"
        ? setGeneratingFullAudit
        : setGeneratingCompetitorAnalysis;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const body = {
        lead,
        leadId: resolvedLeadId,
        campaignId: assignment?.campaignId || lead?.campaignId || "",
        campaignType,
        track: campaignType,
        website: lead.website || "",
        placeId:
          lead.placeId ||
          lead.googlePlaceId ||
          "",
        gmbProfileUrl:
          lead.gmbProfileUrl ||
          lead.googleMapsUri ||
          lead.googleMapsUrl ||
          "",
        niche:
          lead.dailyNiche ||
          assignment?.niche ||
          lead.category ||
          lead.primaryType ||
          "",
        location:
          lead.dailyLocation ||
          assignment?.location ||
          lead.address ||
          lead.formattedAddress ||
          "",
        resourceType:
          lead.dailyResourceType ||
          lead.resourceType ||
          assignment?.resourceType ||
          "",
        country:
          lead.dailyCountry ||
          lead.country ||
          assignment?.country ||
          "",
        regionCode:
          lead.dailyRegionCode ||
          lead.regionCode ||
          assignment?.regionCode ||
          "",
        ...(kind === "mini"
          ? {
              priority: true,
              interactive: true,
              automatic: false,
              source: "call-workspace-open-realtime",
            }
          : {}),
      };
      const report = kind === "mini"
        ? await apiRequest("/lead-audits/mini", { method: "POST", body })
        : await apiRequest("/lead-audits/generate", {
            method: "POST",
            body: { ...body, kind },
          });

      if (kind === "mini") {
        setMiniAudit(report);
        setLead((current) => ({
          ...(current || {}),
          miniAudit: report,
          miniAuditStatus: report.status || "queued",
          auditTrack: campaignType,
          auditType: campaignType === "gmb" ? "GMB Mini Audit" : "Website Mini Audit",
        }));
      }

      setSuccess(
        report.status === "complete"
          ? `${formatLabel(kind)} audit is ready.`
          : `${formatLabel(kind)} audit was queued.`
      );
      await loadWorkspace({ silent: true });
    } catch (requestError) {
      setError(requestError?.message || `The ${kind} audit could not be generated.`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!lead || !resolvedLeadId) return;
    if (miniAuditReady || miniAuditPending) return;

    // Realtime mode: opening this workspace generates only this lead's Mini Audit.
    // Backend cache/dedupe prevents duplicate work for repeated opens.
    if (!miniAuditStatus || miniAuditFailed) {
      void generateReport("mini");
    }
    // generateReport intentionally omitted from dependencies; this effect is keyed
    // to the current lead and audit state only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resolvedLeadId,
    miniAuditStatus,
    miniAuditReady,
    miniAuditPending,
    miniAuditFailed,
  ]);

  async function saveOutcome() {
    if (!resolvedAssignmentId) return;

    if (["callback", "follow_up"].includes(outcome) && !followUpAt) {
      setError("Select a follow-up date and time.");
      return;
    }

    setSavingOutcome(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/caller-queue/${encodeURIComponent(resolvedAssignmentId)}/outcome`,
        {
          method: "POST",
          timeoutMs: 30_000,
          body: {
            outcome,
            status: outcome,
            notes: notes.trim(),
            ...(outcome === "callback" && followUpAt
              ? { callbackAt: new Date(followUpAt).toISOString() }
              : {}),
            ...(outcome === "follow_up" && followUpAt
              ? { followUpAt: new Date(followUpAt).toISOString() }
              : {}),
          },
        }
      );

      if (response.assignment) {
        setAssignment(response.assignment);
        setLead(response.assignment.lead || lead);
      }
      setSuccess("The call outcome was saved.");
    } catch (requestError) {
      setError(requestError?.message || "The call outcome could not be saved.");
    } finally {
      setSavingOutcome(false);
    }
  }

  if (loading) {
    return (
      <main className="rf-call-workspace">
        <section className="rf-call-empty-state"><p>Loading call workspace…</p></section>
      </main>
    );
  }

  if (!lead || !assignment) {
    return (
      <main className="rf-call-workspace">
        <section className="rf-call-empty-state">
          <h1>Lead not available</h1>
          <p>{error || "The selected assignment is unavailable."}</p>
          <button type="button" onClick={() => navigate("/app/my-leads")}>Return to my leads</button>
        </section>
      </main>
    );
  }

  return (
    <main className="rf-call-workspace">
      <header className="rf-call-header">
        <div className="rf-call-header__identity">
          <div>
            <p className="rf-call-eyebrow">Live Telnyx call workspace</p>
            <h1>{lead.business || lead.name || "Business lead"}</h1>
            <p>{lead.phone || "No phone"} · {lead.website || "No website"}</p>
          </div>
        </div>
        <div className="rf-call-header__actions">
          <button type="button" onClick={() => navigate("/app/my-leads")}>Back to leads</button>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadWorkspace({ silent: true })}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <div className="rf-workspace-alert rf-workspace-alert--error">{error}</div> : null}
      {success ? <div className="rf-workspace-alert rf-workspace-alert--success">{success}</div> : null}

      <section className="rf-call-layout">
        <div className="rf-call-layout__primary">
          <section className="cardish" style={{ marginBottom: 12 }}>
            <p className="rf-call-eyebrow">Manual caller phone</p>
            <h2>Telnyx dialer & keypad</h2>
            <p>The dialer unlocks as soon as the default Mini Audit is ready. During an active call the End call button and dial pad are available below.</p>
          </section>

          {miniAuditReady ? (
            <TelnyxDialer
              lead={lead}
              assignmentId={resolvedAssignmentId}
              campaignId={assignment.campaignId || lead.campaignId || ""}
              autoAdvance={false}
              onAssignmentChange={(updated) => {
                if (!updated) return;
                setAssignment(updated);
                if (updated.lead) setLead(updated.lead);
              }}
              onCallComplete={() => void loadWorkspace({ silent: true })}
              onOpenNextLead={() => navigate("/app/my-leads")}
            />
          ) : (
            <section className="cardish" style={{ marginBottom: 12 }}>
              <p className="rf-call-eyebrow">Pre-call audit</p>
              <h2>Mini Audit required before dialing</h2>
              <p>
                {miniAuditPending
                  ? "ReachFly is preparing the default Mini Audit. Manager setup is not required."
                  : "ReachFly will generate the built-in Mini Audit automatically. A manager PDF only changes future report formatting."}
              </p>
              {!miniAuditPending ? (
                <button
                  type="button"
                  onClick={() => void generateReport("mini")}
                  disabled={generatingAudit}
                >
                  {miniAuditFailed ? "Retry Mini Audit" : "Generate Mini Audit"}
                </button>
              ) : null}
            </section>
          )}

          <section className="rf-call-outcome-card">
            <div>
              <p className="rf-call-eyebrow">Call disposition</p>
              <h2>Save the human-reviewed outcome</h2>
            </div>

            <label>
              <span>Outcome</span>
              <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                {OUTCOMES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Objections, decision maker, timing and next step"
              />
            </label>

            <label>
              <span>Follow-up</span>
              <input
                type="datetime-local"
                value={followUpAt}
                onChange={(event) => setFollowUpAt(event.target.value)}
              />
            </label>

            <button type="button" disabled={savingOutcome} onClick={() => void saveOutcome()}>
              {savingOutcome ? "Saving…" : "Save outcome"}
            </button>
          </section>

          <section className="rf-call-history-card">
            <div>
              <p className="rf-call-eyebrow">Telnyx history</p>
              <h2>Recent calls</h2>
            </div>
            {!callHistory.length ? <p>No calls recorded yet.</p> : (
              <div className="rf-call-history-list">
                {callHistory.slice(0, 20).map((call) => (
                  <article key={call.id || call.callId}>
                    <strong>{formatLabel(call.outcome || call.status)}</strong>
                    <span>{formatDateTime(call.endedAt || call.updatedAt || call.createdAt)}</span>
                    <span>{formatDuration(call.durationSeconds)}</span>
                    {call.hasRecording ? (
                      <a href={`/api/telnyx/recordings/${encodeURIComponent(call.id)}`} target="_blank" rel="noreferrer">
                        Recording
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
            {latestCall?.cause ? <p>{latestCall.cause}</p> : null}
          </section>
        </div>

        <aside className="rf-call-layout__secondary">
          <section className="rf-call-information-panel">
            <p className="rf-call-eyebrow">Lead details</p>
            <h2>{lead.business || lead.name}</h2>
            <dl>
              <dt>Phone</dt><dd>{lead.phone || "Not available"}</dd>
              <dt>Email</dt><dd>{lead.email || "Not available"}</dd>
              <dt>Address</dt><dd>{lead.address || lead.formattedAddress || "Not available"}</dd>
              <dt>Campaign</dt><dd>{assignment.campaignName || "Not available"}</dd>
              <dt>Attempts</dt><dd>{assignment.callAttempts || 0}</dd>
            </dl>
          </section>

          <MiniAuditPanel
            lead={lead}
            audit={miniAudit}
            status={miniAuditStatus}
            generating={generatingAudit}
            generatingFullAudit={generatingFullAudit}
            generatingCompetitorAnalysis={generatingCompetitorAnalysis}
            onGenerateMiniAudit={() => void generateReport("mini")}
            onGenerateFullAudit={() => void generateReport("full")}
            onGenerateCompetitorAnalysis={() => void generateReport("competitor")}
          />
        </aside>
      </section>
    </main>
  );
}

function normalizeCampaignType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return [
    "gmb",
    "gmb_audit",
    "google_business_profile",
    "local_visibility",
  ].includes(normalized)
    ? "gmb"
    : "website";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function formatLabel(value) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(value) {
  const seconds = Math.max(0, Number(value || 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
