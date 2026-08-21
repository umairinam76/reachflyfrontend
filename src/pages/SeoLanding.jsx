import { useMemo } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  Globe2,
  Mail,
  MapPinned,
  MessageCircle,
  Phone,
  Radar,
  Search,
  Shield,
  Sparkles,
  Target,
  Users,
  Workflow,
  Zap,
} from "../components/icons";
import { useSEO } from "../seo";

const SITE = "https://www.reachflyai.com";

const FAQ = [
  [
    "Is ReachFly only a lead scraper?",
    "No. ReachFly is a connected sales workspace that combines lead discovery, website intelligence, AI Voice, outreach, meetings, contacts, pipeline activity, and team operations.",
  ],
  [
    "Can I use ReachFly for AI calling?",
    "Yes. ReachFly includes AI Voice Agent workflows for qualifying leads, capturing call outcomes, supporting follow-up, and booking meetings from the same workspace context.",
  ],
  [
    "Can I continue conversations through email?",
    "Yes. ReachFly includes email setup and follow-up workflows so lead and campaign context can continue into email without rebuilding the prospect record.",
  ],
  [
    "Does ReachFly support team workflows?",
    "Yes. ReachFly uses workspace roles so owners, administrators, managers, callers, and other permitted users can see the tools appropriate to their responsibilities.",
  ],
];

const PAGES = {
  "ai-marketing": {
    path: "/ai-marketing-software",
    title: "AI Marketing Software for Lead Generation — ReachFlyAI",
    description:
      "ReachFly helps sales and growth teams discover leads, add website intelligence, run AI Voice conversations, follow up, and manage pipeline activity in one workspace.",
    h1: "AI marketing software that keeps discovery, conversations, and follow-up connected.",
    keyword: "AI marketing software",
    badge: "AI marketing workspace",
    intro:
      "Find the right businesses, understand why they may care, launch the right conversation, and keep every next step tied to the same lead record.",
    finalTitle: "Build an AI-assisted sales workflow without stitching together disconnected tools.",
    focusTitle: "Move from market signal to measurable sales action.",
    focusText:
      "ReachFly is designed around the operating sequence that matters: identify a market, build context, start a conversation, capture the outcome, and continue the follow-up.",
    accentIcon: Sparkles,
  },

  "lead-generation": {
    path: "/ai-lead-generation-crm",
    title: "AI Lead Generation CRM for Sales Teams — ReachFlyAI",
    description:
      "Use ReachFly to discover business leads, organize prospect context, connect outreach, and track sales activity in one AI-assisted CRM.",
    h1: "AI lead generation CRM for teams that need more than another contact list.",
    keyword: "AI lead generation CRM",
    badge: "Lead generation CRM",
    intro:
      "Choose a niche and location, discover relevant businesses, keep useful evidence attached to each lead, and move prospects into real follow-up workflows.",
    finalTitle: "Turn lead discovery into an organized sales process.",
    focusTitle: "Better prospecting starts with explainable context.",
    focusText:
      "Instead of treating a lead as a row in a spreadsheet, ReachFly keeps the business, discovery context, activity, owner, outreach, and next action connected.",
    accentIcon: Target,
  },

  "website-audit": {
    path: "/website-audit-outreach-tool",
    title: "Website Audit Outreach Tool — ReachFlyAI",
    description:
      "Use ReachFly website intelligence to identify practical digital opportunities and carry that context into outreach, calling, and follow-up.",
    h1: "Turn website intelligence into better sales conversations.",
    keyword: "website audit outreach tool",
    badge: "Audit-based outreach",
    intro:
      "Review website and digital-experience signals before contacting a prospect, then keep the useful findings available to your campaign, AI Voice Agent, and team.",
    finalTitle: "Give every outreach motion a clearer reason to exist.",
    focusTitle: "Useful audits are sales context, not decorative scores.",
    focusText:
      "ReachFly keeps audit findings connected to the prospect so your team can use the evidence in a call, email, follow-up, or qualification decision.",
    accentIcon: Brain,
  },

  autoreach: {
    path: "/auto-reach-crm",
    title: "Auto-Reach CRM for Follow-Up Workflows — ReachFlyAI",
    description:
      "ReachFly connects lead context, email follow-up, calling, campaign activity, and pipeline actions inside one sales workspace.",
    h1: "Auto-reach CRM for coordinated follow-up across the sales workflow.",
    keyword: "auto-reach CRM",
    badge: "Connected follow-up",
    intro:
      "Build follow-up around real lead outcomes instead of isolated channel automation. Keep calls, email activity, callbacks, meetings, and pipeline state connected.",
    finalTitle: "Automate repetitive follow-up without losing sales context.",
    focusTitle: "One lead timeline should coordinate every next action.",
    focusText:
      "ReachFly is built to keep outreach state visible so a callback, meeting, email, or campaign step does not become another disconnected task.",
    accentIcon: Workflow,
  },

  "local-leads": {
    path: "/local-lead-generation-tool",
    title: "Local Lead Generation Tool for Service Businesses — ReachFlyAI",
    description:
      "Discover local business opportunities by niche and location, keep prospect context organized, and move leads into outreach workflows with ReachFly.",
    h1: "Local lead generation for teams selling into real business markets.",
    keyword: "local lead generation tool",
    badge: "Local lead discovery",
    intro:
      "Choose the market you want to pursue, discover relevant businesses, preserve useful location and opportunity context, and hand qualified prospects into your sales process.",
    finalTitle: "Turn local market research into a repeatable sales workflow.",
    focusTitle: "Treat the market as a territory, not a one-off search.",
    focusText:
      "ReachFly helps teams organize discovery around niches and locations so prospecting, campaign activity, and future follow-up remain easier to understand.",
    accentIcon: MapPinned,
  },

  "lead-scraping": {
    path: "/lead-scraping-software",
    title: "Lead Scraping Software for Outreach Workflows — ReachFlyAI",
    description:
      "Use ReachFly to discover business leads, organize source context, avoid disconnected lists, and move useful prospects into audits, outreach, AI calling, and CRM activity.",
    h1: "Lead discovery software connected to the work that happens after the list.",
    keyword: "lead scraping software",
    badge: "Business lead discovery",
    intro:
      "Build prospect lists from the market you care about, keep useful source and business context visible, and move qualified records directly into outreach and follow-up.",
    finalTitle: "Stop treating lead collection as the end of the workflow.",
    focusTitle: "A useful lead is one your team can act on.",
    focusText:
      "ReachFly is designed to carry discovered businesses into audit, calling, email, meetings, and pipeline workflows instead of exporting context into another disconnected system.",
    accentIcon: Search,
  },
};

