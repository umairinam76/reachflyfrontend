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
  `ReachFly SEO prerender complete: ${BLOG_POSTS.length} article pages + /blog + sitemap.xml + robots.txt + rss.xml written to ${DIST_DIR}`
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
    `<link data-reachfly-prerender="true" rel="alternate" type="application/rss+xml" title="ReachFlyAI Blog RSS" href="${RSS_URL}">`,
    `<script data-reachfly-prerender="true" type="application/ld+json">${safeJson(jsonLd)}</script>`,
    `<style data-reachfly-prerender="true">${criticalBlogCss()}</style>`,
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
