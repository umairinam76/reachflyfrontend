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
import "../styles.css";

const chips = [
  "Autonomous voice calling",
  "Lead discovery",
  "Website intelligence",
  "Automatic email follow-up",
  "WhatsApp follow-up",
  "CRM pipeline",
  "Meeting booking",
  "Connected-call credits",
  "Territory intelligence",
  "Live sales outcomes",
];

const problems = [
  [
    "01",
    "Reps lose hours finding who to call",
    "Lead discovery, qualification context, territories, notes, and website intelligence are usually scattered across separate tools before a rep even starts selling.",
  ],
  [
    "02",
    "Good leads die after the first conversation",
    "Callbacks are missed, follow-up emails go out late, WhatsApp threads lose context, and interested prospects quietly disappear between systems.",
  ],
  [
    "03",
    "Sales managers cannot see the real next step",
    "A call can end with interest, an objection, a meeting request, or a follow-up need — but the CRM often receives only a vague note instead of an executed action.",
  ],
  [
    "04",
    "Teams pay for activity instead of outcomes",
    "More seats, more dialers, more inboxes, more tools, and more administration do not guarantee more qualified conversations or booked meetings.",
  ],
];

const process = [
  [
    Target,
    "01",
    "Find the right accounts",
    "Build a lead market by niche, city, territory, intent, and digital opportunity instead of feeding the operator a random list.",
  ],
  [
    Brain,
    "02",
    "Load real sales context",
    "ReachFly analyzes business and website context, lead history, notes, qualification criteria, objections, offers, and your desired outcome.",
  ],
  [
    Zap,
    "03",
    "Run the conversation",
    "The voice operator calls, discloses that it is automated, qualifies the prospect, handles the conversation, and works toward the campaign goal.",
  ],
  [
    Mail,
    "04",
    "Act immediately after the call",
    "Based on the outcome, ReachFly can send the follow-up email, continue through WhatsApp, schedule a callback, update the lead, or prepare the next action.",
  ],
  [
    MessageCircle,
    "05",
    "Book when the buyer confirms",
    "When the prospect confirms a date and time, the workflow can book the meeting and keep the appointment linked to the lead and conversation history.",
  ],
  [
    Workflow,
    "06",
    "Keep selling until the next step is complete",
    "Qualify, follow up, book, hand off, re-engage, or move toward purchase according to the campaign context — without dropping the lead between tools.",
  ],
];

const autonomousOutcomes = [
  [
    Zap,
    "Call and qualify",
    "Run disclosed outbound conversations, ask qualification questions, handle common objections, and record what the prospect actually said.",
  ],
  [
    Mail,
    "Send the email automatically",
    "After the call, send the right follow-up from the same context instead of waiting for a rep to copy notes into another tool.",
  ],
  [
    MessageCircle,
    "Continue on WhatsApp",
    "Carry the next step into messaging when the campaign calls for it, keeping the same lead record and conversation context.",
  ],
  [
    Workflow,
    "Execute the next action",
    "Create the callback, update the CRM stage, assign a human task, trigger follow-up, or move the opportunity forward based on the call outcome.",
  ],
  [
    CheckCircle2,
    "Book confirmed meetings",
    "Only create a meeting when the prospect actually confirms the date and time, keeping the booking tied to the lead and call outcome.",
  ],
  [
    BarChart3,
    "Measure outcomes, not dials",
    "Track connected conversations, qualified interest, meetings, follow-ups, pipeline movement, and credit usage from one workspace.",
  ],
];

const operators = [
  [
    Radar,
    "Scout",
    "Builds and filters lead markets using the territory, niche, and criteria you choose.",
  ],
  [
    Brain,
    "Research",
    "Turns website, business, and digital-experience context into useful sales intelligence.",
  ],
  [
    Zap,
    "Voice",
    "Runs disclosed sales conversations, qualifies intent, handles objections, and captures the outcome.",
  ],
  [
    Mail,
    "Follow-up",
    "Writes and sends the next email using the actual lead, call, and business context.",
  ],
  [
    Workflow,
    "Pipeline",
    "Keeps callbacks, assignments, next steps, and opportunity movement connected to the same record.",
  ],
];

const safeguards = [
  "Automated-caller disclosure at the beginning of the conversation",
  "Recording-aware calling controls",
  "Workspace-scoped access and calling identity",
  "Role-based owner, admin, manager, and caller permissions",
  "DNC, suppression, calling-window, and campaign controls",
  "Credit charging tied to completed connected conversations",
];