const ALIASES = {
  main: "ai-marketing",
  leadgen: "lead-generation",
  "lead-generation-crm": "lead-generation",
  "auto-reach": "autoreach",
};

const PLATFORM_CARDS = [
  [
    Search,
    "Lead discovery",
    "Build focused prospect lists by niche and location, then keep those records attached to the sales workflow.",
  ],
  [
    Brain,
    "Website intelligence",
    "Turn visible digital and website opportunities into useful prospect context before outreach begins.",
  ],
  [
    Bot,
    "AI Voice Agents",
    "Run AI-assisted sales conversations, capture outcomes, and support meeting booking from workspace context.",
  ],
  [
    Mail,
    "Email follow-up",
    "Continue prospect conversations through email while keeping campaign and lead context connected.",
  ],
  [
    Calendar,
    "Meetings",
    "Keep booked meetings tied to the contact, source, owner, and conversation that created them.",
  ],
  [
    BarChart3,
    "Sales operations",
    "Track activity, calls, meetings, campaigns, follow-up, and pipeline movement from one workspace.",
  ],
];

const WORKFLOW = [
  [
    Target,
    "Choose the market",
    "Define the niche and location you want to pursue instead of starting with an anonymous bulk list.",
  ],
  [
    Radar,
    "Build context",
    "Review the prospect and the evidence that makes the account worth contacting.",
  ],
  [
    Phone,
    "Start the conversation",
    "Use AI Voice, email, or team follow-up while keeping the same lead context available.",
  ],
  [
    MessageCircle,
    "Capture the outcome",
    "Record what happened, what the prospect needs, and which next action should occur.",
  ],
  [
    Workflow,
    "Continue the pipeline",
    "Keep callbacks, meetings, follow-up, and ownership visible instead of recreating context manually.",
  ],
];

