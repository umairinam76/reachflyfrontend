import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Send,
  Trash2,
  Workflow,
} from "../components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
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

const DIGITAL_CHANNELS = new Set([
  "email",
  "whatsapp",
]);

export default function PipelineBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const role = normalizeWorkspaceRole(
    user?.workspaceRole ||
      user?.role ||
      ""
  );

  const canManage = [
    "owner",
    "admin",
    "manager",
  ].includes(role);

  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [campaignId, setCampaignId] = useState(id || "");
  const [stages, setStages] = useState(starter);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [voiceData, setVoiceData] = useState(null);
  const [billingData, setBillingData] = useState(null);

  const loadOptionalVoiceReadiness = useCallback(async () => {
    if (!canManage) {
      setVoiceData(null);
      setBillingData(null);
      return;
    }

    const [voiceResult, billingResult] =
      await Promise.allSettled([
        apiRequest(
          "/telnyx/ai-agent/dashboard",
          { timeoutMs: 12_000 }
        ),
        apiRequest(
          "/billing/credits",
          { timeoutMs: 12_000 }
        ),
      ]);

    setVoiceData(
      voiceResult.status === "fulfilled"
        ? voiceResult.value
        : null
    );

    setBillingData(
      billingResult.status === "fulfilled"
        ? billingResult.value
        : null
    );
  }, [canManage]);

  useEffect(() => {
    if (!user || canManage) {
      return;
    }

    navigate("/app/dashboard", {
      replace: true,
    });
  }, [
    canManage,
    navigate,
    user,
  ]);

  useEffect(() => {
    if (!canManage) {
      setCampaigns([]);
      setLoadingCampaigns(false);
      return;
    }

    let active = true;

    setLoadingCampaigns(true);
    setError("");

    Promise.all([
      api.campaigns(),
      loadOptionalVoiceReadiness(),
    ])
      .then(([response]) => {
        if (!active) return;

        const items = extractCampaigns(response);
        setCampaigns(items);

        const nextId =
          id ||
          items[0]?.id ||
          "";

        setCampaignId((current) =>
          id || current || nextId
        );
      })
      .catch((requestError) => {
        if (!active) return;

        setCampaigns([]);
        setError(
          requestError?.message ||
            "Campaigns could not be loaded."
        );
      })
      .finally(() => {
        if (active) {
          setLoadingCampaigns(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    canManage,
    id,
    loadOptionalVoiceReadiness,
  ]);

  useEffect(() => {
    if (!canManage || !campaignId) {
      setCampaign(null);
      return;
    }

    let active = true;

    setError("");

    api
      .campaign(campaignId)
      .then((item) => {
        if (!active) return;

        setCampaign(item);
        setStages(
          getCampaignStages(item).map(
            (stage, index) => ({
              ...stage,
              enabled:
                stage.enabled !== false,
              order: index,
            })
          )
        );
      })
      .catch((requestError) => {
        if (!active) return;

        setCampaign(null);
        setError(
          requestError?.message ||
            "The campaign could not be loaded."
        );
      });

    return () => {
      active = false;
    };
  }, [
    campaignId,
    canManage,
  ]);

  useEffect(() => {
    if (!canManage || !campaignId) {
      return;
    }

    const source = new EventSource(
      api.eventsUrl(campaignId)
    );

    source.onmessage = (event) => {
      let parsed;

      try {
        parsed = JSON.parse(
          event.data
        );
      } catch {
        return;
      }

      if (parsed.campaign) {
        setCampaign((current) => ({
          ...(current || {}),
          ...parsed.campaign,
        }));
      }

      if (
        [
          "pipeline_complete",
          "pipeline_failed",
          "error",
        ].includes(parsed.type)
      ) {
        setRunning(false);
      }
    };

    source.onerror = () => {};

    return () => {
      source.close();
    };
  }, [
    campaignId,
    canManage,
  ]);

  const leadsReady = Number(
    campaign?.leadCount ||
      campaign?.leads?.length ||
      0
  );

  const progress =
    campaign?.outreachProgress ||
    campaign?.progress || {
      percent: 0,
      message: "Pipeline not started",
    };

  const sorted = useMemo(
    () =>
      stages.map(
        (stage, order) => ({
          ...stage,
          order,
        })
      ),
    [stages]
  );

  const enabledVoiceStages = useMemo(
    () =>
      sorted.filter(
        (stage) =>
          stage.enabled !== false &&
          stage.channel === "ai_voice"
      ),
    [sorted]
  );

  const enabledDigitalStages = useMemo(
    () =>
      sorted.filter(
        (stage) =>
          stage.enabled !== false &&
          DIGITAL_CHANNELS.has(
            stage.channel
          )
      ),
    [sorted]
  );

  const sampleLead = useMemo(
    () =>
      campaign?.leads?.[0] ||
      null,
    [campaign]
  );

  const isSheetPitchCampaign = useMemo(
    () =>
      Boolean(
        campaign?.usesSheetPitch ||
          campaign?.messageMode ===
            "sheet" ||
          campaign?.sheetPitchField
      ),
    [campaign]
  );

  const voiceReadiness = useMemo(
    () =>
      getVoiceReadiness(
        voiceData,
        billingData
      ),
    [
      billingData,
      voiceData,
    ]
  );

  const discoveryReady =
    leadsReady > 0 &&
    ![
      "discovering",
      "failed",
    ].includes(
      campaign?.pipelineStatus
    );

  /*
   * The existing runPipeline contract is proven for the digital pipeline.
   * It is not used for enabled AI Voice stages here. Voice execution stays
   * in the Voice Agent workflow so this page cannot imply unsupported launch
   * behavior or accidentally send an unknown channel through the digital runner.
   */
  const canRunDigital =
    discoveryReady &&
    enabledDigitalStages.length > 0 &&
    enabledVoiceStages.length === 0 &&
    campaign?.pipelineStatus !==
      "running";

  const updateStage = (
    index,
    key,
    value
  ) => {
    setError("");
    setNotice("");

    setStages((current) =>
      current.map((stage, i) => {
        if (i !== index) {
          return stage;
        }

        if (key !== "channel") {
          return {
            ...stage,
            [key]: value,
          };
        }

        return normalizeStageForChannel(
          {
            ...stage,
            channel: value,
          },
          value
        );
      })
    );
  };

  const addStage = (
    channel = "email"
  ) => {
    setError("");
    setNotice("");

    setStages((current) => [
      ...current,
      createStage(channel),
    ]);
  };

  const removeStage = (index) => {
    setStages((current) =>
      current.filter(
        (_, i) => i !== index
      )
    );
  };

  const prepareStagesForSave = () =>
    sorted.map((stage, index) => {
      const normalized =
        normalizeStageForChannel(
          stage,
          stage.channel
        );

      const isDynamicSheetStage =
        isSheetPitchCampaign &&
        index === 0 &&
        normalized.channel ===
          "email";

      if (isDynamicSheetStage) {
        return {
          ...normalized,
          order: index,
          usesLeadPersonalizedMessage:
            true,
          dynamicBodyField:
            "firstImprovement",
        };
      }

      if (
        normalized.channel ===
        "ai_voice"
      ) {
        return {
          ...normalized,
          order: index,
          executionMode:
            "voice_agent",
          disclosureRequired:
            true,
        };
      }

      return {
        ...normalized,
        order: index,
      };
    });

  const save = async () => {
    if (!campaignId) {
      setError(
        "Choose a campaign first."
      );
      return null;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload =
        prepareStagesForSave();

      const updated =
        await api.updatePipeline(
          campaignId,
          payload
        );

      const nextCampaign =
        updated?.campaign ||
        updated ||
        campaign;

      setCampaign(nextCampaign);
      setStages(
        (
          nextCampaign?.pipeline?.length
            ? nextCampaign.pipeline
            : payload
        ).map(
          (stage, index) => ({
            ...stage,
            enabled:
              stage.enabled !== false,
            order: index,
          })
        )
      );

      setNotice(
        enabledVoiceStages.length
          ? "Pipeline saved. AI Voice stages are launched from Voice Agent; digital stages use the campaign runner."
          : "Pipeline saved."
      );

      return nextCampaign;
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The pipeline could not be saved."
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    if (
      enabledVoiceStages.length > 0
    ) {
      setError(
        "This sequence contains an enabled AI Voice stage. AI Voice is launched from the Voice Agent workspace, not through the digital campaign runner. Disable the AI Voice stage before running digital follow-up here."
      );
      return;
    }

    if (!discoveryReady) {
      setError(
        "Wait until lead discovery has completed before running digital outreach."
      );
      return;
    }

    if (
      !enabledDigitalStages.length
    ) {
      setError(
        "Add or enable at least one email or WhatsApp stage before running digital outreach."
      );
      return;
    }

    try {
      setRunning(true);
      setError("");
      setNotice("");

      const saved = await save();

      if (!saved) {
        setRunning(false);
        return;
      }

      await api.runPipeline(
        campaignId
      );

      setNotice(
        "Digital outreach started. AI Voice, if configured separately, remains controlled from Voice Agent."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Digital outreach could not be started."
      );
      setRunning(false);
    }
  };

  if (!canManage) {
    return (
      <div className="page pipeline-page">
        <div className="card">
          <span className="eyebrow">
            Restricted workspace feature
          </span>
          <h1>
            Campaign management access required
          </h1>
          <p className="text-muted">
            Campaign pipelines are available to workspace owners, administrators, and managers.
          </p>
          <button
            type="button"
            className="btn primary mt16"
            onClick={() =>
              navigate(
                "/app/dashboard",
                { replace: true }
              )
            }
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pipeline-page">
      <Loader
        visible={
          running ||
          campaign?.pipelineStatus ===
            "running"
        }
        percent={
          progress.percent || 1
        }
        message={
          progress.message ||
          "Running digital outreach"
        }
        title="Running digital outreach"
      />

      <div className="page-heading">
        <div>
          <span className="eyebrow">
            Campaign pipeline
          </span>
          <h1>
            Coordinate AI Voice and digital follow-up.
          </h1>
          <p>
            Build email and WhatsApp follow-up here, keep AI Voice visible in the sequence, and launch voice conversations from the dedicated Voice Agent workspace.
          </p>
        </div>

        <Link
          className="btn ghost"
          to={
            campaignId
              ? `/app/campaigns/${campaignId}`
              : "/app/campaigns/history"
          }
        >
          <ArrowLeft /> Back
        </Link>
      </div>

      <div className="pipeline-toolbar cardish">
        <label>
          <span>Campaign</span>
          <select
            value={campaignId}
            disabled={
              loadingCampaigns
            }
            onChange={(event) => {
              const nextId =
                event.target.value;

              setCampaignId(nextId);
              setNotice("");
              setError("");

              if (nextId) {
                navigate(
                  `/app/campaigns/${nextId}/pipeline`
                );
              }
            }}
          >
            <option value="">
              {loadingCampaigns
                ? "Loading campaigns…"
                : "Select campaign"}
            </option>

            {campaigns.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name ||
                    "Untitled campaign"}
                  {item.status
                    ? ` · ${item.status}`
                    : ""}
                </option>
              )
            )}
          </select>
        </label>

        <div className="pipeline-readiness">
          <b>{leadsReady}</b>
          <span>leads ready</span>
          <small>
            {discoveryReady
              ? "Lead discovery ready"
              : "Complete discovery first"}
          </small>
        </div>

        <div className="pipeline-readiness">
          <b>
            {enabledDigitalStages.length}
          </b>
          <span>digital stages</span>
          <small>
            Email / WhatsApp runner
          </small>
        </div>

        <div className="pipeline-readiness">
          <b>
            {enabledVoiceStages.length}
          </b>
          <span>AI Voice stages</span>
          <small>
            {enabledVoiceStages.length
              ? "Launch from Voice Agent"
              : "Optional"}
          </small>
        </div>
      </div>

      {error ? (
        <div
          className="error-banner"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          className="success-banner"
          role="status"
        >
          <Check /> {notice}
        </div>
      ) : null}

      {isSheetPitchCampaign ? (
        <div className="success-banner">
          <Mail />
          This campaign uses personalized sheet pitches. Edit the first email body below to change spacing, links, CTA, and signature before digital launch.
        </div>
      ) : null}

      {enabledVoiceStages.length ? (
        <section className="cardish pipeline-voice-readiness">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">
                AI Voice execution
              </span>
              <h3>
                Voice stages use the dedicated Voice Agent workflow
              </h3>
              <p>
                This editor stores the AI Voice stage and its campaign context, but it does not send that stage through the digital pipeline runner. That prevents the UI from claiming a voice launch path the runner does not expose.
              </p>
            </div>

            <Phone />
          </div>

          <div className="grid4 mt16">
            <PipelineReadinessMetric
              label="Voice setup"
              value={
                voiceReadiness.configured
                  ? "Ready"
                  : "Check setup"
              }
              note={
                voiceReadiness.number
                  ? `Business number ${voiceReadiness.number}`
                  : "Verify agent and business number"
              }
            />

            <PipelineReadinessMetric
              label="AI call credits"
              value={
                voiceReadiness.balance == null
                  ? "—"
                  : formatNumber(
                      voiceReadiness.balance
                    )
              }
              note="Dedicated call-credit wallet"
            />

            <PipelineReadinessMetric
              label="Disclosure"
              value="Required"
              note="AI identity + recording policy"
            />

            <PipelineReadinessMetric
              label="Execution"
              value="Voice Agent"
              note="Calls, transcripts, outcomes and meetings"
            />
          </div>

          <div className="flex flex-gap flex-wrap mt16">
            <Link
              className="btn primary"
              to="/app/voice-agent"
            >
              <Phone /> Open Voice Agent
            </Link>

            <Link
              className="btn light"
              to="/app/billing"
            >
              Credits &amp; usage
            </Link>
          </div>
        </section>
      ) : null}

      <div className="pipeline-layout-v5">
        <section className="pipeline-canvas cardish">
          <div className="pipeline-head">
            <div>
              <h2>
                <Workflow /> Sequence stages
              </h2>
              <p>
                Variables:{" "}
                {variables.map(
                  (variable) => (
                    <span
                      className="pipeline-var-chip"
                      key={variable}
                    >
                      {variable}
                    </span>
                  )
                )}
              </p>
            </div>

            <div className="flex flex-gap flex-wrap">
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  addStage("ai_voice")
                }
              >
                <Phone /> Add AI Voice
              </button>

              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  addStage("email")
                }
              >
                <Mail /> Add email
              </button>

              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  addStage("whatsapp")
                }
              >
                <MessageCircle /> Add WhatsApp
              </button>
            </div>
          </div>

          <AnimatePresence>
            {stages.map(
              (stage, index) => {
                const isVoice =
                  stage.channel ===
                  "ai_voice";

                const isDynamicSheetStage =
                  isSheetPitchCampaign &&
                  index === 0 &&
                  stage.channel ===
                    "email";

                const previewSubject =
                  renderTemplate(
                    stage.subject || "",
                    sampleLead
                  );

                const previewBody =
                  renderTemplate(
                    stage.body || "",
                    sampleLead
                  );

                return (
                  <motion.article
                    className={`stage-card ${
                      stage.enabled === false
                        ? "disabled"
                        : ""
                    }`}
                    key={`${
                      stage.id ||
                      stage.name
                    }-${index}`}
                    initial={{
                      opacity: 0,
                      y: 10,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.98,
                    }}
                  >
                    <div
                      className={`stage-num ${stage.channel}`}
                    >
                      {isVoice ? (
                        <Phone size={18} />
                      ) : stage.channel ===
                        "email" ? (
                        <Mail size={18} />
                      ) : (
                        <MessageCircle
                          size={18}
                        />
                      )}
                    </div>

                    <div className="stage-fields">
                      <div className="stage-line">
                        <input
                          value={
                            stage.name || ""
                          }
                          onChange={(event) =>
                            updateStage(
                              index,
                              "name",
                              event.target.value
                            )
                          }
                          aria-label="Stage name"
                        />

                        <select
                          value={
                            stage.channel
                          }
                          onChange={(event) =>
                            updateStage(
                              index,
                              "channel",
                              event.target.value
                            )
                          }
                        >
                          <option value="ai_voice">
                            AI Voice
                          </option>
                          <option value="email">
                            Email
                          </option>
                          <option value="whatsapp">
                            WhatsApp
                          </option>
                        </select>

                        <label className="delay-field">
                          <Clock size={14} />
                          <input
                            type="number"
                            min="0"
                            value={
                              Number(
                                stage.delayMinutes ||
                                  0
                              )
                            }
                            onChange={(event) =>
                              updateStage(
                                index,
                                "delayMinutes",
                                Math.max(
                                  0,
                                  Number(
                                    event.target.value ||
                                      0
                                  )
                                )
                              )
                            }
                            title="Delay minutes"
                          />
                        </label>

                        <label className="pipeline-stage-enabled">
                          <input
                            type="checkbox"
                            checked={
                              stage.enabled !==
                              false
                            }
                            onChange={(event) =>
                              updateStage(
                                index,
                                "enabled",
                                event.target.checked
                              )
                            }
                          />
                          <span>Enabled</span>
                        </label>

                        <button
                          className="icon-btn"
                          type="button"
                          onClick={() =>
                            removeStage(index)
                          }
                          aria-label="Remove stage"
                          title="Remove stage"
                        >
                          <Trash2 />
                        </button>
                      </div>

                      {stage.channel ===
                      "email" ? (
                        <input
                          value={
                            stage.subject || ""
                          }
                          onChange={(event) =>
                            updateStage(
                              index,
                              "subject",
                              event.target.value
                            )
                          }
                          placeholder="Subject"
                        />
                      ) : null}

                      {isDynamicSheetStage ? (
                        <div className="pipeline-dynamic-body">
                          <small>
                            Sheet pitch format
                          </small>
                          <b>
                            Edit the email format here before launching.
                          </b>
                          <p>
                            Use{" "}
                            <code>
                              {
                                "{firstImprovement}"
                              }
                            </code>{" "}
                            where each lead&apos;s personalized sheet pitch should appear.
                          </p>
                        </div>
                      ) : null}

                      {isVoice ? (
                        <div className="pipeline-dynamic-body">
                          <small>
                            AI Voice stage
                          </small>
                          <b>
                            Configuration here; execution in Voice Agent.
                          </b>
                          <p>
                            Keep the objective concise and grounded in verified lead context. The active Voice Agent remains responsible for AI disclosure, recording policy, calling-window checks, suppression rules, transcripts, outcomes, and meetings.
                          </p>
                        </div>
                      ) : null}

                      <textarea
                        value={
                          stage.body || ""
                        }
                        onChange={(event) =>
                          updateStage(
                            index,
                            "body",
                            event.target.value
                          )
                        }
                        placeholder={
                          isVoice
                            ? "Voice objective / campaign context"
                            : "Message body"
                        }
                      />

                      <div className="pipeline-preview-card">
                        <small>
                          {isVoice
                            ? "Sample voice context"
                            : "Sample send preview"}
                        </small>

                        {stage.channel ===
                          "email" &&
                        previewSubject ? (
                          <b>
                            {previewSubject}
                          </b>
                        ) : null}

                        <p>
                          {previewBody ||
                            "No sample lead available yet."}
                        </p>

                        {isVoice ? (
                          <small>
                            AI identity disclosure is mandatory. This preview does not initiate a call.
                          </small>
                        ) : null}
                      </div>
                    </div>
                  </motion.article>
                );
              }
            )}
          </AnimatePresence>
        </section>

        <aside className="pipeline-side cardish">
          <h3>Run controls</h3>

          <div className="outreach-meter">
            <span>
              <i
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      Number(
                        progress.percent ||
                          0
                      )
                    )
                  )}%`,
                }}
              />
            </span>
            <b>
              {Math.max(
                0,
                Math.min(
                  100,
                  Number(
                    progress.percent || 0
                  )
                )
              )}
              %
            </b>
            <small>
              {progress.message ||
                "Pipeline not started"}
            </small>
          </div>

          <button
            className="btn primary full"
            type="button"
            disabled={
              saving ||
              running ||
              !campaignId
            }
            onClick={save}
          >
            {saving ? (
              "Saving…"
            ) : (
              <>
                <Check /> Save pipeline
              </>
            )}
          </button>

          <button
            className="btn dark full"
            type="button"
            disabled={
              running ||
              !canRunDigital
            }
            onClick={run}
            title={
              enabledVoiceStages.length
                ? "AI Voice stages launch from Voice Agent. Disable the enabled AI Voice stage before using the digital runner."
                : !enabledDigitalStages.length
                  ? "Add or enable an email or WhatsApp stage first."
                  : !discoveryReady
                    ? "Complete lead discovery first."
                    : "Run the enabled digital stages."
            }
          >
            {running ? (
              "Running…"
            ) : (
              <>
                <Send /> Run digital follow-up
              </>
            )}
          </button>

          {enabledVoiceStages.length ? (
            <Link
              className="btn light full"
              to="/app/voice-agent"
            >
              <Phone /> Open AI Voice launch
            </Link>
          ) : null}

          <div className="pipeline-note">
            <Search />
            Digital outreach uses the existing campaign runner. AI Voice uses its dedicated launch workflow. Keep outreach compliant with applicable calling, messaging, consent, suppression, and recording requirements.
          </div>
        </aside>
      </div>
    </div>
  );
}

function PipelineReadinessMetric({
  label,
  value,
  note,
}) {
  return (
    <article className="metric-card">
      <div className="metric-num sm">
        {value}
      </div>
      <div className="metric-label">
        {label}
      </div>
      {note ? (
        <small className="text-muted">
          {note}
        </small>
      ) : null}
    </article>
  );
}

function createStage(channel) {
  if (channel === "ai_voice") {
    return {
      ...aiVoiceStarter,
    };
  }

  if (channel === "whatsapp") {
    return {
      name: "New WhatsApp step",
      channel,
      delayMinutes: 1440,
      subject: "",
      body:
        "Hi {name}, I noticed an opportunity for {business}: {firstIssue}.",
      enabled: true,
    };
  }

  return {
    name: "New email step",
    channel: "email",
    delayMinutes: 1440,
    subject:
      "Quick idea for {business}",
    body:
      "Hi {name}, I noticed an opportunity for {business}: {firstIssue}.",
    enabled: true,
  };
}

function normalizeStageForChannel(
  stage,
  channel
) {
  if (channel === "ai_voice") {
    return {
      ...stage,
      channel,
      subject: "",
      executionMode:
        "voice_agent",
      disclosureRequired:
        true,
      body:
        stage.body ||
        aiVoiceStarter.body,
    };
  }

  if (channel === "whatsapp") {
    return {
      ...stage,
      channel,
      subject: "",
      executionMode:
        undefined,
      disclosureRequired:
        undefined,
    };
  }

  return {
    ...stage,
    channel: "email",
    subject:
      stage.subject ||
      "Quick idea for {business}",
    executionMode:
      undefined,
    disclosureRequired:
      undefined,
  };
}

function getCampaignStages(campaign) {
  const pipeline =
    Array.isArray(campaign?.pipeline) &&
    campaign.pipeline.length
      ? campaign.pipeline
      : starter;

  const hasVoiceStage =
    pipeline.some(
      (stage) =>
        stage?.channel ===
        "ai_voice"
    );

  if (
    !hasVoiceStage &&
    isAiVoiceEnabled(campaign)
  ) {
    return [
      {
        ...aiVoiceStarter,
      },
      ...pipeline,
    ];
  }

  return pipeline;
}

function isAiVoiceEnabled(campaign) {
  if (!campaign) {
    return false;
  }

  const channels =
    Array.isArray(campaign.channels)
      ? campaign.channels
      : [];

  return Boolean(
    campaign.aiVoiceEnabled ||
      campaign.voiceEnabled ||
      campaign.voiceCampaignEnabled ||
      campaign.outreachPlan?.aiVoice ||
      campaign.outreach?.aiVoice ||
      channels.includes("ai_voice") ||
      campaign.pipeline?.some?.(
        (stage) =>
          stage?.channel ===
            "ai_voice" &&
          stage?.enabled !== false
      )
  );
}

function getVoiceReadiness(
  voiceData,
  billingData
) {
  const agent =
    voiceData?.agent ||
    voiceData?.voiceAgent ||
    voiceData?.configuredAgent ||
    {};

  const diagnostics =
    voiceData?.diagnostics ||
    voiceData?.readiness ||
    agent?.diagnostics ||
    {};

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
      (
        agent?.id &&
        number
      ) ||
      (
        agent?.elevenLabsAgentId &&
        agent?.elevenLabsPhoneNumberId
      )
  );

  const rawBalance =
    billingData?.aiCalling?.wallet
      ?.balance ??
    billingData?.aiCalling?.wallet
      ?.available ??
    billingData?.aiCalling
      ?.balance ??
    null;

  const numericBalance =
    rawBalance == null
      ? null
      : Number(rawBalance);

  return {
    configured,
    number,
    balance:
      numericBalance != null &&
      Number.isFinite(
        numericBalance
      )
        ? numericBalance
        : null,
  };
}

function extractCampaigns(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    Array.isArray(
      response?.campaigns
    )
  ) {
    return response.campaigns;
  }

  if (
    Array.isArray(
      response?.records
    )
  ) {
    return response.records;
  }

  return [];
}

function normalizeWorkspaceRole(value) {
  const role = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (role.includes("owner")) {
    return "owner";
  }

  if (role.includes("admin")) {
    return "admin";
  }

  if (role.includes("manager")) {
    return "manager";
  }

  if (
    role === "caller" ||
    role.includes("cold_caller") ||
    role.includes(
      "sales_representative"
    ) ||
    role.includes("sales_rep") ||
    role.includes("telemarketer")
  ) {
    return "caller";
  }

  return role || "caller";
}

function getLeadName(lead) {
  return (
    lead?.contact_name ||
    lead?.contactName ||
    lead?.name ||
    "there"
  );
}

function getLeadBusiness(lead) {
  return (
    lead?.business ||
    lead?.company ||
    lead?.companyName ||
    lead?.name ||
    "your business"
  );
}

function getLeadLocation(lead) {
  return (
    lead?.location ||
    lead?.address ||
    lead?.city ||
    ""
  );
}

function getLeadIssue(lead) {
  return (
    lead?.realIssue ||
    lead?.firstIssue ||
    lead?.category ||
    lead?.notes ||
    "one issue"
  );
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

function renderTemplate(
  template,
  lead
) {
  if (!template) return "";

  const replacements = {
    "{name}": getLeadName(lead),
    "{business}":
      getLeadBusiness(lead),
    "{firstIssue}":
      getLeadIssue(lead),
    "{firstImprovement}":
      getLeadImprovement(lead),
    "{location}":
      getLeadLocation(lead),
    "{website}":
      lead?.website || "",
  };

  return String(template).replace(
    /\{name\}|\{business\}|\{firstIssue\}|\{firstImprovement\}|\{location\}|\{website\}/g,
    (match) =>
      replacements[match] || ""
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    undefined,
    {
      maximumFractionDigits: 3,
    }
  ).format(Number(value || 0));
}