import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import BrandLogo from "../components/BrandLogo";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  CheckCircle2,
  Globe,
  Mail,
  MapPinned,
  MessageCircle,
  Radar,
  Send,
  Shield,
  Target,
  Workflow,
  Zap,
} from "../components/icons";

const chips = [
  "AI voice agents",
  "Live calling",
  "Lead discovery",
  "Website audits",
  "Email follow-up",
  "WhatsApp follow-up",
  "CRM pipeline",
  "Meeting booking",
  "Usage credits",
  "Territory intelligence",
];

const features = [
  [
    Target,
    "Find",
    "Discover businesses by niche, city, territory, intent, and digital opportunity.",
  ],
  [
    Brain,
    "Diagnose",
    "Audit websites for conversion, trust, SEO, speed, booking, and follow-up gaps.",
  ],
  [
    Zap,
    "Call",
    "Use AI voice agents to qualify leads, capture outcomes, and move the right prospects forward.",
  ],
  [
    Send,
    "Follow up",
    "Continue the conversation through email, WhatsApp, tasks, callbacks, and booked meetings.",
  ],
  [
    BarChart3,
    "Operate",
    "Track leads, calls, replies, tasks, pipeline movement, meetings, usage, and team performance.",
  ],
  [
    Workflow,
    "Automate",
    "Keep every lead connected to the next action instead of losing context between tools and team members.",
  ],
];

const agents = [
  [
    Radar,
    "Scout Agent",
    "Searches and filters lead markets inside the niche, territory, and criteria you choose.",
  ],
  [
    Brain,
    "Audit Agent",
    "Turns website and digital-experience gaps into practical sales context for outreach.",
  ],
  [
    Zap,
    "Voice Agent",
    "Runs disclosed AI sales conversations, qualifies interest, records outcomes, and supports meeting booking.",
  ],
  [
    Mail,
    "Writer Agent",
    "Creates value-first email and follow-up messaging using lead and audit context.",
  ],
  [
    Workflow,
    "Pipeline Agent",
    "Keeps callbacks, assignments, follow-ups, and next actions linked to the same lead record.",
  ],
];

const launchSteps = [
  [
    "01",
    "Choose the outcome",
    "Decide whether the campaign should qualify leads, book meetings, re-engage opportunities, or follow up on inbound demand.",
  ],
  [
    "02",
    "Configure the voice agent",
    "Choose the voice and sales behavior, add your business context, and define the questions, objections, handoff rules, and booking path.",
  ],
  [
    "03",
    "Connect a business number",
    "Use a ReachFly calling number or connect an approved existing business number through the supported onboarding path.",
  ],
  [
    "04",
    "Load leads and context",
    "Bring in leads, website context, notes, campaign data, and the information the agent needs before speaking with a prospect.",
  ],
  [
    "05",
    "Launch and monitor",
    "Run calls, follow call state, review transcripts and outcomes, and continue follow-up from the same workspace.",
  ],
  [
    "06",
    "Measure what converts",
    "Track connected conversations, meetings, follow-ups, pipeline movement, usage credits, and team results.",
  ],
];

const safeguards = [
  "AI disclosure in outbound calling behavior",
  "Recording-aware calling copy",
  "Workspace-scoped access controls",
  "Role-based owner, admin, manager, and caller experiences",
  "Lead and task history connected to call outcomes",
  "Credit charging tied to successful billable events",
];