export default function SeoLanding({
  variant = "ai-marketing",
}) {
  const resolvedVariant =
    ALIASES[variant] ||
    variant;

  const page =
    PAGES[resolvedVariant] ||
    PAGES["ai-marketing"];

  const AccentIcon =
    page.accentIcon ||
    Sparkles;

  const jsonLd = useMemo(() => {
    const canonical = `${SITE}${page.path}`;

    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE}/#organization`,
          name: "ReachFlyAI",
          url: `${SITE}/`,
          logo: {
            "@type": "ImageObject",
            url: `${SITE}/reachfly-logo.png`,
          },
        },
        {
          "@type": "WebSite",
          "@id": `${SITE}/#website`,
          url: `${SITE}/`,
          name: "ReachFlyAI",
          publisher: {
            "@id": `${SITE}/#organization`,
          },
        },
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: page.title,
          description: page.description,
          isPartOf: {
            "@id": `${SITE}/#website`,
          },
          breadcrumb: {
            "@id": `${canonical}#breadcrumb`,
          },
        },
        {
          "@type": "SoftwareApplication",
          "@id": `${canonical}#software`,
          name: "ReachFlyAI",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: page.description,
          url: canonical,
          featureList: [
            "Lead discovery",
            "Website intelligence",
            "AI Voice Agents",
            "Email follow-up",
            "Meeting workflows",
            "CRM and pipeline activity",
            "Role-based team operations",
          ],
          publisher: {
            "@id": `${SITE}/#organization`,
          },
        },
        {
          "@type": "FAQPage",
          "@id": `${canonical}#faq`,
          mainEntity: FAQ.map(([question, answer]) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: {
              "@type": "Answer",
              text: answer,
            },
          })),
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonical}#breadcrumb`,
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: `${SITE}/`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: page.keyword,
              item: canonical,
            },
          ],
        },
      ],
    };
  }, [
    page.description,
    page.keyword,
    page.path,
    page.title,
  ]);

  useSEO({
    title: page.title,
    description:
      page.description,
    path: page.path,
    jsonLd,
  });

  return (
    <>
      <SeoLandingStyles />

      <main className="rf-seo-v7">
        <header className="rfs-nav">
          <Link
            className="rfs-brand"
            to="/"
            aria-label="ReachFly home"
          >
            <span>
              <BrandLogo size={37} />
            </span>

      
          </Link>

          <nav>
            <Link to="/">
              Platform
            </Link>

            <Link to="/blog">
              Guides
            </Link>

            <Link to="/login">
              Sign in
            </Link>
          </nav>

          <Link
            className="rfs-button primary"
            to="/signup"
          >
            Get started
            <ArrowRight size={14} />
          </Link>
        </header>

        <section className="rfs-hero">
          <div className="rfs-grid-bg" />

          <div className="rfs-hero-copy">
            <span className="rfs-kicker">
              <AccentIcon size={14} />
              {page.badge}
            </span>

            <h1>
              {page.h1}
            </h1>

            <p>
              {page.intro}
            </p>

            <div className="rfs-actions">
              <Link
                className="rfs-button primary large"
                to="/signup"
              >
                Create your workspace
                <ArrowRight size={16} />
              </Link>

              <Link
                className="rfs-button ghost large"
                to="/login"
              >
                Open ReachFly
              </Link>
            </div>

            <div className="rfs-proof">
              <span>
                <Check size={12} />
                Connected sales context
              </span>

              <span>
                <Check size={12} />
                Role-based workspace
              </span>

              <span>
                <Check size={12} />
                Prepaid usage model
              </span>
            </div>
          </div>

          <SeoPreview
            page={page}
            AccentIcon={AccentIcon}
          />
        </section>

        <section className="rfs-intro-strip">
          <span>
            Built for practical sales operations
          </span>

          <div>
            {[
              "Lead discovery",
              "AI audits",
              "AI Voice",
              "Email",
              "Meetings",
              "Pipeline",
            ].map(
              (
                item
              ) => (
                <b key={item}>
                  {item}
                </b>
              )
            )}
          </div>
        </section>

        <section className="rfs-section">
          <SectionHeading
            eyebrow="Connected platform"
            title="From prospect discovery to the next real sales action."
            text="ReachFly gives teams one place to find relevant businesses, build useful context, start conversations, and keep follow-up attached to the same prospect."
          />

          <div className="rfs-card-grid">
            {PLATFORM_CARDS.map(
              (
                [
                  Icon,
                  title,
                  text,
                ]
              ) => (
                <article key={title}>
                  <span>
                    <Icon size={19} />
                  </span>

                  <strong>
                    {title}
                  </strong>

                  <p>
                    {text}
                  </p>
                </article>
              )
            )}
          </div>
        </section>

        <section className="rfs-focus">
          <div>
            <span className="rfs-eyebrow">
              Why this workflow
            </span>

            <h2>
              {page.focusTitle}
            </h2>

            <p>
              {page.focusText}
            </p>

            <ul>
              <li>
                <CheckCircle2 size={14} />
                Business context stays attached to the lead.
              </li>

              <li>
                <CheckCircle2 size={14} />
                Calls, meetings, email, and pipeline activity remain visible.
              </li>

              <li>
                <CheckCircle2 size={14} />
                Owners and teams work inside the same workspace model.
              </li>

              <li>
                <CheckCircle2 size={14} />
                Customer-facing screens avoid unnecessary provider jargon.
              </li>
            </ul>
          </div>

          <aside>
            <span>
              <Shield size={21} />
            </span>

            <small>
              Controlled operations
            </small>

            <h3>
              Keep AI inside a visible sales process.
            </h3>

            <p>
              ReachFly is designed around workspace ownership, role-based
              access, visible activity, connected outcomes, and reviewable next
              actions.
            </p>

            <div>
              <span>
                <Users size={13} />
                Team roles
              </span>

              <span>
                <Workflow size={13} />
                Shared state
              </span>

              <span>
                <Globe2 size={13} />
                Market workflows
              </span>
            </div>
          </aside>
        </section>

        <section className="rfs-section">
          <SectionHeading
            eyebrow="Operating sequence"
            title="A clearer path from market selection to measurable follow-up."
            text="The product is organized around the actions a sales team actually takes instead of forcing every workflow through a collection of disconnected technical settings."
          />

          <div className="rfs-workflow">
            {WORKFLOW.map(
              (
                [
                  Icon,
                  title,
                  text,
                ],
                index
              ) => (
                <article key={title}>
                  <span className="rfs-step">
                    0{index + 1}
                  </span>

                  <i>
                    <Icon size={17} />
                  </i>

                  <div>
                    <strong>
                      {title}
                    </strong>

                    <p>
                      {text}
                    </p>
                  </div>
                </article>
              )
            )}
          </div>
        </section>

        <section className="rfs-faq">
          <SectionHeading
            eyebrow="FAQ"
            title="Common questions about ReachFly."
            text="A few quick answers about how the workspace fits together."
          />

          <div>
            {FAQ.map(
              (
                [
                  question,
                  answer,
                ]
              ) => (
                <details key={question}>
                  <summary>
                    {question}
                  </summary>

                  <p>
                    {answer}
                  </p>
                </details>
              )
            )}
          </div>
        </section>

        <section className="rfs-final">
          <div>
            <span className="rfs-kicker">
              <Zap size={14} />
              ReachFly Sales OS
            </span>

            <h2>
              {page.finalTitle}
            </h2>

            <p>
              Start with a focused market, add the context your team needs, and
              keep every conversation and next action connected.
            </p>

            <div>
              <Link
                className="rfs-button primary large"
                to="/signup"
              >
                Get started
                <ArrowRight size={16} />
              </Link>

              <Link
                className="rfs-button ghost large"
                to="/blog"
              >
                Read the guides
              </Link>
            </div>
          </div>
        </section>

        <footer className="rfs-footer">
          <Link
            className="rfs-brand"
            to="/"
          >
            <span>
              <BrandLogo size={35} />
            </span>

     
          </Link>

          <p>
            AI-native lead discovery, sales conversations, follow-up, and CRM
            operations.
          </p>

          <nav>
            <Link to="/blog">
              Blog
            </Link>

            <Link to="/privacy">
              Privacy
            </Link>

            <Link to="/terms">
              Terms
            </Link>
          </nav>
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
    <header className="rfs-section-head">
      <span className="rfs-eyebrow">
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

function SeoPreview({
  page,
  AccentIcon,
}) {
  return (
    <div className="rfs-preview">
      <header>
        <div>
          <i />
          <i />
          <i />
        </div>

        <small>
          ReachFly workspace
        </small>

        <Shield size={12} />
      </header>

      <div className="rfs-preview-body">
        <aside>
          <span className="logo">
            <BrandLogo size={23} />
          </span>

          {[
            "Overview",
            "Leads",
            "Audits",
            "AI Voice",
            "Meetings",
            "Pipeline",
          ].map(
            (
              item,
              index
            ) => (
              <span
                key={item}
                className={
                  index === 1
                    ? "active"
                    : ""
                }
              >
                <i />
                {item}
              </span>
            )
          )}
        </aside>

        <main>
          <div className="rfs-preview-title">
            <div>
              <small>
                {page.badge}
              </small>

              <strong>
                Campaign workspace
              </strong>
            </div>

            <button type="button">
              Launch
            </button>
          </div>

          <div className="rfs-preview-metrics">
            {[
              [
                Target,
                "Ready leads",
                "48",
              ],
              [
                Brain,
                "Context ready",
                "39",
              ],
              [
                Phone,
                "Live calls",
                "2",
              ],
              [
                Calendar,
                "Meetings",
                "6",
              ],
            ].map(
              (
                [
                  Icon,
                  label,
                  value,
                ]
              ) => (
                <article key={label}>
                  <span>
                    <Icon size={11} />
                  </span>

                  <strong>
                    {value}
                  </strong>

                  <small>
                    {label}
                  </small>
                </article>
              )
            )}
          </div>

          <div className="rfs-preview-grid">
            <section>
              <header>
                <span>
                  <AccentIcon size={13} />
                </span>

                <strong>
                  Opportunity context
                </strong>

                <em>
                  Ready
                </em>
              </header>

              <div className="rfs-preview-score">
                <b>
                  81
                </b>

                <span>
                  opportunity score
                </span>
              </div>

              <p>
                Prospect context is attached before the next sales action.
              </p>
            </section>

            <section>
              <header>
                <span>
                  <Bot size={13} />
                </span>

                <strong>
                  Next action
                </strong>
              </header>

              <div className="rfs-mini-timeline">
                <span className="done">
                  <Check size={9} />
                  Lead found
                </span>

                <span className="done">
                  <Check size={9} />
                  Context ready
                </span>

                <span>
                  <Phone size={9} />
                  AI Voice
                </span>
              </div>
            </section>

            <div className="rfs-mini-table">
              {[
                [
                  "Nova Dental",
                  "Meeting booked",
                  "Won",
                ],
                [
                  "Smile Studio",
                  "Callback",
                  "Live",
                ],
                [
                  "Pure Clinics",
                  "Email follow-up",
                  "Next",
                ],
              ].map(
                (
                  [
                    lead,
                    action,
                    status,
                  ]
                ) => (
                  <div key={lead}>
                    <strong>
                      {lead}
                    </strong>

                    <span>
                      {action}
                    </span>

                    <em>
                      {status}
                    </em>
                  </div>
                )
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SeoLandingStyles() {
  return (
    <style>{`
      .rf-seo-v7{
        --rfs-bg:#f8f9fa;
        --rfs-card:#fff;
        --rfs-text:#191c1d;
        --rfs-text2:#4c4b59;
        --rfs-muted:#777784;
        --rfs-line:#e2e4e7;
        --rfs-primary:#4648d4;
        --rfs-primary-dark:#3739bd;
        --rfs-primary-soft:#e8e9ff;
        --rfs-violet:#6b38d4;
        --rfs-dark:#2e3132;
        --rfs-green:#087a51;
        --rfs-green-soft:#dff8eb;
        --rfs-ease:cubic-bezier(.2,.8,.2,1);
        min-height:100vh;
        color:var(--rfs-text);
        background:var(--rfs-bg);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-seo-v7 *,
      .rf-seo-v7 *::before,
      .rf-seo-v7 *::after{
        box-sizing:border-box;
      }

      .rfs-nav{
        position:sticky;
        z-index:50;
        top:0;
        min-height:66px;
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:center;
        gap:24px;
        padding:0 max(22px,calc((100vw - 1320px)/2));
        background:rgba(248,249,250,.89);
        border-bottom:1px solid rgba(226,228,231,.88);
        backdrop-filter:blur(16px);
      }

      .rfs-brand{
        display:flex;
        align-items:center;
        gap:8px;
        width:max-content;
        color:var(--rfs-text);
        text-decoration:none;
      }

      .rfs-brand > span{
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
      }

      .rfs-brand > div{
        display:grid;
      }

      .rfs-brand strong{
        font:600 15px/18px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfs-brand small{
        color:var(--rfs-primary);
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.11em;
        text-transform:uppercase;
      }

      .rfs-nav > nav{
        justify-self:center;
        display:flex;
        align-items:center;
        gap:24px;
      }

      .rfs-nav > nav a{
        color:var(--rfs-text2);
        text-decoration:none;
        font-size:8px;
        font-weight:650;
      }

      .rfs-nav > nav a:hover{
        color:var(--rfs-primary);
      }

      .rfs-button{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 11px;
        border:1px solid transparent;
        border-radius:8px;
        text-decoration:none;
        font-size:8px;
        font-weight:700;
        transition:.15s var(--rfs-ease);
      }

      .rfs-button:hover{
        transform:translateY(-1px);
      }

      .rfs-button.primary{
        color:#fff;
        background:var(--rfs-primary);
        border-color:var(--rfs-primary);
        box-shadow:0 7px 17px rgba(70,72,212,.15);
      }

      .rfs-button.primary:hover{
        background:var(--rfs-primary-dark);
      }

      .rfs-button.ghost{
        color:inherit;
        background:rgba(255,255,255,.08);
        border-color:rgba(255,255,255,.12);
      }

      .rfs-button.large{
        min-height:46px;
        padding:9px 14px;
        font-size:9px;
      }

      .rfs-hero{
        position:relative;
        min-height:650px;
        display:grid;
        grid-template-columns:minmax(0,.92fr) minmax(550px,1.08fr);
        align-items:center;
        gap:50px;
        overflow:hidden;
        padding:75px max(28px,calc((100vw - 1320px)/2)) 68px;
        color:#fff;
        background:
          radial-gradient(circle at 12% 18%,rgba(85,88,223,.26),transparent 30%),
          radial-gradient(circle at 82% 67%,rgba(107,56,212,.22),transparent 34%),
          linear-gradient(145deg,#292c2e,#303335 55%,#292c2e);
      }

      .rfs-grid-bg{
        position:absolute;
        inset:0;
        opacity:.28;
        background-image:
          linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
        background-size:30px 30px;
        mask-image:linear-gradient(#000,transparent 90%);
      }

      .rfs-hero-copy,
      .rfs-preview{
        position:relative;
        z-index:2;
      }

      .rfs-kicker{
        width:max-content;
        min-height:29px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:5px 8px;
        color:#d4d5ff;
        background:rgba(84,87,220,.16);
        border:1px solid rgba(160,162,255,.14);
        border-radius:999px;
        font-size:7px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfs-hero h1{
        max-width:650px;
        margin:16px 0 0;
        color:#fff;
        font:600 clamp(43px,5vw,68px)/1.01 Geist,Inter,sans-serif;
        letter-spacing:-.052em;
      }

      .rfs-hero-copy > p{
        max-width:600px;
        margin:18px 0 0;
        color:rgba(242,244,245,.69);
        font-size:11px;
        line-height:19px;
      }

      .rfs-actions{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:24px;
      }

      .rfs-proof{
        display:flex;
        flex-wrap:wrap;
        gap:12px;
        margin-top:18px;
        color:rgba(239,241,242,.55);
      }

      .rfs-proof span{
        display:flex;
        align-items:center;
        gap:5px;
        font-size:6.5px;
      }

      .rfs-proof svg{
        color:#bfc0ff;
      }

      .rfs-preview{
        overflow:hidden;
        background:#fafbfc;
        border:1px solid rgba(255,255,255,.68);
        border-radius:13px;
        box-shadow:
          0 32px 75px rgba(0,0,0,.26),
          0 6px 17px rgba(0,0,0,.10);
      }

      .rfs-preview > header{
        height:36px;
        display:grid;
        grid-template-columns:1fr auto 1fr;
        align-items:center;
        padding:0 11px;
        color:#7c7d85;
        background:#f0f1f3;
        border-bottom:1px solid #e1e3e5;
      }

      .rfs-preview > header > div{
        display:flex;
        gap:4px;
      }

      .rfs-preview > header i{
        width:7px;
        height:7px;
        background:#c5c7cb;
        border-radius:50%;
      }

      .rfs-preview > header small{
        font-size:5.5px;
        font-weight:700;
        letter-spacing:.04em;
        text-transform:uppercase;
      }

      .rfs-preview > header svg{
        justify-self:end;
      }

      .rfs-preview-body{
        min-height:408px;
        display:grid;
        grid-template-columns:105px minmax(0,1fr);
      }

      .rfs-preview-body > aside{
        display:grid;
        align-content:start;
        gap:4px;
        padding:13px 8px;
        background:#303335;
      }

      .rfs-preview-body > aside .logo{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        margin:0 0 10px 4px;
      }

      .rfs-preview-body > aside > span:not(.logo){
        min-height:30px;
        display:flex;
        align-items:center;
        gap:5px;
        padding:6px;
        color:#9da1a6;
        border-radius:6px;
        font-size:5.5px;
      }

      .rfs-preview-body > aside > span.active{
        color:#fff;
        background:var(--rfs-primary);
      }

      .rfs-preview-body > aside > span i{
        width:11px;
        height:4px;
        background:currentColor;
        border-radius:999px;
      }

      .rfs-preview-body > main{
        min-width:0;
        padding:15px;
        color:var(--rfs-text);
        background:#f8f9fa;
      }

      .rfs-preview-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .rfs-preview-title > div{
        display:grid;
      }

      .rfs-preview-title small{
        color:var(--rfs-primary);
        font-size:5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfs-preview-title strong{
        font:600 11px/15px Geist,Inter,sans-serif;
      }

      .rfs-preview-title button{
        min-height:28px;
        padding:5px 8px;
        color:#fff;
        background:var(--rfs-primary);
        border:0;
        border-radius:6px;
        font-size:5.5px;
        font-weight:700;
      }

      .rfs-preview-metrics{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:6px;
        margin-top:11px;
      }

      .rfs-preview-metrics article{
        min-height:70px;
        display:grid;
        align-content:space-between;
        padding:8px;
        background:#fff;
        border:1px solid #e4e6e8;
        border-radius:7px;
      }

      .rfs-preview-metrics article > span{
        width:23px;
        height:23px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:var(--rfs-primary-soft);
        border-radius:6px;
      }

      .rfs-preview-metrics strong{
        margin-top:5px;
        font-size:12px;
      }

      .rfs-preview-metrics small{
        color:#83848b;
        font-size:4.8px;
      }

      .rfs-preview-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:6px;
        margin-top:7px;
      }

      .rfs-preview-grid > section{
        min-height:132px;
        padding:9px;
        background:#fff;
        border:1px solid #e4e6e8;
        border-radius:7px;
      }

      .rfs-preview-grid > section > header{
        display:flex;
        align-items:center;
        gap:5px;
      }

      .rfs-preview-grid section header > span{
        width:23px;
        height:23px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:var(--rfs-primary-soft);
        border-radius:6px;
      }

      .rfs-preview-grid section header strong{
        flex:1;
        font-size:5.8px;
      }

      .rfs-preview-grid section header em{
        padding:3px 5px;
        color:var(--rfs-green);
        background:var(--rfs-green-soft);
        border-radius:999px;
        font-size:4.5px;
        font-style:normal;
      }

      .rfs-preview-score{
        display:flex;
        align-items:baseline;
        gap:5px;
        margin-top:10px;
      }

      .rfs-preview-score b{
        color:var(--rfs-violet);
        font-size:26px;
      }

      .rfs-preview-score span{
        color:#888893;
        font-size:4.8px;
      }

      .rfs-preview-grid section > p{
        margin:4px 0 0;
        color:#85868d;
        font-size:5px;
        line-height:8px;
      }

      .rfs-mini-timeline{
        display:grid;
        gap:5px;
        margin-top:12px;
      }

      .rfs-mini-timeline > span{
        min-height:24px;
        display:flex;
        align-items:center;
        gap:5px;
        padding:5px 6px;
        color:#73747d;
        background:#f5f6f7;
        border-radius:5px;
        font-size:5px;
      }

      .rfs-mini-timeline > span.done{
        color:#376554;
        background:#e7f7ef;
      }

      .rfs-mini-table{
        grid-column:1/-1;
        overflow:hidden;
        background:#fff;
        border:1px solid #e4e6e8;
        border-radius:7px;
      }

      .rfs-mini-table > div{
        min-height:35px;
        display:grid;
        grid-template-columns:1fr 1fr auto;
        align-items:center;
        gap:7px;
        padding:0 9px;
      }

      .rfs-mini-table > div + div{
        border-top:1px solid #eff0f1;
      }

      .rfs-mini-table strong{
        font-size:5.7px;
      }

      .rfs-mini-table span{
        color:#85868d;
        font-size:5px;
      }

      .rfs-mini-table em{
        padding:3px 5px;
        color:var(--rfs-primary);
        background:var(--rfs-primary-soft);
        border-radius:999px;
        font-size:4.7px;
        font-style:normal;
        font-weight:700;
      }

      .rfs-intro-strip{
        min-height:70px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:20px;
        padding:14px 22px;
        background:#fff;
        border-bottom:1px solid var(--rfs-line);
      }

      .rfs-intro-strip > span{
        color:var(--rfs-muted);
        font-size:6px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfs-intro-strip > div{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:7px;
      }

      .rfs-intro-strip b{
        padding:5px 7px;
        color:#5f606a;
        background:#f3f4f5;
        border-radius:999px;
        font-size:5.5px;
      }

      .rfs-section,
      .rfs-faq{
        width:min(1220px,calc(100% - 48px));
        margin:0 auto;
        padding:90px 0;
      }

      .rfs-section-head{
        max-width:820px;
        margin-bottom:34px;
      }

      .rfs-eyebrow{
        display:block;
        margin-bottom:6px;
        color:var(--rfs-primary);
        font-size:7px;
        font-weight:800;
        letter-spacing:.1em;
        text-transform:uppercase;
      }

      .rfs-section-head h2,
      .rfs-focus h2,
      .rfs-final h2{
        margin:0;
        font:600 clamp(29px,3.8vw,46px)/1.08 Geist,Inter,sans-serif;
        letter-spacing:-.038em;
      }

      .rfs-section-head p,
      .rfs-focus > div > p,
      .rfs-final p{
        max-width:720px;
        margin:10px 0 0;
        color:var(--rfs-text2);
        font-size:9px;
        line-height:16px;
      }

      .rfs-card-grid{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:9px;
      }

      .rfs-card-grid article{
        min-height:200px;
        display:grid;
        align-content:start;
        padding:18px;
        background:#fff;
        border:1px solid var(--rfs-line);
        border-radius:12px;
      }

      .rfs-card-grid article > span{
        width:40px;
        height:40px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:var(--rfs-primary-soft);
        border-radius:9px;
      }

      .rfs-card-grid article > strong{
        margin-top:21px;
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rfs-card-grid article > p{
        margin:5px 0 0;
        color:var(--rfs-muted);
        font-size:7.5px;
        line-height:13px;
      }

      .rfs-focus{
        display:grid;
        grid-template-columns:minmax(0,.95fr) minmax(400px,.75fr);
        align-items:center;
        gap:65px;
        padding:88px max(28px,calc((100vw - 1220px)/2));
        color:#fff;
        background:#2e3132;
      }

      .rfs-focus .rfs-eyebrow{
        color:#bfc0ff;
      }

      .rfs-focus > div > p{
        color:rgba(241,243,244,.62);
      }

      .rfs-focus ul{
        display:grid;
        gap:8px;
        padding:0;
        margin:22px 0 0;
        list-style:none;
      }

      .rfs-focus li{
        display:flex;
        align-items:flex-start;
        gap:7px;
        color:rgba(242,244,245,.75);
        font-size:7.5px;
      }

      .rfs-focus li svg{
        flex:0 0 auto;
        color:#bfc0ff;
      }

      .rfs-focus aside{
        min-height:300px;
        display:flex;
        flex-direction:column;
        justify-content:flex-end;
        padding:24px;
        background:
          radial-gradient(circle at 84% 12%,rgba(94,97,232,.22),transparent 34%),
          rgba(255,255,255,.055);
        border:1px solid rgba(255,255,255,.08);
        border-radius:14px;
      }

      .rfs-focus aside > span{
        width:45px;
        height:45px;
        display:grid;
        place-items:center;
        margin-bottom:auto;
        color:#d0d1ff;
        background:rgba(70,72,212,.18);
        border-radius:11px;
      }

      .rfs-focus aside > small{
        color:#bfc0ff;
        font-size:6px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfs-focus aside h3{
        margin:5px 0 0;
        color:#fff;
        font:600 20px/26px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rfs-focus aside p{
        margin:7px 0 0;
        color:rgba(241,243,244,.58);
        font-size:7.5px;
        line-height:13px;
      }

      .rfs-focus aside > div{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:16px;
      }

      .rfs-focus aside > div span{
        display:flex;
        align-items:center;
        gap:5px;
        padding:5px 7px;
        color:rgba(245,246,247,.74);
        background:rgba(255,255,255,.06);
        border-radius:999px;
        font-size:5.5px;
      }

      .rfs-workflow{
        display:grid;
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfs-line);
        border-radius:12px;
      }

      .rfs-workflow article{
        min-height:90px;
        display:grid;
        grid-template-columns:38px 39px minmax(0,1fr);
        align-items:center;
        gap:11px;
        padding:13px 16px;
      }

      .rfs-workflow article + article{
        border-top:1px solid #eff0f1;
      }

      .rfs-step{
        color:#a1a2aa;
        font-size:6px;
        font-weight:800;
      }

      .rfs-workflow article > i{
        width:39px;
        height:39px;
        display:grid;
        place-items:center;
        color:var(--rfs-primary);
        background:var(--rfs-primary-soft);
        border-radius:9px;
        font-style:normal;
      }

      .rfs-workflow article > div{
        display:grid;
      }

      .rfs-workflow strong{
        font-size:9px;
      }

      .rfs-workflow p{
        margin:2px 0 0;
        color:var(--rfs-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfs-faq{
        padding-top:65px;
      }

      .rfs-faq > div{
        display:grid;
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfs-line);
        border-radius:12px;
      }

      .rfs-faq details{
        padding:0 17px;
      }

      .rfs-faq details + details{
        border-top:1px solid #eff0f1;
      }

      .rfs-faq summary{
        min-height:60px;
        display:flex;
        align-items:center;
        cursor:pointer;
        font-size:8.5px;
        font-weight:700;
      }

      .rfs-faq details p{
        max-width:820px;
        margin:-5px 0 15px;
        color:var(--rfs-text2);
        font-size:7.5px;
        line-height:13px;
      }

      .rfs-final{
        width:min(1220px,calc(100% - 48px));
        margin:10px auto 0;
        padding:60px;
        overflow:hidden;
        color:#fff;
        background:
          radial-gradient(circle at 90% 16%,rgba(96,99,233,.25),transparent 31%),
          radial-gradient(circle at 10% 80%,rgba(107,56,212,.18),transparent 28%),
          #2e3132;
        border-radius:18px;
      }

      .rfs-final > div{
        max-width:800px;
      }

      .rfs-final .rfs-kicker{
        margin-bottom:13px;
      }

      .rfs-final p{
        color:rgba(241,243,244,.62);
      }

      .rfs-final > div > div{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:22px;
      }

      .rfs-footer{
        width:min(1220px,calc(100% - 48px));
        min-height:170px;
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:start;
        gap:25px;
        margin:0 auto;
        padding:48px 0 38px;
      }

      .rfs-footer > p{
        max-width:390px;
        margin:5px 0 0;
        color:var(--rfs-muted);
        font-size:6.5px;
        line-height:11px;
      }

      .rfs-footer nav{
        display:flex;
        gap:15px;
      }

      .rfs-footer nav a{
        color:var(--rfs-text2);
        text-decoration:none;
        font-size:6.5px;
      }

      @media(max-width:1050px){
        .rfs-hero{
          grid-template-columns:1fr;
        }

        .rfs-preview{
          width:min(760px,100%);
          margin:0 auto;
        }

        .rfs-focus{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:820px){
        .rfs-nav > nav{
          display:none;
        }

        .rfs-nav{
          grid-template-columns:1fr auto;
        }

        .rfs-card-grid{
          grid-template-columns:1fr 1fr;
        }

        .rfs-footer{
          grid-template-columns:1fr 1fr;
        }

        .rfs-footer > p{
          grid-column:1/-1;
        }
      }

      @media(max-width:620px){
        .rfs-nav{
          min-height:62px;
          padding:0 14px;
        }

        .rfs-nav > .rfs-button{
          min-height:35px;
        }

        .rfs-hero{
          min-height:0;
          padding:57px 16px 45px;
        }

        .rfs-hero h1{
          font-size:41px;
        }

        .rfs-hero-copy > p{
          font-size:9.5px;
          line-height:16px;
        }

        .rfs-actions{
          display:grid;
        }

        .rfs-actions .rfs-button{
          width:100%;
        }

        .rfs-preview-body{
          min-height:0;
          grid-template-columns:1fr;
        }

        .rfs-preview-body > aside{
          display:none;
        }

        .rfs-preview-body > main{
          padding:11px;
        }

        .rfs-preview-metrics{
          grid-template-columns:1fr 1fr;
        }

        .rfs-preview-grid{
          grid-template-columns:1fr;
        }

        .rfs-mini-table{
          grid-column:auto;
        }

        .rfs-intro-strip{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfs-section,
        .rfs-faq{
          width:calc(100% - 28px);
          padding:68px 0;
        }

        .rfs-card-grid{
          grid-template-columns:1fr;
        }

        .rfs-focus{
          padding:68px 14px;
        }

        .rfs-workflow article{
          grid-template-columns:34px minmax(0,1fr);
        }

        .rfs-workflow article > i{
          display:none;
        }

        .rfs-final{
          width:calc(100% - 28px);
          padding:38px 23px;
          border-radius:14px;
        }

        .rfs-footer{
          width:calc(100% - 28px);
          grid-template-columns:1fr;
        }
      }

      @media(max-width:410px){
        .rfs-nav > .rfs-button{
          padding:6px 8px;
          font-size:7px;
        }

        .rfs-preview-grid > section:nth-child(2){
          display:none;
        }

        .rfs-mini-table > div{
          grid-template-columns:1fr auto;
        }

        .rfs-mini-table > div > span{
          display:none;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-seo-v7 *,
        .rf-seo-v7 *::before,
        .rf-seo-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
