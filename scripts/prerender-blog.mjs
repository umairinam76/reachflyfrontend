import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  BLOG_POSTS,
} from "../src/content/blog-posts.js";

const SITE =
  "https://www.reachflyai.com";

const SCRIPT_DIR =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );

const WEB_ROOT =
  path.resolve(
    SCRIPT_DIR,
    ".."
  );

const DIST_DIR =
  path.resolve(
    process.env.REACHFLY_WEB_DIST ||
      path.join(
        WEB_ROOT,
        "dist"
      )
  );

const INDEX_FILE =
  path.join(
    DIST_DIR,
    "index.html"
  );

if (
  !fs.existsSync(
    INDEX_FILE
  )
) {
  console.error(
    `ReachFly prerender skipped: build output was not found at ${INDEX_FILE}. Run the normal Vite build before this script.`
  );
  process.exit(1);
}

const baseHtml =
  fs.readFileSync(
    INDEX_FILE,
    "utf8"
  );

if (
  !baseHtml.includes(
    "</head>"
  ) ||
  !baseHtml.includes(
    "</body>"
  )
) {
  console.error(
    "ReachFly prerender failed: dist/index.html is not a complete HTML document."
  );
  process.exit(2);
}

const uniqueSlugs =
  new Set(
    BLOG_POSTS.map(
      (post) =>
        post.slug
    )
  );

if (
  uniqueSlugs.size !==
  BLOG_POSTS.length
) {
  console.error(
    "ReachFly prerender failed: duplicate blog slugs were found."
  );
  process.exit(3);
}

const blogIndexHtml =
  renderDocument({
    baseHtml,
    title:
      "ReachFlyAI Blog | AI Sales, Lead Generation & Outreach Guides",
    description:
      "Practical ReachFly guides for AI sales automation, lead generation, CRM workflows, website audits, calling, outreach and sales operations.",
    canonical:
      `${SITE}/blog`,
    bodyHtml:
      renderBlogIndex(),
    jsonLd: {
      "@context":
        "https://schema.org",
      "@type":
        "CollectionPage",
      name:
        "ReachFlyAI Blog",
      url:
        `${SITE}/blog`,
      publisher: {
        "@type":
          "Organization",
        name:
          "ReachFlyAI",
        url:
          SITE,
      },
    },
  });

writeRoute(
  "/blog",
  blogIndexHtml
);

for (
  const post of
  BLOG_POSTS
) {
  const canonical =
    `${SITE}/blog/${post.slug}`;

  const html =
    renderDocument({
      baseHtml,
      title:
        `${post.title} | ReachFlyAI`,
      description:
        post.description,
      canonical,
      bodyHtml:
        renderBlogPost(post),
      jsonLd: {
        "@context":
          "https://schema.org",
        "@type":
          "Article",
        headline:
          post.title,
        description:
          post.description,
        datePublished:
          post.publishedAt,
        dateModified:
          post.updatedAt ||
          post.publishedAt,
        mainEntityOfPage:
          canonical,
        author: {
          "@type":
            "Organization",
          name:
            "ReachFlyAI",
        },
        publisher: {
          "@type":
            "Organization",
          name:
            "ReachFlyAI",
          url:
            SITE,
        },
      },
    });

  writeRoute(
    `/blog/${post.slug}`,
    html
  );
}

console.log(
  `ReachFly prerender complete: ${BLOG_POSTS.length} article pages plus /blog written to ${DIST_DIR}`
);

