import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock,
  Mail,
  MessageCircle,
  Search,
  Send,
  Trash2,
  Workflow,
} from "../components/icons";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
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

const variables = [
  "{name}",
  "{business}",
  "{firstIssue}",
  "{firstImprovement}",
  "{location}",
  "{website}",
];

export default function PipelineBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [campaignId, setCampaignId] = useState(id || "");
  const [stages, setStages] = useState(starter);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.campaigns().then((items) => {
      setCampaigns(items);
      const nextId = id || items[0]?.id || "";
      setCampaignId(nextId);
    });
  }, [id]);

  useEffect(() => {
    if (!campaignId) return;

    api
      .campaign(campaignId)
      .then((item) => {
        setCampaign(item);
        setStages(
          (item.pipeline?.length ? item.pipeline : starter).map(
            (stage, index) => ({
              ...stage,
              order: index,
            })
          )
        );
      })
      .catch((e) => setError(e.message));
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;

    const source = new EventSource(api.eventsUrl(campaignId));

    source.onmessage = (event) => {
      const parsed = JSON.parse(event.data);

      if (parsed.campaign) {
        setCampaign((current) => ({ ...(current || {}), ...parsed.campaign }));
      }

      if (["pipeline_complete", "error"].includes(parsed.type)) {
        setRunning(false);
      }
    };

    source.onerror = () => {};

    return () => source.close();
  }, [campaignId]);

  const leadsReady = campaign?.leadCount || campaign?.leads?.length || 0;

  const canRun =
    leadsReady > 0 &&
    !["discovering", "running", "failed"].includes(campaign?.pipelineStatus);

  const progress = campaign?.outreachProgress || {
    percent: 0,
    message: "Pipeline not started",
  };

  const sorted = useMemo(() => {
    return stages.map((stage, order) => ({ ...stage, order }));
  }, [stages]);

  const sampleLead = useMemo(() => {
    return campaign?.leads?.[0] || null;
  }, [campaign]);

  const isSheetPitchCampaign = useMemo(() => {
    return (
      campaign?.usesSheetPitch ||
      campaign?.messageMode === "sheet" ||
      Boolean(campaign?.sheetPitchField)
    );
  }, [campaign]);

  const updateStage = (index, key, value) => {
    setStages((current) =>
      current.map((stage, i) =>
        i === index ? { ...stage, [key]: value } : stage
      )
    );
  };

  const addStage = (channel = "email") => {
    setStages((current) => [
      ...current,
      {
        name: channel === "email" ? "New email step" : "New WhatsApp step",
        channel,
        delayMinutes: 1440,
        subject: channel === "email" ? "Quick idea for {business}" : "",
        body:
          "Hi {name}, I noticed an opportunity for {business}: {firstIssue}.",
        enabled: true,
      },
    ]);
  };

  const removeStage = (index) => {
    setStages((current) => current.filter((_, i) => i !== index));
  };

  const prepareStagesForSave = () => {
    return sorted.map((stage, index) => {
      const isDynamicSheetStage =
        isSheetPitchCampaign &&
        index === 0 &&
        stage.channel === "email";

      if (!isDynamicSheetStage) {
        return stage;
      }

      return {
        ...stage,
        usesLeadPersonalizedMessage: true,
        dynamicBodyField: "firstImprovement",
      };
    });
  };

  const save = async () => {
    if (!campaignId) {
      setError("Choose a campaign first.");
      return null;
    }

    try {
      setSaving(true);
      setError("");

      const payload = prepareStagesForSave();
      const updated = await api.updatePipeline(campaignId, payload);

      setCampaign(updated);
      setStages(
        (updated.pipeline?.length ? updated.pipeline : payload).map(
          (stage, index) => ({
            ...stage,
            order: index,
          })
        )
      );

      return updated;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    if (!canRun) {
      setError(
        "Wait until lead discovery has completed before running the outreach pipeline."
      );
      return;
    }

    try {
      setRunning(true);
      setError("");

      const saved = await save();

      if (!saved) {
        setRunning(false);
        return;
      }

      await api.runPipeline(campaignId);
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  };

  return (
    <div className="pipeline-page">
      <Loader
        visible={running || campaign?.pipelineStatus === "running"}
        percent={progress.percent || 1}
        message={progress.message || "Running pipeline"}
        title="Running outreach pipeline"
      />

      <div className="page-heading">
        <div>
          <span className="eyebrow">Pipeline builder</span>
          <h1>Simple sequence builder for non-technical users.</h1>
          <p>
            Use icons, plain-language steps, reusable variables, and clear delay
            timing for email and WhatsApp outreach.
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
            onChange={(e) => {
              setCampaignId(e.target.value);

              if (e.target.value) {
                navigate(`/app/campaigns/${e.target.value}/pipeline`);
              }
            }}
          >
            <option value="">Select campaign</option>
            {campaigns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.status}
              </option>
            ))}
          </select>
        </label>

        <div className="pipeline-readiness">
          <b>{leadsReady}</b>
          <span>leads ready</span>
          <small>{canRun ? "Ready to run" : "Complete discovery first"}</small>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isSheetPitchCampaign && (
        <div className="success-banner">
          <Mail />
          This campaign uses personalized sheet pitches. Edit the first email
          body below to change spacing, links, CTA, and signature before launch.
        </div>
      )}

      <div className="pipeline-layout-v5">
        <section className="pipeline-canvas cardish">
          <div className="pipeline-head">
            <div>
              <h2>
                <Workflow /> Sequence stages
              </h2>
              <p>
                Variables:{" "}
                {variables.map((variable) => (
                  <span className="pipeline-var-chip" key={variable}>
                    {variable}
                  </span>
                ))}
              </p>
            </div>

            <div>
              <button className="btn ghost" onClick={() => addStage("email")}>
                <Mail /> Add email
              </button>
              <button
                className="btn ghost"
                onClick={() => addStage("whatsapp")}
              >
                <MessageCircle /> Add WhatsApp
              </button>
            </div>
          </div>

          <AnimatePresence>
            {stages.map((stage, index) => {
              const isDynamicSheetStage =
                isSheetPitchCampaign &&
                index === 0 &&
                stage.channel === "email";

              const previewSubject = renderTemplate(
                stage.subject || "",
                sampleLead
              );

              const previewBody = renderTemplate(stage.body || "", sampleLead);

              return (
                <motion.article
                  className="stage-card"
                  key={`${stage.id || stage.name}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                >
                  <div className={`stage-num ${stage.channel}`}>
                    {stage.channel === "email" ? (
                      <Mail size={18} />
                    ) : (
                      <MessageCircle size={18} />
                    )}
                  </div>

                  <div className="stage-fields">
                    <div className="stage-line">
                      <input
                        value={stage.name}
                        onChange={(e) =>
                          updateStage(index, "name", e.target.value)
                        }
                        aria-label="Stage name"
                      />

                      <select
                        value={stage.channel}
                        onChange={(e) =>
                          updateStage(index, "channel", e.target.value)
                        }
                      >
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>

                      <label className="delay-field">
                        <Clock size={14} />
                        <input
                          type="number"
                          min="0"
                          value={stage.delayMinutes}
                          onChange={(e) =>
                            updateStage(
                              index,
                              "delayMinutes",
                              Number(e.target.value)
                            )
                          }
                          title="Delay minutes"
                        />
                      </label>

                      <button
                        className="icon-btn"
                        onClick={() => removeStage(index)}
                      >
                        <Trash2 />
                      </button>
                    </div>

                    {stage.channel === "email" && (
                      <input
                        value={stage.subject || ""}
                        onChange={(e) =>
                          updateStage(index, "subject", e.target.value)
                        }
                        placeholder="Subject"
                      />
                    )}

                    {isDynamicSheetStage && (
                      <div className="pipeline-dynamic-body">
                        <small>Sheet pitch format</small>
                        <b>Edit the email format here before launching.</b>
                        <p>
                          Use <code>{"{firstImprovement}"}</code> where each
                          lead’s personalized sheet pitch should appear.
                        </p>
                      </div>
                    )}

                    <textarea
                      value={stage.body || ""}
                      onChange={(e) =>
                        updateStage(index, "body", e.target.value)
                      }
                      placeholder="Message body"
                    />

                    <div className="pipeline-preview-card">
                      <small>Sample send preview</small>
                      {stage.channel === "email" && previewSubject && (
                        <b>{previewSubject}</b>
                      )}
                      <p>{previewBody || "No sample lead available yet."}</p>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </section>

        <aside className="pipeline-side cardish">
          <h3>Run controls</h3>

          <div className="outreach-meter">
            <span>
              <i style={{ width: `${progress.percent || 0}%` }} />
            </span>
            <b>{progress.percent || 0}%</b>
            <small>{progress.message}</small>
          </div>

          <button
            className="btn primary full"
            disabled={saving || running || !campaignId}
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
            disabled={running || !canRun}
            onClick={run}
          >
            {running ? (
              "Running…"
            ) : (
              <>
                <Send /> Run campaign
              </>
            )}
          </button>

          <div className="pipeline-note">
            <Search /> Outreach is rate-limited in this demo. Use responsible
            outreach and comply with local laws and platform rules.
          </div>
        </aside>
      </div>
    </div>
  );
}

function getLeadName(lead) {
  return lead?.contact_name || lead?.name || "there";
}

function getLeadBusiness(lead) {
  return lead?.business || lead?.company || lead?.name || "your business";
}

function getLeadLocation(lead) {
  return lead?.location || lead?.address || lead?.city || "";
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