const footerColumns = [
  {
    title: "Platform",
    links: [
      ["Sales workspace", "#platform"],
      ["Voice calling", "#voice"],
      ["Sales operators", "#operators"],
      ["Pricing", "#pricing"],
    ],
  },
  {
    title: "Workflow",
    links: [
      ["Lead discovery", "#platform"],
      ["Follow-up automation", "#outcomes"],
      ["Meeting booking", "#outcomes"],
      ["CRM operations", "#outcomes"],
    ],
  },
  {
    title: "Account",
    links: [
      ["Sign in", "/login"],
      ["Create workspace", "/signup"],
      ["Blog", "/blog"],
    ],
  },
  {
    title: "Trust",
    links: [
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
      ["Contact", "/contact"],
    ],
  },
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
          <a href="#voice">Calling</a>
          <a href="#operators">Operators</a>
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

      <section className="cu-hero cu-hero-v2">
        <div className="cu-hero-bg" />
        <div className="cu-hero-glow cu-hero-glow-one" />
        <div className="cu-hero-glow cu-hero-glow-two" />

        <div className="cu-hero-inner">
          <motion.div
            className="cu-hero-copy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="cu-kicker-v2">
              Autonomous sales execution
            </span>

            <h1>
              One sales operator that can call, follow up, book meetings, and
              keep every lead moving.
            </h1>

            <p className="cu-hero-lead">
              ReachFly gives your pipeline an always-on sales operator that works
              from real business context. It can discover leads, run disclosed
              voice conversations, send follow-up emails automatically, continue
              through WhatsApp, book confirmed meetings, update CRM outcomes,
              schedule callbacks, and execute the next step your campaign needs.
            </p>

            <div className="cu-hero-actions">
              <Link className="cu-btn cu-btn-primary cu-btn-xl" to="/signup">
                Build your sales operator <ArrowRight size={18} />
              </Link>

              <a className="cu-btn cu-btn-ghost cu-btn-xl" href="#process">
                See how it works
              </a>
            </div>

            <div className="cu-proof-row cu-proof-row-v2">
              {[
                "10 free connected-call credits",
                "Automatic post-call follow-up",
                "Confirmed meeting booking",
                "One CRM context from lead to outcome",
              ].map((item) => (
                <span key={item}>
                  <Check size={15} /> {item}
                </span>
              ))}
            </div>
          </motion.div>

          <ProductPreview />
        </div>
      </section>

      {/* Intentionally outside the hero so the product preview can never cover it. */}
      <div className="cu-chip-strip cu-chip-strip-after-hero">
        <div className="cu-chip-track">
          {[...chips, ...chips].map((chip, index) => (
            <span className="cu-product-chip" key={`${chip}-${index}`}>
              <SparkChip i={index} />
              {chip}
            </span>
          ))}
        </div>
      </div>

      <section className="cu-story-section cu-problem-section">
        <div className="cu-section-head cu-section-head-wide">
          <span className="cu-eyebrow">The sales problem</span>

          <h2>
            Most teams do not have a lead problem. They have an execution gap
            between interest and the next action.
          </h2>

          <p>
            Traditional sales stacks make humans coordinate research, dialing,
            notes, follow-up, messaging, calendars, and CRM updates across
            different tools. ReachFly is designed to close those gaps.
          </p>
        </div>

        <div className="cu-problem-grid">
          {problems.map(([number, title, text]) => (
            <article className="cu-problem-card" key={number}>
              <span className="cu-card-number">{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="platform" className="cu-section cu-platform-v2">
        <div className="cu-section-head">
          <span className="cu-eyebrow">One connected execution layer</span>

          <h2>
            Stop handing the same lead from tool to tool before anything useful
            happens.
          </h2>

          <p>
            ReachFly keeps market discovery, business intelligence, calling,
            follow-up, meetings, pipeline state, ownership, and usage history on
            the same workspace record.
          </p>
        </div>

        <div className="cu-platform-flow">
          <div className="cu-platform-flow-line" />

          {[
            ["Discover", "Find accounts worth contacting"],
            ["Understand", "Load business and lead context"],
            ["Call", "Have the sales conversation"],
            ["Act", "Execute the next step immediately"],
            ["Measure", "Track outcomes and pipeline movement"],
          ].map(([title, text], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="voice" className="cu-agents cu-voice-v2">
        <div className="cu-section-head">
          <span className="cu-eyebrow">Beyond another AI agent</span>

          <h2>
            Built to act like a sales operator, not stop when the conversation
            ends.
          </h2>

          <p>
            The value is not just that software can speak. The value is that the
            call outcome can immediately become the next sales action without a
            rep rebuilding the context by hand.
          </p>
        </div>

        <div className="cu-voice-compare">
          <article className="cu-voice-compare-card muted">
            <span className="cu-compare-label">Typical voice tool</span>
            <h3>The call ends. The work starts again.</h3>
            <ul>
              <li>Transcript lives in another dashboard</li>
              <li>A rep reads notes and decides what happened</li>
              <li>Someone writes the follow-up email</li>
              <li>Someone updates the CRM</li>
              <li>Someone books or reschedules the meeting</li>
            </ul>
          </article>

          <article className="cu-voice-compare-card featured">
            <span className="cu-compare-label">ReachFly sales operator</span>
            <h3>The call ends. The next action is already moving.</h3>
            <ul>
              <li>Outcome stays attached to the lead</li>
              <li>Follow-up email can be sent automatically</li>
              <li>WhatsApp or callback can continue the conversation</li>
              <li>Confirmed meeting can be booked</li>
              <li>Pipeline stage and next action remain connected</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="process" className="cu-section cu-process-section">
        <div className="cu-section-head cu-section-head-wide">
          <span className="cu-eyebrow">How ReachFly works</span>

          <h2>
            From “we need more sales conversations” to an operating sales
            workflow.
          </h2>

          <p>
            Set the outcome once. ReachFly uses the same business context,
            campaign rules, lead data, and conversation history to keep moving
            toward that outcome.
          </p>
        </div>

        <div className="cu-process-grid">
          {process.map(([Icon, number, title, text], index) => (
            <article className="cu-process-card" key={number}>
              <div className="cu-process-top">
                <span className="cu-process-icon">
                  <Icon size={20} />
                </span>
                <em>{number}</em>
              </div>

              <h3>{title}</h3>
              <p>{text}</p>

              {index < process.length - 1 ? (
                <span className="cu-process-arrow">→</span>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section id="outcomes" className="cu-agents cu-outcome-section">
        <div className="cu-section-head">
          <span className="cu-eyebrow">What happens after the call</span>

          <h2>
            Calling is only the first action. ReachFly keeps executing.
          </h2>

          <p>
            Your campaign decides what success means. The operator can qualify,
            follow up, book, re-engage, hand off, or continue moving toward the
            sale using the context it already has.
          </p>
        </div>

        <div className="cu-outcome-grid">
          {autonomousOutcomes.map(([Icon, title, text], index) => (
            <article className="cu-outcome-card" key={title}>
              <div className="cu-outcome-icon">
                <Icon size={22} />
              </div>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="operators" className="cu-section cu-operators-section">
        <div className="cu-section-head">
          <span className="cu-eyebrow">One system, specialized operators</span>

          <h2>
            Do not buy five disconnected agents. Give one sales system the
            specialists it needs.
          </h2>

          <p>
            Each specialist works from the same workspace context, so discovery,
            research, calling, follow-up, and pipeline operations stay attached
            to the same buyer journey.
          </p>
        </div>

        <div className="cu-agent-grid cu-operator-grid">
          {operators.map(([Icon, title, text], index) => (
            <article className="cu-agent-card cu-operator-card" key={title}>
              <div className="cu-agent-top">
                <span>
                  <Icon size={24} />
                </span>
                <em>0{index + 1}</em>
              </div>

              <h3>{title} Operator</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cu-agents cu-safety-v2">
        <div className="cu-section-head">
          <span className="cu-eyebrow">Controlled sales automation</span>

          <h2>
            Autonomous execution should still have clear rules, ownership, and
            auditability.
          </h2>

          <p>
            ReachFly is built around workspace ownership, visible call outcomes,
            suppression controls, calling windows, role-based access, and
            disclosure-aware voice behavior.
          </p>
        </div>

        <div className="cu-safeguard-grid">
          {safeguards.map((item, index) => (
            <article key={item}>
              <span>
                <Shield size={19} />
              </span>
              <em>0{index + 1}</em>
              <h3>{item}</h3>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="cu-section cu-pricing cu-pricing-v2">
        <div className="cu-section-head">
          <span className="cu-eyebrow">Pay for execution</span>

          <h2>
            Start with 10 free connected-call credits. Add more when the sales
            operator proves useful.
          </h2>

          <p>
            General ReachFly credits stay separate from the dedicated calling
            wallet. Connected-call pricing, available packs, and checkout
            amounts are published by the backend.
          </p>
        </div>

        <div className="cu-price-grid">
          <article>
            <span className="cu-price-eyebrow">Included</span>
            <h3>Launch credits</h3>

            <p>
              Every new workspace can begin with a small calling allowance so
              the team can configure the workflow and test real sales
              conversations before buying a larger pack.
            </p>

            <strong>
              10
              <span> connected calls</span>
            </strong>

            <ul>
              <li>
                <CheckCircle2 size={15} /> One-time new-workspace allowance
              </li>
              <li>
                <CheckCircle2 size={15} /> Dedicated calling wallet
              </li>
              <li>
                <CheckCircle2 size={15} /> Usage visible in ReachFly
              </li>
            </ul>

            <Link className="cu-btn cu-btn-primary cu-btn-full" to="/signup">
              Start free
            </Link>
          </article>

          <article className="featured">
            <div className="cu-price-badge">Connected calling</div>

            <h3>Pay when a conversation connects</h3>

            <p>
              The current ReachFly model uses a dedicated call-credit balance
              rather than hiding phone usage inside unrelated lead-generation
              or audit credits.
            </p>

            <strong>
              $1
              <span> / connected call*</span>
            </strong>

            <ul>
              <li>
                <CheckCircle2 size={15} /> Failed attempts are not connected calls
              </li>
              <li>
                <CheckCircle2 size={15} /> Unanswered attempts are not connected calls
              </li>
              <li>
                <CheckCircle2 size={15} /> Duplicate settlement is idempotent
              </li>
              <li>
                <CheckCircle2 size={15} /> Add prepaid call packs when needed
              </li>
            </ul>

            <Link className="cu-btn cu-btn-primary cu-btn-full" to="/signup">
              Build your operator
            </Link>
          </article>

          <article>
            <span className="cu-price-eyebrow">Calling identity</span>
            <h3>Business number</h3>

            <p>
              Each production calling workflow is tied to an approved business
              calling identity instead of becoming an anonymous outbound dialer.
            </p>

            <strong>
              Flexible
              <span> setup</span>
            </strong>

            <ul>
              <li>
                <CheckCircle2 size={15} /> ReachFly-supported business number
              </li>
              <li>
                <CheckCircle2 size={15} /> Workspace-scoped calling identity
              </li>
              <li>
                <CheckCircle2 size={15} /> Activation status inside the workspace
              </li>
            </ul>

            <Link className="cu-btn cu-btn-primary cu-btn-full" to="/signup">
              Configure calling
            </Link>
          </article>
        </div>

        <p className="cu-pricing-footnote">
          * Current launch pricing target. The active rate, duration policy,
          available packs, number charges, and checkout amount shown inside
          ReachFly remain authoritative.
        </p>
      </section>

      <section className="cu-final cu-final-v2">
        <div>
          <span className="cu-eyebrow">Not another chatbot. Not another dialer.</span>

          <h2>
            Give every lead a sales operator that calls, follows up, books, and
            keeps moving toward the outcome.
          </h2>

          <p>
            Discover the account, understand the opportunity, have the
            conversation, send the follow-up automatically, book the confirmed
            meeting, update the CRM, and execute the next step — all from one
            sales context.
          </p>

          <Link className="cu-btn cu-btn-primary cu-btn-xl" to="/signup">
            Build your sales operator <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="cu-footer-v2">
        <div className="cu-footer-v2-main">
          <div className="cu-footer-v2-brand">
            <Link className="cu-brand" to="/">
              <span className="cu-brand-mark">
                <BrandLogo size={42} />
              </span>
              <b>ReachFly.Ai</b>
            </Link>

            <p>
              Autonomous sales execution for teams that want more conversations
              completed, more follow-up executed, and fewer leads lost between
              tools.
            </p>

            <div className="cu-footer-trust">
              <span>
                <Shield size={14} /> Controlled workflows
              </span>
              <span>
                <Globe size={14} /> Built for distributed sales teams
              </span>
            </div>
          </div>

          <div className="cu-footer-v2-links">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h4>{column.title}</h4>

                {column.links.map(([label, href]) =>
                  href.startsWith("/") ? (
                    <Link key={label} to={href}>
                      {label}
                    </Link>
                  ) : (
                    <a key={label} href={href}>
                      {label}
                    </a>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="cu-footer-v2-bottom">
          <span>© {new Date().getFullYear()} ReachFly.Ai</span>
          <span>Lead → conversation → follow-up → outcome.</span>
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
      className="cu-preview cu-preview-v2"
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
            "Voice operator",
            "Pipeline",
            "Channels",
            "Analytics",
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
              <span className="cu-preview-kicker">
                Autonomous calling campaign
              </span>
              <h3>Dental practices · London</h3>
              <p>Qualified leads · website context · sales execution</p>
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
                <Zap size={16} /> Sales Operator
              </div>

              <div className="cu-progress-line">
                <span style={{ width: "72%" }} />
              </div>

              <p>
                Calling qualified leads and executing the next action from the
                conversation outcome…
              </p>
            </div>

            <div className="cu-preview-panel">
              <div className="cu-panel-title">
                <Brain size={16} /> Buyer context
              </div>

              <div className="cu-audit-score">
                <strong>81</strong>
                <span>avg opportunity score</span>
              </div>
            </div>

            <div className="cu-preview-table">
              {[
                ["Smile Studio", "Callback email sent", "Live"],
                ["Nova Dental", "Meeting booked", "Won"],
                ["Pure Clinics", "WhatsApp follow-up", "Next"],
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
