import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Globe2,
  Mail,
  Phone,
  Rocket,
  Sparkles,
  Users,
  X,
  Zap,
} from "../components/icons";
import { api } from "../api";
import { apiRequest } from "../lib/workspace-platform-client.js";
import { useAuth } from "../auth/AuthContext";

const SELECTION_STORAGE_KEY = "reachfly:selected-campaign-leads";

const MODES = Object.freeze({
  EMAIL: "email",
  VOICE: "voice",
});

export default function CampaignCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [mode, setMode] = useState(MODES.VOICE);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [marketLocation, setMarketLocation] = useState("");
  const [offer, setOffer] = useState("");
  const [dailyLimit, setDailyLimit] = useState(30);
  const [emailAccountId, setEmailAccountId] = useState("");
  const [emailSubject, setEmailSubject] = useState("Quick idea for {business}");
  const [emailBody, setEmailBody] = useState(
    "Hi {name},\n\nI noticed an opportunity for {business}. I wanted to share a quick idea that may help.\n\nWould you be open to a short conversation?"
  );
  const [aiManagedEmail, setAiManagedEmail] = useState(true);
  const [connections, setConnections] = useState(null);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [voiceDashboard, setVoiceDashboard] = useState(null);
  const [loadingVoiceReadiness, setLoadingVoiceReadiness] = useState(true);
  const [voiceReadinessError, setVoiceReadinessError] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedLeads = useMemo(
    () => resolveSelectedLeads(location.state),
    [location.state]
  );

  const leadContext = useMemo(
    () => inferLeadContext(selectedLeads),
    [selectedLeads]
  );

  const emailConnections = useMemo(
    () => normalizeEmailConnections(connections),
    [connections]
  );

  const selectedEmailAccount = useMemo(
    () =>
      emailConnections.find(
        (item) => String(item?.id || "") === String(emailAccountId || "")
      ) || null,
    [emailAccountId, emailConnections]
  );

  const emailReadyCount = useMemo(
    () => selectedLeads.filter((lead) => isValidEmail(lead?.email)).length,
    [selectedLeads]
  );

  const phoneReadyCount = useMemo(
    () => selectedLeads.filter((lead) => Boolean(normalizePhone(lead?.phone))).length,
    [selectedLeads]
  );

  const voiceAgents = useMemo(
    () => normalizeVoiceAgents(voiceDashboard),
    [voiceDashboard]
  );

  const selectedVoiceAgent = useMemo(
    () =>
      voiceAgents.find((item) => String(item?.id || "") === String(selectedAgentId || "")) ||
      null,
    [selectedAgentId, voiceAgents]
  );

  const voiceReadiness = useMemo(
    () => resolveVoiceReadiness(voiceDashboard, selectedVoiceAgent),
    [selectedVoiceAgent, voiceDashboard]
  );

  const voiceCampaignReady = voiceReadiness.ready;

  const role = normalizeRole(user?.workspaceRole || user?.role || "");
  const canManageCampaigns = ["owner", "admin", "manager"].includes(role);

  useEffect(() => {
    if (!niche && leadContext.niche) setNiche(leadContext.niche);
    if (!marketLocation && leadContext.location) {
      setMarketLocation(leadContext.location);
    }
  }, [leadContext.location, leadContext.niche, marketLocation, niche]);

  useEffect(() => {
    let alive = true;

    async function loadConnections() {
      setLoadingConnections(true);
      try {
        const response = await api.connections();
        if (!alive) return;
        setConnections(response || {});
      } catch {
        if (!alive) return;
        setConnections({ emailConnections: [] });
      } finally {
        if (alive) setLoadingConnections(false);
      }
    }

    void loadConnections();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadVoiceReadiness() {
      setLoadingVoiceReadiness(true);
      setVoiceReadinessError("");

      try {
        const response = await apiRequest("/telnyx/ai-agent/dashboard", {
          timeoutMs: 30_000,
        });
        if (!alive) return;
        setVoiceDashboard(response || null);
      } catch (requestError) {
        if (!alive) return;
        setVoiceDashboard(null);
        setVoiceReadinessError(
          requestError?.message ||
            "ReachFly could not verify the business-number and Voice Agent setup."
        );
      } finally {
        if (alive) setLoadingVoiceReadiness(false);
      }
    }

    void loadVoiceReadiness();

    const refreshVoiceReadiness = () => {
      void loadVoiceReadiness();
    };

    window.addEventListener("focus", refreshVoiceReadiness);

    return () => {
      alive = false;
      window.removeEventListener("focus", refreshVoiceReadiness);
    };
  }, []);

  useEffect(() => {
    if (!voiceAgents.length) {
      if (selectedAgentId) setSelectedAgentId("");
      return;
    }

    if (selectedAgentId && voiceAgents.some((item) => String(item?.id || "") === selectedAgentId)) {
      return;
    }

    const requestedAgentId = String(
      location.state?.agentId ||
        location.state?.voiceAgentId ||
        new URLSearchParams(location.search || "").get("agent") ||
        ""
    ).trim();

    const requested = voiceAgents.find((item) => String(item?.id || "") === requestedAgentId);
    const preferred =
      requested ||
      voiceAgents.find((item) => getVoiceAgentReadiness(item, voiceDashboard).ready) ||
      voiceAgents.find((item) => isOutboundAgent(item)) ||
      voiceAgents[0];

    if (preferred?.id) setSelectedAgentId(String(preferred.id));
  }, [location.search, location.state, selectedAgentId, voiceAgents, voiceDashboard]);

  useEffect(() => {
    if (emailAccountId || !emailConnections.length) return;
    const preferred =
      emailConnections.find((item) => item?.active === true) ||
      emailConnections.find((item) => item?.isDefault === true) ||
      emailConnections[0];
    if (preferred?.id) setEmailAccountId(String(preferred.id));
  }, [emailAccountId, emailConnections]);

  useEffect(() => {
    if (!selectedLeads.length) return;
    try {
      window.sessionStorage.setItem(
        SELECTION_STORAGE_KEY,
        JSON.stringify({
          leads: selectedLeads,
          savedAt: Date.now(),
        })
      );
    } catch {
      // Browser storage is optional. Route state remains authoritative.
    }
  }, [selectedLeads]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setError("");

    if (!canManageCampaigns) {
      setError("Campaign creation is available to workspace owners, admins, and managers.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedNiche = niche.trim() || leadContext.niche || "Selected leads";
    const trimmedLocation =
      marketLocation.trim() || leadContext.location || "Selected lead market";

    if (selectedLeads.length === 0 && trimmedNiche.length < 2) {
      setError("Enter the target niche or select leads from All Leads first.");
      return;
    }

    if (selectedLeads.length === 0 && trimmedLocation.length < 2) {
      setError("Enter the target location or select leads from All Leads first.");
      return;
    }

    if (mode === MODES.EMAIL && !emailConnections.length) {
      setError("Connect an email account before starting an Email Campaign.");
      return;
    }

    if (mode === MODES.EMAIL && !emailAccountId) {
      setError("Choose the email account ReachFly should send from.");
      return;
    }

    if (mode === MODES.EMAIL && selectedLeads.length > 0 && emailReadyCount === 0) {
      setError("None of the selected leads has a usable email address.");
      return;
    }

    if (mode === MODES.VOICE && loadingVoiceReadiness) {
      setError("ReachFly is still checking your calling setup. Try again in a moment.");
      return;
    }

    if (mode === MODES.VOICE && !selectedVoiceAgent) {
      setError("Choose the outbound AI agent that should run this campaign.");
      return;
    }

    if (mode === MODES.VOICE && !voiceCampaignReady) {
      setError(
        voiceReadiness.message ||
          "Set up a ReachFly business number and activate an outbound AI agent before creating an AI Calling campaign."
      );
      return;
    }

    if (mode === MODES.VOICE && selectedLeads.length > 0 && phoneReadyCount === 0) {
      setError("None of the selected leads has a callable phone number.");
      return;
    }

    setSaving(true);

    try {
      const isImportedSelection = selectedLeads.length > 0;
      const senderEmail =
        selectedEmailAccount?.fromEmail ||
        selectedEmailAccount?.accountEmail ||
        selectedEmailAccount?.email ||
        selectedEmailAccount?.username ||
        "";

      const payload = {
        name:
          trimmedName ||
          `${trimmedNiche} — ${mode === MODES.EMAIL ? "Email" : "AI Calling"}`,
        niche: trimmedNiche,
        location: trimmedLocation,
        selectedSegment: trimmedNiche,
        offer: offer.trim(),
        dailyLimit: clampNumber(dailyLimit, 1, 100000),
        limit: isImportedSelection ? selectedLeads.length : 100,
        qualityLevel: "balanced",

        campaignType: mode === MODES.EMAIL ? "email" : "ai-calling",
        primaryChannel: mode === MODES.EMAIL ? "email" : "voice",
        voiceEnabled: mode === MODES.VOICE,
        aiVoiceEnabled: mode === MODES.VOICE,
        voiceAgentId: mode === MODES.VOICE ? String(selectedVoiceAgent?.id || "") : "",
        aiAgentId: mode === MODES.VOICE ? String(selectedVoiceAgent?.id || "") : "",
        agentId: mode === MODES.VOICE ? String(selectedVoiceAgent?.id || "") : "",
        voiceAgentName: mode === MODES.VOICE ? String(selectedVoiceAgent?.name || "") : "",
        fromNumber: mode === MODES.VOICE ? String(selectedVoiceAgent?.fromNumber || "") : "",
        businessNumber: mode === MODES.VOICE ? String(selectedVoiceAgent?.fromNumber || "") : "",
        callingMode: mode === MODES.VOICE ? String(selectedVoiceAgent?.callingMode || "outbound") : "",
        aiManagedEmailFollowUp: mode === MODES.VOICE && aiManagedEmail,
        goal:
          mode === MODES.EMAIL
            ? "email"
            : aiManagedEmail
              ? "both"
              : "voice",

        emailAccountId:
          mode === MODES.EMAIL || aiManagedEmail ? emailAccountId : "",
        senderEmail:
          mode === MODES.EMAIL || aiManagedEmail ? senderEmail : "",

        outreachPlan: {
          strategy: mode === MODES.EMAIL ? "email" : "ai_voice",
          primaryChannel: mode === MODES.EMAIL ? "email" : "voice",
          aiVoice: mode === MODES.VOICE,
          voiceAgentId: mode === MODES.VOICE ? String(selectedVoiceAgent?.id || "") : "",
          voiceAgentName: mode === MODES.VOICE ? String(selectedVoiceAgent?.name || "") : "",
          fromNumber: mode === MODES.VOICE ? String(selectedVoiceAgent?.fromNumber || "") : "",
          callingMode: mode === MODES.VOICE ? String(selectedVoiceAgent?.callingMode || "outbound") : "",
          emailEnabled: mode === MODES.EMAIL || aiManagedEmail,
          aiManagedEmailFollowUp: mode === MODES.VOICE && aiManagedEmail,
          aiChoosesFollowUpTiming: mode === MODES.VOICE && aiManagedEmail,
          digitalChannel: mode === MODES.EMAIL ? "email" : aiManagedEmail ? "email" : "none",
          disclosureRequired: mode === MODES.VOICE,
          recordingPolicy: mode === MODES.VOICE ? "workspace_policy" : "",
        },

        pipeline: buildPipeline({
          mode,
          aiManagedEmail,
          emailSubject,
          emailBody,
        }),
      };

      if (isImportedSelection) {
        Object.assign(payload, {
          source: "external-import",
          externalImport: true,
          leads: selectedLeads,
          totalRows: selectedLeads.length,
          validEmails: emailReadyCount,
          missingEmails: Math.max(selectedLeads.length - emailReadyCount, 0),
          validPhones: phoneReadyCount,
          missingPhones: Math.max(selectedLeads.length - phoneReadyCount, 0),
        });
      }

      const created = await api.createCampaign(payload);
      const campaignId = created?.id || created?.campaign?.id || "";

      if (!campaignId) {
        throw new Error("Campaign was created without a campaign ID.");
      }

      clearStoredSelection();
      notify(
        "success",
        "Campaign created",
        mode === MODES.EMAIL
          ? "Your email campaign is ready."
          : `${selectedVoiceAgent?.name || "Your AI agent"} is connected to this campaign and ready to call.`
      );

      navigate(`/app/campaigns/${campaignId}`, {
        replace: true,
        state: {
          createdCampaign: true,
          campaignMode: mode,
          voiceAgentId: mode === MODES.VOICE ? String(selectedVoiceAgent?.id || "") : "",
          fromNumber: mode === MODES.VOICE ? String(selectedVoiceAgent?.fromNumber || "") : "",
        },
      });
    } catch (requestError) {
      const message =
        requestError?.message || "The campaign could not be created.";
      setError(message);
      notify("error", "Campaign creation failed", message);
    } finally {
      setSaving(false);
    }
  }

  if (!canManageCampaigns) {
    return (
      <>
        <CampaignCreateStyles />
        <div className="rfcc-page">
          <section className="rfcc-restricted">
            <span className="rfcc-restricted-icon"><Rocket size={25} /></span>
            <span className="rfcc-eyebrow">Restricted workspace feature</span>
            <h1>Campaign access required</h1>
            <p>Campaign creation is available to workspace owners, administrators, and managers.</p>
            <Link className="rfcc-btn rfcc-btn-primary" to="/app/dashboard">
              Return to dashboard <ArrowRight size={15} />
            </Link>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <CampaignCreateStyles />
      <div className="rfcc-page">
        <div className="rfcc-topline">
          <Link className="rfcc-back" to="/app/campaigns">
            <ArrowLeft size={15} /> Campaigns
          </Link>
          <span className="rfcc-flow-label">Create Campaign</span>
        </div>

        <header className="rfcc-hero">
          <div>
            <span className="rfcc-eyebrow">Connected outreach</span>
            <h1>How should ReachFly work these leads?</h1>
            <p>
              Choose email or AI calling. ReachFly keeps the lead history, call context,
              follow-ups, and campaign outcomes connected in one workspace.
            </p>
          </div>

          <div className="rfcc-audience-pill">
            <Users size={17} />
            <span>
              <strong>{selectedLeads.length}</strong>
              <small>{selectedLeads.length === 1 ? "lead selected" : "leads selected"}</small>
            </span>
          </div>
        </header>

        {error ? (
          <div className="rfcc-message rfcc-message-error" role="alert">
            <X size={16} />
            <div>
              <strong>Campaign needs attention</strong>
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        {mode === MODES.VOICE ? (
          <VoiceSetupGate
            loading={loadingVoiceReadiness}
            ready={voiceCampaignReady}
            readiness={voiceReadiness}
            error={voiceReadinessError}
            agents={voiceAgents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
            dashboard={voiceDashboard}
          />
        ) : null}

        <section className="rfcc-mode-grid" aria-label="Campaign type">
          <ModeCard
            active={mode === MODES.EMAIL}
            icon={<Mail size={22} />}
            eyebrow="Email Campaign"
            title="AI-personalized email outreach"
            description="ReachFly writes and sends personalized email from your connected account, tracks delivery and replies, and keeps every response attached to the lead."
            bullets={[
              "Personalized email per lead",
              "Connected sender account",
              "Follow-up sequence and reply tracking",
            ]}
            onClick={() => setMode(MODES.EMAIL)}
          />

          <ModeCard
            active={mode === MODES.VOICE}
            recommended
            icon={<Phone size={22} />}
            eyebrow="AI Calling Campaign"
            title="Let the Voice Agent run the conversation"
            description="Your AI Voice Agent calls, qualifies, handles objections, captures outcomes, and can decide when an email follow-up is useful."
            bullets={[
              "AI calls and qualification",
              "Lead context travels into every call",
              "Optional AI-decided email follow-up",
            ]}
            onClick={() => setMode(MODES.VOICE)}
          />
        </section>

        <form className="rfcc-form" onSubmit={handleSubmit}>
          <section className="rfcc-card">
            <div className="rfcc-card-head">
              <div>
                <span className="rfcc-step">1</span>
                <div>
                  <span className="rfcc-eyebrow">Campaign basics</span>
                  <h2>Name and targeting context</h2>
                </div>
              </div>
              <CheckCircle2 size={18} />
            </div>

            <div className="rfcc-fields rfcc-fields-two">
              <Field label="Campaign name" optional>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={
                    mode === MODES.EMAIL
                      ? "New York clinics — Email"
                      : "New York clinics — AI Calling"
                  }
                  maxLength={120}
                />
              </Field>

              <Field label="Daily outreach limit">
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={dailyLimit}
                  onChange={(event) => setDailyLimit(event.target.value)}
                />
              </Field>

              <Field label="Niche / segment">
                <input
                  value={niche}
                  onChange={(event) => setNiche(event.target.value)}
                  placeholder="Clinics"
                  maxLength={120}
                />
              </Field>

              <Field label="Location / market">
                <input
                  value={marketLocation}
                  onChange={(event) => setMarketLocation(event.target.value)}
                  placeholder="New York"
                  maxLength={180}
                />
              </Field>
            </div>

            <Field label="What are you offering?" optional>
              <textarea
                rows="3"
                value={offer}
                onChange={(event) => setOffer(event.target.value)}
                placeholder="Give the AI a short description of the offer, desired outcome, or campaign objective."
                maxLength={1200}
              />
            </Field>
          </section>

          <section className="rfcc-card">
            <div className="rfcc-card-head">
              <div>
                <span className="rfcc-step">2</span>
                <div>
                  <span className="rfcc-eyebrow">
                    {mode === MODES.EMAIL ? "Email setup" : "AI orchestration"}
                  </span>
                  <h2>
                    {mode === MODES.EMAIL
                      ? "Configure the email campaign"
                      : "Choose the agent that will own this campaign"}
                  </h2>
                </div>
              </div>
              {mode === MODES.EMAIL ? <Mail size={18} /> : <Bot size={18} />}
            </div>

            {mode === MODES.EMAIL ? (
              <div className="rfcc-channel-panel">
                <EmailAccountField
                  loading={loadingConnections}
                  connections={emailConnections}
                  value={emailAccountId}
                  onChange={setEmailAccountId}
                />

                <Field label="First email subject">
                  <input
                    value={emailSubject}
                    onChange={(event) => setEmailSubject(event.target.value)}
                    maxLength={180}
                  />
                </Field>

                <Field label="Message direction">
                  <textarea
                    rows="7"
                    value={emailBody}
                    onChange={(event) => setEmailBody(event.target.value)}
                    maxLength={5000}
                  />
                </Field>

                <TokenHelp />
              </div>
            ) : (
              <div className="rfcc-channel-panel">
                <VoiceJourney
                  agent={selectedVoiceAgent}
                  leadCount={selectedLeads.length}
                  phoneReadyCount={phoneReadyCount}
                  aiManagedEmail={aiManagedEmail}
                />

                {selectedVoiceAgent ? (
                  <div className="rfcc-selected-agent">
                    <span className="rfcc-selected-agent-mark"><Bot size={18} /></span>
                    <div>
                      <small>Campaign owner</small>
                      <strong>{selectedVoiceAgent.name || "ReachFly AI Agent"}</strong>
                      <span>
                        {callingModeLabel(selectedVoiceAgent.callingMode)} · {formatCampaignPhone(selectedVoiceAgent.fromNumber) || "No number"} · {languageLabel(selectedVoiceAgent)}
                      </span>
                    </div>
                    <Link to={`/app/agents?agent=${encodeURIComponent(String(selectedVoiceAgent.id || ""))}`}>
                      Manage agent <ArrowRight size={12} />
                    </Link>
                  </div>
                ) : null}

                <label className="rfcc-toggle-card">
                  <input
                    type="checkbox"
                    checked={aiManagedEmail}
                    onChange={(event) => setAiManagedEmail(event.target.checked)}
                  />
                  <span className="rfcc-toggle-ui" aria-hidden="true"><i /></span>
                  <span className="rfcc-toggle-copy">
                    <strong>Let ReachFly AI decide when to send email</strong>
                    <small>
                      The Voice Agent can trigger email only when the conversation outcome makes it useful—for example send-info, meeting confirmation, or a relevant follow-up.
                    </small>
                  </span>
                </label>

                {aiManagedEmail ? (
                  <EmailAccountField
                    loading={loadingConnections}
                    connections={emailConnections}
                    value={emailAccountId}
                    onChange={setEmailAccountId}
                    optional
                  />
                ) : null}
              </div>
            )}
          </section>

          <section className="rfcc-card">
            <div className="rfcc-card-head">
              <div>
                <span className="rfcc-step">3</span>
                <div>
                  <span className="rfcc-eyebrow">Audience</span>
                  <h2>Review the leads entering this campaign</h2>
                </div>
              </div>
              <Users size={18} />
            </div>

            {selectedLeads.length ? (
              <>
                <div className="rfcc-readiness-grid">
                  <ReadinessStat
                    icon={<Users size={17} />}
                    label="Selected"
                    value={selectedLeads.length}
                  />
                  <ReadinessStat
                    icon={<Phone size={17} />}
                    label="Phone ready"
                    value={phoneReadyCount}
                    active={mode === MODES.VOICE}
                  />
                  <ReadinessStat
                    icon={<Mail size={17} />}
                    label="Email ready"
                    value={emailReadyCount}
                    active={mode === MODES.EMAIL || aiManagedEmail}
                  />
                </div>

                <LeadPreview leads={selectedLeads.slice(0, 5)} />

                <Link className="rfcc-text-link" to="/app/leads?view=all">
                  Change selected leads <ArrowRight size={13} />
                </Link>
              </>
            ) : (
              <div className="rfcc-empty-audience">
                <span><Globe2 size={24} /></span>
                <div>
                  <strong>No saved leads selected yet</strong>
                  <p>
                    You can still create a discovery campaign from the niche and location above,
                    or return to All Leads and choose the exact records you want.
                  </p>
                </div>
                <Link className="rfcc-btn rfcc-btn-secondary" to="/app/leads?view=all">
                  Select from All Leads <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </section>

          <footer className="rfcc-submit-bar">
            <div className="rfcc-submit-summary">
              <span className={`rfcc-submit-icon ${mode}`}>
                {mode === MODES.EMAIL ? <Mail size={18} /> : <Phone size={18} />}
              </span>
              <div>
                <strong>
                  {mode === MODES.EMAIL ? "Email Campaign" : "AI Calling Campaign"}
                </strong>
                <span>
                  {mode === MODES.VOICE && selectedVoiceAgent
                    ? `${selectedVoiceAgent.name || "AI agent"} · ${formatCampaignPhone(selectedVoiceAgent.fromNumber) || "number required"}`
                    : selectedLeads.length
                      ? `${selectedLeads.length} selected lead${selectedLeads.length === 1 ? "" : "s"}`
                      : "New lead discovery campaign"}
                </span>
              </div>
            </div>

            <div className="rfcc-submit-actions">
              <Link className="rfcc-btn rfcc-btn-secondary" to="/app/campaigns">
                Cancel
              </Link>
              <button className="rfcc-btn rfcc-btn-primary" type="submit" disabled={saving || (mode === MODES.VOICE && (!voiceCampaignReady || loadingVoiceReadiness))}>
                {saving ? (
                  <><span className="rfcc-spinner" /> Creating campaign…</>
                ) : mode === MODES.VOICE && !voiceCampaignReady ? (
                  <>
                    <Phone size={15} />
                    Complete Voice Setup First
                  </>
                ) : (
                  <>
                    {mode === MODES.EMAIL ? <Mail size={15} /> : <Zap size={15} />}
                    Create {mode === MODES.EMAIL ? "Email" : "AI Calling"} Campaign
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </>
  );
}

function VoiceSetupGate({
  loading,
  ready,
  readiness,
  error,
  agents,
  selectedAgentId,
  onSelectAgent,
  dashboard,
}) {
  if (loading) {
    return (
      <section className="rfcc-voice-gate checking">
        <span className="rfcc-voice-gate-icon"><span className="rfcc-spinner dark" /></span>
        <div>
          <strong>Checking the connected calling journey…</strong>
          <p>ReachFly is loading your AI agents, assigned business numbers, and outbound readiness.</p>
        </div>
      </section>
    );
  }

  if (!agents.length) {
    return (
      <section className="rfcc-voice-gate blocked">
        <span className="rfcc-voice-gate-icon"><Bot size={18} /></span>
        <div>
          <strong>Create an AI agent before launching a calling campaign</strong>
          <p>{error || "Campaigns are linked to a specific ReachFly AI agent so the language, opening, context, memory, number, and call outcomes stay consistent."}</p>
          <div className="rfcc-voice-checks">
            <span className="missing">1 AI agent</span>
            <span className="missing">2 Business number</span>
            <span className="missing">3 Outbound enabled</span>
          </div>
        </div>
        <Link className="rfcc-btn rfcc-btn-primary" to="/app/agents?onboarding=1&mode=outbound&returnTo=%2Fapp%2Fcampaigns%2Fnew">
          Create AI Agent <ArrowRight size={14} />
        </Link>
      </section>
    );
  }

  return (
    <section className={`rfcc-agent-gate ${ready ? "ready" : "blocked"}`}>
      <div className="rfcc-agent-gate-head">
        <span className="rfcc-voice-gate-icon">{ready ? <CheckCircle2 size={18} /> : <Bot size={18} />}</span>
        <div>
          <strong>{ready ? "Campaign calling path is connected" : "Choose a campaign-ready outbound agent"}</strong>
          <p>
            {ready
              ? `${readiness.agentName || "This AI agent"} will call from ${readiness.numberLabel || "its assigned business number"}. Its saved language, opening, system instructions, memory and closing behavior remain attached.`
              : error || readiness.message || "Select an enabled outbound agent with an assigned ReachFly business number."}
          </p>
        </div>
        <Link className="rfcc-btn rfcc-btn-secondary" to="/app/agents?mode=outbound">Manage agents</Link>
      </div>

      <div className="rfcc-agent-picker" role="radiogroup" aria-label="Campaign AI agent">
        {agents.map((agent) => {
          const state = getVoiceAgentReadiness(agent, dashboard);
          const selected = String(agent?.id || "") === String(selectedAgentId || "");
          return (
            <button
              key={agent?.id || agent?.name}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`rfcc-agent-choice ${selected ? "selected" : ""} ${state.ready ? "ready" : "needs-setup"}`}
              onClick={() => onSelectAgent(String(agent?.id || ""))}
            >
              <span className="rfcc-agent-choice-icon"><Bot size={16} /></span>
              <span className="rfcc-agent-choice-copy">
                <strong>{agent?.name || "ReachFly AI Agent"}</strong>
                <small>{callingModeLabel(agent?.callingMode)} · {languageLabel(agent)}</small>
                <em>{formatCampaignPhone(agent?.fromNumber) || "Business number not assigned"}</em>
              </span>
              <span className={`rfcc-agent-choice-state ${state.ready ? "ok" : "warn"}`}>
                {state.ready ? <CheckCircle2 size={13} /> : <span>!</span>}
                {state.ready ? "Ready" : state.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {!ready ? (
        <div className="rfcc-agent-fix-row">
          <span>{readiness.message || "This agent needs setup before it can own an outbound campaign."}</span>
          <Link to={`/app/agents?mode=outbound${selectedAgentId ? `&agent=${encodeURIComponent(selectedAgentId)}` : ""}`}>
            Fix selected agent <ArrowRight size={12} />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function VoiceJourney({ agent, leadCount, phoneReadyCount, aiManagedEmail }) {
  const steps = [
    { icon: <Users size={15} />, label: "Audience", value: leadCount ? `${leadCount} leads` : "Discovery", ready: true },
    { icon: <Bot size={15} />, label: "AI agent", value: agent?.name || "Choose agent", ready: Boolean(agent) },
    { icon: <Phone size={15} />, label: "Business number", value: agent?.fromNumber ? formatCampaignPhone(agent.fromNumber) : "Assign number", ready: Boolean(agent?.fromNumber) },
    { icon: <Zap size={15} />, label: "Outbound calls", value: phoneReadyCount ? `${phoneReadyCount} callable` : leadCount ? "No callable leads" : "Ready for discovery", ready: Boolean(agent && isOutboundAgent(agent)) },
    { icon: <Sparkles size={15} />, label: "Next action", value: aiManagedEmail ? "AI call + follow-up" : "Call outcome", ready: Boolean(agent) },
  ];

  return (
    <div className="rfcc-journey-map" aria-label="Connected campaign journey">
      {steps.map((step, index) => (
        <div className="rfcc-journey-fragment" key={step.label}>
          <div className={`rfcc-journey-node ${step.ready ? "ready" : "pending"}`}>
            <span>{step.icon}</span>
            <div><small>{step.label}</small><strong>{step.value}</strong></div>
          </div>
          {index < steps.length - 1 ? <i className={step.ready ? "ready" : ""}><ArrowRight size={12} /></i> : null}
        </div>
      ))}
    </div>
  );
}

function normalizeVoiceAgents(dashboard) {
  const source = Array.isArray(dashboard?.agents)
    ? dashboard.agents
    : dashboard?.agent
      ? [dashboard.agent]
      : [];

  return source.filter(Boolean).map((agent, index) => ({
    ...agent,
    id: String(agent?.id || agent?.agentId || agent?.aiAgentId || agent?.elevenLabsAgentId || `agent-${index}`),
    name: String(agent?.name || agent?.agentName || "ReachFly AI Agent").trim(),
  }));
}

function getVoiceAgentReadiness(agent, dashboard) {
  const diagnostics = dashboard?.diagnostics || {};
  const fromNumber = String(agent?.fromNumber || "").trim();
  const numberReady = Boolean(
    fromNumber &&
      (agent?.elevenLabsPhoneNumberId || diagnostics.purchasedNumberRequired === false || diagnostics.numberPurchased || diagnostics.selectedFromNumber === fromNumber)
  );
  const agentReady = Boolean(agent && agent.enabled !== false && (agent.elevenLabsAgentId || diagnostics.configured === true));
  const outboundReady = isOutboundAgent(agent) && diagnostics.outboundEnabled !== false;
  const runtimeReady = diagnostics.configured !== false;

  let message = "";
  let shortLabel = "Setup";
  if (!fromNumber || !numberReady) {
    message = `Assign a ReachFly business number to ${agent?.name || "this AI agent"} before using it in a campaign.`;
    shortLabel = "No number";
  } else if (!agentReady) {
    message = `Activate ${agent?.name || "this AI agent"} before using it in a campaign.`;
    shortLabel = "Inactive";
  } else if (!outboundReady) {
    message = `Set ${agent?.name || "this AI agent"} to Outbound or Inbound + Outbound mode.`;
    shortLabel = "Inbound only";
  } else if (!runtimeReady) {
    message = "Finish the ReachFly voice runtime setup before launching outbound campaigns.";
    shortLabel = "Runtime";
  }

  return {
    ready: numberReady && agentReady && outboundReady && runtimeReady,
    numberReady,
    agentReady,
    outboundReady,
    runtimeReady,
    fromNumber,
    numberLabel: formatCampaignPhone(fromNumber),
    agentName: agent?.name || "ReachFly AI Agent",
    shortLabel,
    message,
  };
}

function resolveVoiceReadiness(dashboard, selectedAgent) {
  if (!selectedAgent) {
    return {
      ready: false,
      numberReady: false,
      agentReady: false,
      outboundReady: false,
      numberLabel: "",
      agentName: "",
      message: normalizeVoiceAgents(dashboard).length
        ? "Choose the AI agent that should own this campaign."
        : "Create an outbound AI agent and connect a business number first.",
    };
  }
  return getVoiceAgentReadiness(selectedAgent, dashboard);
}

function isOutboundAgent(agent) {
  return ["outbound", "both"].includes(String(agent?.callingMode || "outbound").trim().toLowerCase());
}

function callingModeLabel(value) {
  const mode = String(value || "outbound").trim().toLowerCase();
  if (mode === "both") return "Inbound + outbound";
  if (mode === "inbound") return "Inbound only";
  return "Outbound";
}

function languageLabel(agent) {
  const primary = String(agent?.primaryLanguage || agent?.language || "en").trim().toLowerCase();
  const names = { en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian", nl: "Dutch", ar: "Arabic", hi: "Hindi", ur: "Urdu", zh: "Chinese", ja: "Japanese", ko: "Korean", ru: "Russian", tr: "Turkish" };
  return names[primary] || primary.toUpperCase();
}

function formatCampaignPhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function ModeCard({ active, recommended = false, icon, eyebrow, title, description, bullets, onClick }) {
  return (
    <button
      type="button"
      className={`rfcc-mode-card ${active ? "active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className="rfcc-mode-topline">
        <span className="rfcc-mode-icon">{icon}</span>
        <div className="rfcc-mode-badges">
          {recommended ? <span className="rfcc-recommended">Recommended</span> : null}
          {active ? <span className="rfcc-selected"><CheckCircle2 size={13} /> Selected</span> : null}
        </div>
      </div>
      <span className="rfcc-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <ul>
        {bullets.map((item) => <li key={item}><CheckCircle2 size={14} /> {item}</li>)}
      </ul>
    </button>
  );
}

function Field({ label, optional = false, children }) {
  return (
    <label className="rfcc-field">
      <span>{label}{optional ? <em>Optional</em> : null}</span>
      {children}
    </label>
  );
}

function EmailAccountField({ loading, connections, value, onChange, optional = false }) {
  return (
    <Field label="Sending email account" optional={optional}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
      >
        <option value="">
          {loading
            ? "Loading connected email accounts…"
            : connections.length
              ? optional ? "No email account selected" : "Choose a connected email account"
              : "No connected email accounts"}
        </option>
        {connections.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label || item.accountEmail || item.fromEmail || item.email || item.username || "Connected account"}
          </option>
        ))}
      </select>
      {!loading && !connections.length ? (
        <span className="rfcc-field-help">
          Connect Gmail or SMTP from <Link to="/app/connections">Integrations</Link> before sending email.
        </span>
      ) : null}
    </Field>
  );
}

function TokenHelp() {
  return (
    <div className="rfcc-token-help">
      <Sparkles size={15} />
      <span>
        Personalization tokens supported by the existing campaign pipeline include
        <code>{"{name}"}</code>, <code>{"{business}"}</code>, <code>{"{firstIssue}"}</code>, and <code>{"{firstImprovement}"}</code>.
      </span>
    </div>
  );
}

function ReadinessStat({ icon, label, value, active = false }) {
  return (
    <article className={`rfcc-readiness ${active ? "active" : ""}`}>
      <span>{icon}</span>
      <div><strong>{value}</strong><small>{label}</small></div>
    </article>
  );
}

function LeadPreview({ leads }) {
  return (
    <div className="rfcc-lead-preview">
      {leads.map((lead, index) => {
        const name = getBusinessName(lead, index);
        const location = lead?.address || lead?.location || "Location unavailable";
        return (
          <article className="rfcc-lead-row" key={leadIdentity(lead, index)}>
            <span className="rfcc-avatar">{getInitials(name)}</span>
            <div className="rfcc-lead-main">
              <strong>{name}</strong>
              <span>{location}</span>
            </div>
            <div className="rfcc-lead-channels">
              <span className={normalizePhone(lead?.phone) ? "ready" : "missing"} title={lead?.phone || "No phone"}>
                <Phone size={13} />
              </span>
              <span className={isValidEmail(lead?.email) ? "ready" : "missing"} title={lead?.email || "No email"}>
                <Mail size={13} />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function buildPipeline({ mode, aiManagedEmail, emailSubject, emailBody }) {
  if (mode === MODES.EMAIL) {
    return [
      {
        name: "AI personalized introduction",
        channel: "email",
        delayMinutes: 0,
        subject: emailSubject.trim() || "Quick idea for {business}",
        body: emailBody.trim(),
        enabled: true,
      },
      {
        name: "Helpful follow-up",
        channel: "email",
        delayMinutes: 2880,
        subject: "Following up — {business}",
        body: "Hi {name},\n\nJust following up in case this is useful. One practical improvement for {business} may be to {firstImprovement}.\n\nHappy to send the details.",
        enabled: true,
      },
    ];
  }

  if (!aiManagedEmail) return [];

  return [
    {
      name: "AI-triggered post-call email",
      channel: "email",
      delayMinutes: 0,
      subject: "Following up on our conversation",
      body: "Hi {name},\n\nFollowing up on our conversation. I wanted to send the information we discussed for {business}.\n\nBest,\nReachFlyAI",
      enabled: true,
      aiTriggered: true,
      triggerPolicy: "conversation_outcome",
    },
  ];
}

function resolveSelectedLeads(routeState) {
  const direct =
    routeState?.selectedLeads ||
    routeState?.leads ||
    routeState?.campaignLeads ||
    [];

  if (Array.isArray(direct) && direct.length) {
    return dedupeLeads(direct);
  }

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(SELECTION_STORAGE_KEY) || "null");
    if (Array.isArray(stored?.leads) && stored.leads.length) {
      return dedupeLeads(stored.leads);
    }
  } catch {
    // Ignore unavailable or malformed storage.
  }

  return [];
}

function clearStoredSelection() {
  try {
    window.sessionStorage.removeItem(SELECTION_STORAGE_KEY);
  } catch {
    // Storage is optional.
  }
}

function dedupeLeads(leads) {
  const seen = new Set();
  const output = [];

  leads.filter(Boolean).forEach((lead, index) => {
    const key = leadIdentity(lead, index);
    if (seen.has(key)) return;
    seen.add(key);
    output.push(lead);
  });

  return output;
}

function leadIdentity(lead, index = 0) {
  return String(
    lead?.id ||
    lead?.leadId ||
    lead?.placeId ||
    lead?.googlePlaceId ||
    normalizePhone(lead?.phone) ||
    String(lead?.email || "").trim().toLowerCase() ||
    `${String(lead?.business || lead?.company || lead?.name || "lead").trim().toLowerCase()}-${index}`
  );
}

function inferLeadContext(leads) {
  if (!Array.isArray(leads) || !leads.length) {
    return { niche: "", location: "" };
  }

  const niche = mostCommon(
    leads.map((lead) => lead?.niche || lead?.category || lead?.primaryType).filter(Boolean)
  );

  const location = mostCommon(
    leads.map((lead) => lead?.location || compactAddressLocation(lead?.address)).filter(Boolean)
  );

  return { niche: niche || "", location: location || "" };
}

function compactAddressLocation(value) {
  const parts = String(value || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(", ");
  return parts.slice(-3).join(", ");
}

function mostCommon(values) {
  const counts = new Map();
  let best = "";
  let bestCount = 0;

  values.forEach((value) => {
    const clean = String(value || "").trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    const next = (counts.get(key)?.count || 0) + 1;
    counts.set(key, { count: next, value: clean });
    if (next > bestCount) {
      bestCount = next;
      best = clean;
    }
  });

  return best;
}

function normalizeEmailConnections(source) {
  const candidates = Array.isArray(source?.emailConnections)
    ? source.emailConnections
    : Array.isArray(source?.connections)
      ? source.connections.filter((item) => {
          const type = String(item?.type || item?.provider || item?.kind || "").toLowerCase();
          return type.includes("email") || type.includes("gmail") || type.includes("smtp");
        })
      : [];

  return candidates.filter((item) => item && item.id);
}

function getBusinessName(lead, index = 0) {
  return (
    lead?.business ||
    lead?.company ||
    lead?.companyName ||
    lead?.name ||
    `Lead ${index + 1}`
  );
}

function getInitials(value) {
  return String(value || "RF")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const plus = raw.startsWith("+") ? "+" : "";
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? `${plus}${digits}` : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function notify(type, title, message) {
  if (typeof window === "undefined") return;
  if (window.reachflyToast?.[type]) {
    window.reachflyToast[type](title, message);
    return;
  }
  window.dispatchEvent(
    new CustomEvent("reachfly:toast", {
      detail: { type, title, message },
    })
  );
}

function CampaignCreateStyles() {
  return (
    <style>{`
      .rfcc-page{--rfcc-text:#151622;--rfcc-muted:#727489;--rfcc-line:#e7e7ee;--rfcc-primary:#5f61e9;--rfcc-primary-soft:#f0f0ff;--rfcc-surface:#fff;max-width:1180px;margin:0 auto;padding:22px 24px 54px;color:var(--rfcc-text)}
      .rfcc-topline{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.rfcc-back{display:inline-flex;align-items:center;gap:7px;color:#5f6171;text-decoration:none;font-size:13px;font-weight:650}.rfcc-back:hover{color:var(--rfcc-primary)}.rfcc-flow-label{font-size:11px;font-weight:750;color:#73758a;text-transform:uppercase;letter-spacing:.08em}
      .rfcc-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:22px}.rfcc-hero>div:first-child{max-width:760px}.rfcc-eyebrow{display:block;color:#6668d8;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.rfcc-hero h1{margin:5px 0 8px;font-size:32px;line-height:1.1;letter-spacing:-.035em}.rfcc-hero p{margin:0;color:var(--rfcc-muted);font-size:14px;line-height:1.65}.rfcc-audience-pill{display:flex;align-items:center;gap:9px;min-width:150px;padding:10px 12px;border:1px solid #dfdff0;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(38,40,90,.05)}.rfcc-audience-pill>svg{color:var(--rfcc-primary)}.rfcc-audience-pill span{display:grid}.rfcc-audience-pill strong{font-size:14px}.rfcc-audience-pill small{font-size:10px;color:var(--rfcc-muted)}
      .rfcc-message{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;margin-bottom:18px;border-radius:12px;font-size:12px}.rfcc-message-error{border:1px solid #ffd1cf;background:#fff7f6;color:#9f2e2a}.rfcc-message>div{display:grid;gap:2px}.rfcc-message strong{font-size:12px}.rfcc-message span{line-height:1.5}
      .rfcc-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}.rfcc-mode-card{appearance:none;width:100%;padding:20px;text-align:left;border:1px solid var(--rfcc-line);border-radius:16px;background:#fff;cursor:pointer;box-shadow:0 4px 15px rgba(30,32,70,.035);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.rfcc-mode-card:hover{transform:translateY(-2px);border-color:#cfd0f3;box-shadow:0 10px 25px rgba(49,51,126,.08)}.rfcc-mode-card.active{border:1.5px solid var(--rfcc-primary);background:linear-gradient(180deg,#fafaff,#fff);box-shadow:0 12px 30px rgba(95,97,233,.11)}.rfcc-mode-topline{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}.rfcc-mode-icon{width:43px;height:43px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#6265ee,#7a4cdf);border-radius:13px;box-shadow:0 7px 16px rgba(95,97,233,.22)}.rfcc-mode-badges{display:flex;align-items:center;gap:6px}.rfcc-recommended,.rfcc-selected{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:999px;font-size:9px;font-weight:750}.rfcc-recommended{color:#5b3fa9;background:#f3edff}.rfcc-selected{color:#3c3eb4;background:#ececff}.rfcc-mode-card h2{margin:5px 0 7px;font-size:18px;letter-spacing:-.02em}.rfcc-mode-card p{margin:0 0 14px;color:var(--rfcc-muted);font-size:12px;line-height:1.6}.rfcc-mode-card ul{list-style:none;display:grid;gap:7px;padding:0;margin:0}.rfcc-mode-card li{display:flex;align-items:center;gap:7px;color:#515366;font-size:11px}.rfcc-mode-card li svg{color:#5e61dd}
      .rfcc-form{display:grid;gap:16px}.rfcc-card{padding:20px;border:1px solid var(--rfcc-line);border-radius:16px;background:#fff;box-shadow:0 5px 20px rgba(26,28,64,.035)}.rfcc-card-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:16px;margin-bottom:17px;border-bottom:1px solid #eeeeF3}.rfcc-card-head>div{display:flex;align-items:center;gap:11px}.rfcc-card-head>svg{color:#7779a0}.rfcc-card-head h2{margin:2px 0 0;font-size:15px}.rfcc-step{width:29px;height:29px;display:grid;place-items:center;color:#fff;background:#5f61e9;border-radius:9px;font-size:11px;font-weight:800}
      .rfcc-fields{display:grid;gap:14px}.rfcc-fields-two{grid-template-columns:1.6fr .7fr;margin-bottom:14px}.rfcc-field{display:grid;gap:6px}.rfcc-field>span:first-child{display:flex;align-items:center;gap:8px;color:#424456;font-size:11px;font-weight:700}.rfcc-field em{padding:2px 5px;color:#8a8c9f;background:#f3f3f6;border-radius:5px;font-size:8px;font-style:normal;font-weight:650}.rfcc-field input,.rfcc-field textarea,.rfcc-field select{width:100%;box-sizing:border-box;padding:10px 11px;color:#1b1c28;background:#fff;border:1px solid #dfe0e8;border-radius:9px;outline:none;font:inherit;font-size:12px;transition:border-color .15s ease,box-shadow .15s ease}.rfcc-field textarea{resize:vertical;line-height:1.55}.rfcc-field input:focus,.rfcc-field textarea:focus,.rfcc-field select:focus{border-color:#9294ef;box-shadow:0 0 0 3px rgba(95,97,233,.1)}.rfcc-field-help{display:block!important;color:#8a8c9b!important;font-size:9px!important;font-weight:500!important}.rfcc-field-help a{color:var(--rfcc-primary);font-weight:700}
      .rfcc-channel-panel{display:grid;gap:14px}.rfcc-ai-route{display:grid;grid-template-columns:auto 1fr auto auto 1fr;align-items:center;gap:12px;padding:15px;border:1px solid #e5e5f2;border-radius:13px;background:#fafaff}.rfcc-ai-route-node{width:38px;height:38px;display:grid;place-items:center;color:#6466c9;background:#ececff;border-radius:11px}.rfcc-ai-route-node.primary{color:#fff;background:#6264eb}.rfcc-ai-route>div{display:grid;gap:2px}.rfcc-ai-route strong{font-size:11px}.rfcc-ai-route span:not(.rfcc-ai-route-node){color:var(--rfcc-muted);font-size:9px;line-height:1.45}.rfcc-ai-route>svg{color:#9a9bad}.rfcc-toggle-card{display:flex;align-items:flex-start;gap:11px;padding:14px;border:1px solid #dedff0;border-radius:13px;background:#fff;cursor:pointer}.rfcc-toggle-card>input{position:absolute;opacity:0;pointer-events:none}.rfcc-toggle-ui{width:36px;height:20px;flex:0 0 36px;padding:2px;background:#cfd0dc;border-radius:999px;transition:background .15s ease}.rfcc-toggle-ui i{display:block;width:16px;height:16px;background:#fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:transform .15s ease}.rfcc-toggle-card input:checked+.rfcc-toggle-ui{background:#6264eb}.rfcc-toggle-card input:checked+.rfcc-toggle-ui i{transform:translateX(16px)}.rfcc-toggle-copy{display:grid;gap:3px}.rfcc-toggle-copy strong{font-size:11px}.rfcc-toggle-copy small{color:var(--rfcc-muted);font-size:9px;line-height:1.5}.rfcc-token-help{display:flex;align-items:flex-start;gap:8px;padding:10px 11px;color:#5e6073;background:#f8f8fb;border-radius:9px;font-size:9px;line-height:1.55}.rfcc-token-help svg{flex:0 0 auto;color:#6668d8}.rfcc-token-help code{margin:0 2px;padding:1px 4px;background:#ececff;border-radius:4px;color:#4c4eb9}
      .rfcc-readiness-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:13px}.rfcc-readiness{display:flex;align-items:center;gap:9px;padding:11px;border:1px solid #e5e5ed;border-radius:11px}.rfcc-readiness.active{border-color:#d0d1f8;background:#fafaff}.rfcc-readiness>span{width:31px;height:31px;display:grid;place-items:center;color:#72748d;background:#f2f2f6;border-radius:9px}.rfcc-readiness.active>span{color:#5b5dd0;background:#ececff}.rfcc-readiness>div{display:grid}.rfcc-readiness strong{font-size:14px}.rfcc-readiness small{color:var(--rfcc-muted);font-size:9px}.rfcc-lead-preview{border:1px solid #e7e7ee;border-radius:11px;overflow:hidden}.rfcc-lead-row{display:flex;align-items:center;gap:10px;padding:10px 11px;border-bottom:1px solid #eeeeF3}.rfcc-lead-row:last-child{border-bottom:0}.rfcc-avatar{width:30px;height:30px;display:grid;place-items:center;flex:0 0 30px;color:#5254bc;background:#efefff;border-radius:9px;font-size:9px;font-weight:800}.rfcc-lead-main{display:grid;gap:1px;min-width:0;flex:1}.rfcc-lead-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.rfcc-lead-main span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--rfcc-muted);font-size:9px}.rfcc-lead-channels{display:flex;gap:5px}.rfcc-lead-channels>span{width:25px;height:25px;display:grid;place-items:center;border-radius:7px}.rfcc-lead-channels .ready{color:#2a8c68;background:#ebf8f2}.rfcc-lead-channels .missing{color:#acaebb;background:#f3f3f5}.rfcc-text-link{display:inline-flex;align-items:center;gap:5px;margin-top:11px;color:var(--rfcc-primary);text-decoration:none;font-size:10px;font-weight:750}.rfcc-empty-audience{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:13px;padding:15px;border:1px dashed #d7d7e1;border-radius:12px;background:#fbfbfd}.rfcc-empty-audience>span{width:39px;height:39px;display:grid;place-items:center;color:#6668d8;background:#eeeeff;border-radius:11px}.rfcc-empty-audience strong{font-size:11px}.rfcc-empty-audience p{margin:3px 0 0;color:var(--rfcc-muted);font-size:9px;line-height:1.5}
      .rfcc-submit-bar{position:sticky;bottom:14px;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 13px;border:1px solid #ddddE8;border-radius:14px;background:rgba(255,255,255,.96);box-shadow:0 14px 35px rgba(24,25,60,.13);backdrop-filter:blur(14px)}.rfcc-submit-summary{display:flex;align-items:center;gap:9px}.rfcc-submit-icon{width:36px;height:36px;display:grid;place-items:center;color:#fff;border-radius:10px}.rfcc-submit-icon.email{background:#5f61e9}.rfcc-submit-icon.voice{background:linear-gradient(145deg,#5f61e9,#8749d5)}.rfcc-submit-summary>div{display:grid}.rfcc-submit-summary strong{font-size:11px}.rfcc-submit-summary span{color:var(--rfcc-muted);font-size:9px}.rfcc-submit-actions{display:flex;align-items:center;gap:8px}.rfcc-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:35px;padding:8px 12px;border-radius:9px;text-decoration:none;font-size:10px;font-weight:750;cursor:pointer;transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease}.rfcc-btn:disabled{opacity:.6;cursor:wait}.rfcc-btn-primary{color:#fff;background:#5f61e9;border:1px solid #5f61e9;box-shadow:0 5px 12px rgba(95,97,233,.18)}.rfcc-btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 18px rgba(95,97,233,.24)}.rfcc-btn-secondary{color:#4d4f60;background:#fff;border:1px solid #dadbe4}.rfcc-btn-secondary:hover{border-color:#bfc0dd}.rfcc-spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:rfccSpin .7s linear infinite}@keyframes rfccSpin{to{transform:rotate(360deg)}}
      .rfcc-voice-gate{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;margin:0 0 13px;padding:12px 13px;border:1px solid #e3e4ec;border-radius:13px;background:#fff}.rfcc-voice-gate-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px}.rfcc-voice-gate strong{display:block;font-size:11px}.rfcc-voice-gate p{margin:3px 0 0;color:var(--rfcc-muted);font-size:9px;line-height:1.5}.rfcc-voice-gate.ready{border-color:#cdebdc;background:#f7fcf9}.rfcc-voice-gate.ready .rfcc-voice-gate-icon{background:#e8f7ef;color:#23875a}.rfcc-voice-gate.blocked{border-color:#f0d8c4;background:#fffaf6}.rfcc-voice-gate.blocked .rfcc-voice-gate-icon{background:#fff0e4;color:#b66424}.rfcc-voice-gate.checking .rfcc-voice-gate-icon{background:#f0f0ff}.rfcc-voice-checks{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.rfcc-voice-checks span{padding:4px 7px;border-radius:999px;font-size:8px;font-weight:750}.rfcc-voice-checks .ok{background:#eaf8f1;color:#247a55}.rfcc-voice-checks .missing{background:#fff0e4;color:#a85d24}.rfcc-spinner.dark{border-color:rgba(95,97,233,.22);border-top-color:#5f61e9}
      .rfcc-agent-gate{margin:0 0 14px;border:1px solid #e3e4ec;border-radius:14px;background:#fff;overflow:hidden}.rfcc-agent-gate.ready{border-color:#cfe9dc}.rfcc-agent-gate-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px 14px;background:#fbfbfd;border-bottom:1px solid #ececf1}.rfcc-agent-gate.ready .rfcc-agent-gate-head{background:#f7fcf9}.rfcc-agent-gate-head strong{display:block;font-size:11px}.rfcc-agent-gate-head p{margin:3px 0 0;color:var(--rfcc-muted);font-size:9px;line-height:1.5}.rfcc-agent-gate.ready .rfcc-voice-gate-icon{background:#e8f7ef;color:#23875a}.rfcc-agent-gate.blocked .rfcc-voice-gate-icon{background:#fff0e4;color:#b66424}.rfcc-agent-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:11px}.rfcc-agent-choice{appearance:none;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px;border:1px solid #e5e5ed;border-radius:11px;background:#fff;text-align:left;color:inherit;cursor:pointer;transition:.15s ease}.rfcc-agent-choice:hover{transform:translateY(-1px);border-color:#cfd0ed}.rfcc-agent-choice.selected{border-color:#8f91e9;box-shadow:0 0 0 3px rgba(95,97,233,.08);background:#fbfbff}.rfcc-agent-choice-icon{width:34px;height:34px;display:grid;place-items:center;color:#5f61d7;background:#eeeeff;border-radius:9px}.rfcc-agent-choice-copy{min-width:0;display:grid;gap:1px}.rfcc-agent-choice-copy strong,.rfcc-agent-choice-copy small,.rfcc-agent-choice-copy em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rfcc-agent-choice-copy strong{font-size:10px}.rfcc-agent-choice-copy small{color:var(--rfcc-muted);font-size:8px}.rfcc-agent-choice-copy em{color:#585a6c;font-size:8px;font-style:normal}.rfcc-agent-choice-state{display:inline-flex;align-items:center;gap:4px;padding:4px 6px;border-radius:999px;font-size:7px;font-weight:800;white-space:nowrap}.rfcc-agent-choice-state.ok{color:#247a55;background:#eaf8f1}.rfcc-agent-choice-state.warn{color:#a85d24;background:#fff0e4}.rfcc-agent-fix-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;color:#7a5a39;background:#fffaf6;border-top:1px solid #f2dfce;font-size:8px}.rfcc-agent-fix-row a{display:inline-flex;align-items:center;gap:4px;color:#a85d24;text-decoration:none;font-weight:800}.rfcc-journey-map{display:flex;align-items:stretch;gap:0;padding:10px;border:1px solid #e5e5f2;border-radius:13px;background:#fafaff;overflow:auto}.rfcc-journey-fragment{display:flex;align-items:center;min-width:0;flex:1}.rfcc-journey-node{min-width:120px;flex:1;display:flex;align-items:center;gap:7px;padding:8px;border:1px solid transparent;border-radius:9px}.rfcc-journey-node.ready{background:#fff;border-color:#e7e7f1}.rfcc-journey-node.pending{background:#f3f3f6;color:#8d8f9c}.rfcc-journey-node>span{width:27px;height:27px;display:grid;place-items:center;flex:0 0 27px;color:#5f61d7;background:#eeeeff;border-radius:8px}.rfcc-journey-node.pending>span{color:#9799a5;background:#e8e8ec}.rfcc-journey-node>div{min-width:0;display:grid}.rfcc-journey-node small{color:var(--rfcc-muted);font-size:6px;text-transform:uppercase;letter-spacing:.05em}.rfcc-journey-node strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px}.rfcc-journey-fragment>i{width:24px;display:grid;place-items:center;flex:0 0 24px;color:#b0b1bd;font-style:normal}.rfcc-journey-fragment>i.ready{color:#5f61d7}.rfcc-selected-agent{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:10px;padding:11px;border:1px solid #dddff5;border-radius:12px;background:#f8f8ff}.rfcc-selected-agent-mark{width:40px;height:40px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#5f61e9,#8749d5);border-radius:11px}.rfcc-selected-agent>div{min-width:0;display:grid}.rfcc-selected-agent small{color:var(--rfcc-muted);font-size:7px;text-transform:uppercase;letter-spacing:.05em}.rfcc-selected-agent strong{font-size:11px}.rfcc-selected-agent>div>span{color:#727489;font-size:8px}.rfcc-selected-agent>a{display:inline-flex;align-items:center;gap:4px;color:#5f61d7;text-decoration:none;font-size:8px;font-weight:800}
            .rfcc-restricted{max-width:520px;margin:70px auto;padding:32px;text-align:center;border:1px solid #e4e4ec;border-radius:17px;background:#fff}.rfcc-restricted-icon{width:48px;height:48px;display:grid;place-items:center;margin:0 auto 13px;color:#fff;background:#6264e8;border-radius:14px}.rfcc-restricted h1{margin:5px 0 8px}.rfcc-restricted p{margin:0 0 18px;color:var(--rfcc-muted);font-size:12px;line-height:1.6}
      @media(max-width:860px){.rfcc-agent-picker{grid-template-columns:1fr}.rfcc-agent-gate-head{grid-template-columns:auto 1fr}.rfcc-agent-gate-head>.rfcc-btn{grid-column:1/-1}.rfcc-journey-map{display:grid;gap:5px}.rfcc-journey-fragment{display:grid;grid-template-columns:1fr}.rfcc-journey-fragment>i{display:none}.rfcc-journey-node{min-width:0}.rfcc-page{padding:18px 16px 42px}.rfcc-hero{display:grid}.rfcc-audience-pill{width:max-content}.rfcc-voice-gate{grid-template-columns:auto 1fr}.rfcc-voice-gate>.rfcc-btn{grid-column:1/-1}.rfcc-mode-grid{grid-template-columns:1fr}.rfcc-fields-two{grid-template-columns:1fr}.rfcc-ai-route{grid-template-columns:auto 1fr}.rfcc-ai-route>svg{display:none}.rfcc-readiness-grid{grid-template-columns:1fr 1fr 1fr}.rfcc-submit-bar{position:static;align-items:stretch;flex-direction:column}.rfcc-submit-actions{display:grid;grid-template-columns:1fr 1fr}.rfcc-empty-audience{grid-template-columns:auto 1fr}.rfcc-empty-audience .rfcc-btn{grid-column:1/-1}.rfcc-hero h1{font-size:27px}}
      @media(max-width:560px){.rfcc-selected-agent{grid-template-columns:38px 1fr}.rfcc-selected-agent>a{grid-column:1/-1}.rfcc-agent-choice{grid-template-columns:32px 1fr}.rfcc-agent-choice-state{grid-column:2;justify-self:start}.rfcc-agent-fix-row{align-items:flex-start;flex-direction:column}.rfcc-page{padding-left:12px;padding-right:12px}.rfcc-mode-card,.rfcc-card{padding:15px}.rfcc-mode-badges{align-items:flex-end;flex-direction:column}.rfcc-readiness-grid{grid-template-columns:1fr}.rfcc-submit-actions{grid-template-columns:1fr}.rfcc-hero h1{font-size:24px}.rfcc-ai-route{grid-template-columns:auto 1fr}.rfcc-ai-route-node:nth-of-type(2){margin-top:5px}.rfcc-lead-row{align-items:flex-start}.rfcc-lead-channels{padding-top:2px}}
    `}</style>
  );
}
