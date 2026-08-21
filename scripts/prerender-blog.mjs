import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  BLOG_POSTS,
  getRelatedPosts,
  validateBlogCatalog,
} from "../src/content/blog-posts.js";

const SITE = "https://www.reachflyai.com";
const SITE_NAME = "ReachFlyAI";
const LOGO_URL = `${SITE}/reachfly-logo.png`;
const RSS_URL = `${SITE}/rss.xml`;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");

const STATIC_INDEXABLE_ROUTES = [
  "/",
  "/ai-marketing-software",
  "/ai-lead-generation-crm",
  "/website-audit-outreach-tool",
  "/auto-reach-crm",
  "/local-lead-generation-tool",
  "/lead-scraping-software",
  "/blog",
];


const LANDING_PAGES = [
  {
    path: "/ai-marketing-software",
    title: "AI Marketing Software for Lead Generation — ReachFlyAI",
    description:
      "ReachFly helps sales and growth teams discover leads, add website intelligence, run AI Voice conversations, follow up, and manage pipeline activity in one workspace.",
    h1: "AI marketing software that keeps discovery, conversations, and follow-up connected.",
    keyword: "AI marketing software",
    badge: "AI marketing workspace",
    intro:
      "Find the right businesses, understand why they may care, launch the right conversation, and keep every next step tied to the same lead record.",
    finalTitle:
      "Build an AI-assisted sales workflow without stitching together disconnected tools.",
    focusTitle: "Move from market signal to measurable sales action.",
    focusText:
      "ReachFly is designed around the operating sequence that matters: identify a market, build context, start a conversation, capture the outcome, and continue the follow-up.",
  },
  {
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
  },
  {
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
  },
  {
    path: "/auto-reach-crm",
    title: "Auto-Reach CRM for Follow-Up Workflows — ReachFlyAI",
    description:
      "ReachFly connects lead context, email follow-up, calling, campaign activity, and pipeline actions inside one sales workspace.",
    h1: "Auto-reach CRM for coordinated follow-up across the sales workflow.",
    keyword: "auto-reach CRM",
    badge: "Connected follow-up",
    intro:
      "Build follow-up around real lead outcomes instead of isolated channel automation. Keep calls, email activity, callbacks, meetings, and pipeline state connected.",
    finalTitle:
      "Automate repetitive follow-up without losing sales context.",
    focusTitle: "One lead timeline should coordinate every next action.",
    focusText:
      "ReachFly is built to keep outreach state visible so a callback, meeting, email, or campaign step does not become another disconnected task.",
  },
  {
    path: "/local-lead-generation-tool",
    title: "Local Lead Generation Tool for Service Businesses — ReachFlyAI",
    description:
      "Discover local business opportunities by niche and location, keep prospect context organized, and move leads into outreach workflows with ReachFly.",
    h1: "Local lead generation for teams selling into real business markets.",
    keyword: "local lead generation tool",
    badge: "Local lead discovery",
    intro:
      "Choose the market you want to pursue, discover relevant businesses, preserve useful location and opportunity context, and hand qualified prospects into your sales process.",
    finalTitle:
      "Turn local market research into a repeatable sales workflow.",
    focusTitle: "Treat the market as a territory, not a one-off search.",
    focusText:
      "ReachFly helps teams organize discovery around niches and locations so prospecting, campaign activity, and future follow-up remain easier to understand.",
  },
  {
    path: "/lead-scraping-software",
    title: "Lead Scraping Software for Outreach Workflows — ReachFlyAI",
    description:
      "Use ReachFly to discover business leads, organize source context, avoid disconnected lists, and move useful prospects into audits, outreach, AI calling, and CRM activity.",
    h1: "Lead discovery software connected to the work that happens after the list.",
    keyword: "lead scraping software",
    badge: "Business lead discovery",
    intro:
      "Build prospect lists from the market you care about, keep useful source and business context visible, and move qualified records directly into outreach and follow-up.",
    finalTitle:
      "Stop treating lead collection as the end of the workflow.",
    focusTitle: "A useful lead is one your team can act on.",
    focusText:
      "ReachFly is designed to carry discovered businesses into audit, calling, email, meetings, and pipeline workflows instead of exporting context into another disconnected system.",
  },
];

