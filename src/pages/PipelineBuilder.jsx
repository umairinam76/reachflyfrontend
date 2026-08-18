import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  Workflow,
  X,
  Zap,
} from "../components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../lib/workspace-platform-client.js";
import Loader from "../components/Loader";

const starter = [
  {
    name: "Value-first intro",
    channel: "email",
    delayMinutes: 0,
    subject: "Quick idea for {business}",
    body:
      "Hi {name},\n\nI noticed a quick growth opportunity for {business}: {firstIssue}.\n\nWould you be open to a 10-minute walkthrough?",
    enabled: true,
  },
  {
    name: "Helpful proof follow-up",
    channel: "email",
    delayMinutes: 2880,
    subject: "One practical fix for {business}",
    body:
      "Hi {name},\n\nOne simple improvement would be to {firstImprovement}.\n\nI can send a short 3-point fix list if useful.",
    enabled: true,
  },
  {
    name: "Short WhatsApp nudge",
    channel: "whatsapp",
    delayMinutes: 4320,
    subject: "",
    body:
      "Hi {name}, I found one conversion opportunity for {business}. Want me to send the quick notes?",
    enabled: true,
  },
];

const aiVoiceStarter = {
  name: "AI Voice conversation",
  channel: "ai_voice",
  delayMinutes: 0,
  subject: "",
  body:
    "Use verified lead context and the campaign offer to start a concise sales conversation. The agent must disclose that it is an AI sales agent and follow the workspace recording policy.",
  enabled: true,
  executionMode: "voice_agent",
  disclosureRequired: true,
};

const variables = [
  "{name}",
  "{business}",
  "{firstIssue}",
  "{firstImprovement}",
  "{location}",
  "{website}",
];

const DIGITAL_CHANNELS = new Set(["email", "whatsapp"]);

