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
  "AI marketing",
  "Lead discovery",
  "Website audits",
  "Auto-reach",
  "WhatsApp follow-ups",
  "CRM pipeline",
  "Territory map",
  "Reply tracking",
];

const features = [
  [Target, "Find", "Discover businesses by niche, city, intent, and digital opportunity."],
  [Brain, "Diagnose", "Audit websites for SEO, trust, conversion, speed, and automation gaps."],
  [Send, "Reach", "Generate personalized email and WhatsApp follow-up sequences from audit insights."],
  [BarChart3, "Track", "Measure leads, sent messages, replies, pipeline progress, and territories."],
];

const agents = [
  [Radar, "Scout Agent", "Searches and filters lead markets inside your selected niche and territory."],
  [Brain, "Audit Agent", "Turns website weaknesses into easy-to-understand opportunities."],
  [Mail, "Writer Agent", "Creates value-first outreach with safe personalization variables."],
  [Workflow, "Pipeline Agent", "Schedules follow-ups and keeps every lead moving through the CRM."],
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
          <a href="#agents">Agents</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="cu-nav-actions">
          <Link className="cu-btn cu-btn-ghost" to="/app/dashboard">
            Dashboard
          </Link>
          <Link className="cu-btn cu-btn-primary" to="/app/builder">
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
              <Zap size={15} /> AI client acquisition workspace
            </span>

            <h1>AI marketing, lead discovery, and auto-reach in one CRM.</h1>

            <p>
              ReachFly.Ai finds businesses, audits their websites, writes
              personalized outreach, manages WhatsApp and email follow-ups, and
              shows the full campaign flow from territory to booked conversation.
            </p>

            <div className="cu-hero-actions">
              <Link className="cu-btn cu-btn-primary cu-btn-xl" to="/app/builder">
                Launch campaign <ArrowRight size={18} />
              </Link>

              <Link className="cu-btn cu-btn-ghost cu-btn-xl" to="/app/dashboard">
                Open workspace
              </Link>
            </div>

            <div className="cu-proof-row">
              {[
                "No spreadsheet chaos",
                "Demo-ready workflow",
                "Guided setup",
                "Compliance-first outreach",
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
            {[...chips, ...chips].map((chip, i) => (
              <span className="cu-product-chip" key={`${chip}-${i}`}>
                <SparkChip i={i} />
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="cu-section">
        <div className="cu-section-head">
          <span className="cu-eyebrow">One connected workspace</span>
          <h2>Everything a modern outreach team needs.</h2>
          <p>
            Instead of jumping between search pages, spreadsheets, email tools,
            WhatsApp, and CRMs, ReachFly connects the entire acquisition loop.
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

      <section id="agents" className="cu-agents">
        <div className="cu-section-head">
          <span className="cu-eyebrow">ReachFly AI agents</span>
          <h2>Command the process without leaving your ecosystem.</h2>
          <p>
            ReachFly AI only answers and takes action inside your campaigns,
            leads, channels, settings, territories, and reports.
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

      <section id="pricing" className="cu-section cu-pricing">
        <div className="cu-section-head">
          <span className="cu-eyebrow">Pricing</span>
          <h2>Start lean and scale when campaigns work.</h2>
        </div>

        <div className="cu-price-grid">
          {[
            ["Starter", "$49", "For freelancers testing one niche."],
            ["Growth", "$149", "For agencies and serious outbound teams."],
            ["Scale", "Custom", "For custom source adapters and teams."],
          ].map(([name, price, text], i) => (
            <article className={i === 1 ? "featured" : ""} key={name}>
              {i === 1 && <div className="cu-price-badge">Most popular</div>}

              <h3>{name}</h3>
              <p>{text}</p>

              <strong>
                {price}
                <span>{price.startsWith("$") ? "/mo" : ""}</span>
              </strong>

              <ul>
                <li>
                  <CheckCircle2 size={15} /> AI campaign builder
                </li>
                <li>
                  <CheckCircle2 size={15} /> Email and WhatsApp pipeline
                </li>
                <li>
                  <CheckCircle2 size={15} /> Dashboard and reports
                </li>
              </ul>

              <Link className="cu-btn cu-btn-primary cu-btn-full" to="/app/builder">
                Start
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="cu-final">
        <div>
          <span className="cu-eyebrow">Ready to run your next campaign?</span>
          <h2>Show a complete workflow, not only static screens.</h2>
          <p>
            Launch a campaign, stream backend progress, open the lead table,
            build a pipeline, connect channels, and manage the workflow from
            ReachFly AI.
          </p>

          <Link className="cu-btn cu-btn-primary cu-btn-xl" to="/app/dashboard">
            Open app <ArrowRight size={18} />
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

        <p>AI-powered lead discovery, audits, and outreach CRM.</p>

        <div>
          <span>
            <Shield size={14} /> Secure workflow
          </span>
          <span>
            <Globe size={14} /> Global campaigns
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
        <span>ReachFly Growth Workspace</span>
      </div>

      <div className="cu-preview-body">
        <aside className="cu-preview-side">
          <div className="cu-preview-logo">
            <BrandLogo size={28} />
            <b>ReachFly.Ai</b>
          </div>

          {["Dashboard", "Launch", "Pipeline", "Channels", "AI"].map(
            (item, i) => (
              <div
                key={item}
                className={`cu-preview-nav-item ${i === 1 ? "active" : ""}`}
              >
                <span />
                {item}
              </div>
            )
          )}
        </aside>

        <main className="cu-preview-main">
          <div className="cu-preview-header">
            <div>
              <span className="cu-preview-kicker">AI campaign</span>
              <h3>Dentists · London</h3>
              <p>100 leads · audit-based outreach</p>
            </div>
            <button>Launch</button>
          </div>

          <div className="cu-preview-metrics">
            {[
              ["Discovered", "94"],
              ["Audited", "77"],
              ["Ready", "51"],
              ["Replies", "8"],
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
                <Radar size={16} /> Scout Agent
              </div>
              <div className="cu-progress-line">
                <span style={{ width: "78%" }} />
              </div>
              <p>Filtering leads by source quality…</p>
            </div>

            <div className="cu-preview-panel">
              <div className="cu-panel-title">
                <Brain size={16} /> Audit Agent
              </div>
              <div className="cu-audit-score">
                <strong>72</strong>
                <span>avg opportunity score</span>
              </div>
            </div>

            <div className="cu-preview-table">
              {["Smile Studio", "Nova Dental", "Pure Clinics"].map(
                (lead, index) => (
                  <div key={lead}>
                    <span>{lead}</span>
                    <em>{["Weak CTA", "No booking flow", "Slow site"][index]}</em>
                    <b>{["A-", "B+", "B"][index]}</b>
                  </div>
                )
              )}
            </div>
          </div>
        </main>
      </div>
    </motion.div>
  );
}