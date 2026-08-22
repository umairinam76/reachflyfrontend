import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  Clock3,
  Globe2,
  Phone,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Zap,
} from "../components/icons";
import { api } from "../api";

const MODES = [
  {
    id: "inbound",
    eyebrow: "Inbound AI",
    title: "Answer every business call",
    description:
      "Give customers a consistent AI receptionist that can answer questions, qualify intent, book approved appointments and capture the next action.",
    direction: "↓",
    icon: Phone,
    highlights: ["Business-number routing", "Booking & caller intake", "Business-hours aware"],
  },
  {
    id: "outbound",
    eyebrow: "Outbound AI",
    title: "Call leads with context",
    description:
      "Use a controlled AI sales agent for campaigns, follow-up, qualification and meeting booking while keeping the configured business context attached.",
    direction: "↑",
    icon: Bot,
    highlights: ["Campaign-ready calling", "Lead-specific context", "Qualification & follow-up"],
  },
  {
    id: "both",
    eyebrow: "Inbound + outbound",
    title: "One agent for both directions",
    description:
      "Use the same business-aware AI agent for incoming calls and outbound campaigns, with separate openings and one connected business memory.",
    direction: "↕",
    icon: Zap,
    highlights: ["One connected agent", "Separate call openings", "Shared business memory"],
  },
];