export default function Marketing() {
  return (
    <main className="cu-page">
      <header className="cu-nav">
        <Link className="cu-brand" to="/">
          <span className="cu-brand-mark">
            <BrandLogo size={42} />
          </span>
          <b>ReachFly.Ai</b>
        </Link>

        <nav className="cu-nav-links">
          <a href="#platform">Platform</a>
          <a href="#voice">AI calling</a>
          <a href="#agents">Agents</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="cu-nav-actions">
          <Link className="cu-btn cu-btn-ghost" to="/login">
            Sign in
          </Link>

          <Link className="cu-btn cu-btn-primary" to="/signup">
            Get started <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="cu-hero">
        <div className="cu-hero-bg" />
        <div className="cu-hero-glow cu-hero-glow-one" />
        <div className="cu-hero-glow cu-hero-glow-two" />

        <div className="cu-hero-inner">
          <motion.div
            className="cu-hero-copy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="cu-pill">
              <Zap size={15} /> AI sales workspace with voice calling
            </span>

            <h1>
              Find leads, call them with AI, follow up, and manage the sale in
              one connected workspace.
            </h1>

            <p>
              ReachFly.Ai combines lead discovery, website intelligence, AI
              voice agents, email, WhatsApp, callbacks, meeting booking,
              pipeline management, team workflows, and usage credits so the
              full sales journey stays connected.
            </p>

            <div className="cu-hero-actions">
              <Link className="cu-btn cu-btn-primary cu-btn-xl" to="/signup">
                Start with ReachFly <ArrowRight size={18} />
              </Link>

              <Link className="cu-btn cu-btn-ghost cu-btn-xl" to="/login">
                Open workspace
              </Link>
            </div>

            <div className="cu-proof-row">
              {[
                "AI calling + CRM in one flow",
                "Prepaid usage credits",
                "Role-based team operations",
                "Compliance-aware sales workflows",
              ].map((item) => (
                <span key={item}>
                  <Check size={15} /> {item}
                </span>
              ))}
            </div>
          </motion.div>

          <ProductPreview />
        </div>

        <div className="cu-chip-strip">
          <div className="cu-chip-track">
            {[...chips, ...chips].map((chip, index) => (
              <span className="cu-product-chip" key={`${chip}-${index}`}>
                <SparkChip i={index} />
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="cu-section">
        <div className="cu-section-head">
          <span className="cu-eyebrow">One connected sales workspace</span>

          <h2>
            Move from market discovery to real sales conversations without
            stitching together five different systems.
          </h2>

          <p>
            ReachFly keeps prospect data, audit context, calls, messages,
            callbacks, meetings, assignments, pipeline state, and usage history
            connected to the same workspace.
          </p>
        </div>

        <div className="cu-workspace-grid">
          {features.map(([Icon, title, text]) => (
            <article className="cu-work-card" key={title}>
              <span>
                <Icon size={22} />
              </span>

              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="voice" className="cu-agents">
        <div className="cu-section-head">
          <span className="cu-eyebrow">ReachFly AI calling</span>

          <h2>
            Give your sales process a voice agent that works from the same lead
            context as your team.
          </h2>

          <p>
            Configure the agent, connect the calling identity, load business and
            lead context, run calls, review outcomes, and continue follow-up
            without losing the conversation history.
          </p>
        </div>

        <div className="cu-agent-grid">
          <article className="cu-agent-card">
            <div className="cu-agent-top">
              <span>
                <Zap size={24} />
              </span>
              <em>01</em>
            </div>

            <h3>Natural sales conversations</h3>
            <p>
              The voice agent is designed to lead with the business problem,
              ask useful qualification questions, handle objections, and move
              qualified prospects toward the right next step.
            </p>
          </article>

          <article className="cu-agent-card">
            <div className="cu-agent-top">
              <span>
                <MessageCircle size={24} />
              </span>
              <em>02</em>
            </div>

            <h3>Call outcomes stay connected</h3>
            <p>
              Call status, transcript, qualification, notes, callback timing,
              meeting outcomes, and follow-up can remain linked to the same lead
              and workspace.
            </p>
          </article>

          <article className="cu-agent-card">
            <div className="cu-agent-top">
              <span>
                <Workflow size={24} />
              </span>
              <em>03</em>
            </div>

            <h3>Human team stays in control</h3>
            <p>
              Owners and managers can oversee the workflow while callers and
              sales users continue from assigned tasks, callbacks, and qualified
              opportunities.
            </p>
          </article>

          <article className="cu-agent-card">
            <div className="cu-agent-top">
              <span>
                <Shield size={24} />
              </span>
              <em>04</em>
            </div>

            <h3>Disclosure-aware calling</h3>
            <p>
              Outbound voice behavior is designed to identify the agent as AI
              and account for recording disclosure requirements rather than
              pretending the caller is a human salesperson.
            </p>
          </article>
        </div>

        <div className="cu-hero-actions">
          <Link className="cu-btn cu-btn-primary cu-btn-xl" to="/signup">
            Configure your voice agent <ArrowRight size={18} />
          </Link>

          <Link className="cu-btn cu-btn-ghost cu-btn-xl" to="/login">
            Open voice workspace
          </Link>
        </div>
      </section>

      <section className="cu-section">
        <div className="cu-section-head">
          <span className="cu-eyebrow">From setup to live operation</span>
          <h2>A clearer path from “we need more conversations” to a working AI calling workflow.</h2>
          <p>
            ReachFly is built around an activation sequence that keeps the
            agent, business number, lead context, workflow, billing, and
            operational results connected.
          </p>
        </div>

        <div className="cu-workspace-grid">
          {launchSteps.map(([number, title, text]) => (
            <article className="cu-work-card" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="agents" className="cu-agents">
        <div className="cu-section-head">
          <span className="cu-eyebrow">ReachFly AI agents</span>

          <h2>
            Use specialist agents across discovery, diagnosis, calling,
            messaging, and pipeline operations.
          </h2>

          <p>
            Each agent is part of the same sales workspace instead of becoming
            another disconnected AI tool with its own copy of your customer
            data.
          </p>
        </div>

        <div className="cu-agent-grid">
          {agents.map(([Icon, title, text], index) => (
            <article className="cu-agent-card" key={title}>
              <div className="cu-agent-top">
                <span>
                  <Icon size={24} />
                </span>
                <em>0{index + 1}</em>
              </div>

              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cu-section">
        <div className="cu-section-head">
          <span className="cu-eyebrow">Operational safeguards</span>

          <h2>
            Build AI calling into a controlled sales process, not an anonymous
            robocalling loop.
          </h2>

          <p>
            ReachFly is designed around workspace ownership, role-based access,
            visible call outcomes, auditable usage, and disclosure-aware agent
            behavior.
          </p>
        </div>

        <div className="cu-workspace-grid">
          {safeguards.map((item) => (
            <article className="cu-work-card" key={item}>
              <span>
                <Shield size={22} />
              </span>

              <h3>{item}</h3>

              <p>
                Configure and operate this control from the same workspace used
                for leads, calls, tasks, and follow-up.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="cu-section cu-pricing">
        <div className="cu-section-head">
          <span className="cu-eyebrow">Usage-based pricing</span>

          <h2>
            Prepaid credits instead of forcing every workspace into a monthly
            subscription tier.
          </h2>

          <p>
            ReachFly publishes feature rates and available credit packs inside
            Billing. The backend owns the rate card and checkout amounts so the
            browser cannot invent or modify commercial pricing.
          </p>
        </div>

        <div className="cu-price-grid">
          <article>
            <h3>ReachFly usage credits</h3>

            <p>
              General product credits cover billable ReachFly features such as
              lead discovery, audits, and AI actions according to the current
              published rate card.
            </p>

            <strong>
              Prepaid
              <span> usage</span>
            </strong>

            <ul>
              <li>
                <CheckCircle2 size={15} /> Shared workspace balance
              </li>
              <li>
                <CheckCircle2 size={15} /> Server-published feature rates
              </li>
              <li>
                <CheckCircle2 size={15} /> Usage and credit ledger
              </li>
              <li>
                <CheckCircle2 size={15} /> Secure hosted checkout when enabled
              </li>
            </ul>

            <Link className="cu-btn cu-btn-primary cu-btn-full" to="/signup">
              Create workspace
            </Link>
          </article>

          <article className="featured">
            <div className="cu-price-badge">AI calling</div>

            <h3>Connected call credits</h3>

            <p>
              AI calling uses a dedicated call-credit balance so phone usage is
              not hidden inside unrelated lead-generation or audit credits.
            </p>

            <strong>
              $1
              <span> / connected call*</span>
            </strong>

            <ul>
              <li>
                <CheckCircle2 size={15} /> 30 onboarding call credits when the current voice offer is enabled
              </li>
              <li>
                <CheckCircle2 size={15} /> Failed or unanswered attempts are not treated as connected calls
              </li>
              <li>
                <CheckCircle2 size={15} /> Duplicate provider events cannot double-charge the same call
              </li>
              <li>
                <CheckCircle2 size={15} /> Duration and overage policy shown with the active calling offer
              </li>
            </ul>

            <Link className="cu-btn cu-btn-primary cu-btn-full" to="/signup">
              Start AI calling
            </Link>
          </article>

          <article>
            <h3>Business number</h3>

            <p>
              Calling activation includes the business-number step so the agent
              is tied to an approved calling identity rather than an anonymous
              outbound workflow.
            </p>

            <strong>
              Flexible
              <span> setup</span>
            </strong>

            <ul>
              <li>
                <CheckCircle2 size={15} /> Add a ReachFly-supported calling number
              </li>
              <li>
                <CheckCircle2 size={15} /> Connect an approved existing business number when supported
              </li>
              <li>
                <CheckCircle2 size={15} /> Workspace-scoped calling identity
              </li>
              <li>
                <CheckCircle2 size={15} /> Calling status visible in the voice workspace
              </li>
            </ul>

            <Link className="cu-btn cu-btn-primary cu-btn-full" to="/signup">
              Configure calling
            </Link>
          </article>
        </div>

        <p className="cu-section-head">
          * Current launch pricing target. The active rate, calling duration
          policy, available packs, and any applicable charges should be shown in
          ReachFly before activation or checkout.
        </p>
      </section>

      <section className="cu-final">
        <div>
          <span className="cu-eyebrow">Ready to create more sales conversations?</span>

          <h2>
            Build the campaign, launch the AI voice agent, and keep every next
            step inside ReachFly.
          </h2>

          <p>
            Discover leads, add context, run disclosed AI calls, review
            outcomes, schedule callbacks, book meetings, continue through email
            or WhatsApp, and measure the entire process from one workspace.
          </p>

          <Link className="cu-btn cu-btn-primary cu-btn-xl" to="/signup">
            Get started <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="cu-footer">
        <Link className="cu-brand" to="/">
          <span className="cu-brand-mark">
            <BrandLogo size={42} />
          </span>
          <b>ReachFly.Ai</b>
        </Link>

        <p>
          AI-powered lead discovery, sales calling, follow-up, and CRM
          operations.
        </p>

        <div>
          <span>
            <Shield size={14} /> Controlled workflows
          </span>

          <span>
            <Globe size={14} /> Global sales operations
          </span>
        </div>
      </footer>
    </main>
  );
}

function SparkChip({ i }) {
  const icons = [
    Target,
    Brain,
    Zap,
    Mail,
    MessageCircle,
    Workflow,
    MapPinned,
    BarChart3,
    Shield,
  ];

  const Icon = icons[i % icons.length];

  return <Icon size={17} />;
}

function ProductPreview() {
  return (
    <motion.div
      className="cu-preview"
      initial={{ opacity: 0, y: 32, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2 }}
    >
      <div className="cu-preview-top">
        <div>
          <span className="cu-dot cu-dot-red" />
          <span className="cu-dot cu-dot-yellow" />
          <span className="cu-dot cu-dot-green" />
        </div>

        <span>ReachFly Sales Workspace</span>
      </div>

      <div className="cu-preview-body">
        <aside className="cu-preview-side">
          <div className="cu-preview-logo">
            <BrandLogo size={28} />
            <b>ReachFly.Ai</b>
          </div>

          {[
            "Dashboard",
            "Leads",
            "Voice agent",
            "Pipeline",
            "Channels",
            "AI",
          ].map((item, index) => (
            <div
              key={item}
              className={`cu-preview-nav-item ${
                index === 2 ? "active" : ""
              }`}
            >
              <span />
              {item}
            </div>
          ))}
        </aside>

        <main className="cu-preview-main">
          <div className="cu-preview-header">
            <div>
              <span className="cu-preview-kicker">AI calling campaign</span>
              <h3>Dental practices · London</h3>
              <p>Qualified leads · website context · voice follow-up</p>
            </div>

            <button>Launch</button>
          </div>

          <div className="cu-preview-metrics">
            {[
              ["Ready leads", "48"],
              ["Queued", "9"],
              ["Live calls", "2"],
              ["Meetings", "6"],
            ].map(([label, value]) => (
              <div key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="cu-preview-board">
            <div className="cu-preview-panel">
              <div className="cu-panel-title">
                <Zap size={16} /> Voice Agent
              </div>

              <div className="cu-progress-line">
                <span style={{ width: "72%" }} />
              </div>

              <p>
                Calling qualified leads and writing outcomes back to the
                workspace…
              </p>
            </div>

            <div className="cu-preview-panel">
              <div className="cu-panel-title">
                <Brain size={16} /> Lead context
              </div>

              <div className="cu-audit-score">
                <strong>81</strong>
                <span>avg opportunity score</span>
              </div>
            </div>

            <div className="cu-preview-table">
              {[
                ["Smile Studio", "Interested · callback", "Live"],
                ["Nova Dental", "Meeting booked", "Won"],
                ["Pure Clinics", "Follow-up email", "Next"],
              ].map(([lead, outcome, status]) => (
                <div key={lead}>
                  <span>{lead}</span>
                  <em>{outcome}</em>
                  <b>{status}</b>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </motion.div>
  );
}