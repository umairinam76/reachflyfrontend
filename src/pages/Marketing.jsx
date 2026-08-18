import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import BrandLogo from "../components/BrandLogo";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Mail,
  MapPinned,
  Menu,
  MessageCircle,
  Phone,
  Shield,
  Sparkles,
  Target,
  Users,
  Workflow,
  X,
  Zap,
} from "../components/icons";

const FEATURES = [
  {
    icon: Target,
    title: "Lead discovery",
    text: "Build focused prospect lists by niche and location, then keep those leads attached to every next step.",
  },
  {
    icon: Brain,
    title: "AI audits",
    text: "Turn website and digital-experience gaps into useful sales context before outreach begins.",
  },
  {
    icon: Bot,
    title: "AI Voice Agents",
    text: "Run disclosed AI sales conversations, capture outcomes, and move qualified prospects forward.",
  },
  {
    icon: Mail,
    title: "Email follow-up",
    text: "Continue conversations with value-first email messaging connected to the same lead and campaign context.",
  },
  {
    icon: Calendar,
    title: "Meeting booking",
    text: "Keep booked meetings connected to the call, contact, owner, and sales context that created them.",
  },
  {
    icon: Workflow,
    title: "Pipeline operations",
    text: "Track assignments, callbacks, follow-ups, status changes, and team activity from one sales workspace.",
  },
];

const AGENTS = [
  {
    icon: MapPinned,
    label: "Scout",
    title: "Scout Agent",
    text: "Finds and filters prospects inside the market, niche, and territory your team chooses.",
  },
  {
    icon: Brain,
    label: "Audit",
    title: "Audit Agent",
    text: "Turns public website and business context into practical outreach intelligence.",
  },
  {
    icon: Phone,
    label: "Voice",
    title: "Voice Agent",
    text: "Runs AI-assisted sales conversations with lead context, outcomes, and meeting-booking support.",
  },
  {
    icon: Mail,
    label: "Writer",
    title: "Writer Agent",
    text: "Creates follow-up messaging from lead, audit, and conversation context.",
  },
  {
    icon: Workflow,
    label: "Pipeline",
    title: "Pipeline Agent",
    text: "Keeps next actions, assignments, and follow-up connected to the lead record.",
  },
];

const FLOW = [
  ["01", "Find the right market", "Choose the niche and location you want to pursue."],
  ["02", "Add useful context", "Use lead data and audits to understand why the prospect may care."],
  ["03", "Launch the right conversation", "Use AI Voice, email, or team follow-up from the same record."],
  ["04", "Capture every outcome", "Keep status, notes, callbacks, meetings, and follow-up visible."],
  ["05", "Operate the pipeline", "Move qualified opportunities forward without losing context."],
];

const SAFEGUARDS = [
  "Workspace-scoped access",
  "Role-based team controls",
  "Disclosure-aware AI calling",
  "Visible call and meeting history",
  "Server-owned billing rates",
  "Connected lead activity",
];