export default function PipelineBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editorRef = useRef(null);
  const eventToastRef = useRef({ key: "", at: 0 });

  const role = normalizeWorkspaceRole(user?.workspaceRole || user?.role || "");
  const canManage = ["owner", "admin", "manager"].includes(role);

  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [campaignId, setCampaignId] = useState(id || "");
  const [stages, setStages] = useState(starter);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [voiceData, setVoiceData] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [launchReviewOpen, setLaunchReviewOpen] = useState(false);
  const [variableMenuOpen, setVariableMenuOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);

  const loadOptionalVoiceReadiness = useCallback(async () => {
    if (!canManage) {
      setVoiceData(null);
      setBillingData(null);
      return;
    }

    const [voiceResult, billingResult] = await Promise.allSettled([
      apiRequest("/telnyx/ai-agent/dashboard", { timeoutMs: 12_000 }),
      apiRequest("/billing/credits", { timeoutMs: 12_000 }),
    ]);

    setVoiceData(voiceResult.status === "fulfilled" ? voiceResult.value : null);
    setBillingData(billingResult.status === "fulfilled" ? billingResult.value : null);
  }, [canManage]);

  const loadCampaign = useCallback(
    async (targetId, { silent = false, toast = false } = {}) => {
      if (!canManage || !targetId) {
        setCampaign(null);
        return null;
      }

      if (silent) setRefreshing(true);
      else setLoadingCampaign(true);

      try {
        const item = await api.campaign(targetId);
        setCampaign(item);
        const nextStages = getCampaignStages(item).map((stage, index) => ({
          ...stage,
          enabled: stage.enabled !== false,
          order: index,
        }));
        setStages(nextStages);
        setActiveStageIndex((current) =>
          nextStages.length ? Math.min(current, nextStages.length - 1) : 0
        );
        setError("");
        if (toast) {
          notify("success", "Sequence refreshed", "The latest campaign sequence is now loaded.");
        }
        return item;
      } catch (requestError) {
        const message = requestError?.message || "The campaign could not be loaded.";
        setError(message);
        if (toast) notify("error", "Refresh failed", message);
        return null;
      } finally {
        setLoadingCampaign(false);
        setRefreshing(false);
      }
    },
    [canManage]
  );

  useEffect(() => {
    if (!user || canManage) return;
    navigate("/app/dashboard", { replace: true });
  }, [canManage, navigate, user]);

  useEffect(() => {
    if (!canManage) {
      setCampaigns([]);
      setLoadingCampaigns(false);
      return undefined;
    }

    let active = true;
    setLoadingCampaigns(true);
    setError("");

    Promise.all([api.campaigns(), loadOptionalVoiceReadiness()])
      .then(([response]) => {
        if (!active) return;
        const items = extractCampaigns(response);
        setCampaigns(items);
        const nextId = id || items[0]?.id || "";
        setCampaignId((current) => id || current || nextId);
      })
      .catch((requestError) => {
        if (!active) return;
        setCampaigns([]);
        setError(requestError?.message || "Campaigns could not be loaded.");
      })
      .finally(() => {
        if (active) setLoadingCampaigns(false);
      });

    return () => {
      active = false;
    };
  }, [canManage, id, loadOptionalVoiceReadiness]);

  useEffect(() => {
    if (!campaignId) {
      setCampaign(null);
      return;
    }
    void loadCampaign(campaignId);
  }, [campaignId, loadCampaign]);

  useEffect(() => {
    if (!canManage || !campaignId) return undefined;

    const source = new EventSource(api.eventsUrl(campaignId));

    source.onmessage = (event) => {
      let parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (parsed.campaign) {
        setCampaign((current) => ({ ...(current || {}), ...parsed.campaign }));
      }

      if (["pipeline_complete", "pipeline_failed", "error"].includes(parsed.type)) {
        setRunning(false);
      }

      maybeToastPipelineEvent(parsed, eventToastRef);
    };

    source.onerror = () => {};

    return () => source.close();
  }, [campaignId, canManage]);

  const leadsReady = Number(campaign?.leadCount || campaign?.leads?.length || 0);
  const progress = campaign?.outreachProgress || campaign?.progress || {
    percent: 0,
    message: "Pipeline not started",
  };

  const sorted = useMemo(
    () => stages.map((stage, order) => ({ ...stage, order })),
    [stages]
  );

  const enabledVoiceStages = useMemo(
    () => sorted.filter((stage) => stage.enabled !== false && stage.channel === "ai_voice"),
    [sorted]
  );

  const enabledDigitalStages = useMemo(
    () =>
      sorted.filter(
        (stage) => stage.enabled !== false && DIGITAL_CHANNELS.has(stage.channel)
      ),
    [sorted]
  );

  const sampleLead = useMemo(() => campaign?.leads?.[0] || null, [campaign]);

  const isSheetPitchCampaign = useMemo(
    () => Boolean(campaign?.usesSheetPitch || campaign?.messageMode === "sheet" || campaign?.sheetPitchField),
    [campaign]
  );

  const voiceReadiness = useMemo(
    () => getVoiceReadiness(voiceData, billingData),
    [billingData, voiceData]
  );

  const discoveryReady =
    leadsReady > 0 && !["discovering", "failed"].includes(campaign?.pipelineStatus);

  const canRunDigital =
    discoveryReady &&
    enabledDigitalStages.length > 0 &&
    enabledVoiceStages.length === 0 &&
    campaign?.pipelineStatus !== "running";

  const activeStage = sorted[activeStageIndex] || null;
  const activePreview = useMemo(
    () => ({
      subject: renderTemplate(activeStage?.subject || "", sampleLead),
      body: renderTemplate(activeStage?.body || "", sampleLead),
    }),
    [activeStage, sampleLead]
  );

  const copyAnalysis = useMemo(() => analyzeSequenceCopy(sorted), [sorted]);

  const updateStage = (index, key, value) => {
    setError("");
    setNotice("");
    setStages((current) =>
      current.map((stage, i) => {
        if (i !== index) return stage;
        if (key !== "channel") return { ...stage, [key]: value };
        return normalizeStageForChannel({ ...stage, channel: value }, value);
      })
    );
  };

  const addStage = (channel = "email") => {
    setError("");
    setNotice("");
    setStages((current) => {
      const next = [...current, createStage(channel)];
      setActiveStageIndex(next.length - 1);
      return next;
    });
  };

  const removeStage = (index) => {
    setStages((current) => {
      const next = current.filter((_, i) => i !== index);
      setActiveStageIndex((active) => {
        if (!next.length) return 0;
        if (active > index) return active - 1;
        return Math.min(active, next.length - 1);
      });
      return next;
    });
    notify("info", "Step removed", "Save the sequence when you are ready to keep this change.");
  };

  const insertVariable = (value) => {
    if (!activeStage) return;
    const index = activeStageIndex;
    updateStage(index, "body", `${activeStage.body || ""}${activeStage.body ? " " : ""}${value}`);
    setVariableMenuOpen(false);
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const prepareStagesForSave = () =>
    sorted.map((stage, index) => {
      const normalized = normalizeStageForChannel(stage, stage.channel);
      const isDynamicSheetStage =
        isSheetPitchCampaign && index === 0 && normalized.channel === "email";

      if (isDynamicSheetStage) {
        return {
          ...normalized,
          order: index,
          usesLeadPersonalizedMessage: true,
          dynamicBodyField: "firstImprovement",
        };
      }

      if (normalized.channel === "ai_voice") {
        return {
          ...normalized,
          order: index,
          executionMode: "voice_agent",
          disclosureRequired: true,
        };
      }

      return { ...normalized, order: index };
    });

  const save = async ({ quiet = false } = {}) => {
    if (!campaignId) {
      const message = "Choose a campaign first.";
      setError(message);
      notify("warning", "Campaign required", message);
      return null;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload = prepareStagesForSave();
      const updated = await api.updatePipeline(campaignId, payload);
      const nextCampaign = updated?.campaign || updated || campaign;

      setCampaign(nextCampaign);
      setStages(
        (nextCampaign?.pipeline?.length ? nextCampaign.pipeline : payload).map(
          (stage, index) => ({ ...stage, enabled: stage.enabled !== false, order: index })
        )
      );

      const message = enabledVoiceStages.length
        ? "Sequence saved. AI Voice steps launch from Voice Agent; digital steps use the campaign runner."
        : "Sequence saved successfully.";

      setNotice(message);
      if (!quiet) notify("success", "Sequence saved", message);
      return nextCampaign;
    } catch (requestError) {
      const message = requestError?.message || "The sequence could not be saved.";
      setError(message);
      notify("error", "Save failed", message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    if (enabledVoiceStages.length > 0) {
      const message =
        "This sequence contains an enabled AI Voice step. AI Voice launches from the Voice Agent workspace. Disable the enabled AI Voice step before running digital follow-up here.";
      setError(message);
      setLaunchReviewOpen(false);
      notify("warning", "AI Voice uses a separate launch flow", message);
      return;
    }

    if (!discoveryReady) {
      const message = "Wait until lead discovery has completed before running digital outreach.";
      setError(message);
      notify("warning", "Lead discovery is not ready", message);
      return;
    }

    if (!enabledDigitalStages.length) {
      const message = "Add or enable at least one email or WhatsApp step before running digital outreach.";
      setError(message);
      notify("warning", "Digital step required", message);
      return;
    }

    try {
      setRunning(true);
      setError("");
      setNotice("");
      setLaunchReviewOpen(false);

      const saved = await save({ quiet: true });
      if (!saved) {
        setRunning(false);
        return;
      }

      await api.runPipeline(campaignId);
      const message =
        "Digital outreach started. ReachFly will update progress and outcomes here as the campaign runs.";
      setNotice(message);
      notify("success", "Campaign launched", message);
    } catch (requestError) {
      const message = requestError?.message || "Digital outreach could not be started.";
      setError(message);
      setRunning(false);
      notify("error", "Launch failed", message);
    }
  };

  if (!canManage) {
    return (
      <>
        <PipelineBuilderStyles />
        <div className="rf-pipeline-v7">
          <section className="rfp-access-card">
            <span className="rfp-access-icon"><Workflow size={24} /></span>
            <span className="rfp-eyebrow">Restricted workspace feature</span>
            <h1>Campaign management access required</h1>
            <p>Campaign sequences are available to workspace owners, administrators, and managers.</p>
            <button
              type="button"
              className="rfp-btn rfp-btn-primary"
              onClick={() => navigate("/app/dashboard", { replace: true })}
            >
              Return to dashboard
            </button>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PipelineBuilderStyles />
      <Loader
        visible={running || campaign?.pipelineStatus === "running"}
        percent={progress.percent || 1}
        message={progress.message || "Running digital outreach"}
        title="Running digital outreach"
      />

      <div className="rf-pipeline-v7">
        <div className="rfp-topline">
          <Link
            className="rfp-back"
            to={campaignId ? `/app/campaigns/${campaignId}` : "/app/campaigns"}
          >
            <ArrowLeft size={15} />
            Campaign
          </Link>

          <div className="rfp-top-actions">
            <button
              type="button"
              className="rfp-icon-btn"
              aria-label="Refresh campaign sequence"
              title="Refresh"
              disabled={!campaignId || refreshing}
              onClick={() => void loadCampaign(campaignId, { silent: true, toast: true })}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            </button>

            <button
              type="button"
              className="rfp-btn rfp-btn-secondary"
              disabled={saving || !campaignId}
              onClick={() => void save()}
            >
              {saving ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}
              {saving ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              className="rfp-btn rfp-btn-primary"
              disabled={!campaignId || running}
              onClick={() => setLaunchReviewOpen(true)}
            >
              <Send size={15} />
              Review & Launch
            </button>
          </div>
        </div>

        <header className="rfp-header">
          <div>
            <span className="rfp-eyebrow">Campaign sequence</span>
            <h1>Messaging</h1>
            <p>Craft your outreach sequence. Preview personalization, coordinate AI Voice, and launch supported digital follow-up from one campaign workspace.</p>
          </div>

          <div className="rfp-steps" aria-label="Campaign setup progress">
            <SetupStep number="1" label="Audience" complete />
            <i />
            <SetupStep number="2" label="Channels" complete />
            <i />
            <SetupStep number="3" label="Messaging" active />
          </div>
        </header>

        <section className="rfp-campaign-strip">
          <label className="rfp-campaign-select">
            <span>Campaign</span>
            <select
              value={campaignId}
              disabled={loadingCampaigns}
              onChange={(event) => {
                const nextId = event.target.value;
                setCampaignId(nextId);
                setNotice("");
                setError("");
                if (nextId) navigate(`/app/campaigns/${nextId}/pipeline`);
              }}
            >
              <option value="">
                {loadingCampaigns ? "Loading campaigns…" : "Select campaign"}
              </option>
              {campaigns.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || "Untitled campaign"}{item.status ? ` · ${item.status}` : ""}
                </option>
              ))}
            </select>
          </label>

          <ReadinessItem
            value={formatNumber(leadsReady)}
            label="Audience"
            note={discoveryReady ? "Leads ready" : "Discovery pending"}
            tone={discoveryReady ? "success" : "neutral"}
          />
          <ReadinessItem
            value={String(enabledDigitalStages.length)}
            label="Digital steps"
            note="Email / WhatsApp"
            tone="primary"
          />
          <ReadinessItem
            value={String(enabledVoiceStages.length)}
            label="AI Voice steps"
            note={enabledVoiceStages.length ? "Voice Agent launch" : "Optional"}
            tone="violet"
          />
        </section>

        {loadingCampaign && !campaign ? <PipelineSkeleton /> : null}

        {error ? (
          <AnimatedBanner
            tone="error"
            icon={<X size={16} />}
            title="Sequence needs attention"
            message={error}
          />
        ) : null}

        {notice ? (
          <AnimatedBanner
            tone="success"
            icon={<CheckCircle2 size={16} />}
            title="Sequence updated"
            message={notice}
          />
        ) : null}

        {isSheetPitchCampaign ? (
          <AnimatedBanner
            tone="success"
            icon={<Mail size={16} />}
            title="Personalized sheet pitches are active"
            message="The first email can use {firstImprovement} to insert each lead's personalized sheet pitch."
          />
        ) : null}

        {campaign ? (
          <div className="rfp-layout">
            <main className="rfp-main">
              <section className="rfp-editor-card">
                <div className="rfp-editor-head">
                  <div className="rfp-editor-title">
                    <ChannelBadge channel={activeStage?.channel || "email"} />
                    <div>
                      <span className="rfp-eyebrow">Step {activeStageIndex + 1}</span>
                      <h2>{activeStage?.name || "Sequence step"}</h2>
                    </div>
                  </div>

                  <div className="rfp-editor-head-actions">
                    <span>{sorted.length} step{sorted.length === 1 ? "" : "s"}</span>
                    <label className="rfp-stage-switch">
                      <input
                        type="checkbox"
                        checked={activeStage?.enabled !== false}
                        onChange={(event) =>
                          updateStage(activeStageIndex, "enabled", event.target.checked)
                        }
                      />
                      <i />
                      Enabled
                    </label>
                  </div>
                </div>

                <div className="rfp-sequence-tabs">
                  {sorted.map((stage, index) => (
                    <button
                      type="button"
                      key={`${stage.id || stage.name}-${index}`}
                      className={`${index === activeStageIndex ? "active" : ""} ${
                        stage.enabled === false ? "disabled" : ""
                      }`}
                      onClick={() => setActiveStageIndex(index)}
                    >
                      <ChannelMiniIcon channel={stage.channel} />
                      <span>
                        <strong>{stage.name || `Step ${index + 1}`}</strong>
                        <small>{delayLabel(stage.delayMinutes, index)}</small>
                      </span>
                    </button>
                  ))}
                </div>

                {activeStage ? (
                  <motion.div
                    className="rfp-editor-body"
                    key={`${activeStageIndex}-${activeStage.channel}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="rfp-stage-config-grid">
                      <label>
                        <span>Step name</span>
                        <input
                          value={activeStage.name || ""}
                          onChange={(event) =>
                            updateStage(activeStageIndex, "name", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        <span>Channel</span>
                        <select
                          value={activeStage.channel}
                          onChange={(event) =>
                            updateStage(activeStageIndex, "channel", event.target.value)
                          }
                        >
                          <option value="email">Email</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="ai_voice">AI Voice</option>
                        </select>
                      </label>

                      <label>
                        <span>Delay</span>
                        <div className="rfp-delay-input">
                          <Clock size={14} />
                          <input
                            type="number"
                            min="0"
                            value={Number(activeStage.delayMinutes || 0)}
                            onChange={(event) =>
                              updateStage(
                                activeStageIndex,
                                "delayMinutes",
                                Math.max(0, Number(event.target.value || 0))
                              )
                            }
                          />
                          <small>min</small>
                        </div>
                      </label>
                    </div>

                    {activeStage.channel === "email" ? (
                      <label className="rfp-subject-field">
                        <span>Subject</span>
                        <div>
                          <input
                            value={activeStage.subject || ""}
                            onChange={(event) =>
                              updateStage(activeStageIndex, "subject", event.target.value)
                            }
                            placeholder="Subject line"
                          />
                          <Sparkles size={15} />
                        </div>
                      </label>
                    ) : null}

                    {isSheetPitchCampaign &&
                    activeStageIndex === 0 &&
                    activeStage.channel === "email" ? (
                      <div className="rfp-context-note success">
                        <Mail size={15} />
                        <div>
                          <strong>Sheet pitch format</strong>
                          <span>
                            Use <code>{"{firstImprovement}"}</code> where each lead's personalized pitch should appear.
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {activeStage.channel === "ai_voice" ? (
                      <div className="rfp-context-note voice">
                        <Phone size={15} />
                        <div>
                          <strong>AI Voice objective</strong>
                          <span>
                            This editor stores campaign context. Calls, disclosure, recording policy, calling windows, transcripts, outcomes, and meetings remain controlled by Voice Agent.
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <div className="rfp-toolbar">
                      <div className="rfp-format-actions" aria-hidden="true">
                        <button type="button" disabled title="Formatting is preserved as plain text">B</button>
                        <button type="button" disabled title="Formatting is preserved as plain text"><em>I</em></button>
                        <button type="button" disabled title="Formatting is preserved as plain text"><u>U</u></button>
                        <span />
                        <button type="button" disabled>☷</button>
                        <button type="button" disabled>≡</button>
                      </div>

                      <div className="rfp-variable-anchor">
                        <button
                          type="button"
                          className="rfp-variable-btn"
                          onClick={() => setVariableMenuOpen((value) => !value)}
                          aria-expanded={variableMenuOpen}
                        >
                          <span>{"{}"}</span>
                          Insert Variable
                        </button>

                        {variableMenuOpen ? (
                          <div className="rfp-variable-menu">
                            {variables.map((variable) => (
                              <button
                                type="button"
                                key={variable}
                                onClick={() => insertVariable(variable)}
                              >
                                {variable}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <textarea
                      ref={editorRef}
                      className="rfp-message-editor"
                      value={activeStage.body || ""}
                      onChange={(event) =>
                        updateStage(activeStageIndex, "body", event.target.value)
                      }
                      placeholder={
                        activeStage.channel === "ai_voice"
                          ? "Voice objective / campaign context"
                          : "Write your message..."
                      }
                    />

                    <div className="rfp-ai-assist-bar">
                      <span className="rfp-ai-assist-label">
                        <Sparkles size={15} /> AI Assist
                      </span>
                      <button
                        type="button"
                        onClick={() => applyRewrite(activeStageIndex, "shorten", stages, setStages)}
                      >
                        Shorten
                      </button>
                      <button
                        type="button"
                        onClick={() => applyRewrite(activeStageIndex, "cta", stages, setStages)}
                      >
                        Improve CTA
                      </button>
                      <button
                        type="button"
                        onClick={() => applyRewrite(activeStageIndex, "tone", stages, setStages)}
                      >
                        Tone
                      </button>
                      <small>Local editing helpers — no message is sent.</small>
                    </div>

                    <section className="rfp-preview">
                      <div className="rfp-preview-head">
                        <span>
                          {activeStage.channel === "ai_voice"
                            ? "Sample voice context"
                            : "Personalized preview"}
                        </span>
                        <small>{sampleLead ? getLeadBusiness(sampleLead) : "No sample lead yet"}</small>
                      </div>
                      {activeStage.channel === "email" && activePreview.subject ? (
                        <strong className="rfp-preview-subject">{activePreview.subject}</strong>
                      ) : null}
                      <p>{activePreview.body || "No sample lead available yet."}</p>
                      {activeStage.channel === "ai_voice" ? (
                        <small className="rfp-preview-legal">AI identity disclosure is mandatory. This preview never initiates a call.</small>
                      ) : null}
                    </section>
                  </motion.div>
                ) : (
                  <div className="rfp-empty-editor">
                    <Workflow size={25} />
                    <strong>Add your first sequence step</strong>
                    <span>Create an email, WhatsApp, or AI Voice step to continue.</span>
                  </div>
                )}
              </section>

              <button
                type="button"
                className="rfp-add-step"
                onClick={() => addStage("email")}
              >
                <Plus size={16} />
                Add Follow-up Step
              </button>

              <div className="rfp-stage-library">
                <button type="button" onClick={() => addStage("email")}>
                  <Mail size={16} />
                  <span><strong>Email</strong><small>Add another email follow-up</small></span>
                </button>
                <button type="button" onClick={() => addStage("whatsapp")}>
                  <MessageCircle size={16} />
                  <span><strong>WhatsApp</strong><small>Add a short messaging touch</small></span>
                </button>
                <button type="button" onClick={() => addStage("ai_voice")}>
                  <Phone size={16} />
                  <span><strong>AI Voice</strong><small>Add voice context to the sequence</small></span>
                </button>
                {activeStage ? (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeStage(activeStageIndex)}
                  >
                    <Trash2 size={16} />
                    <span><strong>Remove step</strong><small>Delete the selected step locally</small></span>
                  </button>
                ) : null}
              </div>
            </main>

            <aside className="rfp-side">
              {enabledVoiceStages.length ? (
                <section className="rfp-side-card rfp-voice-card">
                  <div className="rfp-side-card-head">
                    <div>
                      <span className="rfp-eyebrow">Voice Agent Script</span>
                      <h3>AI Voice execution</h3>
                    </div>
                    <span className={`rfp-ready-chip ${voiceReadiness.configured ? "ready" : "check"}`}>
                      {voiceReadiness.configured ? "Active" : "Check setup"}
                    </span>
                  </div>

                  <p>Configure the campaign objective here, then launch calls from the dedicated Voice Agent workspace.</p>

                  <div className="rfp-voice-preview">
                    <p>{renderTemplate(enabledVoiceStages[0]?.body || aiVoiceStarter.body, sampleLead)}</p>
                  </div>

                  <div className="rfp-voice-meta">
                    <span><small>Business number</small><strong>{voiceReadiness.number || "Not confirmed"}</strong></span>
                    <span><small>AI call credits</small><strong>{voiceReadiness.balance == null ? "—" : formatNumber(voiceReadiness.balance)}</strong></span>
                  </div>

                  <div className="rfp-side-actions">
                    <Link className="rfp-text-button" to="/app/voice-agents">
                      <Phone size={14} /> Open Voice Agent
                    </Link>
                    <Link className="rfp-text-button subtle" to="/app/billing">Credits & usage</Link>
                  </div>
                </section>
              ) : (
                <section className="rfp-side-card rfp-voice-card muted">
                  <div className="rfp-side-card-head">
                    <div>
                      <span className="rfp-eyebrow">Voice Agent Script</span>
                      <h3>AI Voice is optional</h3>
                    </div>
                    <span className="rfp-ready-chip check">Off</span>
                  </div>
                  <p>Add an AI Voice step if this campaign should include calling context. Voice launches remain separate from digital sending.</p>
                  <button type="button" className="rfp-btn rfp-btn-secondary full" onClick={() => addStage("ai_voice")}>
                    <Plus size={14} /> Add AI Voice Step
                  </button>
                </section>
              )}

              <section className="rfp-side-card rfp-analysis-card">
                <button
                  type="button"
                  className="rfp-analysis-toggle"
                  onClick={() => setAiPanelOpen((value) => !value)}
                  aria-expanded={aiPanelOpen}
                >
                  <span><Sparkles size={16} /> AI Analysis</span>
                  <span>{aiPanelOpen ? "−" : "+"}</span>
                </button>

                <AnimatePresence initial={false}>
                  {aiPanelOpen ? (
                    <motion.div
                      className="rfp-analysis-body"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <AnalysisRow label="Readability" value={copyAnalysis.readability} />
                      <AnalysisRow label="Spam Risk" value={copyAnalysis.spamRisk} />
                      <AnalysisRow label="Length" value={copyAnalysis.length} />
                      <AnalysisRow label="Variables" value={`${copyAnalysis.variableCount} used`} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>

              <section className="rfp-side-card rfp-run-card">
                <div className="rfp-side-card-head">
                  <div>
                    <span className="rfp-eyebrow">Run controls</span>
                    <h3>Campaign readiness</h3>
                  </div>
                  <Send size={17} />
                </div>

                <div className="rfp-run-progress">
                  <span><i style={{ width: `${clampPercent(progress.percent)}%` }} /></span>
                  <strong>{clampPercent(progress.percent)}%</strong>
                  <small>{progress.message || "Pipeline not started"}</small>
                </div>

                <ReadinessCheck label="Lead discovery" ready={discoveryReady} />
                <ReadinessCheck label="Digital step configured" ready={enabledDigitalStages.length > 0} />
                <ReadinessCheck label="No Voice step in digital runner" ready={enabledVoiceStages.length === 0} warning={enabledVoiceStages.length > 0} />

                <button
                  type="button"
                  className="rfp-btn rfp-btn-primary full"
                  disabled={!campaignId || running}
                  onClick={() => setLaunchReviewOpen(true)}
                >
                  <Send size={14} /> Review & Launch
                </button>
              </section>
            </aside>
          </div>
        ) : !loadingCampaign ? (
          <section className="rfp-no-campaign">
            <Workflow size={26} />
            <h2>Select a campaign to configure messaging</h2>
            <p>Choose an existing campaign above, or return to Campaigns and create one first.</p>
            <Link className="rfp-btn rfp-btn-primary" to="/app/campaigns">Open Campaigns</Link>
          </section>
        ) : null}

        <AnimatePresence>
          {launchReviewOpen ? (
            <LaunchReviewModal
              campaign={campaign}
              stages={sorted}
              leadsReady={leadsReady}
              discoveryReady={discoveryReady}
              enabledDigitalStages={enabledDigitalStages}
              enabledVoiceStages={enabledVoiceStages}
              canRunDigital={canRunDigital}
              voiceReadiness={voiceReadiness}
              running={running}
              saving={saving}
              onClose={() => !running && setLaunchReviewOpen(false)}
              onSave={() => void save()}
              onRun={() => void run()}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

function SetupStep({ number, label, complete = false, active = false }) {
  return (
    <span className={`rfp-setup-step ${active ? "active" : ""} ${complete ? "complete" : ""}`}>
      <b>{complete ? <Check size={12} /> : number}</b>
      <span><small>Step {number}:</small>{label}</span>
    </span>
  );
}

function ReadinessItem({ value, label, note, tone }) {
  return (
    <article className={`rfp-readiness-item ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </article>
  );
}

function ChannelBadge({ channel }) {
  const Icon = channel === "ai_voice" ? Phone : channel === "whatsapp" ? MessageCircle : Mail;
  const label = channel === "ai_voice" ? "AI Voice" : channel === "whatsapp" ? "WhatsApp" : "Email";
  return <span className={`rfp-channel-badge ${channel}`} title={label}><Icon size={17} /></span>;
}

function ChannelMiniIcon({ channel }) {
  const Icon = channel === "ai_voice" ? Phone : channel === "whatsapp" ? MessageCircle : Mail;
  return <span className={`rfp-channel-mini ${channel}`}><Icon size={13} /></span>;
}

function AnalysisRow({ label, value }) {
  return (
    <span className="rfp-analysis-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function ReadinessCheck({ label, ready, warning = false }) {
  return (
    <span className={`rfp-readiness-check ${ready ? "ready" : warning ? "warning" : "pending"}`}>
      <i>{ready ? <Check size={11} /> : warning ? "!" : "•"}</i>
      <span>{label}</span>
    </span>
  );
}

function AnimatedBanner({ tone, icon, title, message }) {
  return (
    <motion.section
      className={`rfp-banner ${tone}`}
      role={tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span className="rfp-banner-icon">{icon}</span>
      <div><strong>{title}</strong><span>{message}</span></div>
    </motion.section>
  );
}

function LaunchReviewModal({
  campaign,
  stages,
  leadsReady,
  discoveryReady,
  enabledDigitalStages,
  enabledVoiceStages,
  canRunDigital,
  voiceReadiness,
  running,
  saving,
  onClose,
  onSave,
  onRun,
}) {
  return (
    <motion.div
      className="rfp-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !running) onClose();
      }}
    >
      <motion.section
        className="rfp-launch-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rfp-launch-title"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
      >
        <div className="rfp-launch-head">
          <div>
            <span className="rfp-eyebrow">Review & Launch</span>
            <h2 id="rfp-launch-title">Final check before outreach starts</h2>
          </div>
          <button type="button" aria-label="Close review" disabled={running} onClick={onClose}><X size={16} /></button>
        </div>

        <div className="rfp-launch-summary">
          <SummaryMetric label="Audience" value={formatNumber(leadsReady)} />
          <SummaryMetric label="Sequence steps" value={String(stages.filter((stage) => stage.enabled !== false).length)} />
          <SummaryMetric label="Digital steps" value={String(enabledDigitalStages.length)} />
          <SummaryMetric label="AI Voice steps" value={String(enabledVoiceStages.length)} />
        </div>

        <div className="rfp-launch-checks">
          <ReadinessCheck label="Campaign selected" ready={Boolean(campaign?.id)} />
          <ReadinessCheck label="Lead discovery complete" ready={discoveryReady} />
          <ReadinessCheck label="Digital follow-up configured" ready={enabledDigitalStages.length > 0} />
          {enabledVoiceStages.length ? (
            <ReadinessCheck label="AI Voice configured in Voice Agent" ready={voiceReadiness.configured} warning={!voiceReadiness.configured} />
          ) : null}
        </div>

        {enabledVoiceStages.length ? (
          <div className="rfp-launch-warning">
            <Phone size={16} />
            <div>
              <strong>AI Voice is not sent through this digital launch button.</strong>
              <span>Save this sequence, then launch voice calls from the Voice Agent workspace. Disable the enabled AI Voice step if you want to run the digital campaign now.</span>
            </div>
          </div>
        ) : null}

        <div className="rfp-launch-sequence">
          <span>Messaging sequence</span>
          {stages.map((stage, index) => (
            <div key={`${stage.id || stage.name}-${index}`} className={stage.enabled === false ? "disabled" : ""}>
              <b>{index + 1}</b>
              <ChannelMiniIcon channel={stage.channel} />
              <span><strong>{stage.name || `Step ${index + 1}`}</strong><small>{delayLabel(stage.delayMinutes, index)}</small></span>
              <em>{stage.enabled === false ? "Disabled" : "Enabled"}</em>
            </div>
          ))}
        </div>

        <div className="rfp-launch-actions">
          <button type="button" className="rfp-btn rfp-btn-secondary" disabled={saving || running} onClick={onSave}>
            {saving ? <RefreshCw size={14} className="spin" /> : <Check size={14} />} Save Draft
          </button>
          {enabledVoiceStages.length ? (
            <Link className="rfp-btn rfp-btn-primary" to="/app/voice-agents"><Phone size={14} /> Open Voice Agent</Link>
          ) : (
            <button type="button" className="rfp-btn rfp-btn-primary" disabled={!canRunDigital || running} onClick={onRun}>
              {running ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
              {running ? "Launching..." : "Launch Campaign"}
            </button>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}

function SummaryMetric({ label, value }) {
  return <article><strong>{value}</strong><span>{label}</span></article>;
}

function PipelineSkeleton() {
  return (
    <div className="rfp-skeleton" aria-busy="true" aria-label="Loading campaign sequence">
      <div className="rfp-skeleton-main"><i /><i /><i /></div>
      <div className="rfp-skeleton-side"><i /><i /></div>
    </div>
  );
}

function createStage(channel) {
  if (channel === "ai_voice") return { ...aiVoiceStarter };
  if (channel === "whatsapp") {
    return {
      name: "New WhatsApp step",
      channel,
      delayMinutes: 1440,
      subject: "",
      body: "Hi {name}, I noticed an opportunity for {business}: {firstIssue}.",
      enabled: true,
    };
  }

  return {
    name: "New email step",
    channel: "email",
    delayMinutes: 1440,
    subject: "Quick idea for {business}",
    body: "Hi {name}, I noticed an opportunity for {business}: {firstIssue}.",
    enabled: true,
  };
}

function normalizeStageForChannel(stage, channel) {
  if (channel === "ai_voice") {
    return {
      ...stage,
      channel,
      subject: "",
      executionMode: "voice_agent",
      disclosureRequired: true,
      body: stage.body || aiVoiceStarter.body,
    };
  }

  if (channel === "whatsapp") {
    return {
      ...stage,
      channel,
      subject: "",
      executionMode: undefined,
      disclosureRequired: undefined,
    };
  }

  return {
    ...stage,
    channel: "email",
    subject: stage.subject || "Quick idea for {business}",
    executionMode: undefined,
    disclosureRequired: undefined,
  };
}

function getCampaignStages(campaign) {
  const pipeline = Array.isArray(campaign?.pipeline) && campaign.pipeline.length
    ? campaign.pipeline
    : starter;

  const hasVoiceStage = pipeline.some((stage) => stage?.channel === "ai_voice");

  if (!hasVoiceStage && isAiVoiceEnabled(campaign)) {
    return [{ ...aiVoiceStarter }, ...pipeline];
  }

  return pipeline;
}

function isAiVoiceEnabled(campaign) {
  if (!campaign) return false;
  const channels = Array.isArray(campaign.channels) ? campaign.channels : [];
  return Boolean(
    campaign.aiVoiceEnabled ||
      campaign.voiceEnabled ||
      campaign.voiceCampaignEnabled ||
      campaign.outreachPlan?.aiVoice ||
      campaign.outreach?.aiVoice ||
      channels.includes("ai_voice") ||
      campaign.pipeline?.some?.(
        (stage) => stage?.channel === "ai_voice" && stage?.enabled !== false
      )
  );
}

function getVoiceReadiness(voiceData, billingData) {
  const agent = voiceData?.agent || voiceData?.voiceAgent || voiceData?.configuredAgent || {};
  const diagnostics = voiceData?.diagnostics || voiceData?.readiness || agent?.diagnostics || {};
  const number =
    voiceData?.selectedPhoneNumber ||
    voiceData?.selectedBusinessNumber ||
    voiceData?.phoneNumber ||
    diagnostics?.selectedPhoneNumber ||
    diagnostics?.businessNumber ||
    agent?.phoneNumber ||
    agent?.businessNumber ||
    "";

  const configured = Boolean(
    diagnostics?.configured === true ||
      diagnostics?.ready === true ||
      voiceData?.configured === true ||
      voiceData?.ready === true ||
      (agent?.id && number) ||
      (agent?.elevenLabsAgentId && agent?.elevenLabsPhoneNumberId)
  );

  const rawBalance =
    billingData?.aiCalling?.wallet?.balance ??
    billingData?.aiCalling?.wallet?.available ??
    billingData?.aiCalling?.balance ??
    null;
  const numericBalance = rawBalance == null ? null : Number(rawBalance);

  return {
    configured,
    number,
    balance:
      numericBalance != null && Number.isFinite(numericBalance) ? numericBalance : null,
  };
}

function extractCampaigns(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.campaigns)) return response.campaigns;
  if (Array.isArray(response?.records)) return response.records;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function normalizeWorkspaceRole(value) {
  const role = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (role.includes("owner")) return "owner";
  if (role.includes("admin")) return "admin";
  if (role.includes("manager")) return "manager";
  if (
    role === "caller" ||
    role.includes("cold_caller") ||
    role.includes("sales_representative") ||
    role.includes("sales_rep") ||
    role.includes("telemarketer")
  ) {
    return "caller";
  }
  return role || "caller";
}

function getLeadName(lead) {
  return lead?.contact_name || lead?.contactName || lead?.name || "there";
}

function getLeadBusiness(lead) {
  return lead?.business || lead?.company || lead?.companyName || lead?.name || "your business";
}

function getLeadLocation(lead) {
  return lead?.location || lead?.address || lead?.city || "";
}

function getLeadIssue(lead) {
  return lead?.realIssue || lead?.firstIssue || lead?.category || lead?.notes || "one issue";
}

function getLeadImprovement(lead) {
  return (
    lead?.firstImprovement ||
    lead?.personalizedPitch ||
    lead?.sheetPitch ||
    lead?.recommendedFix ||
    lead?.personalizedMessage ||
    "improve one conversion workflow"
  );
}

function renderTemplate(template, lead) {
  if (!template) return "";
  const replacements = {
    "{name}": getLeadName(lead),
    "{business}": getLeadBusiness(lead),
    "{firstIssue}": getLeadIssue(lead),
    "{firstImprovement}": getLeadImprovement(lead),
    "{location}": getLeadLocation(lead),
    "{website}": lead?.website || "",
  };

  return String(template).replace(
    /\{name\}|\{business\}|\{firstIssue\}|\{firstImprovement\}|\{location\}|\{website\}/g,
    (match) => replacements[match] || ""
  );
}

function analyzeSequenceCopy(stages) {
  const enabled = stages.filter((stage) => stage.enabled !== false);
  const text = enabled.map((stage) => `${stage.subject || ""} ${stage.body || ""}`).join(" ").trim();
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const sentences = text ? text.split(/[.!?]+/).filter((part) => part.trim()) : [];
  const avgSentence = sentences.length ? words.length / sentences.length : 0;
  const variableMatches = text.match(/\{[^}]+\}/g) || [];
  const spamWords = ["free", "guaranteed", "act now", "urgent", "winner", "buy now", "limited time", "100%"];
  const lower = text.toLowerCase();
  const spamHits = spamWords.filter((word) => lower.includes(word)).length;

  return {
    readability: !words.length ? "Waiting for copy" : avgSentence <= 18 ? "Good" : avgSentence <= 26 ? "Moderate" : "Dense",
    spamRisk: spamHits === 0 ? "Low" : spamHits <= 2 ? "Medium" : "High",
    length: words.length < 45 ? "Short" : words.length <= 160 ? "Balanced" : "Long",
    variableCount: new Set(variableMatches).size,
  };
}

function applyRewrite(index, mode, stages, setStages) {
  const stage = stages[index];
  if (!stage) return;
  let body = String(stage.body || "").trim();
  if (!body) return;

  if (mode === "shorten") {
    const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 2) body = sentences.slice(0, Math.max(2, Math.ceil(sentences.length * 0.7))).join(" ");
    else if (body.length > 260) body = `${body.slice(0, 250).trim()}…`;
  }

  if (mode === "cta") {
    if (!/[?]\s*$/.test(body)) {
      body = `${body.replace(/\s+$/, "")}\n\nWould you be open to a quick conversation?`;
    }
  }

  if (mode === "tone") {
    body = body
      .replace(/\bI want to\b/gi, "I'd like to")
      .replace(/\bYou need to\b/gi, "You may want to")
      .replace(/\bASAP\b/g, "when convenient");
  }

  setStages((current) => current.map((item, i) => (i === index ? { ...item, body } : item)));
  notify("info", "Draft adjusted", "The selected step was updated locally. Review it before saving.");
}

function delayLabel(minutes, index) {
  const value = Math.max(0, Number(minutes || 0));
  if (index === 0 && value === 0) return "Send immediately";
  if (value < 60) return `Wait ${value} min`;
  if (value < 1440) {
    const hours = value / 60;
    return `Wait ${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr${hours === 1 ? "" : "s"}`;
  }
  const days = value / 1440;
  return `Wait ${Number.isInteger(days) ? days : days.toFixed(1)} day${days === 1 ? "" : "s"}`;
}

function clampPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function maybeToastPipelineEvent(parsed, ref) {
  let payload = null;
  if (parsed?.type === "pipeline_complete") {
    payload = {
      type: "success",
      title: "Campaign outreach complete",
      message: "The digital sequence finished and campaign outcomes are ready to review.",
    };
  }
  if (["pipeline_failed", "error"].includes(parsed?.type)) {
    payload = {
      type: "error",
      title: "Campaign processing failed",
      message: parsed?.message || parsed?.campaign?.error || "The campaign reported a processing failure.",
    };
  }
  if (!payload) return;

  const key = `${parsed?.type}|${payload.message}`;
  const now = Date.now();
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

function PipelineBuilderStyles() {
  return (
    <style>{`
      .rf-pipeline-v7{
        --rfp-bg:#f8f9fa;--rfp-card:#fff;--rfp-soft:#f3f4f5;--rfp-high:#eceeef;
        --rfp-text:#191c1d;--rfp-text-soft:#4c4b59;--rfp-muted:#7b7988;
        --rfp-outline:#e5e7eb;--rfp-outline-strong:#cbc9d8;
        --rfp-primary:#4648d4;--rfp-primary-dark:#3739be;--rfp-primary-soft:#eeeeff;
        --rfp-violet:#6b38d4;--rfp-violet-soft:#f3edff;
        --rfp-success:#08795a;--rfp-success-soft:#e9f8f2;
        --rfp-danger:#ba1a1a;--rfp-danger-soft:#ffedeb;
        --rfp-warning:#8a6100;--rfp-warning-soft:#fff5d8;
        --rfp-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;min-height:100%;padding:16px 32px 46px;color:var(--rfp-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfpPageIn 260ms var(--rfp-ease)
      }
      .rf-pipeline-v7 *,.rf-pipeline-v7 *::before,.rf-pipeline-v7 *::after{box-sizing:border-box}
      .rf-pipeline-v7 a{color:inherit}.rf-pipeline-v7 .spin{animation:rfpSpin .8s linear infinite}
      @keyframes rfpPageIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      @keyframes rfpSpin{to{transform:rotate(360deg)}}
      @keyframes rfpPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.48;transform:scale(.78)}}
      @keyframes rfpPop{from{opacity:0;transform:translateY(-4px) scale(.985)}to{opacity:1;transform:none}}
      @keyframes rfpShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
      .rfp-topline{min-height:36px;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:8px}
      .rfp-back{display:inline-flex;align-items:center;gap:6px;color:var(--rfp-text-soft)!important;text-decoration:none;font-size:11px;font-weight:650;transition:color .15s var(--rfp-ease),transform .15s var(--rfp-ease)}
      .rfp-back:hover{color:var(--rfp-primary)!important;transform:translateX(-1px)}
      .rfp-top-actions{display:flex;align-items:center;gap:8px}
      .rfp-header{display:flex;align-items:flex-start;justify-content:space-between;gap:26px;padding:4px 0 25px}
      .rfp-header>div:first-child{max-width:660px}.rfp-eyebrow{display:block;margin-bottom:4px;color:var(--rfp-primary);font-size:9px;font-weight:750;line-height:13px;letter-spacing:.09em;text-transform:uppercase}
      .rfp-header h1,.rfp-access-card h1,.rfp-no-campaign h2{margin:0;color:var(--rfp-text);font:600 30px/38px Geist,Inter,sans-serif;letter-spacing:-.025em}
      .rfp-header p,.rfp-access-card p,.rfp-no-campaign p{margin:6px 0 0;color:var(--rfp-text-soft);font-size:12px;line-height:18px}
      .rfp-steps{display:flex;align-items:center;gap:8px;padding-top:10px}.rfp-steps>i{width:22px;height:1px;background:#d5d4de}
      .rfp-setup-step{min-height:48px;display:flex;align-items:center;gap:8px;padding:7px 12px;background:#eff0f1;border:1px solid transparent;border-radius:999px;color:var(--rfp-text-soft)}
      .rfp-setup-step>b{width:20px;height:20px;display:grid;place-items:center;flex:0 0 20px;background:#fff;border-radius:50%;font-size:9px}
      .rfp-setup-step>span{display:grid;gap:0;font-size:9px;font-weight:650;line-height:12px}.rfp-setup-step>span small{font-size:8px;font-weight:500}
      .rfp-setup-step.active{color:#fff;background:var(--rfp-primary);box-shadow:0 5px 14px rgba(70,72,212,.18)}.rfp-setup-step.active>b{color:var(--rfp-primary)}
      .rfp-setup-step.complete>b{color:var(--rfp-primary)}
      .rfp-btn{appearance:none;min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:8px 13px;border:1px solid transparent;border-radius:8px;text-decoration:none;white-space:nowrap;cursor:pointer;font:600 11px/17px Inter,sans-serif;transition:transform .15s var(--rfp-ease),background .15s var(--rfp-ease),border-color .15s var(--rfp-ease),color .15s var(--rfp-ease),box-shadow .15s var(--rfp-ease)}
      .rfp-btn:hover:not(:disabled){transform:translateY(-1px)}.rfp-btn:active:not(:disabled){transform:scale(.985)}.rfp-btn:disabled,.rfp-icon-btn:disabled{opacity:.52;cursor:not-allowed}.rfp-btn.full{width:100%}
      .rfp-btn-primary{color:#fff!important;background:var(--rfp-primary);border-color:var(--rfp-primary);box-shadow:0 5px 14px rgba(70,72,212,.16)}.rfp-btn-primary:hover:not(:disabled){background:var(--rfp-primary-dark)}
      .rfp-btn-secondary{color:var(--rfp-text)!important;background:#fff;border-color:var(--rfp-outline)}.rfp-btn-secondary:hover:not(:disabled){color:var(--rfp-primary)!important;background:var(--rfp-primary-soft);border-color:rgba(70,72,212,.22)}
      .rfp-icon-btn{width:39px;height:39px;display:grid;place-items:center;padding:0;color:var(--rfp-text-soft);background:#fff;border:1px solid var(--rfp-outline);border-radius:8px;cursor:pointer;transition:all .15s var(--rfp-ease)}.rfp-icon-btn:hover:not(:disabled){color:var(--rfp-primary);background:var(--rfp-primary-soft);transform:translateY(-1px)}
      .rfp-campaign-strip{display:grid;grid-template-columns:minmax(280px,1.6fr) repeat(3,minmax(150px,.65fr));gap:12px;margin-bottom:16px;padding:12px;background:#fff;border:1px solid var(--rfp-outline);border-radius:13px}
      .rfp-campaign-select{display:grid;gap:4px}.rfp-campaign-select>span{color:var(--rfp-muted);font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.rfp-campaign-select select{width:100%;height:39px;padding:0 10px;color:var(--rfp-text);background:#fff;border:1px solid var(--rfp-outline);border-radius:8px;outline:0;font:500 10px/16px Inter,sans-serif}.rfp-campaign-select select:focus{border-color:rgba(70,72,212,.45);box-shadow:0 0 0 3px rgba(70,72,212,.08)}
      .rfp-readiness-item{display:grid;align-content:center;gap:0;padding:7px 10px;background:var(--rfp-soft);border-radius:9px}.rfp-readiness-item strong{color:var(--rfp-text);font:600 18px/22px Geist,Inter,sans-serif}.rfp-readiness-item span{color:var(--rfp-text-soft);font-size:9px;font-weight:650}.rfp-readiness-item small{color:var(--rfp-muted);font-size:7px}.rfp-readiness-item.primary strong{color:var(--rfp-primary)}.rfp-readiness-item.violet strong{color:var(--rfp-violet)}.rfp-readiness-item.success strong{color:var(--rfp-success)}
      .rfp-banner{display:flex;align-items:flex-start;gap:10px;padding:11px 13px;margin-bottom:13px;border:1px solid;border-radius:9px}.rfp-banner.error{color:#7b1717;background:var(--rfp-danger-soft);border-color:#ffd1cd}.rfp-banner.success{color:#075f45;background:var(--rfp-success-soft);border-color:#c8ecdf}.rfp-banner-icon{width:28px;height:28px;display:grid;place-items:center;flex:0 0 28px;background:rgba(255,255,255,.72);border-radius:8px}.rfp-banner>div{display:grid;gap:2px}.rfp-banner strong{font-size:10px;line-height:14px}.rfp-banner span{font-size:9px;line-height:14px}
      .rfp-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;align-items:start}.rfp-main{min-width:0}.rfp-side{display:grid;gap:14px;position:sticky;top:78px}
      .rfp-editor-card,.rfp-side-card{background:#fff;border:1px solid var(--rfp-outline);border-radius:15px;box-shadow:0 1px 2px rgba(25,28,29,.03)}.rfp-editor-card{overflow:visible}
      .rfp-editor-head{display:flex;align-items:center;justify-content:space-between;gap:15px;min-height:66px;padding:13px 18px;border-bottom:1px solid var(--rfp-outline)}.rfp-editor-title{min-width:0;display:flex;align-items:center;gap:10px}.rfp-editor-title h2{margin:0;max-width:520px;overflow:hidden;color:var(--rfp-text);text-overflow:ellipsis;white-space:nowrap;font:600 13px/18px Geist,Inter,sans-serif}
      .rfp-channel-badge{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;color:var(--rfp-primary);background:var(--rfp-primary-soft);border-radius:8px}.rfp-channel-badge.whatsapp{color:var(--rfp-success);background:var(--rfp-success-soft)}.rfp-channel-badge.ai_voice{color:var(--rfp-violet);background:var(--rfp-violet-soft)}
      .rfp-editor-head-actions{display:flex;align-items:center;gap:12px;color:var(--rfp-muted);font-size:8px}.rfp-stage-switch{display:flex;align-items:center;gap:5px;color:var(--rfp-text-soft);font-size:8px;font-weight:650;cursor:pointer}.rfp-stage-switch input{position:absolute;opacity:0}.rfp-stage-switch i{width:28px;height:16px;position:relative;background:#d5d5dd;border-radius:999px;transition:background .15s}.rfp-stage-switch i::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.13);transition:transform .15s}.rfp-stage-switch input:checked+i{background:var(--rfp-primary)}.rfp-stage-switch input:checked+i::after{transform:translateX(12px)}
      .rfp-sequence-tabs{display:flex;gap:1px;overflow-x:auto;padding:7px 8px;background:#fafafb;border-bottom:1px solid var(--rfp-outline)}.rfp-sequence-tabs>button{min-width:160px;display:flex;align-items:center;gap:8px;padding:8px;color:var(--rfp-text-soft);background:transparent;border:1px solid transparent;border-radius:8px;text-align:left;cursor:pointer;transition:all .15s var(--rfp-ease)}.rfp-sequence-tabs>button:hover{background:#fff}.rfp-sequence-tabs>button.active{color:var(--rfp-primary);background:#fff;border-color:rgba(70,72,212,.14);box-shadow:0 2px 7px rgba(25,28,29,.04)}.rfp-sequence-tabs>button.disabled{opacity:.55}.rfp-sequence-tabs>button>span:last-child{min-width:0;display:grid;gap:0}.rfp-sequence-tabs strong,.rfp-sequence-tabs small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rfp-sequence-tabs strong{font-size:9px}.rfp-sequence-tabs small{font-size:7px;font-weight:500;color:var(--rfp-muted)}
      .rfp-channel-mini{width:25px;height:25px;display:grid;place-items:center;flex:0 0 25px;color:var(--rfp-primary);background:var(--rfp-primary-soft);border-radius:6px}.rfp-channel-mini.whatsapp{color:var(--rfp-success);background:var(--rfp-success-soft)}.rfp-channel-mini.ai_voice{color:var(--rfp-violet);background:var(--rfp-violet-soft)}
      .rfp-editor-body{padding:18px 22px 20px}.rfp-stage-config-grid{display:grid;grid-template-columns:1.5fr .75fr .75fr;gap:10px;margin-bottom:14px}.rfp-stage-config-grid label,.rfp-subject-field{display:grid;gap:5px}.rfp-stage-config-grid label>span,.rfp-subject-field>span{color:var(--rfp-text-soft);font-size:8px;font-weight:650;letter-spacing:.04em;text-transform:uppercase}.rfp-stage-config-grid input,.rfp-stage-config-grid select,.rfp-subject-field input{width:100%;height:39px;padding:0 10px;color:var(--rfp-text);background:#fff;border:1px solid var(--rfp-outline);border-radius:8px;outline:0;font:400 10px/16px Inter,sans-serif}.rfp-stage-config-grid input:focus,.rfp-stage-config-grid select:focus,.rfp-subject-field input:focus,.rfp-message-editor:focus{border-color:rgba(70,72,212,.46);box-shadow:0 0 0 3px rgba(70,72,212,.08)}
      .rfp-delay-input{display:flex;align-items:center;gap:5px;height:39px;padding:0 8px;color:var(--rfp-muted);background:#fff;border:1px solid var(--rfp-outline);border-radius:8px}.rfp-delay-input input{height:35px;min-width:0;padding:0;border:0;box-shadow:none!important}.rfp-delay-input small{font-size:8px}
      .rfp-subject-field{margin-bottom:12px}.rfp-subject-field>div{position:relative}.rfp-subject-field svg{position:absolute;right:11px;top:50%;color:var(--rfp-violet);transform:translateY(-50%)}.rfp-subject-field input{padding-right:34px}
      .rfp-context-note{display:flex;align-items:flex-start;gap:8px;padding:10px 11px;margin-bottom:12px;border:1px solid;border-radius:8px}.rfp-context-note>svg{flex:0 0 auto}.rfp-context-note>div{display:grid;gap:2px}.rfp-context-note strong{font-size:9px}.rfp-context-note span{font-size:8px;line-height:13px}.rfp-context-note.success{color:#076145;background:var(--rfp-success-soft);border-color:#c8ecdf}.rfp-context-note.voice{color:#57319e;background:var(--rfp-violet-soft);border-color:#e0d4ff}.rfp-context-note code{padding:1px 4px;background:rgba(255,255,255,.68);border-radius:4px}
      .rfp-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:45px;padding:5px 7px;background:#fbfbfc;border:1px solid var(--rfp-outline);border-bottom:0;border-radius:9px 9px 0 0}.rfp-format-actions{display:flex;align-items:center;gap:2px}.rfp-format-actions button{width:28px;height:28px;display:grid;place-items:center;padding:0;color:#3f3f49;background:transparent;border:0;border-radius:5px;font-size:10px}.rfp-format-actions button:disabled{opacity:.8;cursor:default}.rfp-format-actions>span{width:1px;height:18px;margin:0 4px;background:var(--rfp-outline)}
      .rfp-variable-anchor{position:relative}.rfp-variable-btn{min-height:30px;display:flex;align-items:center;gap:5px;padding:5px 8px;color:var(--rfp-primary);background:var(--rfp-primary-soft);border:0;border-radius:6px;cursor:pointer;font-size:8px;font-weight:650}.rfp-variable-btn>span{font-family:monospace;font-weight:800}.rfp-variable-menu{position:absolute;z-index:30;top:36px;right:0;width:190px;display:grid;gap:2px;padding:5px;background:#fff;border:1px solid var(--rfp-outline);border-radius:9px;box-shadow:0 14px 36px rgba(25,28,29,.13);animation:rfpPop .16s var(--rfp-ease)}.rfp-variable-menu button{min-height:31px;padding:6px 8px;color:var(--rfp-text-soft);background:transparent;border:0;border-radius:6px;text-align:left;cursor:pointer;font:600 8px/12px monospace}.rfp-variable-menu button:hover{color:var(--rfp-primary);background:var(--rfp-primary-soft)}
      .rfp-message-editor{width:100%;min-height:260px;display:block;resize:vertical;padding:18px 20px;color:var(--rfp-text);background:#fff;border:1px solid var(--rfp-outline);border-radius:0 0 9px 9px;outline:0;font:400 11px/18px Inter,sans-serif;white-space:pre-wrap}
      .rfp-ai-assist-bar{width:max-content;max-width:100%;display:flex;align-items:center;gap:3px;margin:14px auto 0;padding:5px 7px;background:#fff;border:1px solid var(--rfp-outline);border-radius:999px;box-shadow:0 7px 18px rgba(25,28,29,.08)}.rfp-ai-assist-label{display:flex;align-items:center;gap:5px;padding:4px 8px;color:var(--rfp-violet);font-size:8px;font-weight:700;border-right:1px solid var(--rfp-outline)}.rfp-ai-assist-bar button{padding:5px 8px;color:var(--rfp-text);background:transparent;border:0;border-radius:999px;cursor:pointer;font-size:8px;font-weight:600}.rfp-ai-assist-bar button:hover{color:var(--rfp-primary);background:var(--rfp-primary-soft)}.rfp-ai-assist-bar small{padding:0 6px;color:var(--rfp-muted);font-size:7px}
      .rfp-preview{margin-top:15px;padding:14px;background:#fafafd;border:1px solid var(--rfp-outline);border-radius:9px}.rfp-preview-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.rfp-preview-head>span{color:var(--rfp-text-soft);font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.rfp-preview-head small{color:var(--rfp-muted);font-size:7px}.rfp-preview-subject{display:block;margin-bottom:6px;color:var(--rfp-text);font-size:10px}.rfp-preview p{margin:0;color:var(--rfp-text-soft);white-space:pre-wrap;font-size:9px;line-height:15px}.rfp-preview-legal{display:block;margin-top:7px;color:var(--rfp-warning);font-size:7px;line-height:12px}
      .rfp-empty-editor{min-height:420px;display:grid;place-items:center;align-content:center;gap:6px;color:var(--rfp-muted);text-align:center}.rfp-empty-editor>svg{color:var(--rfp-primary)}.rfp-empty-editor strong{color:var(--rfp-text);font-size:11px}.rfp-empty-editor span{font-size:9px}
      .rfp-add-step{width:100%;min-height:56px;display:flex;align-items:center;justify-content:center;gap:7px;margin-top:14px;color:var(--rfp-text);background:transparent;border:1px dashed var(--rfp-outline-strong);border-radius:10px;cursor:pointer;font-size:10px;font-weight:650;transition:all .15s var(--rfp-ease)}.rfp-add-step:hover{color:var(--rfp-primary);background:var(--rfp-primary-soft);border-color:rgba(70,72,212,.28)}
      .rfp-stage-library{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}.rfp-stage-library>button{min-height:66px;display:flex;align-items:flex-start;gap:8px;padding:10px;color:var(--rfp-text-soft);background:#fff;border:1px solid var(--rfp-outline);border-radius:9px;text-align:left;cursor:pointer;transition:all .15s var(--rfp-ease)}.rfp-stage-library>button:hover{color:var(--rfp-primary);background:var(--rfp-primary-soft);transform:translateY(-1px)}.rfp-stage-library>button.danger{color:var(--rfp-danger)}.rfp-stage-library>button.danger:hover{background:var(--rfp-danger-soft)}.rfp-stage-library>button>span{display:grid;gap:1px}.rfp-stage-library strong{font-size:9px}.rfp-stage-library small{font-size:7px;line-height:11px;color:var(--rfp-muted)}
      .rfp-side-card{padding:18px}.rfp-side-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}.rfp-side-card-head h3{margin:0;color:var(--rfp-text);font:600 12px/17px Geist,Inter,sans-serif}.rfp-side-card>p{margin:0 0 13px;color:var(--rfp-text-soft);font-size:9px;line-height:14px}.rfp-ready-chip{min-height:21px;display:inline-flex;align-items:center;padding:3px 7px;border-radius:5px;font-size:7px;font-weight:700}.rfp-ready-chip.ready{color:var(--rfp-primary);background:var(--rfp-primary-soft)}.rfp-ready-chip.check{color:#5e6170;background:#eef0f3}
      .rfp-voice-preview{min-height:138px;padding:13px;margin-bottom:12px;background:#fff;border:1px solid var(--rfp-outline);border-radius:8px}.rfp-voice-preview p{margin:0;color:var(--rfp-text);white-space:pre-wrap;font-size:9px;line-height:15px}.rfp-voice-card{background:#f8f8fa}.rfp-voice-card.muted{background:#fff}.rfp-voice-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}.rfp-voice-meta>span{display:grid;gap:1px;padding:8px;background:#fff;border-radius:7px}.rfp-voice-meta small{color:var(--rfp-muted);font-size:7px}.rfp-voice-meta strong{overflow:hidden;color:var(--rfp-text);text-overflow:ellipsis;white-space:nowrap;font-size:8px}.rfp-side-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}.rfp-text-button{display:inline-flex;align-items:center;gap:4px;color:var(--rfp-primary)!important;text-decoration:none;font-size:8px;font-weight:700}.rfp-text-button.subtle{color:var(--rfp-text-soft)!important}
      .rfp-analysis-card{padding:0;overflow:hidden}.rfp-analysis-toggle{width:100%;min-height:50px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;color:var(--rfp-text);background:transparent;border:0;cursor:pointer}.rfp-analysis-toggle>span:first-child{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700}.rfp-analysis-toggle svg{color:var(--rfp-violet)}.rfp-analysis-body{display:grid;gap:6px;overflow:hidden;padding:0 14px 14px}.rfp-analysis-row{min-height:39px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 9px;background:#fff;border:1px solid var(--rfp-outline);border-radius:7px}.rfp-analysis-row>span{color:var(--rfp-text-soft);font-size:8px}.rfp-analysis-row>strong{color:var(--rfp-text);font-size:8px}
      .rfp-run-progress{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px;margin-bottom:12px}.rfp-run-progress>span{height:5px;overflow:hidden;background:#e6e7eb;border-radius:999px}.rfp-run-progress i{display:block;height:100%;background:linear-gradient(90deg,var(--rfp-primary),#7f80ee);border-radius:999px;transition:width .25s var(--rfp-ease)}.rfp-run-progress>strong{color:var(--rfp-primary);font-size:8px}.rfp-run-progress>small{grid-column:1/-1;color:var(--rfp-muted);font-size:7px}
      .rfp-readiness-check{min-height:31px;display:flex;align-items:center;gap:7px;padding:6px 0;color:var(--rfp-text-soft);font-size:8px}.rfp-readiness-check>i{width:19px;height:19px;display:grid;place-items:center;flex:0 0 19px;border-radius:50%;font-style:normal;font-weight:800}.rfp-readiness-check.ready>i{color:var(--rfp-success);background:var(--rfp-success-soft)}.rfp-readiness-check.warning>i{color:var(--rfp-warning);background:var(--rfp-warning-soft)}.rfp-readiness-check.pending>i{color:#71717d;background:#eff0f1}.rfp-run-card>.rfp-btn{margin-top:10px}
      .rfp-no-campaign{min-height:360px;display:grid;place-items:center;align-content:center;gap:6px;padding:30px;color:var(--rfp-muted);background:#fff;border:1px dashed var(--rfp-outline-strong);border-radius:14px;text-align:center}.rfp-no-campaign>svg{color:var(--rfp-primary)}.rfp-no-campaign h2{font-size:17px;line-height:23px}.rfp-no-campaign p{max-width:480px}.rfp-no-campaign>.rfp-btn{margin-top:8px}
      .rfp-access-card{max-width:620px;padding:28px;margin-top:18px;background:#fff;border:1px solid var(--rfp-outline);border-radius:16px}.rfp-access-icon{width:46px;height:46px;display:grid;place-items:center;margin-bottom:14px;color:var(--rfp-primary);background:var(--rfp-primary-soft);border-radius:13px}.rfp-access-card h1{font-size:22px;line-height:29px}.rfp-access-card>.rfp-btn{margin-top:18px}
      .rfp-modal-backdrop{position:fixed;z-index:220;inset:0;display:grid;place-items:center;padding:20px;background:rgba(18,20,26,.37);backdrop-filter:blur(4px)}.rfp-launch-modal{width:min(720px,100%);max-height:90vh;overflow:auto;padding:22px;background:#fff;border:1px solid var(--rfp-outline);border-radius:16px;box-shadow:0 26px 80px rgba(18,20,26,.24)}.rfp-launch-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:15px;border-bottom:1px solid var(--rfp-outline)}.rfp-launch-head h2{margin:0;color:var(--rfp-text);font:600 18px/24px Geist,Inter,sans-serif}.rfp-launch-head>button{width:29px;height:29px;display:grid;place-items:center;padding:0;color:var(--rfp-muted);background:transparent;border:0;border-radius:7px;cursor:pointer}.rfp-launch-head>button:hover{color:var(--rfp-text);background:var(--rfp-soft)}
      .rfp-launch-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:15px 0}.rfp-launch-summary article{display:grid;gap:2px;padding:12px;background:var(--rfp-soft);border-radius:8px}.rfp-launch-summary strong{color:var(--rfp-text);font:600 19px/23px Geist,Inter,sans-serif}.rfp-launch-summary span{color:var(--rfp-muted);font-size:8px}.rfp-launch-checks{display:grid;grid-template-columns:1fr 1fr;column-gap:18px;margin-bottom:12px}.rfp-launch-warning{display:flex;align-items:flex-start;gap:9px;padding:11px;margin:8px 0 14px;color:#6d4d00;background:var(--rfp-warning-soft);border:1px solid #efd995;border-radius:8px}.rfp-launch-warning>svg{flex:0 0 auto}.rfp-launch-warning>div{display:grid;gap:2px}.rfp-launch-warning strong{font-size:9px}.rfp-launch-warning span{font-size:8px;line-height:13px}
      .rfp-launch-sequence{display:grid;gap:6px;padding-top:12px;border-top:1px solid var(--rfp-outline)}.rfp-launch-sequence>span{color:var(--rfp-text-soft);font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.rfp-launch-sequence>div{min-height:46px;display:flex;align-items:center;gap:8px;padding:7px 8px;background:#fafafb;border:1px solid var(--rfp-outline);border-radius:8px}.rfp-launch-sequence>div.disabled{opacity:.5}.rfp-launch-sequence>div>b{width:20px;height:20px;display:grid;place-items:center;flex:0 0 20px;color:#fff;background:var(--rfp-primary);border-radius:50%;font-size:7px}.rfp-launch-sequence>div>span{min-width:0;flex:1;display:grid}.rfp-launch-sequence>div>span strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px}.rfp-launch-sequence>div>span small{color:var(--rfp-muted);font-size:7px}.rfp-launch-sequence>div>em{color:var(--rfp-muted);font-size:7px;font-style:normal}.rfp-launch-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:16px;margin-top:16px;border-top:1px solid var(--rfp-outline)}
      .rfp-skeleton{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px}.rfp-skeleton-main,.rfp-skeleton-side{display:grid;gap:9px}.rfp-skeleton i{display:block;background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);background-size:220% 100%;border-radius:14px;animation:rfpShimmer 1.25s linear infinite}.rfp-skeleton-main i:first-child{height:70px}.rfp-skeleton-main i:nth-child(2){height:500px}.rfp-skeleton-main i:nth-child(3){height:60px}.rfp-skeleton-side i:first-child{height:290px}.rfp-skeleton-side i:nth-child(2){height:190px}
      .rfp-btn:focus-visible,.rfp-icon-btn:focus-visible,.rfp-sequence-tabs button:focus-visible,.rfp-variable-btn:focus-visible,.rfp-add-step:focus-visible,.rfp-stage-library button:focus-visible{outline:3px solid rgba(70,72,212,.16);outline-offset:2px}
      @media(max-width:1160px){.rf-pipeline-v7{padding:16px 24px 40px}.rfp-header{flex-direction:column}.rfp-steps{padding-top:0}.rfp-layout,.rfp-skeleton{grid-template-columns:minmax(0,1fr) 290px;gap:16px}.rfp-campaign-strip{grid-template-columns:minmax(260px,1.5fr) repeat(3,minmax(130px,.6fr))}.rfp-stage-library{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:930px){.rfp-layout,.rfp-skeleton{grid-template-columns:1fr}.rfp-side{position:static;grid-template-columns:1fr 1fr}.rfp-run-card{grid-column:1/-1}.rfp-campaign-strip{grid-template-columns:1fr 1fr}.rfp-campaign-select{grid-column:1/-1}.rfp-stage-config-grid{grid-template-columns:1fr 1fr}.rfp-stage-config-grid label:first-child{grid-column:1/-1}}
      @media(max-width:700px){.rf-pipeline-v7{padding:12px 14px 84px}.rfp-topline{align-items:flex-start}.rfp-top-actions{display:grid;grid-template-columns:auto 1fr}.rfp-top-actions .rfp-btn-primary{grid-column:1/-1}.rfp-header h1{font-size:25px;line-height:32px}.rfp-header p{font-size:10px;line-height:16px}.rfp-steps{width:100%;overflow:auto}.rfp-setup-step{min-width:max-content}.rfp-campaign-strip{grid-template-columns:1fr 1fr;gap:8px}.rfp-readiness-item{min-height:64px}.rfp-side{grid-template-columns:1fr}.rfp-run-card{grid-column:auto}.rfp-editor-head{align-items:flex-start;flex-direction:column}.rfp-editor-head-actions{width:100%;justify-content:space-between}.rfp-editor-body{padding:14px}.rfp-stage-config-grid{grid-template-columns:1fr}.rfp-stage-config-grid label:first-child{grid-column:auto}.rfp-toolbar{align-items:flex-start;flex-direction:column}.rfp-variable-anchor{align-self:stretch}.rfp-variable-btn{width:100%;justify-content:center}.rfp-variable-menu{left:0;right:auto}.rfp-message-editor{min-height:230px;padding:14px}.rfp-ai-assist-bar{width:100%;overflow:auto;justify-content:flex-start;border-radius:9px}.rfp-ai-assist-bar small{display:none}.rfp-stage-library{grid-template-columns:1fr 1fr}.rfp-launch-summary{grid-template-columns:1fr 1fr}.rfp-launch-checks{grid-template-columns:1fr}.rfp-launch-actions{display:grid;grid-template-columns:1fr 1fr}.rfp-launch-actions .rfp-btn{width:100%}}
      @media(max-width:460px){.rfp-top-actions{width:100%;grid-template-columns:39px 1fr}.rfp-topline{flex-direction:column}.rfp-campaign-strip{grid-template-columns:1fr}.rfp-campaign-select{grid-column:auto}.rfp-stage-library{grid-template-columns:1fr}.rfp-launch-actions{grid-template-columns:1fr}.rfp-launch-summary{grid-template-columns:1fr 1fr}.rfp-voice-meta{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){.rf-pipeline-v7,.rf-pipeline-v7 .spin,.rfp-live-dot,.rfp-skeleton i{animation:none!important}.rf-pipeline-v7 *,.rf-pipeline-v7 *::before,.rf-pipeline-v7 *::after{transition-duration:.01ms!important;scroll-behavior:auto!important}}
    `}</style>
  );
}
