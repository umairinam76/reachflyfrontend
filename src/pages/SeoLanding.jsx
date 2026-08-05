import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Globe2,
  Mail,
  MessageCircle,
  Radar,
  Search,
  Shield,
  Target,
  Workflow,
  Zap,
} from "../components/icons";
import { useSEO } from "../seo";

const baseFaq = [
  [
    "Is ReachFly.Ai only a scraper?",
    "No. ReachFly.Ai is a growth CRM that includes lead discovery, website audits, outreach pipelines, territories, contacts, inbox, and campaign analytics.",
  ],
  [
    "Can I connect Gmail?",
    "Yes. ReachFly.Ai supports Gmail SMTP with an app password, Outlook, and custom SMTP providers.",
  ],
  [
    "Does WhatsApp require QR linking?",
    "Yes. The WhatsApp setup page supports QR linking and session management through a whatsapp-web.js compatible backend.",
  ],
  [
    "Can ReachFly AI answer unrelated questions?",
    "No. ReachFly AI is restricted to your product ecosystem: campaigns, leads, channels, analytics, territories, contacts, inbox, and settings.",
  ],
];

const pages = {
  "ai-marketing": {
    path: "/ai-marketing-software",
    title: "AI Marketing Software for Lead Generation — ReachFly.Ai",
    description:
      "ReachFly.Ai helps agencies and service sellers discover leads, audit websites, personalize outreach, and manage campaigns from one AI marketing CRM.",
    h1: "AI marketing software for lead generation, outreach, and campaign tracking.",
    keyword: "AI marketing software",
    badge: "AI marketing platform",
    intro:
      "Create targeted campaigns, discover business leads, audit websites, personalize outreach, and manage follow-ups from one clean growth workspace.",
    finalTitle: "Launch AI-powered marketing campaigns with ReachFly.Ai.",
  },

  "lead-generation": {
    path: "/ai-lead-generation-crm",
    title: "AI Lead Generation CRM for Agencies — ReachFly.Ai",
    description:
      "Use ReachFly.Ai to find business leads, audit websites, build outreach pipelines, and track campaign performance in one CRM.",
    h1: "AI lead generation CRM for agencies, freelancers, and sales teams.",
    keyword: "AI lead generation CRM",
    badge: "Lead generation CRM",
    intro:
      "Find local businesses by niche and location, review opportunity signals, organize leads, and move every campaign into a clear follow-up pipeline.",
    finalTitle: "Turn lead discovery into organized campaign follow-up.",
  },

  "website-audit": {
    path: "/website-audit-outreach-tool",
    title: "Website Audit Outreach Tool — ReachFly.Ai",
    description:
      "ReachFly.Ai turns website gaps into personalized outreach angles for agencies, consultants, and growth teams.",
    h1: "Turn website audits into personalized outreach campaigns.",
    keyword: "website audit outreach tool",
    badge: "Audit-based outreach",
    intro:
      "Use website audit intelligence to identify SEO, trust, conversion, automation, and technical gaps before creating outreach sequences.",
    finalTitle: "Use website gaps to create better outreach angles.",
  },

  autoreach: {
    path: "/auto-reach-crm",
    title: "Auto-Reach CRM for Email and WhatsApp Campaigns — ReachFly.Ai",
    description:
      "ReachFly.Ai helps teams build email and WhatsApp follow-up pipelines with campaign tracking, territories, and AI assistance.",
    h1: "Auto-reach CRM for email, WhatsApp, and campaign follow-ups.",
    keyword: "auto-reach CRM",
    badge: "Auto-reach workspace",
    intro:
      "Build simple email and WhatsApp follow-up workflows with clear stages, delays, campaign history, and progress tracking.",
    finalTitle: "Manage outreach pipelines without confusing tools.",
  },

  "local-leads": {
    path: "/local-lead-generation-tool",
    title: "Local Lead Generation Tool for Service Businesses — ReachFly.Ai",
    description:
      "Find local businesses by niche, city, radius, and opportunity score with ReachFly.Ai.",
    h1: "Local lead generation tool for agencies and service sellers.",
    keyword: "local lead generation tool",
    badge: "Local lead discovery",
    intro:
      "Choose a niche, city, radius, lead target, and outreach goal. ReachFly.Ai helps organize the market into campaigns and territories.",
    finalTitle: "Find and organize local business opportunities faster.",
  },

  "lead-scraping": {
    path: "/lead-scraping-software",
    title: "Lead Scraping Software for Outreach Campaigns — ReachFly.Ai",
    description:
      "ReachFly.Ai helps teams discover business leads, filter source quality, audit websites, and move leads into outreach campaigns.",
    h1: "Lead discovery software connected to outreach, audits, and CRM tracking.",
    keyword: "lead scraping software",
    badge: "Business lead discovery",
    intro:
      "Discover business records from connected sources, filter source quality, avoid duplicate markets, and move useful leads into outreach workflows.",
    finalTitle: "Move from business discovery to campaign action.",
  },
};

const aliases = {
  main: "ai-marketing",
  leadgen: "lead-generation",
  "lead-generation-crm": "lead-generation",
  "auto-reach": "autoreach",
};