export default function VoiceStartPage() {
  const [searchParams] = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";

  const [dashboard, setDashboard] = useState(null);
  const [commerce, setCommerce] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashboardResult, commerceResult] = await Promise.allSettled([
        api.voiceAgentDashboard(),
        api.voiceCommerce(),
      ]);

      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value || null);
      } else {
        setDashboard(null);
      }

      if (commerceResult.status === "fulfilled") {
        setCommerce(commerceResult.value || null);
      } else {
        setCommerce(null);
      }

      if (dashboardResult.status === "rejected" && commerceResult.status === "rejected") {
        setError(
          dashboardResult.reason?.message ||
            commerceResult.reason?.message ||
            "ReachFly could not load your current AI calling setup."
        );
      } else {
        setError("");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const agents = useMemo(() => normalizeAgents(dashboard), [dashboard]);
  const activeNumbers = useMemo(() => normalizeNumbers(commerce), [commerce]);
  const readyAgents = useMemo(
    () => agents.filter((agent) => getAgentReadiness(agent).ready),
    [agents]
  );

  const workspaceReadiness = useMemo(() => {
    const hasAgent = agents.length > 0;
    const hasBrain = agents.some(hasBusinessBrain);
    const hasNumber = activeNumbers.length > 0 || agents.some((agent) => Boolean(agent?.fromNumber));
    const hasDirection = agents.some((agent) => ["inbound", "outbound", "both"].includes(normalizeToken(agent?.callingMode)));
    const hasReadyAgent = readyAgents.length > 0;

    const steps = [
      {
        id: "agent",
        label: "AI agent",
        detail: hasAgent ? `${agents.length} created` : "Create your first agent",
        ready: hasAgent,
        href: "/app/agents",
        icon: Bot,
      },
      {
        id: "brain",
        label: "Business Brain",
        detail: hasBrain ? "Context connected" : "Add business context",
        ready: hasBrain,
        href: "/app/agents",
        icon: Brain,
      },
      {
        id: "number",
        label: "Business number",
        detail: hasNumber ? "Number available" : "Choose a number",
        ready: hasNumber,
        href: "/app/phone-numbers",
        icon: Building2,
      },
      {
        id: "direction",
        label: "Call direction",
        detail: hasDirection ? "Inbound / outbound set" : "Choose call direction",
        ready: hasDirection,
        href: "/app/agents",
        icon: Target,
      },
      {
        id: "live",
        label: "Ready to call",
        detail: hasReadyAgent ? `${readyAgents.length} agent${readyAgents.length === 1 ? "" : "s"} ready` : "Finish setup",
        ready: hasReadyAgent,
        href: hasReadyAgent ? "/app/calls" : "/app/agents",
        icon: CheckCircle2,
      },
    ];

    return {
      steps,
      complete: steps.filter((step) => step.ready).length,
      total: steps.length,
      ready: hasReadyAgent,
    };
  }, [agents, activeNumbers, readyAgents]);

  const primaryAgent = readyAgents[0] || agents[0] || null;
  const missingForPrimary = primaryAgent ? getAgentReadiness(primaryAgent).missing : [];

  const modeHref = (mode) =>
    `/app/voice-agent?tab=setup&view=calling&mode=${mode}${
      onboarding ? "&onboarding=1" : ""
    }`;

  return (
    <>
      <VoiceStartStyles />

      <main className="rf-voice-start-v10">
        <header className="rfvs-head">
          <div className="rfvs-head-copy">
            <span className="rfvs-pill">
              <Sparkles size={14} />
              {onboarding ? "Workspace ready" : "ReachFly AI Voice"}
            </span>
            <h1>Your AI calling journey, connected from setup to live calls.</h1>
            <p>
              Create the agent, connect its business knowledge and number, choose the call direction,
              then use the same agent for inbound calls or outbound campaigns.
            </p>
          </div>

          <div className="rfvs-head-actions">
            <button
              type="button"
              className="rfvs-refresh"
              onClick={() => void load({ silent: true })}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? "spin" : ""} />
              Refresh status
            </button>
            <Link className="rfvs-manage" to="/app/agents">
              Manage AI agents
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        {onboarding ? (
          <section className="rfvs-credit-note">
            <span><Sparkles size={15} /></span>
            <div>
              <strong>Your 10 free ReachFly credits are ready.</strong>
              <p>Build the agent first, then use your credits on metered calling features.</p>
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="rfvs-error">
            <Shield size={16} />
            <div>
              <strong>Live setup status is temporarily unavailable.</strong>
              <p>{error} You can still continue configuring your AI agent.</p>
            </div>
          </section>
        ) : null}

        <section className="rfvs-journey-card">
          <div className="rfvs-journey-head">
            <div>
              <span>Workspace readiness</span>
              <strong>
                {loading
                  ? "Checking your connected AI calling setup…"
                  : workspaceReadiness.ready
                    ? "Your AI calling foundation is ready."
                    : `${workspaceReadiness.complete} of ${workspaceReadiness.total} setup stages connected.`}
              </strong>
            </div>

            <div className={`rfvs-readiness ${workspaceReadiness.ready ? "ready" : ""}`}>
              <span>{loading ? "…" : Math.round((workspaceReadiness.complete / workspaceReadiness.total) * 100)}%</span>
              <small>{workspaceReadiness.ready ? "Ready" : "Setup"}</small>
            </div>
          </div>

          <div className="rfvs-journey-line" aria-label="AI calling setup journey">
            {workspaceReadiness.steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div className="rfvs-step-wrap" key={step.id}>
                  <Link className={`rfvs-step ${step.ready ? "ready" : ""}`} to={step.href}>
                    <span className="rfvs-step-icon">
                      {step.ready ? <CheckCircle2 size={17} /> : <Icon size={17} />}
                    </span>
                    <span className="rfvs-step-copy">
                      <b>{step.label}</b>
                      <small>{loading ? "Checking…" : step.detail}</small>
                    </span>
                  </Link>
                  {index < workspaceReadiness.steps.length - 1 ? (
                    <span className={`rfvs-connector ${step.ready ? "ready" : ""}`}>
                      <i />
                      <ArrowRight size={13} />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!loading && primaryAgent ? (
            <div className="rfvs-agent-strip">
              <div className="rfvs-agent-avatar">
                {String(primaryAgent?.name || "AI").slice(0, 1).toUpperCase()}
                <span className={getAgentReadiness(primaryAgent).ready ? "online" : "setup"} />
              </div>
              <div className="rfvs-agent-main">
                <span>Connected agent</span>
                <strong>{primaryAgent?.name || "ReachFly AI Agent"}</strong>
                <small>
                  {callingModeLabel(primaryAgent?.callingMode)} · {languageLabel(primaryAgent)}
                  {primaryAgent?.fromNumber ? ` · ${primaryAgent.fromNumber}` : " · number not linked"}
                </small>
              </div>
              <div className="rfvs-agent-side">
                {getAgentReadiness(primaryAgent).ready ? (
                  <span className="rfvs-status-good"><CheckCircle2 size={13} /> Ready for calls</span>
                ) : (
                  <span className="rfvs-status-warn"><Clock3 size={13} /> {missingForPrimary.length} item{missingForPrimary.length === 1 ? "" : "s"} left</span>
                )}
                <Link to={`/app/agents?agent=${encodeURIComponent(String(primaryAgent?.id || ""))}`}>
                  Open agent <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rfvs-section-head">
          <div>
            <span>Choose a call direction</span>
            <h2>What should this AI agent handle?</h2>
          </div>
          <p>
            You can change the mode later. Agents configured for both directions keep one business brain while using the correct opening for each call type.
          </p>
        </section>

        <section className="rfvs-grid">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const matchingAgents = agents.filter((agent) => modeMatches(agent?.callingMode, mode.id));
            return (
              <Link className={`rfvs-card ${mode.id}`} to={modeHref(mode.id)} key={mode.id}>
                <div className="rfvs-card-top">
                  <div className="rfvs-card-icon">
                    <Icon size={24} />
                    <i>{mode.direction}</i>
                  </div>
                  {matchingAgents.length ? (
                    <span className="rfvs-existing">
                      <CheckCircle2 size={12} />
                      {matchingAgents.length} configured
                    </span>
                  ) : (
                    <span className="rfvs-new">New setup</span>
                  )}
                </div>

                <span className="rfvs-kicker">{mode.eyebrow}</span>
                <h3>{mode.title}</h3>
                <p>{mode.description}</p>

                <div className="rfvs-mini-flow">
                  <span><Brain size={12} /> Brain</span>
                  <i><ArrowRight size={10} /></i>
                  <span><Phone size={12} /> Number</span>
                  <i><ArrowRight size={10} /></i>
                  <span><Zap size={12} /> Calls</span>
                </div>

                <ul>
                  {mode.highlights.map((item) => (
                    <li key={item}><CheckCircle2 size={14} /> {item}</li>
                  ))}
                </ul>

                <strong className="rfvs-cta">
                  {matchingAgents.length ? `Configure another ${mode.id === "both" ? "dual-mode" : mode.id} agent` : `Set up ${mode.id === "both" ? "both directions" : mode.id}`}
                  <ArrowRight size={15} />
                </strong>
              </Link>
            );
          })}
        </section>

        <section className="rfvs-destination-grid">
          <Link to="/app/phone-numbers">
            <span><Building2 size={17} /></span>
            <div><b>Business Numbers</b><small>{activeNumbers.length ? `${activeNumbers.length} active number${activeNumbers.length === 1 ? "" : "s"}` : "Connect a number to an agent"}</small></div>
            <ArrowRight size={14} />
          </Link>
          <Link to="/app/campaigns/new">
            <span><Target size={17} /></span>
            <div><b>Outbound Campaign</b><small>Use an outbound-ready agent with selected leads</small></div>
            <ArrowRight size={14} />
          </Link>
          <Link to="/app/calls">
            <span><Phone size={17} /></span>
            <div><b>Calls</b><small>See live and completed agent activity</small></div>
            <ArrowRight size={14} />
          </Link>
          <Link to="/app/agents">
            <span><Globe2 size={17} /></span>
            <div><b>AI Workforce</b><small>Manage language, scripts, brain and hours</small></div>
            <ArrowRight size={14} />
          </Link>
        </section>
      </main>
    </>
  );
}

