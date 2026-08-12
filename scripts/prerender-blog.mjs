import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLOG_POSTS } from "../src/content/blog-posts.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const dist = path.join(webRoot, "dist");
const templatePath = path.join(dist, "index.html");
if (!fs.existsSync(templatePath)) {
  console.warn("[prerender-blog] dist/index.html not found; run after vite build.");
  process.exit(0);
}
const template = fs.readFileSync(templatePath, "utf8");
const escape = (value) => String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
for (const post of BLOG_POSTS) {
  const canonical = `https://www.reachflyai.com/blog/${post.slug}`;
  const schema = JSON.stringify({"@context":"https://schema.org","@type":"Article",headline:post.title,description:post.description,datePublished:post.publishedAt,dateModified:post.updatedAt,mainEntityOfPage:canonical,author:{"@type":"Organization",name:"ReachFly.Ai"},publisher:{"@type":"Organization",name:"ReachFly.Ai"}}).replace(/</g,"\\u003c");
  const body = `<article><h1>${escape(post.title)}</h1><p>${escape(post.description)}</p>${post.sections.map(s=>`<section><h2>${escape(s.heading)}</h2><p>${escape(s.body)}</p></section>`).join("")}</article>`;
  let html = template
    .replace(/<title>[^<]*<\/title>/i, `<title>${escape(post.title)} | ReachFly.Ai</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, "")
    .replace("</head>", `<meta name="description" content="${escape(post.description)}"><link rel="canonical" href="${canonical}"><script type="application/ld+json">${schema}</script></head>`)
    .replace(/<div\s+id=["']root["']\s*><\/div>/i, `<div id="root">${body}</div>`);
  const target = path.join(dist, "blog", post.slug);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "index.html"), html);
}
console.log(`[prerender-blog] generated ${BLOG_POSTS.length} static blog entry pages.`);