const LANDING_FAQ = [
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

const LANDING_PLATFORM_CARDS = [
  [
    "Lead discovery",
    "Build focused prospect lists by niche and location, then keep those records attached to the sales workflow.",
  ],
  [
    "Website intelligence",
    "Turn visible digital and website opportunities into useful prospect context before outreach begins.",
  ],
  [
    "AI Voice Agents",
    "Run AI-assisted sales conversations, capture outcomes, and support meeting booking from workspace context.",
  ],
  [
    "Email follow-up",
    "Continue prospect conversations through email while keeping campaign and lead context connected.",
  ],
  [
    "Meetings",
    "Keep booked meetings tied to the contact, source, owner, and conversation that created them.",
  ],
  [
    "Sales operations",
    "Track activity, calls, meetings, campaigns, follow-up, and pipeline movement from one workspace.",
  ],
];

const LANDING_WORKFLOW = [
  [
    "Choose the market",
    "Define the niche and location you want to pursue instead of starting with an anonymous bulk list.",
  ],
  [
    "Build context",
    "Review the prospect and the evidence that makes the account worth contacting.",
  ],
  [
    "Start the conversation",
    "Use AI Voice, email, or team follow-up while keeping the same lead context available.",
  ],
  [
    "Capture the outcome",
    "Record what happened, what the prospect needs, and which next action should occur.",
  ],
  [
    "Continue the pipeline",
    "Keep callbacks, meetings, follow-up, and ownership visible instead of recreating context manually.",
  ],
];


const DIST_DIR = resolveDistDirectory();
const INDEX_FILE = path.join(DIST_DIR, "index.html");

if (!fs.existsSync(INDEX_FILE)) {
  console.error(
    `ReachFly prerender skipped: build output was not found at ${INDEX_FILE}. Run the normal Vite build before this script.`
  );
  process.exit(1);
}

const baseHtml = fs.readFileSync(INDEX_FILE, "utf8");

if (!baseHtml.includes("</head>") || !baseHtml.includes("</body>")) {
  console.error(
    "ReachFly prerender failed: dist/index.html is not a complete HTML document."
  );
  process.exit(2);
}

const validation = validateBlogCatalog();
if (!validation.valid) {
  console.error("ReachFly prerender failed: blog catalog is invalid.");
  validation.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(3);
}

const uniqueSlugs = new Set(BLOG_POSTS.map((post) => post.slug));
if (uniqueSlugs.size !== BLOG_POSTS.length) {
  console.error("ReachFly prerender failed: duplicate blog slugs were found.");
  process.exit(4);
}

const newestBlogDate = newestDate(
  BLOG_POSTS.flatMap((post) => [post.updatedAt, post.publishedAt])
);

const organizationLd = {
  "@type": "Organization",
  "@id": `${SITE}/#organization`,
  name: SITE_NAME,
  url: `${SITE}/`,
  logo: {
    "@type": "ImageObject",
    url: LOGO_URL,
  },
};

const websiteLd = {
  "@type": "WebSite",
  "@id": `${SITE}/#website`,
  url: `${SITE}/`,
  name: SITE_NAME,
  alternateName: "ReachFly AI",
  publisher: {
    "@id": `${SITE}/#organization`,
  },
};


for (const page of LANDING_PAGES) {
  const canonical = `${SITE}${page.path}`;
  const breadcrumbId = `${canonical}#breadcrumb`;

  const graph = [
    organizationLd,
    websiteLd,
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
        "@id": breadcrumbId,
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${canonical}#software`,
      name: SITE_NAME,
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
      mainEntity: LANDING_FAQ.map(([question, answer]) => ({
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
      "@id": breadcrumbId,
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
  ];

  const html = renderDocument({
    baseHtml,
    title: page.title,
    description: page.description,
    canonical,
    bodyHtml: renderSeoLanding(page),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": graph,
    },
    includeRss: false,
    css: criticalLandingCss(),
  });

  writeRoute(page.path, html);
}

const blogIndexCanonical = `${SITE}/blog`;
const blogIndexTitle = "AI Sales Automation, Lead Generation & CRM Guides";
const blogIndexDescription =
  "Practical guides on AI sales automation, lead generation, prospecting, CRM workflows, outbound outreach, AI calling, website audits and sales operations.";

const blogIndexHtml = renderDocument({
  baseHtml,
  title: blogIndexTitle,
  description: blogIndexDescription,
  canonical: blogIndexCanonical,
  ogType: "website",
  bodyHtml: renderBlogIndex(),
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd,
      websiteLd,
      {
        "@type": "Blog",
        "@id": `${SITE}/blog#blog`,
        name: "AI Sales Automation & Lead Generation Guides",
        description: blogIndexDescription,
        url: blogIndexCanonical,
        publisher: {
          "@id": `${SITE}/#organization`,
        },
        blogPost: BLOG_POSTS.slice(0, 20).map((post) => ({
          "@type": "BlogPosting",
          headline: post.title,
          url: `${SITE}/blog/${post.slug}`,
        })),
      },
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/blog#page`,
        url: blogIndexCanonical,
        name: blogIndexTitle,
        description: blogIndexDescription,
        isPartOf: {
          "@id": `${SITE}/#website`,
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: BLOG_POSTS.length,
          itemListElement: BLOG_POSTS.map((post, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${SITE}/blog/${post.slug}`,
            name: post.title,
          })),
        },
      },
    ],
  },
});

writeRoute("/blog", blogIndexHtml);

for (const post of BLOG_POSTS) {
  const canonical = `${SITE}/blog/${post.slug}`;
  const related = getRelatedPosts(post, 4);
  const readingMinutes = estimateReadingMinutes(post);
  const title = String(post.seoTitle || post.title || "").trim();
  const description = cleanDescription(post.description);

  const graph = [
    organizationLd,
    websiteLd,
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
          name: "Blog",
          item: `${SITE}/blog`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title,
          item: canonical,
        },
      ],
    },
    {
      "@type": "BlogPosting",
      "@id": `${canonical}#article`,
      headline: post.title,
      description,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt || post.publishedAt,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonical,
      },
      author: {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: SITE_NAME,
      },
      publisher: {
        "@id": `${SITE}/#organization`,
      },
      articleSection: post.category,
      keywords: buildArticleKeywords(post),
      wordCount: countPostWords(post),
      timeRequired: `PT${readingMinutes}M`,
      isPartOf: {
        "@id": `${SITE}/blog#blog`,
      },
      ...(post.image
        ? {
            image: absoluteUrl(post.image),
          }
        : {}),
    },
  ];

  if (Array.isArray(post.faqs) && post.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: post.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    });
  }

  const html = renderDocument({
    baseHtml,
    // Intentionally no ReachFlyAI prefix/suffix here. The query-focused article
    // title is the document title Google is asked to use.
    title,
    description,
    canonical,
    ogType: "article",
    image: post.image ? absoluteUrl(post.image) : "",
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt || post.publishedAt,
    section: post.category,
    bodyHtml: renderBlogPost(post, related, readingMinutes),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": graph,
    },
  });

  writeRoute(`/blog/${post.slug}`, html);
}

writeRootFile("sitemap.xml", renderSitemap());
writeRootFile("robots.txt", renderRobotsTxt());
writeRootFile("rss.xml", renderRssFeed());

console.log(
  `ReachFly SEO prerender complete: ${LANDING_PAGES.length} commercial pages + ${BLOG_POSTS.length} article pages + /blog + sitemap.xml + robots.txt + rss.xml written to ${DIST_DIR}`
);

function resolveDistDirectory() {
  const configured = String(process.env.REACHFLY_WEB_DIST || "").trim();
  const candidates = [
    configured ? path.resolve(configured) : "",
    path.join(WEB_ROOT, "dist"),
    path.resolve(WEB_ROOT, "../dist/web"),
    path.resolve(WEB_ROOT, "../../dist/web"),
  ].filter(Boolean);

  const found = candidates.find((directory) =>
    fs.existsSync(path.join(directory, "index.html"))
  );

  return found || candidates[0] || path.join(WEB_ROOT, "dist");
}

function renderDocument({
  baseHtml,
  title,
  description,
  canonical,
  ogType = "website",
  image = "",
  publishedAt = "",
  updatedAt = "",
  section = "",
  bodyHtml,
  jsonLd,
  includeRss = true,
  css = criticalBlogCss(),
}) {
  let html = stripManagedSeo(baseHtml);

  const tags = [
    `<title data-reachfly-prerender="true">${escapeHtml(title)}</title>`,
    `<meta data-reachfly-prerender="true" name="description" content="${escapeAttribute(description)}">`,
    `<meta data-reachfly-prerender="true" name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">`,
    `<meta data-reachfly-prerender="true" name="author" content="ReachFlyAI">`,
    `<meta data-reachfly-prerender="true" property="og:type" content="${escapeAttribute(ogType)}">`,
    `<meta data-reachfly-prerender="true" property="og:locale" content="en_US">`,
    `<meta data-reachfly-prerender="true" property="og:site_name" content="ReachFlyAI">`,
    `<meta data-reachfly-prerender="true" property="og:title" content="${escapeAttribute(title)}">`,
    `<meta data-reachfly-prerender="true" property="og:description" content="${escapeAttribute(description)}">`,
    `<meta data-reachfly-prerender="true" property="og:url" content="${escapeAttribute(canonical)}">`,
    image
      ? `<meta data-reachfly-prerender="true" property="og:image" content="${escapeAttribute(image)}">`
      : "",
    `<meta data-reachfly-prerender="true" name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta data-reachfly-prerender="true" name="twitter:title" content="${escapeAttribute(title)}">`,
    `<meta data-reachfly-prerender="true" name="twitter:description" content="${escapeAttribute(description)}">`,
    image
      ? `<meta data-reachfly-prerender="true" name="twitter:image" content="${escapeAttribute(image)}">`
      : "",
    ogType === "article" && publishedAt
      ? `<meta data-reachfly-prerender="true" property="article:published_time" content="${escapeAttribute(publishedAt)}">`
      : "",
    ogType === "article" && updatedAt
      ? `<meta data-reachfly-prerender="true" property="article:modified_time" content="${escapeAttribute(updatedAt)}">`
      : "",
    ogType === "article" && section
      ? `<meta data-reachfly-prerender="true" property="article:section" content="${escapeAttribute(section)}">`
      : "",
    `<link data-reachfly-prerender="true" rel="canonical" href="${escapeAttribute(canonical)}">`,
    includeRss
      ? `<link data-reachfly-prerender="true" rel="alternate" type="application/rss+xml" title="ReachFlyAI Blog RSS" href="${RSS_URL}">`
      : "",
    `<script data-reachfly-prerender="true" type="application/ld+json">${safeJson(jsonLd)}</script>`,
    css
      ? `<style data-reachfly-prerender="true">${css}</style>`
      : "",
  ].filter(Boolean);

  html = html.replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);

  html = html.replace(
    /<div\s+id=["']root["']\s*>[\s\S]*?<\/div>/i,
    `<div id="root">${bodyHtml}</div>`
  );

  return html;
}

function stripManagedSeo(value) {
  return String(value)
    .replace(/<title(?:\s[^>]*)?>[\s\S]*?<\/title>/gi, "")
    .replace(
      /<meta\s+[^>]*(?:name|property)=["'](?:description|robots|author|og:[^"']+|twitter:[^"']+|article:[^"']+)["'][^>]*>/gi,
      ""
    )
    .replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi, "")
    .replace(
      /<link\s+[^>]*rel=["']alternate["'][^>]*type=["']application\/rss\+xml["'][^>]*>/gi,
      ""
    )
    // The Vite homepage may already contain Organization / SoftwareApplication
    // JSON-LD. Blog pages receive a page-specific @graph instead, so remove the
    // inherited JSON-LD to avoid conflicting structured data.
    .replace(
      /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
      ""
    )
    .replace(
      /<style\s+[^>]*data-reachfly-prerender=["']true["'][^>]*>[\s\S]*?<\/style>/gi,
      ""
    );
}


function renderSeoLanding(page) {
  const cards = LANDING_PLATFORM_CARDS.map(
    ([title, text]) => `
      <article class="rf-landing-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
      </article>`
  ).join("\n");

  const workflow = LANDING_WORKFLOW.map(
    ([title, text], index) => `
      <article class="rf-landing-step">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(text)}</p>
        </div>
      </article>`
  ).join("\n");

  const faqs = LANDING_FAQ.map(
    ([question, answer]) => `
      <details>
        <summary>${escapeHtml(question)}</summary>
        <p>${escapeHtml(answer)}</p>
      </details>`
  ).join("\n");

  return `
    <main class="rf-prerender-landing">
      <nav class="rf-landing-nav" aria-label="Primary">
        <a class="rf-landing-brand" href="/">ReachFlyAI</a>
        <div>
          <a href="/">Platform</a>
          <a href="/blog">Guides</a>
          <a href="/login">Sign in</a>
          <a class="rf-landing-button" href="/signup">Get started</a>
        </div>
      </nav>

      <header class="rf-landing-hero">
        <p class="rf-landing-kicker">${escapeHtml(page.badge)}</p>
        <h1>${escapeHtml(page.h1)}</h1>
        <p class="rf-landing-intro">${escapeHtml(page.intro)}</p>
        <p><a class="rf-landing-button" href="/signup">Create your workspace</a></p>
      </header>

      <section class="rf-landing-section">
        <p class="rf-landing-eyebrow">Connected platform</p>
        <h2>From prospect discovery to the next real sales action.</h2>
        <p>ReachFly gives teams one place to find relevant businesses, build useful context, start conversations, and keep follow-up attached to the same prospect.</p>
        <div class="rf-landing-grid">${cards}</div>
      </section>

      <section class="rf-landing-focus">
        <p class="rf-landing-eyebrow">Why this workflow</p>
        <h2>${escapeHtml(page.focusTitle)}</h2>
        <p>${escapeHtml(page.focusText)}</p>
        <ul>
          <li>Business context stays attached to the lead.</li>
          <li>Calls, meetings, email, and pipeline activity remain visible.</li>
          <li>Owners and teams work inside the same workspace model.</li>
          <li>Customer-facing screens avoid unnecessary provider jargon.</li>
        </ul>
      </section>

      <section class="rf-landing-section">
        <p class="rf-landing-eyebrow">Operating sequence</p>
        <h2>A clearer path from market selection to measurable follow-up.</h2>
        <p>The product is organized around the actions a sales team actually takes instead of forcing every workflow through a collection of disconnected technical settings.</p>
        <div class="rf-landing-workflow">${workflow}</div>
      </section>

      <section class="rf-landing-section rf-landing-faq">
        <p class="rf-landing-eyebrow">FAQ</p>
        <h2>Common questions about ReachFly.</h2>
        ${faqs}
      </section>

      <section class="rf-landing-final">
        <h2>${escapeHtml(page.finalTitle)}</h2>
        <p>Start with a focused market, add the context your team needs, and keep every conversation and next action connected.</p>
        <p><a class="rf-landing-button" href="/signup">Get started</a> <a href="/blog">Read the guides</a></p>
      </section>
    </main>`;
}

function renderBlogIndex() {
  const categories = Array.from(
    new Set(BLOG_POSTS.map((post) => post.category).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const categoryLinks = categories
    .map(
      (category) =>
        `<a href="#${escapeAttribute(slugify(category))}">${escapeHtml(category)}</a>`
    )
    .join("");

  const grouped = categories
    .map((category) => {
      const posts = BLOG_POSTS.filter((post) => post.category === category);
      const cards = posts.map(renderBlogCard).join("\n");
      return `
        <section id="${escapeAttribute(slugify(category))}" class="rf-prerender-blog-category">
          <header>
            <h2>${escapeHtml(category)}</h2>
            <p>${posts.length} guide${posts.length === 1 ? "" : "s"}</p>
          </header>
          <div class="rf-prerender-blog-grid">${cards}</div>
        </section>`;
    })
    .join("\n");

  return `
    <main class="rf-prerender-blog-shell">
      <nav class="rf-prerender-topnav" aria-label="Primary">
        <a class="rf-prerender-brand" href="/">ReachFlyAI</a>
        <a href="/blog" aria-current="page">Blog</a>
        <a href="/signup">Start free</a>
      </nav>

      <header class="rf-prerender-blog-hero">
        <p class="rf-prerender-kicker">AI sales resources</p>
        <h1>AI sales automation and lead generation guides</h1>
        <p>Practical, evidence-led guides for prospecting, lead generation, outreach, AI calling, CRM workflows, website audits and sales operations.</p>
      </header>

      <nav class="rf-prerender-category-nav" aria-label="Blog categories">
        ${categoryLinks}
      </nav>

      ${grouped}
    </main>`;
}

function renderBlogCard(post) {
  return `
    <article class="rf-prerender-blog-card">
      <p class="rf-prerender-card-meta">${escapeHtml(post.category)} · ${escapeHtml(post.intent)}</p>
      <h3><a href="/blog/${escapeAttribute(post.slug)}">${escapeHtml(post.title)}</a></h3>
      <p>${escapeHtml(post.description)}</p>
      <small>Updated <time datetime="${escapeAttribute(post.updatedAt || post.publishedAt)}">${escapeHtml(formatHumanDate(post.updatedAt || post.publishedAt))}</time> · ${estimateReadingMinutes(post)} min read</small>
    </article>`;
}

function renderBlogPost(post, related, readingMinutes) {
  const toc = (post.sections || [])
    .map(
      (section) =>
        `<li><a href="#${escapeAttribute(slugify(section.heading))}">${escapeHtml(section.heading)}</a></li>`
    )
    .join("\n");

  const sections = (post.sections || [])
    .map(
      (section) => `
        <section id="${escapeAttribute(slugify(section.heading))}">
          <h2>${escapeHtml(section.heading)}</h2>
          ${renderParagraphs(section.body)}
        </section>`
    )
    .join("\n");

  const faqs = (post.faqs || [])
    .map(
      (faq) => `
        <details>
          <summary>${escapeHtml(faq.q)}</summary>
          <p>${escapeHtml(faq.a)}</p>
        </details>`
    )
    .join("\n");

  const relatedHtml = (related || [])
    .map(
      (item) => `
        <li>
          <a href="/blog/${escapeAttribute(item.slug)}">${escapeHtml(item.title)}</a>
          <small>${escapeHtml(item.category)}</small>
        </li>`
    )
    .join("\n");

  return `
    <main class="rf-prerender-blog-shell rf-prerender-blog-article">
      <nav class="rf-prerender-topnav" aria-label="Primary">
        <a class="rf-prerender-brand" href="/">ReachFlyAI</a>
        <a href="/blog">Blog</a>
        <a href="/signup">Start free</a>
      </nav>

      <nav class="rf-prerender-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span>›</span><a href="/blog">Blog</a><span>›</span><span>${escapeHtml(post.category)}</span>
      </nav>

      <article>
        <header class="rf-prerender-article-header">
          <p class="rf-prerender-kicker">${escapeHtml(post.category)} · ${escapeHtml(post.intent)}</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="rf-prerender-dek">${escapeHtml(post.description)}</p>
          <small>
            Updated <time datetime="${escapeAttribute(post.updatedAt || post.publishedAt)}">${escapeHtml(formatHumanDate(post.updatedAt || post.publishedAt))}</time>
            · ${readingMinutes} min read
          </small>
        </header>

        ${toc ? `<nav class="rf-prerender-toc" aria-label="Table of contents"><strong>In this guide</strong><ol>${toc}</ol></nav>` : ""}

        <div class="rf-prerender-article-body">
          ${sections}

          ${faqs ? `<section id="frequently-asked-questions"><h2>Frequently asked questions</h2>${faqs}</section>` : ""}

          ${relatedHtml ? `<aside class="rf-prerender-related"><h2>Related guides</h2><ul>${relatedHtml}</ul></aside>` : ""}

          <aside class="rf-prerender-cta">
            <h2>Turn research into an actionable sales workflow</h2>
            <p>ReachFly connects lead discovery, evidence-based audits, outreach, AI Voice, follow-up and CRM context in one sales workspace.</p>
            <a href="/signup">Explore ReachFly</a>
          </aside>
        </div>
      </article>
    </main>`;
}

function renderParagraphs(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
}

function renderSitemap() {
  const urls = [];

  for (const route of STATIC_INDEXABLE_ROUTES) {
    urls.push({
      loc: `${SITE}${route === "/" ? "/" : route}`,
      lastmod: newestBlogDate,
    });
  }

  for (const post of BLOG_POSTS) {
    urls.push({
      loc: `${SITE}/blog/${post.slug}`,
      lastmod: post.updatedAt || post.publishedAt || newestBlogDate,
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ loc, lastmod }) => `  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>\n`;
}

function renderRobotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /app/",
    "Disallow: /api/",
    "Disallow: /login",
    "",
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ].join("\n");
}

function renderRssFeed() {
  const posts = [...BLOG_POSTS]
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt || b.publishedAt || 0) -
        Date.parse(a.updatedAt || a.publishedAt || 0)
    )
    .slice(0, 50);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ReachFlyAI Blog</title>
    <link>${SITE}/blog</link>
    <description>AI sales automation, lead generation, outbound, CRM and AI calling guides.</description>
    <language>en-us</language>
    ${posts
      .map((post) => {
        const url = `${SITE}/blog/${post.slug}`;
        return `<item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.updatedAt || post.publishedAt).toUTCString()}</pubDate>
    </item>`;
      })
      .join("\n    ")}
  </channel>
</rss>\n`;
}

function writeRoute(route, html) {
  const relative = route.replace(/^\/+/, "").replace(/\/+$/, "");
  const directory = path.join(DIST_DIR, relative);

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), html, "utf8");
}

function writeRootFile(filename, contents) {
  fs.writeFileSync(path.join(DIST_DIR, filename), contents, "utf8");
}

function estimateReadingMinutes(post) {
  return Math.max(1, Math.ceil(countPostWords(post) / 220));
}

function countPostWords(post) {
  const text = [
    post.title,
    post.description,
    ...(post.sections || []).flatMap((section) => [section.heading, section.body]),
    ...(post.faqs || []).flatMap((faq) => [faq.q, faq.a]),
  ]
    .filter(Boolean)
    .join(" ");

  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function buildArticleKeywords(post) {
  return Array.from(
    new Set(
      [
        post.category,
        post.intent,
        ...String(post.title || "")
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((word) => word.length >= 4),
      ].filter(Boolean)
    )
  )
    .slice(0, 12)
    .join(", ");
}

function cleanDescription(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= 165 ? text : `${text.slice(0, 161).trim()}…`;
}

function newestDate(values) {
  const dates = values
    .filter(Boolean)
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time);
  return dates[0]?.value || new Date().toISOString().slice(0, 10);
}

function absoluteUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `${SITE}${text.startsWith("/") ? text : `/${text}`}`;
}

function slugify(value) {
  return String(value || "section")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function formatHumanDate(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return String(value || "");
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(time));
}


function criticalLandingCss() {
  return `
    .rf-prerender-landing{max-width:1220px;margin:0 auto;padding:0 22px 72px;color:#191c1d;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .rf-landing-nav{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid #e4e5e9}.rf-landing-nav>div{display:flex;align-items:center;gap:16px}.rf-landing-nav a{color:#4c4d57;text-decoration:none;font-size:14px}.rf-landing-brand{font-weight:800!important;color:#171923!important;font-size:18px!important}
    .rf-landing-button{display:inline-flex;align-items:center;justify-content:center;padding:11px 16px!important;border-radius:9px;background:#4648d4;color:#fff!important;text-decoration:none;font-weight:700}
    .rf-landing-hero{padding:72px 0 64px;max-width:900px}.rf-landing-kicker,.rf-landing-eyebrow{color:#5658dc;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.rf-landing-hero h1{margin:10px 0 16px;font-size:clamp(40px,6vw,68px);line-height:1.02;letter-spacing:-.045em}.rf-landing-intro{max-width:760px;color:#5e606d;font-size:19px;line-height:1.7}
    .rf-landing-section,.rf-landing-focus,.rf-landing-final{padding:56px 0}.rf-landing-section>h2,.rf-landing-focus>h2,.rf-landing-final>h2{max-width:850px;margin:8px 0 12px;font-size:clamp(30px,4vw,46px);line-height:1.1;letter-spacing:-.035em}.rf-landing-section>p:not(.rf-landing-eyebrow),.rf-landing-focus>p:not(.rf-landing-eyebrow),.rf-landing-final>p{max-width:780px;color:#626572;font-size:16px;line-height:1.7}
    .rf-landing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:28px}.rf-landing-card{padding:22px;border:1px solid #e3e4e8;border-radius:14px;background:#fff}.rf-landing-card h3{margin:0 0 8px;font-size:18px}.rf-landing-card p{margin:0;color:#6a6c78;line-height:1.6}
    .rf-landing-focus{padding-left:30px;padding-right:30px;border-radius:18px;background:#f7f7ff}.rf-landing-focus ul{display:grid;gap:10px;padding-left:20px;color:#4f515e}
    .rf-landing-workflow{display:grid;gap:10px;margin-top:28px}.rf-landing-step{display:grid;grid-template-columns:44px 1fr;gap:14px;padding:18px 0;border-top:1px solid #ececf0}.rf-landing-step>span{color:#7779df;font-weight:800}.rf-landing-step h3{margin:0 0 6px}.rf-landing-step p{margin:0;color:#6b6d79;line-height:1.6}
    .rf-landing-faq details{padding:16px 0;border-top:1px solid #ececf0}.rf-landing-faq summary{cursor:pointer;font-weight:700}.rf-landing-faq details p{color:#626572;line-height:1.65}
    .rf-landing-final{margin-top:24px;padding:46px 34px;border-radius:18px;background:#2e3132;color:#fff}.rf-landing-final>p{color:rgba(255,255,255,.72)}.rf-landing-final a:not(.rf-landing-button){margin-left:12px;color:#d7d8ff}
    @media(max-width:800px){.rf-landing-nav>div>a:not(.rf-landing-button){display:none}.rf-landing-grid{grid-template-columns:1fr}.rf-landing-hero{padding-top:50px}.rf-landing-focus,.rf-landing-final{padding-left:22px;padding-right:22px}}
  `;
}

function criticalBlogCss() {
  return `
    .rf-prerender-blog-shell{max-width:1120px;margin:0 auto;padding:28px 22px 72px;color:#191c1d;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .rf-prerender-topnav{display:flex;align-items:center;gap:18px;margin-bottom:46px}.rf-prerender-topnav a{color:#4c4d57;text-decoration:none;font-size:14px}.rf-prerender-topnav .rf-prerender-brand{margin-right:auto;color:#171923;font-weight:800;font-size:18px}
    .rf-prerender-blog-hero{max-width:820px;margin-bottom:28px}.rf-prerender-kicker{color:#5658dc;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.rf-prerender-blog-hero h1,.rf-prerender-article-header h1{margin:8px 0 12px;font-size:clamp(34px,5vw,58px);line-height:1.04;letter-spacing:-.04em}.rf-prerender-blog-hero>p:last-child,.rf-prerender-dek{color:#666976;font-size:18px;line-height:1.65}
    .rf-prerender-category-nav{display:flex;flex-wrap:wrap;gap:8px;margin:26px 0 40px}.rf-prerender-category-nav a{padding:8px 12px;border:1px solid #e3e4e8;border-radius:999px;color:#4d4f5c;text-decoration:none;font-size:12px;background:#fff}
    .rf-prerender-blog-category{margin:42px 0}.rf-prerender-blog-category>header{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}.rf-prerender-blog-category h2{margin:0;font-size:26px}.rf-prerender-blog-category>header p{margin:0;color:#8a8c97;font-size:12px}
    .rf-prerender-blog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.rf-prerender-blog-card{padding:20px;border:1px solid #e4e5e9;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(20,24,31,.04)}.rf-prerender-blog-card h3{margin:7px 0 9px;font-size:19px;line-height:1.3}.rf-prerender-blog-card h3 a{color:#1d1f27;text-decoration:none}.rf-prerender-blog-card>p:not(.rf-prerender-card-meta){color:#696b78;line-height:1.65}.rf-prerender-card-meta,.rf-prerender-blog-card small{color:#858793;font-size:11px}
    .rf-prerender-blog-article{max-width:920px}.rf-prerender-breadcrumb{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px;color:#858793;font-size:12px}.rf-prerender-breadcrumb a{color:#5b5ddc;text-decoration:none}.rf-prerender-article-header{margin-bottom:30px}.rf-prerender-article-header small{color:#858793}.rf-prerender-toc{margin:28px 0;padding:18px 20px;border:1px solid #e3e4e8;border-radius:14px;background:#fafafd}.rf-prerender-toc ol{margin:10px 0 0;padding-left:20px}.rf-prerender-toc li{margin:6px 0}.rf-prerender-toc a{color:#4b4dcf;text-decoration:none}
    .rf-prerender-article-body{max-width:760px}.rf-prerender-article-body section{margin:34px 0}.rf-prerender-article-body h2{font-size:28px;line-height:1.2;letter-spacing:-.025em}.rf-prerender-article-body p{color:#4f515e;font-size:17px;line-height:1.78}.rf-prerender-article-body details{margin:10px 0;padding:14px 16px;border:1px solid #e4e5e9;border-radius:12px}.rf-prerender-article-body summary{cursor:pointer;font-weight:700}.rf-prerender-related,.rf-prerender-cta{margin-top:42px;padding:22px;border:1px solid #e2e3e8;border-radius:16px;background:#fafafd}.rf-prerender-related ul{display:grid;gap:10px;padding:0;list-style:none}.rf-prerender-related li{display:grid;gap:2px}.rf-prerender-related a{color:#3f41c8;font-weight:700;text-decoration:none}.rf-prerender-related small{color:#858793}.rf-prerender-cta{background:linear-gradient(135deg,#f7f7ff,#fff)}.rf-prerender-cta a{display:inline-flex;margin-top:8px;padding:10px 14px;border-radius:9px;background:#4648d4;color:#fff;text-decoration:none;font-weight:700}
    @media(max-width:720px){.rf-prerender-blog-shell{padding:20px 16px 56px}.rf-prerender-blog-grid{grid-template-columns:1fr}.rf-prerender-topnav{margin-bottom:30px}.rf-prerender-blog-hero h1,.rf-prerender-article-header h1{font-size:36px}.rf-prerender-dek,.rf-prerender-blog-hero>p:last-child{font-size:16px}.rf-prerender-article-body p{font-size:16px}}
  `;
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