function normalizeAgents(dashboard) {
  if (Array.isArray(dashboard?.agents)) return dashboard.agents.filter(Boolean);
  if (dashboard?.agent) return [dashboard.agent];
  if (Array.isArray(dashboard)) return dashboard.filter(Boolean);
  return [];
}

function normalizeNumbers(commerce) {
  const source = Array.isArray(commerce?.numbers)
    ? commerce.numbers
    : commerce?.activeNumber
      ? [commerce.activeNumber]
      : [];
  return source.filter((item) => item && normalizeToken(item?.status || "active") === "active");
}

function hasBusinessBrain(agent) {
  return Boolean(
    String(agent?.systemPrompt || agent?.agentContext || "").trim() &&
    (
      String(agent?.businessKnowledge || "").trim() ||
      agent?.businessHours ||
      String(agent?.inboundGreeting || agent?.greeting || "").trim()
    )
  );
}

function getAgentReadiness(agent) {
  const missing = [];
  if (!agent?.fromNumber) missing.push("Business number");
  if (!agent?.voice) missing.push("Voice");
  if (!agent?.primaryLanguage) missing.push("Default language");
  if (!String(agent?.systemPrompt || agent?.agentContext || "").trim()) missing.push("System prompt");
  if (!String(agent?.greeting || agent?.inboundGreeting || "").trim()) missing.push("Opening script");
  if (agent?.complianceConfirmed === false) missing.push("Calling policy");
  return { ready: missing.length === 0, missing };
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function modeMatches(agentMode, selectedMode) {
  const normalized = normalizeToken(agentMode || "outbound");
  if (selectedMode === "both") return normalized === "both";
  return normalized === selectedMode || normalized === "both";
}

function callingModeLabel(value) {
  const normalized = normalizeToken(value || "outbound");
  if (normalized === "both") return "Inbound + outbound";
  if (normalized === "inbound") return "Inbound";
  return "Outbound";
}

function languageLabel(agent) {
  const primary = String(agent?.primaryLanguage || "en").trim().toLowerCase();
  const labels = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    it: "Italian",
    nl: "Dutch",
    ar: "Arabic",
    hi: "Hindi",
    ur: "Urdu",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    ru: "Russian",
    tr: "Turkish",
    pl: "Polish",
    id: "Indonesian",
    vi: "Vietnamese",
    uk: "Ukrainian",
  };
  return labels[primary] || primary.toUpperCase();
}