function renderDocument({
  baseHtml,
  title,
  description,
  canonical,
  bodyHtml,
  jsonLd,
}) {
  let html =
    stripManagedSeo(
      baseHtml
    );

  const head = [
    `<title data-reachfly-prerender="true">${escapeHtml(title)}</title>`,
    `<meta data-reachfly-prerender="true" name="description" content="${escapeAttribute(description)}">`,
    `<meta data-reachfly-prerender="true" name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">`,
    `<meta data-reachfly-prerender="true" property="og:type" content="article">`,
    `<meta data-reachfly-prerender="true" property="og:site_name" content="ReachFlyAI">`,
    `<meta data-reachfly-prerender="true" property="og:title" content="${escapeAttribute(title)}">`,
    `<meta data-reachfly-prerender="true" property="og:description" content="${escapeAttribute(description)}">`,
    `<meta data-reachfly-prerender="true" property="og:url" content="${escapeAttribute(canonical)}">`,
    `<meta data-reachfly-prerender="true" name="twitter:card" content="summary_large_image">`,
    `<meta data-reachfly-prerender="true" name="twitter:title" content="${escapeAttribute(title)}">`,
    `<meta data-reachfly-prerender="true" name="twitter:description" content="${escapeAttribute(description)}">`,
    `<link data-reachfly-prerender="true" rel="canonical" href="${escapeAttribute(canonical)}">`,
    `<script data-reachfly-prerender="true" type="application/ld+json">${safeJson(jsonLd)}</script>`,
  ].join("\n    ");

  html = html.replace(
    "</head>",
    `    ${head}\n  </head>`
  );

  html = html.replace(
    /<div\s+id=["']root["']\s*>[\s\S]*?<\/div>/i,
    `<div id="root">${bodyHtml}</div>`
  );

  return html;
}

function stripManagedSeo(value) {
  return String(value)
    .replace(
      /<title(?:\s[^>]*)?>[\s\S]*?<\/title>/gi,
      ""
    )
    .replace(
      /<meta\s+[^>]*(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi,
      ""
    )
    .replace(
      /<link\s+[^>]*rel=["']canonical["'][^>]*>/gi,
      ""
    )
    .replace(
      /<script\s+[^>]*data-reachfly-prerender=["']true["'][^>]*>[\s\S]*?<\/script>/gi,
      ""
    );
}

function renderBlogIndex() {
  const cards =
    BLOG_POSTS.map(
      (post) => `
        <article class="rf-prerender-blog-card">
          <p>${escapeHtml(post.category)} · ${escapeHtml(post.intent)}</p>
          <h2><a href="/blog/${escapeAttribute(post.slug)}">${escapeHtml(post.title)}</a></h2>
          <p>${escapeHtml(post.description)}</p>
          <small>Updated ${escapeHtml(post.updatedAt || post.publishedAt)} · ${Number(post.readingMinutes || 0)} min read</small>
        </article>`
    ).join("\n");

  return `
    <main class="rf-prerender-blog-shell">
      <header>
        <a href="/">ReachFlyAI</a>
        <p>AI sales resources</p>
        <h1>Practical guides for modern sales teams</h1>
        <p>Evidence-led articles about lead generation, sales automation, CRM workflows, calling, website audits and outbound operations.</p>
      </header>
      <section aria-label="ReachFly articles">${cards}</section>
    </main>`;
}

function renderBlogPost(post) {
  const sections =
    (post.sections || [])
      .map(
        (section) => `
          <section>
            <h2>${escapeHtml(section.heading)}</h2>
            <p>${escapeHtml(section.body)}</p>
          </section>`
      )
      .join("\n");

  const faqs =
    (post.faqs || [])
      .map(
        (faq) => `
          <details>
            <summary>${escapeHtml(faq.q)}</summary>
            <p>${escapeHtml(faq.a)}</p>
          </details>`
      )
      .join("\n");

  return `
    <main class="rf-prerender-blog-shell rf-prerender-blog-article">
      <nav aria-label="Breadcrumb"><a href="/">ReachFlyAI</a> / <a href="/blog">Blog</a> / ${escapeHtml(post.category)}</nav>
      <article>
        <header>
          <p>${escapeHtml(post.category)} · ${escapeHtml(post.intent)}</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p>${escapeHtml(post.description)}</p>
          <small>Updated ${escapeHtml(post.updatedAt || post.publishedAt)} · ${Number(post.readingMinutes || 0)} min read</small>
        </header>
        ${sections}
        <section>
          <h2>Frequently asked questions</h2>
          ${faqs}
        </section>
        <aside>
          <h2>Turn research into an actionable sales workflow</h2>
          <p>ReachFly connects lead discovery, evidence-based audits, caller workflows, outreach and sales operations in one workspace.</p>
          <a href="/signup">Explore ReachFly</a>
        </aside>
      </article>
    </main>`;
}

function writeRoute(
  route,
  html
) {
  const relative =
    route
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

  const directory =
    path.join(
      DIST_DIR,
      relative
    );

  fs.mkdirSync(
    directory,
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    path.join(
      directory,
      "index.html"
    ),
    html,
    "utf8"
  );
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
  return escapeHtml(value)
    .replace(/`/g, "&#096;");
}