const featureCards = [
  [
    Search,
    "Lead discovery",
    "Create campaigns by niche, city, radius, lead target, and source quality.",
  ],
  [
    Brain,
    "Website audit intelligence",
    "Find SEO, trust, conversion, technical, and automation gaps.",
  ],
  [
    Mail,
    "Email outreach",
    "Connect Gmail, Outlook, or custom SMTP for campaign sending.",
  ],
  [
    MessageCircle,
    "WhatsApp follow-ups",
    "Link WhatsApp Web sessions and manage follow-up steps.",
  ],
  [
    Workflow,
    "Pipeline builder",
    "Build simple non-technical sequences with clear delays and icons.",
  ],
  [
    BarChart3,
    "Analytics dashboard",
    "Track leads, sends, replies, campaigns, and useful growth metrics.",
  ],
];

export default function SeoLanding({ variant = "ai-marketing" }) {
  const resolvedVariant = aliases[variant] || variant;
  const page = pages[resolvedVariant] || pages["ai-marketing"];

  const softwareJsonLd = {
    "@type": "SoftwareApplication",
    name: "ReachFly.Ai",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: page.description,
    url: page.path,
    offers: {
      "@type": "Offer",
      price: "49",
      priceCurrency: "USD",
    },
  };

  const faqJsonLd = {
    "@type": "FAQPage",
    mainEntity: baseFaq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.keyword,
        item: page.path,
      },
    ],
  };

  useSEO({
    title: page.title,
    description: page.description,
    path: page.path,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [softwareJsonLd, faqJsonLd, breadcrumbJsonLd],
    },
  });

  return (
    <main className="seo-page">
      <header className="seo-nav">
        <Link className="cu-brand" to="/">
          <span className="cu-brand-mark">
            <Zap size={18} />
          </span>
          <b>ReachFly.Ai</b>
        </Link>

        <Link className="cu-btn cu-btn-primary" to="/app/builder">
          Launch campaign <ArrowRight size={16} />
        </Link>
      </header>

      <section className="seo-hero">
        <span className="seo-kicker">
          <Target size={15} /> {page.badge}
        </span>

        <h1>{page.h1}</h1>

        <p>{page.intro}</p>

        <div className="seo-actions">
          <Link className="cu-btn cu-btn-primary cu-btn-xl" to="/app/builder">
            Start finding leads <ArrowRight size={18} />
          </Link>

          <Link className="cu-btn cu-btn-ghost cu-btn-xl" to="/app/dashboard">
            View dashboard
          </Link>
        </div>
      </section>

      <section className="seo-grid-section">
        <div className="seo-section-head">
          <span>Platform</span>
          <h2>From prospect search to follow-up pipeline.</h2>
          <p>
            ReachFly.Ai gives agencies, freelancers, consultants, and sales teams one
            place to discover leads, review opportunities, create outreach, and track
            campaign progress.
          </p>
        </div>

        <div className="seo-card-grid">
          {featureCards.map(([Icon, titleText, copy]) => (
            <article className="seo-card" key={titleText}>
              <Icon />
              <h3>{titleText}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-compare">
        <div>
          <span className="seo-kicker">
            <Radar size={15} /> Why ReachFly.Ai
          </span>

          <h2>Built for teams reaching real businesses.</h2>

          <p>
            Most outreach tools start with a contact list. ReachFly.Ai starts with a
            market, a business, a website opportunity, and a clear reason to contact
            that business.
          </p>

          <ul>
            <li>
              <CheckCircle2 /> Campaign builder for non-technical users.
            </li>
            <li>
              <CheckCircle2 /> Email and WhatsApp setup flows.
            </li>
            <li>
              <CheckCircle2 /> CRM dashboard with campaign metrics.
            </li>
            <li>
              <CheckCircle2 /> AI assistant restricted to your product ecosystem.
            </li>
            <li>
              <CheckCircle2 /> Territory tracking to avoid repeated market targeting.
            </li>
          </ul>
        </div>

        <aside>
          <Shield />
          <h3>Product-focused growth CRM</h3>
          <p>
            ReachFly.Ai is designed for lead discovery, website audits, outreach
            workflows, pipeline tracking, territory intelligence, and campaign
            operations.
          </p>
        </aside>
      </section>

      <section className="seo-grid-section">
        <div className="seo-section-head">
          <span>Workflow</span>
          <h2>Simple enough for non-technical users.</h2>
          <p>
            The product is built around a guided 5-click campaign flow, clear channel
            setup pages, visual pipelines, and easy campaign dashboards.
          </p>
        </div>

        <div className="seo-card-grid">
          {[
            [
              Target,
              "Choose a market",
              "Select your niche, location, radius, lead goal, and outreach channel.",
            ],
            [
              Search,
              "Find useful leads",
              "Review discovered businesses, contact details, source quality, and website opportunities.",
            ],
            [
              Workflow,
              "Build follow-ups",
              "Create email and WhatsApp steps using simple icons, delays, and editable messages.",
            ],
            [
              BarChart3,
              "Track performance",
              "Monitor active, queued, and completed campaigns from a structured dashboard.",
            ],
          ].map(([Icon, titleText, copy]) => (
            <article className="seo-card" key={titleText}>
              <Icon />
              <h3>{titleText}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-faq">
        <div className="seo-section-head">
          <span>FAQ</span>
          <h2>Common questions</h2>
        </div>

        {baseFaq.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>

      <section className="seo-final">
        <Globe2 />
        <h2>{page.finalTitle}</h2>
        <p>
          Pick a niche, location, lead target, and outreach goal. ReachFly.Ai helps
          you move from market discovery to campaign follow-up.
        </p>

        <Link className="cu-btn cu-btn-primary cu-btn-xl" to="/app/builder">
          Launch campaign
        </Link>
      </section>
    </main>
  );
}