function VoiceStartStyles() {
  return (
    <style>{`
      .rf-voice-start-v10,.rf-voice-start-v10 *{box-sizing:border-box}
      .rf-voice-start-v10{width:min(1320px,100%);margin:0 auto;padding:22px 22px 48px;color:#20222d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .rf-voice-start-v10 a{text-decoration:none;color:inherit}.rf-voice-start-v10 button{font:inherit;cursor:pointer}
      .rf-voice-start-v10 .spin{animation:rfvsSpin .8s linear infinite}@keyframes rfvsSpin{to{transform:rotate(360deg)}}
      .rfvs-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:8px 0 16px}
      .rfvs-head-copy{max-width:830px}.rfvs-pill{min-height:28px;display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid #dfdef8;border-radius:999px;color:#5755d8;background:#f3f2ff;font-size:9px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
      .rfvs-head h1{max-width:790px;margin:10px 0 0;color:#1e2029;font-family:Geist,Inter,sans-serif;font-size:clamp(29px,3.6vw,45px);line-height:1.04;letter-spacing:-.045em}
      .rfvs-head p{max-width:750px;margin:10px 0 0;color:#747681;font-size:12px;line-height:1.65}
      .rfvs-head-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.rfvs-head-actions>*{min-height:38px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 12px;border-radius:10px;font-size:9px;font-weight:800}
      .rfvs-refresh{border:1px solid #e1e2e7;background:#fff;color:#62646d}.rfvs-refresh:disabled{opacity:.55;cursor:not-allowed}.rfvs-manage{border:1px solid #5557db;background:#5557db;color:#fff!important;box-shadow:0 8px 18px rgba(85,87,219,.16)}
      .rfvs-credit-note,.rfvs-error{display:flex;align-items:flex-start;gap:10px;margin:0 0 12px;padding:11px 13px;border:1px solid #dfe2e3;border-radius:12px;background:#fff}.rfvs-credit-note>span,.rfvs-error>svg{flex:0 0 auto}.rfvs-credit-note>span{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;color:#5756d7;background:#eeeeff}.rfvs-credit-note strong,.rfvs-error strong{font-size:10px}.rfvs-credit-note p,.rfvs-error p{margin:2px 0 0;color:#7f808b;font-size:9px;line-height:1.5}.rfvs-error{border-color:#f0dbb7;background:#fffaf1;color:#9a6814}
      .rfvs-journey-card{margin-bottom:18px;border:1px solid #e2e3e9;border-radius:17px;background:linear-gradient(180deg,#fff,#fbfbfe);box-shadow:0 10px 30px rgba(28,31,52,.045);overflow:hidden}
      .rfvs-journey-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid #ececf1}.rfvs-journey-head span,.rfvs-journey-head strong{display:block}.rfvs-journey-head>div:first-child>span{color:#8b8d97;font-size:8px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.rfvs-journey-head>div:first-child>strong{margin-top:3px;font-size:12px;color:#30323a}
      .rfvs-readiness{min-width:62px;padding:7px 10px;border-radius:10px;background:#fff4df;text-align:center;color:#95630c}.rfvs-readiness.ready{background:#eaf8f0;color:#23865a}.rfvs-readiness span{font-size:13px;font-weight:850}.rfvs-readiness small{display:block;margin-top:1px;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
      .rfvs-journey-line{display:flex;align-items:stretch;padding:14px 15px 13px;overflow:auto}.rfvs-step-wrap{display:flex;align-items:center;min-width:0;flex:1}.rfvs-step{min-width:135px;flex:1;display:grid;grid-template-columns:31px minmax(0,1fr);align-items:center;gap:8px;padding:9px;border:1px solid #e8e9ee;border-radius:10px;background:#fff;transition:.16s ease}.rfvs-step:hover{transform:translateY(-1px);border-color:#d5d5fa}.rfvs-step.ready{border-color:#dbeee2;background:#f8fdf9}.rfvs-step-icon{width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:#f0f0ff;color:#5557db}.rfvs-step.ready .rfvs-step-icon{background:#e8f7ee;color:#26875a}.rfvs-step-copy{min-width:0}.rfvs-step-copy b,.rfvs-step-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rfvs-step-copy b{font-size:9px}.rfvs-step-copy small{margin-top:2px;color:#94969f;font-size:7px}
      .rfvs-connector{width:28px;flex:0 0 28px;display:grid;place-items:center;position:relative;color:#c6c7ce}.rfvs-connector i{position:absolute;left:0;right:0;height:1px;background:#e5e6ea}.rfvs-connector svg{position:relative;background:#fbfbfe}.rfvs-connector.ready{color:#72b68e}.rfvs-connector.ready i{background:#bfe1cd}
      .rfvs-agent-strip{display:grid;grid-template-columns:39px minmax(0,1fr) auto;align-items:center;gap:10px;margin:0 15px 14px;padding:10px 11px;border:1px solid #ececf1;border-radius:11px;background:#fff}.rfvs-agent-avatar{width:38px;height:38px;position:relative;display:grid;place-items:center;border-radius:11px;background:linear-gradient(135deg,#5557db,#8764df);color:#fff;font-size:13px;font-weight:850}.rfvs-agent-avatar>span{position:absolute;right:-2px;bottom:-2px;width:10px;height:10px;border:2px solid #fff;border-radius:50%;background:#e2a542}.rfvs-agent-avatar>span.online{background:#37a56b}.rfvs-agent-main span,.rfvs-agent-main strong,.rfvs-agent-main small{display:block}.rfvs-agent-main span{color:#9698a2;font-size:7px;text-transform:uppercase;letter-spacing:.06em;font-weight:800}.rfvs-agent-main strong{margin-top:2px;font-size:10px}.rfvs-agent-main small{margin-top:2px;color:#82848e;font-size:8px}.rfvs-agent-side{text-align:right}.rfvs-agent-side>span{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:999px;font-size:7px;font-weight:800}.rfvs-status-good{background:#e9f8ef;color:#238558}.rfvs-status-warn{background:#fff3de;color:#986408}.rfvs-agent-side>a{display:flex;align-items:center;justify-content:flex-end;gap:3px;margin-top:4px;color:#5557db;font-size:7px;font-weight:800}
      .rfvs-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:0 0 10px}.rfvs-section-head>div>span{color:#7779df;font-size:8px;font-weight:850;letter-spacing:.07em;text-transform:uppercase}.rfvs-section-head h2{margin:3px 0 0;font-family:Geist,Inter,sans-serif;font-size:20px;letter-spacing:-.03em}.rfvs-section-head>p{max-width:500px;margin:0;color:#858791;font-size:9px;line-height:1.55;text-align:right}
      .rfvs-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.rfvs-card{min-height:390px;display:flex;flex-direction:column;padding:20px;border:1px solid #e1e2e7;border-radius:17px;background:radial-gradient(circle at 100% 0,rgba(92,82,231,.09),transparent 40%),linear-gradient(180deg,#fff,#fbfbfd);box-shadow:0 10px 28px rgba(28,31,52,.045);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.rfvs-card:hover{transform:translateY(-3px);border-color:#cfcee9;box-shadow:0 17px 38px rgba(28,31,52,.08)}.rfvs-card.outbound{background:radial-gradient(circle at 100% 0,rgba(134,82,222,.1),transparent 40%),linear-gradient(180deg,#fff,#fcfbff)}.rfvs-card.both{background:radial-gradient(circle at 100% 0,rgba(67,158,128,.1),transparent 40%),linear-gradient(180deg,#fff,#fbfdfc)}
      .rfvs-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.rfvs-card-icon{width:49px;height:49px;position:relative;display:grid;place-items:center;margin-bottom:15px;border-radius:14px;color:#5557d8;background:#efefff}.rfvs-card.both .rfvs-card-icon{background:#eaf8f1;color:#2f8c65}.rfvs-card-icon i{position:absolute;right:-5px;bottom:-5px;width:21px;height:21px;display:grid;place-items:center;border:3px solid #fff;border-radius:50%;color:#fff;background:#5557d8;font-size:10px;font-style:normal;font-weight:900}.rfvs-card.both .rfvs-card-icon i{background:#2f8c65}.rfvs-existing,.rfvs-new{display:inline-flex;align-items:center;gap:4px;padding:5px 7px;border-radius:999px;font-size:7px;font-weight:800}.rfvs-existing{background:#eaf8f0;color:#268558}.rfvs-new{background:#f1f2f5;color:#858791}
      .rfvs-kicker{color:#7779df;font-size:8px;font-weight:850;letter-spacing:.07em;text-transform:uppercase}.rfvs-card h3{margin:5px 0 0;color:#22242e;font-family:Geist,Inter,sans-serif;font-size:20px;letter-spacing:-.025em}.rfvs-card>p{min-height:64px;margin:8px 0 0;color:#747681;font-size:9px;line-height:1.6}
      .rfvs-mini-flow{display:flex;align-items:center;gap:5px;margin:13px 0 0;padding:8px;border:1px solid #ebebf0;border-radius:9px;background:rgba(255,255,255,.78)}.rfvs-mini-flow span{display:inline-flex;align-items:center;gap:4px;color:#666874;font-size:7px;font-weight:750}.rfvs-mini-flow i{display:grid;place-items:center;color:#b3b4bd}.rfvs-card ul{display:grid;gap:7px;margin:13px 0 16px;padding:12px 0 0;border-top:1px solid #ececf1;list-style:none}.rfvs-card li{display:flex;align-items:center;gap:7px;color:#585a65;font-size:8px}.rfvs-card li svg{color:#5558d8}.rfvs-card.both li svg{color:#2f8c65}.rfvs-cta{min-height:40px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding:0 12px;border-radius:10px;color:#fff;background:linear-gradient(135deg,#5558e8,#8054df);font-size:9px;box-shadow:0 8px 18px rgba(81,83,213,.16)}.rfvs-card.both .rfvs-cta{background:linear-gradient(135deg,#348d68,#4b9f7d);box-shadow:0 8px 18px rgba(52,141,104,.14)}
      .rfvs-destination-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.rfvs-destination-grid>a{display:grid;grid-template-columns:32px minmax(0,1fr) 16px;align-items:center;gap:8px;padding:10px;border:1px solid #e6e7eb;border-radius:10px;background:#fff;transition:.15s ease}.rfvs-destination-grid>a:hover{border-color:#d2d3f2;transform:translateY(-1px)}.rfvs-destination-grid>a>span{width:31px;height:31px;display:grid;place-items:center;border-radius:8px;background:#f0f0ff;color:#5557db}.rfvs-destination-grid b,.rfvs-destination-grid small{display:block}.rfvs-destination-grid b{font-size:8px}.rfvs-destination-grid small{margin-top:2px;color:#92949e;font-size:7px}.rfvs-destination-grid>a>svg{color:#9a9ca6}
      @media(max-width:980px){.rfvs-head{align-items:flex-start;flex-direction:column}.rfvs-head-actions{justify-content:flex-start}.rfvs-grid{grid-template-columns:1fr 1fr}.rfvs-card.both{grid-column:1/-1;min-height:330px}.rfvs-destination-grid{grid-template-columns:1fr 1fr}.rfvs-section-head{align-items:flex-start;flex-direction:column}.rfvs-section-head>p{text-align:left}.rfvs-journey-line{padding-bottom:17px}.rfvs-step-wrap{flex:0 0 auto}.rfvs-step{width:160px}.rfvs-agent-strip{grid-template-columns:39px minmax(0,1fr)}.rfvs-agent-side{grid-column:1/-1;text-align:left;padding-left:49px}.rfvs-agent-side>a{justify-content:flex-start}}
      @media(max-width:680px){.rf-voice-start-v10{padding:16px 12px 34px}.rfvs-head h1{font-size:29px}.rfvs-head-actions{width:100%}.rfvs-head-actions>*{flex:1}.rfvs-grid{grid-template-columns:1fr}.rfvs-card.both{grid-column:auto}.rfvs-card{min-height:350px}.rfvs-destination-grid{grid-template-columns:1fr}.rfvs-journey-head{align-items:flex-start}.rfvs-journey-line{display:grid;gap:7px}.rfvs-step-wrap{display:block}.rfvs-step{width:100%}.rfvs-connector{display:none}.rfvs-agent-strip{margin:0 10px 10px}.rfvs-agent-main small{white-space:normal}}
      @media(prefers-reduced-motion:reduce){.rf-voice-start-v10 *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
    `}</style>
  );
}