export default function Marketing() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const close = () => setMobileOpen(false);

    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("resize", close);
    };
  }, [mobileOpen]);

  return (
    <>
      <MarketingStyles />

      <main className="rf-marketing-v7">
        <header className="rfm-nav">
          <Link className="rfm-brand" to="/">
            <span>
              <BrandLogo size={38} />
            </span>

            <div>
              <strong>
                ReachFly
              </strong>

              <small>
                Sales OS
              </small>
            </div>
          </Link>

          <nav className="rfm-desktop-nav">
            <a href="#platform">Platform</a>
            <a href="#voice">AI Voice</a>
            <a href="#agents">AI Agents</a>
            <a href="#workflow">Workflow</a>
            <a href="#pricing">Pricing</a>
          </nav>

          <div className="rfm-nav-actions">
            <Link className="rfm-btn secondary" to="/login">
              Sign in
            </Link>

            <Link className="rfm-btn primary" to="/signup">
              Get started
              <ArrowRight size={14} />
            </Link>

            <button
              type="button"
              className="rfm-menu-btn"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        {mobileOpen ? (
          <div
            className="rfm-mobile-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setMobileOpen(false);
              }
            }}
          >
            <aside className="rfm-mobile-menu">
              <header>
                <Link className="rfm-brand" to="/" onClick={() => setMobileOpen(false)}>
                  <span>
                    <BrandLogo size={34} />
                  </span>

                  <div>
                    <strong>ReachFly</strong>
                    <small>Sales OS</small>
                  </div>
                </Link>

                <button
                  type="button"
                  aria-label="Close navigation"
                  onClick={() => setMobileOpen(false)}
                >
                  <X size={16} />
                </button>
              </header>

              <nav>
                {[
                  ["#platform", "Platform"],
                  ["#voice", "AI Voice"],
                  ["#agents", "AI Agents"],
                  ["#workflow", "Workflow"],
                  ["#pricing", "Pricing"],
                ].map(([href, label]) => (
                  <a key={href} href={href} onClick={() => setMobileOpen(false)}>
                    {label}
                    <ChevronRight size={13} />
                  </a>
                ))}
              </nav>

              <div>
                <Link className="rfm-btn secondary" to="/login">
                  Sign in
                </Link>

                <Link className="rfm-btn primary" to="/signup">
                  Create workspace
                  <ArrowRight size={14} />
                </Link>
              </div>
            </aside>
          </div>
        ) : null}

        <section className="rfm-hero">
          <div className="rfm-hero-grid" />

          <motion.div
            className="rfm-hero-copy"
            initial={{
              opacity: 0,
              y: 18,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.45,
            }}
          >
            <span className="rfm-kicker">
              <Sparkles size={14} />
              AI-native sales workspace
            </span>

            <h1>
              Find leads. Start conversations. Keep every next step connected.
            </h1>

            <p>
              ReachFly combines lead discovery, AI audits, AI Voice Agents,
              email follow-up, CRM context, meetings, and team workflows in one
              focused sales operating system.
            </p>

            <div className="rfm-hero-actions">
              <Link className="rfm-btn primary large" to="/signup">
                Create your workspace
                <ArrowRight size={17} />
              </Link>

              <a className="rfm-btn ghost large" href="#platform">
                Explore the platform
              </a>
            </div>

            <div className="rfm-proof">
              <span>
                <Check size={13} />
                Prepaid usage model
              </span>

              <span>
                <Check size={13} />
                Role-based workspace
              </span>

              <span>
                <Check size={13} />
                AI Voice + CRM context
              </span>
            </div>
          </motion.div>

          <ProductPreview />
        </section>

        <section className="rfm-trust-strip">
          <span>Built for focused sales operations</span>

          <div>
            {[
              "Lead discovery",
              "AI audits",
              "AI Voice",
              "Email",
              "Meetings",
              "Pipeline",
              "Team",
            ].map((item) => (
              <b key={item}>{item}</b>
            ))}
          </div>
        </section>

        <section id="platform" className="rfm-section">
          <SectionHeading
            eyebrow="One connected workspace"
            title="Your sales workflow should not reset every time you switch tools."
            text="ReachFly keeps the lead, context, conversation, owner, meeting, follow-up, and pipeline status connected inside one workspace."
          />

          <div className="rfm-feature-grid">
            {FEATURES.map((item, index) => {
              const Icon = item.icon;

              return (
                <motion.article
                  key={item.title}
                  initial={{
                    opacity: 0,
                    y: 12,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{
                    once: true,
                    amount: 0.2,
                  }}
                  transition={{
                    delay: index * 0.04,
                  }}
                >
                  <span>
                    <Icon size={19} />
                  </span>

                  <strong>
                    {item.title}
                  </strong>

                  <p>
                    {item.text}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section id="voice" className="rfm-section rfm-voice-section">
          <div className="rfm-voice-copy">
            <span className="rfm-eyebrow">
              AI Voice
            </span>

            <h2>
              Give your sales workflow a Voice Agent that already knows the lead.
            </h2>

            <p>
              Configure the agent, connect a business number, load business and
              lead context, review call outcomes, and continue follow-up without
              rebuilding the conversation somewhere else.
            </p>

            <ul>
              <li>
                <CheckCircle2 size={14} />
                Lead and company context before the call
              </li>
              <li>
                <CheckCircle2 size={14} />
                Call outcomes, transcripts, and follow-up in the workspace
              </li>
              <li>
                <CheckCircle2 size={14} />
                Meeting booking connected to the same sales record
              </li>
              <li>
                <CheckCircle2 size={14} />
                Disclosure-aware AI calling workflow
              </li>
            </ul>

            <Link className="rfm-inline-cta" to="/signup">
              Configure your workspace
              <ArrowRight size={14} />
            </Link>
          </div>

          <VoicePreview />
        </section>

        <section id="agents" className="rfm-section">
          <SectionHeading
            eyebrow="Specialist AI agents"
            title="Use AI where it adds leverage without losing the human sales process."
            text="ReachFly's agent experiences support discovery, analysis, calling, messaging, and follow-up while keeping the workspace as the source of operational context."
          />

          <div className="rfm-agent-grid">
            {AGENTS.map((item, index) => {
              const Icon = item.icon;

              return (
                <article key={item.title}>
                  <header>
                    <span>
                      <Icon size={19} />
                    </span>

                    <em>
                      0{index + 1}
                    </em>
                  </header>

                  <small>
                    {item.label}
                  </small>

                  <strong>
                    {item.title}
                  </strong>

                  <p>
                    {item.text}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="rfm-section rfm-workflow-section">
          <SectionHeading
            eyebrow="A simpler operating flow"
            title="From market selection to real conversations in one sequence."
            text="The product is structured around the steps a sales team actually takes, instead of exposing every technical setting at once."
          />

          <div className="rfm-flow">
            {FLOW.map(([number, title, text]) => (
              <article key={number}>
                <span>
                  {number}
                </span>

                <div>
                  <strong>
                    {title}
                  </strong>

                  <p>
                    {text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rfm-section rfm-safeguards">
          <div>
            <span className="rfm-eyebrow">
              Controlled operations
            </span>

            <h2>
              AI sales automation should stay visible, scoped, and reviewable.
            </h2>

            <p>
              ReachFly is designed around workspace ownership, role-based
              access, visible activity, and customer-safe product language.
            </p>
          </div>

          <div className="rfm-safeguard-grid">
            {SAFEGUARDS.map((item) => (
              <span key={item}>
                <Shield size={14} />
                {item}
              </span>
            ))}
          </div>
        </section>

        <section id="pricing" className="rfm-section">
          <SectionHeading
            eyebrow="Usage-based pricing"
            title="Use prepaid credits instead of hiding product costs behind fake tiers."
            text="ReachFly shows active credit packs and server-owned rates inside Billing. Checkout amounts come from the backend, not from editable browser values."
          />

          <div className="rfm-pricing-grid">
            <PricingCard
              icon={Zap}
              title="ReachFly Credits"
              text="General usage credits cover supported product actions such as lead discovery, audits, and AI-assisted workflows according to the live rate card."
              points={[
                "Prepaid workspace balance",
                "Usage and ledger history",
                "Server-published feature rates",
              ]}
              action="Create workspace"
            />

            <PricingCard
              icon={Phone}
              title="AI Call Credits"
              text="Calling uses its own credit wallet so voice usage remains visible and separate from general ReachFly product credits."
              points={[
                "Separate calling wallet",
                "Connected-call usage history",
                "Business-number readiness",
              ]}
              featured
              action="Start AI Voice"
            />

            <PricingCard
              icon={Building2}
              title="Business Number"
              text="Connect or purchase an approved business number as part of AI Voice onboarding, then keep its workspace status visible."
              points={[
                "Workspace-scoped number",
                "Calling readiness state",
                "Existing-number connection flow",
              ]}
              action="Configure calling"
            />
          </div>
        </section>

        <section className="rfm-final">
          <div>
            <span className="rfm-kicker">
              <Sparkles size={14} />
              Build the whole sales loop
            </span>

            <h2>
              Start with a market. End with a measurable sales conversation.
            </h2>

            <p>
              Create your ReachFly workspace, configure the right AI Voice
              workflow, connect lead context, and keep every outcome visible.
            </p>

            <div>
              <Link className="rfm-btn primary large" to="/signup">
                Get started
                <ArrowRight size={17} />
              </Link>

              <Link className="rfm-btn ghost large" to="/login">
                Open workspace
              </Link>
            </div>
          </div>
        </section>

        <footer className="rfm-footer">
          <div className="rfm-footer-brand">
            <Link className="rfm-brand" to="/">
              <span>
                <BrandLogo size={36} />
              </span>

              <div>
                <strong>
                  ReachFly
                </strong>

                <small>
                  Sales OS
                </small>
              </div>
            </Link>

            <p>
              AI-native lead discovery, calling, follow-up, and CRM operations.
            </p>
          </div>

          <nav>
            <a href="#platform">Platform</a>
            <a href="#voice">AI Voice</a>
            <a href="#pricing">Pricing</a>
            <Link to="/blog">Blog</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>

          <div>
            <span>
              <Shield size={13} />
              Controlled workflows
            </span>

            <span>
              <Globe2 size={13} />
              Connected sales operations
            </span>
          </div>
        </footer>
      </main>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
}) {
  return (
    <header className="rfm-section-head">
      <span className="rfm-eyebrow">
        {eyebrow}
      </span>

      <h2>
        {title}
      </h2>

      <p>
        {text}
      </p>
    </header>
  );
}

function PricingCard({
  icon: Icon,
  title,
  text,
  points,
  action,
  featured = false,
}) {
  return (
    <article className={`rfm-price-card ${featured ? "featured" : ""}`}>
      {featured ? (
        <span className="rfm-price-badge">
          AI Voice
        </span>
      ) : null}

      <header>
        <span>
          <Icon size={19} />
        </span>

        <strong>
          {title}
        </strong>
      </header>

      <p>
        {text}
      </p>

      <ul>
        {points.map((point) => (
          <li key={point}>
            <CheckCircle2 size={13} />
            {point}
          </li>
        ))}
      </ul>

      <Link className="rfm-btn primary full" to="/signup">
        {action}
        <ArrowRight size={14} />
      </Link>
    </article>
  );
}

function ProductPreview() {
  return (
    <motion.div
      className="rfm-product-preview"
      initial={{
        opacity: 0,
        y: 24,
        scale: 0.985,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      transition={{
        duration: 0.5,
        delay: 0.12,
      }}
    >
      <header>
        <div>
          <i />
          <i />
          <i />
        </div>

        <small>
          ReachFly Sales Workspace
        </small>

        <Shield size={12} />
      </header>

      <div className="rfm-product-body">
        <aside>
          <span className="rfm-mini-brand">
            <BrandLogo size={23} />
          </span>

          {[
            "Overview",
            "Leads",
            "AI Voice",
            "Meetings",
            "Inbox",
            "Pipeline",
          ].map((item, index) => (
            <span
              key={item}
              className={index === 2 ? "active" : ""}
            >
              <i />
              {item}
            </span>
          ))}
        </aside>

        <main>
          <div className="rfm-preview-head">
            <div>
              <small>
                AI Voice Campaign
              </small>

              <strong>
                Dental practices · London
              </strong>
            </div>

            <button type="button">
              Launch
            </button>
          </div>

          <div className="rfm-preview-metrics">
            {[
              ["Ready leads", "48", Target],
              ["Queued", "9", Workflow],
              ["Live calls", "2", Phone],
              ["Meetings", "6", Calendar],
            ].map(([label, value, Icon]) => (
              <article key={label}>
                <span>
                  <Icon size={12} />
                </span>

                <strong>
                  {value}
                </strong>

                <small>
                  {label}
                </small>
              </article>
            ))}
          </div>

          <div className="rfm-preview-content">
            <section>
              <header>
                <span>
                  <Bot size={13} />
                </span>

                <strong>
                  Voice Agent
                </strong>

                <em>
                  Live
                </em>
              </header>

              <div className="rfm-call-wave">
                {Array.from({
                  length: 24,
                }).map((_, index) => (
                  <i
                    key={index}
                    style={{
                      "--wave-height": `${9 + ((index * 7) % 23)}px`,
                    }}
                  />
                ))}
              </div>

              <p>
                Calling qualified leads and writing outcomes back to the same
                workspace.
              </p>
            </section>

            <section>
              <header>
                <span>
                  <Brain size={13} />
                </span>

                <strong>
                  Lead context
                </strong>
              </header>

              <div className="rfm-context-score">
                <b>
                  81
                </b>

                <span>
                  Opportunity score
                </span>
              </div>
            </section>

            <div className="rfm-preview-table">
              {[
                ["Nova Dental", "Meeting booked", "Won"],
                ["Smile Studio", "Callback", "Live"],
                ["Pure Clinics", "Email follow-up", "Next"],
              ].map(([lead, outcome, status]) => (
                <div key={lead}>
                  <span>
                    {lead}
                  </span>

                  <small>
                    {outcome}
                  </small>

                  <em>
                    {status}
                  </em>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </motion.div>
  );
}

function VoicePreview() {
  return (
    <div className="rfm-voice-preview">
      <header>
        <span>
          <Phone size={15} />
        </span>

        <div>
          <small>
            Active AI Voice conversation
          </small>

          <strong>
            Nova Dental
          </strong>
        </div>

        <em>
          02:14
        </em>
      </header>

      <div className="rfm-voice-wave">
        {Array.from({
          length: 44,
        }).map((_, index) => (
          <i
            key={index}
            style={{
              "--voice-height": `${8 + ((index * 13) % 34)}px`,
            }}
          />
        ))}
      </div>

      <div className="rfm-transcript">
        <article>
          <span>
            AI
          </span>

          <p>
            I noticed your booking journey could make it easier for new patients
            to choose a time. Is improving online conversion a priority this
            quarter?
          </p>
        </article>

        <article className="contact">
          <span>
            ND
          </span>

          <p>
            Yes, we'd like more bookings from the website. Send me the audit and
            let's schedule a follow-up.
          </p>
        </article>
      </div>

      <footer>
        <span>
          <CheckCircle2 size={13} />
          Qualified
        </span>

        <span>
          <Calendar size={13} />
          Meeting suggested
        </span>
      </footer>
    </div>
  );
}

function MarketingStyles() {
  return (
    <style>{`
      .rf-marketing-v7{
        --rfm-bg:#f8f9fa;
        --rfm-card:#fff;
        --rfm-text:#191c1d;
        --rfm-text2:#4c4b59;
        --rfm-muted:#757585;
        --rfm-line:#e3e5e7;
        --rfm-primary:#4648d4;
        --rfm-primary-dark:#3537bb;
        --rfm-primary-soft:#e8e9ff;
        --rfm-violet:#6b38d4;
        --rfm-dark:#2e3132;
        --rfm-green:#087a51;
        --rfm-green-soft:#dff8eb;
        --rfm-ease:cubic-bezier(.2,.8,.2,1);
        min-height:100vh;
        color:var(--rfm-text);
        background:var(--rfm-bg);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-marketing-v7 *,
      .rf-marketing-v7 *::before,
      .rf-marketing-v7 *::after{
        box-sizing:border-box;
      }

      .rf-marketing-v7 a{
        color:inherit;
      }

      .rfm-nav{
        position:sticky;
        z-index:100;
        top:0;
        min-height:68px;
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:center;
        gap:24px;
        padding:0 max(24px,calc((100vw - 1440px)/2));
        background:rgba(248,249,250,.88);
        border-bottom:1px solid rgba(227,229,231,.85);
        backdrop-filter:blur(16px);
      }

      .rfm-brand{
        display:flex;
        align-items:center;
        gap:8px;
        width:max-content;
        text-decoration:none;
      }

      .rfm-brand > span{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
      }

      .rfm-brand > div{
        display:grid;
      }

      .rfm-brand strong{
        font:600 15px/18px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfm-brand small{
        color:var(--rfm-primary);
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.12em;
        text-transform:uppercase;
      }

      .rfm-desktop-nav{
        justify-self:center;
        display:flex;
        align-items:center;
        gap:25px;
      }

      .rfm-desktop-nav a{
        color:var(--rfm-text2);
        text-decoration:none;
        font-size:8px;
        font-weight:650;
      }

      .rfm-desktop-nav a:hover{
        color:var(--rfm-primary);
      }

      .rfm-nav-actions{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rfm-btn{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 11px;
        border:1px solid transparent;
        border-radius:8px;
        text-decoration:none;
        white-space:nowrap;
        font-size:8px;
        font-weight:700;
        transition:.15s var(--rfm-ease);
      }

      .rfm-btn:hover{
        transform:translateY(-1px);
      }

      .rfm-btn.primary{
        color:#fff;
        background:var(--rfm-primary);
        border-color:var(--rfm-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.15);
      }

      .rfm-btn.primary:hover{
        background:var(--rfm-primary-dark);
      }

      .rfm-btn.secondary{
        background:#fff;
        border-color:var(--rfm-line);
      }

      .rfm-btn.ghost{
        color:var(--rfm-text);
        background:rgba(255,255,255,.68);
        border-color:rgba(255,255,255,.38);
      }

      .rfm-btn.large{
        min-height:47px;
        padding:10px 15px;
        border-radius:9px;
        font-size:9px;
      }

      .rfm-btn.full{
        width:100%;
        margin-top:auto;
      }

      .rfm-menu-btn{
        display:none;
        width:38px;
        height:38px;
        place-items:center;
        padding:0;
        color:var(--rfm-text);
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:8px;
      }

      .rfm-hero{
        position:relative;
        min-height:720px;
        display:grid;
        grid-template-columns:minmax(0,.9fr) minmax(560px,1.1fr);
        align-items:center;
        gap:44px;
        overflow:hidden;
        padding:82px max(30px,calc((100vw - 1360px)/2)) 70px;
        color:#fff;
        background:
          radial-gradient(circle at 10% 15%,rgba(88,91,224,.26),transparent 28%),
          radial-gradient(circle at 80% 65%,rgba(107,56,212,.24),transparent 34%),
          linear-gradient(145deg,#2a2d2f,#303335 55%,#292c2e);
      }

      .rfm-hero-grid{
        position:absolute;
        inset:0;
        opacity:.27;
        pointer-events:none;
        background-image:
          linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
        background-size:30px 30px;
        mask-image:linear-gradient(#000,transparent 90%);
      }

      .rfm-hero-copy,
      .rfm-product-preview{
        position:relative;
        z-index:2;
      }

      .rfm-kicker{
        width:max-content;
        min-height:29px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:5px 8px;
        color:#d8d9ff;
        background:rgba(87,89,219,.16);
        border:1px solid rgba(156,158,255,.13);
        border-radius:999px;
        font-size:7px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfm-hero-copy h1{
        max-width:650px;
        margin:17px 0 0;
        color:#fff;
        font:600 clamp(45px,5.2vw,72px)/.99 Geist,Inter,sans-serif;
        letter-spacing:-.055em;
      }

      .rfm-hero-copy > p{
        max-width:590px;
        margin:19px 0 0;
        color:rgba(241,243,244,.69);
        font-size:12px;
        line-height:20px;
      }

      .rfm-hero-actions{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:25px;
      }

      .rfm-proof{
        display:flex;
        flex-wrap:wrap;
        gap:12px;
        margin-top:19px;
        color:rgba(239,241,242,.55);
      }

      .rfm-proof span{
        display:flex;
        align-items:center;
        gap:5px;
        font-size:6.5px;
      }

      .rfm-proof svg{
        color:#bfc0ff;
      }

      .rfm-product-preview{
        overflow:hidden;
        background:#fbfbfc;
        border:1px solid rgba(255,255,255,.68);
        border-radius:14px;
        box-shadow:
          0 35px 80px rgba(0,0,0,.27),
          0 7px 18px rgba(0,0,0,.10);
        transform:perspective(1200px) rotateY(-3deg) rotateX(1deg);
      }

      .rfm-product-preview > header{
        height:37px;
        display:grid;
        grid-template-columns:1fr auto 1fr;
        align-items:center;
        padding:0 12px;
        color:#7c7d85;
        background:#f1f2f4;
        border-bottom:1px solid #e2e4e6;
      }

      .rfm-product-preview > header > div{
        display:flex;
        gap:4px;
      }

      .rfm-product-preview > header i{
        width:7px;
        height:7px;
        background:#c6c8cc;
        border-radius:50%;
      }

      .rfm-product-preview > header small{
        font-size:6px;
        font-weight:700;
        text-transform:uppercase;
      }

      .rfm-product-preview > header svg{
        justify-self:end;
      }

      .rfm-product-body{
        min-height:470px;
        display:grid;
        grid-template-columns:112px minmax(0,1fr);
      }

      .rfm-product-body > aside{
        display:grid;
        align-content:start;
        gap:4px;
        padding:15px 9px;
        background:#303335;
      }

      .rfm-mini-brand{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        margin:0 0 12px 5px;
      }

      .rfm-product-body > aside > span:not(.rfm-mini-brand){
        min-height:32px;
        display:flex;
        align-items:center;
        gap:6px;
        padding:6px 7px;
        color:#9ea2a7;
        border-radius:6px;
        font-size:6px;
      }

      .rfm-product-body > aside > span.active{
        color:#fff;
        background:#4648d4;
      }

      .rfm-product-body > aside > span i{
        width:12px;
        height:4px;
        background:currentColor;
        border-radius:999px;
        opacity:.75;
      }

      .rfm-product-body > main{
        min-width:0;
        padding:17px;
        color:var(--rfm-text);
        background:#f8f9fa;
      }

      .rfm-preview-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }

      .rfm-preview-head > div{
        display:grid;
      }

      .rfm-preview-head small{
        color:var(--rfm-primary);
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfm-preview-head strong{
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfm-preview-head button{
        min-height:30px;
        padding:5px 9px;
        color:#fff;
        background:var(--rfm-primary);
        border:0;
        border-radius:6px;
        font-size:6px;
        font-weight:700;
      }

      .rfm-preview-metrics{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:7px;
        margin-top:13px;
      }

      .rfm-preview-metrics article{
        min-height:77px;
        display:grid;
        align-content:space-between;
        padding:9px;
        background:#fff;
        border:1px solid #e4e6e8;
        border-radius:8px;
      }

      .rfm-preview-metrics article > span{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        color:var(--rfm-primary);
        background:var(--rfm-primary-soft);
        border-radius:7px;
      }

      .rfm-preview-metrics article strong{
        margin-top:6px;
        font-size:13px;
      }

      .rfm-preview-metrics article small{
        color:#83848b;
        font-size:5px;
      }

      .rfm-preview-content{
        display:grid;
        grid-template-columns:1.2fr .8fr;
        gap:7px;
        margin-top:8px;
      }

      .rfm-preview-content > section{
        min-height:141px;
        padding:10px;
        background:#fff;
        border:1px solid #e4e6e8;
        border-radius:8px;
      }

      .rfm-preview-content > section > header{
        display:flex;
        align-items:center;
        gap:6px;
      }

      .rfm-preview-content > section header > span{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        color:var(--rfm-primary);
        background:var(--rfm-primary-soft);
        border-radius:6px;
      }

      .rfm-preview-content > section header strong{
        flex:1;
        font-size:6.5px;
      }

      .rfm-preview-content > section header em{
        padding:3px 5px;
        color:#087a51;
        background:#dff8eb;
        border-radius:999px;
        font-size:5px;
        font-style:normal;
      }

      .rfm-call-wave{
        height:44px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:3px;
        margin:8px 0;
      }

      .rfm-call-wave i{
        width:3px;
        height:var(--wave-height);
        background:#6d6fe1;
        border-radius:999px;
      }

      .rfm-preview-content section > p{
        margin:0;
        color:#85868d;
        font-size:5.5px;
        line-height:9px;
      }

      .rfm-context-score{
        min-height:80px;
        display:grid;
        place-items:center;
        align-content:center;
        margin-top:9px;
        background:#f5f4fb;
        border-radius:7px;
      }

      .rfm-context-score b{
        color:var(--rfm-violet);
        font-size:25px;
      }

      .rfm-context-score span{
        color:#888893;
        font-size:5px;
      }

      .rfm-preview-table{
        grid-column:1/-1;
        overflow:hidden;
        background:#fff;
        border:1px solid #e4e6e8;
        border-radius:8px;
      }

      .rfm-preview-table > div{
        min-height:39px;
        display:grid;
        grid-template-columns:1fr 1fr auto;
        align-items:center;
        gap:8px;
        padding:0 10px;
      }

      .rfm-preview-table > div + div{
        border-top:1px solid #eff0f1;
      }

      .rfm-preview-table span{
        font-size:6px;
        font-weight:700;
      }

      .rfm-preview-table small{
        color:#81828a;
        font-size:5.5px;
      }

      .rfm-preview-table em{
        padding:3px 5px;
        color:var(--rfm-primary);
        background:var(--rfm-primary-soft);
        border-radius:999px;
        font-size:5px;
        font-style:normal;
        font-weight:700;
      }

      .rfm-trust-strip{
        min-height:72px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:22px;
        padding:15px 24px;
        background:#fff;
        border-bottom:1px solid var(--rfm-line);
      }

      .rfm-trust-strip > span{
        color:var(--rfm-muted);
        font-size:6px;
        font-weight:700;
        text-transform:uppercase;
      }

      .rfm-trust-strip > div{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:8px;
      }

      .rfm-trust-strip b{
        padding:5px 7px;
        color:#5f606a;
        background:#f3f4f5;
        border-radius:999px;
        font-size:5.5px;
        font-weight:700;
      }

      .rfm-section{
        width:min(1240px,calc(100% - 48px));
        margin:0 auto;
        padding:96px 0;
      }

      .rfm-section-head{
        max-width:820px;
        margin-bottom:37px;
      }

      .rfm-eyebrow{
        display:block;
        margin-bottom:6px;
        color:var(--rfm-primary);
        font-size:7px;
        font-weight:800;
        letter-spacing:.1em;
        text-transform:uppercase;
      }

      .rfm-section-head h2,
      .rfm-voice-copy h2,
      .rfm-safeguards h2,
      .rfm-final h2{
        margin:0;
        font:600 clamp(30px,4vw,48px)/1.08 Geist,Inter,sans-serif;
        letter-spacing:-.04em;
      }

      .rfm-section-head p,
      .rfm-voice-copy > p,
      .rfm-safeguards > div:first-child > p,
      .rfm-final p{
        max-width:720px;
        margin:11px 0 0;
        color:var(--rfm-text2);
        font-size:10px;
        line-height:17px;
      }

      .rfm-feature-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
      }

      .rfm-feature-grid article{
        min-height:215px;
        display:grid;
        align-content:start;
        padding:20px;
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rfm-feature-grid article > span{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        color:var(--rfm-primary);
        background:var(--rfm-primary-soft);
        border-radius:10px;
      }

      .rfm-feature-grid article > strong{
        margin-top:23px;
        font:600 13px/18px Geist,Inter,sans-serif;
      }

      .rfm-feature-grid article > p{
        margin:5px 0 0;
        color:var(--rfm-muted);
        font-size:8px;
        line-height:14px;
      }

      .rfm-voice-section{
        width:auto;
        max-width:none;
        display:grid;
        grid-template-columns:minmax(0,.85fr) minmax(500px,1.15fr);
        align-items:center;
        gap:70px;
        padding:95px max(30px,calc((100vw - 1240px)/2));
        color:#fff;
        background:
          radial-gradient(circle at 88% 20%,rgba(99,102,238,.16),transparent 28%),
          #2e3132;
      }

      .rfm-voice-copy .rfm-eyebrow{
        color:#bfc0ff;
      }

      .rfm-voice-copy > p{
        color:rgba(239,241,242,.62);
      }

      .rfm-voice-copy ul{
        display:grid;
        gap:8px;
        padding:0;
        margin:24px 0 0;
        list-style:none;
      }

      .rfm-voice-copy li{
        display:flex;
        align-items:flex-start;
        gap:7px;
        color:rgba(242,244,245,.75);
        font-size:8px;
      }

      .rfm-voice-copy li svg{
        flex:0 0 auto;
        color:#aeb0ff;
      }

      .rfm-inline-cta{
        display:inline-flex;
        align-items:center;
        gap:6px;
        margin-top:25px;
        color:#d1d2ff!important;
        text-decoration:none;
        font-size:8px;
        font-weight:750;
      }

      .rfm-voice-preview{
        overflow:hidden;
        background:#fff;
        border:1px solid rgba(255,255,255,.16);
        border-radius:13px;
        box-shadow:0 25px 65px rgba(0,0,0,.22);
      }

      .rfm-voice-preview > header{
        min-height:72px;
        display:grid;
        grid-template-columns:37px minmax(0,1fr) auto;
        align-items:center;
        gap:9px;
        padding:12px 14px;
        color:var(--rfm-text);
        background:#f8f9fa;
        border-bottom:1px solid var(--rfm-line);
      }

      .rfm-voice-preview > header > span{
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
        color:var(--rfm-primary);
        background:var(--rfm-primary-soft);
        border-radius:9px;
      }

      .rfm-voice-preview > header > div{
        display:grid;
      }

      .rfm-voice-preview > header small{
        color:var(--rfm-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rfm-voice-preview > header strong{
        font-size:9px;
      }

      .rfm-voice-preview > header em{
        color:var(--rfm-green);
        font-size:7px;
        font-style:normal;
        font-weight:700;
      }

      .rfm-voice-wave{
        height:100px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:3px;
        padding:0 18px;
        background:
          linear-gradient(180deg,#fff,#fafaff);
      }

      .rfm-voice-wave i{
        width:3px;
        height:var(--voice-height);
        background:linear-gradient(#7779e7,#4648d4);
        border-radius:999px;
      }

      .rfm-transcript{
        display:grid;
        gap:8px;
        padding:13px 14px;
        color:var(--rfm-text);
        background:#f7f8f9;
        border-top:1px solid var(--rfm-line);
      }

      .rfm-transcript article{
        display:grid;
        grid-template-columns:29px minmax(0,1fr);
        align-items:start;
        gap:8px;
        padding:9px;
        background:#fff;
        border:1px solid #e7e8ea;
        border-radius:8px;
      }

      .rfm-transcript article > span{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfm-primary);
        border-radius:8px;
        font-size:5.5px;
        font-weight:800;
      }

      .rfm-transcript article.contact > span{
        background:#2e3132;
      }

      .rfm-transcript p{
        margin:0;
        color:var(--rfm-text2);
        font-size:6.8px;
        line-height:12px;
      }

      .rfm-voice-preview > footer{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        padding:10px 14px;
        color:var(--rfm-text);
        background:#fff;
        border-top:1px solid var(--rfm-line);
      }

      .rfm-voice-preview > footer span{
        display:flex;
        align-items:center;
        gap:4px;
        padding:5px 7px;
        color:var(--rfm-green);
        background:var(--rfm-green-soft);
        border-radius:999px;
        font-size:6px;
        font-weight:700;
      }

      .rfm-agent-grid{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:9px;
      }

      .rfm-agent-grid article{
        min-height:250px;
        display:grid;
        align-content:start;
        padding:16px;
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:12px;
      }

      .rfm-agent-grid article > header{
        display:flex;
        align-items:center;
        justify-content:space-between;
      }

      .rfm-agent-grid article > header > span{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        color:var(--rfm-primary);
        background:var(--rfm-primary-soft);
        border-radius:9px;
      }

      .rfm-agent-grid article > header em{
        color:#afb0b8;
        font-size:7px;
        font-style:normal;
        font-weight:750;
      }

      .rfm-agent-grid article > small{
        margin-top:25px;
        color:var(--rfm-primary);
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfm-agent-grid article > strong{
        margin-top:3px;
        font:600 11px/16px Geist,Inter,sans-serif;
      }

      .rfm-agent-grid article > p{
        margin:5px 0 0;
        color:var(--rfm-muted);
        font-size:7px;
        line-height:12px;
      }

      .rfm-workflow-section{
        padding-top:70px;
      }

      .rfm-flow{
        display:grid;
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:13px;
      }

      .rfm-flow article{
        min-height:91px;
        display:grid;
        grid-template-columns:57px minmax(0,1fr);
        align-items:center;
        gap:12px;
        padding:13px 17px;
      }

      .rfm-flow article + article{
        border-top:1px solid #eff0f1;
      }

      .rfm-flow article > span{
        width:45px;
        height:45px;
        display:grid;
        place-items:center;
        color:var(--rfm-primary);
        background:var(--rfm-primary-soft);
        border-radius:10px;
        font-size:7px;
        font-weight:800;
      }

      .rfm-flow article > div{
        display:grid;
      }

      .rfm-flow strong{
        font-size:9px;
      }

      .rfm-flow p{
        margin:2px 0 0;
        color:var(--rfm-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfm-safeguards{
        display:grid;
        grid-template-columns:minmax(0,.9fr) minmax(500px,1.1fr);
        align-items:center;
        gap:60px;
        padding-top:70px;
        padding-bottom:70px;
      }

      .rfm-safeguard-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
      }

      .rfm-safeguard-grid span{
        min-height:57px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:10px 12px;
        color:var(--rfm-text2);
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:9px;
        font-size:7px;
        font-weight:650;
      }

      .rfm-safeguard-grid svg{
        color:var(--rfm-primary);
      }

      .rfm-pricing-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
      }

      .rfm-price-card{
        position:relative;
        min-height:410px;
        display:flex;
        flex-direction:column;
        padding:20px;
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:13px;
      }

      .rfm-price-card.featured{
        border-color:#cacbff;
        box-shadow:
          0 0 0 1px #cacbff,
          0 15px 36px rgba(70,72,212,.07);
      }

      .rfm-price-badge{
        position:absolute;
        right:14px;
        top:14px;
        padding:4px 6px;
        color:var(--rfm-primary);
        background:var(--rfm-primary-soft);
        border-radius:999px;
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfm-price-card > header{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rfm-price-card > header > span{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        color:var(--rfm-primary);
        background:var(--rfm-primary-soft);
        border-radius:9px;
      }

      .rfm-price-card > header strong{
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfm-price-card > p{
        margin:18px 0 0;
        color:var(--rfm-text2);
        font-size:8px;
        line-height:14px;
      }

      .rfm-price-card ul{
        display:grid;
        gap:8px;
        padding:18px 0 25px;
        margin:18px 0 0;
        border-top:1px solid #eff0f1;
        list-style:none;
      }

      .rfm-price-card li{
        display:flex;
        align-items:flex-start;
        gap:6px;
        color:var(--rfm-text2);
        font-size:7px;
      }

      .rfm-price-card li svg{
        flex:0 0 auto;
        color:var(--rfm-green);
      }

      .rfm-final{
        width:min(1240px,calc(100% - 48px));
        margin:20px auto 0;
        overflow:hidden;
        padding:65px;
        color:#fff;
        background:
          radial-gradient(circle at 90% 20%,rgba(96,99,233,.25),transparent 31%),
          radial-gradient(circle at 8% 80%,rgba(107,56,212,.18),transparent 28%),
          #2e3132;
        border-radius:20px;
      }

      .rfm-final > div{
        max-width:850px;
      }

      .rfm-final .rfm-kicker{
        margin-bottom:15px;
      }

      .rfm-final p{
        color:rgba(241,243,244,.64);
      }

      .rfm-final > div > div{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:24px;
      }

      .rfm-footer{
        width:min(1240px,calc(100% - 48px));
        min-height:210px;
        display:grid;
        grid-template-columns:1.2fr 1fr 1fr;
        align-items:start;
        gap:45px;
        margin:0 auto;
        padding:58px 0 46px;
      }

      .rfm-footer-brand{
        display:grid;
      }

      .rfm-footer-brand > p{
        max-width:320px;
        margin:10px 0 0;
        color:var(--rfm-muted);
        font-size:7px;
        line-height:12px;
      }

      .rfm-footer nav{
        display:grid;
        gap:8px;
      }

      .rfm-footer nav a{
        width:max-content;
        color:var(--rfm-text2);
        text-decoration:none;
        font-size:7px;
      }

      .rfm-footer > div:last-child{
        display:grid;
        gap:7px;
      }

      .rfm-footer > div:last-child span{
        display:flex;
        align-items:center;
        gap:6px;
        color:var(--rfm-muted);
        font-size:6.5px;
      }

      .rfm-footer > div:last-child svg{
        color:var(--rfm-primary);
      }

      .rfm-mobile-backdrop{
        position:fixed;
        z-index:220;
        inset:0;
        display:flex;
        justify-content:flex-end;
        background:rgba(25,28,29,.28);
        backdrop-filter:blur(3px);
      }

      .rfm-mobile-menu{
        width:min(340px,90vw);
        min-height:100%;
        padding:18px;
        background:#fff;
        box-shadow:-20px 0 60px rgba(25,28,29,.13);
      }

      .rfm-mobile-menu > header{
        display:flex;
        align-items:center;
        justify-content:space-between;
      }

      .rfm-mobile-menu > header > button{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        background:#fff;
        border:1px solid var(--rfm-line);
        border-radius:8px;
      }

      .rfm-mobile-menu nav{
        display:grid;
        margin-top:24px;
      }

      .rfm-mobile-menu nav a{
        min-height:48px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:0 4px;
        border-bottom:1px solid #eff0f1;
        text-decoration:none;
        font-size:8px;
        font-weight:650;
      }

      .rfm-mobile-menu > div:last-child{
        display:grid;
        gap:7px;
        margin-top:20px;
      }

      @media(max-width:1180px){
        .rfm-hero{
          grid-template-columns:1fr;
          gap:55px;
          padding-top:70px;
        }

        .rfm-hero-copy{
          max-width:780px;
        }

        .rfm-product-preview{
          width:min(780px,100%);
          margin:0 auto;
          transform:none;
        }

        .rfm-voice-section{
          grid-template-columns:1fr;
        }

        .rfm-voice-copy{
          max-width:760px;
        }

        .rfm-voice-preview{
          width:min(760px,100%);
        }

        .rfm-agent-grid{
          grid-template-columns:repeat(3,1fr);
        }
      }

      @media(max-width:900px){
        .rfm-desktop-nav{
          display:none;
        }

        .rfm-nav{
          grid-template-columns:1fr auto;
        }

        .rfm-menu-btn{
          display:grid;
        }

        .rfm-nav-actions > .rfm-btn.secondary{
          display:none;
        }

        .rfm-feature-grid,
        .rfm-pricing-grid{
          grid-template-columns:1fr 1fr;
        }

        .rfm-agent-grid{
          grid-template-columns:1fr 1fr;
        }

        .rfm-safeguards{
          grid-template-columns:1fr;
        }

        .rfm-footer{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:680px){
        .rfm-nav{
          min-height:62px;
          padding:0 14px;
        }

        .rfm-nav-actions > .rfm-btn.primary{
          display:none;
        }

        .rfm-hero{
          min-height:0;
          padding:60px 18px 48px;
        }

        .rfm-hero-copy h1{
          font-size:44px;
        }

        .rfm-hero-copy > p{
          font-size:10px;
          line-height:17px;
        }

        .rfm-product-preview{
          border-radius:10px;
        }

        .rfm-product-body{
          min-height:0;
          grid-template-columns:1fr;
        }

        .rfm-product-body > aside{
          display:none;
        }

        .rfm-product-body > main{
          padding:12px;
        }

        .rfm-preview-metrics{
          grid-template-columns:1fr 1fr;
        }

        .rfm-preview-content{
          grid-template-columns:1fr;
        }

        .rfm-preview-table{
          grid-column:auto;
        }

        .rfm-trust-strip{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfm-section{
          width:min(100% - 28px,1240px);
          padding:70px 0;
        }

        .rfm-feature-grid,
        .rfm-pricing-grid,
        .rfm-agent-grid{
          grid-template-columns:1fr;
        }

        .rfm-voice-section{
          padding:70px 14px;
        }

        .rfm-safeguard-grid{
          grid-template-columns:1fr;
        }

        .rfm-final{
          width:calc(100% - 28px);
          padding:38px 24px;
          border-radius:15px;
        }

        .rfm-footer{
          width:calc(100% - 28px);
          grid-template-columns:1fr;
          gap:25px;
        }
      }

      @media(max-width:430px){
        .rfm-hero-copy h1{
          font-size:38px;
        }

        .rfm-btn.large{
          width:100%;
        }

        .rfm-hero-actions{
          display:grid;
        }

        .rfm-preview-content > section:nth-child(2){
          display:none;
        }

        .rfm-preview-table > div{
          grid-template-columns:1fr auto;
        }

        .rfm-preview-table small{
          display:none;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-marketing-v7 *,
        .rf-marketing-v7 *::before,
        .rf-marketing-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
